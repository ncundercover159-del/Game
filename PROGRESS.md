# Progress

## How to run
`npm run dev`, open http://localhost:8080/. `npm test` for unit tests; `npm install` once, then
`npm run test:e2e` and `npm run shots` for the headless smoke test and screenshots.

## Milestones
- [x] **M0 Foundation and look**: references studied, STYLE_GUIDE.md, 63-colour palette, indexed-grid
  sprite pipeline + atlas, gallery and animation preview, integer-scaled canvas, fixed-step loop,
  input abstraction, camera, procedural autotiled terrain (47 blob cases), layered player with
  walk/idle/tool animations.
- [x] **M1 Farm vertical slice**: 64x48 overgrown farm (seeded weeds, stones, twigs, stumps,
  trees, bamboo; forest edge; pond; river with banks; minka, kura, well, lanterns, fenced terraces),
  movement with corner-sliding collision, 5 tools with swing animations and effects, target tile +
  mouse reach, 12-slot hotbar and backpack menu, till > plant > water > grow > harvest for daikon,
  komatsuna, soramame and strawberry (regrows), item drops with magnet pickup, Genki, day/night
  lighting with window and lantern pools, clock with sun/moon dial and zodiac hour, sleep via the
  farmhouse door with ink-wipe day card, pass-out at 02:00, 3-slot saves (checksum, backup,
  migrations, export/import), autosave on sleep, Tsukikage tutorial asides, procedural SFX,
  title screen, options (sound, time speed, screen shake), debug keys and URL parameters.
  Feedback after M1: "I really like them. Continue."
- [x] **M2 Seasons and economy**: four seasons restyle the farm in place (turf palettes, maple and
  ginkgo, bare winter branches, snow on thatch and weeds, seasonal decals and drifting petals or
  leaves); deterministic weather forecast the evening before (clear, cloudy, rain, wind, summer
  storms with lightning, tsuyu rains, two typhoons per autumn, snow, blizzards) with rain watering
  the fields and dimming the light; irrigation channels dug with the hoe, flood-fill flow from the
  pond or river, sluice gates, flooded paddies and rice; all 22 starter crops (18 with generated
  art), season withering, straw-covered winter beds (hay), typhoon damage; shipping crate and an
  itemised end-of-day screen with forecast and a seasonal verse; Chōbei's Yorozuya (buy by season
  with a Saturday seed discount, sell) and Genzō's forge (iron bars, two-day tool upgrades) reached
  by the valley road; tool tiers with charged hoe/can swings (3, 5, 9 tiles), heavier axe and
  pickaxe hits, large logs and boulders that need an upgrade; HUD weather icon, tier icons, charge
  pips; save v2 with a v1 migration.
- [ ] M3 Village and people
- [ ] M4 Nature and craft
- [ ] M5 Combat and caves
- [ ] M6 Story and festivals
- [ ] M7 Content and polish

## Next
M3 Village and people: the village and shrine maps, interiors and warps (the farmhouse gets a real
bed), the NPC framework (schedules, A* pathfinding, dialogue script engine), bonds and gifts, the
notice board and letters, 8 NPCs, Shrine Offerings v1. The valley-road shop menu becomes a walk to
the real Yorozuya and forge.

## Verification (M1)
- `npm test`: 36 unit tests (calendar, farming rules and regrowth, inventory, save checksum and
  migrations, day rules, autotile masks, art integrity, RNG/population determinism, collision).
- `npm run test:e2e`: title -> new farm -> walk the path -> till, plant, water -> sickle a weed and
  collect the drop -> sleep through the door dialogue -> overnight growth -> hand harvest -> refill
  at the well -> save from the menu -> reload the slot -> pass out at 02:00 (10% penalty, half
  Genki, wake at home). Zero console errors.
- `npm run shots`: shots/m1/01-10 (title, first morning, crop stages, axe strike, golden hour,
  night, menu, day card, whole-farm overview, 720p window).
- Performance (headless Chromium, software rendering, night with lighting): simulation step
  0.03 ms, update + render 2.8 ms per frame; JS heap ~10 MB; atlas ~1024x~900; 219 autotile cells.

## Verification (M2)
- `npm test`: 48 unit tests, adding irrigation flow/sluices/paddies, season withering, rain and
  typhoons, planting rules (season, paddy, straw), multi-yield harvests, weather determinism
  (tsuyu, exactly two typhoons), shipping value, charged swing areas, v1 -> v2 save migration.
- `npm run test:e2e` adds: shipping a stack in the crate and being paid overnight; an Iron hoe
  charged for a second tilling three tiles in a line.
- `npm run shots` writes shots/m2 (seasons, rain, storm at night, irrigated paddies, shop, forge,
  end-of-day screen, every crop ripe).

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
- Until interiors exist (M3), sleeping happens at the farmhouse door (interact facing it).
- Any tool clears a weed (only the sickle yields hay); every swing costs 2 Genki except refilling
  the Jōro; the pickaxe turns empty soil back to earth but never destroys a planted tile.
- Items left on the ground at the end of the day are collected automatically (drops are not saved).
- Harvest quality in M1 uses base odds (Fine 12%, Excellent 3%); farming skill modifies it in M4.
- No crop withering at season change yet: seasons as a system arrive in M2.
- Every new game draws its overgrowth from the seed (`?seed=` for reproducible layouts).
- (M2) The Yorozuya and the forge are reached from the valley road as a trip menu (60 in-game
  minutes, shop hours and closed days apply) until the village map is walkable in M3.
- (M2) Irrigation: hoe on empty tilled soil digs a channel; the pickaxe fills it; channels carry
  water only when connected (4-way) to natural water; a tilled tile beside running water is a
  paddy and counts as watered. Rice only grows in paddies.
- (M2) Winter crops need straw-covered soil: use Hay on tilled soil. Straw also protects crops
  from typhoons (bamboo windbreaks join in M4 with crafting).
- (M2) Charged swings exist for the hoe and can only (Iron 3-line, Steel 5-line, Tamahagane 3x3);
  axe and pickaxe tiers add damage per hit. Steel bars and tamahagane come from the caves (M5), so
  in M2 only Iron upgrades are reachable.
- (M2) Crop art: the four M1 crops stay hand-drawn; the other 18 are generated from plant forms
  (rosette, bush, vine, trellis, grass) and shaded produce blobs, so every crop has 5 stages and
  an icon from the same style rules.
- (M2) Seasons restyle by recolouring atlas frames (`name@summer|autumn|winter`) and by per-season
  turf palettes; the ground chunks are redrawn once when the season turns.

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

**M2 pass** (seasonal art; the references only show spring, so the fallback direction in the brief
leads): maple reds and ginkgo gold follow ref 1's foliage clustering; winter uses `ink4-6` snow
with violet shadows per the palette rules. Fixes from the pass: day-time light pools showing
under snow (threshold raised), bare trees too short (longer first branch), thatch too bright
under snow (snowy thatch variant), clock plate too narrow for two-digit days (widened).

**M0 pass 2**: grass brightness/saturation and silhouettes now match the family; remaining gaps are
content density (flowers, props), not style. Tool swing windup was hidden behind the head -> tools
raised higher and drawn behind the body only while raised.

## Known issues
- Bamboo clumps and the thatch roof are serviceable but plain; revisit with the bamboo grove (M4).
- The northern terraces are fenced, signposted and stepped with stone walls, but stay locked until
  the shrine is restored (M3 offerings).
- Shops open from a valley-road menu until the village map exists (M3).
- Weather has no audio yet (the procedural soundscape is M7); thunder uses a stand-in rumble.
- Interiors do not exist yet, so the farmhouse door is where you sleep (bed interaction in M3).
- Touch controls, rebinding UI and the fuller title/new-game flow are M7 items.
