-- Tactical Nuke (5,000 R$, ~18 s): siren, cartoon missile descends, countdown pips, whiteout, stylised mushroom cloud, terrain ring, slow-mo, drifting ash.
-- Deliberately cartoonish: no real-world references, no people or places.
return {
	Id = "dig_nuke", Rig = "dig_nuke", Stage = "Sky", Duration = 18, Weight = 10,
	Cues = {
		{ At = 0.0, Cue = "Anticipate", Actions = { { "Place", At = "HoleTop", Offset = { 0, 120, 0 } }, { "Sound", Cue = "siren" }, { "Shot", Name = "HoleWide" }, { "Vignette", Amount = 0.5, Time = 5 } } },
		{ At = 1.0, Cue = "Anticipate", Actions = { { "Sound", Cue = "siren", Pitch = 1.1 } } },
		{ At = 2.0, Cue = "Anticipate", Actions = { { "Sound", Cue = "siren" } } },
		{ At = 2.5, Cue = "Deploy", Actions = {
			{ "Clip", Name = "Spin" }, { "Motion", To = "HoleTop", Offset = 30, Time = 3.0, Ease = "InOutSine" }, { "Shot", Name = "FollowRig" },
			{ "Burst", Kind = "Fire", At = "Exhaust", Count = 20 }, { "Sound", Cue = "engine", Pitch = 0.6 } } },
		{ At = 5.5, Cue = "Descend", Actions = { { "Sound", Cue = "tick", Pitch = 0.9 }, { "Squash", Scale = 1.08, Time = 0.2 } } },
		{ At = 6.0, Cue = "Descend", Actions = { { "Sound", Cue = "tick", Pitch = 1.0 }, { "Squash", Scale = 1.1, Time = 0.2 } } },
		{ At = 6.5, Cue = "Descend", Actions = { { "Sound", Cue = "tick", Pitch = 1.2 }, { "Squash", Scale = 1.14, Time = 0.2 } } },
		{ At = 7.0, Cue = "Descend", Actions = { { "Motion", To = "Marker", Offset = 2, Time = 1.2, Ease = "InCubic" }, { "Sound", Cue = "whoosh_big" }, { "Fov", Delta = 12, Time = 1 } } },
		{ At = 8.2, Cue = "Impact", Actions = {
			{ "Hide" }, { "Flash", Color = Color3.fromRGB(255, 255, 255), Time = 1.6, Everyone = true }, { "Sound", Cue = "boom_big", At = "Marker" },
			{ "Sound", Cue = "sonic", At = "Marker", Delay = 0.3 }, { "Duck", Amount = 0.8, Time = 2.5 }, { "HitStop", Time = 0.15 },
			{ "SlowMo", Scale = 0.25, Time = 1.6 }, { "Impact", Power = 90 }, { "Mushroom", Height = 70, Time = 8 },
			{ "Ring", Radius = 90, Time = 2.2, Color = Color3.fromRGB(255, 220, 160), Cubes = 48 }, { "Shake", Amount = 1 }, { "Bloom", Amount = 2.5, Time = 3 },
			{ "Light", Color = Color3.fromRGB(255, 220, 160), Range = 60, Time = 3 }, { "Pulse", Power = 80 }, { "Haptic", Amount = 1, Time = 0.6 }, { "Shot", Name = "HoleWide" } } },
		{ At = 10.0, Cue = "Aftermath", Actions = { { "Popup" }, { "Burst", Kind = "Ash", Count = 60, Scale = 2 }, { "Burst", Kind = "Smoke", Count = 30, Scale = 2 } } },
		{ At = 13.0, Cue = "Aftermath", Actions = { { "Burst", Kind = "Ash", Count = 40, Scale = 2 } } },
	},
}
