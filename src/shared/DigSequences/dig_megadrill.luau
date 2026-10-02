-- Mega Drill (500 R$, ~10 s): giant helical bit on a cable rig, flutes spinning, sparks cascading, heat glow, rising pitch.
return {
	Id = "dig_megadrill", Rig = "dig_megadrill", Stage = "HoleTop", Duration = 10, Weight = 5,
	Cues = {
		{ At = 0.0, Cue = "Anticipate", Actions = {
			{ "Place", At = "HoleTop", Offset = { 0, 30, 0 } }, { "Shot", Name = "Sky" }, { "Sound", Cue = "engine", Pitch = 0.8 },
			{ "Motion", To = "HoleTop", Time = 1.4, Ease = "OutBack" } } },
		{ At = 1.4, Cue = "Deploy", Actions = {
			{ "Clip", Name = "Spin", Speed = 0.4 }, { "Sound", Cue = "drill", Loop = true, Key = "drill", Pitch = 0.7 }, { "Shake", Amount = 0.15 }, { "Fov", Delta = -6, Time = 0.5 } } },
		{ At = 2.2, Cue = "Descend", Actions = {
			{ "Clip", Name = "Spin", Speed = 1 }, { "Motion", To = "Marker", Offset = 8, Time = 3.0, Ease = "InOutQuad" }, { "Shot", Name = "FollowRig" },
			{ "Burst", Kind = "Spark", At = "Spark", Count = 20, Skin = true } } },
		{ At = 3.4, Cue = "Descend", Actions = { { "Burst", Kind = "Spark", At = "Spark", Count = 30, Skin = true }, { "Debris", At = "Wall", Count = 10, Power = 18 }, { "Sound", Cue = "drill", Pitch = 0.9 } } },
		{ At = 5.2, Cue = "Impact", Actions = {
			{ "Clip", Name = "Spin", Speed = 1.8 }, { "Sound", Cue = "drill", Pitch = 1.25 }, { "Burst", Kind = "Fire", At = "Impact", Count = 30 },
			{ "Burst", Kind = "Spark", At = "Impact", Count = 50, Skin = true }, { "Light", Color = Color3.fromRGB(255, 150, 60), Range = 40, Time = 2.5 },
			{ "Shake", Amount = 0.45 }, { "Bloom", Amount = 1, Time = 2 }, { "Shot", Name = "Marker" } } },
		{ At = 6.8, Cue = "Impact", Actions = {
			{ "Impact", Power = 40 }, { "Ring", Radius = 22, Time = 0.8 }, { "HitStop", Time = 0.08 }, { "Popup" }, { "Pulse", Power = 30 },
			{ "Sound", Cue = "boom_small", At = "Marker" }, { "Haptic", Amount = 0.5, Time = 0.2 } } },
		{ At = 7.6, Cue = "Aftermath", Actions = {
			{ "StopSound", Key = "drill" }, { "Clip", Name = "Spin", Speed = 0.3 }, { "Motion", To = "HoleTop", Offset = 40, Time = 2.2, Ease = "InCubic" },
			{ "Burst", Kind = "Smoke", Count = 20 }, { "Shot", Name = "HoleWide" } } },
	},
}
