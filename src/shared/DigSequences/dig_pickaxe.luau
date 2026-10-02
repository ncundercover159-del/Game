-- Pickaxe (25 R$, ~4.4 s): overhead two-handed swings, sparks on stone, a chunk breaks away, pick left wobbling in the wall.
return {
	Id = "dig_pickaxe", Rig = "dig_pickaxe", Stage = "Hand", Duration = 4.4, Weight = 1,
	Cues = {
		{ At = 0.0, Cue = "Anticipate", Actions = { { "Shot", Name = "OverShoulder" }, { "Character", Clip = "Swing" }, { "Sound", Cue = "swing" } } },
		{ At = 0.45, Cue = "Impact", Actions = { { "Sound", Cue = "pick_clang" }, { "Burst", Kind = "Spark", At = "Wall", Count = 14, Skin = true }, { "Shake", Amount = 0.12 } } },
		{ At = 0.9, Cue = "Anticipate", Actions = { { "Character", Clip = "Swing" }, { "Sound", Cue = "swing", Pitch = 0.95 } } },
		{ At = 1.35, Cue = "Impact", Actions = { { "Sound", Cue = "pick_clang", Pitch = 0.9 }, { "Burst", Kind = "Spark", At = "Wall", Count = 18, Skin = true }, { "HitStop", Time = 0.05 }, { "Shake", Amount = 0.15 } } },
		{ At = 1.8, Cue = "Anticipate", Actions = { { "Character", Clip = "Swing" }, { "Fov", Delta = -5, Time = 0.3 } } },
		{ At = 2.25, Cue = "Impact", Actions = {
			{ "Sound", Cue = "pick_clang", Pitch = 0.8 }, { "Sound", Cue = "crack" }, { "HitStop", Time = 0.08 },
			{ "Burst", Kind = "Spark", At = "Wall", Count = 26, Skin = true }, { "Debris", At = "Wall", Count = 18, Power = 24 },
			{ "Place", At = "Wall", Offset = { 0, 0, 0.5 } }, { "Shake", Amount = 0.25 } } },
		{ At = 2.4, Cue = "Aftermath", Actions = { { "Motion", By = { 0, 0, 0 }, Time = 0.1 }, { "Squash", Scale = 1.08, Time = 1.2 } } },
		{ At = 3.0, Cue = "Descend", Actions = { { "Impact", Power = 12 }, { "Popup" }, { "Pulse", Power = 8 }, { "Shot", Name = "Marker" } } },
	},
}
