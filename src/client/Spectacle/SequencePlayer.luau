--[[
	SequencePlayer: plays one DigSequence (Shared.DigSequences.<toolId>).
	The definition is pure data: a list of cues (Anticipate, Deploy, Impact,
	Descend, Aftermath) at times, each with actions. This file is the engine
	that interprets actions; retuning or adding a sequence never touches it.

	Anchors resolved at play time:
	  Spot      the rim dig spot (faces the hole centre)
	  Hand      the performer's right hand
	  Marker    hole centre at the depth marker
	  Wall      the wall below the spot at marker depth
	  HoleTop   above the hole centre; Sky: high above the hole
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local HoleMath = require(Shared.HoleMath)
local CosmeticStyles = require(Shared.CosmeticStyles)
local Format = require(Shared.Util.Format)
local KeyframeLite = require(Shared.KeyframeLite)

local RigBuilder = require(script.Parent.RigBuilder)
local EffectsKit = require(script.Parent.EffectsKit)
local CameraFx = require(script.Parent.CameraFx)
local Audio = require(script.Parent.Audio)
local WorldReactions = require(script.Parent.WorldReactions)
local CharacterAnimator = require(script.Parent.CharacterAnimator)

local SequencePlayer = {}
SequencePlayer.OnPopup = nil -- (text, worldPosition) set by Main

local Easing = KeyframeLite.Easing

local function anchors(ctx)
	local spot = HoleMath.DigSpot(ctx.Spot or 1)
	local spotPos = Vector3.new(spot.X, 0, spot.Z)
	local spotCF = CFrame.lookAt(spotPos, Vector3.new(0, 0, 0))
	local marker = EffectsKit.MarkerPoint()
	local wallR = HoleMath.RadiusAtY(marker.Y - 0.2) - 0.5
	local dir = spotPos.Unit
	local performer = ctx.Performer and Players:GetPlayerByUserId(ctx.Performer)
	local character = performer and performer.Character
	local hand = CharacterAnimator.RightHand(character)
	return {
		Spot = spotCF,
		Hand = hand or (spotCF * CFrame.new(1, 4, 0)),
		Marker = CFrame.new(marker),
		Wall = CFrame.lookAt(dir * wallR + Vector3.new(0, marker.Y + 2, 0), marker),
		HoleTop = CFrame.new(0, 24, 0),
		Sky = CFrame.new(spotPos.X * 0.3, 260, spotPos.Z * 0.3 - 40),
		Character = character,
	}
end

local function anchorPos(a, name)
	local cf = a[name] or a.Marker
	return cf.Position
end

--[[
	Plays a sequence. ctx = HoleEvent "Dig" payload. opts = { Ticker, Camera }.
	Returns a handle { Done = bool, Skip = fn }.
]]
function SequencePlayer.Play(def, ctx, opts)
	opts = opts or {}
	local handle = { Done = false, Skipped = false }
	local a = anchors(ctx)
	local skin = CosmeticStyles.SkinForItem(ctx.Skin)
	local metresText = "+" .. Format.ExactMetres(ctx.Metres or 0)

	if opts.Ticker then
		-- Cheap version: popup + sound + a puff at the marker, no rig.
		Audio.Play("ui_pop", anchorPos(a, "Marker"))
		EffectsKit.Burst("Dust", anchorPos(a, "Marker"), 6, 0.8)
		if SequencePlayer.OnPopup then
			SequencePlayer.OnPopup(metresText, anchorPos(a, "Marker"), ctx)
		end
		handle.Done = true
		return handle
	end

	local rig = RigBuilder.Build(def.Rig or ctx.ItemId, ctx.Skin)
	rig:SetRoot(a[def.Stage or "Spot"] or a.Spot)
	rig:SetScale(def.Scale or 1)
	local motion = nil -- { From, To, T, D, Ease, Arc, Spin }
	local inHand = def.Stage == "Hand" and rig.Def.Handheld == true
	local spin = nil
	local squash = nil
	local loops = {}
	local released = false
	local cameraOn = opts.Camera and def.Camera ~= false
	local shotName = "OverShoulder"
	local clock = 0

	local function shot(t)
		local root = rig.Root.Position
		local spotPos = a.Spot.Position
		local out = spotPos.Unit
		if shotName == "OverShoulder" then
			local eye = spotPos + out * 14 + Vector3.new(0, 10, 0)
			return CFrame.lookAt(eye, root:Lerp(anchorPos(a, "Marker"), 0.3)), 60
		elseif shotName == "FollowRig" then
			local eye = root + out * 22 + Vector3.new(0, 14, 0)
			return CFrame.lookAt(eye, root), 64
		elseif shotName == "Marker" then
			local m = anchorPos(a, "Marker")
			return CFrame.lookAt(m + out * 26 + Vector3.new(0, 16, 0), m), 66
		elseif shotName == "Sky" then
			return CFrame.lookAt(spotPos + out * 30 + Vector3.new(0, 8, 0), root), 72
		elseif shotName == "HoleWide" then
			return CFrame.lookAt(out * 95 + Vector3.new(0, 70, 0), Vector3.new(0, -20, 0)), 62
		end
		return nil
	end
	if cameraOn then
		CameraFx.Cinematic(shot)
	end

	local function startMotion(m)
		local fromCF = rig.Root
		local toCF
		if m.To then
			local target = a[m.To] or a.Marker
			toCF = CFrame.new(target.Position + Vector3.new(0, m.Offset or 0, 0)) * fromCF.Rotation
		elseif m.By then
			toCF = fromCF * CFrame.new(m.By[1], m.By[2], m.By[3])
		else
			toCF = fromCF
		end
		motion = { From = fromCF, To = toCF, T = 0, D = m.Time or 1, Ease = Easing[m.Ease or "InOutQuad"] or Easing.InOutQuad, Arc = m.Height or 0, Tumble = m.Tumble }
	end

	local function act(action)
		local kind = action[1]
		if kind == "Place" or kind == "Motion" or kind == "Hide" then
			inHand = false
		end
		if kind == "Clip" then
			rig:Play(action.Name, action.Speed)
		elseif kind == "Character" then
			CharacterAnimator.Play(a.Character, action.Clip)
		elseif kind == "Place" then
			rig:SetRoot((a[action.At] or a.Spot) * CFrame.new(table.unpack(action.Offset or { 0, 0, 0 })))
		elseif kind == "Motion" then
			startMotion(action)
		elseif kind == "Spin" then
			spin = { Bone = action.Bone or "Root", Speed = math.rad(action.Speed or 360), Axis = action.Axis or "Y", Angle = 0 }
		elseif kind == "Squash" then
			squash = { S = action.Scale or 1.2, T = 0, D = action.Time or 0.25 }
		elseif kind == "Sound" then
			local pos = action.At == "Marker" and anchorPos(a, "Marker") or rig.Root.Position
			local s = Audio.Play(action.Cue, pos, { Loop = action.Loop, Pitch = action.Pitch, Volume = action.Volume, Range = action.Range })
			if action.Loop then
				loops[action.Key or action.Cue] = s
			end
		elseif kind == "StopSound" then
			Audio.Stop(loops[action.Key])
			loops[action.Key] = nil
		elseif kind == "Burst" then
			local pos = action.At == "Rig" and rig.Root.Position or (action.At and rig.Def.Attachments[action.At] and rig:Attachment(action.At).Position) or anchorPos(a, action.At or "Marker")
			EffectsKit.Burst(action.Kind, pos, action.Count or 20, action.Scale, action.Skin and skin.Particles or nil)
		elseif kind == "Debris" then
			EffectsKit.Debris(anchorPos(a, action.At or "Marker") + Vector3.new(0, 1, 0), action.Count or 12, action.Power or 30)
		elseif kind == "Impact" then
			EffectsKit.Impact(anchorPos(a, action.At or "Marker") + Vector3.new(0, 1, 0), action.Power or 20, ctx.Effect, skin.Particles)
		elseif kind == "Ring" then
			EffectsKit.Ring(anchorPos(a, action.At or "Marker"), action.Radius or 20, action.Color or skin.Accent, action.Time or 0.8, action.Cubes)
		elseif kind == "Light" then
			EffectsKit.Flash(anchorPos(a, action.At or "Marker"), action.Color or Color3.fromRGB(255, 220, 160), action.Range or 40, action.Time or 0.6)
		elseif kind == "Beam" then
			EffectsKit.Beam(anchorPos(a, action.From or "Sky"), anchorPos(a, action.To or "Marker"), action.Color or Color3.fromRGB(150, 240, 255), action.Width or 3, action.Time or 1)
		elseif kind == "Mushroom" then
			EffectsKit.Mushroom(anchorPos(a, "Marker"), action.Height or 60, action.Time or 6)
		elseif kind == "Shake" then
			CameraFx.Shake(action.Amount or 0.3)
		elseif kind == "Fov" then
			if cameraOn then
				CameraFx.FovPunch(action.Delta or 8, action.Time)
			end
		elseif kind == "HitStop" then
			CameraFx.HitStop(action.Time or 0.06)
		elseif kind == "SlowMo" then
			CameraFx.SlowMo(action.Scale or 0.3, action.Time or 0.8)
		elseif kind == "Flash" then
			if cameraOn or action.Everyone then
				CameraFx.Flash(action.Color, action.Time)
			end
		elseif kind == "Bloom" then
			CameraFx.BloomPulse(action.Amount or 1, action.Time or 0.8)
		elseif kind == "Vignette" then
			if cameraOn then
				CameraFx.Vignette(action.Amount or 0.5, action.Time or 1)
			end
		elseif kind == "Duck" then
			Audio.Duck(action.Amount or 0.5, action.Time or 1)
		elseif kind == "Haptic" then
			if cameraOn then
				Audio.Haptic(action.Amount or 0.5, action.Time or 0.2)
			end
		elseif kind == "Pulse" then
			WorldReactions.Pulse(anchorPos(a, "Marker"), action.Power or 20)
		elseif kind == "Popup" then
			if SequencePlayer.OnPopup then
				SequencePlayer.OnPopup(metresText, anchorPos(a, "Marker"), ctx)
			end
		elseif kind == "Shot" then
			shotName = action.Name
		elseif kind == "Hide" then
			rig:SetTransparency(1)
		elseif kind == "Banner" then
			if SequencePlayer.OnBanner then
				SequencePlayer.OnBanner(ctx, action)
			end
		end
	end

	-- Flatten cue actions into a time-sorted list.
	local events = {}
	for _, cue in def.Cues do
		for _, action in cue.Actions do
			table.insert(events, { T = cue.At + (action.Delay or 0), A = action, Cue = cue.Cue })
		end
	end
	table.sort(events, function(x, y)
		return x.T < y.T
	end)
	local nextIndex = 1

	local function finish()
		if handle.Done then
			return
		end
		handle.Done = true
		for key, s in loops do
			Audio.Stop(s)
			loops[key] = nil
		end
		rig:Destroy()
		if cameraOn and not released then
			released = true
			CameraFx.Release()
		end
	end

	function handle.Skip()
		-- The buyer can skip the camera portion; the world sequence keeps playing.
		if cameraOn and not released then
			released = true
			handle.Skipped = true
			CameraFx.Release()
		end
	end

	local conn
	conn = RunService.Heartbeat:Connect(function(rawDt)
		local dt = rawDt * CameraFx.Clock
		clock += dt
		while nextIndex <= #events and events[nextIndex].T <= clock do
			local ok, err = pcall(act, events[nextIndex].A)
			if not ok then
				warn("[Sequence] " .. def.Id .. ": " .. tostring(err))
			end
			nextIndex += 1
		end
		if motion then
			motion.T += dt
			local k = math.clamp(motion.T / motion.D, 0, 1)
			local e = motion.Ease(k)
			local pos = motion.From.Position:Lerp(motion.To.Position, e) + Vector3.new(0, math.sin(k * math.pi) * motion.Arc, 0)
			local rot = motion.From.Rotation
			if motion.Tumble then
				rot *= CFrame.Angles(k * motion.Tumble, k * motion.Tumble * 0.6, 0)
			end
			rig:SetRoot(CFrame.new(pos) * rot)
			if k >= 1 then
				motion = nil
			end
		end
		if spin then
			spin.Angle += spin.Speed * dt
			local r = spin.Axis == "Z" and CFrame.Angles(0, 0, spin.Angle) or CFrame.Angles(0, spin.Angle, 0)
			rig:SetBoneOffset(spin.Bone, r)
		end
		if squash then
			squash.T += dt
			local k = math.clamp(squash.T / squash.D, 0, 1)
			local s = 1 + (squash.S - 1) * math.sin(k * math.pi)
			rig:SetScale(s)
			if k >= 1 then
				rig:SetScale(def.Scale or 1)
				squash = nil
			end
		end
		if inHand and a.Character then
			local hand = CharacterAnimator.RightHand(a.Character)
			if hand then
				rig:SetRoot(hand * CFrame.new(0, -0.6, 0))
			end
		end
		rig:Step(dt)
		if clock >= def.Duration then
			conn:Disconnect()
			finish()
		end
	end)
	return handle
end

return SequencePlayer
