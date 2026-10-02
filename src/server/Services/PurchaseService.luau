--[[
	PurchaseService: purchase requests, the single ProcessReceipt handler,
	and Studio test-mode receipts.

	Request flow
	  client RequestPurchase(itemId, { GiftTo, Dedication, Surface })
	  -> server validates (ownership, order, recipient, filtering)
	  -> records exactly ONE pending prompt per player (so a receipt's context
	     is never ambiguous)
	  -> Roblox purchase prompt (or, in Studio test mode, a test confirmation
	     that produces a simulated receipt for the very same handler)

	ProcessReceipt (all Developer Products)
	  1. route ProductId through the Catalog
	  2. player not here / profile not loaded -> NotProcessedYet
	  3. PurchaseId already in the ledger -> re-confirm save -> PurchaseGranted
	  4. apply the grant (Grants), save gift recipients first
	  5. record PurchaseId + Recent Purchases row in the buyer's profile
	  6. save; PurchaseGranted only after the save succeeded
]]

local HttpService = game:GetService("HttpService")
local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local Catalog = require(Shared.Catalog)
local Format = require(Shared.Util.Format)
local Net = require(Shared.Net)
local TextFilter = require(script.Parent.Parent.Lib.TextFilter)

local Services = script.Parent
local function svc(name)
	return require(Services[name])
end

local PurchaseService = {}

local GRANTED = Enum.ProductPurchaseDecision.PurchaseGranted
local NOT_YET = Enum.ProductPurchaseDecision.NotProcessedYet

local pending = {} -- [Player] = context (one per player)
local contexts = {} -- [purchaseId] = context, kept until the receipt is granted
local inFlight = {} -- [purchaseId] = true while a receipt is being processed
local lastTestReceipt = {} -- [Player] = receipt (debug replay)
local tokenCounter = 0

PurchaseService.PriceOverrides = {} -- [itemId] = real PriceInRobux

------------------------------------------------------------------------------
-- Pending prompt context
------------------------------------------------------------------------------
local function currentPending(player: Player)
	local ctx = pending[player]
	if ctx and os.clock() - ctx.Clock > Config.Social.PendingPromptTimeout then
		pending[player] = nil
		return nil
	end
	return ctx
end

function PurchaseService.ClearPending(player: Player, productId: number?)
	local ctx = pending[player]
	if ctx and (productId == nil or ctx.ProductId == productId) then
		pending[player] = nil
	end
end

function PurchaseService.HasPending(player: Player): boolean
	return currentPending(player) ~= nil
end

-- The context for a receipt: remembered per PurchaseId so a NotProcessedYet
-- retry keeps the same gift target / dedication.
local function contextFor(player: Player, receipt)
	local purchaseId = tostring(receipt.PurchaseId)
	local ctx = contexts[purchaseId]
	if ctx then
		return ctx
	end
	local p = pending[player]
	if p and p.ProductId == receipt.ProductId then
		pending[player] = nil
		contexts[purchaseId] = p
		return p
	end
	return nil
end

------------------------------------------------------------------------------
-- Validation
------------------------------------------------------------------------------
function PurchaseService.Validate(player: Player, item, options)
	options = options or {}
	if not item then
		return false, "That item doesn't exist."
	end
	if item.Purchase ~= "DevProduct" and item.Purchase ~= "GamePass" and item.Purchase ~= "Subscription" then
		return false, "That item isn't sold for Robux."
	end
	if not Config.IsTestMode() and not item.HasRealId then
		return false, "This item isn't available yet."
	end
	if item.Purchase == "Subscription" and not Config.Subscription.Enabled then
		return false, "The Deep Diver Club isn't open yet."
	end
	local DataService = svc("DataService")
	local data = DataService.Get(player)
	if not data then
		return false, "Your data is still loading."
	end
	local Entitlements = svc("EntitlementService")

	-- Gift target
	local recipient, recipientData = nil, nil
	if options.GiftTo then
		if not Catalog.IsGiftable(item) then
			return false, "This item can't be gifted."
		end
		if options.GiftTo == player.UserId then
			return false, "Pick someone else to gift to."
		end
		recipient = Players:GetPlayerByUserId(options.GiftTo)
		recipientData = recipient and DataService.Get(recipient)
		if not recipient or not recipientData then
			return false, "That player isn't in this server any more."
		end
		if item.Ownership == "OneTime" and recipientData.Owned[item.Id] then
			return false, recipient.DisplayName .. " already owns this."
		end
	else
		-- Self purchase ownership rules
		if item.Ownership == "OneTime" or item.Ownership == "Pass" then
			if Entitlements.Has(player, item.Id) then
				return false, "You already own this."
			end
		end
		if item.Category == "AutoDigger" and data.AutoDiggerLevel ~= item.Effect.Level - 1 then
			if data.AutoDiggerLevel >= item.Effect.Level then
				return false, "You already own this level."
			end
			return false, string.format("Buy Lv%d first (levels go in order).", item.Effect.Level - 1)
		end
		if item.Category == "TierSkip" and svc("SeasonService").Tier(player) >= Config.Season.Tiers then
			return false, "You've already reached the final tier."
		end
		if item.Category == "Club" and Entitlements.IsClub(player) then
			return false, "You're already in the Deep Diver Club."
		end
	end
	return true, nil, recipient
end

------------------------------------------------------------------------------
-- Requests
------------------------------------------------------------------------------
function PurchaseService.Request(player: Player, itemId: string, options)
	options = options or {}
	local item = Catalog.Get(itemId)
	local ok, reason, recipient = PurchaseService.Validate(player, item, options)
	if not ok then
		return { ok = false, reason = reason }
	end
	if currentPending(player) then
		return { ok = false, reason = "Finish your current purchase first." }
	end

	-- Dedicate a Dig (free with digs of 100 R$ or more), filtered.
	local dedication = nil
	if options.Dedication and options.Dedication ~= "" then
		if item.Category ~= "Dig" or item.Price < Config.Social.DedicationMinPrice then
			return { ok = false, reason = "Dedications come with digs of R$ 100 or more." }
		end
		local clean = Format.CleanLine(options.Dedication, Config.Social.DedicationMaxChars)
		dedication = TextFilter.ForBroadcast(clean, player.UserId)
		if dedication == nil then
			return { ok = false, reason = "We couldn't check that message. Try again or leave it blank." }
		end
	end

	tokenCounter += 1
	local ctx = {
		Token = string.format("%d-%d", player.UserId, tokenCounter),
		ItemId = item.Id,
		ProductId = item.ProductId,
		GamePassId = item.GamePassId,
		GiftTo = recipient and recipient.UserId or nil,
		GiftToName = recipient and recipient.DisplayName or nil,
		Dedication = dedication,
		Clock = os.clock(),
		Surface = options.Surface,
	}
	pending[player] = ctx

	local Analytics = svc("Analytics")
	if recipient then
		Analytics.Funnel(player, "GiftStarted", item.Category, item.Id, item.Price, options.Surface)
	end
	Analytics.Funnel(player, "PromptShown", item.Category, item.Id, item.Price, options.Surface)

	if Config.IsTestMode() then
		Net.Event("PromptTest"):FireClient(player, {
			Token = ctx.Token,
			ItemId = item.Id,
			Price = item.Price,
			GiftToName = ctx.GiftToName,
			Dedication = dedication,
		})
		return { ok = true, test = true, token = ctx.Token }
	end

	if item.Purchase == "GamePass" then
		MarketplaceService:PromptGamePassPurchase(player, item.GamePassId)
	elseif item.Purchase == "Subscription" then
		MarketplaceService:PromptSubscriptionPurchase(player, item.SubscriptionId)
	else
		MarketplaceService:PromptProductPurchase(player, item.ProductId)
	end
	return { ok = true }
end

------------------------------------------------------------------------------
-- Studio test mode: the stand-in for the Roblox purchase prompt
------------------------------------------------------------------------------
function PurchaseService.MakeTestReceipt(player: Player, item)
	return {
		PlayerId = player.UserId,
		ProductId = item.ProductId,
		PurchaseId = "TEST-" .. HttpService:GenerateGUID(false),
		CurrencySpent = item.Price,
		CurrencyType = Enum.CurrencyType.Robux,
		PlaceIdWherePurchased = game.PlaceId,
	}
end

function PurchaseService.TestDecision(player: Player, token: string, accepted: boolean)
	if not Config.IsTestMode() then
		return { ok = false, reason = "Test purchases only work in Studio test mode." }
	end
	local ctx = currentPending(player)
	if not ctx or ctx.Token ~= token then
		return { ok = false, reason = "That purchase prompt expired." }
	end
	local item = Catalog.Get(ctx.ItemId)
	if not accepted then
		pending[player] = nil
		svc("Analytics").Funnel(player, "PurchaseCancelled", item.Category, item.Id, item.Price, ctx.Surface)
		return { ok = true, cancelled = true }
	end
	if item.Purchase == "GamePass" then
		pending[player] = nil
		svc("EntitlementService").GrantPass(player, item, "Test")
		return { ok = true, granted = true }
	elseif item.Purchase == "Subscription" then
		pending[player] = nil
		svc("EntitlementService").SetTestClub(player, true)
		return { ok = true, granted = true }
	end
	local receipt = PurchaseService.MakeTestReceipt(player, item)
	lastTestReceipt[player] = receipt
	local decision = PurchaseService.ProcessReceipt(receipt)
	return { ok = decision == GRANTED, granted = decision == GRANTED, purchaseId = receipt.PurchaseId }
end

-- Debug: deliver the same receipt again (must grant nothing).
function PurchaseService.ReplayLastTestReceipt(player: Player)
	local receipt = lastTestReceipt[player]
	if not receipt then
		return nil
	end
	return PurchaseService.ProcessReceipt(receipt), receipt.PurchaseId
end

------------------------------------------------------------------------------
-- The one ProcessReceipt
------------------------------------------------------------------------------
function PurchaseService.ProcessReceipt(receipt)
	local item = Catalog.ByProductId[receipt.ProductId]
	if not item then
		warn("[Purchase] receipt for unknown product " .. tostring(receipt.ProductId))
		return NOT_YET
	end
	local player = Players:GetPlayerByUserId(receipt.PlayerId)
	if not player then
		return NOT_YET -- Roblox retries when they next join
	end
	local DataService = svc("DataService")
	local data = DataService.WaitFor(player, 15)
	if not data then
		return NOT_YET
	end
	local purchaseId = tostring(receipt.PurchaseId)

	-- The same receipt can be delivered more than once (even concurrently).
	while inFlight[purchaseId] do
		task.wait(0.1)
	end
	if DataService.HasPurchase(player, purchaseId) then
		if DataService.IsPurchaseSaved(player, purchaseId) or DataService.SaveAsync(player) then
			contexts[purchaseId] = nil
			return GRANTED
		end
		return NOT_YET
	end

	inFlight[purchaseId] = true
	local ctx = contextFor(player, receipt)
	local ok, result = pcall(svc("Grants").Apply, player, item, ctx, purchaseId)
	if not ok then
		inFlight[purchaseId] = nil
		warn(string.format("[Purchase] grant failed for %s (%s): %s", item.Id, purchaseId, tostring(result)))
		return NOT_YET
	end

	-- Gift recipients are persisted before the buyer's ledger entry exists,
	-- so a retry re-saves them instead of skipping them.
	for _, other in result.MustSave or {} do
		if other.Parent and not DataService.SaveAsync(other) then
			inFlight[purchaseId] = nil
			return NOT_YET
		end
	end

	local price = receipt.CurrencySpent or item.Price
	DataService.RecordPurchase(player, purchaseId)
	data.Stats.RobuxSpent += price
	DataService.AddRecentPurchase(player, {
		T = os.time(),
		Id = item.Id,
		Name = item.Name,
		Price = price,
		Received = result.Received,
		To = ctx and ctx.GiftToName or nil,
		Test = purchaseId:sub(1, 5) == "TEST-",
	})
	local saved = DataService.SaveAsync(player)
	inFlight[purchaseId] = nil
	DataService.Push(player)
	if not saved then
		return NOT_YET
	end
	contexts[purchaseId] = nil
	svc("Analytics").Funnel(player, "PurchaseCompleted", item.Category, item.Id, price, ctx and ctx.Surface)
	Net.Event("Notify"):FireClient(player, { Kind = "Purchase", ItemId = item.Id, Text = result.Received })
	return GRANTED
end

------------------------------------------------------------------------------
-- Real prices (trust: the store shows what the prompt will charge)
------------------------------------------------------------------------------
local function loadRealPrices()
	for _, item in Catalog.Items do
		if item.HasRealId and item.Purchase == "DevProduct" then
			local ok, productInfo = pcall(MarketplaceService.GetProductInfo, MarketplaceService, item.ProductId, Enum.InfoType.Product)
			if ok and productInfo and productInfo.PriceInRobux then
				if productInfo.PriceInRobux ~= item.Price then
					warn(string.format("[Purchase] %s costs R$ %d in Creator Hub but R$ %d in the Catalog; showing the real price.", item.Id, productInfo.PriceInRobux, item.Price))
					PurchaseService.PriceOverrides[item.Id] = productInfo.PriceInRobux
				end
			end
		end
	end
end

function PurchaseService.Init()
	MarketplaceService.ProcessReceipt = PurchaseService.ProcessReceipt
	MarketplaceService.PromptProductPurchaseFinished:Connect(function(userId, productId, isPurchased)
		local player = Players:GetPlayerByUserId(userId)
		if not player then
			return
		end
		if not isPurchased then
			local ctx = pending[player]
			if ctx and ctx.ProductId == productId then
				pending[player] = nil
				local item = Catalog.ByProductId[productId]
				svc("Analytics").Funnel(player, "PurchaseCancelled", item and item.Category, item and item.Id, item and item.Price, ctx.Surface)
			end
		end
	end)
	Players.PlayerRemoving:Connect(function(player)
		pending[player] = nil
		lastTestReceipt[player] = nil
	end)
	task.spawn(loadRealPrices)
end

PurchaseService._GRANTED = GRANTED
PurchaseService._NOT_YET = NOT_YET

return PurchaseService
