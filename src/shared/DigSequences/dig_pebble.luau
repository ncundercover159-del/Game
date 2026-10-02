-- Pebble Toss (5 R$, ~3 s): wind-up, lob, comic wall bounce, plink down the shaft, puff, micro hit-stop, "+1 m".
return {
	Id = "dig_pebble", Rig = "dig_pebble", Stage = "Hand", Duration = 3.2, Weight = 1,
	Cues = {
		{ At = 0.0, Cue = "Anticipate", Actions = {
			{ "Character", Clip = "WindUp" }, { "Sound", Cue = "pebble_windup" }, { "Fov", Delta = -4, Time = 0.45 },
			{ "Shot", Name = "OverShoulder" }, { "Squash", Scale = 1.25, Time = 0.4 } } },
		{ At = 0.45, Cue = "Deploy", Actions = {
			{ "Character", Clip = "Throw" }, { "Sound", Cue = "whoosh_small" },
			{ "Motion", To = "Wall", Height = 7, Time = 0.55, Ease = "OutQuad", Tumble = 9 }, { "Shot", Name = "FollowRig", Delay = 0.1 } } },
		{ At = 1.0, Cue = "Impact", Actions = {
			{ "Sound", Cue = "pebble_plink", Pitch = 1.1 }, { "Squash", Scale = 0.7, Time = 0.12 }, { "Burst", Kind = "Dust", At = "Rig", Count = 4, Scale = 0.4 },
			{ "Motion", To = "Marker", Offset = 0.5, Height = 2, Time = 0.9, Ease = "InQuad", Tumble = 14 } } },
		{ At = 1.9, Cue = "Descend", Actions = {
			{ "Sound", Cue = "pebble_plink", At = "Marker", Pitch = 1.4 }, { "Sound", Cue = "pebble_echo", At = "Marker", Delay = 0.25 },
			{ "Sound", Cue = "pebble_echo", At = "Marker", Delay = 0.5, Volume = 0.6 }, { "HitStop", Time = 0.05 },
			{ "Impact", Power = 6 }, { "Popup" }, { "Shot", Name = "Marker" }, { "Pulse", Power = 4 } } },
		{ At = 2.4, Cue = "Aftermath", Actions = { { "Hide" }, { "Character", Clip = "Point" } } },
	},
}
