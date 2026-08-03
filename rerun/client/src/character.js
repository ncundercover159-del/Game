// RERUN — the articulated character.
//
// A head, a torso, two arms and two legs, animated with a real walk cycle.
// Every part is its own InstancedMesh, so one draw call covers that part on
// all sixty ghosts at once. Five draw calls for a crowd, not sixty.
//
// Every joint rotates in the sagittal plane (about local X) and the body
// rotates about Y. Two rotations on perpendicular axes compose into a single
// matrix with no quaternion work and no Object3D per part.

import {
  SphereGeometry, CapsuleGeometry, CylinderGeometry, CircleGeometry,
  InstancedMesh, MeshLambertMaterial, MeshBasicMaterial, Color, DoubleSide,
} from 'three';
import { PLAYER_HEIGHT, MOVE_SPEED } from '@shared/constants.js';

// Proportions, in metres, measured from the feet. Shoulders plus arm radius
// stay inside the 0.38m collision cylinder so the visual never pokes through
// a wall the body is resting against.
export const RIG = {
  hipY: 0.62,
  hipX: 0.125,
  legLen: 0.62,
  legR: 0.10,

  torsoY: 0.88,
  torsoR: 0.225,
  torsoLen: 0.30,

  shoulderY: 1.08,
  shoulderX: 0.275,
  armLen: 0.48,
  armR: 0.082,

  headY: 1.30,
  headR: 0.215,

  eyeY: 1.33,
  eyeX: 0.085,
  eyeF: 0.185,
};

// One full stride covers this much ground, so the feet match the floor
// instead of skating over it.
const STRIDE_METRES = 1.35;
export const STRIDE_RATE = (Math.PI * 2) / STRIDE_METRES;

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * A crowd of characters sharing five instanced meshes.
 * `ghost: true` gives unlit, translucent parts; otherwise they are lit.
 */
export class CharacterRig {
  constructor(scene, capacity, { ghost = false, opacity = 1 } = {}) {
    this.capacity = capacity;
    this.ghost = ghost;

    // depthWrite stays ON for ghosts. Six translucent parts per body with
    // depth writing off means every limb blends over every other limb over
    // every ghost behind it, and the fill cost is what actually kills a phone.
    // Writing depth keeps the ghostly blend against the arena while giving
    // correct occlusion between bodies — which also stops a crowd smearing
    // into one pale mass.
    const mat = () => (ghost
      ? new MeshBasicMaterial({ transparent: true, opacity, depthWrite: true })
      : new MeshLambertMaterial({}));

    const head = new SphereGeometry(RIG.headR, 7, 5);
    const torso = new CapsuleGeometry(RIG.torsoR, RIG.torsoLen, 2, 7);
    // Limbs hang from their pivot, so the origin sits at the joint.
    const leg = new CylinderGeometry(RIG.legR, RIG.legR * 0.82, RIG.legLen, 5);
    leg.translate(0, -RIG.legLen / 2, 0);
    const arm = new CylinderGeometry(RIG.armR, RIG.armR * 0.85, RIG.armLen, 5);
    arm.translate(0, -RIG.armLen / 2, 0);

    this.head = new InstancedMesh(head, mat(), capacity);
    this.torso = new InstancedMesh(torso, mat(), capacity);
    this.legs = new InstancedMesh(leg, mat(), capacity * 2);
    this.arms = new InstancedMesh(arm, mat(), capacity * 2);

    this.eyes = new InstancedMesh(
      new CircleGeometry(0.058, 6),
      new MeshBasicMaterial({
        color: 0x0b0c14, side: DoubleSide,
        transparent: ghost, opacity: ghost ? 0.8 : 1, depthWrite: !ghost,
      }),
      capacity * 2,
    );

    this.parts = [this.head, this.torso, this.legs, this.arms];
    for (const m of [...this.parts, this.eyes]) {
      m.frustumCulled = false;
      m.count = 0;
    }
    const white = new Color(1, 1, 1);
    for (const m of this.parts) {
      for (let i = 0; i < m.instanceMatrix.count; i++) m.setColorAt(i, white);
      m.instanceColor.needsUpdate = true;
    }

    scene.add(this.head, this.torso, this.legs, this.arms, this.eyes);

    this.n = 0;
    this.limbN = 0;
    this.eyeN = 0;
  }

  begin() {
    this.n = 0;
    this.limbN = 0;
    this.eyeN = 0;
  }

  /**
   * pose: { x, y, z, yaw, dist, speed, grounded, dead, t, scale, color }
   *  dist    metres travelled so far — drives the stride, so it never skates
   *  speed   horizontal m/s
   *  t       seconds, only used for the death flail
   */
  write(pose) {
    if (this.n >= this.capacity) return;
    const i = this.n;
    const s = Math.min(1, (pose.speed || 0) / (MOVE_SPEED * 0.75));
    const air = pose.grounded === false ? 1 : 0;
    const k = pose.scale === undefined ? 1 : pose.scale;

    const phase = (pose.dist || 0) * STRIDE_RATE;
    const swing = Math.sin(phase);
    const swingB = Math.sin(phase + Math.PI);

    let legA = swing * 0.85 * s;
    let legB = swingB * 0.85 * s;
    let armA = -swing * 0.55 * s - 0.1;
    let armB = -swingB * 0.55 * s - 0.1;
    let lean = 0.20 * s;
    let bob = Math.abs(Math.sin(phase)) * 0.03 * s;

    if (air) {
      // Airborne: front knee up, back leg trailing, arms thrown overhead.
      legA = lerp(legA, -0.95, 1);
      legB = lerp(legB, 0.55, 1);
      armA = -2.15;
      armB = -1.95;
      lean = -0.08;
      bob = 0;
    }
    if (pose.dead) {
      // The pose that loops forever.
      const f = (pose.t || 0) * 9;
      legA = Math.sin(f) * 1.15;
      legB = Math.sin(f + 2.1) * 1.15;
      armA = -2.7 + Math.sin(f * 1.3) * 0.35;
      armB = -2.7 + Math.sin(f * 1.1 + 1) * 0.35;
      lean = 0.55;
      bob = 0;
    }

    const ox = pose.x;
    const oy = pose.y + bob * k;
    const oz = pose.z;
    const yaw = pose.yaw;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cl = Math.cos(lean), sl = Math.sin(lean);

    // Everything above the hip inherits the lean, so pivots are swung about
    // the hip before being placed.
    const hipY = RIG.hipY * k;
    const leaned = (py, pz) => {
      const dy = py * k - hipY;
      return { y: hipY + dy * cl - pz * sl, z: dy * sl + pz * cl };
    };

    const col = pose.color;

    // --- torso ---
    const tp = leaned(RIG.torsoY, 0);
    this.setPart(this.torso, i, ox, oy, oz, cy, sy, 0, tp.y, tp.z, lean, k, col);

    // --- head ---
    const hp = leaned(RIG.headY, 0);
    this.setPart(this.head, i, ox, oy, oz, cy, sy, 0, hp.y, hp.z, lean * 0.45, k, col);

    // --- legs (straight off the hip, no lean) ---
    const li = this.limbN;
    this.setPart(this.legs, li, ox, oy, oz, cy, sy, -RIG.hipX * k, hipY, 0, legA, k, col);
    this.setPart(this.legs, li + 1, ox, oy, oz, cy, sy, RIG.hipX * k, hipY, 0, legB, k, col);

    // --- arms (leaned with the torso) ---
    const sp = leaned(RIG.shoulderY, 0);
    this.setPart(this.arms, li, ox, oy, oz, cy, sy, -RIG.shoulderX * k, sp.y, sp.z, lean + armA, k, col);
    this.setPart(this.arms, li + 1, ox, oy, oz, cy, sy, RIG.shoulderX * k, sp.y, sp.z, lean + armB, k, col);
    this.limbN += 2;

    // --- eyes, carried on the face ---
    const ep = leaned(RIG.eyeY, RIG.eyeF);
    const ey = oy + ep.y;
    const fx = sy * ep.z, fz = cy * ep.z;
    const rx = cy * RIG.eyeX * k, rz = -sy * RIG.eyeX * k;
    const ea = this.eyes.instanceMatrix.array;
    writeYaw(ea, this.eyeN, ox + fx + rx, ey, oz + fz + rz, cy, sy, k);
    writeYaw(ea, this.eyeN + 1, ox + fx - rx, ey, oz + fz - rz, cy, sy, k);
    this.eyeN += 2;

    this.n++;
  }

  setPart(mesh, idx, ox, oy, oz, cy, sy, px, py, pz, rot, k, col) {
    const a = mesh.instanceMatrix.array;
    const o = idx * 16;
    const ca = Math.cos(rot), sa = Math.sin(rot);

    // Ry(yaw) * Rx(rot), scaled uniformly.
    a[o] = cy * k; a[o + 1] = 0; a[o + 2] = -sy * k; a[o + 3] = 0;
    a[o + 4] = sy * sa * k; a[o + 5] = ca * k; a[o + 6] = cy * sa * k; a[o + 7] = 0;
    a[o + 8] = sy * ca * k; a[o + 9] = -sa * k; a[o + 10] = cy * ca * k; a[o + 11] = 0;
    // Pivot, rotated into world by the yaw only.
    a[o + 12] = ox + cy * px + sy * pz;
    a[o + 13] = oy + py;
    a[o + 14] = oz - sy * px + cy * pz;
    a[o + 15] = 1;

    if (col) {
      const c = mesh.instanceColor.array;
      c[idx * 3] = col.r; c[idx * 3 + 1] = col.g; c[idx * 3 + 2] = col.b;
    }
  }

  end() {
    this.head.count = this.n;
    this.torso.count = this.n;
    this.legs.count = this.limbN;
    this.arms.count = this.limbN;
    this.eyes.count = this.eyeN;
    for (const m of this.parts) {
      m.instanceMatrix.needsUpdate = true;
      m.instanceColor.needsUpdate = true;
    }
    this.eyes.instanceMatrix.needsUpdate = true;
  }

  /** Top of the head, for sitting hats on. */
  static headTop(scale = 1) {
    return (RIG.headY + RIG.headR) * scale;
  }
}

function writeYaw(a, i, x, y, z, cy, sy, k) {
  const o = i * 16;
  a[o] = cy * k; a[o + 1] = 0; a[o + 2] = -sy * k; a[o + 3] = 0;
  a[o + 4] = 0; a[o + 5] = k; a[o + 6] = 0; a[o + 7] = 0;
  a[o + 8] = sy * k; a[o + 9] = 0; a[o + 10] = cy * k; a[o + 11] = 0;
  a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1;
}

export { PLAYER_HEIGHT };
