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

## Addendum, 02:29 UTC — the build has already moved

The art pass is working live. Between the capture graded above and this commit,
`art/materials.js:62` gained `import { surfaceTexture } from './textures.js'` — **fix 3 is now in
flight** and C4 may already be better than the F recorded here. I have not re-captured; doing so
would grade a moving target and the numbers above would no longer match the frames they describe.

Still absent as of this addendum: `scene.environment` (fix 4 — grep across `client/src/` returns
nothing), and `art/post.js` is unchanged (fix 1). Everything else in this document stands. Re-run
the harnesses for a current grade; do not treat the F as live once the art pass reports done.

## Re-grading

Re-run the two harnesses and re-measure against rubric v1.0. The criteria most likely to move first
are C5, C6 and C2; C4 follows as soon as `textures.js` is connected. C7 will improve automatically
once C2 lands, since most of what is wrong with the contractor is that it has no shadow.

---
---

# Second grading pass — 2026-08-08

**Date:** 2026-08-08 (captures taken 07:52–08:04 UTC)
**Graded against:** `docs/visual-rubric.md` **v1.0** — same criteria, same thresholds, so the two
passes are directly comparable.
**Build graded:** bundle `index-9ZxN5wL4.js` (2,150.98 kB) + `three-D8l_1uvJ.js` (486.55 kB), built
by me from the working tree at commit `91a4613`.
**Caution on staleness:** the tree moved under me again during this pass. By the time I wrote this,
HEAD was `4d27e75` and someone had rebuilt to `index-DzFLXGSE.js`. This grade describes
`index-9ZxN5wL4.js` and nothing later.

**Honesty statement unchanged.** I did not run, install or play R.E.P.O. or PEAK. No side-by-side
was performed. PEAK columns are measured from the four real screenshot files in `refs/peak/`;
**R.E.P.O. still contributes no image** — `refs/repo/` is still empty, the egress proxy still
refuses every source, and R.E.P.O. informs this grade by written description only.

## Overall: **F → C−**

Six outright failures have become zero. Nothing is above B−. This is now recognisably a game rather
than a greybox, and the fixes landed where the first review said they would pay: post, grounding,
texture. The remaining gap is no longer "nothing is implemented" but "several things are implemented
at the wrong intensity" — which is a much better problem.

| Criterion | Pass 1 | Pass 2 | |
|---|---|---|---|
| C1 Lighting / bounce | F | **B−** | ▲▲ |
| C2 Contact shadows | F | **B−** | ▲▲▲ |
| C3 Material variety | F | **C+** | ▲▲ |
| C4 Texture presence | F | **C** | ▲▲ overshot |
| C5 Tonal range | F | **D** | ▲ with a real regression |
| C6 Post chain | F | **C** | ▲▲ overdone CA |
| C7 Silhouette at 10 m | C | **C** | ▬ worse at 20 m |
| C8 Composition / depth | F | **C** | ▲ |
| C9 Colour discipline | F | **C−** | ▲ |

### Measured delta

| Metric | Target | Pass 1 range | Pass 2 range | PEAK |
|---|---|---|---|---|
| Draw calls / triangles | — | 6 / 1,092 | 116 / 11,661 | — |
| Median luma | 55–110 | 62–182 | 24.6–133.8 | 70.5 |
| **Crushed (L≤4)** | < 2% | **0.0–19.9%** | **4.1–23.1%** | 0.0% |
| Clipped (L≥250) | < 0.2% | 0.0–0.4% | 0.0–0.6% | 0.0% |
| Mean saturation | 0.25–0.55 | 0.185–0.435 | 0.282–0.518 | 0.392 |
| Chromatic pixels | > 85% | 41–92% | 48.6–91.1% | 98.9% |
| Dominant hue share | 25–45% | 39.8–55.9% | 32.7–49.0% | 26.3% |
| Hue families | ≥ 5 | 2–6 | 5–8 | 7 |
| **Flat pixels (SD<2)** | ≤ 70% | 84.8–97.1% | **7.1–18.9%** | 63.1% |
| **Textured (SD 2–25)** | ≥ 25% | 2.2–11.6% | **79.7–90.2%** | 36.1% |
| Shadow tint spread | ≥ 10 | 0.6–1.6 | 5.9–11.8 | 26.3 |
| Contact near÷far | ≤ 0.75 | 1.07–1.37 | **0.465–0.743** | — |
| Texture feature size | — | — | 4.3–5.4 px | 8.2–26.6 px |
| CA edge / centre | — | 0 / 0 | 2.0–3.0 px / 0–1 px | — |

## Two measurement caveats, stated before the grades rest on them

**1. `hz-fig.js` bypasses the post chain.** My figure harness calls `renderer.render()` directly, so
its captures contain no SSAO, bloom, grade, vignette or CA. Its contact readings (1.36–1.47) are
therefore *not* evidence that grounding failed — they measure the raw scene. I graded C2 from
targeted probes on the post-processed frames instead (`probe2.js`), which is the honest measurement.
The figure shots remain useful as a pre-post control for geometry and texture, and I have used them
only that way. The post chain is not exposed on `window.__hz`, and there is no client-side bot spawn,
so I could not get a figure into a post-processed frame without touching game code, which I did not.

**2. My vignette proxy is confounded when the frame's centre is dark.** `imgstat2` reports corner ÷
centre: `hz-pit` 0.724 and `hz-floor` 0.425 are valid and in range. `hz-racking` 3.104 and `hz-dock`
4.399 are **not** a regression — those frames now have genuinely dark central content (a foreground
column, the pit), so the ratio is measuring subject matter. The vignette is visibly present in all
four. I am not scoring those two numbers.

## Criterion by criterion

### C1 — Lighting and indirect/bounce — **F → B−**

The fix worked. Lamps now pool on the **floor**, which was the whole complaint: `hz-dock` shows a
clear lit pool beneath each ceiling fixture, and the pit reads as a lit volume rather than a green
rectangle. The `RoomEnvironment` gives surfaces something to pick up, so there is a genuine indirect
term. Key-to-fill on one material measures 2.1:1 (`hz-pit`: open floor 135.8 vs shadowed 63.2),
inside the acceptable band and reaching further on `hz-dock`. Held below A because `SHADOW_LAMPS`
is 1, so directionality comes from a single source and the rest of the room is ambient-lit.

### C2 — Contact shadows and grounding — **F → B−** (biggest single win)

Measured on post-processed frames:

| Probe | near ÷ far | verdict |
|---|---|---|
| Dock platform cast shadow (`hz-pit`) | **0.465** | real cast shadow, shape follows object |
| Floor at pit-rim base (`hz-dock`) | **0.582** | grounded |
| Floor under a small prop (`hz-dock`) | **0.743** | grounded, just inside the ≤0.75 bar |

From 1.07–1.37 *anti*-shadows to 0.465–0.743. Objects now sit on the floor, and — the part that
usually gets skipped — **the hand-sized props are grounded too**, which is the class this game is
about. Held at B− because one caster means single-direction shadowing, much of the grounding is SSAO
rather than cast, and I could not verify the contractor is grounded (see caveat 1).

### C3 — Material variety — **F → C+**

`scene.environment` fixed the dead metals. There are now specular highlights — the van's
checker-plate in `hz-pit` reads as metal, the corrugated cladding has a directional sheen, and the
lamps are emissive. Four response classes, up from one. Held at C+ because materials are still
uniform *within* a surface: no edge wear, no grime gradient in the lower third of walls, no traffic
scuffing. The blue racking texture reads as glitter rather than painted steel.

### C4 — Texture presence — **F → C** (passed the threshold, overshot the reference)

`tex%` went 2.2–11.6 → **79.7–90.2**; `flat%` went 84.8–97.1 → **7.1–18.9**. That clears the ≥25 /
≤70 bar by a mile — and lands nowhere near the reference, which is 36.1 / 63.1. **PEAK leaves 63% of
its frame smooth.** This build now leaves 7–19%. There is no rest anywhere for the eye.

Confirming the scale problem numerically: mean texture feature size is **4.3–5.4 px** on
post-processed frames and 6.4–7.0 px pre-post, against PEAK's **8.2–26.6 px**. The ceiling is a
dot-screen, exactly as reported. Note the compounding: post *reduces* apparent feature size from 6.4
to 4.3 px, i.e. grain and CA are piling high-frequency noise onto texture that is already too fine.

Grading C rather than higher is a deliberate reading of the rubric's anti-gaming clause — the
threshold is met but the detail is not surface-appropriate. **UV scale wants to be 2–4× coarser**,
and some materials should stay smooth.

### C5 — Tonal range and exposure — **F → D**, and this is where the regression is

Improvements are real: median luma is better placed (three of five frames now inside 55–110, against
zero before), and shadow tint spread went 0.6–1.6 → 5.9–11.8, so the grade is doing something.

But **crushing got worse across the board**:

| Frame | Pass 1 crush% | Pass 2 crush% |
|---|---|---|
| hz-spawn | 0.0 | **4.1** |
| hz-floor | 3.2 | **18.2** |
| hz-racking | 19.9 | **23.1** |
| hz-pit | 3.9 | **15.8** |
| hz-dock | 4.7 | **15.4** |

Every frame regressed. Four of five now exceed the 8% fail threshold, where before only one did.
The darkest-5% mean is RGB **[0,0,8]** — a blue residue over a black point still sitting on zero, so
R and G are fully clipped off the bottom. PEAK's is 35/32/58: *lifted* and tinted. The grade added a
tint without adding a lift. `hz-racking` at median luma 24.6 is now simply too dark, and `hz-floor`
clipped slightly worse too (0.4% → 0.6%).

### C6 — Post chain — **F → C**

It exists and it works: SSAO is measurably darkening contacts, bloom halos are present and gated,
ACES is rolling off, vignette measures 0.425–0.724 where the metric is valid. That is a large jump
from a no-op passthrough.

Capped at C by the chromatic aberration, which the rubric explicitly says should cost points when
overdone. Measured misregistration is **2.0–3.0 px at the frame edge against 0.0–1.0 px at centre**.
Two observations for whoever tunes it: it is radial (good), but the magnitude is roughly 2–4× a
tasteful value at 720p, and it is being applied over a dot-screen ceiling, so every fringe lands on
a high-frequency edge and produces rainbow speckle across the whole upper frame. Halving the
coefficient *and* coarsening the ceiling UVs will each fix about half the visible damage.

I should be straight about one thing: I was told the CA was "roughly fifty times too strong". I
cannot corroborate that figure from pixels — 2–3 px of edge misregistration is bad but it is not
50× bad. If the 50× comes from reading a constant in the shader, that may well be right about the
constant; it is not what the frame shows. Reporting what I measured.

### C7 — Silhouette at 10 m — **C → C** (slightly worse at distance)

Unchanged at close range and mildly regressed far out. Figure-vs-background ΔL: 163.7 at 5 m, 104.0
at 10 m, **35.1 at 20 m — down from 58.0**. The background got brighter and much busier, so the
contractor competes with texture noise it did not have to compete with before. Still near-white,
still no rim or outline cue. (Pre-post measurement — see caveat 1.)

### C8 — Composition and depth — **F → C**

Fog at 6/42 is doing visible work; the far wall in `hz-dock` now sits back from the near floor
instead of reading at equal presence. The bare-plane failure is also gone — the bottom of the frame
is textured concrete rather than an empty gradient, so no single unbroken plane dominates. Held at C
because most sightlines still have nothing in the near field to frame the shot, and `hz-racking`
puts a large unreadable dark mass dead centre.

### C9 — Colour discipline — **F → C−**

Hue families 2–6 → **5–8** (all frames now clear the ≥5 bar), dominant share 39.8–55.9% → **32.7–49.0%**,
mean saturation into the target band on every frame. The duotone problem is solved. Still failing on
the worst frame: `hz-pit` carries chroma on only **48.6%** of pixels, under the 50% floor, so half
that frame is dead grey.

## Regressions, called out separately

1. **Crushed blacks, every frame, roughly tripled** (see C5). The single thing to fix. The grade
   tints the shadows but never lifts the black point off zero.
2. **Silhouette separation at 20 m: ΔL 58.0 → 35.1** (C7), caused by the busier, brighter background.
3. **`flat%` collapsed 84.8–97.1 → 7.1–18.9** (C4). An overshoot, not a failure by threshold, but
   it is a swing straight past the reference: PEAK keeps 63% of the frame smooth and this keeps 7–19%.
4. **Chromatic aberration introduced at 2–3 px edge misregistration** (C6) — a new artefact,
   intended as a feature, currently overdone.
5. Marginal: `hz-floor` clipping 0.4% → 0.6%.

## Priority for a third pass

1. **Lift the black point.** Target `crush%` < 2 on every frame and a darkest-5% around RGB 35/32/58
   with spread ≥ 10 — currently [0,0,8]. Purely a grade constant; the cheapest fix in this list and
   it clears the only remaining D.
2. **Coarsen texture UVs 2–4×** and let some materials stay smooth. Target feature size 8–20 px and
   `flat%` back up toward 40–60%. Fixes the dot-screen ceiling and half the CA damage.
3. **Halve the CA coefficient**, or better, weight it so the centre 60% of frame is untouched.
4. **Give the contractor a rim cue and a darker torso value.** ΔL at 20 m is 35 and falling as the
   world gets busier; a near-white figure will vanish against the pale floors.
5. **Raise `SHADOW_LAMPS` if the budget allows it** — at 116 draw calls there is headroom under the
   150 cap for one more caster, which would give the room a second shadow direction. Measure first;
   the ~65-draws-per-caster figure is the binding constraint, not the triangle count.
