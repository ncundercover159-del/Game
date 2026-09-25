// Race simulation: owns karts, world, phases and events. Pure logic, runs
// identically in the browser (single-player) and on the server (online).
import { SIM, RACE, CLASSES, KART } from '../config.js';
import { createKart, stepKart, collideKarts } from '../physics/kart.js';
import { totalStats, statsToPhysics } from '../physics/stats.js';
import { getRacer, getVehicle, getWheels, getGlider } from '../data/registry.js';
import { emptyInput } from '../physics/input.js';
import { makeRng } from '../math.js';
import { LapSystem } from './laps.js';
import { ItemSystem } from './items.js';

export class Race {
  // opts: { world, mode: 'race'|'freeplay'|'battle'|'timetrial', laps, classId,
  //         entrants: [{ id, racerId, vehicleId, wheelsId, gliderId, human, name, ai }], seed }
  constructor(opts) {
    this.opts = opts;
    this.world = opts.world;
    this.mode = opts.mode || 'race';
    this.laps = opts.laps || 3;
    this.classId = opts.classId || '150cc';
    this.cls = CLASSES[this.classId] || CLASSES['150cc'];
    this.rng = makeRng(opts.seed || 12345);
    this.tick = 0;
    this.time = 0;          // time since GO (negative during countdown)
    this.phase = opts.skipCountdown ? 'racing' : 'countdown';
    this.countdown = opts.skipCountdown ? 0 : RACE.countdown + (opts.introTime || 0);
    this.events = [];
    this.karts = [];
    this.inputs = new Map();
    this.systems = [];      // pluggable per-tick systems (items, hazards, laps, AI)
    this.hitHooks = [];     // (kart, kind, opts) => void, e.g. battle balloons
    const spawns = this.world.gridSpawns ? this.world.gridSpawns(opts.entrants.length) : null;
    opts.entrants.forEach((e, i) => this.addKart(e, spawns ? spawns[i] : this.world.respawnPoint({ x: 0, z: 0 })));
    this.emit = (type, id, data) => this.events.push({ type, id, t: this.tick, ...data });
    if (this.world.type === 'track' && this.mode !== 'battle') {
      this.lapSystem = new LapSystem(this);
      this.systems.push(this.lapSystem);
    }
    this.items = new ItemSystem(this, { items: opts.items !== false && this.mode !== 'timetrial' });
    this.systems.unshift(this.items);
    this.ranked = [...this.karts];
  }

  addKart(e, spawn) {
    const racer = getRacer(e.racerId);
    const stats = totalStats(racer, getVehicle(e.vehicleId), getWheels(e.wheelsId), getGlider(e.gliderId));
    const phys = statsToPhysics(stats);
    const k = createKart(e.id, { x: spawn.x, y: spawn.y, z: spawn.z, yaw: spawn.yaw, phys, classMul: this.cls.speedMul });
    k.hint = spawn.hint ?? -1;
    k.ribbon = spawn.ribbon ?? 0;
    k.entrant = e;
    k.racerId = racer?.id;
    k.element = racer?.element;
    k.stats = stats;
    k.human = !!e.human;
    k.name = e.name || racer?.name || e.id;
    k.place = this.karts.length + 1;
    k.finished = false;
    k.finishTime = 0;
    this.karts.push(k);
    this.inputs.set(k.id, emptyInput());
    return k;
  }

  kart(id) { return this.karts.find((k) => k.id === id); }

  setInput(id, input) { this.inputs.set(id, input); }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  step() {
    const dt = SIM.dt;
    this.tick++;
    if (this.phase === 'countdown') {
      if (this.tick === 1 && this.countdown <= RACE.countdown + 1e-6) this.emit('countdown', null, { n: 3 });
      const before = this.countdown;
      this.countdown -= dt;
      const whole = Math.ceil(this.countdown);
      if (whole !== Math.ceil(before) && whole >= 1 && whole <= 3) this.emit('countdown', null, { n: whole });
      if (this.countdown <= 0) {
        this.countdown = 0;
        this.phase = 'racing';
        this.emit('go', null, {});
      }
    }
    if (this.phase !== 'countdown') this.time += dt;

    const ctx = { emit: this.emit, countdown: this.countdown, racing: true, race: this };
    for (const sys of this.systems) sys.preStep?.(this, dt);
    for (const k of this.karts) {
      if (k.eliminated) continue;
      const inp = k.finished && k.human ? this.autoInput(k) : this.inputs.get(k.id) || emptyInput();
      stepKart(k, inp, this.world, dt, ctx);
    }
    collideKarts(this.karts, this.emit, (o, kind, o2) => this.items.hit(o, kind, o2));
    for (const sys of this.systems) sys.postStep?.(this, dt);
  }

  // After finishing, humans are driven by the AI (set by the AI system if present).
  autoInput(k) {
    return this.autoDriver ? this.autoDriver(k) : { steer: 0, btn: 1 };
  }
}

export { KART };
