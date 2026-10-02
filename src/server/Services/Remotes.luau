--[[
	Remotes: binds every client->server remote to its service, through
	RemoteGuard (rate limits + argument validation). The server decides what
	is owned, equipped and prompt-able; clients only request.
]]

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local RemoteGuard = require(script.Parent.Parent.Lib.RemoteGuard)

local V = RemoteGuard.V

local Services = script.Parent
local function svc(name)
	return require(Services[name])
end

local Remotes = {}

local function equipValue()
	-- An item id, or false to unequip.
	return function(value)
		if value == false then
			return true, false
		end
		return V.Id()(value)
	end
end

function Remotes.Snapshot(player: Player)
	local HoleService = svc("HoleService")
	return {
		Hole = HoleService.PublicState(true),
		Feed = svc("FeedService").History(),
		Boards = svc("LeaderboardService").Payload(),
		Artifacts = svc("FindService").Artifacts(),
		Pool = svc("PoolService").Public(),
		Boost = svc("BoostService").PublicState(),
		Prices = svc("PurchaseService").PriceOverrides,
		TestMode = Config.IsTestMode(),
		Energy = svc("FreePathService").Energy(player),
		ServerTime = os.time(),
	}
end

function Remotes.Profile(player: Player)
	local DataService = svc("DataService")
	local data = DataService.WaitFor(player, 20)
	if not data then
		return nil
	end
	local view = DataService.View(player)
	view.Energy = svc("FreePathService").Energy(player)
	view.Club = svc("EntitlementService").IsClub(player)
	view.SeasonTier = svc("SeasonService").Tier(player)
	return view
end

function Remotes.Init()
	RemoteGuard.OnInvoke("GetSnapshot", Remotes.Snapshot)
	RemoteGuard.OnInvoke("GetProfile", Remotes.Profile)

	RemoteGuard.OnInvoke("RequestPurchase", function(player, itemId, options)
		return svc("PurchaseService").Request(player, itemId, options)
	end, {
		V.Id(),
		V.Shape({
			GiftTo = V.Integer(-1e12, 1e12, true),
			Dedication = V.String(Config.Social.DedicationMaxChars, true),
			Surface = V.Id(true),
		}, true),
	})

	RemoteGuard.OnInvoke("TestPurchaseDecision", function(player, token, accepted)
		return svc("PurchaseService").TestDecision(player, token, accepted)
	end, { V.String(48), V.Boolean() })

	RemoteGuard.OnInvoke("Equip", function(player, slot, itemId)
		return svc("CosmeticsService").Equip(player, slot, itemId)
	end, { V.Id(), equipValue() })

	RemoteGuard.OnInvoke("ShardBuy", function(player, itemId)
		return svc("ShardService").Buy(player, itemId)
	end, { V.Id() })

	RemoteGuard.OnInvoke("ClaimDaily", function(player)
		return svc("FreePathService").ClaimDaily(player)
	end)

	RemoteGuard.OnInvoke("ClaimSeason", function(player, track, tier)
		return svc("SeasonService").Claim(player, track, tier)
	end, { V.OneOf({ "Free", "Premium" }), V.Integer(1, Config.Season.Tiers) })

	RemoteGuard.OnInvoke("SetText", function(player, kind, text)
		if kind == "PlaqueMessage" then
			return svc("CosmeticsService").SetPlaqueMessage(player, text)
		end
		return { ok = false, reason = "Unknown text." }
	end, { V.OneOf({ "PlaqueMessage" }), V.String(Config.Social.PlaqueMessageMaxChars * 2) })

	RemoteGuard.OnInvoke("SetPreference", function(player, key, value)
		return svc("CosmeticsService").SetPreference(player, key, value)
	end, { V.OneOf({ "FlagDesign", "NameColor" }), V.Integer(0, 32) })

	RemoteGuard.OnInvoke("LeaveStation", function(player)
		svc("StationService").Leave(player)
		return { ok = true }
	end)

	RemoteGuard.OnInvoke("Debug", function(player, command, args)
		return svc("DebugService").Run(player, command, args)
	end, { V.Id(), V.Any() })

	RemoteGuard.OnEvent("StationSwing", function(player)
		svc("StationService").Swing(player)
	end)

	RemoteGuard.OnEvent("Analytics", function(player, eventName, category, itemId, surface)
		svc("Analytics").FromClient(player, eventName, category, itemId, surface)
	end, { V.Id(), V.Id(true), V.Id(true), V.Id(true) })
end

return Remotes
