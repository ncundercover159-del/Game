--[[
	Economy: pure rules for free-path metres, multipliers and caps.
	Server services call these; tools/simulate.luau runs the same functions to
	produce the tuning tables in docs/DESIGN.md.

	Contribution rule: leaderboards count BASE metres (dig metres, Auto-Digger
	level rates and unboosted free-path metres). Multipliers from the 2x Free
	Metres pass, personal boosts, server boosts and the Club only speed up the
	hole; they never inflate anyone's contribution total.
]]

local Config = require(script.Parent.Config)

local Economy = {}

export type BoostFlags = {
	FreePass: boolean?,
	Personal: boolean?,
	Server: boolean?,
	Club: boolean?,
}

-- Free-path sources.
Economy.Sources = {
	Passive = "Passive",
	Station = "Station",
	Obby = "Obby",
	Minigame = "Minigame",
	Daily = "Daily",
	Pool = "Pool",
}

-- Passive Auto-Digger base rate (metres per minute).
function Economy.PassiveBaseRate(level: number, hasAutoBoost: boolean?): number
	level = math.clamp(math.floor(level or 0), 0, 5)
	local rate = Config.Free.AutoDiggerRates[level]
	if hasAutoBoost then
		rate = math.min(rate * Config.Free.AutoDigBoostMultiplier, Config.Free.PassiveBaseCap)
	end
	return rate
end

-- Total multiplier for a free-path source, capped at Config.Boosts.StackCap.
--   2x Free Metres pass: obbies, minigames, dig stations, daily reward
--   Personal boost:      Auto-Digger (AFK), dig stations, obbies, minigames
--   Server boost:        all free-path metres except the daily reward
--   Deep Diver Club:     all free-path metres except the daily reward
function Economy.FreeMultiplier(source: string, flags: BoostFlags): number
	local m = 1
	if flags.FreePass and source ~= "Passive" and source ~= "Pool" then
		m *= Config.Free.FreePassMultiplier
	end
	if source ~= "Daily" and source ~= "Pool" then
		if flags.Personal then
			m *= Config.Boosts.PersonalMultiplier
		end
		if flags.Server then
			m *= Config.Boosts.ServerMultiplier
		end
		if flags.Club then
			m *= Config.Boosts.ClubMultiplier
		end
	end
	return math.min(m, Config.Boosts.StackCap)
end

-- Crew dig rate for a server population (metres per minute).
function Economy.CrewRate(playerCount: number): number
	local c = Config.Crew
	return math.min(c.MaxMetresPerMinute, c.BaseMetresPerMinute + c.PerPlayerMetresPerMinute * math.max(0, playerCount))
end

------------------------------------------------------------------------------
-- Active free-metre token bucket ("Dig Energy")
------------------------------------------------------------------------------
-- Every active source draws base metres from one bucket per player that
-- refills at ActiveRatePerMinute up to ActiveBucketCapacity. This bounds any
-- mix of stations, obbies and minigames, and makes autoclicking pointless.
export type Bucket = { Tokens: number, Time: number }

function Economy.NewBucket(now: number): Bucket
	return { Tokens = Config.Free.ActiveBucketCapacity, Time = now }
end

function Economy.RefillBucket(bucket: Bucket, now: number)
	local rate = Config.Free.ActiveRatePerMinute / 60
	local elapsed = math.max(0, now - bucket.Time)
	bucket.Tokens = math.min(Config.Free.ActiveBucketCapacity, bucket.Tokens + elapsed * rate)
	bucket.Time = now
end

-- Takes up to `want` base metres; returns the granted amount.
function Economy.TakeFromBucket(bucket: Bucket, want: number, now: number): number
	Economy.RefillBucket(bucket, now)
	local granted = math.max(0, math.min(want, bucket.Tokens))
	bucket.Tokens -= granted
	-- keep float noise from accumulating
	granted = math.floor(granted * 1000 + 0.5) / 1000
	return granted
end

------------------------------------------------------------------------------
-- Dig tiers
------------------------------------------------------------------------------
function Economy.MetresPerRobux(item): number
	return item.Effect.Metres / item.Price
end

-- Largest metres any single purchase may add.
function Economy.SinglePurchaseCap(): number
	return Config.Hole.TargetDepthMetres * Config.Hole.MaxSinglePurchaseFraction
end

return Economy
