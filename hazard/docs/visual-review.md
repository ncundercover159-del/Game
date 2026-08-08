# HAZARD PAY — visual review

**Date:** 2026-08-07 (captures taken 21:52–21:56 UTC)
**Graded against:** `docs/visual-rubric.md` **v1.0**
**Build graded:** working tree at commit `8fd60a8`, client bundle `index-8CaM3rMn.js` (2,112.25 kB)
**Renderer:** SwiftShader software GL, 1280×720. FPS figures here are meaningless; nothing else is.

## Overall: **F**

A competent, well-commented physics blockout with the lighting *intent* correct in the level data
and effectively **zero art execution shipped**. Six of nine criteria are outright failures, and the
three that are not are held up by level design rather than by rendering. This does not currently
read as a game in the R.E.P.O./PEAK space; it reads as a greybox with the lights left on.

The headline: `client/src/art/post.js` is still the no-op passthrough, and
`client/src/art/textures.js` — 17.8 kB of work, modified minutes before this capture — **is imported
by nothing**. I rebuilt and the bundle hash did not change, which is how I know none of it is live.
The art pass has written code but has not connected it.

---

## Honesty statement

I did not run, install or play R.E.P.O. or PEAK. They are commercial Unity titles on Steam and this
is a headless Linux container. **No side-by-side comparison was performed and none is possible
here.** Anyone using this document as a release gate should know exactly what it is and is not.

* **PEAK:** graded against four genuine screenshot files in `refs/peak/`, carrying shipped build
  stamps and HUD. Real evidence, but a narrow sample — one dusk exterior plus one interior menu.
* **R.E.P.O.: no image was obtained. The `refs/repo/` directory is empty and remained empty.**
  Every fetch attempt was refused by the network egress proxy — `store.steampowered.com`,
  `steamcommunity.com`, the Steam CDNs, Wikipedia, Fandom, `landfall.se`, `thunderstore.io`,
  YouTube thumbnails, all `EGRESS_BLOCKED` or 403 at CONNECT. Only `WebSearch` functioned, and it
  returns text, not pictures. R.E.P.O.'s contribution to this grade is **written description only**,
  and is flagged as such wherever it appears.

Sources, including the low-quality ones I discarded, are in `refs/MANIFEST.md`.

---

## Method

```
cd /home/user/Game/hazard/client && npx vite build
cd <scratchpad> && node hz.js       # hz-spawn/floor/racking/pit/dock.png
cd <scratchpad> && node hz-fig.js   # hz-fig-5m/10m/20m.png — C7 needs a body in frame,
                                    # and the normal harness is first-person
```

Numbers from `imgstat.js` (HUD-cropped), `imgstat2.js` and `figstat.js` in the scratchpad. Worst
frame scores, per rubric §1.

### Measured, this build vs the PEAK reference

| Metric | Rubric target | hz-spawn | hz-floor | hz-racking | hz-pit | hz-dock | **PEAK vista** |
|---|---|---|---|---|---|---|---|
| Median luma | 55–110 | **181.6** | **173.5** | 62.5 | **179.1** | 129.1 | 70.5 |
| p99 luma | — | 233.0 | 239.5 | 234.2 | 234.4 | 216.4 | 150.1 |
| Crushed (L≤4) | < 2% | 0.0% | 3.2% | **19.9%** | 3.9% | 4.7% | 0.0% |
| Clipped (L≥250) | < 0.2% | 0.0% | 0.4% | 0.0% | 0.0% | 0.0% | 0.0% |
| Mean saturation | 0.25–0.55 | 0.193 | 0.214 | 0.435 | **0.185** | 0.258 | 0.392 |
| Chromatic pixels | > 85% | 62.3% | 54.4% | 91.9% | **41.2%** | 67.2% | 98.9% |
| Dominant hue share | 25–45% | **55.9%** | 39.8% | 52.8% | 40.5% | 52.5% | 26.3% |
| Hue families | ≥ 5 | **2** | **4** | 6 | **4** | **3** | 7 |
| Flat pixels (SD<2) | ≤ 70% | **97.1%** | **93.8%** | **86.7%** | **95.8%** | **84.8%** | 63.1% |
| Textured (SD 2–25) | ≥ 25% | **2.2%** | **4.4%** | **10.7%** | **2.2%** | **11.6%** | 36.1% |
| Vignette corner÷centre | 0.72–0.94 | n/a¹ | — | **2.104** | — | **1.369** | 0.940 |
| Shadow tint spread | ≥ 10 | n/a¹ | — | **1.6** | — | **0.6** | 26.3 |

Bold = fails the rubric threshold.

¹ `imgstat2` does not crop the HUD, so on the near-empty `hz-spawn` frame its vignette (0.609) and
shadow-tint (spread 24.2) readings are measuring the dark HUD banner, not the scene. Discarded
rather than quoted — they would flatter the build for the wrong reason.

---

## Criterion by criterion

### C1 — Lighting structure and indirect/bounce — **F**

The lamps light the *ceiling*, not the floor. In `hz-racking` and `hz-dock` there are handsome warm
pools on the ceiling directly above each fixture while the floor beneath is a uniform beige wash —
which is precisely the named failure condition in the rubric. Physically it is correct: point lights
at y=8.4 in a 9 m room are a metre from the ceiling and eight from the floor, so inverse-square does
the rest. Artistically it is backwards; the floor is where the game happens. There is a
`HemisphereLight` giving up- and down-facing surfaces different values, which is the one thing
keeping this off the floor of the scale, and no bounce cue of any kind.

### C2 — Contact shadows and grounding — **F** (automatic)

**Nothing in any frame casts a shadow.** Not the racking, not the mezzanine, not the van, not a
single prop, not the contractor. The cause is precise: `worldview.js:92` constructs every lamp as a
`PointLight` and never sets `castShadow`. The only shadow-casting light in the scene is the
exterior `DirectionalLight` (`worldview.js:74`), which the warehouse roof occludes completely. So
shadow mapping is enabled in `main.js:36`, every mesh is flagged `castShadow`/`receiveShadow`, and
the result is zero shadows.

Measured under the contractor, floor luma near ÷ far: **1.110 at 5 m, 1.373 at 10 m, 1.071 at 20 m.**
Not merely absent — *inverted*. The floor directly beneath the figure is up to 37% **brighter** than
the floor beside it, because the pit's green fill light shines under it unobstructed. Objects do not
float; they hover over a faint glow. The small props read as confetti stickers painted on the
concrete.

This is the single most damning tell in the build.

### C3 — Material variety per frame — **F**

One response class: matte. There is not a single specular highlight anywhere in any of the eight
frames. `materials.js` sets `metalness` 0.55–0.75 on `deckplate`, `grate`, `steelblue` and `metal`,
and it is all wasted — **there is no `scene.environment` anywhere in the project** (no PMREM, no env
map; confirmed by grep across `worldview.js`, `main.js` and `art/*`). A metallic material with
nothing to reflect has no diffuse term and nothing to mirror, so it renders as flat dead colour. The
roughness values are equally inert. Materials are distinguished by hue alone, which is the criterion's
definition of failure.

### C4 — Texture presence — **F**

The classic jam-build tell, at full strength. `tex%` between **2.2 and 11.6** against a 25% target;
`flat%` between **84.8 and 97.1** against a 70% ceiling. `hz-spawn` is 97.1% flat — a literally
featureless frame. Every surface is untextured colour plus a shading gradient. The per-brush vertex
tonal jitter in `buildStatic()` is a nice thought and is doing almost nothing at these numbers.

`art/textures.js` exists and is substantial. It is imported by nothing. Wiring it in is the whole fix.

### C5 — Tonal range and exposure discipline — **F**

Failing at both ends simultaneously, which takes some doing.

* Three of five frames sit at median luma **173–182** — milky, washed-out, no black point. `hz-pit`
  and `hz-floor` have a blown white hotspot on the ceiling with no roll-off.
* `hz-racking` goes the other way: **19.9% of the frame is pure black**, against an 8% fail
  threshold. Not dark — *empty*. R.E.P.O. is described in every written source as very dark, but
  dark with detail is a different thing from 20% of the image at RGB zero.
* Shadow channel spread **0.6–1.6** against a ≥10 target. The blacks are dead neutral and
  completely ungraded. PEAK's darkest 5% sits at RGB 35/32/58 — lifted *and* blue-violet. This
  build's is RGB 2/1/0.

The frames both clip and crush. PEAK's vista does neither: 0.0% and 0.0%, with the entire image
living between luma 33 and 150 and still reading as high contrast, because its contrast is local.

### C6 — Post chain — **F**

`art/post.js` returns `{ render() { renderer.render(scene, camera); } }`. There is no post chain. No
AO, no bloom, no grade, no vignette.

Worse than absent on vignette: corner ÷ centre measures **2.104** on `hz-racking` and **1.369** on
`hz-dock`. An *inverse* vignette — the corners are twice as bright as the centre, actively dragging
the eye off the subject and out of the frame.

Per the R.E.P.O. finding in the rubric (§0), this is not a missing garnish. R.E.P.O. ships Motion
Blur, Lens Distortion, Bloom, Chromatic Aberration, Grain, Glitch Loop and Pixelation as individual
player toggles plus a Camera Noise amount — a set nobody exposes unless the intended default is a
degraded camera feed. The post chain *is* the reference look. Shipping without one is not "clean";
it is off-target.

### C7 — Character silhouette readability at 10 m — **C**

The best-performing criterion, and the only one carried by deliberate design. The contractor is a
box figure with a hard hat and brim, and it reads unambiguously as a person at 10 m: head, hat,
arms, legs, facing direction all legible. `figure.js` spreads eight player hues deliberately far
apart. Credit where due.

Measured figure-vs-background ΔL: **161.7 at 5 m, 108.3 at 10 m, 58.0 at 20 m** — comfortably past
the 45 threshold. But it cannot score higher than C, for two reasons the rubric requires:

1. **The separation does not hold against every background.** Those deltas are against the dark navy
   platform. The figure renders as near-white cream — the hi-viz torso (`0xf2c53d`) is washed out to
   pale by the exposure — and the level has large pale beige/white floor areas at luma 180–210 where
   ΔL collapses to near zero. It will disappear against its own floor.
2. **No rim, outline or contact cue.** Combined with C2, the contractor floats.

### C8 — Composition and depth separation — **F**

No depth cue is operating. Fog is configured `near: 14, far: 74` in a warehouse roughly 32 m across,
so at the far wall the fog factor is around 0.1 and contributes nothing visible; the far wall reads
at the same clarity and value as the near floor. PEAK carries essentially all of its depth this way
and it is the single cheapest thing in the document.

Composition then fails on its own terms: the bottom ~40% of `hz-floor`, `hz-pit` and `hz-dock` is a
single unbroken empty plane, over the 40% fail threshold. `hz-spawn` is a flat blue-white box with
nothing in it at all. Nothing occupies the near field to frame any shot, and `hz-racking`'s
foreground is an unreadable black mass. The frames are horizontal slabs: dark ceiling band, mid wall
band, bright floor band.

### C9 — Colour discipline — **F**

Worst frame `hz-spawn`: dominant hue **55.9%** across **2** families — a duotone with no accents.
`hz-pit`: only **41.2%** of pixels carry any chroma at all, against a 50% fail floor — over half the
frame is dead grey. Against PEAK's 26.3% dominant across 7 families at 98.9% chromatic.

The instructive part is that PEAK *looks* like a purple monochrome and measures as seven hue
families. Its discipline comes from controlling value and saturation and keeping accents small in
area, not from removing hues. This build has fewer hues and less discipline — the worst of both.

`hz-racking` (52.8% dominant, 6 families, 0.435 saturation, 91.9% chromatic) is close to acceptable
and shows the level data is capable of better. The mint-green pit light (`#9fffc0`) is the loudest
thing in several frames and is fighting everything else.

---

## Top five fixes, in priority order

Ordered by return per hour, per rubric §2. The first two are most of the grade.

### 1. Build the post chain. `client/src/art/post.js` is a no-op — replace it.

One full-screen composite pass, in this order, all procedural:

* **Grade / tonemap.** Lift the black point off zero and tint it. Target: darkest-5% mean RGB around
  35/32/58 with channel spread ≥ 10, `crush%` < 2, `clip%` < 0.2, median luma 55–110 on interiors.
  Currently 2/1/0, spread 0.6, crush up to 19.9%.
* **Vignette.** Target corner ÷ centre **0.72–0.94**. Currently **2.104** — an inverse vignette, so
  this is a sign flip before it is a tuning job.
* **AO.** Wall–floor junctions should measure 0.62–0.85 against open floor 30 px away. Currently
  ~1.0; nothing has corners.
* **Bloom.** Threshold-gated so only emitters bloom, halo 6–20 px, source keeps a hard core.
* **Camera-feed layer**, player-toggleable, matching the R.E.P.O. setting set: grain, edge chromatic
  aberration, mild lens distortion, optional pixelation step. Subtle enough to survive a still.

Verify with `imgstat.js` / `imgstat2.js` against the C5 and C6 thresholds.

### 2. Ground everything. Nothing in the build casts a shadow.

`worldview.js:92` builds every lamp as a `PointLight` and never sets `castShadow`; the only caster
is the exterior sun at `worldview.js:74`, which the roof fully occludes. Do not simply enable shadow
maps on all seven lamps — that is seven cube renders a frame. Either:

* promote the two or three lamps that matter to shadow casters at modest map size, **or**
* add a cheap downward blob/contact-shadow per dynamic object, plus the AO pass from fix 1.

Target: floor luma near ÷ far ≤ 0.75 within 0.3 object-widths, for small props as well as figures.
Currently **1.07–1.37** — an anti-shadow, because the pit fill light shines under everything
unobstructed. Measure with `figstat.js`.

### 3. Wire `art/textures.js` into `art/materials.js`. It is dead code right now.

17.8 kB written, imported by nothing, bundle hash unchanged across a rebuild. Once live, aim at
`tex%` ≥ 25 and `flat%` ≤ 70 (currently 2.2–11.6 and 84.8–97.1). Detail at two scales per material:
a fine grain readable at 1 m, a large pattern readable at 10 m. Floors want painted bay markings,
tyre scuffs and hatched hazard zones — they double as navigation cues.

Note the rubric's anti-gaming clause: full-screen noise inflates `tex%` without texturing anything
and scores F regardless of the number. The detail must be perspective-foreshortened on a receding
floor and must differ between material types.

### 4. Give the metals something to reflect, or stop paying for them.

There is no `scene.environment` in the project, so the `metalness` 0.55–0.75 on `deckplate`, `grate`,
`steelblue` and `metal` renders as flat dead colour and every roughness value is inert. Add a PMREM
generated from a procedural gradient or a small rendered cube — cheap, one-time, at boot — so metal
reads as metal and specular highlights exist. Target for C3: four or more response classes per
frame, at least one emissive and one genuinely reflective, and materials that vary *within* a
surface (edge wear, grime in the lower third of walls, traffic-lane scuffing).

### 5. Make depth read: fix the fog curve, then the composition.

Fog is `near: 14, far: 74` in a ~32 m room, so it contributes essentially nothing. Pull it in hard
enough that near-to-far measures ΔL > 25 or Δsaturation > 0.10 across the frame — PEAK carries
almost all of its depth this way and it costs nothing. Then place something in the near field of
every gameplay sightline to frame the shot (a racking upright, a doorway edge, a hanging cable), so
no single empty plane exceeds 35% of the frame; three frames currently run to ~40% bare floor.

While in the level data: the mint-green pit light `#9fffc0` is the loudest element in several frames
and is wrecking C9. Reserve high-chroma green for gameplay-critical signalling — extraction — and
nothing else.

---

## Re-grading

Re-run the two harnesses and re-measure against rubric v1.0. The criteria most likely to move first
are C5, C6 and C2; C4 follows as soon as `textures.js` is connected. C7 will improve automatically
once C2 lands, since most of what is wrong with the contractor is that it has no shadow.
