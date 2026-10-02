-- Dynamite Bundle (100 R$, ~6 s): fuse hiss + spark trail, spinning toss, tick-tick, flash, shockwave ring, chunk eruption, slow-mo.
return {
	Id = "dig_dynamite", Rig = "dig_dynamite", Stage = "Hand", Duration = 6.2, Weight = 3,
	Cues = {
		{ At = 0.0, Cue = "Anticipate", Actions = {
			{ "Shot", Name = "OverShoulder" }, { "Sound", Cue = "fuse_hiss", Loop = true, Key = "fuse" }, { "Burst", Kind = "Spark", At = "Fuse", Count = 12, Scale = 0.5 },
			{ "Character", Clip = "WindUp" } } },
		{ At = 0.6, Cue = "Deploy", Actions = {
			{ "Character", Clip = "Throw" }, { "Sound", Cue = "whoosh_small" }, { "Motion", To = "Marker", Offset = 1, Height = 14, Time = 1.3, Ease = "InOutQuad", Tumble = 16 },
			{ "Shot", Name = "FollowRig", Delay = 0.15 } } },
		{ At = 1.0, Cue = "Deploy", Actions = { { "Burst", Kind = "Spark", At = "Fuse", Count = 10, Scale = 0.5 } } },
		{ At = 2.0, Cue = "Descend", Actions = { { "Sound", Cue = "tick" }, { "Shot", Name = "Marker" }, { "Vignette", Amount = 0.35, Time = 1.6 } } },
		{ At = 2.45, Cue = "Descend", Actions = { { "Sound", Cue = "tick", Pitch = 1.1 }, { "Squash", Scale = 1.15, Time = 0.2 } } },
		{ At = 2.9, Cue = "Descend", Actions = { { "Sound", Cue = "tick", Pitch = 1.25 }, { "Squash", Scale = 1.25, Time = 0.2 } } },
		{ At = 3.3, Cue = "Impact", Actions = {
			{ "StopSound", Key = "fuse" }, { "Hide" }, { "Sound", Cue = "boom_small", At = "Marker" }, { "Duck", Amount = 0.5, Time = 1 },
			{ "Flash", Color = Color3.fromRGB(255, 240, 200), Time = 0.4 }, { "Light", Color = Color3.fromRGB(255, 180, 90), Range = 50, Time = 0.8 },
			{ "Ring", Radius = 26, Time = 0.9 }, { "Impact", Power = 32 }, { "Burst", Kind = "Fire", Count = 24 },
			{ "SlowMo", Scale = 0.3, Time = 0.7 }, { "Shake", Amount = 0.55 }, { "Fov", Delta = 10, Time = 0.4 }, { "Bloom", Amount = 1.2, Time = 1 },
			{ "Pulse", Power = 26 }, { "Haptic", Amount = 0.6, Time = 0.25 } } },
		{ At = 3.9, Cue = "Aftermath", Actions = { { "Popup" }, { "Burst", Kind = "Smoke", Count = 16 }, { "Shot", Name = "HoleWide", Delay = 0.8 } } },
	},
}
