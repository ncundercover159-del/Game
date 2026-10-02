
## Art pass
- `blender/build_all.py`: atlas, 58 environment FBX modules (231k tris total, chunked at 12k per mesh), 11 tool FBX, 21 find FBX, 32 icons, tool shots, hero render and reference pair (`docs/reference-match/hero_vs_reference.png`).
- Tests: 47/47 pass (`lune run tests/run`).
- Known gaps against the reference: the distant mountain backdrop renders as flat blocks; the boards and logo text are runtime SurfaceGuis, so they're blank in the Blender render; foliage density is lower than the reference.
