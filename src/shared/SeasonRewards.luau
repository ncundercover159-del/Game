--[[
	SeasonRewards: exactly what every tier of the current season gives.
	Shown in full in the Season panel.

	Rules
	* Neither track ever grants Shards: Shards must never be obtainable with
	  Robux, and premium tracks and tier skips are bought with Robux.
	* Premium-track cosmetics stay purchasable on their own in the Style tab
	  (no limited-time-only cosmetics); season-debut items carry Season = "S1".
]]

local SeasonRewards = {}

-- [tier] = itemId. Tiers without an entry give no item on that track.
SeasonRewards.Free = {
	[2] = "title_pebblepusher",
	[6] = "trail_dust",
	[10] = "hat_bandana",
	[15] = "plaque_wood",
	[20] = "hat_canvas",
	[25] = "title_s1digger",
	[30] = "title_s1finisher",
}

SeasonRewards.Premium = {
	[1] = "hat_rookie",
	[3] = "effect_confetti",
	[6] = "title_dirtdigger",
	[9] = "trail_spark",
	[12] = "hat_crystal",
	[15] = "trail_crystal",
	[18] = "effect_pixel",
	[21] = "title_corechaser",
	[24] = "pet_glowworm",
	[27] = "plaque_neon",
	[30] = "skin_galaxy",
}

return SeasonRewards
