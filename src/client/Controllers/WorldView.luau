--[[
	WorldView: client rendering of shared world state.
	  * Server Depth sign in the gate doorway (counting, progress, strata icons)
	  * Top Diggers board (cycles This Hole / All Time) and Most Valuable
	    Finds board (top ten by Value, highlighting finds this player owns)
	  * Depth gauge marker on the ladder + find markers (glowing glints)
	  * "Undug" darkness below the marker that clears as it descends
	    (ReferenceCamera's showcase hides it and lights the whole stack)
	  * Gauge plaques relabelled in metres for the current target
	  * Artifacts hall showpieces, relic orb rings (Community Dig Pool)
	  * Per-stratum lighting blend as the camera descends
]]

local CollectionService = game:GetService("CollectionService")
local Lighting = game:GetService("Lighting")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Catalog = require(Shared.Catalog)
local Config = require(Shared.Config)
local HoleMath = require(Shared.HoleMath)
local Strata = require(Shared.Strata)
local Format = require(Shared.Util.Format)

local Kit = require(script.Parent.Parent.UI.Kit)
local State = require(script.Parent.Parent.State)

local New = Kit.New
local WorldView = {}

local depthSign = {}
local boardRows = { Diggers = {}, Finds = {} }
local diggersTitle
local markerPart, shroudParts, findMarkers = nil, {}, {}
local showcaseLights = {}
local boardMode = "ThisHole"

local function tagged(tag)
	return CollectionService:GetTagged(tag)[1]
end

local function waitTagged(tag, timeout)
	local deadline = os.clock() + (timeout or 20)
	while os.clock() < deadline do
		local inst = tagged(tag)
		if inst then
			return inst
		end
		task.wait(0.5)
	end
	return nil
end

------------------------------------------------------------------------------
-- Server Depth sign (gate doorway)
------------------------------------------------------------------------------
local function buildDepthSign()
	local part = waitTagged("DepthSign")
	if not part then
		return
	end
	local gui = New("SurfaceGui", { Face = Enum.NormalId.Back, SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud, PixelsPerStud = 40, LightInfluence = 0, Parent = part })
	local bg = New("Frame", { BackgroundColor3 = Kit.Colors.Slate, Size = UDim2.fromScale(1, 1), Parent = gui }, { Kit.Stroke(Kit.Colors.Gold, 8) })
	Kit.Label({ Text = "SERVER DEPTH", Display = true, Color = Kit.Colors.Cream, Size = UDim2.fromScale(0.9, 0.18), Position = UDim2.fromScale(0.05, 0.04), Parent = bg })
	depthSign.depth = Kit.Label({ Text = "0 m", Display = true, Color = Kit.Colors.GoldLight, Stroke = Kit.Colors.GoldDark, StrokeSize = 6, Size = UDim2.fromScale(0.9, 0.34), Position = UDim2.fromScale(0.05, 0.22), Parent = bg })
	depthSign.target = Kit.Label({ Text = "/ 10,000 m", Color = Kit.Colors.White, Size = UDim2.fromScale(0.9, 0.14), Position = UDim2.fromScale(0.05, 0.56), Parent = bg })
	local bar = New("Frame", { BackgroundColor3 = Color3.fromRGB(8, 10, 18), Size = UDim2.fromScale(0.9, 0.1), Position = UDim2.fromScale(0.05, 0.73), Parent = bg }, { Kit.Corner(10) })
	for _, band in Strata.Bands do
		New("Frame", { BackgroundColor3 = band.Color, BackgroundTransparency = 0.4, BorderSizePixel = 0, Size = UDim2.fromScale(band.To - band.From, 1), Position = UDim2.fromScale(band.From, 0), Parent = bar })
		New("Frame", { BackgroundColor3 = band.Accent, Size = UDim2.fromScale(0.03, 0.08), Position = UDim2.fromScale(band.From + (band.To - band.From) / 2 - 0.015, 0.88), Parent = bg }, { Kit.Corner(20) })
	end
	depthSign.fill = New("Frame", { BackgroundColor3 = Kit.Colors.Gold, Size = UDim2.fromScale(0, 1), Parent = bar }, { Kit.Corner(10) })
end

------------------------------------------------------------------------------
-- Boards
------------------------------------------------------------------------------
local function buildBoard(tag, title, key)
	local part = waitTagged(tag)
	if not part then
		return
	end
	local gui = New("SurfaceGui", { Face = Enum.NormalId.Front, SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud, PixelsPerStud = 24, LightInfluence = 0.1, Parent = part })
	local bg = New("Frame", { BackgroundColor3 = Color3.fromRGB(24, 29, 47), Size = UDim2.fromScale(1, 1), Parent = gui }, { Kit.Padding(24) })
	local t = Kit.Label({ Text = title, Display = true, Color = Kit.Colors.White, Stroke = Color3.fromRGB(8, 10, 18), StrokeSize = 3, Size = UDim2.fromScale(1, 0.12), Parent = bg })
	if key == "Diggers" then
		diggersTitle = t
	end
	for i = 1, 10 do
		local y = 0.15 + (i - 1) * 0.085
		local r = {}
		r.rank = Kit.Label({ Text = "#" .. i, Display = true, Color = Kit.Colors.Rank, AlignX = Enum.TextXAlignment.Left, Size = UDim2.fromScale(0.12, 0.075), Position = UDim2.fromScale(0, y), Parent = bg })
		local nameX = key == "Finds" and 0.22 or 0.13
		if key == "Finds" then
			r.icon = New("Frame", { Size = UDim2.fromScale(0.06, 0.06), Position = UDim2.fromScale(0.13, y + 0.008), Parent = bg }, { Kit.Corner(6) })
		end
		r.name = Kit.Label({ Text = "", AlignX = Enum.TextXAlignment.Left, Size = UDim2.fromScale(0.5, 0.075), Position = UDim2.fromScale(nameX, y), Parent = bg })
		r.value = Kit.Label({ Text = "", AlignX = Enum.TextXAlignment.Right, Size = UDim2.fromScale(0.36, 0.075), Position = UDim2.fromScale(0.64, y), Parent = bg })
		boardRows[key][i] = r
	end
end

local function refreshDiggers()
	local boards = State.Boards
	if not boards or not boardRows.Diggers[1] then
		return
	end
	local rows = boardMode == "ThisHole" and boards.ThisHole or boards.AllTime
	diggersTitle.Text = boardMode == "ThisHole" and "Top Diggers · This Hole" or "Top Diggers · All Time"
	for i = 1, 10 do
		local r, data = boardRows.Diggers[i], rows and rows[i]
		r.name.Text = data and data.Name or "—"
		r.value.Text = data and Format.Metres(data.Metres) or ""
		r.name.TextColor3 = (data and data.UserId == Players.LocalPlayer.UserId) and Kit.Colors.GoldLight or Kit.Colors.White
	end
end

local function refreshFinds()
	if not boardRows.Finds[1] then
		return
	end
	local p = State.Profile
	for i = 1, 10 do
		local f = Catalog.FindsByValue[i]
		local r = boardRows.Finds[i]
		local owned = p and (p.Collection[f.Id] or 0) > 0
		r.name.Text = f.Name .. (owned and "  ✓" or "")
		r.name.TextColor3 = owned and Kit.Colors.GoldLight or Kit.Colors.White
		r.value.Text = Format.Value(f.Value)
		r.icon.BackgroundColor3 = Kit.TierColor(f.Tier)
	end
end

------------------------------------------------------------------------------
-- Gauge marker, find markers, undug shroud
------------------------------------------------------------------------------
local function buildGauge()
	local anchor = waitTagged("DepthGauge")
	local angle = math.rad(anchor and anchor:GetAttribute("Angle") or -52)
	WorldView.LadderAngle = angle
	markerPart = New("Part", {
		Name = "DepthMarker",
		Anchored = true,
		CanCollide = false,
		CanQuery = false,
		Material = Enum.Material.Neon,
		Color = Kit.Colors.GoldLight,
		Size = Vector3.new(4.2, 0.5, 1.2),
		Parent = workspace,
	})
	New("PointLight", { Color = Kit.Colors.GoldLight, Range = 14, Brightness = 2.5, Parent = markerPart })
	-- Undug shroud: one dark disc per stratum band below the marker.
	for _, band in Strata.Bands do
		if not band.Hidden then
			local disc = New("Part", {
				Name = "Undug_" .. band.Id,
				Anchored = true,
				CanCollide = false,
				CanQuery = false,
				CastShadow = false,
				Shape = Enum.PartType.Cylinder,
				Material = Enum.Material.SmoothPlastic,
				Color = Color3.fromRGB(8, 8, 14),
				Transparency = 0.06,
				Size = Vector3.new(1, band.Radius * 2 - 0.4, band.Radius * 2 - 0.4),
				Parent = workspace,
			})
			shroudParts[band.Id] = disc
		end
	end
end

local function placementPosition(fraction, side)
	local y = HoleMath.FractionToY(fraction)
	local r = HoleMath.RadiusAtY(y - 0.1) - 0.3
	local a = (WorldView.LadderAngle or 0) + side
	return Vector3.new(math.cos(a) * r, y, math.sin(a) * r)
end

local function rebuildFindMarkers()
	for _, m in findMarkers do
		m:Destroy()
	end
	table.clear(findMarkers)
	local target = State.Hole.Target
	for _, pl in State.Hole.Placements or {} do
		local f = Catalog.FindsById[pl.FindId]
		local side = (pl.Index % 2 == 0) and 0.09 or -0.09
		local glint = New("Part", {
			Name = "FindGlint",
			Anchored = true,
			CanCollide = false,
			CanQuery = false,
			Material = Enum.Material.Neon,
			Shape = Enum.PartType.Ball,
			Color = Kit.TierColor(f and f.Tier or 1),
			Size = Vector3.new(0.9, 0.9, 0.9),
			Transparency = pl.Unearthed and 0.85 or 0.1,
			Position = placementPosition(pl.Depth / target, side),
			Parent = workspace,
		})
		glint:SetAttribute("FindIndex", pl.Index)
		findMarkers[pl.Index] = glint
	end
end

local function updateHoleVisuals()
	local fraction = State.Fraction()
	local markerY = HoleMath.FractionToY(fraction)
	if markerPart then
		local a = WorldView.LadderAngle or 0
		local r = HoleMath.RadiusAtY(markerY - 0.1) - 1
		markerPart.CFrame = CFrame.lookAt(Vector3.new(math.cos(a) * r, markerY, math.sin(a) * r), Vector3.new(0, markerY, 0))
	end
	for _, band in Strata.Bands do
		local disc = shroudParts[band.Id]
		if disc then
			-- shroud covers the band from the marker (or band top) to its bottom
			local top = math.min(band.YTop, markerY)
			local height = top - band.YBottom
			if height <= 0.05 or State.ShowcaseOverride then
				disc.Transparency = 1
			else
				disc.Transparency = 0.06
				disc.Size = Vector3.new(height, disc.Size.Y, disc.Size.Z)
				disc.CFrame = CFrame.new(0, band.YBottom + height / 2, 0) * CFrame.Angles(0, 0, math.rad(90))
			end
		end
	end
end

local function relabelPlaques()
	for _, plaque in CollectionService:GetTagged("GaugePlaque") do
		local percent = plaque:GetAttribute("Percent") or 0
		local gui = plaque:FindFirstChildOfClass("SurfaceGui")
		local label = gui and gui:FindFirstChildWhichIsA("TextLabel")
		if label then
			label.Text = Format.Short(State.Hole.Target * percent / 100) .. " m"
		end
	end
end

------------------------------------------------------------------------------
-- Artifacts hall and relic
------------------------------------------------------------------------------
local showpieces = {}
local function refreshArtifacts()
	for _, s in showpieces do
		s:Destroy()
	end
	table.clear(showpieces)
	local Showpiece = require(script.Parent.Parent.Spectacle.FindModels)
	for _, pedestal in CollectionService:GetTagged("ArtifactPedestal") do
		local index = pedestal:GetAttribute("Index")
		local entry = State.Artifacts[index]
		if entry then
			local model = Showpiece.Build(entry.FindId, entry.Found)
			model:PivotTo(pedestal.CFrame * CFrame.new(0, 3.2, 0))
			model.Parent = workspace
			local label = New("BillboardGui", { Size = UDim2.fromOffset(160, 40), StudsOffset = Vector3.new(0, 4.5, 0), MaxDistance = 80, Parent = model.PrimaryPart })
			local f = Catalog.FindsById[entry.FindId]
			Kit.Label({ Text = entry.Found and (f.Name .. "\n" .. Format.Value(f.Value)) or ("Reach " .. Format.ExactMetres(entry.Depth)), Color = entry.Found and Kit.Colors.GoldLight or Kit.Colors.Dim, Stroke = Kit.Colors.Slate, Parent = label })
			table.insert(showpieces, model)
		end
	end
end

local function animateShowcase(dt, t)
	for i, model in showpieces do
		if model.PrimaryPart then
			local base = model:GetAttribute("Base")
			if not base then
				model:SetAttribute("Base", model:GetPivot())
				base = model:GetPivot()
			end
			model:PivotTo(base * CFrame.new(0, math.sin(t * 2 + i) * 0.25, 0) * CFrame.Angles(0, t * 0.8 + i, 0))
		end
	end
	local fill = math.clamp((State.Pool.Value or 0) / math.max(1, State.Pool.Fill or 2500), 0, 1)
	for _, ring in CollectionService:GetTagged("PoolRing") do
		local base = ring:GetAttribute("BasePivot")
		if not base then
			ring:SetAttribute("BasePivot", ring:GetPivot())
			base = ring:GetPivot()
		end
		local tilt = ring:GetAttribute("Tilt") or Vector3.new(70, 0, 0)
		local speed = 0.4 + fill * 3.5
		local dir = ring:GetAttribute("Ring") == 2 and -1 or 1
		ring:PivotTo(CFrame.new(base.Position) * CFrame.Angles(math.rad(tilt.X), math.rad(tilt.Y), math.rad(tilt.Z)) * CFrame.Angles(0, t * speed * dir, 0))
	end
	local orb = tagged("PoolRelic")
	if orb then
		local part = orb:IsA("Model") and orb.PrimaryPart or orb:FindFirstChildWhichIsA("BasePart", true)
		local light = part and part:FindFirstChildOfClass("PointLight")
		if light then
			light.Brightness = 1.5 + fill * 4 + math.sin(t * 3) * 0.3
		end
	end
end

------------------------------------------------------------------------------
-- Lighting per stratum (camera depth) and showcase
------------------------------------------------------------------------------
local cc, bloom
local function lightingFor(y)
	local band = Strata.AtY(y)
	return band and band.Lighting or Strata.Surface
end

local function updateLighting(dt)
	cc = cc or Lighting:FindFirstChildOfClass("ColorCorrectionEffect")
	bloom = bloom or Lighting:FindFirstChildOfClass("BloomEffect")
	local camera = workspace.CurrentCamera
	local inHole = camera.CFrame.Position.Y < -2 and Vector3.new(camera.CFrame.Position.X, 0, camera.CFrame.Position.Z).Magnitude < Config.Hole.TopRadiusStuds
	local preset = inHole and lightingFor(camera.CFrame.Position.Y) or Strata.Surface
	local k = math.min(1, dt * 2)
	if cc then
		cc.TintColor = cc.TintColor:Lerp(preset.Tint, k)
		cc.Saturation += (preset.Saturation - cc.Saturation) * k
		cc.Contrast += (preset.Contrast - cc.Contrast) * k
	end
	if bloom and not WorldView.BloomOverride then
		bloom.Intensity += (preset.Bloom - bloom.Intensity) * k
	end
	Lighting.Ambient = Lighting.Ambient:Lerp(preset.Ambient, k)
end

function WorldView.SetShowcase(on: boolean)
	State.ShowcaseOverride = on and 0.95 or nil
	for _, l in showcaseLights do
		l.Enabled = on
	end
	if on and #showcaseLights == 0 then
		for _, band in Strata.Bands do
			local p = New("Part", { Anchored = true, CanCollide = false, CanQuery = false, Transparency = 1, Size = Vector3.one, Position = Vector3.new(0, (band.YTop + band.YBottom) / 2, 0), Parent = workspace })
			table.insert(showcaseLights, New("PointLight", { Range = band.Radius + 14, Brightness = 1.2, Color = band.Accent:Lerp(Color3.new(1, 1, 1), 0.5), Parent = p }))
		end
	end
end

function WorldView.MarkerPosition()
	return markerPart and markerPart.Position or Vector3.new(0, 0, 0)
end

function WorldView.Start()
	task.spawn(buildDepthSign)
	task.spawn(function()
		buildBoard("BoardTopDiggers", "Top Diggers", "Diggers")
		refreshDiggers()
	end)
	task.spawn(function()
		buildBoard("BoardFinds", "Most Valuable Finds", "Finds")
		refreshFinds()
	end)
	buildGauge()
	rebuildFindMarkers()
	relabelPlaques()
	task.spawn(refreshArtifacts)
	State.BoardsChanged:Connect(refreshDiggers)
	State.ProfileChanged:Connect(refreshFinds)
	State.HoleEvent:Connect(function(event)
		if event.Type == "Cycle" then
			rebuildFindMarkers()
			relabelPlaques()
			State.Artifacts = {}
			refreshArtifacts()
		elseif event.Type == "Find" then
			local glint = findMarkers[event.Index]
			if glint then
				glint.Transparency = 0.85
			end
			refreshArtifacts()
		end
	end)
	task.spawn(function()
		while true do
			task.wait((State.Boards and State.Boards.CycleSeconds) or 12)
			boardMode = boardMode == "ThisHole" and "AllTime" or "ThisHole"
			refreshDiggers()
		end
	end)
	local t = 0
	RunService.RenderStepped:Connect(function(dt)
		t += dt
		updateHoleVisuals()
		animateShowcase(dt, t)
		updateLighting(dt)
		if depthSign.depth then
			depthSign.depth.Text = Format.Metres(State.DisplayDepth, State.DisplayDepth < 1000)
			depthSign.target.Text = "/ " .. Format.Commas(State.Hole.Target) .. " m"
			depthSign.fill.Size = UDim2.fromScale(State.Fraction(), 1)
		end
	end)
end

return WorldView
