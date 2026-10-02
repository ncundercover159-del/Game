--[[
	HoleMath: pure functions for the hole (no Roblox services, no state).
	  * depth <-> physical position mapping
	  * deterministic, seeded find placement (policy-critical: nothing about a
	    find is rolled at purchase time; the seed fixes every depth at the start
	    of a cycle and every placement is public)
	  * find crossing detection
	  * per-cycle target growth
]]

local Config = require(script.Parent.Config)
local Strata = require(script.Parent.Strata)
local Prng = require(script.Parent.Util.Prng)

local HoleMath = {}

function HoleMath.BaseTarget(): number
	return Config.Hole.TargetDepthMetres
end

-- Target for a cycle number (1 = first hole). Grows by CycleGrowth of the base
-- per completed cycle and is capped at MaxTargetMultiplier x base.
function HoleMath.TargetForCycle(cycle: number): number
	local base = Config.Hole.TargetDepthMetres
	local grown = base * (1 + Config.Hole.CycleGrowth * math.max(0, cycle - 1))
	return math.floor(math.min(grown, base * Config.Hole.MaxTargetMultiplier) + 0.5)
end

function HoleMath.Fraction(depth: number, target: number): number
	if target <= 0 then
		return 0
	end
	return math.clamp(depth / target, 0, 1)
end

-- Physical Y (studs, rim = 0) of a depth fraction. Piecewise-linear inside each
-- stratum so the marker enters a band exactly when the depth does.
function HoleMath.FractionToY(fraction: number): number
	fraction = math.clamp(fraction, 0, 1)
	for _, band in Strata.Bands do
		if fraction <= band.To then
			local t = (fraction - band.From) / (band.To - band.From)
			return band.YTop + (band.YBottom - band.YTop) * t
		end
	end
	local last = Strata.Bands[#Strata.Bands]
	return last.YBottom
end

-- Inverse of FractionToY (used by camera tools and plaques).
function HoleMath.YToFraction(y: number): number
	if y >= 0 then
		return 0
	end
	for _, band in Strata.Bands do
		if y >= band.YBottom then
			local t = (y - band.YTop) / (band.YBottom - band.YTop)
			return band.From + (band.To - band.From) * t
		end
	end
	return 1
end

-- Wall radius (studs) at a physical Y, following the stepped terraces.
function HoleMath.RadiusAtY(y: number): number
	local band = Strata.AtY(y)
	if not band then
		return Config.Hole.TopRadiusStuds
	end
	return band.Radius
end

-- Rim positions where dig sequences are staged (evenly spaced around the
-- hole, just outside the fence ring). Shared so server and clients agree.
function HoleMath.DigSpot(index: number)
	local n = Config.World.DigSpots
	local angle = (index - 1) / n * math.pi * 2 + math.pi / n
	local radius = Config.Hole.TopRadiusStuds + 5
	return {
		X = math.cos(angle) * radius,
		Z = math.sin(angle) * radius,
		Angle = angle,
		Radius = radius,
	}
end

-- Seed for a new cycle. `salt` should differ per server (e.g. JobId) so two
-- servers rarely share a find map; the seed is shown in the Find Map.
function HoleMath.NewSeed(cycle: number, salt: string, now: number): number
	return Prng.Hash(string.format("%s:%d:%d", salt or "kd", cycle, math.floor(now or 0)))
end

export type Placement = {
	Index: number,
	FindId: string,
	Depth: number, -- metres, one decimal
	Fraction: number,
	Unearthed: boolean,
	FinderName: string?,
	FinderUserId: number?,
}

-- Places every find for a cycle. Deterministic for (seed, target, finds).
-- Placements keep a minimum spacing so two finds never share a depth.
function HoleMath.PlaceFinds(seed: number, target: number, finds): { Placement }
	local rng = Prng.new(seed)
	local minGap = target * 0.004
	local placements = {}
	local taken = {}
	for _, find in finds do
		for _ = 1, find.Count do
			local depth
			for _attempt = 1, 24 do
				local fraction = rng:NextNumber(find.BandLo, find.BandHi)
				local candidate = math.floor(fraction * target * 10 + 0.5) / 10
				local clash = false
				for _, other in taken do
					if math.abs(other - candidate) < minGap then
						clash = true
						break
					end
				end
				depth = candidate
				if not clash then
					break
				end
			end
			table.insert(taken, depth)
			table.insert(placements, {
				FindId = find.Id,
				Depth = depth,
				Fraction = depth / target,
				Unearthed = false,
			})
		end
	end
	table.sort(placements, function(a, b)
		if a.Depth == b.Depth then
			return a.FindId < b.FindId
		end
		return a.Depth < b.Depth
	end)
	for index, placement in placements do
		placement.Index = index
	end
	return placements
end

-- Indices of buried placements with fromDepth < depth <= toDepth, shallowest
-- first. A single huge dig can cross several finds; each is reported once.
function HoleMath.Crossed(placements: { Placement }, fromDepth: number, toDepth: number): { number }
	local crossed = {}
	if toDepth <= fromDepth then
		return crossed
	end
	for index, placement in placements do
		if not placement.Unearthed and placement.Depth > fromDepth and placement.Depth <= toDepth then
			table.insert(crossed, index)
		end
	end
	return crossed
end

return HoleMath
