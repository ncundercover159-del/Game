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
  GRAB_MAX_FORCE, GRAB_MAX_ACCEL, GRAB_TRACK_ACCEL, GRAB_TARGET_SPEED,
  GRAB_RESPOND, GRAB_MAX_SPEED,
  GRAB_BREAK_DISTANCE, GRAB_MAX_MASS, COOP_GRAB_BONUS,
  THROW_IMPULSE, BUTTON, TICK_DT,
} from '../shared/tune.js';

const { GROUP_STATIC, GROUP_PROP, GROUP_ACTOR, GROUP_RAGDOLL } = GROUPS;

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

  // NO MASS REFUSAL. There used to be one here — the first pair of hands was
  // turned away above liftCapacity(1) * 1.35, i.e. 189kg — and since a lift can
  // only be JOINED once it exists, nobody could ever start one. The piano at
  // 220kg, the bathtub at 190 and the generator at 260 could not be picked up
  // by any number of contractors, which deletes the cooperative carry the whole
  // game is built around and takes £6,600 of the warehouse's £5,200 quota with
  // it. The level was unwinnable and the reason was one line.
  //
  // Nothing needs to replace it, because the servo below models it physically:
  // the hands have a force budget, holding the thing up is paid out of it
  // first, and only the remainder can be spent moving it. One pair on a piano
  // can support 79% of its weight and has nothing left to steer with, so it
  // sags and drags; a second pair doubles the budget and it comes up. Refusing
  // the grab outright replaced a physical answer with an arbitrary one.

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
  // Everything below touches the rigid body, which may already have been freed
  // — a prop can be removed from the world while somebody is still holding it,
  // and the links are only cleaned up here. Drop the references and leave the
  // physics alone.
  if (rec.removed) { actor.held = null; return; }

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
    if (!rec || rec.removed || rec.broken || rec.extracted || list.length === 0) {
      if (rec) rec.held = null;
      holders.delete(propId);
      for (const a of list) if (a.held === rec) a.held = null;
      continue;
    }

    // What the hands are worth, what holding it costs, and what is left.
    const budget = GRAB_MAX_FORCE * list.length;
    const hold = rec.def.mass * 22;          // |GRAVITY|; see tune.js
    const strength = Math.min(1, budget / hold);
    const spare = Math.max(0, budget - hold);

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

    // Control effort is limited by how briskly hands can move a thing, by what
    // is left after holding it up — and differently on each axis, because
    // dragging something is not lifting it.
    const ceiling = GRAB_MAX_ACCEL * list.length;
    const left = spare / rec.def.mass;
    const maxUp = Math.min(ceiling, left);
    const maxFlat = Math.min(ceiling, Math.max(left, GRAB_TRACK_ACCEL * list.length));

    const flat = Math.hypot(ax, az);
    if (flat > maxFlat) { const s = maxFlat / flat; ax *= s; az *= s; }
    if (Math.abs(ay) > maxUp) ay = Math.sign(ay) * maxUp;

    // ...then weight support goes on, OUTSIDE the clamp, and that placement is
    // the whole difference between a carry and a catastrophe.
    //
    // I moved it inside the clamp to make the co-operative lift real, and it
    // did — one pair could no longer raise a piano. It also reintroduced the
    // exact failure the comment I deleted was warning about. Clamping the
    // combined vector scales the SUPPORT down whenever control effort
    // saturates, so a 38kg elk with a generous control budget had its support
    // cut to a quarter, fell, fought the servo on the way, and arrived as
    // pieces: a bot shift delivered six of six broken and put three of four
    // contractors on the floor. Support is a standing cost with a fixed
    // direction; scaling it by how hard somebody is steering is not physics.
    //
    // So the budget is divided instead of shared. Holding it up is paid first,
    // and only what is left over can be spent on moving it — which is both what
    // a person is actually like and stable, because the support term is now
    // constant and cannot be modulated by the controller at all.
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
