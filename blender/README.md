# Blender art pipeline

All art is authored procedurally in Blender (headless `bpy` module, Blender 4.5).

    pip install bpy==4.5.* numpy pillow     # Python 3.11
    python blender/build_all.py [--fast]    # ~6 min on CPU (Cycles)

| Step | Output |
|---|---|
| Pixel-noise texture atlas (`kd/textures.py`) | `assets/export/atlas.png` |
| Environment modules from `assets/layout.json` (`kd/meshkit.py`) | `assets/export/env_*.fbx` |
| Tool rigs from `assets/gamedata.json` (defined in `src/shared/Rigs.luau`) | `assets/export/dig_*.fbx` |
| Finds | `assets/export/find_*.fbx` |
| Icons | `assets/renders/icons/*.png` |
| Hero render + reference pair | `docs/screenshots/hero.png`, `docs/reference-match/` |

`assets/layout.json` comes from `python blender/kd/layout.py`, and `assets/gamedata.json` from `lune run tools/export_data`.
Both are the single source shared with the Rojo place builder, so a mesh's pivot always matches its GREYBOX stand-in (`AssetKey` attribute).
FBX files are exported -Z forward, Y up, with the textures embedded. After a build, run `tools/upload_assets.py` (Open Cloud) or `tools/studio/SwapGreybox.lua`; see docs/SETUP.md.
