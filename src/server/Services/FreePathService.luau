--[[
	FreePathService: everything that moves the hole without Robux.

	* Passive Auto-Digger trickle for every player (level rate x boosts),
	  credited every Config.Free.PassiveTickSeconds; clients show it as
	  "+0.1 m" floaties leaving the player's bay.
	* Dig Energy: one token bucket per player shared by every ACTIVE source
	  (dig stations, obbies, minigames). Any mix of activities is bounded by
	  the bucket's refill rate, and overflow becomes Season XP.
	* The Crew's tiny population-scaled rate (never anyone's contribution).
	* Daily reward with a 7-day streak.
]]

local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local Economy = require(Shared.Economy)
local Net = require(Shared.Net)

local Services = script.Parent
local function svc(name)
	return require(Services[name])
end

local FreePathService = {}

local buckets = {} -- [Player] = Economy bucket

local function bucketFor(player: Player)
	local bucket = buckets[player]
	if not bucket then
		bucket = Economy.NewBucket(os.clock())
		buckets[player] = bucket
	end
	return bucket
end

function FreePathService.Energy(player: Player)
	local bucket = bucketFor(player)
	Economy.RefillBucket(bucket, os.clock())
	return {
		Tokens = math.floor(bucket.Tokens * 100) / 100,
		Capacity = Config.Free.ActiveBucketCapacity,
		RatePerMinute = Config.Free.ActiveRatePerMinute,
	}
end

local function creditStats(player: Player, base: number, metres: number)
	local DataService = svc("DataService")
	local data = DataService.Get(player)
	if not data then
		return
	end
	data.Stats.LifetimeMetres += base
	data.Stats.FreeMetres += metres
	local seasonId = Config.Season.Id
	data.Stats.SeasonMetres[seasonId] = (data.Stats.SeasonMetres[seasonId] or 0) + base
	DataService.MarkDirty(player)
	svc("LeaderboardService").MarkDirty(player)
end

--[[
	Grants active free-path metres from the Dig Energy bucket.
	source: "Station" | "Obby" | "Minigame"
	Returns { Base, Metres, Multiplier, Overflow }
]]
function FreePathService.GrantActive(player: Player, source: string, baseWant: number)
	local granted = Economy.TakeFromBucket(bucketFor(player), baseWant, os.clock())
	local overflow = math.max(0, baseWant - granted)
	local multiplier = svc("BoostService").Multiplier(player, source)
	local metres = granted * multiplier
	if granted > 0 then
		svc("HoleService").AddMetres(metres, {
			Kind = source,
			UserId = player.UserId,
			Name = player.DisplayName,
			Base = granted,
		})
		creditStats(player, granted, metres)
	end
	if overflow > 0 then
		svc("SeasonService").AddXP(player, math.ceil(overflow * 10), "Overflow")
	end
	return { Base = granted, Metres = metres, Multiplier = multiplier, Overflow = overflow }
end

------------------------------------------------------------------------------
-- Passive trickle
------------------------------------------------------------------------------
function FreePathService.PassiveTick(seconds: number)
	local HoleService = svc("HoleService")
	local DataService = svc("DataService")
	local Entitlements = svc("EntitlementService")
	local floaties = {}
	for _, player in Players:GetPlayers() do
		local data = DataService.Get(player)
		if data then
			local base = Economy.PassiveBaseRate(data.AutoDiggerLevel, Entitlements.Has(player, "pass_autoboost")) / 60 * seconds
			local metres = base * svc("BoostService").Multiplier(player, "Passive")
			HoleService.AddMetres(metres, {
				Kind = "Passive",
				UserId = player.UserId,
				Name = player.DisplayName,
				Base = base,
			})
			creditStats(player, base, metres)
			table.insert(floaties, { player.UserId, math.floor(metres * 100 + 0.5) / 100 })
		end
	end
	if #floaties > 0 then
		Net.Event("Floaty"):FireAllClients(floaties)
	end
end

function FreePathService.CrewTick(seconds: number)
	local metres = Economy.CrewRate(#Players:GetPlayers()) / 60 * seconds
	svc("HoleService").AddMetres(metres, { Kind = "Crew", Name = "the Crew", Contributes = false })
end

------------------------------------------------------------------------------
-- Daily reward
------------------------------------------------------------------------------
local function today(): number
	return math.floor(os.time() / 86400)
end

function FreePathService.ClaimDaily(player: Player)
	local DataService = svc("DataService")
	local data = DataService.Get(player)
	if not data then
		return { ok = false, reason = "Your data is still loading." }
	end
	local day = today()
	if (data.Daily.LastDay or 0) >= day then
		return { ok = false, reason = "Already claimed today. Come back tomorrow!", nextIn = (day + 1) * 86400 - os.time() }
	end
	local streak = 1
	if data.Daily.LastDay == day - 1 then
		streak = math.min((data.Daily.Streak or 0) + 1, 7)
	end
	data.Daily.LastDay = day
	data.Daily.Streak = streak
	local base = Config.Free.Daily.Metres[streak]
	local multiplier = svc("BoostService").Multiplier(player, "Daily")
	local metres = base * multiplier
	svc("HoleService").AddMetres(metres, {
		Kind = "Daily",
		UserId = player.UserId,
		Name = player.DisplayName,
		Base = base,
	})
	creditStats(player, base, metres)
	svc("ShardService").Add(player, Config.Free.Daily.Shards[streak], "Daily")
	svc("SeasonService").AddXP(player, Config.Free.Daily.XP[streak], "Daily")
	DataService.Push(player)
	return { ok = true, streak = streak, metres = metres, shards = Config.Free.Daily.Shards[streak] }
end

function FreePathService.Init()
	Players.PlayerRemoving:Connect(function(player)
		buckets[player] = nil
	end)
end

function FreePathService.Start()
	task.spawn(function()
		while true do
			task.wait(Config.Free.PassiveTickSeconds)
			FreePathService.PassiveTick(Config.Free.PassiveTickSeconds)
		end
	end)
	task.spawn(function()
		while true do
			task.wait(Config.Crew.TickSeconds)
			FreePathService.CrewTick(Config.Crew.TickSeconds)
		end
	end)
end

return FreePathService
