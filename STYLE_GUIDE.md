# Rōnin no Sato: Style Guide

Numbers first. Everything here was measured from the four attached references or decided to fill
gaps they leave. When a reference and this guide disagree about how something *looks*, fix this
guide.

## 1. What each reference is for

| # | File | Use it for | Do not use it for |
|---|------|------------|-------------------|
| 1 | `1.png` (1920x1080 festival clearing, a Stardew Valley screenshot) | Pixel scale, tile size, character proportions and outlines, grass texture, foliage clustering, cherry-blossom palette, wooden fence and planter construction, drop shadows | Any character, costume, layout or asset. It is copyrighted: style analysis only |
| 2 | `2.jpg` (860x484 night farm with HUD, a Stardew Valley screenshot, downscaled) | HUD construction (wooden nine-slice frames, hotbar, clock plate with dial, vertical energy bar), night lighting (indigo multiply + warm light pools), water and shoreline, cobble paths, lush weed clumps | Any asset, icon, or the exact HUD layout. Style analysis only |
| 3 | `3.jpg` (photo: vermilion three-storey pagoda before a waterfall in dense forest) | Architecture colour (vermilion lacquer + dark grey-teal tile roofs + white trim), mountain forest mood, waterfall, the "deep mountain" greens (bluer and less saturated than ref 1) | |
| 4 | `4.jpg` (photo: white castle keep, sakura, vermilion bridge, boatman with sugegasa) | White plaster + dark tile architecture (kura storehouses, castle town), sakura masses, stone wall colours, vermilion bridges, sugegasa hats, spring sky | |

## 2. Measurements

| Property | Value | Source |
|----------|-------|--------|
| Logical pixel | 4x4 device px at 1920x1080 | ref 1: 83% of colour runs are multiples of 4, grid offset 0 |
| Logical viewport | 480x270 at 1080p (band 420-520 x 230-290) | ref 1 / 4 |
| Tile | 16x16 logical px | fence post pitch, planters, hotbar slots |
| Character frame | 16x32; visible height 28-30 px; width 14-16 px | ref 1 villagers |
| Head | 12-14 px tall, **~45% of body height** (the brief said a third; the references win) | ref 1 |
| Eyes | 1-2 px wide, 2 px tall, dark with an occasional light catch-light | ref 1 |
| Legs | 4-6 px visible; feet 2 px | ref 1 |
| Drop shadow | ellipse ~12x4 px under feet, ink at ~30% opacity | ref 1 |
| Trees | canopy 36-48 px wide, built from 6-8 px leaf clusters; trunk 8-12 px | ref 1 |
| HUD slot | 16x16 icon in an 18-20 px slot; 12 slots | ref 2 (30 px pitch at 0.45 scale = 17 logical) |
| HUD frame border | 3-4 px: dark brown outline, orange-tan bevel, cream inset | ref 2 |
| Energy bar | vertical, ~8x56 px, green fill, lettered cap | ref 2 |
| Clock plate | ~72x44 px: day/night dial on the left, date/time text boxes on the right, money counter below | ref 2 |

## 3. Palette rules

- One master palette: **`src/art/palette.js`**, 63 colours in 12 named ramps (`ink`, `grass`,
  `teal`, `water`, `wood`, `stone`, `straw`, `red`, `gold`, `sakura`, `indigo`, `skin`), dark to
  light, 1 spare slot of the 64 budget. Every drawn colour is a palette entry.
- Blended colours are allowed only as the result of drawing palette colours with opacity (drop
  shadows, the day/night multiply overlay, light pools, UI dimming).
- Hue shifting: shadows move toward teal/indigo/violet (`grass0` is a blue-teal, `sakura0` a
  violet, `wood0` a purple-brown); highlights move toward warm yellow/peach (`grass6` is a
  yellow-green, `wood6` a straw cream).
- No pure black (`ink0` = #140f1c) or pure white (`ink6` = #f6efe6).
- Saturation: high for the valley (refs 1-2 are strongly saturated). Mountain/shrine areas lean on
  `teal` and the darker `grass` steps to echo ref 3's cooler forest.

Extracted dominant colours (median-cut) that the ramps were fitted to:

- Ref 1 grass: #359a0b #63c216 #237921 #2b8907 #107216; shadows #085326 #054f2b #0c373e; outlines
  #110b0b #030103; wood #4c2413 #8f401c #d66930; sakura #652381 #af55bd #f67db7 #f4b6c0.
- Ref 2 night: #1752ab #02028a (water) #dbba82 #c28b4a #a8551e #63241b (HUD wood) #10520d #46ad3d.
- Ref 3: #79a64d #527c28 #2a3d36 #0d2225 (forest), #84cdfe (sky).
- Ref 4: #e8e7f2 (plaster) #382e27 #544b3a (roof/wood) #d1b9c0 #c59fa2 (sakura) #2f8adb #59a3e0
  (sky) #9c8971 #766a3b (stone wall).

## 4. Outlines and shading

- **Selective outlines**: an object's outline is the darkest tone of its *own* ramp
  (`raster.outline()` does this automatically). Hair outlines in dark hair colour, a kimono in its
  darkest dye, a tree in `grass0/1`.
- Characters and interactable objects get a full 1 px outline all round. Terrain gets outlines only
  on the edge facing the lower layer (grass rim over dirt, soil rim).
- Light comes from the **top-left**. Each material uses 3-4 tones: outline, shadow, mid, light
  (+ an optional specular pixel on metal, water and eyes).
- Dithering only for fog, sky and water. No gradients, no blur, no anti-aliasing (including text).

## 5. Terrain

- 16x16 tiles, autotiled per 3x3 neighbourhood, reduced to the 47 canonical blob masks
  (`src/art/terrain.js`). Edges come from a blurred occupancy field thresholded against tileable
  noise, so corners are rounded and edges are slightly ragged like hand-drawn tiles.
- Texture period is 64 px: each tile shows one of 16 windows of the texture, so no 16 px repeats.
- Layer order (bottom to top): water, land (earth), tilled soil, grass, path, decals.
- Grass: 2x1 speckle in `grass2..grass5` with occasional blade marks, `grass1` rim, `grass2` lip on
  south edges.
- Water: `water1/2` body, `water3/4` ripple dashes that shimmer over 4 frames (250 ms each), foam
  hugging the shore, a 4 px striated earth bank face under land to the north, and a `water0` shadow
  band below it.
- Tilled soil: `wood2` loam broken into lit clods; wet soil is one step darker on the same ramp.

## 5b. Seasons
- Turf palettes (`GRASS_PALS`): spring `grass2-6`; summer one step deeper (`grass1-5`); autumn
  olive with straw highlights (`grass1-3` + `straw2-3`); winter snow (`ink4-6`, violet shadows).
- Foliage recolours: summer leaves one step darker; broadleaf autumn alternates maple
  (`red0-4`, `gold2-3`) and ginkgo (`gold0-3`); sakura is green in summer, orange-red in autumn;
  broadleaf and sakura go bare in winter (branches in `wood0-2` with snow caps); pines take snow on
  their lit tiers; weeds dry to straw in autumn and become snowy mounds in winter.
- Snow settles on thatch (`straw2-4` -> `ink5-6`) and on terrace walls.
- Seasonal ground decals: spring flowers, summer hydrangea blue, autumn fallen leaves and red
  higanbana, winter twigs.

## 6. Characters

- Frame 16x32, anchored at the feet (8, 30). Head ~13 px, torso ~8 px, hakama ~7 px, feet 2 px.
- Built from layers: body/skin, outfit (kosode top, hakama, obi), hair, headwear, held tool.
  Palette swaps use semantic keys (see `src/art/characters.js`) so one set of grids supports
  skin tones, hair colours and outfit dyes.
- 4 directions; left frames mirror right frames. Walk: 4 frames at 150 ms (contact, pass, contact,
  pass; body bobs up 1 px on pass frames). Idle: 2-frame breathing (torso 1 px). Tool swing: 3
  frames (raise, strike, follow-through).

## 6b. Villagers and portraits
- Villagers share the player's grids. Variety comes from palette ramps (hair, skin, kosode,
  hakama/kimono, obi, collar, cord) and hairstyle crowns painted over the head: topknot (base),
  cropped, bun with a kanzashi, long (hair over the shoulders and down the back; a white paper tie in the portrait), and a
  hachimaki headband in the cord colour. Only the player wears a sword.
- Portraits are 48x48 busts: shoulders and crossed collar in the robe colours, a lit face with a
  solid shadow band on the right (no dithering), hair by style, and five expressions (neutral,
  happy, sad, angry, surprised) set by brows, eyes and mouth. Older faces get two lines at the
  mouth and brow; beards are solid with a lit left side.
- Emote bubbles: ink6 bubble with an ink1 outline and a tail, 7x6 symbol (!, ?, heart, dots,
  note, anger).

## 7. Objects, trees, buildings

- Trees: procedural canopies from overlapping leaf clusters shaded top-left, outlined in their own
  ramp's darkest tone, with a separate trunk; canopies sway 1 px and turn translucent when the
  player walks behind them.
- Architecture follows refs 3-4: thatch in the `straw` ramp with vertical strand texture and a
  thick cut eave; plaster in `ink5/ink6`; timber in `wood0-2`; tile roofs in `ink1-3` with `teal`
  moss accents; vermilion lacquer in `red2/red3`.
- Townhouses (machiya) are parametric: tile or thatch roof, plaster or board walls, koshi lattice
  windows either side of the door, a noren in the shop's colour, a signboard, a stone plinth. They
  are drawn bottom-centred on their footprint; the door sits on the footprint's front row.
- Shrine: torii 78 px wide with posts outside the stair; the hall has vermilion pillars, white
  walls and a dark cypress-bark roof with crossed chigi; ema racks and a shimenawa on the cedar.
- Interiors are seen from above with a two-row back wall (dark cap, then plaster over a timber
  wainscot). Floors: tatami (straw weave, indigo heri on the long sides), floorboards (4 px boards
  running away from the viewer, rare butt joints), doma (tamped earth). Furniture keeps the same
  outline and light rules as outdoor props.

## 8. UI

- Nine-slice wooden frames: `wood1` outline, `wood4/wood5` bevel, `wood6/straw4` cream inset
  (ref 2). Selected hotbar slot: `red2` frame.
- Text: Fusion Pixel (OFL, 8/10/12 px), rasterised once per glyph and alpha-thresholded, so text is
  1-bit crisp and always drawn at integer positions. Body text `wood1` on cream, HUD numbers
  `red1` on cream (ref 2), world captions `ink6` with a 1 px `ink0` drop shadow.

## 9. Lighting

- Day/night: a multiply overlay whose colour is keyed to the time (dawn `sakura4`, day none,
  golden hour `gold3`, dusk `indigo3`, night `indigo2` -> `indigo1`).
- Light pools: concentric stepped discs (no gradients) added onto the light map at night, warm
  (`gold2`, `red4`) for lanterns, windows and hearths.
- A soft vignette (stepped, 2 bands) at night only.

## 10. Comparison log

Side-by-side checks against the references at 1x and 3x are recorded in PROGRESS.md
("Art comparison passes").
