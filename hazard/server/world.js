// HAZARD PAY — the physical world.
//
// One Rapier world per room, built from a level's plain data. The server owns
// every transform in the game; the client never simulates a prop, it only draws
// what it is told. That is the only way eight people agree about where a piano
// is while all four of them are pulling on it.

import RAPIER from '@dimforge/rapier3d-compat';
import { PROP_BY_ID, propRadius } from '../shared/props.js';
import { GRAVITY, PROP_SLEEP_LINVEL, PROP_SLEEP_ANGVEL } from '../shared/tune.js';

let ready = null;
export function initPhysics() {
  if (!ready) ready = RAPIER.init();
  return ready;
}
export { RAPIER };

const GROUP_STATIC = 0x0001;
const GROUP_PROP = 0x0002;
const GROUP_ACTOR = 0x0004;
const GROUP_RAGDOLL = 0x0008;

export const GROUPS = { GROUP_STATIC, GROUP_PROP, GROUP_ACTOR, GROUP_RAGDOLL };

// Rapier packs membership in the high 16 bits and the filter in the low 16.
export const membership = (mem, filter) => ((mem << 16) | filter) >>> 0;

export class World {
  constructor(level) {
    this.level = level;
    this.world = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 });
    this.world.integrationParameters.dt = 1 / 60;
    // A few extra solver iterations: stacked crates and two-person carries both
    // look wrong when the solver gives up early, and this is cheap at our size.
    this.world.integrationParameters.numSolverIterations = 8;

    this.events = new RAPIER.EventQueue(true);
    this.props = new Map();       // id -> prop record
    this.byHandle = new Map();    // collider handle -> prop record
    // Static geometry needs the same treatment the props get. buildStatic used
    // to create a collider and throw the brush away, which is fine right up
    // until something wants to know what it just looked at — a valve is a brush
    // and USE is a raycast, and a handle with nothing behind it cannot answer.
    this.brushByHandle = new Map();
    this.nextPropId = 1;
    this.brokenThisTick = [];
    this.drifts = [];             // conveyors: [{collider, vel}]

    this.buildStatic();
    this.spawnProps();
  }

  // --- static geometry ------------------------------------------------------
  buildStatic() {
    for (const b of this.level.brushes) {
      const rb = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(b.p[0], b.p[1], b.p[2])
          .setRotation(eulerToQuat(b.r || [0, 0, 0])),
      );
      const desc = RAPIER.ColliderDesc.cuboid(b.s[0] / 2, b.s[1] / 2, b.s[2] / 2)
        .setFriction(b.friction ?? 0.9)
        .setRestitution(b.restitution ?? 0.02)
        .setCollisionGroups(membership(
          GROUP_STATIC, GROUP_PROP | GROUP_ACTOR | GROUP_RAGDOLL,
        ));
      const col = this.world.createCollider(desc, rb);
      this.brushByHandle.set(col.handle, b);
      if (b.drift) this.drifts.push({ col, vel: b.drift });
      // A conveyor is just a surface with a tangential velocity. Rapier does
      // this natively, which saves faking it with per-contact impulses.
      if (b.drift) {
        col.setFriction(1.4);
      }
    }
  }

  // --- props ----------------------------------------------------------------
  spawnProps() {
    for (const p of this.level.props) this.spawnProp(p.kind, p.p, p.r);
  }

  spawnProp(kind, pos, rot) {
    const def = PROP_BY_ID[kind];
    if (!def) throw new Error(`unknown prop kind: ${kind}`);

    const id = this.nextPropId++;
    const rb = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(pos[0], pos[1], pos[2])
        .setRotation(eulerToQuat(rot || [0, 0, 0]))
        .setLinearDamping(0.06)
        .setAngularDamping(0.28)
        .setCcdEnabled(def.mass < 30), // light things are the ones that tunnel
    );

    const filter = GROUP_STATIC | GROUP_PROP | GROUP_ACTOR | GROUP_RAGDOLL;

    // Mass has to come from DENSITY, not from setAdditionalMass().
    //
    // Rapier recomputes a body's mass properties when colliders are attached,
    // so an additional mass applied afterwards is silently ignored — every prop
    // then weighs whatever its collider volume implies at the default density,
    // which for a mug is 0.0009kg instead of 0.4kg. Nothing announces this: the
    // catalogue still says 0.4, so every force computed from it is four hundred
    // times too strong, and carried objects fly off like they have been shot.
    // Setting density gets the mass right *and* gives Rapier a correct inertia
    // tensor for free.
    const parts = def.shape === 'compound' ? def.parts
      : [{ shape: def.shape, size: def.size }];
    let volume = 0;
    for (const p of parts) volume += shapeVolume(p.shape, p.size);
    const density = def.mass / Math.max(1e-6, volume);

    const mk = (shape, size, offset) => {
      let d;
      if (shape === 'box') d = RAPIER.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2);
      else if (shape === 'cyl') d = RAPIER.ColliderDesc.cylinder(size[1] / 2, size[0]);
      else d = RAPIER.ColliderDesc.ball(size[0]);
      d.setDensity(density)
        .setFriction(def.friction).setRestitution(def.restitution)
        .setCollisionGroups(membership(GROUP_PROP, filter))
        .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
        // The event only says "this touched something"; how badly it went is
        // read off the velocity delta. Fragile things want a low bar so every
        // real contact is considered; everything else only cares about hits
        // hard enough to hurt a person.
        .setContactForceEventThreshold(def.fragile ? 2 : 400);
      if (offset) d.setTranslation(offset[0], offset[1], offset[2]);
      return this.world.createCollider(d, rb);
    };

    const cols = [];
    if (def.shape === 'compound') {
      for (const part of def.parts) cols.push(mk(part.shape, part.size, part.offset));
    } else {
      cols.push(mk(def.shape, def.size));
    }


    const radius = propRadius(def);
    const rec = {
      id, kind, def, rb, cols, radius,
      // Torque has to be scaled by rotational inertia, not mass. A mug is 0.4kg
      // but its inertia is under a thousandth of that number, so a torque sized
      // by mass spins it at tens of thousands of rad/s² and fires it into the
      // floor. 0.4*m*r^2 is the solid-body approximation and it is close enough
      // for anything shaped like a piano or a bathtub.
      inertia: Math.max(1e-4, 0.4 * def.mass * radius * radius),
      asleep: false, held: null, broken: false, extracted: false,
      restingSince: 0, dirty: true,
    };
    this.props.set(id, rec);
    for (const c of cols) this.byHandle.set(c.handle, rec);
    return rec;
  }

  propByCollider(handle) { return this.byHandle.get(handle); }

  brushByCollider(handle) { return this.brushByHandle.get(handle); }

  breakProp(rec) {
    if (rec.broken || rec.extracted) return false;
    rec.broken = true;
    rec.dirty = true;
    // The husk stays, so the floor fills with the evidence.
    for (const c of rec.cols) {
      c.setCollisionGroups(membership(GROUP_PROP, GROUP_STATIC | GROUP_PROP));
    }
    this.brokenThisTick.push(rec);
    return true;
  }

  /**
   * Stock that has been paid for stops being furniture.
   *
   * Marking a prop `extracted` used to bank the money, hide the mesh, and leave
   * a fully solid rigid body sitting in the van. Deliver a safe and the next
   * thing you deliver bounces off it; deliver four and the van is a wall you
   * cannot get the fifth past. The van had a physical capacity nobody designed,
   * every game got quietly harder towards the end, and on the plant — small
   * flatbed, 260kg pump motor — the last delivery may simply not have fit.
   *
   * Kept in `props` rather than removed, because the record is what carries the
   * EXTRACTED flag to clients, and a prop that vanishes from the map stops
   * being told about. Inert, asleep and colliding with nothing is the state we
   * actually want: invisible to physics, still present on the wire.
   */
  retireProp(rec) {
    for (const c of rec.cols) c.setCollisionGroups(membership(0, 0));
    rec.rb.setGravityScale(0, true);
    rec.rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    rec.rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    rec.rb.sleep();
  }

  removeProp(rec) {
    for (const c of rec.cols) this.byHandle.delete(c.handle);
    this.world.removeRigidBody(rec.rb);
    this.props.delete(rec.id);
  }

  // --- step -----------------------------------------------------------------
  /**
   * One tick, bracketed by a velocity snapshot.
   *
   * Fragility is "how hard did it just get hit", and the honest measure of that
   * is how much velocity the thing lost in the collision — not contact force.
   * Force divided by mass punishes light objects for existing: a 0.4kg mug
   * registers 77N just being lifted off a floor, which reads as a 2.5m/s smash
   * and shatters it in your hands. Velocity delta cannot be fooled that way,
   * and gravity only ever contributes 0.37m/s of it per tick.
   */
  step() {
    this.brokenThisTick.length = 0;
    for (const rec of this.props.values()) {
      const v = rec.rb.linvel();
      rec.pvx = v.x; rec.pvy = v.y; rec.pvz = v.z;
      rec.contacted = false;
    }
    this.world.step(this.events);
    for (const rec of this.props.values()) {
      const v = rec.rb.linvel();
      rec.dv = Math.hypot(v.x - rec.pvx, v.y - rec.pvy, v.z - rec.pvz);
    }
    this.trackSleep();
  }

  /**
   * Rapier sleeps idle bodies for us; we just need to notice the edge, because
   * the transition is what the wire cares about. A prop that is asleep costs
   * nothing to send and a prop that just fell asleep must be sent exactly once,
   * at its final resting transform.
   */
  trackSleep() {
    for (const rec of this.props.values()) {
      const sleeping = rec.rb.isSleeping();
      if (sleeping !== rec.asleep) {
        rec.asleep = sleeping;
        rec.dirty = true;
      } else if (!sleeping) {
        rec.dirty = true;
      }
    }
  }

  /** Everything that has to go out this snapshot. */
  *dirtyProps() {
    for (const rec of this.props.values()) if (rec.dirty) yield rec;
  }

  /** Called after a snapshot goes out. Awake props re-dirty themselves next tick. */
  clearDirty() {
    for (const rec of this.props.values()) rec.dirty = false;
  }

  isResting(rec) {
    const v = rec.rb.linvel(), a = rec.rb.angvel();
    return Math.hypot(v.x, v.y, v.z) < PROP_SLEEP_LINVEL
      && Math.hypot(a.x, a.y, a.z) < PROP_SLEEP_ANGVEL;
  }

  destroy() {
    this.events.free();
    this.world.free();
  }
}

export function eulerToQuat([x, y, z]) {
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
  return {
    x: s1 * c2 * c3 + c1 * s2 * s3,
    y: c1 * s2 * c3 - s1 * c2 * s3,
    z: c1 * c2 * s3 + s1 * s2 * c3,
    w: c1 * c2 * c3 - s1 * s2 * s3,
  };
}

/** Volume of a primitive, for turning a catalogue mass into a collider density. */
export function shapeVolume(shape, size) {
  if (shape === 'box') return size[0] * size[1] * size[2];
  if (shape === 'cyl') return Math.PI * size[0] * size[0] * size[1];
  return (4 / 3) * Math.PI * size[0] * size[0] * size[0];
}
