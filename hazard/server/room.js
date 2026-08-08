// HAZARD PAY — a job in progress.
//
// One room owns one physics world, its contractors, its tasks and its clock.
// The server simulates at 60Hz and ships a snapshot at 20Hz; clients render the
// past and predict only their own capsule, so nothing they do can disagree with
// this file about where anything is.

import RAPIER from '@dimforge/rapier3d-compat';
import { World, initPhysics, membership, GROUPS } from './world.js';
import { Actor } from './actor.js';
import { tryGrab, release, stepGrabs, pickTarget } from './grab.js';
import { LEVEL_BY_ID, DEFAULT_LEVEL, validateLevel } from '../shared/levels/index.js';
import { Writer, MSG, PFLAG, OFLAG } from '../shared/protocol.js';
import {
  TICK_MS, TICK_DT, PHASE, MAX_PLAYERS, BUTTON, BRIEFING_MS, DEBRIEF_MS,
  EXTRACT_DWELL_MS, IMPACT_SAFE_MOMENTUM, IMPACT_DAMAGE_PER_NS,
  REVIVE_RADIUS, REVIVE_SECONDS, DOWNED_BLEEDOUT_MS, HEALTH_MAX,
} from '../shared/tune.js';

export class Room {
  constructor(code, levelId = DEFAULT_LEVEL) {
    this.code = code;
    this.level = LEVEL_BY_ID[levelId] || LEVEL_BY_ID[DEFAULT_LEVEL];
    const errs = validateLevel(this.level);
    if (errs.length) throw new Error(`level ${this.level.id}: ${errs.join('; ')}`);

    this.world = new World(this.level);
    this.actors = new Map();       // slot -> Actor
    this.clients = new Map();      // slot -> client handle
    this.holders = new Map();      // propId -> [Actor]
    this.freeSlots = Array.from({ length: MAX_PLAYERS }, (_, i) => i).reverse();

    this.phase = PHASE.LOBBY;
    this.tick = 0;
    this.startedAt = 0;
    this.phaseEndsAt = 0;
    this.lastActivity = Date.now();

    this.banked = 0;
    this.breakages = 0;
    this.extractedKinds = new Map();
    this.intactKinds = new Map();
    this.events = [];              // gameplay events for the wire
    this.taskState = this.level.tasks.map((t) => ({ id: t.id, done: false, progress: 0 }));

    this.hitScratch = { a: null, b: null };
  }

  static async create(code, levelId) {
    await initPhysics();
    return new Room(code, levelId);
  }

  get playerCount() { return this.actors.size; }
  get full() { return this.actors.size >= MAX_PLAYERS; }

  // --- membership -----------------------------------------------------------
  join(client, name) {
    if (this.full) return null;
    const slot = this.freeSlots.pop();
    const actor = new Actor(this.world, slot, this.spawnFor(slot), this.level.spawnYaw || 0);
    actor.name = (name || `CONTRACTOR ${slot + 1}`).slice(0, 14).toUpperCase();
    this.actors.set(slot, actor);
    this.clients.set(slot, client);
    this.lastActivity = Date.now();
    this.emit('join', { slot, name: actor.name });
    return slot;
  }

  leave(slot) {
    const actor = this.actors.get(slot);
    if (!actor) return;
    release(actor, this.holders, false);
    actor.destroy();
    this.actors.delete(slot);
    this.clients.delete(slot);
    this.freeSlots.push(slot);
    this.emit('leave', { slot });
  }

  /**
   * A spot on the spawn ring that actually has a floor under it.
   *
   * Levels are hand-authored data, and the ring is generated, so it is entirely
   * possible to place the eighth contractor inside a wall or past the edge of
   * the world — where there is no floor at all and they fall for ever. Cast
   * down before committing, and fall back to the author's own point, which is
   * the one spot they definitely checked.
   */
  spawnFor(slot) {
    const base = this.level.spawn;
    const spread = this.level.spawnSpread || 1.8;
    const a = (slot / MAX_PLAYERS) * Math.PI * 2;
    const cand = [
      base[0] + Math.cos(a) * spread,
      base[1],
      base[2] + Math.sin(a) * spread,
    ];
    return this.groundUnder(cand) ? cand : [...base];
  }

  groundUnder(p) {
    const ray = new RAPIER.Ray({ x: p[0], y: p[1] + 0.4, z: p[2] }, { x: 0, y: -1, z: 0 });
    const hit = this.world.world.castRay(ray, 6, true, undefined,
      membership(GROUPS.GROUP_ACTOR, GROUPS.GROUP_STATIC));
    return !!hit;
  }

  emit(type, detail) { this.events.push({ type, detail }); }

  drainEvents() { const e = this.events; this.events = []; return e; }

  // --- flow -----------------------------------------------------------------
  begin(now) {
    this.phase = PHASE.BRIEFING;
    this.phaseEndsAt = now + BRIEFING_MS;
    this.emit('phase', { phase: this.phase });
  }

  startJob(now) {
    this.phase = PHASE.ACTIVE;
    this.startedAt = now;
    this.phaseEndsAt = now + this.level.timeLimit * 1000;
    this.emit('phase', { phase: this.phase });
  }

  endJob(now, reason) {
    this.phase = PHASE.DEBRIEF;
    this.phaseEndsAt = now + DEBRIEF_MS;
    this.emit('phase', { phase: this.phase, reason });
    this.emit('results', this.results(reason));
  }

  // --- the tick -------------------------------------------------------------
  step(now) {
    if (this.phase === PHASE.BRIEFING && now >= this.phaseEndsAt) this.startJob(now);
    else if (this.phase === PHASE.ACTIVE && now >= this.phaseEndsAt) this.endJob(now, 'timeout');

    const active = this.phase === PHASE.ACTIVE || this.phase === PHASE.BRIEFING;

    for (const actor of this.actors.values()) {
      const input = actor.pendingInput || ZERO_INPUT;
      actor.applyView(input);
      if (active) this.handleButtons(actor, input, now);
      actor.step(active ? input : ZERO_INPUT, now);
    }

    if (active) stepGrabs(this.world, this.holders, this.actors);

    this.world.step();
    this.drainContacts(now);

    if (this.phase === PHASE.ACTIVE) {
      this.checkExtraction(now);
      this.checkDowned(now);
      this.checkTasks(now);
    }

    this.tick++;
  }

  handleButtons(actor, input, now) {
    if (actor.ragdoll) { actor.grabLatch = false; return; }

    const wantGrab = (input.buttons & BUTTON.GRAB) !== 0;
    if (wantGrab && !actor.grabLatch) {
      if (actor.held) release(actor, this.holders, false);
      else tryGrab(this.world, actor, this.holders);
    }
    actor.grabLatch = wantGrab;

    const wantThrow = (input.buttons & BUTTON.THROW) !== 0;
    if (wantThrow && !actor.throwLatch && actor.held) {
      release(actor, this.holders, true);
      this.emit('throw', { slot: actor.slot });
    }
    actor.throwLatch = wantThrow;

    if (actor.held) {
      if (input.buttons & BUTTON.PULL) actor.holdDist = Math.max(1.0, actor.holdDist - 2.4 * TICK_DT);
      if (input.buttons & BUTTON.PUSH) actor.holdDist = Math.min(3.2, actor.holdDist + 2.4 * TICK_DT);
    }

    // Looking at a downed friend and holding USE revives them.
    if (input.buttons & BUTTON.USE) this.tryRevive(actor, now);
    else actor.reviving = null;

    void pickTarget;
  }

  tryRevive(actor, now) {
    let best = null, bd = REVIVE_RADIUS;
    for (const other of this.actors.values()) {
      if (other === actor || !other.downed) continue;
      const d = Math.hypot(other.pos.x - actor.pos.x, other.pos.y - actor.pos.y, other.pos.z - actor.pos.z);
      if (d < bd) { bd = d; best = other; }
    }
    if (!best) { actor.reviving = null; return; }
    if (actor.reviving !== best.slot) { actor.reviving = best.slot; actor.reviveStart = now; }
    if (now - actor.reviveStart >= REVIVE_SECONDS * 1000) {
      best.downed = false;
      best.ragdollUntil = now;
      best.health = HEALTH_MAX * 0.4;
      actor.reviving = null;
      this.emit('revive', { by: actor.slot, slot: best.slot });
    }
  }

  /**
   * Contact force events are where the comedy is scored: a crate that hits a
   * contractor at speed hurts them, and a fragile thing that hits anything at
   * speed stops being a thing.
   */
  drainContacts(now) {
    // Nothing can break before the job starts. A level's props are authored a
    // little above their resting place and drop into it on load, and gravity
    // here is -22 — a 25cm settle is already 3.3m/s, which is enough to shatter
    // a mug. Without this gate a warehouse fails its own "don't break anything"
    // task during the briefing, before a single contractor has moved.
    const scoring = this.phase === PHASE.ACTIVE;

    this.world.events.drainContactForceEvents((ev) => {
      if (!scoring) return;
      const a = this.world.propByCollider(ev.collider1());
      const b = this.world.propByCollider(ev.collider2());

      for (const rec of [a, b]) {
        if (!rec || !rec.def.fragile || rec.broken || rec.extracted) continue;
        // The event says it hit something; the velocity it lost this tick says
        // how hard. Requiring both means a thrown mug survives leaving your
        // hand (an impulse, no contact) and shatters when it lands (both).
        if (rec.dv <= rec.def.fragile) continue;
        this.world.breakProp(rec);
        this.breakages++;
        const p = rec.rb.translation();
        this.emit('break', { id: rec.id, kind: rec.kind, p: [p.x, p.y, p.z], value: rec.def.value });
      }
    });

    // Props hitting people. Rapier reports actor colliders too, but the actor
    // is kinematic so no force event fires for it; instead check proximity of
    // fast heavy props to each contractor, which is cheap at our counts.
    for (const rec of this.world.props.values()) {
      if (rec.rb.isSleeping() || rec.extracted) continue;
      const v = rec.rb.linvel();
      const speed = Math.hypot(v.x, v.y, v.z);
      const momentum = speed * rec.def.mass;
      if (momentum < IMPACT_SAFE_MOMENTUM) continue;
      const p = rec.rb.translation();
      for (const actor of this.actors.values()) {
        if (!actor.alive || actor.held === rec) continue;
        const dx = p.x - actor.pos.x, dz = p.z - actor.pos.z;
        const dy = p.y - (actor.pos.y + 0.9);
        const reach = rec.radius + 0.5;
        if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
        if (now - (actor.lastHitAt || 0) < 400) continue;
        actor.lastHitAt = now;
        actor.damage((momentum - IMPACT_SAFE_MOMENTUM) * IMPACT_DAMAGE_PER_NS, now, 'impact');
        this.emit('hit', { slot: actor.slot, id: rec.id, force: momentum });
      }
    }
  }

  /** A prop counts when it has come to rest inside the van and stayed there. */
  checkExtraction(now) {
    const e = this.level.extract;
    const [ex, ey, ez] = e.p;
    const [sx, sy, sz] = e.s;
    for (const rec of this.world.props.values()) {
      if (rec.extracted) continue;
      const p = rec.rb.translation();
      const inside = Math.abs(p.x - ex) < sx / 2
        && Math.abs(p.y - ey) < sy / 2
        && Math.abs(p.z - ez) < sz / 2;
      if (!inside || rec.held !== null || !this.world.isResting(rec)) {
        rec.restingSince = 0;
        continue;
      }
      if (!rec.restingSince) { rec.restingSince = now; continue; }
      if (now - rec.restingSince < EXTRACT_DWELL_MS) continue;

      rec.extracted = true;
      rec.dirty = true;
      const paid = rec.broken ? Math.round(rec.def.value * 0.1) : rec.def.value;
      this.banked += paid;
      this.extractedKinds.set(rec.kind, (this.extractedKinds.get(rec.kind) || 0) + 1);
      if (!rec.broken) {
        this.intactKinds.set(rec.kind, (this.intactKinds.get(rec.kind) || 0) + 1);
      }
      this.emit('extract', { id: rec.id, kind: rec.kind, value: paid, broken: rec.broken });
    }
  }

  checkDowned(now) {
    let anyUp = false;
    for (const actor of this.actors.values()) {
      if (actor.downed) {
        if (!actor.downedAt) actor.downedAt = now;
        if (now - actor.downedAt > DOWNED_BLEEDOUT_MS) { actor.alive = false; }
      } else {
        actor.downedAt = 0;
        if (actor.alive) anyUp = true;
      }
    }
    if (this.actors.size > 0 && !anyUp) this.endJob(now, 'wipe');
  }

  checkTasks(now) {
    let allDone = true;
    this.level.tasks.forEach((t, i) => {
      const st = this.taskState[i];
      if (t.type === 'extract_value') {
        st.progress = Math.min(1, this.banked / t.target);
        st.done = this.banked >= t.target;
      } else if (t.type === 'no_breakages') {
        st.progress = Math.min(1, this.breakages / (t.limit + 1));
        st.done = this.breakages <= t.limit;
      } else if (t.type === 'extract_kind') {
        // `intact` matters: without it "deliver the piano" is satisfied by
        // delivering the wreckage of a piano, which is not the same job.
        const n = (t.intact ? this.intactKinds : this.extractedKinds).get(t.kind) || 0;
        st.progress = Math.min(1, n / t.count);
        st.done = n >= t.count;
      }
      // Only the required tasks gate the job; bonuses are just money.
      if (!t.bonus && !st.done) allDone = false;
    });
    if (allDone && this.phase === PHASE.ACTIVE) this.endJob(now, 'complete');
  }

  results(reason) {
    let bonus = 0;
    const lines = [];
    this.level.tasks.forEach((t, i) => {
      const st = this.taskState[i];
      if (t.bonus && st.done) { bonus += t.bonus; lines.push({ title: t.title, paid: t.bonus }); }
    });
    return {
      reason,
      banked: this.banked,
      bonus,
      total: this.banked + bonus,
      quota: this.level.quota,
      met: this.banked >= this.level.quota,
      breakages: this.breakages,
      bonuses: lines,
      seconds: Math.round((Date.now() - this.startedAt) / 1000),
    };
  }

  // --- the wire -------------------------------------------------------------
  snapshot(now) {
    const w = new Writer(4096);
    w.u8w(MSG.SNAPSHOT);
    w.u32w(this.tick);
    w.u32w(now >>> 0);
    w.u8w(this.phase);

    w.u8w(this.actors.size);
    for (const a of this.actors.values()) {
      w.u8w(a.slot);
      let f = 0;
      if (a.alive) f |= PFLAG.ALIVE;
      if (a.ragdoll) f |= PFLAG.RAGDOLL;
      if (a.downed) f |= PFLAG.DOWNED;
      if (a.grounded) f |= PFLAG.GROUNDED;
      if (a.sprinting) f |= PFLAG.SPRINT;
      if (a.crouched) f |= PFLAG.CROUCH;
      if (a.held) f |= PFLAG.HAULING;
      w.u8w(f);
      w.posw(a.pos.x, a.pos.y, a.pos.z);
      w.angw(a.yaw);
      w.angw(a.pitch);
      w.u8w(Math.round(a.health));
      w.u8w(Math.round(a.stamina));
      w.u16w(a.held ? a.held.id : 0);
      w.u32w(a.lastInputSeq >>> 0);
    }

    // Ragdoll bones, only for the people currently being furniture.
    let boneCount = 0;
    for (const a of this.actors.values()) if (a.ragdoll) boneCount += a.ragdoll.bodies.length;
    w.u16w(boneCount);
    for (const a of this.actors.values()) {
      if (!a.ragdoll) continue;
      for (let i = 0; i < a.ragdoll.bodies.length; i++) {
        const b = a.ragdoll.bodies[i];
        const p = b.translation(), q = b.rotation();
        w.u8w(a.slot); w.u8w(i);
        w.posw(p.x, p.y, p.z);
        w.quatw(q.x, q.y, q.z, q.w);
      }
    }

    // Props: only what moved, plus anything that just came to rest.
    const dirty = [];
    for (const rec of this.world.dirtyProps()) dirty.push(rec);
    w.u16w(dirty.length);
    for (const rec of dirty) {
      const p = rec.rb.translation(), q = rec.rb.rotation();
      w.u16w(rec.id);
      let f = 0;
      if (rec.asleep) f |= OFLAG.ASLEEP;
      if (rec.held !== null) f |= OFLAG.HELD;
      if (rec.broken) f |= OFLAG.BROKEN;
      if (rec.extracted) f |= OFLAG.EXTRACTED;
      w.u8w(f);
      w.posw(p.x, p.y, p.z);
      w.quatw(q.x, q.y, q.z, q.w);
    }
    this.world.clearDirty();
    return w.bytes();
  }

  destroy() {
    for (const a of this.actors.values()) a.destroy();
    this.world.destroy();
  }
}

const ZERO_INPUT = {
  seq: 0, moveX: 0, moveY: 0, yaw: 0, pitch: 0, buttons: 0, holdDist: 1.85,
};

export { TICK_MS };
