// HAZARD PAY — a contractor.
//
// Alive, you are a kinematic capsule driven by a character controller: reliable
// on stairs, never sticks on a seam, and shoves props out of the way with real
// impulses. Knocked down, the capsule vanishes and eleven dynamic boxes wired
// together with spherical joints take over, and you are furniture until you
// stop rolling.
//
// The swap is the whole trick. A dynamic-capsule player is unpleasant to
// control and a kinematic ragdoll is not a ragdoll, so we run both and hand
// over at the moment of indignity.

import RAPIER from '@dimforge/rapier3d-compat';
import { membership, GROUPS, eulerToQuat } from './world.js';
import {
  PLAYER_RADIUS, PLAYER_HEIGHT, CROUCH_HEIGHT, EYE_HEIGHT, CROUCH_EYE, PLAYER_MASS,
  WALK_SPEED, SPRINT_SPEED, CROUCH_SPEED, GROUND_ACCEL, AIR_ACCEL, GROUND_FRICTION,
  JUMP_VELOCITY, GRAVITY, MAX_FALL, COYOTE_MS, JUMP_BUFFER_MS, MAX_STEP, MAX_SLOPE,
  STAMINA_MAX, STAMINA_SPRINT, STAMINA_REGEN, STAMINA_REGEN_DELAY_MS,
  STAMINA_HAUL_PER_KG, HAUL_FREE_KG, HEALTH_MAX, FALL_SAFE_SPEED, FALL_DAMAGE_PER_MS,
  RAGDOLL_TRIGGER_DAMAGE, RAGDOLL_MIN_MS, RAGDOLL_SETTLE_SPEED, BUTTON, TICK_DT,
} from '../shared/tune.js';

const { GROUP_STATIC, GROUP_PROP, GROUP_ACTOR, GROUP_RAGDOLL } = GROUPS;

// pelvis, chest, head, then arms and legs. Eleven is the fewest that still
// flails convincingly — nine reads as a plank and thirteen costs solver time
// nobody can see.
export const BONES = [
  { name: 'pelvis', size: [0.34, 0.24, 0.22], mass: 14, parent: -1, anchor: [0, 0, 0] },
  { name: 'chest', size: [0.38, 0.40, 0.24], mass: 20, parent: 0, anchor: [0, 0.32, 0] },
  { name: 'head', size: [0.24, 0.26, 0.24], mass: 5, parent: 1, anchor: [0, 0.33, 0] },
  { name: 'armLU', size: [0.13, 0.30, 0.13], mass: 3, parent: 1, anchor: [-0.25, 0.14, 0] },
  { name: 'armLL', size: [0.11, 0.30, 0.11], mass: 2, parent: 3, anchor: [0, -0.30, 0] },
  { name: 'armRU', size: [0.13, 0.30, 0.13], mass: 3, parent: 1, anchor: [0.25, 0.14, 0] },
  { name: 'armRL', size: [0.11, 0.30, 0.11], mass: 2, parent: 5, anchor: [0, -0.30, 0] },
  { name: 'legLU', size: [0.16, 0.38, 0.16], mass: 7, parent: 0, anchor: [-0.11, -0.22, 0] },
  { name: 'legLL', size: [0.14, 0.38, 0.14], mass: 5, parent: 7, anchor: [0, -0.38, 0] },
  { name: 'legRU', size: [0.16, 0.38, 0.16], mass: 7, parent: 0, anchor: [0.11, -0.22, 0] },
  { name: 'legRL', size: [0.14, 0.38, 0.14], mass: 5, parent: 9, anchor: [0, -0.38, 0] },
];

// Where each bone sits relative to the pelvis when standing, so the ragdoll
// starts in the pose the capsule was last drawn in rather than a heap.
const REST = (() => {
  const out = new Array(BONES.length);
  out[0] = [0, 0, 0];
  for (let i = 1; i < BONES.length; i++) {
    const b = BONES[i];
    const p = out[b.parent];
    out[i] = [p[0] + b.anchor[0], p[1] + b.anchor[1], p[2] + b.anchor[2]];
  }
  return out;
})();

export class Actor {
  constructor(world, slot, spawn, yaw) {
    this.w = world;
    this.world = world.world;
    this.slot = slot;

    this.pos = { x: spawn[0], y: spawn[1], z: spawn[2] };
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = yaw || 0;
    this.pitch = 0;

    this.grounded = false;
    this.lastGroundedAt = -1e9;
    this.jumpQueuedAt = -1e9;
    this.crouched = false;
    this.sprinting = false;
    this.height = PLAYER_HEIGHT;

    this.health = HEALTH_MAX;
    this.stamina = STAMINA_MAX;
    this.lastExertAt = -1e9;

    this.ragdoll = null;
    this.ragdollUntil = 0;
    this.downed = false;
    this.alive = true;

    this.held = null;          // prop record
    this.holdDist = 1.85;
    this.grabLatch = false;
    this.throwLatch = false;

    this.lastInputSeq = 0;
    this.impactAccum = 0;

    this.makeCapsule();
  }

  makeCapsule() {
    const half = Math.max(0.02, this.height / 2 - PLAYER_RADIUS);
    this.body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(this.pos.x, this.pos.y + this.height / 2, this.pos.z),
    );
    this.collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(half, PLAYER_RADIUS)
        .setCollisionGroups(membership(GROUP_ACTOR, GROUP_STATIC | GROUP_PROP | GROUP_ACTOR | GROUP_RAGDOLL))
        .setFriction(0.1),
      this.body,
    );

    this.ctrl = this.world.createCharacterController(0.02);
    this.ctrl.setUp({ x: 0, y: 1, z: 0 });
    this.ctrl.setMaxSlopeClimbAngle(MAX_SLOPE);
    this.ctrl.setMinSlopeSlideAngle(MAX_SLOPE * 0.72);
    this.ctrl.enableAutostep(MAX_STEP, 0.28, true);
    this.ctrl.enableSnapToGround(0.42);
    this.ctrl.setApplyImpulsesToDynamicBodies(true);
    // Mass matters here: this is what lets a sprinting contractor bowl a stack
    // of crates over instead of politely stopping.
    this.ctrl.setCharacterMass(PLAYER_MASS);
  }

  destroyCapsule() {
    if (this.ctrl) { this.world.removeCharacterController(this.ctrl); this.ctrl = null; }
    if (this.body) { this.world.removeRigidBody(this.body); this.body = null; this.collider = null; }
  }

  get eye() {
    return this.pos.y + (this.crouched ? CROUCH_EYE : EYE_HEIGHT);
  }

  /**
   * Adopt this tick's aim before anything reads it.
   *
   * Buttons are processed before movement (a grab has to happen at the instant
   * it was pressed, not a tick later), and a grab is a raycast out of the eye —
   * so if the view were still updated inside step() every grab would fire along
   * the previous frame's aim. Sixteen milliseconds of stale is invisible when
   * you are standing still and completely wrong the moment you flick.
   */
  applyView(input) {
    if (this.ragdoll || !this.alive) return;
    this.yaw = input.yaw;
    this.pitch = input.pitch;
  }

  // --- per tick -------------------------------------------------------------
  step(input, now) {
    if (this.ragdoll) { this.stepRagdoll(now); return; }
    if (!this.alive) return;

    const wantCrouch = (input.buttons & BUTTON.CROUCH) !== 0;
    this.setCrouch(wantCrouch);

    const heldMass = this.held ? this.held.def.mass : 0;
    const overweight = Math.max(0, heldMass - HAUL_FREE_KG);

    // Sprinting needs stamina and free-ish hands.
    const wantSprint = (input.buttons & BUTTON.SPRINT) !== 0
      && !this.crouched && this.stamina > 1 && heldMass < 60;
    this.sprinting = wantSprint;

    let drain = 0;
    if (wantSprint) drain += STAMINA_SPRINT;
    if (overweight > 0) drain += overweight * STAMINA_HAUL_PER_KG;
    if (drain > 0) {
      this.stamina = Math.max(0, this.stamina - drain * TICK_DT);
      this.lastExertAt = now;
    } else if (now - this.lastExertAt > STAMINA_REGEN_DELAY_MS) {
      this.stamina = Math.min(STAMINA_MAX, this.stamina + STAMINA_REGEN * TICK_DT);
    }

    // Exhausted and loaded down is a walk, and a slow one.
    const fatigue = this.stamina <= 0 ? 0.62 : 1;
    const loadPenalty = 1 / (1 + overweight * 0.006);
    const target = (this.crouched ? CROUCH_SPEED
      : this.sprinting && this.stamina > 0 ? SPRINT_SPEED : WALK_SPEED)
      * fatigue * loadPenalty;

    // --- wish direction in world space ---
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    let wx = input.moveX * c - input.moveY * s;
    let wz = input.moveX * s + input.moveY * c;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }

    const accel = (this.grounded ? GROUND_ACCEL : AIR_ACCEL) * TICK_DT;
    this.vel.x = approach(this.vel.x, wx * target, accel);
    this.vel.z = approach(this.vel.z, wz * target, accel);

    if (this.grounded && wl < 0.01) {
      const f = Math.max(0, 1 - GROUND_FRICTION * TICK_DT);
      this.vel.x *= f; this.vel.z *= f;
    }

    // --- jump, with coyote time and a buffer, because both are free ---
    if (input.buttons & BUTTON.JUMP) {
      if (!this.jumpLatch) this.jumpQueuedAt = now;
      this.jumpLatch = true;
    } else this.jumpLatch = false;

    const canJump = this.grounded || (now - this.lastGroundedAt) <= COYOTE_MS;
    if (canJump && (now - this.jumpQueuedAt) <= JUMP_BUFFER_MS && !this.crouched) {
      this.vel.y = JUMP_VELOCITY;
      this.jumpQueuedAt = -1e9;
      this.lastGroundedAt = -1e9;
      this.grounded = false;
    }

    this.vel.y = Math.max(this.vel.y + GRAVITY * TICK_DT, -MAX_FALL);

    // --- move ---
    const wasFalling = this.vel.y;
    const desired = {
      x: this.vel.x * TICK_DT, y: this.vel.y * TICK_DT, z: this.vel.z * TICK_DT,
    };
    this.ctrl.computeColliderMovement(this.collider, desired, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    const mv = this.ctrl.computedMovement();

    this.pos.x += mv.x; this.pos.y += mv.y; this.pos.z += mv.z;

    const wasGrounded = this.grounded;
    this.grounded = this.ctrl.computedGrounded();
    if (this.grounded) {
      this.lastGroundedAt = now;
      if (this.vel.y < 0) this.vel.y = 0;
      // Landing hurts in proportion to how fast you were going, and past a
      // point it stops being your legs' problem and becomes the floor's.
      if (!wasGrounded) {
        const speed = -wasFalling;
        if (speed > FALL_SAFE_SPEED) {
          this.damage((speed - FALL_SAFE_SPEED) * FALL_DAMAGE_PER_MS, now, 'fall');
          // damage() can ragdoll, and ragdolling destroys the capsule and nulls
          // this.body. Everything below this point assumes a capsule, so a hard
          // landing would dereference null and take the whole room down with it.
          // Once you are furniture there is nothing left in this function to do.
          if (this.ragdoll) return;
        }
      }
    } else if (mv.y > -1e-6 && this.vel.y < 0) {
      this.vel.y = 0; // stood up into something
    }

    // Blocked horizontally? Kill the component so we don't accumulate speed
    // into a wall and then rocket sideways the moment it ends.
    if (Math.abs(mv.x) < Math.abs(desired.x) * 0.5) this.vel.x *= 0.4;
    if (Math.abs(mv.z) < Math.abs(desired.z) * 0.5) this.vel.z *= 0.4;

    this.body.setNextKinematicTranslation({
      x: this.pos.x, y: this.pos.y + this.height / 2, z: this.pos.z,
    });
  }

  setCrouch(want) {
    if (want === this.crouched) return;
    if (!want) {
      // Only stand if there is room, or you clip through the shelf above you.
      const half = Math.max(0.02, PLAYER_HEIGHT / 2 - PLAYER_RADIUS);
      const hit = this.world.castShape(
        { x: this.pos.x, y: this.pos.y + PLAYER_HEIGHT / 2, z: this.pos.z },
        { x: 0, y: 0, z: 0, w: 1 },
        { x: 0, y: 1, z: 0 },
        new RAPIER.Capsule(half, PLAYER_RADIUS * 0.95),
        0, 0.02, true,
        undefined,
        membership(GROUP_ACTOR, GROUP_STATIC | GROUP_PROP),
        this.collider,
      );
      if (hit) return;
    }
    this.crouched = want;
    this.height = want ? CROUCH_HEIGHT : PLAYER_HEIGHT;
    this.world.removeCollider(this.collider, true);
    const half = Math.max(0.02, this.height / 2 - PLAYER_RADIUS);
    this.collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(half, PLAYER_RADIUS)
        .setCollisionGroups(membership(GROUP_ACTOR, GROUP_STATIC | GROUP_PROP | GROUP_ACTOR | GROUP_RAGDOLL))
        .setFriction(0.1),
      this.body,
    );
  }

  // --- damage ---------------------------------------------------------------
  damage(amount, now, cause) {
    if (!this.alive || amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) { this.goDown(now); return; }
    if (amount >= RAGDOLL_TRIGGER_DAMAGE && !this.ragdoll) this.enterRagdoll(now, cause);
  }

  goDown(now) {
    this.downed = true;
    this.enterRagdoll(now, 'downed');
    this.ragdollUntil = Infinity;
  }

  // --- ragdoll --------------------------------------------------------------
  enterRagdoll(now, cause) {
    if (this.ragdoll) return;
    this.dropHeld();
    const base = { x: this.pos.x, y: this.pos.y + 0.92, z: this.pos.z };
    const q = eulerToQuat([0, this.yaw, 0]);
    this.destroyCapsule();

    const bodies = [];
    const filter = GROUP_STATIC | GROUP_PROP | GROUP_RAGDOLL;
    for (let i = 0; i < BONES.length; i++) {
      const b = BONES[i];
      const r = REST[i];
      // Rest offsets are in the actor's local frame, so spin them by the yaw
      // the contractor was facing when their day went wrong.
      const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
      const wx = r[0] * c + r[2] * s;
      const wz = -r[0] * s + r[2] * c;

      const rb = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(base.x + wx, base.y + r[1], base.z + wz)
          .setRotation(q)
          .setLinvel(this.vel.x, this.vel.y, this.vel.z)
          .setLinearDamping(0.12)
          .setAngularDamping(0.7)
          .setCcdEnabled(true),
      );
      // Density, not additional mass — see the note in world.js. A ragdoll
      // whose bones weigh two grams each does not fall over, it evaporates.
      const vol = b.size[0] * b.size[1] * b.size[2];
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(b.size[0] / 2, b.size[1] / 2, b.size[2] / 2)
          .setDensity(b.mass / vol)
          .setFriction(0.75).setRestitution(0.05)
          .setCollisionGroups(membership(GROUP_RAGDOLL, filter)),
        rb,
      );
      bodies.push(rb);
    }

    const joints = [];
    for (let i = 1; i < BONES.length; i++) {
      const b = BONES[i];
      const parent = bodies[b.parent];
      const child = bodies[i];
      const pAnchor = { x: b.anchor[0], y: b.anchor[1], z: b.anchor[2] };
      const cAnchor = { x: 0, y: 0, z: 0 };
      const jd = RAPIER.JointData.spherical(pAnchor, cAnchor);
      joints.push(this.world.createImpulseJoint(jd, parent, child, true));
    }

    this.ragdoll = { bodies, joints, cause };
    this.ragdollUntil = now + RAGDOLL_MIN_MS;
  }

  stepRagdoll(now) {
    const pelvis = this.ragdoll.bodies[0].translation();
    this.pos.x = pelvis.x;
    this.pos.y = pelvis.y - 0.92;
    this.pos.z = pelvis.z;

    if (this.downed || now < this.ragdollUntil) return;
    // Up again only once you have actually stopped tumbling — getting up
    // mid-roll teleports you through the thing you were rolling down.
    let speed = 0;
    for (const b of this.ragdoll.bodies) {
      const v = b.linvel();
      speed = Math.max(speed, Math.hypot(v.x, v.y, v.z));
    }
    if (speed > RAGDOLL_SETTLE_SPEED) return;
    this.exitRagdoll();
  }

  exitRagdoll() {
    if (!this.ragdoll) return;
    const pelvis = this.ragdoll.bodies[0].translation();
    for (const j of this.ragdoll.joints) this.world.removeImpulseJoint(j, false);
    for (const b of this.ragdoll.bodies) this.world.removeRigidBody(b);
    this.ragdoll = null;

    this.pos.x = pelvis.x;
    this.pos.y = pelvis.y - 0.5;
    this.pos.z = pelvis.z;
    this.vel.x = 0; this.vel.y = 0; this.vel.z = 0;
    this.crouched = false;
    this.height = PLAYER_HEIGHT;
    this.makeCapsule();
  }

  ragdollTransforms() {
    if (!this.ragdoll) return null;
    return this.ragdoll.bodies;
  }

  dropHeld() {
    if (!this.held) return;
    this.held.held = null;
    this.held.dirty = true;
    this.held = null;
  }

  destroy() {
    this.dropHeld();
    if (this.ragdoll) {
      for (const j of this.ragdoll.joints) this.world.removeImpulseJoint(j, false);
      for (const b of this.ragdoll.bodies) this.world.removeRigidBody(b);
      this.ragdoll = null;
    }
    this.destroyCapsule();
  }
}

function approach(v, target, maxDelta) {
  const d = target - v;
  if (d > maxDelta) return v + maxDelta;
  if (d < -maxDelta) return v - maxDelta;
  return target;
}
