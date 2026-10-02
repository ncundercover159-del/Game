--[[
	PoolService: the Community Dig Pool (P2), shown in the world by the golden
	relic orb. It fills with the Robux value of dig purchases in this server.
	When it fills, a bonus cinematic plays and EVERY player here (free players
	included) gets bonus free metres, Shards and XP. No timer, no pressure:
	a pure social-proof feature.
]]

local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local Net = require(Shared.Net)

local Services = script.Parent
local function svc(name)
	return require(Services[name])
end

local PoolService = { Value = 0, Fills = 0 }

function PoolService.Public()
	return { Value = PoolService.Value, Fill = Config.Pool.FillRobux, Fills = PoolService.Fills, Enabled = Config.Pool.Enabled }
end

function PoolService.Payout()
	PoolService.Fills += 1
	local HoleService = svc("HoleService")
	for _, player in Players:GetPlayers() do
		local data = svc("DataService").Get(player)
		if data then
			local bonus = Config.Pool.BonusMetresPerPlayer
			HoleService.AddMetres(bonus, {
				Kind = "Pool",
				UserId = player.UserId,
				Name = player.DisplayName,
				Contributes = false, -- pool metres are a gift to everyone, not leaderboard contribution
			})
			data.Stats.FreeMetres += bonus
			svc("ShardService").Add(player, Config.Pool.BonusShards, "Pool")
			svc("SeasonService").AddXP(player, Config.Pool.BonusXP, "Pool")
		end
	end
	svc("FeedService").Post({
		Kind = "Pool",
		Tier = 5,
		Text = string.format(
			"The Community Dig Pool overflowed! Everyone here gets +%d m, +%d Shards and +%d XP.",
			Config.Pool.BonusMetresPerPlayer,
			Config.Pool.BonusShards,
			Config.Pool.BonusXP
		),
		Announce = true,
	})
	Net.Event("HoleEvent"):FireAllClients({ Type = "PoolFill", Pool = PoolService.Public() })
end

function PoolService.Add(robux: number, _buyerName: string?)
	if not Config.Pool.Enabled or robux <= 0 then
		return
	end
	PoolService.Value += robux
	while PoolService.Value >= Config.Pool.FillRobux do
		PoolService.Value -= Config.Pool.FillRobux
		PoolService.Payout()
	end
	Net.Event("HoleEvent"):FireAllClients({ Type = "Pool", Pool = PoolService.Public() })
end

return PoolService
