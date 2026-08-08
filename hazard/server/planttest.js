// HAZARD PAY — the two mechanics THE FLOODED PLANT is named after.
//
// Valves and water are the first pieces of gameplay that are not "move a box",
// and both are easy to get subtly wrong in ways no screenshot shows: a curve
// that interpolates through the wrong pair of keys, a penalty that fires twice,
// a write-off that also writes off the thing you already delivered. So they get
// their own harness rather than a corner of smoke.js, which is warehouse-shaped
// from top to bottom.
//
//   node server/planttest.js

import { Room } from './room.js';
import { initPhysics } from './world.js';
import { Reader, MSG, NO_WATER } from '../shared/protocol.js';
import {
  PHASE, BUTTON, TICK_MS, VALVE_TURN_MS, POS_SCALE, WATER_SPEED_SCALE,
} from '../shared/tune.js';

let fails = 0;
const ok = (name, cond, extra) => {
  if (!cond) { fails++; console.log(`FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
  else console.log(`ok   ${name}${extra ? ` — ${extra}` : ''}`);
};
const note = (s) => console.log(`     ${s}`);

await initPhysics();

const input = (o = {}) => ({
  seq: 0, moveX: 0, moveY: 0, yaw: 0, pitch: 0, buttons: 0, holdDist: 1.85, ...o,
});

/** A room on the plant, already ACTIVE, with the clock parked out of the way. */
async function plant() {
  const room = await Room.create('PLNT', 'flooded');
  const t = { now: 0 };
  room.begin(t.now);
  const briefing = Math.round(7000 / TICK_MS);
  for (let i = 0; i < briefing; i++) { t.now += TICK_MS; room.step(t.now); }
  room.phaseEndsAt = t.now + 1e9;   // the time limit is not what is under test
  t.advance = (ms, fn) => {
    const steps = Math.round(ms / TICK_MS);
    for (let i = 0; i < steps; i++) { t.now += TICK_MS; if (fn) fn(i, t.now); room.step(t.now); }
  };
  /** Jump the job clock to `seconds` without simulating the gap. */
  t.clockTo = (seconds) => { room.startedAt = t.now - seconds * 1000; };
  return { room, t };
}

/**
 * Somewhere a contractor can stand and see a given valve.
 *
 * Derived rather than authored: try the four compass points at arm's length and
 * keep the first one the raycast actually resolves to this valve. A hardcoded
 * spot is a spot that silently stops working the day somebody moves a pipe, and
 * the failure would look like "valves are broken" rather than "the test stands
 * inside a pipe".
 */
function viewpointFor(room, v) {
  const p = v.def.p;
  for (const [dx, dz, yaw] of [[0, 1.6, Math.PI], [0, -1.6, 0], [1.6, 0, -Math.PI / 2], [-1.6, 0, Math.PI / 2]]) {
    for (const foot of [p[1] - 0.575, p[1] - 0.575 - 0.35, p[1] - 1.0]) {
      const a = [...room.actors.values()][0];
      const pitch = Math.atan2(p[1] - (foot + 1.58), 1.6);
      place(a, p[0] + dx, foot, p[2] + dz, yaw, pitch);
      if (room.lookedAtBrush(a, 2.4) === v.brush) return { x: p[0] + dx, y: foot, z: p[2] + dz, yaw, pitch };
    }
  }
  return null;
}

function place(a, x, y, z, yaw, pitch) {
  a.pos.x = x; a.pos.y = y; a.pos.z = z;
  a.yaw = yaw; a.pitch = pitch;
  a.vel.x = 0; a.vel.y = 0; a.vel.z = 0;
  if (a.body) a.body.setNextKinematicTranslation({ x, y: y + a.height / 2, z });
}

/** Hold USE on a spot for `ms`, pinning the contractor there while they turn. */
function holdUse(room, t, a, at, ms) {
  t.advance(ms, () => {
    place(a, at.x, at.y, at.z, at.yaw, at.pitch);
    a.pendingInput = input({ yaw: at.yaw, pitch: at.pitch, buttons: BUTTON.USE });
  });
  a.pendingInput = input();
}

// =============================================================================
// 1. The level's own data
// =============================================================================
{
  const { room } = await plant();
  ok('the plant boots', room.level.id === 'flooded');
  ok('three valves are indexed', room.valves.size === 3, `${room.valves.size}`);
  ok('every valve has geometry behind it',
    [...room.valves.values()].every((v) => !!v.brush));
  ok('water starts where the level says', room.floodY === room.level.flood.start,
    `${room.floodY}`);

  const zones = room.floodZones.length;
  if (zones) ok('flood zones are declared', zones === 3, `${zones} zones`);
  else note('PENDING: flood.zones is not authored yet, so the order penalty has '
    + 'no geometry to raise. Zone assertions below are skipped.');
  room.destroy();
}

// The starting level is the single most dangerous number in the level file, and
// the failure is completely silent: props at the bottom of the deepest tank go
// under during the briefing, the write-off lands a second into the job, and the
// player sees a quota they cannot reach for reasons that happened off camera.
// At -3.6 this level lost £4,478 including the pump motor and one of the two
// fishbowls the job requires — i.e. it was unwinnable before anybody moved.
{
  const { room, t } = await plant();
  const total = [...room.world.props.values()].reduce((s, r) => s + r.def.value, 0);
  t.clockTo(room.level.flood.startsAt - 1);
  t.advance(2000);
  const lost = [...room.world.props.values()].filter((r) => r.flooded);
  const value = lost.reduce((s, r) => s + r.def.value, 0);
  ok('nothing has drowned before the water starts rising', lost.length === 0,
    `${lost.length} props, £${value} of £${total}`);
  room.destroy();
}

// =============================================================================
// 2. The curve
// =============================================================================
{
  const { room, t } = await plant();
  const f = room.level.flood;

  t.clockTo(f.startsAt - 5);
  t.advance(TICK_MS);
  ok('nothing happens before startsAt', Math.abs(room.floodY - f.start) < 1e-6,
    `y=${room.floodY.toFixed(3)} at t=${f.startsAt - 5}s`);

  // Every declared reach, hit on the nose. This is the assertion that catches an
  // off-by-one in the segment walk, which is otherwise invisible: the water
  // still rises, just through the wrong pair of keys.
  let worst = 0;
  for (const r of f.reaches) {
    t.clockTo(r.at);
    t.advance(TICK_MS);
    worst = Math.max(worst, Math.abs(room.floodY - r.y));
  }
  ok('the curve passes through every reach', worst < 0.02, `worst ${worst.toFixed(3)}m`);

  t.clockTo(f.reaches[f.reaches.length - 1].at + 400);
  t.advance(TICK_MS);
  ok('the water holds at the end', Math.abs(room.floodY - f.end) < 1e-6,
    `y=${room.floodY.toFixed(3)}`);

  // Monotonic, because water that goes down is a bug and a very confusing one.
  t.clockTo(0);
  let prev = -Infinity, dips = 0;
  for (let s = 0; s <= 420; s += 4) {
    t.clockTo(s); t.advance(TICK_MS);
    if (room.floodY < prev - 1e-6) dips++;
    prev = room.floodY;
  }
  ok('the water never falls', dips === 0, `${dips} dips over 420s`);
  room.destroy();
}

// =============================================================================
// 3. Turning a valve
// =============================================================================
{
  const { room, t } = await plant();
  const A = room.actors.get(room.join({ send() {} }, 'ALPHA'));
  const v1 = room.valves.get('V1');
  const spot = viewpointFor(room, v1);
  ok('there is somewhere to stand and see V1', !!spot,
    spot ? `at ${spot.x.toFixed(1)},${spot.y.toFixed(1)},${spot.z.toFixed(1)}` : 'no clear line');

  if (spot) {
    holdUse(room, t, A, spot, VALVE_TURN_MS * 0.5);
    ok('half a turn is not a turn', !v1.shut, `progress ${(A.turnProgress || 0).toFixed(2)}`);
    ok('the hold reports progress', A.turnProgress > 0.3 && A.turnProgress < 0.75,
      `${(A.turnProgress || 0).toFixed(2)}`);

    // Let go halfway and the wheel springs back — otherwise a valve is a series
    // of taps, and the 1.2s is decoration.
    t.advance(200, () => { place(A, spot.x, spot.y, spot.z, spot.yaw, spot.pitch); A.pendingInput = input(); });
    ok('letting go resets the turn', !A.turning && !A.turnProgress);

    holdUse(room, t, A, spot, VALVE_TURN_MS + 120);
    ok('holding all the way shuts it', v1.shut);
    ok('the sequence records it', room.valveOrder.join() === 'V1', room.valveOrder.join());

    const events = room.drainEvents().filter((e) => e.type === 'valve');
    ok('shutting a valve is an event', events.length === 1
      && events[0].detail.id === 'V1' && events[0].detail.shut === 1
      && events[0].detail.total === 3);

    // Re-using a shut valve is a no-op, not an error and not a double count.
    holdUse(room, t, A, spot, VALVE_TURN_MS + 120);
    ok('a shut valve stays shut once', room.valveOrder.length === 1,
      `${room.valveOrder.length} entries`);
  }
  room.destroy();
}

// =============================================================================
// 4. Order, and what skipping costs
// =============================================================================
{
  const { room, t } = await plant();
  const A = room.actors.get(room.join({ send() {} }, 'ALPHA'));
  const v3 = room.valves.get('V3');
  const spot = viewpointFor(room, v3);

  if (!spot) { ok('there is somewhere to stand and see V3', false); }
  else {
    room.drainEvents();
    holdUse(room, t, A, spot, VALVE_TURN_MS + 120);
    ok('V3 first still shuts', v3.shut);
    ok('shutting out of order is not clean', room.sequenceClean === false);

    const pens = room.drainEvents().filter((e) => e.type === 'penalty');
    ok('both skipped valves are penalised', pens.length === 2,
      pens.map((p) => p.detail.valve).join() || 'none');

    if (room.floodZones.length) {
      const bed = room.floodBonus.get('bed') || 0;
      const sump = room.floodBonus.get('sump') || 0;
      const metres = room.level.sequence.penalty.metres;
      ok('the skipped tanks flood', bed === metres && sump === metres,
        `bed +${bed}m, sump +${sump}m`);
      ok('the tank nobody skipped does not', !room.floodBonus.get('sludge'));

      // The zone the bonus applies to, and only that zone.
      const zn = room.floodZones.find((z) => z.name === 'sump');
      const inside = room.waterAt((zn.x0 + zn.x1) / 2, (zn.z0 + zn.z1) / 2);
      const outside = room.waterAt(zn.x1 + 4, zn.z1 + 4);
      ok('a penalised tank is wetter than the deck beside it', inside > outside + 1,
        `${inside.toFixed(2)} vs ${outside.toFixed(2)}`);
      // ...but never wetter than its own rim, or the surface floats above a dry
      // deck and reads as a rendering bug rather than as a punishment.
      ok('a penalised tank stops at its rim', inside <= zn.rim + 1e-6,
        `${inside.toFixed(2)} vs rim ${zn.rim}`);

      // Late in the job the site catches up, and the two must not compound.
      t.clockTo(400); t.advance(TICK_MS);
      const late = room.waterAt((zn.x0 + zn.x1) / 2, (zn.z0 + zn.z1) / 2);
      ok('a flooded tank does not overflow at the end', late <= zn.rim + 1e-6,
        `${late.toFixed(2)} vs rim ${zn.rim}`);
    }

    // Penalising twice is the obvious bug here: shut V3, then V2, and V1 is
    // still open and still lower than both.
    const v2 = room.valves.get('V2');
    const spot2 = viewpointFor(room, v2);
    if (spot2) {
      room.drainEvents();
      holdUse(room, t, A, spot2, VALVE_TURN_MS + 120);
      const again = room.drainEvents().filter((e) => e.type === 'penalty');
      ok('a valve is only penalised once', again.length === 0,
        again.map((p) => p.detail.valve).join());
    }
  }
  room.destroy();
}

// =============================================================================
// 5. The task
// =============================================================================
{
  const { room, t } = await plant();
  const task = room.level.tasks.find((x) => x.type === 'operate_in_order');
  if (!task) {
    note('PENDING: flooded has no operate_in_order task yet, so only the '
      + 'mechanism is under test, not the scoring.');
  } else {
    const A = room.actors.get(room.join({ send() {} }, 'ALPHA'));
    const i = room.level.tasks.indexOf(task);
    ok('the shutdown task starts empty', room.taskState[i].progress === 0);

    let shut = 0;
    for (const id of ['V1', 'V2', 'V3']) {
      const spot = viewpointFor(room, room.valves.get(id));
      if (!spot) continue;
      holdUse(room, t, A, spot, VALVE_TURN_MS + 120);
      shut++;
      t.advance(TICK_MS);
      ok(`${id} moves the task on`,
        Math.abs(room.taskState[i].progress - shut / 3) < 1e-6,
        `${(room.taskState[i].progress * 100).toFixed(0)}%`);
    }
    ok('all three shut completes it', room.taskState[i].done);
    ok('done in order is clean', room.taskState[i].clean === true);
  }
  room.destroy();
}

// =============================================================================
// 6. What the water does
// =============================================================================
{
  const { room, t } = await plant();
  const A = room.actors.get(room.join({ send() {} }, 'ALPHA'));

  // --- a prop that goes under is a write-off -------------------------------
  const mug = room.world.spawnProp('mug', [0, -4.2, 0]);
  t.clockTo(300);           // -0.6, well over the sump floor
  t.advance(400);
  ok('a prop is not written off instantly', !mug.flooded);
  t.advance(900);
  ok('a prop under water is written off', mug.flooded);

  const sunk = room.drainEvents().filter((e) => e.type === 'sunk');
  ok('losing stock is an event', sunk.some((e) => e.detail.id === mug.id));

  // ...and stops paying. Fishing a written-off safe out of the sump and driving
  // it away would be the obvious exploit, so check the van refuses it.
  const e = room.level.extract;
  const before = room.banked;
  mug.rb.setTranslation({ x: e.p[0], y: e.p[1], z: e.p[2] }, true);
  mug.rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
  t.advance(2500);
  ok('a written-off prop cannot be banked', room.banked === before,
    `£${before} -> £${room.banked}`);

  // --- and so does a contractor ---------------------------------------------
  const deep = [0, -4.3, 0];
  A.health = 100;
  t.advance(2000, () => {
    place(A, deep[0], deep[1], deep[2], 0, 0);
    A.pendingInput = input();
  });
  ok('being under water hurts', A.health < 100, `health ${A.health.toFixed(0)}`);
  const rate = (100 - A.health) / 2;
  ok('drowning is survivable for a moment and not for a minute',
    rate > 8 && rate < 18, `${rate.toFixed(1)} hp/s`);

  A.health = 100;
  t.advance(9000, () => {
    if (A.alive && !A.ragdoll) place(A, deep[0], deep[1], deep[2], 0, 0);
    A.pendingInput = input();
  });
  ok('staying under puts you down', A.downed, `health ${A.health.toFixed(0)}`);
  room.destroy();
}

// =============================================================================
// 7. Wading
// =============================================================================
{
  const { room, t } = await plant();
  const A = room.actors.get(room.join({ send() {} }, 'ALPHA'));

  const run = (waterOffset) => {
    place(A, 20, 0.02, 10, 0, 0);
    t.advance(200, () => { A.pendingInput = input(); A.waterY = -Infinity; });
    const x0 = A.pos.x, z0 = A.pos.z;
    t.advance(1500, () => {
      A.waterY = waterOffset === null ? -Infinity : A.pos.y + waterOffset;
      A.pendingInput = input({ moveY: 1, yaw: 0 });
    });
    return Math.hypot(A.pos.x - x0, A.pos.z - z0);
  };

  const dry = run(null);
  const wet = run(0.6);
  ok('dry land walks at full speed', dry > 4, `${dry.toFixed(2)}m in 1.5s`);
  ok('wading is slower', wet < dry * 0.75, `${wet.toFixed(2)}m vs ${dry.toFixed(2)}m dry`);
  ok('wading is not a wall', wet > dry * WATER_SPEED_SCALE * 0.7,
    `${(wet / dry).toFixed(2)}x, floor is ${WATER_SPEED_SCALE}`);
  room.destroy();
}

// =============================================================================
// 8. The wire
// =============================================================================
{
  const { room, t } = await plant();
  const A = room.actors.get(room.join({ send() {} }, 'ALPHA'));
  t.clockTo(190);
  t.advance(TICK_MS);

  const spot = viewpointFor(room, room.valves.get('V1'));
  if (spot) holdUse(room, t, A, spot, VALVE_TURN_MS + 120);

  const snap = room.snapshot(t.now);
  const r = new Reader(snap);
  ok('snapshot is a snapshot', r.u8r() === MSG.SNAPSHOT);
  r.u32r(); r.u32r(); r.u8r();
  const pc = r.u8r();
  for (let i = 0; i < pc; i++) {
    r.u8r(); r.u8r(); r.posr({}); r.angr(); r.angr(); r.u8r(); r.u8r(); r.u16r(); r.u32r();
  }
  const bones = r.u16r();
  for (let i = 0; i < bones; i++) { r.u8r(); r.u8r(); r.posr({}); r.u32r(); }
  const props = r.u16r();
  for (let i = 0; i < props; i++) { r.u16r(); r.u8r(); r.posr({}); r.u32r(); }

  const water = r.i16r() / POS_SCALE;
  ok('the water level is on the wire', Math.abs(water - room.floodY) < 0.02,
    `${water.toFixed(2)} vs ${room.floodY.toFixed(2)}`);
  const mask = r.u8r();
  ok('the valve mask is on the wire', mask === (spot ? 1 : 0), `0b${mask.toString(2)}`);
  const zn = r.u8r();
  ok('the zone count is on the wire', zn === room.floodZones.length, `${zn}`);
  for (let i = 0; i < zn; i++) r.i16r();
  ok('the snapshot is fully consumed', r.done, `${r.len - r.o} bytes left over`);
  room.destroy();
}

// A level with no water says so, rather than saying "very low".
{
  const dry = await Room.create('DRY', 'warehouse');
  dry.begin(0);
  const r = new Reader(dry.snapshot(0));
  r.u8r(); r.u32r(); r.u32r(); r.u8r();
  const pc = r.u8r();
  for (let i = 0; i < pc; i++) {
    r.u8r(); r.u8r(); r.posr({}); r.angr(); r.angr(); r.u8r(); r.u8r(); r.u16r(); r.u32r();
  }
  const bones = r.u16r();
  for (let i = 0; i < bones; i++) { r.u8r(); r.u8r(); r.posr({}); r.u32r(); }
  const props = r.u16r();
  for (let i = 0; i < props; i++) { r.u16r(); r.u8r(); r.posr({}); r.u32r(); }
  ok('a dry level sends the no-water sentinel', r.i16r() === NO_WATER);
  ok('a dry level has no valves and no zones', r.u8r() === 0 && r.u8r() === 0);
  dry.destroy();
}

void PHASE;
console.log(fails ? `\n${fails} FAILED` : '\nall good');
process.exit(fails ? 1 : 0);
