-- Excavator (250 R$, ~8 s): rolls in on treads, three-joint boom scoops chunks and dumps them, exhaust puffs, horn.
return {
	Id = "dig_excavator", Rig = "dig_excavator", Stage = "Spot", Duration = 8.2, Weight = 4, Scale = 0.85,
	Cues = {
		{ At = 0.0, Cue = "Anticipate", Actions = {
			{ "Place", At = "Spot", Offset = { 0, 0, 22 } }, { "Clip", Name = "Idle" }, { "Shot", Name = "FollowRig" },
			{ "Sound", Cue = "engine", Loop = true, Key = "engine" }, { "Motion", To = "Spot", Time = 1.6, Ease = "OutCubic" },
			{ "Burst", Kind = "Smoke", At = "Exhaust", Count = 8, Scale = 0.5 } } },
		{ At = 1.6, Cue = "Deploy", Actions = { { "Sound", Cue = "horn" }, { "Squash", Scale = 1.06, Time = 0.3 }, { "Burst", Kind = "Smoke", At = "Exhaust", Count = 10, Scale = 0.6 }, { "Shake", Amount = 0.1 } } },
		{ At = 2.0, Cue = "Descend", Actions = { { "Clip", Name = "Scoop" }, { "Shot", Name = "OverShoulder" } } },
		{ At = 3.2, Cue = "Impact", Actions = {
			{ "Debris", At = "Wall", Count = 20, Power = 22 }, { "Burst", Kind = "Dust", At = "Wall", Count = 20 }, { "Sound", Cue = "shovel_scrape", Pitch = 0.6 },
			{ "Shake", Amount = 0.3 }, { "HitStop", Time = 0.06 } } },
		{ At = 4.3, Cue = "Aftermath", Actions = { { "Debris", At = "Wall", Count = 16, Power = 30 }, { "Sound", Cue = "shovel_scrape", Pitch = 0.5 } } },
		{ At = 4.6, Cue = "Descend", Actions = { { "Clip", Name = "Scoop", Speed = 1.15 } } },
		{ At = 5.7, Cue = "Impact", Actions = {
			{ "Impact", Power = 30 }, { "Popup" }, { "Pulse", Power = 22 }, { "Shake", Amount = 0.35 }, { "Fov", Delta = 7, Time = 0.35 },
			{ "Sound", Cue = "boom_small", At = "Marker", Pitch = 1.3 }, { "Shot", Name = "Marker" } } },
		{ At = 6.8, Cue = "Aftermath", Actions = { { "Sound", Cue = "horn", Pitch = 1.2 }, { "Motion", By = { 0, 0, 18 }, Time = 1.3, Ease = "InCubic" }, { "StopSound", Key = "engine", Delay = 1.2 } } },
	},
}
