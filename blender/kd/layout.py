#!/usr/bin/env python3
"""Map layout generator: the single source of truth for the world.

Writes assets/layout.json, read by:
  * tools/build_place.luau (Lune) -> GREYBOX Roblox parts in place/KeepDigging.rbxl
  * blender/build_scene.py         -> the bevelled, textured Blender art scene
                                      and the per-module FBX exports

Coordinates are Roblox studs: X east, Y up, Z south (the hero camera looks
north, toward -Z). Rotations are degrees, applied X then Y then Z like
CFrame.Angles. The composition reproduces reference/hero.png (see
docs/REFERENCE_SPEC.md).

    python3 blender/kd/layout.py
"""
import json
import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from palette import MATERIALS  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets" / "layout.json"

U = 4  # voxel unit, studs
SEED = 20261002

# Must match src/shared/Strata.luau (checked by tools/build_place.luau).
BANDS = [
    ("Topsoil", 0, -12, 60),
    ("Stone", -12, -24, 53),
    ("Ore", -24, -40, 46),
    ("Crystal", -40, -56, 39),
    ("Magma", -56, -68, 33),
]
FLOOR_Y = -68
CORE = ("Core", -68, -72, 28)
HOLE_R = 60
PATH_R = 74  # outer edge of the sand ring around the fence
FENCE_R = 62.6
ISLAND_R = 226
HERO_CAMERA = (0.0, 104.0, 152.0)
STATION_ANGLES = [20, 64, 116, 160, 204, 336]
LADDER_ANGLE = -52.0
BAY_RADIUS = 86.0


def clamp(v, a, b):
    return max(a, min(b, v))


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def rgb_to_hex(c):
    return "#%02X%02X%02X" % tuple(int(clamp(round(x), 0, 255)) for x in c)


def yaw_to(src, dst):
    """Yaw (deg) so a part at src has its front (-Z) facing dst."""
    dx, dz = dst[0] - src[0], dst[2] - src[2]
    return math.degrees(math.atan2(-dx, -dz))


class Module:
    def __init__(self, layout, key, name, path, pivot=(0, 0, 0), yaw=0.0, tags=None, attrs=None, greybox=True, unique=True):
        self.layout = layout
        self.key = key
        self.name = name
        self.path = path
        self.pivot = list(pivot)
        self.yaw = yaw
        self.tags = list(tags or [])
        self.attrs = dict(attrs or {})
        self.greybox = greybox
        self.unique = unique
        self.parts = []

    def colour(self, mat, shade=None, jitter=0.05):
        light, mid, dark = MATERIALS[mat][1]
        rng = self.layout.rng
        if shade is None:
            r = rng.random()
            base = light if r < 0.25 else (mid if r < 0.75 else dark)
        else:
            base = (light, mid, dark)[shade]
        if jitter:
            k = 1 + rng.uniform(-jitter, jitter)
            return rgb_to_hex(tuple(x * k for x in hex_to_rgb(base)))
        return base

    def part(self, shape, size, pos, mat, rot=(0, 0, 0), shade=None, color=None, name=None, tags=None,
             attrs=None, transparency=None, collide=True, shadow=True, light=None, gui=None, jitter=0.05,
             cls=None, anchored=True):
        p = {
            "s": shape,
            "z": [round(v, 3) for v in size],
            "p": [round(v, 3) for v in pos],
            "m": mat,
            "c": color or self.colour(mat, shade, jitter),
        }
        if any(abs(r) > 1e-6 for r in rot):
            p["r"] = [round(v, 3) for v in rot]
        if name:
            p["n"] = name
        if tags:
            p["tags"] = list(tags)
        if attrs:
            p["a"] = dict(attrs)
        extra = MATERIALS[mat][2]
        t = transparency if transparency is not None else extra.get("transparency")
        if t:
            p["t"] = t
        if extra.get("reflectance"):
            p["rf"] = extra["reflectance"]
        if not collide:
            p["nc"] = 1
        if not shadow:
            p["ns"] = 1
        if light:
            p["light"] = light
        if gui:
            p["gui"] = gui
        if cls:
            p["cls"] = cls
        self.parts.append(p)
        return p

    def box(self, size, pos, mat, **kw):
        return self.part("Block", size, pos, mat, **kw)

    def to_json(self):
        return {
            "key": self.key,
            "name": self.name,
            "path": self.path,
            "pivot": [round(v, 3) for v in self.pivot],
            "yaw": round(self.yaw, 3),
            "tags": self.tags,
            "attrs": self.attrs,
            "greybox": self.greybox,
            "parts": self.parts,
        }


class Layout:
    def __init__(self, seed=SEED):
        self.rng = random.Random(seed)
        self.modules = []
        self.occupied = []  # (x, z, radius) keep-out circles for scatter

    def module(self, key, name, path, **kw):
        m = Module(self, key, name, path, **kw)
        self.modules.append(m)
        return m

    def reserve(self, x, z, r):
        self.occupied.append((x, z, r))

    def free(self, x, z, r):
        for ox, oz, orr in self.occupied:
            if (x - ox) ** 2 + (z - oz) ** 2 < (r + orr) ** 2:
                return False
        return True


# ---------------------------------------------------------------------------
# Ground material map
# ---------------------------------------------------------------------------
PATHS = [
    # (x0, z0, x1, z1, half-width) sand paths radiating from the rim ring
    (0, 70, 0, 128, 6),  # south: spawn plaza
    (-40, -62, -54, -132, 5),  # north: to the gate doorway (west of centre)
    (40, -62, 54, -132, 5),
    (0, -74, 0, -138, 7),  # gate steps
    (-58, 50, -128, 104, 4),  # artifacts hall
    (56, 54, 118, 134, 5),  # portal
    (-62, -36, -98, -98, 4),  # beginner obby
    (58, -40, 96, -104, 4),  # pro obby / stall
    (70, 6, 160, 40, 4),  # golden relic
    (-70, -6, -160, -24, 4),  # top diggers board
]
PONDS = [(-200, 22, 15), (-182, -158, 9)]
SAND_PLAZAS = [(128, 146, 24), (0, 120, 18), (0, -128, 14)]


def dist_seg(px, pz, x0, z0, x1, z1):
    vx, vz = x1 - x0, z1 - z0
    wx, wz = px - x0, pz - z0
    t = clamp((wx * vx + wz * vz) / max(1e-9, vx * vx + vz * vz), 0, 1)
    cx, cz = x0 + vx * t, z0 + vz * t
    return math.hypot(px - cx, pz - cz)


def island_radius(theta):
    return ISLAND_R + 10 * math.sin(3 * theta + 0.5) + 7 * math.cos(5 * theta) + 5 * math.sin(7 * theta + 1.3)


def ground_material(x, z):
    r = math.hypot(x, z)
    theta = math.atan2(z, x)
    if r > island_radius(theta):
        return None
    if r < HOLE_R + 4:
        return "hole"
    for px, pz, pr in PONDS:
        if math.hypot(x - px, z - pz) < pr:
            return "water"
    if r < PATH_R:
        return "sand"
    for x0, z0, x1, z1, w in PATHS:
        if dist_seg(x, z, x0, z0, x1, z1) < w:
            return "sand"
    for px, pz, pr in SAND_PLAZAS:
        if math.hypot(x - px, z - pz) < pr:
            return "sand"
    return "grass"


def build_ground(L):
    top = L.module("env_island_top", "IslandTop", "Map/Ground", greybox=True)
    body = L.module("env_island_body", "IslandBody", "Map/Ground", greybox=True)
    half = 232
    rows = list(range(-half, half, U))
    for z0 in rows:
        cz = z0 + U / 2
        run_mat, run_start, cells = None, None, []
        xs = list(range(-half, half, U))
        for x0 in xs + [half]:
            cx = x0 + U / 2
            mat = ground_material(cx, cz) if x0 < half else None
            if mat != run_mat or (run_mat and (x0 - run_start) >= 12 * U):
                if run_mat and run_mat != "hole":
                    length = x0 - run_start
                    centre_x = run_start + length / 2
                    if run_mat == "water":
                        top.box((length, 1.0, U), (centre_x, -1.6, cz), "water", collide=False, shadow=False)
                        top.box((length, 2.1, U), (centre_x, -3.05, cz), "dirt_dark")
                    else:
                        top.box((length, U, U), (centre_x, -U / 2, cz), run_mat)
                run_mat, run_start = mat, x0
        # body: wide strips under the top layer, skipping the hole
        inside = [x0 for x0 in xs if ground_material(x0 + U / 2, cz) not in (None,)]
        if not inside:
            continue
        xmin, xmax = min(inside), max(inside) + U
        if abs(cz) < HOLE_R + 8:
            hx = math.sqrt(max(0.0, (HOLE_R + 8) ** 2 - cz * cz))
            spans = [(xmin, -hx), (hx, xmax)]
        else:
            spans = [(xmin, xmax)]
        for a, b in spans:
            if b - a > 0.5:
                body.box((b - a, 24, U), ((a + b) / 2, -16, cz), "dirt", jitter=0.03)
                # stone strata on the cliff faces only (outer 20 studs of the row)
                for ea, eb in ((a, min(b, a + 20)), (max(a, b - 20), b)):
                    if eb - ea > 0.5:
                        body.box((eb - ea, 20, U), ((ea + eb) / 2, -38, cz), "cobble", jitter=0.04)
    # fill under the plaza far from edges (hidden), keeps the island solid
    # Voxel bumps: raised grass blocks scattered over open grass
    bumps = L.module("env_grass_bumps", "GrassBumps", "Map/Ground")
    count = 0
    tries = 0
    while count < 140 and tries < 4000:
        tries += 1
        x = L.rng.uniform(-215, 215)
        z = L.rng.uniform(-215, 215)
        x, z = round(x / U) * U, round(z / U) * U
        if ground_material(x, z) != "grass" or math.hypot(x, z) < PATH_R + 8 or not L.free(x, z, 3):
            continue
        h = L.rng.choice([1.0, 1.5, 2.0])
        bumps.box((U, h, U), (x, h / 2, z), "grass", shade=L.rng.choice([0, 1, 2]))
        count += 1


# ---------------------------------------------------------------------------
# The hole
# ---------------------------------------------------------------------------
def band_cell_material(band, rng, layer_index, layers):
    r = rng.random()
    if band == "Topsoil":
        return "stone_chunk" if r < 0.12 else "dirt"
    if band == "Stone":
        if r < 0.07 and 0 < layer_index < layers - 1:
            return "fossil"
        return "stone_chunk" if r < 0.15 else "cobble"
    if band == "Ore":
        if r < 0.05:
            return "iron"
        return "coal"
    if band == "Crystal":
        return "cavern_deep" if r < 0.3 else "cavern"
    if band == "Magma":
        return "lava" if r < 0.09 else "magma_rock"
    return "core_gold"


def build_hole(L):
    rng = L.rng
    prev_r = HOLE_R + 4
    centres = [((i + 0.5) * U) for i in range(-20, 20)]
    for name, ytop, ybot, radius in BANDS:
        walls = L.module(f"env_hole_{name.lower()}", f"Wall_{name}", "Map/Hole", tags=["HoleWall"], attrs={"Band": name})
        layers = int((ytop - ybot) / U)
        for li in range(layers):
            y = ytop - U * li - U / 2
            for cx in centres:
                for cz in centres:
                    r = math.hypot(cx, cz)
                    if r < radius:
                        continue
                    neighbour_inside = any(math.hypot(cx + dx, cz + dz) < radius for dx, dz in ((U, 0), (-U, 0), (0, U), (0, -U)))
                    is_ledge = li == 0 and r < prev_r
                    if not (neighbour_inside or is_ledge):
                        continue
                    mat = band_cell_material(name, rng, li, layers)
                    if name == "Topsoil" and li == 0:
                        # grass-capped rim blocks: green top, dirt sides
                        walls.box((U, 0.9, U), (cx, -0.45, cz), "grass")
                        walls.box((U, U - 0.9, U), (cx, -U / 2 - 0.45, cz), "dirt")
                        continue
                    walls.box((U, U, U), (cx, y, cz), mat)
                    if neighbour_inside and name == "Ore" and rng.random() < 0.16:
                        # inset ore glints / lantern windows on the inner face
                        inward = (-cx / r, -cz / r)
                        gm = "lantern_window" if rng.random() < 0.45 else "ore_glint"
                        sz = 1.3 if gm == "lantern_window" else 0.9
                        walls.box((sz, sz, sz), (cx + inward[0] * (U / 2), y + rng.uniform(-0.8, 0.8), cz + inward[1] * (U / 2)), gm, collide=False, shadow=False)
        # backing octagon ring (hidden; keeps the ground solid behind the wall)
        backing = L.module(f"env_hole_{name.lower()}_backing", f"Backing_{name}", "Map/Hole", greybox=False)
        mid_r = (radius + U + HOLE_R + 12) / 2
        thickness = (HOLE_R + 12) - (radius + U)
        if thickness > 1:
            for k in range(8):
                a = k * math.pi / 4
                seg = 2 * mid_r * math.tan(math.pi / 8) + 2
                btop = min(ytop, -4.2)
                backing.box((seg, btop - ybot, thickness), (math.cos(a) * mid_r, (btop + ybot) / 2, math.sin(a) * mid_r),
                            "dirt_dark", rot=(0, -math.degrees(a) + 90, 0), shadow=False, jitter=0)
        prev_r = radius

    # crystal clusters in the cavern band (protruding from wall and ledges)
    crystals = L.module("env_hole_crystals", "CrystalClusters", "Map/Hole", tags=["CrystalCluster"])
    cyan, purple, magenta = "crystal_cyan", "crystal_purple", "crystal_magenta"
    for k in range(14):
        a = k / 14 * 2 * math.pi + rng.uniform(-0.15, 0.15)
        y = rng.uniform(-54, -42)
        rr = 39 + 0.6
        base = (math.cos(a) * rr, y, math.sin(a) * rr)
        mat = rng.choice([cyan, cyan, purple, purple, magenta])
        n = rng.randint(3, 5)
        for j in range(n):
            h = rng.uniform(1.8, 4.2)
            w = rng.uniform(0.6, 1.1)
            tilt = rng.uniform(-35, 35)
            crystals.box((w, h, w), (base[0] + rng.uniform(-1, 1), base[1] + h / 2 - 0.5, base[2] + rng.uniform(-1, 1)), mat,
                         rot=(rng.uniform(-30, 30), math.degrees(-a) + rng.uniform(-20, 20), tilt), collide=False)
        crystals.box((0.4, 0.4, 0.4), base, "invisible", collide=False, shadow=False,
                     light={"type": "Point", "range": 13, "brightness": 2.2, "color": MATERIALS[mat][1][1]})
    # big purple cluster low-left on the far wall (as in the reference)
    a = math.radians(-128)
    base = (math.cos(a) * 38.5, -55, math.sin(a) * 38.5)
    for j, (h, tx, tz) in enumerate([(6, 0, 0), (4.5, -1.3, 0.6), (5, 1.2, -0.4), (3.2, 0.4, 1.2), (3.6, -0.6, -1.3)]):
        crystals.box((1.4, h, 1.4), (base[0] + tx, base[1] + h / 2, base[2] + tz), purple if j % 2 == 0 else magenta,
                     rot=(tz * 12, 0, -tx * 14), collide=False)

    # lava flows down the magma band
    flows = L.module("env_hole_lavaflows", "LavaFlows", "Map/Hole")
    for k in range(6):
        a = k / 6 * 2 * math.pi + 0.4
        rr = 33 + 0.4
        flows.box((1.6, 11.5, 0.6), (math.cos(a) * rr, -62, math.sin(a) * rr), "lava", rot=(0, -math.degrees(a) + 90, 0), collide=False)

    # floor: magma with lava pools (tagged for the bottom reveal)
    floor = L.module("env_hole_floor", "Floor", "Map/Hole", tags=["HoleFloor"])
    for cx in centres:
        for cz in centres:
            r = math.hypot(cx, cz)
            if r < 33 + U:
                pool = math.hypot(cx - 6, cz + 5) < 7 or math.hypot(cx + 11, cz - 8) < 5 or rng.random() < 0.06
                if pool:
                    floor.box((U, 0.8, U), (cx, FLOOR_Y - 0.6, cz), "lava", collide=True)
                    floor.box((U, 3.4, U), (cx, FLOOR_Y - 2.7, cz), "magma_rock")
                else:
                    floor.box((U, U, U), (cx, FLOOR_Y - U / 2, cz), "magma_floor")
    floor.box((2, 2, 2), (0, FLOOR_Y + 3, 0), "invisible", collide=False, shadow=False,
              light={"type": "Point", "range": 40, "brightness": 3, "color": "#FE761D"})

    # core chamber below the floor (hidden until the bottom reveal)
    core = L.module("env_core", "CoreChamber", "Map/Hole", tags=["CoreChamber"])
    for k in range(16):
        a = k / 16 * 2 * math.pi
        core.box((12, 28, 3), (math.cos(a) * 29, -86, math.sin(a) * 29), "core_gold", rot=(0, -math.degrees(a) + 90, 0))
    core.box((80, 4, 80), (0, -102, 0), "core_gold")
    core.box((3, 3, 3), (0, -86, 0), "invisible", collide=False, shadow=False,
             light={"type": "Point", "range": 50, "brightness": 4, "color": "#FFE1A0"})


def build_ladder(L):
    """Timber ladder and scaffold down the far-right wall: the depth gauge."""
    a = math.radians(LADDER_ANGLE)
    out = (math.cos(a), math.sin(a))
    tan = (-math.sin(a), math.cos(a))
    yaw = -math.degrees(a) - 90
    ladder = L.module("env_ladder", "Ladder", "Map/Ladder", tags=["Ladder"])
    for name, ytop, ybot, radius in BANDS:
        r = radius - 0.7
        for side in (-1.5, 1.5):
            x = out[0] * r + tan[0] * side
            z = out[1] * r + tan[1] * side
            ladder.box((0.45, ytop - ybot, 0.45), (x, (ytop + ybot) / 2, z), "wood_dark", rot=(0, yaw, 0), tags=["ReactLadder"])
        y = ytop - 0.8
        while y > ybot:
            ladder.box((3.2, 0.3, 0.3), (out[0] * r, y, out[1] * r), "wood", rot=(0, yaw, 0), collide=False)
            y -= 1.6
        # scaffold platform at each ledge
        ladder.box((4.2, 0.5, 4.2), (out[0] * (radius + 1.2), ytop - 0.25, out[1] * (radius + 1.2)), "wood", rot=(0, yaw, 0))
        # lantern stop per band
        lx, lz = out[0] * (r - 0.6) + tan[0] * 2.6, out[1] * (r - 0.6) + tan[1] * 2.6
        ladder.box((0.9, 1.2, 0.9), (lx, ytop - 3, lz), "lantern_glass", collide=False,
                   light={"type": "Point", "range": 12, "brightness": 1.6, "color": "#FFC86B"}, tags=["ReactLantern"])
    # gauge plaques every 5% of the target (text updated by clients per cycle)
    plaques = L.module("env_gauge_plaques", "GaugePlaques", "Map/Ladder")
    fractions = [(i * 5) / 100 for i in range(1, 20)]
    band_fractions = [(0.0, 0.15), (0.15, 0.35), (0.35, 0.55), (0.55, 0.78), (0.78, 0.95)]
    for f in fractions:
        y = None
        rad = None
        for (fa, fb), (_, ytop, ybot, radius) in zip(band_fractions, BANDS):
            if f <= fb:
                y = ytop + (ybot - ytop) * (f - fa) / (fb - fa)
                rad = radius
                break
        if y is None:
            continue
        px = out[0] * (rad - 0.6) - tan[0] * 2.8
        pz = out[1] * (rad - 0.6) - tan[1] * 2.8
        plaques.box((2.6, 1.3, 0.25), (px, y, pz), "wood", rot=(0, yaw + 180, 0), collide=False,
                    tags=["GaugePlaque"], attrs={"Percent": int(round(f * 100))},
                    gui={"face": "Back", "ppu": 40, "lines": [{"text": f"{int(round(f * 100))}%", "font": "FredokaOne",
                                                              "color": "#FFE9B8", "stroke": "#2A1A0C", "rect": [0, 0, 1, 1]}]})
    gauge = L.module("marker_depth_gauge", "DepthGauge", "Map/Ladder", greybox=False)
    gauge.box((1, 1, 1), (out[0] * 58, 0, out[1] * 58), "marker", collide=False, shadow=False, tags=["DepthGauge"],
              attrs={"Angle": LADDER_ANGLE})


def build_fence(L):
    fence = L.module("env_fence_ring", "FenceRing", "Map/Rim", tags=["Fence"])
    step = 7.5
    gaps = set()
    for sa in STATION_ANGLES:
        gaps.add(round(sa / step) * step)
    angles = [i * step for i in range(int(360 / step))]
    posts = []
    for i, ang in enumerate(angles):
        if any(abs(((ang - g + 180) % 360) - 180) < step * 0.6 for g in gaps):
            posts.append(None)
            continue
        a = math.radians(ang)
        x, z = math.cos(a) * FENCE_R, math.sin(a) * FENCE_R
        lantern = i % 4 == 0
        h = 5.8 if lantern else 3.4
        fence.box((0.9, h, 0.9), (x, h / 2, z), "wood_dark", rot=(0, -ang, 0), tags=["ReactFence"])
        if lantern:
            fence.box((1.3, 1.5, 1.3), (x, h + 0.75, z), "lantern_glass", collide=False, tags=["ReactLantern"],
                      light={"type": "Point", "range": 13, "brightness": 1.4, "color": "#FFC86B"})
            fence.box((1.6, 0.35, 1.6), (x, h + 1.65, z), "iron_band", collide=False)
        posts.append((x, z))
    n = len(posts)
    for i in range(n):
        p0, p1 = posts[i], posts[(i + 1) % n]
        if not p0 or not p1:
            continue
        mx, mz = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
        length = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
        ang = math.degrees(math.atan2(p1[1] - p0[1], p1[0] - p0[0]))
        for hgt in (1.25, 2.65):
            fence.box((length, 0.38, 0.38), (mx, hgt, mz), "wood", rot=(0, -ang, 0), tags=["ReactFence"])


def build_stations(L):
    for idx, ang in enumerate(STATION_ANGLES, start=1):
        a = math.radians(ang)
        st = L.module("prop_dig_station", f"DigStation{idx}", "Map/Rim/Stations", pivot=(math.cos(a) * 61, 0, math.sin(a) * 61),
                      yaw=-ang - 90, unique=False)
        # stone lip over the edge, little sign, pick rack (local: -Z points into the hole)
        st.box((6, 0.8, 4), (0, 0.4, -0.5), "stone_block")
        st.box((0.5, 3.6, 0.5), (3.6, 1.8, 2.6), "wood_dark")
        st.box((3.2, 1.6, 0.3), (3.6, 3.3, 2.6), "wood",
               gui={"face": "Back", "ppu": 30, "lines": [{"text": "DIG STATION", "font": "FredokaOne", "color": "#FFE9B8", "stroke": "#2A1A0C", "rect": [0, 0, 1, 1]}]})
        st.box((0.3, 2.4, 0.3), (-3.4, 1.2, 2.4), "wood", rot=(0, 0, 18))
        st.box((1.4, 0.4, 0.4), (-3.0, 2.3, 2.4), "metal", rot=(0, 0, 18))
        marker = L.module("marker_station", f"StationAnchor{idx}", "Map/Rim/Stations", greybox=False)
        marker.box((2, 2, 2), (math.cos(a) * 62.5, 2.2, math.sin(a) * 62.5), "invisible", collide=False, shadow=False,
                   tags=["DigStation"], attrs={"StationId": idx})
        L.reserve(math.cos(a) * 62, math.sin(a) * 62, 6)


def build_spawn(L):
    sp = L.module("marker_spawns", "Spawns", "Map/Spawns", greybox=False)
    for i, x in enumerate((-12, -4, 4, 12)):
        sp.box((6, 1, 6), (x, 0.5, 118), "sand", cls="SpawnLocation", tags=["RimSpawn"], shade=0, jitter=0)
    L.reserve(0, 118, 22)


def lantern_post(m, x, z, h=6.0, light=True):
    m.box((0.9, h, 0.9), (x, h / 2, z), "wood_dark", tags=["ReactLantern"])
    m.box((1.4, 1.6, 1.4), (x, h + 0.8, z), "lantern_glass", collide=False, tags=["ReactLantern"],
          light={"type": "Point", "range": 12, "brightness": 1.3, "color": "#FFC86B"} if light else None)
    m.box((1.8, 0.4, 1.8), (x, h + 1.8, z), "iron_band", collide=False)


def build_gate(L):
    gate = L.module("env_gate", "Gate", "Map/Gate", tags=["Gate"])
    zf = -134.0  # front face
    depth = 32
    heights = [40, 48, 56, 64, 72, 72, 72, 72, 72, 64, 56, 48, 40]
    xs = [(-52 + 8 * i + 4) for i in range(13)]
    for x, hmax in zip(xs, heights):
        y = 0
        while y < hmax:
            h = 8
            if abs(x) < 9 and y < 24:  # doorway opening
                y += h
                continue
            mat = "gate_stone" if L.rng.random() > 0.15 else "gate_dark"
            gate.box((8, h, depth), (x, y + h / 2, zf - depth / 2), mat, jitter=0.07)
            y += h
        # mossy cap with a few cube clumps
        gate.box((8.4, 2.2, depth + 0.4), (x, hmax + 1.1, zf - depth / 2), "moss")
        if L.rng.random() < 0.6:
            gate.box((4, 3, 4), (x + L.rng.uniform(-2, 2), hmax + 3.6, zf - depth / 2 + L.rng.uniform(-8, 8)), "leaves")
    # doorway interior and lintel
    gate.box((18, 24, 1), (0, 12, zf - depth + 0.5), "gate_dark", jitter=0)
    gate.box((1, 24, depth), (-9.5, 12, zf - depth / 2), "gate_dark", jitter=0)
    gate.box((1, 24, depth), (9.5, 12, zf - depth / 2), "gate_dark", jitter=0)
    gate.box((22, 3, 4), (0, 25.5, zf + 1), "gate_stone", shade=0)
    # steps up to the doorway
    for i in range(3):
        gate.box((26 - i * 4, 0.9, 3), (0, 0.45 + i * 0.9, zf + 7.5 - i * 3), "stone_block", shade=1)
    # lanterns flanking the doorway and the logo
    for x in (-13, 13):
        lantern_post(gate, x, zf + 4, h=7)
    for x in (-40, 40):
        gate.box((2.2, 2.6, 2.2), (x, 50, zf + 1.6), "lantern_glass", collide=False, tags=["ReactLantern"],
                 light={"type": "Point", "range": 16, "brightness": 1.8, "color": "#FFC86B"})
    # 3D logo plate with SurfaceGui text (matches the reference typography)
    logo = L.module("env_logo", "Logo", "Map/Gate", tags=["Logo"])
    logo.box((76, 32, 1.2), (0, 47, zf + 1.0), "gate_dark", shade=2, jitter=0, gui={
        "face": "Back", "ppu": 12, "lines": [
            {"text": "KEEP", "font": "FredokaOne", "color": "#F7A81B", "gradient": ["#FFD36B", "#F1B23E", "#E08A10"],
             "stroke": "#3A2208", "strokeSize": 6, "rect": [0.12, 0.02, 0.6, 0.46]},
            {"text": "DIGGING!", "font": "FredokaOne", "color": "#E2EBF9", "gradient": ["#FFFFFF", "#E2EBF9", "#C4D5EE"],
             "stroke": "#283457", "strokeSize": 7, "rect": [0.02, 0.48, 0.96, 0.5]},
        ]})
    # the pickaxe leaning off the P
    logo.box((1.4, 18, 1.4), (24, 52, zf + 2.2), "wood", rot=(0, 0, -38))
    logo.box((14, 2.4, 1.6), (29.5, 59, zf + 2.4), "metal", rot=(0, 0, -20))
    logo.box((3, 2, 1.8), (36, 57, zf + 2.4), "iron", rot=(0, 0, -45))
    # Server Depth sign in the doorway (client renders its SurfaceGui)
    sign = L.module("marker_depth_sign", "DepthSign", "Map/Gate", greybox=False)
    sign.box((16, 10, 0.6), (0, 12.5, zf - 3), "board_face", shade=1, tags=["DepthSign"], jitter=0)
    L.reserve(0, zf - 16, 60)


def framed_sign(m, centre, width, height, text, face_mat, text_color, stroke, yaw=0, post_h=None, font="FredokaOne"):
    x, y, z = centre
    m.box((width + 1.2, height + 1.2, 0.7), (x, y, z), "wood", rot=(0, yaw, 0))
    m.box((width, height, 0.8), (x, y, z), face_mat, rot=(0, yaw, 0), gui={
        "face": "Front", "ppu": 14, "lines": [{"text": text, "font": font, "color": text_color, "stroke": stroke, "rect": [0.04, 0.08, 0.92, 0.84]}]})
    if post_h:
        a = math.radians(yaw)
        for side in (-1, 1):
            px = x + math.cos(a) * side * (width / 2 - 0.6)
            pz = z - math.sin(a) * side * (width / 2 - 0.6)
            m.box((0.9, post_h, 0.9), (px, post_h / 2, pz), "wood_dark", rot=(0, yaw, 0))


def obby_platform(m, pos, size, edge_mat, top_mat, stage=None, course=None, kind=None):
    x, y, z = pos
    sx, sz = size
    m.box((sx, 1, sz), (x, y - 0.5, z), top_mat, shade=1)
    e = 0.35
    m.box((sx, e, e), (x, y + 0.02, z - sz / 2 + e / 2), edge_mat, collide=False)
    m.box((sx, e, e), (x, y + 0.02, z + sz / 2 - e / 2), edge_mat, collide=False)
    m.box((e, e, sz), (x - sx / 2 + e / 2, y + 0.02, z), edge_mat, collide=False)
    m.box((e, e, sz), (x + sx / 2 - e / 2, y + 0.02, z), edge_mat, collide=False)
    if y > 2:
        m.box((sx * 0.4, y - 1, sz * 0.4), (x, (y - 1) / 2, z), "platform_dark" if "purple" in edge_mat or "red" in edge_mat else "dirt", shade=2)
    if kind:
        attrs = {"Course": course}
        if stage is not None:
            attrs["Stage"] = stage
        m.box((sx - 0.4, 1.2, sz - 0.4), (x, y + 0.7, z), "invisible", collide=False, shadow=False, tags=[kind], attrs=attrs)


def build_beginner_obby(L):
    m = L.module("env_obby_beginner", "BeginnerObby", "Map/Obbies/Beginner", tags=["ObbyCourse"], attrs={"Course": "Beginner"})
    start = (-96, 0.6, -98)
    obby_platform(m, start, (10, 10), "neon_green", "platform_green", course="Beginner", kind="ObbyStart")
    pts = [(-108, 2.5, -110), (-120, 4.5, -118), (-132, 6.5, -112), (-144, 8.5, -122), (-152, 10.5, -136),
           (-160, 12.5, -150), (-170, 12.5, -158), (-182, 12.5, -158), (-194, 12.5, -158), (-202, 14.5, -170),
           (-196, 16.5, -184), (-184, 18.5, -192)]
    for i, p in enumerate(pts, start=1):
        size = (8, 8) if i not in (7, 8, 9) else (12, 6)  # 7-9: the bridge over the stream
        obby_platform(m, p, size, "neon_green", "platform_green" if i not in (7, 8, 9) else "wood", stage=i, course="Beginner", kind="ObbyCheckpoint")
    finish = (-170, 20.5, -196)
    obby_platform(m, finish, (10, 10), "neon_green", "platform_green", course="Beginner", kind="ObbyFinish")
    # green neon arches / frames (as in the reference)
    for (x, y, z) in [(-120, 4.5, -118), (-160, 12.5, -150), (-196, 16.5, -184)]:
        for side in (-3.6, 3.6):
            m.box((0.6, 7, 0.6), (x + side, y + 3.5, z), "neon_green", collide=False)
        m.box((7.8, 0.6, 0.6), (x, y + 7, z), "neon_green", collide=False)
    framed_sign(m, (-108, 15, -126), 20, 5, "Beginner Obby", "sign_green", "#FFFFFF", "#1F4A2A",
                yaw=yaw_to((-108, 15, -126), HERO_CAMERA), post_h=12.5)
    exit_marker = L.module("marker_obby_exit_b", "BeginnerExit", "Map/Obbies/Beginner", greybox=False)
    exit_marker.box((4, 1, 4), (-88, 0.5, -88), "invisible", collide=False, shadow=False, tags=["ObbyExit"], attrs={"Course": "Beginner"})
    L.reserve(-150, -150, 60)


def build_pro_obby(L):
    m = L.module("env_obby_pro", "ProObby", "Map/Obbies/Pro", tags=["ObbyCourse"], attrs={"Course": "Pro"})
    start = (104, 0.6, -112)
    obby_platform(m, start, (10, 10), "neon_purple", "platform_dark", course="Pro", kind="ObbyStart")
    pts = [(115, 3, -124), (127, 6, -132), (139, 9, -126), (152, 12, -134), (163, 14, -148), (176, 16, -156), (188, 18, -146)]
    tower = (182, 0, -122)
    for k in range(9):
        a = math.radians(200 + k * 72)
        pts.append((tower[0] + math.cos(a) * 9.5, 21.5 + k * 3.2, tower[2] + math.sin(a) * 9.5))
    for i, p in enumerate(pts, start=1):
        edge = "neon_blue" if i % 2 == 0 else "neon_purple"
        obby_platform(m, p, (5.5, 5.5), edge, "platform_dark", stage=i, course="Pro", kind="ObbyCheckpoint")
        if i in (4, 6, 9, 12):  # red neon hazard strips: touching sends you back
            m.box((5, 0.6, 0.8), (p[0], p[1] + 0.5, p[2]), "neon_red", collide=False, tags=["ObbyKill"], attrs={"Course": "Pro"})
    # the tall red-neon hazard tower
    m.box((7, 54, 7), (tower[0], 27, tower[2]), "platform_dark", shade=2)
    for dx, dz in ((-3.6, -3.6), (3.6, -3.6), (-3.6, 3.6), (3.6, 3.6)):
        m.box((0.5, 54, 0.5), (tower[0] + dx, 27, tower[2] + dz), "neon_red", collide=False)
    for y in (12, 26, 40, 54):
        m.box((8, 0.6, 8), (tower[0], y, tower[2]), "neon_red", collide=False)
    finish = (tower[0], 54.6, tower[2])
    obby_platform(m, finish, (8, 8), "neon_red", "platform_dark", course="Pro", kind="ObbyFinish")
    # purple arch sign
    sx, sy, sz = 112, 20, -150
    yaw = yaw_to((sx, sy, sz), HERO_CAMERA)
    for side in (-11, 11):
        a = math.radians(yaw)
        m.box((2, 26, 2), (sx + math.cos(a) * side, 13, sz - math.sin(a) * side), "platform_dark", rot=(0, yaw, 0))
        m.box((0.4, 26, 0.4), (sx + math.cos(a) * side, 13, sz - math.sin(a) * side - 0.9), "neon_purple", rot=(0, yaw, 0), collide=False)
    framed_sign(m, (sx, sy + 4, sz), 20, 6, "Pro Obby", "sign_purple", "#FFFFFF", "#1C1240", yaw=yaw)
    exit_marker = L.module("marker_obby_exit_p", "ProExit", "Map/Obbies/Pro", greybox=False)
    exit_marker.box((4, 1, 4), (92, 0.5, -92), "invisible", collide=False, shadow=False, tags=["ObbyExit"], attrs={"Course": "Pro"})
    L.reserve(150, -140, 55)


def build_stall(L):
    x0, z0 = 52, -118
    yaw = yaw_to((x0, 0, z0), (0, 0, 0))
    m = L.module("env_market_stall", "MarketStall", "Map/Plaza/Stall", pivot=(x0, 0, z0), yaw=yaw)
    for dx, dz in ((-6, -3.5), (6, -3.5), (-6, 3.5), (6, 3.5)):
        m.box((0.9, 9, 0.9), (dx, 4.5, dz), "wood_dark")
    m.box((13, 3, 3), (0, 1.5, -3.2), "wood")
    m.box((13.4, 0.5, 3.4), (0, 3.2, -3.2), "wood", shade=0, tags=["StoreKiosk"])
    m.box((14.5, 0.8, 5.2), (0, 9.6, -2.1), "roof_tile", rot=(22, 0, 0))
    m.box((14.5, 0.8, 5.2), (0, 9.6, 2.6), "roof_tile", rot=(-22, 0, 0))
    m.box((14.6, 0.6, 0.6), (0, 10.6, 0.25), "wood_dark")
    m.box((12, 0.3, 2.4), (0, 7.4, -4.6), "canvas_red", rot=(-18, 0, 0), collide=False)
    m.box((8, 2.2, 0.4), (0, 7.4, -4.0), "board_face", collide=False, gui={
        "face": "Front", "ppu": 24, "lines": [{"text": "STORE", "font": "FredokaOne", "color": "#FFD36B", "gradient": ["#FFE9A6", "#F7A81B"], "stroke": "#3A2208", "rect": [0, 0, 1, 1]}]})
    for i, dx in enumerate((-4, -1.4, 1.2, 3.8)):
        m.box((0.25, 2.6, 0.25), (dx, 4.8, -1.0), "wood", rot=(0, 0, 10 - i * 6), collide=False)
        m.box((1.2, 0.4, 0.4), (dx + 0.2, 6.0, -1.0), "metal", rot=(0, 0, 10 - i * 6), collide=False)
    m.box((2.4, 2.4, 2.4), (-8.4, 1.2, -1), "wood", shade=0)
    m.box((2, 2, 2), (-8.2, 3.4, -1.2), "wood", shade=2)
    m.box((1.8, 2.6, 1.8), (8.4, 1.3, 0), "wood_dark")
    lantern_post(m, -6.6, -4.6, h=5.2)
    lantern_post(m, 6.6, -4.6, h=5.2)
    L.reserve(x0, z0, 12)


def build_lounge(L):
    a = math.radians(-46)
    x0, z0 = math.cos(a) * 98, math.sin(a) * 98
    yaw = yaw_to((x0, 0, z0), (0, 0, 0))
    m = L.module("env_vip_lounge", "VipLounge", "Map/Plaza/Lounge", pivot=(x0, 0, z0), yaw=yaw)
    h = 9.5
    for dx in (-10, 0, 10):
        for dz in (-6, 6):
            m.box((1.2, h, 1.2), (dx, h / 2, dz), "wood_dark")
    m.box((22, 1, 14), (0, h + 0.5, 0), "wood")
    # railing + invisible barrier (no climbing in without the pass)
    for dz in (-6.8, 6.8):
        m.box((22, 0.4, 0.4), (0, h + 2.4, dz), "wood")
        m.box((22, 8, 0.4), (0, h + 4.5, dz), "invisible", shadow=False)
    for dx in (-10.8, 10.8):
        m.box((0.4, 0.4, 14), (dx, h + 2.4, 0), "wood")
        m.box((0.4, 8, 14), (dx, h + 4.5, 0), "invisible", shadow=False)
    m.box((24, 0.6, 16), (0, h + 8.4, 0), "canvas_red", collide=False)
    for dx in (-10, 10):
        for dz in (-6, 6):
            m.box((0.5, 7.5, 0.5), (dx, h + 4.6, dz), "gold")
    for dx in (-6, 0, 6):
        m.box((4, 1.2, 2), (dx, h + 1.6, 3), "canvas", cls="Seat")
        m.box((4, 2.4, 0.6), (dx, h + 2.4, 4.2), "canvas")
    m.box((10, 2.6, 0.4), (0, h + 10.4, -8), "board_face", collide=False, gui={
        "face": "Front", "ppu": 24, "lines": [{"text": "VIP RIM LOUNGE", "font": "FredokaOne", "color": "#FFD36B", "stroke": "#3A2208", "rect": [0, 0, 1, 1]}]})
    markers = L.module("marker_lounge", "LoungeMarkers", "Map/Plaza/Lounge", pivot=(x0, 0, z0), yaw=yaw, greybox=False)
    markers.box((3, 3, 1), (0, 1.5, -8.5), "stone_block", tags=["LoungeEntry"])
    markers.box((2, 1, 2), (0, h + 1.5, -2), "invisible", collide=False, shadow=False, tags=["LoungeSpot"])
    markers.box((2, 2, 1), (-8, h + 2, -5.6), "wood", tags=["LoungeExit"])
    markers.box((2, 1, 2), (-4, 0.5, -11), "invisible", collide=False, shadow=False, tags=["LoungeExitSpot"])
    L.reserve(x0, z0, 16)


def board(L, key, name, pos, w, h, tag):
    yaw = yaw_to(pos, HERO_CAMERA)
    m = L.module(key, name, "Map/Boards", pivot=pos, yaw=yaw)
    base = 12
    m.box((w, h, 1.2), (0, base + h / 2, 0), "board_face", shade=1, tags=[tag], jitter=0)
    t = 2.2
    m.box((w + 2 * t, t, 2), (0, base + h + t / 2, 0.2), "wood")
    m.box((w + 2 * t, t, 2), (0, base - t / 2, 0.2), "wood")
    m.box((t, h, 2), (-w / 2 - t / 2, base + h / 2, 0.2), "wood")
    m.box((t, h, 2), (w / 2 + t / 2, base + h / 2, 0.2), "wood")
    for side in (-1, 1):
        m.box((2.6, base + h + 3, 2.6), (side * (w / 2 - 4), (base + h + 3) / 2, 1.8), "wood_dark")
    m.box((w + 6, 1.2, 3), (0, base + h + t + 0.6, 0.2), "moss")
    L.reserve(pos[0], pos[2], w / 2 + 6)


def build_boards(L):
    board(L, "env_board_topdiggers", "TopDiggersBoard", (-150, 0, -46), 36, 30, "BoardTopDiggers")
    board(L, "env_board_finds", "FindsBoard", (152, 0, -20), 36, 38, "BoardFinds")


def build_artifacts(L):
    cx, cz = -150, 112
    m = L.module("env_artifacts_hall", "ArtifactsHall", "Map/Plaza/Artifacts", tags=["ArtifactsHall"])
    # curved fence around the front, opening toward the hole
    for k in range(17):
        a = math.radians(70 + k * 12)
        x, z = cx + math.cos(a) * 34, cz + math.sin(a) * 26
        m.box((0.9, 3.4, 0.9), (x, 1.7, z), "wood_dark", tags=["ReactFence"])
        if k < 16:
            a2 = math.radians(70 + (k + 1) * 12)
            x2, z2 = cx + math.cos(a2) * 34, cz + math.sin(a2) * 26
            length = math.hypot(x2 - x, z2 - z)
            ang = math.degrees(math.atan2(z2 - z, x2 - x))
            for hgt in (1.2, 2.6):
                m.box((length, 0.38, 0.38), ((x + x2) / 2, hgt, (z + z2) / 2), "wood", rot=(0, -ang, 0))
    # hanging sign
    sx, sz = cx - 14, cz - 18
    yaw = yaw_to((sx, 0, sz), HERO_CAMERA)
    framed_sign(m, (sx, 9, sz), 14, 3.6, "Artifacts", "board_face", "#FFFFFF", "#101420", yaw=yaw, post_h=11)
    # six pedestals (showpieces are client-rendered spinning finds)
    peds = L.module("marker_pedestals", "Pedestals", "Map/Plaza/Artifacts", greybox=True)
    slots = [(-164, 104), (-150, 98), (-136, 104), (-160, 120), (-146, 124), (-132, 118)]
    for i, (px, pz) in enumerate(slots, start=1):
        peds.box((5, 1.2, 5), (px, 0.6, pz), "pedestal_dark")
        peds.box((4, 2.2, 4), (px, 2.3, pz), "pedestal", tags=["ArtifactPedestal"], attrs={"Index": i})
        peds.box((4.4, 0.4, 4.4), (px, 3.6, pz), "pedestal", shade=0)
    L.reserve(cx, cz, 36)


def build_relic(L):
    x, z = 168, 56
    m = L.module("env_golden_relic", "GoldenRelic", "Map/Plaza/Relic", tags=["PoolRelicBase"])
    for i, (w, h) in enumerate([(11, 1.6), (8.5, 1.8), (6.5, 2.0)]):
        y = sum(hh for _, hh in [(11, 1.6), (8.5, 1.8), (6.5, 2.0)][:i]) + h / 2
        m.box((w, h, w), (x, y, z), "relic_dark")
        m.box((w * 0.72, h + 0.02, w * 1.02), (x, y, z), "relic_dark", rot=(0, 45, 0))
        m.box((w + 0.3, 0.3, w + 0.3), (x, y + h / 2, z), "gold", collide=False)
    orb = L.module("env_relic_orb", "RelicOrb", "Map/Plaza/Relic", pivot=(x, 10.5, z), tags=["PoolRelic"])
    orb.box((4.2, 4.2, 4.2), (0, 0, 0), "relic_gold", rot=(35, 45, 0), collide=False,
            light={"type": "Point", "range": 18, "brightness": 2.5, "color": "#FBE574"})
    for ring, tilt in ((1, (70, 0, 20)), (2, (70, 60, -20))):
        rm = L.module("env_relic_ring", f"RelicRing{ring}", "Map/Plaza/Relic", pivot=(x, 10.5, z), tags=["PoolRing"], attrs={"Ring": ring}, unique=False)
        for k in range(16):
            a = k / 16 * 2 * math.pi
            rm.box((1.5, 0.35, 0.35), (math.cos(a) * 5.2, 0, math.sin(a) * 5.2), "relic_gold", rot=(0, -math.degrees(a) + 90, 0), collide=False)
        rm.attrs["Tilt"] = list(tilt)
    L.reserve(x, z, 9)


def build_portal(L):
    x, z = 128, 146
    yaw = yaw_to((x, 0, z), (0, 0, 0))
    m = L.module("env_portal", "Portal", "Map/Plaza/Portal", pivot=(x, 0, z), yaw=yaw)
    for side in (-5.5, 5.5):
        for i in range(4):
            m.box((3.2, 3.2, 3.2), (side, 1.6 + i * 3.2, 0), "portal_stone", rot=(0, 0, 0))
    for i, (dx, dy, rz) in enumerate([(-4.4, 14.0, 30), (-1.6, 15.4, 10), (1.6, 15.4, -10), (4.4, 14.0, -30)]):
        m.box((3.4, 3.2, 3.4), (dx, dy, 0), "portal_stone", rot=(0, 0, rz))
    m.box((8.4, 12.4, 0.6), (0, 7.4, 0), "portal_glow", collide=False, tags=["PortalHub"],
          light={"type": "Point", "range": 22, "brightness": 3, "color": "#7FE9FF"})
    for side in (-1, 1):
        m.box((1.2, 2.6, 6), (side * 9, 1.3, 2.4), "wood", rot=(0, side * 18, 0))
    ret = L.module("marker_portal_return", "PortalReturn", "Map/Plaza/Portal", greybox=False)
    ret.box((3, 1, 3), (116, 0.5, 132), "invisible", collide=False, shadow=False, tags=["PortalReturn"])
    L.reserve(x, z, 14)


def build_waterfall(L):
    m = L.module("env_waterfall", "Waterfall", "Map/Plaza/Waterfall", tags=["Waterfall"])
    for gx in range(-232, -204, 4):
        for gz in range(6, 38, 4):
            h = 20 + (4 if (gx + gz) % 8 == 0 else 0)
            m.box((4, h, 4), (gx + 2, h / 2, gz + 2), "dirt" if L.rng.random() > 0.3 else "cobble")
            m.box((4.2, 1.4, 4.2), (gx + 2, h + 0.7, gz + 2), "grass")
    m.box((7, 20, 0.8), (-203.6, 10.4, 21), "waterfall", rot=(0, 90, 0), collide=False, tags=["WaterfallSheet"])
    for i in range(6):
        m.box((2.2, 1.2, 2.2), (-200 + L.rng.uniform(-2, 2), -0.6, 17 + i * 1.6), "foam", collide=False)
    L.reserve(-212, 20, 22)


def tree(L, variant, x, z, scale=1.0):
    key = f"prop_tree_{variant}"
    m = L.module(key, f"Tree_{variant}", "Map/Nature/Trees", pivot=(x, 0, z), yaw=L.rng.choice([0, 90, 180, 270]), unique=False)
    s = scale
    if variant == "a":
        m.box((2 * s, 9 * s, 2 * s), (0, 4.5 * s, 0), "trunk")
        m.box((9 * s, 6 * s, 9 * s), (0, 10 * s, 0), "leaves", tags=["ReactLeaves"])
        m.box((7 * s, 5 * s, 7 * s), (1 * s, 14.5 * s, 0.5 * s), "leaves_light", tags=["ReactLeaves"])
        m.box((4 * s, 3.5 * s, 4 * s), (-0.5 * s, 18 * s, 0), "leaves_light", tags=["ReactLeaves"])
        m.box((4 * s, 4 * s, 4 * s), (-4 * s, 8.5 * s, 2 * s), "leaves_dark", tags=["ReactLeaves"])
    elif variant == "b":
        m.box((2.4 * s, 7 * s, 2.4 * s), (0, 3.5 * s, 0), "trunk")
        m.box((12 * s, 6 * s, 11 * s), (0, 9 * s, 0), "leaves_dark", tags=["ReactLeaves"])
        m.box((8 * s, 5 * s, 8 * s), (1 * s, 13.5 * s, -1 * s), "leaves", tags=["ReactLeaves"])
        m.box((5 * s, 3 * s, 5 * s), (3 * s, 16.5 * s, 2 * s), "leaves_light", tags=["ReactLeaves"])
    else:
        m.box((1.8 * s, 12 * s, 1.8 * s), (0, 6 * s, 0), "trunk")
        m.box((7 * s, 8 * s, 7 * s), (0, 14 * s, 0), "leaves", tags=["ReactLeaves"])
        m.box((5 * s, 6 * s, 5 * s), (0, 20 * s, 0), "leaves_light", tags=["ReactLeaves"])
        m.box((3 * s, 4 * s, 3 * s), (0, 24.5 * s, 0), "leaves_light", tags=["ReactLeaves"])
    L.reserve(x, z, 6 * s)


def build_trees(L):
    fixed = [
        ("a", -212, -70, 1.1), ("b", -206, -10, 1.0), ("c", -172, -64, 1.0), ("a", -224, 60, 1.0),
        ("b", -120, -150, 1.0), ("c", -88, -150, 1.0), ("a", -70, -176, 1.1), ("b", 70, -176, 1.1),
        ("c", 82, -148, 1.0), ("a", -36, -186, 1.0), ("b", 36, -186, 1.0),
        ("a", 214, 30, 1.0), ("c", 214, -64, 1.0), ("b", 206, 96, 1.0),
        ("a", -40, 168, 1.2), ("b", -14, 184, 1.0), ("c", 30, 170, 1.0),
        ("a", -198, 150, 1.0), ("c", -112, 162, 1.0), ("b", -96, 70, 0.9), ("a", -110, 20, 0.9),
        ("c", 112, 76, 0.9), ("b", 96, 30, 0.85), ("a", 178, 160, 1.0), ("c", 70, 118, 0.85),
        ("b", -230, -120, 1.0), ("a", 230, -120, 1.0), ("c", -170, 30, 0.9), ("a", 150, -40, 0.9),
    ]
    for v, x, z, s in fixed:
        if ground_material(x, z) in (None, "hole", "water"):
            continue
        tree(L, v, x, z, s)


def build_props(L):
    nat = L.module("env_nature_props", "NatureProps", "Map/Nature/Props")
    pebbles = L.module("env_rim_pebbles", "RimPebbles", "Map/Rim")
    rng = L.rng
    placed = 0
    tries = 0
    while placed < 170 and tries < 6000:
        tries += 1
        x, z = rng.uniform(-215, 215), rng.uniform(-215, 215)
        mat = ground_material(x, z)
        if mat != "grass" or math.hypot(x, z) < PATH_R + 4 or not L.free(x, z, 2.5):
            continue
        kind = rng.random()
        if kind < 0.35:  # bush: cube cluster
            s = rng.uniform(1.6, 3.0)
            nat.box((s, s, s), (x, s / 2, z), "bush", rot=(0, rng.uniform(0, 90), 0), tags=["ReactLeaves"])
            if rng.random() < 0.6:
                nat.box((s * 0.7, s * 0.7, s * 0.7), (x + s * 0.6, s * 0.35, z + rng.uniform(-0.5, 0.5)), "bush", tags=["ReactLeaves"])
        elif kind < 0.55:  # fern: three leaning blades
            for k in range(3):
                a = k * 120 + rng.uniform(-20, 20)
                nat.box((0.5, 2.2, 1.4), (x + math.cos(math.radians(a)) * 0.5, 1.0, z + math.sin(math.radians(a)) * 0.5), "fern",
                        rot=(rng.uniform(-30, 30), a, rng.uniform(15, 35)), collide=False)
        elif kind < 0.78:  # flowers
            mat2 = rng.choice(["flower_yellow", "flower_pink", "flower_white"])
            for k in range(rng.randint(2, 4)):
                fx, fz = x + rng.uniform(-1.2, 1.2), z + rng.uniform(-1.2, 1.2)
                nat.box((0.18, 0.9, 0.18), (fx, 0.45, fz), "fern", collide=False)
                nat.box((0.55, 0.45, 0.55), (fx, 1.0, fz), mat2, collide=False)
        else:  # stone blocks, sometimes stacked
            s = rng.uniform(1.6, 3.4)
            nat.box((s, s * 0.8, s), (x, s * 0.4, z), "stone_block", rot=(0, rng.uniform(0, 90), 0))
            if rng.random() < 0.35:
                nat.box((s * 0.6, s * 0.5, s * 0.6), (x + 0.3, s * 0.8 + s * 0.25, z - 0.2), "stone_block", rot=(0, rng.uniform(0, 90), 0))
        L.reserve(x, z, 1.5)
        placed += 1
    # loose pebbles on the rim that hop when big digs land
    for k in range(40):
        a = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(64.5, 72)
        pebbles.box((0.9, 0.6, 0.8), (math.cos(a) * r, 0.3, math.sin(a) * r), "stone_chunk", rot=(0, rng.uniform(0, 90), 0),
                    collide=False, tags=["ReactPebble"])
    # benches and barrels around the plaza
    for (bx, bz, ang) in [(-20, 92, 0), (24, 92, 0), (-86, 30, 70), (88, -20, -70)]:
        bench = L.module("prop_bench", "Bench", "Map/Plaza/Props", pivot=(bx, 0, bz), yaw=ang, unique=False)
        bench.box((5, 0.5, 1.6), (0, 1.2, 0), "wood", cls="Seat")
        for dx in (-2, 2):
            bench.box((0.5, 1.2, 1.4), (dx, 0.6, 0), "wood_dark")
        L.reserve(bx, bz, 3)
    # plaza lantern posts along the paths
    lamps = L.module("env_plaza_lanterns", "PlazaLanterns", "Map/Plaza/Props")
    for (lx, lz) in [(-8, 80), (8, 80), (-8, 104), (8, 104), (-60, 66), (66, 62), (-20, -84), (20, -84),
                     (-104, 84), (102, 108), (-82, -60), (82, -62), (-110, -10), (112, 22)]:
        if ground_material(lx, lz) in ("grass", "sand"):
            lantern_post(lamps, lx, lz, h=5.4, light=(abs(lx) + abs(lz)) % 3 != 0)


def build_bays(L):
    m = L.module("marker_bays", "BaySlots", "Map/Rim/Bays", greybox=False)
    count = 30
    a0, a1 = math.radians(-12), math.radians(192)
    for i in range(count):
        a = a0 + (a1 - a0) * i / (count - 1)
        x, z = math.cos(a) * BAY_RADIUS, math.sin(a) * BAY_RADIUS
        yaw = yaw_to((x, 0, z), (0, 0, 0))
        m.box((5, 0.4, 5), (x, 0.2, z), "stone_block", rot=(0, yaw, 0), tags=["BaySlot"], attrs={"Slot": i + 1, "Yaw": round(yaw, 2)})


def build_crew_points(L):
    m = L.module("marker_crew", "CrewPoints", "Map/Ladder", greybox=False)
    a = math.radians(LADDER_ANGLE)
    out = (math.cos(a), math.sin(a))
    tan = (-math.sin(a), math.cos(a))
    roles = [("Winch", 66, 0.6, 0), ("Ladder", 58.6, -8, 0), ("Ladder", 54.6, -20, 0), ("Frontier", 0, 0, 4),
             ("Frontier", 0, 0, -4), ("Frontier", 0, 0, 9)]
    for i, (role, r, y, off) in enumerate(roles, start=1):
        m.box((1, 1, 1), (out[0] * r + tan[0] * off, y, out[1] * r + tan[1] * off), "marker", collide=False, shadow=False,
              tags=["CrewPoint"], attrs={"Index": i, "Role": role})


def build_distant(L):
    hills = L.module("env_distant_hills", "DistantHills", "Map/Scenery", tags=["Scenery"])
    rng = L.rng
    for (hx, hz, w, h) in [(-150, -280, 120, 46), (-40, -300, 140, 62), (90, -290, 120, 52), (210, -260, 100, 40),
                           (-260, -220, 90, 34), (300, -200, 90, 30), (-320, -60, 70, 26), (330, 20, 80, 28)]:
        steps = 4
        for i in range(steps):
            sw = w * (1 - i * 0.22)
            sh = h / steps
            hills.box((sw, sh, sw * 0.7), (hx, i * sh + sh / 2 - 6, hz), "dirt" if i < steps - 1 else "dirt", shade=1)
            hills.box((sw + 0.4, 2.2, sw * 0.7 + 0.4), (hx, (i + 1) * sh - 6 + 1.1, hz), "grass", shade=rng.choice([0, 1]))
    floats = L.module("env_floating_islands", "FloatingIslands", "Map/Scenery", tags=["Scenery"])
    for (fx, fy, fz, w) in [(-330, 46, -170, 44), (360, 64, -210, 52), (-340, 80, 110, 36), (330, 30, 70, 40), (0, 110, -420, 60)]:
        floats.box((w, 6, w * 0.8), (fx, fy, fz), "dirt")
        floats.box((w + 0.4, 2.4, w * 0.8 + 0.4), (fx, fy + 4.2, fz), "grass")
        for i in range(1, 4):
            s = w * (1 - i * 0.25)
            floats.box((s, 7, s * 0.8), (fx + rng.uniform(-3, 3), fy - 3 - i * 6.5, fz + rng.uniform(-3, 3)), "cobble" if i > 1 else "dirt")
        floats.box((3.5, 9, 3.5), (fx + w * 0.2, fy + 9.5, fz), "trunk")
        floats.box((10, 7, 10), (fx + w * 0.2, fy + 16, fz), "leaves", tags=["ReactLeaves"])
    # Voxel mountain range on the horizon: each peak is a stack of shrinking,
    # slightly offset blocks (snow on the top layers) plus a smaller shoulder
    # peak, so the silhouette reads as stepped mountains rather than a wall.
    mountains = L.module("env_mountains", "Mountains", "Map/Scenery", tags=["Scenery"])
    # own random stream so the rest of the map stays identical
    shared_rng, L.rng = L.rng, random.Random(SEED + 97)
    rng = L.rng

    def peak(mx, mz, w, h, steps):
        sh = h / steps
        ox = oz = 0.0
        for i in range(steps):
            f = 1 - i / steps
            sw = w * (0.18 + 0.82 * f)
            snow = i >= steps - 2
            mountains.box((sw, sh + 0.5, sw * 0.62), (mx + ox, i * sh + sh / 2 - 60, mz + oz),
                          "mountain_snow" if snow else "mountain", collide=False, shadow=False, shade=i % 2)
            ox += rng.uniform(-0.035, 0.035) * w
            oz += rng.uniform(-0.02, 0.02) * w

    for (mx, mz, w, h) in [(-900, -1300, 700, 420), (-200, -1500, 900, 560), (650, -1350, 800, 460), (-1300, -700, 600, 360), (1300, -800, 600, 340)]:
        peak(mx, mz, w, h, 8)
        side = 1 if mx < 0 else -1
        peak(mx + side * w * 0.42, mz + w * 0.12, w * 0.55, h * 0.58, 6)
    L.rng = shared_rng
    for _ in range(20):  # the draws the old single-box mountains made, keeping later colours stable
        shared_rng.random()


def build_hub(L):
    hub = L.module("env_minigame_hub", "MinigameHub", "Hub", tags=["MinigameHub"])
    hy = 40
    hub.box((170, 8, 170), (0, hy - 4, 1500), "dirt")
    hub.box((170.4, 1.2, 170.4), (0, hy - 0.6, 1500), "grass")
    for k in range(4):
        hub.box((150 - k * 30, 10, 150 - k * 30), (0, hy - 13 - k * 10, 1500), "cobble" if k else "dirt")
    # Gem Rush arena (crystal cave)
    gx, gz = -45, 1520
    hub.box((70, 1, 70), (gx, hy + 0.5, gz), "cavern")
    for k in range(12):
        a = k / 12 * 2 * math.pi
        hub.box((6, 12, 6), (gx + math.cos(a) * 38, hy + 6, gz + math.sin(a) * 38), "cavern_deep")
        hub.box((1.2, 4, 1.2), (gx + math.cos(a) * 34, hy + 3, gz + math.sin(a) * 34), "crystal_cyan" if k % 2 else "crystal_purple", collide=False)
    # Cave-In arena (stone)
    cx, cz = 45, 1520
    hub.box((60, 1, 60), (cx, hy + 0.5, cz), "cobble")
    for k in range(10):
        a = k / 10 * 2 * math.pi
        hub.box((7, 9, 7), (cx + math.cos(a) * 34, hy + 4.5, cz + math.sin(a) * 34), "stone_chunk")
    framed_sign(hub, (gx, hy + 9, 1470), 16, 4, "GEM RUSH", "sign_purple", "#FFFFFF", "#1C1240", yaw=180, post_h=None)
    framed_sign(hub, (cx, hy + 9, 1470), 16, 4, "CAVE-IN", "board_face", "#FFD36B", "#3A2208", yaw=180, post_h=None)
    framed_sign(hub, (0, hy + 14, 1446), 22, 5, "MINIGAMES", "sign_green", "#FFFFFF", "#1F4A2A", yaw=180, post_h=None)
    for (lx, lz) in [(-14, 1440), (14, 1440), (-30, 1470), (30, 1470)]:
        lantern_post(hub, lx, lz, h=5.5)
    markers = L.module("marker_hub", "HubMarkers", "Hub", greybox=False)
    markers.box((6, 1, 6), (0, hy + 0.5, 1438), "sand", tags=["HubSpawn"], shade=0)
    markers.box((8.4, 12.4, 0.6), (0, hy + 7, 1424), "portal_glow", collide=False, tags=["PortalBack"],
                light={"type": "Point", "range": 20, "brightness": 2.5, "color": "#7FE9FF"})
    markers.box((4, 4, 4), (gx, hy + 2, 1460), "neon_purple", tags=["MinigameJoin"], attrs={"Game": "GemRush"})
    markers.box((4, 4, 4), (cx, hy + 2, 1460), "neon_red", tags=["MinigameJoin"], attrs={"Game": "CaveIn"})
    markers.box((66, 10, 66), (gx, hy + 6, gz), "invisible", collide=False, shadow=False, tags=["MinigameArena"], attrs={"Game": "GemRush"})
    markers.box((56, 10, 56), (cx, hy + 6, cz), "invisible", collide=False, shadow=False, tags=["MinigameArena"], attrs={"Game": "CaveIn"})
    markers.box((4, 1, 4), (gx, hy + 0.5, 1452), "invisible", collide=False, shadow=False, tags=["MinigameExit"], attrs={"Game": "GemRush"})
    markers.box((4, 1, 4), (cx, hy + 0.5, 1452), "invisible", collide=False, shadow=False, tags=["MinigameExit"], attrs={"Game": "CaveIn"})


def build(seed=SEED):
    L = Layout(seed)
    # reserve feature footprints first so scatter avoids them
    L.reserve(0, 0, PATH_R + 6)
    build_gate(L)
    build_spawn(L)
    build_stations(L)
    build_beginner_obby(L)
    build_pro_obby(L)
    build_stall(L)
    build_lounge(L)
    build_boards(L)
    build_artifacts(L)
    build_relic(L)
    build_portal(L)
    build_waterfall(L)
    build_bays(L)
    for x, z, r in [(0, -150, 30)]:
        L.reserve(x, z, r)
    build_ground(L)
    build_hole(L)
    build_ladder(L)
    build_fence(L)
    build_crew_points(L)
    build_trees(L)
    build_props(L)
    build_distant(L)
    build_hub(L)
    return L


def main():
    L = build()
    data = {
        "version": 1,
        "unit": U,
        "bands": [{"id": b[0], "yTop": b[1], "yBottom": b[2], "radius": b[3]} for b in BANDS + [CORE]],
        "holeRadius": HOLE_R,
        "heroCamera": {"position": list(HERO_CAMERA), "lookAt": [0, -22, -38], "fov": 64},
        "modules": [m.to_json() for m in L.modules],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, separators=(",", ":")))
    parts = sum(len(m.parts) for m in L.modules)
    keys = len({m.key for m in L.modules})
    print(f"wrote {OUT.relative_to(ROOT)}: {len(L.modules)} modules, {keys} unique keys, {parts} parts")


if __name__ == "__main__":
    main()
