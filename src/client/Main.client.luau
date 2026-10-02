--[[
	Keep Digging! client bootstrap: state, HUD, store, panels, world view,
	free-path visuals and the dig spectacle (Dig Director).
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Catalog = require(Shared.Catalog)
local HoleMath = require(Shared.HoleMath)
local Format = require(Shared.Util.Format)

local Client = script.Parent
local State = require(Client.State)
local Kit = require(Client.UI.Kit)
local Store = require(Client.UI.Store)
local Panels = require(Client.UI.Panels)
local HUD = require(Client.Controllers.HUD)
local WorldView = require(Client.Controllers.WorldView)
local FreePathView = require(Client.Controllers.FreePathView)
local DigDirector = require(Client.Spectacle.DigDirector)
local SequencePlayer = require(Client.Spectacle.SequencePlayer)
local CameraFx = require(Client.Spectacle.CameraFx)
local EffectsKit = require(Client.Spectacle.EffectsKit)
local Audio = require(Client.Spectacle.Audio)
local BottomReveal = require(Client.Spectacle.BottomReveal)
local FindModels = require(Client.Spectacle.FindModels)

local player = Players.LocalPlayer

------------------------------------------------------------------------------
-- Graphics quality (Auto: phones Medium, desktop High; overridable)
------------------------------------------------------------------------------
local function applySettings(s)
	local q = s.Quality
	if q == "Auto" then
		q = Kit.IsTouch and "Medium" or "High"
	end
	DigDirector.SetQuality(q)
	FreePathView.Quality = q
	CameraFx.ShakeEnabled = s.Shake
	DigDirector.AutoSkipOwn = s.AutoSkipOwn
	Audio.Volume = s.Volume
	local dof = game:GetService("Lighting"):FindFirstChildOfClass("DepthOfFieldEffect")
	if dof then
		dof.Enabled = q == "High"
	end
end

State.Start()
applySettings(Panels.Settings)
Panels.OnSetting = applySettings

local overlay = Kit.Screen("KD_Overlay", 20)
Store.Start(overlay)
Panels.Start(overlay)

HUD.Open = function(panel, opts)
	opts = opts or {}
	if panel == "Store" then
		Panels.Close()
		Store.Open(opts)
	else
		Store.Close()
		if panel == "Collection" then
			Panels.Collection("Collection")
		elseif panel == "Season" then
			Panels.Collection("Season")
		elseif panel == "Recent" then
			Panels.Recent()
		elseif panel == "Daily" then
			Panels.Daily()
		elseif panel == "Settings" then
			Panels.SettingsPanel()
		elseif panel == "Debug" then
			Panels.Debug()
		end
	end
end

HUD.Start()
WorldView.Start()
FreePathView.Start()

------------------------------------------------------------------------------
-- Spectacle hooks
------------------------------------------------------------------------------
local skipGui = Kit.Screen("KD_Skip", 60)
local skipButton = Kit.Button({ Text = "Tap to skip ⏭", Style = "Slate", Size = UDim2.fromOffset(190, 50), Position = UDim2.new(0.5, 0, 1, -24), Anchor = Vector2.new(0.5, 1), MaxTextSize = 18, Parent = skipGui })
skipButton.Visible = false
local skipFn = nil
skipButton.Activated:Connect(function()
	if skipFn then
		skipFn()
	end
end)
DigDirector.OnSkipButton = function(visible, fn)
	skipButton.Visible = visible
	skipFn = fn
end

SequencePlayer.OnPopup = function(text, worldPos, ctx)
	local anchor = Instance.new("Part")
	anchor.Anchored = true
	anchor.CanCollide = false
	anchor.CanQuery = false
	anchor.Transparency = 1
	anchor.Size = Vector3.one
	anchor.Position = worldPos + Vector3.new(0, 4, 0)
	anchor.Parent = workspace
	local gui = Kit.New("BillboardGui", { Size = UDim2.fromOffset(260, 70), AlwaysOnTop = true, MaxDistance = 600, Parent = anchor })
	local item = Catalog.Get(ctx.ItemId)
	Kit.Label({ Text = text, Display = true, Color = item and Kit.TierColor(item.Tier) or Kit.Colors.GoldLight, Stroke = Kit.Colors.Slate, StrokeSize = 3, Parent = gui })
	task.spawn(function()
		for i = 1, 60 do
			anchor.Position += Vector3.new(0, 0.25, 0)
			task.wait(1 / 60)
		end
		anchor:Destroy()
	end)
	FreePathView.CrewReact((item and item.Effect.Weight or 1) * 6)
	Audio.Play("ui_pop")
	if ctx.Dedication and ctx.Dedication ~= "" then
		local ded = Kit.New("BillboardGui", { Size = UDim2.fromOffset(320, 40), StudsOffset = Vector3.new(0, -3, 0), AlwaysOnTop = true, MaxDistance = 400, Parent = anchor })
		Kit.Label({ Text = '"' .. ctx.Dedication .. '"', Color = Kit.Colors.Cream, Stroke = Kit.Colors.Slate, Parent = ded })
	end
end

SequencePlayer.OnBanner = function(ctx)
	-- The Big One: the buyer's name in giant letters for the whole server.
	local banner = Kit.Label({
		Text = string.upper(ctx.BuyerName or ctx.PerformerName or "SOMEONE") .. "\nDROPPED THE BIG ONE!",
		Display = true,
		Color = Kit.Colors.GoldLight,
		Stroke = Kit.Colors.GoldDark,
		StrokeSize = 4,
		Size = UDim2.new(0.9, 0, 0.3, 0),
		Position = UDim2.fromScale(0.5, 0.32),
		Anchor = Vector2.new(0.5, 0.5),
		ZIndex = 30,
		Parent = skipGui,
	})
	Kit.Pop(banner)
	task.delay(5, function()
		Kit.Tween(banner, 0.8, { TextTransparency = 1 })
		task.wait(0.9)
		banner:Destroy()
	end)
end

-- Find unearthing mini-cutscene at the wall: glint, crack, reveal pop.
local function unearth(event)
	local y = HoleMath.FractionToY(event.Depth / math.max(1, State.Hole.Target))
	local r = HoleMath.RadiusAtY(y - 0.1) - 1
	local a = (WorldView.LadderAngle or 0) + 0.3
	local pos = Vector3.new(math.cos(a) * r, y, math.sin(a) * r)
	EffectsKit.Flash(pos, Color3.fromRGB(255, 240, 200), 30, 0.8)
	Audio.Play("crack", pos)
	task.delay(0.35, function()
		EffectsKit.Debris(pos, 10, 14)
		local model = FindModels.Build(event.FindId, true)
		model:PivotTo(CFrame.new(pos + Vector3.new(0, 2, 0)))
		model.Parent = workspace
		Audio.Play("find", pos)
		EffectsKit.Burst("Glow", pos, 30, 1)
		local t0 = os.clock()
		while os.clock() - t0 < 3 do
			local k = os.clock() - t0
			model:PivotTo(CFrame.new(pos + Vector3.new(0, 2 + k * 3, 0)) * CFrame.Angles(0, k * 4, 0))
			task.wait()
		end
		model:Destroy()
	end)
end

State.HoleEvent:Connect(function(event)
	if event.Type == "Dig" then
		DigDirector.Enqueue(event)
	elseif event.Type == "Find" then
		unearth(event)
	elseif event.Type == "Bottom" then
		BottomReveal.Play(event)
	elseif event.Type == "PoolFill" then
		CameraFx.Flash(Color3.fromRGB(255, 230, 140), 0.6)
		Audio.Play("fanfare")
		for _, ring in game:GetService("CollectionService"):GetTagged("PoolRelic") do
			EffectsKit.Burst("Glow", ring:GetPivot().Position, 60, 2, { Color3.fromRGB(255, 230, 120), Color3.fromRGB(255, 255, 255) })
			EffectsKit.Ring(ring:GetPivot().Position, 40, Color3.fromRGB(255, 214, 90), 1.4)
		end
	end
end)

------------------------------------------------------------------------------
-- Debug local commands (ReferenceCamera, fly-through)
------------------------------------------------------------------------------
Panels.OnDebugLocal = function(name)
	if name == "ReferenceCamera" then
		Panels.Close()
		WorldView.SetShowcase(true)
		CameraFx.HeroShot()
		return "Hero camera + showcase depth (local only). Use 'Exit camera' to return."
	elseif name == "ExitCamera" then
		WorldView.SetShowcase(false)
		CameraFx.Release()
		return "Camera released"
	elseif name == "FlyDown" then
		Panels.Close()
		WorldView.SetShowcase(true)
		CameraFx.Cinematic(function(t)
			local k = math.clamp(t / 20, 0, 1)
			local y = 30 - 120 * k
			local r = 24
			local eye = Vector3.new(math.cos(t * 0.4) * r, y, math.sin(t * 0.4) * r)
			if t > 22 then
				WorldView.SetShowcase(false)
				CameraFx.Release()
			end
			return CFrame.lookAt(eye, Vector3.new(0, y - 12, 0)), 70
		end)
		return "Flying from the rim down to the core (22 s)"
	end
	return nil
end

UserInputService.InputBegan:Connect(function(input, processed)
	if processed then
		return
	end
	if input.KeyCode == Enum.KeyCode.Escape then
		Store.Close()
		Panels.Close()
	end
end)

print(string.format("[Keep Digging!] client ready for %s", player.Name), Format.Commas(State.Hole.Target))
