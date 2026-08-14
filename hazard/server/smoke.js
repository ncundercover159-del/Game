// HAZARD PAY — headless proof the simulation is real.
//
// Runs a room with bots for a simulated minute and asserts the things that,
// if they are wrong, make every later problem impossible to diagnose: nothing
// goes NaN, nobody leaves the building, props settle, ragdolls recover, the
// grab lifts what it should and refuses what it should not, and a snapshot
// round-trips through the wire unharmed.

import { Room } from './room.js';
import { release, tryGrab } from './grab.js';
import { initPhysics } from './world.js';
import { Reader, MSG } from '../shared/protocol.js';
import { PHASE, BUTTON, TICK_MS, GRAB_MAX_MASS, REVIVE_SECONDS } from '../shared/tune.js';
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

// THE SPAWN RING, measured at the instant of joining and nowhere later.
// groundUnder used to raycast, and Rapier's query pipeline is empty until the
// world has stepped — so it reported "no floor" for every slot, everybody fell
// back to the level's single spawn point, and four co-located kinematic
// capsules cost about 60ms EACH in computeColliderMovement. A four-player room
// ran at 3.6Hz and the symptom was "the server is slow".
{
  let closest = Infinity;
  const at = [...room.actors.values()].map((a) => ({ x: a.pos.x, z: a.pos.z }));
  for (let i = 0; i < at.length; i++) {
    for (let j = i + 1; j < at.length; j++) {
      closest = Math.min(closest, Math.hypot(at[i].x - at[j].x, at[i].z - at[j].z));
    }
  }
  ok('contractors do not spawn inside one another', closest > 0.9,
    `closest pair ${closest.toFixed(2)}m apart at join`);
}

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
// One pair of hands can TAKE HOLD of anything — the refusal that used to live
// here made the co-op carry unreachable, since a lift can only be joined once
// it exists. What one pair cannot do is LIFT 220kg, and that is the servo's
// job: strength is 1/overload, so it supports 64% of the weight and the piano
// drags rather than rises.
ok('one pair of hands can take hold of 220kg', A.held !== null,
  `mass ${PROP_BY_ID.piano.mass}kg vs one-pair capacity ${GRAB_MAX_MASS}kg`);
if (A.held) {
  const y0 = piano.rb.translation().y;
  A.pendingInput = input({ yaw: Math.PI, pitch: 0.45 });
  advance(1200);
  ok('...but cannot lift it', piano.rb.translation().y - y0 < 0.25,
    `rose ${(piano.rb.translation().y - y0).toFixed(2)}m`);
  release(A, room.holders, false);
  A.pendingInput = input();
  advance(300);
}

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

// --- the things a bot found that no headless test was asking -----------------
// Every one of these was self-consistent inside its own file, which is exactly
// why the suite was green through all of them.
{
  // 1. THE SPAWN RING. groundUnder used to raycast, and Rapier's query pipeline
  //    is empty until the world has stepped — so it said "no floor" for every
  //    slot, everyone spawned on one point, and four co-located capsules cost
  //    60ms each in computeColliderMovement. A four-player room ran at 3.6Hz.
  // 2. MOVEMENT AGREES WITH AIM. Both conventions were internally consistent
  //    and differed by a sign in X, so walking forward while facing east went
  //    west. Nothing compared them until a bot walked at something.
  const walker = A;
  walker.pendingInput = input();
  for (const yaw of [0, Math.PI / 2, 2.3]) {
    walker.pos.x = 0; walker.pos.y = 0.05; walker.pos.z = 0;
    walker.vel.x = 0; walker.vel.y = 0; walker.vel.z = 0;
    walker.yaw = yaw;
    walker.body.setNextKinematicTranslation({ x: 0, y: 0.05 + walker.height / 2, z: 0 });
    advance(120, () => { walker.pendingInput = input({ yaw }); });
    const x0 = walker.pos.x, z0 = walker.pos.z;
    advance(500, () => { walker.pendingInput = input({ yaw, moveY: 1 }); });
    const mx = walker.pos.x - x0, mz = walker.pos.z - z0;
    const len = Math.hypot(mx, mz);
    const aim = { x: Math.sin(yaw), z: Math.cos(yaw) };
    const dot = len > 0.05 ? (mx / len) * aim.x + (mz / len) * aim.z : 0;
    ok(`walking forward goes where you are looking, yaw ${yaw.toFixed(2)}`, dot > 0.9,
      `moved ${len.toFixed(2)}m, alignment ${dot.toFixed(3)}`);
  }
}

// --- the two-person carry, which was unreachable -----------------------------
// tryGrab refused the FIRST pair of hands above 189kg, and a lift can only be
// JOINED once it exists, so the piano, the bathtub and the generator could not
// be picked up by any number of contractors. The cooperative carry the whole
// game is built on did not exist, and £6,600 of a £5,200 quota was unreachable.
//
// The grabs here are driven through tryGrab directly rather than through aim
// and a button. That is deliberate: what is on trial is the mass rule and the
// servo, and routing it through a raycast makes the test fail for reasons about
// camera pitch and prop settling that have nothing to do with either.
{
  for (const a of [A, B, C]) { release(a, room.holders, false); a.pendingInput = input(); }
  advance(400);

  // Authored rest heights, from warehouse.js. Dropping these in from any height
  // destroys them before the test starts: gravity is -22, so a 0.9m drop lands
  // at 6.3m/s against a piano's 5.5m/s fragility, and a broken prop cannot be
  // picked up — which presents as "the grab is broken" rather than "the fixture
  // smashed the fixture".
  const REST_Y = { piano: 0.52, bathtub: 0.60, generator: 0.60 };

  for (const kind of ['piano', 'bathtub', 'generator']) {
    const def = PROP_BY_ID[kind];
    const rec = room.world.spawnProp(kind, [5.5, REST_Y[kind], 7.5]);
    advance(600);
    ok(`the ${kind} survives being placed`, !rec.broken, `${def.mass}kg`);

    const hold = (actor, dx) => {
      // Stand them up first. The previous round ends with a 220kg piano two
      // metres in the air and it lands on somebody; a ragdolled actor has no
      // capsule, so the next fixture dies on a null body rather than on
      // anything to do with what it is testing.
      if (actor.ragdoll) { actor.downed = false; actor.exitRagdoll(); }
      actor.alive = true;
      actor.health = 100;
      const q = rec.rb.translation();
      actor.pos.x = q.x + dx; actor.pos.y = 0.05; actor.pos.z = q.z + 1.3;
      actor.vel.x = 0; actor.vel.y = 0; actor.vel.z = 0;
      actor.yaw = Math.PI;
      actor.pitch = Math.atan2(q.y - (actor.pos.y + 1.58), 1.3);
      actor.body.setNextKinematicTranslation({
        x: actor.pos.x, y: 0.05 + actor.height / 2, z: actor.pos.z,
      });
      return tryGrab(room.world, actor, room.holders) === rec;
    };
    const drive = (n) => advance(n, () => {
      for (const actor of [A, B]) {
        if (actor.held === rec) actor.pendingInput = input({ yaw: Math.PI, pitch: 0.42 });
      }
    });

    ok(`one pair of hands can take hold of the ${kind}`, hold(A, 0));
    const y0 = rec.rb.translation().y;
    drive(1000);
    const solo = rec.rb.translation().y - y0;
    ok(`one pair cannot lift the ${kind}`, solo < 0.3,
      `${def.mass}kg rose ${solo.toFixed(2)}m on ${(3080 / (def.mass * 22)).toFixed(2)} of the weight`);

    ok(`a second pair can join the ${kind}`, hold(B, 0.6));
    const y1 = rec.rb.translation().y;
    drive(1400);
    const pair = rec.rb.translation().y - y1;
    ok(`two pairs lift the ${kind}`, pair > 0.4,
      `rose ${pair.toFixed(2)}m against ${solo.toFixed(2)}m solo`);

    release(A, room.holders, false);
    release(B, room.holders, false);
    A.pendingInput = input(); B.pendingInput = input();
    // Remove it BEFORE it lands. Letting two metres of piano go over a
    // contractor's head is realistic and makes the next round's fixture flaky.
    room.world.removeProp(rec);
    advance(300);
  }
}

// --- a carried prop does not kill the person helping you ---------------------
// Impact damage used ABSOLUTE momentum, so a 132kg safe at walking pace scored
// 185 against a safe threshold of 26 and knocked out anyone within a metre and
// a half of whoever was carrying it. The correct play was for the rest of the
// crew to stand well clear, which is the opposite of a co-operative hauling
// game. What hurts is being HIT, and that is about the speed difference.
//
// Gravity is switched off on the fixture and both bodies are pinned each tick,
// so the only variable is relative velocity. An earlier version let the prop
// fall while claiming to measure a carry, and the 0.37m/s of gravity per tick
// was enough on 132kg to register as a series of impacts — the test failed for
// a reason that had nothing to do with what it was checking.
{
  const safe = room.world.spawnProp('safe', [5.5, 0.9, 7.5]);
  safe.rb.setGravityScale(0, true);
  advance(200);
  C.health = 100;
  C.pos.x = 5.5; C.pos.y = 0.05; C.pos.z = 8.6;
  C.body.setNextKinematicTranslation({ x: C.pos.x, y: 0.05 + C.height / 2, z: C.pos.z });
  advance(200, () => { C.pendingInput = input(); });

  // C is given an INPUT and walks; the safe is then matched to whatever
  // velocity the controller actually produced. Writing C.vel directly does not
  // work — actor.step recomputes it from input every tick, so a hand-set value
  // is gone before the impact check reads it and the "relative" velocity is
  // just the prop's absolute velocity wearing a different name. I wrote that
  // comment once and then made the same mistake again two fixtures later.
  const travelling = (relX) => advance(900, () => {
    C.pendingInput = input({ yaw: Math.PI / 2, moveY: 1 });   // due +x
    safe.rb.setLinvel({ x: C.vel.x + relX, y: 0, z: C.vel.z }, true);
    safe.rb.setTranslation({ x: C.pos.x + 0.75, y: C.pos.y + 0.85, z: C.pos.z }, true);
  });

  // Let C reach a steady walk BEFORE measuring. The controller accelerates at
  // GROUND_ACCEL, so for the first few ticks the prop is matched to a velocity
  // the contractor has not reached yet — 0.8m/s of transient on 132kg is one
  // genuine impact, and it lands every run.
  travelling(0);
  C.health = 100;
  travelling(0);
  // Survivable, not pristine. A fixture cannot hold two bodies in perfect
  // lockstep — the contractor's speed wobbles as the controller re-grounds, and
  // 0.2m/s of residual on 132kg is still a nudge. What matters is the size of
  // the change: on ABSOLUTE momentum this same walk scores 4.1 * 132 = 541
  // against a threshold of 26, which is 463 damage and an instant knockout,
  // twice over, every time anyone carried anything past a teammate.
  ok('walking alongside a carried safe does not deck you', C.health > 80,
    `health ${C.health.toFixed(0)} after 1.8s beside 132kg matching your pace `
    + '(absolute momentum scored 541 here and killed outright)');

  C.health = 100;
  travelling(6.0);
  ok('a safe swung into you still hurts', C.health < 85,
    `health ${C.health.toFixed(0)} after 132kg at +6.0m/s relative`);

  room.world.removeProp(safe);
  C.pendingInput = input();
  advance(200);
}

// --- reviving actually revives -----------------------------------------------
// Bleedout clears `alive`; the revive restored `downed` and health but not
// `alive`, so Actor.step returned early for ever and the contractor was a
// permanent heap that the snapshot called neither alive nor downed.
{
  B.pendingInput = input();
  B.health = 0;
  B.goDown(now);
  B.alive = false;               // what bleedout does
  B.downedAt = now;
  A.pos.x = B.pos.x + 0.6; A.pos.y = B.pos.y; A.pos.z = B.pos.z;
  if (A.body) A.body.setNextKinematicTranslation({ x: A.pos.x, y: A.pos.y + A.height / 2, z: A.pos.z });
  advance(REVIVE_SECONDS * 1000 + 400, () => {
    A.pos.x = B.pos.x + 0.6; A.pos.z = B.pos.z;
    A.pendingInput = input({ buttons: BUTTON.USE });
  });
  ok('a revived contractor is alive again', B.alive && !B.downed,
    `alive=${B.alive} downed=${B.downed} health=${B.health.toFixed(0)}`);
  A.pendingInput = input();
  advance(2500);
  ok('...and can move again', !B.ragdoll || B.alive);
}

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
