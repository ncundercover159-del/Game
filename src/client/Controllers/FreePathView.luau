--[[
	FreePathView: client visuals and controls for the free path.
	  * Auto-Digger bays: Lv0 hand-cranked bucket ... Lv5 mini boring rig,
	    each with an idle loop and an output pulse that sends "+0.1 m"
	    floaties to the hole. Only the nearest N bays render (distance LOD).
	  * Dig station mode: a big HOLD button swings the pickaxe; one
	    StationSwing per swing (the server validates and caps).
	  * Minigame status HUD.
	  * The Crew: voxel miner NPCs on the ladder, winch and dig frontier;
	    they duck and cheer on big digs. LOD'd and capped.
	  * Pets and rim flags for nearby players (capped per quality).
	  * Other players' station swings, entrance effects.
]]

local CollectionService = game:GetService("CollectionService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local CosmeticStyles = require(Shared.CosmeticStyles)
local Format = require(Shared.Util.Format)
local Net = require(Shared.Net)

local Kit = require(script.Parent.Parent.UI.Kit)
local State = require(script.Parent.Parent.State)
local EffectsKit = require(script.Parent.Parent.Spectacle.EffectsKit)
local Audio = require(script.Parent.Parent.Spectacle.Audio)
local CharacterAnimator = require(script.Parent.Parent.Spectacle.CharacterAnimator)

local New = Kit.New
local FreePathView = {}
FreePathView.Quality = "Medium"

local localPlayer = Players.LocalPlayer
local folder = New("Folder", { Name = "KD_FreePath", Parent = workspace })

local function box(model, size, cf, color, material)
	return New("Part", {
		Anchored = true,
		CanCollide = false,
		CanQuery = false,
		CastShadow = false,
		Size = size,
		CFrame = cf,
		Color = color,
		Material = material or Enum.Material.SmoothPlastic,
		Parent = model,
	})
end

------------------------------------------------------------------------------
-- Auto-Digger bay rigs (GREYBOX, AssetKey bay_lv<n>)
------------------------------------------------------------------------------
local rgb = Color3.fromRGB
local BAY_DESIGNS = {
	[0] = function(m, cf) -- hand-cranked bucket on a wooden frame
		box(m, Vector3.new(0.4, 3.6, 0.4), cf * CFrame.new(-1.6, 1.8, 0), rgb(110, 76, 46), Enum.Material.Wood)
		box(m, Vector3.new(0.4, 3.6, 0.4), cf * CFrame.new(1.6, 1.8, 0), rgb(110, 76, 46), Enum.Material.Wood)
		box(m, Vector3.new(3.6, 0.35, 0.35), cf * CFrame.new(0, 3.5, 0), rgb(90, 90, 96), Enum.Material.Metal).Name = "Spin"
		box(m, Vector3.new(1.4, 1.2, 1.4), cf * CFrame.new(0, 1.6, 0), rgb(130, 96, 60), Enum.Material.WoodPlanks).Name = "Bob"
	end,
	[1] = function(m, cf) -- rusty auto-digger: little piston box
		box(m, Vector3.new(2.6, 2.2, 2.6), cf * CFrame.new(0, 1.1, 0), rgb(150, 90, 60), Enum.Material.CorrodedMetal)
		box(m, Vector3.new(0.6, 2.2, 0.6), cf * CFrame.new(0, 2.6, -0.6), rgb(110, 110, 116), Enum.Material.Metal).Name = "Bob"
		box(m, Vector3.new(0.5, 0.5, 0.5), cf * CFrame.new(0.9, 2.4, 0.9), rgb(255, 160, 60), Enum.Material.Neon)
	end,
	[2] = function(m, cf) -- steam auto-digger: boiler + chimney
		box(m, Vector3.new(3.2, 2.6, 3.2), cf * CFrame.new(0, 1.3, 0), rgb(70, 74, 86), Enum.Material.Metal)
		box(m, Vector3.new(0.8, 2.6, 0.8), cf * CFrame.new(1, 3.6, 1), rgb(40, 40, 46), Enum.Material.Metal).Name = "Chimney"
		box(m, Vector3.new(0.7, 2.6, 0.7), cf * CFrame.new(-0.6, 2.6, -1), rgb(236, 176, 44), Enum.Material.SmoothPlastic).Name = "Bob"
	end,
	[3] = function(m, cf) -- twin-bit
		box(m, Vector3.new(3.6, 2.4, 3), cf * CFrame.new(0, 1.2, 0), rgb(236, 176, 44), Enum.Material.SmoothPlastic)
		box(m, Vector3.new(0.6, 3, 0.6), cf * CFrame.new(-0.9, 1.6, -1.8), rgb(180, 186, 196), Enum.Material.Metal).Name = "Spin"
		box(m, Vector3.new(0.6, 3, 0.6), cf * CFrame.new(0.9, 1.6, -1.8), rgb(180, 186, 196), Enum.Material.Metal).Name = "Spin2"
	end,
	[4] = function(m, cf) -- turbo: bigger housing, glowing vents
		box(m, Vector3.new(4.2, 3, 3.6), cf * CFrame.new(0, 1.5, 0), rgb(200, 60, 50), Enum.Material.SmoothPlastic)
		box(m, Vector3.new(4.3, 0.4, 3.7), cf * CFrame.new(0, 2.2, 0), rgb(255, 150, 40), Enum.Material.Neon)
		box(m, Vector3.new(1, 3.4, 1), cf * CFrame.new(0, 1.8, -2.2), rgb(190, 196, 206), Enum.Material.Metal).Name = "Spin"
	end,
	[5] = function(m, cf) -- mini boring rig: cutter disc + segmented body
		box(m, Vector3.new(4.6, 3.6, 5), cf * CFrame.new(0, 1.8, 0.4), rgb(236, 176, 44), Enum.Material.SmoothPlastic)
		local disc = box(m, Vector3.new(0.8, 4.2, 4.2), cf * CFrame.new(0, 2, -2.6) * CFrame.Angles(0, math.rad(90), 0), rgb(150, 156, 166), Enum.Material.Metal)
		disc.Shape = Enum.PartType.Cylinder
		disc.Name = "Disc"
		box(m, Vector3.new(0.6, 0.6, 0.6), cf * CFrame.new(1.8, 3.8, 1.8), rgb(80, 240, 255), Enum.Material.Neon)
	end,
}

local bays = {} -- [slotPart] = { Model, Level, Owner, Parts }

local function buildBay(slot: BasePart, level: number)
	local model = New("Model", { Name = "Bay", Parent = folder })
	model:SetAttribute("AssetKey", "bay_lv" .. level)
	model:AddTag("GREYBOX")
	local yaw = math.rad(slot:GetAttribute("Yaw") or 0)
	local cf = CFrame.new(slot.Position + Vector3.new(0, 0.4, 0)) * CFrame.Angles(0, yaw, 0)
	BAY_DESIGNS[math.clamp(level, 0, 5)](model, cf)
	local name = slot:GetAttribute("OwnerName") or ""
	local tag = New("BillboardGui", { Size = UDim2.fromOffset(140, 30), StudsOffset = Vector3.new(0, 5.5, 0), MaxDistance = 70, Parent = model:FindFirstChildWhichIsA("BasePart") })
	Kit.Label({ Text = name .. "  Lv" .. level, Color = Kit.Colors.Cream, Stroke = Kit.Colors.Slate, Parent = tag })
	local entry = { Model = model, Level = level, Owner = slot:GetAttribute("OwnerUserId"), Base = {} }
	for _, p in model:GetChildren() do
		if p:IsA("BasePart") then
			entry.Base[p] = p.CFrame
		end
	end
	return entry
end

local function updateBays(t)
	local camera = workspace.CurrentCamera
	local slots = {}
	for _, slot in CollectionService:GetTagged("BaySlot") do
		local owner = slot:GetAttribute("OwnerUserId") or 0
		if owner ~= 0 then
			table.insert(slots, { Slot = slot, D = (slot.Position - camera.CFrame.Position).Magnitude, Mine = owner == localPlayer.UserId })
		elseif bays[slot] then
			bays[slot].Model:Destroy()
			bays[slot] = nil
		end
	end
	table.sort(slots, function(a, b)
		if a.Mine ~= b.Mine then
			return a.Mine
		end
		return a.D < b.D
	end)
	local limit = Config.Graphics.VisibleBays[FreePathView.Quality] or 12
	local keep = {}
	for i, s in slots do
		if i <= limit and s.D < Config.Graphics.BayLodDistance then
			keep[s.Slot] = true
			local level = s.Slot:GetAttribute("Level") or 0
			local entry = bays[s.Slot]
			if not entry or entry.Level ~= level or entry.Owner ~= s.Slot:GetAttribute("OwnerUserId") then
				if entry then
					entry.Model:Destroy()
				end
				bays[s.Slot] = buildBay(s.Slot, level)
			end
		end
	end
	for slot, entry in bays do
		if not keep[slot] then
			entry.Model:Destroy()
			bays[slot] = nil
		else
			-- idle animation
			for p, base in entry.Base do
				if p.Name == "Bob" then
					p.CFrame = base * CFrame.new(0, math.abs(math.sin(t * 3 + entry.Level)) * 0.5, 0)
				elseif p.Name == "Spin" or p.Name == "Spin2" then
					p.CFrame = base * CFrame.Angles(0, t * (4 + entry.Level), 0)
				elseif p.Name == "Disc" then
					p.CFrame = base * CFrame.Angles(t * 5, 0, 0)
				end
			end
		end
	end
end

local function floaty(userId: number, amount: number)
	for slot, entry in bays do
		if entry.Owner == userId then
			local start = slot.Position + Vector3.new(0, 5, 0)
			local gui = New("BillboardGui", { Size = UDim2.fromOffset(90, 26), AlwaysOnTop = false, MaxDistance = 90, Adornee = nil })
			local anchor = New("Part", { Anchored = true, CanCollide = false, CanQuery = false, Transparency = 1, Size = Vector3.one, Position = start, Parent = folder })
			gui.Adornee = anchor
			gui.Parent = anchor
			Kit.Label({ Text = "+" .. Format.Metres(amount, true), Display = true, Color = Kit.Colors.GoldLight, Stroke = Kit.Colors.GoldDark, Parent = gui })
			local target = Vector3.new(0, 2, 0)
			task.spawn(function()
				local t0 = os.clock()
				while os.clock() - t0 < 1.4 do
					local k = (os.clock() - t0) / 1.4
					anchor.Position = start:Lerp(target, k * k) + Vector3.new(0, math.sin(k * math.pi) * 8, 0)
					RunService.Heartbeat:Wait()
				end
				anchor:Destroy()
			end)
			return
		end
	end
end

------------------------------------------------------------------------------
-- Crew
------------------------------------------------------------------------------
local crew = {}
local function buildMiner(cf: CFrame, i: number)
	local m = New("Model", { Name = "Miner", Parent = folder })
	m:SetAttribute("AssetKey", "crew_miner")
	m:AddTag("GREYBOX")
	local skin = ({ rgb(255, 214, 170), rgb(214, 160, 120), rgb(150, 100, 70) })[i % 3 + 1]
	local parts = {
		Body = box(m, Vector3.new(1.6, 1.8, 1), CFrame.new(), rgb(60, 110, 200), Enum.Material.Fabric),
		Head = box(m, Vector3.new(1.1, 1.1, 1.1), CFrame.new(), skin),
		Hat = box(m, Vector3.new(1.3, 0.5, 1.3), CFrame.new(), rgb(255, 196, 40)),
		Lamp = box(m, Vector3.new(0.35, 0.3, 0.2), CFrame.new(), rgb(255, 250, 210), Enum.Material.Neon),
		ArmL = box(m, Vector3.new(0.5, 1.4, 0.5), CFrame.new(), rgb(60, 110, 200), Enum.Material.Fabric),
		ArmR = box(m, Vector3.new(0.5, 1.4, 0.5), CFrame.new(), rgb(60, 110, 200), Enum.Material.Fabric),
		Legs = box(m, Vector3.new(1.4, 1.4, 0.9), CFrame.new(), rgb(80, 60, 50), Enum.Material.Fabric),
		Pick = box(m, Vector3.new(0.25, 2.2, 0.25), CFrame.new(), rgb(120, 84, 50), Enum.Material.Wood),
	}
	return { Model = m, P = parts, Base = cf, Phase = i * 1.3, Cheer = 0, Duck = 0 }
end

local function poseMiner(c, t)
	local base = c.Base * CFrame.new(0, -c.Duck * 0.6, 0)
	local swing = math.sin(t * 4 + c.Phase)
	local cheer = c.Cheer
	local P = c.P
	local list, cfs = {}, {}
	local function put(part, cf)
		table.insert(list, part)
		table.insert(cfs, cf)
	end
	put(P.Legs, base * CFrame.new(0, 0.7, 0))
	put(P.Body, base * CFrame.new(0, 2.3, 0) * CFrame.Angles(math.rad(10 * swing * (1 - cheer)), 0, 0))
	put(P.Head, base * CFrame.new(0, 3.75, 0))
	put(P.Hat, base * CFrame.new(0, 4.4, 0))
	put(P.Lamp, base * CFrame.new(0, 4.25, -0.7))
	local armSwing = cheer > 0 and math.rad(160) or math.rad(60 + 60 * swing)
	put(P.ArmR, base * CFrame.new(1.05, 2.9, 0) * CFrame.Angles(-armSwing, 0, 0) * CFrame.new(0, -0.6, 0))
	put(P.ArmL, base * CFrame.new(-1.05, 2.9, 0) * CFrame.Angles(cheer > 0 and -armSwing or -armSwing * 0.8, 0, 0) * CFrame.new(0, -0.6, 0))
	put(P.Pick, base * CFrame.new(1.05, 2.9, 0) * CFrame.Angles(-armSwing, 0, 0) * CFrame.new(0, -1.6, -0.4))
	workspace:BulkMoveTo(list, cfs, Enum.BulkMoveMode.FireCFrameChanged)
end

local function buildCrew()
	local points = CollectionService:GetTagged("CrewPoint")
	table.sort(points, function(a, b)
		return (a:GetAttribute("Index") or 0) < (b:GetAttribute("Index") or 0)
	end)
	for i, p in points do
		if i > Config.Crew.MaxVisibleMiners then
			break
		end
		local c = buildMiner(p.CFrame, i)
		c.Role = p:GetAttribute("Role")
		c.Point = p
		table.insert(crew, c)
	end
end

local function updateCrew(t, dt)
	local camera = workspace.CurrentCamera
	local markerY = require(script.Parent.WorldView).MarkerPosition().Y
	for i, c in crew do
		if c.Role == "Frontier" then
			local off = c.Point.Position
			c.Base = CFrame.new(off.X, markerY + 0.6, off.Z) * CFrame.Angles(0, i * 1.9, 0)
		elseif c.Role == "Ladder" then
			local p = c.Point.Position
			local climb = math.sin(t * 0.4 + i) * 4
			c.Base = CFrame.lookAt(Vector3.new(p.X, math.max(markerY + 2, p.Y + climb), p.Z), Vector3.new(0, p.Y, 0))
		else
			c.Base = c.Point.CFrame
		end
		c.Cheer = math.max(0, c.Cheer - dt)
		c.Duck = math.max(0, c.Duck - dt * 2)
		local far = (c.Base.Position - camera.CFrame.Position).Magnitude > Config.Graphics.CrewLodDistance
		c.Model.Parent = far and nil or folder
		if not far then
			poseMiner(c, t)
		end
	end
end

function FreePathView.CrewReact(power: number)
	for _, c in crew do
		c.Duck = math.min(1, power / 30)
		task.delay(0.5, function()
			c.Cheer = 1.6
		end)
	end
end

------------------------------------------------------------------------------
-- Station mode (HOLD to swing)
------------------------------------------------------------------------------
local stationGui, holdButton, bucketBar
local holding, stationActive, interval, perBucket = false, false, 1.25, 4
local swings = 0

local function setStation(state)
	stationActive = state.Active
	if not stationGui then
		stationGui = Kit.Screen("KD_Station", 6)
		holdButton = Kit.Button({ Text = "HOLD TO DIG", Style = "Green", Size = UDim2.fromOffset(190, 110), Position = UDim2.new(1, -150, 1, -150), Anchor = Vector2.new(1, 1), Radius = 28, Parent = stationGui })
		holdButton.MouseButton1Down:Connect(function()
			holding = true
		end)
		holdButton.MouseButton1Up:Connect(function()
			holding = false
		end)
		holdButton.MouseLeave:Connect(function()
			holding = false
		end)
		local bar = New("Frame", { BackgroundColor3 = Kit.Colors.Slate, Size = UDim2.fromOffset(190, 16), Position = UDim2.new(1, -150, 1, -268), Anchor = Vector2.new(1, 1), Parent = stationGui }, { Kit.Corner(8) })
		bucketBar = New("Frame", { BackgroundColor3 = Kit.Colors.Cyan, Size = UDim2.fromScale(0, 1), Parent = bar }, { Kit.Corner(8) })
		Kit.Button({ Text = "Leave", Style = "Slate", Size = UDim2.fromOffset(100, 44), Position = UDim2.new(1, -150, 1, -290), Anchor = Vector2.new(1, 1), Parent = stationGui, OnClick = function()
			Net.Function("LeaveStation"):InvokeServer()
		end })
	end
	stationGui.Enabled = stationActive
	interval = state.Interval or interval
	perBucket = state.SwingsPerBucket or perBucket
	holding = false
end

local lastSwing = 0
local function stationStep()
	if not (stationActive and holding) then
		return
	end
	local now = os.clock()
	if now - lastSwing >= interval then
		lastSwing = now
		swings += 1
		CharacterAnimator.Play(localPlayer.Character, "Swing")
		Audio.Play("swing")
		task.delay(0.45, function()
			Audio.Play("pick_clang", nil, { Volume = 0.5, Pitch = 1.1 })
			local root = localPlayer.Character and localPlayer.Character:FindFirstChild("HumanoidRootPart")
			if root then
				local dir = (Vector3.new(0, root.Position.Y, 0) - root.Position).Unit
				EffectsKit.Debris(root.Position + dir * 4 + Vector3.new(0, -1, 0), 3, 16)
			end
		end)
		Net.Event("StationSwing"):FireServer()
		bucketBar.Size = UDim2.fromScale((swings % perBucket) / perBucket, 1)
	end
end

------------------------------------------------------------------------------
-- Minigame HUD
------------------------------------------------------------------------------
local mgGui, mgLabel
local function minigame(msg)
	if not mgGui then
		mgGui = Kit.Screen("KD_Minigame", 7)
		local _, face = Kit.Panel({ Size = UDim2.fromOffset(360, 70), Position = UDim2.new(0.5, 0, 0, 120), Anchor = Vector2.new(0.5, 0), Accent = Kit.Colors.Cyan, Parent = mgGui })
		mgLabel = Kit.Label({ Text = "", Display = true, Size = UDim2.new(1, -16, 1, -8), Position = UDim2.fromOffset(8, 4), Parent = face })
	end
	mgGui.Enabled = true
	local name = msg.Game == "GemRush" and "Gem Rush" or "Cave-In"
	if msg.Phase == "Lobby" then
		mgLabel.Text = string.format("%s starts in %d", name, msg.TimeLeft or 0)
	elseif msg.Phase == "Round" then
		mgLabel.Text = string.format("%s · %d s left", name, msg.TimeLeft or 0)
	elseif msg.Phase == "Score" then
		mgLabel.Text = string.format("Gems: %d", msg.Score or 0)
		Audio.Play("ui_pop")
	elseif msg.Phase == "Out" then
		mgLabel.Text = "Out! A boulder got you."
	elseif msg.Phase == "Results" then
		mgLabel.Text = msg.Text or "Round over"
		task.delay(5, function()
			mgGui.Enabled = false
		end)
	elseif msg.Phase == "Joined" then
		mgLabel.Text = "Joined " .. name .. "!"
	end
end

------------------------------------------------------------------------------
-- Pets and flags (nearest N)
------------------------------------------------------------------------------
local pets = {}
local function updatePets(t)
	local list = {}
	local camera = workspace.CurrentCamera
	for _, player in Players:GetPlayers() do
		local petId = player:GetAttribute("Eq_Pet")
		local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
		if petId and petId ~= "" and root then
			table.insert(list, { Player = player, Pet = petId, Root = root, D = (root.Position - camera.CFrame.Position).Magnitude })
		end
	end
	table.sort(list, function(a, b)
		return a.D < b.D
	end)
	local limit = Config.Graphics.VisiblePets[FreePathView.Quality] or 10
	local keep = {}
	for i, e in list do
		if i > limit then
			break
		end
		keep[e.Player] = true
		local pet = pets[e.Player]
		if not pet or pet.Id ~= e.Pet then
			if pet then
				pet.Model:Destroy()
			end
			local style = CosmeticStyles.Pets[e.Pet] or CosmeticStyles.Pets.pet_mole
			local m = New("Model", { Name = "Pet", Parent = folder })
			m:SetAttribute("AssetKey", e.Pet)
			m:AddTag("GREYBOX")
			local s = style.Size
			local body = box(m, Vector3.new(s, s * 0.8, s * 1.1), CFrame.new(), style.Body, style.Glow and Enum.Material.Neon or Enum.Material.SmoothPlastic)
			local belly = box(m, Vector3.new(s * 0.7, s * 0.5, 0.2), CFrame.new(), style.Belly)
			local nose = box(m, Vector3.new(s * 0.25, s * 0.25, s * 0.25), CFrame.new(), style.Nose, Enum.Material.Neon)
			pet = { Id = e.Pet, Model = m, Body = body, Belly = belly, Nose = nose, S = s, Hover = style.Hover, Pos = e.Root.Position }
			pets[e.Player] = pet
		end
		local target = e.Root.CFrame * Vector3.new(2.6, -1.8, 2.2)
		pet.Pos = pet.Pos:Lerp(target, 0.12)
		local bob = pet.Hover and (1.2 + math.sin(t * 3) * 0.3) or math.abs(math.sin(t * 8)) * 0.3
		local cf = CFrame.lookAt(pet.Pos + Vector3.new(0, bob, 0), pet.Pos + e.Root.CFrame.LookVector * 4 + Vector3.new(0, bob, 0))
		pet.Body.CFrame = cf
		pet.Belly.CFrame = cf * CFrame.new(0, -pet.S * 0.1, -pet.S * 0.55)
		pet.Nose.CFrame = cf * CFrame.new(0, pet.S * 0.1, -pet.S * 0.6)
	end
	for player, pet in pets do
		if not keep[player] then
			pet.Model:Destroy()
			pets[player] = nil
		end
	end
end

local flags = {}
local function updateFlags()
	local owners = {}
	for _, player in Players:GetPlayers() do
		if player:GetAttribute("Eq_Flag") == "flag_personal" then
			table.insert(owners, player)
		end
	end
	local limit = Config.Graphics.VisibleFlags[FreePathView.Quality] or 16
	for i, player in owners do
		if i > limit then
			break
		end
		local design = CosmeticStyles.FlagDesigns[player:GetAttribute("FlagDesign") or 1] or CosmeticStyles.FlagDesigns[1]
		local key = player.UserId .. ":" .. design.Name
		if not flags[player] or flags[player].Key ~= key then
			if flags[player] then
				flags[player].Model:Destroy()
			end
			local a = math.rad((i - 1) * (360 / math.max(8, #owners)) + 11)
			local base = Vector3.new(math.cos(a) * 62.6, 0, math.sin(a) * 62.6)
			local m = New("Model", { Name = "RimFlag", Parent = folder })
			box(m, Vector3.new(0.35, 9, 0.35), CFrame.new(base + Vector3.new(0, 4.5, 0)), rgb(220, 220, 225), Enum.Material.Metal)
			local cf = CFrame.lookAt(base + Vector3.new(0, 7.6, 0), base + Vector3.new(0, 7.6, 0) + Vector3.new(-math.sin(a), 0, math.cos(a))) * CFrame.new(-1.6, 0, 0)
			box(m, Vector3.new(3.2, 2, 0.12), cf, design.Field, Enum.Material.Fabric)
			box(m, Vector3.new(3.2, 0.4, 0.14), cf, design.Stripe, Enum.Material.Fabric)
			box(m, Vector3.new(0.8, 0.8, 0.16), cf * CFrame.new(0.6, 0, 0), design.Emblem, Enum.Material.Fabric)
			flags[player] = { Model = m, Key = key }
		end
	end
	for player, f in flags do
		if not player.Parent or player:GetAttribute("Eq_Flag") ~= "flag_personal" then
			f.Model:Destroy()
			flags[player] = nil
		end
	end
end

------------------------------------------------------------------------------
function FreePathView.Start()
	task.spawn(function()
		task.wait(3)
		buildCrew()
	end)
	Net.Event("Floaty").OnClientEvent:Connect(function(list)
		for _, entry in list do
			floaty(entry[1], entry[2])
		end
	end)
	Net.Event("StationState").OnClientEvent:Connect(setStation)
	Net.Event("Minigame").OnClientEvent:Connect(minigame)
	Net.Event("PlayerFx").OnClientEvent:Connect(function(fx)
		local player = Players:GetPlayerByUserId(fx.UserId)
		if not player or player == localPlayer then
			return
		end
		local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
		if fx.Type == "Swing" and root and (root.Position - workspace.CurrentCamera.CFrame.Position).Magnitude < 120 then
			CharacterAnimator.Play(player.Character, "Swing")
		elseif fx.Type == "Entrance" and root then
			local crystal = fx.Effect == "entrance_crystalrise"
			EffectsKit.Ring(root.Position - Vector3.new(0, 2.5, 0), 10, crystal and Kit.Colors.Cyan or rgb(139, 77, 39), 0.9)
			EffectsKit.Burst(crystal and "Glow" or "Dust", root.Position, 30, 1.2)
			EffectsKit.Debris(root.Position - Vector3.new(0, 2, 0), 16, 26)
			Audio.Play("boom_small", root.Position, { Pitch = 1.5, Volume = 0.6 })
		end
	end)
	local t = 0
	local acc = 0
	RunService.Heartbeat:Connect(function(dt)
		t += dt
		acc += dt
		stationStep()
		updatePets(t)
		updateCrew(t, dt)
		if acc > 0.25 then
			acc = 0
			updateBays(t)
			updateFlags()
		else
			for _, entry in bays do
				for p, base in entry.Base do
					if p.Name == "Bob" then
						p.CFrame = base * CFrame.new(0, math.abs(math.sin(t * 3 + entry.Level)) * 0.5, 0)
					elseif p.Name == "Spin" or p.Name == "Spin2" then
						p.CFrame = base * CFrame.Angles(0, t * (4 + entry.Level), 0)
					elseif p.Name == "Disc" then
						p.CFrame = base * CFrame.Angles(t * 5, 0, 0)
					end
				end
			end
		end
	end)
	-- The Gem Rush gems spin for everyone nearby.
	RunService.RenderStepped:Connect(function(dt)
		for _, gem in CollectionService:GetTagged("MinigameGem") do
			gem.CFrame *= CFrame.Angles(0, dt * 2, 0)
		end
	end)
end

return FreePathView
