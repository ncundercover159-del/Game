--[[
	Catalog
	=======
	Defines every purchasable item and every find. The store UI, receipt
	routing, equip system, analytics, the Finds board, the Find Map and the
	SETUP.md product table are all generated from these tables, so adding an
	item is one entry here (plus, for Robux items, one ID in Config).

	Item fields
	  Id          unique string id (also the Config.ProductIds / GamePassIds key)
	  Category    Dig | AutoDigger | Pass | Boost | Skin | Plaque | PlaqueMessage |
	              DigEffect | HardHat | Pet | Trail | Aura | Flag | Title |
	              NameColor | Entrance | SeasonPass | TierSkip | StarterPack | Club
	  Tab         store tab: Dig | Boosts | Upgrades | Style | Passes
	  Section     sub-heading inside a tab
	  Name        display name
	  Price       exact Robux price (nil for Shard / default items)
	  ShardPrice  Shards price for free-tier cosmetics (never purchasable with Robux)
	  Ownership   Consumable | OneTime | Pass | Subscription | Default | Season
	  Purchase    DevProduct | GamePass | Subscription | Shards | None
	  Priority    P0 | P1 | P2 (scope order)
	  Giftable    can be bought for another player in the same server
	  Slot        equip slot for cosmetics
	  Effect      machine-readable effect values
	  Description exact, player-facing effect text (generated from Effect)
	  Tier        1..6, picks the frame colour
	  Season      season the item debuted in (seasonal items stay purchasable)
]]

local Config = require(script.Parent.Config)

local Catalog = {}

Catalog.Tabs = {
	{ Id = "Dig", Name = "Dig" },
	{ Id = "Boosts", Name = "Boosts" },
	{ Id = "Upgrades", Name = "Upgrades" },
	{ Id = "Style", Name = "Style" },
	{ Id = "Passes", Name = "Passes & Club" },
	{ Id = "Gifts", Name = "Gifts" },
}

Catalog.TierColors = {
	[1] = Color3.fromRGB(184, 193, 204), -- common grey
	[2] = Color3.fromRGB(95, 211, 90), -- uncommon green
	[3] = Color3.fromRGB(63, 169, 245), -- rare blue
	[4] = Color3.fromRGB(179, 92, 255), -- epic purple
	[5] = Color3.fromRGB(255, 182, 39), -- legendary gold
	[6] = Color3.fromRGB(255, 79, 216), -- mythic magenta
}

Catalog.Rarities = { "Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic" }
Catalog.RarityTier = { Common = 1, Uncommon = 2, Rare = 3, Epic = 4, Legendary = 5, Mythic = 6 }

-- Equip slots and the item each slot holds when nothing is equipped.
Catalog.Slots = {
	ToolSkin = "skin_classic",
	PlaqueStyle = "plaque_stone",
	DigEffect = false,
	HardHat = false,
	Pet = false,
	Trail = false,
	Aura = false,
	Flag = false,
	Title = false,
	Entrance = false,
}

Catalog.Items = {} :: { any }
Catalog.ById = {} :: { [string]: any }
Catalog.ByProductId = {} :: { [number]: any }
Catalog.ByGamePassId = {} :: { [number]: any }

local order = 0

local function formatMetres(m: number): string
	if m == math.floor(m) then
		local s = tostring(math.floor(m))
		local formatted = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
		if formatted:sub(1, 1) == "," then
			formatted = formatted:sub(2)
		end
		return formatted .. " m"
	end
	return string.format("%.1f m", m)
end

local function add(def)
	assert(def.Id and def.Category and def.Name, "Catalog item needs Id, Category and Name")
	assert(Catalog.ById[def.Id] == nil, "Duplicate catalog id " .. def.Id)
	order += 1
	def.Order = order
	def.Priority = def.Priority or "P1"
	def.Effect = def.Effect or {}
	def.Tier = def.Tier or 1
	def.Giftable = def.Giftable == true
	if def.Purchase == nil then
		if def.ShardPrice then
			def.Purchase = "Shards"
		elseif def.Ownership == "Default" or def.Ownership == "Season" then
			def.Purchase = "None"
		else
			def.Purchase = "DevProduct"
		end
	end
	if def.Purchase == "Shards" then
		-- Shards can never be bought with Robux, directly or indirectly.
		assert(def.Price == nil, def.Id .. ": Shard items must not have a Robux price")
	end
	table.insert(Catalog.Items, def)
	Catalog.ById[def.Id] = def
	return def
end

------------------------------------------------------------------------------
-- 1. DIG (repeatable Developer Products, P0)
------------------------------------------------------------------------------
-- Metres per Robux strictly improves with price (0.200 -> 0.250 m/R$) and the
-- top tier sits exactly on the 25%-of-target single-purchase cap.
local DIGS = {
	{ "dig_pebble", "Pebble Toss", 5, 1, 1, 1, "A chunky lucky pebble, lobbed with love." },
	{ "dig_shovel", "Hand Shovel", 10, 2.1, 1, 1, "Three quick scoops and a big toss." },
	{ "dig_pickaxe", "Pickaxe", 25, 5.4, 1, 1, "Overhead swings that crack the wall." },
	{ "dig_jackhammer", "Jackhammer", 50, 11, 2, 2, "Rattling, pumping, rising-pitch chaos." },
	{ "dig_dynamite", "Dynamite Bundle", 100, 22.5, 3, 2, "Fuse, toss, tick-tick... BOOM." },
	{ "dig_excavator", "Excavator", 250, 57, 4, 3, "Rolls in on treads and scoops the floor." },
	{ "dig_megadrill", "Mega Drill", 500, 116, 5, 3, "A giant helical bit lowered on a cable rig." },
	{ "dig_tbm", "Tunnel Boring Machine", 1000, 236, 6, 4, "A cutter-head the size of a house." },
	{ "dig_orbital", "Orbital Drill Strike", 2500, 600, 8, 4, "A drill bolt dropped from orbit." },
	{ "dig_nuke", "Tactical Nuke", 5000, 1220, 10, 5, "Siren, countdown, cartoon mushroom cloud." },
	{ "dig_bigone", "The Big One", 9999, 2500, 16, 6, "A colossal golden drill-ship with YOUR name on it." },
}

Catalog.DigOrder = {}
for _, d in DIGS do
	local id, name, price, metres, weight, tier, flavour = table.unpack(d)
	add({
		Id = id,
		Category = "Dig",
		Tab = "Dig",
		Section = "Dig Tools",
		Name = name,
		Price = price,
		Ownership = "Consumable",
		Priority = "P0",
		Giftable = true,
		Tier = tier,
		Effect = { Metres = metres, Sequence = id, Weight = weight },
		Flavour = flavour,
		Description = string.format(
			"Adds %s to THIS server's hole and plays the %s dig for everyone here.",
			formatMetres(metres),
			name
		),
	})
	table.insert(Catalog.DigOrder, id)
end

------------------------------------------------------------------------------
-- 2. UPGRADES (P1)
------------------------------------------------------------------------------
local AUTO = {
	{ "auto_lv1", "Rusty Auto-Digger", 99, 1 },
	{ "auto_lv2", "Steam Auto-Digger", 199, 2 },
	{ "auto_lv3", "Twin-Bit Auto-Digger", 399, 3 },
	{ "auto_lv4", "Turbo Auto-Digger", 799, 4 },
	{ "auto_lv5", "Mini Boring Rig", 1499, 5 },
}
for i, a in AUTO do
	local id, name, price, level = table.unpack(a)
	local rate = Config.Free.AutoDiggerRates[level]
	add({
		Id = id,
		Category = "AutoDigger",
		Tab = "Upgrades",
		Section = "Auto-Digger",
		Name = string.format("Lv%d %s", level, name),
		Price = price,
		Ownership = "OneTime",
		Priority = "P1",
		Tier = math.min(6, level + 1),
		Requires = i > 1 and AUTO[i - 1][1] or nil,
		Effect = { Level = level, RatePerMinute = rate },
		Description = string.format(
			"Permanent. Your Auto-Digger bay becomes a %s and digs %.1f m per minute while you are in a server.%s",
			name,
			rate,
			level > 1 and string.format(" Levels are bought in order (needs Lv%d).", level - 1) or ""
		),
	})
end

add({
	Id = "pass_2xfree",
	Category = "Pass",
	Tab = "Upgrades",
	Section = "Game Passes",
	Name = "2x Free Metres",
	Price = 299,
	Ownership = "Pass",
	Purchase = "GamePass",
	Priority = "P1",
	Tier = 3,
	Effect = { FreePassMultiplier = Config.Free.FreePassMultiplier },
	Description = "Permanent Game Pass. Doubles the metres you earn from obbies, minigames, dig stations and the daily reward.",
})
add({
	Id = "pass_autoboost",
	Category = "Pass",
	Tab = "Upgrades",
	Section = "Game Passes",
	Name = "Auto-Dig Boost",
	Price = 399,
	Ownership = "Pass",
	Purchase = "GamePass",
	Priority = "P1",
	Tier = 3,
	Effect = { PassiveMultiplier = Config.Free.AutoDigBoostMultiplier },
	Description = string.format(
		"Permanent Game Pass. Your Auto-Digger digs %d%% faster (passive rate capped at %.1f m per minute).",
		math.floor((Config.Free.AutoDigBoostMultiplier - 1) * 100 + 0.5),
		Config.Free.PassiveBaseCap
	),
})
add({
	Id = "pass_vip",
	Category = "Pass",
	Tab = "Upgrades",
	Section = "Game Passes",
	Name = "VIP Rim Lounge",
	Price = 499,
	Ownership = "Pass",
	Purchase = "GamePass",
	Priority = "P1",
	Tier = 5,
	Effect = { Lounge = true, ChatTag = "VIP" },
	Description = "Permanent Game Pass. Access to the raised VIP Rim Lounge with the best view of the hole, private seating and a VIP chat tag. No gameplay advantage.",
})

------------------------------------------------------------------------------
-- 3. BOOSTS (consumable Developer Products, P1)
------------------------------------------------------------------------------
add({
	Id = "boost_personal_30",
	Category = "Boost",
	Tab = "Boosts",
	Section = "Personal Boosts",
	Name = "Free-Dig Boost x2 (30 min)",
	Price = 49,
	Ownership = "Consumable",
	Priority = "P1",
	Tier = 2,
	Effect = { Kind = "Personal", Seconds = 30 * 60, Multiplier = Config.Boosts.PersonalMultiplier },
	Description = "x2 on your Auto-Digger, dig-station, obby and minigame metres for 30 minutes of real time. Buying again adds 30 minutes. Total multipliers never exceed x4.",
})
add({
	Id = "boost_personal_120",
	Category = "Boost",
	Tab = "Boosts",
	Section = "Personal Boosts",
	Name = "Free-Dig Boost x2 (2 hours)",
	Price = 149,
	Ownership = "Consumable",
	Priority = "P1",
	Tier = 3,
	Effect = { Kind = "Personal", Seconds = 120 * 60, Multiplier = Config.Boosts.PersonalMultiplier },
	Description = "x2 on your Auto-Digger, dig-station, obby and minigame metres for 2 hours of real time. Buying again adds 2 hours. Total multipliers never exceed x4.",
})
add({
	Id = "boost_server",
	Category = "Boost",
	Tab = "Boosts",
	Section = "Server Boost",
	Name = "Server Boost x2 (15 min)",
	Price = 199,
	Ownership = "Consumable",
	Priority = "P1",
	Giftable = false,
	Tier = 4,
	Effect = {
		Kind = "Server",
		Seconds = Config.Boosts.ServerBoostSeconds,
		Multiplier = Config.Boosts.ServerMultiplier,
	},
	Description = "Everyone currently in THIS server gets x2 free-path metres for 15 minutes. You are named in the feed and wear a Server Hero tag while it runs.",
})

------------------------------------------------------------------------------
-- 4. STYLE (cosmetics, direct purchase, no randomness)
------------------------------------------------------------------------------
-- Tool Skin Themes (P1): apply to all 11 dig tools and their particles.
add({
	Id = "skin_classic",
	Category = "Skin",
	Tab = "Style",
	Section = "Tool Skin Themes",
	Name = "Classic",
	Ownership = "Default",
	Priority = "P1",
	Slot = "ToolSkin",
	Tier = 1,
	Effect = { Theme = "Classic" },
	Description = "The original workshop finish on all 11 dig tools. Free.",
})
local SKINS = {
	{ "skin_gold", "Gold", 149, 3, "Polished gold plating with engraved trim on all 11 dig tools; gold sparks." },
	{ "skin_neon", "Neon", 249, 4, "Black housings with glowing neon edges on all 11 dig tools; neon particles." },
	{ "skin_candy", "Candy", 249, 4, "Candy-stripe enamel and sprinkle sparks on all 11 dig tools." },
	{ "skin_obsidian", "Obsidian", 399, 4, "Glassy volcanic black with ember cracks on all 11 dig tools; ember particles." },
	{ "skin_galaxy", "Galaxy", 599, 5, "Animated star-field metal, orbiting stardust and extra rings on all 11 dig tools." },
	{ "skin_rainbow", "Animated Rainbow", 999, 6, "Flowing rainbow chrome, prism fins and rainbow particle trails on all 11 dig tools." },
}
for _, s in SKINS do
	local id, name, price, tier, text = table.unpack(s)
	add({
		Id = id,
		Category = "Skin",
		Tab = "Style",
		Section = "Tool Skin Themes",
		Name = name,
		Price = price,
		Ownership = "OneTime",
		Priority = "P1",
		Giftable = true,
		Slot = "ToolSkin",
		Tier = tier,
		Effect = { Theme = name },
		Description = text .. " Permanent; equip any time.",
	})
end

-- Plaque Styles (P1)
add({
	Id = "plaque_stone",
	Category = "Plaque",
	Tab = "Style",
	Section = "Plaque Styles",
	Name = "Stone Plaque",
	Ownership = "Default",
	Priority = "P1",
	Slot = "PlaqueStyle",
	Tier = 1,
	Effect = { Style = "Stone" },
	Description = "Carved stone wall plaque. Free.",
})
add({
	Id = "plaque_wood",
	Category = "Plaque",
	Tab = "Style",
	Section = "Plaque Styles",
	Name = "Wood Plaque",
	ShardPrice = 300,
	Ownership = "OneTime",
	Priority = "P1",
	Slot = "PlaqueStyle",
	Tier = 2,
	Effect = { Style = "Wood" },
	Description = "Timber plaque with iron corners. Earned with Shards only.",
})
local PLAQUES = {
	{ "plaque_gold", "Gold Plaque", 199, 3, "Gold", "Gold-leaf plaque that catches the light." },
	{ "plaque_crystal", "Crystal Plaque", 399, 4, "Crystal", "Faceted crystal plaque with an inner glow." },
	{ "plaque_neon", "Neon Plaque", 399, 4, "Neon", "Neon-outlined plaque that glows in the deep." },
	{ "plaque_magma", "Animated Magma Plaque", 799, 5, "Magma", "Molten plaque with flowing lava and embers." },
}
for _, p in PLAQUES do
	local id, name, price, tier, style, text = table.unpack(p)
	add({
		Id = id,
		Category = "Plaque",
		Tab = "Style",
		Section = "Plaque Styles",
		Name = name,
		Price = price,
		Ownership = "OneTime",
		Priority = "P1",
		Giftable = true,
		Slot = "PlaqueStyle",
		Tier = tier,
		Effect = { Style = style },
		Description = text .. " Used whenever your name is carved into the hole wall. Permanent.",
	})
end
add({
	Id = "plaque_message",
	Category = "PlaqueMessage",
	Tab = "Style",
	Section = "Plaque Styles",
	Name = "Plaque Message",
	Price = 99,
	Ownership = "OneTime",
	Priority = "P1",
	Giftable = true,
	Tier = 2,
	Effect = { MaxChars = Config.Social.PlaqueMessageMaxChars },
	Description = string.format(
		"Permanent. Adds a short custom line (max %d characters, filtered) under your name on every wall plaque. Edit it any time.",
		Config.Social.PlaqueMessageMaxChars
	),
})

-- Dig Effect Styles (P2)
for _, e in { "Confetti", "Lightning", "Sakura", "Pixel", "Fire" } do
	add({
		Id = "effect_" .. e:lower(),
		Category = "DigEffect",
		Tab = "Style",
		Section = "Dig Effect Styles",
		Name = e .. " Impact",
		Price = 99,
		Ownership = "OneTime",
		Priority = "P2",
		Giftable = true,
		Slot = "DigEffect",
		Tier = 3,
		Effect = { Style = e },
		Description = string.format(
			"Your digs' impact bursts in %s colours and shapes at the hole. Purely cosmetic. Permanent.",
			e:lower()
		),
	})
end

-- Hard Hats (P2)
local HATS = {
	{ "hat_rookie", "Rookie Hard Hat", 79, 2, nil },
	{ "hat_lamp", "Headlamp Hat", 129, 3, nil },
	{ "hat_drill", "Drill-Top Hat", 179, 3, nil },
	{ "hat_crystal", "Crystal Crown Hat", 229, 4, "S1" },
	{ "hat_lava", "Lava Helmet", 249, 4, nil },
	{ "hat_gold", "Golden Hard Hat", 299, 5, nil },
}
for _, h in HATS do
	local id, name, price, tier, season = table.unpack(h, 1, 5)
	add({
		Id = id,
		Category = "HardHat",
		Tab = "Style",
		Section = "Hard Hats",
		Name = name,
		Price = price,
		Ownership = "OneTime",
		Priority = "P2",
		Giftable = true,
		Slot = "HardHat",
		Tier = tier,
		Season = season,
		Description = "Hard hat accessory worn on your avatar. Purely cosmetic. Permanent.",
	})
end
add({
	Id = "hat_canvas",
	Category = "HardHat",
	Tab = "Style",
	Section = "Hard Hats",
	Name = "Canvas Cap",
	ShardPrice = 400,
	Ownership = "OneTime",
	Priority = "P2",
	Slot = "HardHat",
	Tier = 1,
	Description = "A dusty canvas cap. Earned with Shards only.",
})
add({
	Id = "hat_bandana",
	Category = "HardHat",
	Tab = "Style",
	Section = "Hard Hats",
	Name = "Dusty Bandana",
	ShardPrice = 250,
	Ownership = "OneTime",
	Priority = "P2",
	Slot = "HardHat",
	Tier = 1,
	Description = "A red miner's bandana. Earned with Shards only.",
})

-- Pets (P2)
local PETS = {
	{ "pet_mole", "Mole", 199, 3, false, "A grumpy little mole who sniffs for treasure." },
	{ "pet_drillbot", "Drill-Bot", 299, 3, false, "A tiny robot with a whirring nose drill." },
	{ "pet_glowworm", "Glow Worm", 399, 4, "S1", "A bouncy worm that glows brighter underground." },
	{ "pet_golem", "Crystal Golem", 599, 5, false, "A pocket-sized golem of living crystal." },
	{ "pet_lavaslug", "Lava Slug", 799, 5, false, "A slow, smug slug that leaves glowing footprints." },
}
for _, p in PETS do
	local id, name, price, tier, season, text = table.unpack(p, 1, 6)
	add({
		Id = id,
		Category = "Pet",
		Tab = "Style",
		Section = "Pets",
		Name = name,
		Price = price,
		Ownership = "OneTime",
		Priority = "P2",
		Giftable = true,
		Slot = "Pet",
		Tier = tier,
		Season = season or nil,
		Description = text .. " Follows you, idles and celebrates big digs. Purely cosmetic. Permanent.",
	})
end

-- Trails and Auras (P2)
local TRAILS = {
	{ "trail_spark", "Spark Trail", 99, "Trail", 2, nil },
	{ "trail_crystal", "Crystal Trail", 149, "Trail", 3, "S1" },
	{ "trail_rainbow", "Rainbow Trail", 199, "Trail", 4, nil },
	{ "aura_frost", "Frost Aura", 149, "Aura", 3, nil },
	{ "aura_ember", "Ember Aura", 199, "Aura", 4, nil },
}
for _, t in TRAILS do
	local id, name, price, slot, tier, season = table.unpack(t, 1, 6)
	add({
		Id = id,
		Category = slot,
		Tab = "Style",
		Section = "Trails & Auras",
		Name = name,
		Price = price,
		Ownership = "OneTime",
		Priority = "P2",
		Giftable = true,
		Slot = slot,
		Tier = tier,
		Season = season,
		Description = (slot == "Trail" and "A trail that follows you as you move." or "A soft particle aura around you.")
			.. " Purely cosmetic. Permanent.",
	})
end
add({
	Id = "trail_dust",
	Category = "Trail",
	Tab = "Style",
	Section = "Trails & Auras",
	Name = "Dust Trail",
	ShardPrice = 300,
	Ownership = "OneTime",
	Priority = "P2",
	Slot = "Trail",
	Tier = 1,
	Description = "A puff of dirt behind every step. Earned with Shards only.",
})

-- Rim Flag (P2)
add({
	Id = "flag_personal",
	Category = "Flag",
	Tab = "Style",
	Section = "Rim Flags",
	Name = "Personal Rim Flag",
	Price = 149,
	Ownership = "OneTime",
	Priority = "P2",
	Giftable = true,
	Slot = "Flag",
	Tier = 3,
	Effect = { Designs = 8 },
	Description = "Plants your own flag on the rim fence in every server (pick from 8 designs, change any time). Purely cosmetic. Permanent.",
})

-- Titles and Name Tags (P2)
local TITLES = {
	{ "title_dirtdigger", "Dirt Digger", 49, 2, nil },
	{ "title_drillmaster", "Drill Master", 99, 3, nil },
	{ "title_deepdiver", "Deep Diver", 149, 4, nil },
	{ "title_corechaser", "Core Chaser", 199, 4, "S1" },
	{ "title_legend", "Hole Legend", 299, 5, nil },
}
for _, t in TITLES do
	local id, name, price, tier, season = table.unpack(t, 1, 5)
	add({
		Id = id,
		Category = "Title",
		Tab = "Style",
		Section = "Titles & Name Tags",
		Name = string.format('Title: "%s"', name),
		Price = price,
		Ownership = "OneTime",
		Priority = "P2",
		Giftable = true,
		Slot = "Title",
		Tier = tier,
		Season = season,
		Effect = { Text = name },
		Description = string.format('Shows "%s" above your name. Purely cosmetic. Permanent.', name),
	})
end
add({
	Id = "title_pebblepusher",
	Category = "Title",
	Tab = "Style",
	Section = "Titles & Name Tags",
	Name = 'Title: "Pebble Pusher"',
	ShardPrice = 150,
	Ownership = "OneTime",
	Priority = "P2",
	Slot = "Title",
	Tier = 1,
	Effect = { Text = "Pebble Pusher" },
	Description = 'Shows "Pebble Pusher" above your name. Earned with Shards only.',
})
add({
	Id = "title_s1digger",
	Category = "Title",
	Tab = "Style",
	Section = "Titles & Name Tags",
	Name = 'Title: "S1 Digger"',
	ShardPrice = 500,
	Ownership = "OneTime",
	Priority = "P2",
	Slot = "Title",
	Tier = 2,
	Season = "S1",
	Effect = { Text = "S1 Digger" },
	Description = 'Shows "S1 Digger" above your name. Season 1 free-track reward, also earnable with Shards.',
})
add({
	Id = "title_s1finisher",
	Category = "Title",
	Tab = "Style",
	Section = "Titles & Name Tags",
	Name = 'Title: "Season 1 Finisher"',
	ShardPrice = 900,
	Ownership = "OneTime",
	Priority = "P2",
	Slot = "Title",
	Tier = 3,
	Season = "S1",
	Effect = { Text = "Season 1 Finisher" },
	Description = 'Shows "Season 1 Finisher" above your name. Season 1 free-track reward, also earnable with Shards.',
})
add({
	Id = "namecolor",
	Category = "NameColor",
	Tab = "Style",
	Section = "Titles & Name Tags",
	Name = "Name Colour",
	Price = 49,
	Ownership = "OneTime",
	Priority = "P2",
	Giftable = true,
	Tier = 2,
	Effect = { Colours = 10 },
	Description = "Unlocks 10 name tag colours you can switch between any time. Purely cosmetic. Permanent.",
})

-- Entrance Effects (P2)
add({
	Id = "entrance_dirtburst",
	Category = "Entrance",
	Tab = "Style",
	Section = "Entrance Effects",
	Name = "Dirt Burst Entrance",
	Price = 199,
	Ownership = "OneTime",
	Priority = "P2",
	Giftable = true,
	Slot = "Entrance",
	Tier = 4,
	Description = "You burst out of the ground in a shower of voxel dirt when you join a server. Purely cosmetic. Permanent.",
})
add({
	Id = "entrance_crystalrise",
	Category = "Entrance",
	Tab = "Style",
	Section = "Entrance Effects",
	Name = "Crystal Rise Entrance",
	Price = 199,
	Ownership = "OneTime",
	Priority = "P2",
	Giftable = true,
	Slot = "Entrance",
	Tier = 4,
	Description = "You rise from a ring of glowing crystals when you join a server. Purely cosmetic. Permanent.",
})

------------------------------------------------------------------------------
-- 5. PASSES AND CLUB
------------------------------------------------------------------------------
-- The Season Pass is a Developer Product with a per-season entitlement record:
-- Game Passes are lifetime, so they cannot express "this season only".
add({
	Id = "season_pass",
	Category = "SeasonPass",
	Tab = "Passes",
	Section = "Season Pass",
	Name = "Season Pass: " .. Config.Season.Name,
	Price = 799,
	Ownership = "OneTime",
	Priority = "P1",
	Tier = 5,
	Effect = { Season = Config.Season.Id },
	Description = string.format(
		"Unlocks the premium reward track for %s (%d tiers, every reward listed in the Season panel). Tiers unlock with Season XP from free play.",
		Config.Season.Name,
		Config.Season.Tiers
	),
})
add({
	Id = "season_tierskip",
	Category = "TierSkip",
	Tab = "Passes",
	Section = "Season Pass",
	Name = "Season Tier Skip",
	Price = 49,
	Ownership = "Consumable",
	Priority = "P1",
	Tier = 2,
	Effect = { Tiers = 1 },
	Description = "Instantly completes your current Season tier (one tier per purchase, fixed price).",
})
add({
	Id = "starter_pack",
	Category = "StarterPack",
	Tab = "Passes",
	Section = "Starter Pack",
	Name = "Starter Pack",
	Price = 199,
	Ownership = "OneTime",
	Priority = "P1",
	Tier = 4,
	Effect = { Contents = { "auto_lv1", "skin_gold", "hat_rookie", "dig_jackhammer" } },
	Description = "One per account: Lv1 Rusty Auto-Digger + Gold tool skin + Rookie Hard Hat + one Jackhammer dig (11 m). Anything you already own is swapped for the closest-value dig, shown before you buy.",
})
add({
	Id = "club",
	Category = "Club",
	Tab = "Passes",
	Section = "Deep Diver Club",
	Name = "Deep Diver Club",
	Ownership = "Subscription",
	Purchase = "Subscription",
	Priority = "P2",
	Tier = 5,
	Effect = Config.Subscription.Perks,
	Description = string.format(
		"Monthly subscription (%s, renews monthly until cancelled). Perks: x%.1f free-dig rate, Club tag, one free Pebble Toss per day, and the Crystal Trail cosmetic (also buyable on its own in Style).",
		Config.Subscription.DisplayPrice,
		Config.Subscription.Perks.FreeDigMultiplier
	),
})

------------------------------------------------------------------------------
-- Product / pass id routing (placeholder ids for Studio test mode)
------------------------------------------------------------------------------
-- Items without a real id get a negative synthetic id so test-mode receipts
-- route through exactly the same lookup as real ones.
for i, item in Catalog.Items do
	if item.Purchase == "DevProduct" then
		local real = Config.ProductIds[item.Id]
		assert(real ~= nil, "Config.ProductIds is missing " .. item.Id)
		item.ProductId = (real and real ~= 0) and real or -(1000 + i)
		item.HasRealId = real ~= nil and real ~= 0
		Catalog.ByProductId[item.ProductId] = item
	elseif item.Purchase == "GamePass" then
		local real = Config.GamePassIds[item.Id]
		assert(real ~= nil, "Config.GamePassIds is missing " .. item.Id)
		item.GamePassId = (real and real ~= 0) and real or -(5000 + i)
		item.HasRealId = real ~= nil and real ~= 0
		Catalog.ByGamePassId[item.GamePassId] = item
	elseif item.Purchase == "Subscription" then
		item.SubscriptionId = Config.SubscriptionIds[item.Id]
		item.HasRealId = item.SubscriptionId ~= nil and item.SubscriptionId ~= ""
	end
end

------------------------------------------------------------------------------
-- FINDS (P1): the discovery layer of the hole
------------------------------------------------------------------------------
-- Value is a display score shown with a "$" suffix. Band is the fixed depth
-- band (fraction of the target) the find is placed in each cycle. Count is
-- how many of that find are placed per cycle. Every placement is public:
-- visible on the depth gauge, as wall glints, and in the Find Map.
Catalog.Finds = {} :: { any }
Catalog.FindsById = {} :: { [string]: any }

local FINDS = {
	{ "find_coin", "Old Coin", "Common", 120, 0.01, 0.14, 3 },
	{ "find_bone", "Old Bone", "Common", 180, 0.02, 0.15, 3 },
	{ "find_pot", "Clay Pot", "Common", 260, 0.04, 0.15, 2 },
	{ "find_horseshoe", "Lucky Horseshoe", "Uncommon", 450, 0.06, 0.20, 2 },
	{ "find_ironore", "Iron Ore", "Common", 350, 0.16, 0.34, 2 },
	{ "find_ammonite", "Ammonite Fossil", "Uncommon", 900, 0.15, 0.30, 2 },
	{ "find_trilobite", "Trilobite Fossil", "Uncommon", 1400, 0.18, 0.35, 2 },
	{ "find_dinotooth", "Dino Tooth", "Rare", 3200, 0.22, 0.35, 1 },
	{ "find_silver", "Silver Nugget", "Uncommon", 5000, 0.35, 0.50, 2 },
	{ "find_goldnugget", "Gold Nugget", "Rare", 12000, 0.38, 0.55, 1 },
	{ "find_oldpick", "Ancient Pickaxe", "Rare", 24000, 0.42, 0.55, 1 },
	{ "find_amethyst", "Amethyst", "Epic", 60000, 0.55, 0.63, 1 },
	{ "find_emerald", "Emerald", "Epic", 85000, 0.57, 0.66, 1 },
	{ "find_sapphire", "Sapphire", "Epic", 120000, 0.60, 0.69, 1 },
	{ "find_ruby", "Ruby", "Epic", 160000, 0.63, 0.72, 1 },
	{ "find_diamond", "Diamond", "Legendary", 250000, 0.66, 0.78, 1 },
	{ "find_crown", "Lost Crown", "Legendary", 400000, 0.78, 0.84, 1 },
	{ "find_meteorite", "Meteorite", "Legendary", 650000, 0.80, 0.88, 1 },
	{ "find_glowcrystal", "Glowing Crystal", "Mythic", 900000, 0.84, 0.91, 1 },
	{ "find_goldfossil", "Golden Fossil", "Mythic", 1500000, 0.87, 0.93, 1 },
	{ "find_relic", "Ancient Relic", "Mythic", 2500000, 0.90, 0.95, 1 },
}
for i, f in FINDS do
	local id, name, rarity, value, lo, hi, count = table.unpack(f)
	assert(lo < hi and hi <= 0.95, id .. ": finds must sit above the core (<= 95%)")
	local find = {
		Id = id,
		Name = name,
		Rarity = rarity,
		Tier = Catalog.RarityTier[rarity],
		Value = value,
		BandLo = lo,
		BandHi = hi,
		Count = count,
		Order = i,
		FirstShards = Config.Shards.FirstFind[rarity],
		Visual = { Model = "find_" .. id:sub(6), Icon = "icon_" .. id },
	}
	table.insert(Catalog.Finds, find)
	Catalog.FindsById[id] = find
end

-- Finds sorted by Value, most valuable first (Most Valuable Finds board).
Catalog.FindsByValue = table.clone(Catalog.Finds)
table.sort(Catalog.FindsByValue, function(a, b)
	return a.Value > b.Value
end)

------------------------------------------------------------------------------
-- Helpers
------------------------------------------------------------------------------
function Catalog.Get(id: string)
	return Catalog.ById[id]
end

function Catalog.ByTab(tabId: string)
	local list = {}
	for _, item in Catalog.Items do
		if item.Tab == tabId then
			table.insert(list, item)
		end
	end
	return list
end

function Catalog.IsGiftable(item): boolean
	return item ~= nil and item.Giftable == true and item.Purchase == "DevProduct"
end

-- Dig items sorted by price (used for compensation and Starter Pack swaps).
function Catalog.DigItems()
	local list = {}
	for _, id in Catalog.DigOrder do
		table.insert(list, Catalog.ById[id])
	end
	return list
end

-- The dig item whose price is closest to `price` (ties go to the cheaper).
function Catalog.ClosestDig(price: number)
	local best, bestDiff = nil, math.huge
	for _, item in Catalog.DigItems() do
		local diff = math.abs(item.Price - price)
		if diff < bestDiff then
			best, bestDiff = item, diff
		end
	end
	return best
end

function Catalog.FormatMetres(m: number): string
	return formatMetres(m)
end

return Catalog
