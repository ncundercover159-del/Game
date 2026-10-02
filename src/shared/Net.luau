--[[
	Net: every remote the game uses, declared in one place.
	The server creates them under ReplicatedStorage.Remotes at startup
	(Net.Init); clients fetch them with Net.Event / Net.Function.

	Direction is noted per remote. Every client->server remote is wrapped by
	the server's RemoteGuard (rate limits + argument validation).
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Net = {}

Net.Events = {
	"HoleEvent", -- S->C discrete hole events: Dig, Find, State, Cycle, Pool, Bottom
	"Feed", -- S->C feed entries
	"Profile", -- S->C the local player's profile view (full or partial)
	"Notify", -- S->C toasts / banners
	"Boards", -- S->C leaderboard rows
	"PlayerFx", -- S->C other players' actions (swings, entrances, celebrations)
	"PromptTest", -- S->C Studio test-mode purchase confirmation
	"OpenUI", -- S->C open a panel after the player activated a prompt (store kiosk)
	"StationState", -- S->C entered / left a dig station
	"Minigame", -- S->C minigame state for participants
	"StationSwing", -- C->S one swing at a dig station
	"Analytics", -- C->S purchase funnel and engagement events
	"MinigameInput", -- C->S collect requests
}

Net.Unreliable = {
	"HoleTick", -- S->C batched depth (8 Hz)
	"Floaty", -- S->C Auto-Digger output pulses
}

Net.Functions = {
	"GetSnapshot", -- hole, finds, feed, boards, artifacts, pool, boosts
	"GetProfile", -- the caller's profile view
	"RequestPurchase", -- (itemId, options) -> result
	"TestPurchaseDecision", -- (token, accepted) Studio test mode only
	"Equip", -- (slot, itemId | false)
	"ShardBuy", -- (itemId)
	"ClaimDaily",
	"ClaimSeason", -- (track, tier)
	"SetText", -- (kind, text) plaque message
	"SetPreference", -- (key, value) flag design, name colour
	"LeaveStation",
	"Debug", -- (command, args) Studio test mode only
}

local folder: Folder? = nil

function Net.Init()
	assert(RunService:IsServer(), "Net.Init is server-only")
	if folder then
		return
	end
	local f = Instance.new("Folder")
	f.Name = "Remotes"
	for _, name in Net.Events do
		local r = Instance.new("RemoteEvent")
		r.Name = name
		r.Parent = f
	end
	for _, name in Net.Unreliable do
		local ok, r = pcall(Instance.new, "UnreliableRemoteEvent")
		if not ok then
			r = Instance.new("RemoteEvent")
		end
		r.Name = name
		r.Parent = f
	end
	for _, name in Net.Functions do
		local r = Instance.new("RemoteFunction")
		r.Name = name
		r.Parent = f
	end
	f.Parent = ReplicatedStorage
	folder = f
end

local function getFolder()
	if folder then
		return folder
	end
	folder = ReplicatedStorage:WaitForChild("Remotes", 60)
	return folder
end

function Net.Event(name: string): RemoteEvent
	local f = getFolder()
	return f:WaitForChild(name, 30)
end

function Net.Function(name: string): RemoteFunction
	local f = getFolder()
	return f:WaitForChild(name, 30)
end

return Net
