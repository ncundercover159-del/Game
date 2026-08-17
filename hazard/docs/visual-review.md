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

---

# Third grading pass — 2026-08-08

**Date:** 2026-08-08, captures 20:56–21:05 UTC.
**Graded against:** `docs/visual-rubric.md` **v1.1**, amended this session. **v1.1 changes the
thresholds on C1, C4, C5 and C6**, so those four are not directly comparable with the pass-2 letters
and the table below flags them. C2, C3, C7, C8 and C9 are graded against unchanged criteria.
**Build graded:** working tree at `5496dcc` plus uncommitted changes to `art/figure.js`, `main.js`
and `worldview.js`; bundle `index-Bdnzj_ps.js` (2,183.03 kB) + `three-Tal2OJeb.js`, built by me.
**Frames:** `hz-{spawn,floor,racking,pit,dock}.png`, `hzf-{idle,walk,haul,down,head,lineup}.png`,
`hzw-{t000,t130,t280,t370,under}.png`. Ports 4231/4232/4233.
**Caution on staleness — the tree moved under me again, as it did in pass 2.** By the time this was
written HEAD was `c255141`, "Merge both pupils into one node, and measure what a contractor costs",
which touches the very figure C7 grades and the draw-call cost noted at the foot. **This grade
describes `index-Bdnzj_ps.js` and nothing later.** Re-shoot before treating C7 or the 252-draw
finding as current.

## Honesty statement — and this pass it finally changes

I did not run, install or play R.E.P.O. or PEAK. They are commercial Unity titles on Steam and this
is a headless Linux container. **No side-by-side capture was performed and none is possible here.**

What has changed is that **R.E.P.O. now has images.** Seven genuine in-game captures are on disk in
`refs/repo/`, obtained from the only image host the egress policy leaves reachable —
`raw.githubusercontent.com` — by finding a R.E.P.O. mod whose author committed gameplay screenshots
into the repository rather than hotlinking them to an image host:

* https://raw.githubusercontent.com/darmuh/FovUpdate/master/Screenshots/example1.jpg
* …`example2` … `example6`, and `iconog.jpg`, same path. Repo: https://github.com/darmuh/FovUpdate

They carry R.E.P.O.'s shipped HUD — the green `+100/100` cross, the amber `⚡40/40` bolt, the
`$0 / $9,184` quota with `0/1` extractions beneath, the three numbered item slots, the extraction
cart's `$0` display and the `TAXMAN:` message list — so authenticity is high. **They are also JPEG,
the field of view is modded, the graphics settings are one player's, and six of the seven are dark
interiors.** No texture threshold and no composition claim may rest on them. Full caveats in
`refs/MANIFEST.md`.

Steam, Wikipedia, Wikimedia, Fandom, imgur, PC Gamer, GameSpot, IGDB, YouTube and
`user-images.githubusercontent.com` were all re-tested this session and all still answer **403 at
CONNECT**. PEAK gained nothing new; it remains the same four files, one dusk vista plus an interior
menu.

## Overall: **C− → D+**

That is not the build getting worse. **The build is visibly better than it was twelve hours ago**:
the crushed blacks are gone entirely, there is a real character in the world, it is grounded and
casting a shape-correct shadow, the water level rises and reads as water, and the texture statistics
that overshot wildly in pass 2 have landed inside the reference band. Four criteria genuinely moved
up.

The letter comes down because **two criteria were previously mis-measured and are now measured
correctly, and both fail.** The room has no lighting design — key-to-fill on one material is
**1.01–1.40:1** where the rubric's floor is 2:1 and R.E.P.O.'s reference is 3.2:1 to 11.6:1. Pass 2
scored that at 2.1:1 and graded it B−, because it measured open floor against *shadowed* floor,
which measures the shadow map and not the light. And C9 triggers two of its own named failure
conditions, one of which was present in pass 2 and was graded C− anyway; that was over-generous and
I am correcting my own grade, not only the build.

**Read the criterion notes, not the letter.** The letter moved because the instrument improved.

| Criterion | Pass 1 | Pass 2 | Pass 3 | |
|---|---|---|---|---|
| C1 Lighting / bounce † | F | B− | **F** | ▼▼▼ measurement corrected |
| C2 Contact shadows | F | B− | **B−** | ▬ now verified on figures |
| C3 Material variety | F | C+ | **C+** | ▬ |
| C4 Texture presence † | F | C | **C** | ▬ statistics fixed, content is not |
| C5 Tonal range † | F | D | **B** | ▲▲▲ biggest win of the pass |
| C6 Post chain † | F | C | **C** | ▬ bloom now the blocker, CA acquitted |
| C7 Silhouette at 10 m | C | C | **C** | ▬ same letter, wholly different reasons |
| C8 Composition / depth | F | C | **D−** | ▼ |
| C9 Colour discipline | F | C− | **F** | ▼▼ part regression, part corrected grade |

† graded against amended v1.1 thresholds; not comparable with the pass-2 letter.

## Before the grades: three things about the instrument

**1. Every screenshot I have ever graded was framed against a bug, and this one is not.** The
first-person camera was aimed 180° from the server's grab ray, and the harness's shot angles had all
been chosen by eye against that, so the harness had silently learned the inversion. `aimtest.js`
now passes with a worst disagreement of 3.89e-16 and 40 m of clear sight down all three spawn views.
The consequence for this document: **`hz-spawn` in pass 3 is not the same view as `hz-spawn` in pass
2.** Where I quote a pass-2 number below it is for orientation, not as a delta. Anything that looks
like a frame-level regression across the convention change should be assumed to be a different room
until someone checks.

**2. Three of my own metrics have now been caught measuring something other than what they claim.**
Vignette-by-corner÷centre measures dark subject matter (three frames return 2.2–3.2 with a visibly
present vignette). `tex%` measures exposure, not texture (it ranks R.E.P.O. as smoother than PEAK,
which is nonsense). Key-to-fill measures the shadow map if either sample sits in a cast shadow. And
in this pass a fourth: my disc-shaped contact probe returned ratios of 1.10–1.28 — *anti*-shadows —
because the "near" disc included the prop's own bright pixels. Re-sampling floor only, beside the
prop rather than over it, gives 0.61–0.82. All four are now written into rubric §4. **Where a number
and the picture disagree, the picture wins.**

**3. Interpolation was pinned at zero under swiftshader, so every remote figure in every prior
capture was frozen.** Fixed. The figures in this pass are mid-animation, which is why I can grade
the waddle and the hauling pose at all.

## Measured, this build against both references

HUD-cropped, `crit3-stat.js` / `crit3-stat2.js`.

| Metric | hz-spawn | hz-floor | hz-racking | hz-pit | hz-dock | **PEAK** | **R.E.P.O.** |
|---|---|---|---|---|---|---|---|
| Median luma | 95.0 | 105.3 | 29.6 | 126.3 | 91.0 | 70.5 | 7.1–11.7 |
| p01 luma | 25.4 | 23.4 | 21.6 | 23.4 | 24.7 | 33.5 | 3.5–4.0 |
| **Crushed (L≤4)** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | 0.0 | 1.2–3.7 |
| Clipped (L≥250) | 0.0 | **0.7** | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| Darkest-5% RGB | 24/22/41 | 23/21/37 | 22/20/36 | 22/21/37 | 23/21/41 | 35/32/58 | 3/3/6 |
| Shadow spread | 18.6 | 15.7 | 15.6 | 16.5 | 20.1 | 26.3 | 1.6–3.9 |
| Mean saturation | 0.296 | 0.242 | 0.393 | 0.199 | 0.288 | 0.392 | 0.39–0.54 |
| **Chromatic (S>0.15)** | 72.9 | 59.8 | 95.3 | **48.4** | 67.0 | 98.9 | 90.0–99.4 |
| **Dominant hue share** | 42.1 | 46.5 | **58.1** | 49.6 | 42.5 | 26.3 | 19.0–31.2 |
| Hue families | 5 | 5 | 4 | 5 | **3** | 7 | 5–10 |
| Flat (SD<2) | 54.3 | 65.9 | 69.8 | 72.4 | 57.3 | 63.1 | n/a (JPEG) |
| Textured (SD 2–25) | 43.2 | 31.6 | 28.9 | 25.6 | 41.4 | 36.1 | n/a (JPEG) |
| Normalised texture CV | — | — | 0.056 | — | 0.056 | 0.043 | 0.066–0.073 |
| Draws / triangles | 155 / 13,533 | | | | | — | — |

Two lines in that table are the story of the pass. **Crushed is 0.0 on every frame** where pass 2
ran 4.1–23.1. And **chromatic coverage is 48.4–72.9% against 90–99% on both references** — the one
place where PEAK and R.E.P.O. agree exactly and this build is nowhere near either.

## Criterion by criterion

### C1 — Lighting structure and indirect/bounce — **B− → F**

Measured on two unshadowed patches of the same material, per amended v1.1:

| Frame | Bright | Dark | Ratio |
|---|---|---|---|
| hz-spawn, concrete floor | 153.8 | 142.4 | **1.08 : 1** |
| hz-dock, concrete floor | 130.6 | 102.9 | **1.27 : 1** |
| hz-racking, concrete floor | 108.9 | 107.4 | **1.01 : 1** |
| hz-racking, clad wall | 37.2 | 26.5 | **1.40 : 1** |
| *R.E.P.O. `example1`, stone wall* | *64.8* | *20.4 / 5.6* | ***3.2 : 1 / 11.6 : 1*** |

The rubric's FAIL line is 2:1 and every reading is below it. **The warehouse floor is a wash.** You
can walk from directly under a lamp to the far corner of the room and the floor changes by one
percent. That is why the frames read as a lit model rather than a place — everything else in the
document is downstream of this. In `refs/repo/fovupdate-example1.jpg` a single sconce puts the stone
under it at luma 65, the same stone three metres away at 20, and the far side of the room at 6, and
the hue rotates warm → neutral → cool across that range. That is a room. This is a lightbox.

One thing is working and should not be lost while fixing this: **the hue does vary even where the
value does not.** hz-dock's floor is RGB 134/116/98 (warm) at the left edge and 126/133/126 (neutral)
at centre. The warm/cool machinery exists; it is the value range that is missing.

Downgrade from B− is a correction to the measurement, not evidence the build regressed. The build
was this flat in pass 2 too.

### C2 — Contact shadows and grounding — **B− → B−**, and now actually verified

Pass 2 could not measure the contractor at all: the old figure harness bypassed the post chain.
`hz-fig2.js` shoots through it, so this is the first honest reading.

| Probe | near ÷ far | verdict |
|---|---|---|
| Contractor's boots, `hzf-walk` | **0.621** | grounded, MATCHES band |
| Contractor's boots, `hzf-idle` | **0.422** | grounded, tight to contact |
| Small red prop, `hz-dock` | 0.608 | grounded |
| White block, `hz-dock` | 0.787 | grounded, ACCEPTABLE |
| Grey cylinder, `hzf-idle` | 0.821 | grounded, ACCEPTABLE |

Five figures in `hzf-lineup` each throw a long, separate, direction-consistent shadow, and the
ragdoll in `hzf-down` keeps its shadow through the fall. Shape follows object. Hand-sized props are
grounded, which is the class this game is about and the class builds usually give up on.

Held at B− for one reason only: a single shadow direction. Everything in every frame is lit from the
same place, so the shadows are parallel and the scene has no cross-lighting. That is the same root
cause as C1.

### C3 — Material variety — **C+ → C+**

Response classes across the set: matte concrete, semi-gloss painted steel, emissive lamps,
corrugated cladding with a directional sheen, and — new this pass — **transmissive water**, which is
a genuine fifth class and reads correctly. The flooded plant is the best-looking content in the
build.

Held at C+ on the same complaint as pass 2, which nothing has addressed: materials are uniform
*within* a surface. No edge wear, no grime gradient up a wall, no traffic lane polished into the
floor. And the racking's blue still reads as **glitter, not painted steel** — a fine bright sparkle
across a saturated blue that no industrial surface has.

### C4 — Texture presence — **C → C**. The numbers are fixed. The content is not.

This is the finding that contradicts the standing bug list, so here it is with numbers. I was told
texture scale is "2–4× too fine" and flat area is "7–19% against PEAK's 63%". **Neither is true of
this build any more.**

| | Pass 2 | Pass 3 | PEAK | R.E.P.O. |
|---|---|---|---|---|
| flat% (SD < 2) | 7.1–18.9 | **54.3–72.4** | 63.1 | n/a |
| tex% (SD 2–25) | 79.7–90.2 | **25.6–43.2** | 36.1 | n/a |
| Normalised texture CV | — | **0.043–0.056** | 0.043 | 0.066–0.073 |
| Feature size, ×1.5 to 1080p | 6.5–8.1 px | **3.2–3.6 px** | 3.1 px | 3.2–3.4 px |

flat% and tex% now bracket PEAK. The contrast-normalised CV sits between the two references. Feature
size, once the 720p→1080p resolution difference is taken out, matches R.E.P.O. almost exactly.
**Whoever tuned this hit the target.** If the scale is still being chased, it is being chased past
the reference.

It stays at C under the v1.1 content cap, because I cannot name a single material from its pattern:

* **The squiggly loops are the worst texture in the build.** Wandering closed contours across the
  concrete in `hz-dock`, `hz-pit`, `hzw-*` and — importantly — on the plant's *tank walls* as well as
  its deck. They read as biro doodles or a hand-drawn contour map. Nothing about concrete does that.
* **The white speckles read as snow or paint spatter**, not aggregate. They are uniform in size,
  uniform in brightness and uniform in density across a receding plane.
* **The racking sparkle reads as glitter.**
* The ceiling's radiating white ribs in `hz-spawn` read as a striped awning.

The direction to give an art agent is no longer "coarsen the UVs". It is "replace three patterns".

### C5 — Tonal range and exposure — **D → B**. The largest win in the pass.

`crush%` is **0.0 on all five frames**, from 4.1–23.1. p01 is 21.6–25.4, so the black point sits
comfortably off zero. The darkest 5% measures [22,20,36] to [24,22,41] with a channel spread of
15.6–20.1 — a lifted blue-violet, close to PEAK's [35,32,58]/26.3 and a world away from the
[0,0,8]/0.6 of pass 2. `uLift` at (0.098, 0.090, 0.156) is exactly the right shape of fix, applied in
exactly the right place, and it is worth noting that the comment in `post.js` records the lift coming
*down* by a third once `materials.js` grew a bounce floor. That ordering is correct and someone
understood the problem.

Not an A, for two reasons. `hz-floor` clips **0.7%** of its pixels — both references clip 0.0% on
thirteen frames out of thirteen, so any clipping at all is a defect (see C6, bloom). And exposure
placement is loose: median luma runs 29.6 to 126.3 across five frames of the same building.
`hz-racking` at 29.6 is under the interior band and `hz-pit` at 126.3 is over the MATCHES ceiling.
For context against the reference nobody has had until today: R.E.P.O.'s median is 7–12. This build
is not too dark. On `hz-pit` it is four times too bright.

### C6 — Post chain — **C → C**, with one sub-check now failing outright and one verdict retracted

**Vignette — pass.** Valid readings: `hz-floor` 0.619, `hz-pit` 0.904, both inside the widened
0.27–0.94 band. The other three return 2.2–3.2 because their centres are genuinely dark content;
the metric is invalid there and the vignette is visibly present by eye in all five.

**Ambient occlusion — pass.** `uAO` 0.70, contacts measuring 0.42–0.82, tight to the crease, no
halo rings. Nothing to complain about.

**Bloom — FAIL, and it is the blocker for this criterion.** On `hz-floor` and `hz-pit` the van's
interior lamp is a featureless white ball roughly 190 px across. Sampling a 180×150 box over it:
mean luma 174.5, and the **top 10% of that box sits at 253.3** — 2,700 pixels of clipped white. The
emitter has lost its shape entirely, which is the rubric's stated bloom failure condition verbatim,
and it is also the source of C5's only clip. For contrast, R.E.P.O.'s sconces bloom out to 12–96 px
and the sconce core stays a readable rectangle inside the halo. Wide is fine. Losing the source is
not. The fault is unlikely to be `uThreshold` 1.62 or `uBloom` 0.55; it is that the emitter itself is
arriving at the composite already clipped.

**Grade — pass.** Shadow spread 15.6–20.1, consistent blue-violet lift across every frame in the
set, warm lamps against it. A deliberate identity.

**Camera-feed layer — and I retract pass 2's verdict on it.** Pass 2 docked the chromatic aberration
as "2–4× a tasteful value" at 2.0–3.0 px of edge misregistration. Having now seen seven real R.E.P.O.
frames, that judgement was wrong. R.E.P.O. runs the camera-feed layer *loud*: fringing plainly
legible on the HUD glyphs, grain over every surface, corner stretch, corners taken to near-black.
Rubric v1.1 puts MATCHES at 1.5–4 px edge with under 1 px centre; `uAberration` 0.0026 producing
2.8 px is **in band**. Leave it alone. The one part of the pass-2 note that survives is the
interaction warning: CA over texture finer than ~4 px speckles, and that is a texture problem.

### C7 — Silhouette readability at 10 m — **C → C**, for entirely different reasons

Pass 2's C was awarded to a near-white capsule. There is now a designed character — eight builds
varying height, girth, head size, eye size, eye spacing and hat shape; oversized hats; a hauling
pose; a waddle; spring-mounted eyes that survive into the ragdoll. As a piece of character design
thinking it is sound, and `figure.js`'s own comment — "the eyes are the whole character" — is the
right instinct. On screen, it does not land yet.

Measured on `hzf-lineup`, figure against the background immediately beside it:

| | Luma | Δ vs background | Verdict |
|---|---|---|---|
| Figure A, body | 68.2 | **20.8** | bottom of ACCEPTABLE |
| Figure D, body | 81.5 | **9.7** | **below the FAIL line of 20** |
| Figure A, hat | 135.0 | **46.0** | MATCHES |
| Figure D, hat | 162.2 | **71.0** | MATCHES |

**The hat is doing all of the work and the body is doing none of it.** Against pale concrete a
contractor's torso is within ten luma of the floor behind it. The read at distance is a yellow disc
floating above a smudge.

Five concrete faults, in order of how much they cost:

1. **Every build wears the same yellow hat.** The one element with reference-grade contrast carries
   *no* per-player information. The per-player colour lives in the torso stripes — the busiest,
   lowest-contrast, first-to-be-eaten-by-fog part of the figure. This is exactly backwards. Put the
   slot colour on the hat.
2. **The torso is too close in value to the environment.** It needs to go darker, or more saturated,
   or both, and it needs a rim/edge cue to hold it off pale backgrounds — the rubric has asked for
   one for three passes and there still is not one.
3. **The stripe pairs clash and read as sportswear.** Purple-on-yellow, magenta-green-yellow. The
   `hzf-lineup` crew looks like a five-a-side team, not a work gang. Workwear reads as *one*
   hi-vis hue plus retroreflective banding, with the identity colour placed elsewhere.
4. **The eyes do not survive distance.** They are visible as two dark pin dots in `hzf-walk` and
   `hzf-haul` at ~3 m and gone by 8 m. If the eyes are the whole character, they need to be an order
   of magnitude larger in solid angle — R.E.P.O.'s reference principle is huge features on a simple
   body, and these are small features on a simple body.
5. **The `bucket` hat reads as a bowler, not a hard hat.** A flat-topped cylinder with a flat brim.
   A hard hat's silhouette is a *dome* with a short peak; the four `bucket` builds have lost the one
   shape that says "this person works here".

Two harness faults blocking a proper grade of this, both in `hz-fig2.js`: every solo shot rendered
**THE TALL ONE** — a `bucket` build with the second-smallest eyes in the table — so no `dome` build
was ever photographed alone; and **`hzf-head.png` is not a head close-up**, it is a full-body
three-quarter at ~3 m. The eyes, which the author says are the whole character, cannot be graded from
the shot named after them.

I was asked to be harder on `figure.js` because it has had no art direction applied. Fair: the
*modelling* judgement is good and the *colour and value* judgement is not. Nothing above is a
geometry problem.

### C8 — Composition and depth separation — **C → D−**

Fog still does real work — the far wall in `hz-dock` and `hz-spawn` sits back from the near floor.
Beyond that this is the weakest it has been.

* **`hz-racking` puts a featureless navy mass across the lower centre of the frame.** Mean luma 35.2
  at RGB 36/34/45, occupying **14.1%** of the frame, running off the bottom edge, with no readable
  surface, no highlight and no silhouette that says what it is. The rubric names "a black,
  detail-free mass filling the lower frame" as a FAIL condition, and the only thing keeping this off
  an F is that it is midground rather than foreground. It is a hair's breadth from an automatic
  failure and it should be treated as one.
* **The pale floor plane is back at 35–45% of the frame** in `hz-pit`, `hz-floor`, `hz-dock` and all
  three dry plant shots — an unbroken, evenly-lit, doodle-textured slab with nothing occluding it.
  The rubric's ACCEPTABLE ceiling is 35%.
* **Not one frame in ten has a foreground framing element.** No racking upright, no doorway edge, no
  hanging cable in the near field. Every shot is a flat elevation of a room.
* **The extraction volume renders as a green wireframe cuboid** in `hz-floor`, `hz-pit`, `hzf-idle`,
  `hzf-walk`, `hzf-head` and `hzf-haul`. One-pixel green lines on a box. That is a debug gizmo
  sitting in the middle of the hero shot of the game.
* **The ceiling starbursts are confirmed and they are severe.** In `hz-racking` the ribs form a fan
  radiating from the vanishing point with the top 1% at luma 235.7 spread over 144 px. It reads as a
  circus tent, or as a lens flare someone forgot to remove, and it owns the top third of the frame.

### C9 — Colour discipline — **C− → F**

Two of the rubric's named failure conditions are live:

* **`hz-pit` carries chroma on 48.4% of pixels** — under the 50% floor. Over half that frame is dead
  grey. Both references sit at 90–99%; this is the single metric on which they agree most closely
  and the build's worst frame is half of it.
* **`hz-racking` has a 58.1% dominant hue across 4 families** — a blue-and-beige duotone. It escapes
  the literal wording of the FAIL clause (which requires ≤3 families) by one family.

And `hz-dock` is down to **3 hue families**, under the ≥5 bar. Dominant hue share across the set is
42.1–58.1%, worse than pass 2's 32.7–49.0% and far outside both references' 19–31%.

Being straight about my own record: `hz-pit` measured 48.6% chromatic in pass 2 and I graded C−
anyway. That was over-generous against my own rubric. Part of this downgrade is the build getting
bluer, and part is me applying the standard I wrote.

The cause is visible without any measurement: navy ceiling, navy racking, navy monolith, pale beige
floor. **Blue is being used as a neutral.** It is the largest-area surface treatment in the
warehouse, which leaves accents nowhere to go — the only saturated non-blue things in `hz-dock` are
two hazard-striped panels and three small red props. PEAK reads as a purple monochrome and measures
26% dominant across 7 families; that perception is produced by controlling *value and saturation*
while keeping accent *area* small, not by painting everything one hue.

## The water, and the arbitration I was asked for

### `hzw-t370.png`: is there a specular highlight, or is it just teal?

**Neither, exactly. There is a genuine near-neutral highlight in the frame, and it is not on the
water surface.**

Sampling the water body only (x 330–1280, y 245–460, clear of the HUD text):

| | RGB | Luma | Spatial spread |
|---|---|---|---|
| Region mean | 40 / 94 / 92 | 82.1 | — |
| Top 1% by luma | 184 / 189 / 188 | 188.1 | **30 px** |
| Top 0.1% by luma | 199 / 215 / 213 | 211.4 | **18 px** |
| Brightest pixel | 223 / 235 / 233 | 232.3 | at (637, 395) |

The frame is emphatically not "just teal": against a mean that is strongly teal (red at 43% of
green), the brightest tenth of a percent is **near-neutral and clustered inside 18 px**. Tinted like
the light rather than like the surface, and compact. That is a real highlight and the
highlight-neutrality metric is right to pass it.

But sampling the water *surface* band alone (y 228–260):

| | RGB | Spatial spread |
|---|---|---|
| Region mean | 41 / 111 / 108 | — |
| Top 1% by luma | 80 / 141 / 134 | **132 px** |

The surface's bright end is **teal and smeared over 130 px**. That is diffuse brightening, not a
specular. The compact neutral thing at (637, 395) is the submerged lamp and its bloom — an emitter
that would be in the frame whether or not the water reflected anything.

**So: the metric passes for a legitimate reason, and the thing you hoped it was protecting is
absent.** The water surface has no specular. Looking at `hzw-t280`, where the surface is presented
flat to camera at a good angle, there is a broad soft brightening on the left and **no reflected
image of anything** — no lamp, no wall, no rig. Whatever "lamp reflections on the surface" is doing
in the code, it is not visible in these four frames.

**My recommendation, since you asked me to arbitrate rather than to nudge.** You were right to
replace the whole-frame cast assertion; a frame that is deliberately 60% teal water genuinely cannot
be judged by a global cast, and that is a limitation of the metric rather than a threshold you bent.
But highlight neutrality is not a good proxy for "the water reads as reflective", because an emitter
satisfies it for free. Add a third check that is actually about the surface: **inside the
water-surface band only, require the top 1% by luma to be within 20% of neutral *and* clustered
inside ~40 px.** Today that check fails, correctly. Keep the global cast printed, and make it
blocking on dry levels — where a cast is a bug — and non-blocking on flooded ones, where it is the
subject. For the record, measured whole-frame at full resolution rather than on a 160×90 downsample,
`hzw-t370` reads RGB 38/67/74, a cast of **1.95**. It is heavily cast. It should be.

### The rest of the water

The rising tide is the best thing in the build. `hzw-t000` → `t130` → `t280` → `t370` reads as a
tank filling, the submerged geometry stays legible through the teal, and `hzw-under` is genuinely
convincing as being underwater — depth fog, drifting particulate, a rust-orange floor patch giving
the teal something to work against. Transmissive water is a material class nothing else in the build
provides.

Three faults. The waterline where the surface meets the camera is a **hard horizontal seam** with no
meniscus, no thickness and no distortion, most obvious at the top of `hzw-under`. The **deck's
squiggle doodles are on the tank walls too**, so the one part of the level that should read as poured
concrete reads as a notepad. And the teal is strong enough that `hzw-t370` has essentially no warm
accent anywhere in frame; `t000` and `under` both have one and are better for it.

## Regressions and confirmations

**Confirmed, from your known-and-unfixed list:**

* Navy monolith in `hz-racking` — confirmed, 14.1% of frame at luma 35.2, and worse than the phrase
  "navy pillar" suggests.
* Deck-rib starbursts — confirmed and severe, top 1% at luma 235.7 across the upper third.
* Squiggly-loop deck pattern — confirmed, and it is on the tank walls as well as the deck.
* Ceiling deckplate moiré at grazing angles — confirmed in `hz-spawn` and `hz-racking`.

**Not confirmed — these two appear to be fixed and the bug list is stale:**

* "Texture scale 2–4× too fine": feature size normalised to 1080p is 3.2–3.6 px against R.E.P.O.'s
  3.2–3.4 px and PEAK's 3.1 px. It is on target.
* "Flat surface area 7–19% against PEAK's 63%": now **54.3–72.4%**, bracketing PEAK's 63.1%.

**New regressions:**

1. **Dominant hue share 32.7–49.0% → 42.1–58.1%** (C9). The build got bluer.
2. **`hz-dock` down to 3 hue families**, under the ≥5 bar.
3. **Bloom now clips.** `hz-floor` 0.6% → 0.7% clipped, and the emitter's shape is gone entirely.
4. **`hz-fig2.js` fails its own draw-call assertion**: 252 draws with six figures on screen, against
   a 175 budget. Eleven meshes per figure, uninstanced.

## Top five fixes for a fourth pass, in priority order

### 1. Give the room a lighting design. Target key-to-fill 4:1 on one material.

Currently 1.01–1.40:1; the rubric floor is 2:1; R.E.P.O. measures 3.2:1 across a corridor and 11.6:1
across a room. **This is the reason the build does not look like the references and every other
criterion is downstream of it.** Concretely: reduce the ambient/hemisphere term until unlit floor
sits near luma 30–45, then put the light back as *pools* — lamp intensity up, falloff tighter, and
large gaps between lamps that are allowed to stay dark. Verify by sampling two unshadowed patches of
the same floor and dividing. Do not verify against a cast shadow; that is how this got graded B− in
pass 2.

### 2. Fix the bloom clip, then the emitter behind it.

`hz-floor` and `hz-pit`: the van lamp is a 190 px featureless ball with 2,700 pixels at luma ≥253.
Clamp the emissive so the source arrives at the composite unclipped, and check the halo keeps a hard
core — R.E.P.O.'s sconces bloom out to 96 px and stay rectangles. This also clears C5's only clip and
is the smallest change in this list.

### 3. Replace three textures. Not the scale — the patterns.

The scale is on target; leave the UVs alone. Replace: **(a)** the wandering closed-loop squiggles on
concrete, everywhere including the plant's tank walls — that pattern reads as biro doodles; **(b)**
the uniform white speckle, which reads as snow rather than aggregate; **(c)** the fine sparkle on the
blue racking, which reads as glitter rather than painted steel. Replace them with things that name
their material: cast-slab expansion joints and bay markings on the floor, aggregate pitting at a
different scale from the joints, and flat paint with wear at the edges on the steel.

### 4. Move the contractor's identity colour to the hat, and darken the torso.

Measured: the hat separates from the background by ΔL 46–71 and the body by **9.7–20.8**, so the hat
is carrying the entire read and it is the same yellow on all eight builds. Put the slot colour on the
hat shell; drop the torso to one hi-vis hue with retroreflective banding and no clashing second
colour; take the torso value down so it does not sit within ten luma of pale concrete; add a rim or
edge cue. Also: make the `bucket` hat a dome with a peak — a flat-topped cylinder with a flat brim
reads as a bowler — and enlarge the eyes substantially, because at present they are gone by 8 m.

### 5. Break up the blue, and put something in the near field.

Blue is being used as a neutral across the ceiling, the racking and the monolith, which is why the
dominant hue share is 42–58% against a reference band of 19–31% and why `hz-pit` has chroma on only
48.4% of its pixels. Repaint at least one of the three large blue surfaces in a warm neutral. While
in there: give the navy mass in `hz-racking` a readable surface or move it out of the sightline;
replace the green wireframe extraction cuboid with something authored; and put one occluding object
in the near field of each standard camera angle, because ten frames from this build contain zero
foreground framing elements between them.

### Also worth doing, below the line

* `hz-fig2.js` shoots THE TALL ONE for every solo shot, so no `dome` build has ever been
  photographed alone, and `hzf-head.png` is a full-body shot rather than a head close-up. The eyes
  cannot be graded from the shot named after them. Cycle the build across the solo shots and
  actually frame the head.
* 252 draws with six figures against a 175 budget. Eleven uninstanced meshes per contractor.

---

## Pass 3b — re-shoot against a newer build, 2026-08-09

Written because two of pass 3's confirmations were reported fixed while the pass was being written,
and a confirmation that is stale is worse than no confirmation at all. This section re-tests only
what a newer build could have changed. **It does not re-grade the criteria**; where the statistics
are unchanged, the pass-3 letters stand and are not restated.

**Build:** HEAD `c255141` plus uncommitted changes to `art/materials.js`, `art/props.js`,
`server/world.js` and `server/nettest.js`; bundle `index-DlLLoYOk.js` (2,193.91 kB) +
`three-jfAxEz14.js`, built by me. **Frames:** `p3b-{spawn,floor,racking,pit,dock,ceiling,groundtex}.png`
and `p3bw-deck-t*.png`, captured with `crit3b.js` on ports 4762/4763.

**Two harness notes before the findings.**

The warehouse went from **13,533 to 53,681 triangles** — 4× — and at that load a 1280×720 readback
under swiftshader exceeds Playwright's 30 s default. `hz.js` and `hz-water.js` now both die on
`page.screenshot: Timeout 30000ms exceeded` after passing all their assertions, so the suite reports
a failure while the build is fine. `crit3b.js` is a capture-only copy with the timeout raised to
180 s; the shot angles are copied verbatim rather than re-aimed, for the reason set out in rubric §4.

`p3b-groundtex.png` is mislabelled by me and should be ignored as a concrete sample: at that pitch
the camera is looking into the extraction volume, not at the floor. The pale green expanse in it is
the objective marker.

### The two claimed fixes: both real, both confirmed by eye

**Squiggly-loop concrete pattern — fixed.** Verified on a 3× nearest-neighbour magnification of the
near floor in `p3b-dock` (`crop-floor.png`), not on a statistic. The wandering closed contours are
gone. They are still visible in `hzw-t370.png`, which was shot before the fix; disregard that part of
pass 3's C4 note and of the water section.

What replaced them does not yet name its material. The near-centre dock floor measures a local
standard deviation of **3.0** over a 300×65 patch — close to flat — and the magnified crop reads as a
soft blotchy wash with faint diagonal streaking, i.e. dirty lino rather than concrete. Elsewhere the
floor is better: slab joints and bay markings are present in `p3b-spawn` and `p3b-racking` and are
the best texture work in the build. **C4's cap at C was for pattern content, not for scale, and it
stands** — but the specific instruction in pass 3's fix #3(a) is discharged.

**Ceiling deckplate moiré — fixed, and it has left two new problems behind.** The hard interference
pattern is gone at both angles I could find it at. In its place:

| | Luma | RGB | Local SD |
|---|---|---|---|
| Ceiling looking straight up (`p3b-ceiling`) | 26.2 | 26 / 25 / 42 | **1.0** |
| Ceiling at grazing angle (`p3b-spawn`, top band, HUD-free) | 98.4 | 82 / 102 / 117 | 37.2 |
| Floor, near camera, same frame | 156.7 | 150 / 158 / 168 | 17.3 |

Straight up, the ceiling is now a **dead flat navy field** — SD 1.0 is as featureless as a surface
can measure, and it is the largest single surface in that frame. At a grazing angle it is soft
blue-grey streaking, cool in hue (blue leads red by 35) and busier than the floor it faces, so the
top 15% of `p3b-spawn` reads as overcast sky rather than as a roof. Trading a moiré for a sky is a
good trade; neither endpoint is finished.

**A correction against myself, made before this section was filed.** The first version of that table
put the grazing ceiling at luma 158.2 and called it brighter than the floor. It is not: my sample
rectangle spanned the quota readout, and I had measured the HUD's white text. Clear of the HUD the
same band reads 98.4, i.e. **darker** than the floor at 156.7. The claim was wrong in its direction,
not merely its magnitude. Rubric §4 says every metric here is a proxy and three had already been
caught measuring something other than what they claim; this is the fourth, it is mine, and it was
caught only because the number looked surprising enough to re-sample. Sample rectangles must be
checked against the HUD overlay before their contents are believed.

### Still present, re-confirmed on the new build

* **The navy mass in `p3b-racking`** — luma **25.3**, RGB 26/24/40, still a featureless slab across
  the lower centre running off the bottom edge. Darker than pass 3 measured it, not better.
* **The deck-rib starbursts** — the ceiling lamp fans in `p3b-racking` measure luma 112.4 at local
  SD **46.7** against a ceiling of 67.3. Still owning the upper third, still reading as smeared
  radiating streaks.
* **The bloom clip** — the van lamp core measures a **mean** of 239.6 (`p3b-pit`) and 242.3
  (`p3b-floor`) over an 80×90 box, and `p3b-floor` clips **0.8%** of its pixels, marginally worse
  than pass 3's 0.7%. The emitter still has no shape inside its halo. This remains the smallest,
  highest-value fix in the document.
* **The green wireframe extraction gizmo** — still drawn, clearly visible inside the van in
  `p3b-pit`, `p3b-floor` and `p3b-ceiling`.

### New, and it did not exist in pass 3's frames

**The extraction volume now reads as a swimming pool.** Where pass 3 saw a green wireframe cuboid,
there is now also a filled green basin on the warehouse floor — bright (luma **176.9**, RGB
165/184/146), kerbed, with a pale plank laid across it — and in `p3b-dock` and `p3b-spawn` it is the
brightest large object in frame. It is confidently rendered and it is the wrong object: a lit green
basin with a board over it is a paddling pool, in a dry warehouse, and it is the volume the entire
game loop is about. This is not an improvement on the wireframe. A wireframe reads as unfinished; this
reads as finished and wrong, which is harder to see and worse to ship.

**The dock pile-up bug could not be observed.** Every frame in this set sits at £0 of £5,200 with
nothing extracted, so no delivered stock exists to pile up. Neither confirmed nor denied — and it
has since been fixed in `b574c94`, "Paid-for stock stops being furniture", which landed while this
section was being written. A frame that shows a part-filled van remains ungraded by anyone; the
harness never plays far enough into a job to produce one, which is a gap in the capture set rather
than in the build.

### The statistics did not move, so the pass-3 letters stand

| Metric | Pass 3 range | Pass 3b range | Verdict |
|---|---|---|---|
| Median luma | 29.6–126.3 | 29.6–121.4 | unchanged |
| Crushed (L≤4) | 0.0 | 0.0 | unchanged |
| Clipped (L≥250) | 0.0–0.7 | 0.0–**0.8** | marginally worse |
| Chromatic (S>0.15) | 48.4–95.3 | **48.8**–95.4 | unchanged |
| Dominant hue share | 42.1–58.1 | 39.6–**58.2** | unchanged |
| Hue families | 3–5 | **3**–6 | unchanged |
| flat% | 54.3–72.4 | 56.7–75.0 | unchanged |
| tex% | 25.6–43.2 | 23.1–40.7 | unchanged |

**C1 re-measured on the new build**, two unshadowed patches of the same concrete per frame, per
rubric v1.1:

| Frame | Bright | Dark | Ratio |
|---|---|---|---|
| `p3b-dock`, floor near vs right mid | 110.2 | 92.4 | **1.19 : 1** |
| `p3b-pit`, floor near vs left | 147.9 | 122.3 | **1.21 : 1** |
| `p3b-spawn`, floor near vs left mid | 156.7 | 118.0 | **1.33 : 1** |
| `p3b-spawn`, floor near vs far wall | 156.7 | 68.8 | *2.28 : 1, confounded by fog* |

Only the last clears the 2:1 floor and it does so by measuring aerial perspective rather than
lighting, which is precisely the class of error rubric §4 was written about. **C1 remains F and it
remains the top fix.** Nothing in this re-shoot changes the priority order; fix #3 is now
approximately one-third discharged.

### The `hzw-t370` arbitration, verified by eye and re-measured

You asked whether that frame contains a specular highlight or is just teal, and said a metric could
not answer it. Agreed, so I looked at the file, and then measured what I had looked at.

| Region of `hzw-t370.png` | RGB | Luma | Local SD |
|---|---|---|---|
| Water body, bulk | 40 / 92 / 90 | 80.6 | 27.1 |
| Water **surface band** (y 240–268) | 51 / 119 / 113 | 103.8 | **11.9** |
| Compact bright core at ~(640, 435) | **162 / 163 / 161** | 162.4 | 26.2 |
| Water 40 px to the left of that core | 77 / 103 / 101 | 97.1 | 31.9 |

**The answer is: the frame is not just teal, and it does not have a specular highlight on the water.**
Both halves matter.

There is a genuine compact near-neutral bright feature in it — RGB 162/163/161 is neutral to within
two levels, sitting 65 luma above the water 40 px beside it. Against a body that is strongly teal
(red at 43% of green) that is exactly what a specular signature looks like to a metric, and your
highlight-neutrality check is passing for a real reason rather than a rounding one. But looking at
the frame, that neutral core is a submerged light and its bloom sitting on the tank floor behind a
red-topped crate. It is an emitter. It would be in that frame whether or not water reflected
anything at all.

The surface itself — the horizontal plane the metric is nominally about — is teal at 51/119/113 and
smooth at SD **11.9**, with no reflected image of the lamp, the walls or the rig anywhere along it.

So the metric is sound and the thing you hoped it protected is absent. **Do not nudge the 1.45
threshold; it is not the problem.** Add a check that is actually about the surface: inside the
surface band only, require the top 1% by luma to be within 20% of neutral *and* clustered inside
~40 px. That check fails today, correctly, and it cannot be satisfied by an emitter somewhere else
in the frame. Keep the whole-frame cast printed, blocking on dry levels where a cast is a bug and
non-blocking on flooded ones where it is the subject.

---

# Fourth grading pass — 2026-08-09

**Date:** 2026-08-09, captures 12:49–13:05 UTC.
**Graded against:** `docs/visual-rubric.md` **v1.1** — same version as pass 3, so pass 3, pass 3b
and this pass are directly comparable throughout.
**Build graded:** HEAD `bdf209a` plus uncommitted changes to `art/materials.js`, `art/post.js`,
`art/figure.js`, `worldview.js` and `main.js`; bundle **`index-qEebbyCl.js`** (2,198.90 kB) +
`three-Db8soB1n.js` (491.20 kB), built by me at 12:48 UTC.
**Staleness, as usual:** by 13:07 the tree had been rebuilt to `index-DdbG-IWd.js`. This grade
describes `index-qEebbyCl.js` and nothing later.
**Frames:** `crit4/hz-{spawn,floor,racking,pit,dock}.png`, `crit4/hzf-{idle,walk,haul,down,head,lineup}.png`,
`crit4/hzw-{t000,t130,t280,t370,under}.png`, on ports 4231/4232/4233. Every shot was copied into
`crit4/` the instant it was taken, because three of us were running harnesses against the same
output filenames and half of what was on disk when I started belonged to somebody else.

**Honesty statement unchanged and still binding.** I have not installed, run or played R.E.P.O. or
PEAK, and no side-by-side capture was performed or is possible in this container. The R.E.P.O.
column is measured from the seven `refs/repo/fovupdate-*.jpg` files downloaded from a public git
repository; the PEAK column from the four `refs/peak/*.png` files. I re-fetched
`fovupdate-iconog.jpg` this pass as a third independent verification — HTTP 200, 187,097 bytes,
byte-identical to the copy on disk. I also looked at `fovupdate-example1.jpg` and
`fovupdate-example4.jpg` directly this pass rather than quoting the table, because a number I have
not re-seen is a number I should not be leaning on.

**No new reference material could be obtained.** `api.github.com` search endpoints are now blocked
for this session (403, "sessions are bound to their configured repositories"), and Steam, Wikipedia,
Fandom, YouTube and the publishers' own sites remain blocked at CONNECT. `raw.githubusercontent.com`
still works for known paths, which is the only reason the R.E.P.O. set exists at all. Two candidate
PEAK mod repositories were checked for README imagery and had none.

## Overall: **D+ → D+**

The letter has not moved, and that is the wrong summary of what happened. Two of pass 3's five fixes
landed properly and one of them is the biggest single art improvement in the project so far. Against
that, the plant's water has stopped rendering entirely, the bloom clip got worse for the third pass
running, and the frames have gone brighter and greyer. It is a build that is being improved in one
place and broken in another at roughly the same rate.

| Criterion | P1 | P2 | P3 | **P4** | |
|---|---|---|---|---|---|
| C1 Lighting / bounce | F | B− ✗ | D− | **D** | ▲ 1.40 → 1.55:1, still under the 2:1 floor |
| C2 Contact shadows | F | B− | C | **C** | ▬ grounded, but the shadows are the wrong colour |
| C3 Material variety | F | C+ | C | **C+** | ▲ and would be higher if the water compiled |
| C4 Texture presence | F | C | C | **B−** | ▲▲ the one unambiguous win |
| C5 Tonal range | F | D | C− | **C−** | ▬ crush stays fixed, clip gets worse |
| C6 Post chain | F | C | D+ | **D** | ▼ bloom worse again |
| C7 Silhouette at 10 m | C | C | C− | **C** | ▲ hat identity landed |
| C8 Composition / depth | F | C | C− | **C−** | ▬ |
| C9 Colour discipline | F | C− | D+ | **D** | ▼ |

✗ = a grade I later found to be wrong. Pass 2's C1 B− rested on a 2.1:1 key-to-fill taken by
sampling a cast shadow as the fill patch. C1 has never been above D on an honest measurement.

## Three notes on the instrument before any grade rests on it

**1. I got a measurement wrong again this pass, and caught it.** I tried to establish the
key-to-fill from a screenshot by placing rectangles on what I took to be shadow streaks and lit gaps
in `hzf-lineup`. The results were self-contradictory — a "shadow" at luma 163.9 next to a "gap" at
131.1 — which means I could not reliably tell one from the other by eye at full size. **That
measurement is retracted in full.** The key-to-fill quoted below is the harness's own top-down
`floorPatch` probe, which places its samples by world coordinate and photographs each one. This is
the fifth proxy in this document caught measuring something other than what it claims.

**2. So I built `crit4-crop.js`.** It crops a rectangle, magnifies it with nearest-neighbour, writes
it as a PNG and prints the mean of exactly the pixels it just wrote. Any region quoted in this pass
was looked at before its number was believed. `crit4/zoom-crew.png` and `crit4/zoom-floor.png` are
the two that mattered.

**3. The vignette proxy is confounded on three of five frames, again.** `corner ÷ centre` reads
4.042 on `hz-spawn`, 2.784 on `hz-racking` and 1.907 on `hz-dock`. Those frames have dark subject
matter dead centre and lit walls in the corners; the number is measuring composition. Only
`hz-floor` (0.478) and `hz-pit` (0.842) are valid. I am not scoring the other three numerically, and
I say what I saw instead.

## Measured, this build against both references

| Metric | v1.1 target | P3 range | **P4 range** | R.E.P.O. | PEAK |
|---|---|---|---|---|---|
| Draws / triangles | — | — | 137–165 / 48.1k–55.0k | — | — |
| Median luma | 55–110 | 29.6–126.3 | **45.5–141.9** | 7.1–11.7 | 70.5 |
| Crushed (L ≤ 4) | < 2% | 0.0 | **0.0–0.1** | 1.2–3.7 | 0.0 |
| **Clipped (L ≥ 250)** | **0.0%** | 0.0–0.7 | **0.0–1.3** | 0.0 | 0.0 |
| Darkest-5% RGB | lifted, tinted | — | [5,4,8] – [23,21,38] | [2,3,3]–[4,4,7] | [35,32,58] |
| Shadow channel spread | — | — | 3.9–16.4 | 1.6–3.9 | 26.3 |
| Mean saturation | 0.25–0.55 | — | **0.140–0.410** | 0.39–0.54 | 0.392 |
| **Chromatic (S > 0.15)** | **≥ 90%** | 48.4–95.3 | **25.4–94.1** | 90.0–99.4 | 98.9 |
| **Dominant hue share** | **< 33%** | 42.1–58.1 | **29.0–50.7** | 19.0–31.2 | 26.3 |
| **Hue families (> 3%)** | **≥ 5** | 3–5 | **4–11** | 5–10 | 7 |
| Flat (SD < 2) | ≤ 70% | — | **44.0–80.4** | — | 63.1 |
| Textured (SD 2–25) | ≥ 25% | — | **18.7–47.0** | — | 36.1 |
| Texture feature size | — | — | 2.2–2.7 px @720p | 3.15 px @1080p | 2.05 px @768p |
| Local relative contrast | — | — | 0.076–0.093 | 0.073 | 0.043 |
| Key : fill, same material | ≥ 2:1 | 1.01–1.40 | **1.55:1** | 3.2:1 / 11.6:1 | — |

All four of v1.1's hard requirements still fail on at least one frame: clipping on three frames,
chroma below 90% on six, dominant hue above a third on nine, and fewer than five hue families on
three.

## Criterion by criterion

### C1 — Lighting and indirect/bounce — D− → **D**

Key-to-fill is **1.55:1**, from the harness's own world-placed top-down probe (key 0.6121 under the
north-west lamp, fill 0.3960 on open floor 14 m from any lamp, both linearised). It has moved from
1.01–1.40 and it is still under the 2:1 rubric floor and a long way under R.E.P.O.'s 3.2:1 on one
stone wall.

**The specific question I was asked — does it read as a lighting design, or just as more contrast?**
Neither, yet. It reads as a wash with one blown source in it, and I can point at why rather than
just assert it:

* In `hz-racking` and `hz-spawn` the ceiling lamps produce large soft pools **on the ceiling**, and
  nothing identifiable on the floor beneath them. That is the fail mode C1 names by name: light
  landing on the emitter's own surface and not on the surface it is meant to illuminate.
* There is exactly one source with authority in the whole level — the cool dock lamp — and it is
  clipped, so it contributes a white hole rather than a key.
* There is nothing doing the work of a rim. No figure in any of the six figure frames has a lit
  edge, and against the near-white dock wall in `hzf-lineup` the pale hats lose their outline
  entirely.

For comparison, and this is a frame I opened and looked at this pass rather than a row in a table:
`refs/repo/fovupdate-example1.jpg` puts two warm sconces on a vaulted stone wall, and you can see
the design in one glance — a bright pool immediately around each sconce, a fast falloff along the
same wall, the arch soffits in deep shadow, a lit wedge of floor running to the far door, and the
right-hand third of the frame at essentially zero. Warm key, cold near-black fill, and the eye is
led to the objective by light alone. Nothing in HAZARD PAY's ten frames does any of that.

**The trap in the ratio, since you named it.** You are right that 4:1 can be reached by turning the
fill down until the room is unreadable, and that would be the same failure as brightening until a
luma floor passes. Two guards: the frames must keep `crush%` under 2 (they are at 0.0–0.1 now, so
there is a great deal of room to take the fill down before anything goes empty), and the *lit pools
must land on the floor*. A room where the gaps are dark and every lamp throws a legible ellipse on
the concrete under it is a design. A room that is uniformly darker is not, and the ratio cannot tell
them apart — which is why the ceiling-pool observation above is the check that matters, not the
number.

### C2 — Contact shadows and grounding — C → **C**

Grounding is real and holds: every figure in `hzf-idle`, `hzf-head`, `hzf-down` and `hzf-lineup`
has a dark contact pool under the boots, and the ragdoll keeps one while lying at 45°. Small props
— the mug, the floor cans in `hz-dock` — are grounded too, which is the class this game is about.

Held at C, and the reason is new: **the shadows are the wrong colour and the wrong shape.** On the
verified crop `crit4/zoom-floor.png` (600×150 of the near floor in `hzf-lineup`, mean RGB
129/136/125, green-dominant) the shadowed concrete reads khaki. Concrete with a warm key removed
should fall towards the cool ambient; instead it falls to olive, and at full frame the near floor
reads as a football pitch. The same crop shows the shadow boundaries are hard straight cuts with
essentially no penumbra, from the single 512×512 point-light caster, while elsewhere the frames
carry large soft dark blobs with no caster in shot that read as stains rather than as shadows.

### C3 — Material variety — C → **C+**

Four response classes are present and legible: matte concrete, semi-gloss on the hat shell, metal
on the racking uprights and the plant's grating stair treads, and emissive on the lamps. The
galvanised perforated stair treads in `hzw-under` are the best-read material in the build.

It would be higher if the one genuinely reflective surface in the game rendered — see the water
finding below. As it stands the build still has no visible reflection of the scene in anything, and
materials remain uniform within a surface, with the honourable exception of the plant's tank walls,
which carry large-scale damp blotching and are the closest thing here to authored wear.

### C4 — Texture presence — C → **B−**

The one unambiguous win, and it is a large one.

| | P2 | P3/3b | **P4** | PEAK | R.E.P.O. |
|---|---|---|---|---|---|
| Flat (SD < 2) | 7.1–18.9% | — | **44.0–72.7%** | 63.1% | — |
| Textured (SD 2–25) | 79.7–90.2% | — | **24.7–47.0%** | 36.1% | — |
| Feature size | 4.3–5.4 px | — | **2.2–2.7 px** | 2.05 px @768p | 3.15 px @1080p |
| Local relative contrast | — | — | **0.076–0.093** | 0.043 | 0.073 |

The warehouse now straddles PEAK's flat/textured split instead of sitting an order of magnitude the
wrong side of it, and the local relative contrast sits on R.E.P.O.'s value rather than PEAK's, which
is the right reference to be near for an interior. Slab joints and bay markings are present and
legible. This is what pass 1's third priority asked for, arrived at properly.

**Close the "texture scale 2–4× too fine" item. The metric no longer supports it.** Normalised for
frame width, the references sit at roughly 1.9 px (PEAK) and 2.1 px (R.E.P.O.) against this build's
2.2–2.7. If anything the build is now marginally the *coarser* of the three. Whoever is about to
coarsen UVs on the strength of that line should stop; the remaining texture complaints are pattern
and artefact, not scale.

Held at B− by three things, none of them scale: the ceiling starbursts (below), the aliasing on the
fine vertical wall corrugation at grazing angles, and — still present in the plant, though gone from
the warehouse — the wandering closed-loop squiggles, clearly visible in red on the dark prop at the
bottom of `hzw-under`. Pass 3b's "fixed" applies to the warehouse concrete only.

### C5 — Tonal range and exposure — C− → **C−**

The black point stays fixed: `crush%` is **0.0–0.1** across all five warehouse frames, holding pass
3's gain, and the darkest 5% on `hz-spawn` and `hz-dock` reads [23,21,38] and [21,19,35] at channel
spreads of 16.4 and 15.7 — lifted and blue-violet, the closest this build has ever been to PEAK's
[35,32,58] at 26.3. That is a genuinely good grade in the shadows.

Everything else went the wrong way. **Clipping is now on three frames** — `hz-floor` 1.1%,
`hzf-head` 1.3%, `hzf-lineup` 0.8% — against 0.7% in pass 3 and 0.8% in pass 3b, and against
**0.0% on every one of the eleven reference files**. Neither reference clips a single pixel, ever;
this is the one place where the two of them agree completely and the build disagrees with both.
Median luma has risen to 45.5–141.9, so `hz-dock` at 118.9 and `hzf-head` at 141.9 now sit above the
55–110 band, and `hz-racking` alone did not get the shadow lift (darkest-5% [5,4,8], spread 3.9).
Net: one failure mode traded for its opposite, and the grade stands still.

### C6 — Post chain — D+ → **D**

**Bloom is the problem and it is worse for the third pass running.** The halo probe returns 96 px —
its own search cap — on `hz-spawn`, `hz-floor` and `hz-dock`, and the visual is unambiguous: in
`hz-floor` the dock lamp is a pure-white core with no shape inside a halo that spans a quarter of
the frame width, and the corrugated wall behind it is washed to blank paper across its full width.
`hzf-head` and `hzf-lineup` show the same lamp doing the same thing.

Against the reference, and this is a verified crop rather than an impression —
`crit4/zoom-sconce.png`, a 200×150 region of `example1` around the left sconce at 3×. The emitter is
a green fluorescent tube about 12 × 60 px. **It keeps a hard rectangular edge and a distinctly green
core; it does not go white.** Its mounting bracket is a fully readable dark silhouette immediately
beneath it. There is a warm glow on the stone reaching perhaps 60–70 px, but the masonry relief
stays legible right up to within about 10 px of the tube: that is *light landing on a textured
surface*, not a screen-space ball. And the frame clips 0.0%. R.E.P.O. bloom does not destroy what is
behind it. This one is not subtle and it has now been the smallest, highest-value item in three
consecutive passes.

**Correction, filed rather than quietly amended.** The first draft of this paragraph put R.E.P.O.'s
halo at "roughly 15–25 px at 1920" from memory of the frame. That was an unverified eyeball figure
and it is too small — the glow reaches two to three times that. It also contradicted v1.1's own
R.E.P.O. table, which reports 12–96 px, and the contradiction is what prompted the crop. **The
comparison that survives is qualitative and it is the one that matters: the source keeps its shape
and its hue, and the surface behind it keeps its texture.**

While there: the halo probe locates the brightest pixel in the *whole* frame and measures downward
from it. On these R.E.P.O. captures the brightest pixel is the HUD's green `+100`, not a sconce, so
the 12–96 px range in the v1.1 table is at least partly measuring HUD glow. Treat that row as
unreliable for both games until the probe is given a region to search within. That is a sixth proxy
caught pointing at the wrong thing.

Vignette: valid readings are 0.478 (`hz-floor`) and 0.842 (`hz-pit`), both in band. The three
confounded frames are not scored, but what I can say by eye is that the top corners of `hz-spawn`
and `hz-dock` are *brighter* than the frame centre, and R.E.P.O. runs 0.27–0.78 with corners at
essentially zero. The vignette is present but weak, and it is not holding the eye in.

AO and grade are both doing visible work and are not what is holding this criterion down.

### C7 — Silhouette at 10 m — C− → **C**

**Pass 3's fix #4 landed and it works.** `crit4/hzf-lineup.png` puts five contractors at roughly
8–12 m with five clearly distinguishable hat hues — purple, sage, magenta, teal, green — and at that
distance the hat is doing exactly the job it was moved there to do. Identity now reads.

**And the face works.** `hzf-head` finally caught the model looking at the camera, and the eyes are
the best piece of art in the build: two large white spheres with heavy dark pupils and a clean
specular, unambiguous, and squarely in the R.E.P.O. idiom of big features on a simple body. They
need nothing.

What is holding this at C is visible in the verified magnification `crit4/zoom-crew.png`:

* **The hats do not read as hard hats.** Flat-disc brims where there is a brim at all, no crown rib,
  no peak, a matte speckled finish that reads as felt or icing, and they sit high and far back so a
  large bare tan skull shows all round. At 10 m the crew reads as garden gnomes in hi-vis.
* **The vest front is incoherent.** In `hzf-head` the chest is a jumble of pale rectangles, an empty
  red-outlined badge and black panels with no hierarchy. From behind it is fine — orange field, two
  bands — which is what the front should also be.
* **Trousers introduce a second saturated identity colour** (strong green on some builds) that
  competes with the hat, directly against the intent recorded in `figure.js`'s own header comment.
* **Still no rim or edge cue**, so against the near-white dock the pale hats lose their outline.
* The eight builds differ on paper but at 10 m all five silhouettes are the same egg-on-a-post.

### C8 — Composition and depth — C− → **C−**

Fog is doing real work and the three depth bands are distinguishable in every warehouse frame.
Against that: `hzw-t370` gives over a third of the frame to a featureless grey deck slab with no
detail and nothing occluding, which is the rubric's single-plane failure in all but the last few
per cent; `hz-spawn` does something similar with the near floor. Near-field framing elements remain
absent from every standard angle except `hz-racking`, where the piano provides one — and the piano
is a black wedge with no surface detail at all, so it frames the shot as a hole rather than an
object. `hz-spawn` also carries a pale cloud-like band across the top of frame above the ceiling
line, which breaks the interior read completely.

### C9 — Colour discipline — D+ → **D**

Chroma is the failure. Six of the ten frames carry chroma on under 90% of pixels and four are under
50%: `hzw-t000` and `hzw-t370` at **25.4%**, `hz-pit` at 38.4%, `hz-floor` and `hzf-head` at 44.8%.
The references sit at 90.0–99.4% (R.E.P.O.) and 98.9% (PEAK) — they agree with each other and the
build agrees with neither. Mean saturation runs 0.140–0.410 against 0.39–0.54 and 0.392. This build
is markedly greyer than both of its references, and pass 2's warning applies exactly: chasing the
look by desaturating lands on grey mush.

Dominant hue share is 29.0–50.7% against a reference band of 19.0–31.2%, and three frames carry
fewer than five hue families. The unintended khaki in the floor shadows (C2) is a hue nobody chose.
Hazard yellow-and-black is used well and sparingly, and is the one piece of colour discipline in
the build that is working.

## The plant: the water does not render at all

This is the largest single finding of the pass and it is a regression against a fix.

`waterMaterial()`'s `MeshPhysicalMaterial` **fails to compile**. Both program variants throw in the
fragment shader:

```
THREE.WebGLProgram: Shader Error 0 — VALIDATE_STATUS false
Material Type: MeshPhysicalMaterial
Program Info Log: Fragment shader is not compiled.
FRAGMENT   ERROR: 0:1583: 'geometr…
```

The consequence is total: **there is no water in the flooded level at any point on the curve.**
`hzw-t000` (sump dry, water y = −4.40) and `hzw-t370` (water y = +0.35, nominally over the deck)
are identical to within 0.1 in every statistic I measure — p50 129.9 vs 129.8, saturation 0.140 vs
0.140, 11 hue families each — and the harness's own `the water is visible in the frame` assertion
fails with a channel delta of **0.0** between a dry sump and a full one. Looking at `hzw-t370`
directly: the tank is visibly dry. You can see the concrete tank floor, the stairs running down into
it, a crate standing on the bottom, and the damp blotching on the walls. There is no surface, no
waterline and no submersion.

So the answer to last pass's arbitration has been overtaken. You were right to fix the surface
rather than the threshold, and the diagnosis of `pow(nh, 700)` was almost certainly correct — but
the replacement does not compile, and the shader injection is referencing a symbol that is not in
scope at that point in the physical material's fragment chain. **Until it compiles there is nothing
to grade, and the new surface-band check will fail for a second, different reason than the one it
was written to catch.** That is worth knowing before the check's failure is read as evidence about
the water's appearance.

The underwater wash does still work, and it is thin: `hzw-under` is a uniformly milky sage-green
frame with 80.4% of pixels flat, chroma on 82.6% and everything compressed into a narrow bright
band. It reads as a smoke-filled room, not as being underwater. No caustics, no particulate, no
surface overhead, no shafts.

Separately, and to its credit: the plant's tank interior is the strongest environment art in the
project. Large pale concrete panels with damp blotching at a believable scale, galvanised perforated
stair treads that read as galvanised perforated stair treads, and hazard-striped and green-piped
accents in the upper frame. If the warehouse looked like the inside of that tank the overall grade
would be a full letter higher.

## Confirmations, corrections and things that have not moved

**Confirmed still present:** the deck-rib starbursts, which own the upper third of `hz-racking` and
`hz-dock` as fans of smeared brown streaking; the navy mass in the upper corners of `hz-spawn`,
`hz-dock` and `hzf-down`; aliasing on the fine vertical wall corrugation at grazing angles; the
squiggly-loop pattern, in the plant only.

**One diagnostic offered on the starbursts**, since they have survived three passes. They are
*radial about each lamp*, not uniform across the deck. That pattern is what a high-frequency relief
term does when a point light sits almost in the plane of the surface it is lighting: every fragment
picks a different specular answer and the noise fans out from the source. If that is right, the
lever is the ceiling's relief strength or the lamp's height off the deck plane, not the tiling — and
`materials.js` already carries `deckplate.bump: 1.5` and a comment about fading relief edge-on, so
the fade may simply not be aggressive enough. Offered as a hypothesis; I did not test it, and I do
not modify game code.

**The extraction volume still reads as a swimming pool, and it is now unmistakable.** In `hz-spawn`,
`hz-dock` and `hz-racking` it is a lit mint-green basin with a kerb and a pale plank across it, and
in two of those frames it is the brightest large object in shot. Pass 3b called this; nothing has
changed except that it has become more confidently rendered. This is the volume the entire game loop
is about and it currently looks like a paddling pool.

**Harness note, offered rather than fixed.** `hz-fig2.js` cannot hold the figure's facing. Its
`YAWTRACE` shows `actorYaw` following `pendingInput.yaw` one sample later on every tick, so the
`b.yaw = Math.PI` set immediately before the head shot is overwritten within a tick or two. This
pass the shot happened to catch the model face-on; last pass it did not, and three of pass 3's
figure frames were the back of the head. The face is where the whole design lives and whether it
gets photographed is currently luck. Freeze or overwrite `pendingInput` for the duration of the
posed shots.

## Top five fixes for a fifth pass, in priority order

### 1. Make the water compile.

`worldview.js` `waterMaterial()` — the `MeshPhysicalMaterial` fragment shader fails to compile with
`ERROR: 0:1582/1583: 'geometr…'` on both program variants, and the flooded level therefore renders
with no water at any clock value. `hzw-t000` and `hzw-t370` are identical to 0.1 in every channel
and the harness's own visibility assertion fails at a channel delta of 0.0. The injection is
referring to a symbol that is not in scope at that chunk in three's physical chain. Nothing about
the flood — surface, reflection, waterline, the new surface-band check — means anything until this
builds.

### 2. Gate and tighten the bloom. Third pass of asking, and it got worse again.

`hz-floor` clips 1.1% of its pixels (0.7% → 0.8% → 1.1% across three passes) and the halo probe
saturates at its 96 px cap on three frames. The dock lamp arrives at the composite as a shapeless
white ball and takes the wall behind it with it. Raise the threshold so only the emitter clears it,
cut the radius substantially, and clamp the emissive so the core keeps its hue. **Target, stated as
a picture rather than a number because the halo probe is not trustworthy** (see C6): `clip%` 0.0 on
every frame; the fixture still has a recognisable shape and a colour other than white inside its own
glow; and the wall behind it still shows its texture. `crit4/zoom-sconce.png` is what that looks
like in the reference.

### 3. Take the fill down; make the lamps land on the floor.

Key-to-fill is 1.55:1 against a 2:1 floor. Do it by reducing `AMBIENT_GAIN` and the hemisphere
intensity, not by raising `LIGHT_GAIN`: median luma is already 45.5–141.9 against R.E.P.O.'s 7.1–11.7
and `crush%` is at 0.0–0.1, so there is a great deal of headroom to darken before anything empties
out. Then fix what the ratio cannot see — the ceiling lamps currently pool on the ceiling and put
nothing identifiable on the floor. Drop the fixtures below the deck plane or give them a downward
cone so each one throws a legible ellipse on the concrete. **Grade this by looking at whether the
pools land, not by the ratio**; the ratio can be hit by turning the room off.

### 4. Fix the shadow colour, then the shadow edge.

Verified on `crit4/zoom-floor.png`: shadowed concrete reads khaki-green at RGB 129/136/125, with
hard straight boundaries and no penumbra. Concrete out of a warm key should fall to the cool
ambient. Check the hemisphere ground colour `#2b2521` against the concrete albedo — a warm-brown
bounce over a slightly green-grey slab is the obvious candidate — and either raise the point light's
shadow map above 512² or blur it, so the edge stops being a straight cut across the floor.

### 5. Make the hat a hard hat; make the vest front one shape.

Verified on `crit4/zoom-crew.png`. Add a crown rib and a shaped peak, seat the hat lower so less
skull shows, and drop the speckle so it reads as moulded plastic rather than felt. On the front,
replace the jumble of pale rectangles and the empty red-outlined badge with one hi-vis field and two
bands — the back of the same figure already does this and reads correctly. Remove the second
saturated identity colour from the trousers. Add a rim or edge cue, which is still the only thing
that will hold a contractor off the near-white dock wall. **Do not touch the eyes.**

### Also worth doing, below the line

* The extraction volume (fix 5 of pass 3, unactioned): it is a mint paddling pool with a plank
  across it, and it is the most important object in the game.
* Chroma: six of ten frames sit under 90% chromatic and four under 50%, against 90–99% on both
  references. The build is greyer than either reference, not more disciplined than them.
* `hz-spawn` carries a pale cloud band across the top of frame above the ceiling line.

---

# Fifth grading pass — 2026-08-17

**Date:** 2026-08-17, captures 08:47–09:30 UTC.
**Graded against:** `docs/visual-rubric.md` **v1.2**. v1.2 adds C10 and §5 and moves no threshold on
C1–C9, so pass 4 and pass 5 are directly comparable on all nine of the old criteria.
**Build graded:** HEAD `3965a08`, clean tree, bundle **`index-Co9EO8LB.js`** (2,210.79 kB) +
`three-fM-4CLaN.js` (491.20 kB), built by me at 08:44 UTC.
**Staleness — I wrote "for once, not a caveat" here and had to come back and correct it.** At
capture time it was true: every commit since the previous set touched only `server/smoke.js` and
`server/nettest.js`, and `git log -- hazard/client` put the last client change at `da3a93d`, before
this build. By 09:06 UTC, while I was writing this up, `art/figure.js`, `art/materials.js` and
`art/textures.js` had all been modified and the tree rebuilt to `index-CY0dtNiO.js`. **This grade
describes `index-Co9EO8LB.js` and nothing later** — in particular, anything the art pass did to the
hats or the materials after 09:05 is not in these frames and is not in these letters.
**Frames:** `crit7/hz-{spawn,floor,racking,pit,dock}.png`, `crit7/hzf-{idle,walk,haul,down,head,lineup}.png`,
`crit7/hzw-{t000,t130,t280,t370,under}.png`, plus `crit7/hzp-{key,fill}.png`, `crit7/pool-lamp{0,1}.png`
and `crit7/kf-*.png`. Ports 4271–4274 and 4281–4282. Warehouse renders at 165 draws / 55,333 tris,
the plant at 138 / 48,319.

**Honesty statement, unchanged and still binding.** I have not installed, run or played R.E.P.O. or
PEAK, and no side-by-side capture was performed or is possible in this container. The R.E.P.O.
column is measured from the eight `refs/repo/fovupdate-*.jpg` files; the PEAK column from the four
`refs/peak/*.png` files. I opened `fovupdate-example1.jpg` again this pass rather than quoting the
table, because the lighting question I was asked is answered by that frame and by nothing else here.

**No new reference material could be obtained, and one more route is now closed.** The egress proxy
still answers 403 at CONNECT for Steam, Wikipedia, Fandom, YouTube and the publishers' sites. I
tried the GitHub route again — the one that produced the R.E.P.O. set — and the MCP GitHub tools now
refuse any repository outside this session: *"Access denied: repository … is not configured for this
session."* Two mod repositories that would have been worth checking could not be listed. The
reference set is what it is and is unlikely to grow.

---

## The three questions I was asked, answered first

**1. Does `hzw-t370` have a specular highlight in it now, on my own check?** **Yes.** Verified, and
this is a real change rather than a threshold moving.

**2. Do the lamp pools land on the concrete, and does it read as key, fill and rim — or as more
contrast?** **The pools land. It reads as key and fill. The rim is nominal.** The ratio you reached
is smaller than reported and the route you took to it did not damage the room.

**3. Does the rubric say whether the game plays?** **It did not, and that was a real omission.** It
now says something narrow and honest: **C10** grades whether one frame tells a player what the job
is, and **§5** states plainly what a stills instrument cannot see and forbids inferring play quality
from a good-looking frame. See both at the foot of `visual-rubric.md`. C10's first grade is below and
it is the worst grade in this document, for a reason that has been sitting in plain sight for four
passes.

---

## Overall: **D+ → C−**

The first genuine upward step since pass 2, and unlike pass 2's it survives re-measurement. Three
things that had been open for three passes are closed: the water compiles and reflects, clipping is
at **0.0% on all eleven frames**, and the lamps illuminate the floor instead of the ceiling. Against
that, one criterion arrives at F on its first grading, the hats have got worse rather than better,
and the single most important object in the game — the van — is a featureless pale slab.

| Criterion | P1 | P2 | P3 | P4 | **P5** | |
|---|---|---|---|---|---|---|
| C1 Lighting / bounce | F | B− ✗ | D− | D | **C** | ▲ 2.2–2.7:1, pools land, rim nominal |
| C2 Contact shadows | F | B− | C | C | **C+** | ▲ penumbra appeared; colour still wrong |
| C3 Material variety | F | C+ | C | C+ | **B−** | ▲ the water is the first real reflection |
| C4 Texture presence | F | C | C | B− | **B−** | ▬ flat/tex straddle PEAK; artefacts hold it down |
| C5 Tonal range | F | D | C− | C− | **B** | ▲▲ clip 0.0 everywhere, crush 0.0–1.5, p01 ≥ 4 |
| C6 Post chain | F | C | D+ | D | **D+** | ▲ bloom no longer clips, still fires on a wall |
| C7 Silhouette at 10 m | C | C | C− | C | **C−** | ▼ hats worse; torso ΔL 20.9 |
| C8 Composition / depth | F | C | C− | C− | **C−** | ▬ sky band, empty planes, black piano |
| C9 Colour discipline | F | C− | D+ | D | **D** | ▬ six frames under 65% chromatic |
| **C10 Playable legibility** | — | — | — | — | **F** | new — the hazard outshines the destination |

✗ = a grade I later found to be wrong.

---

## The instrument: three more errors, two of them mine, one of them mine twice

The count in rubric §4 was six. It is nine.

**7. The harness's key-to-fill samples a racking shelf and calls it floor.** `hz.js` places its key
patch at `(-14, -9)` with the camera 3.4 m above it looking straight down, and its comment states
that the top-down placement makes the sample *"guaranteed to be the floor and not a crate"*. It is
not. `racking(-15, -9, 4, 3)` in `warehouse.js` puts a `steelblue` deck across **y 2.10–2.19** at
that coordinate. The probe photographs a shelf from 1.2 m away — a different material, 2.1 m nearer
the lamp than the concrete it is being compared against. I did not deduce this from the picture; I
imported the level's own brush list and tested the point (`crit7-occupy.mjs`), and only then looked
at `crit7/hzp-key.png`, which is a smooth saturated orange plane with no slab joints, against
`hzp-fill.png`, which is grey concrete with joints and stains. Two materials, one ratio.

A top-down camera is guaranteed to see *whatever is underneath it*, which in this level is racking
under three of the five ceiling lamps. Only `(-14, 5)` and `(14, 5)` have a bright lamp over open
floor at all.

**8. My replacement probe let the job clock expire and measured two of its six samples behind the
DEBRIEF panel.** `crit7/kf-hz-key.png` from the first run is a screenshot of the results overlay
dimming the whole scene, and I had already written the numbers it produced into a table. Caught by
looking at the crop, which is the rule in §4. The first run's "as published 3.07:1" and "1.20×
inflation" figures are **retracted in full**; the numbers below come from a second run with
`clockTo(30)` before every sample and every frame confirmed at phase 2.

**9. I have called the inspection pit the extraction volume for two consecutive passes.** Pass 3b
and pass 4 both report that "the extraction volume reads as a swimming pool — a lit mint-green basin
with a kerb and a pale plank across it". `warehouse.js` puts `extract` at `[0, 2.05, 15.4]`: it is
**the van**, on the dock, behind the camera in two of the three frames I cited. The mint basin is
`box(..., tag: 'pitfloor')` with a `#9fffc0` flickering tube in it — an *inspection trench*, the
level's principal fall hazard, the thing the brief tells you to mind. Its plank is the escape route
added in `cc34a70`.

I am filing this rather than amending it, because it is the most useful error in the document. The
fix list it generated was pointed at the wrong object for two passes, and — far more importantly —
**a grader who had studied this level four times still read the hazard as the destination.** That is
not a note about my attention. That is the C10 result, arrived at accidentally and under the
strongest possible conditions.

---

## Measured, this build against both references

Whole-frame statistics over the HUD-free crop, `crit3-stat.js` / `crit3-stat2.js`.

| Metric | v1.2 target | P4 range | **P5 range** | R.E.P.O. | PEAK |
|---|---|---|---|---|---|
| Median luma (lit interior) | 45–110 | 45.5–141.9 | **27.4–96.7** | 7.1–11.7 | 70.5 |
| p01 luma | ≥ 3 | — | **4.0–22.3** | 3.5–4.0 | 33.5 |
| **Clipped (L ≥ 250)** | **0.0%** | 0.0–1.3 | **0.0 on all 11** | 0.0 | 0.0 |
| Crushed (L ≤ 4) | < 2% | 0.0–0.1 | **0.0–1.5** | 1.2–3.7 | 0.0 |
| Darkest-5% RGB | lifted | [5,4,8]–[23,21,38] | **[4,4,5]–[18,18,26]** | [2,3,3]–[4,4,7] | [35,32,58] |
| Shadow channel spread | — | 3.9–16.4 | **0.8–9.9** (27.2 on water) | 1.6–3.9 | 26.3 |
| Mean saturation | 0.25–0.55 | 0.140–0.410 | **0.149–0.650** | 0.39–0.54 | 0.392 |
| **Chromatic (S > 0.15)** | **≥ 90%** | 25.4–94.1 | **38.1–99.2** | 90.0–99.4 | 98.9 |
| **Dominant hue share** | **< 33%** | 29.0–50.7 | **20.0–49.8** | 19.0–31.2 | 26.3 |
| **Hue families (> 3%)** | **≥ 5** | 4–11 | **3–10** | 5–10 | 7 |
| Flat (SD < 2) | ≤ 70% | 44.0–80.4 | **47.3–80.2** | — | 63.1 |
| Textured (SD 2–25) | ≥ 25% | 18.7–47.0 | **18.7–48.5** | — | 36.1 |
| **Key : fill, floor v floor** | ≥ 2:1 | 1.55:1 ✗ | **2.23–2.74:1** | 3.2:1 / 11.6:1 | — |

One of v1.2's four hard requirements is now fully met (**nothing clips, on any frame, for the first
time**). The other three still fail on the worst frame: chroma below 90% on nine frames, dominant hue
above a third on seven, fewer than five hue families on two.

---

## Criterion by criterion

### C1 — Lighting and indirect/bounce — D → **C**

**The corrected number.** Floor concrete under a lamp against floor concrete 8.5 m from every lamp,
both points filtered against the level's brush list before rendering, all six crops photographed:

| Patch | linear luma | run 2 |
|---|---|---|
| `(-14, 5)` under the west lamp, open floor | 0.3906 | 0.4101 |
| `(14, 5)` under the east lamp, open floor | 0.4300 | 0.4404 |
| `(-8, -3)` 8.5 m from every lamp | 0.1423 | 0.1836 |
| `(8, -3)` 8.5 m from every lamp | 0.1766 | 0.1766 |
| **key : fill** | **2.44–2.74:1** | **2.23–2.49:1** |

**2.2–2.7:1 across two runs**, ±0.25 of run-to-run spread because a 240 px crop lands on varying
amounts of the floor's oil staining. That clears the 2:1 rubric floor honestly, for the first time in
the project. It is well short of the 4:1 MATCHES band and of R.E.P.O.'s 3.2:1 on a single wall.

**And the sample-placement bug turns out not to matter much.** The harness's deck-versus-floor pair
in the same run reads 2.43:1 against my 2.23–2.49:1 — the shelf inflates the key sample by about
**1.08×**. I found the error, it is worth fixing, and it does not overturn your result. Fix it because
the next lighting change will be graded against it, not because this one was wrong.

**I cannot reproduce 3.83:1.** Their own probe reports 2.79:1 and 2.83:1 on the two runs I have logs
for, and mine reports 2.2–2.7:1. If 3.83 came from the plant, or from an intermediate tree, say so;
if it came from this probe on the warehouse, one of us is measuring something else again.

**Now the part the ratio cannot see, which is what was actually asked.**

*Do the pools land on the concrete?* **Yes.** `crit7/pool-lamp0.png` stands the camera 6 m from the
north-west lamp and looks at the floor under it: warm sandy concrete, brightening toward the lamp,
and — the evidence that settles it — **the racking uprights cast long shadow bars across the floor,
radiating from the lamp position**. That is a light with a place in the room, not an ambient term.
Six passes ago there was nothing under the lamps at all.

*Ceiling versus floor.* Measured on two verified crops of `hz-dock`: the lit ceiling band reads luma
**73.1** (86/71/54, warm) and the floor beneath the same lamps reads **64.9** (65/66/55). The ceiling
is 1.13× the floor. It was, on your own account, about sixty times. **That inversion is fixed.**

*Does it read as key, fill and rim?* Key: yes. Fill: yes, but too generous — the profile between two
lamps only falls to 0.059 at its single darkest sample and sits at 0.12–0.33 across most of the span,
so the gaps between lamps never become dark places. Rim: **nominal.** `RIM_GAIN 0.50` at `#7fa8d8`
produces, on the verified 4× crop `crit7/zoom-fig-back.png`, a cool edge one to two pixels wide along
part of one arm and shoulder, and nothing at all elsewhere. In `hzf-lineup` no figure has a lit edge
I can find. It is in the scene and it is not in the picture.

*Which failure mode did you land in?* **Neither.** The frames did not go dark to buy the ratio:
`crush%` is 0.0 on ten of eleven frames and 1.5% on the eleventh, and median luma is 27–97, so
nothing has been emptied out. You bought the ratio by moving the lamps, and the room is more legible
than it was, not less. Held at C rather than higher because the fill is still high enough that the
room has no dark, and because a designed light would put a pool where the player is meant to go —
which brings us to C10.

### C2 — Contact shadows and grounding — C → **C+**

Grounding holds everywhere and has improved in one specific way: **penumbra exists now.** On the
verified 5× crop `crit7/zoom-lit.png` the shadow boundary across the near floor is a gradient over
four to six source pixels rather than pass 4's hard cut. In `hzf-lineup` all five contractors throw
long directional shadows that agree with one another, and the mug at bottom-right — a hand-sized
prop — has its own contact pool.

`near ÷ far` on the verified pair in `hzf-lineup`: shadowed floor **60.6**, lit floor beside it
**103.9**, ratio **0.583**, inside the MATCHES band.

**Held at C+ for the reason pass 4 gave, unchanged: the shadows are the wrong colour.** The verified
crops are unambiguous. Lit concrete reads **100/105/106** — cool, blue-dominant. Shadowed concrete
reads **59/61/57** — green-dominant with blue *suppressed*. So the frame's hue rotates **cool → warm
olive** as light is removed. `refs/repo/fovupdate-example1.jpg` rotates the other way on one stone
wall: 74/65/32 warm under the sconce, 19/21/18 neutral three metres along, 6/5/9 cool across the
room. Warm key, cool fill is what reads as a lit room. Cool key, khaki fill is what makes the near
floor of `hzf-lineup` look like a football pitch, which is exactly what it looks like.

The mechanism is visible in the level data: near the dock the key is `#cfe4ff`, a cold lamp, so
what survives in shadow is the hemisphere ground bounce `#2b2521`, a warm brown. The two are the
wrong way round for a working interior.

### C3 — Material variety — C+ → **B−**

**The water compiles, and it is the first surface in this project that reflects anything.** That
moves the criterion up a step on its own: the build now has matte concrete, semi-gloss, metal,
emissive *and* a transmissive-reflective surface, five response classes, with the galvanised
perforated stair treads in `hzw-under` still the best-read material in the game.

Held below B by the same limitation as before — materials are uniform within a surface, with the
plant's damp-blotched tank walls the honourable exception — and by the new observation that the
reflection is a single specular lobe rather than an image. Nothing in the frame is reflected *in*
anything; one light is.

### C4 — Texture presence — B− → **B−**

Unchanged and still the strongest criterion. `flat%` 47.3–80.2 and `tex%` 18.7–48.5 straddle PEAK's
63.1 / 36.1 rather than sitting an order of magnitude the wrong side of it.

Held at B− by artefacts, all four of them confirmed present this pass and none of them a scale
problem:

* **The deck-rib streaking owns the ceiling.** `hz-racking` gives its entire top third to a fan of
  smeared tan streaks radiating from a point. On the verified 3× crop `crit7/zoom-dockceil.png` the
  ceiling is long horizontal light and dark bands with no plate structure at all — it reads as
  brushed metal or motion blur, not as a deck. It is also the busiest surface in most frames, which
  is precisely backwards for a ceiling.
* **The squiggly loops are still in the plant and are now unmissable.** Bottom of `hzw-under`: white
  wandering closed loops over the red pump body and the black pipe. They read as biro doodles.
* Grazing aliasing on the fine wall corrugation, unchanged.
* The floor under a lamp (`crit7/kf-key-w.png`) is very nearly featureless apart from slab joints
  and soft stains — the smooth 63% PEAK keeps is present, but it is all in one place.

### C5 — Tonal range and exposure — C− → **B**

**The largest single improvement in this pass, and the cleanest close of an old finding.**

`clip%` is **0.0 on every one of eleven frames**. Pass 2 opened this, pass 3 carried it, pass 4 had
it at 1.3% and called it the one place where both references agree and the build agreed with
neither. Thirteen reference frames read 0.0; eleven build frames now read 0.0.

`crush%` is 0.0 on ten frames and 1.5% on `hz-racking`. `p01` runs 4.0–22.3, above the ≥3 floor
everywhere. Median luma 27.4–96.7, with nine of eleven inside the 45–110 interior band.

Not an A for two reasons. `hz-racking` at median 27.4 with darkest-5% [4,4,5] and channel spread 0.8
is both too dark for the interior band and completely untinted — it is the one frame that did not
get the grade. And the highlight end has traded clipping for a different problem: `hz-floor` and
`hz-pit` reach p95 189–200 on a surface with almost no local contrast, which is the C6 finding.

### C6 — Post chain — D → **D+**

**Bloom: better, and still firing on the wrong thing.** It no longer clips. But the verified 3× crop
`crit7/zoom-van.png` shows the van interior at mean **180/191/199**, median luma **177**, local SD
**3.6** — a thirty-point band of pale blue-white in which the corrugation survives only as a ghost.
And `crit7/zoom-lamp.png`, a 4× crop of the pale mass above the van roof, shows there is **no fixture
in it at all**: it is bloom bleeding out of the van's own lit interior, past its silhouette, forty
pixels into the black ceiling, with violet fringing along the boundary.

So the threshold is being cleared by **a large diffuse surface at luma ~180**, which is exactly what
C6 MATCHES forbids: *"tight and threshold-gated, so only genuinely bright things bloom and mid-grey
walls never do."* Compare `crit4/zoom-sconce.png`: R.E.P.O.'s tube keeps a hard rectangular edge, a
green core, a readable dark bracket beneath it, and masonry relief legible to within ten pixels of
the emitter.

The fix is no longer "clamp the emissive". It is: bring the van interior's value down — the dock
lamp is at intensity 680 and hangs at y = 2.0, eight hundred millimetres above a dock deck at
y = 1.2 — and then set the bloom threshold above what remains.

**Vignette: I am scoring this from the picture, and it is absent on the wide frames.** The metric
reads 4.011 on `hz-spawn`, 2.828 on `hz-racking`, 1.953 on `hz-dock`. Pass 4 declined to score those
as confounded. I do not think that is right any more. The verified 3× crop `crit7/zoom-topband.png`
shows why the corners are bright: **a pale blue-grey plane with diagonal streaking sits across the
top of the interior**, meeting the warm ceiling at a hard horizontal line, brighter than anything
else in the upper half of the frame. There is no darkening at the extreme corners of `hz-spawn` or
`hz-dock` that I can see. C6's FAIL clause is corners as bright as or brighter than centre, actively
pulling the eye off the subject, and that is what these frames do. `hz-floor` (0.397) is the one
valid in-band reading.

AO and grade continue to do visible work and are not what holds this down.

### C7 — Silhouette at 10 m — C → **C−**

Down a step, and the hats are why.

`hzf-lineup` puts five contractors at roughly 8–12 m with five distinguishable hues — purple, pale
yellow, magenta, green, teal. The identity read works: measured on verified 6× crops, hat versus
adjacent background is **ΔL 64.0** with strong hue separation (100/92/144 against 33/34/37), above
the MATCHES bar.

Everything else is worse or unchanged:

* **The hats have become vegetables.** At full frame the crew reads as garden gnomes wearing
  cabbages. On the verified 4× crop `crit7/zoom-fig-back.png` the hat is a smooth speckled dome, far
  wider than the head, with a ragged scalloped edge, one odd flat flange sticking out sideways where
  a peak should be, no crown rib and no brim. It sits high enough that a bare tan skull shows for
  about a third of the head's height all the way round. This is the third pass this item has been
  raised and the silhouette is now less like a hard hat than it was.
* **The torso barely separates.** Torso ΔL against immediate background is **20.9** — the very
  bottom of the ACCEPTABLE band and one point above outright failure.
* **The vest front is not the only incoherent side, and I was wrong about that.** Pass 4 said the
  back "is fine — orange field, two bands — which is what the front should also be". The verified
  crop shows the back is **a pale grey cross**: one vertical band stopping mid-back, two horizontals,
  a stray at the waist. At 10 m it reads as a first-aid tabard. Retracting pass 4's sentence.
* The trousers' competing identity colour is **gone**. That part of fix 5 landed.
* The arms are two orange spheres with no shoulder seam; at distance they merge into the torso mass.
* Still no usable rim (C1).
* **The face could not be graded again.** `hzf-head` caught the back of the head for the second time
  in three passes. Pass 4 filed this as a harness defect — `hz-fig2.js` cannot hold the figure's
  facing, because `pendingInput.yaw` overwrites the posed `b.yaw` within a tick or two — and it has
  not been fixed. The eyes are the best art in the build and whether they get photographed is a coin
  toss. Freeze `pendingInput` for the duration of the posed shots.

### C8 — Composition and depth — C− → **C−**

Fog and the improved key–fill give three legible depth bands in every warehouse frame. Against that,
three of pass 4's four composition failures are exactly as they were:

* **The sky band.** `crit7/zoom-topband.png`, verified: a pale blue-grey plane above the ceiling line
  in `hz-spawn` and `hz-dock`. It breaks the interior read completely and it is the brightest thing
  in the upper frame.
* **Empty planes.** `hzw-t000` and `hzw-t280` give the bottom 36% of frame to a featureless grey deck
  slab with one joint line and nothing occluding. `hz-spawn` does the same with the near floor.
* **The piano is still a hole.** In `hz-racking` it is a pure black wedge occupying roughly a fifth
  of the frame with no surface detail whatsoever. It is the one near-field framing element in the
  standard shot list and it frames the shot as an absence.

### C9 — Colour discipline — D → **D**

No movement. Chroma is the failure and it is the same failure: nine of eleven frames carry chroma on
under 90% of pixels and three are under 50% — `hzf-idle` at **38.1%**, `hzf-lineup` at 45.8%,
`hz-pit` at 49.4%. Both references sit at 90.0–99.4%. Mean saturation runs 0.149–0.650 against
0.39–0.54 and 0.392; the low end is grey mush and the high end is `hzw-t370`, which is 65% saturated
because it is mostly teal water.

Dominant hue share 20.0–49.8% against a reference band of 19.0–31.2%; `hz-racking` carries four hue
families and `hzw-under` three, both under the floor of five.

The one thing working remains hazard yellow-and-black, used on hazards and nowhere else. That is
correct reserved-colour discipline and it should be the model for the rest.

### C10 — Playable legibility from a still — **F** (first grading)

Five questions against `crit7/hz-dock.png`, HUD ignored. I am contaminated — I have read this
level's source — so I have scored only what the frame supports and marked what I could not have
known.

1. **What in frame is worth money?** *Fail.* The valuables in shot are small red and white cylinders
   scattered on the concrete. They read as litter. Nothing in the frame carries a reserved finish
   that says "billable".
2. **Where does it have to go?** **Automatic fail, and the evidence is unusually strong.** The
   extraction volume is the van, at `[0, 2.05, 15.4]`, behind the camera. The object that dominates
   the frame — brightest large mass, own internal glow, dead centre — is the inspection pit: a mint
   basin with a navy kerb and a plank across it. **I read it as the extraction volume for two
   consecutive passes and wrote it into two fix lists.** If a grader with the source open gets this
   wrong twice, a player gets it wrong.
3. **What will hurt me?** *Partial.* The hazard chevron panels are correct and legible. The pit —
   the actual fall hazard, the thing the brief tells you to mind — is lit like a feature, not like a
   danger.
4. **Where is onward?** *Fail.* The frame has no brightest continuous path. The floor is evenly lit
   corner to corner and the only strong directional cue points at the pit.
5. **Which figure is me / a team-mate?** Not applicable in this frame; scored on `hzf-lineup`, where
   hat hue answers it clearly. *Pass.*

**One and a half of five, with an automatic fail on question 2.**

The diagnosis is one sentence and it is worth more than the letter: **the level's brightest, most
saturated, most centrally composed object is its principal hazard, and its objective is an unlit
box behind you.** Every lighting and colour decision currently argues the player toward the trench.
This is not an art-polish item; it is the game's own instructions, rendered backwards.

---

## Confirmations, corrections, and things closed

**Closed this pass, with evidence:**

* Water compiles and reflects — pass 4 fix #1. Verified on my own surface-band check, below.
* Clipping — pass 4 fix #2, partially. `clip%` 0.0 on eleven of eleven frames.
* The ceiling-versus-floor light inversion — pass 4 fix #3. Ceiling 73.1 against floor 64.9 in
  `hz-dock`, verified crops; pools and cast upright shadows on the concrete in `pool-lamp0`.
* Trousers no longer carry a second identity colour — part of pass 4 fix #5.
* **"Texture scale 2–4× too fine" stays closed.** Pass 4 closed it on the metric; nothing this pass
  reopens it. Feature scale is not the problem and has not been since pass 3.

**Corrected:**

* The extraction volume is the van, not the mint basin. Passes 3b and 4 are wrong on this and every
  fix-list line about "the extraction volume looking like a paddling pool" was aimed at the pit.
* Pass 4's "from behind it is fine — orange field, two bands". It is a grey cross.
* My own first key-to-fill run this pass, two samples of which were taken behind the debrief panel.

**Confirmed still present:** deck-rib streaking on the ceiling; the pale sky band above the ceiling
line; grazing aliasing on wall corrugation; the squiggly loops in the plant; the black featureless
piano; khaki shadows; mushroom hats; a jumbled vest — front *and* back.

**On the water, since I was asked to arbitrate and the answer has changed.**
Rectangle `(340, 470)–(480, 540)` of `crit7/hzw-t370.png`, on flooded deck water only, cropped and
looked at at 6× (`crit7/zoom-glint-left.png`) before any number was believed:

| Surface-band check, as specified in pass 4 | Result | |
|---|---|---|
| Top 1% by luma within 20% of neutral | **1.125** | pass |
| Clustered inside ~40 px | **one cluster, 100% of the top 1%, span 15 px** | pass |
| Above the band's own median | **3.53×** | pass |

The crop shows an elongated pale blue-white specular lobe lying on the water, stretched along the
view direction as a light on rippled water is. It is a reflection of something. **The water is
fixed.**

Three honest qualifications. First, my "clustered inside ~40 px" was the wrong shape of bound — a
specular on a rippled surface is legitimately elongated, and the useful test is whether the bright
set is *one lobe rather than smeared across the band*, which it is. Second, the other bright region
in that frame is **not** a reflection: the 4× crop `crit7/zoom-glint-mid.png` shows the pale mass
behind the pump motor is the submerged lamp's bloom leaking above the waterline, shapeless and
washing the water out. That is the trap from last time, still live, and it is why the rectangle
matters. Third, over the flooded deck as a whole — rectangle `(300, 500)–(1150, 660)` — the top 1%
measures **1.594** from neutral, i.e. teal. One lobe near the light; nothing anywhere else. The
surface reflects a lamp, not a room.

**And on your metric decision: you were right and the global cast is now useless on that level.**
`hzw-t370` measures a global cast of **2.18** in this build, against 1.46 when you left it failing.
A frame that is deliberately most-of-a-frame of teal water will fail a whole-frame cast assertion no
matter how good it is. Highlight neutrality inside a named band is the right instrument; keep it.

---

## On whether it plays, and what I am not entitled to say

You asked whether the rubric has room to say whether the thing plays. It does now, narrowly, and
§5 of `visual-rubric.md` sets out exactly how narrowly. Restating the operative part here so it
travels with the grade:

**Nothing in this document is evidence that HAZARD PAY plays well or badly.** Every letter above
comes from PNG files taken by a headless harness under software GL by an agent that has never held
the controls. The instrument cannot see frame rate, input latency, animation in motion, whether a
lift can be joined, or whether a quota is reachable — and it has already proved that: remote figures
were frozen solid in every capture for several passes and the frames looked no different, and a
piano that no number of contractors could lift photographed exactly like one they could.

So on the unwinnable-game fix: I can see that it is the largest change to the project since I started
grading, and I can see the shape of it in the commit log and in your account. **I did not observe it
and I will not grade it.** What I will say is the part that is mine: the bot pass found six bugs that
no headless test was asking about, and this pass found three measurement errors that no assertion was
asking about, two of them in my own instrument. Those are the same failure. A suite that only ever
tests one side of a convention against itself will never find a disagreement about it, and a metric
that is never asked to photograph its own sample will keep measuring the wrong rectangle for as long
as it is trusted.

---

## Top five fixes for a sixth pass, in priority order

### 1. Make the van the brightest thing in the room and the pit the dimmest.

This is C10's automatic fail and it is one level-data change, not an art pass. The pit currently has
its own light — `light([0, 1.2, 1.0], { intensity: 7, range: 8, color: '#9fffc0', flicker: 0.55 })` —
which makes the game's principal fall hazard the brightest, most saturated, most central object in
three of five standard frames. The van, which is where £5,200 has to go, is an unlit box facing away
from the room. **Swap the emphasis.** Put a warm working light *inside* the van mouth so it reads as
a destination with a lit throat; take the pit's tube down to a dim flickering hazard-amber that says
"hole" rather than "swimming pool"; and give the pit lip the hazard chevron livery that the level
already uses correctly elsewhere. Grade it by handing `hz-dock.png` to someone who has not seen the
level and asking them where the money goes.

### 2. Stop the bloom firing on the van's walls, by darkening the walls.

Verified: van interior median luma **177**, local SD **3.6**, mean 180/191/199, and the pale mass
above the roofline is bloom escaping the van's own diffuse surface with no fixture in it. The dock
lamp is intensity **680** at **y = 2.0**, 800 mm above a deck at y = 1.2. Bring the lamp's intensity
and proximity down until the interior sits in the 90–130 range where the corrugation has contrast to
live in, *then* set the bloom threshold above that. Target picture, not a number: the van's ribs are
legible across its full width, and any halo in the frame has a fixture inside it with a shape and a
colour that is not white. `crit4/zoom-sconce.png` is the reference.

### 3. Turn the shadow hue the right way round.

Verified crops: lit concrete **100/105/106** (cool), shadowed concrete **59/61/57** (green-dominant,
blue suppressed). The reference rotates warm → neutral → cool as light is removed; this rotates
cool → khaki. Two candidates, both in `worldview.js` / the level env: the dock key is `#cfe4ff`, a
cold lamp, and the hemisphere ground is `#2b2521`, a warm brown, so what is left in shadow is the
warm term. Either warm the key near the dock or cool the ground bounce. The near floor of
`hzf-lineup` currently reads as a football pitch and this is the whole reason.

### 4. Make the hat a hard hat. Third pass of asking, and it got further away.

Verified at 4× on `crit7/zoom-fig-back.png`: a smooth speckled dome wider than the head, ragged
scalloped edge, one flat flange where a peak should be, no crown rib, no brim, seated high enough
that a third of a bare tan skull shows all round. At 10 m five contractors read as gnomes in
cabbages. Add a crown rib and a shaped peak, seat it lower, drop the speckle so it reads as moulded
plastic. While there: the vest **back** needs the same treatment as the front — it is a pale grey
cross, not hi-vis banding; two horizontal bands and two over the shoulders is the shape. And the
torso is at ΔL 20.9 against its background, one point above failing, so a darker torso value or a
rim that is actually visible is the difference between a readable crew and a barely readable one.
**Do not touch the eyes.**

### 5. Fix the ceiling streaking and the sky band, in that order.

Both verified this pass. The deck-rib streaking (`crit7/zoom-dockceil.png`) makes the ceiling the
busiest surface in most frames and owns the top third of `hz-racking` as a radial fan — pass 4's
hypothesis that it is a relief term breaking down where a light sits near the plane of the surface is
still the best available and still untested. The sky band (`crit7/zoom-topband.png`) is a pale
blue-grey plane above the ceiling line in `hz-spawn` and `hz-dock` that breaks the interior read and
makes the top corners the brightest part of the frame, which is what the vignette metric has been
reporting as a confound for three passes and is, I now think, real.

### Also worth doing, below the line

* Fix the key-to-fill probe's sample point. `(-14, -9)` is under a racking deck; `(-14, 5)` and
  `(14, 5)` are the only bright lamps in the level with open floor beneath them. `crit7-occupy.mjs`
  filters candidates against the brush list.
* Fix `hz-fig2.js`'s facing, so the face is photographed on purpose rather than by luck.
* The squiggly loops in the plant, and the black featureless piano.
* Chroma: nine of eleven frames sit under 90% chromatic and three under 50%. The build is greyer
  than both references, not more disciplined than them.
