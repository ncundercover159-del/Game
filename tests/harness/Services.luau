--[[
	Mock Roblox services for Lune tests. Each mock implements the subset of
	the real API the game uses, records traffic for assertions, and supports
	failure injection where the real service can fail (DataStores, filtering).

	MemoryStoreService and MessagingService are deliberately booby-trapped:
	any use throws, which enforces the "no cross-server counter / no purchase
	broadcast" rule at test time.
]]

local serde = require("@lune/serde")
local roblox = require("@lune/roblox")
local MockInstance = require("./MockInstance")

local Signal = MockInstance.Signal

local Services = {}

------------------------------------------------------------------------------
-- DataStore value validation (mirrors Roblox's JSON storage rules)
------------------------------------------------------------------------------
local function validate(value, path)
	local t = type(value)
	if t == "table" then
		local n = #value
		local count = 0
		local hasString, hasNumber = false, false
		for k, v in value do
			count += 1
			if type(k) == "string" then
				hasString = true
			elseif type(k) == "number" then
				hasNumber = true
				if k ~= math.floor(k) or k < 1 or k > n then
					error(string.format("DataStore value at %s has a non-array numeric key %s", path, tostring(k)))
				end
			else
				error(string.format("DataStore value at %s has a %s key", path, type(k)))
			end
			validate(v, path .. "." .. tostring(k))
		end
		if hasString and hasNumber then
			error("DataStore value at " .. path .. " mixes array and dictionary keys")
		end
		if hasNumber and count ~= n then
			error("DataStore value at " .. path .. " is a sparse array")
		end
	elseif t == "number" then
		if value ~= value or value == math.huge or value == -math.huge then
			error("DataStore value at " .. path .. " is NaN/inf")
		end
	elseif t ~= "string" and t ~= "boolean" and t ~= "nil" then
		error("DataStore value at " .. path .. " is a " .. t .. " (not JSON-serializable)")
	end
end

local function copy(value)
	if value == nil then
		return nil
	end
	validate(value, "root")
	return serde.decode("json", serde.encode("json", value))
end

------------------------------------------------------------------------------
-- DataStoreService
------------------------------------------------------------------------------
local MockStore = {}
MockStore.__index = MockStore

function MockStore.new(name)
	return setmetatable({
		Name = name,
		_data = {},
		_fail = { Get = 0, Set = 0, Update = 0, Remove = 0 },
		_calls = { Get = 0, Set = 0, Update = 0, Remove = 0 },
	}, MockStore)
end

function MockStore:_check(kind)
	self._calls[kind] += 1
	if self._fail[kind] > 0 then
		self._fail[kind] -= 1
		error("MockDataStore: injected " .. kind .. " failure on " .. self.Name)
	end
end

function MockStore:GetAsync(key)
	self:_check("Get")
	return copy(self._data[tostring(key)])
end

function MockStore:SetAsync(key, value)
	self:_check("Set")
	self._data[tostring(key)] = copy(value)
end

function MockStore:UpdateAsync(key, transform)
	self:_check("Update")
	local old = copy(self._data[tostring(key)])
	local new = transform(old, { Version = "1" })
	if new == nil then
		return nil
	end
	self._data[tostring(key)] = copy(new)
	return copy(new)
end

function MockStore:IncrementAsync(key, delta)
	self:_check("Update")
	local v = (self._data[tostring(key)] or 0) + (delta or 1)
	self._data[tostring(key)] = v
	return v
end

function MockStore:RemoveAsync(key)
	self:_check("Remove")
	local old = self._data[tostring(key)]
	self._data[tostring(key)] = nil
	return copy(old)
end

function MockStore:GetSortedAsync(ascending, pageSize)
	self:_check("Get")
	local rows = {}
	for k, v in self._data do
		table.insert(rows, { key = k, value = v })
	end
	table.sort(rows, function(a, b)
		if ascending then
			return a.value < b.value
		end
		return a.value > b.value
	end)
	local page = {}
	for i = 1, math.min(pageSize or 10, #rows) do
		table.insert(page, rows[i])
	end
	return {
		IsFinished = true,
		GetCurrentPage = function()
			return page
		end,
		AdvanceToNextPageAsync = function() end,
	}
end

function Services.DataStoreService()
	local svc = MockInstance.new("DataStoreService")
	svc.Name = "DataStoreService"
	local stores = {}
	rawget(svc, "_props").GetDataStore = function(_, name, scope)
		local key = name .. "/" .. tostring(scope or "global")
		stores[key] = stores[key] or MockStore.new(name)
		return stores[key]
	end
	rawget(svc, "_props").GetOrderedDataStore = function(_, name, scope)
		local key = "ordered:" .. name .. "/" .. tostring(scope or "global")
		stores[key] = stores[key] or MockStore.new(name)
		return stores[key]
	end
	rawget(svc, "_props")._stores = stores
	return svc
end

------------------------------------------------------------------------------
-- Players
------------------------------------------------------------------------------
function Services.Players()
	local svc = MockInstance.new("Players")
	svc.Name = "Players"
	local p = rawget(svc, "_props")
	p.PlayerAdded = Signal.new("PlayerAdded")
	p.PlayerRemoving = Signal.new("PlayerRemoving")
	p.UserSubscriptionStatusChanged = Signal.new("UserSubscriptionStatusChanged")
	p.MaxPlayers = 30
	p.GetPlayers = function(self)
		local list = {}
		for _, child in self:GetChildren() do
			if child.ClassName == "Player" then
				table.insert(list, child)
			end
		end
		return list
	end
	p.GetPlayerByUserId = function(self, userId)
		for _, player in self:GetPlayers() do
			if player.UserId == userId then
				return player
			end
		end
		return nil
	end
	p.GetNameFromUserIdAsync = function(_, userId)
		return "User" .. tostring(userId)
	end
	-- Test helpers
	p._add = function(self, userId, name)
		local player = MockInstance.new("Player")
		player.Name = name or ("Player" .. userId)
		player.DisplayName = name or ("Player" .. userId)
		player.UserId = userId
		player.AccountAge = 100
		player.MembershipType = roblox.Enum.MembershipType.None
		player.Parent = self
		self.PlayerAdded:Fire(player)
		return player
	end
	p._remove = function(self, player)
		self.PlayerRemoving:Fire(player)
		player.Parent = nil
	end
	return svc
end

------------------------------------------------------------------------------
-- MarketplaceService
------------------------------------------------------------------------------
function Services.MarketplaceService()
	local svc = MockInstance.new("MarketplaceService")
	svc.Name = "MarketplaceService"
	local p = rawget(svc, "_props")
	p.PromptProductPurchaseFinished = Signal.new("PromptProductPurchaseFinished")
	p.PromptGamePassPurchaseFinished = Signal.new("PromptGamePassPurchaseFinished")
	p.PromptSubscriptionPurchaseFinished = Signal.new("PromptSubscriptionPurchaseFinished")
	p._prompts = {}
	p._passPrompts = {}
	p._ownedPasses = {}
	p._subscriptions = {}
	p._prices = {}
	p.PromptProductPurchase = function(self, player, productId)
		table.insert(self._prompts, { player = player, productId = productId })
	end
	p.PromptGamePassPurchase = function(self, player, passId)
		table.insert(self._passPrompts, { player = player, passId = passId })
	end
	p.PromptSubscriptionPurchase = function(self, player, subId)
		table.insert(self._prompts, { player = player, subscriptionId = subId })
	end
	p.UserOwnsGamePassAsync = function(self, userId, passId)
		local owned = self._ownedPasses[userId]
		return owned ~= nil and owned[passId] == true
	end
	p.GetProductInfo = function(self, id, _infoType)
		return { PriceInRobux = self._prices[id] or 0, Name = "Product " .. tostring(id) }
	end
	p.GetUserSubscriptionStatusAsync = function(self, player, subId)
		local subs = self._subscriptions[player.UserId]
		local on = subs ~= nil and subs[subId] == true
		return { IsSubscribed = on, IsRenewing = on }
	end
	-- Test helper: deliver a receipt through the game's ProcessReceipt.
	p._receipt = function(self, userId, productId, purchaseId, price)
		assert(self.ProcessReceipt, "ProcessReceipt was never assigned")
		return self.ProcessReceipt({
			PlayerId = userId,
			ProductId = productId,
			PurchaseId = purchaseId,
			CurrencySpent = price or 0,
			CurrencyType = roblox.Enum.CurrencyType.Robux,
			PlaceIdWherePurchased = 0,
		})
	end
	return svc
end

------------------------------------------------------------------------------
-- RunService
------------------------------------------------------------------------------
function Services.RunService()
	local svc = MockInstance.new("RunService")
	svc.Name = "RunService"
	local p = rawget(svc, "_props")
	p._studio = true
	p._server = true
	p.IsStudio = function(self)
		return self._studio
	end
	p.IsServer = function(self)
		return self._server
	end
	p.IsClient = function(self)
		return not self._server
	end
	p.IsRunning = function()
		return true
	end
	p.IsRunMode = function()
		return false
	end
	p.Heartbeat = Signal.new("Heartbeat")
	p.Stepped = Signal.new("Stepped")
	p.PreSimulation = Signal.new("PreSimulation")
	p.PostSimulation = Signal.new("PostSimulation")
	p.RenderStepped = Signal.new("RenderStepped")
	p.BindToRenderStep = function() end
	p.UnbindFromRenderStep = function() end
	return svc
end

------------------------------------------------------------------------------
-- HttpService
------------------------------------------------------------------------------
function Services.HttpService()
	local svc = MockInstance.new("HttpService")
	svc.Name = "HttpService"
	local p = rawget(svc, "_props")
	local counter = 0
	p.GenerateGUID = function(_, curly)
		counter += 1
		local g = string.format("00000000-0000-4000-8000-%012d", counter)
		if curly == false then
			return g
		end
		return "{" .. g .. "}"
	end
	p.JSONEncode = function(_, v)
		return serde.encode("json", v)
	end
	p.JSONDecode = function(_, s)
		return serde.decode("json", s)
	end
	return svc
end

------------------------------------------------------------------------------
-- TextService (filter mock: words in _blocklist become hashes)
------------------------------------------------------------------------------
function Services.TextService()
	local svc = MockInstance.new("TextService")
	svc.Name = "TextService"
	local p = rawget(svc, "_props")
	p._blocklist = { "badword" }
	p._fail = 0
	p.FilterStringAsync = function(self, text, _fromUserId, _context)
		if self._fail > 0 then
			self._fail -= 1
			error("MockTextService: injected filter failure")
		end
		local filtered = text
		for _, word in self._blocklist do
			filtered = filtered:gsub(word, string.rep("#", #word))
		end
		return {
			GetNonChatStringForBroadcastAsync = function()
				return filtered
			end,
			GetNonChatStringForUserAsync = function()
				return filtered
			end,
			GetChatForUserAsync = function()
				return filtered
			end,
		}
	end
	p.GetTextSize = function()
		return roblox.Vector2.new(100, 20)
	end
	return svc
end

------------------------------------------------------------------------------
-- AnalyticsService (records every call)
------------------------------------------------------------------------------
function Services.AnalyticsService()
	local svc = MockInstance.new("AnalyticsService")
	svc.Name = "AnalyticsService"
	local p = rawget(svc, "_props")
	p._log = {}
	for _, method in {
		"LogCustomEvent",
		"LogEconomyEvent",
		"LogFunnelStepEvent",
		"LogOnboardingFunnelStepEvent",
		"LogProgressionEvent",
		"LogProgressionStartEvent",
		"LogProgressionCompleteEvent",
		"LogProgressionFailEvent",
	} do
		p[method] = function(self, ...)
			table.insert(self._log, { method = method, args = table.pack(...) })
		end
	end
	return svc
end

------------------------------------------------------------------------------
-- CollectionService
------------------------------------------------------------------------------
function Services.CollectionService()
	local svc = MockInstance.new("CollectionService")
	svc.Name = "CollectionService"
	local p = rawget(svc, "_props")
	local tagged = {}
	local added, removed = {}, {}
	local function signalFor(map, tag)
		map[tag] = map[tag] or Signal.new("Tag")
		return map[tag]
	end
	p.AddTag = function(_, inst, tag)
		inst:AddTag(tag)
		tagged[tag] = tagged[tag] or {}
		if not table.find(tagged[tag], inst) then
			table.insert(tagged[tag], inst)
			signalFor(added, tag):Fire(inst)
		end
	end
	p.RemoveTag = function(_, inst, tag)
		inst:RemoveTag(tag)
		local list = tagged[tag]
		local i = list and table.find(list, inst)
		if i then
			table.remove(list, i)
			signalFor(removed, tag):Fire(inst)
		end
	end
	p.HasTag = function(_, inst, tag)
		return inst:HasTag(tag)
	end
	p.GetTagged = function(_, tag)
		local out = {}
		for _, inst in tagged[tag] or {} do
			if not rawget(inst, "_destroyed") then
				table.insert(out, inst)
			end
		end
		return out
	end
	p.GetInstanceAddedSignal = function(_, tag)
		return signalFor(added, tag)
	end
	p.GetInstanceRemovedSignal = function(_, tag)
		return signalFor(removed, tag)
	end
	return svc
end

------------------------------------------------------------------------------
-- TweenService (applies goals immediately so tests are deterministic)
------------------------------------------------------------------------------
function Services.TweenService()
	local svc = MockInstance.new("TweenService")
	svc.Name = "TweenService"
	rawget(svc, "_props").Create = function(_, inst, _info, goals)
		local tween = MockInstance.new("Tween")
		local tp = rawget(tween, "_props")
		tp.Completed = Signal.new("Completed")
		tp.Play = function()
			for k, v in goals do
				inst[k] = v
			end
			tp.Completed:Fire(roblox.Enum.PlaybackState.Completed)
		end
		tp.Cancel = function() end
		tp.Pause = function() end
		return tween
	end
	rawget(svc, "_props").GetValue = function(_, alpha)
		return alpha
	end
	return svc
end

------------------------------------------------------------------------------
-- Forbidden services: any use throws.
------------------------------------------------------------------------------
local function forbidden(name)
	local svc = MockInstance.new(name)
	svc.Name = name
	setmetatable(rawget(svc, "_props"), {
		__index = function(_, key)
			if key == "Name" or key == "ClassName" or key == "Parent" then
				return nil
			end
			return function()
				error(string.format("POLICY: %s:%s used (no cross-server counters or purchase broadcasts)", name, tostring(key)))
			end
		end,
	})
	return svc
end

function Services.MemoryStoreService()
	return forbidden("MemoryStoreService")
end

function Services.MessagingService()
	return forbidden("MessagingService")
end

------------------------------------------------------------------------------
-- Misc
------------------------------------------------------------------------------
function Services.PolicyService()
	local svc = MockInstance.new("PolicyService")
	svc.Name = "PolicyService"
	rawget(svc, "_props").GetPolicyInfoForPlayerAsync = function()
		return {
			ArePaidRandomItemsRestricted = false,
			IsPaidItemTradingAllowed = true,
			AreAdsAllowed = false,
			AllowedExternalLinkReferences = {},
			IsSubjectToChinaPolicies = false,
			IsContentSharingAllowed = true,
		}
	end
	return svc
end

function Services.Generic(name)
	local svc = MockInstance.new(name)
	svc.Name = name
	return svc
end

return Services
