--[[
	AssetSwapService: replaces GREYBOX map stand-ins with the Blender meshes at
	server start, using Shared.GreyboxSwap (the same code as the Studio
	command-bar script tools/studio/SwapGreybox.lua).

	Meshes come from either source:
	  * models imported in Studio with the 3D Importer, left in
	    ServerStorage.KD_Imported or anywhere in the Workspace;
	  * Model assets uploaded by tools/upload_assets.py (AssetRegistry.Models),
	    loaded with InsertService:LoadAsset (works for assets owned by the
	    experience's creator).
	Stand-ins already swapped in Studio are left alone. A stand-in stays behind
	as an invisible collision proxy (cheap, predictable collisions on mobile).

	Uploaded tool, find, pet, crew and bay models are also preloaded into
	ReplicatedStorage.KD_Assets. With nothing imported or uploaded this service
	does nothing.
]]

local InsertService = game:GetService("InsertService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local AssetRegistry = require(Shared.AssetRegistry)
local GreyboxSwap = require(Shared.GreyboxSwap)
local MeshManifest = require(Shared.MeshManifest)

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

-- Anything for the swap to use: uploads, the KD_Imported folder or an import
-- left at the top of the Workspace.
local function hasMeshes(templates): boolean
	if next(templates) ~= nil or ServerStorage:FindFirstChild(GreyboxSwap.FolderName) then
		return true
	end
	for _, child in workspace:GetChildren() do
		if MeshManifest[GreyboxSwap.NormaliseName(child.Name)] then
			return true
		end
	end
	return false
end

function AssetSwapService.Start()
	local templates = {}
	for key, assetId in AssetRegistry.Models do
		if MeshManifest[key] and AssetRegistry.ModelId(key) then
			local template = load(assetId)
			if template then
				templates[key] = template
			end
		end
	end
	if hasMeshes(templates) then
		GreyboxSwap.Run({
			Manifest = MeshManifest,
			Templates = templates,
			Root = workspace,
			Storage = ServerStorage,
			SkipSwapped = true,
		})
	end
	if not AssetRegistry.HasUploads() then
		return
	end
	-- Client-side visuals (tool rigs, pets, crew) are cloned from here.
	local folder = Instance.new("Folder")
	folder.Name = "KD_Assets"
	for key, assetId in AssetRegistry.Models do
		if
			key:match("^tool_")
			or key:match("^pet_")
			or key:match("^crew_")
			or key:match("^find_")
			or key:match("^bay_")
		then
			local template = load(assetId)
			if template then
				local copy = template:Clone()
				copy.Name = key
				copy.Parent = folder
			end
		end
	end
	folder.Parent = ReplicatedStorage
end

return AssetSwapService
