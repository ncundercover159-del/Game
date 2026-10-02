--[[
	EconomySim: deterministic time-to-bottom simulation driven by the real
	Config, Economy and Catalog modules (loaded through the test runtime), so
	the tables in docs/DESIGN.md can never drift from the game's numbers.

	Model (1-second steps):
	  * Passive: every player's Auto-Digger rate (level, Auto-Dig Boost) times
	    the capped free multiplier.
	  * Active: "active" players dig at exactly the Dig Energy refill rate
	    (Config.Free.ActiveRatePerMinute), the most any free activity mix can
	    sustain. Worst-case scenarios also spend a full Dig Energy bucket and the
	    best daily reward at t = 0.
	  * Server Boost uptime is modelled as on for the first u% of every
	    15-minute window. Personal boosts are held by a fixed share of players.
	  * Digs: a server-wide Robux-per-hour budget spent on a fixed tier mix.
	  * Community Dig Pool fills from dig spend and pays every player.
	  * Crew: Economy.CrewRate(players).
]]

local EconomySim = {}

-- Fraction of dig spend per tier (sums to 1). Reflects many small impulse
-- buys and occasional big ones.
EconomySim.DigMix = {
	dig_pebble = 0.06,
	dig_shovel = 0.05,
	dig_pickaxe = 0.07,
	dig_jackhammer = 0.08,
	dig_dynamite = 0.12,
	dig_excavator = 0.12,
	dig_megadrill = 0.12,
	dig_tbm = 0.13,
	dig_orbital = 0.10,
	dig_nuke = 0.08,
	dig_bigone = 0.07,
}

-- Spending profiles. DigRobuxPerHourPer10 scales with population.
EconomySim.Profiles = {
	FreeOnly = {
		Name = "Free-only",
		ActiveShare = 0.5,
		Levels = { 0 },
		FreePassShare = 0,
		AutoBoostShare = 0,
		PersonalShare = 0,
		ServerUptime = 0,
		DigRobuxPerHourPer10 = 0,
	},
	Light = {
		Name = "Light spending",
		ActiveShare = 0.5,
		Levels = { 0, 0, 1, 1, 2 },
		FreePassShare = 0.1,
		AutoBoostShare = 0.05,
		PersonalShare = 0.1,
		ServerUptime = 0.2,
		DigRobuxPerHourPer10 = 600,
	},
	Moderate = {
		Name = "Moderate spending",
		ActiveShare = 0.5,
		Levels = { 0, 1, 2, 2, 3 },
		FreePassShare = 0.25,
		AutoBoostShare = 0.15,
		PersonalShare = 0.25,
		ServerUptime = 0.6,
		DigRobuxPerHourPer10 = 1800,
	},
	Lively = {
		Name = "Lively spending",
		ActiveShare = 0.55,
		Levels = { 1, 2, 3, 3, 4 },
		FreePassShare = 0.4,
		AutoBoostShare = 0.3,
		PersonalShare = 0.4,
		ServerUptime = 1.0,
		DigRobuxPerHourPer10 = 4000,
	},
	MaxedFree = {
		Name = "Free-only, all Lv5 + both rate passes, everyone active (worst case)",
		ActiveShare = 1.0,
		Levels = { 5 },
		FreePassShare = 1.0,
		AutoBoostShare = 1.0,
		PersonalShare = 0,
		ServerUptime = 0,
		DigRobuxPerHourPer10 = 0,
		WorstCaseBursts = true,
	},
}

local function share(index: number, n: number, fraction: number): boolean
	-- Deterministic: the first round(fraction * n) players have the trait.
	return index <= math.floor(fraction * n + 0.5)
end

function EconomySim.Run(deps, profile, playerCount: number, options)
	options = options or {}
	local Config, Economy, Catalog = deps.Config, deps.Economy, deps.Catalog
	local target = options.Target or Config.Hole.TargetDepthMetres
	local dt = 1
	local players = {}
	for i = 1, playerCount do
		local levels = profile.Levels
		table.insert(players, {
			Level = levels[((i - 1) % #levels) + 1],
			AutoBoost = share(i, playerCount, profile.AutoBoostShare),
			FreePass = share(i, playerCount, profile.FreePassShare),
			Personal = share(i, playerCount, profile.PersonalShare),
			-- active share counted from the other end so traits overlap realistically
			Active = (playerCount - i + 1) <= math.floor(profile.ActiveShare * playerCount + 0.5),
		})
	end

	local depth = 0
	local freeMetres, paidMetres, crewMetres, poolMetres = 0, 0, 0, 0
	local contribution = 0
	local pool = 0
	local digBudget = 0
	local digQueue = {}
	for id, fraction in EconomySim.DigMix do
		table.insert(digQueue, { item = Catalog.Get(id), fraction = fraction, budget = 0 })
	end
	table.sort(digQueue, function(a, b)
		return a.item.Price < b.item.Price
	end)
	local robuxPerSecond = profile.DigRobuxPerHourPer10 * (playerCount / 10) / 3600

	-- t = 0 one-offs
	for _, p in players do
		local flags = { FreePass = p.FreePass }
		local dailyIndex = profile.WorstCaseBursts and 7 or 1
		local daily = Config.Free.Daily.Metres[dailyIndex] * Economy.FreeMultiplier("Daily", flags)
		depth += daily
		freeMetres += daily
		if profile.WorstCaseBursts and p.Active then
			local burst = Config.Free.ActiveBucketCapacity * Economy.FreeMultiplier("Station", flags)
			depth += burst
			freeMetres += burst
		end
	end

	local t = 0
	local limit = options.LimitSeconds or 72 * 3600
	while depth < target and t < limit do
		t += dt
		local serverOn = profile.ServerUptime > 0
			and ((t % Config.Boosts.ServerBoostSeconds) < profile.ServerUptime * Config.Boosts.ServerBoostSeconds)
		for _, p in players do
			local flags = { FreePass = p.FreePass, Personal = p.Personal, Server = serverOn }
			local passiveBase = Economy.PassiveBaseRate(p.Level, p.AutoBoost) / 60 * dt
			local passive = passiveBase * Economy.FreeMultiplier("Passive", flags)
			depth += passive
			freeMetres += passive
			contribution += passiveBase
			if p.Active then
				local activeBase = Config.Free.ActiveRatePerMinute / 60 * dt
				local active = activeBase * Economy.FreeMultiplier("Station", flags)
				depth += active
				freeMetres += active
				contribution += activeBase
			end
		end
		local crew = Economy.CrewRate(playerCount) / 60 * dt
		depth += crew
		crewMetres += crew

		if robuxPerSecond > 0 then
			for _, entry in digQueue do
				entry.budget += robuxPerSecond * entry.fraction * dt
				while entry.budget >= entry.item.Price do
					entry.budget -= entry.item.Price
					depth += entry.item.Effect.Metres
					paidMetres += entry.item.Effect.Metres
					contribution += entry.item.Effect.Metres
					if Config.Pool.Enabled then
						pool += entry.item.Price
						while pool >= Config.Pool.FillRobux do
							pool -= Config.Pool.FillRobux
							local bonus = Config.Pool.BonusMetresPerPlayer * playerCount
							depth += bonus
							poolMetres += bonus
						end
					end
				end
			end
		end
		digBudget = 0
	end

	return {
		Seconds = t,
		Minutes = t / 60,
		Reached = depth >= target,
		FreeMetres = freeMetres,
		PaidMetres = paidMetres,
		CrewMetres = crewMetres,
		PoolMetres = poolMetres,
		RobuxPerHour = robuxPerSecond * 3600,
	}
end

-- Time (seconds) until the depth counter shows its first visible change
-- (+0.1 m) for one Lv0 free player on their own.
function EconomySim.FirstVisibleTick(deps): number
	local Economy, Config = deps.Economy, deps.Config
	local perSecond = Economy.PassiveBaseRate(0, false) / 60 + Economy.CrewRate(1) / 60
	local tick = Config.Free.PassiveTickSeconds
	local t = 0
	local shown = 0
	while shown < 0.1 do
		t += tick
		shown = math.floor(perSecond * t * 10 + 1e-9) / 10
	end
	return t
end

return EconomySim
