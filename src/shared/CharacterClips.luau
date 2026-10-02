--[[
	CharacterClips: R15 action poses for dig performers (KeyframeLite format,
	applied as additive Motor6D C0 offsets on each client). The same data is
	exported to KeyframeSequence .rbxm files for upload (tools/export_anims.luau);
	when AssetRegistry.Animations has an id for a clip, the Animator plays
	that instead. Joints: RightShoulder, LeftShoulder, Waist, Neck, Root.
]]

return {
	WindUp = {
		Length = 0.45,
		Tracks = {
			RightShoulder = { { 0, R = { 0, 0, 0 } }, { 0.45, R = { 150, 0, -20 }, E = "OutBack" } },
			Waist = { { 0, R = { 0, 0, 0 } }, { 0.45, R = { -10, 35, 0 }, E = "OutQuad" } },
			Neck = { { 0, R = { 0, 0, 0 } }, { 0.45, R = { 8, -15, 0 }, E = "OutQuad" } },
		},
	},
	Throw = {
		Length = 0.5,
		Tracks = {
			RightShoulder = { { 0, R = { 150, 0, -20 } }, { 0.15, R = { -40, 0, 10 }, E = "InQuad" }, { 0.5, R = { 0, 0, 0 }, E = "OutBack" } },
			Waist = { { 0, R = { -10, 35, 0 } }, { 0.15, R = { 15, -30, 0 }, E = "InQuad" }, { 0.5, R = { 0, 0, 0 }, E = "OutQuad" } },
		},
	},
	Swing = {
		Length = 0.7,
		Tracks = {
			RightShoulder = { { 0, R = { 0, 0, 0 } }, { 0.3, R = { 170, 0, 0 }, E = "OutBack" }, { 0.45, R = { 20, 0, 0 }, E = "InCubic" }, { 0.7, R = { 0, 0, 0 }, E = "OutQuad" } },
			LeftShoulder = { { 0, R = { 0, 0, 0 } }, { 0.3, R = { 165, 0, 0 }, E = "OutBack" }, { 0.45, R = { 25, 0, 0 }, E = "InCubic" }, { 0.7, R = { 0, 0, 0 }, E = "OutQuad" } },
			Waist = { { 0, R = { 0, 0, 0 } }, { 0.3, R = { -18, 0, 0 }, E = "OutQuad" }, { 0.45, R = { 22, 0, 0 }, E = "InCubic" }, { 0.7, R = { 0, 0, 0 }, E = "OutQuad" } },
		},
	},
	Scoop = {
		Length = 0.55,
		Tracks = {
			RightShoulder = { { 0, R = { 0, 0, 0 } }, { 0.25, R = { 60, 0, 0 }, E = "OutQuad" }, { 0.55, R = { 120, 0, -10 }, E = "OutBack" } },
			LeftShoulder = { { 0, R = { 0, 0, 0 } }, { 0.25, R = { 50, 0, 0 }, E = "OutQuad" }, { 0.55, R = { 100, 0, 10 }, E = "OutBack" } },
			Waist = { { 0, R = { 0, 0, 0 } }, { 0.25, R = { 25, 0, 0 }, E = "OutQuad" }, { 0.55, R = { -10, 0, 0 }, E = "OutBack" } },
		},
	},
	Brace = {
		Length = 0.3,
		Tracks = {
			RightShoulder = { { 0, R = { 0, 0, 0 } }, { 0.3, R = { 70, 0, -10 }, E = "OutBack" } },
			LeftShoulder = { { 0, R = { 0, 0, 0 } }, { 0.3, R = { 70, 0, 10 }, E = "OutBack" } },
			Waist = { { 0, R = { 0, 0, 0 } }, { 0.3, R = { 20, 0, 0 }, E = "OutQuad" } },
		},
	},
	Point = {
		Length = 0.35,
		Tracks = {
			RightShoulder = { { 0, R = { 0, 0, 0 } }, { 0.35, R = { 165, 0, 0 }, E = "OutBack" } },
			Neck = { { 0, R = { 0, 0, 0 } }, { 0.35, R = { 25, 0, 0 }, E = "OutQuad" } },
		},
	},
	Celebrate = {
		Length = 1.2,
		Loop = false,
		Tracks = {
			RightShoulder = { { 0, R = { 0, 0, 0 } }, { 0.25, R = { 170, 0, -25 }, E = "OutBack" }, { 0.6, R = { 150, 0, -10 }, E = "InOutSine" }, { 0.9, R = { 170, 0, -25 }, E = "InOutSine" }, { 1.2, R = { 0, 0, 0 }, E = "OutQuad" } },
			LeftShoulder = { { 0, R = { 0, 0, 0 } }, { 0.25, R = { 170, 0, 25 }, E = "OutBack" }, { 0.6, R = { 150, 0, 10 }, E = "InOutSine" }, { 0.9, R = { 170, 0, 25 }, E = "InOutSine" }, { 1.2, R = { 0, 0, 0 }, E = "OutQuad" } },
			Root = { { 0, P = { 0, 0, 0 } }, { 0.3, P = { 0, 1.2, 0 }, E = "OutQuad" }, { 0.6, P = { 0, 0, 0 }, E = "OutBounce" }, { 1.2, P = { 0, 0, 0 } } },
		},
	},
}
