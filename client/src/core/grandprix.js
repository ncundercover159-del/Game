// Grand Prix / Versus event manager: builds the field of 12 racers, runs the
// cup's races in order, tracks points and decides trophies.
import { RACE } from '@shared/config.js';
import { getData, listOf } from '@shared/data/registry.js';
import { makeRng } from '@shared/math.js';
import { isUnlocked } from './profile.js';

export function buildField(player, { count = 12, seed = Date.now() % 100000, allowLocked = true } = {}) {
  const rng = makeRng(seed);
  const racers = listOf('racers').filter((r) => r.id !== player.racerId && (allowLocked || isUnlocked('racers', r)));
  const vehicles = listOf('vehicles');
  const wheels = listOf('wheels');
  const gliders = listOf('gliders');
  // shuffle
  for (let i = racers.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [racers[i], racers[j]] = [racers[j], racers[i]]; }
  const field = [{ ...player, id: 'p1', human: true }];
  for (let i = 0; field.length < count; i++) {
    const r = racers[i % Math.max(1, racers.length)] || getData().racers[player.racerId];
    field.push({
      id: 'ai' + i,
      racerId: r.id,
      vehicleId: vehicles[Math.floor(rng() * vehicles.length)]?.id,
      wheelsId: wheels[Math.floor(rng() * wheels.length)]?.id,
      gliderId: gliders[Math.floor(rng() * gliders.length)]?.id,
      name: r.name,
      human: false,
      personality: r.personality,
    });
  }
  return field;
}

export class GrandPrix {
  // opts: { cupId, classId, player: {racerId, vehicleId, wheelsId, gliderId, name}, tracks?: [ids], laps, items, mode }
  constructor(opts) {
    this.opts = opts;
    const cup = getData().cups.find((c) => c.id === opts.cupId);
    this.cup = cup;
    // tracks that aren't built yet are skipped (the cup screen says so)
    this.tracks = (opts.tracks || cup?.tracks || []).filter((t) => getData().tracks[t]);
    this.classId = opts.classId || '150cc';
    this.laps = opts.laps || 3;
    this.index = 0;
    this.field = buildField(opts.player, { count: opts.count || 12, seed: opts.seed });
    this.points = new Map(this.field.map((e) => [e.id, 0]));
    this.history = [];
  }

  get trackId() { return this.tracks[this.index]; }
  get finished() { return this.index >= this.tracks.length; }

  // grid: race 1 the player starts last; later races by standings (leader in front)
  gridOrder() {
    if (this.index === 0) return [...this.field.filter((e) => !e.human), ...this.field.filter((e) => e.human)];
    return [...this.field].sort((a, b) => this.points.get(b.id) - this.points.get(a.id));
  }

  raceConfig() {
    return {
      trackId: this.trackId,
      classId: this.classId,
      mirror: this.classId === 'mirror',
      laps: this.laps,
      items: this.opts.items !== false,
      mode: 'race',
      entrants: this.gridOrder(),
      localId: 'p1',
      seed: (this.opts.seed || 1) + this.index * 101,
    };
  }

  // record a finished race: results = [{ id, place, time }]
  record(results) {
    const pts = RACE.points;
    const gained = {};
    for (const r of results) {
      const p = pts[r.place - 1] || 0;
      gained[r.id] = p;
      this.points.set(r.id, (this.points.get(r.id) || 0) + p);
    }
    this.history.push({ trackId: this.trackId, results, gained });
    this.index++;
    return gained;
  }

  standings() {
    return [...this.field]
      .map((e) => ({ ...e, points: this.points.get(e.id) || 0 }))
      .sort((a, b) => b.points - a.points);
  }

  playerRank() {
    return this.standings().findIndex((e) => e.human) + 1;
  }

  trophy() {
    const r = this.playerRank();
    return r === 1 ? 'gold' : r === 2 ? 'silver' : r === 3 ? 'bronze' : null;
  }
}
