local task = require("@lune/task")
--[[
	ServerBoot: boots the real server services inside a fresh Runtime for
	tests (Init only; background loops are not started), and offers helpers
	to add players and deliver receipts.
]]

local ServerBoot = {}

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
	"Remotes",
}

function ServerBoot.new(t, options)
	options = options or {}
	local rt = t.runtime(options)
	if options.Configure then
		options.Configure(rt)
	end
	local Store = rt:Require("Server/Lib/Store")
	Store.BackoffBase = 0
	local Net = rt:Require("Shared/Net")
	Net.Init()
	local boot = { rt = rt }
	function boot.svc(name)
		return rt:Require("Server/Services/" .. name)
	end
	for _, name in ORDER do
		local service = boot.svc(name)
		if service.Init then
			service.Init()
		end
	end
	boot.BottomService = boot.svc("BottomService")
	boot.BottomService.Speed = 1e6 -- reveal timeline runs instantly in tests
	local players = rt:Service("Players")
	function boot.addPlayer(userId, name)
		local player = players:_add(userId, name)
		return player
	end
	function boot.waitLoaded(player, maxFrames)
		local DataService = boot.svc("DataService")
		for _ = 1, maxFrames or 200 do
			if DataService.Get(player) then
				return DataService.Get(player)
			end
			task.wait()
		end
		return nil
	end
	function boot.removePlayer(player)
		players:_remove(player)
	end
	function boot.data(player)
		return boot.svc("DataService").Get(player)
	end
	function boot.receipt(player, itemId, purchaseId)
		local Catalog = rt:Require("Shared/Catalog")
		local item = Catalog.Get(itemId)
		local mps = rt:Service("MarketplaceService")
		return mps:_receipt(player.UserId, item.ProductId, purchaseId or ("P-" .. itemId .. "-" .. tostring(os.clock())), item.Price)
	end
	function boot.store(name)
		local dss = rt:Service("DataStoreService")
		return dss:GetDataStore(name)
	end
	boot.GRANTED = rt:Require("Shared/Config") and require("@lune/roblox").Enum.ProductPurchaseDecision.PurchaseGranted
	boot.NOT_YET = require("@lune/roblox").Enum.ProductPurchaseDecision.NotProcessedYet
	return boot
end

return ServerBoot
