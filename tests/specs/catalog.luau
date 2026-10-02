-- Catalog and economy invariants (policy rules that must never regress).
return function(t)
	t.test("every dig tier respects the 25% single-purchase cap", function()
		local rt = t.runtime()
		local Catalog = rt:Require("Shared/Catalog")
		local Config = rt:Require("Shared/Config")
		local cap = Config.Hole.TargetDepthMetres * Config.Hole.MaxSinglePurchaseFraction
		for _, item in Catalog.DigItems() do
			t.ok(item.Effect.Metres <= cap, item.Id .. " exceeds the single-purchase cap")
		end
	end)

	t.test("metres per Robux strictly improves with tier", function()
		local rt = t.runtime()
		local Catalog = rt:Require("Shared/Catalog")
		local last = 0
		local lastPrice = 0
		for _, item in Catalog.DigItems() do
			local mpr = item.Effect.Metres / item.Price
			t.ok(item.Price > lastPrice, item.Id .. " is not priced above the previous tier")
			t.ok(mpr > last, item.Id .. " metres/R$ does not improve")
			last = mpr
			lastPrice = item.Price
		end
		t.eq(#Catalog.DigItems(), 11, "dig tier count")
		t.eq(Catalog.Get("dig_pebble").Effect.Metres, 1, "pebble toss metres")
		t.eq(Catalog.Get("dig_pebble").Price, 5, "pebble toss price")
		t.eq(Catalog.Get("dig_bigone").Price, 9999, "big one price")
	end)

	t.test("every Robux item routes through a product or pass id", function()
		local rt = t.runtime()
		local Catalog = rt:Require("Shared/Catalog")
		for _, item in Catalog.Items do
			if item.Purchase == "DevProduct" then
				t.ok(Catalog.ByProductId[item.ProductId] == item, item.Id .. " product routing")
				t.ok(type(item.Price) == "number" and item.Price > 0, item.Id .. " needs a price")
			elseif item.Purchase == "GamePass" then
				t.ok(Catalog.ByGamePassId[item.GamePassId] == item, item.Id .. " pass routing")
			end
			t.ok(type(item.Description) == "string" and #item.Description > 10, item.Id .. " needs a description")
		end
	end)

	t.test("shard items can never be bought with Robux", function()
		local rt = t.runtime()
		local Catalog = rt:Require("Shared/Catalog")
		local shardItems = 0
		for _, item in Catalog.Items do
			if item.ShardPrice then
				shardItems += 1
				t.eq(item.Price, nil, item.Id .. " has a Robux price")
				t.eq(item.Purchase, "Shards", item.Id .. " purchase type")
			end
		end
		t.ok(shardItems >= 4, "expected several free-tier Shard cosmetics")
	end)

	t.test("finds: ~20 types, top ten by value match the reference board", function()
		local rt = t.runtime()
		local Catalog = rt:Require("Shared/Catalog")
		t.ok(#Catalog.Finds >= 20, "find count")
		local expected = {
			"Ancient Relic",
			"Golden Fossil",
			"Glowing Crystal",
			"Meteorite",
			"Lost Crown",
			"Diamond",
			"Ruby",
			"Sapphire",
			"Emerald",
			"Amethyst",
		}
		for i, name in expected do
			t.eq(Catalog.FindsByValue[i].Name, name, "finds board row " .. i)
		end
		-- More valuable finds sit deeper.
		for i = 1, 9 do
			local a, b = Catalog.FindsByValue[i], Catalog.FindsByValue[i + 1]
			t.ok(a.BandHi >= b.BandHi, a.Name .. " should sit at least as deep as " .. b.Name)
		end
	end)

	t.test("closest-value dig compensation", function()
		local rt = t.runtime()
		local Catalog = rt:Require("Shared/Catalog")
		t.eq(Catalog.ClosestDig(149).Id, "dig_dynamite", "Gold skin compensation")
		t.eq(Catalog.ClosestDig(799).Id, "dig_tbm", "Lv4 compensation")
		t.eq(Catalog.ClosestDig(99).Id, "dig_dynamite", "Lv1 compensation")
		t.eq(Catalog.ClosestDig(1).Id, "dig_pebble", "tiny compensation")
	end)

	t.test("formatting", function()
		local rt = t.runtime()
		local Format = rt:Require("Shared/Util/Format")
		t.eq(Format.Commas(12345678), "12,345,678")
		t.eq(Format.Value(432109), "432,109$")
		t.eq(Format.Metres(4210), "4,210 m")
		t.eq(Format.Metres(2.1), "2.1 m")
		t.eq(Format.ExactMetres(22.5), "22.5 m")
		t.eq(Format.Clock(3725), "1:02:05")
		t.eq(Format.CleanLine("  hi   there \n you  ", 40), "hi there you")
		t.eq(Format.CleanLine(string.rep("a", 50), 40), string.rep("a", 40))
	end)
end
