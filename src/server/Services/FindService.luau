--[[
	FindService: reacts to HoleService.FindUnearthed. Every player currently
	in the server receives the find in their Collection; the digger whose
	metres crossed it is credited as Finder in the feed. First discovery of a
	find type grants Shards; duplicates grant fewer.

	Also owns the Artifacts hall state: the six most valuable finds unearthed
	this cycle, padded with silhouettes of the most valuable still-buried
	placements (labelled with the depth to reach).
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

local FindService = {}

function FindService.ShardsFor(find, firstTime: boolean): number
	if firstTime then
		return find.FirstShards
	end
	return math.max(Config.Shards.DuplicateMin, math.floor(find.FirstShards * Config.Shards.DuplicateFraction))
end

-- Grants one find to one player. Returns (firstTime, shards).
function FindService.GrantTo(player: Player, find)
	local DataService = svc("DataService")
	local data = DataService.Get(player)
	if not data then
		return false, 0
	end
	local count = data.Collection[find.Id] or 0
	local first = count == 0
	data.Collection[find.Id] = count + 1
	data.CollectionValue += find.Value
	data.Stats.FindsUnearthed += 1
	local shards = FindService.ShardsFor(find, first)
	svc("ShardService").Add(player, shards, "Find:" .. find.Id)
	svc("SeasonService").AddXP(player, 10 * find.Tier, "Find")
	DataService.MarkDirty(player)
	DataService.Push(player)
	return first, shards
end

function FindService.Artifacts()
	local HoleService = svc("HoleService")
	local found, buried = {}, {}
	for _, p in HoleService.Placements do
		local find = Catalog.FindsById[p.FindId]
		local row = { FindId = p.FindId, Depth = p.Depth, Found = p.Unearthed, Value = find.Value, FinderName = p.FinderName }
		if p.Unearthed then
			table.insert(found, row)
		else
			table.insert(buried, row)
		end
	end
	local byValue = function(a, b)
		if a.Value == b.Value then
			return a.Depth < b.Depth
		end
		return a.Value > b.Value
	end
	table.sort(found, byValue)
	table.sort(buried, byValue)
	local pedestals = {}
	local seen = {}
	for _, row in found do
		if #pedestals >= 6 then
			break
		end
		if not seen[row.FindId] then
			seen[row.FindId] = true
			table.insert(pedestals, row)
		end
	end
	for _, row in buried do
		if #pedestals >= 6 then
			break
		end
		if not seen[row.FindId] then
			seen[row.FindId] = true
			table.insert(pedestals, row)
		end
	end
	return pedestals
end

local function onUnearthed(placement, source)
	local find = Catalog.FindsById[placement.FindId]
	if not find then
		return
	end
	for _, player in Players:GetPlayers() do
		local first, shards = FindService.GrantTo(player, find)
		Net.Event("Notify"):FireClient(player, {
			Kind = "Find",
			FindId = find.Id,
			Text = string.format(
				"%s %s! +%d Shards",
				first and "New find:" or "Found another",
				find.Name,
				shards
			),
			Tier = find.Tier,
		})
	end
	local finder = placement.FinderName or "the server"
	svc("FeedService").Post({
		Kind = "Find",
		FindId = find.Id,
		Tier = find.Tier,
		Text = string.format(
			"%s unearthed %s (%s) at %s! Everyone here gets it.",
			finder,
			find.Name,
			Format.Value(find.Value),
			Format.ExactMetres(placement.Depth)
		),
		Announce = find.Tier >= 5,
	})
	Net.Event("HoleEvent"):FireAllClients({
		Type = "Find",
		Index = placement.Index,
		FindId = find.Id,
		Depth = placement.Depth,
		FinderName = finder,
		Artifacts = FindService.Artifacts(),
	})
	svc("Analytics").LogServer("FindUnearthed", { find.Id, find.Rarity, source and source.Kind or "?" })
end

function FindService.Init()
	svc("HoleService").FindUnearthed:Connect(onUnearthed)
end

FindService._onUnearthed = onUnearthed

return FindService
