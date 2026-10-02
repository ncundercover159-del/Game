"""One-command art build (headless Blender via the `bpy` module).

    /root/kd/venv/bin/python blender/build_all.py [--fast]

1. assets/export/atlas.png                    pixel-noise texture atlas
2. assets/export/<moduleKey>.fbx              one per unique layout module (local space)
3. assets/export/<toolRig>.fbx                tool rigs from assets/gamedata.json
4. assets/export/<findId>.fbx                 faceted find meshes
5. assets/renders/icons/<id>.png              store / find icons
6. docs/screenshots/hero.png, tool_<id>.png   hero view and tool turntable shots
7. docs/reference-match/hero_vs_reference.png side-by-side with reference/hero.png
Roblox (x, y, z) -> Blender (x, -z, y); every FBX is exported -Z forward, Y up.
"""
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "blender" / "kd"))

import bpy  # noqa: E402
import bmesh  # noqa: E402,I001
from mathutils import Euler, Matrix, Vector  # noqa: E402
from PIL import Image  # noqa: E402

import meshkit  # noqa: E402
import textures  # noqa: E402

FAST = "--fast" in sys.argv
EXPORT = ROOT / "assets" / "export"
ICONS = ROOT / "assets" / "renders" / "icons"
SHOTS = ROOT / "docs" / "screenshots"
MATCH = ROOT / "docs" / "reference-match"
layout = json.loads((ROOT / "assets" / "layout.json").read_text())
game = json.loads((ROOT / "assets" / "gamedata.json").read_text())


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def lin(hexc):
    return [int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5)]


def flat_material(hexc, glow=False):
    name = f"M_{hexc}{'_glow' if glow else ''}"
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    c = [x ** 2.2 for x in lin(hexc)] + [1]
    b.inputs["Base Color"].default_value = c
    b.inputs["Roughness"].default_value = 0.6
    if glow:
        b.inputs["Emission Color"].default_value = c
        b.inputs["Emission Strength"].default_value = 3
    return m


def setup_render(res, samples, out, transparent=False):
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = 4 if FAST else samples
    s.cycles.use_denoising = True
    s.render.resolution_x, s.render.resolution_y = res
    s.render.film_transparent = transparent
    s.render.filepath = str(out)
    s.view_settings.view_transform = "Standard"
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.38, 0.62, 0.92, 1)
    bg.inputs["Strength"].default_value = 0.9
    s.world = world
    if not any(o.type == "LIGHT" for o in s.objects):
        sun = bpy.data.lights.new("sun", "SUN")
        sun.energy = 4
        so = bpy.data.objects.new("sun", sun)
        so.rotation_euler = Euler((math.radians(45), math.radians(-30), math.radians(-60)))
        s.collection.objects.link(so)


def camera(pos, look, fov=40):
    s = bpy.context.scene
    cd = bpy.data.cameras.new("cam")
    cd.sensor_fit = "VERTICAL"
    cd.angle_y = math.radians(fov)
    cd.clip_end = 5000
    co = bpy.data.objects.new("cam", cd)
    co.location = Vector(pos)
    co.rotation_euler = (Vector(look) - co.location).to_track_quat("-Z", "Z").to_euler()
    s.collection.objects.link(co)
    s.camera = co
    return co


def frame_objects(objs, fov=35, yaw=35, pitch=22):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector([min(p[i] for p in pts) for i in range(3)])
    hi = Vector([max(p[i] for p in pts) for i in range(3)])
    centre, radius = (lo + hi) / 2, max((hi - lo).length / 2, 0.5)
    dist = radius / math.sin(math.radians(fov) / 2) * 1.05
    d = Vector((math.sin(math.radians(yaw)) * math.cos(math.radians(pitch)),
                -math.cos(math.radians(yaw)) * math.cos(math.radians(pitch)),
                math.sin(math.radians(pitch))))
    return camera(centre + d * dist, centre, fov)


def render():
    bpy.ops.render.render(write_still=True)


# 1. atlas ------------------------------------------------------------------
atlas_path = EXPORT / "atlas.png"
index = textures.build_atlas(atlas_path)
print("atlas", atlas_path)

# 2. environment modules ----------------------------------------------------
seen = {}
for mod in layout["modules"]:
    seen.setdefault(mod["key"], mod)
tri_total = 0
for key, mod in sorted(seen.items()):
    reset()
    mats = meshkit.atlas_materials(bpy.data.images.load(str(atlas_path)))
    objs = meshkit.build_module_meshes(mod, index, mats)
    if not objs:
        continue
    tri_total += sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons)
    meshkit.export_fbx(objs, EXPORT / f"{key}.fbx")
print(f"exported {len(seen)} modules, {tri_total} tris")


# 3. tool rigs ----------------------------------------------------------------
# default skin theme (skins recolour these roles at runtime)
ROLE_COLOURS = {"P": "#F7A81B", "S": "#3C5CC8", "A": "#D8322C", "M": "#8E929C", "G": "#6BF2FF", "W": "#8B5A2B", "D": "#232326"}

def build_rig(rig_id, rig):
    bones = {b["name"]: b for b in rig["bones"]}
    objs = []
    for bname in bones:
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new("UVMap")
        mats = []
        for p in rig["parts"]:
            if p["bone"] != bname:
                continue
            hexc = p["role"] if p["role"].startswith("#") else ROLE_COLOURS.get(p["role"], "#B8C1CC")
            m = flat_material(hexc, p["role"] == "G")
            if m not in mats:
                mats.append(m)
            mtx = Matrix.Translation(meshkit.r2b(p["pos"])) @ meshkit.roblox_rot(*p["rot"]).to_4x4()
            fake_index = {"_": (0, 0)}
            meshkit.add_part(bm, mtx, p["size"], "_", p["shape"], fake_index, uv, mats.index(m), bevel=0.12)
        if not bm.faces:
            bm.free()
            continue
        me = bpy.data.meshes.new(f"{rig_id}_{bname}")
        bm.to_mesh(me)
        bm.free()
        for m in mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(bname, me)
        bpy.context.scene.collection.objects.link(ob)
        objs.append(ob)
    return objs


for rig_id, rig in sorted(game["rigs"].items()):
    reset()
    objs = build_rig(rig_id, rig)
    meshkit.export_fbx(objs, EXPORT / f"{rig_id}.fbx")
    setup_render((512, 512), 16, ICONS / f"{rig_id}.png", transparent=True)
    frame_objects(objs)
    render()
    setup_render((960, 640), 24, SHOTS / f"tool_{rig_id}.png")
    frame_objects(objs, fov=40, yaw=-30, pitch=15)
    render()
print("exported", len(game["rigs"]), "tool rigs")

# 4. finds ------------------------------------------------------------------
for f in game["finds"]:
    reset()
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
    for v in bm.verts:
        v.co.z *= 1.4 if f["tier"] >= 3 else 0.6
    me = bpy.data.meshes.new(f["id"])
    bm.to_mesh(me)
    bm.free()
    me.materials.append(flat_material(f["color"], glow=f["tier"] >= 4))
    ob = bpy.data.objects.new(f["id"], me)
    bpy.context.scene.collection.objects.link(ob)
    meshkit.export_fbx([ob], EXPORT / f"{f['id']}.fbx")
    setup_render((256, 256), 12, ICONS / f"{f['id']}.png", transparent=True)
    frame_objects([ob])
    render()
print("exported", len(game["finds"]), "finds")

# 5. hero render + reference match -----------------------------------------
reset()
mats = meshkit.atlas_materials(bpy.data.images.load(str(atlas_path)))
for mod in layout["modules"]:
    for o in meshkit.build_module_meshes(mod, index, mats, local=False):
        pass
cam = layout["heroCamera"]
setup_render((1536, 1024), 32, SHOTS / "hero.png")
camera(meshkit.r2b(cam["position"]), meshkit.r2b(cam["lookAt"]), cam["fov"])
render()
MATCH.mkdir(parents=True, exist_ok=True)
ref = Image.open(ROOT / "reference" / "hero.png").convert("RGB")
ours = Image.open(SHOTS / "hero.png").convert("RGB")
h = 640
ref = ref.resize((int(ref.width * h / ref.height), h))
ours = ours.resize((int(ours.width * h / ours.height), h))
pair = Image.new("RGB", (ref.width + ours.width + 16, h), (20, 20, 20))
pair.paste(ref, (0, 0))
pair.paste(ours, (ref.width + 16, 0))
pair.save(MATCH / "hero_vs_reference.png")
print("hero + reference match written")
