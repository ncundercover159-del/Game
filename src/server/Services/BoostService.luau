--[[
	BoostService: free-path multipliers.
	  * Personal Free-Dig Boost: expiry timestamp in the profile, so it
	    survives rejoins and server hops. Buying again extends it.
	  * Server Boost: lives in this server only; the buyer is named in the feed
	    and wears a "Server Hero" tag while it runs.
	  * Total stacking (2x pass x personal x server x Club) is capped at
	    Config.Boosts.StackCap by Economy.FreeMultiplier.
	Remaining time is shown as plain information only.
]]

local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local Economy = require(Shared.Economy)
local Format = require(Shared.Util.Format)
local Net = require(Shared.Net)

local Services = script.Parent
local function svc(name)
	return require(Services[name])
end

local BoostService = {}

BoostService.Server = { Until = 0, HeroUserId = nil, HeroName = nil }

function BoostService.PersonalActive(player: Player): boolean
	local data = svc("DataService").Get(player)
	return data ~= nil and (data.Boosts.PersonalExpiry or 0) > os.time()
end

function BoostService.ServerActive(): boolean
	return BoostService.Server.Until > os.time()
end

function BoostService.Flags(player: Player)
	local Entitlements = svc("EntitlementService")
	return {
		FreePass = Entitlements.Has(player, "pass_2xfree"),
		Personal = BoostService.PersonalActive(player),
		Server = BoostService.ServerActive(),
		Club = Entitlements.IsClub(player),
	}
end

function BoostService.Multiplier(player: Player, source: string): number
	return Economy.FreeMultiplier(source, BoostService.Flags(player))
end

function BoostService.AddPersonal(player: Player, seconds: number): number
	local DataService = svc("DataService")
	local data = DataService.Get(player)
	assert(data, "AddPersonal: profile not loaded")
	local now = os.time()
	data.Boosts.PersonalExpiry = math.max(now, data.Boosts.PersonalExpiry or 0) + seconds
	DataService.MarkDirty(player)
	DataService.Push(player)
	svc("Analytics").LogServer("BoostActivated", { "Personal", tostring(seconds) }, player)
	return data.Boosts.PersonalExpiry
end

function BoostService.PublicState()
	return {
		ServerUntil = BoostService.Server.Until,
		HeroName = BoostService.Server.HeroName,
		Now = os.time(),
	}
end

local function setHero(userId: number?, on: boolean)
	if not userId then
		return
	end
	local player = Players:GetPlayerByUserId(userId)
	if player then
		player:SetAttribute("ServerHero", on)
	end
end

function BoostService.AddServer(buyer: Player, seconds: number): number
	local now = os.time()
	local server = BoostService.Server
	if server.HeroUserId and server.HeroUserId ~= buyer.UserId then
		setHero(server.HeroUserId, false)
	end
	server.Until = math.max(now, server.Until) + seconds
	server.HeroUserId = buyer.UserId
	server.HeroName = buyer.DisplayName
	setHero(buyer.UserId, true)
	Net.Event("HoleEvent"):FireAllClients({ Type = "ServerBoost", Boost = BoostService.PublicState() })
	svc("FeedService").Post({
		Kind = "Boost",
		Tier = 4,
		Text = string.format(
			"%s started a Server Boost! Everyone here gets x%d free-path metres for %s.",
			buyer.DisplayName,
			Config.Boosts.ServerMultiplier,
			Format.Duration(seconds)
		),
		Announce = true,
	})
	svc("Analytics").LogServer("BoostActivated", { "Server", tostring(seconds) }, buyer)
	return server.Until
end

function BoostService.Start()
	task.spawn(function()
		local wasActive = false
		while true do
			task.wait(1)
			local active = BoostService.ServerActive()
			if wasActive and not active then
				setHero(BoostService.Server.HeroUserId, false)
				BoostService.Server.HeroUserId = nil
				BoostService.Server.HeroName = nil
				Net.Event("HoleEvent"):FireAllClients({ Type = "ServerBoost", Boost = BoostService.PublicState() })
			end
			wasActive = active
		end
	end)
end

return BoostService
