--[[
	GreyboxSwap: puts imported Blender meshes onto their GREYBOX stand-ins.

	It never trusts the importer's pivot, unit or axis settings. Every mesh
	module has a manifest entry (Shared.MeshManifest, written by
	blender/build_all.py) holding the local bounds of the whole module, of each
	exported mesh object ("chunk") and the position of a tiny "KD_Probe" cube.
	Comparing those with the imported parts gives the importer's scale and
	quarter-turn rotation, so a copy can be placed with local point q at
	standIn:GetPivot() * q. The rotation is decided by a vote over every
	module, because the importer treats all files the same way.

	  GreyboxSwap.Run({ Manifest = require(Shared.MeshManifest) })

	finds the imported models (ServerStorage.KD_Imported, or anywhere in the
	Workspace, matched by file name), moves them into ServerStorage.KD_Imported
	and gives every stand-in with that AssetKey a "<key>_Mesh" child. The
	stand-in's own parts turn invisible but keep their collisions; parts the
	meshes leave out (KeepsVisible: signs, Neon, Glass, see-through parts) stay
	as they are. Running it again replaces the earlier visuals.

	Used by tools/studio/SwapGreybox.lua (Studio command bar, edit time) and
	AssetSwapService (run time). Keep it free of requires: the command-bar
	script inlines this file.
]]

local GreyboxSwap = {}

GreyboxSwap.Yaws = { 0, 90, 180, 270 }
-- Mean fit error allowed, as a fraction of the module's diagonal.
GreyboxSwap.Tolerance = 0.03
GreyboxSwap.FolderName = "KD_Imported"
-- Other files from Keep Digging! bundles (tools, finds, old marker exports)
-- that are tidied out of the Workspace when found at its top level.
GreyboxSwap.TidyPatterns = { "^env_", "^prop_", "^marker_", "^dig_", "^tool_", "^find_" }

local VISUAL_ATTR = "KD_Visual"
local SWAPPED_ATTR = "KD_Swapped"

local function vec(t): Vector3
	return Vector3.new(t[1], t[2], t[3])
end

local function vmin(a: Vector3, b: Vector3): Vector3
	return Vector3.new(math.min(a.X, b.X), math.min(a.Y, b.Y), math.min(a.Z, b.Z))
end

local function vmax(a: Vector3, b: Vector3): Vector3
	return Vector3.new(math.max(a.X, b.X), math.max(a.Y, b.Y), math.max(a.Z, b.Z))
end

-- Manifest rows are plain arrays so the generated file stays compact:
--   [key] = { c = centre, s = size, p = probe, k = { { index, cx, cy, cz, sx, sy, sz }, ... } }
function GreyboxSwap.Decode(manifest)
	local out = {}
	for key, row in manifest do
		local chunks = {}
		for _, k in row.k do
			chunks[k[1]] = { Center = Vector3.new(k[2], k[3], k[4]), Size = Vector3.new(k[5], k[6], k[7]) }
		end
		out[string.lower(key)] = {
			Key = key,
			Center = vec(row.c),
			Size = vec(row.s),
			Probe = row.p and vec(row.p) or nil,
			Chunks = chunks,
			ChunkCount = #row.k,
		}
	end
	return out
end

-- "env_gate", "env_gate.fbx", "Env_Gate (2)" -> "env_gate"
function GreyboxSwap.NormaliseName(name: string): string
	local n = string.lower(name)
	n = string.gsub(n, "%s*%(%d+%)$", "")
	n = string.gsub(n, "%.fbx$", "")
	return n
end

-- Chunk index of an imported part: "<key>" or "<key>_0" -> 0, "<key>_3" -> 3.
local function chunkIndex(key: string, partName: string): number?
	local n = string.lower(partName)
	if n == key then
		return 0
	end
	if string.sub(n, 1, #key + 1) == key .. "_" then
		local index = tonumber(string.sub(n, #key + 2))
		if index and index >= 0 and index == math.floor(index) then
			return index
		end
	end
	return nil
end

local function isProbe(part: Instance): boolean
	return string.find(string.lower(part.Name), "kd_probe", 1, true) ~= nil
end

-- World-axis bounds of a (possibly rotated) part.
local function partBounds(part: BasePart): (Vector3, Vector3)
	local cf, half = part.CFrame, part.Size / 2
	local x, y, z = cf.XVector, cf.YVector, cf.ZVector
	local extent = Vector3.new(
		math.abs(x.X) * half.X + math.abs(y.X) * half.Y + math.abs(z.X) * half.Z,
		math.abs(x.Y) * half.X + math.abs(y.Y) * half.Y + math.abs(z.Y) * half.Z,
		math.abs(x.Z) * half.X + math.abs(y.Z) * half.Y + math.abs(z.Z) * half.Z
	)
	return cf.Position - extent, cf.Position + extent
end

local function baseParts(root: Instance): { BasePart }
	local parts = {}
	if root:IsA("BasePart") then
		table.insert(parts, root)
	end
	for _, d in root:GetDescendants() do
		if d:IsA("BasePart") then
			table.insert(parts, d)
		end
	end
	return parts
end

-- What an imported model looks like now: overall bounds (probe excluded),
-- the centre of every named chunk and the probe position.
function GreyboxSwap.Observe(root: Instance, key: string)
	local lo, hi
	local chunks, probe = {}, nil
	for _, part in baseParts(root) do
		if isProbe(part) then
			probe = part.Position
		else
			local a, b = partBounds(part)
			lo = lo and vmin(lo, a) or a
			hi = hi and vmax(hi, b) or b
			local index = chunkIndex(key, part.Name)
			if index ~= nil then
				chunks[index] = part.Position
			end
		end
	end
	if not lo then
		return nil
	end
	return { Center = (lo + hi) / 2, Size = hi - lo, Chunks = chunks, Probe = probe }
end

-- Scale and per-rotation fit error of an observed import against its entry.
-- The importer is assumed to map a local offset v (from the entry's centre) to
-- scale * R(yaw) * v; errors[yaw] is the mean mismatch over the overall size,
-- the chunk centres and the probe, relative to the module's diagonal.
function GreyboxSwap.Fit(entry, seen): (number, { [number]: number })
	local scale = seen.Size.Magnitude / math.max(entry.Size.Magnitude, 1e-6)
	local norm = math.max(entry.Size.Magnitude, 1e-3)
	local errors = {}
	for _, yaw in GreyboxSwap.Yaws do
		local r = CFrame.Angles(0, math.rad(yaw), 0)
		local rotated = r:VectorToWorldSpace(entry.Size)
		local want = Vector3.new(math.abs(rotated.X), math.abs(rotated.Y), math.abs(rotated.Z))
		local total, n = (seen.Size / scale - want).Magnitude / norm, 1
		if entry.ChunkCount > 1 then
			for index, chunk in entry.Chunks do
				local at = seen.Chunks[index]
				if at then
					local expect = r:VectorToWorldSpace(chunk.Center - entry.Center)
					total += ((at - seen.Center) / scale - expect).Magnitude / norm
					n += 1
				end
			end
		end
		if entry.Probe and seen.Probe then
			local expect = r:VectorToWorldSpace(entry.Probe - entry.Center)
			total += ((seen.Probe - seen.Center) / scale - expect).Magnitude / norm
			n += 1
		end
		errors[yaw] = total / n
	end
	return scale, errors
end

-- The importer rotates every file the same way, so the rotation is chosen by
-- summing every module's errors. Returns the yaw and whether the evidence
-- actually told the candidates apart (symmetric modules cannot).
function GreyboxSwap.ChooseYaw(fits): (number, boolean)
	local totals = {}
	for _, yaw in GreyboxSwap.Yaws do
		totals[yaw] = 0
	end
	for _, fit in fits do
		for yaw, err in fit.Errors do
			totals[yaw] += math.min(err, 1)
		end
	end
	local best, second
	for _, yaw in GreyboxSwap.Yaws do
		if best == nil or totals[yaw] < totals[best] - 1e-9 then
			second = best
			best = yaw
		elseif second == nil or totals[yaw] < totals[second] then
			second = yaw
		end
	end
	return best, totals[second] - totals[best] > 0.01
end

-- Moves (and rescales) a copy of the import so local point q of the module
-- ends up at target * q.
function GreyboxSwap.Place(visual: Model, target: CFrame, entry, seen, yaw: number, scale: number)
	visual.PrimaryPart = nil
	visual.WorldPivot = CFrame.new(seen.Center) * CFrame.Angles(0, math.rad(yaw), 0)
	if math.abs(scale - 1) > 1e-4 then
		visual:ScaleTo(visual:GetScale() / scale)
	end
	visual:PivotTo(target * CFrame.new(entry.Center))
end

local KEEP_MATERIALS = { Neon = true, Glass = true, ForceField = true }

-- Stand-in parts the meshes leave out, so they stay visible after a swap.
-- Must match stays_part in blender/kd/meshkit.py.
function GreyboxSwap.KeepsVisible(part: BasePart): boolean
	if part:GetAttribute("KeepVisible") == true or part:FindFirstChildOfClass("SurfaceGui") ~= nil then
		return true
	end
	local material = part.Material
	if material and KEEP_MATERIALS[material.Name] then
		return true
	end
	return part.Transparency > 0 and part.Transparency < 0.99
end

local function hideStandIn(standIn: Instance)
	for _, part in baseParts(standIn) do
		if not GreyboxSwap.KeepsVisible(part) then
			part.Transparency = 1
		end
	end
end

local function asModel(inst: Instance): Model
	if inst:IsA("Model") then
		return inst :: Model
	end
	local model = Instance.new("Model")
	inst.Parent = model
	return model
end

local function finishVisual(visual: Model)
	for _, d in visual:GetDescendants() do
		if d:IsA("BasePart") then
			if isProbe(d) then
				d:Destroy()
			else
				d.Anchored = true
				d.CanCollide = false
				d.CanQuery = false
				d.CanTouch = false
				d.Massless = true
			end
		end
	end
end

local function count(t): number
	local n = 0
	for _ in t do
		n += 1
	end
	return n
end

local function sortedKeys(t): { string }
	local keys = {}
	for k in t do
		table.insert(keys, k)
	end
	table.sort(keys)
	return keys
end

-- options:
--   Manifest      raw manifest table (required)
--   Templates     { [key] = Instance } extra templates (uploaded assets)
--   Root          where stand-ins and stray imports live (default workspace)
--   Storage       where KD_Imported lives (default ServerStorage)
--   SkipSwapped   leave stand-ins that already have a visual alone
--   Undo          record one undo step (Studio command bar)
--   Log           print-like function
function GreyboxSwap.Run(options)
	options = options or {}
	local manifest = GreyboxSwap.Decode(assert(options.Manifest, "GreyboxSwap.Run needs a Manifest"))
	local root = options.Root or workspace
	local storage = options.Storage or game:GetService("ServerStorage")
	local log = options.Log or print
	local report = {
		Swapped = 0,
		StandIns = 0,
		Templates = 0,
		Moved = 0,
		Removed = 0,
		AlreadySwapped = 0,
		Missing = {},
		Mismatched = {},
		Yaw = 0,
		YawDecided = false,
		Scale = 1,
	}

	local history, recording
	if options.Undo then
		local ok, service = pcall(game.GetService, game, "ChangeHistoryService")
		if ok and service then
			history = service
			local began, id = pcall(service.TryBeginRecording, service, "Keep Digging! mesh swap")
			recording = began and id or nil
		end
	end
	local function commit()
		if history and recording then
			pcall(history.FinishRecording, history, recording, Enum.FinishRecordingOperation.Commit)
		end
	end

	local folder = storage:FindFirstChild(GreyboxSwap.FolderName)

	-- 1. templates: uploaded assets, ServerStorage.KD_Imported, stray imports
	local templates = {}
	for key, inst in options.Templates or {} do
		templates[string.lower(key)] = inst
	end
	if folder then
		for _, inst in folder:GetChildren() do
			local key = GreyboxSwap.NormaliseName(inst.Name)
			if manifest[key] and not templates[key] then
				templates[key] = inst
			end
		end
	end
	local candidates = {}
	for _, d in root:GetDescendants() do
		if
			(d:IsA("Model") or d:IsA("BasePart"))
			and manifest[GreyboxSwap.NormaliseName(d.Name)]
			and d:GetAttribute("AssetKey") == nil
			and d:GetAttribute(VISUAL_ATTR) == nil
		then
			table.insert(candidates, d)
		end
	end
	local function ensureFolder()
		if not folder then
			folder = Instance.new("Folder")
			folder.Name = GreyboxSwap.FolderName
			folder.Parent = storage
		end
		return folder
	end
	local claimed = {}
	for _, d in candidates do
		if d.Parent == nil then
			continue -- went with an import destroyed above
		end
		-- skip parts of stand-ins, of our visuals and of imports already claimed
		local inside = false
		local a = d.Parent
		while a and a ~= root do
			if claimed[a] or a:GetAttribute("AssetKey") ~= nil or a:GetAttribute(VISUAL_ATTR) ~= nil then
				inside = true
				break
			end
			a = a.Parent
		end
		if not inside then
			claimed[d] = true
			local key = GreyboxSwap.NormaliseName(d.Name)
			local besideStandIn = false
			for _, sibling in (d.Parent and d.Parent:GetChildren() or {}) do
				local siblingKey = sibling:GetAttribute("AssetKey")
				if type(siblingKey) == "string" and string.lower(siblingKey) == key then
					besideStandIn = true
					break
				end
			end
			if besideStandIn and templates[key] then
				-- a copy left next to its stand-in by an earlier swap script
				d:Destroy()
				report.Removed += 1
			else
				d.Parent = ensureFolder()
				report.Moved += 1
				if not templates[key] then
					templates[key] = d
				end
			end
		end
	end
	for _, d in root:GetChildren() do
		if (d:IsA("Model") or d:IsA("BasePart")) and d:GetAttribute("AssetKey") == nil then
			local name = GreyboxSwap.NormaliseName(d.Name)
			for _, pattern in GreyboxSwap.TidyPatterns do
				if string.find(name, pattern) then
					d.Parent = ensureFolder()
					report.Moved += 1
					break
				end
			end
		end
	end

	-- 2. measure every template and vote on the importer's rotation
	local fits = {}
	local scales = {}
	for key, template in templates do
		local entry = manifest[key]
		local seen = entry and GreyboxSwap.Observe(template, key)
		if seen then
			local scale, errors = GreyboxSwap.Fit(entry, seen)
			fits[key] = { Seen = seen, Scale = scale, Errors = errors }
			table.insert(scales, scale)
		end
	end
	report.Templates = count(fits)
	if report.Templates == 0 then
		commit()
		log(
			"[KD] No imported Keep Digging! models found. Import the .fbx files first (they can land anywhere in the Workspace)."
		)
		return report
	end
	table.sort(scales)
	report.Scale = scales[math.floor((#scales + 1) / 2)]
	report.Yaw, report.YawDecided = GreyboxSwap.ChooseYaw(fits)

	-- 3. swap every stand-in that has a matching template
	local standIns = {}
	for _, d in root:GetDescendants() do
		if d:IsA("Model") then
			local key = d:GetAttribute("AssetKey")
			if type(key) == "string" and manifest[string.lower(key)] then
				table.insert(standIns, d)
			end
		end
	end
	for _, standIn in standIns do
		local key = string.lower(standIn:GetAttribute("AssetKey"))
		local fit = fits[key]
		report.StandIns += 1
		if not fit then
			report.Missing[key] = true
		elseif fit.Errors[report.Yaw] > GreyboxSwap.Tolerance then
			report.Mismatched[key] = fit.Errors[report.Yaw]
		elseif options.SkipSwapped and standIn:GetAttribute(SWAPPED_ATTR) then
			report.AlreadySwapped += 1
		else
			for _, child in standIn:GetChildren() do
				if child:GetAttribute(VISUAL_ATTR) ~= nil then
					child:Destroy()
				end
			end
			hideStandIn(standIn)
			local visual = asModel(templates[key]:Clone())
			visual.Name = key .. "_Mesh"
			visual:SetAttribute(VISUAL_ATTR, key)
			GreyboxSwap.Place(visual, standIn:GetPivot(), manifest[key], fit.Seen, report.Yaw, fit.Scale)
			finishVisual(visual)
			visual.Parent = standIn
			standIn:SetAttribute(SWAPPED_ATTR, key)
			standIn:RemoveTag("GREYBOX")
			report.Swapped += 1
		end
	end

	commit()

	log(
		string.format(
			"[KD] Placed %d of %d stand-ins using %d imported models (importer turn %d°%s, scale x%.2f).%s%s",
			report.Swapped,
			report.StandIns,
			report.Templates,
			report.Yaw,
			report.YawDecided and "" or ", assumed",
			report.Scale,
			report.AlreadySwapped > 0 and string.format(" %d already had their meshes.", report.AlreadySwapped) or "",
			report.Moved > 0
					and string.format(" Moved %d imports into ServerStorage.%s.", report.Moved, GreyboxSwap.FolderName)
				or ""
		)
	)
	local missing = sortedKeys(report.Missing)
	if #missing > 0 then
		log("[KD] Not imported yet (still grey blocks): " .. table.concat(missing, ", "))
	end
	local mismatched = sortedKeys(report.Mismatched)
	if #mismatched > 0 then
		log(
			"[KD] These imports don't match this place's layout; re-import them from the latest zip: "
				.. table.concat(mismatched, ", ")
		)
	end
	return report
end

return GreyboxSwap
