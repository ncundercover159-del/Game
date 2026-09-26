# SkyKart architecture

## Big picture

```
                 ┌──────────────── shared/ (pure ES modules, no DOM / Three.js) ────────────────┐
                 │ config.js  physics/kart.js  track/{track,arena,resolve,hazardState}.js         │
                 │ sim/{race,laps,items,hazards,battle,ghost}.js  ai/driver.js  net/protocol.js   │
                 │ data/registry.js (content registry, track resolution)                          │
                 └───────────────▲───────────────────────────────────────────▲──────────────────┘
                                 │ same code                                 │ same code
   client (browser)              │                          server (Node)     │
   ┌─────────────────────────────┴──────────┐               ┌─────────────────┴───────────────┐
   │ LocalSession: runs Race at 60 Hz       │               │ Hub → Room: runs Race at 60 Hz  │
   │ NetSession: predicts own kart,         │◄── ws JSON ──►│ per room, 20 Hz snapshots,      │
   │   interpolates others from snapshots   │   inputs /    │ bots fill the grid, reconnect,  │
   │ RaceStage (Three.js) ← viewState(id)   │   snapshots   │ ghost share store (/api/ghosts) │
   │ Hud / menus (DOM) · AudioManager       │               └─────────────────────────────────┘
   └────────────────────────────────────────┘
```

The rule that makes everything work: **the simulation is one deterministic set of modules with a fixed 60 Hz step**. Single-player runs it in the browser. Online play runs it on the server, and the client runs the *same* kart physics to predict its own kart.

## Simulation (`shared/`)

- **`sim/race.js`: `Race`** owns karts, the world, phases (countdown → racing → finished) and an event queue. Pluggable *systems* run in `preStep` and `postStep` around the per-kart physics step:
  1. `AIController`: produces inputs for non-human karts and applies the rubber band.
  2. `ItemSystem`: item boxes, roulette, 32 items, projectiles, hazards, coins and hits.
  3. `LapSystem`: continuous race distance, laps, places, wrong-way and the finish.
  4. `HazardSystem`: themed track hazards.
  5. `BattleSystem`: balloons, Coin Runners, scoring and the timer.
- **`physics/kart.js`: `stepKart`** is the arcade controller.
  - Speed approaches the top speed exponentially; steering uses a yaw rate plus lateral slip.
  - Hopping, drifting and three mini-turbo tiers; boosts; the start boost; tricks.
  - Ramps, gliding, landing, walls (reflect plus scrub), off-road, surfaces, falling and rescue.
  - Every number lives in `config.js`.
- **Worlds** implement one query interface, `probe(agent, x, y, z, out)` → ground height, normal, wall push-out, surface, ramp/glider flags and track-space progress. There are two implementations:
  - `TrackWorld` (`track/track.js`): the main closed spline plus open *branch* splines (shortcuts), resampled every 2 m into ribbons with per-sample width, banking, walls, gaps and surfaces. Queries project onto the nearest sample; a hill-climb from the kart's last sample index keeps them O(1). Dynamic colliders (doors, pistons, carousel hubs, collapsing bridges) are merged in through `probeDynamic`.
  - `ArenaWorld` (`track/arena.js`): analytic floors, platforms, ramps and pillars for battle.
- **Track resolution** (`track/resolve.js`) turns authored JSON into control points:
  - Turtle *paths* (`S`, `L`, `R`, `CLOSE` using a Dubins curve).
  - `@cmd+metres` anchors for every placement.
  - Chord-built shortcut branches.
  - `remixOf` + `reverse` for the retro cup. Reversal moves gap-jump ramps to the far side of their gap.
- **Hazards** (`track/hazardState.js`) are pure functions of race time, plus the leader's lap for collapsing bridges. The server applies their effects, and clients render and predict exactly the same motion with no extra network traffic.
- **AI** (`ai/driver.js`):
  - A curvature-based racing line with look-ahead pursuit.
  - A hop → drift → release state machine.
  - Shortcut decisions, hazard and item avoidance, gate timing (lasers, crushers, doors), caution near deadly edges, and item tactics.
  - Personalities and difficulties (line noise, look-ahead, mistakes, pace).
- **Ghosts** (`sim/ghost.js`): 20 Hz pose samples, delta/zig-zag varints and URL-safe base64 (`G1.…`).

## Client (`client/src/`)

- **Sessions.**
  - `LocalSession` steps the `Race` with a fixed-timestep accumulator and exposes interpolated `viewState(id)`.
  - `NetSession` implements the same interface online. See Networking below.
- **Rendering** (`render/`):
  - **Figures:** JSON bones plus primitive parts are merged into one skinned mesh per character or vehicle. The custom "vinyl toy" `ShaderMaterial` provides cel bands, a spec pip, rim light and fog. An inverted-hull outline is added up close.
  - **Animation:** a procedural spring `Animator`.
  - **Track geometry:** `TrackView` builds strips from the ribbons: road, kerbs, off-road, rails, canyon walls, tunnels, bridges with pillars, island skirts or embankments. Props are instanced and landmarks use figures.
  - **Hazards and items:** `HazardView` animates hazards from `hazardState`. `ItemView` draws items with instanced boxes and coins.
  - **Effects and cameras:**
    - Pooled GPU particles and skid marks in a single-draw ring buffer.
    - A chase camera with a constant horizontal FOV across aspect ratios.
    - A finish replay with trackside cameras.
  - **LOD:** outlines only near the camera, half-rate animation far away, and an adaptive quality governor (pixel ratio, particles, outlines, prop density).
- **UI** (`ui/`) is DOM over the canvas: the HUD, touch controls with a layout editor, screens with a stack manager, and CSS spring animations. The HUD reads kart state each frame and diffs text updates.
- **Modes** (`modes/`) install methods onto `App`: time trial, battle, versus rules and progression.
- **Audio** (`audio/`):
  - A Web Audio graph (master → compressor; music, SFX, engine and voice buses).
  - A look-ahead chiptune sequencer that compiles song data into per-step note tables. A drift arpeggio layer fades in while you drift, and the tempo rises on the final lap.
  - Synthesised SFX, per-kart engine voices panned by angle, and formant-synth barks with subtitles.
- **Persistence:** `localStorage` holds the profile (coins, unlocks, trophies, medals, best times, ghosts, stats, daily streak) and the settings.
- **PWA:** `public/sw.js` serves hashed assets cache-first and the page network-first. The API and WebSocket are never cached.

## Networking

- **Transport:** JSON over `ws` at `/ws`, with `perMessageDeflate`. The protocol version is checked on `hello`.
- **Client to server:** batched input frames `{type:'i', f:[[seq, steer*127, buttons], …]}`. The server rate-limits them with a per-tick token bucket and consumes one per tick.
- **Server to client:** snapshots at 20 Hz.
  - A shared body carries the tick, phase, time, compact kart view arrays, items, projectiles, hazards and effects, battle state and events.
  - Each player gets a small head: `a` (the last acknowledged input sequence) and `me` (the full state of their own kart).
- **Prediction and reconciliation:** the client applies the authoritative state of its own kart, replays the inputs the server hasn't acknowledged yet, and hides small corrections with a decaying visual offset.
- **Remote karts** are interpolated about 100 ms in the past. The clock offset follows the fastest-arriving snapshots.
- **Events** such as hop, drift and mini-turbo are predicted locally and dropped from snapshots for the local kart.
- **Resilience:** a reconnect token gives a 60 s grace period, and a bot drives your kart meanwhile. Mid-race joiners spectate. Players can rematch, and a paused or hidden tab hands control to the bot.

## Data flow for content

`client/src/data/load.js` (Vite `import.meta.glob`) and `shared/data/nodeLoader.js` (fs) both call `setGameData()`. The registry resolves tracks once, so the client, server, tests and tools all see identical, resolved content.

## Testing strategy

- **Unit and simulation tests (Vitest):**
  - kart physics: drifting, jumps, walls, rescue;
  - items, the AI and networking (prediction, reconciliation, rate limits);
  - ghost codec accuracy;
  - **every track and mirror completable by AI**, and every arena running a battle.
- **Headless browser drivers (Playwright + SwiftShader)** in `tools/`: scripted playtests, a two-browser online race, and screenshot contact sheets.
- **Validators:** `check-assets` (content) and `track-check` (geometry, AI completion, maps).
