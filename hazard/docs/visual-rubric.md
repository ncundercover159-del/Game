# HAZARD PAY — visual rubric

**Version 1.2** · amended 2026-08-17 · owner: visual critic
**v1.1** 2026-08-08, addendum to §4 on 2026-08-09. **v1.0** 2026-08-07.
See "§3 — Amendments" at the foot for the change list. v1.1 changed thresholds on C1, C4, C5 and C6,
so grades against v1.0 and v1.1 are **not** directly comparable on those four criteria. v1.2 adds
**C10** and **§5** and changes no existing threshold, so C1–C9 remain comparable across v1.1 and
v1.2.

A screenshot-gradeable standard for the look of HAZARD PAY, calibrated against R.E.P.O. and PEAK.
Every criterion below has a stated measurement method and numeric thresholds, so that two agents
grading the same PNG arrive at the same score. Where a criterion cannot be reduced to a number, the
checklist is explicit about what counts as a pass and the score is capped accordingly.

---

## 0. Provenance and honesty

Read this before quoting any threshold as "matching the reference".

* **Neither R.E.P.O. nor PEAK was installed, run, or played.** They are commercial Unity titles on
  Steam; this is a headless Linux container. No side-by-side capture was performed and none is
  possible here. Any document claiming one is fabricated.
* **PEAK numbers in this rubric are measured from four real screenshot files** held in
  `refs/peak/`. They carry shipped build stamps (`v1.60.b`, `v1.60.d`) and the shipped HUD, so their
  authenticity is high-confidence, but their originating URLs were not recorded and all four are
  from **one lighting condition** (a dusk exterior) plus one interior menu. Thresholds derived from
  them are therefore calibrated on a narrow sample. Treat them as a floor, not gospel.
* **R.E.P.O. now contributes seven real images** (v1.1, 2026-08-08). `refs/repo/fovupdate-*.jpg`,
  pulled from `raw.githubusercontent.com/darmuh/FovUpdate/master/Screenshots/` — a R.E.P.O. FOV mod
  whose author committed gameplay captures into the repo instead of hotlinking them, which is the
  only image route the egress policy leaves open. They carry R.E.P.O.'s shipped HUD, so authenticity
  is high. **But they are JPEG, the FOV is modded, and the graphics settings are one player's**, so
  no texture threshold may be derived from them and no composition claim may rest on them. Details
  and the full caveat list are in `refs/MANIFEST.md`.
* Full sourcing, including the discounted low-quality sources, is in `refs/MANIFEST.md`.

### The two references disagree, and the rubric must say which one applies

PEAK is a bright outdoor climbing game. R.E.P.O. is a near-black interior horror game. Measured side
by side they disagree by an order of magnitude on exposure and by 7× on shadow tint. A single band
covering both would be so wide it asserted nothing. **HAZARD PAY is a lit industrial interior and
sits between them**, so from v1.1 the exposure and post criteria carry two columns and the grader
picks by scene type. Where both references agree — colour discipline, chroma coverage, nothing
clipping — the band is narrow and binding.

### The one thing R.E.P.O. tells us that changes the brief

R.E.P.O. ships **Motion Blur, Lens Distortion, Bloom, Chromatic Aberration, Grain, Glitch Loop and
Pixelation** as individual player-facing graphics settings, plus a separate gameplay **Camera Noise**
amount. A studio does not expose that particular seven unless the intended default is a *degraded
camera feed* rather than a clean render — and multiple sources confirm the pixelation is deliberate,
with the setting existing so players can dial it *back*.

The consequence for HAZARD PAY is direct: **the target is not a clean render.** A frame that is
sharp, evenly lit and free of artefacts is not closer to the reference, it is further from it. Post
is not polish to be added at the end; it is a load-bearing part of the look.

---

## 1. How to grade

Capture with the existing harness so the framing is comparable run to run:

```
cd /home/user/Game/hazard/client && npx vite build
cd <scratchpad> && HZ_PORT=<pick one> node hz.js        # hz-spawn/floor/racking/pit/dock.png
cd <scratchpad> && HZ_PORT=<pick one> node hz-fig2.js   # hzf-idle/walk/haul/down/head/lineup, for C7
cd <scratchpad> && HZ_PORT=<pick one> node hz-water.js  # hzw-t000/t130/t280/t370/under, flooded plant
```

Pick a distinct `HZ_PORT` per run; several agents run these at once. `hz-fig.js` (the v1.0 figure
harness) is superseded by `hz-fig2.js`, which shoots through the post chain — the older one called
`renderer.render()` directly and produced captures with no AO, bloom, grade, vignette or CA in them.
Do not grade C2 or C6 from `hz-fig-*.png`.

Numeric criteria are measured with `imgstat.js` and `imgstat2.js` in the scratchpad. Both crop away
HUD furniture (top 26%, bottom 7%) before measuring, so HUD text does not pollute the statistics.
`crit3-stat.js` / `crit3-stat2.js` are the same tools with JPEG decoding added, for the reference
files. `crit3-probe.js` adds three targeted probes the whole-frame statistics cannot do:
`region` (is the bright part of a frame tinted like the light or like the surface?), `contact`
(near ÷ far floor luma around a point, for C2) and `texscale` (contrast-normalised texture, for C4).

Grade every criterion on every gameplay frame, then take the **worst** frame's score, not the mean.
A game is judged by its bad angles.

Letter bands: **F** = fails as defined. **D–C** = acceptable band, lower and upper. **B–A** =
matches the references. A criterion may only score A if its numeric test passes *and* the visual
checklist passes; the numbers exist to stop wishful grading, not to replace looking.

### Reference values measured for this rubric

| Metric | PEAK vista | PEAK interior menu | What it means |
|---|---|---|---|
| Median luma (p50) | 70 | 82 | Frames sit low-mid, not bright |
| p95 / p99 luma | 97 / 150 | 189 / 255 | Highlights are rare and contained |
| Clipped pixels (L ≥ 250) | 0.0% | 1.3% | Almost nothing blows out |
| Crushed pixels (L ≤ 4) | 0.0% | 0.4% | **Nothing is pure black** |
| Darkest-5% mean RGB | 35, 32, 58 | 8, 14, 18 | Blacks are lifted and tinted |
| Shadow channel spread | 26.3 | 10.1 | Shadows carry a hue |
| Mean saturation | 0.392 | 0.672 | Everything has chroma |
| Pixels with S > 0.15 | 98.9% | 93.1% | Almost no dead grey |
| Dominant hue share | 26.3% | 45.5% | Dominant, not monopolist |
| Hue families (>3% each) | 7 | 3 | Accents exist |
| Flat pixels (local SD < 2) | 63.1% | 77.9% | |
| Textured pixels (SD 2–25) | 36.1% | 11.0% | **Surfaces carry detail** |
| Vignette (corner ÷ centre) | 0.940 | 0.336 | Edges darker than centre |

The two most transferable findings: **PEAK crushes nothing to black and tints what shadow it has**,
and **a third of the vista frame carries surface texture**.

### R.E.P.O. reference values, measured for v1.1

Seven files, `refs/repo/fovupdate-*.jpg`, HUD-cropped, same tooling. Read the caveats in
`refs/MANIFEST.md` before quoting any of it.

| Metric | R.E.P.O. (n=7) | PEAK vista | The disagreement |
|---|---|---|---|
| Median luma | **7.1 – 11.7** | 70.5 | 8× |
| p95 / p99 luma | 14–104 / 30–112 | 97 / 150 | |
| p01 luma | 3.5 – 4.0 | 33.5 | Both keep a floor above zero |
| Crushed (L ≤ 4) | 1.2 – 3.7% | 0.0% | Both effectively nothing |
| Clipped (L ≥ 250) | 0.0% on all seven | 0.0% | **Total agreement** |
| Darkest-5% RGB | [2,3,3] – [4,4,7] | [35,32,58] | |
| Shadow channel spread | 1.6 – 3.9 | 26.3 | 7× |
| Mean saturation | 0.39 – 0.54 | 0.392 | **Agreement** |
| Pixels with S > 0.15 | 90.0 – 99.4% | 98.9% | **Agreement** |
| Dominant hue share | 19.0 – 31.2% | 26.3% | **Agreement** |
| Hue families (> 3%) | 5 – 10 | 7 | **Agreement** |
| Vignette (corner ÷ centre) | 0.27 – 0.78 | 0.940 | |
| Bloom halo radius | 12 – 96 px @1080p | 8 px | |
| Key : fill, same material | 3.2:1 lit vs shaded, **11.6:1** lit vs unlit | — | |

The single most useful line in that table is the **key-to-fill**. In `example1`, one stone wall
measures RGB 74/65/32 under a sconce, 19/21/18 three metres along the same wall, and 6/5/9 across
the room. Warm key, neutral mid, cool fill, and an eleven-to-one range on one material. That is what
"the lighting is designed" looks like as a number, and it is the number a flat build fails hardest.

**What the two references agree on is as informative as where they differ.** Neither clips. Both put
90%+ of pixels above S = 0.15. Both hold the dominant hue under a third with five or more families.
Those four are therefore hard requirements in v1.1, not bands.

---

## C1 — Lighting structure and indirect/bounce

**What is being tested:** whether the frame has a light *design* — a key, a fill, and a sense that
light has bounced — or whether it is a uniform wash with lamps stuck to the ceiling.

**Method.** Identify the brightest lit region and the darkest lit region *on the same material*
(e.g. two patches of floor). Compute their luma ratio. Then check whether any surface facing *away*
from every light source is lit by anything other than a constant.

**v1.1 — neither sample may be inside a cast shadow.** Comparing open floor against shadowed floor
measures the shadow map, not the light design, and it will report a completely flat room as passing.
This is not hypothetical: the pass-2 grade of this project scored 2.1:1 that way and graded C1 at
B−; re-measured correctly on two unshadowed patches of the same floor, the same build gives
**1.1–1.3:1** and fails. Take both samples from surfaces that no object occludes, at different
distances from the nearest lamp.

**v1.1 reference values.** R.E.P.O. `example1`, one stone wall: **3.2:1** between the sconce pool
and the same wall three metres away, **11.6:1** between the sconce pool and the far side of the
room, and the hue rotates warm → neutral → cool across that range (74/65/32 → 19/21/18 → 6/5/9).

* **FAILS.** Key-to-fill ratio on one material below 2:1 — the room is a wash. Or: surfaces facing
  away from all lights are lit by a single flat term with no directional or colour variation, so
  every wall reads as the same wall. Or: light pools appear on the emitter's own surface (the
  ceiling) but not on the surface they should be illuminating (the floor).
* **ACCEPTABLE.** Key-to-fill between 2:1 and 5:1. A hemisphere or gradient ambient gives up-facing
  and down-facing surfaces different values. Lamps produce visible pools on the floor beneath them.
  No true indirect, but the fake reads as directional.
* **MATCHES.** Key-to-fill between 4:1 and 12:1 with detail retained at both ends. Ambient is
  *directional and coloured* — cool from above, warm from the floor, or vice versa — and light
  visibly picks up the colour of large nearby surfaces (a red wall tints the floor beside it). At
  least one bounce cue per frame that a viewer would notice if removed.

---

## C2 — Contact shadows and grounding

**What is being tested:** the single fastest tell of an unfinished 3D build. Do objects sit on the
floor, or float above it like decals?

**Method.** Pick every object in frame that rests on a surface, up to six. For each, sample the mean
luma of floor pixels within roughly 0.2 object-widths of the contact line, and the mean luma of
floor pixels 1.5–2.5 object-widths away. Compute `near ÷ far`. Score is driven by how many objects
show grounding.

* **FAILS.** `near ÷ far` above 0.95 for the majority of objects — no darkening at contact at all.
  Objects read as painted onto the floor. **This is an automatic F for the frame regardless of the
  ratio if no object in frame casts any shadow whatsoever.**
* **ACCEPTABLE.** `near ÷ far` between 0.75 and 0.92 for most objects; contact darkening exists but
  is soft, uniform, and does not change with object shape — i.e. a blob shadow or an AO term rather
  than a real cast shadow. Standing figures are grounded; small props may not be.
* **MATCHES.** `near ÷ far` at or below 0.75 within 0.3 object-widths, tightening to below 0.55 at
  the contact line itself. Shadow shape follows object shape and light direction. Small props
  (anything hand-sized) are grounded too — this is where builds usually give up, and it is exactly
  the class of object HAZARD PAY's gameplay is about.

**Note on cost.** Full shadow maps on every point light is the expensive answer and usually the
wrong one in a browser. A single downward blob or a screen-space contact-shadow ray march buys most
of the perceptual win. The criterion tests the *result*, not the technique.

---

## C3 — Material variety per frame

**What is being tested:** whether surfaces differ in how they respond to light, or only in albedo
colour. Ten differently-coloured lambert boxes are one material, not ten.

**Method.** Count *response classes* visible in frame: (a) matte/diffuse, (b) semi-gloss with a
broad highlight, (c) sharp specular or metallic with a tight highlight or a reflected environment,
(d) emissive, (e) transmissive. Then count how many distinct surfaces show an actual specular
highlight.

* **FAILS.** Fewer than two response classes. Zero specular highlights anywhere in frame — every
  surface is pure lambert, so roughness and metalness values are being set in code but not read on
  screen. Distinguishing one material from another relies entirely on hue.
* **ACCEPTABLE.** Three response classes present, with at least three surfaces showing a visible
  highlight. Metal reads as metal. Materials are still per-object-uniform — no wear, no edge
  variation, no dirt gradient.
* **MATCHES.** Four or more response classes with at least one emissive and one genuinely
  reflective surface per frame. Materials vary *within* a surface: edge wear lighter than faces,
  grime accumulating in the lower third of walls, scuffing along the floor's traffic lanes. Two
  objects of the same colour are still distinguishable by their light response alone.

---

## C4 — Texture presence

**What is being tested:** the classic jam-build tell. Flat untextured colour.

**Method.** `imgstat.js` reports `flat%` (pixels whose local 3×3 luma standard deviation is < 2) and
`tex%` (SD between 2 and 25). Measure over the HUD-free crop.

* **FAILS.** `tex%` below 12, or `flat%` above 80. Large areas — floors, walls — are unbroken
  gradients. A viewer cannot tell what any surface is made of with the colour removed.
* **ACCEPTABLE.** `tex%` between 12 and 25, `flat%` between 65 and 80. Surfaces carry some
  breakup — a noise pattern, a tiling grid, painted floor markings, panel seams — enough that
  material is guessable in greyscale, but detail does not survive a close approach.
* **MATCHES.** `tex%` at or above 25 with `flat%` at or below 70 (PEAK's vista: 36.1 / 63.1).
  Every major surface class carries detail at two scales: a fine grain readable at 1 m and a large
  pattern readable at 10 m. Floors carry human traces — bay markings, tyre scuffs, hatched hazard
  zones — that also serve navigation.

**Anti-gaming clause.** A full-screen grain or noise post pass will inflate `tex%` without texturing
anything. If `tex%` passes, the grader must confirm that the high-frequency detail is *attached to
surfaces* — it should be perspective-foreshortened on a receding floor and should differ between
material types. Uniform screen-space noise scores this criterion **F** regardless of the number.

**v1.1 — three limits on the metric, all of which were hit in practice.**

1. **`flat%` / `tex%` are exposure-dependent and must not be compared across frames of different
   brightness.** Local standard deviation is an absolute quantity: a surface whose whole content
   sits inside a 12-luma band cannot exceed SD 2 however relieved it is. R.E.P.O.'s reference frames
   measure `flat%` 80.7–97.4, which would rank them *smoother* than PEAK, and they are visibly
   nothing of the sort. Where frames differ in exposure, use the contrast-normalised form: mean
   local SD ÷ local mean. Reference values, `crit3-probe.js texscale`: **PEAK 0.043, R.E.P.O.
   0.066–0.073.** Below 0.035 is flat; 0.04–0.08 is the reference band.
2. **JPEG sources may not set a texture threshold.** Compression removes the exact signal being
   measured. PEAK's PNGs are the only sound texture reference this project holds.
3. **Feature size in pixels is not comparable across resolutions.** The references are 1920×1080 and
   the harness shoots 1280×720; multiply harness feature sizes by 1.5 before comparing, or state
   both and compare nothing.

**v1.1 — and the thing the numbers cannot see.** A frame can hit `tex%` 30, `flat%` 60 and a
correct feature size and still look like a jam build, because the *content* of the pattern is wrong.
Wandering closed loops read as biro doodles, not concrete. Uniform bright specks read as snow or
paint spatter. Fine sparkle on painted steel reads as glitter. If the grader cannot name the
material from the pattern alone — "that is worn concrete", "that is galvanised steel" — the
criterion is capped at **C** whatever the statistics say.

---

## C5 — Tonal range and exposure discipline

**What is being tested:** where the frame sits on the histogram and whether it holds detail at both
ends. This is scored separately from post because a frame can have no post at all and still be
correctly exposed, and vice versa.

**Method.** `imgstat.js` reports p01/p05/p50/p95/p99 luma, `clip%` (L ≥ 250) and `crush%` (L ≤ 4).
`imgstat2.js` reports the mean RGB of the darkest 5% and its channel spread.

**v1.1 — this criterion is now genre-conditioned, because the two references disagree by 8×.**
PEAK sits at median luma 70; R.E.P.O. sits at 7–12. A single band spanning both would pass anything.
HAZARD PAY is a lit industrial interior with working lamps, not a torch-lit horror map and not an
alpine vista, so it is graded against the **interior** column. The R.E.P.O. column is stated so that
anyone deliberately pushing the build darker knows what the target actually is, and so that "too
dark" is never asserted without saying too dark *for what*.

| | FAILS | ACCEPTABLE | MATCHES |
|---|---|---|---|
| **Median luma — lit interior** (this project) | > 150, or < 20 | 35–140 | **45–110** |
| Median luma — torch-lit horror (R.E.P.O.) | > 40 | 12–40 | **7–15** |
| Median luma — outdoor vista (PEAK) | — | — | 55–90 |

The rest of the criterion is **not** genre-conditioned. Both references agree on all of it:

* **FAILS.** `crush%` above 8 — large regions are pure black voids with no detail. Dark is not the
  same as *empty*, and R.E.P.O. proves the distinction: it is eight times darker than PEAK and still
  crushes only 1.2–3.7%, because its black point sits at p01 ≈ 3.5–4.0 rather than at zero. Or
  `clip%` above 1. Or the darkest 5% has a channel spread below 1.5 with a mean below 2, i.e. the
  black point is on the floor and untinted.
* **ACCEPTABLE.** `crush%` between 2 and 8, `clip%` between 0.2 and 1. Blacks are lifted off zero
  (p01 ≥ 3) whether or not they are tinted. Highlights roll off rather than snapping.
* **MATCHES.** `crush%` below 2 and `clip%` below 0.2 — *nothing* is pure black and *nothing* is
  pure white. Both references achieve `clip% = 0.0` on **every** frame measured, thirteen of
  thirteen; treat any clipping at all as a defect to be explained. p01 at or above 3.
  **Shadow tint is a preference, not a requirement**: PEAK lifts to [35,32,58] with spread 26.3,
  R.E.P.O. sits at [3,3,6] with spread 1.6–3.9, and both look deliberate. A spread of 10+ scores
  MATCHES; a spread under 4 also scores MATCHES *provided* p01 ≥ 3 and the frame's colour identity
  is carried somewhere else. What fails is a black point *on zero*, in either style.
  The whole frame can live inside a 40-point band and still read as high contrast, because contrast
  is *local*, not endpoint-to-endpoint — R.E.P.O. does exactly that with p50 = 9 and p99 = 77.

---

## C6 — Post chain: AO, bloom, grade, vignette

**What is being tested:** presence first, taste second. Given the R.E.P.O. finding, absence of post
is a bigger failure here than in a typical project.

**Method.** Four independent sub-checks. Score the criterion at the level of the *weakest* two.

**Vignette.** `imgstat2.js` reports corner ÷ centre mean luma over 12% boxes.
* FAILS: ratio ≥ 1.0 — corners as bright as or brighter than centre, actively pulling the eye off
  the subject.
* ACCEPTABLE: 0.86–0.99.
* MATCHES (**widened in v1.1**): **0.27–0.94**. PEAK's vista is 0.940 and R.E.P.O.'s seven frames
  run 0.27–0.78, so heavy vignetting is squarely within the reference space rather than an excess;
  far lower is also legitimate behind a full-screen UI panel (PEAK menu: 0.336).

**v1.1 — the metric is invalid when the frame's centre is genuinely dark.** Corner ÷ centre is a
proxy for a radial falloff and it measures subject matter instead whenever a dark object sits in the
middle: three frames of this project's own build return 2.2–3.2 with a visually present vignette.
**A ratio above 1.0 is only a failure if the centre of the frame is not itself dark content.** Check
by eye before scoring, and if the centre is dark, score the sub-check from the visual read alone and
say so.

**Ambient occlusion.** Sample luma at a wall–floor junction and 30 px along the floor from it.
* FAILS: ratio ≥ 0.95 — junctions and creases are as bright as open surfaces, so nothing has corners.
* ACCEPTABLE: 0.80–0.94, radius visually plausible.
* MATCHES: 0.62–0.85, with the darkening tight to the crease rather than a halo. Overdone AO —
  visible dark rings floating around object outlines, or ratio below 0.45 — scores **D**, not A; a
  dirty-looking frame is its own failure.

**Bloom.** Visual check, with a numeric aid that is unreliable on frames containing large soft
gradients and must not be used alone. Around a light source or a bright specular, does luma exceed
1.25× the local background out to 6–20 px, decaying smoothly?
* FAILS: no halo at all around emitters, or a halo so wide and strong the source loses its shape.
* ACCEPTABLE: present, roughly the right radius, slightly heavy.
* MATCHES: tight and threshold-gated, so only genuinely bright things bloom and mid-grey walls
  never do. Emitters keep a hard core inside the halo.

**Grade.** Covered numerically by C5's shadow-tint test; here, judge whether the frame has a
deliberate colour identity — a consistent split between warm lights and cool shadows, or a LUT-like
push — rather than being the raw output of the lighting.
* FAILS: neutral, ungraded, shadow channel spread below 4.
* ACCEPTABLE: a visible tint in one direction.
* MATCHES: a designed relationship between light and shadow hue that is consistent across every
  frame in the set.

**Camera-feed layer.** Not required for a pass, but the strongest single lever available to this
project — see §2. Grain, chromatic aberration at the frame edge, mild lens distortion, and a
resolution/pixelation step, all player-toggleable.

**v1.1 — now evidenced by image, and the correction goes against the previous grade.** The seven
R.E.P.O. captures show the camera-feed layer running *loud*: grain visible over every surface,
radial colour fringing plainly legible on the HUD glyphs, corner stretching from lens distortion,
and corners taken to near-black. v1.0 asked for effects "subtle enough to survive a still"; the
reference is not subtle, and pass 2 of this project's review docked chromatic aberration at 2.0–3.0
px of edge misregistration as "2–4× a tasteful value". **Against the reference that judgement was
wrong.** Revised band, measured as red/blue misregistration against green at the frame edge,
normalised to 720p:

* FAILS: 0 px — the layer is absent and the build is a clean render, which is the wrong target.
  Or above 6 px, at which point text and thin geometry become unreadable.
* ACCEPTABLE: 0.5–1.5 px, or above 4 px.
* MATCHES: **1.5–4 px at the edge with under 1 px at centre**, radial, applied over detail coarse
  enough that the fringe does not land on a high-frequency edge and speckle.

The one thing that does not change: the effect must be gated so it never lands on a dot-screen. CA
over texture finer than ~4 px produces rainbow noise rather than a lens, and that is a texture-scale
defect showing up in the post chain, not a post defect.

---

## C7 — Character silhouette readability at 10 m

**What is being tested:** can you tell at a glance that there is a person there, how many, which
one is your mate, and which way they are facing — from across a warehouse.

**Method.** Use `hz-fig-10m.png`. At 1280×720 with a 60° vertical FOV, a 1.8 m figure at 10 m
occupies roughly 120 px of frame height; anything much smaller means the FOV or the framing is
wrong. Sample the mean luma and mean hue of figure pixels, and of an annulus of background pixels
immediately surrounding the figure.

* **FAILS.** |Δ luma| between figure and immediate background below 20, *and* no strong hue
  separation — the figure disappears into whatever is behind it. Or the silhouette does not read as
  a person: no distinguishing head or headwear shape, limbs merged into the torso mass.
* **ACCEPTABLE.** |Δ luma| of 20–45, or a clear hue separation carrying the read. Humanoid
  silhouette is unambiguous. Facing direction is guessable. Two players in one frame are
  distinguishable by colour but not instantly.
* **MATCHES.** |Δ luma| above 45 *or* a hue separation of more than 90° at saturation above 0.4,
  and the separation holds against **every** background the level contains, not just one. Silhouette
  carries a designed distinguishing feature at its extremity — headwear, a shoulder shape, a carried
  tool. Facing direction is unambiguous at a glance. Per-player colour is legible at 20 m. A rim or
  edge cue holds the figure off dark backgrounds.

**On the R.E.P.O. comparison:** its player character is described in written sources as a robotic,
puppet-like figure with large eyes, player-colourable from the lobby. Big features on a simple body
is a silhouette-first design — the read at distance is head-shape plus colour, not facial detail.
That principle is the target; no image was available to grade against.

---

## C8 — Composition and depth separation

**What is being tested:** whether the frame is built in layers or is one flat slab of room.

**Method.** Divide the frame into foreground (within ~2 m), midground (the working space) and
background (far wall, beyond ~15 m). Compare mean luma and mean saturation of the three bands. Then
apply the checklist.

* **FAILS.** Fewer than three distinguishable depth bands. Mean luma of the far band within 10 of
  the near band, and saturation within 0.05 — the far wall is as present as the near floor, so the
  space has no air in it. Or the frame is dominated by a single unbroken plane covering more than
  40% of it (a bare floor, a bare wall) with nothing occluding. Or the foreground is a black,
  detail-free mass filling the lower frame.
* **ACCEPTABLE.** Three bands distinguishable, |Δ luma| of 12–25 between near and far, driven by
  fog or falloff. Something breaks the silhouette of the far wall. No single empty plane exceeds 35%
  of the frame.
* **MATCHES.** |Δ luma| above 25 or |Δ saturation| above 0.10 between near and far, so distance is
  legible instantly — PEAK carries essentially all of its depth this way, with near rock at value
  0.20–0.30 lifting to 0.55–0.65 and taking the sky's hue almost completely by the summit. Every
  gameplay frame has something in the near field to frame the shot: a racking upright, a doorway
  edge, a hanging cable. Sightlines are composed so the player's next objective sits in a clear
  midground pocket against a contrasting background.

---

## C9 — Colour discipline

**What is being tested:** whether the palette is designed. Note that "disciplined" does not mean
"desaturated" or "monochrome" — the PEAK measurements disprove that reading directly.

**Method.** `imgstat.js` reports mean saturation, the share of pixels above S = 0.15, the dominant
hue's share of chromatic pixels, and the number of hue families holding more than 3% each.

* **FAILS.** Dominant hue share above 50% with 3 or fewer hue families — a duotone with no accents.
  Or pixels above S = 0.15 below 50% — half the frame is dead grey. Or the opposite: no dominant at
  all, with five or more hue families each above 15%, i.e. confetti.
* **ACCEPTABLE.** Dominant hue share 30–50%, four or more hue families, mean saturation 0.20–0.60,
  and above 70% of pixels carrying some chroma. Accent colours exist and are smaller in area than
  the dominant.
* **MATCHES.** Dominant hue share 25–45% across 5 or more hue families, mean saturation 0.25–0.55,
  and above 85% of pixels carrying chroma (PEAK vista: 26.3% dominant, 7 families, 0.392 mean sat,
  98.9% chromatic). Accents are **small in area and high in chroma** — the discipline comes from
  restricting accent *area*, not from removing hues. Gameplay-critical colours (extraction zone,
  valuables, hazards) are reserved and appear nowhere decoratively.

**The lesson from the numbers.** PEAK's vista reads as a purple monochrome to the eye but measures
as seven hue families with only a 26% dominant. The perception of discipline is produced by
controlling *value and saturation*, and by keeping accents tiny, not by throwing hues away. A build
that chases the look by desaturating everything will land on grey mush and score **F** here.

---

## C10 — Playable legibility from a still (new in v1.2)

**Why this exists.** Nine criteria in, this rubric graded how the build *looks* and had no opinion
at all about whether a player could tell what to do. That was an omission, and it was raised as one:
for a first-person game the render is the entire user interface, so "the frame is well composed" and
"the frame tells you what the game wants" are different claims and only one of them was being made.
C10 makes the second one gradeable. It stays inside what a screenshot can actually prove — see §5
for the far larger set of things it cannot.

**What is being tested:** whether one gameplay frame, shown to someone who has never seen the game,
communicates the job.

**Method.** Take a gameplay frame at the standard capture settings. **Write the answers down before
checking them against the level data** — a grader who checks first will find the frame far more
legible than a player would. Five questions, in this order:

1. **What in frame is worth money?** Point at it.
2. **Where does it have to go?** Is the extraction volume identifiable as a destination rather than
   as set dressing, and does it look like it accepts goods?
3. **What in frame will hurt me, or break the valuable?** Drops, moving plant, live water, hazard
   zones.
4. **Where is onward?** The route out of this space.
5. **Which figure is me, and which is a team-mate?** Only scored on frames containing figures.

Score is the number answered correctly on the first attempt, and every wrong answer must be written
down with what the grader thought it was — a frame where the extraction volume was read as a
swimming pool is more useful evidence than the score.

* **FAILS.** Two or fewer correct. **Automatic fail, whatever the count, if the extraction volume
  reads as something other than a place goods go**, or if a valuable is indistinguishable from set
  dressing at the distance the player will first see it.
* **ACCEPTABLE.** Three or four correct. The extraction volume is identifiable once pointed out, the
  valuables read as valuables at midground distance, and hazard livery is used for hazards.
* **MATCHES.** All five correct from a frame the grader has not seen before, with the HUD cropped
  away. Valuables carry a reserved finish — specular, trim, a colour — that nothing decorative uses.
  The extraction volume reads as industrial equipment with a mouth, lit so the eye lands on it.
  Hazard livery appears on hazards **and nowhere else**. Light is doing navigational work: the route
  onward is the brightest continuous path in the frame, as it is in `refs/repo/fovupdate-example1.jpg`,
  where a lit wedge of floor runs from the camera to the far door through an otherwise near-black room.

**Relationship to the other criteria.** C10 overlaps C8 (composition) and C9 (reserved colours) on
purpose, and it is scored separately because a frame can pass both and still be unreadable: three
crisp depth bands and a disciplined palette will not tell you which of the forty props is the one
worth £900. Where C8 asks whether the frame is built in layers, C10 asks whether the layers are
carrying information.

---

## 2. What a browser Three.js build can and cannot match

An honest accounting, because effort spent on the wrong criterion is wasted.

### Cannot realistically match

* **Baked global illumination.** R.E.P.O. and PEAK are Unity builds and can ship lightmaps and
  light probes baked offline over hours. This project has no asset pipeline, no loader and no bake
  step. True multi-bounce GI is out. Chasing it — realtime GI, path-traced probes, heavy SSGI — will
  burn the entire budget for a result that still loses.
* **Authored PBR texture sets.** Albedo/normal/roughness/AO/height per material, made by an artist
  in Substance, is what carries most of the fidelity gap. With no loader and a procedural-only
  constraint, HAZARD PAY cannot match this. It can get a surprising distance with procedural
  patterns, but not to parity.
* **High-density geometry.** The current build renders 1,092 triangles. Unity builds here run
  several orders of magnitude more, with normal maps standing in for still more. Browser + Rapier
  physics on the CPU means the triangle budget stays modest.
* **Many shadow-casting lights.** Seven shadow-mapped point lights is seven cube renders per frame.
  Not viable.

### Can match, or come close enough that nobody counts pixels

* **Tonal range, exposure and grade (C5, C6-grade).** Entirely a shader and tonemapping decision.
  Costs one full-screen pass. There is *no* technical reason a browser build cannot match PEAK's
  histogram exactly. This is free parity.
* **Colour discipline (C9).** Costs nothing but decisions. Pure art direction.
* **Post chain (C6).** One well-built composite pass gives AO, bloom, vignette, grain, chromatic
  aberration and a LUT-style grade. This is the criterion where a browser build is nearest to
  parity, and — given the R.E.P.O. settings finding — also the one that most defines the target
  look. Best return in the document.
* **Contact shadows (C2).** A blob shadow or a short screen-space ray march delivers the
  perceptual result of grounding at a fraction of shadow-map cost. Near-total parity for very
  little.
* **Procedural texture (C4).** Canvas-generated noise, grids, stains and floor markings, uploaded
  once at boot, break up flat colour convincingly. Not parity with authored PBR, but it clears the
  jam-build tell completely, which is what the criterion actually measures.
* **Composition and silhouette (C7, C8).** Level layout, fog curve, FOV, palette assignment. All
  free, all decisions.
* **Fake indirect (C1).** Hemisphere ambient, a coloured floor-bounce term, a handful of cheap
  non-shadowing fill lights placed to imply bounce. Reads as GI at gameplay distance.

### Where the effort should go, in order of return per hour

1. **Post chain and grade** (C5, C6). One pass. Largest single visual delta available, and the
   R.E.P.O. reference says it *is* the look rather than a garnish.
2. **Contact shadows** (C2). Cheap, and removes the most damning tell.
3. **Procedural texture** (C4). Moderate effort, removes the second most damning tell.
4. **Colour and composition** (C8, C9). Free, needs taste rather than code.
5. **Material response variety** (C3). Moderate.
6. **Geometry density and authored detail.** Last. Lowest return, highest cost, and it is the one
   area where the gap cannot be closed anyway.

---

## 3. Amendments in v1.1 (2026-08-08)

Driven by acquiring seven real R.E.P.O. screenshots (`refs/repo/`, sourcing in `refs/MANIFEST.md`),
which replaced prose with measurement on the criteria R.E.P.O. was supposed to inform.

| Criterion | Change | Why |
|---|---|---|
| §0 | R.E.P.O. now contributes images; two-reference split declared | Seven real captures obtained |
| §1 | R.E.P.O. measured-values table added | |
| C1 | Neither key nor fill sample may sit in a cast shadow; reference 3.2:1 / 11.6:1 added | The old method scored a flat room at 2.1:1 by measuring a shadow |
| C4 | `flat%`/`tex%` declared exposure-dependent; contrast-normalised form added; JPEG and resolution barred from setting thresholds; new cap at **C** when the pattern does not name a material | The absolute-SD metric ranks R.E.P.O. as smoother than PEAK, which is false |
| C5 | Median-luma band now genre-conditioned (three columns); shadow tint downgraded from requirement to preference; `clip%` hardened | The references disagree 8× on exposure and 7× on shadow tint |
| C6 | Vignette MATCHES widened to 0.27–0.94; the corner÷centre metric declared invalid on dark-centred frames; camera-feed layer given a numeric CA band, and **the pass-2 verdict that CA was overdone is retracted** | R.E.P.O. runs the camera-feed layer loud |
| C2, C3, C7, C8, C9 | **Unchanged.** | Both references agree, or no image evidence was gained |

### Amendments in v1.2 (2026-08-17)

No threshold on C1–C9 moved, so pass 4 and pass 5 remain directly comparable on all nine.

| Change | Why |
|---|---|
| **C10 — Playable legibility from a still** added | Nine criteria graded how the build looks and none of them asked whether a frame tells the player what to do. For a first-person game the render is the interface; the omission was raised and it was a real one. |
| **§5 — What this rubric cannot see** added | The same question, answered honestly in the other direction: C10 closes only what a screenshot can close. §5 states, so it can be cited rather than re-argued, that this instrument is blind to frame rate, latency, animation in motion, and whether the game can be won — and sets the rule for quoting somebody else's play evidence. |

### What did *not* change, and should be trusted more than before

C9's numbers held up under a second independent reference. R.E.P.O. measures 19–31% dominant hue
across 5–10 families at mean saturation 0.39–0.54 with 90–99% of pixels chromatic; PEAK measures
26.3% / 7 / 0.392 / 98.9%. Two games with nothing else in common land inside the same narrow band.
**Colour discipline is the best-evidenced criterion in this document.** So is the requirement that
nothing clips: 13 reference frames, 13 zeroes.

---

## 4. On trusting the instrument (v1.1)

Added because the harness this rubric depends on was found to have been calibrated against a bug.

The first-person camera was aimed 180° away from the server's grab ray for the whole of the project's
life — a Three.js camera looks down its own −Z, so `rotateY(yaw)` points it at `(−sin, −cos)`, while
the level data and every server raycast use `(+sin, +cos)`. Every shot angle in the screenshot
harness had been chosen *by eye* against that. The harness therefore silently encoded the inversion,
framed every shot to compensate, and would have resisted the correction: fixing the camera moved
every named shot onto different geometry.

Three consequences for anyone grading with this rubric:

1. **A harness calibrated by eye inherits whatever was broken when it was calibrated.** Shot angles
   must be derived from level data — spawn points, objective volumes, named landmarks — not chosen
   until the picture looks right.
2. **Frame-to-frame deltas across a convention change are not deltas.** `hz-spawn` before and after
   the fix are different rooms. Say so rather than tabulating them as a regression.
3. **Every metric in this document is a proxy, and three of them have now been caught measuring
   something other than what they claim** — vignette measuring dark subject matter, `tex%` measuring
   exposure, key-to-fill measuring a cast shadow. Where a number and the picture disagree, **the
   picture wins and the number gets a caveat written next to it.** Never quote a threshold for a
   frame you have not looked at.

### Addendum, 2026-08-09 — the count is six, and one rule follows from it

Two more proxies have since been caught measuring something other than what they claim, both by the
grader who was relying on them:

4. **A ceiling luma sample that had spanned the HUD's quota readout**, reporting the grazing ceiling
   at 158.2 and "brighter than the floor" when it is 98.4 and darker. Wrong in *direction*, not
   merely in magnitude.
5. **A lit-floor-versus-shadowed-floor comparison placed by eye** on a full-size screenshot, which
   returned a "shadow" brighter than the "gap" beside it. The rectangles were simply not where the
   grader thought they were.

The rule that follows, and it is not optional: **look at the rectangle before quoting the number
that came out of it.** `crit4-crop.js` in the scratchpad exists for this — it crops a region,
magnifies it nearest-neighbour, writes it as a PNG, and prints the mean of exactly the pixels it
just wrote, so the sample and its statistic cannot disagree. A region-derived figure in a review
should either be accompanied by the crop it came from or not be there.

Corollary for whole-frame metrics, which are not exempt: a metric whose value depends on the frame's
exposure, on its subject matter, or on where the HUD sits cannot be compared across frames that
differ in those things. Vignette (`corner ÷ centre`), absolute-SD `tex%`, and any whole-frame colour
cast on a level whose art direction is a single dominant hue are all in this class. Print them,
caveat them, and score them only where the confound is absent.

6. **The bloom-halo probe searches the whole frame for its brightest pixel.** On the R.E.P.O.
   captures that pixel is the HUD's green `+100`, not a light fixture, so the "12–96 px @1080p"
   figure in the R.E.P.O. table above is at least partly measuring HUD glow. **Do not grade bloom
   against that row.** Grade it against the picture: does the emitter keep a recognisable shape and
   a colour other than white inside its own glow, and does the surface behind it keep its texture?
   `crit4/zoom-sconce.png` — a 3× crop of a sconce in `fovupdate-example1.jpg` — is the reference
   for that judgement. The probe should be given an explicit region before its numbers are used
   again.

---

## 5. What this rubric cannot see (new in v1.2)

Written because I was asked, directly, whether this document has anything to say about whether
HAZARD PAY *plays* as well as it looks. The honest answer is that it did not, and that C10 closes
only the narrow part of the gap a screenshot can close. The rest of the gap is stated here so that
nobody reads a grade in this document as a verdict on the game.

**This is a stills rubric graded by an agent that has never played the build.** Every number and
every letter in `visual-review.md` comes from PNG files produced by a headless harness under
software GL. That instrument is blind to, and no grade in this document is evidence about:

* **Frame rate and frame pacing.** Every capture runs at 10–46 fps under SwiftShader. That figure is
  meaningless about real hardware and must never be quoted as performance.
* **Input latency, aim feel, movement weight.** Not visible in a still. The camera-versus-grab-ray
  inversion described in §4 was invisible to nine criteria for the whole life of the project and was
  found by a test that spanned two subsystems, not by looking at pictures.
* **Animation in motion.** C7 grades a silhouette in a frozen frame. Whether the waddle reads as a
  waddle, whether the ragdoll settles or jitters, whether interpolation is running at all — a still
  cannot tell you. Remote figures were frozen solid in every capture for several passes and the
  frames looked no different.
* **Whether the game can be won.** Whether a valuable can be picked up, whether two players can join
  a lift, whether the quota is reachable, whether a level soft-locks. A frame of a piano says
  nothing about whether the piano can be lifted; for a long time it could not be, by anyone, and
  the screenshots were unaffected.
* **Audio, haptics, netcode, and everything a second player would notice.**

**The rule that follows.** A visual reviewer must not infer play quality from a good-looking frame,
and must not infer visual quality from a passing gameplay test. When play evidence is relevant to a
visual finding — a bot run, a smoke test, a harness assertion — it may be **quoted, with attribution
to whoever ran it**, and must be labelled as second-hand. It may never be presented as something the
reviewer observed. The instrument that grades play is a bot harness with assertions about outcomes,
and it belongs in a different document with a different owner.
