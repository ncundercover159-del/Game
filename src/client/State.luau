--[[
	State: the client's view of the server. Fetches the snapshot and profile,
	keeps them current from remotes, and exposes signals for controllers.
	The displayed depth is smoothed (counting animation) from authoritative
	server values; it never runs ahead of the server.
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Net = require(Shared.Net)
local Signal = require(Shared.Util.Signal)

local State = {}

State.Hole = { Depth = 0, Target = 10000, Cycle = 1, State = "Digging", Placements = {}, Seed = 0, Contributors = {} }
State.DisplayDepth = 0
State.Profile = nil
State.Feed = {}
State.Boards = nil
State.Artifacts = {}
State.Pool = { Value = 0, Fill = 2500 }
State.Boost = { ServerUntil = 0 }
State.Prices = {}
State.TestMode = false
State.Energy = nil
State.ServerOffset = 0
State.ShowcaseOverride = nil -- ReferenceCamera local showcase (fraction)

State.HoleChanged = Signal.new()
State.HoleEvent = Signal.new()
State.ProfileChanged = Signal.new()
State.FeedAdded = Signal.new()
State.BoardsChanged = Signal.new()
State.Notify = Signal.new()
State.DepthJump = Signal.new() -- (delta)
State.Ready = Signal.new()

local STATE_NAMES = { [0] = "Digging", [1] = "Revealing", [2] = "Resetting" }

function State.ServerNow(): number
	return os.time() + State.ServerOffset
end

function State.Fraction(): number
	if State.ShowcaseOverride then
		return State.ShowcaseOverride
	end
	return math.clamp(State.DisplayDepth / math.max(1, State.Hole.Target), 0, 1)
end

function State.Owns(itemId: string): boolean
	local p = State.Profile
	if not p then
		return false
	end
	return p.Owned[itemId] == true
end

function State.Price(item)
	return State.Prices[item.Id] or item.Price
end

local function applyHole(h)
	for k, v in h do
		State.Hole[k] = v
	end
	State.HoleChanged:Fire()
end

function State.Start()
	local snapshot = Net.Function("GetSnapshot"):InvokeServer()
	if snapshot then
		applyHole(snapshot.Hole)
		State.DisplayDepth = snapshot.Hole.Depth
		State.Feed = snapshot.Feed or {}
		State.Boards = snapshot.Boards
		State.Artifacts = snapshot.Artifacts or {}
		State.Pool = snapshot.Pool or State.Pool
		State.Boost = snapshot.Boost or State.Boost
		State.Prices = snapshot.Prices or {}
		State.TestMode = snapshot.TestMode
		State.Energy = snapshot.Energy
		State.ServerOffset = (snapshot.ServerTime or os.time()) - os.time()
	end
	task.spawn(function()
		local profile = Net.Function("GetProfile"):InvokeServer()
		if profile then
			State.Profile = profile
			State.Energy = profile.Energy or State.Energy
			State.ProfileChanged:Fire()
		end
	end)

	Net.Event("HoleTick").OnClientEvent:Connect(function(depth, target, cycle, stateCode)
		local prev = State.Hole.Depth
		State.Hole.Depth = depth
		State.Hole.Target = target
		State.Hole.Cycle = cycle
		State.Hole.State = STATE_NAMES[stateCode] or "Digging"
		if depth - prev > target * 0.002 then
			State.DepthJump:Fire(depth - prev)
		end
		State.HoleChanged:Fire()
	end)
	Net.Event("HoleEvent").OnClientEvent:Connect(function(event)
		if event.Type == "Cycle" and event.Snapshot then
			applyHole(event.Snapshot)
			State.DisplayDepth = event.Snapshot.Depth
		elseif event.Type == "Find" then
			local p = State.Hole.Placements[event.Index]
			if p then
				p.Unearthed = true
				p.FinderName = event.FinderName
			end
			State.Artifacts = event.Artifacts or State.Artifacts
		elseif event.Type == "Pool" or event.Type == "PoolFill" then
			State.Pool = event.Pool
		elseif event.Type == "ServerBoost" then
			State.Boost = event.Boost
		elseif event.Type == "State" then
			State.Hole.State = event.State
		end
		State.HoleEvent:Fire(event)
	end)
	Net.Event("Feed").OnClientEvent:Connect(function(entry)
		table.insert(State.Feed, entry)
		while #State.Feed > 30 do
			table.remove(State.Feed, 1)
		end
		State.FeedAdded:Fire(entry)
	end)
	Net.Event("Profile").OnClientEvent:Connect(function(view)
		State.Profile = view
		if view.Energy then
			State.Energy = view.Energy
		end
		State.ProfileChanged:Fire()
	end)
	Net.Event("Boards").OnClientEvent:Connect(function(boards)
		State.Boards = boards
		State.BoardsChanged:Fire()
	end)
	Net.Event("Notify").OnClientEvent:Connect(function(n)
		if n.Energy then
			State.Energy = n.Energy
		end
		State.Notify:Fire(n)
	end)

	-- Counting animation: ease the displayed depth toward the server value.
	RunService.RenderStepped:Connect(function(dt)
		local target = State.Hole.Depth
		local diff = target - State.DisplayDepth
		if diff < 0 then
			State.DisplayDepth = target -- new cycle / reset
		elseif diff > 0 then
			local step = math.max(diff * math.min(1, dt * 4.5), math.min(diff, dt * 2))
			State.DisplayDepth += step
		end
	end)
	State.Ready:Fire()
end

return State
