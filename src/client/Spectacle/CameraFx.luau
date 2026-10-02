--[[
	CameraFx: camera and screen juice.
	  Shake(trauma)     trauma-based shake with decay (respects the setting)
	  FovPunch(delta, t)
	  HitStop(t), SlowMo(scale, t)  scale EffectsKit.TimeScale / sequence clock
	  Flash(color, t), Vignette(amount, t), BloomPulse(amount, t)
	  Cinematic(shotFn) take over the camera (buyer only), Release()
	  HeroShot()        the reference framing (ReferenceCamera)
]]

local Lighting = game:GetService("Lighting")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)

local EffectsKit = require(script.Parent.EffectsKit)

local CameraFx = {}

CameraFx.ShakeEnabled = true
CameraFx.Active = false -- a cinematic owns the camera
CameraFx.Clock = 1 -- multiplier for sequence time (hit-stop / slow-mo)

local trauma = 0
local fovOffset = 0
local fovTarget = 0
local baseFov = 70
local shot = nil
local screen, flashFrame, vignette

local function ensureScreen()
	if screen then
		return
	end
	screen = Instance.new("ScreenGui")
	screen.Name = "KD_ScreenFx"
	screen.IgnoreGuiInset = true
	screen.DisplayOrder = 50
	screen.ResetOnSpawn = false
	screen.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")
	flashFrame = Instance.new("Frame")
	flashFrame.Size = UDim2.fromScale(1, 1)
	flashFrame.BackgroundTransparency = 1
	flashFrame.BorderSizePixel = 0
	flashFrame.Parent = screen
	vignette = Instance.new("Frame")
	vignette.Size = UDim2.fromScale(1, 1)
	vignette.BackgroundColor3 = Color3.new(0, 0, 0)
	vignette.BackgroundTransparency = 1
	vignette.BorderSizePixel = 0
	local grad = Instance.new("UIGradient")
	grad.Transparency = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0),
		NumberSequenceKeypoint.new(0.25, 1),
		NumberSequenceKeypoint.new(0.75, 1),
		NumberSequenceKeypoint.new(1, 0),
	})
	grad.Parent = vignette
	vignette.Parent = screen
end

function CameraFx.Shake(amount: number)
	if CameraFx.ShakeEnabled then
		trauma = math.min(1, trauma + amount)
	end
end

function CameraFx.FovPunch(delta: number, duration: number?)
	fovTarget = delta
	task.delay(duration or 0.3, function()
		fovTarget = 0
	end)
end

function CameraFx.HitStop(duration: number)
	CameraFx.Clock = 0.02
	EffectsKit.TimeScale = 0.05
	task.delay(duration, function()
		CameraFx.Clock = 1
		EffectsKit.TimeScale = 1
	end)
end

function CameraFx.SlowMo(scale: number, duration: number)
	CameraFx.Clock = scale
	EffectsKit.TimeScale = scale
	task.delay(duration, function()
		CameraFx.Clock = 1
		EffectsKit.TimeScale = 1
	end)
end

function CameraFx.Flash(color: Color3?, duration: number?)
	ensureScreen()
	flashFrame.BackgroundColor3 = color or Color3.new(1, 1, 1)
	flashFrame.BackgroundTransparency = 0.05
	TweenService:Create(flashFrame, TweenInfo.new(duration or 0.5, Enum.EasingStyle.Quad), { BackgroundTransparency = 1 }):Play()
end

function CameraFx.Vignette(amount: number, duration: number)
	ensureScreen()
	vignette.BackgroundTransparency = 1 - amount
	TweenService:Create(vignette, TweenInfo.new(duration, Enum.EasingStyle.Sine), { BackgroundTransparency = 1 }):Play()
end

function CameraFx.BloomPulse(amount: number, duration: number)
	local bloom = Lighting:FindFirstChildOfClass("BloomEffect")
	if not bloom then
		return
	end
	local base = bloom.Intensity
	bloom.Intensity = base + amount
	TweenService:Create(bloom, TweenInfo.new(duration, Enum.EasingStyle.Quad), { Intensity = base }):Play()
end

-- shotFn(t) -> CFrame for the camera; returns a release function.
function CameraFx.Cinematic(shotFn)
	local camera = workspace.CurrentCamera
	CameraFx.Active = true
	baseFov = 70
	camera.CameraType = Enum.CameraType.Scriptable
	shot = { Fn = shotFn, T = 0 }
	return CameraFx.Release
end

function CameraFx.Release()
	local camera = workspace.CurrentCamera
	shot = nil
	CameraFx.Active = false
	camera.CameraType = Enum.CameraType.Custom
	camera.FieldOfView = 70
end

function CameraFx.HeroShot()
	local hc = Config.World.HeroCamera
	local pos = Vector3.new(hc.Position[1], hc.Position[2], hc.Position[3])
	local look = Vector3.new(hc.LookAt[1], hc.LookAt[2], hc.LookAt[3])
	CameraFx.Cinematic(function()
		return CFrame.lookAt(pos, look), hc.FieldOfView
	end)
end

RunService:BindToRenderStep("KD_CameraFx", Enum.RenderPriority.Camera.Value + 1, function(dt)
	local camera = workspace.CurrentCamera
	if shot then
		shot.T += dt
		local cf, fov = shot.Fn(shot.T)
		if cf then
			camera.CFrame = cf
		end
		baseFov = fov or 70
	end
	fovOffset += (fovTarget - fovOffset) * math.min(1, dt * 12)
	if shot or math.abs(fovOffset) > 0.01 then
		camera.FieldOfView = baseFov + fovOffset
	end
	if trauma > 0 then
		local s = trauma * trauma
		local t = os.clock() * 28
		local offset = CFrame.Angles(
			math.rad(math.noise(t, 1) * 2.2 * s),
			math.rad(math.noise(t, 2) * 2.2 * s),
			math.rad(math.noise(t, 3) * 3.5 * s)
		)
		camera.CFrame *= offset
		trauma = math.max(0, trauma - dt * 1.4)
	end
end)

return CameraFx
