--[[
	WorldReactions: the world reacts to every dig. Nearby tagged props get a
	springy local wobble (client-only, restored afterwards):
	  ReactFence / ReactLantern  rattle and sway
	  ReactLeaves                canopies shake
	  ReactPebble                pebbles hop
	  HoleWall                   cracks shed debris at the marker depth
	The number of props moved per pulse is capped for performance.
]]

local CollectionService = game:GetService("CollectionService")
local RunService = game:GetService("RunService")

local EffectsKit = require(script.Parent.EffectsKit)

local WorldReactions = {}

local active = {} -- [part] = { Base, T, Power, Kind }
local MAX_PER_PULSE = 140

local function collect(tag, centre, radius, list)
	for _, inst in CollectionService:GetTagged(tag) do
		local parts = inst:IsA("BasePart") and { inst } or inst:GetDescendants()
		for _, p in parts do
			if p:IsA("BasePart") and (p.Position - centre).Magnitude < radius then
				table.insert(list, { p, tag })
			end
		end
	end
end

function WorldReactions.Pulse(centre: Vector3, power: number)
	local radius = 40 + power * 3
	local list = {}
	collect("ReactFence", centre, radius, list)
	collect("ReactLantern", centre, radius, list)
	collect("ReactPebble", centre, radius * 1.4, list)
	collect("ReactLeaves", centre, radius * 1.2, list)
	local n = 0
	for _, entry in list do
		local p, tag = entry[1], entry[2]
		if n >= MAX_PER_PULSE then
			break
		end
		if not active[p] then
			active[p] = { Base = p.CFrame, T = 0, Power = math.clamp(power / 30, 0.15, 1.5), Kind = tag, Phase = math.random() * 6 }
			n += 1
		else
			active[p].T = 0
		end
	end
	-- walls crack near the marker
	EffectsKit.Debris(EffectsKit.MarkerPoint() + Vector3.new(0, 4, 0), 4 + power * 0.3, 10)
end

RunService.Heartbeat:Connect(function(dt)
	local parts, cframes = {}, {}
	for p, s in active do
		s.T += dt
		local life = 1.4
		if s.T >= life or not p.Parent then
			if p.Parent then
				table.insert(parts, p)
				table.insert(cframes, s.Base)
			end
			active[p] = nil
		else
			local decay = (1 - s.T / life) ^ 2
			local wob = math.sin(s.T * 22 + s.Phase) * decay * s.Power
			local cf
			if s.Kind == "ReactPebble" then
				local hop = math.max(0, math.sin(s.T * 9)) * decay * s.Power * 1.6
				cf = s.Base * CFrame.new(0, hop, 0) * CFrame.Angles(wob * 0.6, 0, wob * 0.4)
			elseif s.Kind == "ReactLeaves" then
				cf = s.Base * CFrame.new(wob * 0.25, 0, wob * 0.15) * CFrame.Angles(0, 0, wob * 0.05)
			else
				cf = s.Base * CFrame.Angles(wob * 0.06, 0, wob * 0.08)
			end
			table.insert(parts, p)
			table.insert(cframes, cf)
		end
	end
	if #parts > 0 then
		workspace:BulkMoveTo(parts, cframes, Enum.BulkMoveMode.FireCFrameChanged)
	end
end)

return WorldReactions
