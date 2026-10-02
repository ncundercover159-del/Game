"""Quick composition check: render assets/layout.json from the hero camera.

    /path/to/python-with-bpy blender/preview_layout.py [out.png] [samples]
Roblox (x, y, z) -> Blender (x, -z, y).
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
out = sys.argv[1] if len(sys.argv) > 1 else str(ROOT / "docs" / "screenshots" / "layout_hero.png")
samples = int(sys.argv[2]) if len(sys.argv) > 2 else 24
data = json.loads((ROOT / "assets" / "layout.json").read_text())

C = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))


def r2b(v):
    return C @ Vector(v)


def roblox_rot(rx, ry, rz):
    rot = (Matrix.Rotation(math.radians(rx), 3, "X") @ Matrix.Rotation(math.radians(ry), 3, "Y") @ Matrix.Rotation(math.radians(rz), 3, "Z"))
    return C @ rot @ C.transposed()


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
mats = {}


def material(hexc, emissive, transp):
    key = (hexc, emissive, transp)
    if key in mats:
        return mats[key]
    m = bpy.data.materials.new(hexc)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    rgb = [int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    lin = [c ** 2.2 for c in rgb] + [1]
    bsdf.inputs["Base Color"].default_value = lin
    bsdf.inputs["Roughness"].default_value = 0.85
    if emissive:
        bsdf.inputs["Emission Color"].default_value = lin
        bsdf.inputs["Emission Strength"].default_value = 4
    if transp:
        bsdf.inputs["Alpha"].default_value = 1 - transp
    mats[key] = m
    return m


mesh = bpy.data.meshes.new("cube")
bm_verts = [(x, y, z) for x in (-.5, .5) for y in (-.5, .5) for z in (-.5, .5)]
faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
mesh.from_pydata(bm_verts, [], faces)
NEON = {"ore_glint", "lantern_window", "crystal_cyan", "crystal_purple", "crystal_magenta", "lava", "core_glow", "lantern_glass",
        "neon_green", "neon_purple", "neon_blue", "neon_red", "portal_glow", "relic_gold"}
count = 0
for mod in data["modules"]:
    piv = Matrix.Translation(r2b(mod["pivot"])) @ roblox_rot(0, mod["yaw"], 0).to_4x4()
    for p in mod["parts"]:
        if p.get("t", 0) >= 0.99 or p["m"] in ("mountain", "mountain_snow"):
            continue
        local = Matrix.Translation(r2b(p["p"])) @ roblox_rot(*p.get("r", (0, 0, 0))).to_4x4()
        sx, sy, sz = p["z"]
        size = Matrix.Diagonal((sx, sz, sy, 1))
        ob = bpy.data.objects.new("p", mesh.copy() if False else mesh)
        ob.matrix_world = piv @ local @ size
        ob.data = mesh
        ob.material_slots  # noqa
        ob.active_material = None
        ob.color = (1, 1, 1, 1)
        scene.collection.objects.link(ob)
        ob.material_slots
        ob.data.materials.clear() if False else None
        ob.active_material = None
        mslot_mat = material(p["c"], p["m"] in NEON, p.get("t", 0))
        if not ob.material_slots:
            ob.data.materials.append(None)
        ob.material_slots[0].link = "OBJECT"
        ob.material_slots[0].material = mslot_mat
        count += 1

cam = data["heroCamera"]
cd = bpy.data.cameras.new("cam")
cd.angle_y = math.radians(cam["fov"])
cd.sensor_fit = "VERTICAL"
cd.clip_end = 5000
co = bpy.data.objects.new("cam", cd)
co.location = r2b(cam["position"])
direction = r2b(cam["lookAt"]) - co.location
co.rotation_euler = direction.to_track_quat("-Z", "Z").to_euler()
scene.collection.objects.link(co)
scene.camera = co
sun = bpy.data.lights.new("sun", "SUN")
sun.energy = 4
so = bpy.data.objects.new("sun", sun)
so.rotation_euler = Euler((math.radians(45), math.radians(-30), math.radians(-60)))
scene.collection.objects.link(so)
world = bpy.data.worlds.new("w")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.38, 0.62, 0.92, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
scene.world = world
scene.render.engine = "CYCLES"
scene.cycles.samples = samples
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 1536, 1024
scene.render.resolution_percentage = 50
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print("rendered", count, "parts to", out)
