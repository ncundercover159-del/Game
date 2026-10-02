--[[
	HoleService: the single authoritative owner of this server's hole.

	State (server memory only; there is no cross-server counter):
	  State         "Digging" | "Revealing" | "Resetting"
	  Cycle         1, 2, 3 ...
	  Target        metres to the bottom for this cycle
	  Depth         metres dug this cycle (never decreases within a cycle)
	  Seed          find seed for this cycle (public)
	  Placements    every find placement for this cycle (public)
	  Contributions this hole's base-metre contributions per player
	  Bank          metres that arrived during a reveal or overflowed the
	                target; credited when the next cycle begins

	AddMetres is the only way depth changes. The Digging -> Revealing
	transition happens synchronously inside it (no yields between the check
	and the state change), guarded by TriggeredCycle, so the bottom event
	fires exactly once per cycle however many digs land together.
]]

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local Catalog = require(Shared.Catalog)
local HoleMath = require(Shared.HoleMath)
local Signal = require(Shared.Util.Signal)
local Net = require(Shared.Net)

local HoleService = {}

HoleService.State = "Digging"
HoleService.Cycle = 1
HoleService.Target = HoleMath.TargetForCycle(1)
HoleService.Depth = 0
HoleService.Seed = 1
HoleService.Placements = {}
HoleService.Contributions = {} -- ["u<userId>"] = { UserId, Name, Metres, Biggest, BiggestDepth, Digs }
HoleService.Bank = {}
HoleService.TriggeredCycle = 0
HoleService.CycleStartedAt = os.time()

HoleService.FindUnearthed = Signal.new() -- (placement, source)
HoleService.BottomReached = Signal.new() -- (cycle, source)
HoleService.CycleStarted = Signal.new() -- (cycle)
HoleService.ContributionsChanged = Signal.new()
HoleService.StateChanged = Signal.new() -- (state)

local dirty = true
local lastBroadcast = 0

local STATE_CODES = { Digging = 0, Revealing = 1, Resetting = 2 }

local function contributionKey(userId: number): string
	return "u" .. tostring(userId)
end

------------------------------------------------------------------------------
-- Cycle setup
------------------------------------------------------------------------------
function HoleService.SetupCycle(cycle: number, seed: number?)
	HoleService.Cycle = cycle
	HoleService.Target = HoleMath.TargetForCycle(cycle)
	HoleService.Depth = 0
	HoleService.Seed = seed or HoleMath.NewSeed(cycle, game.JobId, os.time())
	HoleService.Placements = HoleMath.PlaceFinds(HoleService.Seed, HoleService.Target, Catalog.Finds)
	HoleService.Contributions = {}
	HoleService.CycleStartedAt = os.time()
	HoleService.State = "Digging"
	dirty = true
end

------------------------------------------------------------------------------
-- The one way depth changes
------------------------------------------------------------------------------
--[[
	source = {
	  Kind = "Dig" | "Passive" | "Station" | "Obby" | "Minigame" | "Daily" |
	         "Crew" | "Pool" | "Debug",
	  UserId = number?, Name = string?,
	  Base = number?            -- base metres for contribution (defaults to amount for Dig)
	  Contributes = boolean?    -- false for Crew/Pool/Debug
	  ItemId = string?, DigId = string?
	}
	Returns (appliedMetres, bankedMetres).
]]
function HoleService.AddMetres(amount: number, source)
	assert(type(amount) == "number" and amount == amount, "AddMetres: bad amount")
	if amount <= 0 then
		return 0, 0
	end
	source = source or { Kind = "Debug" }

	if HoleService.State ~= "Digging" then
		table.insert(HoleService.Bank, { Amount = amount, Source = source })
		return 0, amount
	end

	local from = HoleService.Depth
	local to = math.min(HoleService.Target, from + amount)
	local applied = to - from
	local overflow = amount - applied
	HoleService.Depth = to
	dirty = true

	-- Contribution: base metres, proportional to what landed this cycle.
	local contributes = source.UserId ~= nil and source.Contributes ~= false
	if contributes and applied > 0 then
		local base = source.Base or amount
		local baseApplied = base * (applied / amount)
		local key = contributionKey(source.UserId)
		local entry = HoleService.Contributions[key]
		if not entry then
			entry = { UserId = source.UserId, Name = source.Name or "?", Metres = 0, Biggest = 0, BiggestDepth = 0, Digs = 0 }
			HoleService.Contributions[key] = entry
		end
		entry.Metres += baseApplied
		if source.Name then
			entry.Name = source.Name
		end
		if source.Kind == "Dig" then
			entry.Digs += 1
			if baseApplied > entry.Biggest then
				entry.Biggest = baseApplied
				entry.BiggestDepth = to
			end
		end
		HoleService.ContributionsChanged:Fire()
	end

	-- Finds crossed by this exact metre range, shallowest first.
	for _, index in HoleMath.Crossed(HoleService.Placements, from, to) do
		local placement = HoleService.Placements[index]
		placement.Unearthed = true
		placement.FinderUserId = source.UserId
		placement.FinderName = source.Name or (source.Kind == "Crew" and "the Crew" or "the server")
		placement.UnearthedAt = os.time()
		HoleService.FindUnearthed:Fire(placement, source)
	end

	-- Bottom: exactly once per cycle.
	if HoleService.Depth >= HoleService.Target and HoleService.TriggeredCycle < HoleService.Cycle then
		HoleService.TriggeredCycle = HoleService.Cycle
		HoleService.State = "Revealing"
		if overflow > 0 then
			local carried = table.clone(source)
			if carried.Base then
				carried.Base = carried.Base * (overflow / amount)
			end
			table.insert(HoleService.Bank, { Amount = overflow, Source = carried })
		end
		HoleService.StateChanged:Fire("Revealing")
		HoleService.BottomReached:Fire(HoleService.Cycle, source)
		return applied, overflow
	end
	return applied, 0
end

function HoleService.SetState(state: string)
	assert(STATE_CODES[state] ~= nil, "bad state " .. tostring(state))
	HoleService.State = state
	dirty = true
	HoleService.StateChanged:Fire(state)
	Net.Event("HoleEvent"):FireAllClients({ Type = "State", State = state, Cycle = HoleService.Cycle })
end

-- Starts the next cycle and credits the bank. Called by BottomService.
function HoleService.NextCycle(seed: number?)
	HoleService.SetupCycle(HoleService.Cycle + 1, seed)
	local bank = HoleService.Bank
	HoleService.Bank = {}
	HoleService.CycleStarted:Fire(HoleService.Cycle)
	Net.Event("HoleEvent"):FireAllClients({ Type = "Cycle", Snapshot = HoleService.PublicState(true) })
	for _, entry in bank do
		HoleService.AddMetres(entry.Amount, entry.Source)
	end
end

------------------------------------------------------------------------------
-- Queries
------------------------------------------------------------------------------
function HoleService.Fraction(): number
	return HoleMath.Fraction(HoleService.Depth, HoleService.Target)
end

function HoleService.TopContributors(limit: number)
	local rows = {}
	for _, entry in HoleService.Contributions do
		table.insert(rows, entry)
	end
	table.sort(rows, function(a, b)
		if a.Metres == b.Metres then
			return a.UserId < b.UserId
		end
		return a.Metres > b.Metres
	end)
	local out = {}
	for i = 1, math.min(limit, #rows) do
		local r = rows[i]
		out[i] = {
			UserId = r.UserId,
			Name = r.Name,
			Metres = math.floor(r.Metres * 10 + 0.5) / 10,
			Biggest = r.Biggest,
			BiggestDepth = r.BiggestDepth,
		}
	end
	return out
end

function HoleService.PlacementsPublic()
	local out = {}
	for i, p in HoleService.Placements do
		out[i] = {
			Index = p.Index,
			FindId = p.FindId,
			Depth = p.Depth,
			Unearthed = p.Unearthed,
			FinderName = p.FinderName,
		}
	end
	return out
end

function HoleService.PublicState(includePlacements: boolean?)
	return {
		Depth = HoleService.Depth,
		Target = HoleService.Target,
		Cycle = HoleService.Cycle,
		State = HoleService.State,
		Seed = HoleService.Seed,
		Placements = includePlacements and HoleService.PlacementsPublic() or nil,
		Contributors = HoleService.TopContributors(Config.Leaderboards.Rows),
		BankedMetres = HoleService.BankedMetres(),
	}
end

function HoleService.BankedMetres(): number
	local total = 0
	for _, entry in HoleService.Bank do
		total += entry.Amount
	end
	return total
end

------------------------------------------------------------------------------
-- Replication (batched, 5-10 Hz, plus a 2 s keep-alive)
------------------------------------------------------------------------------
function HoleService.Broadcast()
	dirty = false
	lastBroadcast = os.clock()
	Net.Event("HoleTick"):FireAllClients(
		HoleService.Depth,
		HoleService.Target,
		HoleService.Cycle,
		STATE_CODES[HoleService.State]
	)
end

function HoleService.Init()
	HoleService.SetupCycle(1)
end

function HoleService.Start()
	local interval = 1 / Config.Hole.ReplicationHz
	local accumulator = 0
	RunService.Heartbeat:Connect(function(dt)
		accumulator += dt
		if accumulator < interval then
			return
		end
		accumulator = 0
		if dirty or os.clock() - lastBroadcast > 2 then
			HoleService.Broadcast()
		end
	end)
	Players.PlayerAdded:Connect(function()
		dirty = true
	end)
end

return HoleService
