# Levels — what the server still needs to wire

Three jobs ship in `LEVELS`: `warehouse`, `tower`, `flooded`. All three are
complete and winnable **today**, using only the task types `room.js` already
supports (`extract_value`, `no_breakages`, `extract_kind`).

Two of them carry level data the server does not read yet. That data is listed
below with exact semantics. Nothing here is required for the levels to play —
it is required for them to mean what their briefs say they mean.

Run the lint before touching any of this:

```
node shared/levels/leveltest.js      # every level file, registered or not
node server/smoke.js                 # the simulation itself
```

---

## 1. `extract_kind` counts broken things, and probably should not

**This is a live bug in an existing task type, not a new feature.**

`Room.checkExtraction` sets `rec.extracted` and increments `extractedKinds`
regardless of `rec.broken`. A prop that has shattered still collides with
static geometry (`World.breakProp` only drops it out of the ACTOR and RAGDOLL
groups), so its husk comes to rest in the van and banks at 10% value — and
counts, in full, toward `extract_kind`.

So THE CHANDELIER (tower) and THE OCCUPANTS (flooded) — both unbonused, both
therefore gating their job — can be completed by throwing the object off a
nineteen-metre plate and delivering the wreckage.

Suggested: an optional `intact: true` on `extract_kind`, counting only props
where `!rec.broken`.

```js
} else if (t.type === 'extract_kind') {
  const n = t.intact ? (this.extractedIntact.get(t.kind) || 0)
                     : (this.extractedKinds.get(t.kind) || 0);
```

with a second `Map` filled alongside the first when `!rec.broken`. Once that
exists, add `intact: true` to `tower.tasks#chandelier` and
`flooded.tasks#fish`. I have left both without it rather than write a flag the
server silently ignores.

---

## 2. `operate_in_order` — the flooded plant's shutdown sequence

**Needs:** a USE interaction on brushes, and a task type that scores the order
they are used in.

`flooded.js` carries three valve stands as brushes:

```js
box(p, [0.5, 1.15, 0.5], 'steelblue',
    { tag: 'valve', valve: 'V1', order: 1, label: 'INTAKE' })
```

and the same three in `level.sequence`, which is the authoritative copy:

```js
sequence: {
  id: 'shutdown',
  valves: [
    { id: 'V1', order: 1, label: 'INTAKE',         p: [...], floods: 'bed'    },
    { id: 'V2', order: 2, label: 'FILTER BYPASS',  p: [...], floods: 'sump'   },
    { id: 'V3', order: 3, label: 'SLUDGE RETURN',  p: [...], floods: 'sludge' },
  ],
  penalty: { kind: 'flood_zone', metres: 2.2 },
}
```

### The interaction

`BUTTON.USE` is currently consumed entirely by `Room.tryRevive`. A valve needs
it too. Suggested precedence: revive first (a downed contractor beats
plumbing), and only if `tryRevive` found nobody, look for a valve.

- Ray or short shape-cast from the eye, `GRAB_RANGE`-ish (3.0m is generous for
  a valve; 2.0m reads better), against `GROUP_STATIC`.
- The hit collider maps back to its brush. **There is no brush↔collider map
  today** — `World.buildStatic` throws the brush away after creating the
  collider. It needs the same treatment props get: a `byHandle` entry, or a
  `this.brushByHandle = new Map()` alongside it.
- Holding USE for ~1.2s turns the valve (they are wheels, not switches). Emit
  `{ type: 'valve', detail: { id, order, index } }` so the HUD can say so.
- A valve turns once. Re-using a shut valve is a no-op, not an error.

### The task

```js
{ id: 'shutdown', type: 'operate_in_order', sequence: 'shutdown',
  title: 'SHUT IT DOWN', detail: '...' }
```

- `progress` = valves shut / total.
- `done` when all are shut **and** every one was shut in ascending `order`.
- Out of order is **not** a failure — it applies `sequence.penalty` and the
  task can still be completed by shutting the rest. A hard fail on a
  mis-click is miserable in a co-op game where somebody else pressed it.
- `penalty: { kind: 'flood_zone', metres: 2.2 }` means: the tank named by the
  **skipped** valve's `floods` gets its water level raised by 2.2m
  immediately. Skip V1 and the filter bed fills while you are standing in it.

---

## 3. `flood` — a rising water level

**Needs:** a water level that rises on a schedule, and something that happens
to people and props below it.

`flooded.js` carries:

```js
flood: {
  start: -3.6,          // absolute Y, not depth below the deck
  end: 0.4,
  startsAt: 40,         // seconds after the job goes ACTIVE
  reaches: [
    { y: -2.8, at: 120, note: 'the sludge tank floor is gone' },
    { y: -2.0, at: 190, note: 'the filter bed floor is gone' },
    { y: -0.6, at: 300, note: 'only the sump stair head is above it' },
    { y:  0.4, at: 360, note: 'the deck' },
  ],
}
```

`reaches` is a piecewise-linear curve through absolute heights, keyed on
seconds since the job started. Interpolate between entries; hold at `end`.
`start` applies before `startsAt`. Levels without a `flood` block have no
water and nothing changes for them.

Minimum viable behaviour, in the order it is worth implementing:

1. **The client draws it.** A single translucent plane at `y`, sent in the
   snapshot as one quantised value. Everything else is cosmetic without this,
   because a deadline you cannot see is just a random loss.
2. **Props below it are lost.** Simplest honest rule: a prop whose origin has
   been under the water line for `EXTRACT_DWELL_MS` is written off — mark it
   `flooded`, stop it counting for anything, and emit an event so the HUD can
   flash the value you just lost. Buoyancy is not needed and is a trap: a
   floating piano is funny once and wrong for ever.
3. **Contractors below it drown.** Reuse the downed path rather than inventing
   one — head under water (`pos.y + EYE_HEIGHT < floodY`) drains health at
   about 12/s so an accidental dunk is survivable and a trapped contractor at
   the bottom of the sump is not.
4. **Movement in water.** If it is cheap: below the line, scale
   `WALK_SPEED`/`SPRINT_SPEED` by ~0.55 and add drag. If it is not cheap,
   skip it — the deadline does the work.

The plant's numbers are tuned against a 400s limit so that: the sludge tank
and filter bed are gone by half time, the sump stair head goes under at 300s,
and the deck itself is only wet at the very end. The lorry at 2.2m and the
gantry at 4.6m are never reached, deliberately — there is always somewhere dry
to stand and be out of pocket.

---

## 4. `build.js` — `catwalk()` rails the wrong two sides
### (reported, not fixed: `build.js` is not this pass's file)

```js
export function catwalk(p, s, mat = 'grate') {
  return [
    box(p, s, mat, { tag: 'catwalk' }),
    box([p[0], p[1] + 0.55, p[2] - s[2] / 2], [s[0], 1.1, 0.06], 'railing', ...),
    box([p[0], p[1] + 0.55, p[2] + s[2] / 2], [s[0], 1.1, 0.06], 'railing', ...),
  ];
}
```

The two rails are always on the ±Z faces and always span `s[0]` in X. That is
correct for a catwalk running along X — which is the only kind the warehouse
and the tower have — and it walls off **both ends** of one running along Z,
turning a walkway into a 2m box you cannot enter.

I hit this building the plant's gantry (a north–south branch to the control
room) and worked around it with a local helper. Intended behaviour, if you
want it in `build.js`:

> Rail the two **long** sides, whichever axis they are on. If `s[0] >= s[2]`,
> rail the ±Z faces spanning `s[0]` in X (today's behaviour, unchanged). If
> `s[2] > s[0]`, rail the ±X faces spanning `s[2]` in Z.

```js
const long = s[0] >= s[2];
const rail = (dx, dz) => box(
  [p[0] + dx, p[1] + 0.55, p[2] + dz],
  long ? [s[0], 1.1, 0.06] : [0.06, 1.1, s[2]],
  'railing', { tag: 'rail', thin: true },
);
return [
  box(p, s, mat, { tag: 'catwalk' }),
  long ? rail(0, -s[2] / 2) : rail(-s[0] / 2, 0),
  long ? rail(0,  s[2] / 2) : rail( s[0] / 2, 0),
];
```

This is backward compatible: every existing call has `s[0] > s[2]`.

Worth knowing either way: a helper that rails both long sides cannot express a
T-junction, because the rail of the through-route blocks the branch. The plant
builds its one junction out of two rail segments with a gap. If `catwalk` ever
grows an options bag, `{ rails: 'both' | 'north' | 'south' | 'none' }` is the
thing that would have saved the most effort here.

---

## 5. `server/actor.js` — a hard landing crashes the room
### (reported, not fixed: `server/` is not this pass's file)

Reproduced on the **untouched warehouse**, no new level involved:

```
actor.js:228   a landing over FALL_SAFE_SPEED calls this.damage(...)
actor.js:279   damage() over RAGDOLL_TRIGGER_DAMAGE calls enterRagdoll()
actor.js:293   enterRagdoll() calls destroyCapsule(), which nulls this.body
actor.js:240   ...and step() then reads this.body.setNextKinematicTranslation
```

Any fall of more than about three metres — 9.5m/s is `FALL_SAFE_SPEED`, and
12 damage is `RAGDOLL_TRIGGER_DAMAGE`, so the threshold is
`9.5 + 12/6.2 = 11.4m/s` — throws a `TypeError` out of `Room.step`. That
includes stepping off the warehouse mezzanine.

It has never been seen because `smoke.js` only ragdolls an actor by calling
`damage()` from outside `step()`, which returns to a caller that does not then
touch the capsule. It matters now because THE TOWER is a level about falling
off things and THE FLOODED PLANT has a 4.4m sump.

The fix is one line, after the fall-damage call at actor.js:230:

```js
if (this.ragdoll) return;   // damage() may have taken the capsule away
```

`leveltest.js` asserts this on every level and currently records it as a known
defect. **It heals itself** — the moment `actor.js` grows that line the check
flips from a recorded `WARN` to a passing `ok`, with no edit needed here.

---

## Authoring notes, for whoever writes JOB 04

Three numbers cost me the most time; they are in the level files as comments
too, but they generalise.

**Author every prop at its resting height, plus 20mm.** Gravity is -22 and a
contact resolves at about 1.12x the impact speed, so the drop a fragile thing
survives is `fragile² / 55` metres: 186mm for a mug, 110mm for a fishbowl,
82mm for a chandelier. `room.js` refuses to score breakages before
`PHASE.ACTIVE` and briefs for six seconds, which hides an authoring mistake
rather than fixing it — the level has still destroyed its own stock, it just
did it off-camera. `leveltest.js` turns that gate off and measures what the
level actually does.

**A step rise over 0.30 is a step nobody wants to climb.** `MAX_STEP` is 0.42,
which is a limit and not a target. Measured by walking a bot up 4m of test
stair: a 0.286 rise climbs in 7.7s, a 0.333 rise takes 15.0s and a 0.364 rise
takes 17.5s of visible shuffling. Tread depth barely matters (0.44 walks as
well as 0.55) — a capsule 0.68m across straddles three treads whatever you do,
and the rise is what decides whether there is ever a clean one to stand on.
Buy steepness with distance instead.

**Every way into a hole must start flush with the edge it cuts through.** All
four of the plant's descents were originally set 800mm inside their tank, which
leaves an invisible gap behind the first step with the full depth of the tank
under it. It looks fine from every angle and it is a four-metre fall.
