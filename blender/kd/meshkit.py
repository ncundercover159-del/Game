"""Blender mesh kit: bevelled blocks with atlas UVs, materials, FBX export.

Roblox (x, y, z) -> Blender (x, -z, y). Every part becomes a bevelled box
(cylinders get 12 sides, balls a UV sphere); faces are UV-mapped into the
part's material tile so the whole module uses one atlas texture set.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from palette import MATERIALS
from textures import tile_uv

C = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))
GLOW_KEYS = {k for k, v in MATERIALS.items() if v[0] == "Neon"}
GLASS_KEYS = {k for k, v in MATERIALS.items() if v[0] == "Glass"}


def r2b(v):
    return C @ Vector(v)


def roblox_rot(rx, ry, rz):
    rot = Matrix.Rotation(math.radians(rx), 3, "X") @ Matrix.Rotation(math.radians(ry), 3, "Y") @ Matrix.Rotation(math.radians(rz), 3, "Z")
    return C @ rot @ C.transposed()


def part_matrix(pivot, yaw, p):
    piv = Matrix.Translation(r2b(pivot)) @ roblox_rot(0, yaw, 0).to_4x4()
    local = Matrix.Translation(r2b(p["p"])) @ roblox_rot(*p.get("r", (0, 0, 0))).to_4x4()
    return piv @ local


def add_part(bm, matrix, size, key, shape, index, uv_layer, mat_index, bevel=0.22, segments=1):
    sx, sy, sz = size  # roblox x, y(up), z
    before = set(bm.faces)
    scale = Matrix.Diagonal((sx, sz, sy, 1))  # blender x, y(depth), z(up)
    if shape == "Cylinder":
        # Roblox cylinders run along local X
        geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.5, radius2=0.5, depth=1.0)
        verts = geom["verts"]
        bmesh.ops.rotate(bm, verts=verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 3, "Y"))
    elif shape == "Ball":
        geom = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=0.5)
        verts = geom["verts"]
    else:
        geom = bmesh.ops.create_cube(bm, size=1.0)
        verts = geom["verts"]
    bmesh.ops.transform(bm, matrix=matrix @ scale, verts=verts)
    faces = list({f for v in verts for f in v.link_faces})
    if shape == "Block" and bevel > 0:
        edges = list({e for f in faces for e in f.edges})
        smallest = min(sx, sy, sz)
        off = min(bevel, smallest * 0.2)
        if off > 0.01:
            bmesh.ops.bevel(bm, geom=edges + list(verts), offset=off, segments=segments, profile=0.6, affect="EDGES", clamp_overlap=True)
            bm.normal_update()
    faces = [f for f in bm.faces if f not in before]
    u0, v0, u1, v1 = tile_uv(index, key)
    for f in faces:
        if not f.is_valid:
            continue
        f.material_index = mat_index
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        a, b = [(1, 2), (0, 2), (0, 1)][ax]
        coords = [(lv.vert.co[a], lv.vert.co[b]) for lv in f.loops]
        mins = [min(c[0] for c in coords), min(c[1] for c in coords)]
        span = [max(c[0] for c in coords) - mins[0] or 1, max(c[1] for c in coords) - mins[1] or 1]
        for lv, (ca, cb) in zip(f.loops, coords):
            lv[uv_layer].uv = (u0 + (ca - mins[0]) / span[0] * (u1 - u0), v0 + (cb - mins[1]) / span[1] * (v1 - v0))


def atlas_materials(atlas_image):
    mats = {}
    for kind in ("base", "glow", "glass"):
        name = f"M_env_{kind}"
        m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree
        bsdf = nt.nodes["Principled BSDF"]
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = atlas_image
        tex.interpolation = "Closest"
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = 0.85
        if kind == "glow":
            nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
            bsdf.inputs["Emission Strength"].default_value = 5.0
        if kind == "glass":
            bsdf.inputs["Alpha"].default_value = 0.55
            bsdf.inputs["Roughness"].default_value = 0.1
            m.blend_method = "BLEND" if hasattr(m, "blend_method") else None
        mats[kind] = m
    return mats


def mat_kind(key):
    if key in GLOW_KEYS:
        return "glow"
    if key in GLASS_KEYS:
        return "glass"
    return "base"


def build_module_meshes(module, index, mats, max_tris=12000, local=True, segments=1):
    """Builds one or more mesh objects (split under max_tris) for a layout module."""
    objects = []
    pivot = module["pivot"] if not local else [0, 0, 0]
    yaw = module["yaw"] if not local else 0
    origin = Matrix.Identity(4)
    if not local:
        origin = Matrix.Identity(4)
    chunk = 0
    bm = None
    tris = 0
    kinds = ["base", "glow", "glass"]

    def flush():
        nonlocal bm, chunk, tris
        if bm is None:
            return
        me = bpy.data.meshes.new(f"{module['key']}_{chunk}")
        bm.to_mesh(me)
        bm.free()
        for k in kinds:
            me.materials.append(mats[k])
        ob = bpy.data.objects.new(f"{module['key']}_{chunk}" if chunk else module["key"], me)
        bpy.context.scene.collection.objects.link(ob)
        objects.append(ob)
        bm = None
        chunk += 1
        tris = 0

    for p in module["parts"]:
        if p.get("t", 0) >= 0.99:
            continue
        if bm is None:
            bm = bmesh.new()
            uv = bm.loops.layers.uv.new("UVMap")
        uv = bm.loops.layers.uv.active
        m = part_matrix(pivot, yaw, p) if not local else (Matrix.Translation(r2b(p["p"])) @ roblox_rot(*p.get("r", (0, 0, 0))).to_4x4())
        add_part(bm, m, p["z"], p["m"], p["s"], index, uv, kinds.index(mat_kind(p["m"])), segments=segments)
        tris = sum(len(f.verts) - 2 for f in bm.faces)
        if tris > max_tris:
            flush()
    flush()
    return objects


def export_fbx(objects, path):
    bpy.ops.object.select_all(action="DESELECT")
    for ob in objects:
        ob.select_set(True)
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.fbx(
        filepath=str(path),
        use_selection=True,
        apply_unit_scale=True,
        apply_scale_options="FBX_SCALE_UNITS",
        axis_forward="-Z",
        axis_up="Y",
        mesh_smooth_type="FACE",
        path_mode="COPY",
        embed_textures=True,
        bake_space_transform=True,
    )
