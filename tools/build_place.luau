--[[
	Builds place/KeepDigging.rbxl:
	  1. reads build/code.rbxl (rojo build default.project.json -o build/code.rbxl)
	  2. generates the GREYBOX map from assets/layout.json
	  3. sets lighting, atmosphere, workspace streaming and player settings

	  lune run tools/build_place
]]

local fs = require("@lune/fs")
local serde = require("@lune/serde")
local roblox = require("@lune/roblox")

local Instance = roblox.Instance
local Vector3, CFrame, Color3, Enum = roblox.Vector3, roblox.CFrame, roblox.Color3, roblox.Enum

local layout = serde.decode("json", fs.readFile("assets/layout.json"))
local game = roblox.deserializePlace(fs.readFile("build/code.rbxl"))
local Workspace = game:GetService("Workspace")
local Lighting = game:GetService("Lighting")

-- Strata check: the generated map must agree with Strata.luau.
local strataSource = fs.readFile("src/shared/Strata.luau")
for _, band in layout.bands do
	local pattern = string.format('Id = "%s",.-YTop = (%%-?%%d+),%%s*YBottom = (%%-?%%d+)', band.id)
	local top, bottom = strataSource:match(pattern)
	assert(top and tonumber(top) == band.yTop and tonumber(bottom) == band.yBottom, "Strata mismatch for " .. band.id)
end

local MATERIAL = {
	Grass = Enum.Material.Grass,
	LeafyGrass = Enum.Material.LeafyGrass,
	SmoothPlastic = Enum.Material.SmoothPlastic,
	Wood = Enum.Material.Wood,
	WoodPlanks = Enum.Material.WoodPlanks,
	Sand = Enum.Material.Sand,
	Slate = Enum.Material.Slate,
	Glass = Enum.Material.Glass,
	Ground = Enum.Material.Ground,
	Cobblestone = Enum.Material.Cobblestone,
	Limestone = Enum.Material.Limestone,
	Basalt = Enum.Material.Basalt,
	Metal = Enum.Material.Metal,
	Neon = Enum.Material.Neon,
	CrackedLava = Enum.Material.CrackedLava,
	Foil = Enum.Material.Foil,
	Fabric = Enum.Material.Fabric,
	Snow = Enum.Material.Snow,
}

-- material key -> Roblox material name, parsed from the Python palette
local palette = {}
for key, mat in fs.readFile("blender/kd/palette.py"):gmatch('"([%w_]+)": %("(%w+)"') do
	palette[key] = mat
end

local function hex(h: string)
	return Color3.fromRGB(tonumber(h:sub(2, 3), 16), tonumber(h:sub(4, 5), 16), tonumber(h:sub(6, 7), 16))
end

local FONTS = {
	FredokaOne = "rbxasset://fonts/families/FredokaOne.json",
	Gotham = "rbxasset://fonts/families/GothamSSm.json",
}

local function folderPath(root, path)
	local node = root
	for segment in path:gmatch("[^/]+") do
		local child = node:FindFirstChild(segment)
		if not child then
			child = Instance.new(segment == "Map" and "Model" or "Folder")
			child.Name = segment
			child.Parent = node
		end
		node = child
	end
	return node
end

local function buildGui(part, gui)
	local sg = Instance.new("SurfaceGui")
	sg.Face = Enum.NormalId[gui.face or "Front"]
	sg.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	sg.PixelsPerStud = gui.ppu or 20
	sg.LightInfluence = 0
	sg.Parent = part
	for _, line in gui.lines do
		local label = Instance.new("TextLabel")
		label.BackgroundTransparency = 1
		local r = line.rect
		label.Position = roblox.UDim2.fromScale(r[1], r[2])
		label.Size = roblox.UDim2.fromScale(r[3], r[4])
		label.Text = line.text
		label.TextScaled = true
		label.FontFace = roblox.Font.new(FONTS[line.font] or FONTS.Gotham, Enum.FontWeight.Bold)
		label.TextColor3 = line.gradient and Color3.new(1, 1, 1) or hex(line.color)
		if line.gradient then
			local g = Instance.new("UIGradient")
			local kps = {}
			for i, c in line.gradient do
				table.insert(kps, roblox.ColorSequenceKeypoint.new((i - 1) / (#line.gradient - 1), hex(c)))
			end
			g.Color = roblox.ColorSequence.new(kps)
			g.Rotation = 90
			g.Parent = label
		end
		if line.stroke then
			local s = Instance.new("UIStroke")
			s.Color = hex(line.stroke)
			s.Thickness = line.strokeSize or 3
			s.Parent = label
		end
		label.Parent = sg
	end
end

local SHAPES = {
	Block = Enum.PartType.Block,
	Wedge = Enum.PartType.Wedge,
	Cylinder = Enum.PartType.Cylinder,
	Ball = Enum.PartType.Ball,
}

local partCount = 0
local function buildPart(p, pivot)
	local cls = p.cls or "Part"
	local part = Instance.new(cls)
	if cls == "Part" then
		part.Shape = SHAPES[p.s] or Enum.PartType.Block
	end
	part.Size = Vector3.new(p.z[1], p.z[2], p.z[3])
	local cf = CFrame.new(p.p[1], p.p[2], p.p[3])
	if p.r then
		cf *= CFrame.Angles(math.rad(p.r[1]), math.rad(p.r[2]), math.rad(p.r[3]))
	end
	part.CFrame = pivot * cf
	part.Anchored = true
	part.Material = MATERIAL[palette[p.m] or "SmoothPlastic"] or Enum.Material.SmoothPlastic
	part.Color = hex(p.c)
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	if p.t then
		part.Transparency = p.t
	end
	if p.rf then
		part.Reflectance = p.rf
	end
	if p.nc then
		part.CanCollide = false
		part.CanTouch = p.tags ~= nil
		part.CanQuery = false
	end
	if p.ns then
		part.CastShadow = false
	end
	if cls == "SpawnLocation" then
		part.Neutral = true
		part.Duration = 0
		local decal = part:FindFirstChildOfClass("Decal")
		if decal then
			decal:Destroy()
		end
	end
	part.Name = p.n or p.m
	if p.tags then
		for _, tag in p.tags do
			part:AddTag(tag)
		end
	end
	if p.a then
		for k, v in p.a do
			part:SetAttribute(k, v)
		end
	end
	if p.light then
		local light = Instance.new("PointLight")
		light.Range = p.light.range
		light.Brightness = p.light.brightness
		light.Color = hex(p.light.color)
		light.Shadows = false
		light.Parent = part
	end
	if p.gui then
		buildGui(part, p.gui)
	end
	partCount += 1
	return part
end

for _, m in layout.modules do
	local parent = folderPath(Workspace, m.path)
	local model = Instance.new("Model")
	model.Name = m.name
	local pivot = CFrame.new(m.pivot[1], m.pivot[2], m.pivot[3]) * CFrame.Angles(0, math.rad(m.yaw), 0)
	for _, p in m.parts do
		buildPart(p, pivot).Parent = model
	end
	-- WorldPivotData is the serialized form of WorldPivot (an OptionalCFrame);
	-- setting WorldPivot here would only live in memory and never reach the file,
	-- leaving Studio to pivot every module on its bounding-box centre.
	model.WorldPivotData = pivot
	if m.greybox then
		model:AddTag("GREYBOX")
		model:SetAttribute("AssetKey", m.key)
	end
	for _, tag in m.tags do
		model:AddTag(tag)
	end
	for k, v in m.attrs do
		if type(v) == "table" then
			v = Vector3.new(v[1], v[2], v[3])
		end
		model:SetAttribute(k, v)
	end
	model.Parent = parent
end

local map = Workspace:FindFirstChild("Map")
map.ModelStreamingMode = Enum.ModelStreamingMode.Persistent
Workspace.StreamingEnabled = true

-- Lighting: warm bright daylight from the upper left of the hero view.
Lighting.Technology = Enum.Technology.Future
Lighting.ClockTime = 14.6
Lighting.GeographicLatitude = 30
Lighting.Brightness = 2.6
Lighting.Ambient = Color3.fromRGB(112, 112, 122)
Lighting.OutdoorAmbient = Color3.fromRGB(140, 140, 152)
Lighting.EnvironmentDiffuseScale = 0.6
Lighting.EnvironmentSpecularScale = 0.6
Lighting.ShadowSoftness = 0.25
local function add(className, props)
	local inst = Instance.new(className)
	for k, v in props do
		inst[k] = v
	end
	inst.Parent = Lighting
	return inst
end
add("Atmosphere", { Density = 0.28, Offset = 0.05, Color = Color3.fromRGB(199, 227, 250), Decay = Color3.fromRGB(106, 140, 180), Glare = 0.3, Haze = 1.3 })
add("BloomEffect", { Intensity = 0.6, Size = 28, Threshold = 1.5 })
add("ColorCorrectionEffect", { Saturation = 0.12, Contrast = 0.06, Brightness = 0.02, TintColor = Color3.fromRGB(255, 252, 246) })
add("SunRaysEffect", { Intensity = 0.04, Spread = 0.6 })
add("DepthOfFieldEffect", { Enabled = false, FarIntensity = 0.12, FocusDistance = 120, InFocusRadius = 80, NearIntensity = 0 })
local sky = add("Sky", { SunAngularSize = 14, MoonAngularSize = 8 })
sky.Name = "Sky"
local clouds = Instance.new("Clouds")
clouds.Cover = 0.55
clouds.Density = 0.55
clouds.Color = Color3.fromRGB(255, 255, 255)
clouds.Parent = Workspace:FindFirstChildOfClass("Terrain") or Workspace

local starter = game:GetService("StarterPlayer")
starter.CameraMaxZoomDistance = 220
local players = game:GetService("Players")
players.CharacterAutoLoads = true

fs.writeDir("place")
fs.writeFile("place/KeepDigging.rbxl", roblox.serializePlace(game))
print(string.format("wrote place/KeepDigging.rbxl (%d map parts, %d modules)", partCount, #layout.modules))
