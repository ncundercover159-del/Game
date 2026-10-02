--[[
	CosmeticStyles: visual data for every cosmetic, shared by the server
	(hats, trails, auras, name tags, plaques) and clients (tool skins, dig
	effects, pets, flags, previews). Keyed by Catalog ids / theme names.

	Skin themes never change timing or rigs: only colours, materials,
	particles and (top tiers) extra geometry flags.
]]

local CosmeticStyles = {}

local rgb = Color3.fromRGB

CosmeticStyles.Skins = {
	Classic = {
		Primary = rgb(236, 176, 44), -- safety-yellow housings
		Secondary = rgb(74, 78, 90), -- gunmetal
		Accent = rgb(255, 122, 40),
		Metal = Enum.Material.Metal,
		Paint = Enum.Material.SmoothPlastic,
		Reflectance = 0.05,
		Particles = { rgb(255, 214, 120), rgb(255, 140, 40) },
	},
	Gold = {
		Primary = rgb(255, 200, 60),
		Secondary = rgb(196, 140, 30),
		Accent = rgb(255, 246, 200),
		Metal = Enum.Material.Foil,
		Paint = Enum.Material.Foil,
		Reflectance = 0.25,
		Particles = { rgb(255, 228, 120), rgb(255, 190, 40), rgb(255, 255, 220) },
	},
	Neon = {
		Primary = rgb(18, 20, 28),
		Secondary = rgb(34, 38, 52),
		Accent = rgb(60, 240, 255),
		AccentNeon = true,
		Metal = Enum.Material.Metal,
		Paint = Enum.Material.SmoothPlastic,
		Reflectance = 0.1,
		Particles = { rgb(60, 240, 255), rgb(255, 60, 220) },
	},
	Candy = {
		Primary = rgb(255, 128, 190),
		Secondary = rgb(255, 250, 252),
		Accent = rgb(120, 236, 200),
		Stripes = true,
		Metal = Enum.Material.SmoothPlastic,
		Paint = Enum.Material.SmoothPlastic,
		Reflectance = 0.15,
		Particles = { rgb(255, 128, 190), rgb(120, 236, 200), rgb(255, 236, 110) },
	},
	Obsidian = {
		Primary = rgb(20, 16, 26),
		Secondary = rgb(52, 30, 70),
		Accent = rgb(255, 110, 30),
		AccentNeon = true,
		Metal = Enum.Material.Glass,
		Paint = Enum.Material.Basalt,
		Reflectance = 0.2,
		Particles = { rgb(255, 110, 30), rgb(255, 60, 20), rgb(80, 20, 10) },
	},
	Galaxy = {
		Primary = rgb(30, 28, 92),
		Secondary = rgb(96, 44, 170),
		Accent = rgb(230, 236, 255),
		AccentNeon = true,
		ExtraRings = true,
		Metal = Enum.Material.Glass,
		Paint = Enum.Material.SmoothPlastic,
		Reflectance = 0.15,
		Particles = { rgb(150, 110, 255), rgb(90, 160, 255), rgb(255, 255, 255) },
	},
	["Animated Rainbow"] = {
		Primary = rgb(255, 80, 80),
		Secondary = rgb(240, 240, 255),
		Accent = rgb(255, 255, 255),
		Animated = true, -- client cycles hue on Primary/Accent
		Fins = true,
		Metal = Enum.Material.Foil,
		Paint = Enum.Material.SmoothPlastic,
		Reflectance = 0.3,
		Particles = {
			rgb(255, 70, 70),
			rgb(255, 170, 40),
			rgb(255, 240, 60),
			rgb(80, 230, 110),
			rgb(70, 170, 255),
			rgb(170, 90, 255),
		},
	},
}

function CosmeticStyles.SkinForItem(itemId: string?)
	local map = {
		skin_classic = "Classic",
		skin_gold = "Gold",
		skin_neon = "Neon",
		skin_candy = "Candy",
		skin_obsidian = "Obsidian",
		skin_galaxy = "Galaxy",
		skin_rainbow = "Animated Rainbow",
	}
	return CosmeticStyles.Skins[map[itemId or "skin_classic"] or "Classic"]
end

CosmeticStyles.Plaques = {
	Stone = { Color = rgb(122, 122, 132), Material = Enum.Material.Slate, Text = rgb(240, 240, 245), Frame = rgb(80, 82, 92) },
	Wood = { Color = rgb(130, 88, 50), Material = Enum.Material.WoodPlanks, Text = rgb(255, 236, 200), Frame = rgb(74, 78, 87) },
	Gold = { Color = rgb(255, 196, 60), Material = Enum.Material.Foil, Text = rgb(70, 40, 6), Frame = rgb(200, 140, 30), Reflectance = 0.3 },
	Crystal = { Color = rgb(120, 220, 255), Material = Enum.Material.Glass, Text = rgb(20, 40, 80), Frame = rgb(170, 110, 255), Glow = rgb(82, 246, 255), Transparency = 0.15 },
	Neon = { Color = rgb(20, 22, 34), Material = Enum.Material.SmoothPlastic, Text = rgb(90, 255, 240), Frame = rgb(255, 60, 220), FrameNeon = true },
	Magma = { Color = rgb(60, 20, 18), Material = Enum.Material.CrackedLava, Text = rgb(255, 230, 190), Frame = rgb(254, 118, 29), FrameNeon = true, Embers = true },
}

function CosmeticStyles.PlaqueForItem(itemId: string?)
	local map = {
		plaque_stone = "Stone",
		plaque_wood = "Wood",
		plaque_gold = "Gold",
		plaque_crystal = "Crystal",
		plaque_neon = "Neon",
		plaque_magma = "Magma",
	}
	return CosmeticStyles.Plaques[map[itemId or "plaque_stone"] or "Stone"], map[itemId or "plaque_stone"] or "Stone"
end

-- Impact colour / shape packs (P2). Shape names are understood by EffectsKit.
CosmeticStyles.DigEffects = {
	effect_confetti = { Colors = { rgb(255, 80, 120), rgb(255, 220, 60), rgb(80, 200, 255), rgb(120, 255, 140) }, Shape = "Confetti" },
	effect_lightning = { Colors = { rgb(200, 230, 255), rgb(120, 170, 255) }, Shape = "Bolts" },
	effect_sakura = { Colors = { rgb(255, 190, 220), rgb(255, 240, 248) }, Shape = "Petals" },
	effect_pixel = { Colors = { rgb(90, 255, 120), rgb(40, 200, 255), rgb(255, 255, 255) }, Shape = "Pixels" },
	effect_fire = { Colors = { rgb(255, 200, 60), rgb(255, 100, 20), rgb(200, 30, 10) }, Shape = "Flames" },
}

-- Hard hats: built from simple parts as GREYBOX stand-ins until the
-- Blender meshes are uploaded (AssetKey = hat id).
CosmeticStyles.Hats = {
	hat_rookie = { Shell = rgb(255, 196, 40), Brim = rgb(240, 180, 30), Stripe = rgb(255, 255, 255) },
	hat_lamp = { Shell = rgb(255, 150, 30), Brim = rgb(220, 120, 20), Lamp = rgb(255, 250, 210) },
	hat_drill = { Shell = rgb(80, 86, 100), Brim = rgb(60, 64, 74), Drill = rgb(230, 230, 236) },
	hat_crystal = { Shell = rgb(70, 60, 160), Brim = rgb(50, 44, 120), Crystal = rgb(82, 246, 255) },
	hat_lava = { Shell = rgb(40, 20, 20), Brim = rgb(30, 14, 14), Glow = rgb(254, 118, 29) },
	hat_gold = { Shell = rgb(255, 204, 60), Brim = rgb(214, 160, 30), Stripe = rgb(255, 250, 220), Shiny = true },
	hat_canvas = { Shell = rgb(176, 150, 110), Brim = rgb(150, 126, 90) },
	hat_bandana = { Shell = rgb(200, 40, 40), Brim = rgb(200, 40, 40), Bandana = true },
}

CosmeticStyles.Trails = {
	trail_dust = { Colors = { rgb(176, 130, 90), rgb(120, 90, 60) }, Lifetime = 0.5, Width = 1.2, Transparency = 0.45 },
	trail_spark = { Colors = { rgb(255, 230, 120), rgb(255, 150, 40) }, Lifetime = 0.35, Width = 0.8, Transparency = 0.2, Light = true },
	trail_crystal = { Colors = { rgb(82, 246, 255), rgb(179, 78, 250) }, Lifetime = 0.6, Width = 1.0, Transparency = 0.15, Light = true },
	trail_rainbow = {
		Colors = { rgb(255, 70, 70), rgb(255, 200, 40), rgb(80, 230, 110), rgb(70, 170, 255), rgb(170, 90, 255) },
		Lifetime = 0.7,
		Width = 1.2,
		Transparency = 0.1,
		Light = true,
	},
}

CosmeticStyles.Auras = {
	aura_frost = { Colors = { rgb(200, 240, 255), rgb(120, 200, 255) }, Rate = 14, Size = 0.5, Speed = 1.2 },
	aura_ember = { Colors = { rgb(255, 200, 80), rgb(255, 90, 20) }, Rate = 18, Size = 0.4, Speed = 2.2 },
}

CosmeticStyles.Pets = {
	pet_mole = { Body = rgb(110, 84, 70), Belly = rgb(214, 170, 150), Nose = rgb(255, 140, 160), Size = 1.6, Hover = false },
	pet_drillbot = { Body = rgb(190, 196, 210), Belly = rgb(255, 196, 40), Nose = rgb(230, 230, 236), Size = 1.5, Hover = true },
	pet_glowworm = { Body = rgb(120, 255, 170), Belly = rgb(210, 255, 220), Nose = rgb(255, 255, 255), Size = 1.4, Glow = true },
	pet_golem = { Body = rgb(96, 88, 190), Belly = rgb(82, 246, 255), Nose = rgb(179, 78, 250), Size = 2.0, Glow = true },
	pet_lavaslug = { Body = rgb(70, 24, 20), Belly = rgb(254, 118, 29), Nose = rgb(255, 210, 120), Size = 1.7, Glow = true },
}

CosmeticStyles.FlagDesigns = {
	{ Name = "Dig Orange", Field = rgb(255, 140, 40), Stripe = rgb(255, 255, 255), Emblem = rgb(70, 40, 10) },
	{ Name = "Grass Green", Field = rgb(98, 168, 63), Stripe = rgb(255, 240, 160), Emblem = rgb(30, 70, 30) },
	{ Name = "Sky Blue", Field = rgb(90, 180, 255), Stripe = rgb(255, 255, 255), Emblem = rgb(20, 60, 120) },
	{ Name = "Crystal", Field = rgb(70, 60, 160), Stripe = rgb(82, 246, 255), Emblem = rgb(179, 78, 250) },
	{ Name = "Magma", Field = rgb(130, 41, 54), Stripe = rgb(254, 118, 29), Emblem = rgb(255, 220, 160) },
	{ Name = "Royal Gold", Field = rgb(247, 168, 27), Stripe = rgb(255, 248, 220), Emblem = rgb(110, 60, 10) },
	{ Name = "Night", Field = rgb(24, 29, 47), Stripe = rgb(178, 254, 201), Emblem = rgb(255, 255, 255) },
	{ Name = "Candy", Field = rgb(255, 128, 190), Stripe = rgb(120, 236, 200), Emblem = rgb(255, 255, 255) },
}

CosmeticStyles.NameColors = {
	rgb(255, 255, 255),
	rgb(255, 214, 90),
	rgb(255, 140, 60),
	rgb(255, 90, 110),
	rgb(255, 120, 220),
	rgb(180, 120, 255),
	rgb(90, 180, 255),
	rgb(80, 240, 230),
	rgb(120, 236, 120),
	rgb(200, 255, 90),
}

-- Earned (non-purchasable) titles.
CosmeticStyles.EarnedTitles = {
	holebreaker = { Text = "Hole Breaker", Color = rgb(255, 214, 90) },
}

return CosmeticStyles
