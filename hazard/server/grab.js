// HAZARD PAY — the grab.
//
// Carrying is a spring, never a parent. If you weld a crate to the camera it
// becomes a hat: it stops colliding meaningfully, it never swings, and it can
// be walked through walls. A spring keeps the object a real rigid body that
// happens to be dragged along — so it clips doorframes, it swings when you
// turn, it knocks your friends over, and when you carry something too heavy it
// physically drags behind you.
//
// Everything funny about this genre lives in that one decision.

import RAPIER from '@dimforge/rapier3d-compat';
import { membership, GROUPS } from './world.js';
import {
  GRAB_RANGE, GRAB_RADIUS, HOLD_DISTANCE_MIN, HOLD_DISTANCE_MAX,
  GRAB_TORQUE_SPRING, GRAB_TORQUE_DAMPING,
  GRAB_MAX_FORCE, GRAB_MAX_ACCEL, GRAB_TARGET_SPEED,
  GRAB_RESPOND, GRAB_MAX_SPEED,
  GRAB_BREAK_DISTANCE, GRAB_MAX_MASS, COOP_GRAB_BONUS,
  THROW_IMPULSE, BUTTON, TICK_DT,
} from '../shared/tune.js';

const { GROUP_STATIC, GROUP_PROP, GROUP_ACTOR } = GROUPS;

export function lookDir(actor) {
  const cp = Math.cos(actor.pitch), sp = Math.sin(actor.pitch);
  return {
    x: Math.sin(actor.yaw) * cp,
    y: sp,
    z: Math.cos(actor.yaw) * cp,
  };
}

/**
 * What is this contractor pointing at, if anything?
 *
 * Two passes, and the order is the whole point. A single fat cast against
 * everything sounds forgiving and is the opposite: aim at a mug on a bench and
 * the sphere clips the bench lip first, so the one thing you obviously meant to
 * grab is the one thing you cannot. So: sweep a generous sphere against PROPS
 * ONLY to decide what you meant, then fire a hairline ray at STATICS ONLY to
 * check nothing solid is in the way. Forgiving aim, honest occlusion.
 */
export function pickTarget(world, actor) {
  const o = { x: actor.pos.x, y: actor.eye, z: actor.pos.z };
  const d = lookDir(actor);

  // castShape(pos, rot, vel, shape, targetDistance, maxToi, stopAtPenetration,
  //           filterFlags, filterGroups, excludeCollider, excludeBody, predicate)
  const hit = world.world.castShape(
    o, { x: 0, y: 0, z: 0, w: 1 }, d,
    new RAPIER.Ball(GRAB_RADIUS),
    0, GRAB_RANGE, true,
    undefined,
    membership(GROUP_ACTOR, GROUP_PROP),
    actor.collider || undefined,
  );
  if (!hit) return null;

  const rec = world.propByCollider(hit.collider.handle);
  if (!rec || rec.broken || rec.extracted) return null;

  // Line of sight, centre to centre. A wall between you and the safe means no.
  const p = rec.rb.translation();
  let lx = p.x - o.x, ly = p.y - o.y, lz = p.z - o.z;
  const dist = Math.hypot(lx, ly, lz);
  if (dist > 1e-4) {
    lx /= dist; ly /= dist; lz /= dist;
    const blocked = world.world.castRay(
      new RAPIER.Ray(o, { x: lx, y: ly, z: lz }),
      // Stop short of the prop's own surface, or the crate occludes itself.
      Math.max(0, dist - rec.radius - 0.05),
      true, undefined,
      membership(GROUP_ACTOR, GROUP_STATIC),
      undefined, undefined,
    );
    if (blocked) return null;
  }
  return rec;
}

/** How much can this many pairs of hands lift? */
export function liftCapacity(handCount) {
  return GRAB_MAX_MASS * (1 + (handCount - 1) * COOP_GRAB_BONUS);
}

export function tryGrab(world, actor, holders) {
  const rec = pickTarget(world, actor);
  if (!rec) return null;

  const current = holders.get(rec.id) || [];
  if (current.includes(actor)) return null;
  // You can always join a lift already in progress, even if you could not have
  // started it — that is the entire cooperative move.
  if (current.length === 0 && rec.def.mass > liftCapacity(1) * 1.35) return null;

  rec.rb.wakeUp();
  const p = rec.rb.translation();
  const eye = { x: actor.pos.x, y: actor.eye, z: actor.pos.z };
  actor.holdDist = Math.max(HOLD_DISTANCE_MIN, Math.min(HOLD_DISTANCE_MAX,
    Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z)));

  rec.hold = { x: p.x, y: p.y, z: p.z };
  actor.held = rec;
  rec.held = actor.slot;
  rec.dirty = true;
  current.push(actor);
  holders.set(rec.id, current);
  return rec;
}

export function release(actor, holders, impulse) {
  const rec = actor.held;
  if (!rec) return;
  const list = holders.get(rec.id);
  if (list) {
    const i = list.indexOf(actor);
    if (i >= 0) list.splice(i, 1);
    if (list.length === 0) { holders.delete(rec.id); rec.held = null; }
  } else {
    rec.held = null;
  }
  if (impulse) {
    const d = lookDir(actor);
    const j = THROW_IMPULSE * Math.min(rec.def.mass, 40);
    rec.rb.applyImpulse({ x: d.x * j, y: d.y * j + j * 0.18, z: d.z * j }, true);
  }
  if (!holders.get(rec.id)) {
    rec.hold = null;
    // Let go cleanly, or the last frame's carry force keeps shoving it forever.
    rec.rb.resetForces(false);
    rec.rb.resetTorques(false);
  }
  rec.dirty = true;
  actor.held = null;
}

/**
 * Drive every held prop toward its holders' hands.
 *
 * With two holders the target is the midpoint of both hands, which is why a
 * two-person carry feels like a negotiation: pull in different directions and
 * the piano goes precisely nowhere, in a way everyone can see and shout about.
 */
export function stepGrabs(world, holders, actorsBySlot) {
  for (const [propId, list] of holders) {
    const rec = world.props.get(propId);
    if (!rec || rec.broken || rec.extracted || list.length === 0) {
      if (rec) rec.held = null;
      holders.delete(propId);
      for (const a of list) if (a.held === rec) a.held = null;
      continue;
    }

    const capacity = liftCapacity(list.length);
    const overload = rec.def.mass / capacity;

    // Average hand position, and average intended facing.
    let tx = 0, ty = 0, tz = 0;
    for (const a of list) {
      const d = lookDir(a);
      tx += a.pos.x + d.x * a.holdDist;
      ty += a.eye + d.y * a.holdDist;
      tz += a.pos.z + d.z * a.holdDist;
    }
    tx /= list.length; ty /= list.length; tz /= list.length;

    const p = rec.rb.translation();
    const v = rec.rb.linvel();

    // Chase the hands rather than snapping to them. Without this a fast turn
    // creates two metres of spring error in a single tick and the object is
    // fired across the room; with it, the object is dragged round behind you,
    // which is both survivable and much funnier.
    if (!rec.hold) rec.hold = { x: p.x, y: p.y, z: p.z };
    const h = rec.hold;
    let hx = tx - h.x, hy = ty - h.y, hz = tz - h.z;
    const hd = Math.hypot(hx, hy, hz);
    const step = GRAB_TARGET_SPEED * TICK_DT;
    if (hd > step) { const s = step / hd; h.x += hx * s; h.y += hy * s; h.z += hz * s; }
    else { h.x = tx; h.y = ty; h.z = tz; }

    let ex = h.x - p.x, ey = h.y - p.y, ez = h.z - p.z;
    const err = Math.hypot(tx - p.x, ty - p.y, tz - p.z);

    // Yanked out of reach: physics wins, hands lose.
    if (err > GRAB_BREAK_DISTANCE) {
      for (const a of [...list]) release(a, holders, false);
      continue;
    }

    rec.rb.wakeUp();
    // Rapier's addForce is a PERSISTENT accumulator, not a one-tick impulse:
    // it stays applied until explicitly reset. Re-adding a hold force every
    // tick without clearing the last one integrates it — after twenty ticks a
    // 112N carry is pushing with 2.2kN, which is why a held mug oscillates to
    // 40m/s and detonates. Clear before every write.
    rec.rb.resetForces(false);
    rec.rb.resetTorques(false);

    // A velocity servo. Work out how fast the object ought to be moving to
    // close the gap, clamp THAT, then apply only the acceleration needed to
    // reach it — plus enough to carry its own weight. Because the clamp lands
    // on the target velocity rather than on the output force, there is nothing
    // for the controller to wind up: the object physically cannot exceed
    // GRAB_MAX_SPEED, however hard you swing the camera.
    const strength = Math.min(1, 1 / Math.max(1, overload));
    let wx = ex * GRAB_RESPOND, wy = ey * GRAB_RESPOND, wz = ez * GRAB_RESPOND;
    const wm = Math.hypot(wx, wy, wz);
    if (wm > GRAB_MAX_SPEED) {
      const s = GRAB_MAX_SPEED / wm;
      wx *= s; wy *= s; wz *= s;
    }

    // Control effort only — how hard to push to reach the target velocity.
    let ax = (wx - v.x) / TICK_DT;
    let ay = (wy - v.y) / TICK_DT;
    let az = (wz - v.z) / TICK_DT;

    const am = Math.hypot(ax, ay, az);
    const maxA = Math.min(
      GRAB_MAX_ACCEL * list.length,
      (GRAB_MAX_FORCE * list.length) / rec.def.mass,
    );
    if (am > maxA) { const s = maxA / am; ax *= s; ay *= s; az *= s; }

    // Weight support goes on AFTER the clamp, never inside it. Holding a thing
    // up is not control effort, it is a standing cost — fold it into the vector
    // being clamped and the moment the servo saturates you silently stop
    // supporting the object, so it free-falls *and* fights the servo, which
    // oscillates it to 20m/s and fires it through the floor.
    // `strength` is the one dial that belongs here: overloaded hands support
    // only part of the weight, and the thing visibly sags out of your grip.
    const g = world.world.gravity;
    ax -= g.x * strength;
    ay -= g.y * strength;
    az -= g.z * strength;

    rec.rb.addForce({
      x: ax * rec.def.mass, y: ay * rec.def.mass, z: az * rec.def.mass,
    }, true);

    // Angular: damp the spin so it stops helicoptering, and nudge toward level.
    // Scaled by INERTIA, not mass — see the note where inertia is computed.
    const I = rec.inertia * strength;
    const av = rec.rb.angvel();
    let ttx = -av.x * GRAB_TORQUE_DAMPING * I;
    let tty = -av.y * GRAB_TORQUE_DAMPING * I;
    let ttz = -av.z * GRAB_TORQUE_DAMPING * I;

    // Uprighting torque: cross(objectUp, worldUp) points the way to level.
    const q = rec.rb.rotation();
    const up = rotateVec(q, 0, 1, 0);
    const crossX = up.y * 0 - up.z * 1;
    const crossY = 0;
    const crossZ = up.x * 1 - up.y * 0;
    const ks = GRAB_TORQUE_SPRING * I;
    ttx += crossX * ks; tty += crossY * ks; ttz += crossZ * ks;

    rec.rb.addTorque({ x: ttx, y: tty, z: ttz }, true);
    rec.dirty = true;

    void actorsBySlot; void TICK_DT; void BUTTON;
  }
}

function rotateVec(q, x, y, z) {
  const { x: qx, y: qy, z: qz, w: qw } = q;
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;
  return {
    x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
    y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
    z: iz * qw + iw * -qz + ix * -qy - iy * -qx,
  };
}
