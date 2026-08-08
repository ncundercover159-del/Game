// HAZARD PAY — AI contractors.
//
// A bot is a thing that fills in an input packet. That is the whole contract:
// it reads the world the way a player reads their screen, and it writes
// `pendingInput`, exactly like a socket does. It never sets a position, never
// calls tryGrab, never touches a rigid body. Two reasons, and the second is the
// important one:
//
//   1. Whatever a bot can do, a player can do, because it is the same code.
//   2. The input path is the thing that is hardest to test with humans, so the
//      bots are permanent load on it. If a bot can work a shift, the netcode
//      underneath it works.
//
// They exist because the original brief is a game you play with friends, and a
// demo cannot depend on three of them being awake.
//
// --- on the two coordinate conventions --------------------------------------
// The actor's aim and the actor's movement do not share a frame. Measured
// against the real simulation (server/actor.js and server/grab.js):
//
//   lookDir(yaw)     = ( sin yaw, cos yaw)      <- where a grab ray goes
//   move(moveY = 1)  = (-sin yaw, cos yaw)      <- where the body goes
//
// They agree along Z and are mirrored in X. Rather than pick a side, everything
// below derives its stick from the actor's own wish-direction formula, inverted:
// the matrix in Actor.step is a plain rotation, so the stick that produces a
// wanted world direction is that matrix transposed. This stays correct whichever
// way the argument about conventions is eventually settled — see the report.

import RAPIER from '@dimforge/rapier3d-compat';
import { membership, GROUPS } from './world.js';
import { liftCapacity } from './grab.js';
import {
  BUTTON, GRAB_RANGE, EYE_HEIGHT, REVIVE_RADIUS, IMPACT_SAFE_MOMENTUM, TICK_DT,
} from '../shared/tune.js';

const { GROUP_STATIC, GROUP_ACTOR } = GROUPS;

const MODE = {
  SEEK: 'seek',      // walking to something worth money
  HAUL: 'haul',      // walking it to the van
  DROP: 'drop',      // stood at the van, letting go
  CLEAR: 'clear',    // stepping back so it can settle
  RESCUE: 'rescue',  // a mate is on the floor
};

// How far ahead the feet are checked. Just past a walking stride, so a bot
// notices the edge of the inspection pit before it is standing over it.
const PROBE_AHEAD = 0.95;
// A drop this deep is a decision, not a step. The loading dock is 1.2m and the
// pit is 1.4m, and the difference between them is that nothing which goes into
// the pit ever comes out: a jump apex is 0.57m and autostep is 0.42m, so a 1.4m
// lip is a trap with no exit. Bots use the ramp for the dock and treat anything
// deeper than this as a wall.
const LEDGE_MAX_DROP = 1.0;
// A rise bigger than the character controller's autostep needs a hop. Jumping
// on sight of it beats waiting to be stuck against it.
const STEP_UP = 0.30;
// Chest-height feeler for walls and racking uprights. Low kerbs pass under it,
// deliberately: those are the character controller's problem, not navigation's.
const FEEL_AHEAD = 1.25;
const FEEL_HEIGHT = 0.95;

// How fast a bot may turn its head, in radians per second.
//
// This is not cosmetic. A carried object is dragged towards a point an arm's
// length in front of the eyes, so the aim IS the hand: snap the yaw round in
// one tick and the hand teleports through an arc, the servo chases it at its
// full GRAB_MAX_SPEED of 6.5m/s, and a 126kg server rack becomes 818kg m/s of
// momentum — which room.js reads as an instant knockout for every contractor
// within a metre and a half. Bots that turn at a human speed simply stop
// killing their own crew.
const TURN_FREE = 7.0;
const TURN_CARRY = 2.6;
const LOOK_RATE = 3.2;
// Room to leave around other people. Modest on purpose: every carried load is
// already in the hazard list that everybody else steers around, so inflating
// this as well double-counts and turns a shared ramp into a standoff where
// nobody may approach anybody. A body on the floor gets less room still — it
// cannot dodge, it is ankle height, and it has an unfortunate habit of coming
// to rest exactly on the route to the van.
const AVOID_ACTOR = 1.1;
const AVOID_DOWNED = 0.6;
// How long a mate lies there before somebody puts the takings down and goes to
// get them. A crew that is all on the floor loses the job outright.
const RESCUE_PATIENCE_MS = 6000;

const AIM_TOLERANCE = 0.30;       // radians, before a bot bothers pressing grab
const REACH = GRAB_RANGE * 0.72;  // stop short of the limit; the cast is fat
const MAX_LIFT_HEIGHT = 2.4;      // above this you need a boost, which bots lack
const STUCK_SPEED = 0.55;         // m/s below which "walking" means "shoving a wall"
const STUCK_MS = 500;
const CLAIM_MS = 9000;
const GIVE_UP_MS = 16_000;        // per target, before it goes on the ignore list
const SNUB_MS = 30_000;           // how long an abandoned target stays ignored
const REPLAN_MS = 4000;

const ZERO = {
  seq: 0, moveX: 0, moveY: 0, yaw: 0, pitch: 0, buttons: 0, holdDist: 1.85,
};

/**
 * One AI contractor.
 *
 * Owns no state the simulation reads — only its own opinions about where it was
 * going and why.
 */
export class Bot {
  constructor(slot, pool) {
    this.slot = slot;
    this.pool = pool;
    // A lane of their own. Eight contractors funnelling up one ramp on exactly
    // the same line spend the shift shoving each other off it, and the loading
    // dock is six metres wide precisely so they do not have to.
    this.lane = ((slot % 4) - 1.5) * 0.9;
    this.mode = MODE.SEEK;
    this.targetId = 0;
    this.rescueSlot = -1;
    this.seq = 1;
    this.since = 0;
    this.snubbed = new Map();   // propId -> the time it may be considered again
    this.route = [];
    this.routeAt = 0;
    this.routeKey = '';
    this.lastPos = { x: 0, z: 0 };
    this.movedAt = 0;
    this.jumpUntil = 0;
    this.sidestep = 1;
    this.sidestepUntil = 0;
    this.grabPulseUntil = 0;
    this.grabRestUntil = 0;
    this.yaw = null;            // where the head actually is, as opposed to wants to be
    this.pitch = 0;
  }

  /**
   * Turn the head towards where the decision wanted it, at a speed a wrist
   * could manage. Everything that sends a yaw goes through here.
   */
  face(desiredYaw, desiredPitch, me, carrying) {
    if (this.yaw === null) { this.yaw = me.yaw; this.pitch = me.pitch; }
    const rate = (carrying ? TURN_CARRY : TURN_FREE) * TICK_DT;
    this.yaw = wrapAngle(this.yaw + clamp(wrapAngle(desiredYaw - this.yaw), -rate, rate));
    const prate = LOOK_RATE * TICK_DT;
    this.pitch = clamp(this.pitch + clamp(desiredPitch - this.pitch, -prate, prate), -1.5, 1.5);
    return this.yaw;
  }

  /**
   * One input packet, in the shape shared/protocol.js readInput produces.
   *
   * @param {Room} room
   * @param {Actor} me the bot's own actor — read only
   * @param {number} now room clock, milliseconds
   */
  think(room, me, now) {
    // Face down on the floor is not a state with opinions.
    if (!me.alive || me.ragdoll || me.downed) {
      this.movedAt = now;
      this.route = [];
      this.yaw = me.yaw;
      this.pitch = me.pitch;
      return this.idle(me);
    }
    if (!this.since) { this.since = now; this.movedAt = now; }
    this.trackProgress(me, now);

    // A crew that is all on the floor loses the job outright — room.js calls
    // that a wipe — so picking a mate up eventually outranks any single crate.
    // Somebody with their hands full waits a few seconds first, in case a free
    // pair of hands takes it; if nobody does, they go anyway. Reviving does not
    // need empty hands, only proximity and the USE button held down.
    const casualty = this.pool.casualtyFor(room, me, this, now);
    const urgent = casualty
      && (!me.held || now - (casualty.downedAt || now) > RESCUE_PATIENCE_MS);

    if (urgent) {
      if (this.mode !== MODE.RESCUE || this.rescueSlot !== casualty.slot) {
        this.enter(MODE.RESCUE, now);
        this.rescueSlot = casualty.slot;
      }
    } else if (me.held) {
      // Holding something otherwise overrides everything: finish the delivery.
      if (this.mode !== MODE.HAUL && this.mode !== MODE.DROP) this.enter(MODE.HAUL, now);
    } else if (this.mode === MODE.HAUL || this.mode === MODE.DROP) {
      // Dropped it, had it yanked away, or somebody's crate landed on it.
      this.enter(this.mode === MODE.DROP ? MODE.CLEAR : MODE.SEEK, now);
    } else if (this.mode === MODE.RESCUE) {
      this.enter(MODE.SEEK, now);
    }

    switch (this.mode) {
      case MODE.HAUL:
      case MODE.DROP: return this.haul(room, me, now);
      case MODE.CLEAR: return this.clear(room, me, now);
      case MODE.RESCUE: return this.rescue(room, me, now);
      default: return this.seek(room, me, now);
    }
  }

  enter(mode, now) {
    this.mode = mode;
    this.since = now;
    this.movedAt = now;
    this.sidestepUntil = 0;
    this.route = [];
    this.routeKey = '';
    if (mode !== MODE.RESCUE) this.rescueSlot = -1;
  }

  trackProgress(me, now) {
    const moved = Math.hypot(me.pos.x - this.lastPos.x, me.pos.z - this.lastPos.z);
    // Sampled per tick, so compare metres-per-tick against the speed we would
    // have if we were walking rather than leaning on a wall.
    if (moved > STUCK_SPEED / 60) this.movedAt = now;
    this.lastPos.x = me.pos.x;
    this.lastPos.z = me.pos.z;
  }

  // --- looking for work ------------------------------------------------------
  seek(room, me, now) {
    let rec = room.world.props.get(this.targetId);
    if (!this.viable(room, rec, me, now)) {
      rec = this.pool.pickTarget(room, me, this, now);
      if (this.targetId) this.pool.unclaim(this.targetId, this.slot);
      this.targetId = rec ? rec.id : 0;
      this.since = now;
      this.movedAt = now;
      this.routeKey = '';
    }
    if (!rec) {
      // Nothing a bot can reach is worth carrying. Wait near the van rather
      // than wandering off; that is where the work will be.
      const e = room.level.extract.p;
      return this.goTo(room, me, now, e[0], e[1], e[2], { arrive: 4.0 });
    }

    this.pool.claim(rec.id, this.slot, now);

    // Given up: it is under a shelf, wedged in a corner, or being fought over.
    // Snub it for a while so the crew spreads out over the building.
    if (now - this.since > GIVE_UP_MS) {
      this.snubbed.set(rec.id, now + SNUB_MS);
      this.pool.unclaim(rec.id, this.slot);
      this.targetId = 0;
      return this.idle(me);
    }

    const p = rec.rb.translation();
    const eye = { x: me.pos.x, y: me.pos.y + EYE_HEIGHT, z: me.pos.z };
    const dist = Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z);
    const aim = aimAt(eye, p);

    if (dist < REACH) {
      const input = this.goTo(room, me, now, p.x, p.y, p.z, { arrive: 0.85, aim });
      // The grab is edge-triggered in room.js: a held button is one attempt and
      // then silence. Pulse it, so a refused grab is retried.
      if (Math.abs(wrapAngle(aim.yaw - me.yaw)) < AIM_TOLERANCE) {
        input.buttons |= this.pulseGrab(now);
      }
      return input;
    }

    // Line the aim up on the way in, so the grab can fire the moment it is in
    // range rather than a turn later. It has to go through `aim` rather than be
    // patched onto the returned packet: the movement stick is derived FROM the
    // yaw in the packet, so overwriting the yaw afterwards silently rotates
    // every step the bot takes away from where it meant to go.
    return this.goTo(room, me, now, p.x, p.y, p.z,
      { arrive: 0.6, aim: dist < GRAB_RANGE * 1.8 ? aim : null });
  }

  /** Is this still a sensible thing to be walking towards? */
  viable(room, rec, me, now) {
    if (!rec) return false;
    if (rec.broken || rec.extracted) return false;
    if (rec.held !== null && !this.pool.needsHands(room, rec)) return false;
    if ((this.snubbed.get(rec.id) || 0) > now) return false;
    if (!this.pool.mayClaim(rec.id, this.slot, now)) return false;
    const p = rec.rb.translation();
    // Anything on a top deck needs a boost off a friend's shoulders, which is a
    // verb no bot has. Chasing it is how a bot spends a shift looking upwards.
    // Measure to the bottom of the thing, not its centre — a vending machine on
    // a low shelf is head height at the base and out of sight at the middle.
    if (p.y - Math.min(rec.radius, 1.1) - me.pos.y > MAX_LIFT_HEIGHT) return false;
    if (insideExtract(room.level.extract, p, 0)) return false;
    return true;
  }

  pulseGrab(now) {
    if (now < this.grabRestUntil) return 0;
    if (now < this.grabPulseUntil) return BUTTON.GRAB;
    this.grabPulseUntil = now + 50;
    this.grabRestUntil = now + 240;
    return BUTTON.GRAB;
  }

  // --- carrying it to the van ------------------------------------------------
  haul(room, me, now) {
    const rec = me.held;
    if (!rec) return this.idle(me);
    const e = room.level.extract;
    const stand = this.pool.dropStand(this.lane);
    const p = rec.rb.translation();
    const here = Math.hypot(me.pos.x - stand.x, me.pos.z - stand.z);

    if (this.mode === MODE.DROP || here < 1.2) {
      if (this.mode !== MODE.DROP) { this.mode = MODE.DROP; this.since = now; }
      // Hold it out over the van bed and let go. Aiming rather than walking in
      // keeps the bot's own capsule out of the volume, so it cannot kick the
      // takings back out while they settle — room.js only pays for things that
      // have stopped moving.
      //
      // The height is per-object and as low as the object allows: gravity is
      // -22 here, so a half-metre release is already 4.7m/s and a mug shatters
      // at 3.2. Set it down; do not post it.
      const aimY = stand.y + clamp(rec.radius, 0.12, 0.9) + 0.08;
      const aim = aimAt({ x: me.pos.x, y: me.pos.y + EYE_HEIGHT, z: me.pos.z },
        { x: stand.aim.x, y: aimY, z: stand.aim.z });
      // Still short of the spot: keep walking in, but face the van the whole
      // way so the load is already over the bed when the feet arrive.
      const input = here > 0.7
        ? this.walk(room, me, now, stand.x, stand.z, { aim, carrying: true })
        : {
          ...ZERO,
          seq: this.seq++,
          yaw: this.face(aim.yaw, aim.pitch, me, true),
          pitch: this.pitch,
        };
      // Release on the object's own position, which is the test room.js
      // applies — and give up eventually rather than stand here all shift.
      if (insideExtract(e, p, 0.2) || now - this.since > 7000) {
        input.buttons |= this.pulseGrab(now);
      }
      return input;
    }

    const input = this.goTo(room, me, now, stand.x, stand.y, stand.z,
      { arrive: 0, carrying: true });
    // Reel the load in against the chest. A long hold swings into door frames
    // and into other people, and the wire's holdDist field cannot do this —
    // the server never reads it (see the report), so PULL is the only lever.
    if (me.holdDist > 1.45) input.buttons |= BUTTON.PULL;
    return input;
  }

  /** Just dropped something in the van: get out of the way so it can settle. */
  clear(room, me, now) {
    if (now - this.since > 1200) { this.enter(MODE.SEEK, now); return this.idle(me); }
    const e = room.level.extract.p;
    const away = { x: me.pos.x - e[0], z: me.pos.z - e[2] };
    const len = Math.hypot(away.x, away.z) || 1;
    return this.goTo(room, me, now,
      me.pos.x + (away.x / len) * 3, me.pos.y, me.pos.z + (away.z / len) * 3, { arrive: 0 });
  }

  // --- picking a mate up -----------------------------------------------------
  rescue(room, me, now) {
    const mate = room.actors.get(this.rescueSlot);
    if (!mate || !mate.downed) { this.enter(MODE.SEEK, now); return this.idle(me); }
    this.pool.claimRescue(this.rescueSlot, this.slot, now);
    const d = Math.hypot(mate.pos.x - me.pos.x, mate.pos.z - me.pos.z);
    const aim = aimAt({ x: me.pos.x, y: me.pos.y + EYE_HEIGHT, z: me.pos.z },
      { x: mate.pos.x, y: mate.pos.y + 0.4, z: mate.pos.z });
    if (d < REVIVE_RADIUS * 0.8) {
      // room.js picks the nearest downed contractor itself; standing close and
      // holding USE is the whole interaction.
      const input = this.idle(me);
      input.yaw = this.face(aim.yaw, aim.pitch, me, !!me.held);
      input.pitch = this.pitch;
      input.buttons |= BUTTON.USE;
      return input;
    }
    if (now - this.since > GIVE_UP_MS) { this.enter(MODE.SEEK, now); return this.idle(me); }
    return this.goTo(room, me, now, mate.pos.x, mate.pos.y, mate.pos.z,
      { arrive: REVIVE_RADIUS * 0.7, aim });
  }

  // --- locomotion ------------------------------------------------------------
  /**
   * Walk to a point, taking the long way round when the level demands it.
   *
   * Two layers. The route is coarse and comes from the level's own tags — a
   * brush tagged `ramp` is how you get onto a brush tagged `dock`, and without
   * that knowledge a bot on the loading dock can see the floor 1.2m below and
   * correctly refuse to step off it, for ever. The steering is fine and comes
   * from raycasts, so a bot cannot be broken by somebody moving a shelf.
   */
  goTo(room, me, now, tx, ty, tz, opts = {}) {
    this.replan(room, me, now, tx, ty, tz);
    while (this.route.length) {
      const wp = this.route[0];
      if (Math.hypot(me.pos.x - wp.x, me.pos.z - wp.z) > wp.r) {
        return this.walk(room, me, now, wp.x, wp.z, { ...opts, arrive: 0 });
      }
      this.route.shift();
    }
    return this.walk(room, me, now, tx, tz, opts);
  }

  replan(room, me, now, tx, ty, tz) {
    const key = `${Math.round(tx)},${Math.round(ty)},${Math.round(tz)}`;
    if (key === this.routeKey && now - this.routeAt < REPLAN_MS) return;
    this.routeKey = key;
    this.routeAt = now;
    this.route = planRoute(room, me, ty, this.lane);
  }

  walk(room, me, now, tx, tz, opts = {}) {
    const dx = tx - me.pos.x;
    const dz = tz - me.pos.z;
    const dist = Math.hypot(dx, dz);
    const carrying = !!me.held;
    const input = { ...ZERO, seq: this.seq++, yaw: me.yaw, pitch: me.pitch };

    if (opts.arrive && dist < opts.arrive) {
      if (opts.aim) {
        input.yaw = this.face(opts.aim.yaw, opts.aim.pitch, me, carrying);
        input.pitch = this.pitch;
      }
      return input;
    }
    if (dist < 1e-3) return input;

    const want = { x: dx / dist, z: dz / dist };
    const pick = this.chooseHeading(room, me, now, want);
    // Boxed in on every heading: turning on the spot is the only move that
    // cannot make things worse, and next tick's fan will be different.
    const dir = pick ? pick.dir : { x: -want.z, z: want.x };

    const yaw = Math.atan2(dir.x, dir.z);
    input.yaw = this.face(opts.aim ? opts.aim.yaw : yaw,
      opts.aim ? opts.aim.pitch : (carrying ? -0.12 : 0), me, carrying);
    input.pitch = this.pitch;

    // Invert the actor's own wish-direction rotation to get the stick that
    // produces `dir` in world space, whatever yaw we ended up facing. Because
    // this is derived from the yaw actually being SENT, a bot mid-turn still
    // walks exactly where it meant to.
    const c = Math.cos(input.yaw), s = Math.sin(input.yaw);
    input.moveX = c * dir.x + s * dir.z;
    input.moveY = -s * dir.x + c * dir.z;

    // Sprint on the way out, never on the way back: hauling burns the same
    // stamina bar, and an exhausted contractor walks at 62%.
    if (!opts.carrying && !me.held && dist > 6 && me.stamina > 40) {
      input.buttons |= BUTTON.SPRINT;
    }

    // Hop for a step the controller cannot autostep, and hop when wedged. The
    // apex is 0.57m and autostep is 0.42m, which between them covers every
    // ledge in the building that is meant to be climbable.
    if (pick && pick.rise > STEP_UP) this.jumpUntil = Math.max(this.jumpUntil, now + 200);
    if (now - this.movedAt > STUCK_MS) {
      this.jumpUntil = Math.max(this.jumpUntil, now + 220);
      this.movedAt = now - STUCK_MS + 260;   // retry shortly, not every tick
    }
    if (now < this.jumpUntil) input.buttons |= BUTTON.JUMP;

    return input;
  }

  /**
   * The heading we want if it is safe, otherwise the nearest one that is. The
   * fan alternates left and right so a bot beside a wall slides along it
   * instead of always turning the same way into the corner.
   */
  chooseHeading(room, me, now, want) {
    const base = Math.atan2(want.x, want.z);
    if (now < this.sidestepUntil) {
      const a = base + this.sidestep * 1.0;
      const cand = { x: Math.sin(a), z: Math.cos(a) };
      const ok = this.probe(room, me, cand);
      if (ok.ok) return { dir: cand, rise: ok.rise };
      this.sidestepUntil = 0;
    }
    for (const off of [0, 0.45, -0.45, 0.95, -0.95, 1.5, -1.5, 2.2, -2.2]) {
      const a = base + off;
      const cand = { x: Math.sin(a), z: Math.cos(a) };
      const ok = this.probe(room, me, cand);
      if (!ok.ok) continue;
      if (off !== 0) {
        // Commit to a detour briefly, or the bot oscillates on the corner it is
        // trying to get round.
        this.sidestep = Math.sign(off);
        this.sidestepUntil = now + 420;
      }
      return { dir: cand, rise: ok.rise };
    }
    return null;
  }

  probe(room, me, dir) {
    const w = room.world.world;
    const filter = membership(GROUP_ACTOR, GROUP_STATIC);
    const spotX = me.pos.x + dir.x * PROBE_AHEAD;
    const spotZ = me.pos.z + dir.z * PROBE_AHEAD;

    // Anything heavy and moving is the most dangerous object in the building,
    // and it is dangerous to BYSTANDERS specifically: room.js scores a prop's
    // absolute momentum against everyone standing near it except whoever is
    // carrying it, so a mate walking past with a 132kg safe is 185kg m/s and an
    // instant knockout. Bots that give the load a wide berth stay on their feet
    // — and staying on their feet is worth more than any shortcut.
    for (const h of this.pool.hazards) {
      if (h.rec === me.held) continue;
      if (Math.abs(h.y - me.pos.y) > 2.2) continue;
      const next = Math.hypot(h.x - spotX, h.z - spotZ);
      if (next > h.keep) continue;
      // Only refuse headings that make it worse, or a bot already inside the
      // radius would find every direction blocked and stand there to be hit.
      if (next < Math.hypot(h.x - me.pos.x, h.z - me.pos.z)) return NO;
    }
    for (const other of room.actors.values()) {
      if (other === me || other.slot === this.rescueSlot) continue;
      if (Math.abs(other.pos.y - me.pos.y) > 2.2) continue;
      const keep = other.downed || other.ragdoll ? AVOID_DOWNED : AVOID_ACTOR;
      const next = Math.hypot(other.pos.x - spotX, other.pos.z - spotZ);
      if (next > keep) continue;
      if (next < Math.hypot(other.pos.x - me.pos.x, other.pos.z - me.pos.z)) return NO;
    }

    // Chest feeler: a wall, a rack upright, a railing.
    const chest = { x: me.pos.x, y: me.pos.y + FEEL_HEIGHT, z: me.pos.z };
    if (w.castRay(new RAPIER.Ray(chest, { x: dir.x, y: 0, z: dir.z }),
      FEEL_AHEAD, true, undefined, filter)) return NO;

    // Foot probe: is there still a floor a stride ahead, and is it a step or a
    // fall? Start above the tallest autostep, so a low kerb reads as ground at
    // the higher level rather than as an obstacle.
    const probe = { x: spotX, y: me.pos.y + 0.6, z: spotZ };
    const hit = w.castRay(new RAPIER.Ray(probe, { x: 0, y: -1, z: 0 }),
      0.6 + LEDGE_MAX_DROP, true, undefined, filter);
    if (!hit) return NO;
    const ground = probe.y - hit.timeOfImpact;
    const drop = me.pos.y - ground;
    if (drop > LEDGE_MAX_DROP) return NO;
    return { ok: true, rise: -drop };
  }

  aimedAt(me, x, y, z) {
    const aim = aimAt({ x: me.pos.x, y: me.pos.y + EYE_HEIGHT, z: me.pos.z }, { x, y, z });
    return { ...ZERO, seq: this.seq++, yaw: aim.yaw, pitch: aim.pitch };
  }

  idle(me) { return { ...ZERO, seq: this.seq++, yaw: me.yaw, pitch: me.pitch }; }
}

const NO = { ok: false, rise: 0 };

// =============================================================================
// the crew
// =============================================================================
/**
 * Owns the bots in one room: their slots, and the claims that stop all eight of
 * them converging on the same mug.
 */
export class BotPool {
  constructor(room) {
    this.room = room;
    this.bots = new Map();        // slot -> Bot
    this.claims = new Map();      // propId -> { slot, until }
    this.rescues = new Map();     // downed slot -> { slot, until }
    this.stands = new Map();      // lane -> where to stand at the van
    // Everything heavy and moving, rebuilt once a tick and read by every bot's
    // steering. Rebuilding it per bot per candidate heading would be forty
    // props times nine headings times eight bots, for one answer.
    this.hazards = [];
    this.hired = 0;
  }

  /** How many contractors this pool is paying for; possessed humans are not. */
  get size() {
    let n = 0;
    for (const slot of this.bots.keys()) if (this.isHire(slot)) n++;
    return n;
  }

  isHire(slot) {
    const handle = this.room.clients.get(slot);
    return !!(handle && handle.bot);
  }

  add(n = 1) {
    const added = [];
    for (let i = 0; i < n; i++) {
      if (this.room.full) break;
      const handle = { bot: true, send() {} };
      const slot = this.room.join(handle, BOT_NAMES[this.hired++ % BOT_NAMES.length]);
      if (slot === null || slot === undefined) break;
      this.bots.set(slot, new Bot(slot, this));
      added.push(slot);
    }
    return added;
  }

  remove(n = 1) {
    const gone = [];
    // Newest first, so the bot that has spent twenty seconds under a vending
    // machine is not the one that evaporates.
    for (const slot of [...this.bots.keys()].filter((s) => this.isHire(s)).sort((a, b) => b - a)) {
      if (gone.length >= n) break;
      this.drop(slot);
      this.room.leave(slot);
      gone.push(slot);
    }
    return gone;
  }

  /** Hire or fire until there are exactly n bots, room permitting. */
  fill(n) {
    const want = Math.max(0, n);
    const have = this.size;
    if (want > have) this.add(want - have);
    else if (want < have) this.remove(have - want);
    return this.size;
  }

  /** Hand a human's contractor to the bot brain: AFK cover, and solo demos. */
  possess(slot) {
    if (!this.room.actors.has(slot)) return false;
    if (!this.bots.has(slot)) this.bots.set(slot, new Bot(slot, this));
    return true;
  }

  dispossess(slot) {
    if (this.isHire(slot)) return false;   // a hire cannot be dismissed this way
    return this.drop(slot);
  }

  drop(slot) {
    for (const [id, c] of this.claims) if (c.slot === slot) this.claims.delete(id);
    for (const [id, c] of this.rescues) if (c.slot === slot) this.rescues.delete(id);
    return this.bots.delete(slot);
  }

  clear() {
    for (const slot of [...this.bots.keys()]) if (this.isHire(slot)) this.room.leave(slot);
    this.bots.clear();
    this.claims.clear();
    this.rescues.clear();
  }

  // --- claims ----------------------------------------------------------------
  mayClaim(id, slot, now) {
    const c = this.claims.get(id);
    return !c || c.slot === slot || c.until < now;
  }

  claim(id, slot, now) { this.claims.set(id, { slot, until: now + CLAIM_MS }); }

  unclaim(id, slot) {
    const c = this.claims.get(id);
    if (c && c.slot === slot) this.claims.delete(id);
  }

  claimRescue(downed, slot, now) { this.rescues.set(downed, { slot, until: now + CLAIM_MS }); }

  /** Cached per lane: it is derived from level geometry, which does not move. */
  dropStand(lane = 0) {
    let s = this.stands.get(lane);
    if (!s) { s = dropStand(this.room, lane); this.stands.set(lane, s); }
    return s;
  }

  /** Is this thing too heavy for the hands already on it? */
  needsHands(room, rec) {
    const list = room.holders.get(rec.id);
    if (!list || list.length === 0) return false;
    return rec.def.mass > liftCapacity(list.length);
  }

  /** The nearest mate on the floor that nobody else is already going to. */
  casualtyFor(room, me, bot, now) {
    let best = null;
    let bd = Infinity;
    for (const other of room.actors.values()) {
      if (other === me || !other.downed || !other.alive) continue;
      const c = this.rescues.get(other.slot);
      if (c && c.slot !== bot.slot && c.until > now) continue;
      const d = Math.hypot(other.pos.x - me.pos.x, other.pos.z - me.pos.z);
      if (d < bd) { bd = d; best = other; }
    }
    return best;
  }

  /**
   * What should this bot go and get?
   *
   * Value over distance, with a shallow denominator so a bot will cross the
   * building for a safe but not for a mug. Everything unreachable, claimed or
   * already banked is filtered out by Bot.viable.
   */
  pickTarget(room, me, bot, now) {
    let best = null;
    let bestScore = -Infinity;
    const solo = liftCapacity(1) * 1.35;
    for (const rec of room.world.props.values()) {
      if (!bot.viable(room, rec, me, now)) continue;
      // Refuse what one pair of hands cannot even start to lift. Joining a lift
      // already under way is a different question, handled by needsHands.
      if (rec.held === null && rec.def.mass > solo) continue;
      const p = rec.rb.translation();
      const d = Math.hypot(p.x - me.pos.x, p.z - me.pos.z) + Math.abs(p.y - me.pos.y) * 2;
      // Fragile stock is worth less than it says it is, because some of it will
      // arrive as pieces and pieces pay a tenth. Not a veto — a chandelier is
      // still a chandelier — just a thumb on the scale.
      const worth = (rec.def.value + 40) * (rec.def.fragile ? 0.8 : 1);
      const score = worth / (d + 7);
      if (score > bestScore) { bestScore = score; best = rec; }
    }
    return best;
  }

  /**
   * Props worth standing clear of.
   *
   * The bar is deliberately well under IMPACT_SAFE_MOMENTUM: by the time a
   * thing is over the threshold it is already swinging, and the point is to not
   * be there when it arrives.
   */
  trackHazards() {
    this.hazards.length = 0;
    for (const rec of this.room.world.props.values()) {
      if (rec.extracted || rec.rb.isSleeping()) continue;
      const v = rec.rb.linvel();
      const momentum = Math.hypot(v.x, v.y, v.z) * rec.def.mass;
      const carried = rec.held !== null;
      if (!carried && momentum < IMPACT_SAFE_MOMENTUM * 0.5) continue;
      const p = rec.rb.translation();
      this.hazards.push({ rec, x: p.x, y: p.y, z: p.z, keep: rec.radius + 1.6 });
    }
  }

  // --- the tick --------------------------------------------------------------
  /**
   * Every bot writes one input packet. This is the only thing this file does to
   * a room, and it is the same thing an inbound websocket frame does.
   */
  think(now) {
    this.trackHazards();
    for (const [slot, bot] of this.bots) {
      const actor = this.room.actors.get(slot);
      if (!actor) { this.drop(slot); continue; }
      const input = bot.think(this.room, actor, now);
      actor.pendingInput = input;
      // Echoed straight back in the snapshot, exactly as for a human, so a
      // spectating client can watch a bot's inputs being consumed.
      actor.lastInputSeq = input.seq;
    }
  }
}

// =============================================================================
// the level, read as navigation
// =============================================================================
/**
 * Coarse waypoints between the floor and the loading dock.
 *
 * Read from the level's own tags rather than from coordinates typed in here: a
 * brush tagged `ramp` is the way onto a brush tagged `dock`. A level with
 * neither gets an empty route, which is right for a job on flat ground.
 */
function planRoute(room, me, targetY, lane = 0) {
  const level = room.level;
  const dock = level.brushes.find((b) => b.tag === 'dock');
  const ramp = level.brushes.find((b) => b.tag === 'ramp');
  if (!dock || !ramp) return [];

  const deck = dock.p[1] + dock.s[1] / 2;
  const meUp = me.pos.y > deck - 0.6;
  const toUp = targetY > deck - 0.6;
  if (meUp === toUp) return [];

  // The approach side is whichever way the ramp sticks out from the dock.
  const ax = ramp.p[0] - dock.p[0];
  const az = ramp.p[2] - dock.p[2];
  const alen = Math.hypot(ax, az) || 1;
  const ux = ax / alen, uz = az / alen;
  const reach = Math.max(ramp.s[0], ramp.s[2]) / 2 + 1.7;
  // Sideways along the ramp, so each contractor has their own line up it.
  const px = -uz * lane, pz = ux * lane;
  const back = dock.s[2] / 2 - 1.0;

  const approach = { x: ramp.p[0] + ux * reach + px, z: ramp.p[2] + uz * reach + pz, r: 1.2 };
  const onRamp = { x: ramp.p[0] + px, z: ramp.p[2] + pz, r: 0.9 };
  const onDock = { x: dock.p[0] + ux * back + px, z: dock.p[2] + uz * back + pz, r: 1.4 };
  return toUp ? [approach, onRamp, onDock] : [onDock, onRamp, approach];
}

/**
 * Where to stand to post something into the van, and where to hold it.
 *
 * Standing beside the volume rather than in it matters: a contractor stood in
 * the van is a contractor who kicks the takings back out onto the dock while
 * they settle, and room.js only pays for things that have stopped moving.
 */
function dropStand(room, lane = 0) {
  const e = room.level.extract;
  const dock = room.level.brushes.find((b) => b.tag === 'dock');
  const ramp = room.level.brushes.find((b) => b.tag === 'ramp');
  const deck = dock ? dock.p[1] + dock.s[1] / 2 : e.p[1] - e.s[1] / 2;

  let ux = 0, uz = -1;
  if (dock && ramp) {
    const ax = ramp.p[0] - dock.p[0], az = ramp.p[2] - dock.p[2];
    const alen = Math.hypot(ax, az) || 1;
    ux = ax / alen; uz = az / alen;
  }
  // Spread the drop points across the width of the van, both so two bots do
  // not stand in each other and so the load does not land on the last one.
  const lim = Math.max(0, e.s[0] / 2 - 1.2);
  const off = clamp(lane * 1.5, -lim, lim);
  const px = -uz * off, pz = ux * off;
  const back = e.s[2] / 2 + 0.5;
  return {
    x: e.p[0] + ux * back + px,
    y: deck,
    z: e.p[2] + uz * back + pz,
    aim: { x: e.p[0] + px, y: e.p[1] - e.s[1] / 2 + 0.55, z: e.p[2] + pz },
  };
}

function insideExtract(e, p, margin = 0) {
  return Math.abs(p.x - e.p[0]) < e.s[0] / 2 - margin
    && Math.abs(p.y - e.p[1]) < e.s[1] / 2 - margin
    && Math.abs(p.z - e.p[2]) < e.s[2] / 2 - margin;
}

/** Yaw and pitch that put lookDir() on a point. */
function aimAt(eye, p) {
  const dx = p.x - eye.x, dy = p.y - eye.y, dz = p.z - eye.z;
  return {
    yaw: Math.atan2(dx, dz),
    pitch: clamp(Math.atan2(dy, Math.max(1e-4, Math.hypot(dx, dz))), -1.5, 1.5),
  };
}

function wrapAngle(a) {
  const t = (a + Math.PI) % (Math.PI * 2);
  return (t < 0 ? t + Math.PI * 2 : t) - Math.PI;
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

const BOT_NAMES = [
  'DEREK', 'SHAZ', 'BIG KEV', 'MO', 'TRACEY', 'GAZ', 'NEV', 'PAULINE',
];
