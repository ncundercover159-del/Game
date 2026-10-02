--[[
	Preview: the store's single pooled ViewportFrame. It is re-parented into
	whichever panel needs it and shows one item at a time: dig tools play
	their looping preview clip, cosmetics spin. Never one viewport per item.
]]

local RunService = game:GetService("RunService")

local Kit = require(script.Parent.Kit)

local Preview = {}

local viewport, camera, worldModel, current, conn
local angle = 0

local function rigBuilder()
	local ok, mod = pcall(function()
		return require(script.Parent.Parent.Spectacle.RigBuilder)
	end)
	return ok and mod or nil
end

function Preview.Attach(parent: Instance, size: UDim2, position: UDim2)
	if not viewport then
		viewport = Kit.New("ViewportFrame", {
			Name = "PreviewViewport",
			BackgroundColor3 = Color3.fromRGB(14, 16, 28),
			Ambient = Color3.fromRGB(150, 150, 170),
			LightColor = Color3.fromRGB(255, 244, 220),
			LightDirection = Vector3.new(-1, -1, -0.6),
		}, { Kit.Corner(12) })
		camera = Instance.new("Camera")
		camera.FieldOfView = 40
		camera.Parent = viewport
		viewport.CurrentCamera = camera
		worldModel = Instance.new("WorldModel")
		worldModel.Parent = viewport
	end
	viewport.Size = size
	viewport.Position = position
	viewport.Parent = parent
	viewport.Visible = true
	return viewport
end

function Preview.Hide()
	if viewport then
		viewport.Visible = false
	end
	if conn then
		conn:Disconnect()
		conn = nil
	end
end

local function fallbackModel(item)
	local model = Instance.new("Model")
	local p = Instance.new("Part")
	p.Size = Vector3.new(3, 3, 3)
	p.Color = Kit.TierColor(item.Tier or 1)
	p.Material = Enum.Material.SmoothPlastic
	p.Anchored = true
	p.Parent = model
	model.PrimaryPart = p
	return model
end

function Preview.Show(item)
	if not viewport then
		return
	end
	if current then
		current:Destroy()
		current = nil
	end
	if conn then
		conn:Disconnect()
	end
	local builder = rigBuilder()
	local rig = builder and builder.ForPreview(item) or nil
	local model = rig and rig.Model or fallbackModel(item)
	model.Parent = worldModel
	current = model
	local cf, size = model:GetBoundingBox()
	local radius = math.max(size.X, size.Y, size.Z)
	local centre = cf.Position
	conn = RunService.RenderStepped:Connect(function(dt)
		angle += dt * 0.6
		local offset = Vector3.new(math.cos(angle), 0.45, math.sin(angle)) * radius * 1.6
		camera.CFrame = CFrame.lookAt(centre + offset, centre)
		if rig and rig.StepPreview then
			rig.StepPreview(dt)
		end
	end)
end

return Preview
