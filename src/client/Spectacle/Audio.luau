--[[
	Audio: the central audio module. Named cues, each a layered set of
	sounds with pitch/volume variation, positional falloff and ducking under
	the big hits. Each cue prefers the uploaded original SFX
	(AssetRegistry.Sounds, synthesized by tools/synth_audio.py) and falls back
	to sounds shipped with the Roblox client so Studio test mode has audio.
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local SoundService = game:GetService("SoundService")
local HapticService = game:GetService("HapticService")
local TweenService = game:GetService("TweenService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local AssetRegistry = require(Shared.AssetRegistry)

local Audio = {}
Audio.Volume = 0.8

local B = "rbxasset://sounds/"
-- cue = { { fallback file, volume, pitch, pitchJitter }, ... }
Audio.Cues = {
	ui_click = { { B .. "clickfast.wav", 0.4, 1, 0.05 } },
	ui_pop = { { B .. "electronicpingshort.wav", 0.35, 1.4, 0.1 } },
	whoosh_small = { { B .. "swoosh.wav", 0.5, 1.3, 0.1 } },
	whoosh_big = { { B .. "swoosh.wav", 0.8, 0.7, 0.05 } },
	pebble_windup = { { B .. "swoosh.wav", 0.25, 1.8, 0.1 } },
	pebble_plink = { { B .. "electronicpingshort.wav", 0.6, 2.2, 0.15 }, { B .. "hit.wav", 0.3, 1.6, 0.1 } },
	pebble_echo = { { B .. "electronicpingshort.wav", 0.25, 1.8, 0.05 } },
	shovel_scrape = { { B .. "hit.wav", 0.5, 0.8, 0.15 }, { B .. "swoosh.wav", 0.25, 1.6, 0.1 } },
	pick_clang = { { B .. "hit.wav", 0.8, 1.4, 0.1 }, { B .. "electronicpingshort.wav", 0.3, 0.9, 0.1 } },
	jack_loop = { { B .. "clickfast.wav", 0.7, 0.6, 0.02 } },
	fuse_hiss = { { B .. "swoosh.wav", 0.4, 2.4, 0.05 } },
	tick = { { B .. "clickfast.wav", 0.6, 1.2, 0 } },
	boom_small = { { B .. "Rocket shot.wav", 0.8, 0.8, 0.08 }, { B .. "hit.wav", 0.6, 0.5, 0.05 } },
	boom_big = { { B .. "Rocket shot.wav", 1, 0.5, 0.04 }, { B .. "hit.wav", 0.9, 0.3, 0.03 } },
	engine = { { B .. "Launching rocket.wav", 0.4, 0.6, 0.05 } },
	horn = { { B .. "electronicpingshort.wav", 0.7, 0.45, 0 } },
	drill = { { B .. "Rocket whoosh 01.wav", 0.6, 0.8, 0.05 } },
	rumble = { { B .. "Launching rocket.wav", 0.7, 0.35, 0.03 } },
	beam = { { B .. "electronicpingshort.wav", 0.6, 0.3, 0 }, { B .. "swoosh.wav", 0.5, 0.4, 0 } },
	siren = { { B .. "electronicpingshort.wav", 0.6, 0.8, 0 } },
	sonic = { { B .. "Rocket shot.wav", 1, 0.35, 0 } },
	find = { { B .. "electronicpingshort.wav", 0.7, 1.6, 0 }, { B .. "victory.wav", 0.35, 1.2, 0 } },
	fanfare = { { B .. "victory.wav", 0.8, 1, 0 } },
	crack = { { B .. "glassbreak.wav", 0.5, 0.7, 0.1 } },
	swing = { { B .. "swordlunge.wav", 0.45, 1.1, 0.1 } },
}

local group = Instance.new("SoundGroup")
group.Name = "KD_Sfx"
group.Volume = 1
group.Parent = SoundService

local holder = Instance.new("Part")
holder.Anchored = true
holder.CanCollide = false
holder.CanQuery = false
holder.Transparency = 1
holder.Name = "KD_AudioEmitter"

local pool = {}

local function getSound(parent)
	local s = table.remove(pool)
	if not s then
		s = Instance.new("Sound")
		s.SoundGroup = group
	end
	s.Parent = parent
	return s
end

local function emitterAt(position: Vector3?)
	if not position then
		return SoundService
	end
	local p = holder:Clone()
	p.Position = position
	p.Parent = workspace
	task.delay(8, function()
		p:Destroy()
	end)
	return p
end

-- Plays a cue (optionally positional). Returns the sounds (for loops).
function Audio.Play(cue: string, position: Vector3?, opts)
	opts = opts or {}
	local layers = Audio.Cues[cue]
	if not layers then
		return {}
	end
	local parent = emitterAt(position)
	local uploaded = AssetRegistry.Sound(cue)
	local played = {}
	for i, layer in layers do
		if uploaded and i > 1 then
			break
		end
		local s = getSound(parent)
		s.SoundId = uploaded or layer[1]
		s.Volume = layer[2] * Audio.Volume * (opts.Volume or 1)
		s.PlaybackSpeed = (opts.Pitch or 1) * layer[3] * (1 + (math.random() * 2 - 1) * layer[4])
		s.RollOffMaxDistance = opts.Range or 300
		s.RollOffMinDistance = 20
		s.Looped = opts.Loop == true
		s:Play()
		table.insert(played, s)
		if not s.Looped then
			task.delay(6, function()
				s:Stop()
				s.Parent = nil
				table.insert(pool, s)
			end)
		end
	end
	return played
end

function Audio.Stop(sounds)
	for _, s in sounds or {} do
		s:Stop()
		s.Looped = false
		s.Parent = nil
		table.insert(pool, s)
	end
end

-- Duck everything under a big hit, then recover.
function Audio.Duck(amount: number, duration: number)
	group.Volume = 1 - amount
	TweenService:Create(group, TweenInfo.new(duration, Enum.EasingStyle.Quad), { Volume = 1 }):Play()
end

function Audio.Haptic(strength: number, duration: number)
	pcall(function()
		for _, input in { Enum.UserInputType.Gamepad1, Enum.UserInputType.Touch } do
			if HapticService:IsVibrationSupported(input) then
				HapticService:SetMotor(input, Enum.VibrationMotor.Large, strength)
				task.delay(duration, function()
					HapticService:SetMotor(input, Enum.VibrationMotor.Large, 0)
				end)
			end
		end
	end)
end

return Audio
