// NetSession: online counterpart of LocalSession. The server is authoritative;
// the client predicts only its own kart (shared physics) and reconciles on
// every snapshot (rewind to the acknowledged input, replay the rest). Remote
// karts are interpolated ~100 ms in the past. Items are server state.
import { SIM, CLASSES, RACE } from '@shared/config.js';
import { createKart, stepKart } from '@shared/physics/kart.js';
import { totalStats, statsToPhysics } from '@shared/physics/stats.js';
import { quantizeInput, emptyInput } from '@shared/physics/input.js';
import { createWorld } from '@shared/track/world.js';
import { getTrackDef, getRacer, getVehicle, getWheels, getGlider } from '@shared/data/registry.js';
import { KART_FULL, KART_VIEW, decodeKart, decodeProjectile, decodeHazard, decodeEffect, decodeLoose, PREDICTED_EVENTS } from '@shared/net/protocol.js';
import { initKartItems } from '@shared/sim/items.js';
import { lerp, wrapAngle } from '@shared/math.js';
import '@shared/track/track.js';

const INTERP_TICKS = Math.round(SIM.interpDelay * SIM.hz);

export class NetSession {
  constructor(client, start) {
    this.client = client;
    this.isOnline = true;
    this.start = start;
    this.def = getTrackDef(start.trackId);
    this.world = createWorld(this.def, { mirror: start.mirror });
    this.localId = start.spectator ? null : start.you;
    this.spectator = !!start.spectator;
    this.introTime = 3;
    this.cls = CLASSES[start.classId] || CLASSES['150cc'];
    this.paused = false;
    this.acc = 0;
    this.seq = 0;
    this.history = [];
    this.outbox = [];
    this.snapshots = [];
    this.serverTick = start.tick || 0;
    this.clockBase = null;
    this.visOffset = { x: 0, y: 0, z: 0 };
    this.prevLocal = null;
    this.inputFn = null;
    this.onEvents = null;
    this.pings = {};
    this.lastSnapAt = performance.now();
    // items state mirrored from snapshots
    const pl = this.world.placements || { itemBoxes: [], coins: [] };
    this.items = {
      boxes: pl.itemBoxes.map((p, i) => ({ id: i, x: p.x, y: p.y, z: p.z, active: true })),
      coins: pl.coins.map((p, i) => ({ id: i, x: p.x, y: p.y, z: p.z, active: true })),
      projectiles: [], hazards: [], effects: [], loose: [],
      treasure: pl.treasure ? { ...pl.treasure, takenLocal: false } : null,
    };
    const spawns = this.world.gridSpawns ? this.world.gridSpawns(start.entrants.length) : [];
    this.karts = start.entrants.map((e, i) => {
      const racer = getRacer(e.racerId);
      const stats = totalStats(racer, getVehicle(e.vehicleId), getWheels(e.wheelsId), getGlider(e.gliderId));
      const sp = spawns[i] || { x: 0, y: 0, z: 0, yaw: 0 };
      const k = createKart(e.id, { x: sp.x, y: sp.y, z: sp.z, yaw: sp.yaw, phys: statsToPhysics(stats), classMul: this.cls.speedMul });
      k.hint = sp.hint ?? -1;
      k.entrant = e; k.racerId = racer.id; k.element = racer.element; k.name = e.name; k.human = e.human;
      k.place = i + 1; k.lap = 0; k.raceDist = 0; k.finished = false; k.finishTime = 0; k.lapTimes = [];
      initKartItems(k);
      return k;
    });
    this.byId = new Map(this.karts.map((k) => [k.id, k]));
    this.views = new Map(this.karts.map((k) => [k.id, { ...k }]));
    const self = this;
    this.race = {
      get karts() { return self.karts; },
      laps: start.laps,
      mode: start.mode,
      phase: 'countdown',
      countdown: RACE.countdown + 3,
      time: 0,
      ranked: [...this.karts],
      items: this.items,
      kart: (id) => this.byId.get(id),
      battle: null,
    };
    this.world.hazardRace = this.race;
    this.unsub = [
      client.on('s', (m) => this.onSnapshot(m)),
    ];
    this.visibility = () => client.send({ type: document.hidden ? 'pause' : 'resume' });
    document.addEventListener('visibilitychange', this.visibility);
  }

  get phase() { return this.race.phase; }
  get countdown() { return this.race.countdown; }
  get time() { return this.race.time; }
  localKart() { return this.localId ? this.byId.get(this.localId) : null; }
  itemState() { return this.items; }

  // --- local fixed-rate loop: sample input, predict own kart, send inputs -------------
  update(realDt) {
    if (realDt <= 0) return 0;
    this.acc += Math.min(realDt, 0.1);
    let steps = 0;
    while (this.acc >= SIM.dt && steps < 5) {
      this.tickLocal();
      this.acc -= SIM.dt;
      steps++;
    }
    if (steps === 5) this.acc = 0;
    if (this.outbox.length) {
      this.client.send({ type: 'i', f: this.outbox });
      this.outbox = [];
    }
    // advance the countdown/time estimate between snapshots
    if (this.race.phase === 'countdown') this.race.countdown = Math.max(0, this.race.countdown - realDt);
    else if (this.race.phase === 'racing') this.race.time += realDt;
    this.world.time = this.race.time;
    return steps;
  }

  tickLocal() {
    const k = this.localKart();
    if (!k) return;
    const raw = this.paused ? emptyInput() : this.inputFn ? this.inputFn() : emptyInput();
    const inp = quantizeInput(raw);
    this.seq++;
    this.history.push({ seq: this.seq, ...inp });
    if (this.history.length > 180) this.history.shift();
    this.outbox.push([this.seq, Math.round(inp.steer * 127), inp.btn]);
    this.prevLocal = { x: k.x, y: k.y, z: k.z, yaw: k.yaw };
    const events = [];
    stepKart(k, inp, this.world, SIM.dt, {
      emit: (type, id, data) => events.push({ type, id, ...data }),
      countdown: this.race.phase === 'countdown' ? this.race.countdown : 0,
      racing: this.race.phase !== 'finished',
    });
    const mine = events.filter((e) => PREDICTED_EVENTS.has(e.type));
    if (mine.length && this.onEvents) this.onEvents(mine);
  }

  // --- snapshots -------------------------------------------------------------------
  onSnapshot(m) {
    const now = performance.now();
    this.lastSnapAt = now;
    this.serverTick = m.t;
    const est = now - (m.t * 1000) / SIM.hz;
    // offset between local and server clocks, tracking the fastest-arriving snapshots
    this.clockBase = this.clockBase === null ? est : Math.min(this.clockBase + 0.25, est);
    const prevPhase = this.race.phase;
    this.race.phase = m.ph;
    this.race.countdown = m.cd;
    this.race.time = m.tm;
    this.world.time = m.tm;
    this.pings = m.pg || {};
    if (m.bt) this.race.battle = { variant: m.bt.v, timeLeft: m.bt.tl };

    // remote karts
    const states = new Map();
    for (const arr of m.k) {
      const id = arr[0];
      const st = decodeKart(arr.slice(1), KART_VIEW, {});
      states.set(id, st);
      const k = this.byId.get(id);
      if (k && id !== this.localId) Object.assign(k, st);
      else if (k) { k.place = st.place; }
    }
    this.snapshots.push({ tick: m.t, states });
    while (this.snapshots.length > 30) this.snapshots.shift();

    // own kart: reconcile
    const k = this.localKart();
    if (k && m.me) {
      const before = { x: k.x, y: k.y, z: k.z };
      decodeKart(m.me, KART_FULL, k);
      this.history = this.history.filter((h) => h.seq > m.a);
      const ctx = { emit: null, countdown: this.race.phase === 'countdown' ? this.race.countdown : 0, racing: this.race.phase !== 'finished' };
      for (const h of this.history) stepKart(k, h, this.world, SIM.dt, ctx);
      // hide small corrections by blending a visual offset back to zero
      const ex = before.x - k.x, ey = before.y - k.y, ez = before.z - k.z;
      if (ex * ex + ey * ey + ez * ez < 25) { this.visOffset.x += ex; this.visOffset.y += ey; this.visOffset.z += ez; }
      else this.visOffset = { x: 0, y: 0, z: 0 };
    }

    // items
    const it = this.items;
    if (m.bx) for (let i = 0; i < it.boxes.length; i++) it.boxes[i].active = m.bx[i] === '1';
    if (m.cn) for (let i = 0; i < it.coins.length; i++) it.coins[i].active = m.cn[i] === '1';
    it.projectiles = (m.p || []).map(decodeProjectile);
    it.hazards = (m.h || []).map(decodeHazard);
    it.effects = (m.e || []).map(decodeEffect);
    it.loose = (m.l || []).map(decodeLoose);
    this.race.ranked = [...this.karts].sort((a, b) => a.place - b.place);

    // events (drop our own predicted ones)
    const ev = (m.ev || []).filter((e) => !(e.id === this.localId && PREDICTED_EVENTS.has(e.type)));
    if (prevPhase !== 'finished' && m.ph === 'finished' && !ev.some((e) => e.type === 'raceEnd')) ev.push({ type: 'raceEnd', id: null });
    for (const e of ev) if (e.type === 'treasure' && e.id === this.localId && it.treasure) it.treasure.takenLocal = true;
    if (ev.length && this.onEvents) this.onEvents(ev);
  }

  // --- rendering state ----------------------------------------------------------------
  viewState(id) {
    const v = this.views.get(id);
    const k = this.byId.get(id);
    if (!v || !k) return null;
    if (id === this.localId) {
      Object.assign(v, k);
      const a = this.acc / SIM.dt;
      if (this.prevLocal && Math.abs(k.x - this.prevLocal.x) + Math.abs(k.z - this.prevLocal.z) < 8) {
        v.x = lerp(this.prevLocal.x, k.x, a);
        v.y = lerp(this.prevLocal.y, k.y, a);
        v.z = lerp(this.prevLocal.z, k.z, a);
        v.yaw = this.prevLocal.yaw + wrapAngle(k.yaw - this.prevLocal.yaw) * a;
      }
      const o = this.visOffset;
      v.x += o.x; v.y += o.y; v.z += o.z;
      const d = Math.exp(-12 / 60);
      o.x *= d; o.y *= d; o.z *= d;
      return v;
    }
    // remote: interpolate between snapshots at (now - interpDelay)
    const snaps = this.snapshots;
    if (!snaps.length) return Object.assign(v, k);
    const nowTick = this.clockBase !== null ? ((performance.now() - this.clockBase) * SIM.hz) / 1000 : snaps[snaps.length - 1].tick;
    const rt = nowTick - INTERP_TICKS;
    let a = null, b = null;
    for (let i = snaps.length - 1; i >= 0; i--) {
      if (snaps[i].tick <= rt) { a = snaps[i]; b = snaps[i + 1] || snaps[i]; break; }
    }
    if (!a) { a = b = snaps[0]; }
    const sa = a.states.get(id), sb = b.states.get(id);
    if (!sa || !sb) return Object.assign(v, k);
    Object.assign(v, k, sb);
    const span = b.tick - a.tick;
    const f = span > 0 ? Math.max(0, Math.min(1.2, (rt - a.tick) / span)) : 0;
    if (Math.abs(sb.x - sa.x) + Math.abs(sb.z - sa.z) < 12) {
      v.x = lerp(sa.x, sb.x, f); v.y = lerp(sa.y, sb.y, f); v.z = lerp(sa.z, sb.z, f);
      v.yaw = sa.yaw + wrapAngle(sb.yaw - sa.yaw) * f;
    }
    return v;
  }

  // latency indicator for the HUD (ms, -1 = disconnected)
  ping(id) { return this.pings[id] ?? 0; }
  get lagging() { return performance.now() - this.lastSnapAt > 600; }

  leave() {
    this.client.leave();
  }

  dispose() {
    for (const u of this.unsub) u();
    document.removeEventListener('visibilitychange', this.visibility);
  }
}
