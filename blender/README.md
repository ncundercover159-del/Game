# Blender art pipeline

All art is authored procedurally in Blender (headless `bpy` module, Blender 4.5).

    pip install bpy==4.5.* numpy pillow     # Python 3.11
    python blender/build_all.py [--fast]    # ~6 min on CPU (Cycles)

| Step | Output |
|---|---|
| Pixel-noise texture atlas (`kd/textures.py`) | `assets/export/atlas.png` |
| GREYBOX modules from `assets/layout.json` (`kd/meshkit.py`), each with a `KD_Probe` cube | `assets/export/env_*.fbx`, `prop_*.fbx`, `manifest.json` |
| Tool rigs from `assets/gamedata.json` (defined in `src/shared/Rigs.luau`) | `assets/export/tool_*.fbx` |
| Finds | `assets/export/find_*.fbx` |
| Icons | `assets/renders/icons/*.png` |
| Hero render + reference pair | `docs/screenshots/hero.png`, `docs/reference-match/` |
| Swap files (`tools/gen_swap_script.py`) | `src/shared/MeshManifest.luau`, `tools/studio/SwapGreybox.lua`, `KD_fbx_models.zip` |

`assets/layout.json` comes from `python blender/kd/layout.py`, and `assets/gamedata.json` from `lune run tools/export_data`.
Both are the single source shared with the Rojo place builder, so every mesh is authored in its stand-in's local space (`AssetKey` attribute).
FBX files are exported -Z forward, Y up, with the textures embedded. Meshes leave out the parts that stay real parts (signs, Neon, Glass, see-through parts) and are split at 12k triangles or 1000 studs.
The swap doesn't rely on the importer keeping that origin. `manifest.json` records every mesh's local bounds and the probe position, and `Shared.GreyboxSwap` uses them to undo whatever scale, turn and offset the importer applied (see SETUP.md, section 4).
