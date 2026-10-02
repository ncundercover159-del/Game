local task = require("@lune/task")
--[[
	MockInstance: a lightweight stand-in for Roblox Instances, enough for the
	server logic under test (folders, remotes, parts, attributes, tags,
	signals). Property writes are stored, events are lazily created signals,
	and children are reachable by name exactly like Roblox (`obj.ChildName`).
]]

local MockSignal = {}
MockSignal.__index = MockSignal

function MockSignal.new(name: string?)
	return setmetatable({ _handlers = {}, Name = name or "Signal", FireCount = 0 }, MockSignal)
end

function MockSignal:Connect(fn)
	local handler = { fn = fn, connected = true }
	table.insert(self._handlers, handler)
	local conn = { Connected = true }
	function conn.Disconnect()
		handler.connected = false
		conn.Connected = false
		local i = table.find(self._handlers, handler)
		if i then
			table.remove(self._handlers, i)
		end
	end
	return conn
end

function MockSignal:Once(fn)
	local conn
	conn = self:Connect(function(...)
		conn:Disconnect()
		fn(...)
	end)
	return conn
end

function MockSignal:Fire(...)
	self.FireCount += 1
	for _, h in table.clone(self._handlers) do
		if h.connected then
			task.spawn(h.fn, ...)
		end
	end
end

function MockSignal:Wait()
	local thread = coroutine.running()
	self:Once(function(...)
		task.spawn(thread, ...)
	end)
	return coroutine.yield()
end

-- Names that resolve to lazily-created signals when read.
local EVENT_NAMES = {
	OnServerEvent = true,
	OnClientEvent = true,
	Event = true,
	Touched = true,
	TouchEnded = true,
	ChildAdded = true,
	ChildRemoved = true,
	DescendantAdded = true,
	DescendantRemoving = true,
	Triggered = true,
	TriggerEnded = true,
	PromptShown = true,
	PromptHidden = true,
	Changed = true,
	AncestryChanged = true,
	Destroying = true,
	CharacterAdded = true,
	CharacterRemoving = true,
	Died = true,
	Completed = true,
	MouseButton1Click = true,
	Activated = true,
	Heartbeat = true,
	MouseButton1Down = true,
	MouseButton1Up = true,
	MouseEnter = true,
	MouseLeave = true,
	FocusLost = true,
	Focused = true,
	InputBegan = true,
	InputEnded = true,
	InputChanged = true,
	Stepped2 = true,
	OnClientInvoke = false,
	Stepped = true,
	RenderStepped = true,
	PreSimulation = true,
	PostSimulation = true,
	PreRender = true,
}

local IS_A = {
	BasePart = { Part = true, MeshPart = true, WedgePart = true, TrussPart = true, CornerWedgePart = true, SpawnLocation = true, UnionOperation = true },
	PVInstance = { Model = true, Part = true, MeshPart = true, WedgePart = true, SpawnLocation = true },
	GuiObject = { Frame = true, TextLabel = true, TextButton = true, ImageLabel = true, ImageButton = true, ScrollingFrame = true, ViewportFrame = true, TextBox = true, CanvasGroup = true },
	LuaSourceContainer = { Script = true, LocalScript = true, ModuleScript = true },
	ValueBase = { IntValue = true, NumberValue = true, StringValue = true, BoolValue = true, ObjectValue = true },
}

local MockInstance = {}
local Methods = {}
local meta = {}

local function props(self)
	return rawget(self, "_props")
end

meta.__index = function(self, key)
	local method = Methods[key]
	if method then
		return method
	end
	local p = props(self)
	local value = p[key]
	if value ~= nil then
		return value
	end
	local child = Methods.FindFirstChild(self, key)
	if child then
		return child
	end
	if key == "Position" and p.CFrame and typeof(p.CFrame) == "CFrame" then
		return p.CFrame.Position
	end
	if key == "CFrame" and typeof(p.Position) == "Vector3" then
		return require("@lune/roblox").CFrame.new(p.Position)
	end
	if EVENT_NAMES[key] then
		local s = MockSignal.new(key)
		p[key] = s
		return s
	end
	return nil
end

meta.__newindex = function(self, key, value)
	if key == "Position" and typeof(value) == "Vector3" then
		local CF = require("@lune/roblox").CFrame
		local old = props(self).CFrame
		props(self).CFrame = old and (CF.new(value) * old.Rotation) or CF.new(value)
	end
	if key == "Parent" then
		Methods._SetParent(self, value)
		return
	end
	local p = props(self)
	local old = p[key]
	p[key] = value
	if old ~= value then
		local changed = rawget(self, "_propSignals")[key]
		if changed then
			changed:Fire()
		end
	end
end

meta.__tostring = function(self)
	return tostring(props(self).Name)
end

function MockInstance.new(className: string, parent: any?)
	local self = setmetatable({
		_props = { ClassName = className, Name = className },
		_children = {},
		_attributes = {},
		_tags = {},
		_propSignals = {},
		_attrSignals = {},
		_isMock = true,
	}, meta)
	if parent then
		self.Parent = parent
	end
	return self
end

function MockInstance.is(value): boolean
	return type(value) == "table" and rawget(value, "_isMock") == true
end

MockInstance.Signal = MockSignal

function Methods._SetParent(self, parent)
	local p = props(self)
	local old = p.Parent
	if old == parent then
		return
	end
	if old then
		local siblings = rawget(old, "_children")
		local i = table.find(siblings, self)
		if i then
			table.remove(siblings, i)
		end
	end
	p.Parent = parent
	if parent then
		table.insert(rawget(parent, "_children"), self)
		local added = rawget(parent, "_props").ChildAdded
		if added then
			added:Fire(self)
		end
	end
end

function Methods.FindFirstChild(self, name, recursive)
	for _, child in rawget(self, "_children") do
		if rawget(child, "_props").Name == name then
			return child
		end
	end
	if recursive then
		for _, child in rawget(self, "_children") do
			local found = Methods.FindFirstChild(child, name, true)
			if found then
				return found
			end
		end
	end
	return nil
end

function Methods.WaitForChild(self, name, _timeout)
	return Methods.FindFirstChild(self, name)
end

function Methods.FindFirstChildOfClass(self, className)
	for _, child in rawget(self, "_children") do
		if rawget(child, "_props").ClassName == className then
			return child
		end
	end
	return nil
end

function Methods.IsA(self, className)
	local own = rawget(self, "_props").ClassName
	if own == className or className == "Instance" then
		return true
	end
	local family = IS_A[className]
	return family ~= nil and family[own] == true
end

function Methods.FindFirstChildWhichIsA(self, className)
	for _, child in rawget(self, "_children") do
		if Methods.IsA(child, className) then
			return child
		end
	end
	return nil
end

function Methods.FindFirstAncestor(self, name)
	local p = props(self).Parent
	while p do
		if props(p).Name == name then
			return p
		end
		p = props(p).Parent
	end
	return nil
end

function Methods.FindFirstAncestorWhichIsA(self, className)
	local p = props(self).Parent
	while p do
		if Methods.IsA(p, className) then
			return p
		end
		p = props(p).Parent
	end
	return nil
end

function Methods.IsDescendantOf(self, ancestor)
	local p = props(self).Parent
	while p do
		if p == ancestor then
			return true
		end
		p = props(p).Parent
	end
	return false
end

function Methods.GetChildren(self)
	return table.clone(rawget(self, "_children"))
end

function Methods.GetDescendants(self)
	local out = {}
	local function walk(node)
		for _, child in rawget(node, "_children") do
			table.insert(out, child)
			walk(child)
		end
	end
	walk(self)
	return out
end

function Methods.ClearAllChildren(self)
	for _, child in table.clone(rawget(self, "_children")) do
		Methods.Destroy(child)
	end
end

function Methods.Destroy(self)
	local destroying = props(self).Destroying
	if destroying then
		destroying:Fire()
	end
	for _, child in table.clone(rawget(self, "_children")) do
		Methods.Destroy(child)
	end
	Methods._SetParent(self, nil)
	rawset(self, "_destroyed", true)
end

function Methods.Clone(self)
	local copy = MockInstance.new(props(self).ClassName)
	for k, v in props(self) do
		if k ~= "Parent" and not (type(v) == "table" and getmetatable(v) == MockSignal) then
			props(copy)[k] = v
		end
	end
	for k, v in rawget(self, "_attributes") do
		rawget(copy, "_attributes")[k] = v
	end
	for tag in rawget(self, "_tags") do
		rawget(copy, "_tags")[tag] = true
	end
	for _, child in rawget(self, "_children") do
		Methods.Clone(child).Parent = copy
	end
	return copy
end

function Methods.GetFullName(self)
	local parts = {}
	local node = self
	while node do
		table.insert(parts, 1, props(node).Name)
		node = props(node).Parent
	end
	return table.concat(parts, ".")
end

function Methods.SetAttribute(self, name, value)
	rawget(self, "_attributes")[name] = value
	local s = rawget(self, "_attrSignals")[name]
	if s then
		s:Fire()
	end
end

function Methods.GetAttribute(self, name)
	return rawget(self, "_attributes")[name]
end

function Methods.GetAttributes(self)
	return table.clone(rawget(self, "_attributes"))
end

function Methods.GetAttributeChangedSignal(self, name)
	local signals = rawget(self, "_attrSignals")
	signals[name] = signals[name] or MockSignal.new("AttributeChanged")
	return signals[name]
end

function Methods.GetPropertyChangedSignal(self, name)
	local signals = rawget(self, "_propSignals")
	signals[name] = signals[name] or MockSignal.new("PropertyChanged")
	return signals[name]
end

function Methods.AddTag(self, tag)
	rawget(self, "_tags")[tag] = true
end

function Methods.RemoveTag(self, tag)
	rawget(self, "_tags")[tag] = nil
end

function Methods.HasTag(self, tag)
	return rawget(self, "_tags")[tag] == true
end

function Methods.GetTags(self)
	local out = {}
	for tag in rawget(self, "_tags") do
		table.insert(out, tag)
	end
	return out
end

-- Remotes: record traffic so tests can assert on it.
function Methods.FireClient(self, player, ...)
	local log = props(self)._clientLog or {}
	props(self)._clientLog = log
	table.insert(log, { player = player, args = table.pack(...) })
end

function Methods.FireAllClients(self, ...)
	local log = props(self)._allLog or {}
	props(self)._allLog = log
	table.insert(log, table.pack(...))
end

function Methods.Fire(self, ...)
	local event = props(self).Event
	if event then
		event:Fire(...)
	end
end

function Methods.GetPivot(self)
	return props(self).CFrame or props(self).PivotCFrame or require("@lune/roblox").CFrame.new()
end

function Methods.PivotTo(self, cf)
	props(self).PivotCFrame = cf
	props(self).CFrame = cf
end

function Methods.Play(self)
	props(self).Playing = true
end

function Methods.Stop(self)
	props(self).Playing = false
end

function Methods.Kick(self, message)
	props(self).KickMessage = message or ""
	props(self).Kicked = true
end

function Methods.LoadCharacter(self) end

function Methods.SetNetworkOwner(self) end

function Methods.ScaleTo(self, s)
	props(self).Scale = s
end

function Methods.GetPartsInPart()
	return {}
end

function Methods.RequestStreamAroundAsync() end

-- Client-side remote calls go straight to the server handlers in the same
-- runtime (integration tests run server and client together).
MockInstance.LocalPlayer = nil
function Methods.InvokeServer(self, ...)
	local handler = props(self).OnServerInvoke
	assert(handler, "no OnServerInvoke for " .. tostring(props(self).Name))
	return handler(MockInstance.LocalPlayer, ...)
end

function Methods.FireServer(self, ...)
	local s = props(self).OnServerEvent
	if s then
		s:Fire(MockInstance.LocalPlayer, ...)
	end
end

local fireClient = Methods.FireClient
function Methods.FireClient(self, player, ...)
	fireClient(self, player, ...)
	local s = props(self).OnClientEvent
	if s and player == MockInstance.LocalPlayer then
		s:Fire(...)
	end
end

local fireAll = Methods.FireAllClients
function Methods.FireAllClients(self, ...)
	fireAll(self, ...)
	local s = props(self).OnClientEvent
	if s then
		s:Fire(...)
	end
end

function Methods.Emit() end
function Methods.BulkMoveTo(_, parts, cframes)
	for i, part in parts do
		props(part).CFrame = cframes[i]
	end
end
function Methods.GetBoundingBox(self)
	return props(self).PivotCFrame or require("@lune/roblox").CFrame.new(), require("@lune/roblox").Vector3.new(4, 4, 4)
end
function Methods.DisplaySystemMessage() end
function Methods.SetMotor() end
function Methods.IsVibrationSupported()
	return false
end
function Methods.LoadAnimation()
	return MockInstance.new("AnimationTrack")
end
function Methods.SetPrimaryPartCFrame(self, cf)
	props(self).PivotCFrame = cf
end

return MockInstance
