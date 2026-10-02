-- Tunnel Boring Machine (1,000 R$, ~12 s): cutter-head with disc cutters bursts from the wall, segmented body, floodlights, deep rumble.
return {
	Id = "dig_tbm", Rig = "dig_tbm", Stage = "Wall", Duration = 12, Weight = 6,
	Cues = {
		{ At = 0.0, Cue = "Anticipate", Actions = {
			{ "Place", At = "Wall", Offset = { 0, -2, 14 } }, { "Shot", Name = "Marker" }, { "Sound", Cue = "rumble", Loop = true, Key = "rumble" },
			{ "Shake", Amount = 0.2 }, { "Debris", At = "Wall", Count = 8, Power = 8 } } },
		{ At = 1.0, Cue = "Anticipate", Actions = { { "Shake", Amount = 0.3 }, { "Debris", At = "Wall", Count = 12, Power = 12 }, { "Vignette", Amount = 0.4, Time = 2 } } },
		{ At = 2.0, Cue = "Deploy", Actions = {
			{ "Clip", Name = "Spin" }, { "Sound", Cue = "drill", Loop = true, Key = "cutter", Pitch = 0.6 }, { "Motion", By = { 0, 0, -10 }, Time = 1.2, Ease = "OutBack" },
			{ "Burst", Kind = "Dust", At = "Wall", Count = 40, Scale = 1.6 }, { "Debris", At = "Wall", Count = 30, Power = 34 }, { "HitStop", Time = 0.08 },
			{ "Shake", Amount = 0.55 }, { "Fov", Delta = 10, Time = 0.4 }, { "Light", At = "Wall", Color = Color3.fromRGB(255, 240, 210), Range = 45, Time = 1.5 } } },
		{ At = 3.6, Cue = "Descend", Actions = { { "Motion", To = "Marker", Offset = 3, Time = 3.4, Ease = "InOutQuad" }, { "Shot", Name = "FollowRig" }, { "Burst", Kind = "Spark", At = "Impact", Count = 30, Skin = true } } },
		{ At = 5.0, Cue = "Descend", Actions = { { "Debris", At = "Marker", Count = 20, Power = 28 }, { "Sound", Cue = "drill", Pitch = 0.8 }, { "Shake", Amount = 0.35 } } },
		{ At = 7.0, Cue = "Impact", Actions = {
			{ "Sound", Cue = "boom_big", At = "Marker" }, { "Duck", Amount = 0.5, Time = 1.2 }, { "Impact", Power = 55 }, { "Ring", Radius = 32, Time = 1 },
			{ "SlowMo", Scale = 0.35, Time = 0.8 }, { "Flash", Color = Color3.fromRGB(255, 230, 190), Time = 0.4 }, { "Bloom", Amount = 1.4, Time = 1.5 },
			{ "Popup" }, { "Pulse", Power = 40 }, { "Shot", Name = "Marker" }, { "Haptic", Amount = 0.7, Time = 0.3 } } },
		{ At = 8.4, Cue = "Aftermath", Actions = {
			{ "StopSound", Key = "cutter" }, { "Clip", Name = "Spin", Speed = 0.2 }, { "Motion", By = { 0, -16, 0 }, Time = 2.2, Ease = "InCubic" },
			{ "Burst", Kind = "Smoke", Count = 24 }, { "Shot", Name = "HoleWide" } } },
		{ At = 10.6, Cue = "Aftermath", Actions = { { "StopSound", Key = "rumble" }, { "Hide" } } },
	},
}
