# Reference spec: `reference/hero.png`

Source: `reference/hero.webp` (1536 x 1024, converted to `hero.png` for sampling). Colours below were sampled from the real pixels (median / 75th-percentile-lightness / 25th-percentile-darkness of each region) with the script in `tools/sample_reference.py`. This spec is the build checklist for the map, lighting and signage. Coordinates are image pixels, origin top-left.

## (a) Composition and camera
* **Aspect / framing:** 3:2 landscape. High three-quarter aerial view looking north, about 40 degrees down, wide lens (estimated vertical FOV about 60 degrees, horizontal about 85 degrees). Slight barrel feel at the edges (boards lean inward).
* **Hole placement:** rim ellipse spans x 420-1150, y 330-780; centre about (790, 560), slightly right of centre and below the middle. The near rim is cropped by the fence at y ~720-780. The far wall shows the full strata stack; the near wall is hidden.
* **Foreground (bottom third):**
  * Artifacts hall, bottom-left (x 0-520, y 620-1000): a curved fenced lawn with six stone pedestals.
  * Stone portal on a sandy plaza, bottom-right (x 1100-1300, y 690-900).
  * Grass blocks with dark dirt sides cropping the frame edges.
* **Midground:** the hole inside its fence ring; the golden relic orb at right (x 1290-1440, y 520-690); the waterfall and pond at left (x 0-160, y 490-620).
* **Background:**
  * Carved stone gate with the 3D logo, top centre (logo x 570-900, y 30-215; gate doorway x 700-790, y 205-290).
  * Beginner Obby top-left (x 250-520, y 140-330).
  * Market stall (x 870-960, y 220-290).
  * Pro Obby top-right (x 1000-1300, y 120-380).
  * Distant voxel hills and floating cliffs, blue mountains at the far left, and a pale sky with soft clouds.
* **Edge framing:** two big angled boards. "Top Diggers" (left, x 0-240, y 150-500) leans in from the left edge; "Most Valuable Finds" (right, x 1260-1536, y 170-620) leans in from the right.

## (b) Environment
* **Hole:** wide, near-circular but faceted by the voxel grid (reads as a rounded octagon). Stepped walls with 5-6 terraces narrowing inward. The far wall is the "hero wall".
* **Strata, rim to floor:**
  1. **Topsoil:** brown dirt blocks, warm and sunlit (#BE6D34 light, #8B4D27 mid, #5C2F1C dark), with embedded grey stone chunks.
  2. **Stone:** grey cobble patches (#848182 / #685E5D / #4A4946); shadowed stone faces read violet-grey (#453E5E).
  3. **Coal & ore:** a near-black speckled band (#3A2931 / #261B24 / #19151F) with small orange "lantern window" glints.
  4. **Crystal cavern:** dark navy-violet blocks with a blue speckle texture (#5F5AAD / #354073 / #262E59; deepest #15182B). Glowing cyan clusters (#52F6FF / #10CAF6 / #0967CB) and purple-magenta clusters (#B34EFA / #7D2CE6 / #5A32C7). The biggest purple cluster sits low-left at x 600-640, y 590-640.
  5. **Magma floor:** crimson rock (#822936 / #501E34) with lava pockets (#E93F1E core, #FE761D glow) and strong bloom.
* **Ladder and scaffold:** a timber ladder with two lantern stops runs down the far-right wall (x 920-960, y 470-700). This doubles as the in-game depth gauge.
* **Rim:** a tan sand path ring (sunlit #FDD99B, #FCD390, shade #F7CE8B) just outside a wooden post-and-rail fence. About 12 lantern posts are visible around the ring (warm #FFC86B glow). Beyond the path: bright grass (#62A83F / #559838; shadow #1D491F), small grey stone blocks, cube bushes, ferns, flowers.
* **Trees:** voxel trees with cube-cluster canopies in three greens (#52A42C / #4A9B26 / #084617) and pixel-noise texture; dark trunks.
* **Water:** pond #439EC4; waterfall #44ADE5 with #75EFFE highlights and white foam.

## (c) Signage, boards and UI
* **Logo plate:**
  * "KEEP" in chunky orange-gold (#F1B23E, light #F4BA4C) with a dark outline. A steel-and-wood pickaxe leans off the P to the right.
  * "DIGGING!" in chunky white (#E2EBF9) with a navy outline (#283457) and a gold underlay.
  * Rounded display font with slight perspective. Lanterns flank the plate.
* **Gate:** dark blue-grey carved stone (#4F556F mid, #7990A1 light, #203155 dark) with mossy grass tops and a dark doorway with a warm glow inside. In game, the **Server Depth** display sits in this doorway.
* **Boards (both):**
  * Dark slate face (#181D2F / #252632) in a chunky wooden frame on two posts, angled toward the camera.
  * Title in bold white sans with a soft shadow.
  * Rows: gold rank "#1" (#F7C64B), white name, right-aligned white value with an "m" or "$" suffix.
  * The Finds board adds a small gem or crown icon per row. Ten rows each.
* **Beginner Obby sign:** a framed green panel with white text "Beginner Obby". Its platforms have bright green neon edges (#B2FEC9 highlight on #369C5F).
* **Pro Obby sign:** a dark purple arch panel (#342388, highlight #BA99EA) with white text "Pro Obby". Purple/blue neon platforms and a red-neon hazard tower (#DC635F bloom).
* **Artifacts sign:** a dark plaque on a timber post with white text "Artifacts".
* **No HUD in the image.** In-game UI must be extrapolated in the same chunky wood/stone + neon style (see ART_BIBLE).

## (d) Palette, lighting, atmosphere
| Element | Sampled hex |
|---|---|
| Sky | #A5D3F7 (light #B1D6FA) |
| Distant mountains | #75BCEA |
| Grass lit / mid / shadow | #62A83F / #559838 / #1D491F |
| Canopy light / mid / dark | #52A42C / #4A9B26 / #084617 |
| Dirt light / mid / dark | #BE6D34 / #8B4D27 / #5C2F1C |
| Cobble | #848182 / #685E5D / #4A4946 |
| Coal | #3A2931 / #261B24 / #19151F |
| Cavern | #5F5AAD / #354073 / #262E59, deep #15182B |
| Crystal cyan | #52F6FF / #10CAF6 / #0967CB |
| Crystal purple | #B34EFA / #7D2CE6 / #5A32C7 |
| Magma rock | #822936 / #501E34 |
| Lava | #E93F1E / #FE761D |
| Sand | #FDD99B / #FCD390 / #F7CE8B |
| Gate stone | #7990A1 / #4F556F / #203155 |
| Board face | #181D2F |
| Logo gold | #F1B23E |
| Logo white / outline | #E2EBF9 / #283457 |
| Portal | #A8FCFC core, #4F97F5 edge |
| Relic gold | #FBE574 |
| Neon green / purple / red | #B2FEC9 / #BA99EA / #DC635F |
| Wood (frames, fence) | #6E4A2A mid, #3E2A1C dark (frames are partly shadowed in the image) |

* **Lighting:** bright warm daylight from the upper left; soft, short shadows falling right and down. Low-contrast sky. Strong bloom on neon, crystals, lava, lanterns and the portal.
* **Atmosphere:** light blue haze on distant hills; saturated, cheerful, high-key colours.

## (e) Art style and material treatment
* Chunky voxel blocks (each block reads clearly at this distance) with soft bevelled edges catching highlights.
* Hand-painted textures with pixel-noise speckle inside each block face, darker edges and crevices, and warm highlights on top faces.
* Grass blocks have a green top with drips over brown sides. Stone and gate blocks show subtle cracks.
* Wood is chunky planks with visible grain. Signs use clean flat panels with neon or gold accents.
* Emissives (crystals, lava, neon, lanterns, portal) are fully saturated and bloom.

## (f) Unclear items and decisions
* **Real hole depth:** a painted image cheats perspective. The floor is visible only because the hole is wide relative to its depth. Decision: physical hole depth 72 studs, top radius 60 studs, 5 terraces (Config.Hole). Strata bands map piecewise to physical bands so marker and stratum always agree.
* **Text on the boards** is placeholder. The boards show real data: Top Diggers cycles This Hole and All Time; Finds shows the ten most valuable find types from the Catalog.
* **Stall content:** ambiguous goods. Decision: the Store kiosk, with a "STORE" hanging sign and tool racks.
* **Golden relic:** an atom-like gold cube with orbiting rings. Decision: the Community Dig Pool meter; ring speed and glow scale with the pool.
* **Gate doorway:** dark in the image. Decision: houses the Server Depth sign (depth, target, progress bar, strata icons).
* **Blue portal destination:** not shown. Decision: the Minigame Hub (Gem Rush, Cave-In).
* **Not in the image:** VIP Rim Lounge, Auto-Digger bays, dig stations, plaques, HUD, the deeper layers' props and the core. These are extrapolated in the same style; see DECISIONS.md.

## Build checklist
- [ ] Hero camera reproduces the framing (gate top centre, boards at the edges, hole low-centre).
- [ ] Hole proportions, terraces and strata order/colours match.
- [ ] Ladder down the far-right wall with lanterns.
- [ ] Fence ring with ~12 lantern posts and a sand path outside it.
- [ ] Gate + logo + Server Depth doorway sign.
- [ ] Beginner Obby (left, green neon, bridge over pond), Pro Obby (right, purple/blue neon, red tower).
- [ ] Market stall between gate and Pro Obby.
- [ ] Angled boards at both edges with real data.
- [ ] Artifacts hall: curved fence, hanging sign, six pedestals.
- [ ] Golden relic orb near the right board.
- [ ] Portal on a sandy plaza, bottom-right.
- [ ] Waterfall and pond on the left; voxel trees in three greens; bushes, ferns, flowers, stone blocks.
- [ ] Distant hills, floating cliffs, blue mountains, soft-cloud sky.
- [ ] Warm upper-left sun, bloom on emissives, light haze.
