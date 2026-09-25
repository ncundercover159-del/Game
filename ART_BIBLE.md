# SKYKART — Art Bible

This document is the visual source of truth. It was written from the attached
reference images (five creature references and four kart-racing gameplay
references). Where this text and those images disagree, **the images win**.

> **IP note.** The creature references are used for *silhouette, proportion,
> palette and attitude only*. Every racer ships with an original name and an
> original, primitive-built model. All names, figure recipes, palettes and audio
> live under `client/assets/` so the whole cast can be renamed, reskinned or
> swapped for licensed GLB models without touching code.

---

## 1. What the references tell us

### 1.1 Gameplay references (kart racing screenshots)

| Observation | Rule we adopt |
|---|---|
| Low chase camera; the kart sits in the lower-centre third, horizon at roughly 35–40 % from the top, wide FOV. The driver is seen from the back and slightly above. | Chase cam: 4.4 m behind, 1.9 m up, look-at 1.2 m above kart, FOV 68° (80° on boost). |
| Asphalt is dark grey with a fine grain, never pure black. A checkered start/finish strip and a dashed checkered centre line. | Road: `#3d3f45` → `#4a4c52` noise, white/black checker start line, dashed centre markings. |
| Verges are saturated grass green; kerbs are bold two-tone stripes; guard rails are chunky blue barriers with glowing neon trim at night. | Every track has a verge band, striped kerbs, chunky rails. Neon trim on night tracks. |
| Big readable landmarks: arches, gates, grandstands, lamp posts, hanging banners, lanterns, bunting, huge signs. | Each track places 3–6 hero landmarks (arches, towers, gates) on sight-lines through corners. |
| Item boxes are translucent, rainbow/pink rounded cubes with a big bold "?" inside, gently spinning and bobbing, placed in rows across the road. | Item box: rounded cube, iridescent pink→cyan shader, white "?" billboard inside, rows of 3–5. |
| Weather/ambience layers: falling snow, drifting leaves, confetti, fireworks. | Every track has an ambient particle layer matching its theme. |
| HUD: coin counter and lap counter in dark translucent rounded pills with bold italic white numerals and a chunky gold coin icon; a huge yellow→orange bevelled position numeral ("5th", "12th", "1st" in gold) with a thick dark outline; a large circular item slot with a small attached coin bubble; a translucent white track-outline minimap with circular character-head markers. | We copy this HUD language exactly (see §6), but move elements off the bottom corners where thumbs live. |

### 1.2 Creature references

Five creature references define the cast's style and five of its racers.
Common traits across all five, which define the house style for every racer:

- **Huge heads** (45–55 % of total figure height), stubby bodies, oversized
  hands/feet/claws.
- **Huge eyes** with a big coloured iris, a small pupil, and a hard white
  specular highlight. Heavy brows give attitude (smirks, scowls, manic grins).
- **Chunky secondary shapes**: horns, fins, tusks, collars, crests. They are
  big and simple enough to read as silhouettes at 40 px tall.
- **Glossy vinyl-toy finish** with painted detail (scale rows, belly plates),
  strong rim light, and a radial "energy burst" of the element colour behind
  them in promotional shots.
- **Attitude poses**: leaning forward, claws out, mouth open, weapon forward.

---

## 2. Global style rules

1. **Silhouette first.** Every racer must be identifiable from its black
   silhouette alone, from behind, at 60 px tall. Each has one "hero shape"
   (see table) that nobody else shares.
2. **Proportions.** Head ≈ 50 % of seated height. Eyes ≈ 35 % of head height.
   No part thinner than ~4 % of figure height (it disappears at speed).
3. **Toy material.** Characters and karts use one shared *vinyl* shader:
   3-band cel diffuse, a hard specular pip, a fresnel rim light tinted by the
   sky, and hemisphere ambient. Metal parts raise specular; glowing parts are
   unlit (emissive). Characters and karts get an inverted-hull outline,
   `#1a1426` at ~2.5 % thickness.
4. **Colour.** Saturated, high-value, few hues per racer (primary, secondary,
   accent, eye). Environment colours sit one step less saturated than racers so
   the racers always pop.
5. **Motion.** Everything squashes and stretches. Nothing starts or stops
   linearly: use springs and overshoot. Idle is never still (breathing,
   blinking, bobbing).
6. **Readability at speed.** Hazards are hot colours (red/orange/magenta) with
   motion; safe boosts are cyan/yellow chevrons; off-road is visibly different
   in colour *and* texture.
7. **Budget.** ≤ 6k triangles per racer, ≤ 3k per vehicle, one skinned
   draw call each (+ one outline call). Blob shadows by default.

---

## 3. Element palette

Every element has a UI/trail colour **and** a glyph, so colour is never the only
cue (colour-blind modes swap the colours; glyphs stay).

| Element | Colour | Glow / accent | Glyph | Trail on boost / drift |
|---|---|---|---|---|
| Fire | `#FF5A1F` | `#FFD23F` | flame | embers + heat sparks |
| Water | `#1E9BFF` | `#9FE3FF` | droplet | droplets + spray rings |
| Earth | `#B8793A` | `#E3C27A` | rock | pebbles + dust puffs |
| Air | `#7FE7F2` | `#FFFFFF` | swirl | gust streaks + tiny clouds |
| Life | `#4CCB3C` | `#C8F56A` | leaf | spinning leaves + petals |
| Undead | `#A8B0C8` | `#6CFFB0` | skull | ghost wisps |
| Tech | `#FFB319` | `#3DE0FF` | gear | electric sparks + bolts |
| Magic | `#A84CFF` | `#FF9BF5` | sparkle | sparkle stars |
| Light | `#FFE45C` | `#FFFFFF` | sun | light glints + rays |
| Dark | `#D33FBF` | `#2B1F4A` | moon | smoky shadow puffs |

Mini-turbo spark tiers are **global** and never recoloured by element (they are
gameplay information): **blue** `#3DB4FF` → **orange** `#FF8A1E` →
**purple** `#C05BFF`. The element trail plays *alongside* the sparks.

---

## 4. The roster (16 racers)

Size classes: **light** (fast accel, great handling, easily bumped),
**medium** (balanced), **heavy** (top speed, weight, slow accel).
★ = based directly on an attached reference image. ● = unlocked at start.

### 4.1 Reference-based racers

#### ★● DRAXO — Magic · medium
*Reference: the purple dragon on the purple burst.*
- **Silhouette / hero shape:** crown of two big back-swept horns plus a row of
  smaller head spikes; a pair of wings spread up behind the shoulders; tail
  ending in an arrow-blade.
- **Palette:** body `#6B3FA0`, scale shading `#4A2A78`, horns/crest/belly
  plates/wing membrane `#F2A93B` → `#E8892B`, claws `#F4F1E8`, iris `#A8322D`.
- **Face:** big red-brown eyes, heavy scowling brows, confident smirk with one
  tiny fang.
- **Signature pose:** chest out, one claw raised, wings flared, tail blade up.
- **Personality in animation:** cocky. Drifts with a head tilt, wing flare on
  boost, smug tail flick when in 1st.

#### ★● GILLBY — Water · medium
*Reference: the teal fish-man carrying a harpoon gun, splashing water.*
- **Silhouette / hero shape:** a fan of three fins on top of the head plus two
  ear fins, making a wide crown; bulky shoulders; the harpoon gun resting across
  the kart's nose.
- **Palette:** skin `#2FB5A8`, shading `#1E8078`, fin membrane `#7FE0D6`,
  belly `#A6E8D8`, iris `#FFC21A`, harpoon gunmetal `#3A3F4A`, tip `#D8DEE6`.
- **Face:** wide-set bulging yellow eyes with small pupils, broad frog-like mouth
  with a jutting lower lip.
- **Signature pose:** leaning over the harpoon, one eye squinting down the barrel.
- **Personality:** earnest, jumpy. Fins flap wildly when hit.

#### ★● GOBBLES — Magic · light
*Reference: the round blue creature with an enormous red tongue.*
- **Silhouette / hero shape:** a near-perfect ball with a comically long tongue
  flopping out; a red mohawk plume on top.
- **Palette:** body `#2F6FD6`, belly `#7FB2FF`, back spikes `#2A2F8F`,
  iris `#9BE22D`, tusks `#FFF7E6`, tongue `#E8394F`, mohawk `#E23A3A`.
- **Face:** two huge green eyes on top of the ball, two white tusks from the lower
  jaw, mouth always open.
- **Signature pose:** tongue out to full length, eyes wide.
- **Personality:** hungry, gleeful chaos. The tongue whips on every turn and
  licks the screen when it wins.

#### ★● BOLTZ — Tech · medium
*Reference: the green dragon in a blue mech helmet firing eye-lasers, with
blue-and-gold mechanical wings.*
- **Silhouette / hero shape:** boxy blue helmet with twin goggle lenses; big
  segmented mechanical wings raised high.
- **Palette:** scales `#5E8A2E`, belly `#C9772E`, armour `#2F66C7`, trim
  `#E8B53A`, lenses (glow) `#FFF6A8`, claws `#7A4A22`.
- **Face:** only the snout and toothy grin show under the helmet; the lenses glow.
- **Signature pose:** crouched low, wings up, lenses blazing.
- **Personality:** gadget-proud nerd. Lenses flash on item use; wings fold on drift.

#### ★● GRIMCHAIN — Undead · medium
*Reference: the golden-skulled ghoul with a red jester collar, black wisp body
and a spiked ball on a chain.*
- **Silhouette / hero shape:** jagged red collar with two drooping points; the body
  tapers into a wisp tail that becomes a chain with a spiked iron ball dragging
  behind the kart.
- **Palette:** skull `#E9C65A`, eye glow `#FF8A1A`, collar `#C2262E`, collar lining
  `#1A1A22`, wisp body `#22202A`, claws `#E0C070`, chain `#8C8F99`, ball `#3A3A44`.
- **Face:** one oversized glowing orange eye, a too-wide jagged grin.
- **Signature pose:** claws spread, grin wide, ball swinging.
- **Personality:** gleeful menace. Cackles (bark) on hits; the ball clanks on landings.

### 4.2 Original racers in the same style

| Racer | Element · size | Hero shape | Palette | Face & personality |
|---|---|---|---|---|
| ● **CINDER** | Fire · light | three teardrop flames for hair | body `#FF5A1F`, belly `#FFC34D`, flames `#FFD23F`/`#FF8A1E`, brows `#7A1E0A` | salamander imp; huge yellow eyes, buck-tooth grin; hyperactive, never stops bouncing |
| **MAGMO** | Fire · heavy | huge block fists, tiny head sunk in shoulders | basalt `#3B3036`, cracks (glow) `#FF7A1A`, crown `#FFB347` | lava golem; glowing slit eyes; slow, proud, earth-shaking landings |
| **TIDEPIP** | Water · light | big domed shell | shell `#2E9E6B`, plate lines `#F2D46B`, skin `#5BC8F0`, iris `#1B4DB8` | baby sea turtle with a water-spout curl on its head; shy, bubbly, cheers with flippers |
| ● **BOULDAR** | Earth · heavy | banded round armadillo shell with moss on top | shell `#9A6B3F`, bands `#C89A5E`, moss `#6FAF3A`, belly `#E8D2A6` | big snout, tiny eyes under a boulder brow; stubborn and grumpy |
| **DIGBY** | Earth · medium | mining helmet with a headlamp + giant digging claws | fur `#8A6E5A`, nose `#FF8FA3`, claws `#EFE3C8`, helmet `#FFC21A` | mole miner with goggles; squints at bright light, chuckles |
| **GUSTAV** | Air · medium | round owl ball with swirl ear-tufts | feathers `#DDEFFF`, shading `#A9CFF5`, beak `#FFB23F`, iris `#3FA9FF` | fluffy cloud owl; dramatic, spins its head 180° to look back |
| ● **SPROUT** | Life · light | two giant leaves on top of a bulb head | head `#7ED957`, body `#3FA34D`, petal collar `#FF7FB0`, iris `#6B3A1E` | plant sprite; sweet, waves at everyone, wilts when last |
| **GRUMBARK** | Life · heavy | tree-stump head with branch antlers | bark `#6B4A2E`, rings `#D9B98A`, moss `#5DAF3A`, eyes (glow) `#B6FF5A` | old ent; slow blink, creaky laugh |
| **WIDGET** | Tech · light | one big cyclops screen-eye + antenna bulb | chrome `#E9EEF3`, panels `#FF8A1E`, screen (glow) `#3DE0FF`, bulb `#FF3D6E` | tiny robot; screen shows emotions (^ ^, x x, > <) |
| **LUMI** | Light · light | long upright ears + floating halo ring | fur `#FFF4D6`, ear tips `#FFD35C`, halo (glow) `#FFE066`, iris `#6A5CFF` | star bunny; serene, sparkles when overtaking |
| **UMBRA** | Dark · medium | crescent-moon ears + smoky wisp tail | fur `#2A2240`, rim `#7A4CFF`, eyes (glow) `#E07BFF`, grin `#F5F0FF` | shadow panther; lazy half-lidded eyes, sharp grin |

### 4.3 Signature items

| Racer | Signature item | Behaviour |
|---|---|---|
| Draxo | **Swap Spell** | 2 s telegraph (both karts glow and a rune circle spins), then swaps positions with a random racer ahead. |
| Gillby | **Harpoon Hook** | fires a harpoon at the nearest racer ahead; on hit it reels Gillby forward (boost) and slows the target. |
| Gobbles | **Tongue Lash** | tongue shoots forward and steals the held item of the racer in front. |
| Boltz | **Turret Drone** | drone follows Boltz for 8 s, firing small bolts at racers ahead. |
| Grimchain | **Chain Flail** | spiked ball orbits the kart for 5 s, spinning out anyone it touches, blocking projectiles. |
| Cinder | **Flame Puff** | flamethrower puff; leaves burning patches on the track for 5 s. |
| Magmo | **Eruption** | ground-pound shockwave that spins out everyone within 9 m. |
| Tidepip | **Wave Surge** | wave pushes nearby karts sideways and gives Tidepip a small boost. |
| Bouldar | **Rolling Boulder** | giant boulder bowls down the track, flattening racers. |
| Digby | **Tunnel Dash** | burrows for 2.5 s: intangible to items and hazards, slight speed boost, pops up with a dust burst. |
| Gustav | **Tornado** | tornado travels down the track, lifts and spins the first racer it touches. |
| Sprout | **Vine Grapple** | vine yanks the racer ahead backwards and gives Sprout a tug forward. |
| Grumbark | **Root Barrier** | wall of thorny roots across the track behind him for 6 s. |
| Widget | **EMP Burst** | racers within 14 m drop their held items and lose boost. |
| Lumi | **Flash** | blinds all opponents' screens for 2.5 s (white-out, fades from centre). |
| Umbra | **Shadow Clone** | a shadow double rides alongside for 6 s, doubling Umbra's collision and absorbing one hit. |

---

## 5. Vehicles

- **Karts (12):** chunky toy cars with oversized wheels and big exhausts. Themed:
  elemental (Ember Roadster, Tide Runner, Stone Crusher, Gale Glider…), tech
  (Circuit Buggy, Piston Pro…), mystic (Hex Hauler, Rune Racer…).
- **Bikes / quads (8):** bikes lean hard into turns; quads are wide and bouncy.
- **Wheels (6)** and **gliders (4)** are separate customisation parts.
- Same vinyl shader, bold two-tone paint, thick outlines, big exhaust pipes that
  spit coloured flame on boost (mini-turbo tier colour, otherwise element colour).

---

## 6. HUD and UI

HUD language is copied from the gameplay references, adjusted so thumbs never
cover it:

| Element | Reference look | Placement on phone (landscape) |
|---|---|---|
| Item slot | large circle, dark rim, glossy inner, small coin bubble attached | top-left |
| Coins + lap | dark translucent rounded pills, bold italic white numerals, gold coin icon, checkered-flag icon | top-left, under the item slot |
| Position | huge bevelled numeral, yellow→orange gradient (gold for 1st), thick dark outline, small suffix | top-right |
| Minimap | translucent white track line, character-head markers in coloured rings | right edge, vertically centred |
| Timer / splits | small italic white numerals | top-centre |

- **Fonts:** *Lilita One* for numerals and titles, *Fredoka* for body text.
- **Shapes:** rounded rectangles (radius 18–24 px), 3–4 px dark outlines,
  element-coloured accents, drop shadows offset straight down.
- **Motion:** spring overshoot on every appear, position changes pop and wobble,
  buttons squash on press.
- **Tap targets:** ≥ 48 px, safe-area aware.

---

## 7. Tracks (per cup)

| Cup | Palette | Ground / verge | Landmarks | Ambient | Hazards |
|---|---|---|---|---|---|
| **Skyland** | sky blue `#8FD3FF`, cloud white, grass `#6CCB4A`, sandstone | grassy floating islands, cloud edges | windmills, rainbow arches, sky-ship masts | drifting cloud puffs, birds | wind gusts, glider gaps, cloud shortcuts |
| **Molten** | charcoal `#2E2328`, lava `#FF6A1A`, ember gold | basalt road, ash verges, lava off-road (void) | volcano cones, obsidian pillars, forge gates | floating embers, heat haze | geysers, rolling boulders, collapsing bridge |
| **Haunted** | night violet `#2B2346`, ghost green `#7CFFB2`, pumpkin orange | cobble road, dead grass, fog pools | crooked towers, gravestones, carousel | fog, fireflies, bats | ghost carousels, timed doors to shortcuts, fog banks |
| **Gearworks** | steel `#5A6272`, hazard yellow `#FFC21A`, copper | metal plate road, grated verges | cranes, smokestacks, giant gears | sparks, steam puffs | conveyor belts, crushers, laser gates, pistons |

Every track must have: a clear racing line, a signature moment (jump, drop,
waterfall, glide), at least one shortcut, and 3+ hero landmarks visible down
long straights.
