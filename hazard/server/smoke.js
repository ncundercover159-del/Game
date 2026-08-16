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

/**
 * Put a contractor back on their feet, empty-handed and unhurt.
 *
 * This file is one long chain of stateful blocks, and each was inheriting the
 * previous one's wreckage: a 260kg generator lifted three metres in one test
 * lands on somebody in the next, and a ragdolled actor then fails an assertion
 * about reviving, or about climbing out of a pit, for reasons that have nothing
 * to do with either. Four separate fixtures grew their own ad-hoc version of
 * this before it was worth naming.
 */
const stand = (actor, at) => {
  resume();
  if (actor.ragdoll) { actor.downed = false; actor.exitRagdoll(); }
  actor.alive = true;
  actor.downed = false;
  actor.health = 100;
  actor.stamina = 100;
  release(actor, room.holders, false);
  actor.vel.x = 0; actor.vel.y = 0; actor.vel.z = 0;
  if (at) {
    actor.pos.x = at[0]; actor.pos.y = at[1]; actor.pos.z = at[2];
  }
  actor.body?.setNextKinematicTranslation({
    x: actor.pos.x, y: actor.pos.y + actor.height / 2, z: actor.pos.z,
  });
  actor.pendingInput = { seq: 0, moveX: 0, moveY: 0, yaw: actor.yaw, pitch: 0, buttons: 0, holdDist: 1.85 };
};

/**
 * Put the job back on the clock.
 *
 * The co-operative fixtures deliberately hoist 220-260kg three metres into the
 * air and then let go, so they land on people — and a job whose entire crew is
 * unconscious correctly ends. That is the game working; it is the fixture
 * causing it. Everything downstream then failed for the same invisible reason:
 * no extraction, no revive, no movement, because none of it runs outside
 * PHASE.ACTIVE. Five assertions, one cause, and none of them said so.
 */
const resume = () => {
  room.phase = PHASE.ACTIVE;
  room.phaseEndsAt = now + room.level.timeLimit * 1000;
};

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

// --- a carry has to survive the whole haul, not just the lift ----------------
// Lift height is not the same measurement as carrying something somewhere, and
// tuning the first broke the second without touching it. A bot shift banked £0
// on safes and delivered six of six elk in pieces while every headless
// lift-height assertion stayed green.
//
// The safe is the top of the solo range and the elk is fragile: between them
// they cover both halves of what went wrong.
{
  for (const a of [A, B, C]) stand(a);
  advance(300);

  for (const [kind, restY] of [['safe', 0.62], ['elk', 0.55]]) {
    const rec = room.world.spawnProp(kind, [5.5, restY, 7.5]);
    advance(500);
    stand(A);   // AFTER settling: the previous block drops a generator on people
    const q = rec.rb.translation();
    A.pos.x = q.x; A.pos.y = 0.05; A.pos.z = q.z + 1.3;
    A.vel.x = 0; A.vel.y = 0; A.vel.z = 0;
    A.yaw = Math.PI;
    A.pitch = Math.atan2(q.y - (A.pos.y + 1.58), 1.3);
    A.body.setNextKinematicTranslation({ x: A.pos.x, y: 0.05 + A.height / 2, z: A.pos.z });
    ok(`one contractor can pick up the ${kind}`,
      tryGrab(room.world, A, room.holders) === rec, `${PROP_BY_ID[kind].mass}kg`);

    // Now WALK somewhere with it, on open floor, for two seconds.
    const from = { x: A.pos.x, z: A.pos.z };
    advance(2000, () => {
      A.pendingInput = input({ yaw: Math.PI / 2, moveY: 1, pitch: 0.05 });
    });
    const walked = Math.hypot(A.pos.x - from.x, A.pos.z - from.z);
    const stillHeld = A.held === rec;
    const p2 = rec.rb.translation();
    const near = Math.hypot(p2.x - A.pos.x, p2.z - A.pos.z);

    ok(`the ${kind} comes with you`, stillHeld && near < 3.0,
      `walked ${walked.toFixed(1)}m, prop ${near.toFixed(1)}m away, `
      + `${stillHeld ? 'still held' : 'DROPPED'}`);
    // Hauling 132kg IS slow by design — loadPenalty and stamina take a walk
    // from 4.1m/s to about 2.3 and then to 1.4 once stamina is gone. What is
    // not by design is the load trailing so far behind that it never arrives,
    // so this measures the lag rather than the pace.
    ok(`the ${kind} keeps up with you`, near < 2.6,
      `${near.toFixed(1)}m behind after ${walked.toFixed(1)}m of walking `
      + `(the grab breaks at 3.9m)`);
    ok(`the ${kind} survives being carried`, !rec.broken);
    ok(`carrying the ${kind} does not knock you out`, A.health > 60 && !A.ragdoll,
      `health ${A.health.toFixed(0)}`);

    room.world.removeProp(rec);
    stand(A);
    advance(300);
  }
}

// --- a carried prop does not kill the person helping you ---------------------
// Impact damage used ABSOLUTE momentum, so a 132kg safe at walking pace scored
// 541 against a safe threshold of 26 — an instant knockout for anyone within a
// metre and a half of whoever was carrying it. The correct play was for the
// crew to stand well clear, which is the opposite of a co-operative hauling
// game. What hurts is being HIT, and that is about the speed difference.
//
// A GENUINELY carries it and C GENUINELY walks alongside, rather than the prop
// being pinned to a hand-set velocity. Two earlier versions of this fixture
// pinned it, and both measured their own one-tick lag between when the velocity
// was written and when actor.step recomputed C's — 0.8m/s of pure artefact on
// 132kg, which is a real impact by the rules and nothing to do with the game.
{
  for (const x of [A, B, C]) stand(x);
  const safe = room.world.spawnProp('safe', [5.5, 0.62, 7.5]);
  advance(500);

  const q = safe.rb.translation();
  stand(A, [q.x, 0.05, q.z + 1.3]);
  A.yaw = Math.PI;
  A.pitch = Math.atan2(q.y - (A.pos.y + 1.58), 1.3);
  ok('a contractor is carrying the safe', tryGrab(room.world, A, room.holders) === safe);

  // C, one and a bit metres to the side, walking the same way at the same pace.
  stand(C, [A.pos.x + 1.3, 0.05, A.pos.z]);
  C.health = 100;
  advance(2500, () => {
    A.pendingInput = input({ yaw: Math.PI / 2, moveY: 1, pitch: 0.05 });
    C.pendingInput = input({ yaw: Math.PI / 2, moveY: 1 });
    // Keep C abreast rather than letting them wander into the load.
    C.pos.z = A.pos.z;
  });
  ok('walking alongside a carried safe does not deck you', C.health > 80,
    `health ${C.health.toFixed(0)} after 2.5s beside a real 132kg carry `
    + '(absolute momentum scored 541 here and killed outright)');
  ok('...and the carrier is fine too', A.health > 80, `health ${A.health.toFixed(0)}`);

  // ...but being hit by one still hurts. Let go and fire it at them.
  release(A, room.holders, false);
  stand(C, [A.pos.x + 2.5, 0.05, A.pos.z]);
  C.health = 100;
  advance(700, (i) => {
    if (i === 0) safe.rb.setLinvel({ x: 9, y: 0, z: 0 }, true);
    C.pendingInput = input();
  });
  ok('a safe thrown at you still hurts', C.health < 85, `health ${C.health.toFixed(0)}`);

  room.world.removeProp(safe);
  for (const x of [A, C]) stand(x);
  advance(200);
}

// --- reviving actually revives -----------------------------------------------
// Bleedout clears `alive`; the revive restored `downed` and health but not
// `alive`, so Actor.step returned early for ever and the contractor was a
// permanent heap that the snapshot called neither alive nor downed.
{
  stand(B);
  stand(A);
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

// --- the pit is not a soft-lock ----------------------------------------------
// Its floor is at -1.10 and its lip at +0.30: a 1.40m climb, against the 0.99m
// a contractor can manage (0.57m of jump plus 0.42m of autostep). Anyone who
// fell in — or was knocked in, which is the more likely way — stayed there for
// the rest of the job, with no way to tell anybody and nothing to do about it.
// There are two crates stacked in the north-west corner now.
{
  for (const a of [A, B, C]) stand(a);
  stand(A, [0.6, -1.05, 1.4]);
  advance(300, () => { A.pendingInput = input(); });
  ok('you can get into the pit', A.pos.y < -0.9, `y=${A.pos.y.toFixed(2)}`);
  if (process.env.DBG) {
    console.log('   DBG phase', room.phase, 'A alive', A.alive, 'downed', A.downed,
      'ragdoll', !!A.ragdoll, 'health', A.health.toFixed(0), 'body', !!A.body,
      'banked', room.banked);
  }

  // Head for the crates in the corner, jumping. Yaw is atan2(dx, dz) — the
  // project's one facing convention.
  let escaped = false;
  advance(9000, (i) => {
    const dx = -2.2 - A.pos.x, dz = -1.0 - A.pos.z;
    A.pendingInput = input({
      yaw: Math.atan2(dx, dz), moveY: 1,
      buttons: i % 40 < 6 ? BUTTON.JUMP : 0,
    });
    if (A.pos.y > 0.25) escaped = true;
  });
  ok('...and you can get back out of it', escaped,
    `ended at y=${A.pos.y.toFixed(2)} (lip is +0.30)`);
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
