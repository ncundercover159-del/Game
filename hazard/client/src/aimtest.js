// HAZARD PAY — does the grab go where you are looking?
//
//   node client/src/aimtest.js
//
// This exists because the answer was no for a long time and nothing noticed.
//
// A Three.js camera looks down its local -Z, so `rotateY(yaw)` aims it at
// (-sin yaw, -cos yaw). The server's lookDir() — which fires the grab, the
// valve ray, and everything else that asks "what am I pointing at" — uses
// (+sin yaw, +cos yaw). The two are exactly opposite, so the contractor was
// reaching behind the camera: you could not pick up the thing in front of you,
// and the warehouse's spawnYaw pointed the view at the dock wall.
//
// It survived because of a gap between two kinds of test rather than a lack of
// them. The headless simulation tests set actor.yaw directly and never build a
// camera, so they only ever exercised one convention against itself. The
// screenshot harness had a camera but graded pixels, and its shot angles were
// chosen by eye — which means it silently learned the broken convention and
// baked it into every camera position in the file.
//
// The lesson generalises past this bug: a seam between two subsystems is only
// tested by something that spans both, and neither side's own suite will ever
// find a disagreement about a shared convention.

import * as THREE from 'three';
import { lookDir } from '../../server/grab.js';

let fails = 0;
const ok = (name, cond, extra) => {
  if (!cond) { fails++; console.log(`FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
  else console.log(`ok   ${name}${extra ? ` — ${extra}` : ''}`);
};

/**
 * Exactly what main.js does to the camera. If that changes, change this — the
 * point of the test is that the two stay in step, so a copy that drifts is
 * worse than no copy at all.
 */
function cameraForward(yaw, pitch) {
  const cam = new THREE.PerspectiveCamera(78, 16 / 9, 0.06, 220);
  cam.rotation.set(0, 0, 0);
  cam.rotateY(yaw + Math.PI);
  cam.rotateX(pitch);
  return cam.getWorldDirection(new THREE.Vector3());
}

const CASES = [
  ['due north', Math.PI, 0],
  ['due south', 0, 0],
  ['due east', Math.PI / 2, 0],
  ['due west', -Math.PI / 2, 0],
  ['off axis', 1.234, 0],
  ['looking down', Math.PI, -0.6],
  ['looking up', 0.4, 0.75],
  ['steeply down', -2.1, -1.2],
];

let worst = 0;
for (const [name, yaw, pitch] of CASES) {
  const c = cameraForward(yaw, pitch);
  const s = lookDir({ yaw, pitch });
  const err = Math.hypot(c.x - s.x, c.y - s.y, c.z - s.z);
  worst = Math.max(worst, err);
  ok(`the camera and the grab agree, ${name}`, err < 1e-6,
    `camera (${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)}) `
    + `vs aim (${s.x.toFixed(2)}, ${s.y.toFixed(2)}, ${s.z.toFixed(2)})`);
}
console.log(`     worst disagreement ${worst.toExponential(2)}`);

// And the specific thing a player would notice first: what you see when the
// job starts. Cast the spawn view into the real collision world and measure how
// far it gets. This is the assertion that would have caught the inversion from
// the other side — with the camera backwards, every one of these stares into
// the surface the spawn platform is bolted to.
//
// Deliberately a raycast and not geometry reasoning. The first version of this
// check compared the view against the direction of the extract volume, which
// sounds equivalent and is not: on the plant the spawn faces east along the
// deck while the lorry is due north, so the metric measured a component that
// was nearly perpendicular to the thing it claimed to be about and reported a
// perfectly good spawn as broken.
const { LEVELS } = await import('../../shared/levels/index.js');
// initPhysics, not RAPIER.init() — world.js memoises the promise, and a second
// bare init of the compat build takes the deprecated argument path.
const { World, GROUPS, membership, initPhysics, RAPIER } = await import('../../server/world.js');
await initPhysics();

for (const level of LEVELS) {
  const w = new World(level);
  const yaw = level.spawnYaw ?? 0;
  const f = cameraForward(yaw, 0);
  const eye = { x: level.spawn[0], y: level.spawn[1] + 1.58, z: level.spawn[2] };
  const hit = w.world.castRay(
    new RAPIER.Ray(eye, { x: f.x, y: f.y, z: f.z }), 40, true, undefined,
    membership(GROUPS.GROUP_ACTOR, GROUPS.GROUP_STATIC),
  );
  const dist = hit ? hit.timeOfImpact : 40;
  ok(`${level.id}: the spawn view is not a wall`, dist > 4.0,
    `${dist.toFixed(1)}m of clear sight down the spawn view`);
  w.destroy();
}

console.log(fails ? `\n${fails} FAILED` : '\nall good');
process.exit(fails ? 1 : 0);
