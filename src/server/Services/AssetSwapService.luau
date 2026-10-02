--[[
	AssetSwapService: replaces GREYBOX stand-ins with the uploaded Blender
	meshes once tools/upload_assets.py has filled AssetRegistry.Models.

	For every instance tagged "GREYBOX" whose AssetKey has an uploaded Model
	asset, the server loads the asset (InsertService:LoadAsset, which works for
	assets owned by the experience's creator), pivots it onto the stand-in's
	pivot and makes it visual-only. The stand-in stays behind as an invisible
	box collision proxy (cheap, predictable collisions on mobile).

	Tool rigs and other client-built visuals are preloaded into
	ReplicatedStorage.KD_Assets so clients can clone them.
	With an empty registry this service does nothing.
]]

local CollectionService = game:GetService("CollectionService")
local InsertService = game:GetService("InsertService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local AssetRegistry = require(Shared.AssetRegistry)

local AssetSwapService = {}

local loaded = {} -- [assetId] = template Model (or false if it failed)

local function load(assetId: number)
	if loaded[assetId] ~= nil then
		return loaded[assetId] or nil
	end
	local ok, container = pcall(InsertService.LoadAsset, InsertService, assetId)
	if not ok or not container then
		warn(string.format("[AssetSwap] could not load asset %d: %s", assetId, tostring(container)))
		loaded[assetId] = false
		return nil
	end
	local asset = container:GetChildren()[1]
	if not asset then
		loaded[assetId] = false
		return nil
	end
	asset.Parent = nil
	container:Destroy()
	loaded[assetId] = asset
	return asset
end

local function visualOnly(root: Instance)
	for _, d in root:GetDescendants() do
		if d:IsA("BasePart") then
			d.Anchored = true
			d.CanCollide = false
			d.CanQuery = false
			d.CanTouch = false
		end
	end
	if root:IsA("BasePart") then
		root.Anchored = true
		root.CanCollide = false
		root.CanQuery = false
		root.CanTouch = false
	end
end

local function hideStandIn(standIn: Instance)
	local parts = standIn:IsA("BasePart") and { standIn } or {}
	for _, d in standIn:GetDescendants() do
		if d:IsA("BasePart") then
			table.insert(parts, d)
		elseif d:IsA("SurfaceGui") or d:IsA("Decal") or d:IsA("Texture") then
			-- keep signage readable: text lives on the stand-in faces
		end
	end
	for _, p in parts do
		if not p:GetAttribute("KeepVisible") then
			p.Transparency = 1
		end
	end
end

function AssetSwapService.Swap(standIn: Instance): boolean
	local key = standIn:GetAttribute("AssetKey")
	local assetId = key and AssetRegistry.ModelId(key)
	if not assetId then
		return false
	end
	local template = load(assetId)
	if not template then
		return false
	end
	local visual = template:Clone()
	visual.Name = (standIn.Name or key) .. "_Mesh"
	visualOnly(visual)
	local pivot = standIn:IsA("Model") and standIn:GetPivot() or (standIn :: BasePart).CFrame
	if visual:IsA("Model") then
		visual:PivotTo(pivot)
	elseif visual:IsA("BasePart") then
		visual.CFrame = pivot
	end
	visual.Parent = standIn.Parent
	hideStandIn(standIn)
	standIn:RemoveTag("GREYBOX")
	standIn:SetAttribute("SwappedTo", assetId)
	return true
end

function AssetSwapService.Start()
	if not AssetRegistry.HasUploads() then
		return
	end
	local swapped, total = 0, 0
	for _, standIn in CollectionService:GetTagged("GREYBOX") do
		total += 1
		if AssetSwapService.Swap(standIn) then
			swapped += 1
		end
		if total % 25 == 0 then
			task.wait() -- spread LoadAsync calls
		end
	end
	-- Client-side visuals (tool rigs, pets, crew) are cloned from here.
	local folder = Instance.new("Folder")
	folder.Name = "KD_Assets"
	for key, assetId in AssetRegistry.Models do
		if key:match("^tool_") or key:match("^pet_") or key:match("^crew_") or key:match("^find_") or key:match("^bay_") then
			local template = load(assetId)
			if template then
				local copy = template:Clone()
				copy.Name = key
				copy.Parent = folder
			end
		end
	end
	folder.Parent = ReplicatedStorage
	print(string.format("[AssetSwap] swapped %d / %d GREYBOX stand-ins", swapped, total))
end

return AssetSwapService
