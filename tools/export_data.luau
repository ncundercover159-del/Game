--[[
	Dumps game data for the Blender pipeline: rigs (Shared.Rigs), catalog
	items and finds -> assets/gamedata.json.
	  lune run tools/export_data
]]
local fs = require("@lune/fs")
local serde = require("@lune/serde")
local process = require("@lune/process")
local Runtime = require("../tests/harness/Runtime")

local rt = Runtime.new({ Root = "." })
local Rigs = rt:Require("Shared/Rigs")
local Catalog = rt:Require("Shared/Catalog")

local function hex(c)
	return string.format("#%02X%02X%02X", math.floor(c.R * 255 + 0.5), math.floor(c.G * 255 + 0.5), math.floor(c.B * 255 + 0.5))
end

local rigs = {}
for id, rig in Rigs do
	if type(rig) == "table" and rig.Parts then
		local parts = {}
		for _, p in rig.Parts do
			table.insert(parts, { bone = p.Bone, size = p.Size, pos = p.Pos, rot = p.Rot or { 0, 0, 0 }, role = p.Role, shape = p.Shape })
		end
		local bones = {}
		for _, b in rig.Bones do
			table.insert(bones, { name = b.Name, parent = b.Parent or "", pivot = b.Pivot })
		end
		rigs[id] = { name = rig.Name, parts = parts, bones = bones }
	end
end
local items = {}
for _, item in Catalog.Items do
	table.insert(items, { id = item.Id, category = item.Category, name = item.Name, tier = item.Tier, color = hex(Catalog.TierColors[item.Tier] or Catalog.TierColors[1]) })
end
local finds = {}
for _, f in Catalog.Finds do
	table.insert(finds, { id = f.Id, name = f.Name, tier = f.Tier, color = hex(Catalog.TierColors[f.Tier]) })
end
fs.writeFile("assets/gamedata.json", serde.encode("json", { rigs = rigs, items = items, finds = finds }))
print("wrote assets/gamedata.json")
process.exit(0)
