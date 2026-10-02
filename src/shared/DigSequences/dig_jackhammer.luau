-- Jackhammer (50 R$, ~5 s): high-frequency vibration, pumping piston, dust jets, rising-pitch rhythm.
return {
	Id = "dig_jackhammer", Rig = "dig_jackhammer", Stage = "Spot", Duration = 5.0, Weight = 2,
	Cues = {
		{ At = 0.0, Cue = "Anticipate", Actions = { { "Shot", Name = "OverShoulder" }, { "Character", Clip = "Brace" }, { "Squash", Scale = 1.15, Time = 0.35 } } },
		{ At = 0.4, Cue = "Deploy", Actions = {
			{ "Clip", Name = "Pump", Speed = 1 }, { "Sound", Cue = "jack_loop", Loop = true, Key = "jack", Pitch = 0.9 },
			{ "Burst", Kind = "Dust", At = "Impact", Count = 10, Scale = 0.6 }, { "Shake", Amount = 0.2 } } },
		{ At = 1.4, Cue = "Descend", Actions = { { "Burst", Kind = "Dust", At = "Exhaust", Count = 8 }, { "Shake", Amount = 0.2 }, { "Debris", At = "Wall", Count = 8, Power = 14 }, { "Sound", Cue = "jack_loop", Pitch = 1.1 } } },
		{ At = 2.4, Cue = "Descend", Actions = { { "Burst", Kind = "Dust", At = "Impact", Count = 14 }, { "Shake", Amount = 0.25 }, { "Debris", At = "Wall", Count = 10, Power = 16 }, { "Sound", Cue = "jack_loop", Pitch = 1.3 } } },
		{ At = 3.3, Cue = "Impact", Actions = {
			{ "StopSound", Key = "jack" }, { "Sound", Cue = "crack" }, { "HitStop", Time = 0.06 }, { "Fov", Delta = 6, Time = 0.3 },
			{ "Impact", Power = 18 }, { "Popup" }, { "Pulse", Power = 12 }, { "Shot", Name = "Marker" } } },
		{ At = 4.2, Cue = "Aftermath", Actions = { { "Clip", Name = nil }, { "Burst", Kind = "Smoke", At = "Exhaust", Count = 6, Scale = 0.5 } } },
	},
}
