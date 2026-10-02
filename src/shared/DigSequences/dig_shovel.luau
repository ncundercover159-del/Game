-- Hand Shovel (10 R$, ~3.6 s): three quick digs at the rim edge, chunks arc in, big final scoop-and-toss.
return {
	Id = "dig_shovel", Rig = "dig_shovel", Stage = "Hand", Duration = 3.6, Weight = 1,
	Cues = {
		{ At = 0.0, Cue = "Anticipate", Actions = { { "Character", Clip = "Brace" }, { "Shot", Name = "OverShoulder" } } },
		{ At = 0.3, Cue = "Deploy", Actions = { { "Character", Clip = "Scoop" }, { "Sound", Cue = "shovel_scrape" }, { "Debris", At = "Wall", Count = 4, Power = 14 } } },
		{ At = 0.85, Cue = "Deploy", Actions = { { "Character", Clip = "Scoop" }, { "Sound", Cue = "shovel_scrape", Pitch = 1.08 }, { "Debris", At = "Wall", Count = 4, Power = 15 } } },
		{ At = 1.4, Cue = "Deploy", Actions = { { "Character", Clip = "Scoop" }, { "Sound", Cue = "shovel_scrape", Pitch = 1.16 }, { "Debris", At = "Wall", Count = 5, Power = 16 } } },
		{ At = 2.0, Cue = "Impact", Actions = {
			{ "Character", Clip = "Throw" }, { "Sound", Cue = "whoosh_small" }, { "Fov", Delta = 5, Time = 0.3 },
			{ "Debris", At = "Wall", Count = 14, Power = 26 }, { "Shake", Amount = 0.15 } } },
		{ At = 2.6, Cue = "Descend", Actions = { { "Impact", Power = 9 }, { "Popup" }, { "Pulse", Power = 6 }, { "Shot", Name = "Marker" } } },
		{ At = 3.1, Cue = "Aftermath", Actions = { { "Hide" } } },
	},
}
