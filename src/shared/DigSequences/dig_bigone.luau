-- The Big One (9,999 R$, ~25 s): a colossal golden drill-ship with the buyer's name in giant letters; skippable server-wide cut-in (<= 8 s for non-buyers).
return {
	Id = "dig_bigone", Rig = "dig_bigone", Stage = "Sky", Duration = 25, Weight = 16,
	Cues = {
		{ At = 0.0, Cue = "Anticipate", Actions = {
			{ "Place", At = "HoleTop", Offset = { 0, 160, 60 } }, { "Banner" }, { "Sound", Cue = "fanfare" }, { "Shot", Name = "HoleWide" },
			{ "Bloom", Amount = 0.8, Time = 4 }, { "Vignette", Amount = 0.4, Time = 6 } } },
		{ At = 1.0, Cue = "Deploy", Actions = {
			{ "Motion", To = "HoleTop", Offset = 46, Time = 5, Ease = "InOutSine" }, { "Sound", Cue = "engine", Loop = true, Key = "engines", Pitch = 0.5 },
			{ "Burst", Kind = "Fire", At = "EngineL", Count = 20 }, { "Burst", Kind = "Fire", At = "EngineR", Count = 20 }, { "Shot", Name = "Sky" } } },
		{ At = 3.0, Cue = "Deploy", Actions = { { "Burst", Kind = "Glow", At = "EngineL", Count = 20, Skin = true }, { "Burst", Kind = "Glow", At = "EngineR", Count = 20, Skin = true }, { "Shake", Amount = 0.25 } } },
		{ At = 6.0, Cue = "Deploy", Actions = {
			{ "Clip", Name = "Spin", Speed = 0.6 }, { "Sound", Cue = "drill", Loop = true, Key = "drill", Pitch = 0.5 }, { "Shot", Name = "FollowRig" },
			{ "Squash", Scale = 1.05, Time = 0.5 }, { "Shake", Amount = 0.35 }, { "Fov", Delta = -8, Time = 0.8 } } },
		{ At = 7.5, Cue = "Descend", Actions = {
			{ "Clip", Name = "Spin", Speed = 1.4 }, { "Motion", To = "Marker", Offset = 28, Time = 5.5, Ease = "InOutQuad" },
			{ "Burst", Kind = "Spark", At = "Impact", Count = 60, Skin = true }, { "Debris", At = "Wall", Count = 30, Power = 30 }, { "Sound", Cue = "rumble" } } },
		{ At = 10.0, Cue = "Descend", Actions = {
			{ "Burst", Kind = "Fire", At = "Impact", Count = 50, Scale = 1.5 }, { "Debris", At = "Marker", Count = 30, Power = 40 }, { "Shake", Amount = 0.5 },
			{ "Light", At = "Marker", Color = Color3.fromRGB(255, 200, 90), Range = 60, Time = 3 }, { "Sound", Cue = "drill", Pitch = 0.8 } } },
		{ At = 13.0, Cue = "Impact", Actions = {
			{ "Flash", Color = Color3.fromRGB(255, 236, 170), Time = 1.2, Everyone = true }, { "Sound", Cue = "boom_big", At = "Marker" }, { "Sound", Cue = "sonic", At = "Marker", Delay = 0.25 },
			{ "Duck", Amount = 0.8, Time = 2.5 }, { "HitStop", Time = 0.15 }, { "SlowMo", Scale = 0.2, Time = 1.8 }, { "Impact", Power = 100 },
			{ "Ring", Radius = 70, Time = 1.6, Color = Color3.fromRGB(255, 214, 90), Cubes = 48 }, { "Ring", Radius = 110, Time = 2.6, Color = Color3.fromRGB(255, 244, 214), Cubes = 48, Delay = 0.3 },
			{ "Burst", Kind = "Glow", Count = 80, Scale = 2, Skin = true }, { "Shake", Amount = 1 }, { "Bloom", Amount = 3, Time = 3.5 }, { "Pulse", Power = 100 },
			{ "Haptic", Amount = 1, Time = 0.7 }, { "Shot", Name = "Marker" } } },
		{ At = 15.0, Cue = "Aftermath", Actions = { { "Popup" }, { "Burst", Kind = "Embers", Count = 60, Scale = 1.5 }, { "Sound", Cue = "fanfare", Pitch = 1.1 } } },
		{ At = 17.0, Cue = "Aftermath", Actions = {
			{ "StopSound", Key = "drill" }, { "Clip", Name = "Spin", Speed = 0.3 }, { "Motion", To = "HoleTop", Offset = 180, Time = 6, Ease = "InCubic" }, { "Shot", Name = "HoleWide" } } },
		{ At = 23.0, Cue = "Aftermath", Actions = { { "StopSound", Key = "engines" } } },
	},
}
