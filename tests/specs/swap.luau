-- GreyboxSwap: imported Blender meshes land exactly on their stand-ins whatever
-- the 3D Importer did to them (pivot, unit scale, quarter turns), and the
-- generated Studio command-bar script does the same with the real manifest.
local fs = require("@lune/fs")
local luau = require("@lune/luau")
local roblox = require("@lune/roblox")
local serde = require("@lune/serde")
local MockInstance = require("../harness/MockInstance")

local CFrame, Vector3, Enum = roblox.CFrame, roblox.Vector3, roblox.Enum

local EPS = 1e-3

-- Only the materials the swap cares about; everything else is plain plastic here.
local function materialOf(paletteMaterial: string?)
	if paletteMaterial == "Neon" or paletteMaterial == "Glass" or paletteMaterial == "ForceField" then
		return Enum.Material[paletteMaterial]
	end
	return Enum.Material.SmoothPlastic
end

local function close(a: Vector3, b: Vector3, eps: number?): boolean
	return (a - b).Magnitude <= (eps or EPS)
end

-- Raw manifest row from chunk boxes { { centre, size }, ... } (module space).
local function row(chunks, probe)
	local lo, hi
	local k = {}
	for i, c in chunks do
		local centre, size = Vector3.new(table.unpack(c[1])), Vector3.new(table.unpack(c[2]))
		local a, b = centre - size / 2, centre + size / 2
		lo = lo and Vector3.new(math.min(lo.X, a.X), math.min(lo.Y, a.Y), math.min(lo.Z, a.Z)) or a
		hi = hi and Vector3.new(math.max(hi.X, b.X), math.max(hi.Y, b.Y), math.max(hi.Z, b.Z)) or b
		table.insert(k, { i - 1, c[1][1], c[1][2], c[1][3], c[2][1], c[2][2], c[2][3] })
	end
	local c, s = (lo + hi) / 2, hi - lo
	return { c = { c.X, c.Y, c.Z }, s = { s.X, s.Y, s.Z }, p = probe, k = k }
end

local MANIFEST = {
	-- three chunks in an L: tells every quarter turn apart
	env_gate = row(
		{ { { 0, 4, 0 }, { 20, 8, 6 } }, { { 14, 10, -2 }, { 8, 20, 8 } }, { { -6, 2, 10 }, { 4, 4, 14 } } },
		{ 3, 5, -1 }
	),
	-- one chunk plus a probe
	prop_tree_oak = row({ { { 0, 6, 0 }, { 6, 12, 10 } } }, { 1.2, 7, -2 }),
	-- square single chunk, no probe: only the vote can turn it
	env_rock = row({ { { 0, 1, 0 }, { 4, 2, 4 } } }, nil),
}

local function entryOf(key)
	local r = MANIFEST[key]
	return Vector3.new(table.unpack(r.c)), Vector3.new(table.unpack(r.s)), r
end

-- An "imported" model as the 3D Importer might leave it: every chunk turned by
-- `yaw` about the model and scaled, dropped at `at`; MeshParts sit at their
-- geometry centres. With partTurn the rotation lives on each part's CFrame
-- instead of in the mesh (both happen in practice).
local function makeImport(key, opts)
	local centre, _, r = entryOf(key)
	local R = CFrame.Angles(0, math.rad(opts.yaw), 0)
	local model = MockInstance.new("Model")
	model.Name = opts.name or key
	for _, k in r.k do
		local c = Vector3.new(k[2], k[3], k[4])
		local size = Vector3.new(k[5], k[6], k[7]) * (opts.stretch or Vector3.one)
		local part = MockInstance.new("MeshPart", model)
		part.Name = k[1] == 0 and key or (key .. "_" .. k[1])
		local pos = opts.at + R:VectorToWorldSpace(c - centre) * opts.scale
		if opts.partTurn then
			part.CFrame = CFrame.new(pos) * R
			part.Size = size * opts.scale
		else
			local turned = R:VectorToWorldSpace(size)
			part.CFrame = CFrame.new(pos)
			part.Size = Vector3.new(math.abs(turned.X), math.abs(turned.Y), math.abs(turned.Z)) * opts.scale
		end
		part.Transparency = 0
	end
	if r.p then
		local probe = MockInstance.new("MeshPart", model)
		probe.Name = "KD_Probe"
		probe.CFrame = CFrame.new(opts.at + R:VectorToWorldSpace(Vector3.new(table.unpack(r.p)) - centre) * opts.scale)
		probe.Size = Vector3.new(0.2, 0.2, 0.2) * opts.scale
	end
	return model
end

-- A GREYBOX stand-in like tools/build_place.luau makes: a Model with the
-- module's pivot, one part per chunk, plus a sign face and a Neon lamp that
-- the meshes leave out.
local function makeStandIn(parent, key, pivot)
	local _, _, r = entryOf(key)
	local model = MockInstance.new("Model")
	model.Name = key .. "_StandIn"
	for _, k in r.k do
		local part = MockInstance.new("Part", model)
		part.CFrame = pivot * CFrame.new(k[2], k[3], k[4])
		part.Size = Vector3.new(k[5], k[6], k[7])
		part.Transparency = 0
		part.Material = Enum.Material.SmoothPlastic
	end
	local sign = MockInstance.new("Part", model)
	sign.Name = "SignFace"
	sign.CFrame = pivot
	sign.Size = Vector3.new(4, 2, 0.2)
	sign.Transparency = 0
	MockInstance.new("SurfaceGui", sign)
	local lamp = MockInstance.new("Part", model)
	lamp.Name = "Lamp"
	lamp.CFrame = pivot
	lamp.Size = Vector3.one
	lamp.Transparency = 0
	lamp.Material = Enum.Material.Neon
	model.WorldPivot = pivot
	model:SetAttribute("AssetKey", key)
	model:AddTag("GREYBOX")
	model.Parent = parent
	return model
end

local function visualOf(standIn)
	for _, child in standIn:GetChildren() do
		if child:GetAttribute("KD_Visual") then
			return child
		end
	end
	return nil
end

-- Every chunk of the visual sits where the module says, in the stand-in's frame.
local function checkPlaced(t, standIn, key, label)
	local visual = visualOf(standIn)
	t.ok(visual ~= nil, label .. ": no visual")
	local pivot = standIn:GetPivot()
	local _, _, r = entryOf(key)
	for _, k in r.k do
		local name = k[1] == 0 and key or (key .. "_" .. k[1])
		local part = visual:FindFirstChild(name)
		t.ok(part ~= nil, label .. ": missing chunk " .. name)
		local want = pivot * Vector3.new(k[2], k[3], k[4])
		t.ok(
			close(part.Position, want),
			string.format("%s: chunk %s at %s, want %s", label, name, tostring(part.Position), tostring(want))
		)
		-- the part's box, seen from the stand-in's frame, is the chunk's box
		local rel = pivot:ToObjectSpace(part.CFrame)
		local half = part.Size / 2
		local ext = Vector3.new(
			math.abs(rel.XVector.X) * half.X + math.abs(rel.YVector.X) * half.Y + math.abs(rel.ZVector.X) * half.Z,
			math.abs(rel.XVector.Y) * half.X + math.abs(rel.YVector.Y) * half.Y + math.abs(rel.ZVector.Y) * half.Z,
			math.abs(rel.XVector.Z) * half.X + math.abs(rel.YVector.Z) * half.Y + math.abs(rel.ZVector.Z) * half.Z
		) * 2
		t.ok(
			close(ext, Vector3.new(k[5], k[6], k[7])),
			string.format("%s: chunk %s size %s", label, name, tostring(ext))
		)
		t.ok(
			part.Anchored == true and part.CanCollide == false,
			label .. ": visual parts must be anchored and non-colliding"
		)
	end
	t.ok(visual:FindFirstChild("KD_Probe", true) == nil, label .. ": probe left in the visual")
end

local function scene(rt)
	local map = MockInstance.new("Model", rt.workspace)
	map.Name = "Map"
	local standIns = {
		makeStandIn(map, "env_gate", CFrame.new(40, 3, -120) * CFrame.Angles(0, math.rad(37), 0)),
		makeStandIn(map, "env_gate", CFrame.new(-60, 0, 30)),
		makeStandIn(map, "prop_tree_oak", CFrame.new(10, 0, 10) * CFrame.Angles(0, math.rad(-120), 0)),
		makeStandIn(map, "env_rock", CFrame.new(5, 1, -5) * CFrame.Angles(0, math.rad(15), 0)),
	}
	return standIns
end

return function(t)
	t.test("imports land exactly on their stand-ins for any importer turn and unit scale", function()
		for _, yaw in { 0, 90, 180, 270 } do
			for _, scale in { 1, 1 / 0.28, 0.28 } do
				for _, partTurn in { false, true } do
					local rt = t.runtime()
					local GreyboxSwap = rt:Require("Shared/GreyboxSwap")
					local standIns = scene(rt)
					for i, key in { "env_gate", "prop_tree_oak", "env_rock" } do
						makeImport(
							key,
							{ yaw = yaw, scale = scale, partTurn = partTurn, at = Vector3.new(i * 50, 80 + i * 30, 0) }
						).Parent =
							rt.workspace
					end
					local report = GreyboxSwap.Run({ Manifest = MANIFEST, Log = function() end })
					local label = string.format("yaw %d scale %.2f%s", yaw, scale, partTurn and " (part turn)" or "")
					t.eq(report.Yaw, yaw, label .. ": importer turn")
					t.eq(report.Swapped, 4, label .. ": stand-ins placed")
					for _, standIn in standIns do
						checkPlaced(t, standIn, standIn:GetAttribute("AssetKey"), label)
					end
				end
			end
		end
	end)

	t.test("swap tidies the Workspace and keeps signs and glow parts visible", function()
		local rt = t.runtime()
		local GreyboxSwap = rt:Require("Shared/GreyboxSwap")
		local standIns = scene(rt)
		makeImport("env_gate", { yaw = 0, scale = 1, at = Vector3.new(0, 90, 0), name = "env_gate.fbx" }).Parent =
			rt.workspace
		makeImport("prop_tree_oak", { yaw = 0, scale = 1, at = Vector3.new(0, 120, 0), name = "prop_tree_oak (2)" }).Parent =
			rt.workspace
		makeImport("env_rock", { yaw = 0, scale = 1, at = Vector3.new(0, 140, 0) }).Parent = rt.workspace
		local stray = MockInstance.new("Model", rt.workspace)
		stray.Name = "dig_pebble" -- a tool model from an older bundle
		GreyboxSwap.Run({ Manifest = MANIFEST, Log = function() end })
		local folder = rt:Service("ServerStorage"):FindFirstChild("KD_Imported")
		t.ok(folder ~= nil, "KD_Imported folder created")
		t.eq(#folder:GetChildren(), 4, "imports and the stray tool model moved into ServerStorage")
		for _, child in rt.workspace:GetChildren() do
			t.ok(
				child.Name == "Map" or child.Name == "Camera" or child.Name == "Terrain",
				"left in the Workspace: " .. child.Name
			)
		end
		for _, standIn in standIns do
			t.ok(not standIn:HasTag("GREYBOX"), "GREYBOX tag removed")
			t.ok(standIn:GetAttribute("KD_Swapped") ~= nil, "stand-in marked as swapped")
			for _, part in standIn:GetChildren() do
				if part:IsA("BasePart") then
					local keep = part.Name == "SignFace" or part.Name == "Lamp"
					t.eq(part.Transparency, keep and 0 or 1, "stand-in part " .. part.Name .. " transparency")
				end
			end
		end
	end)

	t.test("running the swap again keeps one visual per stand-in", function()
		local rt = t.runtime()
		local GreyboxSwap = rt:Require("Shared/GreyboxSwap")
		local standIns = scene(rt)
		for i, key in { "env_gate", "prop_tree_oak", "env_rock" } do
			makeImport(key, { yaw = 180, scale = 1, at = Vector3.new(i * 50, 90, 0) }).Parent = rt.workspace
		end
		GreyboxSwap.Run({ Manifest = MANIFEST, Log = function() end })
		local report = GreyboxSwap.Run({ Manifest = MANIFEST, Log = function() end })
		t.eq(report.Swapped, 4, "second run re-places every stand-in")
		for _, standIn in standIns do
			local visuals = 0
			for _, child in standIn:GetChildren() do
				if child:GetAttribute("KD_Visual") then
					visuals += 1
				end
			end
			t.eq(visuals, 1, "visuals on " .. standIn.Name)
			checkPlaced(t, standIn, standIn:GetAttribute("AssetKey"), "second run")
		end
		-- the run-time pass leaves swapped stand-ins alone
		local skipped = GreyboxSwap.Run({ Manifest = MANIFEST, SkipSwapped = true, Log = function() end })
		t.eq(skipped.Swapped, 0, "SkipSwapped leaves swapped stand-ins alone")
		t.eq(skipped.AlreadySwapped, 4, "already-swapped stand-ins are counted")
	end)

	t.test("mismatched or missing imports leave their stand-ins grey and are reported", function()
		local rt = t.runtime()
		local GreyboxSwap = rt:Require("Shared/GreyboxSwap")
		local standIns = scene(rt)
		makeImport("env_gate", { yaw = 90, scale = 1, at = Vector3.new(0, 90, 0) }).Parent = rt.workspace
		makeImport(
			"prop_tree_oak",
			{ yaw = 90, scale = 1, at = Vector3.new(0, 120, 0), stretch = Vector3.new(1.6, 1, 1) }
		).Parent =
			rt.workspace
		local lines = {}
		local report = GreyboxSwap.Run({
			Manifest = MANIFEST,
			Log = function(line)
				table.insert(lines, line)
			end,
		})
		t.eq(report.Swapped, 2, "only the matching module is placed")
		t.ok(report.Mismatched.prop_tree_oak ~= nil, "stretched import reported as mismatched")
		t.ok(report.Missing.env_rock == true, "module with no import reported as missing")
		t.ok(table.concat(lines, "\n"):find("prop_tree_oak") ~= nil, "mismatch named in the Output")
		for _, standIn in standIns do
			if standIn:GetAttribute("AssetKey") ~= "env_gate" then
				t.ok(visualOf(standIn) == nil, "no visual on " .. standIn.Name)
				for _, part in standIn:GetChildren() do
					if part:IsA("BasePart") then
						t.eq(part.Transparency, 0, "stand-in still visible: " .. standIn.Name)
					end
				end
			end
		end
	end)

	t.test("copies left beside stand-ins by the old swap script are removed", function()
		local rt = t.runtime()
		local GreyboxSwap = rt:Require("Shared/GreyboxSwap")
		local standIns = scene(rt)
		local folder = MockInstance.new("Folder", rt:Service("ServerStorage"))
		folder.Name = "KD_Imported"
		makeImport("env_rock", { yaw = 0, scale = 1, at = Vector3.new(0, 90, 0) }).Parent = folder
		local old = makeImport("env_rock", { yaw = 0, scale = 1, at = Vector3.new(7, 9, 7) })
		old.Parent = standIns[4].Parent
		local report = GreyboxSwap.Run({ Manifest = MANIFEST, Log = function() end })
		t.eq(report.Removed, 1, "old copy removed")
		t.ok(old.Parent == nil, "old copy no longer in the map")
		checkPlaced(t, standIns[4], "env_rock", "after cleanup")
	end)

	-- Real data: the generated manifest, the layout and the command-bar script.
	local layout = serde.decode("json", fs.readFile("assets/layout.json"))
	local manifestJson = serde.decode("json", fs.readFile("assets/export/manifest.json"))
	local palette = {}
	-- selene: allow(manual_table_clone)
	for key, mat in fs.readFile("blender/kd/palette.py"):gmatch('"([%w_]+)": %("(%w+)"') do
		palette[key] = mat
	end

	t.test("manifest covers every meshable module and every mesh fits a MeshPart", function()
		local rt = t.runtime()
		local manifest = rt:Require("Shared/MeshManifest")
		local GreyboxSwap = rt:Require("Shared/GreyboxSwap")
		local decoded = GreyboxSwap.Decode(manifest)
		for key, entry in decoded do
			for _, chunk in entry.Chunks do
				t.ok(
					math.max(chunk.Size.X, chunk.Size.Y, chunk.Size.Z) <= 1100,
					key .. " has a chunk over the 2048-stud MeshPart limit"
				)
			end
			if entry.Probe then
				local d = entry.Probe - entry.Center
				t.ok(
					math.abs(d.X) <= entry.Size.X / 2
						and math.abs(d.Y) <= entry.Size.Y / 2
						and math.abs(d.Z) <= entry.Size.Z / 2,
					key .. " probe outside its bounds"
				)
			end
			t.ok(manifestJson[entry.Key] ~= nil, key .. " missing from manifest.json")
		end
	end)

	t.test("meshes leave out exactly the parts the swap keeps visible", function()
		-- Rebuild every GREYBOX module's parts as build_place does, apply
		-- GreyboxSwap.KeepsVisible and compare the bounds of what is left with
		-- the exported mesh bounds: any disagreement with meshkit.stays_part
		-- would show up as a size or centre mismatch (or a missing entry).
		local rt = t.runtime()
		local GreyboxSwap = rt:Require("Shared/GreyboxSwap")
		local manifest = GreyboxSwap.Decode(rt:Require("Shared/MeshManifest"))
		local checked = {}
		for _, m in layout.modules do
			if m.greybox and not checked[m.key] then
				checked[m.key] = true
				local lo, hi
				local tilted = false
				for _, p in m.parts do
					local part = MockInstance.new("Part")
					part.Transparency = p.t or 0
					part.Material = materialOf(palette[p.m])
					if p.gui then
						MockInstance.new("SurfaceGui", part)
					end
					if p.a and p.a.KeepVisible then
						part:SetAttribute("KeepVisible", true)
					end
					if part.Transparency < 0.99 and not GreyboxSwap.KeepsVisible(part) then
						local cf = CFrame.new(p.p[1], p.p[2], p.p[3])
						if p.r then
							cf *= CFrame.Angles(math.rad(p.r[1]), math.rad(p.r[2]), math.rad(p.r[3]))
							tilted = tilted or (p.r[1] % 90 ~= 0 or p.r[2] % 90 ~= 0 or p.r[3] % 90 ~= 0)
						end
						local half = Vector3.new(p.z[1], p.z[2], p.z[3]) / 2
						local ext = Vector3.new(
							math.abs(cf.XVector.X) * half.X
								+ math.abs(cf.YVector.X) * half.Y
								+ math.abs(cf.ZVector.X) * half.Z,
							math.abs(cf.XVector.Y) * half.X
								+ math.abs(cf.YVector.Y) * half.Y
								+ math.abs(cf.ZVector.Y) * half.Z,
							math.abs(cf.XVector.Z) * half.X
								+ math.abs(cf.YVector.Z) * half.Y
								+ math.abs(cf.ZVector.Z) * half.Z
						)
						local a, b = cf.Position - ext, cf.Position + ext
						lo = lo and Vector3.new(math.min(lo.X, a.X), math.min(lo.Y, a.Y), math.min(lo.Z, a.Z)) or a
						hi = hi and Vector3.new(math.max(hi.X, b.X), math.max(hi.Y, b.Y), math.max(hi.Z, b.Z)) or b
					end
				end
				local entry = manifest[m.key]
				if lo == nil then
					t.ok(entry == nil, m.key .. " has a mesh but every part stays a part")
				else
					t.ok(entry ~= nil, m.key .. " has meshable parts but no mesh")
					-- bevels trim the corners of tilted blocks, so their mesh bounds shrink a little
					local tolerance = tilted and 0.6 or 0.05
					t.ok(
						close(entry.Center, (lo + hi) / 2, tolerance),
						m.key .. " mesh centre differs from its meshable parts"
					)
					t.ok(close(entry.Size, hi - lo, tolerance), m.key .. " mesh size differs from its meshable parts")
				end
			end
		end
	end)

	t.test("the generated command-bar script places real modules end to end", function()
		local source = fs.readFile("tools/studio/SwapGreybox.lua")
		local module = fs.readFile("src/shared/GreyboxSwap.luau")
		t.ok(
			source:find("GreyboxSwap.Run({ Manifest = MANIFEST, Undo = true })", 1, true) ~= nil,
			"script ends with the Run call"
		)
		local inlined = module:gsub("\n([^\n])", "\n\t%1")
		t.ok(
			source:find(inlined, 1, true) ~= nil,
			"script inlines the current GreyboxSwap.luau (re-run tools/gen_swap_script.py)"
		)

		local rt = t.runtime()
		local map = MockInstance.new("Model", rt.workspace)
		map.Name = "Map"
		local keys = { "env_gate", "env_mountains", "env_island_top", "prop_tree_a" }
		local standIns = {}
		for _, m in layout.modules do
			if table.find(keys, m.key) and manifestJson[m.key] then
				local model = MockInstance.new("Model")
				model.Name = m.name
				local pivot = CFrame.new(m.pivot[1], m.pivot[2], m.pivot[3]) * CFrame.Angles(0, math.rad(m.yaw), 0)
				for _, p in m.parts do
					local part = MockInstance.new("Part", model)
					part.CFrame = pivot * CFrame.new(p.p[1], p.p[2], p.p[3])
					part.Size = Vector3.new(p.z[1], p.z[2], p.z[3])
					part.Transparency = p.t or 0
					part.Material = materialOf(palette[p.m])
				end
				model.WorldPivot = pivot
				model:SetAttribute("AssetKey", m.key)
				model.Parent = map
				table.insert(standIns, model)
			end
		end
		t.ok(#standIns >= 4, "found stand-ins for the sample modules")
		-- imports turned 180 degrees, as a front-facing importer would
		local R = CFrame.Angles(0, math.pi, 0)
		for i, key in keys do
			local e = manifestJson[key]
			local centre = Vector3.new(table.unpack(e.center))
			local at = Vector3.new(0, 200 + 300 * i, 0)
			local model = MockInstance.new("Model", rt.workspace)
			model.Name = key
			for _, c in e.chunks do
				local part = MockInstance.new("MeshPart", model)
				part.Name = c.name
				part.CFrame = CFrame.new(at + R:VectorToWorldSpace(Vector3.new(table.unpack(c.center)) - centre)) * R
				part.Size = Vector3.new(table.unpack(c.size))
			end
			local probe = MockInstance.new("MeshPart", model)
			probe.Name = "KD_Probe"
			probe.CFrame = CFrame.new(at + R:VectorToWorldSpace(Vector3.new(table.unpack(e.probe)) - centre))
			probe.Size = Vector3.new(0.2, 0.2, 0.2)
		end
		local env = rt:_makeEnv(MockInstance.new("Script"))
		local printed = {}
		env.print = function(...)
			table.insert(printed, table.concat({ ... }, " "))
		end
		local fn = luau.load(luau.compile(source), { debugName = "SwapGreybox.lua", environment = env })
		fn()
		t.ok(
			table.concat(printed, "\n"):find("Placed " .. #standIns .. " of " .. #standIns, 1, true) ~= nil,
			"Output: " .. table.concat(printed, " | ")
		)
		for _, standIn in standIns do
			local key = standIn:GetAttribute("AssetKey")
			local visual = visualOf(standIn)
			t.ok(visual ~= nil, key .. " got a visual")
			for _, c in manifestJson[key].chunks do
				local part = visual:FindFirstChild(c.name)
				local want = standIn:GetPivot() * Vector3.new(table.unpack(c.center))
				t.ok(part ~= nil and close(part.Position, want, 0.01), key .. " chunk " .. c.name .. " misplaced")
			end
		end
	end)

	t.test("every stand-in in the built place gets its mesh, turned and rescaled imports included", function()
		-- Reads place/KeepDigging.rbxl, mirrors each GREYBOX stand-in (pivot,
		-- parts, materials, SurfaceGuis) into the mock Workspace, imports every
		-- manifest module turned 90 degrees at metre scale (x3.57), and checks
		-- each chunk lands at standIn:GetPivot() * its local centre.
		local place = roblox.deserializePlace(fs.readFile("place/KeepDigging.rbxl"))
		local rt = t.runtime()
		local GreyboxSwap = rt:Require("Shared/GreyboxSwap")
		local manifest = rt:Require("Shared/MeshManifest")
		local shared = place:GetService("ReplicatedStorage").Shared
		for _, name in { "GreyboxSwap", "MeshManifest" } do
			local module = shared:FindFirstChild(name)
			t.ok(module ~= nil, "place ships Shared." .. name)
			t.eq(
				module.Source,
				fs.readFile("src/shared/" .. name .. ".luau"),
				"place has the current Shared." .. name .. " (rebuild the place)"
			)
		end
		local map = MockInstance.new("Model", rt.workspace)
		map.Name = "Map"
		local standIns = {}
		for _, model in place:GetService("Workspace"):GetDescendants() do
			local key = model:IsA("Model") and model:GetAttribute("AssetKey")
			if key and manifestJson[key] then
				local copy = MockInstance.new("Model")
				copy.Name = model.Name
				for _, part in model:GetDescendants() do
					if part:IsA("BasePart") then
						local p = MockInstance.new("Part", copy)
						p.Name = part.Name
						p.CFrame = part.CFrame
						p.Size = part.Size
						p.Transparency = part.Transparency
						p.Material = part.Material
						if part:FindFirstChildOfClass("SurfaceGui") then
							MockInstance.new("SurfaceGui", p)
						end
					end
				end
				local pivot = model.WorldPivotData
				t.ok(typeof(pivot) == "CFrame", model:GetFullName() .. " has no saved pivot (WorldPivotData)")
				copy.WorldPivot = pivot
				copy:SetAttribute("AssetKey", key)
				copy.Parent = map
				table.insert(standIns, copy)
			end
		end
		t.ok(#standIns >= 37, "stand-ins found in the place: " .. #standIns)
		local R = CFrame.Angles(0, math.rad(90), 0)
		local scale = 1 / 0.28
		local i = 0
		for key, e in manifestJson do
			i += 1
			local centre = Vector3.new(table.unpack(e.center))
			local at = Vector3.new(i * 40, 3000, 0)
			local model = MockInstance.new("Model", rt.workspace)
			model.Name = key
			for _, c in e.chunks do
				local part = MockInstance.new("MeshPart", model)
				part.Name = c.name
				part.CFrame = CFrame.new(
					at + R:VectorToWorldSpace(Vector3.new(table.unpack(c.center)) - centre) * scale
				) * R
				part.Size = Vector3.new(table.unpack(c.size)) * scale
			end
			local probe = MockInstance.new("MeshPart", model)
			probe.Name = "KD_Probe"
			probe.CFrame = CFrame.new(at + R:VectorToWorldSpace(Vector3.new(table.unpack(e.probe)) - centre) * scale)
			probe.Size = Vector3.new(0.2, 0.2, 0.2) * scale
		end
		local report = GreyboxSwap.Run({ Manifest = manifest, Log = function() end })
		t.eq(report.Yaw, 90, "importer turn found")
		t.ok(report.YawDecided, "importer turn decided by the evidence")
		t.eq(report.Swapped, #standIns, "every stand-in placed")
		for _, standIn in standIns do
			local key = standIn:GetAttribute("AssetKey")
			local visual = visualOf(standIn)
			for _, c in manifestJson[key].chunks do
				local part = visual and visual:FindFirstChild(c.name)
				local want = standIn:GetPivot() * Vector3.new(table.unpack(c.center))
				t.ok(
					part ~= nil and close(part.Position, want, 0.01),
					key .. " chunk " .. c.name .. " misplaced in " .. standIn.Name
				)
			end
		end
	end)
end
