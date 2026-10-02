--[[
	Runtime: loads the game's Luau source under Lune exactly as Rojo maps it
	(src/shared -> ReplicatedStorage.Shared, src/server ->
	ServerScriptService.Server, src/client -> StarterPlayerScripts.Client),
	with mock services, Roblox datatypes from @lune/roblox, a controllable
	clock and `require(script.Parent.X)` semantics (including recursion
	detection, which Roblox also enforces).
]]

local fs = require("@lune/fs")
local luau = require("@lune/luau")
local roblox = require("@lune/roblox")
local task = require("@lune/task")

local MockInstance = require("./MockInstance")
local Services = require("./Services")

local Runtime = {}
Runtime.__index = Runtime

local SERVICE_FACTORIES = {
	DataStoreService = Services.DataStoreService,
	Players = Services.Players,
	MarketplaceService = Services.MarketplaceService,
	RunService = Services.RunService,
	HttpService = Services.HttpService,
	TextService = Services.TextService,
	AnalyticsService = Services.AnalyticsService,
	CollectionService = Services.CollectionService,
	TweenService = Services.TweenService,
	MemoryStoreService = Services.MemoryStoreService,
	MessagingService = Services.MessagingService,
	PolicyService = Services.PolicyService,
}

local function makeTweenInfo()
	return {
		new = function(time, style, direction, repeatCount, reverses, delayTime)
			return {
				Time = time or 1,
				EasingStyle = style,
				EasingDirection = direction,
				RepeatCount = repeatCount or 0,
				Reverses = reverses or false,
				DelayTime = delayTime or 0,
			}
		end,
	}
end

local function makeRandom()
	local Random = {}
	Random.__index = Random
	function Random.new(seed)
		return setmetatable({ s = math.floor(math.abs(seed or os.clock() * 1e6)) % 2147483647 + 1 }, Random)
	end
	function Random:_next()
		self.s = (self.s * 48271) % 2147483647
		return (self.s - 1) / 2147483646
	end
	function Random:NextNumber(lo, hi)
		local r = self:_next()
		if lo and hi then
			return lo + (hi - lo) * r
		end
		return r
	end
	function Random:NextInteger(lo, hi)
		return lo + math.min(hi - lo, math.floor(self:_next() * (hi - lo + 1)))
	end
	return Random
end

function Runtime.new(options)
	options = options or {}
	local self = setmetatable({}, Runtime)
	self.Root = options.Root or "."
	self.Warnings = {}
	self.Prints = {}
	self.Quiet = options.Quiet ~= false
	self.Clock = { Now = options.Now or 1791000000, Mono = 1000 }
	self._cache = {}
	self._loading = {}
	self._services = {}

	local game = MockInstance.new("DataModel")
	game.Name = "Game"
	game.JobId = options.JobId or "test-job-0001"
	game.PlaceId = 0
	game.PlaceVersion = 1
	game.CreatorId = 1
	game.CreatorType = roblox.Enum.CreatorType.User
	game._closeHandlers = {}
	local runtime = self
	rawget(game, "_props").GetService = function(_, name)
		return runtime:Service(name)
	end
	rawget(game, "_props").BindToClose = function(g, fn)
		table.insert(g._closeHandlers, fn)
	end
	rawget(game, "_props").IsLoaded = function()
		return true
	end
	self.game = game

	-- Containers
	local replicated = self:Service("ReplicatedStorage")
	local serverScripts = self:Service("ServerScriptService")
	local starterPlayer = self:Service("StarterPlayer")
	local starterPlayerScripts = MockInstance.new("StarterPlayerScripts", starterPlayer)
	starterPlayerScripts.Name = "StarterPlayerScripts"
	local workspace = self:Service("Workspace")
	workspace.Gravity = 196.2
	workspace.StreamingEnabled = true
	local camera = MockInstance.new("Camera", workspace)
	camera.Name = "Camera"
	camera.FieldOfView = 70
	workspace.CurrentCamera = camera
	local terrain = MockInstance.new("Terrain", workspace)
	terrain.Name = "Terrain"
	self.workspace = workspace

	self.Shared = self:_mount(self.Root .. "/src/shared", replicated, "Shared")
	self.Server = self:_mount(self.Root .. "/src/server", serverScripts, "Server")
	self.Client = self:_mount(self.Root .. "/src/client", starterPlayerScripts, "Client")
	return self
end

function Runtime:Service(name)
	local existing = self._services[name]
	if existing then
		return existing
	end
	local factory = SERVICE_FACTORIES[name]
	local svc = factory and factory() or Services.Generic(name)
	svc.Name = name
	svc.Parent = self.game
	self._services[name] = svc
	return svc
end

-- Mirrors Rojo's file -> instance rules.
function Runtime:_mount(dir, parent, name)
	if not fs.isDir(dir) then
		local folder = MockInstance.new("Folder", parent)
		folder.Name = name
		return folder
	end
	local container
	local initPath = dir .. "/init.luau"
	if fs.isFile(initPath) then
		container = MockInstance.new("ModuleScript")
		container._sourcePath = initPath
	else
		container = MockInstance.new("Folder")
	end
	container.Name = name
	container.Parent = parent
	local entries = fs.readDir(dir)
	table.sort(entries)
	for _, entry in entries do
		local path = dir .. "/" .. entry
		if fs.isDir(path) then
			self:_mount(path, container, entry)
		elseif entry ~= "init.luau" and entry:match("%.luau$") then
			local base = entry:gsub("%.luau$", "")
			local className = "ModuleScript"
			if base:match("%.server$") then
				className = "Script"
				base = base:gsub("%.server$", "")
			elseif base:match("%.client$") then
				className = "LocalScript"
				base = base:gsub("%.client$", "")
			end
			local inst = MockInstance.new(className, container)
			inst.Name = base
			inst._sourcePath = path
		end
	end
	return container
end

function Runtime:_typeof(value)
	if MockInstance.is(value) then
		return "Instance"
	end
	return typeof(value)
end

function Runtime:_makeEnv(scriptInstance)
	local runtime = self
	local clock = self.Clock
	local mockOs = setmetatable({
		time = function(t)
			if t ~= nil then
				return os.time(t)
			end
			return math.floor(clock.Now)
		end,
		clock = function()
			-- monotonic with a tiny drift so busy-wait loops still terminate
			clock.Mono += 0.0002
			return clock.Mono
		end,
	}, { __index = os })

	local env = {
		script = scriptInstance,
		game = self.game,
		workspace = self.workspace,
		Workspace = self.workspace,
		require = function(target)
			return runtime:Require(target)
		end,
		Instance = {
			new = function(className, parent)
				return MockInstance.new(className, parent)
			end,
		},
		typeof = function(v)
			return runtime:_typeof(v)
		end,
		print = function(...)
			table.insert(runtime.Prints, table.concat(table.pack(...), " ", 1, select("#", ...)))
			if not runtime.Quiet then
				print(...)
			end
		end,
		warn = function(...)
			local parts = {}
			for i = 1, select("#", ...) do
				parts[i] = tostring((select(i, ...)))
			end
			local line = table.concat(parts, " ")
			table.insert(runtime.Warnings, line)
			if not runtime.Quiet then
				print("[warn] " .. line)
			end
		end,
		tick = function()
			return clock.Now
		end,
		time = function()
			return clock.Mono
		end,
		os = mockOs,
		task = task,
		TweenInfo = makeTweenInfo(),
		Random = makeRandom(),
		DateTime = {
			now = function()
				return { UnixTimestamp = math.floor(clock.Now), UnixTimestampMillis = math.floor(clock.Now * 1000) }
			end,
		},
		-- Roblox datatypes
		Enum = roblox.Enum,
		Vector3 = roblox.Vector3,
		Vector2 = roblox.Vector2,
		Vector3int16 = roblox.Vector3int16,
		CFrame = roblox.CFrame,
		Color3 = roblox.Color3,
		BrickColor = roblox.BrickColor,
		ColorSequence = roblox.ColorSequence,
		ColorSequenceKeypoint = roblox.ColorSequenceKeypoint,
		NumberSequence = roblox.NumberSequence,
		NumberSequenceKeypoint = roblox.NumberSequenceKeypoint,
		NumberRange = roblox.NumberRange,
		UDim = roblox.UDim,
		UDim2 = roblox.UDim2,
		Rect = roblox.Rect,
		Ray = roblox.Ray,
		Region3 = roblox.Region3,
		Font = roblox.Font,
		PhysicalProperties = roblox.PhysicalProperties,
		Faces = roblox.Faces,
		Axes = roblox.Axes,
		Content = roblox.Content,
		-- Standard library
		math = math,
		string = string,
		table = table,
		bit32 = bit32,
		utf8 = utf8,
		coroutine = coroutine,
		buffer = buffer,
		debug = debug,
		assert = assert,
		error = error,
		pcall = pcall,
		xpcall = xpcall,
		select = select,
		type = type,
		tostring = tostring,
		tonumber = tonumber,
		pairs = pairs,
		ipairs = ipairs,
		next = next,
		rawget = rawget,
		rawset = rawset,
		rawequal = rawequal,
		rawlen = rawlen,
		setmetatable = setmetatable,
		getmetatable = getmetatable,
		unpack = table.unpack,
		newproxy = newproxy,
		gcinfo = gcinfo,
	}
	env._G = env
	env.shared = {}
	return env
end

function Runtime:Require(target)
	if type(target) == "string" then
		target = self:Resolve(target)
	end
	assert(MockInstance.is(target), "require expects a ModuleScript")
	local cached = self._cache[target]
	if cached ~= nil then
		return cached.value
	end
	if self._loading[target] then
		error("Requested module was required recursively: " .. target:GetFullName())
	end
	local path = target._sourcePath
	assert(path, "Module has no source: " .. target:GetFullName())
	self._loading[target] = true
	local source = fs.readFile(path)
	local chunk = luau.load(source, {
		debugName = path,
		environment = self:_makeEnv(target),
		injectGlobals = false,
	})
	local ok, result = pcall(chunk)
	self._loading[target] = nil
	if not ok then
		error(string.format("Error loading %s: %s", path, tostring(result)), 0)
	end
	self._cache[target] = { value = result }
	return result
end

-- "Shared/Config" or "Server/Services/HoleService"
function Runtime:Resolve(path: string)
	local node
	for segment in path:gmatch("[^/]+") do
		if node == nil then
			if segment == "Shared" then
				node = self.Shared
			elseif segment == "Server" then
				node = self.Server
			elseif segment == "Client" then
				node = self.Client
			else
				error("Unknown root " .. segment)
			end
		else
			local child = node:FindFirstChild(segment)
			if not child then
				error("No module " .. segment .. " in " .. node:GetFullName())
			end
			node = child
		end
	end
	return node
end

-- Runs a Script (e.g. Main.server.luau) the way Roblox would.
function Runtime:RunScript(path: string)
	local inst = self:Resolve(path)
	local chunk = luau.load(fs.readFile(inst._sourcePath), {
		debugName = inst._sourcePath,
		environment = self:_makeEnv(inst),
		injectGlobals = false,
	})
	return chunk()
end

function Runtime:Advance(seconds: number)
	self.Clock.Now += seconds
	self.Clock.Mono += seconds
end

return Runtime
