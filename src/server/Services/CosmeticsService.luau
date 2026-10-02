--[[
	CosmeticsService: equipping and the server-side character cosmetics.

	* Equip(player, slot, itemId | false): the server decides what is owned
	  and equippable. Equipped items replicate as player attributes
	  ("Eq_<Slot>") so every client can render pets, flags and tool skins.
	* Character visuals built on the server (replicated): hard hat, trail,
	  aura, and the overhead name tag (name colour, title, VIP / Club /
	  Server Hero / Hole Breaker tags).
	* Plaque message and preference setters (filtered text).
]]

local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local Catalog = require(Shared.Catalog)
local CosmeticStyles = require(Shared.CosmeticStyles)
local Format = require(Shared.Util.Format)
local AssetRegistry = require(Shared.AssetRegistry)
local TextFilter = require(script.Parent.Parent.Lib.TextFilter)

local Services = script.Parent
local function svc(name)
	return require(Services[name])
end

local CosmeticsService = {}

local SLOTS = {}
for slot in Catalog.Slots do
	SLOTS[slot] = true
end

local filteredPlaqueMessages = {} -- [userId] = filtered text (cached per session)

------------------------------------------------------------------------------
-- Equip
------------------------------------------------------------------------------
function CosmeticsService.Equipped(player: Player, slot: string): string?
	local data = svc("DataService").Get(player)
	local value = data and data.Equipped[slot]
	if value == nil or value == false then
		local default = Catalog.Slots[slot]
		return default or nil
	end
	return value
end

function CosmeticsService.Equip(player: Player, slot: string, itemId: string | boolean, silent: boolean?)
	if not SLOTS[slot] then
		return { ok = false, reason = "Unknown slot." }
	end
	local DataService = svc("DataService")
	local data = DataService.Get(player)
	if not data then
		return { ok = false, reason = "Your data is still loading." }
	end
	if itemId == false or itemId == nil then
		data.Equipped[slot] = nil
	else
		local item = Catalog.Get(itemId :: string)
		if not item or item.Slot ~= slot then
			return { ok = false, reason = "That doesn't go there." }
		end
		if not svc("EntitlementService").Has(player, item.Id) then
			return { ok = false, reason = "You don't own that yet." }
		end
		data.Equipped[slot] = item.Id
	end
	DataService.MarkDirty(player)
	CosmeticsService.ApplyAttributes(player)
	CosmeticsService.RefreshCharacter(player)
	if slot == "PlaqueStyle" then
		svc("PlaqueService").MarkDirty()
	end
	if not silent then
		DataService.Push(player)
		svc("Analytics").Funnel(player, "Equipped", slot, tostring(itemId), 0, "Equip")
	end
	return { ok = true }
end

function CosmeticsService.ApplyAttributes(player: Player)
	local data = svc("DataService").Get(player)
	if not data then
		return
	end
	for slot in SLOTS do
		local value = CosmeticsService.Equipped(player, slot)
		player:SetAttribute("Eq_" .. slot, value or "")
	end
	player:SetAttribute("FlagDesign", data.FlagDesign or 1)
	player:SetAttribute("NameColor", data.NameColor or 0)
	player:SetAttribute("AutoDiggerLevel", data.AutoDiggerLevel or 0)
	player:SetAttribute("HoleBreaker", data.Titles.holebreaker == true)
end

------------------------------------------------------------------------------
-- Text and preferences
------------------------------------------------------------------------------
function CosmeticsService.SetPlaqueMessage(player: Player, text: string)
	local DataService = svc("DataService")
	local data = DataService.Get(player)
	if not data then
		return { ok = false, reason = "Your data is still loading." }
	end
	if not data.Owned.plaque_message then
		return { ok = false, reason = "Unlock Plaque Message in the Style tab first." }
	end
	local clean = Format.CleanLine(text, Config.Social.PlaqueMessageMaxChars)
	local filtered = TextFilter.ForBroadcast(clean, player.UserId)
	if filtered == nil then
		return { ok = false, reason = "We couldn't check that message. Please try again." }
	end
	data.PlaqueMessage = clean -- raw text is stored; only filtered text is ever shown
	filteredPlaqueMessages[player.UserId] = filtered
	DataService.MarkDirty(player)
	DataService.Push(player)
	svc("PlaqueService").MarkDirty()
	return { ok = true, filtered = filtered }
end

-- Filtered plaque message for display (re-filtered each session).
function CosmeticsService.PlaqueMessageFor(userId: number): string
	local cached = filteredPlaqueMessages[userId]
	if cached then
		return cached
	end
	local player = Players:GetPlayerByUserId(userId)
	local data = player and svc("DataService").Get(player)
	if not data or not data.Owned.plaque_message or data.PlaqueMessage == "" then
		return ""
	end
	local filtered = TextFilter.ForBroadcast(data.PlaqueMessage, userId) or ""
	filteredPlaqueMessages[userId] = filtered
	return filtered
end

function CosmeticsService.SetPreference(player: Player, key: string, value: number)
	local DataService = svc("DataService")
	local data = DataService.Get(player)
	if not data then
		return { ok = false, reason = "Your data is still loading." }
	end
	if key == "FlagDesign" then
		if not data.Owned.flag_personal then
			return { ok = false, reason = "Unlock the Personal Rim Flag first." }
		end
		data.FlagDesign = math.clamp(math.floor(value), 1, #CosmeticStyles.FlagDesigns)
	elseif key == "NameColor" then
		if not data.Owned.namecolor and value ~= 0 then
			return { ok = false, reason = "Unlock Name Colour first." }
		end
		data.NameColor = math.clamp(math.floor(value), 0, #CosmeticStyles.NameColors)
	else
		return { ok = false, reason = "Unknown setting." }
	end
	DataService.MarkDirty(player)
	CosmeticsService.ApplyAttributes(player)
	CosmeticsService.RefreshCharacter(player)
	DataService.Push(player)
	return { ok = true }
end

------------------------------------------------------------------------------
-- Character visuals (server-built, replicated)
------------------------------------------------------------------------------
local function clearTagged(character: Model, tagName: string)
	for _, child in character:GetDescendants() do
		if child:GetAttribute("KD_Cosmetic") == tagName then
			child:Destroy()
		end
	end
end

local function weld(part: BasePart, to: BasePart)
	local w = Instance.new("WeldConstraint")
	w.Part0 = part
	w.Part1 = to
	w.Parent = part
end

local function hatPart(name, size, cf, color, material, parent, head)
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size
	p.CFrame = head.CFrame * cf
	p.Color = color
	p.Material = material or Enum.Material.SmoothPlastic
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.Massless = true
	p.CastShadow = false
	p.Parent = parent
	weld(p, head)
	return p
end

local function buildHat(character: Model, hatId: string)
	local head = character:FindFirstChild("Head")
	local style = CosmeticStyles.Hats[hatId]
	if not head or not style then
		return
	end
	local model = Instance.new("Model")
	model.Name = "KD_HardHat"
	model:SetAttribute("KD_Cosmetic", "Hat")
	model:SetAttribute("AssetKey", hatId)
	model:AddTag("GREYBOX")
	local top = head.Size.Y / 2
	if style.Bandana then
		hatPart("Wrap", Vector3.new(1.25, 0.35, 1.25), CFrame.new(0, top - 0.15, 0), style.Shell, Enum.Material.Fabric, model, head)
		hatPart("Knot", Vector3.new(0.3, 0.3, 0.4), CFrame.new(0, top - 0.2, 0.65), style.Shell, Enum.Material.Fabric, model, head)
	else
		local shellMat = style.Shiny and Enum.Material.Foil or Enum.Material.SmoothPlastic
		hatPart("Shell", Vector3.new(1.25, 0.55, 1.25), CFrame.new(0, top + 0.12, 0), style.Shell, shellMat, model, head)
		hatPart("Dome", Vector3.new(0.95, 0.3, 0.95), CFrame.new(0, top + 0.5, 0), style.Shell, shellMat, model, head)
		hatPart("Brim", Vector3.new(1.55, 0.12, 1.55), CFrame.new(0, top - 0.12, -0.08), style.Brim, shellMat, model, head)
		if style.Stripe then
			hatPart("Ridge", Vector3.new(0.18, 0.12, 1.0), CFrame.new(0, top + 0.68, 0), style.Stripe, shellMat, model, head)
		end
		if style.Lamp then
			local lamp = hatPart("Lamp", Vector3.new(0.4, 0.3, 0.2), CFrame.new(0, top + 0.2, -0.68), style.Lamp, Enum.Material.Neon, model, head)
			local light = Instance.new("SpotLight")
			light.Brightness = 3
			light.Range = 18
			light.Angle = 50
			light.Face = Enum.NormalId.Front
			light.Parent = lamp
		end
		if style.Drill then
			hatPart("DrillBase", Vector3.new(0.35, 0.3, 0.35), CFrame.new(0, top + 0.78, 0), style.Brim, Enum.Material.Metal, model, head)
			hatPart("DrillBit", Vector3.new(0.18, 0.55, 0.18), CFrame.new(0, top + 1.18, 0), style.Drill, Enum.Material.Metal, model, head)
		end
		if style.Crystal then
			hatPart("CrystalA", Vector3.new(0.22, 0.6, 0.22), CFrame.new(0, top + 0.9, 0), style.Crystal, Enum.Material.Neon, model, head)
			hatPart("CrystalB", Vector3.new(0.18, 0.45, 0.18), CFrame.new(0.3, top + 0.75, 0) * CFrame.Angles(0, 0, math.rad(-20)), style.Crystal, Enum.Material.Neon, model, head)
			hatPart("CrystalC", Vector3.new(0.18, 0.45, 0.18), CFrame.new(-0.3, top + 0.75, 0) * CFrame.Angles(0, 0, math.rad(20)), style.Crystal, Enum.Material.Neon, model, head)
		end
		if style.Glow then
			hatPart("Vein", Vector3.new(1.27, 0.08, 1.27), CFrame.new(0, top + 0.22, 0), style.Glow, Enum.Material.Neon, model, head)
		end
	end
	model.Parent = character
	-- Final mesh from the Blender pipeline, if uploaded.
	local assetId = AssetRegistry.ModelId(hatId)
	if assetId then
		model:SetAttribute("AssetId", assetId)
	end
end

local function buildTrail(character: Model, trailId: string)
	local root = character:FindFirstChild("HumanoidRootPart")
	local style = CosmeticStyles.Trails[trailId]
	if not root or not style then
		return
	end
	local a0 = Instance.new("Attachment")
	a0.Name = "KD_TrailTop"
	a0.Position = Vector3.new(0, 0.9, 0.3)
	a0:SetAttribute("KD_Cosmetic", "Trail")
	a0.Parent = root
	local a1 = Instance.new("Attachment")
	a1.Name = "KD_TrailBottom"
	a1.Position = Vector3.new(0, -0.9, 0.3)
	a1:SetAttribute("KD_Cosmetic", "Trail")
	a1.Parent = root
	local trail = Instance.new("Trail")
	trail.Name = "KD_Trail"
	trail:SetAttribute("KD_Cosmetic", "Trail")
	trail.Attachment0 = a0
	trail.Attachment1 = a1
	trail.Lifetime = style.Lifetime
	trail.MinLength = 0.2
	trail.WidthScale = NumberSequence.new(style.Width, 0)
	trail.Transparency = NumberSequence.new(style.Transparency, 1)
	trail.LightEmission = style.Light and 0.8 or 0
	local keypoints = {}
	for i, color in style.Colors do
		table.insert(keypoints, ColorSequenceKeypoint.new((i - 1) / math.max(1, #style.Colors - 1), color))
	end
	trail.Color = ColorSequence.new(keypoints)
	trail.FaceCamera = true
	trail.Parent = root
end

local function buildAura(character: Model, auraId: string)
	local root = character:FindFirstChild("HumanoidRootPart")
	local style = CosmeticStyles.Auras[auraId]
	if not root or not style then
		return
	end
	local emitter = Instance.new("ParticleEmitter")
	emitter.Name = "KD_Aura"
	emitter:SetAttribute("KD_Cosmetic", "Aura")
	emitter.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	emitter.Rate = style.Rate
	emitter.Lifetime = NumberRange.new(0.8, 1.4)
	emitter.Speed = NumberRange.new(style.Speed * 0.5, style.Speed)
	emitter.SpreadAngle = Vector2.new(180, 180)
	emitter.Size = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0),
		NumberSequenceKeypoint.new(0.3, style.Size),
		NumberSequenceKeypoint.new(1, 0),
	})
	emitter.Color = ColorSequence.new(style.Colors[1], style.Colors[#style.Colors])
	emitter.LightEmission = 0.7
	emitter.Shape = Enum.ParticleEmitterShape.Cylinder
	emitter.Parent = root
end

local function buildNameTag(player: Player, character: Model)
	local head = character:FindFirstChild("Head")
	if not head then
		return
	end
	local humanoid = character:FindFirstChildOfClass("Humanoid")
	if humanoid then
		humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
	end
	local data = svc("DataService").Get(player)
	local gui = Instance.new("BillboardGui")
	gui.Name = "KD_NameTag"
	gui:SetAttribute("KD_Cosmetic", "NameTag")
	gui.Size = UDim2.fromOffset(220, 64)
	gui.StudsOffset = Vector3.new(0, 2.6, 0)
	gui.MaxDistance = 90
	gui.LightInfluence = 0
	gui.AlwaysOnTop = false
	gui.Adornee = head

	local colorIndex = data and data.NameColor or 0
	local nameColor = CosmeticStyles.NameColors[colorIndex] or Color3.new(1, 1, 1)

	local name = Instance.new("TextLabel")
	name.Name = "PlayerName"
	name.BackgroundTransparency = 1
	name.Size = UDim2.new(1, 0, 0, 26)
	name.Position = UDim2.fromOffset(0, 30)
	name.FontFace = Font.new("rbxasset://fonts/families/FredokaOne.json", Enum.FontWeight.Bold)
	name.TextScaled = true
	name.TextColor3 = nameColor
	name.Text = player.DisplayName
	local stroke = Instance.new("UIStroke")
	stroke.Thickness = 2
	stroke.Color = Color3.fromRGB(24, 22, 40)
	stroke.Parent = name
	name.Parent = gui

	local tags = {}
	local titleId = CosmeticsService.Equipped(player, "Title")
	local titleItem = titleId and Catalog.Get(titleId)
	if titleItem and titleItem.Effect and titleItem.Effect.Text then
		table.insert(tags, titleItem.Effect.Text)
	elseif data and data.Titles.holebreaker then
		table.insert(tags, CosmeticStyles.EarnedTitles.holebreaker.Text)
	end
	if player:GetAttribute("VIP") then
		table.insert(tags, "VIP")
	end
	if player:GetAttribute("Club") then
		table.insert(tags, "Club")
	end
	if player:GetAttribute("ServerHero") then
		table.insert(tags, "Server Hero")
	end
	local title = Instance.new("TextLabel")
	title.Name = "Title"
	title.BackgroundTransparency = 1
	title.Size = UDim2.new(1, 0, 0, 22)
	title.FontFace = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.Bold)
	title.TextScaled = true
	title.TextColor3 = Color3.fromRGB(255, 214, 90)
	title.Text = table.concat(tags, "  ·  ")
	title.Visible = #tags > 0
	local tstroke = Instance.new("UIStroke")
	tstroke.Thickness = 1.5
	tstroke.Color = Color3.fromRGB(40, 26, 8)
	tstroke.Parent = title
	title.Parent = gui
	gui.Parent = head
end

function CosmeticsService.RefreshCharacter(player: Player)
	local character = player.Character
	if not character then
		return
	end
	for _, tagName in { "Hat", "Trail", "Aura", "NameTag" } do
		clearTagged(character, tagName)
	end
	local hat = CosmeticsService.Equipped(player, "HardHat")
	if hat then
		buildHat(character, hat)
	end
	local trail = CosmeticsService.Equipped(player, "Trail")
	if trail then
		buildTrail(character, trail)
	end
	local aura = CosmeticsService.Equipped(player, "Aura")
	if aura then
		buildAura(character, aura)
	end
	buildNameTag(player, character)
end

function CosmeticsService.Init()
	local DataService = svc("DataService")
	DataService.Loaded:Connect(function(player)
		CosmeticsService.ApplyAttributes(player)
		if player.Character then
			CosmeticsService.RefreshCharacter(player)
		end
	end)
	Players.PlayerAdded:Connect(function(player)
		local first = true
		player.CharacterAdded:Connect(function(character)
			character:WaitForChild("HumanoidRootPart", 10)
			character:WaitForChild("Head", 10)
			if DataService.WaitFor(player, 20) then
				CosmeticsService.RefreshCharacter(player)
				if first then
					first = false
					local entrance = CosmeticsService.Equipped(player, "Entrance")
					if entrance then
						task.delay(0.5, function()
							require(Shared.Net).Event("PlayerFx"):FireAllClients({
								Type = "Entrance",
								UserId = player.UserId,
								Effect = entrance,
							})
						end)
					end
				end
			end
		end)
		for _, attr in { "VIP", "Club", "ServerHero", "HoleBreaker" } do
			player:GetAttributeChangedSignal(attr):Connect(function()
				CosmeticsService.RefreshCharacter(player)
			end)
		end
	end)
	Players.PlayerRemoving:Connect(function(player)
		filteredPlaqueMessages[player.UserId] = nil
	end)
end

return CosmeticsService
