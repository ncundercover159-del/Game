--[[
	CharacterAnimator: plays CharacterClips on any R15 character as additive
	Motor6D C0 offsets (locally on every client), or through the Animator
	when an uploaded AnimationId exists. Restores C0 afterwards.
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local KeyframeLite = require(Shared.KeyframeLite)
local CharacterClips = require(Shared.CharacterClips)
local AssetRegistry = require(Shared.AssetRegistry)

local CharacterAnimator = {}

local JOINTS = {
	RightShoulder = "RightUpperArm",
	LeftShoulder = "LeftUpperArm",
	Waist = "UpperTorso",
	Neck = "Head",
	Root = "LowerTorso",
}

local playing = {} -- [character] = { clip, t, motors = { [joint] = { motor, base } } }

function CharacterAnimator.Play(character: Model?, clipName: string)
	if not character then
		return
	end
	local animId = AssetRegistry.Animation(clipName)
	local humanoid = character:FindFirstChildOfClass("Humanoid")
	if animId and humanoid then
		local animator = humanoid:FindFirstChildOfClass("Animator")
		if animator then
			local anim = Instance.new("Animation")
			anim.AnimationId = animId
			animator:LoadAnimation(anim):Play(0.1)
			return
		end
	end
	local clip = CharacterClips[clipName]
	if not clip then
		return
	end
	local state = playing[character]
	if not state then
		state = { motors = {} }
		for joint, partName in JOINTS do
			local part = character:FindFirstChild(partName)
			local motor = part and part:FindFirstChild(joint)
			if motor and motor:IsA("Motor6D") then
				state.motors[joint] = { motor, motor.C0 }
			end
		end
		playing[character] = state
	end
	state.clip = clip
	state.t = 0
end

RunService.Stepped:Connect(function(_, dt)
	for character, state in playing do
		if not character.Parent then
			playing[character] = nil
			continue
		end
		state.t += dt
		local done = state.t > state.clip.Length + 0.25
		local pose = KeyframeLite.Sample(state.clip, math.min(state.t, state.clip.Length))
		for joint, entry in state.motors do
			local offset = (not done) and pose[joint] or CFrame.new()
			entry[1].C0 = entry[2] * offset
		end
		if done then
			playing[character] = nil
		end
	end
end)

function CharacterAnimator.RightHand(character: Model?): CFrame?
	local hand = character and (character:FindFirstChild("RightHand") or character:FindFirstChild("Right Arm"))
	return hand and hand.CFrame or nil
end

return CharacterAnimator
