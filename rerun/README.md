# RERUN

*Every round, your past self comes back. Solid. In the way. Forever.*

A 3–8 player 3D web game for phones. Twenty rounds, twenty seconds each. At
the end of every round everything you did is recorded and replayed as a
**ghost** that repeats your exact run, in a twenty-second loop, for the rest of
the match. Ghosts never stop. They accumulate. Twenty rounds means twenty
copies of you, all looping simultaneously — and with a full room the ghost cap
starts retiring your oldest selves, with a eulogy, around round eight.

**Ghosts are solid.** They collide with living players. They can shove you off
a ledge, block a doorway, or — usefully — be stood on.

The objective needs more bodies than you have. There are always more pressure
plates than living players, so the only way to progress is to have spent an
earlier round standing somewhere useful, on purpose, for future-you. You are
cooperating with your past self, who was an idiot.

Sabotage is fully legal. Spend a whole round standing in the closet doorway and
a permanent copy of you stands in that doorway forever. This is an obviously
good strategy. It is supposed to be.

Deaths replay too. Fall in the pit in round two and you will still be watching
yourself fall into it in round six, with the same little scream, every twenty
seconds. By round five the arena has a rhythmic background of distant screams
on a twenty-second cycle. That is the soundtrack. There is no music.

---

## Run it locally

Two terminals.

```bash
# terminal 1 — the server
cd rerun
npm install
npm start                 # :8787

# terminal 2 — the client
cd rerun/client
npm install
npm run dev               # :5173, proxies /ws to :8787
```

Open `http://<your-lan-ip>:5173` on a few phones on the same wifi. Vite is
already bound to `0.0.0.0`.

Below three players there aren't enough bodies for the plates to be
interesting, so START is disabled. To poke at it solo while developing:

```bash
RERUN_MIN_PLAYERS=1 npm start
```

### Solo build (single file, no server)

```bash
cd rerun/client
npm run build:solo     # -> ../artifact/dist/rerun-solo.html
```

One self-contained HTML file, ~546KB, no network at all: the server `Room`
runs in the page behind a loopback socket, so the phase machine, recordings,
plate authority and wire messages are the real ones. One player, twenty rounds,
nineteen past selves by the end — which is the whole game, since you were
always cooperating with yourself.

### One-command production build

```bash
cd rerun
npm run build      # builds client/dist
npm start          # server serves client/dist AND /ws on the same origin
```

---

## The rounds

The goal changes each round and always needs more simultaneous plate-presses
than the last one.

| # | Plates | The catch |
|---|--------|-----------|
| 1 | 1 | None. Everyone stands on it. Sets the baseline. |
| 2 | 2 | Far apart. Living players can just split up. Feels fine. |
| 3 | 3 | One is on a 2.1m ledge. Jump apex is 1.36m. Stand on somebody. |
| 4 | 4 | The turnstile only stays down while weight is *increasing*. It wants arrivals, not residents. |
| 5–6 | 5–6 | The closet: a door held open by one plate, and plates inside it. Someone has to be the doorman. Forever. |
| 7–14 | 7–14 | One more plate each round, until every plate in the room is lit at once. |
| 15–19 | 14 | No new plates. Instead, one more of them converts to a turnstile each round, so a wall of parked ghosts stops being enough. |
| 20 | 14 | **THE RECKONING.** Half the room is turnstiles and every ghost you have ever been is in it. |

Turnstile plates render blue and their pips are dashed, because standing on one
is a wasted body.

Scoring is plate-seconds, accumulated per tick across the required set, plus a
+25 bonus the first time a round's full set is held simultaneously.

The results screen hands out `MOST USELESS GHOST`, `MOST OBSTRUCTIVE` and
`STILL FALLING`. They are awarded seriously.

---

## Architecture

```
rerun/
  shared/       simulation shared verbatim by client and server
    constants.js   tuning
    arena.js       geometry, plates, round layouts, spawns
    physics.js     capsules, boxes, step-up, ghost shoving
    ghostbuf.js    recording buffers + the binary wire format
    plates.js      plate evaluation (server-authoritative)
  server/       node + ws
    index.js       http, /health, static client, socket routing
    room.js        phase machine, recording, scoring, broadcasts
    codes.js       4-letter room codes
  client/       vite + vanilla js + three.js. no react.
    src/world.js       scene, merged arena, plates, decals, camera fit
    src/character.js   the articulated rig: head, torso, arms, legs, walk cycle
    src/ghosts.js      instanced ghost rendering + hats + flies
    src/avatars.js     living players + projected name tags
    src/instancing.js  raw instance-matrix writers
    src/input.js       joystick + JUMP
    src/net.js         websocket, clock sync
    src/audio.js       the screams
    src/ui.js          screens, HUD, overlays
    src/main.js        glue, prediction, render loop
```

### Ghosts are recorded transforms, not inputs

Replaying inputs deterministically does not work. Floating-point physics is not
deterministic across machines or even across frames, and ghosts desync within
about two seconds. So:

- During the twenty-second round the server samples each living player's
  position and facing at **20Hz** — 400 samples per player per round.
- Samples are quantised to `int16` millimetres: **3600 bytes per ghost**, in
  fixed-size buffers allocated once and never grown.
- On playback the ghost is a **kinematic body**. It follows its recorded
  transform exactly, ignoring all forces. It pushes living players. It is never
  pushed. It never deviates.
- Clients interpolate between samples for smooth motion; the server evaluates
  collisions and plates from the same interpolation on the same clock, so the
  two agree.

A kinematic ghost can walk *through* a living player and shove them into
geometry. When that happens the player is pushed along the ghost's velocity
vector, and if they end up pinned against a wall they get popped upward. It
looks bad. It is very funny. It is not fixed any further than that.

### The round clock

Ghost playback position is always:

```js
ghostPos = mod(serverNow - playStart, 20000)
```

`playStart` is the absolute server timestamp of the current — or upcoming —
play phase, and it ships in every state packet. During the three-second
countdown `serverNow - playStart` is negative, so ghosts play their final three
seconds and roll seamlessly into position zero exactly as the round begins.
There is one deliberate discontinuity, at the hard cut when a round ends.

### Networking

Server-authoritative. The server owns the recordings, the playback clock and
the plate states.

- Clients send `{stick:{x,y}, jump}` at 30Hz.
- Server simulates at 60Hz, broadcasts living player state at 20Hz.
- **Ghosts are not in the state broadcast.** Each ghost's full recording is
  sent once, as a binary frame, at the moment it is created; after that clients
  replay it against the shared clock. This is the difference between a 3KB/s
  game and a 60KB/s one.
- Plate states come from the server every tick and are never computed
  client-side — interpolated client ghosts disagree at the boundaries.
- Late joiners get the whole archive on join (up to ~215KB, squeezed by
  permessage-deflate) behind a "CATCHING UP" screen. They start with zero
  ghosts of their own and are at a real disadvantage. They get labelled
  `NEW HERE` above their head for the rest of the match.
- Reconnect within 30 seconds resumes the same player and keeps their ghosts.
  `sessionStorage` holds `{roomCode, playerId}`. **A disconnected player's
  ghosts keep running.** They come back to find themselves still working.
- Host leaving promotes silently.
- Rooms live in a server-memory `Map` and expire after ten idle minutes. There
  is no database.

The client also runs the shared physics locally for its own capsule and
reconciles gently toward the server, so the stick feels attached to the player
rather than to the network.

### Rendering budget

- Characters are articulated — head, torso, two arms, two legs — with a real
  walk cycle, an airborne pose and a death flail. Every *part* is its own
  `InstancedMesh`, so one draw call covers that part across all sixty ghosts.
  Five draw calls for the whole crowd, where a skinned mesh per ghost would be
  sixty. Animating all sixty rigs measures at **0.09ms/frame**.
- The walk cycle is driven by cumulative distance travelled, derived from the
  recording when a ghost is decoded. So the feet match the ground rather than
  skating, and every client derives the same phase from the same tape without
  transmitting a byte of animation data.
- Living players use the same rig, lit and opaque. The arena is merged into one
  geometry.
- **No shadow maps at all.** Fake radial decals only, culled beyond 15m.
- 16 draw calls and ~17.5k triangles with 60 ghosts on screen, inside the
  40 / 25k budget.
- `setPixelRatio(min(devicePixelRatio, 2))`, dropping to 1.5 automatically
  after sustained frame pressure.
- Camera is a fixed high angle framing the whole arena. It does not follow you.
  You need to see the crowd, and a chase camera in a room this dense is
  nauseating.

Client bundle: **~140KB gzipped** (Three.js is ~120KB of that).

Check the live budget in the console: `__rerun.info`.

---

## Deploying

The client is a static bundle and the server is a long-lived process. You can
put them in one place or two.

### One service (simplest)

The included `Dockerfile` builds the client and serves it from the same origin
as the WebSocket, so nothing needs configuring.

```bash
cd rerun
docker build -t rerun .
docker run -p 8787:8787 rerun
```

- **Railway** — `railway.json` is set up for the Dockerfile. Set the root
  directory to `rerun`.
- **Render** — `render.yaml` is a Docker web service with `/health` as the
  health check. Root directory `rerun`.
- **Fly** — `fly launch --no-deploy && fly deploy` from `rerun/`. Rooms live in
  process memory, so `fly.toml` pins it to a single always-on machine. Do not
  scale it out.

### Two services (static host + server)

Deploy the server as above, then the client to Netlify or Vercel:

- **Netlify** — set *Base directory* to `rerun/client`; `netlify.toml` does the
  rest.
- **Vercel** — set *Root Directory* to `rerun/client`; `vercel.json` does the
  rest.

Either way you **must** set `VITE_SERVER_URL` at build time, or the client will
try to open a socket against the static host and fail:

```
VITE_SERVER_URL=wss://your-server.example.com
```

### Environment variables (server)

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `8787` | |
| `RERUN_MIN_PLAYERS` | `3` | Lower it only for solo development. |

---

## Manual test checklist

There are no automated tests. Run this on real phones.

**Feel**
- [ ] Movement is grippy, not floaty. Stopping is immediate.
- [ ] Jump is a fixed height. No double jump. Coyote time is ~100ms and you
      cannot feel it as a delay.
- [ ] One ghost, on its own, is funny. If it isn't, sixty won't be.

**Characters**
- [ ] Legs and arms swing in a real walk cycle, and the feet do not skate.
- [ ] Jumping tucks a knee up and throws the arms overhead.
- [ ] A ghost that died flails, upside-down-ish, forever.
- [ ] Sixty animated ghosts still report under 40 draw calls in `__rerun.info`.

**Ghosts**
- [ ] Round two: your ghost repeats round one exactly, including standing still.
- [ ] You can be shoved by your own past self.
- [ ] You can stand on a ghost's shoulders and step onto the ledge.
- [ ] Ghosts get generation hats: cone at 3, brim at 4, the unstable one at 5,
      all three plus flies at 6.
- [ ] `YOUR PAST SELVES` only ever goes up.

**The death loop**
- [ ] Fall in the pit; the scream plays.
- [ ] Next round, your ghost falls in the same pit with the same scream.
- [ ] By round five there is a rhythmic background of distant screams.
- [ ] Around round eight with a full room, the oldest ghosts retire with a eulogy.
- [ ] A player who fell in round two can still see themselves falling in round
      six.

**Plates**
- [ ] Round 3's ledge plate cannot be reached without standing on a body.
- [ ] Round 4's turnstile ignores someone standing on it and responds to
      arrivals.
- [ ] From round 15 the converted turnstiles read blue, in the arena and in
      the pips.
- [ ] Round 5's closet door opens only while the door switch is held.
- [ ] Pips at the top of the screen match the plates lighting up in the arena.

**Multiplayer**
- [ ] Six phones on different networks play a full twenty-round match.
- [ ] Two people describing the arena at the 15-second mark of round five agree
      about where the ghosts are.
- [ ] Refresh mid-round: back in under five seconds with all ghosts intact.
- [ ] Kill a player's connection: their ghosts keep running without them.
- [ ] Host quits: someone else silently becomes host.
- [ ] A late joiner sees `NEW HERE` over their own head for the rest of the
      match.

**Performance**
- [ ] `__rerun.fakeGhosts(60)` holds 45fps or better on a three-year-old
      mid-tier Android.
- [ ] `__rerun.info` reports under 40 draw calls and under 25k triangles.
- [ ] No memory growth across a full match.

**Mobile**
- [ ] Portrait only; the rotate overlay appears in landscape.
- [ ] No pinch-zoom, no double-tap-zoom, no overscroll, no text selection.
- [ ] JUMP clears the home indicator on a notched phone.
- [ ] Screen does not sleep during a match.
- [ ] Audio starts on the first tap, not before.

---

## Deliberately not here

No accounts, no persistence between matches, no matchmaking, no leaderboards,
no cosmetics beyond generation hats, no voice chat, no analytics, no level
editor.

There is no mechanic for deleting your own ghosts, and no way to preview your
run before committing to it. The whole game is that you cannot take it back.
