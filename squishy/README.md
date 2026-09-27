# SQUISHY

A gentle two-player online co-op game. Two squishy mochi creatures drop into a quiet
Japanese forest shrine at golden hour and explore it together: pressing stone switches in
unison, bouncing off each other, crossing a koi pond on stepping stones, and answering the
shrine's questions as one. The whole run takes about 6–10 minutes, has no fail states, and
the trivia is re-rolled on every replay.

Three.js + Vite on the client, Node + `ws` on the server. The server is authoritative.

## Running it

```bash
cd squishy
npm install
npm run dev          # game server on :8787 + Vite on :5173 (proxies /ws)
```

Open `http://localhost:5173` in two browsers. To play on phones on the same Wi-Fi, open
`http://<your-computer's-LAN-IP>:5173`. Vite listens on all interfaces.

Production (one process serves the built client and the WebSocket):

```bash
npm run build
PORT=8080 npm start  # http://localhost:8080, WebSocket at /ws
```

`npm test` runs a headless smoke test covering room create/join, input/ack, full room,
disconnect/pause/resume, leave, trivia retry, the springboard, the bell finale and replay.

## How to play

- **Create Room** shows a 4-letter code (no I/O, so nobody mixes up letters). The other
  player taps **Join** and enters it. Exactly two squishies per room.
- **Move:** left thumb anywhere on the left half of the screen (the joystick floats to
  your thumb). **Squish:** hold the round button on the right. A tap squishes for 0.4 s;
  holding keeps you flat.
- Desktop: WASD / arrow keys + Space.

The route, zone by zone:

| Zone | Co-op task |
| --- | --- |
| 森の入口 Forest Entrance | Two mossy switch-stones. Squish on both at the same time (within 0.6 s) to open the wooden gate. |
| 竹林 Bamboo Grove | Squish the leaf-stone to open the far gate for 15 s, then squeeze **under** a fallen-bamboo gap (only fits when squished) and get through together. Once you're both past, it stays open. **Trivia gate 1** at the exit. |
| 鯉の池 Koi Pond | Stand together in the stone ring to raise the stepping stones. They sink 9 s after you leave. Falling in plops you back on the shore. If only one of you makes it across, the switch-stone on the far bank raises them again for your partner. |
| 参道 Shrine Approach | The terrace wall is too high to climb. One squishy squishes flat by the wall and the other rolls onto them and gets **boosted** up, then squishes a switch up top so stone steps rise for the partner. Komainu guard the torii, which is **trivia gate 2**. |
| 境内 Shrine Courtyard | Dusk falls. Squish both lantern-stones together to light the lanterns, which wakes **trivia gate 3**. Then stand by the bell and squish together (within 1 s) to ring it and end the run. |

Fireflies drift around the courtyard, and a few float high enough that you need a boost to
reach them. Catching fireflies, crossing the pond and answering in harmony all add to a
shared "moments" counter. It's there for fun and doesn't do anything.

### Trivia

A pool of 20 gentle Japanese culture / nature questions lives on the server
(`server/index.js`), and 3 are drawn at random each run. Answer order is shuffled per gate.
When both squishies reach a gate, both get the same card. Each player picks on their own,
and the card only shows that your partner has picked, not what. If you both give the
correct answer, the gate opens with a chime. If you disagree or are both wrong, both picks
are shown and you get one more try. After that the gate opens anyway and shows the answer
with a short fun fact. Nobody gets stuck.

## Architecture

```
server/
  index.js    HTTP static host for dist/, WebSocket at /ws, 20 Hz tick loop, trivia pool
  rooms.js    room codes, create/join/resume/leave, 30 s reconnect grace, meta broadcast
  game.js     the authoritative Session: physics stepping, plates, gates, stones, stairs,
              trivia state machine, fireflies, bell finale, replay reset
shared/
  level.js    level layout (zones, gates, plates, stones, props with colliders)
  physics.js  deterministic squishy movement + colliders (used by server AND client)
  protocol.js tick rates, packing of player state
client/
  main.js     renderer, render loop, screen flow, camera, hints, HUD glue
  squishy.js  blob mesh, face, squash-and-stretch springs, hop-bounce cycle
  world.js    terrain, trees, bamboo (wind-sway shader), koi pond + boids, shrine,
              torii, komainu, lanterns, god rays, falling leaves, sky/fog, day→dusk
  puzzles.js  switch-stones, pond ring, stepping stones, stairs, gates, bell, fireflies
  trivia.js   synced trivia modal
  net.js      WebSocket client, reconnect, input batching, prediction + reconciliation,
              snapshot interpolation
  joystick.js floating virtual joystick + hold-to-squish button, keyboard fallback
  audio.js    procedural WebAudio: zone-crossfaded nature beds, koto/shakuhachi motif,
              squish/boop/spring/splash/chime/bell sounds (no audio files)
  util.js     canvas textures, static-geometry batcher, sway / rim shader patches
```

### Netcode

- **Server-authoritative.** Clients only send input commands `[seq, jx, jz, action]`,
  batched about every 50 ms. The server simulates at 60 Hz with `shared/physics.js` and
  broadcasts snapshots at 20 Hz. Discrete state (flags, trivia, moments, pause) goes out
  in separate `meta` messages whenever it changes.
- Each client's commands drive its own squishy one-for-one, so **client-side prediction**
  of your own squishy is exact apart from interactions with your partner and moving world
  pieces. On each snapshot the client rewinds to the server state, drops acknowledged
  commands and replays the rest. Any residual error is smoothed out visually over about
  80 ms. If no commands arrive for 0.35 s (tab in the background, lag spike), the server
  steps that squishy with idle input.
- The **partner** is rendered about 110 ms in the past, interpolated between snapshots.
- **Disconnects** freeze the whole session and show a reconnect countdown (30 s). The
  client keeps its room token in `sessionStorage` and reconnects on its own with backoff,
  even after a page reload. If the grace window runs out, the remaining player is told
  kindly and sent back to the start.

### The squishy look

There's no soft-body simulation. Each squishy is an icosphere with some irregularity and a
flattened base, set in a few nested transforms driven by damped springs: sine-wave idle
breathing, a continuous hop-bounce while moving (they never walk), squash on landing with
overshoot, a ~150 ms flatten along the contact normal on bumps, and a pancake squash with
a stretchy rebound for the big squish. A fresnel rim term adds warm back-lighting. Idle
squishies turn around after a moment so you can see their faces.

### Performance notes (mobile)

Scenery is instanced or merged per material into 36 m slices so both the camera and the
1024² shadow map cull off-screen chunks. The shadow camera follows your squishy. Fog
hides the 150 m far plane. Render resolution adapts between 0.75× and 1.75× device pixels
depending on frame rate.

## Stretch goals

- **Seasonal palette swap: done.** Each run is either autumn (red and orange maples,
  falling leaves) or spring (cherry blossoms, falling petals). Play Again alternates the
  season.
- Hidden teahouse zone: not built.
- Colour picker in the lobby: not built. Player 1 is always Mochi (pink) and player 2 is
  always Matcha (green).

## Debugging

Start the server with `SQUISHY_DEBUG=1` to enable a dev-only `{t:'dbg'}` message that
teleports both squishies and sets puzzle flags, e.g. from the browser console:
`__squishy.net.raw({ t: 'dbg', z: 170, y: 2.2, flags: { court: true } })`.
To point a client at a different server, add `?server=wss://host/ws` to the URL. Share
links take the form `?room=ABCD`, which pre-fills the join code.
