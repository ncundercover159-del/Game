--[[
	HUD: Server Depth pill (top centre, counting, flare on big jumps, strata
	icons), live feed (tier-coloured rows for big digs), the always-visible
	DIG button (bottom-right, thumb reachable), menu buttons, boost timers
	(plain information), Dig Energy, toasts, the daily reward button and the
	single dismissible Starter Pack badge. Chat announcements for big tiers.
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TextChatService = game:GetService("TextChatService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Catalog = require(Shared.Catalog)
local Strata = require(Shared.Strata)
local Format = require(Shared.Util.Format)
local Net = require(Shared.Net)

local Kit = require(script.Parent.Parent.UI.Kit)
local State = require(script.Parent.Parent.State)

local New = Kit.New
local HUD = {}

local gui
local depthLabel, targetLabel, barFill, flare, stratumLabel
local feedFrame
local boostRow, energyBar, energyLabel
local toastHolder
HUD.Open = nil -- set by Main: function(panelName, opts)

local function feedRow(entry)
	local tierColor = Kit.TierColor(entry.Tier or 1)
	local big = (entry.Tier or 1) >= 4
	local row = New("Frame", {
		BackgroundColor3 = big and tierColor or Kit.Colors.Slate,
		BackgroundTransparency = big and 0.15 or 0.25,
		Size = UDim2.new(1, 0, 0, big and 34 or 28),
		Parent = feedFrame,
	}, { Kit.Corner(10), Kit.Stroke(tierColor, big and 2 or 1, 0.3) })
	Kit.Label({
		Text = entry.Text,
		AlignX = Enum.TextXAlignment.Left,
		Size = UDim2.new(1, -16, 1, -6),
		Position = UDim2.fromOffset(10, 3),
		Color = big and Kit.Colors.Slate or Kit.Colors.White,
		MaxTextSize = big and 18 or 15,
		Parent = row,
	})
	Kit.Pop(row)
	task.delay(big and 12 or 8, function()
		if row.Parent then
			Kit.Tween(row, 0.6, { BackgroundTransparency = 1 })
			for _, d in row:GetDescendants() do
				if d:IsA("TextLabel") then
					Kit.Tween(d, 0.6, { TextTransparency = 1 })
				elseif d:IsA("UIStroke") then
					Kit.Tween(d, 0.6, { Transparency = 1 })
				end
			end
			task.wait(0.7)
			row:Destroy()
		end
	end)
	local rows = {}
	for _, child in feedFrame:GetChildren() do
		if child:IsA("Frame") then
			table.insert(rows, child)
		end
	end
	if #rows > 5 then
		rows[1]:Destroy()
	end
	if entry.Announce then
		pcall(function()
			local channel = TextChatService:WaitForChild("TextChannels", 2):FindFirstChild("RBXGeneral")
			if channel then
				channel:DisplaySystemMessage(string.format('<font color="#F7C64B"><b>%s</b></font>', entry.Text))
			end
		end)
	end
end

function HUD.Toast(text: string, color: Color3?)
	local toast = New("Frame", {
		BackgroundColor3 = Kit.Colors.Slate,
		Size = UDim2.new(1, 0, 0, 40),
		Parent = toastHolder,
	}, { Kit.Corner(12), Kit.Stroke(color or Kit.Colors.Gold, 2) })
	Kit.Label({ Text = text, Size = UDim2.new(1, -16, 1, -8), Position = UDim2.fromOffset(8, 4), MaxTextSize = 18, Parent = toast })
	Kit.Pop(toast)
	task.delay(4.5, function()
		toast:Destroy()
	end)
end

-- "+N m" pop-up near the depth pill.
function HUD.MetresPop(text: string, color: Color3?)
	local label = Kit.Label({
		Text = text,
		Display = true,
		Color = color or Kit.Colors.GoldLight,
		Stroke = Kit.Colors.GoldDark,
		StrokeSize = 2,
		Size = UDim2.fromOffset(200, 40),
		Position = UDim2.new(0.5, math.random(-80, 80), 0, 84),
		Anchor = Vector2.new(0.5, 0),
		Parent = gui,
	})
	Kit.Pop(label)
	Kit.Tween(label, 1.4, { Position = label.Position - UDim2.fromOffset(0, 40), TextTransparency = 1 })
	task.delay(1.5, function()
		label:Destroy()
	end)
end

local function buildDepthPill()
	local pill, face = Kit.Panel({
		Name = "DepthPill",
		Size = UDim2.fromOffset(420, 78),
		Position = UDim2.new(0.5, 0, 0, 6),
		Anchor = Vector2.new(0.5, 0),
		Radius = 22,
		Accent = Kit.Colors.Gold,
		Parent = gui,
	})
	Kit.Label({ Text = "SERVER DEPTH", Size = UDim2.new(0.4, 0, 0, 18), Position = UDim2.fromOffset(14, 4), AlignX = Enum.TextXAlignment.Left, Color = Kit.Colors.Cream, MaxTextSize = 14, Parent = face })
	stratumLabel = Kit.Label({ Text = "Topsoil", Size = UDim2.new(0.5, -14, 0, 18), Position = UDim2.new(0.5, 0, 0, 4), AlignX = Enum.TextXAlignment.Right, Color = Kit.Colors.Cyan, MaxTextSize = 14, Parent = face })
	depthLabel = Kit.Label({
		Text = "0.0 m",
		Display = true,
		Color = Kit.Colors.GoldLight,
		Stroke = Kit.Colors.GoldDark,
		StrokeSize = 2,
		Size = UDim2.new(0.62, 0, 0, 32),
		Position = UDim2.fromOffset(12, 20),
		AlignX = Enum.TextXAlignment.Left,
		MaxTextSize = 30,
		Parent = face,
	})
	targetLabel = Kit.Label({ Text = "/ 10,000 m", Size = UDim2.new(0.36, -12, 0, 24), Position = UDim2.new(0.64, 0, 0, 24), AlignX = Enum.TextXAlignment.Right, Color = Kit.Colors.White, MaxTextSize = 20, Parent = face })
	local bar = New("Frame", { BackgroundColor3 = Color3.fromRGB(12, 14, 24), Size = UDim2.new(1, -24, 0, 10), Position = UDim2.new(0, 12, 1, -14), Parent = face }, { Kit.Corner(5) })
	-- strata bands as coloured segments behind the fill
	for _, band in Strata.Bands do
		New("Frame", {
			BackgroundColor3 = band.Color,
			BackgroundTransparency = 0.55,
			BorderSizePixel = 0,
			Size = UDim2.fromScale(band.To - band.From, 1),
			Position = UDim2.fromScale(band.From, 0),
			Parent = bar,
		})
	end
	barFill = New("Frame", { BackgroundColor3 = Kit.Colors.Gold, Size = UDim2.fromScale(0, 1), Parent = bar }, { Kit.Corner(5), Kit.Gradient({ Kit.Colors.GoldLight, Kit.Colors.Gold }, 0) })
	flare = New("Frame", { BackgroundColor3 = Kit.Colors.GoldLight, BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), ZIndex = 5, Parent = pill }, { Kit.Corner(22) })
	pill:SetAttribute("Flare", true)
end

local function buildDigButton()
	local size = Kit.IsTouch and 112 or 100
	local button = Kit.Button({
		Name = "DigButton",
		Text = "DIG!",
		Size = UDim2.fromOffset(size, size),
		Position = Kit.IsTouch and UDim2.new(1, -18, 0.58, 0) or UDim2.new(1, -24, 1, -24),
		Anchor = Kit.IsTouch and Vector2.new(1, 0.5) or Vector2.new(1, 1),
		Radius = size // 2,
		MaxTextSize = 34,
		Parent = gui,
		OnClick = function()
			HUD.Open("Store", { Surface = "DigButton" })
		end,
	})
	-- gentle idle bob so the DIG button reads as the main action (no pressure text)
	local scale = button:FindFirstChildOfClass("UIScale")
	task.spawn(function()
		while button.Parent do
			Kit.Tween(scale, 0.9, { Scale = 1.04 }, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut)
			task.wait(0.9)
			Kit.Tween(scale, 0.9, { Scale = 1 }, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut)
			task.wait(0.9)
		end
	end)
	return button
end

local function buildMenu()
	local holder = New("Frame", {
		BackgroundTransparency = 1,
		Size = UDim2.fromOffset(300, 56),
		Position = UDim2.new(1, -10, 0, 8),
		Anchor = Vector2.new(1, 0),
		Parent = gui,
	}, {
		New("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, HorizontalAlignment = Enum.HorizontalAlignment.Right, Padding = UDim.new(0, 6), SortOrder = Enum.SortOrder.LayoutOrder }),
	})
	local items = {
		{ "Collection", "💎", "Collection" },
		{ "Season", "🎟", "Season" },
		{ "Recent", "📜", "Recent" },
		{ "Daily", "🎁", "Daily" },
		{ "Settings", "⚙", "Settings" },
	}
	for i, it in items do
		Kit.Button({
			Name = it[1],
			Text = it[2],
			Style = "Slate",
			Size = UDim2.fromOffset(52, 52),
			LayoutOrder = i,
			Parent = holder,
			OnClick = function()
				HUD.Open(it[3], { Surface = "HUD" })
			end,
		})
	end
	if State.TestMode then
		Kit.Button({ Name = "Debug", Text = "🛠", Style = "Red", Size = UDim2.fromOffset(52, 52), LayoutOrder = 9, Parent = holder, OnClick = function()
			HUD.Open("Debug", {})
		end })
	end
end

local starterBadge
local function buildStarterBadge()
	local p = State.Profile
	if starterBadge or not p or p.Owned.starter_pack or (p.Flags and p.Flags.StarterBadgeDismissed) then
		return
	end
	local item = Catalog.Get("starter_pack")
	starterBadge = New("Frame", {
		BackgroundTransparency = 1,
		Size = UDim2.fromOffset(170, 44),
		Position = Kit.IsTouch and UDim2.new(1, -18, 0.58, -96) or UDim2.new(1, -24, 1, -136),
		Anchor = Vector2.new(1, 1),
		Parent = gui,
	})
	Kit.Button({ Text = "🎁 Starter Pack R$ " .. item.Price, Style = "Green", Size = UDim2.new(1, -40, 1, 0), MaxTextSize = 16, Display = false, Parent = starterBadge, OnClick = function()
		HUD.Open("Store", { Tab = "Passes", Item = "starter_pack", Surface = "StarterBadge" })
	end })
	Kit.Button({ Text = "×", Style = "Slate", Size = UDim2.fromOffset(36, 36), Position = UDim2.new(1, 0, 0.5, 0), Anchor = Vector2.new(1, 0.5), Parent = starterBadge, OnClick = function()
		starterBadge:Destroy()
		starterBadge = false
	end })
end

local function buildStatus()
	boostRow = New("Frame", {
		BackgroundTransparency = 1,
		Size = UDim2.fromOffset(420, 26),
		Position = UDim2.new(0.5, 0, 0, 88),
		Anchor = Vector2.new(0.5, 0),
		Parent = gui,
	}, { New("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, HorizontalAlignment = Enum.HorizontalAlignment.Center, Padding = UDim.new(0, 6) }) })
	local energy = New("Frame", {
		BackgroundColor3 = Kit.Colors.Slate,
		BackgroundTransparency = 0.2,
		Size = UDim2.fromOffset(190, 26),
		Position = UDim2.new(0.5, 0, 1, -12),
		Anchor = Vector2.new(0.5, 1),
		Parent = gui,
	}, { Kit.Corner(13), Kit.Stroke(Kit.Colors.Cyan, 1, 0.4) })
	energyBar = New("Frame", { BackgroundColor3 = Kit.Colors.Cyan, BackgroundTransparency = 0.25, Size = UDim2.fromScale(1, 1), Parent = energy }, { Kit.Corner(13) })
	energyLabel = Kit.Label({ Text = "Dig Energy", Size = UDim2.new(1, -10, 1, -6), Position = UDim2.fromOffset(5, 3), MaxTextSize = 14, Parent = energy })
	feedFrame = New("Frame", {
		BackgroundTransparency = 1,
		Size = UDim2.fromOffset(360, 230),
		Position = UDim2.fromOffset(10, 64),
		Parent = gui,
	}, { New("UIListLayout", { Padding = UDim.new(0, 4), VerticalAlignment = Enum.VerticalAlignment.Top }) })
	toastHolder = New("Frame", {
		BackgroundTransparency = 1,
		Size = UDim2.fromOffset(420, 200),
		Position = UDim2.new(0.5, 0, 0, 120),
		Anchor = Vector2.new(0.5, 0),
		Parent = gui,
	}, { New("UIListLayout", { Padding = UDim.new(0, 6), HorizontalAlignment = Enum.HorizontalAlignment.Center }) })
end

local function chip(text, color)
	local c = New("Frame", { BackgroundColor3 = Kit.Colors.Slate, BackgroundTransparency = 0.15, Size = UDim2.fromOffset(200, 24), Parent = boostRow }, { Kit.Corner(12), Kit.Stroke(color, 1) })
	Kit.Label({ Text = text, Size = UDim2.new(1, -10, 1, -4), Position = UDim2.fromOffset(5, 2), Color = color, MaxTextSize = 14, Parent = c })
end

local lastBoostText = ""
local function updateStatus()
	local now = State.ServerNow()
	local parts = {}
	local p = State.Profile
	if p and p.Boosts and (p.Boosts.PersonalExpiry or 0) > now then
		table.insert(parts, { "x2 Free-Dig " .. Format.Clock(p.Boosts.PersonalExpiry - now), Kit.Colors.Green })
	end
	if (State.Boost.ServerUntil or 0) > now then
		table.insert(parts, { string.format("Server Boost by %s %s", State.Boost.HeroName or "?", Format.Clock(State.Boost.ServerUntil - now)), Kit.Colors.GoldLight })
	end
	local key = ""
	for _, c in parts do
		key ..= c[1]
	end
	if key ~= lastBoostText then
		lastBoostText = key
		for _, child in boostRow:GetChildren() do
			if child:IsA("Frame") then
				child:Destroy()
			end
		end
		for _, c in parts do
			chip(c[1], c[2])
		end
	end
	local e = State.Energy
	if e then
		local tokens = math.min(e.Capacity, e.Tokens)
		energyBar.Size = UDim2.fromScale(math.clamp(tokens / e.Capacity, 0.04, 1), 1)
		energyLabel.Text = string.format("Dig Energy %.1f / %d m", tokens, e.Capacity)
	end
end

function HUD.Start()
	gui = Kit.Screen("KD_HUD", 5)
	buildDepthPill()
	buildStatus()
	buildMenu()
	buildDigButton()
	for i = math.max(1, #State.Feed - 3), #State.Feed do
		if State.Feed[i] then
			feedRow(State.Feed[i])
		end
	end
	State.FeedAdded:Connect(feedRow)
	State.ProfileChanged:Connect(buildStarterBadge)
	buildStarterBadge()
	State.DepthJump:Connect(function(delta)
		HUD.MetresPop("+" .. Format.ExactMetres(math.floor(delta * 10 + 0.5) / 10))
		if delta > State.Hole.Target * 0.01 then
			flare.BackgroundTransparency = 0.2
			Kit.Tween(flare, 0.8, { BackgroundTransparency = 1 })
		end
	end)
	State.Notify:Connect(function(n)
		if n.Kind == "Bucket" then
			HUD.MetresPop("+" .. Format.Metres(n.Metres or 0, true), Kit.Colors.Cyan)
		elseif n.Text then
			HUD.Toast(n.Text, n.Tier and Kit.TierColor(n.Tier) or nil)
		end
	end)
	local tick = 0
	RunService.RenderStepped:Connect(function(dt)
		local fraction = State.Fraction()
		depthLabel.Text = Format.Metres(State.DisplayDepth, State.DisplayDepth < 1000)
		targetLabel.Text = "/ " .. Format.Commas(State.Hole.Target) .. " m"
		barFill.Size = UDim2.fromScale(fraction, 1)
		local band = Strata.At(fraction)
		stratumLabel.Text = State.Hole.State == "Digging" and band.Name or (State.Hole.State == "Revealing" and "THE BOTTOM!" or "Refilling...")
		stratumLabel.TextColor3 = band.Accent
		tick += dt
		if tick > 0.5 then
			tick = 0
			updateStatus()
		end
	end)
	Net.Event("OpenUI").OnClientEvent:Connect(function(req)
		HUD.Open(req.Panel, req)
	end)
end

return HUD
