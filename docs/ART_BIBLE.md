# Art bible: Keep Digging!

Derived from `reference/hero.png` (see `docs/REFERENCE_SPEC.md` for the sampled palette). Every Blender script in `blender/` reads its constants from `blender/kd/palette.py` and `blender/kd/style.py`, which mirror this document.

## 1. Grid and scale
* **Voxel unit (U) = 4 studs.** Terrain, hole walls, gate blocks and obby platforms snap to this grid. Props may use half (2 studs) and quarter (1 stud) units.
* **Character scale:** an R15 avatar is about 5 studs tall (1.25 U). Fence rails are 3 studs high, lantern posts 5-6 studs, trees 12-20 studs.
* **Hole:** top radius 60 studs, 72 studs deep, five terraces (one per stratum) stepping inward by one unit each.
* **Plaza:** island radius about 230 studs, rim ground at Y = 0.
* **Blender units:** 1 Blender unit = 1 stud. Blender is Z-up; the exporter converts to Roblox Y-up (see `blender/README.md`).

## 2. Bevel and edge language
* Every hard edge is bevelled. No raw primitives are used as final geometry.
  * Environment blocks: bevel 0.22 studs, 2 segments, profile 0.6 (soft "chunk").
  * Props: 0.12 studs, 2 segments.
  * Hero tools: 0.04-0.10 studs depending on part size (about 3% of the smallest dimension), 3 segments on hero silhouettes.
* Weighted normals on all bevelled meshes. Sharp edges are marked where faces meet at 60 degrees or more.
* No n-gons, non-manifold geometry, flipped normals or loose vertices; `blender/kd/qa.py` checks all of these.

## 3. Palette (per stratum and per area)
Values are the sampled reference colours; textures vary around them (plus or minus 6% value, plus or minus 3 degrees hue) so no face is flat.

| Area | Light | Mid | Dark | Accent |
|---|---|---|---|---|
| Grass | #62A83F | #559838 | #1D491F | flowers #F6E05A, #F28AB2 |
| Topsoil (0-15%) | #BE6D34 | #8B4D27 | #5C2F1C | stone chunks #6D717C |
| Stone & fossils (15-35%) | #848182 | #685E5D | #4A4946 | fossil bone #D8C9A3 |
| Coal & ore (35-55%) | #3A2931 | #261B24 | #19151F | ore glint #FF9A3C, iron #8A8F99 |
| Crystal cavern (55-78%) | #5F5AAD | #354073 | #262E59 | cyan #52F6FF, purple #B34EFA, magenta #E040FB |
| Magma (78-95%) | #B33A3A | #822936 | #501E34 | lava #E93F1E -> #FE761D |
| Core (95-100%) | #FFF4D6 | #F7A81B | #8A5A10 | white-hot #FFFFFF |
| Sand | #FDD99B | #FCD390 | #F7CE8B | pebbles #C9A774 |
| Wood | #9A6A3E | #6E4A2A | #3E2A1C | iron bands #4A4E57 |
| Gate stone | #7990A1 | #4F556F | #203155 | moss #4A9B26 |
| Board face | #2A3048 | #181D2F | #0E1220 | gold rank #F7C64B |
| Neon | green #B2FEC9 | purple #BA99EA | red #FF3B5C | blue #5AB8FF |

## 4. Shape language
* Big chunky forms; every asset must read from 100+ studs away and as a black silhouette.
* Exaggerate the feature that names the object: drill flutes, excavator treads and boom, TBM cutter disc, missile fins, satellite panels.
* Stack masses bottom-heavy for machines; top-heavy canopies for trees; crystals as tapered hexagonal prisms in clusters of 3-7 at varied angles.
* Nothing thinner than 0.4 studs on environment props (it disappears on phones).

## 5. Texture treatment
* **Look:** hand-painted pixel-noise. Each block face is a 32 x 32 pixel-art tile upscaled to 128 px with nearest filtering. It has:
  * per-pixel value noise;
  * a darker 2-3 px rim (fake AO);
  * a lighter top-left edge highlight;
  * a few crack or speckle details.
* **Environment:** one 1024 x 1024 atlas (`blender/kd/textures.py`): 10 x 10 cells of 102 px, each a 96 px pixel-noise tile (32 x 32 art, upscaled x3) inside a 3 px gutter of repeated edge pixels; unused cells are neutral grey. One tile per palette material; each face shows its tile once, so it reads as chunky pixel art at any size.
* **Kept parts:** sign faces (SurfaceGui text), Neon, Glass and see-through parts are never meshed. They stay real Roblox parts so glow, glass and text render properly (`meshkit.stays_part` = `GreyboxSwap.KeepsVisible`).
* **Hero tools (planned, not built yet; current tool meshes use flat role colours):** one texture set per tool (colour, normal, roughness, metalness, emissive mask), each 1024 x 1024. They are baked in Blender from procedural shader graphs:
  * AO and curvature masks for edge wear and crevice dirt;
  * gradients and colour variation.
* **Skins:** the same UV layout per tool; only the texture set and the particle colours change. Galaxy and Animated Rainbow add extra geometry (rings, fins) as separate optional meshes.
* **Emissive:** crystals, lava, neon, lanterns and the portal have an emissive mask. In Roblox, MeshPart `Material = Neon` or SurfaceAppearance with a high-value colour drives bloom.

## 6. Lighting mood
* Warm, bright, saturated daylight from the upper left of the hero view; soft short shadows; light blue haze on distant terrain.
* Studio:
  * `Technology = Future`.
  * `Atmosphere`: Density 0.3, Haze 1.2, colour #C7E3FA.
  * `Bloom`: Intensity 0.6, Size 28, Threshold 1.6.
  * `ColorCorrection`: Saturation 0.12, Contrast 0.06.
  * `SunRays`: Intensity 0.04.
  * `DepthOfField` is on for High quality only.
  * `ClockTime 14.6`.
* Per-stratum presets (Strata.luau) blend as the camera descends: warm topsoil, neutral stone, amber ore, blue-violet cavern, red magma, gold core.

## 7. Budgets (verified against Roblox's current limits)
* **Per mesh:** Roblox rejects MeshParts over 20,000 triangles. Our hard ceiling is 15,000 for hero assets (each moving part is its own mesh, target under 10,000). Environment modules 2,000-10,000. Props 300-3,000.
* **Textures:** Roblox caps textures at 1024 x 1024. Every map is authored at 1024 or smaller.
* **Texture memory (mobile):** at most 24 unique 1024² sets resident at once:
  * environment atlas: 1 set;
  * signage: 1;
  * finds: 1 shared atlas;
  * the active tool sets (at most 3 concurrent heavy sequences on High);
  * pets, hats and plaques share 2 atlases.
  The Dig Director's caps keep concurrent tool sets bounded.
* **Collision:** visual meshes use `CanCollide = false`; invisible GREYBOX/collision boxes carry collisions (Box fidelity). Distant props use `RenderFidelity = Automatic`.
* **Parts:** greybox map under 6,000 parts; dynamic effects are pooled (see Config.Graphics).

Sources for the limits:
* [Roblox general specifications](https://create.roblox.com/docs/art/modeling/specifications)
* [DevForum: current mesh triangle limit](https://devforum.roblox.com/t/whats-roblox-current-mesh-triangle-limit/2414597)
* [Roblox mesh size limits explained (2026)](https://meshlox.com/learn/roblox-mesh-size-limits)

## 8. Naming conventions
* Meshes / Blender objects: `env_<module>_<variant>`, `prop_<name>_<variant>`, `tool_<toolId>_<part>`, `find_<id>`, `plaque_<style>`, `hat_<id>`, `pet_<id>_<part>`, `vfx_<name>`, `setpiece_<name>`.
* Rig bones and joints: `<part>` for the bone, `J_<child>` for the Motor6D. Attachments: `ATT_Muzzle`, `ATT_Impact`, `ATT_Exhaust`, `ATT_Spark`, `ATT_Tip`.
* Textures: `T_<asset>_<C|N|R|M|E>.png`. Materials: `M_<asset>`.
* Icons: `icon_<itemId>.png` (512 x 512, transparent).
* Every GREYBOX stand-in carries the tag `GREYBOX` and the attribute `AssetKey = <mesh name>`.

## 9. Hero shots (quality-gate cameras)
1. **Reference hero view:** the `ReferenceCamera` framing (Config.World.HeroCamera), with the whole stratum stack lit.
2. **Mid-hole crystal cavern:** camera at Y -46 inside the hole near the south wall, looking north-east at the cyan and purple clusters and the ladder.
3. **Magma floor:** camera at Y -62, looking across the lava pockets at the ladder foot and the crimson walls.

## 10. UI kit
* **Panels:** chunky rounded panels with a 4-6 px wood frame (#6E4A2A, highlight #9A6A3E), a dark slate face (#181D2F) and a 2 px neon accent stroke in the tab or tier colour.
* **Buttons:**
  * Gold buttons (#F7A81B to #FFD36B gradient, #5A3A08 outline) for primary actions.
  * Slate buttons for secondary actions.
  * All buttons squash on press (0.92 scale) and bounce back (Back easing).
* **Fonts:**
  * Display: Fredoka One (logo, headings, the DIG button), with a gold gradient and a dark outline.
  * Body and board text: Gotham Bold/Black, or Builder Sans Bold.
* **Tier frames:**
  * Common #B8C1CC
  * Uncommon #5FD35A
  * Rare #3FA9F5
  * Epic #B35CFF
  * Legendary #FFB627
  * Mythic #FF4FD8
* **Icons:** rendered in Blender with a fixed three-quarter camera, a key and rim light, on transparent backgrounds. Frames are drawn by the UI so one icon works for every tier.
* **Mobile:** minimum tap target 56 px (scaled), minimum text 16 px, primary actions bottom-right in thumb reach.
