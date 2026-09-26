# SkyKart

A mobile-first arcade kart racer with toy-like elemental racers, built for the browser: Three.js, vanilla ES modules and Vite on the client; Node and `ws` for server-authoritative online play. Everything runs in real time from data: characters, vehicles, tracks, props, music, sound effects and voices are generated procedurally, with no downloaded media.

- **16 racers** (8 unlocked at the start, 8 to unlock), each with a signature item. There are 20 vehicles (12 karts plus 8 bikes and quads), 6 wheel sets and 4 gliders.
- **Tracks:** 16 tracks in 4 cups, a Retro cup of 4 remixes, and 3 battle arenas. Every track has themed hazards and at least one shortcut.
- **Modes:** Grand Prix (50/100/150cc, Mirror, 200cc), Versus with custom rules (including Red vs Blue teams), Time Trial with staff ghosts, your best ghost and shared ghosts, Battle (Balloons and Coin Runners), Daily Challenge, and Online (room codes, quick match, spectating, rematch).
- **Progression:** coins, a shop, unlocks, 36 achievements, trophies, medals and treasure chests.
- **Presentation:** a mobile HUD, touch, tilt, keyboard and gamepad controls, a drag-to-edit button layout, accessibility options, and installation as a PWA with offline play.

## Quick start

```bash
npm install
npm run dev          # client on http://localhost:5173 (use your LAN IP on a phone)
npm run server       # game server on :8787 (online play, ghost sharing)
```

Open the dev URL on a phone in landscape, or use browser dev tools with a phone viewport such as 844×390. For online play, run `npm run server`. The dev client automatically connects to `<host>:8787`; add `?server=ws://host:port/ws` to override this.

Production build (the server also serves the built client):

```bash
npm run build        # -> dist/
npm run server       # http://localhost:8787 serves dist/ + /ws + /api
```

## Controls

| Action | Touch | Keyboard | Gamepad |
|---|---|---|---|
| Steer | wheel (left), or tilt | ← → / A D | left stick, D-pad |
| Accelerate | automatic (can be turned off in Settings) | ↑ / W | A / RT |
| Brake / reverse | BRAKE | ↓ / S | X / LT |
| Hop / drift | DRIFT (hold) | Space / Shift / K | RB |
| Item (hold = trail behind) | item slot | E / X / J / L | LB / Y |
| Throw backwards | drag down on the item button, or hold LOOK + item | ↓ + item | stick down + item |
| Trick (in the air) | ★ | T / I (or drift in the air) | D-pad up |
| Look back | 👁 | C / Q | B |
| Pause | ⏸ | Esc / P | Start |

Driving tips:
- Hold drift through a corner. Sparks go blue → orange → purple for three mini-turbo levels.
- For a rocket start, press and hold DRIFT (or accelerate) just before GO, as the "1" fades. Holding too early causes a wheelspin.
- Press trick when leaving a ramp for a small boost on landing.

## Scripts and tools

| Command | What it does |
|---|---|
| `npm test` | Vitest: physics, items, AI, networking, ghosts, plus every track being completable by AI (60+ tests) |
| `npm run check-assets` | Validates every racer, figure, vehicle, track, arena, cup, song and achievement |
| `npm run loadtest` | Headless bot clients against a local server (12 players per room) |
| `node tools/track-check.mjs [id\|all] [--race] [--svg dir] [--mirror]` | Track geometry checks, a 12-AI completion run and top-down SVG maps |
| `node tools/make-staff-ghosts.mjs [id]` | Regenerates the staff ghosts (an expert AI time trial on each track) |
| `node tools/make-icons.mjs` | Renders the PWA icons |
| `node tools/playtest.mjs --script <name>` | Scripted Playwright playtests with screenshots (mobile viewport) |
| `node tools/online-test.mjs` | Two headless browsers create, join, vote and race online |

### Dev URL parameters

| Parameter | Effect |
|---|---|
| `?race=<trackId>` | Jump straight into a race. Combine with `&laps=1&auto&cc=200cc&racer=<id>&count=6&solo&nointro`. |
| `&auto` | The AI drives your kart (item buttons still work) |
| `?edit=<trackId>` | **Track editor.** A top-down fly camera: click the road to place item rows, pads, coin lines, ramps and any hazard. You can delete, undo, drive-test and export the JSON. |
| `?dev` | Debug overlay |
| `?server=ws://…/ws` | Game server URL override |

## Project layout

```
client/            Vite app (root). index.html, public/ (PWA manifest, sw.js, icons)
  assets/          ★ replaceable content: racers/<id>/{racer,figure}.json, vehicles/, wheels/,
                     gliders/, audio/songs/ (swap this tree to re-skin the game)
  src/core/        app shell, sessions, input, settings, profile, GP logic, quality governor
  src/render/      Three.js: figures, kart views, track/arena/hazard views, particles, camera, replay
  src/ui/          DOM HUD, touch controls, menus, settings, online lobby
  src/modes/       time trial, battle, versus rules, progression (shop/profile/daily)
  src/audio/       procedural music sequencer, SFX synth, formant voices
  src/data/        tracks/, arenas/, cups.json, achievements.json, staff ghosts
  src/dev/         viewer and track editor
server/            Node HTTP + ws: hub, rooms (authoritative 60 Hz sim), ghost share store
shared/            simulation used by both client and server: physics, tracks, items,
                     hazards, AI, battle, laps, protocol, ghosts, data registry
tools/             validators, generators and headless test drivers
tests/             Vitest suites
docs/              DATA_FORMATS.md
ART_BIBLE.md  PLAN.md  ARCHITECTURE.md
```

## Replacing the IP-specific content

Everything character- or brand-specific lives in `client/assets/`:
- racer names and stats (`racer.json`), procedural figures (`figure.json`) and voices;
- vehicles, wheels and gliders;
- song data.

Tracks and cups live in `client/src/data/` and use only generic theme names.

To use real 3D models, set `"assets": { "model": "model.glb" }` in a `racer.json` (or `"model"` in a vehicle JSON) and drop the GLB next to it. It replaces the procedural figure without any code change. The formats are described in [docs/DATA_FORMATS.md](docs/DATA_FORMATS.md).

## Status and known limitations

Nothing in the codebase is a silent placeholder. The features below are limited or not implemented, and each is visible or documented where it applies:

- **Audio is procedural only.** Songs and SFX are synthesised in the browser (Web Audio). Pointing a song or bark at a real audio file is *not implemented*: `racer.assets.barks` is ignored, and procedural barks are used.
- **Feel was tuned without a physical phone.** Tuning used headless mobile-viewport runs, scripted inputs and simulation metrics. Tilt steering, haptics and multi-touch have been exercised in emulation only. All tunables live in `shared/config.js`.
- **Ghost sharing needs the game server for short codes.** Offline, the full ghost code (about 15 KB of text) is copied instead. It can be pasted into the same field.
- **Online play** uses JSON over WebSocket, with reconnect within 60 s, spectating and rematch. There are no accounts or matchmaking regions, and room state lives in memory.
- **Offline PWA:** the menus and single-player modes work offline once the game has been loaded. Staff ghosts and lazily loaded chunks are only available offline if they were used while online.
- **Visual verification** used SwiftShader, so frame rates in headless runs are not representative. Rendering cost is measured with draw calls and triangles: about 80 draw calls and 60–140k triangles in a 12-kart race. CPU cost is about 0.3 ms per frame on a desktop CPU.
