--[[
	GiftService: deliveries for players who were not in the server when
	something was meant for them.
	  * Gifts whose recipient left before the receipt arrived.
	  * Hole Breaker credit for contributors who left before the reveal.

	DataStore KD_PendingGifts_v1, key "u<userId>", value { Entries = { ... } }.
	Queue is idempotent by entry Id (PurchaseId). Delivery records each Id in
	the recipient's GiftReceipts ledger and saves BEFORE the entries are
	removed from the queue, so a crash can never lose or duplicate a gift.
]]

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local Catalog = require(Shared.Catalog)
local Net = require(Shared.Net)
local Store = require(script.Parent.Parent.Lib.Store)

local Services = script.Parent
local function svc(name)
	return require(Services[name])
end

local GiftService = {}

local store = nil
local function getStore()
	if not store then
		store = Store.Get(Config.Data.PendingGiftStore)
	end
	return store
end

local function keyFor(userId: number): string
	return "u" .. tostring(userId)
end

-- Throws if the entry could not be stored (ProcessReceipt then retries).
function GiftService.Queue(userId: number, entry)
	local ok, err = Store.Retry("queue gift", 3, function()
		getStore():UpdateAsync(keyFor(userId), function(old)
			old = old or { Entries = {} }
			old.Entries = old.Entries or {}
			for _, existing in old.Entries do
				if existing.Id == entry.Id then
					return old
				end
			end
			table.insert(old.Entries, entry)
			return old
		end)
	end)
	if not ok then
		error("Could not store pending gift: " .. tostring(err))
	end
end

local function apply(player: Player, data, entry)
	if entry.Kind == "DigGift" then
		local item = Catalog.Get(entry.ItemId)
		if item then
			task.delay(6, function()
				if player.Parent then
					svc("DigService").Perform({
						Item = item,
						Buyer = { UserId = entry.FromUserId, Name = entry.FromName },
						Performer = player,
						Gift = true,
						Kind = "Delivery",
					})
				end
			end)
		end
		return string.format("%s's gift arrived: a %s dig!", entry.FromName or "A friend", item and item.Name or "mystery")
	elseif entry.Kind == "Item" then
		local item = Catalog.Get(entry.ItemId)
		if not item then
			return nil
		end
		if data.Owned[item.Id] then
			local dig = Catalog.ClosestDig(item.Price)
			task.delay(6, function()
				if player.Parent then
					svc("DigService").Perform({
						Item = dig,
						Buyer = { UserId = entry.FromUserId, Name = entry.FromName },
						Performer = player,
						Gift = true,
						Kind = "Delivery",
					})
				end
			end)
			return string.format("%s gifted you %s (you already had it, so it became a %s dig)", entry.FromName or "A friend", item.Name, dig.Name)
		end
		data.Owned[item.Id] = true
		return string.format("%s gifted you %s while you were away!", entry.FromName or "A friend", item.Name)
	elseif entry.Kind == "HoleBreaker" then
		data.Stats.HolesBroken += 1
		data.Titles.holebreaker = true
		return "You helped break a hole while you were away: Hole Breaker credit added!"
	end
	return nil
end

function GiftService.Deliver(player: Player)
	local DataService = svc("DataService")
	local data = DataService.Get(player)
	if not data then
		return 0
	end
	local key = keyFor(player.UserId)
	local ok, value = Store.Retry("read gifts", 3, function()
		return getStore():GetAsync(key)
	end)
	if not ok or not value or not value.Entries or #value.Entries == 0 then
		return 0
	end
	local handled = {}
	local messages = {}
	for _, entry in value.Entries do
		if not DataService.HasGiftReceipt(player, entry.Id) then
			local message = apply(player, data, entry)
			DataService.RecordGiftReceipt(player, entry.Id)
			if message then
				table.insert(messages, message)
			end
		end
		handled[entry.Id] = true
	end
	if not DataService.SaveAsync(player) then
		return 0 -- entries stay queued; the receipts ledger prevents double grants next time
	end
	Store.Retry("clear gifts", 3, function()
		getStore():UpdateAsync(key, function(old)
			if not old or not old.Entries then
				return old
			end
			local remaining = {}
			for _, entry in old.Entries do
				if not handled[entry.Id] then
					table.insert(remaining, entry)
				end
			end
			old.Entries = remaining
			return old
		end)
	end)
	DataService.Push(player)
	for _, message in messages do
		Net.Event("Notify"):FireClient(player, { Kind = "Gift", Text = message })
	end
	return #messages
end

function GiftService.Init()
	svc("DataService").Loaded:Connect(function(player)
		GiftService.Deliver(player)
	end)
end

return GiftService
