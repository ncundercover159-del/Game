// HAZARD PAY — a job in progress.
//
// One room owns one physics world, its contractors, its tasks and its clock.
// The server simulates at 60Hz and ships a snapshot at 20Hz; clients render the
// past and predict only their own capsule, so nothing they do can disagree with
// this file about where anything is.

import RAPIER from '@dimforge/rapier3d-compat';
import { World, initPhysics, membership, GROUPS } from './world.js';
import { Actor } from './actor.js';
import { tryGrab, release, stepGrabs, pickTarget, lookDir } from './grab.js';
import { LEVEL_BY_ID, DEFAULT_LEVEL, validateLevel } from '../shared/levels/index.js';
import { Writer, MSG, PFLAG, OFLAG, NO_WATER } from '../shared/protocol.js';
import {
  TICK_MS, TICK_DT, PHASE, MAX_PLAYERS, BUTTON, BRIEFING_MS, DEBRIEF_MS,
  EXTRACT_DWELL_MS, IMPACT_SAFE_MOMENTUM, IMPACT_DAMAGE_PER_NS,
  REVIVE_RADIUS, REVIVE_SECONDS, DOWNED_BLEEDOUT_MS, HEALTH_MAX,
  VALVE_REACH, VALVE_TURN_MS, FLOOD_WRITEOFF_MS, DROWN_DAMAGE_PER_S,
  POS_SCALE,
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

    this.buildValves();
    this.buildFlood();
  }

  /**
   * The valves a level declares, indexed for the USE raycast.
   *
   * `level.sequence` is the authoritative copy; the brushes carry the same ids
   * so the geometry can be found without a second table to keep in step. If a
   * declared valve has no brush behind it there is nothing to look at and the
   * job cannot be finished, so say so loudly at construction rather than
   * quietly at minute four.
   */
  buildValves() {
    this.valves = new Map();
    this.valveOrder = [];
    this.sequenceClean = true;
    const seq = this.level.sequence;
    if (!seq || !Array.isArray(seq.valves)) return;
    for (const def of seq.valves) {
      const brush = this.level.brushes.find((b) => b.valve === def.id);
      if (!brush) throw new Error(`level ${this.level.id}: valve ${def.id} has no brush`);
      this.valves.set(def.id, { id: def.id, def, brush, shut: false, penalised: false });
    }
  }

  /**
   * Rising water, if this level has any.
   *
   * `reaches` is a piecewise-linear curve through absolute heights keyed on
   * seconds since the job went ACTIVE — not depths below the deck, because a
   * depth is only meaningful next to the surface it was measured from and this
   * plant has four of them.
   *
   * Zones are the one wrinkle. A tank whose valve was skipped fills early and
   * independently, so water height is a function of position, not a scalar.
   * Precompute the rectangles: this is read once per prop per tick and
   * Object.entries in that loop is a hundred allocations a frame for nothing.
   */
  buildFlood() {
    const f = this.level.flood;
    this.floodY = f ? f.start : null;
    this.floodBonus = new Map();      // zone name -> extra metres
    this.floodZones = [];
    if (!f || !f.zones) return;
    for (const [name, z] of Object.entries(f.zones)) {
      this.floodZones.push({
        name, x0: z.x[0], x1: z.x[1], z0: z.z[0], z1: z.z[1],
        rim: Number.isFinite(z.rim) ? z.rim : Infinity,
      });
    }
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
      this.stepFlood(now);
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

    // One button, two jobs. A downed contractor beats plumbing every time: if
    // you are stood over a friend with your hand out, you meant the friend, and
    // the valve behind them can wait the three seconds.
    if (input.buttons & BUTTON.USE) {
      if (!this.tryRevive(actor, now)) this.tryValve(actor, now);
      else { actor.turning = null; actor.turnProgress = 0; }
    } else {
      actor.reviving = null;
      actor.turning = null;
      actor.turnProgress = 0;
    }

    void pickTarget;
  }

  /** @returns {boolean} whether there was anybody to pick up. */
  tryRevive(actor, now) {
    let best = null, bd = REVIVE_RADIUS;
    for (const other of this.actors.values()) {
      if (other === actor || !other.downed) continue;
      const d = Math.hypot(other.pos.x - actor.pos.x, other.pos.y - actor.pos.y, other.pos.z - actor.pos.z);
      if (d < bd) { bd = d; best = other; }
    }
    if (!best) { actor.reviving = null; return false; }
    if (actor.reviving !== best.slot) { actor.reviving = best.slot; actor.reviveStart = now; }
    if (now - actor.reviveStart >= REVIVE_SECONDS * 1000) {
      best.downed = false;
      best.ragdollUntil = now;
      best.health = HEALTH_MAX * 0.4;
      actor.reviving = null;
      this.emit('revive', { by: actor.slot, slot: best.slot });
    }
    return true;
  }

  /** The static brush this contractor is pointing at, within `reach`. */
  lookedAtBrush(actor, reach) {
    if (!actor.alive || actor.ragdoll) return null;
    const d = lookDir(actor);
    const ray = new RAPIER.Ray({ x: actor.pos.x, y: actor.eye, z: actor.pos.z }, d);
    const hit = this.world.world.castRay(ray, reach, true, undefined,
      membership(GROUPS.GROUP_ACTOR, GROUPS.GROUP_STATIC));
    return hit ? this.world.brushByCollider(hit.collider.handle) : null;
  }

  /**
   * Hold USE on a wheel and it turns. Turning one out of order does not fail
   * the sequence — it floods the tank you skipped, which is a worse punishment
   * and a funnier one. A hard fail on a mis-press is miserable in a game where
   * the person who pressed it is usually not the person who has to swim.
   */
  tryValve(actor, now) {
    if (!this.valves.size) { actor.turning = null; return; }
    const brush = this.lookedAtBrush(actor, VALVE_REACH);
    const v = brush && brush.valve ? this.valves.get(brush.valve) : null;
    if (!v || v.shut) { actor.turning = null; actor.turnProgress = 0; return; }

    if (actor.turning !== v.id) { actor.turning = v.id; actor.turnStart = now; }
    actor.turnProgress = Math.min(1, (now - actor.turnStart) / VALVE_TURN_MS);
    if (actor.turnProgress < 1) return;

    actor.turning = null;
    actor.turnProgress = 0;
    v.shut = true;
    v.shutAt = now;
    this.valveOrder.push(v.id);

    // Anything below this one still open was skipped by definition.
    const skipped = [];
    for (const other of this.valves.values()) {
      if (other.shut || other.penalised || other.def.order >= v.def.order) continue;
      skipped.push(other.id);
      this.floodPenalty(other);
    }
    this.emit('valve', {
      id: v.id, order: v.def.order, label: v.def.label, by: actor.slot,
      shut: this.valveOrder.length, total: this.valves.size, skipped,
    });
  }

  /** Skipping a valve fills the tank it was holding back. */
  floodPenalty(v) {
    v.penalised = true;
    this.sequenceClean = false;
    const pen = this.level.sequence.penalty;
    const zone = v.def.floods;
    if (!pen || pen.kind !== 'flood_zone' || !zone
        || !this.floodZones.some((z) => z.name === zone)) {
      // A level may declare an order without declaring geometry for it. Say so
      // rather than silently doing nothing, because "the penalty did not fire"
      // and "the penalty is unwired" look identical from inside the game.
      this.emit('penalty', { valve: v.id, zone: zone || null, metres: 0 });
      return;
    }
    this.floodBonus.set(zone, (this.floodBonus.get(zone) || 0) + pen.metres);
    this.emit('penalty', { valve: v.id, zone, metres: pen.metres });
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

  // --- water ------------------------------------------------------------------
  /** Where the surface is at time `now`, following the level's curve. */
  floodHeight(now) {
    const f = this.level.flood;
    if (!f) return null;
    const t = (now - this.startedAt) / 1000;
    let py = f.start;
    let pt = f.startsAt || 0;
    if (t <= pt) return py;
    for (const r of (f.reaches || [])) {
      if (t < r.at) return py + (r.y - py) * ((t - pt) / Math.max(1e-6, r.at - pt));
      py = r.y; pt = r.at;
    }
    return Number.isFinite(f.end) ? f.end : py;
  }

  /**
   * Water height at a point. Flat everywhere except inside a penalised tank,
   * which fills to its own rim and stops — without the rim clamp, skipping the
   * intake valve puts the filter bed's surface two metres above a deck that is
   * still bone dry, which reads as a bug rather than as a punishment.
   */
  waterAt(x, z) {
    if (this.floodY === null) return -Infinity;
    for (const zn of this.floodZones) {
      if (x < zn.x0 || x > zn.x1 || z < zn.z0 || z > zn.z1) continue;
      const bonus = this.floodBonus.get(zn.name) || 0;
      return bonus ? Math.min(zn.rim, this.floodY + bonus) : this.floodY;
    }
    return this.floodY;
  }

  /** Every zone's surface, in declaration order, for the wire. */
  zoneHeights() {
    return this.floodZones.map((zn) => {
      const bonus = this.floodBonus.get(zn.name) || 0;
      return bonus ? Math.min(zn.rim, this.floodY + bonus) : this.floodY;
    });
  }

  /**
   * What the water does to everything in it.
   *
   * Deliberately not buoyancy. A floating piano is funny exactly once and wrong
   * for ever after, and it would also make the sump trivially solvable by
   * waiting. Water here is a deadline with a body count: it writes off stock
   * that goes under and it drowns anyone who stays under with it.
   */
  stepFlood(now) {
    if (this.floodY === null) return;
    this.floodY = this.floodHeight(now);

    for (const rec of this.world.props.values()) {
      if (rec.extracted || rec.flooded) continue;
      const p = rec.rb.translation();
      if (p.y >= this.waterAt(p.x, p.z)) { rec.sunkSince = 0; continue; }
      if (!rec.sunkSince) { rec.sunkSince = now; continue; }
      if (now - rec.sunkSince < FLOOD_WRITEOFF_MS) continue;
      rec.flooded = true;
      rec.dirty = true;
      this.emit('sunk', { id: rec.id, kind: rec.kind, value: rec.def.value });
    }

    for (const actor of this.actors.values()) {
      if (!actor.alive) { actor.waterY = -Infinity; continue; }
      const w = this.waterAt(actor.pos.x, actor.pos.z);
      actor.waterY = w;
      // Ragdolled, the pelvis is the reference and the head is roughly half a
      // metre above it — face down in six inches of water still counts, which
      // is the correct amount of cruelty for a game about falling over.
      const head = actor.ragdoll ? actor.pos.y + 0.5 : actor.eye;
      if (head < w) actor.damage(DROWN_DAMAGE_PER_S * TICK_DT, now, 'drown');
    }
  }

  /** A prop counts when it has come to rest inside the van and stayed there. */
  checkExtraction(now) {
    const e = this.level.extract;
    const [ex, ey, ez] = e.p;
    const [sx, sy, sz] = e.s;
    for (const rec of this.world.props.values()) {
      // Written off is written off. Fishing a flooded safe out and driving it
      // away would be the obvious exploit, and it is also just not how a loss
      // adjuster works.
      if (rec.extracted || rec.flooded) continue;
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
      // Paid for means out of the way. See World.retireProp — leaving the
      // collider up turns the van into a wall after four deliveries.
      this.world.retireProp(rec);
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
      } else if (t.type === 'operate_in_order') {
        // Done is "all of them shut", not "all of them shut in order". Order is
        // scored in water, not in ticks: a required task that a mis-press can
        // permanently fail is a required task that ends the job at minute one.
        const total = this.valves.size;
        const shut = this.valveOrder.length;
        st.progress = total ? shut / total : 1;
        st.done = total > 0 && shut >= total;
        st.clean = this.sequenceClean;
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

    // Water. Three bytes plus two per zone, sent every snapshot rather than on
    // change, because the surface is moving continuously and a client that
    // missed the one packet saying so would render a dry sump for ever.
    if (this.floodY === null) w.i16w(NO_WATER);
    else w.i16w(clampWater(this.floodY));
    w.u8w(this.valveMask());
    const zones = this.floodY === null ? [] : this.zoneHeights();
    w.u8w(zones.length);
    for (const y of zones) w.i16w(clampWater(y));

    this.world.clearDirty();
    return w.bytes();
  }

  /** One bit per declared valve, in declaration order. Eight is the ceiling. */
  valveMask() {
    let m = 0, i = 0;
    for (const v of this.valves.values()) { if (v.shut) m |= (1 << i); i++; }
    return m;
  }

  destroy() {
    for (const a of this.actors.values()) a.destroy();
    this.world.destroy();
  }
}

// Water shares the position quantiser, so it inherits its range. A surface
// clamped rather than wrapped is merely wrong; a wrapped one is 327 metres of
// wrong in the opposite direction.
function clampWater(y) {
  const v = Math.round(y * POS_SCALE);
  return Math.max(NO_WATER + 1, Math.min(32767, v));
}

const ZERO_INPUT = {
  seq: 0, moveX: 0, moveY: 0, yaw: 0, pitch: 0, buttons: 0, holdDist: 1.85,
};

export { TICK_MS };
