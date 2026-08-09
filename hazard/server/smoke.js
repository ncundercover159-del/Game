// HAZARD PAY — headless proof the simulation is real.
//
// Runs a room with bots for a simulated minute and asserts the things that,
// if they are wrong, make every later problem impossible to diagnose: nothing
// goes NaN, nobody leaves the building, props settle, ragdolls recover, the
// grab lifts what it should and refuses what it should not, and a snapshot
// round-trips through the wire unharmed.

import { Room } from './room.js';
import { initPhysics } from './world.js';
import { Reader, MSG } from '../shared/protocol.js';
import { PHASE, BUTTON, TICK_MS, GRAB_MAX_MASS } from '../shared/tune.js';
import { PROP_BY_ID } from '../shared/props.js';

let fails = 0;
const ok = (name, cond, extra) => {
  if (!cond) { fails++; console.log(`FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
  else console.log(`ok   ${name}${extra ? ` — ${extra}` : ''}`);
};

await initPhysics();
const room = await Room.create('TEST');
console.log(`level "${room.level.name}": ${room.level.brushes.length} brushes, `
  + `${room.world.props.size} props, quota £${room.level.quota}`);

const fake = { send() {} };
const slots = [room.join(fake, 'ALPHA'), room.join(fake, 'BRAVO'), room.join(fake, 'CHARLIE')];
ok('three contractors joined', slots.every((s) => s !== null && s !== undefined));

const A = room.actors.get(slots[0]);
const B = room.actors.get(slots[1]);
const C = room.actors.get(slots[2]);

const input = (o = {}) => ({
  seq: 0, moveX: 0, moveY: 0, yaw: 0, pitch: 0, buttons: 0, holdDist: 1.85, ...o,
});

let now = 0;
const advance = (ms, fn) => {
  const steps = Math.round(ms / TICK_MS);
  for (let i = 0; i < steps; i++) {
    now += TICK_MS;
    if (fn) fn(i, now);
    room.step(now);
  }
};

room.begin(now);
advance(7000);
ok('job started after the briefing', room.phase === PHASE.ACTIVE, `phase=${room.phase}`);

// --- everything stays finite and indoors ------------------------------------
let nan = 0, escaped = 0, minY = Infinity;
const watch = () => {
  for (const a of room.actors.values()) {
    if (![a.pos.x, a.pos.y, a.pos.z].every(Number.isFinite)) nan++;
    if (Math.abs(a.pos.x) > 40 || Math.abs(a.pos.z) > 34) escaped++;
    minY = Math.min(minY, a.pos.y);
  }
  for (const r of room.world.props.values()) {
    const p = r.rb.translation();
    if (![p.x, p.y, p.z].every(Number.isFinite)) nan++;
  }
};

// Walk everybody around for ten seconds, sprinting into things.
advance(10000, (i) => {
  const t = i / 60;
  A.pendingInput = input({ moveY: 1, yaw: Math.sin(t * 0.5) * 2, buttons: BUTTON.SPRINT });
  B.pendingInput = input({ moveX: 1, yaw: 1.2, buttons: i % 120 < 4 ? BUTTON.JUMP : 0 });
  C.pendingInput = input({ moveY: -1, yaw: 3.0 });
  watch();
});
ok('no NaN anywhere', nan === 0, `${nan} non-finite reads`);
ok('nobody left the building', escaped === 0, `${escaped} frames outside`);
ok('nobody fell through the floor', minY > -3, `lowest y=${minY.toFixed(2)}`);

// --- the grab ---------------------------------------------------------------
// Put a contractor next to the piano and check one pair of hands cannot lift it.
const piano = [...room.world.props.values()].find((r) => r.kind === 'piano');
ok('the piano exists', !!piano);
const pp = piano.rb.translation();
A.pos.x = pp.x; A.pos.y = 0.05; A.pos.z = pp.z + 1.6;
A.yaw = Math.PI; A.pitch = -0.12;
A.body.setNextKinematicTranslation({ x: A.pos.x, y: A.pos.y + A.height / 2, z: A.pos.z });
advance(200);
A.pendingInput = input({ yaw: Math.PI, pitch: -0.12, buttons: BUTTON.GRAB });
advance(120);
ok('220kg is too much for one contractor', A.held === null,
  `mass ${PROP_BY_ID.piano.mass}kg vs capacity ${GRAB_MAX_MASS}kg`);

// A mug, however, is fine. Place one deliberately on clear floor rather than
// hunting for whichever mug survived three bots rampaging past a conveyor: a
// flaky fixture here would look exactly like a broken grab.
A.pendingInput = input();
advance(400);
const mug = room.world.spawnProp('mug', [-2.0, 0.06, -14.0]);
advance(500);
const mp = mug.rb.translation();
A.pos.x = mp.x; A.pos.z = mp.z + 1.2; A.pos.y = 0;
A.body.setNextKinematicTranslation({ x: A.pos.x, y: A.pos.y + A.height / 2, z: A.pos.z });
advance(120);
const aimPitch = Math.atan2(mp.y - (A.pos.y + 1.58), 1.2);
A.pendingInput = input({ yaw: Math.PI, pitch: aimPitch, buttons: BUTTON.GRAB });
advance(200);
ok('a mug is grabbable', A.held !== null, A.held ? `holding ${A.held.kind}` : 'grabbed nothing');

if (A.held) {
  const carried = A.held;
  const before = carried.rb.translation().y;
  A.pendingInput = input({ yaw: Math.PI, pitch: 0.3 });
  advance(900, (i) => {
    if (process.env.TRAJ && i % 6 === 0) {
      const q = carried.rb.translation(); const vv = carried.rb.linvel();
      const hh = carried.hold;
      console.log(`   t=${i} mug y=${q.y.toFixed(2)} z=${q.z.toFixed(2)} vy=${vv.y.toFixed(1)}`,
        `hold=${hh ? hh.y.toFixed(2) : 'null'} actorY=${A.pos.y.toFixed(2)} eye=${A.eye.toFixed(2)}`,
        `pitch=${A.pitch.toFixed(2)} hd=${A.holdDist.toFixed(2)} held=${A.held ? 'y' : 'n'}`);
    }
  });
  const after = carried.rb.translation().y;
  ok('the held thing follows the hands', after > before + 0.4 && !carried.broken,
    `y ${before.toFixed(2)} -> ${after.toFixed(2)}${carried.broken ? ' BROKEN' : ''}`);
  ok('still holding it after a big view swing', A.held === carried);
}

// --- ragdoll ----------------------------------------------------------------
B.pendingInput = input();
B.damage(40, now, 'test');
ok('a big hit knocks you down', !!B.ragdoll);
const bones = B.ragdoll ? B.ragdoll.bodies.length : 0;
ok('the ragdoll has eleven bones', bones === 11, `${bones} bones`);
advance(4000, watch);
ok('the ragdoll gets back up', !B.ragdoll);
ok('ragdolling produced no NaN', nan === 0);

// --- extraction -------------------------------------------------------------
const e = room.level.extract;
const gift = [...room.world.props.values()].find((r) => r.kind === 'stapler' && !r.extracted);
gift.rb.setTranslation({ x: e.p[0], y: e.p[1], z: e.p[2] }, true);
gift.rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
const bankedBefore = room.banked;
advance(2500);
ok('a prop resting in the van pays out', room.banked > bankedBefore,
  `£${bankedBefore} -> £${room.banked}`);

// --- the van does not fill up ------------------------------------------------
// Found by bots, because bots are the only thing patient enough to deliver a
// dozen items in a row. An extracted prop used to keep its collider, so paid-for
// stock stayed solid in the van: the second delivery bounced off the first and
// by the fourth the van was a wall. The van had a physical capacity nobody
// designed, and every game got quietly harder towards the end of it.
//
// Same coordinates every time, deliberately. Spread out they would each find
// their own corner and the bug would take a dozen deliveries to show; stacked on
// one spot, a live collider is an immediate interpenetration and the test fails
// on the second item.
{
  const before = room.banked;
  let delivered = 0;
  for (let i = 0; i < 6; i++) {
    const r = room.world.spawnProp('stapler', [e.p[0], e.p[1], e.p[2]]);
    r.rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    advance(1600);
    if (r.extracted) delivered++;
  }
  ok('the van takes delivery after delivery', delivered === 6,
    `${delivered} of 6 banked, £${before} -> £${room.banked}`);

  // ...and check the mechanism, not a symptom. "Nothing is moving" was the
  // first version of this and it passed with the bug still in — retired props
  // settle and go quiet whether or not they are solid, so it asserted nothing.
  // Collision groups are the thing that actually changed.
  const retired = [...room.world.props.values()].filter((r) => r.extracted);
  const solid = retired.filter((r) => r.cols.some((c) => c.collisionGroups() !== 0));
  ok('paid-for stock collides with nothing', solid.length === 0,
    `${solid.length} of ${retired.length} extracted props still solid`);
}

// --- the wire ---------------------------------------------------------------
const snap = room.snapshot(now);
const r = new Reader(snap);
ok('snapshot is a snapshot', r.u8r() === MSG.SNAPSHOT);
r.u32r(); r.u32r(); r.u8r();
const pc = r.u8r();
ok('snapshot carries every contractor', pc === room.actors.size, `${pc} of ${room.actors.size}`);
const read = [];
for (let i = 0; i < pc; i++) {
  const slot = r.u8r(); r.u8r();
  const p = r.posr({});
  r.angr(); r.angr(); r.u8r(); r.u8r(); r.u16r(); r.u32r();
  read.push({ slot, p });
}
const live = room.actors.get(read[0].slot);
const err = Math.hypot(read[0].p.x - live.pos.x, read[0].p.y - live.pos.y, read[0].p.z - live.pos.z);
ok('positions survive quantisation', err < 0.02, `${(err * 1000).toFixed(1)}mm error`);
console.log(`     snapshot ${snap.byteLength} bytes for ${room.actors.size} players `
  + `+ ${room.world.props.size} props`);

// --- sleep saves the bandwidth ---------------------------------------------
advance(6000);
const quiet = room.snapshot(now);
const asleep = [...room.world.props.values()].filter((p) => p.rb.isSleeping()).length;
ok('an idle site mostly sleeps', asleep > room.world.props.size * 0.5,
  `${asleep}/${room.world.props.size} asleep, quiet snapshot ${quiet.byteLength}B`);

// Nothing should shatter just from being loaded into the level.
ok('props survive being placed', room.breakages < 3, `${room.breakages} breakages so far`);

// --- performance ------------------------------------------------------------
const t0 = performance.now();
advance(5000, watch);
const ms = performance.now() - t0;
ok('60Hz is comfortable', ms / 300 < 6,
  `${(ms / 300).toFixed(2)}ms/tick for ${room.world.props.size} props + ${room.actors.size} actors`);

room.destroy();
console.log(fails ? `\n${fails} FAILED` : '\nall good');
process.exit(fails ? 1 : 0);
