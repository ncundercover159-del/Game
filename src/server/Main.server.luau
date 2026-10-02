--[[
	Keep Digging! server bootstrap.
	Creates the remotes, then initialises every service in dependency order
	(Init: wiring, no yields) and starts their loops (Start).
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Net = require(Shared.Net)

Net.Init()

local Services = script.Parent.Services

local ORDER = {
	"Analytics",
	"DataService",
	"HoleService",
	"FeedService",
	"EntitlementService",
	"ClubService",
	"BoostService",
	"SeasonService",
	"ShardService",
	"CosmeticsService",
	"DigService",
	"FindService",
	"PoolService",
	"LeaderboardService",
	"PlaqueService",
	"BottomService",
	"GiftService",
	"PurchaseService",
	"FreePathService",
	"StationService",
	"ObbyService",
	"MinigameService",
	"WorldService",
	"DebugService",
	"AssetSwapService",
	"Remotes",
}

local modules = {}
for _, name in ORDER do
	local module = Services:FindFirstChild(name)
	if module then
		modules[name] = require(module)
	else
		warn("[Main] missing service " .. name)
	end
end

for _, name in ORDER do
	local service = modules[name]
	if service and service.Init then
		local ok, err = pcall(service.Init)
		if not ok then
			warn(string.format("[Main] %s.Init failed: %s", name, tostring(err)))
		end
	end
end

for _, name in ORDER do
	local service = modules[name]
	if service and service.Start then
		task.spawn(function()
			local ok, err = pcall(service.Start)
			if not ok then
				warn(string.format("[Main] %s.Start failed: %s", name, tostring(err)))
			end
		end)
	end
end

print(string.format("[Keep Digging!] server ready (v%s, test mode: %s)", Config.Version, tostring(Config.IsTestMode())))
