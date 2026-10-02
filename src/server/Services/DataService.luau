--[[
	DataService: one versioned profile per player.

	* Session locking: the DataStore value holds { Data, Session = { JobId, Time } }.
	  Loading takes the lock inside UpdateAsync; a lock held by another live
	  server is respected (retry with backoff) until it is stale
	  (Config.Data.SessionLockStaleSeconds) or the final attempt, which
	  takes it over. Saves verify the lock is still ours; if another server
	  took it, this server stops writing and asks the player to rejoin.
	* Saves are serialized per profile; concurrent requests coalesce.
	* Purchase ledger: PurchaseIds are recorded in the profile. A PurchaseId is
	  only "confirmed" after the save that contains it succeeds, which is
	  what ProcessReceipt waits for before returning PurchaseGranted.
	* Migration-safe: Version field + migrations + reconcile against the
	  template, so new fields appear on old profiles automatically.
]]

local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local Signal = require(Shared.Util.Signal)
local Net = require(Shared.Net)
local Store = require(script.Parent.Parent.Lib.Store)

local DataService = {}

DataService.Loaded = Signal.new() -- (player, data)
DataService.Releasing = Signal.new() -- (player, data) fired before the final save

local profiles = {} -- [Player] = profile record
local store = nil
local pushQueued = {} -- [Player] = true

------------------------------------------------------------------------------
-- Schema
------------------------------------------------------------------------------
function DataService.Template()
	return {
		Version = Config.Data.SchemaVersion,
		Owned = {},
		AutoDiggerLevel = 0,
		Equipped = {},
		Boosts = { PersonalExpiry = 0 },
		Shards = 0,
		Season = {
			Id = Config.Season.Id,
			XP = 0,
			Premium = false,
			ClaimedFree = {},
			ClaimedPremium = {},
		},
		Daily = { LastDay = 0, Streak = 0 },
		Stats = {
			LifetimeMetres = 0,
			SeasonMetres = {},
			FreeMetres = 0,
			HolesBroken = 0,
			BiggestDig = 0,
			RobuxSpent = 0,
			Digs = 0,
			FindsUnearthed = 0,
			ObbyClears = 0,
			MinigameRounds = 0,
		},
		Collection = {},
		CollectionValue = 0,
		Titles = {},
		PlaqueMessage = "",
		FlagDesign = 1,
		NameColor = 0,
		Ledger = {},
		LedgerOrder = {},
		RecentPurchases = {},
		GiftReceipts = {},
		Flags = {},
		Club = { LastFreePebbleDay = 0 },
		Created = os.time(),
	}
end

-- Ordered list of migrations: Migrations[n] upgrades version n to n + 1.
local Migrations = {}

local function migrate(data)
	data.Version = data.Version or 1
	while data.Version < Config.Data.SchemaVersion do
		local step = Migrations[data.Version]
		if step then
			step(data)
		end
		data.Version += 1
	end
	return data
end

-- Fills any missing keys from the template (recursively for dictionaries).
local function reconcile(data, template)
	for key, value in template do
		if data[key] == nil then
			if type(value) == "table" then
				data[key] = table.clone(value)
			else
				data[key] = value
			end
		elseif type(value) == "table" and type(data[key]) == "table" and next(value) ~= nil then
			reconcile(data[key], value)
		end
	end
	return data
end

DataService._migrate = migrate
DataService._reconcile = reconcile

------------------------------------------------------------------------------
-- Load / save
------------------------------------------------------------------------------
local function keyFor(userId: number): string
	return "u_" .. tostring(userId)
end

local function getStore()
	if not store then
		store = Store.Get(Config.Data.ProfileStore)
	end
	return store
end

function DataService.LoadAsync(player: Player)
	local key = keyFor(player.UserId)
	local attempts = Config.Data.LoadRetries
	for attempt = 1, attempts do
		local lockedBy = nil
		local ok, result = pcall(function()
			return getStore():UpdateAsync(key, function(old)
				old = old or {}
				local now = os.time()
				local session = old.Session
				if
					session
					and session.JobId ~= game.JobId
					and (now - (session.Time or 0)) < Config.Data.SessionLockStaleSeconds
					and attempt < attempts
				then
					lockedBy = session
					return nil -- keep the other server's lock; retry later
				end
				local data = old.Data or DataService.Template()
				old.Data = reconcile(migrate(data), DataService.Template())
				old.Session = { JobId = game.JobId, Time = now }
				return old
			end)
		end)
		if ok and result and not lockedBy then
			return result.Data
		end
		if not ok then
			warn(string.format("[DataService] load attempt %d for %s failed: %s", attempt, key, tostring(result)))
		end
		if player.Parent == nil then
			return nil
		end
		task.wait(lockedBy and (5 * Store.BackoffBase) or Store.BackoffBase * (2 ^ (attempt - 1)))
	end
	return nil
end

-- Saves the profile. Returns true only when the write succeeded and the
-- session lock is still ours.
function DataService.SaveAsync(player: Player, release: boolean?): boolean
	local profile = profiles[player]
	if not profile or profile.LockLost then
		return false
	end
	while profile.Saving do
		task.wait(0.05)
	end
	profile.Saving = true
	local pendingIds = table.clone(profile.Unsaved)
	local lost = false
	local key = keyFor(player.UserId)
	local ok = Store.Retry("save " .. key, 3, function()
		getStore():UpdateAsync(key, function(old)
			old = old or {}
			if old.Session and old.Session.JobId ~= game.JobId then
				lost = true
				return nil
			end
			local value = { Data = profile.Data }
			if not release then
				value.Session = { JobId = game.JobId, Time = os.time() }
			end
			return value
		end)
	end)
	profile.Saving = false
	if lost then
		profile.LockLost = true
		warn("[DataService] session lock for " .. key .. " was taken by another server")
		player:Kick("Your data was opened in another server. Please rejoin.")
		return false
	end
	if ok then
		for id in pendingIds do
			profile.Unsaved[id] = nil
		end
		profile.LastSave = os.time()
		profile.Dirty = false
	end
	return ok
end

------------------------------------------------------------------------------
-- Access
------------------------------------------------------------------------------
function DataService.Get(player: Player)
	local profile = profiles[player]
	return profile and profile.Data or nil
end

function DataService.IsLoaded(player: Player): boolean
	return profiles[player] ~= nil
end

function DataService.WaitFor(player: Player, timeout: number?)
	local deadline = os.clock() + (timeout or 20)
	while player.Parent ~= nil do
		local profile = profiles[player]
		if profile then
			return profile.Data
		end
		if os.clock() >= deadline then
			return nil
		end
		task.wait(0.1)
	end
	return nil
end

function DataService.MarkDirty(player: Player)
	local profile = profiles[player]
	if profile then
		profile.Dirty = true
	end
end

function DataService.LoadedPlayers()
	local list = {}
	for player in profiles do
		table.insert(list, player)
	end
	return list
end

------------------------------------------------------------------------------
-- Purchase ledger (idempotency)
------------------------------------------------------------------------------
function DataService.HasPurchase(player: Player, purchaseId: string): boolean
	local data = DataService.Get(player)
	return data ~= nil and data.Ledger[purchaseId] ~= nil
end

function DataService.IsPurchaseSaved(player: Player, purchaseId: string): boolean
	local profile = profiles[player]
	return profile ~= nil and profile.Data.Ledger[purchaseId] ~= nil and not profile.Unsaved[purchaseId]
end

function DataService.RecordPurchase(player: Player, purchaseId: string)
	local profile = profiles[player]
	assert(profile, "RecordPurchase: profile not loaded")
	local data = profile.Data
	if data.Ledger[purchaseId] == nil then
		data.Ledger[purchaseId] = os.time()
		table.insert(data.LedgerOrder, purchaseId)
		while #data.LedgerOrder > Config.Data.LedgerSize do
			local oldest = table.remove(data.LedgerOrder, 1)
			data.Ledger[oldest] = nil
		end
	end
	profile.Unsaved[purchaseId] = true
	profile.Dirty = true
end

-- Gift deliveries use their own ledger so a recipient is never granted twice.
function DataService.HasGiftReceipt(player: Player, id: string): boolean
	local data = DataService.Get(player)
	return data ~= nil and data.GiftReceipts[id] ~= nil
end

function DataService.RecordGiftReceipt(player: Player, id: string)
	local profile = profiles[player]
	assert(profile, "RecordGiftReceipt: profile not loaded")
	profile.Data.GiftReceipts[id] = os.time()
	profile.Unsaved[id] = true
	profile.Dirty = true
	-- keep the gift ledger bounded
	local count = 0
	local oldestId, oldestTime = nil, math.huge
	for gid, t in profile.Data.GiftReceipts do
		count += 1
		if t < oldestTime then
			oldestId, oldestTime = gid, t
		end
	end
	if count > Config.Data.LedgerSize and oldestId then
		profile.Data.GiftReceipts[oldestId] = nil
	end
end

function DataService.AddRecentPurchase(player: Player, entry)
	local data = DataService.Get(player)
	if not data then
		return
	end
	table.insert(data.RecentPurchases, 1, entry)
	while #data.RecentPurchases > Config.Data.RecentPurchases do
		table.remove(data.RecentPurchases)
	end
	DataService.MarkDirty(player)
end

------------------------------------------------------------------------------
-- Client view
------------------------------------------------------------------------------
function DataService.View(player: Player)
	local data = DataService.Get(player)
	if not data then
		return nil
	end
	return {
		Owned = data.Owned,
		AutoDiggerLevel = data.AutoDiggerLevel,
		Equipped = data.Equipped,
		Boosts = data.Boosts,
		Shards = data.Shards,
		Season = data.Season,
		Daily = data.Daily,
		Stats = data.Stats,
		Collection = data.Collection,
		CollectionValue = data.CollectionValue,
		Titles = data.Titles,
		PlaqueMessage = data.PlaqueMessage,
		FlagDesign = data.FlagDesign,
		NameColor = data.NameColor,
		RecentPurchases = data.RecentPurchases,
		Flags = data.Flags,
		Now = os.time(),
	}
end

-- Coalesces profile pushes to at most one per 0.2 s per player.
function DataService.Push(player: Player)
	if pushQueued[player] then
		return
	end
	pushQueued[player] = true
	task.delay(0.2, function()
		pushQueued[player] = nil
		if player.Parent and profiles[player] then
			Net.Event("Profile"):FireClient(player, DataService.View(player))
		end
	end)
end

------------------------------------------------------------------------------
-- Lifecycle
------------------------------------------------------------------------------
local function onPlayerAdded(player: Player)
	local data = DataService.LoadAsync(player)
	if player.Parent == nil then
		return
	end
	if not data then
		player:Kick("We couldn't load your save data. Please rejoin in a moment.")
		return
	end
	profiles[player] = {
		Data = data,
		Unsaved = {},
		Dirty = false,
		LastSave = os.time(),
		Saving = false,
		LockLost = false,
	}
	DataService.Loaded:Fire(player, data)
	DataService.Push(player)
end

local function onPlayerRemoving(player: Player)
	local profile = profiles[player]
	if not profile then
		return
	end
	DataService.Releasing:FireSync(player, profile.Data)
	DataService.SaveAsync(player, true)
	profiles[player] = nil
end

function DataService.Init()
	Players.PlayerAdded:Connect(onPlayerAdded)
	Players.PlayerRemoving:Connect(onPlayerRemoving)
	for _, player in Players:GetPlayers() do
		task.spawn(onPlayerAdded, player)
	end
end

function DataService.Start()
	task.spawn(function()
		while true do
			task.wait(Config.Data.AutosaveSeconds)
			for player, profile in profiles do
				if profile.Dirty or os.time() - profile.LastSave > 300 then
					task.spawn(DataService.SaveAsync, player, false)
					task.wait(0.25)
				end
			end
		end
	end)
	game:BindToClose(function()
		local pending = 0
		for player in profiles do
			pending += 1
			task.spawn(function()
				DataService.Releasing:FireSync(player, profiles[player] and profiles[player].Data)
				DataService.SaveAsync(player, true)
				pending -= 1
			end)
		end
		local deadline = os.clock() + 25
		while pending > 0 and os.clock() < deadline do
			task.wait(0.1)
		end
	end)
end

-- Test hook: run the join flow synchronously.
DataService._onPlayerAdded = onPlayerAdded
DataService._onPlayerRemoving = onPlayerRemoving

return DataService
