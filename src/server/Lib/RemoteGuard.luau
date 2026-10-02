--[[
	RemoteGuard: rate limiting and argument validation for every
	client->server remote. Handlers only ever see validated arguments.

	  RemoteGuard.OnEvent("StationSwing", handler, { validators... })
	  RemoteGuard.OnInvoke("RequestPurchase", handler, { validators... })

	Each player gets a token bucket per remote (Config.RateLimits). Rejected
	calls are dropped (events) or answer { ok = false, reason = "..." }
	(functions). Validators are functions (value) -> (ok, cleanedValue).
]]

local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local Net = require(Shared.Net)

local RemoteGuard = {}

local buckets = {} -- [player] = { [remote] = { tokens, time } }

local function limitFor(name: string)
	return Config.RateLimits[name] or Config.RateLimits.Default
end

function RemoteGuard.Allow(player: Player, name: string): boolean
	local limit = limitFor(name)
	local perPlayer = buckets[player]
	if not perPlayer then
		perPlayer = {}
		buckets[player] = perPlayer
	end
	local now = os.clock()
	local b = perPlayer[name]
	if not b then
		b = { tokens = limit.Burst, time = now }
		perPlayer[name] = b
	end
	b.tokens = math.min(limit.Burst, b.tokens + (now - b.time) * limit.Rate)
	b.time = now
	if b.tokens < 1 then
		return false
	end
	b.tokens -= 1
	return true
end

local function validateArgs(validators, ...)
	if not validators then
		return true, table.pack(...)
	end
	local args = table.pack(...)
	if args.n > #validators then
		return false, nil
	end
	local cleaned = { n = #validators }
	for i, validator in validators do
		local ok, value = validator(args[i])
		if not ok then
			return false, nil
		end
		cleaned[i] = value
	end
	return true, cleaned
end

function RemoteGuard.OnEvent(name: string, handler, validators)
	local remote = Net.Event(name)
	remote.OnServerEvent:Connect(function(player, ...)
		if not RemoteGuard.Allow(player, name) then
			return
		end
		local ok, args = validateArgs(validators, ...)
		if not ok then
			return
		end
		local success, err = pcall(handler, player, table.unpack(args, 1, args.n))
		if not success then
			warn(string.format("[RemoteGuard] %s handler error: %s", name, tostring(err)))
		end
	end)
	return remote
end

function RemoteGuard.OnInvoke(name: string, handler, validators)
	local remote = Net.Function(name)
	remote.OnServerInvoke = function(player, ...)
		if not RemoteGuard.Allow(player, name) then
			return { ok = false, reason = "Slow down a little!" }
		end
		local ok, args = validateArgs(validators, ...)
		if not ok then
			return { ok = false, reason = "Invalid request." }
		end
		local success, result = pcall(handler, player, table.unpack(args, 1, args.n))
		if not success then
			warn(string.format("[RemoteGuard] %s handler error: %s", name, tostring(result)))
			return { ok = false, reason = "Something went wrong. Please try again." }
		end
		return result
	end
	return remote
end

------------------------------------------------------------------------------
-- Validators: each returns (ok, cleanedValue)
------------------------------------------------------------------------------
local V = {}
RemoteGuard.V = V

function V.String(maxLen: number, optional: boolean?)
	return function(value)
		if value == nil and optional then
			return true, nil
		end
		if type(value) ~= "string" or #value > maxLen * 4 then
			return false
		end
		if utf8.len(value) == nil or utf8.len(value) > maxLen then
			return false
		end
		return true, value
	end
end

function V.Id(optional: boolean?)
	return function(value)
		if value == nil and optional then
			return true, nil
		end
		if type(value) ~= "string" or #value > 48 or not value:match("^[%w_]+$") then
			return false
		end
		return true, value
	end
end

function V.Number(min: number, max: number, optional: boolean?)
	return function(value)
		if value == nil and optional then
			return true, nil
		end
		if type(value) ~= "number" or value ~= value or value < min or value > max then
			return false
		end
		return true, value
	end
end

function V.Integer(min: number, max: number, optional: boolean?)
	return function(value)
		if value == nil and optional then
			return true, nil
		end
		if type(value) ~= "number" or value ~= math.floor(value) or value < min or value > max then
			return false
		end
		return true, value
	end
end

function V.Boolean(optional: boolean?)
	return function(value)
		if value == nil and optional then
			return true, nil
		end
		if type(value) ~= "boolean" then
			return false
		end
		return true, value
	end
end

function V.OneOf(options: { string }, optional: boolean?)
	local set = {}
	for _, o in options do
		set[o] = true
	end
	return function(value)
		if value == nil and optional then
			return true, nil
		end
		if type(value) ~= "string" or not set[value] then
			return false
		end
		return true, value
	end
end

-- A shallow table with a fixed schema; unknown keys are dropped.
function V.Shape(schema: { [string]: any }, optional: boolean?)
	return function(value)
		if value == nil then
			if optional then
				return true, nil
			end
			value = {}
		end
		if type(value) ~= "table" then
			return false
		end
		local count = 0
		for _ in value do
			count += 1
			if count > 16 then
				return false
			end
		end
		local cleaned = {}
		for key, validator in schema do
			local ok, v = validator(value[key])
			if not ok then
				return false
			end
			cleaned[key] = v
		end
		return true, cleaned
	end
end

-- Accepts any value (debug commands parse their own arguments).
function V.Any()
	return function(value)
		if type(value) == "table" then
			local count = 0
			for k, v in value do
				count += 1
				if count > 8 or (type(v) ~= "string" and type(v) ~= "number" and type(v) ~= "boolean") then
					return false
				end
			end
		end
		return true, value
	end
end

Players.PlayerRemoving:Connect(function(player)
	buckets[player] = nil
end)

return RemoteGuard
