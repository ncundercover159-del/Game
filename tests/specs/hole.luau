local task = require("@lune/task")
-- HoleService, the bottom event exactly-once guard, finds and contributions.
local ServerBoot = require("../harness/ServerBoot")

return function(t)
	t.test("depth never decreases and stops at the target; overflow is banked", function()
		local boot = ServerBoot.new(t)
		local hole = boot.svc("HoleService")
		hole.AddMetres(100, { Kind = "Debug" })
		t.eq(hole.Depth, 100)
		hole.AddMetres(0, { Kind = "Debug" })
		hole.AddMetres(-50, { Kind = "Debug" })
		t.eq(hole.Depth, 100, "no negative metres")
		local applied, banked = hole.AddMetres(hole.Target, { Kind = "Debug" })
		t.near(applied, hole.Target - 100, 1e-9, "applied up to the target")
		t.near(banked, 100, 1e-9, "overflow banked")
		t.eq(hole.State, "Revealing", "bottom reached")
	end)

	t.test("bottom event fires exactly once when 50 digs land together", function()
		local boot = ServerBoot.new(t)
		local hole = boot.svc("HoleService")
		local p = boot.addPlayer(401, "Ana")
		local Catalog = boot.rt:Require("Shared/Catalog")
		local item = Catalog.Get("dig_bigone")
		hole.AddMetres(hole.Target - 30, { Kind = "Debug" })
		local bottomFires = 0
		hole.BottomReached:Connect(function()
			bottomFires += 1
		end)
		local cycle = hole.Cycle
		for _ = 1, 50 do
			boot.svc("DigService").Perform({
				Item = item,
				Buyer = { UserId = p.UserId, Name = "Ana" },
				Performer = p,
				Kind = "Debug",
			})
		end
		t.eq(bottomFires, 1, "BottomReached fired once")
		t.eq(boot.BottomService.FireCount[cycle], 1, "BottomService ran once")
		-- 49 full digs + the overflow of the first are banked for the next cycle
		t.near(hole.BankedMetres() + 30, 50 * 2500, 1e-6, "every metre accounted for")
	end)

	t.test("reveal -> reset -> next cycle: deeper target, new seed, bank credited", function()
		local boot = ServerBoot.new(t, {
			Configure = function(rt)
				rt:Require("Shared/Config").Pool.Enabled = false
			end,
		})
		local hole = boot.svc("HoleService")
		local p = boot.addPlayer(402, "Bo")
		local seed1, target1 = hole.Seed, hole.Target
		boot.rt:Advance(10)
		boot.receipt(p, "dig_bigone", "B-1")
		boot.receipt(p, "dig_bigone", "B-2")
		boot.receipt(p, "dig_bigone", "B-3")
		boot.receipt(p, "dig_bigone", "B-4") -- reaches 10,000 m
		boot.receipt(p, "dig_bigone", "B-5") -- arrives during the reveal: banked
		t.eq(hole.State, "Revealing")
		-- run the (instant) reveal timeline
		local deadline = os.clock() + 2
		while hole.Cycle == 1 and os.clock() < deadline do
			task.wait()
		end
		t.eq(hole.Cycle, 2, "next cycle started")
		t.eq(hole.State, "Digging")
		t.ok(hole.Target > target1, "deeper target")
		t.ok(hole.Target <= target1 * 1.5, "growth capped")
		t.ok(hole.Seed ~= seed1, "new seed")
		t.near(hole.Depth, 2500, 1e-9, "banked dig credited to the new hole")
		local data = boot.data(p)
		t.eq(data.Stats.HolesBroken, 1, "Hole Breaker credit")
		t.ok(data.Titles.holebreaker, "Hole Breaker title")
		t.near(data.Stats.LifetimeMetres, 12500, 1e-9, "persistent stats survive the reset")
		t.near(hole.Contributions["u402"].Metres, 2500, 1e-9, "this-hole contributions reset, bank counted")
	end)

	t.test("find placement is deterministic, public, in band and spaced", function()
		local rt = t.runtime()
		local HoleMath = rt:Require("Shared/HoleMath")
		local Catalog = rt:Require("Shared/Catalog")
		local a = HoleMath.PlaceFinds(12345, 10000, Catalog.Finds)
		local b = HoleMath.PlaceFinds(12345, 10000, Catalog.Finds)
		local c = HoleMath.PlaceFinds(54321, 10000, Catalog.Finds)
		t.eq(#a, 31, "31 placements per cycle")
		local differs = false
		for i = 1, #a do
			t.eq(a[i].Depth, b[i].Depth, "same seed, same depth")
			t.eq(a[i].FindId, b[i].FindId, "same seed, same find")
			if a[i].Depth ~= c[i].Depth then
				differs = true
			end
			local find = Catalog.FindsById[a[i].FindId]
			t.ok(a[i].Fraction >= find.BandLo - 1e-6 and a[i].Fraction <= find.BandHi + 1e-6, a[i].FindId .. " inside its band")
			if i > 1 then
				t.ok(a[i].Depth >= a[i - 1].Depth, "sorted by depth")
			end
		end
		t.ok(differs, "a different seed gives a different map")
	end)

	t.test("crossing: one big dig unearths every find it passes, once, for everyone", function()
		local boot = ServerBoot.new(t)
		local hole = boot.svc("HoleService")
		local a = boot.addPlayer(501, "Ana")
		local b = boot.addPlayer(502, "Bo")
		local shallow = 0
		for _, placement in hole.Placements do
			if placement.Depth <= 2500 then
				shallow += 1
			end
		end
		t.ok(shallow >= 5, "several finds above 2,500 m")
		boot.receipt(a, "dig_bigone", "F-1")
		local found = 0
		for _, placement in hole.Placements do
			if placement.Depth <= 2500 then
				t.ok(placement.Unearthed, "unearthed " .. placement.FindId)
				t.eq(placement.FinderName, a.DisplayName, "finder credited")
				found += 1
			else
				t.ok(not placement.Unearthed, "deeper finds still buried")
			end
		end
		local function total(data)
			local n = 0
			for _, count in data.Collection do
				n += count
			end
			return n
		end
		t.eq(total(boot.data(a)), found, "buyer received each find")
		t.eq(total(boot.data(b)), found, "free player received each find too")
		t.ok(boot.data(b).Shards > 0, "shards for discoveries")
		t.ok(boot.data(b).CollectionValue > 0, "collection value")
		-- replaying the receipt does not unearth anything again
		boot.receipt(a, "dig_bigone", "F-1")
		t.eq(total(boot.data(b)), found, "no duplicates from a replay")
	end)

	t.test("first discovery vs duplicate shards", function()
		local rt = t.runtime()
		local boot = ServerBoot.new(t)
		local FindService = boot.svc("FindService")
		local Catalog = boot.rt:Require("Shared/Catalog")
		local find = Catalog.FindsById.find_relic
		t.eq(FindService.ShardsFor(find, true), 300)
		t.eq(FindService.ShardsFor(find, false), 75)
		t.eq(FindService.ShardsFor(Catalog.FindsById.find_coin, false), 2, "duplicate minimum")
		local _ = rt
	end)

	t.test("contributions count base metres; boosts only speed the hole", function()
		local boot = ServerBoot.new(t)
		local hole = boot.svc("HoleService")
		local p = boot.addPlayer(601, "Ana")
		local data = boot.data(p)
		data.Boosts.PersonalExpiry = boot.rt.Clock.Now + 3600
		boot.svc("BoostService").AddServer(p, 900)
		boot.svc("FreePathService").PassiveTick(60) -- one minute of Lv0 passive
		t.near(hole.Contributions["u601"].Metres, 1.0, 1e-9, "base 1.0 m/min counted")
		t.near(hole.Depth, 4.0, 1e-9, "x2 personal x2 server = x4 on the hole")
		t.near(data.Stats.LifetimeMetres, 1.0, 1e-9, "lifetime contribution is base metres")
	end)

	t.test("boost stacking is capped at x4", function()
		local rt = t.runtime()
		local Economy = rt:Require("Shared/Economy")
		local all = { FreePass = true, Personal = true, Server = true, Club = true }
		t.eq(Economy.FreeMultiplier("Station", all), 4, "station capped")
		t.eq(Economy.FreeMultiplier("Passive", all), 4, "passive capped")
		t.eq(Economy.FreeMultiplier("Daily", all), 2, "daily: only the 2x pass")
		t.eq(Economy.FreeMultiplier("Passive", { FreePass = true }), 1, "2x pass does not affect passive")
	end)

	t.test("dig energy bounds active metres; autoclickers gain nothing", function()
		local boot = ServerBoot.new(t)
		local stations = boot.svc("StationService")
		local p = boot.addPlayer(701, "Clicky")
		local station = boot.rt:Require("Shared/Config") and (function()
			local part = require("../harness/MockInstance").new("Part")
			part.Position = require("@lune/roblox").Vector3.new(0, 0, 70)
			part:SetAttribute("StationId", 1)
			return part
		end)()
		stations.Enter(p, station)
		local counted = 0
		for _ = 1, 200 do -- 200 swings in the same instant
			if stations.Swing(p).counted then
				counted += 1
			end
		end
		t.eq(counted, 1, "only one swing counts without time passing")
		-- a perfectly-timed macro for 10 minutes
		local hole = boot.svc("HoleService")
		local before = hole.Depth
		local Config = boot.rt:Require("Shared/Config")
		for _ = 1, 10 * 60 * 4 do
			boot.rt:Advance(0.25)
			stations.Swing(p)
		end
		local gained = hole.Depth - before
		local cap = Config.Free.ActiveRatePerMinute * 10 + Config.Free.ActiveBucketCapacity
		t.ok(gained <= cap + 1e-6, string.format("gained %.2f m <= %.2f m cap", gained, cap))
	end)

	t.test("community dig pool fills from dig spend and pays every player", function()
		local boot = ServerBoot.new(t)
		local hole = boot.svc("HoleService")
		local pool = boot.svc("PoolService")
		local Config = boot.rt:Require("Shared/Config")
		local a = boot.addPlayer(801, "Ana")
		local b = boot.addPlayer(802, "Bo")
		local _c = boot.addPlayer(803, "Cy")
		boot.receipt(a, "dig_tbm", "PL-1")
		boot.receipt(a, "dig_tbm", "PL-2")
		t.eq(pool.Fills, 0, "2,000 R$ of digs does not fill a 2,500 R$ pool")
		t.eq(pool.Value, 2000, "pool value tracks dig spend")
		-- isolate the payout itself (no dig metres or finds involved)
		local depthBefore = hole.Depth
		local shardsBefore = boot.data(b).Shards
		pool.Add(Config.Pool.FillRobux - pool.Value)
		t.eq(pool.Fills, 1, "filled once")
		t.near(hole.Depth - depthBefore, 3 * Config.Pool.BonusMetresPerPlayer, 1e-9, "every player got bonus metres")
		t.eq(boot.data(b).Shards - shardsBefore, Config.Pool.BonusShards, "free player got the bonus shards")
		t.eq(hole.Contributions["u802"], nil, "pool bonus is not leaderboard contribution")
	end)
end
