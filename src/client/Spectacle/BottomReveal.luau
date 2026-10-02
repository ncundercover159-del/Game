--[[
	BottomReveal: what waits at the bottom of the hole.

	SECRET (documented only here): the magma floor cracks open and the core
	turns out to be the den of the Mole King, a colossal, sleepy golden mole
	wearing a crown, snoring on a pile of gems. The crew's last swing wakes
	him; he yawns, peers up at the whole server, sneezes a geyser of glowing
	gems that rains over the rim (the server pays everyone Shards and XP for
	the hole), waves his giant digging paws, then burrows back down and the
	hole refills for a deeper cycle. Everyone who contributed is a Hole
	Breaker.
]]

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local EffectsKit = require(script.Parent.EffectsKit)
local CameraFx = require(script.Parent.CameraFx)
local Audio = require(script.Parent.Audio)
local WorldReactions = require(script.Parent.WorldReactions)

local BottomReveal = {}

local rgb = Color3.fromRGB
local GOLD, GOLD_DARK, PINK, CROWN = rgb(247, 168, 27), rgb(181, 122, 16), rgb(255, 150, 170), rgb(255, 214, 60)

local function part(model, size, cf, color, material, shape)
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.Size = size
	p.CFrame = cf
	p.Color = color
	p.Material = material or Enum.Material.SmoothPlastic
	if shape then
		p.Shape = shape
	end
	p.Parent = model
	return p
end

local function buildKing()
	local m = Instance.new("Model")
	m.Name = "KD_RevealSetPiece"
	m:SetAttribute("AssetKey", "setpiece_core")
	local rest = {}
	local function add(name, size, offset, color, material, shape)
		local p = part(m, size, CFrame.new(), color, material, shape)
		p.Name = name
		rest[p] = offset
		return p
	end
	add("Body", Vector3.new(30, 24, 26), CFrame.new(0, 12, 0), GOLD, Enum.Material.Foil)
	add("Belly", Vector3.new(20, 16, 2), CFrame.new(0, 10, -13), rgb(255, 224, 150))
	add("Head", Vector3.new(22, 16, 18), CFrame.new(0, 28, -6), GOLD, Enum.Material.Foil)
	add("Snout", Vector3.new(8, 6, 8), CFrame.new(0, 26, -17), rgb(255, 210, 120))
	add("Nose", Vector3.new(4, 3, 3), CFrame.new(0, 27, -21.5), PINK, Enum.Material.Neon)
	add("EyeL", Vector3.new(3, 0.8, 0.6), CFrame.new(-5, 31, -15.2), rgb(30, 20, 20))
	add("EyeR", Vector3.new(3, 0.8, 0.6), CFrame.new(5, 31, -15.2), rgb(30, 20, 20))
	add("PawL", Vector3.new(10, 4, 8), CFrame.new(-14, 4, -14), GOLD_DARK, Enum.Material.Foil)
	add("PawR", Vector3.new(10, 4, 8), CFrame.new(14, 4, -14), GOLD_DARK, Enum.Material.Foil)
	add("Crown", Vector3.new(14, 4, 12), CFrame.new(0, 38, -6), CROWN, Enum.Material.Neon)
	for i = 0, 4 do
		add("Spike" .. i, Vector3.new(2, 5, 2), CFrame.new(-5 + i * 2.5, 41.5, -6), CROWN, Enum.Material.Neon)
	end
	for i = 0, 14 do
		local a = i / 15 * math.pi * 2
		add("Gem" .. i, Vector3.new(3, 3, 3), CFrame.new(math.cos(a) * 20, 1.5, math.sin(a) * 18) * CFrame.Angles(a, a, 0), ({ rgb(82, 246, 255), rgb(179, 78, 250), rgb(230, 40, 60), rgb(60, 220, 110) })[i % 4 + 1], Enum.Material.Neon)
	end
	return m, rest
end

-- phase: "Revealing" (seconds = reveal length) or "Resetting"
function BottomReveal.Play(event)
	local seconds = event.Seconds or 40
	if event.Phase == "Resetting" then
		Audio.Play("rumble", Vector3.new(0, -40, 0), { Pitch = 0.7 })
		for _, floor in workspace:GetDescendants() do
			if floor:IsA("Model") and floor:HasTag("HoleFloor") then
				for _, p in floor:GetDescendants() do
					if p:IsA("BasePart") then
						p.LocalTransparencyModifier = 0
					end
				end
			end
		end
		return
	end
	local floorY = -68
	local king, rest = buildKing()
	king.Parent = workspace
	local base = CFrame.new(0, floorY - 46, 4)
	local released = false
	CameraFx.Cinematic(function(t)
		local k = math.min(1, t / 6)
		local eye = Vector3.new(0, 40 - 30 * k, 70 - 20 * k)
		return CFrame.lookAt(eye, Vector3.new(0, floorY + 10 * k, 0)), 70
	end)
	local function release()
		if not released then
			released = true
			CameraFx.Release()
		end
	end
	task.delay(math.min(14, seconds * 0.5), release)

	-- floor cracks open (client-only visual)
	task.delay(1.0, function()
		Audio.Play("crack", Vector3.new(0, floorY, 0))
		Audio.Play("rumble", Vector3.new(0, floorY, 0))
		CameraFx.Shake(0.6)
		EffectsKit.Ring(Vector3.new(0, floorY + 1, 0), 30, rgb(255, 150, 60), 1.2)
		EffectsKit.Debris(Vector3.new(0, floorY + 2, 0), 40, 50)
		for _, model in workspace:GetDescendants() do
			if model:IsA("Model") and model:HasTag("HoleFloor") then
				for _, p in model:GetDescendants() do
					if p:IsA("BasePart") then
						p.LocalTransparencyModifier = 1
					end
				end
			end
		end
	end)
	local start = os.clock()
	local sneezed, waved = false, false
	local conn
	conn = RunService.RenderStepped:Connect(function()
		local t = os.clock() - start
		-- rise up from the core
		local rise = math.clamp((t - 2) / 4, 0, 1)
		local riseE = 1 - (1 - rise) ^ 3
		local snore = math.sin(t * 2) * 0.6 * (1 - math.clamp((t - 7) / 1, 0, 1))
		local bodyCF = base * CFrame.new(0, 46 * riseE + snore, 0)
		local parts, cfs = {}, {}
		for p, offset in rest do
			local o = offset
			if (p.Name == "PawL" or p.Name == "PawR") and t > 12 and t < 16 then
				local side = p.Name == "PawL" and -1 or 1
				o = offset * CFrame.new(0, 10 + math.sin(t * 8) * 3, 6) * CFrame.Angles(0, 0, side * math.sin(t * 8) * 0.5)
			elseif (p.Name == "EyeL" or p.Name == "EyeR") and t > 7.5 then
				o = offset * CFrame.new(0, 0, 0) -- open eyes: taller
				p.Size = Vector3.new(3, 3, 0.6)
			elseif p.Name == "Head" or p.Name == "Snout" or p.Name == "Nose" or p.Name:sub(1, 5) == "Spike" or p.Name == "Crown" then
				local nod = t > 8.5 and t < 10 and math.sin((t - 8.5) * 10) * 0.12 or 0
				o = CFrame.new(0, 24, -6) * CFrame.Angles(-nod, 0, 0) * CFrame.new(0, -24, 6) * offset
			end
			table.insert(parts, p)
			table.insert(cfs, bodyCF * o)
		end
		workspace:BulkMoveTo(parts, cfs, Enum.BulkMoveMode.FireCFrameChanged)
		if t > 9.8 and not sneezed then
			sneezed = true
			Audio.Play("boom_big", Vector3.new(0, 0, 0), { Pitch = 1.6 })
			CameraFx.Flash(rgb(255, 240, 200), 0.6)
			CameraFx.Shake(0.8)
			WorldReactions.Pulse(Vector3.new(0, 0, 0), 80)
			for i = 1, 8 do
				task.delay(i * 0.15, function()
					EffectsKit.Debris(Vector3.new(0, floorY + 40, -10), 22, 70, { rgb(82, 246, 255), rgb(179, 78, 250), rgb(255, 214, 60), rgb(230, 40, 60) })
					EffectsKit.Burst("Glow", Vector3.new(0, floorY + 42, -14), 30, 2)
				end)
			end
		end
		if t > 12 and not waved then
			waved = true
			Audio.Play("fanfare")
			release()
		end
		-- burrow back down
		if t > seconds - 6 then
			local down = math.clamp((t - (seconds - 6)) / 5, 0, 1)
			base = CFrame.new(0, floorY - 46 - 60 * down * down, 4)
		end
		if t > seconds then
			conn:Disconnect()
			king:Destroy()
			release()
		end
	end)
end

return BottomReveal
