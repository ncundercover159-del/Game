--[[
	ShardService: the free currency. Shards are earned only by playing
	(obbies, minigames, dig stations, finds, daily reward, pool bonus) and
	spent on free-tier cosmetics. No code path converts Robux into Shards.
]]

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Catalog = require(Shared.Catalog)

local Services = script.Parent
local function svc(name)
	return require(Services[name])
end

local ShardService = {}

-- Sources allowed to mint Shards (anything else is a bug).
local ALLOWED_PREFIX = { "Find", "Station", "Obby", "Minigame", "Daily", "Pool", "Debug", "Bottom" }

local function allowed(reason: string): boolean
	for _, prefix in ALLOWED_PREFIX do
		if reason:sub(1, #prefix) == prefix then
			return true
		end
	end
	return false
end

function ShardService.Add(player: Player, amount: number, reason: string)
	assert(allowed(reason), "Shards may only come from play, not " .. tostring(reason))
	amount = math.floor(amount)
	if amount <= 0 then
		return
	end
	local DataService = svc("DataService")
	local data = DataService.Get(player)
	if not data then
		return
	end
	data.Shards += amount
	DataService.MarkDirty(player)
	DataService.Push(player)
	svc("Analytics").Economy(player, "Source", amount, data.Shards, reason)
end

-- Buys a Shard-priced cosmetic. Returns { ok, reason }.
function ShardService.Buy(player: Player, itemId: string)
	local item = Catalog.Get(itemId)
	if not item or item.Purchase ~= "Shards" or not item.ShardPrice then
		return { ok = false, reason = "That item isn't sold for Shards." }
	end
	local DataService = svc("DataService")
	local data = DataService.Get(player)
	if not data then
		return { ok = false, reason = "Your data is still loading." }
	end
	if data.Owned[itemId] then
		return { ok = false, reason = "You already own this." }
	end
	if data.Shards < item.ShardPrice then
		return { ok = false, reason = string.format("You need %d more Shards.", item.ShardPrice - data.Shards) }
	end
	data.Shards -= item.ShardPrice
	data.Owned[itemId] = true
	DataService.MarkDirty(player)
	svc("Analytics").Economy(player, "Sink", item.ShardPrice, data.Shards, "Shop:" .. itemId)
	if item.Slot then
		svc("CosmeticsService").Equip(player, item.Slot, itemId, true)
	end
	DataService.Push(player)
	return { ok = true }
end

return ShardService
