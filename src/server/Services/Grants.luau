--[[
	Grants: applies a paid Developer Product to the right profile.

	Called only from PurchaseService.ProcessReceipt (real or simulated
	receipts share this path). Each function validates before mutating, so a
	thrown error leaves nothing half-granted.

	Returns { Received = "what the player got", MustSave = { players } }.
	MustSave lists other profiles (gift recipients) that must be saved before
	the buyer's ledger entry is recorded.

	Race handling: if a one-time item is already owned when its receipt
	arrives, the buyer gets the closest-value dig instead (logged). Robux is
	never taken for nothing.
]]

local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local Catalog = require(Shared.Catalog)
local Format = require(Shared.Util.Format)
local Net = require(Shared.Net)

local Services = script.Parent
local function svc(name)
	return require(Services[name])
end

local Grants = {}

local ONE_TIME_STYLE = {
	Skin = true,
	Plaque = true,
	PlaqueMessage = true,
	DigEffect = true,
	HardHat = true,
	Pet = true,
	Trail = true,
	Aura = true,
	Flag = true,
	Title = true,
	NameColor = true,
	Entrance = true,
}
Grants.OneTimeStyle = ONE_TIME_STYLE

local function info(player: Player)
	return { UserId = player.UserId, Name = player.DisplayName }
end

local function performDig(buyer: Player, item, performer: Player?, kind: string, extra)
	extra = extra or {}
	local DigService = svc("DigService")
	local result = DigService.Perform({
		Item = item,
		Buyer = info(buyer),
		Performer = performer or buyer,
		Gift = extra.Gift,
		Dedication = extra.Dedication,
		Kind = kind,
		CountsForPool = extra.CountsForPool,
	})
	DigService.CreditBuyerStats(buyer, item.Effect.Metres)
	return result
end

local function digText(item, result): string
	if result.Banked > 0 and result.Applied == 0 then
		return string.format("%s: +%s banked for the next hole", item.Name, Format.ExactMetres(item.Effect.Metres))
	end
	return string.format("%s: +%s to this server's hole", item.Name, Format.ExactMetres(item.Effect.Metres))
end

-- Closest-value dig for an item the buyer (or recipient) already owns.
function Grants.Compensate(buyer: Player, item, reason: string, ownerName: string?): string
	local dig = Catalog.ClosestDig(item.Price)
	local result = performDig(buyer, dig, buyer, "Compensation")
	warn(string.format("[Purchase] %s: %s already owned %s (%s); compensated with %s", buyer.Name, ownerName or "buyer", item.Id, reason, dig.Id))
	svc("Analytics").LogServer("PurchaseCompensated", { item.Id, dig.Id, reason }, buyer)
	return string.format(
		"%s already owned %s, so you got a %s dig instead (%s)",
		ownerName or "You",
		item.Name,
		dig.Name,
		digText(dig, result)
	)
end

local function grantOwned(player: Player, item, autoEquip: boolean)
	local data = svc("DataService").Get(player)
	data.Owned[item.Id] = true
	if autoEquip and item.Slot then
		svc("CosmeticsService").Equip(player, item.Slot, item.Id, true)
	end
end

------------------------------------------------------------------------------
-- Self purchases
------------------------------------------------------------------------------
function Grants.ApplySelf(buyer: Player, item, ctx)
	local DataService = svc("DataService")
	local data = DataService.Get(buyer)
	assert(data, "Grants: buyer profile not loaded")
	local category = item.Category

	if category == "Dig" then
		local result = performDig(buyer, item, buyer, "Purchase", {
			Dedication = ctx and ctx.Dedication or nil,
			CountsForPool = true,
		})
		return { Received = digText(item, result) }
	elseif category == "AutoDigger" then
		local level = item.Effect.Level
		if data.AutoDiggerLevel >= level then
			return { Received = Grants.Compensate(buyer, item, "level-owned") }
		end
		if data.AutoDiggerLevel ~= level - 1 then
			return { Received = Grants.Compensate(buyer, item, "level-order") }
		end
		data.AutoDiggerLevel = level
		svc("WorldService").RefreshBay(buyer)
		svc("FeedService").Post({
			Kind = "Info",
			Tier = item.Tier,
			Text = string.format("%s upgraded their Auto-Digger to %s!", buyer.DisplayName, item.Name),
		})
		return { Received = string.format("%s (%.1f m/min)", item.Name, item.Effect.RatePerMinute) }
	elseif category == "Boost" then
		local seconds = item.Effect.Seconds
		if item.Effect.Kind == "Personal" then
			local expiry = svc("BoostService").AddPersonal(buyer, seconds)
			return {
				Received = string.format(
					"x2 Free-Dig +%s (%s left)",
					Format.Duration(seconds),
					Format.Clock(expiry - os.time())
				),
			}
		end
		svc("BoostService").AddServer(buyer, seconds)
		return { Received = string.format("Server Boost x2 for everyone here, %s", Format.Duration(seconds)) }
	elseif ONE_TIME_STYLE[category] then
		if data.Owned[item.Id] then
			return { Received = Grants.Compensate(buyer, item, "owned") }
		end
		grantOwned(buyer, item, true)
		return { Received = item.Name .. (item.Slot and " (equipped)" or " (unlocked)") }
	elseif category == "SeasonPass" then
		if not svc("SeasonService").SetPremium(buyer) then
			return { Received = Grants.Compensate(buyer, item, "season-owned") }
		end
		return { Received = "Premium track unlocked for " .. Config.Season.Name }
	elseif category == "TierSkip" then
		local ok, tier = svc("SeasonService").SkipTier(buyer)
		if not ok then
			return { Received = Grants.Compensate(buyer, item, "max-tier") }
		end
		return { Received = string.format("Season tier %d completed", tier) }
	elseif category == "StarterPack" then
		if data.Owned.starter_pack then
			return { Received = Grants.Compensate(buyer, item, "owned") }
		end
		local lines = {}
		for _, id in item.Effect.Contents do
			local content = Catalog.Get(id)
			if content.Category == "Dig" then
				local result = performDig(buyer, content, buyer, "Starter")
				table.insert(lines, digText(content, result))
			elseif content.Category == "AutoDigger" then
				if data.AutoDiggerLevel >= content.Effect.Level then
					local dig = Catalog.ClosestDig(content.Price)
					local result = performDig(buyer, dig, buyer, "Starter")
					table.insert(lines, string.format("%s swapped for %s", content.Name, digText(dig, result)))
				else
					data.AutoDiggerLevel = content.Effect.Level
					svc("WorldService").RefreshBay(buyer)
					table.insert(lines, content.Name)
				end
			else
				if data.Owned[id] then
					local dig = Catalog.ClosestDig(content.Price)
					local result = performDig(buyer, dig, buyer, "Starter")
					table.insert(lines, string.format("%s swapped for %s", content.Name, digText(dig, result)))
				else
					grantOwned(buyer, content, true)
					table.insert(lines, content.Name)
				end
			end
		end
		data.Owned.starter_pack = true
		return { Received = "Starter Pack: " .. table.concat(lines, "; ") }
	end
	error("Grants: unhandled category " .. tostring(category))
end

------------------------------------------------------------------------------
-- Gifts
------------------------------------------------------------------------------
function Grants.ApplyGift(buyer: Player, item, ctx, purchaseId: string)
	local DataService = svc("DataService")
	local recipient = Players:GetPlayerByUserId(ctx.GiftTo)
	local recipientData = recipient and DataService.Get(recipient)
	local name = ctx.GiftToName or "your friend"

	if recipient and recipientData then
		if DataService.HasGiftReceipt(recipient, purchaseId) then
			-- Retry after a failed save: already delivered, just persist again.
			return { Received = string.format("Gift to %s: %s", name, item.Name), MustSave = { recipient } }
		end
		local received
		if item.Category == "Dig" then
			local result = performDig(buyer, item, recipient, "Gift", {
				Gift = true,
				Dedication = ctx.Dedication,
				CountsForPool = true,
			})
			received = "Gift to " .. name .. ": " .. digText(item, result)
		elseif ONE_TIME_STYLE[item.Category] then
			if recipientData.Owned[item.Id] then
				received = Grants.Compensate(buyer, item, "recipient-owned", name)
			else
				recipientData.Owned[item.Id] = true
				received = string.format("Gift to %s: %s", name, item.Name)
				svc("FeedService").Post({
					Kind = "Gift",
					Tier = item.Tier,
					Text = string.format("%s gifted %s %s!", buyer.DisplayName, name, item.Name),
				})
			end
		else
			error("Grants: " .. item.Id .. " is not giftable")
		end
		DataService.RecordGiftReceipt(recipient, purchaseId)
		DataService.MarkDirty(recipient)
		DataService.Push(recipient)
		Net.Event("Notify"):FireClient(recipient, {
			Kind = "Gift",
			ItemId = item.Id,
			Text = string.format("%s gifted you %s!", buyer.DisplayName, item.Name),
		})
		svc("Analytics").LogServer("GiftCompleted", { item.Category, item.Id, tostring(item.Price) }, buyer)
		return { Received = received, MustSave = { recipient } }
	end

	-- Recipient left before the receipt arrived: store the gift for their next join.
	svc("GiftService").Queue(ctx.GiftTo, {
		Id = purchaseId,
		Kind = item.Category == "Dig" and "DigGift" or "Item",
		ItemId = item.Id,
		FromUserId = buyer.UserId,
		FromName = buyer.DisplayName,
		T = os.time(),
	})
	if item.Category == "Dig" then
		-- The sender is credited on the leaderboards at purchase time.
		svc("DigService").CreditBuyerStats(buyer, item.Effect.Metres)
	end
	svc("Analytics").LogServer("GiftCompleted", { item.Category, item.Id, "queued" }, buyer)
	return { Received = string.format("Gift to %s: %s (delivered when they next join)", name, item.Name) }
end

function Grants.Apply(buyer: Player, item, ctx, purchaseId: string)
	if ctx and ctx.GiftTo and ctx.GiftTo ~= buyer.UserId then
		return Grants.ApplyGift(buyer, item, ctx, purchaseId)
	end
	return Grants.ApplySelf(buyer, item, ctx)
end

return Grants
