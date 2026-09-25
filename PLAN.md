# SKYKART — Implementation Plan

## Key architectural decisions

1. **One simulation, two hosts.** The whole race simulation (karts, items,
   hazards, laps, AI) lives in `/shared` as plain deterministic ES modules with a
   fixed 60 Hz step and no DOM or Three.js imports. Single-player runs it in the
   browser. Online play runs the *same* code on the Node server, and clients
   predict only their own kart with the shared kart module.
2. **Track space.** A track is a set of *ribbons* (the main closed spline plus
   optional branch splines for shortcuts). Ground height, surface type, walls,
   void (falls), progress, wrong-way and rescue points come from projecting onto
   the nearest ribbon sample. This gives a cheap, exact heightfield that the
   server can evaluate without meshes. Battle arenas use an analytic
   floor/platform model with the same query interface.
3. **Data-driven everything.** Racers are `racer.json` + `figure.json` (a
   primitive-part recipe) under `client/assets/racers/<id>/`. The figure builder
   merges all parts into one skinned mesh (one draw call + one outline). A
   `model.glb` path in the JSON replaces the procedural figure with no code
   change. Vehicles, wheels and gliders work the same way. Tracks are JSON with
   positions expressed in track space (`t` along the spline, `lane` across it).
4. **Rendering on a mobile budget.** One custom "vinyl" shader (cel bands, spec
   pip, rim, fog) for characters and vehicles, Lambert and vertex colours for the
   world, merged static geometry, instanced props, coins and item boxes, blob
   shadows, pooled GPU particles, inverted-hull outlines, an adaptive quality
   governor.
5. **UI in the DOM.** HUD and menus are HTML/CSS over the canvas: crisp text,
   springy CSS animations, safe-area insets, and accessibility come almost free.
6. **Audio is procedural first.** Music comes from a pattern sequencer (song JSON)
   with base, drift and final-lap layers. SFX and "barks" are synthesised. Any
   entry can point at a real audio file instead.
7. **Networking.** A JSON protocol over `ws`. Inputs are sent with sequence
   numbers, the server returns 20 Hz snapshots carrying `ackSeq`, and the client
   rewinds and replays its own kart. Remote karts are interpolated 100 ms behind.
   Item events are sent reliably in order (they share the TCP stream).

## Milestones

| # | Deliverable | Done when |
|---|---|---|
| M1 | Vite app, shared kart physics, touch/keyboard input, drift + 3 mini-turbo tiers, start boost, placeholder racer, chase cam, flat test plane with cones and a ramp | Driving and drifting feel good in a 844×390 mobile viewport |
| M2 | Spline ribbon builder (banking, kerbs, rails, off-road, void), lap/position logic, wrong-way, rescue, one full track, HUD basics, countdown | 3 laps can be completed; the HUD is correct |
| M3 | Item system (orbs, homing, peels, boosts, bomb, shrink, ink, star, magnet, horn), item boxes with roulette, coins, hit reactions | Items work and feel juicy vs. dummy karts |
| M4 | AI (racing line, drift, items, personalities, difficulties), rubber-banding, Grand Prix loop with points, results and podium | A full 4-race cup is playable end to end |
| M5 | 16 racers (figure JSONs), animation set, portraits, 20 vehicles + wheels + gliders, character select turntable, garage | All racers and vehicles are selectable and visible in races |
| M6 | Node server, rooms, lobby, prediction/reconciliation, interpolation, bots filling slots, reconnect, load-test bot | 12 clients race on one machine |
| M7 | 16 tracks + 3 arenas + 4 remixes, all themed hazards, shortcuts, per-cup music, full SFX | Every track is completable by AI in tests |
| M8 | Time trial + ghosts (sharing codes, staff ghosts), battle + coin runners, unlocks, currency, achievements, daily challenge, settings, accessibility | Progression persists; all modes are reachable from menus |
| M9 | Polish, perf pass (throttled CPU profile), PWA, dev editor, docs, bug bash | Build passes; tests pass; docs complete |

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Feel is subjective and can't be playtested on a real phone here | All tunables live in `shared/config.js` with comments. A debug overlay shows speed, drift charge and tier. Headless Playwright runs drive scripted inputs and log speed curves. |
| Floating-point divergence between browsers and Node | The server is authoritative. Clients reconcile, so small divergence only causes invisible corrections. Determinism tests cover same-engine repeatability. |
| Draw calls with 12 racers on low-end phones | Skinned merged figures (2 calls each), instancing, adaptive quality that drops outlines, particles and pixel ratio. |
| 16 tracks is a lot of authoring | A compact track JSON format with defaults, per-cup themes that dress tracks automatically, and a procedural prop scatterer. |
| Headless WebGL is slow (SwiftShader) | Screenshots are for visual checks only. Performance is measured with CPU-side step timings and draw-call counts. |
| Trademarked characters in the references | Original names and primitive models. All IP-sensitive content lives under `client/assets/`. |
| Scope | Build vertically. Each milestone is runnable. Stubs are logged loudly and listed in the README. |

## Decisions noted (no questions asked)

- The existing ORBIT game was moved to `orbit/` to free the repo root.
- AI lives in `/shared/ai`, because the server needs it for bots. The same goes
  for physics in `/shared/physics`. `client/src/physics` and `client/src/ai`
  re-export them so the requested layout still resolves.
- The HUD moves off the bottom corners (thumbs). The layout is otherwise the one
  from the references.
- Loops/anti-gravity are out of scope. Signature moments are jumps, drops, glides,
  banked bowls and waterfalls.
- The "lakitu-style" rescuer is an original character: *Puff*, a cloud critter
  with a fishing rod.
- Ghost sharing: short codes go through the game server. When no server is
  reachable, the game falls back to a long self-contained code.
