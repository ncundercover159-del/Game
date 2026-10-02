--[[
	Rigs: multi-part rig definitions for the 11 dig tools (GREYBOX stand-ins
	that share pivots, bones, attachment points and clips with the Blender
	hero meshes; blender/assets/tools.py reads this data via
	tools/export_rigs.luau).

	Units: studs, rest pose, +Y up, -Z faces the hole (forward).
	Part roles pick colours from the equipped skin theme:
	  P primary, S secondary, A accent, M metal, G glow (neon accent),
	  W wood, D dark rubber, or a fixed "#RRGGBB".
	Bones: { Name, Parent, Pivot = {x,y,z} }. Parts reference a Bone; their
	positions are in rig space (rest pose). Attachments name VFX points.
]]

local Rigs = {}

local function rig(def)
	def.Bones = def.Bones or { { Name = "Root", Pivot = { 0, 0, 0 } } }
	def.Attachments = def.Attachments or {}
	def.Clips = def.Clips or {}
	return def
end

local function B(bone, size, pos, role, rot, shape)
	return { Bone = bone, Size = size, Pos = pos, Role = role, Rot = rot, Shape = shape or "Block" }
end
local function C(bone, size, pos, role, rot)
	return B(bone, size, pos, role, rot, "Cylinder")
end

------------------------------------------------------------------------------
-- 1. Pebble Toss: a chunky lucky pebble with a glint
------------------------------------------------------------------------------
Rigs.dig_pebble = rig({
	Name = "Pebble",
	Handheld = true,
	Parts = {
		B("Root", { 1.1, 0.85, 1.0 }, { 0, 0, 0 }, "#8E929C", { 10, 20, 5 }),
		B("Root", { 0.75, 0.7, 0.8 }, { 0.25, 0.18, -0.1 }, "#A3A7B0", { -12, 40, 8 }),
		B("Root", { 0.22, 0.22, 0.22 }, { 0.35, 0.42, -0.28 }, "G"),
	},
	Attachments = { Impact = { "Root", { 0, -0.4, 0 } } },
})

------------------------------------------------------------------------------
-- 2. Hand Shovel
------------------------------------------------------------------------------
Rigs.dig_shovel = rig({
	Name = "HandShovel",
	Handheld = true,
	Parts = {
		B("Root", { 0.32, 3.6, 0.32 }, { 0, 0, 0 }, "W"),
		B("Root", { 1.1, 0.3, 0.32 }, { 0, 1.9, 0 }, "D"),
		B("Root", { 0.5, 0.45, 0.42 }, { 0, -1.85, 0 }, "P"),
		B("Root", { 1.4, 1.6, 0.18 }, { 0, -2.75, -0.12 }, "M", { 12, 0, 0 }),
		B("Root", { 1.2, 0.2, 0.22 }, { 0, -3.5, -0.3 }, "A", { 12, 0, 0 }),
	},
	Attachments = { Tip = { "Root", { 0, -3.6, -0.3 } } },
})

------------------------------------------------------------------------------
-- 3. Pickaxe
------------------------------------------------------------------------------
Rigs.dig_pickaxe = rig({
	Name = "Pickaxe",
	Handheld = true,
	Parts = {
		B("Root", { 0.36, 4.4, 0.36 }, { 0, 0, 0 }, "W"),
		B("Root", { 0.5, 0.6, 0.5 }, { 0, 2.0, 0 }, "P"),
		B("Root", { 0.55, 0.55, 1.8 }, { 0, 2.3, -0.9 }, "M", { -12, 0, 0 }),
		B("Root", { 0.55, 0.55, 1.8 }, { 0, 2.3, 0.9 }, "M", { 12, 0, 0 }),
		B("Root", { 0.32, 0.32, 0.8 }, { 0, 2.0, -2.0 }, "S", { -28, 0, 0 }),
		B("Root", { 0.32, 0.32, 0.8 }, { 0, 2.0, 2.0 }, "S", { 28, 0, 0 }),
		B("Root", { 0.4, 0.25, 0.4 }, { 0, -1.6, 0 }, "D"),
	},
	Attachments = { Spark = { "Root", { 0, 1.9, -2.4 } } },
})

------------------------------------------------------------------------------
-- 4. Jackhammer: housing, pumping piston, bit
------------------------------------------------------------------------------
Rigs.dig_jackhammer = rig({
	Name = "Jackhammer",
	Bones = {
		{ Name = "Root", Pivot = { 0, 0, 0 } },
		{ Name = "Piston", Parent = "Root", Pivot = { 0, 1.0, 0 } },
	},
	Parts = {
		B("Root", { 1.7, 2.3, 1.3 }, { 0, 2.6, 0 }, "P"),
		B("Root", { 1.8, 0.35, 1.4 }, { 0, 3.85, 0 }, "S"),
		B("Root", { 3.0, 0.32, 0.32 }, { 0, 4.3, 0 }, "D"),
		B("Root", { 0.32, 0.8, 0.32 }, { -1.35, 3.9, 0 }, "M"),
		B("Root", { 0.32, 0.8, 0.32 }, { 1.35, 3.9, 0 }, "M"),
		B("Root", { 0.5, 0.5, 0.9 }, { 0.6, 2.6, 0.75 }, "A"),
		B("Root", { 0.3, 0.3, 1.2 }, { -0.4, 3.0, 0.9 }, "D", { 40, 0, 0 }),
		C("Piston", { 1.0, 0.7, 0.7 }, { 0, 1.2, 0 }, "M", { 0, 0, 90 }),
		B("Piston", { 0.32, 1.6, 0.32 }, { 0, 0.2, 0 }, "M"),
		B("Piston", { 0.5, 0.4, 0.5 }, { 0, -0.65, 0 }, "S"),
	},
	Attachments = { Impact = { "Piston", { 0, -0.8, 0 } }, Exhaust = { "Root", { -0.4, 3.4, 1.4 } } },
	Clips = {
		Pump = { Length = 0.09, Loop = true, Tracks = { Piston = { { 0, P = { 0, 0, 0 } }, { 0.045, P = { 0, -0.32, 0 }, E = "OutQuad" }, { 0.09, P = { 0, 0, 0 }, E = "InQuad" } } } },
	},
})

------------------------------------------------------------------------------
-- 5. Dynamite Bundle
------------------------------------------------------------------------------
do
	local parts = {}
	for i, off in { { 0, 0 }, { 0.5, 0.15 }, { -0.5, 0.15 }, { 0.25, -0.4 }, { -0.25, -0.4 } } do
		table.insert(parts, C("Root", { 2.2, 0.5, 0.5 }, { off[1], 0, off[2] }, i % 2 == 0 and "#D8322C" or "#E8443A", { 0, 0, 90 }))
	end
	table.insert(parts, B("Root", { 1.5, 0.3, 1.2 }, { 0, 0.35, -0.05 }, "A"))
	table.insert(parts, B("Root", { 1.5, 0.3, 1.2 }, { 0, -0.35, -0.05 }, "A"))
	table.insert(parts, B("Root", { 0.12, 0.9, 0.12 }, { 0, 1.5, 0 }, "W", { 0, 0, 15 }))
	table.insert(parts, B("Root", { 0.3, 0.3, 0.3 }, { 0.12, 2.0, 0 }, "G"))
	Rigs.dig_dynamite = rig({
		Name = "Dynamite",
		Handheld = true,
		Parts = parts,
		Attachments = { Fuse = { "Root", { 0.12, 2.0, 0 } }, Impact = { "Root", { 0, 0, 0 } } },
	})
end

------------------------------------------------------------------------------
-- 6. Excavator: treads, cab, boom-stick-bucket
------------------------------------------------------------------------------
Rigs.dig_excavator = rig({
	Name = "Excavator",
	Bones = {
		{ Name = "Root", Pivot = { 0, 0, 0 } },
		{ Name = "Cab", Parent = "Root", Pivot = { 0, 2.6, 0 } },
		{ Name = "Boom", Parent = "Cab", Pivot = { 0, 5.2, -2.0 } },
		{ Name = "Stick", Parent = "Boom", Pivot = { 0, 9.0, -7.2 } },
		{ Name = "Bucket", Parent = "Stick", Pivot = { 0, 3.0, -12.5 } },
	},
	Parts = {
		B("Root", { 2.2, 2.0, 10 }, { -3.2, 1.0, 0 }, "D"),
		B("Root", { 2.2, 2.0, 10 }, { 3.2, 1.0, 0 }, "D"),
		B("Root", { 2.3, 0.35, 10.2 }, { -3.2, 2.05, 0 }, "M"),
		B("Root", { 2.3, 0.35, 10.2 }, { 3.2, 2.05, 0 }, "M"),
		B("Root", { 4.4, 1.0, 6 }, { 0, 2.1, 0 }, "S"),
		B("Cab", { 7.2, 2.2, 7.6 }, { 0, 3.7, 0.6 }, "P"),
		B("Cab", { 3.6, 3.8, 3.8 }, { -1.6, 6.6, -0.6 }, "P"),
		B("Cab", { 3.3, 2.2, 0.2 }, { -1.6, 7.0, -2.55 }, "#9FD6FF"),
		B("Cab", { 0.2, 2.2, 3.0 }, { -3.45, 7.0, -0.6 }, "#9FD6FF"),
		B("Cab", { 7.2, 2.4, 2.2 }, { 0, 4.6, 4.2 }, "S"),
		B("Cab", { 0.6, 3.2, 0.6 }, { 2.4, 7.2, 2.4 }, "M"),
		B("Cab", { 0.8, 0.5, 0.8 }, { 2.4, 8.9, 2.4 }, "D"),
		B("Cab", { 0.7, 0.7, 0.3 }, { 2.6, 5.4, -2.6 }, "G"),
		B("Boom", { 1.4, 1.5, 9.2 }, { 0, 7.4, -5.2 }, "P", { -24, 0, 0 }),
		B("Boom", { 0.5, 0.5, 4 }, { 0.9, 6.5, -4.0 }, "M", { -20, 0, 0 }),
		B("Stick", { 1.1, 1.2, 7.2 }, { 0, 6.0, -9.8 }, "P", { 40, 0, 0 }),
		B("Stick", { 0.45, 0.45, 3.6 }, { 0.8, 6.8, -9.0 }, "M", { 40, 0, 0 }),
		B("Bucket", { 3.4, 2.0, 1.8 }, { 0, 2.2, -12.8 }, "M"),
		B("Bucket", { 3.4, 0.4, 1.6 }, { 0, 1.1, -13.4 }, "S"),
		B("Bucket", { 0.4, 0.5, 0.6 }, { -1.2, 0.8, -14.2 }, "A"),
		B("Bucket", { 0.4, 0.5, 0.6 }, { 0, 0.8, -14.2 }, "A"),
		B("Bucket", { 0.4, 0.5, 0.6 }, { 1.2, 0.8, -14.2 }, "A"),
	},
	Attachments = { Exhaust = { "Cab", { 2.4, 9.2, 2.4 } }, Impact = { "Bucket", { 0, 0.8, -14 } }, Horn = { "Cab", { 0, 7, 0 } } },
	Clips = {
		Idle = { Length = 1.2, Loop = true, Tracks = { Cab = { { 0, P = { 0, 0, 0 } }, { 0.6, P = { 0, 0.06, 0 }, E = "InOutSine" }, { 1.2, P = { 0, 0, 0 }, E = "InOutSine" } } } },
		Scoop = {
			Length = 2.6,
			Tracks = {
				Boom = { { 0, R = { 0, 0, 0 } }, { 0.5, R = { 12, 0, 0 }, E = "OutBack" }, { 1.2, R = { -26, 0, 0 }, E = "InOutQuad" }, { 2.0, R = { 14, 0, 0 }, E = "OutQuad" }, { 2.6, R = { 0, 0, 0 }, E = "InOutQuad" } },
				Stick = { { 0, R = { 0, 0, 0 } }, { 0.5, R = { -10, 0, 0 }, E = "OutQuad" }, { 1.2, R = { 30, 0, 0 }, E = "InOutQuad" }, { 2.0, R = { -18, 0, 0 }, E = "OutQuad" }, { 2.6, R = { 0, 0, 0 } } },
				Bucket = { { 0, R = { 0, 0, 0 } }, { 1.2, R = { -20, 0, 0 } }, { 1.5, R = { 55, 0, 0 }, E = "OutBack" }, { 2.0, R = { 60, 0, 0 } }, { 2.3, R = { -40, 0, 0 }, E = "OutBack" }, { 2.6, R = { 0, 0, 0 } } },
				Cab = { { 0, R = { 0, 0, 0 } }, { 1.6, R = { 0, 0, 0 } }, { 2.1, R = { 0, 35, 0 }, E = "InOutQuad" }, { 2.6, R = { 0, 0, 0 }, E = "OutBack" } },
			},
		},
	},
})

------------------------------------------------------------------------------
-- 7. Mega Drill: gantry + cable + helical cone bit
------------------------------------------------------------------------------
do
	local parts = {
		B("Root", { 1.4, 14, 1.4 }, { -7, 7, 0 }, "S"),
		B("Root", { 1.4, 14, 1.4 }, { 7, 7, 0 }, "S"),
		B("Root", { 16, 1.6, 2.2 }, { 0, 14.4, 0 }, "P"),
		B("Root", { 3.4, 2.4, 3.0 }, { 0, 12.6, 0 }, "M"),
		B("Root", { 0.8, 0.8, 0.8 }, { 2, 13.4, -1.6 }, "G"),
	}
	local bitParts = {
		C("Bit", { 2.4, 3.6, 3.6 }, { 0, 0.6, 0 }, "P", { 0, 0, 90 }),
		B("Bit", { 3.8, 0.6, 3.8 }, { 0, 1.8, 0 }, "A"),
	}
	for i = 0, 6 do
		local w = 3.2 - i * 0.42
		table.insert(bitParts, B("Bit", { w, 0.9, w }, { 0, -0.4 - i * 0.9, 0 }, "M", { 0, i * 20, 0 }))
		table.insert(bitParts, B("Bit", { w + 0.6, 0.22, 0.35 }, { 0, -0.6 - i * 0.9, 0 }, "S", { 0, i * 20 + 45, 18 }))
	end
	table.insert(bitParts, B("Bit", { 0.5, 1.0, 0.5 }, { 0, -6.9, 0 }, "G"))
	for _, p in bitParts do
		table.insert(parts, p)
	end
	table.insert(parts, B("Cable", { 0.25, 10, 0.25 }, { 0, 5, 0 }, "D"))
	Rigs.dig_megadrill = rig({
		Name = "MegaDrill",
		Bones = {
			{ Name = "Root", Pivot = { 0, 0, 0 } },
			{ Name = "Bit", Parent = "Root", Pivot = { 0, 0, 0 } },
			{ Name = "Cable", Parent = "Root", Pivot = { 0, 0, 0 } },
		},
		Parts = parts,
		Attachments = { Impact = { "Bit", { 0, -7.2, 0 } }, Spark = { "Bit", { 0, -4, 0 } } },
		Clips = { Spin = { Length = 0.36, Loop = true, Tracks = { Bit = { { 0, R = { 0, 0, 0 } }, { 0.18, R = { 0, 180, 0 }, E = "Linear" }, { 0.36, R = { 0, 360, 0 }, E = "Linear" } } } } },
	})
end

------------------------------------------------------------------------------
-- 8. Tunnel Boring Machine: cutter-head + segmented body
------------------------------------------------------------------------------
do
	local parts = {}
	for i = 0, 3 do
		table.insert(parts, C("Root", { 4.4, 9.2 - i * 0.3, 9.2 - i * 0.3 }, { 0, 0, 3.0 + i * 4.6 }, i % 2 == 0 and "P" or "S", { 0, 90, 0 }))
		table.insert(parts, C("Root", { 0.6, 9.8 - i * 0.3, 9.8 - i * 0.3 }, { 0, 0, 0.9 + i * 4.6 }, "M", { 0, 90, 0 }))
	end
	table.insert(parts, B("Root", { 1.4, 1.4, 14 }, { 3.6, -3.2, 9 }, "D"))
	table.insert(parts, B("Root", { 1.0, 1.0, 1.0 }, { 3.4, 3.4, 1.2 }, "G"))
	table.insert(parts, B("Root", { 1.0, 1.0, 1.0 }, { -3.4, 3.4, 1.2 }, "G"))
	table.insert(parts, C("Head", { 1.6, 10.4, 10.4 }, { 0, 0, -0.8 }, "M", { 0, 90, 0 }))
	table.insert(parts, B("Head", { 2.2, 2.2, 2.6 }, { 0, 0, -2.4 }, "A", { 0, 0, 45 }))
	for k = 0, 7 do
		local a = k / 8 * math.pi * 2
		table.insert(parts, C("Head", { 0.8, 1.4, 1.4 }, { math.cos(a) * 3.6, math.sin(a) * 3.6, -1.9 }, "S", { 0, 90, 0 }))
		table.insert(parts, B("Head", { 0.5, 4.8, 0.6 }, { math.cos(a) * 2.6, math.sin(a) * 2.6, -1.7 }, "P", { 0, 0, math.deg(a) + 90 }))
	end
	Rigs.dig_tbm = rig({
		Name = "TunnelBoringMachine",
		Bones = { { Name = "Root", Pivot = { 0, 0, 0 } }, { Name = "Head", Parent = "Root", Pivot = { 0, 0, -1 } } },
		Parts = parts,
		Attachments = { Impact = { "Head", { 0, 0, -3 } }, LightL = { "Root", { -3.4, 3.4, 0.6 } }, LightR = { "Root", { 3.4, 3.4, 0.6 } } },
		Clips = { Spin = { Length = 1.2, Loop = true, Tracks = { Head = { { 0, R = { 0, 0, 0 } }, { 0.6, R = { 0, 0, 180 }, E = "Linear" }, { 1.2, R = { 0, 0, 360 }, E = "Linear" } } } } },
	})
end

------------------------------------------------------------------------------
-- 9. Orbital Drill Strike: satellite + drill bolt
------------------------------------------------------------------------------
Rigs.dig_orbital = rig({
	Name = "OrbitalStrike",
	Bones = {
		{ Name = "Root", Pivot = { 0, 0, 0 } },
		{ Name = "Satellite", Parent = "Root", Pivot = { 0, 0, 0 } },
		{ Name = "Bolt", Parent = "Root", Pivot = { 0, 0, 0 } },
	},
	Parts = {
		B("Satellite", { 4, 4, 5 }, { 0, 0, 0 }, "S"),
		B("Satellite", { 10, 0.3, 3.6 }, { -7.4, 0, 0 }, "#3C5CC8"),
		B("Satellite", { 10, 0.3, 3.6 }, { 7.4, 0, 0 }, "#3C5CC8"),
		B("Satellite", { 0.4, 0.4, 2 }, { 0, 0, 0 }, "M"),
		C("Satellite", { 0.6, 3.4, 3.4 }, { 0, -2.6, 0 }, "P", { 0, 0, 90 }),
		B("Satellite", { 0.6, 0.6, 0.6 }, { 0, -3.4, 0 }, "G"),
		B("Bolt", { 1.6, 6, 1.6 }, { 0, 3, 0 }, "P"),
		B("Bolt", { 1.2, 1.6, 1.2 }, { 0, -0.6, 0 }, "M"),
		B("Bolt", { 0.6, 1.2, 0.6 }, { 0, -1.8, 0 }, "G"),
		B("Bolt", { 3, 2, 0.3 }, { 0, 5.6, 0 }, "A"),
		B("Bolt", { 0.3, 2, 3 }, { 0, 5.6, 0 }, "A"),
	},
	Attachments = { Beam = { "Satellite", { 0, -3.6, 0 } }, Impact = { "Bolt", { 0, -2.4, 0 } }, Trail = { "Bolt", { 0, 6, 0 } } },
})

------------------------------------------------------------------------------
-- 10. Tactical Nuke: a stylised cartoon missile
------------------------------------------------------------------------------
Rigs.dig_nuke = rig({
	Name = "CartoonMissile",
	Bones = { { Name = "Root", Pivot = { 0, 0, 0 } }, { Name = "Fins", Parent = "Root", Pivot = { 0, 0, 0 } } },
	Parts = {
		C("Root", { 10, 3, 3 }, { 0, 5, 0 }, "#F2F2F0", { 0, 0, 90 }),
		B("Root", { 2.4, 2.4, 2.4 }, { 0, 10.6, 0 }, "P", { 45, 0, 45 }),
		B("Root", { 1.6, 1.6, 1.6 }, { 0, 11.6, 0 }, "P", { 45, 0, 45 }),
		C("Root", { 0.7, 3.1, 3.1 }, { 0, 7.5, 0 }, "A", { 0, 0, 90 }),
		C("Root", { 0.7, 3.1, 3.1 }, { 0, 3.5, 0 }, "A", { 0, 0, 90 }),
		B("Root", { 0.9, 0.9, 0.2 }, { -0.6, 8.8, -1.5 }, "#1A1A1A"),
		B("Root", { 0.9, 0.9, 0.2 }, { 0.6, 8.8, -1.5 }, "#1A1A1A"),
		B("Fins", { 0.3, 2.6, 2.4 }, { 0, 0.9, 1.9 }, "S"),
		B("Fins", { 0.3, 2.6, 2.4 }, { 0, 0.9, -1.9 }, "S"),
		B("Fins", { 2.4, 2.6, 0.3 }, { 1.9, 0.9, 0 }, "S"),
		B("Fins", { 2.4, 2.6, 0.3 }, { -1.9, 0.9, 0 }, "S"),
		B("Root", { 1.4, 1.0, 1.4 }, { 0, -0.4, 0 }, "G"),
	},
	Attachments = { Impact = { "Root", { 0, 12, 0 } }, Exhaust = { "Root", { 0, -0.8, 0 } } },
	Clips = { Spin = { Length = 0.8, Loop = true, Tracks = { Fins = { { 0, R = { 0, 0, 0 } }, { 0.8, R = { 0, 360, 0 }, E = "Linear" } } } } },
})

------------------------------------------------------------------------------
-- 11. The Big One: colossal golden drill-ship
------------------------------------------------------------------------------
do
	local parts = {
		B("Root", { 26, 6, 12 }, { 0, 0, 0 }, "#F7A81B"),
		B("Root", { 22, 3, 10 }, { 0, 4.4, 0 }, "#FFD36B"),
		B("Root", { 6, 6, 6 }, { -6, 8.6, 0 }, "#F7A81B"),
		B("Root", { 4.4, 1.8, 0.3 }, { -6, 9.4, -3.1 }, "#9FD6FF"),
		B("Root", { 30, 1.0, 2 }, { 0, -2.6, -6.6 }, "A"),
		B("Root", { 30, 1.0, 2 }, { 0, -2.6, 6.6 }, "A"),
		B("Root", { 18, 3, 0.4 }, { 3, 3.6, -6.2 }, "#2A1A08"),
		B("Root", { 2, 9, 2 }, { 10, 8, 3 }, "M"),
		B("Root", { 2.6, 1, 2.6 }, { 10, 13, 3 }, "G"),
	}
	for _, x in { -13, 13 } do
		table.insert(parts, C("Engines", { 8, 4.2, 4.2 }, { x, -1, 0 }, "S", { 0, 90, 0 }))
		table.insert(parts, C("Engines", { 0.8, 3.6, 3.6 }, { x, -1, 4.2 }, "G", { 0, 90, 0 }))
	end
	for i = 0, 8 do
		local w = 9 - i * 0.95
		table.insert(parts, B("Drill", { w, 2.2, w }, { 0, -4.2 - i * 2.2, 0 }, i % 2 == 0 and "#FFD36B" or "#F7A81B", { 0, i * 22, 0 }))
		table.insert(parts, B("Drill", { w + 1.2, 0.5, 0.7 }, { 0, -4.6 - i * 2.2, 0 }, "M", { 0, i * 22 + 40, 16 }))
	end
	table.insert(parts, B("Drill", { 1.2, 2.4, 1.2 }, { 0, -24.4, 0 }, "G"))
	Rigs.dig_bigone = rig({
		Name = "DrillShip",
		Bones = {
			{ Name = "Root", Pivot = { 0, 0, 0 } },
			{ Name = "Drill", Parent = "Root", Pivot = { 0, -4, 0 } },
			{ Name = "Engines", Parent = "Root", Pivot = { 0, -1, 0 } },
		},
		Parts = parts,
		Attachments = {
			Impact = { "Drill", { 0, -25, 0 } },
			EngineL = { "Engines", { -13, -1, 4.6 } },
			EngineR = { "Engines", { 13, -1, 4.6 } },
			NamePlate = { "Root", { 3, 3.6, -6.5 } },
		},
		Clips = { Spin = { Length = 0.5, Loop = true, Tracks = { Drill = { { 0, R = { 0, 0, 0 } }, { 0.5, R = { 0, 360, 0 }, E = "Linear" } } } } },
	})
end

-- Preview loop clip per tool (store viewport)
Rigs.PreviewClip = {
	dig_jackhammer = "Pump",
	dig_excavator = "Scoop",
	dig_megadrill = "Spin",
	dig_tbm = "Spin",
	dig_nuke = "Spin",
	dig_bigone = "Spin",
}

return Rigs
