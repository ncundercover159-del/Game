# HAZARD PAY — visual rubric

**Version 1.0** · 2026-08-07 · owner: visual critic

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
* **R.E.P.O. contributes no images to this rubric.** Every attempt to fetch one was blocked by the
  network egress proxy. R.E.P.O.'s influence here is from written sources only, and is confined to
  criteria C5, C6 and C9, where it is labelled as such.
* Full sourcing, including the discounted low-quality sources, is in `refs/MANIFEST.md`.

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
cd <scratchpad> && node hz.js        # hz-spawn/floor/racking/pit/dock.png
cd <scratchpad> && node hz-fig.js    # hz-fig-5m/10m/20m.png, for C7
```

Numeric criteria are measured with `imgstat.js` and `imgstat2.js` in the scratchpad. Both crop away
HUD furniture (top 26%, bottom 7%) before measuring, so HUD text does not pollute the statistics.

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

---

## C1 — Lighting structure and indirect/bounce

**What is being tested:** whether the frame has a light *design* — a key, a fill, and a sense that
light has bounced — or whether it is a uniform wash with lamps stuck to the ceiling.

**Method.** Identify the brightest lit region and the darkest lit region *on the same material*
(e.g. two patches of floor). Compute their luma ratio. Then check whether any surface facing *away*
from every light source is lit by anything other than a constant.

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

---

## C5 — Tonal range and exposure discipline

**What is being tested:** where the frame sits on the histogram and whether it holds detail at both
ends. This is scored separately from post because a frame can have no post at all and still be
correctly exposed, and vice versa.

**Method.** `imgstat.js` reports p01/p05/p50/p95/p99 luma, `clip%` (L ≥ 250) and `crush%` (L ≤ 4).
`imgstat2.js` reports the mean RGB of the darkest 5% and its channel spread.

* **FAILS.** `crush%` above 8 (large regions are pure black voids with no detail — R.E.P.O. is
  described as very dark, but dark is not the same as *empty*, and detail must survive in the dark).
  Or `clip%` above 1. Or median luma above 150 on an interior frame — a washed-out, milky frame.
  Or the darkest 5% has a channel spread below 4, meaning blacks are dead neutral and ungraded.
* **ACCEPTABLE.** `crush%` between 2 and 8, `clip%` between 0.2 and 1, median luma between 45 and
  130. Blacks are close to neutral but not obviously so. Highlights roll off rather than snapping.
* **MATCHES.** `crush%` below 2 and `clip%` below 0.2 — *nothing* is pure black and *nothing* is
  pure white (PEAK's vista achieves 0.0 on both). Median luma between 55 and 110 on a working
  interior. The darkest 5% has a channel spread of 10 or more and a deliberate hue (PEAK: RGB
  35/32/58, a lifted blue-violet). The whole frame can live inside a 120-point band and still read
  as high contrast, because contrast is *local*, not endpoint-to-endpoint.

---

## C6 — Post chain: AO, bloom, grade, vignette

**What is being tested:** presence first, taste second. Given the R.E.P.O. finding, absence of post
is a bigger failure here than in a typical project.

**Method.** Four independent sub-checks. Score the criterion at the level of the *weakest* two.

**Vignette.** `imgstat2.js` reports corner ÷ centre mean luma over 12% boxes.
* FAILS: ratio ≥ 1.0 — corners as bright as or brighter than centre, actively pulling the eye off
  the subject.
* ACCEPTABLE: 0.86–0.99.
* MATCHES: 0.72–0.94 on gameplay frames (PEAK vista: 0.940); far lower is legitimate behind a
  full-screen UI panel (PEAK menu: 0.336).

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

**Camera-feed layer (R.E.P.O.-specific, written sources only).** Not required for a pass, but the
strongest single lever available to this project — see §2. Grain, chromatic aberration at the frame
edge, mild lens distortion, and a resolution/pixelation step, all player-toggleable. Judge as
MATCHES only if the effects are *subtle enough to survive a still* and the settings to disable them
exist.

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
