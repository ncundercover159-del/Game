--[[
	StationService: dig stations on the rim (map parts tagged "DigStation").
	A ProximityPrompt enters station mode; the client then holds a big button
	and sends one StationSwing per swing. The server counts a swing only if:
	  * the player is at a station and within MaxDistance of it,
	  * at least SwingInterval (minus tolerance) passed since their last one,
	  * fewer than MaxSwingsPerMinute were counted in the last 60 s.
	Every SwingsPerBucket counted swings fill a bucket worth MetresPerBucket
	base metres, drawn from the player's Dig Energy (FreePathService), so
	autoclickers and macro tools gain nothing.
]]

local CollectionService = game:GetService("CollectionService")
local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local Net = require(Shared.Net)

local Services = script.Parent
local function svc(name)
	return require(Services[name])
end

local StationService = {}

local states = {} -- [Player] = { Station, LastSwing, Recent = {times}, Swings, Buckets }
local occupancy = {} -- [station] = count

local MAX_PER_STATION = 3

local function rootOf(player: Player): BasePart?
	local character = player.Character
	return character and character:FindFirstChild("HumanoidRootPart") or nil
end

function StationService.Enter(player: Player, station: BasePart)
	if states[player] and states[player].Station == station then
		return true
	end
	StationService.Leave(player)
	if (occupancy[station] or 0) >= MAX_PER_STATION then
		Net.Event("Notify"):FireClient(player, { Kind = "Info", Text = "This dig station is full. Try another one!" })
		return false
	end
	occupancy[station] = (occupancy[station] or 0) + 1
	states[player] = { Station = station, LastSwing = 0, Recent = {}, Swings = 0, Buckets = 0 }
	Net.Event("StationState"):FireClient(player, {
		Active = true,
		StationId = station:GetAttribute("StationId"),
		Interval = Config.Free.Station.SwingInterval,
		SwingsPerBucket = Config.Free.Station.SwingsPerBucket,
	})
	return true
end

function StationService.Leave(player: Player)
	local state = states[player]
	if not state then
		return
	end
	occupancy[state.Station] = math.max(0, (occupancy[state.Station] or 1) - 1)
	states[player] = nil
	if player.Parent then
		Net.Event("StationState"):FireClient(player, { Active = false })
	end
end

-- Returns the result table for the swing (also used by tests).
function StationService.Swing(player: Player)
	local state = states[player]
	if not state then
		return { counted = false, reason = "not at a station" }
	end
	local st = Config.Free.Station
	local root = rootOf(player)
	if root and (root.Position - state.Station.Position).Magnitude > st.MaxDistance then
		StationService.Leave(player)
		return { counted = false, reason = "too far" }
	end
	local now = os.clock()
	if now - state.LastSwing < st.SwingInterval - st.SwingTolerance then
		return { counted = false, reason = "too fast" }
	end
	-- prune the 60 s window
	local recent = state.Recent
	while #recent > 0 and now - recent[1] > 60 do
		table.remove(recent, 1)
	end
	if #recent >= st.MaxSwingsPerMinute then
		return { counted = false, reason = "per-minute cap" }
	end
	table.insert(recent, now)
	state.LastSwing = now
	state.Swings += 1

	-- Other clients animate the swing (cheap, throttled by the swing rate).
	Net.Event("PlayerFx"):FireAllClients({ Type = "Swing", UserId = player.UserId, StationId = state.Station:GetAttribute("StationId") })

	local result = { counted = true, swings = state.Swings, bucketFilled = false }
	if state.Swings % st.SwingsPerBucket == 0 then
		state.Buckets += 1
		local grant = svc("FreePathService").GrantActive(player, "Station", st.MetresPerBucket)
		svc("SeasonService").AddXP(player, st.XPPerBucket, "Station")
		if state.Buckets % st.ShardsPerBuckets == 0 then
			svc("ShardService").Add(player, 1, "Station")
		end
		result.bucketFilled = true
		result.metres = grant.Metres
		result.base = grant.Base
		Net.Event("Notify"):FireClient(player, {
			Kind = "Bucket",
			Metres = grant.Metres,
			Energy = svc("FreePathService").Energy(player),
		})
	end
	return result
end

local function setupStation(station: BasePart)
	if station:FindFirstChildOfClass("ProximityPrompt") then
		return
	end
	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = "DigPrompt"
	prompt.ActionText = "Dig here"
	prompt.ObjectText = "Dig Station"
	prompt.HoldDuration = 0
	prompt.MaxActivationDistance = 10
	prompt.RequiresLineOfSight = false
	prompt.Parent = station
	prompt.Triggered:Connect(function(player)
		StationService.Enter(player, station)
	end)
end

function StationService.Init()
	for _, station in CollectionService:GetTagged("DigStation") do
		setupStation(station)
	end
	CollectionService:GetInstanceAddedSignal("DigStation"):Connect(setupStation)
	Players.PlayerRemoving:Connect(StationService.Leave)
end

function StationService.Start()
	-- Leave station mode automatically when a player walks away.
	task.spawn(function()
		while true do
			task.wait(1)
			for player, state in states do
				local root = rootOf(player)
				if not root or (root.Position - state.Station.Position).Magnitude > Config.Free.Station.MaxDistance + 4 then
					StationService.Leave(player)
				end
			end
		end
	end)
end

StationService._states = states

return StationService
