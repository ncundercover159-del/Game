--[[
	EffectsKit: the shared juice kit for dig sequences, pooled and budgeted.

	* Voxel debris: pooled anchored cube parts moved by a manual ballistic
	  step (never physics), coloured by the stratum being dug.
	* Shockwave rings: a ring of neon voxel cubes expanding and fading.
	* Bursts: pooled ParticleEmitters (dust, sparks, smoke, fire, embers,
	  confetti...) using textures shipped with the Roblox client.
	* Light flashes, mushroom cloud, beams, dig-effect style overrides.
	Quality (Low/Medium/High) scales counts; Config.Graphics holds budgets.
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local CosmeticStyles = require(Shared.CosmeticStyles)
local HoleMath = require(Shared.HoleMath)
local Strata = require(Shared.Strata)

local EffectsKit = {}

EffectsKit.Quality = "Medium"
EffectsKit.TimeScale = 1 -- slow-motion / hit-stop (shared with SequencePlayer)

local TEX = {
	Dust = "rbxasset://textures/particles/smoke_main.dds",
	Smoke = "rbxasset://textures/particles/smoke_main.dds",
	Spark = "rbxasset://textures/particles/sparkles_main.dds",
	Fire = "rbxasset://textures/particles/fire_main.dds",
	Embers = "rbxasset://textures/particles/fire_sparks_main.dds",
	Glow = "rbxasset://textures/particles/sparkles_main.dds",
}

local folder = Instance.new("Folder")
folder.Name = "KD_Effects"
folder.Parent = workspace

local function quality(): number
	return ({ Low = 0.4, Medium = 0.75, High = 1 })[EffectsKit.Quality] or 0.75
end

------------------------------------------------------------------------------
-- Debris pool
------------------------------------------------------------------------------
local debrisPool, liveDebris = {}, {}

local function takeDebris()
	local p = table.remove(debrisPool)
	if not p then
		if #liveDebris >= (Config.Graphics.DebrisPool[EffectsKit.Quality] or 90) then
			return nil
		end
		p = Instance.new("Part")
		p.Anchored = true
		p.CanCollide = false
		p.CanQuery = false
		p.CanTouch = false
		p.CastShadow = false
		p.TopSurface = Enum.SurfaceType.Smooth
		p.BottomSurface = Enum.SurfaceType.Smooth
		p.Parent = folder
	end
	return p
end

local function strataColor(y)
	local band = Strata.AtY(math.min(-0.5, y))
	return band and band.Color or Color3.fromRGB(139, 77, 39)
end

-- n voxel chunks from `origin`, velocity spread `power`, coloured by depth.
function EffectsKit.Debris(origin: Vector3, n: number, power: number, colors: { Color3 }?)
	n = math.floor(n * quality())
	for _ = 1, n do
		local p = takeDebris()
		if not p then
			break
		end
		local s = math.random(30, 110) / 100 * math.clamp(power / 30, 0.6, 2.2)
		p.Size = Vector3.new(s, s, s)
		p.Color = colors and colors[math.random(1, #colors)] or strataColor(origin.Y):Lerp(Color3.new(0, 0, 0), math.random() * 0.3)
		p.Material = Enum.Material.Ground
		p.Transparency = 0
		p.CFrame = CFrame.new(origin) * CFrame.Angles(math.random() * 6, math.random() * 6, 0)
		local dir = Vector3.new(math.random() - 0.5, math.random() * 0.9 + 0.3, math.random() - 0.5).Unit
		table.insert(liveDebris, { Part = p, V = dir * power * (0.5 + math.random()), Life = 1.4 + math.random() * 0.8, Spin = Vector3.new(math.random(), math.random(), math.random()) * 8 })
	end
end

------------------------------------------------------------------------------
-- Particle bursts (pooled emitters on anchor parts)
------------------------------------------------------------------------------
local emitterPool = {}

local function takeEmitter()
	local e = table.remove(emitterPool)
	if not e then
		local anchor = Instance.new("Part")
		anchor.Anchored = true
		anchor.CanCollide = false
		anchor.CanQuery = false
		anchor.Transparency = 1
		anchor.Size = Vector3.one
		anchor.Parent = folder
		local emitter = Instance.new("ParticleEmitter")
		emitter.Enabled = false
		emitter.Parent = anchor
		local light = Instance.new("PointLight")
		light.Enabled = false
		light.Parent = anchor
		e = { Anchor = anchor, Emitter = emitter, Light = light }
	end
	return e
end

local KINDS = {
	Dust = { Tex = TEX.Dust, Color = { Color3.fromRGB(176, 140, 104), Color3.fromRGB(120, 96, 76) }, Size = { 2, 7 }, Life = { 1.2, 2.4 }, Speed = { 4, 14 }, Light = 0, Drag = 3, Accel = Vector3.new(0, 2, 0) },
	Smoke = { Tex = TEX.Smoke, Color = { Color3.fromRGB(110, 110, 120), Color3.fromRGB(60, 60, 70) }, Size = { 3, 10 }, Life = { 2, 3.5 }, Speed = { 3, 8 }, Light = 0, Drag = 2, Accel = Vector3.new(0, 4, 0) },
	Spark = { Tex = TEX.Spark, Color = { Color3.fromRGB(255, 230, 140), Color3.fromRGB(255, 140, 40) }, Size = { 0.3, 0.05 }, Life = { 0.3, 0.8 }, Speed = { 18, 40 }, Light = 1, Drag = 1, Accel = Vector3.new(0, -60, 0) },
	Fire = { Tex = TEX.Fire, Color = { Color3.fromRGB(255, 210, 90), Color3.fromRGB(255, 80, 20) }, Size = { 4, 1 }, Life = { 0.5, 1.2 }, Speed = { 6, 16 }, Light = 1, Drag = 2, Accel = Vector3.new(0, 10, 0) },
	Embers = { Tex = TEX.Embers, Color = { Color3.fromRGB(255, 180, 60), Color3.fromRGB(255, 60, 20) }, Size = { 0.4, 0.1 }, Life = { 1, 2.5 }, Speed = { 5, 15 }, Light = 1, Drag = 1, Accel = Vector3.new(0, 6, 0) },
	Glow = { Tex = TEX.Glow, Color = { Color3.fromRGB(255, 255, 255), Color3.fromRGB(150, 230, 255) }, Size = { 1.5, 0.2 }, Life = { 0.4, 0.9 }, Speed = { 8, 20 }, Light = 1, Drag = 2, Accel = Vector3.zero },
	Ash = { Tex = TEX.Smoke, Color = { Color3.fromRGB(80, 80, 86), Color3.fromRGB(150, 150, 156) }, Size = { 0.4, 0.2 }, Life = { 3, 6 }, Speed = { 1, 4 }, Light = 0, Drag = 0.5, Accel = Vector3.new(0, -2, 0) },
}

function EffectsKit.Burst(kind: string, position: Vector3, count: number, scale: number?, colors: { Color3 }?)
	local spec = KINDS[kind] or KINDS.Dust
	local e = takeEmitter()
	local em = e.Emitter
	local s = scale or 1
	em.Texture = spec.Tex
	local c = colors or spec.Color
	em.Color = ColorSequence.new(c[1], c[#c])
	em.Size = NumberSequence.new(spec.Size[1] * s, spec.Size[2] * s)
	em.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.1), NumberSequenceKeypoint.new(1, 1) })
	em.Lifetime = NumberRange.new(spec.Life[1], spec.Life[2])
	em.Speed = NumberRange.new(spec.Speed[1] * s, spec.Speed[2] * s)
	em.SpreadAngle = Vector2.new(180, 180)
	em.LightEmission = spec.Light
	em.Drag = spec.Drag
	em.Acceleration = spec.Accel
	em.Rotation = NumberRange.new(0, 360)
	em.RotSpeed = NumberRange.new(-90, 90)
	em.TimeScale = EffectsKit.TimeScale
	e.Anchor.Position = position
	em:Emit(math.max(1, math.floor(count * quality())))
	task.delay(spec.Life[2] + 0.2, function()
		table.insert(emitterPool, e)
	end)
end

function EffectsKit.Flash(position: Vector3, color: Color3, range: number, duration: number)
	local e = takeEmitter()
	e.Anchor.Position = position
	e.Light.Color = color
	e.Light.Range = math.min(60, range)
	e.Light.Brightness = 8
	e.Light.Enabled = true
	local start = os.clock()
	task.spawn(function()
		while os.clock() - start < duration do
			e.Light.Brightness = 8 * (1 - (os.clock() - start) / duration)
			RunService.Heartbeat:Wait()
		end
		e.Light.Enabled = false
		table.insert(emitterPool, e)
	end)
end

------------------------------------------------------------------------------
-- Shockwave ring of voxel cubes (and other expanding primitives)
------------------------------------------------------------------------------
local animated = {}

function EffectsKit.Ring(centre: Vector3, maxRadius: number, color: Color3, duration: number, cubes: number?)
	local n = math.floor((cubes or 28) * quality())
	local parts = {}
	for i = 1, n do
		local p = Instance.new("Part")
		p.Anchored = true
		p.CanCollide = false
		p.CanQuery = false
		p.CastShadow = false
		p.Material = Enum.Material.Neon
		p.Color = color
		p.Size = Vector3.new(1.4, 1.4, 1.4)
		p.Parent = folder
		parts[i] = p
	end
	table.insert(animated, { Kind = "Ring", Parts = parts, Centre = centre, R = maxRadius, T = 0, D = duration })
end

-- Stylised cartoon mushroom cloud (no real-world references).
function EffectsKit.Mushroom(base: Vector3, height: number, duration: number)
	local parts = {}
	local function puff(offset, size, color)
		local p = Instance.new("Part")
		p.Shape = Enum.PartType.Ball
		p.Anchored = true
		p.CanCollide = false
		p.CanQuery = false
		p.CastShadow = false
		p.Material = Enum.Material.SmoothPlastic
		p.Color = color
		p.Size = Vector3.one
		p.Parent = folder
		table.insert(parts, { Part = p, Offset = offset, Size = size })
	end
	for i = 0, 5 do
		puff(Vector3.new(0, i * height / 9, 0), height / 5, Color3.fromRGB(255, 190 - i * 15, 120 - i * 12))
	end
	for k = 0, 9 do
		local a = k / 10 * math.pi * 2
		puff(Vector3.new(math.cos(a) * height / 4, height * 0.72, math.sin(a) * height / 4), height / 3, k % 2 == 0 and Color3.fromRGB(255, 230, 190) or Color3.fromRGB(255, 160, 90))
	end
	puff(Vector3.new(0, height * 0.82, 0), height / 2.2, Color3.fromRGB(255, 244, 214))
	table.insert(animated, { Kind = "Mushroom", Parts = parts, Base = base, T = 0, D = duration })
end

function EffectsKit.Beam(from: Vector3, to: Vector3, color: Color3, width: number, duration: number)
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CastShadow = false
	p.Material = Enum.Material.Neon
	p.Color = color
	local length = (to - from).Magnitude
	p.Size = Vector3.new(width, width, length)
	p.CFrame = CFrame.lookAt((from + to) / 2, to)
	p.Parent = folder
	table.insert(animated, { Kind = "Beam", Parts = { p }, W = width, T = 0, D = duration })
	return p
end

-- Impact burst respecting the performer's Dig Effect Style (P2).
function EffectsKit.Impact(position: Vector3, power: number, effectStyle: string?, skinColors: { Color3 }?)
	local style = effectStyle and CosmeticStyles.DigEffects[effectStyle]
	EffectsKit.Burst("Dust", position, 10 + power, 1 + power / 40)
	EffectsKit.Debris(position, 6 + power * 0.6, 20 + power)
	if style then
		local kind = ({ Confetti = "Glow", Lightning = "Spark", Sakura = "Glow", Pixel = "Glow", Fire = "Fire" })[style.Shape] or "Glow"
		EffectsKit.Burst(kind, position, 20 + power, 1.2, style.Colors)
		if style.Shape == "Pixels" or style.Shape == "Confetti" then
			EffectsKit.Debris(position, 10 + power * 0.3, 25 + power, style.Colors)
		end
	else
		EffectsKit.Burst("Spark", position, 8 + power * 0.5, 1, skinColors)
	end
end

------------------------------------------------------------------------------
-- Step
------------------------------------------------------------------------------
RunService.Heartbeat:Connect(function(rawDt)
	local dt = rawDt * EffectsKit.TimeScale
	if #liveDebris > 0 then
		local parts, cframes = {}, {}
		for i = #liveDebris, 1, -1 do
			local d = liveDebris[i]
			d.Life -= dt
			d.V += Vector3.new(0, -workspace.Gravity * 0.35 * dt, 0)
			local cf = d.Part.CFrame
			local pos = cf.Position + d.V * dt
			if d.Life <= 0 or pos.Y < -80 then
				d.Part.CFrame = CFrame.new(0, -500, 0)
				table.insert(debrisPool, d.Part)
				table.remove(liveDebris, i)
			else
				table.insert(parts, d.Part)
				table.insert(cframes, CFrame.new(pos) * cf.Rotation * CFrame.Angles(d.Spin.X * dt, d.Spin.Y * dt, d.Spin.Z * dt))
				if d.Life < 0.4 then
					d.Part.Transparency = 1 - d.Life / 0.4
				end
			end
		end
		if #parts > 0 then
			workspace:BulkMoveTo(parts, cframes, Enum.BulkMoveMode.FireCFrameChanged)
		end
	end
	for i = #animated, 1, -1 do
		local a = animated[i]
		a.T += dt
		local k = math.clamp(a.T / a.D, 0, 1)
		local ease = 1 - (1 - k) ^ 3
		if a.Kind == "Ring" then
			for j, p in a.Parts do
				local ang = j / #a.Parts * math.pi * 2
				local r = a.R * ease
				p.CFrame = CFrame.new(a.Centre + Vector3.new(math.cos(ang) * r, 0.6, math.sin(ang) * r)) * CFrame.Angles(0, -ang, 0)
				p.Size = Vector3.new(1.6 - k, 1.6 - k, 1.6 - k) * 1.2 + Vector3.new(0.05, 0.05, 0.05)
				p.Transparency = k
			end
		elseif a.Kind == "Mushroom" then
			for _, puff in a.Parts do
				local grow = math.min(1, a.T / (a.D * 0.35))
				local g = 1 - (1 - grow) ^ 3
				puff.Part.Size = Vector3.one * puff.Size * (0.2 + 0.8 * g)
				puff.Part.Position = a.Base + puff.Offset * (0.3 + 0.7 * g) + Vector3.new(0, a.T * 1.5, 0)
				puff.Part.Transparency = math.clamp((k - 0.6) / 0.4, 0, 1)
			end
		elseif a.Kind == "Beam" then
			local p = a.Parts[1]
			local w = a.W * (1 - k)
			p.Size = Vector3.new(w, w, p.Size.Z)
			p.Transparency = k
		end
		if k >= 1 then
			for _, p in a.Parts do
				(p.Part or p):Destroy()
			end
			table.remove(animated, i)
		end
	end
end)

function EffectsKit.MarkerPoint(): Vector3
	local ok, WorldView = pcall(function()
		return require(script.Parent.Parent.Controllers.WorldView)
	end)
	if ok and WorldView.MarkerPosition then
		local m = WorldView.MarkerPosition()
		return Vector3.new(0, m.Y, 0)
	end
	return Vector3.new(0, HoleMath.FractionToY(0), 0)
end

return EffectsKit
