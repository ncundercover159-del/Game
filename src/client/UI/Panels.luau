--[[
	Panels: Collection (+ Find Map + Season), Recent Purchases, Daily reward,
	Settings and the Studio test-mode Debug panel. One panel is open at a
	time; all are generated from Catalog / SeasonRewards / State.
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Catalog = require(Shared.Catalog)
local Config = require(Shared.Config)
local SeasonRewards = require(Shared.SeasonRewards)
local Format = require(Shared.Util.Format)
local Net = require(Shared.Net)

local Kit = require(script.Parent.Kit)
local State = require(script.Parent.Parent.State)

local New = Kit.New
local Panels = {}

local gui
local open -- current panel frame
Panels.Settings = { Quality = "Auto", Shake = true, AutoSkipOwn = false, Volume = 0.8 }
Panels.OnSetting = nil
Panels.OnDebugLocal = nil -- ReferenceCamera etc. handled by Main

local function close()
	if open then
		open:Destroy()
		open = nil
	end
end
Panels.Close = close

local function frame(title, accent)
	close()
	local f, face = Kit.Panel({ Size = UDim2.new(0.86, 0, 0.82, 0), Position = UDim2.fromScale(0.5, 0.54), Anchor = Vector2.new(0.5, 0.5), Accent = accent or Kit.Colors.Gold, ZIndex = 10, Parent = gui })
	New("UISizeConstraint", { MaxSize = Vector2.new(1000, 720) }).Parent = f
	Kit.Label({ Text = title, Display = true, Color = Kit.Colors.GoldLight, Stroke = Kit.Colors.GoldDark, StrokeSize = 3, Size = UDim2.new(1, -90, 0, 40), Position = UDim2.fromOffset(16, 8), AlignX = Enum.TextXAlignment.Left, ZIndex = 11, MaxTextSize = 32, Parent = face })
	Kit.Button({ Text = "✕", Style = "Red", Size = UDim2.fromOffset(52, 52), Position = UDim2.new(1, -8, 0, 6), Anchor = Vector2.new(1, 0), ZIndex = 12, Parent = face, OnClick = close })
	open = f
	Kit.Pop(f)
	return face
end

local function list(face, top)
	return New("ScrollingFrame", {
		BackgroundTransparency = 1,
		Size = UDim2.new(1, -16, 1, -(top + 8)),
		Position = UDim2.fromOffset(8, top),
		CanvasSize = UDim2.new(),
		AutomaticCanvasSize = Enum.AutomaticSize.Y,
		ScrollBarThickness = 8,
		ZIndex = 11,
		Parent = face,
	}, { New("UIListLayout", { Padding = UDim.new(0, 6), SortOrder = Enum.SortOrder.LayoutOrder }) })
end

local function row(parent, height, order, color)
	return New("Frame", { BackgroundColor3 = color or Kit.Colors.SlateLight, Size = UDim2.new(1, -8, 0, height), LayoutOrder = order, ZIndex = 11, Parent = parent }, { Kit.Corner(10) })
end

local function text(parent, t, pos, size, color, alignRight, display)
	return Kit.Label({ Text = t, Position = pos, Size = size, Color = color, AlignX = alignRight and Enum.TextXAlignment.Right or Enum.TextXAlignment.Left, Display = display, ZIndex = 12, MaxTextSize = 18, Parent = parent })
end

local function tabs(face, names, onPick, active)
	local bar = New("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, -16, 0, 46), Position = UDim2.fromOffset(8, 54), ZIndex = 11, Parent = face }, {
		New("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 6) }),
	})
	for _, name in names do
		Kit.Button({ Text = name, Style = name == active and "Gold" or "Slate", Size = UDim2.fromOffset(160, 44), ZIndex = 12, MaxTextSize = 18, Parent = bar, OnClick = function()
			onPick(name)
		end })
	end
end

------------------------------------------------------------------------------
-- Collection / Find Map / Season
------------------------------------------------------------------------------
function Panels.Collection(tab)
	tab = tab or "Collection"
	local face = frame(tab == "Find Map" and "FIND MAP" or (tab == "Season" and "SEASON" or "COLLECTION"))
	tabs(face, { "Collection", "Find Map", "Season" }, Panels.Collection, tab)
	local p = State.Profile
	if tab == "Collection" then
		Net.Event("Analytics"):FireServer("CollectionOpened", nil, nil, "HUD")
		local types, total = 0, 0
		for _, f in Catalog.Finds do
			if p and (p.Collection[f.Id] or 0) > 0 then
				types += 1
			end
		end
		total = p and p.CollectionValue or 0
		text(face, string.format("Total Collection Value: %s   ·   Found %d / %d types", Format.Value(total), types, #Catalog.Finds), UDim2.fromOffset(16, 104), UDim2.new(1, -32, 0, 28), Kit.Colors.Cream)
		local grid = New("ScrollingFrame", { BackgroundTransparency = 1, Size = UDim2.new(1, -16, 1, -150), Position = UDim2.fromOffset(8, 140), CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y, ScrollBarThickness = 8, ZIndex = 11, Parent = face }, {
			New("UIGridLayout", { CellSize = UDim2.fromOffset(150, 120), CellPadding = UDim2.fromOffset(8, 8) }),
		})
		for _, f in Catalog.FindsByValue do
			local count = p and p.Collection[f.Id] or 0
			local cell = New("Frame", { BackgroundColor3 = Kit.Colors.SlateLight, ZIndex = 11, Parent = grid }, { Kit.Corner(10), Kit.Stroke(Kit.TierColor(f.Tier), 2, count > 0 and 0 or 0.7) })
			local icon = Kit.Icon(f, UDim2.fromOffset(52, 52), cell, true)
			icon.Position = UDim2.new(0.5, -26, 0, 6)
			if count == 0 then
				icon.BackgroundTransparency = 0.7
			end
			Kit.Label({ Text = count > 0 and f.Name or "???", Size = UDim2.new(1, -8, 0, 20), Position = UDim2.fromOffset(4, 62), ZIndex = 12, MaxTextSize = 15, Parent = cell })
			Kit.Label({ Text = Format.Value(f.Value) .. (count > 0 and ("  x" .. count) or ""), Color = Kit.TierColor(f.Tier), Size = UDim2.new(1, -8, 0, 18), Position = UDim2.fromOffset(4, 84), ZIndex = 12, MaxTextSize = 14, Parent = cell })
		end
	elseif tab == "Find Map" then
		Net.Event("Analytics"):FireServer("FindMapOpened", nil, nil, "Collection")
		local h = State.Hole
		text(face, string.format("Hole #%d  ·  Seed %d  ·  Target %s  ·  Marker at %s", h.Cycle, h.Seed or 0, Format.ExactMetres(h.Target), Format.Metres(State.DisplayDepth, true)), UDim2.fromOffset(16, 104), UDim2.new(1, -32, 0, 26), Kit.Colors.Cream)
		text(face, "Every find's depth is fixed by this hole's public seed. Robux only moves the marker by the exact metres shown.", UDim2.fromOffset(16, 130), UDim2.new(1, -32, 0, 20), Kit.Colors.Dim)
		local l = list(face, 156)
		for i, pl in h.Placements or {} do
			local f = Catalog.FindsById[pl.FindId]
			local r = row(l, 34, i, pl.Unearthed and Color3.fromRGB(34, 60, 44) or Kit.Colors.SlateLight)
			text(r, Format.ExactMetres(pl.Depth), UDim2.fromOffset(10, 4), UDim2.new(0.2, 0, 1, -8), Kit.Colors.Cream)
			text(r, f and f.Name or pl.FindId, UDim2.new(0.22, 0, 0, 4), UDim2.new(0.38, 0, 1, -8), Kit.TierColor(f and f.Tier or 1))
			text(r, pl.Unearthed and ("✓ found by " .. (pl.FinderName or "?")) or "◌ buried", UDim2.new(0.6, 0, 0, 4), UDim2.new(0.38, 0, 1, -8), pl.Unearthed and Kit.Colors.Green or Kit.Colors.Dim, true)
		end
	else
		Net.Event("Analytics"):FireServer("SeasonOpened", nil, nil, "Collection")
		local season = p and p.Season or { XP = 0, Premium = false, ClaimedFree = {}, ClaimedPremium = {} }
		local tier = math.clamp(math.floor(season.XP / Config.Season.XPPerTier), 0, Config.Season.Tiers)
		text(face, string.format("%s  ·  Tier %d / %d  ·  %d XP  ·  Premium: %s", Config.Season.Name, tier, Config.Season.Tiers, season.XP, season.Premium and "unlocked" or "locked"), UDim2.fromOffset(16, 104), UDim2.new(1, -32, 0, 26), Kit.Colors.Cream)
		text(face, "Season XP comes from free play. Season Pass R$ 799 and Tier Skip R$ 49 per tier are in Store > Passes & Club. No Shards on either track.", UDim2.fromOffset(16, 130), UDim2.new(1, -32, 0, 20), Kit.Colors.Dim)
		local l = list(face, 156)
		for t = 1, Config.Season.Tiers do
			local r = row(l, 40, t, t <= tier and Color3.fromRGB(40, 56, 40) or Kit.Colors.SlateLight)
			text(r, "Tier " .. t, UDim2.fromOffset(10, 6), UDim2.new(0.14, 0, 1, -12), Kit.Colors.GoldLight, false, true)
			for col, track in { "Free", "Premium" } do
				local itemId = (track == "Free" and SeasonRewards.Free or SeasonRewards.Premium)[t]
				local x = col == 1 and 0.16 or 0.58
				if itemId then
					local item = Catalog.Get(itemId)
					local claimed = (track == "Free" and season.ClaimedFree or season.ClaimedPremium)[tostring(t)]
					text(r, track .. ": " .. (item and item.Name or itemId), UDim2.new(x, 0, 0, 6), UDim2.new(0.28, 0, 1, -12), Kit.Colors.White)
					if claimed then
						text(r, "Claimed", UDim2.new(x + 0.28, 0, 0, 6), UDim2.new(0.12, 0, 1, -12), Kit.Colors.Green)
					elseif t <= tier and (track == "Free" or season.Premium) then
						Kit.Button({ Text = "Claim", Style = "Green", Size = UDim2.new(0.11, 0, 1, -8), Position = UDim2.new(x + 0.29, 0, 0, 4), ZIndex = 13, MaxTextSize = 16, Parent = r, OnClick = function()
							Net.Function("ClaimSeason"):InvokeServer(track, t)
							task.wait(0.4)
							Panels.Collection("Season")
						end })
					end
				else
					text(r, track .. ": —", UDim2.new(x, 0, 0, 6), UDim2.new(0.28, 0, 1, -12), Kit.Colors.Dim)
				end
			end
		end
	end
end

------------------------------------------------------------------------------
-- Recent Purchases
------------------------------------------------------------------------------
function Panels.Recent()
	local face = frame("RECENT PURCHASES")
	Net.Event("Analytics"):FireServer("RecentPurchasesOpened", nil, nil, "HUD")
	text(face, "Your last 20 purchases: item, exact price and what you received.", UDim2.fromOffset(16, 54), UDim2.new(1, -32, 0, 24), Kit.Colors.Dim)
	local l = list(face, 84)
	local items = State.Profile and State.Profile.RecentPurchases or {}
	if #items == 0 then
		text(l, "Nothing yet.", UDim2.new(), UDim2.new(1, 0, 0, 30), Kit.Colors.Dim)
	end
	for i, e in items do
		local r = row(l, 58, i)
		local when = os.date("!%d %b %H:%M", e.T or 0)
		text(r, string.format("%s%s", e.Name or e.Id, e.To and ("  → gift to " .. e.To) or ""), UDim2.fromOffset(10, 4), UDim2.new(0.7, 0, 0, 24), Kit.Colors.White)
		text(r, Format.Robux(e.Price or 0) .. (e.Test and " (test)" or ""), UDim2.new(0.7, 0, 0, 4), UDim2.new(0.3, -10, 0, 24), Kit.Colors.GoldLight, true)
		text(r, (e.Received or "") .. "  ·  " .. when .. " UTC", UDim2.fromOffset(10, 30), UDim2.new(1, -20, 0, 22), Kit.Colors.Cream)
	end
end

------------------------------------------------------------------------------
-- Daily reward
------------------------------------------------------------------------------
function Panels.Daily()
	local face = frame("DAILY REWARD")
	local p = State.Profile
	local streak = p and p.Daily and p.Daily.Streak or 0
	text(face, string.format("Streak: %d day(s). Day 7 repeats. Metres go into THIS server's hole.", streak), UDim2.fromOffset(16, 54), UDim2.new(1, -32, 0, 26), Kit.Colors.Cream)
	local l = list(face, 90)
	for d = 1, 7 do
		local r = row(l, 40, d, d == math.min(streak + 1, 7) and Color3.fromRGB(60, 70, 40) or nil)
		text(r, string.format("Day %d:  +%d m, %d Shards, %d Season XP", d, Config.Free.Daily.Metres[d], Config.Free.Daily.Shards[d], Config.Free.Daily.XP[d]), UDim2.fromOffset(10, 6), UDim2.new(1, -20, 1, -12), Kit.Colors.White)
	end
	Kit.Button({ Text = "Claim today's reward", Style = "Green", Size = UDim2.fromOffset(280, 56), Position = UDim2.new(0.5, 0, 1, -12), Anchor = Vector2.new(0.5, 1), ZIndex = 13, Parent = face, OnClick = function()
		local res = Net.Function("ClaimDaily"):InvokeServer()
		if res then
			State.Notify:Fire({ Text = res.ok and string.format("Day %d reward: +%s, +%d Shards!", res.streak, Format.Metres(res.metres, true), res.shards) or res.reason })
		end
		close()
	end })
end

------------------------------------------------------------------------------
-- Settings
------------------------------------------------------------------------------
function Panels.SettingsPanel()
	local face = frame("SETTINGS")
	local l = list(face, 60)
	local s = Panels.Settings
	local function toggle(order, label, get, set)
		local r = row(l, 50, order)
		text(r, label, UDim2.fromOffset(12, 8), UDim2.new(0.6, 0, 1, -16), Kit.Colors.White)
		Kit.Button({ Text = get(), Style = "Slate", Size = UDim2.new(0.34, 0, 1, -10), Position = UDim2.new(0.64, 0, 0, 5), ZIndex = 13, MaxTextSize = 18, Parent = r, OnClick = function()
			set()
			if Panels.OnSetting then
				Panels.OnSetting(s)
			end
			Panels.SettingsPanel()
		end })
	end
	local qualities = { "Auto", "Low", "Medium", "High" }
	toggle(1, "Effects quality", function()
		return s.Quality
	end, function()
		s.Quality = qualities[(table.find(qualities, s.Quality) or 1) % #qualities + 1]
	end)
	toggle(2, "Camera shake", function()
		return s.Shake and "On" or "Off"
	end, function()
		s.Shake = not s.Shake
	end)
	toggle(3, "Skip my dig cinematics", function()
		return s.AutoSkipOwn and "On" or "Off"
	end, function()
		s.AutoSkipOwn = not s.AutoSkipOwn
	end)
	toggle(4, "Sound volume", function()
		return string.format("%d%%", s.Volume * 100)
	end, function()
		s.Volume = (s.Volume >= 1) and 0 or math.min(1, s.Volume + 0.2)
	end)
	if State.Owns("namecolor") then
		toggle(5, "Name colour", function()
			return tostring(State.Profile.NameColor or 0)
		end, function()
			Net.Function("SetPreference"):InvokeServer("NameColor", ((State.Profile.NameColor or 0) + 1) % 11)
		end)
	end
	if State.Owns("flag_personal") then
		toggle(6, "Rim flag design", function()
			return tostring(State.Profile.FlagDesign or 1)
		end, function()
			Net.Function("SetPreference"):InvokeServer("FlagDesign", (State.Profile.FlagDesign or 1) % 8 + 1)
		end)
	end
end

------------------------------------------------------------------------------
-- Debug (Studio test mode only)
------------------------------------------------------------------------------
function Panels.Debug()
	if not State.TestMode then
		return
	end
	local face = frame("TEST MODE DEBUG", Kit.Colors.Red)
	local out = text(face, "Server replies appear here.", UDim2.fromOffset(16, 52), UDim2.new(1, -32, 0, 44), Kit.Colors.Cream)
	local grid = New("ScrollingFrame", { BackgroundTransparency = 1, Size = UDim2.new(1, -16, 1, -110), Position = UDim2.fromOffset(8, 100), CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y, ScrollBarThickness = 8, ZIndex = 11, Parent = face }, {
		New("UIGridLayout", { CellSize = UDim2.fromOffset(196, 46), CellPadding = UDim2.fromOffset(6, 6) }),
	})
	local function cmd(label, command, arg)
		Kit.Button({ Text = label, Style = "Slate", ZIndex = 13, MaxTextSize = 15, Display = false, Parent = grid, OnClick = function()
			local res = Net.Function("Debug"):InvokeServer(command, { arg })
			out.Text = res and (res.ok and tostring(res.result) or ("Error: " .. tostring(res.reason))) or "no reply"
		end })
	end
	local function localCmd(label, name)
		Kit.Button({ Text = label, Style = "Gold", ZIndex = 13, MaxTextSize = 15, Display = false, Parent = grid, OnClick = function()
			if Panels.OnDebugLocal then
				out.Text = Panels.OnDebugLocal(name) or name
			end
		end })
	end
	localCmd("ReferenceCamera", "ReferenceCamera")
	localCmd("Fly camera: rim → core", "FlyDown")
	localCmd("Exit camera", "ExitCamera")
	cmd("+100 m", "AddMetres", 100)
	cmd("+1,000 m", "AddMetres", 1000)
	cmd("Jump to 50%", "JumpPercent", 50)
	cmd("Jump to 90%", "JumpPercent", 90)
	cmd("Dig to next find", "TriggerFind")
	cmd("Trigger bottom", "TriggerBottom")
	cmd("20 simultaneous digs", "SimultaneousDigs", 20)
	cmd("Reset hole", "ResetHole")
	cmd("Fire ALL 11 sequences", "FireAll")
	for _, id in Catalog.DigOrder do
		cmd("Fire " .. Catalog.Get(id).Name, "FireSequence", id)
	end
	cmd("Replay last purchase", "ReplayPurchase")
	cmd("+500 Shards", "GrantShards", 500)
	cmd("Next day", "NextDay")
	cmd("Expire boosts", "ExpireBoosts")
	cmd("Fill Dig Pool", "FillPool")
	cmd("Toggle Club", "ToggleClub")
	cmd("Fake contributors", "FakeContributors", 8)
	cmd("Save now", "SaveNow")
	cmd("Wipe profile", "WipeProfile")
	cmd("Status", "Status")
end

function Panels.Start(screen)
	gui = screen
end

return Panels
