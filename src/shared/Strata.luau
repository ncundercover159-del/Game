--[[
	Strata: the hole's layers, defined as fractions of the current target
	depth, plus the physical studs each band occupies in the map and the
	lighting preset the camera blends to while it is inside that band.

	Physical bands must match the generated map (blender/kd/layout.py writes
	the same Y ranges into assets/layout.json; tools/build_place.luau checks
	they agree).
]]

local Strata = {}

Strata.Bands = {
	{
		Id = "Topsoil",
		Name = "Topsoil",
		From = 0.00,
		To = 0.15,
		YTop = 0,
		YBottom = -12,
		Radius = 60,
		Color = Color3.fromRGB(139, 77, 39),
		Accent = Color3.fromRGB(98, 168, 63),
		Lighting = {
			Ambient = Color3.fromRGB(96, 86, 80),
			Tint = Color3.fromRGB(255, 242, 228),
			Saturation = 0.12,
			Contrast = 0.06,
			Bloom = 0.65,
			Exposure = 0.05,
		},
	},
	{
		Id = "Stone",
		Name = "Stone & Fossils",
		From = 0.15,
		To = 0.35,
		YTop = -12,
		YBottom = -24,
		Radius = 53,
		Color = Color3.fromRGB(104, 94, 93),
		Accent = Color3.fromRGB(216, 201, 163),
		Lighting = {
			Ambient = Color3.fromRGB(84, 86, 98),
			Tint = Color3.fromRGB(236, 240, 255),
			Saturation = 0.08,
			Contrast = 0.08,
			Bloom = 0.7,
			Exposure = 0.0,
		},
	},
	{
		Id = "Ore",
		Name = "Coal & Ore",
		From = 0.35,
		To = 0.55,
		YTop = -24,
		YBottom = -40,
		Radius = 46,
		Color = Color3.fromRGB(38, 27, 36),
		Accent = Color3.fromRGB(255, 154, 60),
		Lighting = {
			Ambient = Color3.fromRGB(72, 60, 58),
			Tint = Color3.fromRGB(255, 226, 200),
			Saturation = 0.14,
			Contrast = 0.1,
			Bloom = 0.95,
			Exposure = 0.1,
		},
	},
	{
		Id = "Crystal",
		Name = "Crystal Cavern",
		From = 0.55,
		To = 0.78,
		YTop = -40,
		YBottom = -56,
		Radius = 39,
		Color = Color3.fromRGB(38, 46, 89),
		Accent = Color3.fromRGB(82, 246, 255),
		Lighting = {
			Ambient = Color3.fromRGB(52, 54, 96),
			Tint = Color3.fromRGB(206, 216, 255),
			Saturation = 0.25,
			Contrast = 0.12,
			Bloom = 1.25,
			Exposure = 0.15,
		},
	},
	{
		Id = "Magma",
		Name = "Magma",
		From = 0.78,
		To = 0.95,
		YTop = -56,
		YBottom = -68,
		Radius = 33,
		Color = Color3.fromRGB(130, 41, 54),
		Accent = Color3.fromRGB(254, 118, 29),
		Lighting = {
			Ambient = Color3.fromRGB(112, 52, 40),
			Tint = Color3.fromRGB(255, 204, 172),
			Saturation = 0.2,
			Contrast = 0.12,
			Bloom = 1.4,
			Exposure = 0.1,
		},
	},
	{
		Id = "Core",
		Name = "The Core",
		From = 0.95,
		To = 1.00,
		YTop = -68,
		YBottom = -72,
		Radius = 28,
		Hidden = true, -- below the lava; only shown by the bottom reveal
		Color = Color3.fromRGB(247, 168, 27),
		Accent = Color3.fromRGB(255, 244, 214),
		Lighting = {
			Ambient = Color3.fromRGB(140, 112, 64),
			Tint = Color3.fromRGB(255, 238, 196),
			Saturation = 0.18,
			Contrast = 0.1,
			Bloom = 1.6,
			Exposure = 0.2,
		},
	},
}

-- Daylight preset used on the rim (matches the reference: warm, bright, from
-- the upper left).
Strata.Surface = {
	Ambient = Color3.fromRGB(112, 112, 122),
	Tint = Color3.fromRGB(255, 252, 246),
	Saturation = 0.12,
	Contrast = 0.06,
	Bloom = 0.6,
	Exposure = 0.0,
}

Strata.ById = {}
for index, band in Strata.Bands do
	band.Index = index
	Strata.ById[band.Id] = band
end

function Strata.At(fraction: number)
	fraction = math.clamp(fraction, 0, 1)
	for _, band in Strata.Bands do
		if fraction < band.To then
			return band
		end
	end
	return Strata.Bands[#Strata.Bands]
end

-- The band whose physical studs contain y (used by the camera for lighting).
function Strata.AtY(y: number)
	if y >= 0 then
		return nil
	end
	for _, band in Strata.Bands do
		if y >= band.YBottom then
			return band
		end
	end
	return Strata.Bands[#Strata.Bands]
end

return Strata
