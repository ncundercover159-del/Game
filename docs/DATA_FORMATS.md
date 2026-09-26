# SkyKart data formats

All content is JSON. `npm run check-assets` validates everything described here. Coordinates use metres. `+y` is up, and karts start facing `+z` (yaw 0). A positive steer turns right, which decreases yaw.

## Racer: `client/assets/racers/<id>/racer.json`

```jsonc
{
  "id": "draxo", "name": "Draxo", "order": 1,
  "element": "magic",            // fire water earth air life undead tech magic light dark
  "size": "medium",              // light | medium | heavy (weight class, figure scale)
  "tagline": "…",
  "stats": { "speed": 0.5, "accel": 0, "weight": 0, "handling": 0.5, "drift": 0.5, "offroad": -0.5, "miniTurbo": 0 },
                                  // each stat is added to vehicle + wheels + glider stats (range about ±3)
  "signature": "swap",           // an item id from shared/sim/items.js ITEM_DEFS
  "reactions": { "hit": ["growl", "yelp"], "boost": ["whoo"], "win": ["roar"], … },  // bark names (audio/voice.js)
  "voice": { "pitch": 1, "formant": "dragon", "rasp": 0.25 },  // formant preset: dragon robotic grumble squeaky
                                  // chuckle bubbly goofy ghoul creak hoot airy rumble sweet purr
  "poses": { "victory": "wingFlare", … },
  "personality": "aggressive",   // AI personality when this racer is a CPU: aggressive hoarder clean chaotic
  "unlock": { "type": "default" }, // see Unlocks
  "kartColor": "#A84CFF",        // tints "tintable" vehicles and the battle balloons
  "assets": { "figure": "figure.json", "model": null, "barks": null }
                                  // model: optional GLB next to racer.json; replaces the procedural figure
}
```

## Figure format (`figure.json`, and the `figure` field of vehicles, wheels, gliders and props)

A figure is a set of bones plus primitive parts. The parts are merged into **one skinned mesh**, which costs one draw call, plus one more for the outline.

```jsonc
{
  "outline": 0.02,                          // outline thickness (0 = none)
  "portrait": { "y": 1.1, "dist": 3.2 },     // racers: framing for the portrait camera
  "palette": { "skin": "#8A4CFF", "belly": "#FFD23F" },   // named colours used by parts
  "bones": {
    "hips":  { "pos": [0, 0.5, 0] },                        // parent defaults to "root"
    "head":  { "parent": "hips", "pos": [0, 0.6, 0.1], "rot": [0, 0, 0] },  // rot in degrees (YXZ)
    "armL":  { "parent": "hips", "pos": [0.3, 0.3, 0], "mirror": true }      // …L bones auto-create …R
  },
  "parts": [
    { "bone": "head", "shape": "sphere", "r": 0.35, "s": [1, 0.9, 1], "p": [0, 0.1, 0], "rot": [0, 0, 0], "c": "skin", "m": "gloss" },
    { "bone": "head", "shape": "eye", "r": 0.09, "p": [0.12, 0.1, 0.3], "iris": "#3a7bd5", "iris_size": 0.62, "pupil_size": 0.5, "look": [0, 0], "mirror": true }
  ]
}
```

**Part shapes** (the dimensions are in part-local space):

| shape | parameters |
|---|---|
| `sphere` | `r`, `hemi` (true = top half only) |
| `capsule` | `r`, `len` |
| `cone` | `r`, `h` (base at the origin) |
| `cyl` | `r` or `rt`/`rb` (top and bottom radius), `h` |
| `box` | `size: [w, h, d]`, `round` |
| `torus` | `r`, `tube`, `arc` (degrees) |
| `lathe` | `points: [[r, y], …]` |
| `tube` | `points: [[x, y, z], …]`, `r0`, `r1`, `segs` |
| `extrude` | `points: [[x, y], …]` (2D outline in XY), `depth`, `bevel` |
| `eye` | `r`, `white`, `iris`, `iris_size`, `pupil`, `pupil_size`, `look: [yawDeg, pitchDeg]` |

**Common part fields:**
- `bone`, `p` (position), `rot` (degrees), `s` (scale).
- `c`: a palette key or `#hex`.
- `m`: the material: `gloss` | `matte` | `soft` | `metal` | `glow` (emissive) | `dark`.

**Repetition helpers:**
- `mirror: true` duplicates the part across X; parts on `…L` bones mirror automatically.
- `array: { n, dp: [x,y,z], dr: [deg,deg,deg], ds }` makes n copies with a stepped position, rotation and scale.
- `ring: { n, r, a0, tilt }` makes n copies around Y, each facing outward.

Props (`client/src/render/propDefs.js`) use the same format. A bone named `spin` is rotated by the track view (windmills, gears, fans, Ferris wheels).

## Vehicles, wheels and gliders (`client/assets/{vehicles,wheels,gliders}/*.json`)

```jsonc
// vehicle
{ "id": "ember_roadster", "name": "…", "type": "kart",   // kart | bike | quad | buggy
  "stats": { … }, "seat": [0, 0.36, -0.22], "pose": "kart",  // "bike" = lean-forward rider pose
  "wheels": { "FL": [x,y,z], "BL": [x,y,z] }, "wheelScale": { "front": 0.88, "back": 1.05 },
  "exhausts": [[x,y,z], …], "tintable": true,              // tintable: primary colour takes the racer's kartColor
  "unlock": { … }, "figure": { …bones wheelFL/wheelBL (mirror), steer, glider… }, "model": null }
// wheels: { "id", "name", "stats", "radius": 0.3, "unlock", "figure" }   // one wheel, cloned to 4
// glider: { "id", "name", "stats", "unlock", "figure" }                    // attached to the glider bone
```

## Unlocks

| type | condition |
|---|---|
| `{ "type": "default" }` | available from the start |
| `{ "type": "coins", "cost": 800 }` | buy it in the Shop |
| `{ "type": "races", "count": 5 }` | finish N races |
| `{ "type": "treasures", "count": 2 }` | find N hidden treasure chests |
| `{ "type": "cup", "cup": "skyland", "trophy": "gold" }` | a trophy in that cup (`trophy` is optional) |
| `{ "type": "goldAll" }` | gold in every main cup |
| `{ "type": "achievement", "id": "…" }` | earn that achievement |

## Tracks: `client/src/data/tracks/<id>.json`

A track is either a list of spline control `points` or, better, a **turtle `path`**:

```jsonc
{
  "id": "mol_forge", "name": "Forge Falls", "type": "track", "cup": "molten", "order": 2,
  "theme": "molten",               // skyland | molten | haunted | gearworks (render/themes.js)
  "music": "molten",               // client/assets/audio/songs/<id>.json
  "laps": 3, "width": 20, "offroad": 5, "autoBank": 6,     // autoBank: degrees of bank from curvature
  "surface": "road", "offSurface": "sand", "walls": true,
  "start": "@0+30",                // start line (anchor or 0..1)
  "look": { "fogFar": 620, "neonRails": true, … },         // per-track theme overrides
  "path": [
    ["S", 80],                     // straight, 80 m
    ["L", 45, 90],                 // left arc, radius 45 m, 90°
    ["S", 70, 4],                  // straight that climbs 4 m (smoothstep)
    ["R", 35, 90, 2, { "w": 16 }], // right arc climbing 2 m; attrs apply to its points (w, off, bank)
    ["CLOSE", 45]                  // shortest Dubins curve (radius 45) back to the start pose
  ],
  …
}
```

**Anchors.** Any `t`, `t0`, `t1`, `from`, `to` or `start` value can be `"@<cmd>+<metres>"`, meaning that many metres after the start of path command `<cmd>`, or a plain fraction of the lap between 0 and 1. `lane` runs from -1 (left edge of the road) to +1 (right edge). Values beyond ±1 place things off the road, for landmarks.

| key | format |
|---|---|
| `sections` | `[{ from, to, w?, off?, bank?, walls?, wallsL?, wallsR?, surface?, offSurface?, gap?, cliff?, bridge?, tunnel?, canyon?: height, noKerb?, noRail? }]` |
| `ramps` | `[{ t (lip position), len, h, lanes?: [a, b], type: "kicker" \| "hill", kick?, glider?, boost? }]` |
| `pads` | `[{ t, lane, len?, w? }]`, boost pads |
| `itemRows` | `[{ t, lanes: [-0.6, -0.2, 0.2, 0.6], ribbon? }]` |
| `coins` | `[{ t0, t1, lane, lane1?, n, ribbon? }]` |
| `branches` | shortcuts: `{ name, points }` **or** `{ from, to, via: [[f, offsetMetres, dy], …], lead? }` (built as a chord between two main-track anchors), plus `width, offroad, surface, walls, sections, ramps, pads` in branch-local 0..1 space |
| `treasure` | `{ t, lane, ribbon? }`, the hidden chest (one per track) |
| `hazards` | see below |
| `landmarks` | `[{ type (prop id), t, lane, dy?, rot?, scale?, spin?, ribbon? }]` |
| `scatter` | `[{ type, density (per metre), dist: [min, max], dy?, scale? }]`, instanced props along the edges |

Surfaces: `road`, `offroad`, `sand`, `snow`, `ice`, `metal`, `water`, `boost`, `lava` and `void` (the last two kill). Unknown names are visual only and drive like road: `wood`, `rainbow`, `cobble`.

**Remix** (Retro cup): `{ "id", "name", "cup": "retro", "remixOf": "sky_cloudtop", "reverse": true, "look": { … } }`. This reverses the base track and re-lights it. Ramps that jump a gap move to the far side of that gap.

### Hazards

All timing is `period` / `phase` seconds of race time. Every client computes the same state from the race clock.

| type | fields | effect |
|---|---|---|
| `windGust` | `t0, t1, dir (±1 = push toward ±lane), period, on, force` | sideways push in the zone |
| `geyser` | `t, lane, period, on?, r?, color?` | launches karts upward and spins them |
| `boulder` | `t0, t1, lane0, lane1, duration, period, r, model?` | rolls along the path and squishes karts |
| `collapse` | `t0, t1, safeLane?, lap?` | on the final lap (or `lap`) the outer lanes fall away |
| `carousel` | `t, lane, r, speed, arms, hub?` | rotating arms spin karts; the hub is solid |
| `door` | `t, lane, w, period, open, ribbon?` | a timed wall (open for `open` seconds of each period) |
| `fog` | `t0, t1, density` | visual: pulls the fog in while the camera is inside |
| `conveyor` | `t0, t1, lane0?, lane1?, speed, dir` | a belt along the track (dir -1 runs backwards) |
| `crusher` | `t, lane, w, d, period, down` | slams down and squishes |
| `laser` | `t, period, on, color?` | a gate across the road; spins karts while on |
| `piston` | `t, side: left\|right, period, out, reach, d` | a wall that shoots out from the side |
| `ghost` | `t, lane0, lane1, speed, model?, hang?, scale?` | an obstacle sweeping across the lanes (ghost, swinging crate…) |

## Battle arenas: `client/src/data/arenas/<id>.json`

```jsonc
{ "id": "arena_sky", "name": "Sky Plaza", "type": "arena", "theme": "skyland", "music": "battle",
  "bounds": { "shape": "circle", "r": 70 },            // or { "shape": "rect", "w", "d" }
  "floors": [                                          // platforms / pillars (solid if taller than a step) / patches
    { "shape": "circle", "x": 0, "z": 0, "r": 13, "h": 3.2, "surface": "road" },
    { "shape": "rect", "x": 0, "z": 50, "w": 10, "d": 10, "h": 1.6, "rot": 0.785 },
    { "shape": "ramp", "x": 0, "z": 20, "w": 8, "d": 15, "rot": 3.14, "h0": 0, "h1": 3.2, "glider": false } ],
  "pads": [{ "x", "z", "rot" }], "itemBoxes": [{ "x", "z" }], "coins": [{ "x", "z" }],
  "decals": [{ "type": "ring", "x", "z", "r" }], "props": [{ "type", "x", "z", "y?", "rot?", "scale?", "spin?" }],
  "spawns": [{ "x", "z", "yaw" }] }                     // optional; default = obstacle-free ring
```

## Cups: `client/src/data/cups.json`

`[{ "id", "name", "theme", "color", "icon", "tracks": [4 track ids], "unlock"? }]`

## Songs: `client/assets/audio/songs/<id>.json`

```jsonc
{ "id": "skyland", "bpm": 142, "root": 62 /* MIDI */, "scale": "major",   // major minor dorian mixolydian
                                                                           // phrygian harmonicMinor lydian pentatonic
  "chords": [0, 4, 5, 3, 0, 4, 3, 4],        // scale degree of each bar's chord (one bar = 16 steps)
  "swing": 0.1,
  "bass":  { "style": "octaves", "wave": "triangle", "vol": 0.2 },  // octaves pulse walk gallop sparse root
  "lead":  { "wave": "square", "vol": 0.075, "lp": 5000, "rhythm": "x.x.x...x.x.x...", "notes": null },
                                             // notes: optional explicit scale degrees per step (null = rest);
                                             // otherwise a seeded melody is generated from the chords
  "arp":   { "pattern": [0, 1, 2, 1], "wave": "square", "every": 1 },  // drift layer (fades in while drifting)
  "pad":   { "wave": "triangle", "vol": 0.03 },   // or false
  "drums": { "kick": "x...x...x...x...", "snare": "....x.......x...", "hat": "x.x.x.x.x.x.x.x." } }  // x = hit, o = open hat
```

## Achievements: `client/src/data/achievements.json`

`[{ "id", "name", "desc", "icon", "reward": coins, "check": … }]`. Supported checks:
- `{ "stat": "<profile.stats key>", "gte": n }`
- `{ "trophies": "gold", "gte": n }`
- `{ "goldCups": 4 }`
- `{ "trophyClass": "mirror" }`
- `{ "treasures": n }`
- `{ "medals": "gold" | "any", "gte": n }`
- `{ "unlockedAll": "racers" }`
- `{ "dailyStreak": n }`

## Ghosts

- **Share code:** `G1.<base64url>`. After the header comes a zig-zag varint stream:
  - the header is a varint length followed by JSON: `{t: track, r: racer, v: vehicle, w: wheels, g: glider, tm: time, l: [lap times], hz, n: name}`;
  - then the frame count;
  - then per frame: delta-encoded `x, y, z` (cm), `yaw` (mrad) and raw `flags` (bit0/1 drift left/right, bit2 boost, bit3 airborne, bit4 glider).
- **Staff ghosts:** `client/src/data/staff/<track>.json` = `{ id, time, racer, code }`, plus `staffTimes.json`. Regenerate them with `node tools/make-staff-ghosts.mjs`.
- **Medals:** gold ≤ the staff time, silver ≤ +5%, bronze ≤ +12%.
- **Server share API:**
  - `POST /api/ghosts {track, time, name, racer, vehicle, data: "<G1 code>"}` → `{code: "ABC123"}`
  - `GET /api/ghosts/ABC123` → the stored object.

## Network protocol (summary)

The authoritative source is `shared/net/protocol.js`: `PROTOCOL_VERSION`, and the `KART_FULL` / `KART_VIEW` field order.

- **Client → server:**
  - `hello {token?, v}`, `create {name, public}`, `join {code, name}`, `quick {name}`, `leave`
  - `pick {racerId, vehicleId, wheelsId, gliderId}`, `ready {ready}`, `settings {…}` (host only), `start`, `vote {trackId}`, `rematch`
  - `ping {c, rtt}`, `pause`, `resume`
  - `i {f: [[seq, steer*127, buttons], …]}`
- **Server → client:**
  - `welcome {id, token, resumed}`, `room {…}`, `start {trackId, mode, entrants, you, tick, …}`
  - `s` (snapshot): `{t, ph, cd, tm, k: [[id, …KART_VIEW]], a, me: [...KART_FULL], bx, cn, p, h, e, l, bt, ev, pg}`
  - `results {results}`, `pong`, `error {message}`.
