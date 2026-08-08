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
