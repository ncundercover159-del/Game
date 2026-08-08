# Levels

Three jobs: `warehouse` (JOB 01), `tower` (JOB 02), `flooded` (JOB 03).

```
node shared/levels/leveltest.js      # every level file, registered or not
node server/smoke.js                 # the simulation itself
```

**A level joins `LEVELS` only once the lint is green against it.** `index.js` is
imported by the server, the client and both harnesses, so a level file that
throws on import stops the whole project at once. The lint reads this directory
rather than the `LEVELS` array and registers a candidate in `LEVEL_BY_ID`
in-process only, so waiting until it passes costs nothing — an unregistered
level is still fully tested, and the run names it so it cannot be forgotten.

---

## What the levels ask of the server

All of it is wired. Recorded here because the level data is the contract and
the numbers in it only make sense against these semantics.

| type | used by | notes |
|---|---|---|
| `extract_value` | all three | |
| `no_breakages` | all three | bonus in every case, so never gating |
| `extract_kind` | all three | `intact: true` on the two gating ones |
| `operate_in_order` | `flooded` | `done` is "all shut"; order is scored in water |

**`intact: true`** is on `tower#chandelier` and `flooded#fish`. Without it both
are satisfied by destroying the object and delivering the wreckage, which pays
a tenth and defeats the level. Any future required `extract_kind` on a fragile
kind wants it too.

**`operate_in_order`** reads `level.sequence`. `flooded` declares three valves
with an `order` and a `floods` naming the tank each one feeds. Shutting them out
of order does not fail the task — it applies `sequence.penalty` to the tank that
was skipped. A required task a mis-press can permanently fail is a required task
that ends the job at minute one.

**`flood`** is a piecewise-linear curve of absolute Y over seconds, plus
optional `zones`. A prop whose **origin** goes under is written off after
`FLOOD_WRITEOFF_MS`; a contractor whose head goes under drains
`DROWN_DAMAGE_PER_S`.

Water height at a point is `globalY` outside every zone and
`min(rim, globalY + bonus)` inside one. Two consequences worth writing down,
because both are easy to get wrong from the level side:

- **`rim` should equal `flood.end`.** Below it, an unpenalised tank stops
  rising while the sheet around it carries on, and the last minute of the job
  has three rectangles of water sitting below the surface. Above it, a
  penalised tank can stand higher than the plant ever floods, which is the bug
  the rim exists to prevent.
- **`penalty.metres` saturates deliberately.** One global figure cannot punish
  three tanks whose floors are at -2.0, -2.8 and -4.4 to the same degree: at
  2.2m it drowned the sump entirely and left the filter bed — the tank V1
  actually feeds — completely untouched, so the most likely mistake in the
  sequence was also the only free one. At 5.0m the penalty is simply "this tank
  is full now", and `rim` decides how full, per tank, if that ever needs to
  differ.

---

## Still open

**`build.js` `scatter()` and the warehouse mugs.** The warehouse's scattered
mugs land at 3.12m/s against a fragility of 3.2 — they survive their own
placement with 2% to spare, and it is the tightest margin in any level.
`scatter()` adds a fixed 0.03 to `centre[1]`, which is correct; the warehouse
then passes a centre 0.145m above where a mug actually rests, and the two
compound. Not urgent, not mine, and one number in `warehouse.js` if anyone
wants the headroom back. The lint prints the worst ratio per level every run.

*(Everything else previously listed here — `extract_kind` counting broken props,
`catwalk()` railing the ends of a Z-running walkway, and `Actor.step`
dereferencing a capsule it had just destroyed — is fixed.)*

---

## Authoring notes, for whoever writes JOB 04

Five things cost real time. They are in the level files as comments too, but
they generalise, and the lint asserts every one of them.

**Author every prop at its resting height, plus 20mm.** Gravity is -22 and a
contact resolves at about 1.12x the impact speed, so the drop a fragile thing
survives is `fragile² / 55` metres: 186mm for a mug, 110mm for a fishbowl,
82mm for a chandelier. `room.js` refuses to score breakages before
`PHASE.ACTIVE` and briefs for six seconds, which hides an authoring mistake
rather than fixing it — the level has still destroyed its own stock, it just
did it off-camera. The lint turns that gate off and measures what the level
actually does.

**A step rise over 0.30 is a step nobody wants to climb.** `MAX_STEP` is 0.42,
which is a limit and not a target. Measured by walking a bot up 4m of test
stair: a 0.286 rise climbs in 7.7s, a 0.333 rise takes 15.0s and a 0.364 rise
takes 17.5s of visible shuffling. Tread depth barely matters (0.44 walks as
well as 0.55) — a capsule 0.68m across straddles three treads whatever you do,
and the rise decides whether there is ever a clean one to stand on. Buy
steepness with distance instead.

**Every way into a hole must start flush with the edge it cuts through.** All
four of the plant's descents were originally set 800mm inside their tank, which
leaves an invisible gap behind the first step with the full depth of the tank
under it. It looks fine from every angle and it is a four-metre fall.

**A flight stacked over the landing it starts from has no headroom.** Its
underside descends to meet that landing, so the last 1.5m before the foot of
the next run is about 1.2m of clearance for a 1.72m contractor, and the route
simply stops working. Alternate the lane, not just the direction. Related: two
parallel runs with a gap between them is a fall the width of a contractor's
hips running the whole length of the structure, invisible from above. Boarded
lifts are boarded across the bay.

**In a level with water, the starting level is the most dangerous number in
the file.** `flooded` began at -3.6 with the sump floor at -4.4, so £4,478 of
stock — including the pump motor and one of the two fishbowls the job requires
— was written off during the loading screen. Nothing about the level file looks
wrong; the lint caught it because it now checks the flood curve against every
prop's origin. Start flush with the deepest floor the water can reach, and
shape the curve by tank rather than by the clock so each segment ends as one
tank's contents go under, deepest first.

### What the lint checks

Per level: `validateLevel`; every prop kind is in the catalogue; every task
type is one `room.js` implements (scraped from `room.js`, so it cannot rot);
at least 1.6x the quota on site; nothing breaks during a three-second settle
with scoring forced on from tick zero; no prop takes an impact it would not
survive; the whole spawn ring has floor under it (32 points, not just the eight
the room hands out); nobody spawns inside the building; the extract volume has
floor under it; everything is at rest, above the world floor and not embedded
after three seconds; ten seconds with three bots produces no NaN and stays
under 6ms/tick; a hard landing does not crash the room.

With water: nothing is under water at t=0; the quota is still 1.6x in reach at
half time; every required `extract_kind` has enough of its kind surviving past
35% of the time limit; every zone rims at or above the final level.

And **routes** — a bot on the real character controller walking the paths the
level is designed around, down *and back up*, because a descent that works is
not evidence that anything can get out again. Eight of them across the two new
jobs. They are what caught the scaffold pitch, the gap between the bays, and
all four of the plant's short descents.
