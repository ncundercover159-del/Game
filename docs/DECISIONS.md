
## Art pipeline (milestone h)
- Tool rigs are defined once in Luau (`src/shared/Rigs.luau`), exported to `assets/gamedata.json`, and meshed in Blender. Runtime GREYBOX rigs and the FBX meshes share pivots and bones.
- Skins are colour/material themes applied to rig part roles (P/S/A/M/G/W/D). This avoids a separate mesh per skin.
- Blender ran headless (`bpy` module, Cycles CPU) because no Blender MCP was connected in the cloud session. Studio MCP was also unavailable, so the place is built with Rojo, and the art is swapped in by upload or by a command-bar script.
