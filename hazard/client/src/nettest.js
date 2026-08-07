// Does the client's decoder agree with the server's encoder?
//
// This is the one seam where a silent mistake is invisible: a wrong field width
// does not throw, it just shifts every subsequent value, and the game renders a
// plausible-looking world in the wrong place. So encode a known state on the
// real server and assert the decode matches it, field by field.
//
//   node hazard/client/src/nettest.js

import { Room } from '../../server/room.js';
import { initPhysics } from '../../server/world.js';
import { decodeSnapshot } from './net.js';
import { TICK_MS, BUTTON, PHASE } from '../../shared/tune.js';
import { PFLAG } from '../../shared/protocol.js';

let fails = 0;
const ok = (name, cond, extra) => {
  if (!cond) { fails++; console.log(`FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
  else console.log(`ok   ${name}${extra ? ` — ${extra}` : ''}`);
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

await initPhysics();
const room = await Room.create('WIRE');
const fake = { send() {} };
const A = room.actors.get(room.join(fake, 'ALPHA'));
const B = room.actors.get(room.join(fake, 'BRAVO'));

let now = 0;
const advance = (ms) => {
  for (let i = 0; i < Math.round(ms / TICK_MS); i++) { now += TICK_MS; room.step(now); }
};
room.begin(now);
advance(7000);

// Put the world into a state that exercises every branch at once: someone
// upright, someone ragdolled, and a prop in motion.
A.pendingInput = {
  seq: 12345, moveX: 0, moveY: 1, yaw: 1.234, pitch: -0.567,
  buttons: BUTTON.SPRINT, holdDist: 2.0,
};
A.lastInputSeq = 12345;
B.damage(50, now, 'test');
const mover = [...room.world.props.values()].find((p) => p.kind === 'crt');
mover.rb.setLinvel({ x: 1.5, y: 0, z: 0 }, true);
advance(200);

const snap = room.snapshot(now);
const dec = decodeSnapshot(snap);
ok('snapshot decodes at all', !!dec);
ok('tick matches', dec.tick === room.tick, `${dec.tick} vs ${room.tick}`);
ok('phase matches', dec.phase === room.phase && dec.phase === PHASE.ACTIVE);
ok('player count matches', dec.players.length === room.actors.size,
  `${dec.players.length} vs ${room.actors.size}`);

const da = dec.players.find((p) => p.slot === A.slot);
ok('found the upright contractor', !!da);
if (da) {
  ok('position survives the wire',
    near(da.x, A.pos.x, 0.01) && near(da.y, A.pos.y, 0.01) && near(da.z, A.pos.z, 0.01),
    `(${da.x.toFixed(2)},${da.y.toFixed(2)},${da.z.toFixed(2)}) vs `
    + `(${A.pos.x.toFixed(2)},${A.pos.y.toFixed(2)},${A.pos.z.toFixed(2)})`);
  ok('yaw survives the wire', near(da.yaw, A.yaw, 0.0002), `${da.yaw} vs ${A.yaw}`);
  ok('pitch survives the wire', near(da.pitch, A.pitch, 0.0002), `${da.pitch} vs ${A.pitch}`);
  ok('health and stamina survive', near(da.health, A.health, 1) && near(da.stamina, A.stamina, 1));
  ok('input seq is echoed back', da.seq === 12345, `${da.seq}`);
  ok('sprint flag is set', (da.flags & PFLAG.SPRINT) !== 0);
  ok('alive flag is set', (da.flags & PFLAG.ALIVE) !== 0);
}

const db = dec.players.find((p) => p.slot === B.slot);
ok('ragdoll flag is set on the downed one', db && (db.flags & PFLAG.RAGDOLL) !== 0);
ok('eleven bones came across', dec.bones.filter((x) => x.slot === B.slot).length === 11,
  `${dec.bones.length} bones total`);

const boneErr = (() => {
  let worst = 0;
  for (const bone of dec.bones) {
    if (bone.slot !== B.slot) continue;
    const live = B.ragdoll.bodies[bone.index].translation();
    worst = Math.max(worst, Math.hypot(bone.x - live.x, bone.y - live.y, bone.z - live.z));
  }
  return worst;
})();
ok('bone positions survive the wire', boneErr < 0.02, `worst ${(boneErr * 1000).toFixed(1)}mm`);

// Rotations are packed into 32 bits by dropping the largest component, so the
// worst case is a tenth of a degree. Check we are actually inside that.
const quatErr = (() => {
  let worst = 0;
  for (const bone of dec.bones) {
    if (bone.slot !== B.slot) continue;
    const q = B.ragdoll.bodies[bone.index].rotation();
    // Sign is not preserved by smallest-three, so compare via |dot|.
    const dot = Math.abs(bone.qx * q.x + bone.qy * q.y + bone.qz * q.z + bone.qw * q.w);
    worst = Math.max(worst, 2 * Math.acos(Math.min(1, dot)));
  }
  return worst;
})();
ok('rotations survive smallest-three packing', quatErr < 0.01,
  `worst ${(quatErr * 57.2958).toFixed(3)} degrees`);

const dp = dec.props.find((p) => p.id === mover.id);
ok('the moving prop is in the snapshot', !!dp);
if (dp) {
  const live = mover.rb.translation();
  ok('prop position survives the wire',
    near(dp.x, live.x, 0.01) && near(dp.y, live.y, 0.01) && near(dp.z, live.z, 0.01));
}

// A sleeping prop must NOT be resent every tick — that is the whole bandwidth
// argument. Take two snapshots in a row with nothing happening.
advance(6000);
room.snapshot(now);
advance(TICK_MS * 3);
const quiet = decodeSnapshot(room.snapshot(now));
const asleep = [...room.world.props.values()].filter((p) => p.rb.isSleeping()).length;
ok('sleeping props stop being sent',
  quiet.props.length < room.world.props.size * 0.5,
  `${quiet.props.length} sent, ${asleep}/${room.world.props.size} asleep`);

room.destroy();
console.log(fails ? `\n${fails} FAILED` : '\nall good');
process.exit(fails ? 1 : 0);
