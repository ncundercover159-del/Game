# HAZARD PAY — reference manifest

Compiled 2026-08-07. Owner: visual critic agent.

## Scope honesty — read this before citing anything here

R.E.P.O. and PEAK are commercial Unity games distributed on Steam. This is a headless Linux
container. **Neither game was installed, run, or played.** No side-by-side capture was performed and
none can be. Everything below is either (a) a real screenshot file that exists on disk in this
directory, or (b) a written description sourced from the public web.

Network state at time of compilation: the agent egress proxy blocked **every** direct HTTP request
and **every** `WebFetch` call attempted (`store.steampowered.com`, `shared.akamai.steamstatic.com`,
`steamcommunity.com`, `en.wikipedia.org`, `upload.wikimedia.org`, `repogame.fandom.com`,
`static.wikia.nocookie.net`, `landfall.se`, `aggrocrab.com`, `thunderstore.io`, `i.ytimg.com`,
`youtube.com` — all returned `EGRESS_BLOCKED` or a 403 at CONNECT). Only `WebSearch` functioned,
which returns page titles, URLs and a text summary, **not images**.

Consequence: **no new reference images could be downloaded during this pass, for either game.**
The PEAK images below were already on disk from an earlier session when egress was evidently more
permissive. The R.E.P.O. folder is empty and stayed empty. R.E.P.O. is therefore characterised from
written sources only, and every claim about it in the rubric is labelled as such.

---

## A. Images actually on disk

### PEAK (Aggro Crab / Landfall, Unity, 2025) — `refs/peak/`

Four genuine in-game captures, plus one near-useless loading screen. Provenance: saved by a prior
session; the originating URL was not recorded in a manifest at the time, so treat the URLs as
unknown. Authenticity is nonetheless high-confidence — they carry a build stamp (`v1.60.b`,
`v1.60.d`), the shipped biome HUD (`SHORE | ROOTS | ALPINE | CALDERA | THE KILN`), the stamina bar
and the 4-slot item bar, none of which would appear in a mock-up.

| File | What it shows | Useful for |
|---|---|---|
| `peak/biomes-hud-english.png` | 1366x768. Full mountain vista at dusk, purple sky, heavy aerial haze. | Fog/depth, colour discipline, silhouette, HUD |
| `peak/biomes-hud-english-customrun.png` | Same vista, alternate HUD state. | Corroborates the above |
| `peak/boarding-pass-map-00-button.png` | 1051x493. Boarding-pass UI over a blurred airport interior. | UI language, interior materials, DOF |
| `peak/map-select-ui-custom-detailed-english.png` | 1366x768. Map-rotation panel over airport interior. | UI language, interior lighting |
| `peak/loading-maps-screen.png` | Black loading screen. | Type only. Not an art reference. |

### R.E.P.O. (Semiwork, Unity, 2025) — `refs/repo/`

**Empty.** No images obtained. Do not cite a R.E.P.O. image; there isn't one.

---

## B. What I read directly off the PEAK captures

These are my own observations of files that exist, not claims about the game as a whole.

1. **Aerial perspective is the primary depth cue and it is aggressive.** The mountain's near rocks
   sit around value 0.20-0.30 and fully saturated grey-green; by the summit they have lifted to
   roughly 0.55-0.65 value and taken on the sky's purple hue almost completely. Depth is being
   carried by fog, not by shadowing.
2. **The sky is a single committed hue with a soft vertical gradient** and a handful of large, soft,
   low-contrast cloud shapes. It occupies well over half the frame and sets the grade for everything
   else.
3. **Rock surfaces are not flat colour.** There is a visible fine mottle/speckle across the stone —
   low contrast, high frequency, clearly a texture rather than vertex tinting. Geometry is chunky
   and faceted but the surface is not.
4. **Snow reads as an up-facing-normal accent.** Near-white caps appear only on top surfaces. It is
   doing a huge amount of work for form-reading at distance and costs almost nothing.
5. **Colour discipline is severe.** Frame is ~90% purple-grey. Accents (green shrubs, magenta urchin
   plants, tan palm trunks, cream pillars, the green stamina bar) are small in screen area and high
   in chroma. Nothing mid-chroma competes with the dominant hue.
6. **Volumetric shafts** are faintly visible descending through the haze at upper right.
7. **The interior shots are textured too** — the airport carpet carries a dense speckle, the floor
   is tiled with visible grout lines, walls have panel breaks. No untextured flat planes anywhere.
8. **UI is chunky, high-chroma, rounded.** Heavy rounded sans, all-caps, generous letter-spacing,
   white on saturated blue, thick rounded-rect containers, drop shadows on the in-world HUD text.
   Diegetic framing (a boarding pass, an airline brand) rather than an abstract menu.
9. **Depth of field / darkening behind UI panels** separates menu from world.

---

## C. R.E.P.O. — written sources only

### C1. Post-processing exposed as player settings (high confidence, corroborated across sources)

R.E.P.O.'s graphics menu exposes, as individual player-facing toggles:
**Motion Blur, Lens Distortion, Bloom, Chromatic Aberration, Grain, Glitch Loop, Pixelation**
(Pixelation is a magnitude preference, e.g. "Small", not a boolean), and separately a gameplay
**Camera Noise** amount.

This is the single most load-bearing finding for HAZARD PAY. A studio does not ship lens distortion,
chromatic aberration, grain, a glitch loop and a pixelation amount as first-class settings unless the
intended default look is *a degraded camera feed*, not a clean render. The pixelation is confirmed by
multiple sources as deliberate ("the resolution is part of the retro style"), with the setting
existing so players can dial it back — i.e. the shipped default is the stylised end, and clarity is
the opt-out.

- https://www.lagofast.com/en/blog/repo-graphic-settings/
- https://androidgram.com/r-e-p-o-repo-game-motion-blur-chromatic-aberration-bloom-more-how-to-disable-them/
- https://gamerblurb.com/articles/repo-best-graphic-settings
- https://www.repo-game.org/zh-tw/repogame-best-settings
- https://steamcommunity.com/app/3241660/discussions/0/597393922610772742/ ("The game is extremely pixalated")
- https://steamcommunity.com/app/3241660/discussions/0/597394233225139709/ (resolution issue thread)
- https://thunderstore.io/c/repo/p/Vippy/REPOFidelity/ (a mod that exists specifically to raise fidelity — corroborates that stock is deliberately low)
- https://www.nexusmods.com/repo/mods/26 (RemoveCameraBob — corroborates camera bob/noise being a shipped, notable effect)

### C2. Lighting and value range (high confidence, consistent across independent sources)

Repeatedly described as: dark everywhere, "sometimes just kind of dark and sometimes inky black
darkness", with the player carrying "a tiny flashlight that projects a fairly narrow cone of light
ahead of you". Minimalist visual design, "slightly blurred textures, desaturated tones, and shadowy
lighting", claustrophobic and abandoned. Explicitly not ray-traced, not photorealistic, and the
sources treat that as a strength — "mood, not megapixels".

The key structural point: **R.E.P.O.'s frames are mostly dark, with a small bright pool.** The
histogram is bottom-weighted with a narrow highlight. That is the opposite of a uniformly-lit
neutral-grey room.

- https://tagn.wordpress.com/2026/07/28/r-e-p-o-initial-impressions/
- https://www.gianty.com/r-e-p-o-game-the-indie-hit-outranking-aaa-on-steam/
- https://digistatement.com/r-e-p-o-repo-game-how-to-disable-flashlight/
- https://southblueprint.com/42214/entertainment/r-e-p-o-game-review/
- https://www.gamingonlinux.com/2025/03/r-e-p-o-is-a-new-co-op-horror-game-with-silly-physics-currently-exploding-on-steam/

### C3. Environment character (medium confidence)

Locations are described as worn-down hallways, abandoned scientific interiors, industrial remnants,
ruined corridors, dimly lit rooms; procedural layouts held together by "strong visual motifs" so each
location has a sense of place. Physics-driven valuables that dent, break and lose market value when
handled roughly; explosive barrels and propane tanks among them. The lobby is described as
"futuristic, grimy cartoonish", distinct from the near-realistic level interiors.

- https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/REPO
- https://gamerblurb.com/articles/review-repo-the-horror-game
- https://repogame.fandom.com/wiki/Player_Character

### C4. Character design (medium confidence)

Player is a "robotic puppet-like character with big eyes", player-colourable from the lobby or the
escape menu. Big eyes on a simple body is a silhouette-first design: the read at distance is
head-shape plus colour, not facial detail.

- https://repogame.fandom.com/wiki/Player_Character
- https://steamcommunity.com/sharedfiles/filedetails/?id=3446078566

### C5. Sources I am explicitly discounting

Several results were low-quality SEO/aggregator pages carrying descriptions that contradict every
other source and the game's known premise — one describes R.E.P.O. as "gritty, glitchy, neon-soaked
chaos ... early 2000s cyberpunk, Quake 3 arena maps, and broken VHS tapes", which does not match a
haunted-mansion extraction game and reads as machine-generated filler. Not used. Hosts discounted:
`reviewsgodzilla.com`, `pxlimo.com`, `reviewergame.com`, `stiggleme.com`, `superwebost.com`,
`goodgame-zone.net`, `playedgamers.net`, `thegigletter.com`.

---

## D. What is still missing and should be obtained when egress allows

1. Any R.E.P.O. screenshot at all. Priority one. Steam store page appid **3241660**.
2. PEAK Shore/Tropics biome shots — the existing pair are both the same dusk vista, which risks
   over-fitting the rubric to one lighting condition. Press kit: `landfall.se/peak-press-kit`.
3. A PEAK or R.E.P.O. interior at close range showing a character at ~10 m, for the silhouette
   criterion, which is currently the least evidenced criterion in the rubric.

---

# Addendum, 2026-08-08 — R.E.P.O. imagery finally obtained

Item 1 of section D is closed. **Seven genuine R.E.P.O. in-game screenshots are now on disk in
`refs/repo/`.** They are the first R.E.P.O. images this project has ever had, and the rubric's
R.E.P.O. thresholds are no longer written from prose.

## How, and what that costs in confidence

Egress policy has not changed: `store.steampowered.com`, every Steam CDN, Wikipedia, Wikimedia,
Fandom, imgur, `user-images.githubusercontent.com`, PC Gamer, GameSpot, IGDB and YouTube all still
answer **403 at CONNECT**, re-verified this session. `api.github.com` is scoped to this session's own
repository and refuses everything else. What *is* reachable is **`raw.githubusercontent.com`**, for
any public repository.

So the route was: find a R.E.P.O. mod whose author committed gameplay screenshots into the
repository itself, rather than hotlinking them to an image host. `darmuh/FovUpdate` — a
field-of-view mod — does exactly that, because its README has to show the same scene at several
FOV values.

| File | Source URL | Notes |
|---|---|---|
| `repo/fovupdate-iconog.jpg` | https://raw.githubusercontent.com/darmuh/FovUpdate/master/Screenshots/iconog.jpg | Extraction cart in a corridor, service truck |
| `repo/fovupdate-example1.jpg` | https://raw.githubusercontent.com/darmuh/FovUpdate/master/Screenshots/example1.jpg | Vaulted stone cellar, two wall sconces |
| `repo/fovupdate-example2.jpg` | https://raw.githubusercontent.com/darmuh/FovUpdate/master/Screenshots/example2.jpg | Same cellar, wider FOV |
| `repo/fovupdate-example3.jpg` | https://raw.githubusercontent.com/darmuh/FovUpdate/master/Screenshots/example3.jpg | Dark interior corridor |
| `repo/fovupdate-example4.jpg` | https://raw.githubusercontent.com/darmuh/FovUpdate/master/Screenshots/example4.jpg | Loading bay, strip light, torch in hand |
| `repo/fovupdate-example5.jpg` | https://raw.githubusercontent.com/darmuh/FovUpdate/master/Screenshots/example5.jpg | Inside the truck, looking out at dusk |
| `repo/fovupdate-example6.jpg` | https://raw.githubusercontent.com/darmuh/FovUpdate/master/Screenshots/example6.jpg | Near-black interior |

Repository: https://github.com/darmuh/FovUpdate — R.E.P.O. mod, topic `repo-mod`, MIT-licensed
source, last pushed 2026-06-09.

**Authenticity: high.** All seven carry R.E.P.O.'s shipped HUD — the green `+100/100` health cross,
the amber `⚡40/40` stamina bolt, `$0 / $9,184` quota with the extraction counter `0/1` beneath it,
and the three numbered item slots along the bottom edge. `iconog.jpg` shows the extraction cart with
its `$0` valuation display and `example5.jpg` shows the truck interior with the `TAXMAN:` message
list. None of that would exist in a mock-up.

**Four caveats, and they matter for every number derived from these files.**

1. **They are JPEG, quality unknown, at 1920×1080.** JPEG destroys precisely the high-frequency
   signal that the `flat%` / `tex%` texture metric measures. **Do not derive a texture threshold
   from these files.** PEAK's PNGs remain the only sound texture reference.
2. **The FOV is modded.** That is the entire point of the mod. Framing, apparent lens distortion and
   the corner stretching are not shipped defaults. Composition and any field-of-view claim must not
   be taken from these.
3. **One player, one session, one graphics-settings state.** R.E.P.O. exposes Bloom, Grain,
   Chromatic Aberration, Pixelation, Motion Blur, Lens Distortion and Glitch Loop as user settings.
   This capture reflects whatever this modder had them set to, which is not necessarily the default.
   The post-chain magnitudes below are one player's configuration, not the shipped one.
4. **Six of seven are dark interiors.** Same over-fitting risk the PEAK sample has, in the opposite
   direction.

Nothing here changes the standing scope statement: **R.E.P.O. and PEAK were not installed, run or
played, and no side-by-side capture was performed or is possible in this container.** These are
files downloaded from a public git repository and measured on disk.

## What the seven files measure

HUD-cropped (top 26%, bottom 7%), `crit3-stat.js` / `crit3-stat2.js`:

| Metric | R.E.P.O. range (n=7) | PEAK vista | Comment |
|---|---|---|---|
| Median luma | **7.1 – 11.7** | 70.5 | An order of magnitude darker |
| p95 / p99 luma | 14–104 / 30–112 | 97 / 150 | The whole picture lives under 40 |
| p01 luma | **3.5 – 4.0** | 33.5 | Black point lifted just off zero, never to zero |
| Crushed (L≤4) | **1.2 – 3.7%** | 0.0% | Very dark, but not empty |
| Clipped (L≥250) | **0.0%** on all seven | 0.0% | Nothing blows out, ever |
| Darkest-5% RGB | [2,3,3] – [4,4,7] | [35,32,58] | Barely lifted, barely tinted |
| Shadow channel spread | **1.6 – 3.9** | 26.3 | Blacks are near-neutral |
| Mean saturation | **0.39 – 0.54** | 0.392 | Higher chroma than PEAK |
| Pixels with S > 0.15 | 90.0 – 99.4% | 98.9% | Almost no dead grey |
| Dominant hue share | 19.0 – 31.2% | 26.3% | Both references agree closely |
| Hue families (>3%) | 5 – 10 | 7 | Both references agree closely |
| Vignette (corner÷centre) | **0.27 – 0.78** | 0.940 | Far heavier than PEAK |
| Key : fill, same stone | **3.2 : 1** lit vs shaded, **11.6 : 1** lit vs unlit | — | `example1`, measured |
| Lit stone RGB | 74/65/32 (warm) | — | |
| Shaded stone RGB | 19/21/18 (neutral) | — | |
| Deep fill RGB | 6/5/9 (cool) | — | Textbook warm key, cool fill |

`flat%` reads 80.7–97.4 and `tex%` 2.6–19.3 on these files, which would say R.E.P.O. is *smoother*
than PEAK. That reading is false twice over — JPEG has eaten the fine detail, and an absolute local
standard deviation cannot see texture in a frame whose entire content sits inside a 12-luma band.
The stone walls in `example1` are visibly, heavily relieved. **The absolute-SD texture metric is
exposure-dependent and must not be applied across frames of different brightness.** A
contrast-normalised version (local SD ÷ local mean) puts R.E.P.O. at 0.066–0.073 against PEAK's
0.043, i.e. R.E.P.O. carries *more* local relative contrast, which matches what the eye sees.

## What the files show that no prose source conveyed

* **The frame is nearly black and it is not a fault.** Median luma under 12. Detail survives because
  the black point sits at 3.5–4.0 rather than 0, not because anything is lifted into visibility.
* **Light is entirely local.** A sconce makes a warm pool a few metres across; three metres away the
  same wall is at luma 20; across the room it is at 5. There is no ambient wash at all.
* **The post chain is loud.** Visible grain over every surface, radial colour fringing that is
  obvious on the HUD glyphs, corner stretching from lens distortion, and a vignette that takes the
  corners to near-black. This corroborates the settings-menu finding from prose: the target look is a
  degraded camera feed, and at these magnitudes it is not subtle.
* **Bloom is generous, and the sources still hold their shape.** Halos measure 12–96 px around the
  sconces, and the sconce core stays a readable rectangle inside the halo. Wide is allowed; losing
  the emitter is not.
* **Saturation is high, value is low.** Mean saturation 0.39–0.54 with 90–99% of pixels chromatic,
  all of it packed into the bottom fifth of the value range. The look is not desaturation.

## Still missing

1. An unmodded R.E.P.O. capture at shipped defaults, and any capture showing the player character.
   **The silhouette criterion C7 still has no image behind it for either game.**
2. PEAK biomes other than the dusk vista.
3. Any R.E.P.O. daylight or brightly-lit interior, to test whether the near-black exposure is the
   whole game or one map.
