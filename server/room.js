// A multiplayer room: lobby (picks, ready, settings, track vote) and an
// authoritative race simulation using the shared Race code at 60 Hz with
// 20 Hz snapshots. Players are { id, name, token, send(msg) } records so the
// room is testable without real sockets.
import { SIM, NET, CLASSES } from '../shared/config.js';
import { Race } from '../shared/sim/race.js';
import { createWorld } from '../shared/track/world.js';
import '../shared/track/track.js';
import { getData, listOf, getTrackDef } from '../shared/data/registry.js';
import { makeRng } from '../shared/math.js';
import {
  KART_FULL, KART_VIEW, encodeKart, encodeProjectile, encodeHazard, encodeEffect, encodeLoose, bitString,
  sanitizeInput, sanitizeName, PROTOCOL_VERSION,
} from '../shared/net/protocol.js';

const SNAP_EVERY = Math.round(SIM.hz / SIM.snapshotHz);
const VOTE_TIME = 10;
const RESULTS_TIME = 14;
const MAX_PLAYERS = SIM.maxRacers;

let nextPlayerId = 1;

export class Room {
  constructor(code, { isPublic = false, log = () => {} } = {}) {
    this.code = code;
    this.isPublic = isPublic;
    this.log = log;
    this.players = new Map();
    this.order = [];
    this.settings = { classId: '150cc', laps: 3, items: true, bots: true, mode: 'race', trackId: null, battle: 'balloons' };
    this.phase = 'lobby';
    this.votes = new Map();
    this.voteTimer = 0;
    this.resultsTimer = 0;
    this.race = null;
    this.tick = 0;
    this.pendingEvents = [];
    this.rng = makeRng(Date.now() & 0xffffff);
    this.emptySince = 0;
    this.lastResults = null;
  }

  get humanCount() { return [...this.players.values()].filter((p) => !p.left).length; }

  // ---------------------------------------------------------------------------
  addPlayer({ name, send, token }) {
    if (this.humanCount >= MAX_PLAYERS) return null;
    const id = 'u' + nextPlayerId++;
    const p = {
      id, name: sanitizeName(name), token: token || Math.random().toString(36).slice(2) + Date.now().toString(36),
      send, connected: true, away: false, ready: false, host: this.humanCount === 0,
      pick: { racerId: 'draxo', vehicleId: 'ember_roadster', wheelsId: 'standard', gliderId: 'sky_wing' },
      inputQ: [], lastSeq: 0, lastInput: { steer: 0, btn: 0 }, ping: 0, tokens: 20,
      spectator: this.phase === 'race', disconnectedAt: 0, left: false,
    };
    this.players.set(id, p);
    this.order.push(id);
    this.log(`[room ${this.code}] + ${p.name} (${id})`);
    this.broadcastRoom();
    if (this.phase === 'race' && this.race) this.sendStart(p);
    return p;
  }

  reconnect(p, send) {
    p.send = send;
    p.connected = true;
    p.away = false;
    p.disconnectedAt = 0;
    const k = this.race?.kart(p.id);
    if (k) { k.human = true; k.disconnected = false; }
    this.log(`[room ${this.code}] ~ ${p.name} reconnected`);
    this.broadcastRoom();
    if (this.phase === 'race' && this.race) this.sendStart(p);
  }

  disconnect(id) {
    const p = this.players.get(id);
    if (!p) return;
    p.connected = false;
    p.disconnectedAt = Date.now();
    const k = this.race?.kart(id);
    if (k) { k.human = false; k.disconnected = true; } // bot takes over
    this.log(`[room ${this.code}] - ${p.name} disconnected (grace ${NET.reconnectGrace}s)`);
    this.broadcastRoom();
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    p.left = true;
    this.players.delete(id);
    this.order = this.order.filter((x) => x !== id);
    const k = this.race?.kart(id);
    if (k) { k.human = false; k.disconnected = true; }
    if (p.host) {
      const next = this.order.map((x) => this.players.get(x)).find((q) => q && q.connected);
      if (next) next.host = true;
    }
    this.broadcastRoom();
  }

  // ---------------------------------------------------------------------------
  onMessage(id, m) {
    const p = this.players.get(id);
    if (!p || !m || typeof m !== 'object') return;
    switch (m.type) {
      case 'i': return this.onInputs(p, m);
      case 'pick': {
        const d = getData();
        if (d.racers[m.racerId]) p.pick.racerId = m.racerId;
        if (d.vehicles[m.vehicleId]) p.pick.vehicleId = m.vehicleId;
        if (d.wheels[m.wheelsId]) p.pick.wheelsId = m.wheelsId;
        if (d.gliders[m.gliderId]) p.pick.gliderId = m.gliderId;
        return this.broadcastRoom();
      }
      case 'name': p.name = sanitizeName(m.name); return this.broadcastRoom();
      case 'ready': p.ready = !!m.ready; this.broadcastRoom(); return this.maybeStartVote();
      case 'settings': {
        if (!p.host || this.phase !== 'lobby') return;
        if (CLASSES[m.classId]) this.settings.classId = m.classId;
        if ([1, 3, 5].includes(m.laps)) this.settings.laps = m.laps;
        if (typeof m.items === 'boolean') this.settings.items = m.items;
        if (typeof m.bots === 'boolean') this.settings.bots = m.bots;
        if (['race', 'battle'].includes(m.mode)) this.settings.mode = m.mode;
        if (['balloons', 'coins'].includes(m.battle)) this.settings.battle = m.battle;
        if (m.trackId === null || getTrackDef(m.trackId)) this.settings.trackId = m.trackId;
        return this.broadcastRoom();
      }
      case 'start': if (p.host) this.startVote(); return;
      case 'vote': if (this.phase === 'vote' && getTrackDef(m.trackId)) { this.votes.set(p.id, m.trackId); this.broadcastRoom(); this.maybeFinishVote(); } return;
      case 'ping': p.ping = Math.max(0, Math.min(5000, +m.rtt || 0)); return p.send({ type: 'pong', c: m.c, s: Date.now() });
      case 'pause': p.away = true; { const k = this.race?.kart(p.id); if (k) k.human = false; } return;
      case 'resume': p.away = false; { const k = this.race?.kart(p.id); if (k && p.connected) k.human = true; } return;
      case 'rematch': if (this.phase === 'results') { p.ready = true; this.broadcastRoom(); } return;
      default: return undefined;
    }
  }

  onInputs(p, m) {
    if (this.phase !== 'race' || !Array.isArray(m.f)) return;
    for (const f of m.f.slice(0, 12)) {
      if (!Array.isArray(f)) continue;
      const seq = f[0] | 0;
      if (seq <= p.lastSeq || p.inputQ.some((q) => q.seq === seq)) continue;
      if (p.tokens < 1) break; // rate limit: token bucket refilled per server tick
      p.tokens--;
      const inp = sanitizeInput(f[1], f[2]);
      p.inputQ.push({ seq, ...inp });
    }
    p.inputQ.sort((a, b) => a.seq - b.seq);
    if (p.inputQ.length > 10) p.inputQ.splice(0, p.inputQ.length - 5); // client ran ahead: catch up
  }

  // ---------------------------------------------------------------------------
  availableTracks() {
    const d = getData();
    return this.settings.mode === 'battle'
      ? Object.values(d.arenas).filter((a) => !a.dev).map((a) => a.id)
      : Object.keys(d.tracks);
  }

  maybeStartVote() {
    if (this.phase !== 'lobby') return;
    const active = [...this.players.values()].filter((p) => p.connected);
    if (active.length > 0 && active.every((p) => p.ready)) this.startVote();
  }

  startVote() {
    if (this.phase !== 'lobby' && this.phase !== 'results') return;
    if (this.settings.trackId) return this.startRace(this.settings.trackId);
    this.phase = 'vote';
    this.votes.clear();
    this.voteTimer = VOTE_TIME;
    this.broadcastRoom();
  }

  maybeFinishVote() {
    const active = [...this.players.values()].filter((p) => p.connected);
    if (active.every((p) => this.votes.has(p.id))) this.voteTimer = Math.min(this.voteTimer, 1.2);
  }

  finishVote() {
    const pool = [...this.votes.values()];
    const tracks = this.availableTracks();
    const trackId = pool.length ? pool[Math.floor(this.rng() * pool.length)] : tracks[Math.floor(this.rng() * tracks.length)];
    this.startRace(trackId);
  }

  buildEntrants() {
    const humans = this.order.map((id) => this.players.get(id)).filter((p) => p && p.connected);
    const entrants = humans.map((p) => ({ id: p.id, name: p.name, human: true, ...p.pick }));
    if (this.settings.bots) {
      const used = new Set(entrants.map((e) => e.racerId));
      const racers = listOf('racers').filter((r) => !used.has(r.id));
      const vehicles = listOf('vehicles');
      let i = 0;
      while (entrants.length < MAX_PLAYERS) {
        const r = racers[i % racers.length] || listOf('racers')[i % 16];
        entrants.push({ id: 'b' + (i + 1), name: r.name, human: false, racerId: r.id, vehicleId: vehicles[Math.floor(this.rng() * vehicles.length)].id, wheelsId: 'standard', gliderId: 'sky_wing', personality: r.personality });
        i++;
      }
    }
    // shuffle grid for fairness (humans spread out)
    for (let j = entrants.length - 1; j > 0; j--) { const k = Math.floor(this.rng() * (j + 1)); [entrants[j], entrants[k]] = [entrants[k], entrants[j]]; }
    return entrants;
  }

  startRace(trackId) {
    const def = getTrackDef(trackId);
    if (!def) return;
    const s = this.settings;
    const cls = CLASSES[s.classId] || CLASSES['150cc'];
    const mode = def.type === 'arena' ? 'battle' : 'race';
    const world = createWorld(def, { mirror: !!cls.mirror });
    const seed = (this.rng() * 1e9) | 0;
    this.raceConfig = { trackId, mirror: !!cls.mirror, classId: s.classId, laps: s.laps, items: s.items, mode, entrants: this.buildEntrants(), seed, battle: s.battle };
    this.race = new Race({ world, mode, laps: s.laps, classId: s.classId, items: s.items, entrants: this.raceConfig.entrants, seed, introTime: 3, battle: s.battle });
    this.phase = 'race';
    this.tick = 0;
    this.pendingEvents = [];
    for (const p of this.players.values()) {
      p.inputQ = []; p.lastSeq = 0; p.lastInput = { steer: 0, btn: 0 }; p.ready = false; p.spectator = !p.connected;
      const k = this.race.kart(p.id);
      if (k) k.human = p.connected && !p.away;
    }
    this.log(`[room ${this.code}] race on ${trackId} (${this.raceConfig.entrants.length} karts)`);
    for (const p of this.players.values()) if (p.connected) this.sendStart(p);
    this.broadcastRoom();
  }

  sendStart(p) {
    p.send({ type: 'start', ...this.raceConfig, you: p.id, tick: this.tick, v: PROTOCOL_VERSION, spectator: !this.race.kart(p.id) });
  }

  // ---------------------------------------------------------------------------
  update(dt) {
    if (this.phase === 'vote') {
      this.voteTimer -= dt;
      if (this.voteTimer <= 0) this.finishVote();
    } else if (this.phase === 'results') {
      this.resultsTimer -= dt;
      if (this.resultsTimer <= 0) { this.phase = 'lobby'; this.race = null; this.broadcastRoom(); }
    } else if (this.phase === 'race' && this.race) {
      this.stepRace();
    }
    // drop players whose reconnect grace expired
    const now = Date.now();
    for (const p of [...this.players.values()]) {
      if (!p.connected && now - p.disconnectedAt > NET.reconnectGrace * 1000) this.removePlayer(p.id);
    }
  }

  stepRace() {
    const race = this.race;
    for (const p of this.players.values()) {
      p.tokens = Math.min(24, p.tokens + (NET.maxInputRate / SIM.hz) * 1.2);
      const k = race.kart(p.id);
      if (!k) continue;
      if (!k.human) continue; // bot (AI) drives disconnected/away players
      const next = p.inputQ.shift();
      if (next) { p.lastSeq = next.seq; p.lastInput = { steer: next.steer, btn: next.btn }; }
      race.setInput(p.id, p.lastInput);
    }
    race.step();
    this.tick++;
    const ev = race.drainEvents();
    if (ev.length) this.pendingEvents.push(...ev);
    if (this.tick % SNAP_EVERY === 0) this.sendSnapshot();
    if (race.phase === 'finished' && !this.finishedAt) this.finishedAt = this.tick;
    if (this.finishedAt && this.tick - this.finishedAt > SIM.hz * 1) this.endRace();
  }

  sendSnapshot() {
    const race = this.race;
    const items = race.items;
    const pings = {};
    for (const p of this.players.values()) pings[p.id] = p.connected ? Math.round(p.ping) : -1;
    const common = {
      type: 's', t: this.tick, ph: race.phase, cd: Math.round(race.countdown * 1000) / 1000, tm: Math.round(race.time * 1000) / 1000,
      k: race.karts.map((k) => [k.id, ...encodeKart(k, KART_VIEW)]),
      p: items.projectiles.map(encodeProjectile),
      h: items.hazards.map(encodeHazard),
      e: items.effects.map(encodeEffect),
      l: items.loose.map(encodeLoose),
      bx: bitString(items.boxes),
      cn: bitString(items.coins),
      ev: this.pendingEvents.filter((e) => e.type !== 'bump' && e.type !== 'place'),
      pg: pings,
      bt: race.battle ? race.battle.snapshot() : undefined,
    };
    this.pendingEvents = [];
    const commonStr = JSON.stringify(common);
    for (const p of this.players.values()) {
      if (!p.connected) continue;
      const k = race.kart(p.id);
      const head = k ? `{"a":${p.lastSeq},"me":${JSON.stringify(encodeKart(k, KART_FULL))},` : '{"a":0,';
      p.send(head + commonStr.slice(1), true);
    }
  }

  endRace() {
    const race = this.race;
    this.finishedAt = 0;
    const results = (race.ranked || race.karts).map((k) => ({
      id: k.id, name: k.name, racerId: k.racerId, place: k.place, time: k.finishTime, estimated: !!k.estimated,
      human: !!this.players.get(k.id), coins: k.coinsTotal || 0, hits: k.hitsLanded || 0, score: k.score ?? k.balloons ?? 0,
    }));
    this.lastResults = results;
    this.phase = 'results';
    this.resultsTimer = RESULTS_TIME;
    this.broadcast({ type: 'results', results, trackId: this.raceConfig.trackId, mode: this.raceConfig.mode });
    this.broadcastRoom();
  }

  // ---------------------------------------------------------------------------
  roomState() {
    return {
      type: 'room', code: this.code, phase: this.phase, isPublic: this.isPublic, settings: this.settings,
      voteTimer: Math.max(0, Math.ceil(this.voteTimer)), resultsTimer: Math.max(0, Math.ceil(this.resultsTimer)),
      tracks: this.availableTracks(),
      votes: Object.fromEntries(this.votes),
      players: this.order.map((id) => this.players.get(id)).filter(Boolean).map((p) => ({
        id: p.id, name: p.name, ready: p.ready, host: p.host, connected: p.connected, away: p.away, ping: Math.round(p.ping), ...p.pick,
      })),
    };
  }

  broadcastRoom() { this.broadcast(this.roomState()); }

  broadcast(msg) {
    const s = JSON.stringify(msg);
    for (const p of this.players.values()) if (p.connected) p.send(s, true);
  }
}
