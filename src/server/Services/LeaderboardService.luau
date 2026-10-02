--[[
	LeaderboardService: contributor leaderboards.
	  * This Hole  - live, this server's HoleService contributions.
	  * This Season / All Time - OrderedDataStores. Writes are throttled per
	    player (only when changed, at most every WriteIntervalSeconds, plus on
	    leave). Reads are cached and refreshed every ReadIntervalSeconds;
	    display only.
	Leaderboards count base metres only (see Economy).
]]

local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local Net = require(Shared.Net)
local Store = require(script.Parent.Parent.Lib.Store)

local Services = script.Parent
local function svc(name)
	return require(Services[name])
end

local LeaderboardService = {}

LeaderboardService.Cache = { AllTime = {}, Season = {} }

local dirty = {} -- [Player] = true
local lastWrite = {} -- [userId] = os.clock()
local written = {} -- [userId] = { AllTime = n, Season = n }
local names = {} -- [userId] = name
local holeDirty = true

local allTimeStore, seasonStore

local function stores()
	if not allTimeStore then
		allTimeStore = Store.GetOrdered(Config.Leaderboards.AllTimeStore)
		seasonStore = Store.GetOrdered(Config.Leaderboards.SeasonStorePrefix .. Config.Season.Id)
	end
	return allTimeStore, seasonStore
end

function LeaderboardService.MarkDirty(player: Player)
	dirty[player] = true
end

local function write(player: Player)
	local data = svc("DataService").Get(player)
	if not data then
		return
	end
	local allTime = math.floor(data.Stats.LifetimeMetres)
	local season = math.floor(data.Stats.SeasonMetres[Config.Season.Id] or 0)
	local prev = written[player.UserId] or {}
	local a, s = stores()
	local key = "u" .. tostring(player.UserId)
	if prev.AllTime ~= allTime then
		local ok = Store.Retry("lb all-time", 2, function()
			a:SetAsync(key, allTime)
		end)
		if ok then
			prev.AllTime = allTime
		end
	end
	if prev.Season ~= season then
		local ok = Store.Retry("lb season", 2, function()
			s:SetAsync(key, season)
		end)
		if ok then
			prev.Season = season
		end
	end
	written[player.UserId] = prev
	lastWrite[player.UserId] = os.clock()
	dirty[player] = nil
end

local function nameFor(userId: number): string
	local player = Players:GetPlayerByUserId(userId)
	if player then
		names[userId] = player.DisplayName
		return player.DisplayName
	end
	if names[userId] then
		return names[userId]
	end
	local ok, name = pcall(Players.GetNameFromUserIdAsync, Players, userId)
	names[userId] = ok and name or ("Digger " .. tostring(userId))
	return names[userId]
end

local function readBoard(store)
	local ok, pages = Store.Retry("lb read", 2, function()
		return store:GetSortedAsync(false, Config.Leaderboards.Rows)
	end)
	if not ok or not pages then
		return nil
	end
	local rows = {}
	for rank, entry in pages:GetCurrentPage() do
		local userId = tonumber(tostring(entry.key):match("%d+"))
		if userId then
			table.insert(rows, { Rank = rank, UserId = userId, Name = nameFor(userId), Metres = entry.value })
		end
	end
	return rows
end

function LeaderboardService.Refresh()
	local a, s = stores()
	local allTime = readBoard(a)
	if allTime then
		LeaderboardService.Cache.AllTime = allTime
	end
	local season = readBoard(s)
	if season then
		LeaderboardService.Cache.Season = season
	end
end

function LeaderboardService.Payload()
	local thisHole = {}
	for rank, row in svc("HoleService").TopContributors(Config.Leaderboards.Rows) do
		thisHole[rank] = { Rank = rank, UserId = row.UserId, Name = row.Name, Metres = row.Metres }
	end
	return {
		ThisHole = thisHole,
		AllTime = LeaderboardService.Cache.AllTime,
		Season = LeaderboardService.Cache.Season,
		SeasonName = Config.Season.Name,
		CycleSeconds = Config.Leaderboards.BoardCycleSeconds,
	}
end

local function broadcast()
	Net.Event("Boards"):FireAllClients(LeaderboardService.Payload())
end

function LeaderboardService.Init()
	svc("HoleService").ContributionsChanged:Connect(function()
		holeDirty = true
	end)
	svc("DataService").Releasing:Connect(function(player)
		task.spawn(write, player)
	end)
	Players.PlayerRemoving:Connect(function(player)
		dirty[player] = nil
	end)
end

function LeaderboardService.Start()
	task.spawn(function()
		while true do
			task.wait(5)
			local now = os.clock()
			for player in dirty do
				if player.Parent and now - (lastWrite[player.UserId] or 0) >= Config.Leaderboards.WriteIntervalSeconds then
					task.spawn(write, player)
					task.wait(0.5)
				end
			end
		end
	end)
	task.spawn(function()
		while true do
			LeaderboardService.Refresh()
			broadcast()
			task.wait(Config.Leaderboards.ReadIntervalSeconds)
		end
	end)
	task.spawn(function()
		while true do
			task.wait(3)
			if holeDirty then
				holeDirty = false
				broadcast()
			end
		end
	end)
end

LeaderboardService._write = write

return LeaderboardService
