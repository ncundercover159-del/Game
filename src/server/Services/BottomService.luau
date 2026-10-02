--[[
	BottomService: orchestrates the bottom event once HoleService has moved
	the hole into "Revealing" (that transition is the exactly-once guard).

	  Revealing  (Config.Hole.RevealSeconds): every client plays the reveal.
	  rewards    contributors get permanent Hole Breaker credit + title (absent
	             contributors receive it on their next join); everyone present
	             gets a share of Shards and XP.
	  Resetting  (Config.Hole.ResetSeconds): the hole refills.
	  Digging    HoleService.NextCycle(): deeper target, new seed, cleared
	             contributions, banked digs credited.
]]

local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local Format = require(Shared.Util.Format)
local Net = require(Shared.Net)

local Services = script.Parent
local function svc(name)
	return require(Services[name])
end

local BottomService = {}

BottomService.FireCount = {} -- [cycle] = how many times the event started (must be 1)
BottomService.Speed = 1 -- tests and debug can fast-forward the timeline

local SHARDS_FOR_EVERYONE = 50
local XP_FOR_EVERYONE = 200

function BottomService.Grant(cycle: number)
	local HoleService = svc("HoleService")
	local DataService = svc("DataService")
	local contributors = HoleService.TopContributors(math.huge)
	local credited = 0
	for _, row in contributors do
		local player = Players:GetPlayerByUserId(row.UserId)
		local data = player and DataService.Get(player)
		if data then
			data.Stats.HolesBroken += 1
			data.Titles.holebreaker = true
			player:SetAttribute("HoleBreaker", true)
			DataService.MarkDirty(player)
			credited += 1
		else
			-- They left before the reveal: deliver the credit on their next join.
			task.spawn(function()
				local ok, err = pcall(svc("GiftService").Queue, row.UserId, {
					Id = string.format("HB:%s:%d", game.JobId, cycle),
					Kind = "HoleBreaker",
					T = os.time(),
				})
				if not ok then
					warn("[Bottom] could not queue Hole Breaker credit: " .. tostring(err))
				end
			end)
		end
	end
	for _, player in Players:GetPlayers() do
		if DataService.Get(player) then
			svc("ShardService").Add(player, SHARDS_FOR_EVERYONE, "Bottom")
			svc("SeasonService").AddXP(player, XP_FOR_EVERYONE, "Bottom")
			DataService.Push(player)
		end
	end
	return credited
end

local function run(cycle: number, source)
	local HoleService = svc("HoleService")
	local breaker = source and source.Name or "the server"
	local contributors = HoleService.TopContributors(10)
	Net.Event("HoleEvent"):FireAllClients({
		Type = "Bottom",
		Phase = "Revealing",
		Cycle = cycle,
		Breaker = breaker,
		Contributors = contributors,
		Seconds = Config.Hole.RevealSeconds / BottomService.Speed,
	})
	svc("FeedService").Post({
		Kind = "Bottom",
		Tier = 6,
		Text = string.format(
			"%s broke through! This server reached the bottom of hole #%d (%s)!",
			breaker,
			cycle,
			Format.ExactMetres(HoleService.Target)
		),
		Announce = true,
	})
	task.wait(Config.Hole.RevealSeconds / BottomService.Speed)

	BottomService.Grant(cycle)
	HoleService.SetState("Resetting")
	Net.Event("HoleEvent"):FireAllClients({
		Type = "Bottom",
		Phase = "Resetting",
		Cycle = cycle,
		Seconds = Config.Hole.ResetSeconds / BottomService.Speed,
	})
	task.wait(Config.Hole.ResetSeconds / BottomService.Speed)

	HoleService.NextCycle()
	svc("FeedService").Post({
		Kind = "Bottom",
		Tier = 5,
		Text = string.format(
			"Hole #%d begins! Target: %s. New find seed: %d.",
			HoleService.Cycle,
			Format.ExactMetres(HoleService.Target),
			HoleService.Seed
		),
	})
end

function BottomService.Init()
	svc("HoleService").BottomReached:Connect(function(cycle, source)
		BottomService.FireCount[cycle] = (BottomService.FireCount[cycle] or 0) + 1
		if BottomService.FireCount[cycle] > 1 then
			warn("[Bottom] duplicate bottom event for cycle " .. cycle .. " ignored")
			return
		end
		local ok, err = pcall(run, cycle, source)
		if not ok then
			warn("[Bottom] reveal failed: " .. tostring(err) .. " (forcing the next cycle)")
			if svc("HoleService").State ~= "Digging" then
				svc("HoleService").NextCycle()
			end
		end
	end)
end

return BottomService
