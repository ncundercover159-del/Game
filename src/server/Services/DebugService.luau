--[[
	DebugService: Studio test-mode commands (Config.IsTestMode() only; the
	remote refuses everything in a live server).

	  AddMetres n            add n metres (not counted as contribution)
	  JumpPercent p          move the hole forward to p% of the target
	  TriggerFind            dig exactly to the next buried find
	  TriggerBottom          dig to the bottom
	  SimultaneousDigs n     land n Big One digs in the same frame at the
	                         bottom and report how many bottom events fired
	  ResetHole              restart this cycle with a new seed
	  FireSequence id        perform one dig sequence (Catalog dig id)
	  FireAll                all 11 sequences back to back (Dig Director test)
	  ReplayPurchase         re-deliver your last test receipt (must grant nothing)
	  GiftLeaveTest userId   queue a gift for userId as if they left mid-purchase
	  GrantShards n, NextDay, ExpireBoosts, FillPool, ToggleClub,
	  FakeContributors n, SaveNow, WipeProfile, Status
	ReferenceCamera is client-side (local showcase, see DECISIONS.md).
]]

local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local Catalog = require(Shared.Catalog)

local Services = script.Parent
local function svc(name)
	return require(Services[name])
end

local DebugService = {}

local function debugSource()
	return { Kind = "Debug", Name = "Debug", Contributes = false }
end

local commands = {}

function commands.AddMetres(_player, n)
	n = tonumber(n) or 100
	local applied, banked = svc("HoleService").AddMetres(math.max(0, n), debugSource())
	return string.format("added %.1f m (banked %.1f)", applied, banked)
end

function commands.JumpPercent(_player, p)
	local HoleService = svc("HoleService")
	p = math.clamp(tonumber(p) or 50, 0, 100)
	local want = HoleService.Target * p / 100
	if want <= HoleService.Depth then
		return "already deeper than that (use ResetHole first)"
	end
	HoleService.AddMetres(want - HoleService.Depth, debugSource())
	return string.format("depth now %.1f m", HoleService.Depth)
end

function commands.TriggerFind(_player)
	local HoleService = svc("HoleService")
	for _, placement in HoleService.Placements do
		if not placement.Unearthed and placement.Depth > HoleService.Depth then
			HoleService.AddMetres(placement.Depth - HoleService.Depth, debugSource())
			return "dug to " .. placement.FindId .. " at " .. placement.Depth .. " m"
		end
	end
	return "no buried finds left this cycle"
end

function commands.TriggerBottom(_player)
	local HoleService = svc("HoleService")
	if HoleService.State ~= "Digging" then
		return "already " .. HoleService.State
	end
	HoleService.AddMetres(HoleService.Target - HoleService.Depth, debugSource())
	return "bottom reached"
end

function commands.SimultaneousDigs(player, n)
	n = math.clamp(tonumber(n) or 20, 2, 100)
	local HoleService = svc("HoleService")
	local BottomService = svc("BottomService")
	if HoleService.State ~= "Digging" then
		return "wait for the hole to be in Digging state"
	end
	local cycle = HoleService.Cycle
	local remaining = HoleService.Target - HoleService.Depth
	if remaining > 50 then
		HoleService.AddMetres(remaining - 50, debugSource())
	end
	local item = Catalog.Get("dig_bigone")
	-- No yields between these calls: they land in the same frame.
	for _ = 1, n do
		svc("DigService").Perform({
			Item = item,
			Buyer = { UserId = player.UserId, Name = player.DisplayName },
			Performer = player,
			Kind = "Debug",
			Contributes = false,
		})
	end
	return string.format(
		"%d digs landed together; bottom events fired for cycle %d: %d; banked %.0f m for the next hole",
		n,
		cycle,
		BottomService.FireCount[cycle] or 0,
		HoleService.BankedMetres()
	)
end

function commands.ResetHole(_player)
	local HoleService = svc("HoleService")
	local cycle = HoleService.Cycle
	HoleService.SetupCycle(cycle)
	HoleService.TriggeredCycle = cycle - 1
	svc("BottomService").FireCount[cycle] = nil
	svc("PlaqueService").Clear()
	require(Shared.Net).Event("HoleEvent"):FireAllClients({ Type = "Cycle", Snapshot = HoleService.PublicState(true) })
	return "hole reset (same cycle, new seed " .. HoleService.Seed .. ")"
end

function commands.FireSequence(player, id)
	local item = Catalog.Get(tostring(id))
	if not item or item.Category ~= "Dig" then
		return "unknown dig id"
	end
	svc("DigService").Perform({
		Item = item,
		Buyer = { UserId = player.UserId, Name = player.DisplayName },
		Performer = player,
		Kind = "Debug",
		Contributes = false,
	})
	return "fired " .. item.Id
end

function commands.FireAll(player)
	task.spawn(function()
		for _, id in Catalog.DigOrder do
			commands.FireSequence(player, id)
			task.wait(0.4)
		end
	end)
	return "firing all 11 sequences 0.4 s apart"
end

function commands.ReplayPurchase(player)
	local DataService = svc("DataService")
	local data = DataService.Get(player)
	local beforeDepth = svc("HoleService").Depth
	local beforeRecent = data and #data.RecentPurchases or 0
	local beforeLifetime = data and data.Stats.LifetimeMetres or 0
	local decision, purchaseId = svc("PurchaseService").ReplayLastTestReceipt(player)
	if not decision then
		return "no test purchase to replay yet"
	end
	return string.format(
		"replayed %s -> %s; depth change %.1f m, lifetime change %.1f m, new receipts %d (all must be 0)",
		purchaseId,
		decision.Name,
		svc("HoleService").Depth - beforeDepth,
		(data and data.Stats.LifetimeMetres or 0) - beforeLifetime,
		(data and #data.RecentPurchases or 0) - beforeRecent
	)
end

function commands.GiftLeaveTest(player, userId)
	userId = tonumber(userId)
	if not userId then
		return "usage: GiftLeaveTest <recipient userId>"
	end
	local item = Catalog.Get("skin_neon")
	svc("GiftService").Queue(userId, {
		Id = "TEST-LEAVE-" .. tostring(os.time()),
		Kind = "Item",
		ItemId = item.Id,
		FromUserId = player.UserId,
		FromName = player.DisplayName,
		T = os.time(),
	})
	local recipient = Players:GetPlayerByUserId(userId)
	if recipient then
		local delivered = svc("GiftService").Deliver(recipient)
		return string.format("queued and delivered %d gift(s) to %s", delivered, recipient.DisplayName)
	end
	return "queued; it will be delivered when that player joins"
end

function commands.GrantShards(player, n)
	svc("ShardService").Add(player, math.clamp(tonumber(n) or 500, 1, 100000), "Debug")
	return "shards granted"
end

function commands.NextDay(player)
	local data = svc("DataService").Get(player)
	if data then
		data.Daily.LastDay -= 1
		data.Club.LastFreePebbleDay -= 1
		svc("DataService").Push(player)
	end
	return "daily reward and club pebble are claimable again"
end

function commands.ExpireBoosts(player)
	local data = svc("DataService").Get(player)
	if data then
		data.Boosts.PersonalExpiry = 0
		svc("DataService").Push(player)
	end
	svc("BoostService").Server.Until = 0
	return "boosts expired"
end

function commands.FillPool(_player)
	local PoolService = svc("PoolService")
	PoolService.Add(Config.Pool.FillRobux - PoolService.Value)
	return "pool filled"
end

function commands.ToggleClub(player)
	local data = svc("DataService").Get(player)
	svc("EntitlementService").SetTestClub(player, not (data and data.Flags.TestClub))
	return "club " .. tostring(data and data.Flags.TestClub)
end

function commands.FakeContributors(_player, n)
	local HoleService = svc("HoleService")
	n = math.clamp(tonumber(n) or 8, 1, 30)
	for i = 1, n do
		HoleService.AddMetres(5 * i, {
			Kind = "Dig",
			UserId = -i,
			Name = "TestDigger" .. i,
			Base = 5 * i,
		})
	end
	return string.format("%d fake contributors added", n)
end

function commands.SaveNow(player)
	return "saved: " .. tostring(svc("DataService").SaveAsync(player))
end

function commands.WipeProfile(player)
	local DataService = svc("DataService")
	local data = DataService.Get(player)
	if not data then
		return "no profile"
	end
	local fresh = DataService.Template()
	-- keep the ledgers so idempotency survives a wipe
	fresh.Ledger = data.Ledger
	fresh.LedgerOrder = data.LedgerOrder
	fresh.GiftReceipts = data.GiftReceipts
	for k in data do
		data[k] = nil
	end
	for k, v in fresh do
		data[k] = v
	end
	DataService.MarkDirty(player)
	DataService.Push(player)
	svc("CosmeticsService").ApplyAttributes(player)
	svc("WorldService").RefreshBay(player)
	return "profile wiped (ledgers kept)"
end

function commands.Status(_player)
	local HoleService = svc("HoleService")
	return string.format(
		"cycle %d, %s, depth %.1f / %d m, seed %d, banked %.1f m, finds unearthed %d/%d",
		HoleService.Cycle,
		HoleService.State,
		HoleService.Depth,
		HoleService.Target,
		HoleService.Seed,
		HoleService.BankedMetres(),
		(function()
			local n = 0
			for _, p in HoleService.Placements do
				if p.Unearthed then
					n += 1
				end
			end
			return n
		end)(),
		#HoleService.Placements
	)
end

DebugService.Commands = commands

function DebugService.Run(player: Player, command: string, args)
	if not Config.IsTestMode() then
		return { ok = false, reason = "Debug commands only work in Studio test mode." }
	end
	local fn = commands[command]
	if not fn then
		return { ok = false, reason = "Unknown command " .. tostring(command) }
	end
	local arg = type(args) == "table" and args[1] or args
	local ok, result = pcall(fn, player, arg)
	if not ok then
		return { ok = false, reason = tostring(result) }
	end
	print(string.format("[Debug] %s %s -> %s", command, tostring(arg), tostring(result)))
	return { ok = true, result = result }
end

return DebugService
