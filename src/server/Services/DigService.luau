--[[
	DigService: performs a dig (paid, gifted, Starter Pack, Club perk,
	delivery or debug). Metres are credited to the hole immediately; the
	visual sequence is broadcast to every client, whose Dig Director plays,
	queues or tickers it. Visuals can never delay or drop metres.

	The dig is staged at the free rim "dig spot" nearest the performer, so
	overlapping digs spread around the hole.
]]

local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local Catalog = require(Shared.Catalog)
local Format = require(Shared.Util.Format)
local HoleMath = require(Shared.HoleMath)
local DigSequences = require(Shared.DigSequences)
local Net = require(Shared.Net)

local Services = script.Parent
local function svc(name)
	return require(Services[name])
end

local DigService = {}

local spotBusyUntil = {}
local digCounter = 0

local function performerPosition(player: Player?): Vector3?
	if not player then
		return nil
	end
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	return root and root.Position or nil
end

function DigService.PickSpot(position: Vector3?, duration: number): number
	local now = os.clock()
	local best, bestScore = 1, math.huge
	for index = 1, Config.World.DigSpots do
		local spot = HoleMath.DigSpot(index)
		local busy = (spotBusyUntil[index] or 0) > now
		local distance = position and (Vector3.new(spot.X, 0, spot.Z) - Vector3.new(position.X, 0, position.Z)).Magnitude or index
		local score = distance + (busy and 10000 or 0)
		if score < bestScore then
			best, bestScore = index, score
		end
	end
	spotBusyUntil[best] = now + duration
	return best
end

--[[
	info = {
	  Item = catalog item (Dig),
	  Buyer = { UserId, Name },      -- credited on leaderboards
	  Performer = Player?            -- whose character performs it (nil = buyer, or absent)
	  PerformerInfo = { UserId, Name }?,
	  Gift = boolean?, Dedication = string?,
	  Kind = "Purchase" | "Gift" | "Starter" | "Club" | "Delivery" | "Compensation" | "Debug",
	  CountsForPool = boolean?,
	  Contributes = boolean?,
	}
	Returns { Applied, Banked, DigId, Metres }
]]
function DigService.Perform(info)
	local item = info.Item
	assert(item and item.Category == "Dig", "DigService.Perform needs a Dig item")
	local HoleService = svc("HoleService")
	digCounter += 1
	local digId = string.format("%s-%d", game.JobId:sub(1, 8), digCounter)
	local metres = item.Effect.Metres
	local buyer = info.Buyer

	local applied, banked = HoleService.AddMetres(metres, {
		Kind = "Dig",
		UserId = buyer and buyer.UserId or nil,
		Name = buyer and buyer.Name or nil,
		Base = metres,
		ItemId = item.Id,
		DigId = digId,
		Contributes = info.Contributes ~= false,
	})

	-- Visual staging
	local performer = info.Performer
	local performerInfo = info.PerformerInfo
		or (performer and { UserId = performer.UserId, Name = performer.DisplayName })
		or buyer
	local skin, effect = "skin_classic", nil
	local styleSource = performer or (buyer and Players:GetPlayerByUserId(buyer.UserId))
	if styleSource then
		local data = svc("DataService").Get(styleSource)
		if data then
			skin = data.Equipped.ToolSkin or skin
			effect = data.Equipped.DigEffect or nil
		end
	end
	local sequence = DigSequences.Get(item.Id)
	local duration = sequence and sequence.Duration or 6
	local spot = DigService.PickSpot(performerPosition(performer), duration)

	local event = {
		Type = "Dig",
		DigId = digId,
		ItemId = item.Id,
		Metres = metres,
		Spot = spot,
		Performer = performerInfo and performerInfo.UserId or nil,
		PerformerName = performerInfo and performerInfo.Name or "Someone",
		Buyer = buyer and buyer.UserId or nil,
		BuyerName = buyer and buyer.Name or nil,
		Gift = info.Gift == true,
		Dedication = info.Dedication,
		Skin = skin,
		Effect = effect,
		Banked = banked > 0 and applied == 0,
		Depth = HoleService.Depth,
		Target = HoleService.Target,
		Kind = info.Kind or "Purchase",
	}
	Net.Event("HoleEvent"):FireAllClients(event)

	-- Feed
	local who = buyer and buyer.Name or "Someone"
	local text
	if info.Gift and performerInfo and buyer and performerInfo.UserId ~= buyer.UserId then
		text = string.format("%s gifted %s a %s  +%s", who, performerInfo.Name, item.Name, Format.ExactMetres(metres))
	elseif info.Kind == "Club" then
		text = string.format("%s used their daily Club Pebble Toss  +%s", who, Format.ExactMetres(metres))
	else
		text = string.format("%s  %s  +%s", who, item.Name, Format.ExactMetres(metres))
	end
	if event.Banked then
		text ..= " (banked for the next hole)"
	end
	if info.Dedication and info.Dedication ~= "" then
		text ..= string.format('  "%s"', info.Dedication)
	end
	svc("FeedService").Post({
		Kind = "Dig",
		Text = text,
		Tier = item.Tier,
		ItemId = item.Id,
		Announce = item.Price >= Config.Social.ChatAnnounceMinPrice,
		BigOne = item.Id == "dig_bigone",
		BuyerName = who,
	})

	-- Community Dig Pool fills only from real Robux dig spend.
	if info.CountsForPool then
		svc("PoolService").Add(item.Price, who)
	end

	return { Applied = applied, Banked = banked, DigId = digId, Metres = metres }
end

-- Credits a buyer's persistent stats for a dig they paid for (or gifted).
function DigService.CreditBuyerStats(player: Player, metres: number)
	local DataService = svc("DataService")
	local data = DataService.Get(player)
	if not data then
		return
	end
	data.Stats.LifetimeMetres += metres
	local seasonId = Config.Season.Id
	data.Stats.SeasonMetres[seasonId] = (data.Stats.SeasonMetres[seasonId] or 0) + metres
	data.Stats.Digs += 1
	if metres > data.Stats.BiggestDig then
		data.Stats.BiggestDig = metres
	end
	DataService.MarkDirty(player)
	svc("LeaderboardService").MarkDirty(player)
end

return DigService
