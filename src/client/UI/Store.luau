--[[
	Store: one store opened only by the player (DIG button, kiosk prompt,
	Starter Pack badge). Tabs: Dig, Boosts, Upgrades, Style, Passes & Club,
	Gifts. Every card shows the exact Robux (or Shards) cost and the exact
	effect; the detail panel adds a looping 3D preview in ONE pooled
	ViewportFrame. Purchases always go through the Roblox prompt (or, in
	Studio test mode, a clearly labelled test prompt for the same server path).
	Everything is generated from the Catalog.
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Catalog = require(Shared.Catalog)
local Format = require(Shared.Util.Format)
local Net = require(Shared.Net)
local Config = require(Shared.Config)

local Kit = require(script.Parent.Kit)
local State = require(script.Parent.Parent.State)
local Preview = require(script.Parent.Preview)

local New = Kit.New
local Store = {}

local gui, root, tabBar, grid, detail, giftBar
local currentTab = "Dig"
local selected = nil
local giftTarget = nil -- { UserId, Name }
local surface = "Store"
local testModal

local function analytics(event, category, itemId)
	Net.Event("Analytics"):FireServer(event, category, itemId, surface)
end

local function ownedState(item)
	local p = State.Profile
	if not p then
		return nil
	end
	if item.Ownership == "Default" then
		return (p.Equipped[item.Slot] == nil or p.Equipped[item.Slot] == item.Id) and "Equipped" or "Owned"
	end
	if item.Category == "AutoDigger" then
		if p.AutoDiggerLevel >= item.Effect.Level then
			return "Owned"
		elseif p.AutoDiggerLevel < item.Effect.Level - 1 then
			return "Locked"
		end
		return nil
	end
	if item.Category == "SeasonPass" then
		return (p.Season and p.Season.Premium) and "Owned" or nil
	end
	if item.Category == "Club" then
		return p.Club and "Owned" or nil
	end
	if p.Owned[item.Id] then
		if item.Slot and p.Equipped[item.Slot] == item.Id then
			return "Equipped"
		end
		return "Owned"
	end
	return nil
end

local function priceText(item)
	if item.ShardPrice then
		return Format.Shards(item.ShardPrice)
	elseif item.Purchase == "Subscription" then
		return Config.Subscription.DisplayPrice
	elseif item.Price then
		return Format.Robux(State.Price(item))
	end
	return "Free"
end

local function itemsForTab(tab)
	if tab == "Gifts" then
		local list = {}
		for _, item in Catalog.Items do
			if Catalog.IsGiftable(item) then
				table.insert(list, item)
			end
		end
		return list
	end
	return Catalog.ByTab(tab)
end

------------------------------------------------------------------------------
-- Starter Pack: itemised, with a truthful "worth" computed from the Catalog
------------------------------------------------------------------------------
local function starterLines()
	local item = Catalog.Get("starter_pack")
	local p = State.Profile
	local lines, worth = {}, 0
	for _, id in item.Effect.Contents do
		local c = Catalog.Get(id)
		worth += c.Price
		local owned = p and ((c.Category == "AutoDigger" and p.AutoDiggerLevel >= c.Effect.Level) or p.Owned[id])
		if owned then
			local dig = Catalog.ClosestDig(c.Price)
			table.insert(lines, string.format("• %s (you own it: swapped for a %s dig, +%s)", c.Name, dig.Name, Format.ExactMetres(dig.Effect.Metres)))
		elseif c.Category == "Dig" then
			table.insert(lines, string.format("• %s dig (+%s to this server's hole)", c.Name, Format.ExactMetres(c.Effect.Metres)))
		else
			table.insert(lines, "• " .. c.Name)
		end
	end
	return lines, worth
end

------------------------------------------------------------------------------
-- Actions
------------------------------------------------------------------------------
local dedicationBox

local function buy(item)
	if item.ShardPrice then
		local res = Net.Function("ShardBuy"):InvokeServer(item.Id)
		if res and not res.ok then
			Store.Message(res.reason, Kit.Colors.Red)
		end
		return
	end
	local options = { Surface = surface }
	if giftTarget then
		options.GiftTo = giftTarget.UserId
	end
	if dedicationBox and dedicationBox.Parent and dedicationBox.Text ~= "" then
		options.Dedication = dedicationBox.Text
	end
	local res = Net.Function("RequestPurchase"):InvokeServer(item.Id, options)
	if not res or not res.ok then
		Store.Message(res and res.reason or "Try again in a moment.", Kit.Colors.Red)
	end
end

local function confirmGift(item)
	-- Clear "You are buying X for PlayerName" confirmation before the prompt.
	local modal, face = Kit.Panel({ Size = UDim2.fromOffset(460, 230), Position = UDim2.fromScale(0.5, 0.5), Anchor = Vector2.new(0.5, 0.5), ZIndex = 20, Accent = Kit.Colors.Gold, Parent = gui })
	Kit.Label({ Text = string.format("You are buying %s for %s", item.Name, giftTarget.Name), Display = true, Size = UDim2.new(1, -24, 0, 70), Position = UDim2.fromOffset(12, 12), ZIndex = 21, MaxTextSize = 28, Parent = face })
	Kit.Label({ Text = priceText(item) .. " · charged to you, delivered to them", Size = UDim2.new(1, -24, 0, 30), Position = UDim2.fromOffset(12, 86), ZIndex = 21, Color = Kit.Colors.Cream, MaxTextSize = 18, Parent = face })
	Kit.Button({ Text = "Cancel", Style = "Slate", Size = UDim2.fromOffset(160, 54), Position = UDim2.new(0.27, 0, 1, -16), Anchor = Vector2.new(0.5, 1), ZIndex = 22, Parent = face, OnClick = function()
		modal:Destroy()
	end })
	Kit.Button({ Text = "Continue", Size = UDim2.fromOffset(160, 54), Position = UDim2.new(0.73, 0, 1, -16), Anchor = Vector2.new(0.5, 1), ZIndex = 22, Parent = face, OnClick = function()
		modal:Destroy()
		buy(item)
	end })
	Kit.Pop(modal)
end

local function equip(item)
	local res = Net.Function("Equip"):InvokeServer(item.Slot, item.Id)
	if res and not res.ok then
		Store.Message(res.reason, Kit.Colors.Red)
	end
end

------------------------------------------------------------------------------
-- Detail panel
------------------------------------------------------------------------------
local function showDetail(item)
	selected = item
	for _, child in detail:GetChildren() do
		if not child:IsA("UICorner") and not child:IsA("UIGradient") and not child:IsA("UIStroke") then
			child:Destroy()
		end
	end
	analytics("ItemViewed", item.Category, item.Id)
	local viewport = Preview.Attach(detail, UDim2.new(1, -16, 0.36, 0), UDim2.fromOffset(8, 8))
	Preview.Show(item)
	if viewport then
		analytics("PreviewOpened", item.Category, item.Id)
	end
	Kit.Label({ Text = item.Name, Display = true, Color = Kit.TierColor(item.Tier), Stroke = Kit.Colors.Slate, Size = UDim2.new(1, -16, 0, 34), Position = UDim2.new(0, 8, 0.36, 12), MaxTextSize = 28, Parent = detail })
	local body = item.Description
	if item.Season then
		body ..= "  (Debuted in Season " .. item.Season:sub(2) .. "; stays purchasable.)"
	end
	if item.Id == "starter_pack" then
		local lines, worth = starterLines()
		body = "One per account. You get:\n" .. table.concat(lines, "\n") .. string.format("\nCatalog value of the contents: R$ %s.", Format.Commas(worth))
	end
	Kit.Label({ Text = body, Size = UDim2.new(1, -20, 0.36, 0), Position = UDim2.new(0, 10, 0.36, 52), AlignX = Enum.TextXAlignment.Left, AlignY = Enum.TextYAlignment.Top, Color = Kit.Colors.Cream, MaxTextSize = 17, Parent = detail })

	local state = ownedState(item)
	local canDedicate = item.Category == "Dig" and item.Price >= Config.Social.DedicationMinPrice
	if canDedicate then
		dedicationBox = New("TextBox", {
			PlaceholderText = "Dedicate this dig (optional, 40 chars)",
			Text = "",
			ClearTextOnFocus = false,
			FontFace = Kit.Body,
			TextScaled = true,
			TextColor3 = Kit.Colors.White,
			PlaceholderColor3 = Kit.Colors.Dim,
			BackgroundColor3 = Color3.fromRGB(14, 16, 28),
			Size = UDim2.new(1, -20, 0, 34),
			Position = UDim2.new(0, 10, 1, -110),
			Parent = detail,
		}, { Kit.Corner(8), New("UITextSizeConstraint", { MaxTextSize = 16 }) })
		dedicationBox:GetPropertyChangedSignal("Text"):Connect(function()
			if utf8.len(dedicationBox.Text) and utf8.len(dedicationBox.Text) > Config.Social.DedicationMaxChars then
				dedicationBox.Text = Format.CleanLine(dedicationBox.Text, Config.Social.DedicationMaxChars)
			end
		end)
	else
		dedicationBox = nil
	end

	local row = New("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, -16, 0, 56), Position = UDim2.new(0, 8, 1, -64), Parent = detail }, {
		New("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 8), HorizontalAlignment = Enum.HorizontalAlignment.Center }),
	})
	if state == "Equipped" then
		Kit.Button({ Text = "Equipped", Style = "Slate", Size = UDim2.fromOffset(170, 54), Parent = row })
	elseif state == "Owned" then
		if item.Slot then
			Kit.Button({ Text = "Equip", Style = "Green", Size = UDim2.fromOffset(170, 54), Parent = row, OnClick = function()
				equip(item)
			end })
		else
			Kit.Button({ Text = "Owned", Style = "Slate", Size = UDim2.fromOffset(170, 54), Parent = row })
		end
	elseif state == "Locked" then
		Kit.Button({ Text = "Needs Lv" .. (item.Effect.Level - 1), Style = "Slate", Size = UDim2.fromOffset(190, 54), Parent = row })
	else
		local label = giftTarget and ("Gift " .. priceText(item)) or ("Buy " .. priceText(item))
		if item.Purchase == "None" then
			label = "Season reward"
		end
		Kit.Button({ Text = label, Size = UDim2.fromOffset(220, 54), Parent = row, OnClick = function()
			if item.Purchase == "None" then
				return
			end
			if giftTarget then
				confirmGift(item)
			else
				buy(item)
			end
		end })
	end
	if not giftTarget and Catalog.IsGiftable(item) and currentTab ~= "Gifts" then
		Kit.Button({ Text = "🎁 Gift", Style = "Slate", Size = UDim2.fromOffset(110, 54), Parent = row, OnClick = function()
			Store.SetTab("Gifts")
			showDetail(item)
		end })
	end
	if item.Id == "plaque_message" and state then
		local box = New("TextBox", {
			PlaceholderText = "Your plaque line (30 chars, filtered)",
			Text = State.Profile and State.Profile.PlaqueMessage or "",
			ClearTextOnFocus = false,
			FontFace = Kit.Body,
			TextScaled = true,
			TextColor3 = Kit.Colors.White,
			BackgroundColor3 = Color3.fromRGB(14, 16, 28),
			Size = UDim2.new(1, -20, 0, 34),
			Position = UDim2.new(0, 10, 1, -110),
			Parent = detail,
		}, { Kit.Corner(8), New("UITextSizeConstraint", { MaxTextSize = 16 }) })
		box.FocusLost:Connect(function(enter)
			if enter then
				local res = Net.Function("SetText"):InvokeServer("PlaqueMessage", box.Text)
				Store.Message(res and res.ok and ("Plaque line set: " .. tostring(res.filtered)) or (res and res.reason or "Failed"), res and res.ok and Kit.Colors.Green or Kit.Colors.Red)
			end
		end)
	end
end

------------------------------------------------------------------------------
-- Grid
------------------------------------------------------------------------------
local function card(item, order)
	local state = ownedState(item)
	local c = New("TextButton", {
		Text = "",
		AutoButtonColor = false,
		BackgroundColor3 = Kit.Colors.SlateLight,
		LayoutOrder = order,
		Parent = grid,
	}, { Kit.Corner(12), Kit.Stroke(Kit.TierColor(item.Tier), 2, selected == item and 0 or 0.45) })
	Kit.Icon(item, UDim2.new(0, 56, 0, 56), c).Position = UDim2.fromOffset(8, 8)
	Kit.Label({ Text = item.Name, AlignX = Enum.TextXAlignment.Left, Size = UDim2.new(1, -76, 0, 24), Position = UDim2.fromOffset(70, 6), MaxTextSize = 16, Parent = c })
	local effect = item.Category == "Dig" and ("+" .. Format.ExactMetres(item.Effect.Metres) .. " to THIS hole") or (item.Section or "")
	Kit.Label({ Text = effect, AlignX = Enum.TextXAlignment.Left, Color = Kit.Colors.Cream, Size = UDim2.new(1, -76, 0, 18), Position = UDim2.fromOffset(70, 32), MaxTextSize = 13, Parent = c })
	Kit.Label({
		Text = state or priceText(item),
		Display = true,
		Color = state and Kit.Colors.Green or (item.ShardPrice and Kit.Colors.Cyan or Kit.Colors.GoldLight),
		AlignX = Enum.TextXAlignment.Right,
		Size = UDim2.new(1, -16, 0, 22),
		Position = UDim2.new(0, 8, 1, -28),
		MaxTextSize = 18,
		Parent = c,
	})
	c.Activated:Connect(function()
		Kit.Click()
		showDetail(item)
		Store.Refresh()
	end)
	return c
end

local function buildGiftBar()
	giftBar.Visible = currentTab == "Gifts"
	for _, child in giftBar:GetChildren() do
		if child:IsA("GuiButton") or child:IsA("TextLabel") then
			child:Destroy()
		end
	end
	if currentTab ~= "Gifts" then
		giftTarget = nil
		return
	end
	Kit.Label({ Text = "1. Pick a player in this server:", Size = UDim2.fromOffset(220, 40), AlignX = Enum.TextXAlignment.Left, MaxTextSize = 16, Parent = giftBar })
	local others = 0
	for _, player in Players:GetPlayers() do
		if player ~= Players.LocalPlayer then
			others += 1
			local chosen = giftTarget and giftTarget.UserId == player.UserId
			Kit.Button({ Text = player.DisplayName, Style = chosen and "Green" or "Slate", Size = UDim2.fromOffset(140, 40), MaxTextSize = 16, Display = false, Parent = giftBar, OnClick = function()
				giftTarget = { UserId = player.UserId, Name = player.DisplayName }
				Store.Refresh()
				if selected then
					showDetail(selected)
				end
			end })
		end
	end
	if others == 0 then
		Kit.Label({ Text = "Nobody else is here yet.", Size = UDim2.fromOffset(220, 40), Color = Kit.Colors.Dim, MaxTextSize = 16, Parent = giftBar })
	end
end

function Store.Refresh()
	if not grid then
		return
	end
	for _, child in grid:GetChildren() do
		if child:IsA("GuiButton") or child:IsA("TextLabel") then
			child:Destroy()
		end
	end
	local order = 0
	local lastSection = nil
	for _, item in itemsForTab(currentTab) do
		if item.Ownership ~= "Season" then
			if item.Section ~= lastSection and currentTab ~= "Gifts" then
				lastSection = item.Section
				order += 1
				local header = Kit.Label({ Text = item.Section or "", Display = true, Color = Kit.Colors.GoldLight, AlignX = Enum.TextXAlignment.Left, MaxTextSize = 20, Parent = grid })
				header.LayoutOrder = order
				header:SetAttribute("Header", true)
			end
			order += 1
			card(item, order)
		end
	end
	for _, b in tabBar:GetChildren() do
		if b:IsA("GuiButton") then
			local active = b.Name == currentTab
			b.Size = active and UDim2.fromOffset(150, 46) or UDim2.fromOffset(136, 40)
		end
	end
	buildGiftBar()
end

function Store.SetTab(tab)
	currentTab = tab
	analytics("TabViewed", tab, nil)
	Store.Refresh()
end

function Store.Message(text, color)
	local toast = Kit.Label({ Text = text, Color = color or Kit.Colors.White, Size = UDim2.new(1, -40, 0, 30), Position = UDim2.new(0.5, 0, 1, -8), Anchor = Vector2.new(0.5, 1), ZIndex = 30, MaxTextSize = 18, Stroke = Kit.Colors.Slate, Parent = root })
	task.delay(3.5, function()
		toast:Destroy()
	end)
end

------------------------------------------------------------------------------
-- Test-mode purchase prompt (Studio only; same server grant path)
------------------------------------------------------------------------------
local function showTestPrompt(req)
	if testModal then
		testModal:Destroy()
	end
	local item = Catalog.Get(req.ItemId)
	local modal, face = Kit.Panel({ Size = UDim2.fromOffset(480, 250), Position = UDim2.fromScale(0.5, 0.5), Anchor = Vector2.new(0.5, 0.5), ZIndex = 40, Accent = Kit.Colors.Red, Parent = gui })
	testModal = modal
	Kit.Label({ Text = "STUDIO TEST PURCHASE (no Robux are spent)", Color = Kit.Colors.Red, Size = UDim2.new(1, -20, 0, 26), Position = UDim2.fromOffset(10, 8), ZIndex = 41, MaxTextSize = 16, Parent = face })
	local text = string.format("Buy %s for R$ %s?", item.Name, Format.Commas(req.Price or 0))
	if req.GiftToName then
		text = string.format("Buy %s for %s for R$ %s?", item.Name, req.GiftToName, Format.Commas(req.Price or 0))
	end
	Kit.Label({ Text = text, Display = true, Size = UDim2.new(1, -20, 0, 80), Position = UDim2.fromOffset(10, 40), ZIndex = 41, MaxTextSize = 26, Parent = face })
	if req.Dedication and req.Dedication ~= "" then
		Kit.Label({ Text = 'Dedication: "' .. req.Dedication .. '"', Color = Kit.Colors.Cream, Size = UDim2.new(1, -20, 0, 24), Position = UDim2.fromOffset(10, 122), ZIndex = 41, MaxTextSize = 16, Parent = face })
	end
	local function decide(accepted)
		modal:Destroy()
		testModal = nil
		local res = Net.Function("TestPurchaseDecision"):InvokeServer(req.Token, accepted)
		if res and not res.ok and res.reason and root then
			Store.Message(res.reason, Kit.Colors.Red)
		end
	end
	Kit.Button({ Text = "Cancel", Style = "Slate", Size = UDim2.fromOffset(170, 54), Position = UDim2.new(0.27, 0, 1, -14), Anchor = Vector2.new(0.5, 1), ZIndex = 42, Parent = face, OnClick = function()
		decide(false)
	end })
	Kit.Button({ Text = "Buy (test)", Size = UDim2.fromOffset(170, 54), Position = UDim2.new(0.73, 0, 1, -14), Anchor = Vector2.new(0.5, 1), ZIndex = 42, Parent = face, OnClick = function()
		decide(true)
	end })
	Kit.Pop(modal)
end

------------------------------------------------------------------------------
-- Open / close
------------------------------------------------------------------------------
function Store.Open(opts)
	opts = opts or {}
	surface = opts.Surface or "Store"
	if root then
		root.Visible = true
	else
		local frame, face = Kit.Panel({ Name = "Store", Size = UDim2.new(0.94, 0, 0.86, 0), Position = UDim2.fromScale(0.5, 0.53), Anchor = Vector2.new(0.5, 0.5), Accent = Kit.Colors.Gold, Parent = gui })
		root = frame
		New("UISizeConstraint", { MaxSize = Vector2.new(1180, 760) }).Parent = frame
		Kit.Label({ Text = "KEEP DIGGING! STORE", Display = true, Color = Kit.Colors.GoldLight, Stroke = Kit.Colors.GoldDark, StrokeSize = 3, Size = UDim2.new(1, -140, 0, 40), Position = UDim2.fromOffset(16, 8), AlignX = Enum.TextXAlignment.Left, MaxTextSize = 34, Parent = face })
		Kit.Button({ Text = "✕", Style = "Red", Size = UDim2.fromOffset(52, 52), Position = UDim2.new(1, -8, 0, 6), Anchor = Vector2.new(1, 0), Parent = face, OnClick = Store.Close })
		tabBar = New("ScrollingFrame", { BackgroundTransparency = 1, Size = UDim2.new(1, -16, 0, 52), Position = UDim2.fromOffset(8, 54), CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.X, ScrollingDirection = Enum.ScrollingDirection.X, ScrollBarThickness = 0, Parent = face }, {
			New("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 6), VerticalAlignment = Enum.VerticalAlignment.Center, SortOrder = Enum.SortOrder.LayoutOrder }),
		})
		for i, tab in Catalog.Tabs do
			local b = Kit.Button({ Name = tab.Id, Text = tab.Name, Style = "Slate", Size = UDim2.fromOffset(136, 40), LayoutOrder = i, MaxTextSize = 18, Parent = tabBar, OnClick = function()
				Store.SetTab(tab.Id)
			end })
			b.Name = tab.Id
		end
		giftBar = New("Frame", { BackgroundTransparency = 1, Size = UDim2.new(0.6, -16, 0, 44), Position = UDim2.fromOffset(8, 110), Visible = false, Parent = face }, {
			New("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 6), VerticalAlignment = Enum.VerticalAlignment.Center }),
		})
		grid = New("ScrollingFrame", { BackgroundTransparency = 1, Size = UDim2.new(0.6, -16, 1, -170), Position = UDim2.fromOffset(8, 160), CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y, ScrollBarThickness = 8, Parent = face }, {
			New("UIGridLayout", { CellSize = UDim2.new(0.5, -8, 0, 104), CellPadding = UDim2.fromOffset(8, 8), SortOrder = Enum.SortOrder.LayoutOrder }),
		})
		detail = New("Frame", { BackgroundColor3 = Kit.Colors.Slate, Size = UDim2.new(0.4, -8, 1, -122), Position = UDim2.new(0.6, 0, 0, 112), Parent = face }, { Kit.Corner(14), Kit.Stroke(Kit.Colors.Gold, 2, 0.5) })
	end
	analytics("StoreOpened", nil, nil)
	Kit.Pop(root)
	Store.SetTab(opts.Tab or (opts.Item and Catalog.Get(opts.Item) and Catalog.Get(opts.Item).Tab) or currentTab)
	local focus = opts.Item and Catalog.Get(opts.Item) or itemsForTab(currentTab)[1]
	if focus then
		showDetail(focus)
	end
end

function Store.Close()
	if root then
		root.Visible = false
		Preview.Hide()
	end
	giftTarget = nil
end

function Store.IsOpen()
	return root ~= nil and root.Visible
end

function Store.Start(screen)
	gui = screen
	Net.Event("PromptTest").OnClientEvent:Connect(showTestPrompt)
	State.ProfileChanged:Connect(function()
		if root and root.Visible then
			Store.Refresh()
			if selected then
				showDetail(selected)
			end
		end
	end)
end

return Store
