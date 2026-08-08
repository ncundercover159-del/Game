// HAZARD PAY — the level lint.
//
// Levels are hand-authored data and hand-authored data is wrong. Every failure
// mode below has a specific, boring cause and a specific, boring fix, and all
// of them look identical from inside the game ("it feels bad"), which is why
// they are asserted here instead of discovered there:
//
//   a spawn ring point with no floor        one contractor in eight falls for ever
//   a prop authored above its rest height   the level shatters its own stock on load
//   a prop authored inside a wall           Rapier ejects it at whatever speed it likes
//   an extract volume over a hole           money that cannot be banked
//   a quota above what is on site           an unwinnable job that reads as a bug
//
// Every level ships through this, warehouse included. Run: node shared/levels/leveltest.js
//
// The room is real — same Room, same World, same Rapier — because the only
// numbers worth asserting on are the ones the server will actually produce.

import RAPIER from '@dimforge/rapier3d-compat';
import { readdir, readFile } from 'node:fs/promises';
import { Room } from '../../server/room.js';
import { initPhysics, membership, GROUPS } from '../../server/world.js';
import { LEVELS, LEVEL_BY_ID, validateLevel } from './index.js';
import { PROP_BY_ID } from '../props.js';
import { TICK_MS, PHASE, MAX_PLAYERS, GRAVITY } from '../tune.js';

let fails = 0;
let level = null;                       // whose assertions we are printing
const ok = (name, cond, extra) => {
  if (!cond) { fails++; console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
  else console.log(`  ok   ${name}${extra ? ` — ${extra}` : ''}`);
  return cond;
};
const warn = (name, extra) => console.log(`  WARN ${name}${extra ? ` — ${extra}` : ''}`);

// ---------------------------------------------------------------------------
// geometry probes

/** Is there static geometry under this point? Same cast Room.spawnFor uses. */
function groundUnder(room, p, reach = 8) {
  const ray = new RAPIER.Ray({ x: p[0], y: p[1] + 0.4, z: p[2] }, { x: 0, y: -1, z: 0 });
  return room.world.world.castRay(ray, reach, true, undefined,
    membership(GROUPS.GROUP_ACTOR, GROUPS.GROUP_STATIC));
}

const qrot = (q, v) => {
  // v + 2 * cross(q.xyz, cross(q.xyz, v) + q.w * v)
  const tx = 2 * (q.y * v[2] - q.z * v[1]);
  const ty = 2 * (q.z * v[0] - q.x * v[2]);
  const tz = 2 * (q.x * v[1] - q.y * v[0]);
  return [
    v[0] + q.w * tx + (q.y * tz - q.z * ty),
    v[1] + q.w * ty + (q.z * tx - q.x * tz),
    v[2] + q.w * tz + (q.x * ty - q.y * tx),
  ];
};

/**
 * Is this prop embedded in the building?
 *
 * Resting on a floor and being buried in one are the same contact as far as
 * Rapier is concerned, so the test is run against a version of the prop's own
 * collider shrunk by SKIN on every axis. A prop that is merely touching the
 * world loses that contact when it shrinks; a prop that is 300mm inside a
 * racking deck still overlaps, and that is the one worth shouting about.
 */
const SKIN = 0.04;
function embeddedIn(room, rec) {
  const def = rec.def;
  const parts = def.shape === 'compound'
    ? def.parts : [{ shape: def.shape, size: def.size, offset: [0, 0, 0] }];
  const p = rec.rb.translation();
  const q = rec.rb.rotation();
  const hits = [];
  for (const part of parts) {
    const shrink = (v, by) => Math.max(0.005, v - by);
    let shape;
    if (part.shape === 'box') {
      shape = new RAPIER.Cuboid(
        shrink(part.size[0] / 2, SKIN), shrink(part.size[1] / 2, SKIN), shrink(part.size[2] / 2, SKIN),
      );
    } else if (part.shape === 'cyl') {
      shape = new RAPIER.Cylinder(shrink(part.size[1] / 2, SKIN), shrink(part.size[0], SKIN));
    } else {
      shape = new RAPIER.Ball(shrink(part.size[0], SKIN));
    }
    const o = qrot(q, part.offset || [0, 0, 0]);
    room.world.world.intersectionsWithShape(
      { x: p.x + o[0], y: p.y + o[1], z: p.z + o[2] }, q, shape,
      (col) => { hits.push(col.handle); return false; },
      undefined, membership(GROUPS.GROUP_ACTOR, GROUPS.GROUP_STATIC),
    );
  }
  return hits.length > 0;
}

/**
 * Is this prop sitting on a conveyor?
 *
 * A brush with `drift` is a moving surface, so anything resting on it is
 * permanently in motion by design and "did everything come to rest" has to
 * know that or the warehouse fails its own conveyor.
 */
function onDrift(lvl, rec) {
  const p = rec.rb.translation();
  for (const b of lvl.brushes) {
    if (!b.drift) continue;
    const top = b.p[1] + b.s[1] / 2;
    if (p.y < top - 0.3 || p.y > top + 1.4) continue;
    if (Math.abs(p.x - b.p[0]) > b.s[0] / 2 + 0.5) continue;
    if (Math.abs(p.z - b.p[2]) > b.s[2] / 2 + 0.5) continue;
    return true;
  }
  return false;
}

/** The bottom of the lowest brush in the level. Nothing may end up under it. */
const floorOfTheWorld = (lvl) => Math.min(...lvl.brushes.map((b) => b.p[1] - b.s[1] / 2));

/**
 * The task types room.js actually implements, read out of room.js.
 *
 * A level naming a task type the server has never heard of does not fail
 * loudly — `checkTasks` simply never sets `done`, so an unbonused task of that
 * type gates the job for ever and the crew plays out the full time limit on a
 * job that cannot be completed. That is the quietest possible failure and it
 * looks exactly like bad luck.
 *
 * Scraped rather than hard-coded so this cannot rot: the day room.js grows
 * `operate_in_order`, this picks it up with no edit here.
 */
async function supportedTaskTypes() {
  const src = await readFile(new URL('../../server/room.js', import.meta.url), 'utf8');
  return new Set([...src.matchAll(/t\.type === '([a-z_]+)'/g)].map((m) => m[1]));
}

/**
 * Where the water is at time t, by the curve in `level.flood`.
 *
 * Mirrors the piecewise-linear read the server does: flat at `start` until
 * `startsAt`, then straight lines between the `reaches` entries, then flat at
 * `end`. Global level only — zones and penalties are the server's business.
 */
function waterAt(flood, t) {
  if (!flood) return -Infinity;
  if (t <= flood.startsAt) return flood.start;
  let py = flood.start, pt = flood.startsAt;
  for (const r of flood.reaches || []) {
    if (t <= r.at) return py + (r.y - py) * ((t - pt) / (r.at - pt));
    py = r.y; pt = r.at;
  }
  return flood.end;
}

// ---------------------------------------------------------------------------
// routes
//
// "No unreachable objectives" is not something a raycast can tell you. A
// staircase whose rise crept over MAX_STEP, a landing 200mm short of the flight
// it meets, a board that does not quite overlap the plate — all of those are
// geometrically plausible and none of them can be walked, and you only find out
// by walking. So: a bot, real character controller, seeking one waypoint at a
// time up the route the level is designed around.
//
// These lists belong to the test, not to the level. Deriving them from the
// level's own constants would only assert that arithmetic is arithmetic.

const stairTowerRoute = () => {
  const LV = [0, 4.0, 7.8, 11.6, 15.4, 19.2];
  const SA = -13.75, SB = -11.65;
  const out = [
    [10.0, 0.2, -13.0],     // across the yard, giving the tower's base a wide berth
    [-9.0, 0.2, -13.0],
    [-9.0, 0.2, -3.4],
    [SA, 0.2, -3.2],        // the foot of the first flight
  ];
  // Both bays carry a flight for every storey, so the waypoints have to name
  // the bay as well as the height: aim vaguely at "up" from the south landing
  // and the shortest line is back down the flight you just climbed.
  for (let k = 0; k < 5; k++) {
    const mid = (LV[k] + LV[k + 1]) / 2;
    out.push([SA, LV[k], -3.3]);     // the foot of bay A, on the south landing
    out.push([SA, mid, 3.3]);        // up bay A to the north landing
    out.push([SB, mid, 3.3]);        // across it
    out.push([SB, LV[k + 1], -3.3]); // up bay B, arriving on the next landing
  }
  out.push([-8.0, LV[5], -3.9]);     // and out along the bridge onto the roof
  out.push([-2.6, LV[5], -1.6]);     // ...to where the chandelier is
  return out;
};

const ROUTES = {
  tower: [
    {
      // The furniture route. If this one breaks the chandelier task is a lie
      // and so is the piano bonus, because nothing heavy has any other way down.
      name: 'the site stair reaches the roof',
      waypoints: stairTowerRoute(),
      budgetMs: 90000,
    },
    {
      // The fast route: three 33-degree runs and a 600mm board across the gap.
      name: 'the scaffold runs reach L3, and the board reaches the plate',
      waypoints: [
        [-6.4, 0.2, -9.6],
        [1.16, 4.0, -9.6],   // top of the first run, onto the L1 lift
        [4.9, 4.0, -9.6],    // east along the lift, still in the lower bay
        [4.9, 4.0, -7.9],    // step across into the upper bay
        [-0.82, 7.8, -7.9],  // up the second run
        [-4.9, 7.8, -7.9],   // west along the L2 lift
        [-4.9, 7.8, -9.6],   // back into the lower bay
        [0.82, 11.6, -9.6],  // up the third, onto the L3 lift
        [3.4, 11.6, -8.4],
        [3.4, 11.6, -6.0],   // over the board, onto the plate
      ],
      budgetMs: 60000,
    },
    {
      // Down only, and the test says so: 45 degrees is inside the controller's
      // climb limit and outside its slide limit.
      name: 'the collapsed slab drops you onto the east deck',
      waypoints: [
        [4.0, 15.5, -2.0],
        [6.2, 15.5, -2.0],   // over the kick rail at the plate edge
        [9.0, 12.9, -2.0],   // ...and there is no walking back up this
        [10.9, 11.7, -2.0],
      ],
      budgetMs: 30000,
    },
  ],

  // Every tank on this job is a hole with exactly one or two ways out, and the
  // whole level is the claim that a 260kg motor can come UP one of them. So
  // each route is walked down AND back, which is the half that actually
  // matters: a descent that works is not evidence of anything.
  flooded: [
    {
      name: 'the sump stair goes down 4.4m and back up',
      waypoints: [
        [-9.0, 0.2, 3.6],
        [4.0, -4.4, 3.6],    // fifteen treads to the floor of the deep one
        [-1.0, -4.4, -0.4],  // alongside the pump motor, not into it: walk a
                             // capsule at a 260kg box and the solver settles
                             // the argument by putting the capsule in the floor
        [4.0, -4.4, 3.6],
        [-9.0, 0.2, 3.6],    // ...and out again, which is the whole job
      ],
      budgetMs: 60000,
    },
    {
      name: 'the filter bed ramp goes down and back up',
      waypoints: [
        [-19.5, 0.2, 6.5],
        [-19.5, -2.0, -0.6],
        [-16.0, -2.0, 0.4],
        [-19.5, -2.0, -0.6],
        [-19.5, 0.2, 6.5],
      ],
      budgetMs: 45000,
    },
    {
      name: 'the sludge companionway goes down and back up',
      waypoints: [
        [18.5, 0.2, -3.4],
        [11.8, -2.8, -3.4],
        [13.0, -2.8, 0.4],
        [11.8, -2.8, -3.4],  // back to the foot of the steps, squarely
        [14.0, -1.4, -3.4],  // ...and up them
        [18.5, 0.2, -3.4],
      ],
      budgetMs: 45000,
    },
    {
      name: 'the gantry stair reaches the control room',
      waypoints: [
        [-23.5, 0.2, -13.0],
        [-23.5, 4.6, -4.0],
        [-23.5, 4.6, 5.0],
        [-21.4, 4.6, 10.0],
      ],
      budgetMs: 45000,
    },
    {
      name: 'the deck reaches the flatbed',
      waypoints: [
        [8.0, 0.2, -11.7],
        [14.6, 2.2, -11.7],
        [19.5, 2.2, -12.6],
      ],
      budgetMs: 30000,
    },
  ],
};

/**
 * Walk a bot along a waypoint list, one leg at a time.
 *
 * Deliberately dim: face the next waypoint, hold W, ease off as it gets close
 * so a landing does not turn into a nineteen-metre drop off an unrailed edge.
 * If a leg cannot be walked in its share of the budget the route is broken and
 * the waypoint it died on is the geometry to go and look at.
 */
function walkRoute(room, actor, waypoints, budgetMs) {
  let leg = 0;
  let now = 0;
  let crashed = null;
  const stalled = { at: null, pos: null };
  const perLeg = budgetMs / waypoints.length;
  let legStart = 0;

  actor.pos = { x: waypoints[0][0], y: waypoints[0][1], z: waypoints[0][2] };
  actor.vel = { x: 0, y: 0, z: 0 };
  actor.body.setNextKinematicTranslation({
    x: actor.pos.x, y: actor.pos.y + actor.height / 2, z: actor.pos.z,
  });
  leg = 1;

  const steps = Math.round(budgetMs / TICK_MS);
  for (let i = 0; i < steps && leg < waypoints.length; i++) {
    const t = waypoints[leg];
    const dx = t[0] - actor.pos.x, dz = t[2] - actor.pos.z;
    const flat = Math.hypot(dx, dz);
    const yaw = Math.atan2(-dx, dz);
    // Ease down inside two metres; sprint the long legs across open ground.
    const gas = Math.min(1, Math.max(0.25, flat / 2));
    actor.pendingInput = {
      seq: 0, moveX: 0, moveY: gas, yaw, pitch: 0,
      buttons: flat > 6 ? 2 : 0, holdDist: 1.85,
    };
    now += TICK_MS;
    // A bot walking a 1.1m scaffold board falls off it, and a fall of more than
    // three metres currently takes the whole room down — see checkHardLanding.
    // Catch it here so a route test reports "fell off" rather than aborting the
    // entire suite on somebody else's bug.
    try { room.step(now); } catch (err) { crashed = err; break; }

    // Arrive properly, and tightly. A loose radius on a staircase lets the bot
    // "reach" a landing while still standing on the flight, and the next leg
    // then walks it straight back down again; on a 1.0m companionway a 0.75m
    // radius lets it arrive beside the steps rather than on them, after which
    // the straight line to the next waypoint goes underneath the whole flight.
    if (flat < 0.45 && Math.abs(actor.pos.y - t[1]) < 0.6) { leg++; legStart = now; }
    if (now - legStart > perLeg * 3) {
      stalled.at = leg;
      stalled.pos = [actor.pos.x, actor.pos.y, actor.pos.z];
      break;
    }
  }
  return {
    done: leg >= waypoints.length,
    crashed,
    leg,
    target: waypoints[Math.min(leg, waypoints.length - 1)],
    pos: stalled.pos || [actor.pos.x, actor.pos.y, actor.pos.z],
  };
}

/**
 * A hard landing must not take the room with it.
 *
 * It currently does, in every level, including the untouched warehouse:
 *
 *   actor.js:228  a landing over FALL_SAFE_SPEED calls this.damage(...)
 *   actor.js:279  damage() over RAGDOLL_TRIGGER_DAMAGE calls enterRagdoll()
 *   actor.js:293  enterRagdoll() calls destroyCapsule(), which nulls this.body
 *   actor.js:240  ...and step() then reads this.body.setNextKinematicTranslation
 *
 * Anything over about a three metre drop, so: the warehouse mezzanine, every
 * plate in the tower, and the sump in the plant. Nobody has hit it because
 * smoke.js only ever ragdolls an actor from OUTSIDE step(), by calling
 * damage() directly, which returns to a caller that does not then touch the
 * capsule. The fix is one line in a file this pass does not own — an early
 * `if (this.ragdoll) return;` after the fall-damage call.
 *
 * Written to heal itself: the day actor.js grows that line, this check goes
 * from a recorded defect to a passing assertion with no edit here.
 */
function checkHardLanding(room, lvl) {
  const slot = room.join({ send() {} }, 'FALLER');
  const a = room.actors.get(slot);
  a.pos = { x: lvl.spawn[0], y: lvl.spawn[1] + 1.5, z: lvl.spawn[2] };
  a.vel = { x: 0, y: -16, z: 0 };
  a.body.setNextKinematicTranslation({ x: a.pos.x, y: a.pos.y + a.height / 2, z: a.pos.z });
  let now = 1e6;
  try {
    for (let i = 0; i < 120; i++) {
      a.pendingInput = { seq: 0, moveX: 0, moveY: 0, yaw: 0, pitch: 0, buttons: 0, holdDist: 1.85 };
      now += TICK_MS;
      room.step(now);
    }
  } catch (err) {
    room.leave(slot);
    return err;
  }
  room.leave(slot);
  return null;
}

const isTheKnownFallCrash = (err) => /setNextKinematicTranslation/.test(err.message)
  && /actor\.js/.test(String(err.stack));

const advance = (room, ms, t0, fn) => {
  const steps = Math.round(ms / TICK_MS);
  let now = t0;
  for (let i = 0; i < steps; i++) {
    now += TICK_MS;
    room.step(now);
    if (fn) fn(i, now);
  }
  return now;
};

// ---------------------------------------------------------------------------

async function checkLevel(lvl) {
  level = lvl.id;
  console.log(`\n=== ${lvl.name}  (${lvl.id}) ===`);

  // --- 1. the data ---------------------------------------------------------
  const errs = validateLevel(lvl);
  if (!ok('validateLevel is clean', errs.length === 0, errs.join('; '))) return;

  const unknown = lvl.props.filter((p) => !PROP_BY_ID[p.kind]).map((p) => p.kind);
  if (!ok('every prop kind is in the catalogue', unknown.length === 0, unknown.join(', '))) return;

  // --- 2. is the job possible at all? --------------------------------------
  const stock = lvl.props.reduce((n, p) => n + PROP_BY_ID[p.kind].value, 0);
  const ratio = stock / lvl.quota;
  ok('the site holds at least 1.6x the quota', ratio >= 1.6,
    `£${stock} of stock against a £${lvl.quota} quota (${ratio.toFixed(2)}x)`);

  const unknownTasks = lvl.tasks.filter((t) => !SUPPORTED.has(t.type));
  const gating = unknownTasks.filter((t) => !t.bonus);
  ok('every task type is one room.js implements', unknownTasks.length === 0,
    unknownTasks.length
      ? `${unknownTasks.map((t) => `${t.id}:${t.type}`).join(', ')}`
        + `${gating.length ? ` — ${gating.length} of them REQUIRED, so the job can never complete` : ''}`
      : [...new Set(lvl.tasks.map((t) => t.type))].join(', '));

  // --- 2b. does the flood leave a job behind? ------------------------------
  // A prop whose origin goes under is written off after 900ms, so a level with
  // rising water is really a schedule of disappearing money. Two things have to
  // hold: nothing is already drowned when the crew walks in, and there is still
  // more than the quota in reach for the whole first half of the job.
  if (lvl.flood) {
    const f = lvl.flood;
    const lostBy = (t) => lvl.props.filter((p) => p.p[1] < waterAt(f, t));
    const worth = (ps) => ps.reduce((n, p) => n + PROP_BY_ID[p.kind].value, 0);

    const drowned = lostBy(0);
    ok('nothing is under water before the job starts', drowned.length === 0,
      drowned.length
        ? `${drowned.length} props worth £${worth(drowned)} — the water starts at `
          + `${f.start} and the lowest stock sits at `
          + `${Math.min(...lvl.props.map((p) => p.p[1])).toFixed(2)}`
        : `water starts at ${f.start}, lowest prop at `
          + `${Math.min(...lvl.props.map((p) => p.p[1])).toFixed(2)}`);

    const half = lvl.timeLimit / 2;
    const left = stock - worth(lostBy(half));
    ok('the quota is still comfortably in reach at half time', left >= lvl.quota * 1.6,
      `£${left} above water at t=${half}s (${(left / lvl.quota).toFixed(2)}x quota)`);

    // Every REQUIRED extract_kind needs at least one of its kind that the water
    // cannot delete before the crew could plausibly have got to it.
    for (const t of lvl.tasks.filter((x) => !x.bonus && x.type === 'extract_kind')) {
      const survives = lvl.props
        .filter((p) => p.kind === t.kind)
        .map((p) => {
          let s2 = lvl.timeLimit;
          for (let u = 0; u <= lvl.timeLimit; u++) if (waterAt(f, u) > p.p[1]) { s2 = u; break; }
          return s2;
        })
        .sort((a, b) => b - a);
      const enough = survives.slice(0, t.count);
      const worst = enough.length === t.count ? enough[enough.length - 1] : 0;
      ok(`the water leaves time to satisfy "${t.title}"`, worst >= lvl.timeLimit * 0.35,
        `${t.count} of ${survives.length} ${t.kind}(s) needed; the ${t.count}${
          t.count === 1 ? 'st' : 'th'} longest-lived lasts ${worst}s of ${lvl.timeLimit}s`);
    }

    const zones = Object.entries(f.zones || {});
    if (zones.length) {
      const badRim = zones.filter(([, z]) => z.rim < f.end);
      ok('every flood zone rims at or above the final level', badRim.length === 0,
        badRim.length
          ? `${badRim.map(([k]) => k).join(', ')} rim below end=${f.end}, so those tanks `
            + 'stop rising while the sheet around them carries on'
          : `${zones.length} zones, rim ${zones[0][1].rim} === end ${f.end}`);
    }
  }

  // Room resolves a level through LEVEL_BY_ID and silently falls back to the
  // default when it misses, so an unregistered level would otherwise boot as
  // the warehouse and pass every assertion below about the wrong building.
  // Registering it here, in this process only, is what lets a level be proved
  // before index.js — which the whole project imports — is touched at all.
  LEVEL_BY_ID[lvl.id] = lvl;
  const room = await Room.create(`T-${lvl.id.slice(0, 3).toUpperCase()}`, lvl.id);
  if (!ok('the room boots', room.level === lvl, `got "${room.level.id}"`)) return;

  // --- 3. the settle -------------------------------------------------------
  // Scoring is forced on from tick zero. The room would normally sit in LOBBY
  // and then brief for six seconds, and room.js refuses to break anything until
  // PHASE.ACTIVE precisely so that a settling level cannot destroy its own
  // stock — which is a kindness the author should not be leaning on. Turn the
  // kindness off and see what the level actually does.
  room.phase = PHASE.ACTIVE;
  room.startedAt = 0;
  room.phaseEndsAt = 1e9;

  const peak = new Map();
  const now = advance(room, 3000, 0, () => {
    for (const rec of room.world.props.values()) {
      if (rec.dv > (peak.get(rec.id) || 0)) peak.set(rec.id, rec.dv);
    }
  });

  // No exemptions. There was one here — warehouse.js authored its piano 700mm
  // above its rest height and shattered it on every load — and it is fixed, so
  // the exemption is gone with it. A tolerated failure that outlives its cause
  // is just a hole in the test.
  const broke = [...room.world.props.values()].filter((r) => r.broken);
  ok('nothing breaks while the level settles', broke.length === 0,
    broke.length
      ? broke.map((r) => {
        const authored = lvl.props[r.id - 1];
        return `${r.kind} authored y=${authored.p[1]}, hit at ${peak.get(r.id).toFixed(2)}m/s `
          + `vs fragile ${r.def.fragile} — needs to sit within `
          + `${(r.def.fragile ** 2 / (2 * -GRAVITY * 1.12 ** 2)).toFixed(3)}m of its rest height`;
      }).join('; ')
      : '0 breakages');

  // Every prop authored at its resting height means every prop's worst impact
  // during the settle is under what would destroy it, with headroom. Same
  // measurement as above, taken per prop rather than per breakage, so it still
  // has something to say about a level whose fragile stock happens to land
  // somewhere forgiving.
  const hot = [];
  let worst = { ratio: 0 };
  for (const rec of room.world.props.values()) {
    if (!rec.def.fragile) continue;
    const r = peak.get(rec.id) / rec.def.fragile;
    if (r > worst.ratio) worst = { ratio: r, kind: rec.kind, dv: peak.get(rec.id), f: rec.def.fragile };
    if (r > 1) hot.push(rec.kind);
  }
  ok('no prop takes an impact it would not survive', hot.length === 0,
    hot.length ? hot.join(', ')
      : `worst is ${worst.kind} at ${worst.dv?.toFixed(2)}m/s of ${worst.f} (${(worst.ratio * 100).toFixed(0)}%)`);

  // --- 4. the spawn ring ---------------------------------------------------
  // Rapier's query pipeline is built during step(), so every raycast below has
  // to happen after the settle and not before it — cast into a world that has
  // never ticked and everything reports empty space, including the floor.
  //
  // Room.spawnFor falls back to the author's own point when a ring position has
  // no floor, so a level with a bad ring still "works" — by stacking eight
  // contractors inside each other. Assert the ring itself, not the fallback.
  const spread = lvl.spawnSpread || 1.8;
  let ringBad = 0, firstBad = null;
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const c = [lvl.spawn[0] + Math.cos(a) * spread, lvl.spawn[1], lvl.spawn[2] + Math.sin(a) * spread];
    if (!groundUnder(room, c)) { ringBad++; if (!firstBad) firstBad = c; }
  }
  ok('the whole spawn ring has floor under it', ringBad === 0,
    ringBad ? `${ringBad}/32 points over nothing, first at ${firstBad.map((v) => v.toFixed(1))}`
      : `r=${spread}m, 32 points`);

  // ...and every slot the room will actually hand out is clear of the walls.
  let slotBlocked = 0;
  for (let s = 0; s < MAX_PLAYERS; s++) {
    const c = room.spawnFor(s);
    let hit = false;
    room.world.world.intersectionsWithShape(
      { x: c[0], y: c[1] + 0.86, z: c[2] }, { x: 0, y: 0, z: 0, w: 1 },
      new RAPIER.Capsule(0.5, 0.3),
      () => { hit = true; return false; },
      undefined, membership(GROUPS.GROUP_ACTOR, GROUPS.GROUP_STATIC),
    );
    if (hit) slotBlocked++;
  }
  ok('nobody spawns inside the building', slotBlocked === 0, `${slotBlocked}/${MAX_PLAYERS} slots blocked`);

  // --- 5. the extract volume ----------------------------------------------
  const e = lvl.extract;
  const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]];
  let noFloor = 0;
  for (const [sx, sz] of corners) {
    const c = [e.p[0] + sx * e.s[0] * 0.42, e.p[1] - e.s[1] / 2 + 0.1, e.p[2] + sz * e.s[2] * 0.42];
    if (!groundUnder(room, c, 2.0)) noFloor++;
  }
  ok('the extract volume has floor under it', noFloor === 0,
    noFloor ? `${noFloor}/5 probes found nothing within 2m` : 'all 5 probes landed');

  // --- 6. where everything ended up ---------------------------------------
  const bottom = floorOfTheWorld(lvl);
  let moving = 0, drifting = 0, sunk = 0, buried = 0;
  const movers = [], buriers = [];
  for (const rec of room.world.props.values()) {
    const v = rec.rb.linvel(), a = rec.rb.angvel();
    const p = rec.rb.translation();
    const still = Math.hypot(v.x, v.y, v.z) < 0.2 && Math.hypot(a.x, a.y, a.z) < 0.6;
    if (!still) {
      if (onDrift(lvl, rec)) drifting++;
      else { moving++; movers.push(`${rec.kind}@${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`); }
    }
    if (p.y < bottom) sunk++;
    if (embeddedIn(room, rec)) { buried++; buriers.push(`${rec.kind}@${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`); }
  }
  ok('everything is at rest after 3s', moving === 0,
    moving ? movers.slice(0, 6).join(' ') : `${room.world.props.size} props${drifting ? `, ${drifting} on a conveyor` : ''}`);
  ok('nothing fell out of the world', sunk === 0, `lowest brush is y=${bottom.toFixed(2)}`);
  ok('nothing is buried in the building', buried === 0,
    buried ? buriers.slice(0, 6).join(' ') : `${room.world.props.size} props clear by ${SKIN * 100}mm`);

  // --- 7. ten seconds of real room, with contractors in it -----------------
  // Bots rather than an empty world: an empty room never exercises the grab,
  // the character controller or the ragdoll, and those are where NaN comes from.
  const fake = { send() {} };
  const slots = [room.join(fake, 'ALPHA'), room.join(fake, 'BRAVO'), room.join(fake, 'CHARLIE')];
  const bots = slots.map((s) => room.actors.get(s));
  const input = (o) => ({ seq: 0, moveX: 0, moveY: 0, yaw: 0, pitch: 0, buttons: 0, holdDist: 1.85, ...o });

  let nan = 0;
  const t0 = performance.now();
  const ticks = Math.round(10000 / TICK_MS);
  advance(room, 10000, now, (i) => {
    const t = i / 60;
    bots.forEach((b, k) => {
      b.pendingInput = input({ moveY: 1, moveX: Math.sin(t * 0.7 + k) * 0.6, yaw: t * (0.6 + k * 0.4) });
    });
    for (const a of room.actors.values()) {
      if (![a.pos.x, a.pos.y, a.pos.z, a.yaw].every(Number.isFinite)) nan++;
    }
    for (const r of room.world.props.values()) {
      const p = r.rb.translation();
      if (![p.x, p.y, p.z].every(Number.isFinite)) nan++;
    }
  });
  const perTick = (performance.now() - t0) / ticks;

  ok('ten seconds with contractors in it produces no NaN', nan === 0, `${nan} non-finite reads`);
  ok('the tick is under 6ms', perTick < 6,
    `${perTick.toFixed(2)}ms/tick, ${lvl.brushes.length} brushes + ${room.world.props.size} props + 3 actors`);

  // --- 8. does a fall take the room down with it? -------------------------
  const fell = checkHardLanding(room, lvl);
  if (fell && isTheKnownFallCrash(fell)) {
    warn('a hard landing crashes the room (known, server/actor.js is not this pass\'s file)',
      'actor.js:228 ragdolls inside step(), nulling this.body, and :240 then reads it; '
      + 'needs `if (this.ragdoll) return;` after the fall-damage call');
  } else {
    ok('a hard landing does not crash the room', !fell, fell ? fell.message : '16m/s onto the spawn');
  }

  // --- 9. can the routes be walked at all? --------------------------------
  // A fresh contractor per route: a bot that fell off the last one is a
  // capsule-less wreck that throws the moment anything moves it.
  for (const b of bots) b.pendingInput = input({});
  for (const route of ROUTES[lvl.id] || []) {
    const s = room.join({ send() {} }, 'WALKER');
    const r = walkRoute(room, room.actors.get(s), route.waypoints, route.budgetMs);
    const where = `on leg ${r.leg}, heading for ${r.target.map((v) => v.toFixed(1))}, `
      + `last seen at ${r.pos.map((v) => v.toFixed(1))}`;
    const why = r.crashed
      ? (isTheKnownFallCrash(r.crashed) ? `fell off ${where}` : `the room threw: ${r.crashed.message}`)
      : `stuck ${where}`;
    ok(route.name, r.done, r.done ? `${route.waypoints.length} waypoints walked` : why);
    room.leave(s);
  }

  room.destroy();
}

// ---------------------------------------------------------------------------
/**
 * Every level in this directory, registered or not.
 *
 * A level must be proved BEFORE it goes in the LEVELS array, never after:
 * index.js is imported by the server, the client and every harness in the
 * project, so a level file that throws on import stops all of them at once.
 * That ordering only works if an unregistered level can still be tested, so
 * the lint reads the directory rather than the array — and then says which
 * files are not registered yet, instead of quietly skipping them.
 */
async function findLevels() {
  const skip = new Set(['build.js', 'index.js', 'leveltest.js']);
  const files = (await readdir(new URL('.', import.meta.url)))
    .filter((f) => f.endsWith('.js') && !skip.has(f)).sort();
  const out = [];
  for (const f of files) {
    let mod;
    try {
      mod = await import(`./${f}`);
    } catch (err) {
      fails++;
      console.log(`\n=== ${f} ===\n  FAIL the file does not even import — ${err.message}`);
      continue;
    }
    const found = Object.values(mod).filter(
      (v) => v && typeof v === 'object' && v.id && Array.isArray(v.brushes) && Array.isArray(v.tasks),
    );
    if (!found.length) {
      fails++;
      console.log(`\n=== ${f} ===\n  FAIL exports nothing that looks like a level`);
    }
    for (const l of found) out.push({ lvl: l, file: f, registered: LEVEL_BY_ID[l.id] === l });
  }
  return out;
}

await initPhysics();
const SUPPORTED = await supportedTaskTypes();
const found = await findLevels();
const unregistered = found.filter((f) => !f.registered);
console.log(`level lint — ${found.length} level file${found.length === 1 ? '' : 's'}, `
  + `${LEVELS.length} registered in index.js`);
for (const f of unregistered) {
  console.log(`  note: ${f.file} exports "${f.lvl.id}" and is NOT in LEVELS — `
    + 'nothing loads it yet. Register it once this run is green.');
}

for (const { lvl } of found) {
  try {
    await checkLevel(lvl);
  } catch (err) {
    fails++;
    console.log(`  FAIL ${level} threw — ${err.stack || err}`);
  }
}
console.log(fails ? `\n${fails} FAILED` : '\nall good');
process.exit(fails ? 1 : 0);
