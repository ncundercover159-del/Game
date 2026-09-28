# Progress

## How to run
`npm run dev`, open http://localhost:8080/. `npm test` for unit tests; `npm install` once, then
`npm run test:e2e` and `npm run shots` for the headless smoke test and screenshots.

## Milestones
- [x] **M0 Foundation and look**: references studied, STYLE_GUIDE.md, 63-colour palette, indexed-grid
  sprite pipeline + atlas, gallery and animation preview, integer-scaled canvas, fixed-step loop,
  input abstraction, camera, procedural autotiled terrain (47 blob cases), layered player with
  walk/idle/tool animations.
- [ ] **M1 Farm vertical slice** (in progress)
- [ ] M2 Seasons and economy
- [ ] M3 Village and people
- [ ] M4 Nature and craft
- [ ] M5 Combat and caves
- [ ] M6 Story and festivals
- [ ] M7 Content and polish

## Next
Finish M1: verify every system headlessly (growth across days, sleep, save/load round trip), unit
tests, Playwright smoke test, screenshot script, then stop for feedback.

## Decisions
- The repository already contained ORBIT (a small arcade game) at the root; it was moved to
  `orbit/index.html` unchanged so the new game can own `index.html`.
- Font: Fusion Pixel (OFL) 8/10/12 px with full Japanese coverage, from the npm fontsource
  packages (GitHub release downloads are blocked in this environment). Glyphs are rasterised once
  and alpha-thresholded, so all text is 1-bit crisp.
- Art is a mix of hand-typed indexed grids (characters, crops, icons, props) and procedural
  generators that output the same indexed grids (terrain, trees, weeds, buildings). Everything is
  compiled into one atlas at boot; autotile variants are generated lazily into a cell cache.
- Terrain edges: blurred 3x3 occupancy thresholded against tileable noise, reduced to the 47
  canonical blob masks. Texture period is 64 px (16 windows per terrain) to avoid visible repeats.
- The bank of a pond or river is drawn by the water tile below the land (3/4 view), not by the land
  tile.
- Head is ~45% of character height, following reference 1 instead of the brief's "a third"
  (references win on looks).
- Tsukikage's asides are non-modal (a dark box, top-left, 7 s) so tutorial hints never block play;
  signs and prompts use the modal dialogue box.

## Reference conflicts (logged)
- Brief: head about a third of body height. Reference 1: ~45%. Followed the reference.

## Art comparison passes
**M0 pass 1** (game at 1x/3x next to reference 1):
1. Grass a step darker and cooler than the reference's yellow-green -> grass ramp retuned
   (`grass3/4/5`), texture now weighted to the lighter tones.
2. Character outlines weaker than the reference's near-black silhouettes -> kosode and hakama
   outlines moved to `ink0`.
3. Drop shadows too faint -> alpha 0.28 -> 0.36.
4. Bare earth flat, no shadow under grass edges -> sparse lit lumps in the dirt, 1 px turf shadow.
5. Weeds read as repeated "shells" -> redrawn as fans of pointed leaves with midribs.

**M0 pass 2**: grass brightness/saturation and silhouettes now match the family; remaining gaps are
content density (flowers, props), not style. Tool swing windup was hidden behind the head -> tools
raised higher and drawn behind the body only while raised.

## Known issues
- None blocking. Thatch roof could use more depth; bamboo clumps are simple.
