--[[
	RigBuilder: turns Shared.Rigs data into a live client-side rig.

	  local rig = RigBuilder.Build(toolId, skinItemId)
	  rig:SetRoot(cframe)           -- world placement
	  rig:Play(clipName, speed)     -- KeyframeLite clip on the bones
	  rig:SetBoneOffset(bone, cf)   -- extra procedural motion (spin, squash)
	  rig:Step(dt)                  -- poses every part (BulkMoveTo)
	  rig:Attachment(name)          -- world CFrame of a VFX point
	  rig:Destroy()

	Parts are anchored, non-colliding and moved in bulk; skin themes only
	change colours/materials/particles (and add rings/fins on top tiers),
	never timing. Rigs are always built from these primitives; the Blender
	tool meshes (assets/export/tool_*.fbx) are used for icons and renders and,
	once uploaded, preloaded into ReplicatedStorage.KD_Assets, but are not
	swapped onto live rigs yet.
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Rigs = require(Shared.Rigs)
local KeyframeLite = require(Shared.KeyframeLite)
local CosmeticStyles = require(Shared.CosmeticStyles)

local RigBuilder = {}
RigBuilder.__index = RigBuilder

local function hexColor(h: string)
	return Color3.fromRGB(tonumber(h:sub(2, 3), 16), tonumber(h:sub(4, 5), 16), tonumber(h:sub(6, 7), 16))
end

local FIXED = {
	W = { Color3.fromRGB(122, 84, 50), Enum.Material.Wood },
	D = { Color3.fromRGB(34, 34, 40), Enum.Material.SmoothPlastic },
}

local function styleFor(role, skin)
	if FIXED[role] then
		return FIXED[role][1], FIXED[role][2], false
	end
	if role:sub(1, 1) == "#" then
		local glassy = role == "#9FD6FF"
		return hexColor(role), glassy and Enum.Material.Glass or Enum.Material.SmoothPlastic, false
	end
	if role == "P" then
		return skin.Primary, skin.Paint, false
	elseif role == "S" then
		return skin.Secondary, skin.Paint, false
	elseif role == "A" then
		return skin.Accent, skin.AccentNeon and Enum.Material.Neon or skin.Metal, skin.AccentNeon
	elseif role == "M" then
		return skin.Secondary:Lerp(Color3.fromRGB(200, 205, 215), 0.35), skin.Metal, false
	elseif role == "G" then
		return skin.Accent, Enum.Material.Neon, true
	end
	return Color3.new(1, 0, 1), Enum.Material.SmoothPlastic, false
end

local function cf(pos, rot)
	local c = CFrame.new(pos[1], pos[2], pos[3])
	if rot then
		c *= CFrame.Angles(math.rad(rot[1]), math.rad(rot[2]), math.rad(rot[3]))
	end
	return c
end

function RigBuilder.Build(toolId: string, skinItemId: string?, parent: Instance?)
	local def = Rigs[toolId]
	assert(def, "No rig for " .. tostring(toolId))
	local skin = CosmeticStyles.SkinForItem(skinItemId)
	local self = setmetatable({}, RigBuilder)
	self.Def = def
	self.Skin = skin
	self.Model = Instance.new("Model")
	self.Model.Name = "Rig_" .. toolId
	self.Model:SetAttribute("AssetKey", "tool_" .. toolId:sub(5))
	self.Model:AddTag("GREYBOX")
	self.Root = CFrame.new()
	self.Bones = {}
	self.BoneOrder = {}
	self.Offsets = {}
	self.Parts = {}
	self.PartBones = {}
	self.PartRest = {}
	self.Clip = nil
	self.ClipTime = 0
	self.ClipSpeed = 1
	self.Scale = 1
	self.Glows = {}

	for _, bone in def.Bones do
		local rest = cf(bone.Pivot)
		self.Bones[bone.Name] = { Name = bone.Name, Parent = bone.Parent, Rest = rest, World = rest }
		table.insert(self.BoneOrder, bone.Name)
	end

	for _, p in def.Parts do
		local part = Instance.new("Part")
		part.Anchored = true
		part.CanCollide = false
		part.CanQuery = false
		part.CanTouch = false
		part.CastShadow = true
		part.TopSurface = Enum.SurfaceType.Smooth
		part.BottomSurface = Enum.SurfaceType.Smooth
		if p.Shape == "Cylinder" then
			part.Shape = Enum.PartType.Cylinder
		end
		part.Size = Vector3.new(p.Size[1], p.Size[2], p.Size[3])
		local color, material, glow = styleFor(p.Role, skin)
		part.Color = color
		part.Material = material
		part.Reflectance = (p.Role == "P" or p.Role == "M") and (skin.Reflectance or 0) or 0
		if p.Role == "#9FD6FF" then
			part.Transparency = 0.35
		end
		part.Parent = self.Model
		local bone = self.Bones[p.Bone] or self.Bones.Root
		table.insert(self.Parts, part)
		self.PartBones[part] = bone
		-- offset relative to the bone's rest pivot
		self.PartRest[part] = bone.Rest:Inverse() * cf(p.Pos, p.Rot)
		if glow or p.Role == "P" or p.Role == "A" then
			table.insert(self.Glows, { Part = part, Role = p.Role })
		end
	end

	-- Top-tier skins add extra geometry (rings / fins) on the root bone.
	if skin.ExtraRings or skin.Fins then
		local _, size = self:RestBounds()
		local radius = math.max(size.X, size.Z) * 0.6 + 0.6
		for k = 0, 11 do
			local a = k / 12 * math.pi * 2
			local part = Instance.new("Part")
			part.Anchored = true
			part.CanCollide = false
			part.CanQuery = false
			part.Material = Enum.Material.Neon
			part.Color = skin.Accent
			part.Size = skin.Fins and Vector3.new(0.15, radius * 0.25, radius * 0.18) or Vector3.new(radius * 0.5, 0.15, 0.15)
			part.Parent = self.Model
			table.insert(self.Parts, part)
			self.PartBones[part] = self.Bones.Root
			self.PartRest[part] = CFrame.new(math.cos(a) * radius, size.Y * 0.45, math.sin(a) * radius) * CFrame.Angles(0, -a, skin.Fins and 0 or math.rad(20))
			table.insert(self.Glows, { Part = part, Role = "G" })
		end
	end

	self.Model.PrimaryPart = self.Parts[1]
	self.Model.Parent = parent or workspace
	self:Step(0)
	return self
end

function RigBuilder:RestBounds()
	local minV, maxV = Vector3.new(math.huge, math.huge, math.huge), Vector3.new(-math.huge, -math.huge, -math.huge)
	for _, p in self.Def.Parts do
		local v = Vector3.new(p.Pos[1], p.Pos[2], p.Pos[3])
		local half = Vector3.new(p.Size[1], p.Size[2], p.Size[3]) / 2
		minV = minV:Min(v - half)
		maxV = maxV:Max(v + half)
	end
	return (minV + maxV) / 2, maxV - minV
end

function RigBuilder:SetRoot(root: CFrame)
	self.Root = root
end

function RigBuilder:SetScale(s: number)
	self.Scale = s
end

function RigBuilder:Play(clipName: string?, speed: number?)
	self.Clip = clipName and self.Def.Clips[clipName] or nil
	self.ClipTime = 0
	self.ClipSpeed = speed or 1
end

function RigBuilder:SetBoneOffset(bone: string, offset: CFrame)
	self.Offsets[bone] = offset
end

function RigBuilder:Step(dt: number)
	self.ClipTime += dt * self.ClipSpeed
	local pose = self.Clip and KeyframeLite.Sample(self.Clip, self.ClipTime) or {}
	local root = self.Root
	for _, name in self.BoneOrder do
		local bone = self.Bones[name]
		local parentWorld = bone.Parent and self.Bones[bone.Parent].World or root
		local parentRest = bone.Parent and self.Bones[bone.Parent].Rest or CFrame.new()
		local local_ = parentRest:Inverse() * bone.Rest
		local anim = pose[name] or CFrame.new()
		local extra = self.Offsets[name] or CFrame.new()
		bone.World = parentWorld * local_ * anim * extra
	end
	local parts, cframes = table.create(#self.Parts), table.create(#self.Parts)
	local s = self.Scale
	for i, part in self.Parts do
		local rest = self.PartRest[part]
		if s ~= 1 then
			rest = CFrame.new(rest.Position * s) * rest.Rotation
		end
		parts[i] = part
		cframes[i] = self.PartBones[part].World * rest
	end
	workspace:BulkMoveTo(parts, cframes, Enum.BulkMoveMode.FireCFrameChanged)
	if self.Skin.Animated then
		local hue = (os.clock() * 0.25) % 1
		for i, g in self.Glows do
			g.Part.Color = Color3.fromHSV((hue + i * 0.04) % 1, 0.8, 1)
		end
	end
end

function RigBuilder:Attachment(name: string): CFrame
	local a = self.Def.Attachments[name]
	if not a then
		return self.Root
	end
	local bone = self.Bones[a[1]] or self.Bones.Root
	local rel = bone.Rest:Inverse() * CFrame.new(a[2][1], a[2][2], a[2][3])
	return bone.World * rel
end

function RigBuilder:SetTransparency(t: number)
	for _, part in self.Parts do
		part.Transparency = math.max(t, part:GetAttribute("BaseT") or 0)
	end
end

function RigBuilder:Destroy()
	self.Model:Destroy()
end

-- Store preview: the tool rig with its loop clip, or a cosmetic stand-in.
function RigBuilder.ForPreview(item)
	if item.Category == "Dig" and Rigs[item.Id] then
		local rig = RigBuilder.Build(item.Id, "skin_classic", nil)
		rig.Model.Parent = nil
		local clip = Rigs.PreviewClip[item.Id]
		if clip then
			rig:Play(clip, 0.6)
		end
		rig.StepPreview = function(dt)
			rig:Step(dt)
		end
		return rig
	elseif item.Category == "Skin" and item.Effect then
		local rig = RigBuilder.Build("dig_megadrill", item.Id, nil)
		rig.Model.Parent = nil
		rig:Play("Spin", 0.5)
		rig.StepPreview = function(dt)
			rig:Step(dt)
		end
		return rig
	end
	return nil
end

return RigBuilder
