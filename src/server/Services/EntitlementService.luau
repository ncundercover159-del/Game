--[[
	EntitlementService: what a player owns, and Game Pass / subscription flows.

	* Game Passes are granted on PromptGamePassPurchaseFinished and re-verified
	  with UserOwnsGamePassAsync on join. A confirmed pass is cached in the
	  profile so an API outage never removes something the player owns.
	* Deep Diver Club (Experience Subscription) is behind
	  Config.Subscription.Enabled; status is checked on join and on
	  Players.UserSubscriptionStatusChanged.
	* In Studio test mode, passes and the Club are simulated through the same
	  grant functions (no real ids needed).
]]

local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local Catalog = require(Shared.Catalog)
local Net = require(Shared.Net)

local Services = script.Parent
local function svc(name)
	return require(Services[name])
end

local EntitlementService = {}

local club = {} -- [Player] = boolean

function EntitlementService.Has(player: Player, itemId: string): boolean
	local item = Catalog.Get(itemId)
	if not item then
		return false
	end
	if item.Ownership == "Default" then
		return true
	end
	local data = svc("DataService").Get(player)
	if not data then
		return false
	end
	if item.Category == "AutoDigger" then
		return (data.AutoDiggerLevel or 0) >= item.Effect.Level
	elseif item.Category == "SeasonPass" then
		return data.Season.Id == Config.Season.Id and data.Season.Premium == true
	elseif item.Category == "Club" then
		return EntitlementService.IsClub(player)
	end
	return data.Owned[itemId] == true
end

function EntitlementService.IsClub(player: Player): boolean
	if Config.IsTestMode() then
		local data = svc("DataService").Get(player)
		if data and data.Flags.TestClub then
			return true
		end
	end
	return club[player] == true
end

local function applyAttributes(player: Player)
	player:SetAttribute("VIP", EntitlementService.Has(player, "pass_vip"))
	player:SetAttribute("Club", EntitlementService.IsClub(player))
end

-- Grants a Game Pass (real purchase, re-verification or test mode).
function EntitlementService.GrantPass(player: Player, item, source: string)
	local DataService = svc("DataService")
	local data = DataService.Get(player)
	if not data then
		return false
	end
	local already = data.Owned[item.Id] == true
	data.Owned[item.Id] = true
	if not already and (source == "Purchase" or source == "Test") then
		DataService.AddRecentPurchase(player, {
			T = os.time(),
			Id = item.Id,
			Name = item.Name,
			Price = item.Price,
			Received = item.Name .. " (Game Pass, permanent)",
			Test = source == "Test",
		})
		data.Stats.RobuxSpent += item.Price
		svc("FeedService").Post({
			Kind = "Info",
			Tier = item.Tier,
			Text = string.format("%s unlocked %s!", player.DisplayName, item.Name),
		})
		Net.Event("Notify"):FireClient(player, { Kind = "Purchase", Text = item.Name .. " unlocked. Thank you!" })
		svc("Analytics").LogServer("PurchaseCompleted", { item.Category, item.Id, tostring(item.Price) }, player)
	end
	applyAttributes(player)
	DataService.MarkDirty(player)
	DataService.Push(player)
	task.spawn(DataService.SaveAsync, player)
	return true
end

function EntitlementService.SetTestClub(player: Player, on: boolean)
	assert(Config.IsTestMode(), "SetTestClub is test-mode only")
	local data = svc("DataService").Get(player)
	if data then
		data.Flags.TestClub = on
		applyAttributes(player)
		svc("DataService").Push(player)
		svc("ClubService").CheckDaily(player)
	end
end

local function verifyPasses(player: Player)
	for _, item in Catalog.Items do
		if item.Purchase == "GamePass" and item.HasRealId then
			local ok, owns = pcall(MarketplaceService.UserOwnsGamePassAsync, MarketplaceService, player.UserId, item.GamePassId)
			if ok and owns then
				EntitlementService.GrantPass(player, item, "Verify")
			elseif not ok then
				warn("[Entitlements] UserOwnsGamePassAsync failed: " .. tostring(owns))
			end
		end
	end
end

local function checkSubscription(player: Player)
	if not Config.Subscription.Enabled then
		return
	end
	local item = Catalog.Get("club")
	if not item.HasRealId then
		return
	end
	local ok, status = pcall(MarketplaceService.GetUserSubscriptionStatusAsync, MarketplaceService, player, item.SubscriptionId)
	if ok and status then
		club[player] = status.IsSubscribed == true
	elseif not ok then
		warn("[Entitlements] subscription status failed: " .. tostring(status))
	end
	applyAttributes(player)
	svc("ClubService").CheckDaily(player)
end

function EntitlementService.Init()
	svc("DataService").Loaded:Connect(function(player)
		applyAttributes(player)
		verifyPasses(player)
		checkSubscription(player)
	end)
	MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(player, passId, purchased)
		svc("PurchaseService").ClearPending(player, nil)
		if not purchased then
			svc("Analytics").LogServer("PurchaseCancelled", { "GamePass", tostring(passId) }, player)
			return
		end
		local item = Catalog.ByGamePassId[passId]
		if item then
			EntitlementService.GrantPass(player, item, "Purchase")
		end
	end)
	pcall(function()
		MarketplaceService.PromptSubscriptionPurchaseFinished:Connect(function(player, _subscriptionId, _didTryPurchasing)
			svc("PurchaseService").ClearPending(player, nil)
			checkSubscription(player)
		end)
	end)
	pcall(function()
		Players.UserSubscriptionStatusChanged:Connect(function(player, _subscriptionId)
			checkSubscription(player)
		end)
	end)
	Players.PlayerRemoving:Connect(function(player)
		club[player] = nil
	end)
end

return EntitlementService
