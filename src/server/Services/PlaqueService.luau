--[[
	PlaqueService: the top contributors of this hole get their name carved
	into the hole wall at the depth of their biggest single dig (free-path
	contributors without a dig are carved at the depth where they first
	entered the top list). Each plaque uses the contributor's equipped
	Plaque Style and, if unlocked, their filtered Plaque Message.

	Plaques are server-built parts (replicated) under workspace.Map.Plaques,
	tagged GREYBOX with AssetKey "plaque_<style>" for the Blender swap.
]]

local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local CosmeticStyles = require(Shared.CosmeticStyles)
local Format = require(Shared.Util.Format)
local HoleMath = require(Shared.HoleMath)

local Services = script.Parent
local function svc(name)
	return require(Services[name])
end

local PlaqueService = {}

local dirtyFlag = true
local plaques = {} -- [userId] = { Model, Signature }
local anchoredDepth = {} -- [userId] = depth used for free-path contributors
local styleCache = {} -- [userId] = plaque item id (kept after they leave)
local folder: Folder? = nil

function PlaqueService.MarkDirty()
	dirtyFlag = true
end

local function getFolder()
	if folder and folder.Parent then
		return folder
	end
	local map = workspace:FindFirstChild("Map")
	folder = Instance.new("Folder")
	folder.Name = "Plaques"
	folder.Parent = map or workspace
	return folder
end

-- Where rank `rank` hangs: spread across the far (north) wall first, which
-- faces the hero camera, then wrapping around.
local function slotAngle(rank: number): number
	local base = -math.pi / 2 -- north (-Z)
	local step = math.rad(16)
	local side = (rank % 2 == 0) and 1 or -1
	local offset = math.floor(rank / 2) * step * side
	return base + offset
end

function PlaqueService.Placement(rank: number, depth: number, target: number)
	local fraction = HoleMath.Fraction(depth, target)
	local y = HoleMath.FractionToY(fraction)
	-- keep plaques inside a band's wall face, not on a ledge edge
	local radius = HoleMath.RadiusAtY(y - 0.5) - 0.35
	local angle = slotAngle(rank)
	local position = Vector3.new(math.cos(angle) * radius, y - 2.2, math.sin(angle) * radius)
	local facing = CFrame.lookAt(position, Vector3.new(0, position.Y, 0))
	return facing
end

local function makePart(name, size, cf, color, material, parent)
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size
	p.CFrame = cf
	p.Color = color
	p.Material = material
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.Parent = parent
	return p
end

local function build(row, rank: number, styleItem: string, message: string, target: number)
	local style, styleName = CosmeticStyles.PlaqueForItem(styleItem)
	local depth = row.BiggestDepth > 0 and row.BiggestDepth or anchoredDepth[row.UserId] or 0
	local cf = PlaqueService.Placement(rank, depth, target)
	local model = Instance.new("Model")
	model.Name = "Plaque_" .. tostring(row.UserId)
	model:SetAttribute("AssetKey", "plaque_" .. styleName:lower())
	model:SetAttribute("UserId", row.UserId)
	model:AddTag("GREYBOX")
	model:AddTag("WallPlaque")

	local frame = makePart("Frame", Vector3.new(7.2, 3.4, 0.5), cf, style.Frame, style.FrameNeon and Enum.Material.Neon or Enum.Material.Metal, model)
	local face = makePart("Face", Vector3.new(6.6, 2.8, 0.6), cf * CFrame.new(0, 0, -0.08), style.Color, style.Material, model)
	face.Reflectance = style.Reflectance or 0
	face.Transparency = style.Transparency or 0
	model.PrimaryPart = frame

	local gui = Instance.new("SurfaceGui")
	gui.Name = "Text"
	gui.Face = Enum.NormalId.Front
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = 40
	gui.LightInfluence = 0.2
	gui.Parent = face

	local title = Instance.new("TextLabel")
	title.BackgroundTransparency = 1
	title.Size = UDim2.new(1, -20, message ~= "" and 0.48 or 0.62, 0)
	title.Position = UDim2.fromOffset(10, 6)
	title.FontFace = Font.new("rbxasset://fonts/families/FredokaOne.json", Enum.FontWeight.Bold)
	title.TextScaled = true
	title.TextColor3 = style.Text
	title.Text = string.format("#%d %s", rank, row.Name)
	title.Parent = gui

	local sub = Instance.new("TextLabel")
	sub.BackgroundTransparency = 1
	sub.Size = UDim2.new(1, -20, 0.28, 0)
	sub.Position = UDim2.new(0, 10, message ~= "" and 0.48 or 0.64, 0)
	sub.FontFace = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.Bold)
	sub.TextScaled = true
	sub.TextColor3 = style.Text
	sub.Text = message ~= "" and string.format('"%s"', message) or (Format.Metres(row.Metres) .. " dug this hole")
	sub.Parent = gui

	if style.Glow then
		local light = Instance.new("PointLight")
		light.Color = style.Glow
		light.Range = 10
		light.Brightness = 1.6
		light.Parent = face
	end
	if style.Embers then
		local emitter = Instance.new("ParticleEmitter")
		emitter.Texture = "rbxasset://textures/particles/fire_sparks_main.dds"
		emitter.Rate = 6
		emitter.Lifetime = NumberRange.new(0.8, 1.6)
		emitter.Speed = NumberRange.new(1, 3)
		emitter.Color = ColorSequence.new(Color3.fromRGB(255, 180, 60), Color3.fromRGB(255, 60, 20))
		emitter.LightEmission = 1
		emitter.Size = NumberSequence.new(0.25, 0)
		emitter.Parent = frame
	end
	model.Parent = getFolder()
	return model
end

function PlaqueService.Rebuild()
	dirtyFlag = false
	local HoleService = svc("HoleService")
	local top = HoleService.TopContributors(Config.Leaderboards.PlaqueCount)
	local keep = {}
	for rank, row in top do
		keep[row.UserId] = true
		if row.BiggestDepth <= 0 and not anchoredDepth[row.UserId] then
			anchoredDepth[row.UserId] = HoleService.Depth
		end
		local player = Players:GetPlayerByUserId(row.UserId)
		if player then
			styleCache[row.UserId] = svc("CosmeticsService").Equipped(player, "PlaqueStyle")
		end
		local styleItem = styleCache[row.UserId] or "plaque_stone"
		local message = svc("CosmeticsService").PlaqueMessageFor(row.UserId)
		local signature = table.concat({ rank, row.Name, styleItem, message, row.BiggestDepth, math.floor(row.Metres) }, "|")
		local existing = plaques[row.UserId]
		if not existing or existing.Signature ~= signature then
			if existing then
				existing.Model:Destroy()
			end
			plaques[row.UserId] = { Model = build(row, rank, styleItem, message, HoleService.Target), Signature = signature }
		end
	end
	for userId, entry in plaques do
		if not keep[userId] then
			entry.Model:Destroy()
			plaques[userId] = nil
		end
	end
end

function PlaqueService.Clear()
	for _, entry in plaques do
		entry.Model:Destroy()
	end
	table.clear(plaques)
	table.clear(anchoredDepth)
end

function PlaqueService.Count(): number
	local n = 0
	for _ in plaques do
		n += 1
	end
	return n
end

function PlaqueService.Init()
	local HoleService = svc("HoleService")
	HoleService.ContributionsChanged:Connect(PlaqueService.MarkDirty)
	HoleService.CycleStarted:Connect(function()
		PlaqueService.Clear()
		PlaqueService.MarkDirty()
	end)
end

function PlaqueService.Start()
	task.spawn(function()
		while true do
			task.wait(4)
			if dirtyFlag then
				local ok, err = pcall(PlaqueService.Rebuild)
				if not ok then
					warn("[Plaques] rebuild failed: " .. tostring(err))
				end
			end
		end
	end)
end

return PlaqueService
