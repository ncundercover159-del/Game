--[[
	FindModels: GREYBOX showpieces for finds (Artifacts pedestals, unearth
	reveals, Collection). Shapes follow each find's silhouette class; the
	Blender meshes (AssetKey "find_<id>") replace them once uploaded.
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Catalog = require(Shared.Catalog)

local FindModels = {}

local rgb = Color3.fromRGB

local SHAPES = {
	find_coin = { "disc", rgb(214, 170, 60) },
	find_bone = { "bone", rgb(236, 226, 200) },
	find_pot = { "pot", rgb(184, 102, 60) },
	find_horseshoe = { "horseshoe", rgb(150, 150, 160) },
	find_ironore = { "ore", rgb(138, 143, 153) },
	find_ammonite = { "spiral", rgb(196, 166, 120) },
	find_trilobite = { "trilobite", rgb(160, 140, 110) },
	find_dinotooth = { "tooth", rgb(240, 232, 210) },
	find_silver = { "ore", rgb(214, 220, 232) },
	find_goldnugget = { "ore", rgb(255, 200, 60) },
	find_oldpick = { "pick", rgb(120, 110, 100) },
	find_amethyst = { "gem", rgb(179, 78, 250) },
	find_emerald = { "gem", rgb(60, 220, 110) },
	find_sapphire = { "gem", rgb(60, 120, 255) },
	find_ruby = { "gem", rgb(230, 40, 60) },
	find_diamond = { "gem", rgb(210, 245, 255) },
	find_crown = { "crown", rgb(255, 200, 50) },
	find_meteorite = { "meteor", rgb(70, 50, 50) },
	find_glowcrystal = { "cluster", rgb(82, 246, 255) },
	find_goldfossil = { "spiral", rgb(255, 210, 80) },
	find_relic = { "relic", rgb(255, 214, 90) },
}

local function part(model, size, cf, color, material)
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.Size = size
	p.CFrame = cf
	p.Color = color
	p.Material = material or Enum.Material.SmoothPlastic
	p.Parent = model
	return p
end

function FindModels.Build(findId: string, found: boolean)
	local spec = SHAPES[findId] or { "gem", rgb(255, 255, 255) }
	local find = Catalog.FindsById[findId]
	local model = Instance.new("Model")
	model.Name = "Find_" .. findId
	model:SetAttribute("AssetKey", "find_" .. findId:sub(6))
	model:AddTag("GREYBOX")
	local color = found and spec[2] or rgb(30, 32, 44)
	local glowMat = found and Enum.Material.Neon or Enum.Material.SmoothPlastic
	local metal = found and Enum.Material.Foil or Enum.Material.SmoothPlastic
	local kind = spec[1]
	local base = part(model, Vector3.new(0.4, 0.4, 0.4), CFrame.new(), color, Enum.Material.SmoothPlastic)
	base.Transparency = 1
	model.PrimaryPart = base
	if kind == "gem" then
		part(model, Vector3.new(1.4, 1.4, 1.4), CFrame.Angles(math.rad(45), 0, math.rad(45)), color, glowMat)
		part(model, Vector3.new(0.9, 1.6, 0.9), CFrame.new(0, 0.2, 0) * CFrame.Angles(0, math.rad(45), 0), color, glowMat)
	elseif kind == "cluster" then
		for i = 0, 4 do
			part(model, Vector3.new(0.5, 1.6 + (i % 2) * 0.6, 0.5), CFrame.new((i - 2) * 0.35, 0.2, (i % 2) * 0.3) * CFrame.Angles(0, 0, math.rad((i - 2) * 14)), color, glowMat)
		end
	elseif kind == "crown" then
		part(model, Vector3.new(2, 0.7, 2), CFrame.new(), color, metal)
		for i = 0, 3 do
			local a = i / 4 * math.pi * 2
			part(model, Vector3.new(0.35, 0.8, 0.35), CFrame.new(math.cos(a) * 0.85, 0.7, math.sin(a) * 0.85), color, metal)
			part(model, Vector3.new(0.3, 0.3, 0.3), CFrame.new(math.cos(a) * 0.85, 1.2, math.sin(a) * 0.85), found and rgb(230, 40, 60) or color, glowMat)
		end
	elseif kind == "meteor" then
		part(model, Vector3.new(1.8, 1.5, 1.6), CFrame.Angles(0.3, 0.4, 0.2), color, Enum.Material.Basalt)
		part(model, Vector3.new(1.85, 0.2, 1.65), CFrame.Angles(0.3, 0.4, 0.2), found and rgb(255, 120, 40) or color, glowMat)
	elseif kind == "relic" then
		part(model, Vector3.new(1.5, 1.5, 1.5), CFrame.Angles(math.rad(35), math.rad(45), 0), color, glowMat)
		for i = 0, 7 do
			local a = i / 8 * math.pi * 2
			part(model, Vector3.new(0.5, 0.15, 0.15), CFrame.Angles(math.rad(60), 0, 0) * CFrame.new(math.cos(a) * 1.6, 0, math.sin(a) * 1.6) * CFrame.Angles(0, -a, 0), color, glowMat)
		end
	elseif kind == "spiral" then
		for i = 0, 6 do
			local a = i * 0.9
			local r = 0.3 + i * 0.13
			part(model, Vector3.new(0.5, 0.5, 0.45), CFrame.new(math.cos(a) * r, math.sin(a) * r, 0), color, metal)
		end
	elseif kind == "disc" then
		local d = part(model, Vector3.new(0.25, 1.4, 1.4), CFrame.Angles(0, 0, 0), color, metal)
		d.Shape = Enum.PartType.Cylinder
	elseif kind == "bone" then
		part(model, Vector3.new(2.2, 0.4, 0.4), CFrame.new(), color)
		for _, x in { -1.1, 1.1 } do
			part(model, Vector3.new(0.5, 0.7, 0.7), CFrame.new(x, 0, 0), color)
		end
	elseif kind == "pot" then
		part(model, Vector3.new(1.4, 1.4, 1.4), CFrame.new(), color, Enum.Material.Slate)
		part(model, Vector3.new(0.8, 0.5, 0.8), CFrame.new(0, 0.9, 0), color, Enum.Material.Slate)
	elseif kind == "horseshoe" then
		for i = 0, 4 do
			local a = math.pi * (i / 4)
			part(model, Vector3.new(0.4, 0.5, 0.3), CFrame.new(math.cos(a) * 0.8, math.sin(a) * 0.8, 0) * CFrame.Angles(0, 0, a), color, metal)
		end
	elseif kind == "pick" then
		part(model, Vector3.new(0.25, 2.2, 0.25), CFrame.new(), rgb(110, 80, 50), Enum.Material.Wood)
		part(model, Vector3.new(0.3, 0.3, 1.8), CFrame.new(0, 1.0, 0), color, metal)
	elseif kind == "tooth" then
		part(model, Vector3.new(0.6, 1.6, 0.5), CFrame.Angles(0, 0, math.rad(12)), color)
	elseif kind == "trilobite" then
		part(model, Vector3.new(1.0, 0.35, 1.6), CFrame.new(), color, Enum.Material.Slate)
		for i = -2, 2 do
			part(model, Vector3.new(1.3 - math.abs(i) * 0.15, 0.2, 0.18), CFrame.new(0, 0.2, i * 0.28), color:Lerp(rgb(0, 0, 0), 0.2), Enum.Material.Slate)
		end
	else -- ore
		part(model, Vector3.new(1.2, 1.0, 1.1), CFrame.Angles(0.4, 0.3, 0), rgb(90, 86, 84), Enum.Material.Slate)
		part(model, Vector3.new(0.6, 0.6, 0.6), CFrame.new(0.3, 0.3, 0.2) * CFrame.Angles(0.5, 0.5, 0), color, metal)
	end
	if found and find and find.Tier >= 4 then
		local light = Instance.new("PointLight")
		light.Color = spec[2]
		light.Range = 10
		light.Brightness = 1.5
		light.Parent = base
	end
	for _, d in model:GetDescendants() do
		if d:IsA("BasePart") and d ~= base and not found then
			d.Transparency = 0.45
		end
	end
	return model
end

return FindModels
