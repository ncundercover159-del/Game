--[[
	WorldService: server-side glue for the map.
	  * Auto-Digger bays: every player gets a rim bay (tag "BaySlot",
	    attribute Slot). The bay's attributes (OwnerUserId, OwnerName, Level)
	    replicate; clients render the matching rig for the nearest bays only.
	  * Store kiosk (the market stall): a ProximityPrompt opens the store only
	    when the player activates it. Never automatic.
	  * VIP Rim Lounge: pass owners are lifted onto the raised deck; others
	    see the pass in the store, again only on activation.
	  * Portal to the Minigame Hub and back.
	  * Players who fall into the hole are returned safely to the rim.
]]

local CollectionService = game:GetService("CollectionService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local Net = require(Shared.Net)

local Services = script.Parent
local function svc(name)
	return require(Services[name])
end

local WorldService = {}

local bayOf = {} -- [Player] = slot part

local function firstTagged(tag: string): BasePart?
	return CollectionService:GetTagged(tag)[1]
end

function WorldService.Teleport(player: Player, cf: CFrame)
	local character = player.Character
	if not character then
		return
	end
	pcall(function()
		player:RequestStreamAroundAsync(cf.Position, 5)
	end)
	character:PivotTo(cf + Vector3.new(0, 3.5, 0))
end

------------------------------------------------------------------------------
-- Auto-Digger bays
------------------------------------------------------------------------------
local function freeBay(): BasePart?
	local slots = CollectionService:GetTagged("BaySlot")
	table.sort(slots, function(a, b)
		return (a:GetAttribute("Slot") or 0) < (b:GetAttribute("Slot") or 0)
	end)
	for _, slot in slots do
		if not slot:GetAttribute("OwnerUserId") or slot:GetAttribute("OwnerUserId") == 0 then
			return slot
		end
	end
	return nil
end

function WorldService.AssignBay(player: Player)
	if bayOf[player] then
		return bayOf[player]
	end
	local slot = freeBay()
	if not slot then
		return nil
	end
	bayOf[player] = slot
	slot:SetAttribute("OwnerUserId", player.UserId)
	slot:SetAttribute("OwnerName", player.DisplayName)
	WorldService.RefreshBay(player)
	return slot
end

function WorldService.RefreshBay(player: Player)
	local slot = bayOf[player]
	local data = svc("DataService").Get(player)
	if slot and data then
		slot:SetAttribute("Level", data.AutoDiggerLevel)
	end
	player:SetAttribute("AutoDiggerLevel", data and data.AutoDiggerLevel or 0)
end

function WorldService.ReleaseBay(player: Player)
	local slot = bayOf[player]
	if slot then
		slot:SetAttribute("OwnerUserId", 0)
		slot:SetAttribute("OwnerName", "")
		slot:SetAttribute("Level", 0)
	end
	bayOf[player] = nil
end

function WorldService.BayFor(player: Player)
	return bayOf[player]
end

------------------------------------------------------------------------------
-- Prompts
------------------------------------------------------------------------------
local function addPrompt(part: Instance, action: string, object: string, handler)
	if not part or part:FindFirstChild("KD_Prompt") then
		return
	end
	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = "KD_Prompt"
	prompt.ActionText = action
	prompt.ObjectText = object
	prompt.MaxActivationDistance = 12
	prompt.RequiresLineOfSight = false
	prompt.Parent = part
	prompt.Triggered:Connect(handler)
	return prompt
end

local function setupPrompts()
	for _, kiosk in CollectionService:GetTagged("StoreKiosk") do
		addPrompt(kiosk, "Open Store", "Store", function(player)
			Net.Event("OpenUI"):FireClient(player, { Panel = "Store", Surface = "Kiosk" })
		end)
	end
	for _, entry in CollectionService:GetTagged("LoungeEntry") do
		addPrompt(entry, "Enter VIP Lounge", "VIP Rim Lounge", function(player)
			if svc("EntitlementService").Has(player, "pass_vip") then
				local spot = firstTagged("LoungeSpot")
				if spot then
					WorldService.Teleport(player, spot.CFrame)
				end
			else
				Net.Event("OpenUI"):FireClient(player, { Panel = "Store", Tab = "Upgrades", Item = "pass_vip", Surface = "LoungeDoor" })
			end
		end)
	end
	for _, exit in CollectionService:GetTagged("LoungeExit") do
		addPrompt(exit, "Leave Lounge", "VIP Rim Lounge", function(player)
			local spot = firstTagged("LoungeExitSpot")
			if spot then
				WorldService.Teleport(player, spot.CFrame)
			end
		end)
	end
	for _, portal in CollectionService:GetTagged("PortalHub") do
		addPrompt(portal, "Enter Minigame Hub", "Portal", function(player)
			local spawn = firstTagged("HubSpawn")
			if spawn then
				WorldService.Teleport(player, spawn.CFrame)
			end
		end)
	end
	for _, portal in CollectionService:GetTagged("PortalBack") do
		addPrompt(portal, "Back to the Hole", "Portal", function(player)
			local spot = firstTagged("PortalReturn")
			if spot then
				WorldService.Teleport(player, spot.CFrame)
			end
		end)
	end
end

------------------------------------------------------------------------------
-- Fall rescue
------------------------------------------------------------------------------
local function rescueCFrame(position: Vector3): CFrame
	local flat = Vector3.new(position.X, 0, position.Z)
	local dir = flat.Magnitude > 0.1 and flat.Unit or Vector3.new(0, 0, 1)
	local rim = dir * (Config.Hole.TopRadiusStuds + 12) + Vector3.new(0, 2, 0)
	return CFrame.lookAt(rim, Vector3.new(0, rim.Y, 0))
end

function WorldService.CheckFalls()
	for _, player in Players:GetPlayers() do
		local character = player.Character
		local root = character and character:FindFirstChild("HumanoidRootPart")
		if root then
			local p = root.Position
			local horizontal = Vector3.new(p.X, 0, p.Z).Magnitude
			local inHole = horizontal < Config.Hole.TopRadiusStuds + 2 and p.Y < Config.Hole.FallRescueY
			local offWorld = p.Y < -250 and math.abs(p.Z) < 900
			if inHole or offWorld then
				root.AssemblyLinearVelocity = Vector3.zero
				WorldService.Teleport(player, rescueCFrame(p))
				Net.Event("Notify"):FireClient(player, { Kind = "Info", Text = "Whoa! The crew hauled you back up to the rim." })
			end
		end
	end
end

function WorldService.Init()
	setupPrompts()
	svc("DataService").Loaded:Connect(function(player)
		WorldService.AssignBay(player)
	end)
	Players.PlayerRemoving:Connect(WorldService.ReleaseBay)
end

function WorldService.Start()
	local accumulator = 0
	RunService.Heartbeat:Connect(function(dt)
		accumulator += dt
		if accumulator >= 0.25 then
			accumulator = 0
			WorldService.CheckFalls()
		end
	end)
end

return WorldService
