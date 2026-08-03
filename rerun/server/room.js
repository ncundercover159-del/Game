// RERUN — a room. Owns the recordings, the playback clock and the plates.

import {
  PHASE, TICK_MS, ROUND_MS, COUNTDOWN_MS, SETTLING_MS,
  TOTAL_ROUNDS, MAX_GHOSTS, MAX_PLAYERS, RECORD_INTERVAL_MS,
  SAMPLES_PER_GHOST, RECONNECT_MS, FULL_SET_BONUS, SETTLING_SECONDS,
} from '../shared/constants.js';
import {
  BOXES_DOOR_CLOSED, BOXES_DOOR_OPEN, roundSpec,
  requiredPlateIndices, spawnFor,
} from '../shared/arena.js';
import { createPlayerState, resetPlayerState, stepPlayer } from '../shared/physics.js';
import {
  createRecording, writeSample, fillForward, sampleAt, makeSampleOut,
  encodeGhosts, FLAG_DEAD, FLAG_GROUNDED,
} from '../shared/ghostbuf.js';
import {
  createPlateStates, resetPlateStates, evaluatePlates, doorIsOpen, pressedMask,
} from '../shared/plates.js';

const MIN_PLAYERS = Number(process.env.RERUN_MIN_PLAYERS || 3);

let nextGhostId = 1;

export class Room {
  constructor(code) {
    this.code = code;
    this.players = new Map(); // playerId -> player
    this.order = []; // playerIds, join order (host succession)
    this.hostId = null;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();

    this.phase = PHASE.LOBBY;
    this.phaseEndsAt = 0;
    this.round = 0;
    // Absolute time at which the current (or upcoming) play phase begins.
    // Ghost loop position is always mod(now - playStart, 20000), which makes
    // playback continuous through the countdown and phase-locked to the round.
    this.playStart = 0;

    this.ghosts = [];
    this.plateStates = createPlateStates();
    this.doorOpen = false;
    this.requiredPlates = [];
    this.teamScore = 0;
    this.roundPlateSeconds = 0;
    this.roundSolved = false;
    this.roundHistory = [];

    this.bodies = []; // ghost collision bodies, rebuilt each tick
    this.lastBroadcast = 0;
    this.lastTick = Date.now();
    this.matchOver = false;
    this.pendingEulogies = [];
  }

  // ---- players -----------------------------------------------------------

  freeSlot() {
    const used = new Set([...this.players.values()].map((p) => p.slot));
    for (let i = 0; i < MAX_PLAYERS; i++) if (!used.has(i)) return i;
    return -1;
  }

  addPlayer(id, name, ws) {
    const slot = this.freeSlot();
    if (slot < 0) return null;
    const spawn = spawnFor(slot);
    const p = {
      id,
      slot,
      name: (name || 'PLAYER').slice(0, 10).toUpperCase(),
      ws,
      connected: true,
      disconnectedAt: 0,
      late: this.phase !== PHASE.LOBBY,
      input: { x: 0, y: 0, jump: false },
      state: createPlayerState(spawn.x, spawn.z),
      alive: false,
      rec: createRecording(),
      recIdx: -1,
      plateSeconds: 0,
      roundPlateSeconds: 0,
      ghostIds: [],
      // `active` = simulated and broadcast. `recording` = gets a ghost at the
      // end of this round. Someone who joins mid-round plays straight away but
      // is not recorded — half a tape would replay as a body teleporting in
      // from the origin.
      active: this.phase === PHASE.COUNTDOWN || this.phase === PHASE.PLAY,
      recording: this.phase === PHASE.COUNTDOWN,
    };
    this.players.set(id, p);
    this.order.push(id);
    if (!this.hostId) this.hostId = id;
    this.lastActivity = Date.now();
    return p;
  }

  removePlayer(id) {
    this.players.delete(id);
    this.order = this.order.filter((x) => x !== id);
    if (this.hostId === id) this.promoteHost();
  }

  promoteHost() {
    // Silently. Nobody needs a ceremony.
    const next = this.order.find((pid) => {
      const p = this.players.get(pid);
      return p && p.connected;
    }) || this.order[0] || null;
    this.hostId = next;
  }

  connectedCount() {
    let n = 0;
    for (const p of this.players.values()) if (p.connected) n++;
    return n;
  }

  canStart() {
    return this.phase === PHASE.LOBBY && this.connectedCount() >= MIN_PLAYERS;
  }

  // ---- match flow --------------------------------------------------------

  startMatch() {
    if (!this.canStart()) return false;
    this.ghosts = [];
    this.teamScore = 0;
    this.roundHistory = [];
    this.round = 0;
    this.matchOver = false;
    for (const p of this.players.values()) {
      p.plateSeconds = 0;
      p.ghostIds = [];
      p.late = false;
    }
    this.beginCountdown(1);
    return true;
  }

  beginCountdown(round) {
    const now = Date.now();
    this.round = round;
    this.phase = PHASE.COUNTDOWN;
    this.playStart = now + COUNTDOWN_MS;
    this.phaseEndsAt = this.playStart;
    this.requiredPlates = requiredPlateIndices(round);
    this.roundPlateSeconds = 0;
    this.roundSolved = false;
    resetPlateStates(this.plateStates);

    for (const p of this.players.values()) {
      const spawn = spawnFor(p.slot);
      resetPlayerState(p.state, spawn.x, spawn.z);
      p.roundPlateSeconds = 0;
      p.recIdx = -1;
      p.alive = true;
      p.active = p.connected;
      p.recording = p.connected;
    }
    this.broadcastPhase();
  }

  beginPlay() {
    this.phase = PHASE.PLAY;
    this.phaseEndsAt = this.playStart + ROUND_MS;
    this.broadcastPhase();
  }

  endPlay() {
    const now = Date.now();
    // Close out every recording so no sample is left at zero.
    for (const p of this.players.values()) {
      if (!p.recording) continue;
      if (p.recIdx < 0) {
        // Never got a sample in (joined at the buzzer) — write the whole tape.
        writeSample(p.rec, 0, p.state.x, p.state.y, p.state.z, p.state.yaw, p.state.dead ? FLAG_DEAD : 0);
        p.recIdx = 0;
      }
      if (p.recIdx < SAMPLES_PER_GHOST - 1) {
        fillForward(p.rec, p.recIdx, SAMPLES_PER_GHOST - 1);
        p.recIdx = SAMPLES_PER_GHOST - 1;
      }
    }

    this.mintGhosts();

    this.roundHistory.push({
      round: this.round,
      plateSeconds: Math.round(this.roundPlateSeconds * 10) / 10,
      solved: this.roundSolved,
      ghosts: this.ghosts.length,
    });

    this.phase = PHASE.SETTLING;
    this.phaseEndsAt = now + SETTLING_MS;
    // Schedule the next play phase now so the ghost clock stays continuous
    // straight through settling and the countdown.
    if (this.round < TOTAL_ROUNDS) {
      this.playStart = now + SETTLING_MS + COUNTDOWN_MS;
    }
    this.broadcastPhase();
  }

  mintGhosts() {
    const created = [];
    const stagger = (SETTLING_SECONDS * 1000 * 0.75);
    const parts = [...this.players.values()].filter((p) => p.recording);
    parts.sort((a, b) => a.slot - b.slot);

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const gen = p.ghostIds.length + 1;
      const rec = createRecording();
      rec.pos.set(p.rec.pos);
      rec.yaw.set(p.rec.yaw);
      rec.flags.set(p.rec.flags);

      let hasDeath = false;
      for (let s = 0; s < SAMPLES_PER_GHOST; s++) {
        if (rec.flags[s] & FLAG_DEAD) { hasDeath = true; break; }
      }

      const g = {
        id: nextGhostId++,
        ownerId: p.id,
        slot: p.slot,
        gen,
        round: this.round,
        rec,
        hasDeath,
        plateSeconds: 0,
        collisions: 0,
        lastHitAt: new Array(MAX_PLAYERS).fill(0),
        loops: 0,
        revealDelayMs: Math.round((i / Math.max(1, parts.length)) * stagger),
        cur: makeSampleOut(),
      };
      this.ghosts.push(g);
      p.ghostIds.push(g.id);
      created.push(g);
    }

    // Cap total ghosts. Retire the oldest generation with a small eulogy.
    const retired = [];
    while (this.ghosts.length > MAX_GHOSTS) {
      const victim = this.ghosts.shift();
      const owner = this.players.get(victim.ownerId);
      if (owner) owner.ghostIds = owner.ghostIds.filter((id) => id !== victim.id);
      retired.push(victim.id);
      this.pendingEulogies.push({
        name: owner ? owner.name : 'SOMEONE',
        gen: victim.gen,
        plateSeconds: Math.round(victim.plateSeconds * 10) / 10,
        deaths: victim.hasDeath ? victim.loops : 0,
      });
    }

    if (created.length) {
      this.sendGhostBatch(created);
      this.broadcastRoom(); // per-player ghost counts just changed
    }
    if (retired.length) {
      this.broadcastJSON({ t: 'retire', ids: retired, entries: this.pendingEulogies.splice(0) });
    }
  }

  advanceAfterSettling() {
    if (this.round >= TOTAL_ROUNDS) {
      this.finishMatch();
    } else {
      this.beginCountdown(this.round + 1);
    }
  }

  finishMatch() {
    this.phase = PHASE.RESULTS;
    this.phaseEndsAt = 0;
    this.matchOver = true;
    // playStart is left alone: the ghosts keep looping behind the results.
    this.broadcastJSON({ t: 'results', ...this.buildResults() });
    this.broadcastPhase();
  }

  returnToLobby() {
    this.phase = PHASE.LOBBY;
    this.round = 0;
    this.ghosts = [];
    this.teamScore = 0;
    this.roundHistory = [];
    this.matchOver = false;
    resetPlateStates(this.plateStates);
    this.doorOpen = false;
    for (const p of this.players.values()) {
      p.ghostIds = [];
      p.plateSeconds = 0;
      p.alive = false;
      p.late = false;
      const spawn = spawnFor(p.slot);
      resetPlayerState(p.state, spawn.x, spawn.z);
    }
    this.broadcastJSON({ t: 'reset' });
    this.broadcastPhase();
    this.broadcastRoom();
  }

  buildResults() {
    const byPlayer = [...this.players.values()].map((p) => {
      let ghostSeconds = 0;
      let deaths = 0;
      for (const g of this.ghosts) {
        if (g.ownerId !== p.id) continue;
        ghostSeconds += g.plateSeconds;
        if (g.hasDeath) deaths += g.loops;
      }
      return {
        slot: p.slot,
        name: p.name,
        live: Math.round(p.plateSeconds * 10) / 10,
        ghost: Math.round(ghostSeconds * 10) / 10,
        total: Math.round((p.plateSeconds + ghostSeconds) * 10) / 10,
        deaths,
      };
    }).sort((a, b) => b.total - a.total);

    const named = (g) => {
      const o = this.players.get(g.ownerId);
      return `${o ? o.name : 'SOMEONE'} · GEN ${g.gen}`;
    };

    let useless = null;
    let obstructive = null;
    let falling = null;
    for (const g of this.ghosts) {
      if (!useless || g.plateSeconds < useless.plateSeconds ||
        (g.plateSeconds === useless.plateSeconds && g.id < useless.id)) useless = g;
      if (!obstructive || g.collisions > obstructive.collisions) obstructive = g;
      const f = g.hasDeath ? g.loops : 0;
      const bf = falling ? (falling.hasDeath ? falling.loops : 0) : -1;
      if (f > bf) falling = g;
    }

    const awards = [];
    if (useless) {
      awards.push({
        title: 'MOST USELESS GHOST',
        who: named(useless),
        detail: `${(Math.round(useless.plateSeconds * 10) / 10).toFixed(1)} plate-seconds contributed across every loop it ran.`,
      });
    }
    if (obstructive) {
      awards.push({
        title: 'MOST OBSTRUCTIVE',
        who: named(obstructive),
        detail: `${obstructive.collisions} collisions with the living.`,
      });
    }
    if (falling && falling.hasDeath) {
      awards.push({
        title: 'STILL FALLING',
        who: named(falling),
        detail: `${falling.loops} completed descents. It has not stopped.`,
      });
    }

    return {
      teamScore: Math.round(this.teamScore * 10) / 10,
      rounds: this.roundHistory,
      players: byPlayer,
      awards,
      ghosts: this.ghosts.length,
    };
  }

  // ---- tick --------------------------------------------------------------

  tick(now) {
    const dt = TICK_MS / 1000;

    // phase transitions
    if (this.phase === PHASE.COUNTDOWN && now >= this.playStart) this.beginPlay();
    else if (this.phase === PHASE.PLAY && now >= this.phaseEndsAt) this.endPlay();
    else if (this.phase === PHASE.SETTLING && now >= this.phaseEndsAt) this.advanceAfterSettling();

    // reap the long-gone (their ghosts keep working)
    for (const p of [...this.players.values()]) {
      if (!p.connected && now - p.disconnectedAt > RECONNECT_MS) {
        const hadGhosts = p.ghostIds.length > 0;
        if (!hadGhosts || this.phase === PHASE.LOBBY) {
          this.removePlayer(p.id);
          this.broadcastRoom();
        } else {
          p.active = false;
          p.recording = false;
        }
      }
    }

    const prevClock = this.lastGhostClock || 0;
    const clock = this.ghostClock(now);
    if (this.phase !== PHASE.LOBBY && clock < prevClock) {
      for (const g of this.ghosts) g.loops++;
    }
    this.lastGhostClock = clock;

    this.updateGhostBodies(now);

    if (this.phase === PHASE.PLAY) {
      this.simulate(now, dt);
    } else if (this.phase !== PHASE.LOBBY) {
      // Between rounds the plates still read, so the arena stays alive and
      // players can see what their ghosts are holding down.
      this.readPlates(now, 0);
    }

    if (now - this.lastBroadcast >= 50) {
      this.lastBroadcast = now;
      this.broadcastState(now);
    }
  }

  ghostClock(now) {
    if (!this.playStart) return 0;
    let t = (now - this.playStart) % ROUND_MS;
    if (t < 0) t += ROUND_MS;
    return t;
  }

  updateGhostBodies(now) {
    const t = this.ghostClock(now);
    const bodies = this.bodies;
    bodies.length = 0;
    if (this.phase === PHASE.LOBBY) return;
    for (let i = 0; i < this.ghosts.length; i++) {
      const g = this.ghosts[i];
      sampleAt(g.rec, t, g.cur);
      bodies.push({
        x: g.cur.x, y: g.cur.y, z: g.cur.z,
        vx: g.cur.vx, vz: g.cur.vz,
        kind: 'ghost', ref: g,
      });
    }
  }

  simulate(now, dt) {
    const world = {
      boxes: this.doorOpen ? BOXES_DOOR_OPEN : BOXES_DOOR_CLOSED,
      bodies: this.bodies,
    };

    for (const p of this.players.values()) {
      if (!p.active) continue;
      const contacts = new Set();
      stepPlayer(p.state, p.input, dt, world, now, contacts);
      for (const idx of contacts) {
        const g = this.bodies[idx] && this.bodies[idx].ref;
        if (!g) continue;
        // Debounced so leaning on a ghost isn't 60 collisions a second.
        if (now - g.lastHitAt[p.slot] > 500) {
          g.lastHitAt[p.slot] = now;
          g.collisions++;
        }
      }
    }

    this.record(now);
    this.readPlates(now, dt);
  }

  record(now) {
    const elapsed = now - this.playStart;
    if (elapsed < 0) return;
    let idx = Math.floor(elapsed / RECORD_INTERVAL_MS);
    if (idx > SAMPLES_PER_GHOST - 1) idx = SAMPLES_PER_GHOST - 1;

    for (const p of this.players.values()) {
      if (!p.recording) continue;
      if (idx <= p.recIdx) continue;
      const s = p.state;
      const flags = (s.dead ? FLAG_DEAD : 0) | (s.grounded ? FLAG_GROUNDED : 0);
      if (p.recIdx >= 0 && idx > p.recIdx + 1) fillForward(p.rec, p.recIdx, idx - 1);
      writeSample(p.rec, idx, s.x, s.y, s.z, s.yaw, flags);
      p.recIdx = idx;
    }
  }

  readPlates(now, dt) {
    const bodies = [];
    for (let i = 0; i < this.bodies.length; i++) bodies.push(this.bodies[i]);
    if (this.phase === PHASE.PLAY) {
      for (const p of this.players.values()) {
        if (!p.active || p.state.dead) continue;
        bodies.push({ x: p.state.x, y: p.state.y, z: p.state.z, kind: 'live', ref: p });
      }
    }

    evaluatePlates(this.plateStates, bodies, now);
    this.doorOpen = doorIsOpen(this.plateStates);

    if (dt <= 0) return;

    let held = 0;
    for (const idx of this.requiredPlates) {
      const st = this.plateStates[idx];
      if (!st.pressed) continue;
      held++;
      this.roundPlateSeconds += dt;
      this.teamScore += dt;
      for (const b of st.contributors) {
        if (b.kind === 'ghost') {
          b.ref.plateSeconds += dt;
        } else {
          b.ref.plateSeconds += dt;
          b.ref.roundPlateSeconds += dt;
        }
      }
    }

    if (!this.roundSolved && held === this.requiredPlates.length && held > 0) {
      this.roundSolved = true;
      this.teamScore += FULL_SET_BONUS;
      this.broadcastJSON({ t: 'solved', round: this.round, bonus: FULL_SET_BONUS });
    }
  }

  // ---- outbound ----------------------------------------------------------

  sendTo(p, obj) {
    if (!p.ws || p.ws.readyState !== 1) return;
    try { p.ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj)); } catch { /* gone */ }
  }

  sendBinary(p, buf) {
    if (!p.ws || p.ws.readyState !== 1) return;
    try { p.ws.send(buf, { binary: true }); } catch { /* gone */ }
  }

  broadcastJSON(obj) {
    const s = JSON.stringify(obj);
    for (const p of this.players.values()) this.sendTo(p, s);
  }

  sendGhostBatch(ghosts, only) {
    const buf = encodeGhosts(ghosts, !!only);
    if (only) this.sendBinary(only, buf);
    else for (const p of this.players.values()) this.sendBinary(p, buf);
  }

  sendArchive(p) {
    if (!this.ghosts.length) {
      this.sendTo(p, { t: 'archive_done', count: 0 });
      return;
    }
    const batch = this.ghosts.map((g) => ({ ...g, revealDelayMs: 0 }));
    this.sendGhostBatch(batch, p);
    this.sendTo(p, { t: 'archive_done', count: this.ghosts.length });
  }

  roomPayload() {
    return {
      t: 'room',
      code: this.code,
      hostId: this.hostId,
      minPlayers: MIN_PLAYERS,
      players: [...this.players.values()]
        .sort((a, b) => a.slot - b.slot)
        .map((p) => ({
          id: p.id, slot: p.slot, name: p.name,
          connected: p.connected, late: p.late,
          ghosts: p.ghostIds.length,
        })),
    };
  }

  broadcastRoom() {
    this.broadcastJSON(this.roomPayload());
  }

  phasePayload() {
    const spec = roundSpec(this.round || 1);
    return {
      t: 'phase',
      phase: this.phase,
      round: this.round,
      totalRounds: TOTAL_ROUNDS,
      playStart: this.playStart,
      phaseEndsAt: this.phaseEndsAt,
      now: Date.now(),
      required: this.requiredPlates,
      title: spec.title,
      goal: spec.goal,
      ghosts: this.ghosts.length,
    };
  }

  broadcastPhase() {
    this.broadcastJSON(this.phasePayload());
  }

  broadcastState(now) {
    const live = [];
    for (const p of this.players.values()) {
      if (this.phase === PHASE.LOBBY) {
        const sp = spawnFor(p.slot);
        live.push([p.slot, r2(sp.x), 0, r2(sp.z), 0, p.connected ? 0 : 1]);
        continue;
      }
      if (!p.active) continue;
      const s = p.state;
      let f = 0;
      if (s.dead) f |= 1;
      if (!p.connected) f |= 2;
      if (p.late) f |= 4;
      if (s.grounded) f |= 8;
      live.push([p.slot, r2(s.x), r2(s.y), r2(s.z), r3(s.yaw), f]);
    }

    const packet = {
      t: 's',
      n: now,
      ps: this.playStart,
      ph: this.phase,
      pe: this.phaseEndsAt,
      r: this.round,
      p: live,
      pl: pressedMask(this.plateStates),
      d: this.doorOpen ? 1 : 0,
      sc: Math.round(this.teamScore * 10) / 10,
      rs: Math.round(this.roundPlateSeconds * 10) / 10,
      g: this.ghosts.length,
    };
    this.broadcastJSON(packet);
  }
}

function r2(v) { return Math.round(v * 100) / 100; }
function r3(v) { return Math.round(v * 1000) / 1000; }

export { MIN_PLAYERS };
