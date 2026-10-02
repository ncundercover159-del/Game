--[[
	AssetRegistry: the single place game code reads uploaded asset IDs from.

	The tables between the GENERATED markers are rewritten by
	`python tools/upload_assets.py` (Roblox Open Cloud). While they are empty
	the game runs on GREYBOX stand-ins (tag "GREYBOX", attribute AssetKey) and
	built-in rbxasset:// sounds, so everything is fully playable in Studio.
]]

local AssetRegistry = {}

-- BEGIN GENERATED (tools/upload_assets.py)
AssetRegistry.Models = {} -- [assetKey] = Model asset id (FBX upload -> Model with MeshParts)
AssetRegistry.Images = {} -- [key] = Decal asset id (icons, UI kit, textures)
AssetRegistry.Sounds = {} -- [cueId] = Audio asset id
AssetRegistry.Animations = {} -- [clipId] = Animation asset id
AssetRegistry.UploadedAt = nil
-- END GENERATED

function AssetRegistry.ModelId(key: string): number?
	local id = AssetRegistry.Models[key]
	if id and id ~= 0 then
		return id
	end
	return nil
end

-- Image content for UI. Decal ids from Open Cloud are shown through the
-- thumbnail endpoint, which resolves a decal to its image.
function AssetRegistry.Image(key: string, size: number?): string?
	local id = AssetRegistry.Images[key]
	if not id or id == 0 then
		return nil
	end
	local s = size or 420
	return string.format("rbxthumb://type=Asset&id=%d&w=%d&h=%d", id, s, s)
end

function AssetRegistry.Sound(cueId: string): string?
	local id = AssetRegistry.Sounds[cueId]
	if id and id ~= 0 then
		return "rbxassetid://" .. tostring(id)
	end
	return nil
end

function AssetRegistry.Animation(clipId: string): string?
	local id = AssetRegistry.Animations[clipId]
	if id and id ~= 0 then
		return "rbxassetid://" .. tostring(id)
	end
	return nil
end

function AssetRegistry.HasUploads(): boolean
	return next(AssetRegistry.Models) ~= nil
end

return AssetRegistry
