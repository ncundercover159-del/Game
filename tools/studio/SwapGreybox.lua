--[[
	Command-bar fallback for the art swap (when uploading via tools/upload_assets.py
	is not possible). Bulk-import assets/export/*.fbx with the 3D Importer, put the
	imported models in ServerStorage.KD_Imported named by AssetKey, then paste this
	into Studio's command bar. Every GREYBOX stand-in with a matching AssetKey gets
	the imported mesh at its pivot; the stand-in becomes an invisible collision proxy.
]]
local CollectionService = game:GetService("CollectionService")
local imported = game:GetService("ServerStorage"):FindFirstChild("KD_Imported")
assert(imported, "Create ServerStorage.KD_Imported with the imported models first")
local swapped = 0
for _, standIn in CollectionService:GetTagged("GREYBOX") do
	local key = standIn:GetAttribute("AssetKey")
	local source = key and imported:FindFirstChild(key)
	if source and standIn:IsDescendantOf(workspace) then
		local visual = source:Clone()
		for _, d in visual:GetDescendants() do
			if d:IsA("BasePart") then
				d.Anchored = true
				d.CanCollide = false
				d.CanQuery = false
				d.CanTouch = false
			end
		end
		visual:PivotTo(standIn:GetPivot())
		visual.Parent = standIn.Parent
		for _, d in standIn:GetDescendants() do
			if d:IsA("BasePart") then
				d.Transparency = 1
			end
		end
		standIn:RemoveTag("GREYBOX")
		swapped += 1
	end
end
print(("Swapped %d GREYBOX stand-ins"):format(swapped))
