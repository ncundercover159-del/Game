--[[
	Kit: the UI kit. Chunky rounded panels with wood frames and slate faces,
	gold display buttons, neon accent strokes, Fredoka One headings and Gotham
	body text (docs/ART_BIBLE.md section 10). Buttons squash on press and
	bounce back. Everything scales with a UIScale tuned for phones.
]]

local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local SoundService = game:GetService("SoundService")

local Kit = {}

Kit.Colors = {
	Wood = Color3.fromRGB(110, 74, 42),
	WoodLight = Color3.fromRGB(154, 106, 62),
	WoodDark = Color3.fromRGB(62, 42, 28),
	Slate = Color3.fromRGB(24, 29, 47),
	SlateLight = Color3.fromRGB(42, 48, 72),
	Gold = Color3.fromRGB(247, 168, 27),
	GoldLight = Color3.fromRGB(255, 211, 107),
	GoldDark = Color3.fromRGB(90, 58, 8),
	White = Color3.fromRGB(255, 255, 255),
	Cream = Color3.fromRGB(255, 233, 184),
	Rank = Color3.fromRGB(247, 198, 75),
	Cyan = Color3.fromRGB(82, 246, 255),
	Green = Color3.fromRGB(95, 211, 90),
	Red = Color3.fromRGB(255, 90, 90),
	Navy = Color3.fromRGB(40, 52, 87),
	Dim = Color3.fromRGB(150, 156, 176),
}

Kit.Display = Font.new("rbxasset://fonts/families/FredokaOne.json", Enum.FontWeight.Bold)
Kit.Body = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.Bold)
Kit.BodyRegular = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.Medium)

Kit.IsTouch = UserInputService.TouchEnabled and not UserInputService.KeyboardEnabled

function Kit.New(className: string, props, children)
	local inst = Instance.new(className)
	for k, v in props or {} do
		if k ~= "Parent" then
			inst[k] = v
		end
	end
	for _, child in children or {} do
		child.Parent = inst
	end
	if props and props.Parent then
		inst.Parent = props.Parent
	end
	return inst
end

local New = Kit.New

function Kit.Corner(radius: number)
	return New("UICorner", { CornerRadius = UDim.new(0, radius or 12) })
end

function Kit.Stroke(color: Color3, thickness: number?, transparency: number?)
	return New("UIStroke", {
		Color = color,
		Thickness = thickness or 2,
		Transparency = transparency or 0,
		ApplyStrokeMode = Enum.ApplyStrokeMode.Border,
	})
end

function Kit.TextStroke(color: Color3, thickness: number?)
	return New("UIStroke", { Color = color, Thickness = thickness or 2, ApplyStrokeMode = Enum.ApplyStrokeMode.Contextual })
end

function Kit.Gradient(colors: { Color3 }, rotation: number?)
	local kps = {}
	for i, c in colors do
		table.insert(kps, ColorSequenceKeypoint.new((i - 1) / math.max(1, #colors - 1), c))
	end
	return New("UIGradient", { Color = ColorSequence.new(kps), Rotation = rotation or 90 })
end

function Kit.Padding(px: number)
	return New("UIPadding", {
		PaddingTop = UDim.new(0, px),
		PaddingBottom = UDim.new(0, px),
		PaddingLeft = UDim.new(0, px),
		PaddingRight = UDim.new(0, px),
	})
end

function Kit.Label(props)
	local label = New("TextLabel", {
		BackgroundTransparency = 1,
		FontFace = props.Display and Kit.Display or Kit.Body,
		Text = props.Text or "",
		TextColor3 = props.Color or Kit.Colors.White,
		TextScaled = props.Scaled ~= false,
		TextSize = props.TextSize or 18,
		TextWrapped = true,
		TextXAlignment = props.AlignX or Enum.TextXAlignment.Center,
		TextYAlignment = props.AlignY or Enum.TextYAlignment.Center,
		Size = props.Size or UDim2.fromScale(1, 1),
		Position = props.Position or UDim2.new(),
		AnchorPoint = props.Anchor or Vector2.zero,
		RichText = props.Rich == true,
		ZIndex = props.ZIndex or 1,
		Name = props.Name or "Label",
		Parent = props.Parent,
	})
	if props.Stroke then
		Kit.TextStroke(props.Stroke, props.StrokeSize).Parent = label
	end
	if props.MaxTextSize then
		New("UITextSizeConstraint", { MaxTextSize = props.MaxTextSize, MinTextSize = props.MinTextSize or 8 }).Parent = label
	end
	return label
end

-- Wood-framed slate panel (like the reference boards).
function Kit.Panel(props)
	local frame = New("Frame", {
		Name = props.Name or "Panel",
		BackgroundColor3 = Kit.Colors.Wood,
		Size = props.Size,
		Position = props.Position or UDim2.new(),
		AnchorPoint = props.Anchor or Vector2.zero,
		ZIndex = props.ZIndex or 1,
		Visible = props.Visible ~= false,
		Parent = props.Parent,
	}, {
		Kit.Corner(props.Radius or 18),
		Kit.Gradient({ Kit.Colors.WoodLight, Kit.Colors.Wood, Kit.Colors.WoodDark }),
		Kit.Stroke(Kit.Colors.WoodDark, 3),
	})
	local inset = props.Inset or 7
	local face = New("Frame", {
		Name = "Face",
		BackgroundColor3 = props.FaceColor or Kit.Colors.Slate,
		Size = UDim2.new(1, -inset * 2, 1, -inset * 2),
		Position = UDim2.fromOffset(inset, inset),
		ZIndex = (props.ZIndex or 1),
		Parent = frame,
	}, {
		Kit.Corner((props.Radius or 18) - 5),
		Kit.Gradient({ Kit.Colors.SlateLight, Kit.Colors.Slate }),
	})
	if props.Accent then
		Kit.Stroke(props.Accent, 2, 0.2).Parent = face
	end
	return frame, face
end

local function squash(button: GuiButton, scale: UIScale)
	button.MouseButton1Down:Connect(function()
		TweenService:Create(scale, TweenInfo.new(0.07, Enum.EasingStyle.Quad), { Scale = 0.92 }):Play()
	end)
	local function release()
		TweenService:Create(scale, TweenInfo.new(0.35, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Scale = 1 }):Play()
	end
	button.MouseButton1Up:Connect(release)
	button.MouseLeave:Connect(release)
end

Kit.ClickSound = nil
function Kit.Click()
	if not Kit.ClickSound then
		Kit.ClickSound = New("Sound", { SoundId = "rbxasset://sounds/clickfast.wav", Volume = 0.4, Parent = SoundService })
	end
	Kit.ClickSound:Play()
end

--[[ Button: Style = "Gold" | "Slate" | "Green" | "Red"; returns the TextButton. ]]
function Kit.Button(props)
	local styles = {
		Gold = { { Kit.Colors.GoldLight, Kit.Colors.Gold }, Kit.Colors.GoldDark, Kit.Colors.GoldDark },
		Slate = { { Kit.Colors.SlateLight, Kit.Colors.Slate }, Color3.fromRGB(90, 100, 140), Kit.Colors.White },
		Green = { { Color3.fromRGB(130, 230, 120), Color3.fromRGB(60, 170, 70) }, Color3.fromRGB(20, 70, 30), Kit.Colors.White },
		Red = { { Color3.fromRGB(255, 120, 110), Color3.fromRGB(200, 60, 60) }, Color3.fromRGB(80, 20, 20), Kit.Colors.White },
	}
	local style = styles[props.Style or "Gold"]
	local button = New("TextButton", {
		Name = props.Name or "Button",
		AutoButtonColor = false,
		BackgroundColor3 = Color3.new(1, 1, 1),
		Size = props.Size or UDim2.fromOffset(160, 52),
		Position = props.Position or UDim2.new(),
		AnchorPoint = props.Anchor or Vector2.zero,
		Text = "",
		ZIndex = props.ZIndex or 2,
		LayoutOrder = props.LayoutOrder or 0,
		Parent = props.Parent,
	}, {
		Kit.Corner(props.Radius or 14),
		Kit.Gradient(style[1]),
		Kit.Stroke(style[2], 3),
	})
	local label = Kit.Label({
		Text = props.Text or "",
		Display = props.Display ~= false,
		Color = props.TextColor or (props.Style == "Gold" or props.Style == nil) and Kit.Colors.GoldDark or Kit.Colors.White,
		Size = UDim2.new(1, -12, 1, -8),
		Position = UDim2.fromOffset(6, 4),
		ZIndex = (props.ZIndex or 2) + 1,
		MaxTextSize = props.MaxTextSize or 28,
		Parent = button,
	})
	label.Name = "Text"
	local scale = New("UIScale", { Parent = button })
	squash(button, scale)
	if props.OnClick then
		button.Activated:Connect(function()
			Kit.Click()
			props.OnClick()
		end)
	end
	return button
end

function Kit.Tween(inst, time, props, style, direction)
	local tween = TweenService:Create(inst, TweenInfo.new(time, style or Enum.EasingStyle.Quad, direction or Enum.EasingDirection.Out), props)
	tween:Play()
	return tween
end

-- Pop an element in with overshoot.
function Kit.Pop(inst: GuiObject)
	local scale = inst:FindFirstChildOfClass("UIScale") or New("UIScale", { Parent = inst })
	scale.Scale = 0.6
	Kit.Tween(scale, 0.35, { Scale = 1 }, Enum.EasingStyle.Back)
end

function Kit.Screen(name: string, order: number?)
	local player = game:GetService("Players").LocalPlayer
	local gui = New("ScreenGui", {
		Name = name,
		ResetOnSpawn = false,
		IgnoreGuiInset = false,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
		DisplayOrder = order or 1,
		Parent = player:WaitForChild("PlayerGui"),
	})
	-- Phones: scale up so tap targets and text stay big.
	local scale = New("UIScale", { Parent = gui })
	local function update()
		local camera = workspace.CurrentCamera
		local size = camera and camera.ViewportSize or Vector2.new(1280, 720)
		local short = math.min(size.X, size.Y)
		scale.Scale = math.clamp(short / 720, 0.62, 1.25) * (Kit.IsTouch and 1.12 or 1)
	end
	update()
	if workspace.CurrentCamera then
		workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(update)
	end
	return gui, scale
end

function Kit.TierColor(tier: number)
	local Catalog = require(game:GetService("ReplicatedStorage").Shared.Catalog)
	return Catalog.TierColors[tier] or Kit.Colors.Dim
end

-- GREYBOX icon stand-in until Blender icons are uploaded.
local ICON_GLYPHS = {
	Dig = "⛏",
	AutoDigger = "⚙",
	Pass = "★",
	Boost = "⚡",
	Skin = "🎨",
	Plaque = "🪧",
	PlaqueMessage = "✎",
	DigEffect = "✨",
	HardHat = "⛑",
	Pet = "🐾",
	Trail = "〰",
	Aura = "✺",
	Flag = "⚑",
	Title = "🏷",
	NameColor = "🖌",
	Entrance = "🚪",
	SeasonPass = "🎟",
	TierSkip = "⏭",
	StarterPack = "🎁",
	Club = "♦",
	Find = "💎",
}

function Kit.Icon(item, size: UDim2, parent: Instance, isFind: boolean?)
	local AssetRegistry = require(game:GetService("ReplicatedStorage").Shared.AssetRegistry)
	local image = AssetRegistry.Image("icon_" .. item.Id, 150)
	if image then
		return New("ImageLabel", { BackgroundTransparency = 1, Image = image, Size = size, Parent = parent, ScaleType = Enum.ScaleType.Fit })
	end
	local holder = New("Frame", { BackgroundColor3 = Kit.TierColor(item.Tier or 1), Size = size, Parent = parent }, {
		Kit.Corner(10),
		Kit.Gradient({ Kit.TierColor(item.Tier or 1), Kit.Colors.Slate }, 90),
	})
	holder:SetAttribute("GREYBOX", true)
	Kit.Label({ Text = ICON_GLYPHS[isFind and "Find" or item.Category] or "?", Display = true, Parent = holder, Size = UDim2.fromScale(0.8, 0.8), Position = UDim2.fromScale(0.1, 0.1) })
	return holder
end

return Kit
