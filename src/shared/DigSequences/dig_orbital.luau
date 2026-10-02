-- Orbital Drill Strike (2,500 R$, ~15 s): satellite glint, targeting reticle, beam lock, re-entry fire trail, white impact, sonic boom.
return {
	Id = "dig_orbital", Rig = "dig_orbital", Stage = "Sky", Duration = 15, Weight = 8,
	Cues = {
		{ At = 0.0, Cue = "Anticipate", Actions = {
			{ "Place", At = "Sky" }, { "Shot", Name = "Sky" }, { "Sound", Cue = "ui_pop", Pitch = 0.5 }, { "Light", At = "Sky", Color = Color3.fromRGB(220, 240, 255), Range = 60, Time = 1.2 } } },
		{ At = 1.5, Cue = "Anticipate", Actions = { { "Ring", Radius = 14, Time = 1.5, Color = Color3.fromRGB(255, 70, 70), Cubes = 20 }, { "Sound", Cue = "tick", Pitch = 0.8 } } },
		{ At = 3.0, Cue = "Anticipate", Actions = { { "Ring", Radius = 10, Time = 1.2, Color = Color3.fromRGB(255, 70, 70), Cubes = 16 }, { "Sound", Cue = "tick", Pitch = 1 }, { "Vignette", Amount = 0.45, Time = 3 } } },
		{ At = 4.2, Cue = "Deploy", Actions = {
			{ "Beam", From = "Sky", To = "Marker", Color = Color3.fromRGB(140, 230, 255), Width = 4, Time = 3 }, { "Sound", Cue = "beam" },
			{ "Bloom", Amount = 1, Time = 3 }, { "Shake", Amount = 0.25 }, { "Shot", Name = "HoleWide" } } },
		{ At = 6.6, Cue = "Descend", Actions = {
			{ "Sound", Cue = "whoosh_big" }, { "Motion", To = "Marker", Offset = 2, Time = 2.0, Ease = "InQuad" }, { "Shot", Name = "FollowRig" },
			{ "Burst", Kind = "Fire", At = "Trail", Count = 30, Scale = 1.4 } } },
		{ At = 7.4, Cue = "Descend", Actions = { { "Burst", Kind = "Fire", At = "Trail", Count = 30, Scale = 1.6 }, { "Fov", Delta = 12, Time = 0.8 } } },
		{ At = 8.6, Cue = "Impact", Actions = {
			{ "Hide" }, { "Flash", Color = Color3.fromRGB(255, 255, 255), Time = 0.9, Everyone = true }, { "Sound", Cue = "sonic", At = "Marker" },
			{ "Sound", Cue = "boom_big", At = "Marker", Delay = 0.2 }, { "Duck", Amount = 0.7, Time = 1.6 }, { "Impact", Power = 70 },
			{ "Ring", Radius = 45, Time = 1.2 }, { "HitStop", Time = 0.12 }, { "SlowMo", Scale = 0.25, Time = 1.0 }, { "Shake", Amount = 0.8 },
			{ "Bloom", Amount = 2, Time = 2 }, { "Light", Color = Color3.fromRGB(255, 255, 255), Range = 60, Time = 1.5 }, { "Pulse", Power = 55 },
			{ "Haptic", Amount = 0.9, Time = 0.4 }, { "Shot", Name = "Marker" } } },
		{ At = 9.6, Cue = "Aftermath", Actions = { { "Popup" }, { "Burst", Kind = "Smoke", Count = 30, Scale = 1.5 }, { "Burst", Kind = "Embers", Count = 30 } } },
		{ At = 11.5, Cue = "Aftermath", Actions = { { "Shot", Name = "HoleWide" } } },
	},
}
