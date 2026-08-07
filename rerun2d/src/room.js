// THE LUMPS — the match.
//
// Owns the recordings, the playback clock, the plates and the score. There is
// no server here and nothing to disagree with, so this is the whole authority:
// it drives the shared simulation, writes the tape, and mints a ghost every
// twenty seconds whether you liked the last twenty seconds or not.

import {
  PHASE, TICK_MS, ROUND_MS, COUNTDOWN_MS, SETTLING_MS, TOTAL_ROUNDS,
  MAX_GHOSTS, RECORD_INTERVAL_MS, SAMPLES_PER_GHOST, SETTLING_SECONDS,
  FULL_SET_BONUS, STAB_REACH, STAB_HEIGHT, STAB_COOLDOWN_MS,
} from './constants.js';
import {
  PLATES, BOXES_DOOR_CLOSED, BOXES_DOOR_OPEN, roundSpec,
  requiredPlateIndices, momentumPlateIndices, spawnFor,
} from '@shared/arena.js';
import { createPlayerState, resetPlayerState, stepPlayer } from '@shared/physics.js';
import {
  createPlateStates, resetPlateStates, evaluatePlates, doorIsOpen,
} from '@shared/plates.js';
import {
  createRecording, writeSample, fillForward, buildStride, sampleAt,
  makeSampleOut, killFrom, FLAG_DEAD, FLAG_GROUNDED,
} from '@shared/ghostbuf.js';
import { makeMem } from './creature.js';

let nextGhostId = 1;

export class Room {
  constructor() {
    this.player = createPlayerState(0, 0);
    this.player.dist = 0;
    this.playerMem = makeMem(1.7);
    this.rec = createRecording();
    this.recIdx = -1;

    this.ghosts = [];
    this.bodies = [];        // collidable: living ghosts only, corpses opt out
    this.plateBodies = [];
    this.plates = createPlateStates();

    this.round = 0;
    this.phase = PHASE.COUNTDOWN;
    this.playStart = 0;
    this.phaseEndsAt = 0;
    this.required = [];
    this.turnstiles = new Set();
    this.doorOpen = false;
    this.doorSlide = 0;      // 0 shut, 1 fully sunk — for the renderer only

    this.score = 0;
    this.roundScore = 0;
    this.roundSolved = false;
    this.history = [];
    this.livePlateSeconds = 0;
    this.murders = 0;
    this.firstMurder = null;
    this.target = null;      // the past self currently within knife reach
    this.stabLatch = false;
    this.lastStabAt = -1e9;
    this.eulogies = [];
    this.events = [];
    this.lastClock = 0;

    this.beginCountdown(1);
  }

  emit(type, detail) { this.events.push({ type, detail }); }

  drain() {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ---- flow ---------------------------------------------------------------
  beginCountdown(round) {
    const now = performance.now();
    this.round = round;
    this.phase = PHASE.COUNTDOWN;
    this.playStart = now + COUNTDOWN_MS;
    this.phaseEndsAt = this.playStart;
    this.required = requiredPlateIndices(round);
    this.turnstiles = momentumPlateIndices(round);
    this.roundScore = 0;
    this.roundSolved = false;
    this.recIdx = -1;
    resetPlateStates(this.plates);

    // Each round starts at its own point on a small ring. Every ghost's tape
    // begins at its owner's spawn, so a fixed one would stand you inside all of
    // your past selves at t=0 and the resolver would fire you out of the room.
    const sp = spawnFor(0, round);
    resetPlayerState(this.player, sp.x, sp.z);
    this.player.dist = 0;
    this.playerMem = makeMem(1.7);
    this.emit('phase', { phase: this.phase, round });
  }

  beginPlay() {
    this.phase = PHASE.PLAY;
    this.phaseEndsAt = this.playStart + ROUND_MS;
    this.emit('phase', { phase: this.phase, round: this.round });
  }

  endPlay() {
    const now = performance.now();
    if (this.recIdx < 0) {
      const p = this.player;
      writeSample(this.rec, 0, p.x, p.y, p.z, p.yaw, this.flagsNow());
      this.recIdx = 0;
    }
    if (this.recIdx < SAMPLES_PER_GHOST - 1) {
      fillForward(this.rec, this.recIdx, SAMPLES_PER_GHOST - 1);
    }
    this.mintGhost();

    this.history.push({
      round: this.round,
      score: Math.round(this.roundScore * 10) / 10,
      solved: this.roundSolved,
      ghosts: this.ghosts.length,
    });

    this.phase = PHASE.SETTLING;
    this.phaseEndsAt = now + SETTLING_MS;
    if (this.round < TOTAL_ROUNDS) {
      // Schedule the next play phase now, so the ghost clock runs continuously
      // straight through settling and the countdown. There is exactly one cut
      // in the whole match and it is the end of a round.
      this.playStart = now + SETTLING_MS + COUNTDOWN_MS;
    }
    this.emit('phase', { phase: this.phase, round: this.round });
  }

  mintGhost() {
    const rec = createRecording();
    rec.pos.set(this.rec.pos);
    rec.yaw.set(this.rec.yaw);
    rec.flags.set(this.rec.flags);

    let hasDeath = false;
    for (let i = 0; i < SAMPLES_PER_GHOST; i++) {
      if (rec.flags[i] & FLAG_DEAD) { hasDeath = true; break; }
    }

    const gen = this.round;
    const g = {
      id: nextGhostId++,
      gen,
      round: this.round,
      rec,
      stride: buildStride(rec),
      hasDeath,
      plateSeconds: 0,
      collisions: 0,
      lastHitAt: 0,
      loops: 0,
      revealAt: performance.now() + SETTLING_SECONDS * 1000 * 0.3,
      stabbedAt: -1,
      cur: makeSampleOut(),
      mem: makeMem(gen * 2.39),
    };
    this.ghosts.push(g);
    this.emit('ghost', g);

    while (this.ghosts.length > MAX_GHOSTS) {
      const victim = this.ghosts.shift();
      this.eulogies.push({
        gen: victim.gen,
        plateSeconds: Math.round(victim.plateSeconds * 10) / 10,
      });
      this.emit('retire', victim);
    }
  }

  advance() {
    if (this.round >= TOTAL_ROUNDS) {
      this.phase = PHASE.RESULTS;
      this.phaseEndsAt = 0;
      this.emit('phase', { phase: this.phase, round: this.round });
      this.emit('results', this.results());
    } else {
      this.beginCountdown(this.round + 1);
    }
  }

  // ---- tick ---------------------------------------------------------------
  tick(now) {
    const dt = TICK_MS / 1000;

    if (this.phase === PHASE.COUNTDOWN && now >= this.playStart) this.beginPlay();
    else if (this.phase === PHASE.PLAY && now >= this.phaseEndsAt) this.endPlay();
    else if (this.phase === PHASE.SETTLING && now >= this.phaseEndsAt) this.advance();

    const clock = this.ghostClock(now);
    if (this.phase !== PHASE.RESULTS && clock < this.lastClock) {
      for (const g of this.ghosts) g.loops++;
    }
    this.lastClock = clock;

    this.updateBodies(clock);

    if (this.phase === PHASE.PLAY) {
      const world = {
        boxes: this.doorOpen ? BOXES_DOOR_OPEN : BOXES_DOOR_CLOSED,
        bodies: this.bodies,
      };
      const contacts = new Set();
      const p = this.player;
      const wasDead = p.dead;
      const px = p.x, pz = p.z;

      stepPlayer(p, this.input || ZERO, dt, world, now, contacts);
      p.dist += Math.hypot(p.x - px, p.z - pz);
      if (p.dead && !wasDead) this.emit('death', { x: p.x, y: p.y, z: p.z });

      for (const i of contacts) {
        const g = this.bodies[i] && this.bodies[i].ref;
        if (g && now - g.lastHitAt > 500) { g.lastHitAt = now; g.collisions++; }
      }

      this.target = p.dead ? null : this.findTarget();
      const wantsStab = !!(this.input && this.input.stab);
      if (wantsStab && !this.stabLatch) this.stab(now, clock);
      this.stabLatch = wantsStab;

      this.record(now);
    } else {
      this.target = null;
      this.stabLatch = false;
    }

    this.readPlates(now, this.phase === PHASE.PLAY ? dt : 0);

    // The door takes a moment to sink, purely so it is watchable.
    const want = this.doorOpen ? 1 : 0;
    this.doorSlide += Math.max(-dt * 3.5, Math.min(dt * 3.5, want - this.doorSlide));
  }

  /**
   * The nearest past self within knife reach that is still alive right now.
   * Omnidirectional — aiming a knife with a thumbstick is not a game — but the
   * reach is barely more than touching distance, so you have to be on top of it.
   */
  findTarget() {
    const p = this.player;
    let best = null;
    let bestD = Infinity;
    for (const b of this.bodies) {
      if (Math.abs(b.y - p.y) > STAB_HEIGHT) continue;
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (d > STAB_REACH || d >= bestD) continue;
      bestD = d;
      best = b.ref;
    }
    return best;
  }

  /**
   * Put the knife in.
   *
   * The ghost is not removed. Its tape is rewritten from this instant onward,
   * so from now on it walks the same route up to exactly here, and dies, and
   * lies there — and does it again in twenty seconds, and again, for the rest
   * of the plate. What you have destroyed is every future in which it was
   * useful, which is the same thing you always do.
   */
  stab(now, clock) {
    if (now - this.lastStabAt < STAB_COOLDOWN_MS) return false;
    const g = this.target;
    if (!g) return false;
    const i = Math.min(SAMPLES_PER_GHOST - 1,
      Math.max(0, Math.floor(clock / RECORD_INTERVAL_MS)));
    if (!killFrom(g.rec, i)) return false;

    // Positions past the knife just changed, so the walk cycle has to be
    // recomputed or the corpse keeps striding on the spot.
    g.stride = buildStride(g.rec);
    g.mem.hurt = 1;
    this.lastStabAt = now;
    g.hasDeath = true;
    g.stabbedAt = i;
    this.murders++;
    if (!this.firstMurder) {
      this.firstMurder = {
        gen: g.gen, at: i * RECORD_INTERVAL_MS / 1000, round: this.round,
      };
    }
    this.emit('stab', {
      gen: g.gen,
      x: g.cur.x, y: g.cur.y, z: g.cur.z,
      fromX: this.player.x, fromY: this.player.y, fromZ: this.player.z,
    });
    return true;
  }

  ghostClock(now) {
    if (!this.playStart) return 0;
    let t = (now - this.playStart) % ROUND_MS;
    if (t < 0) t += ROUND_MS;
    return t;
  }

  /**
   * Sample every ghost into its own `cur`, and collect the ones that still
   * count. A knifed self is drawn where it fell but is neither solid nor heavy:
   * it stops being a step and stops being a weight, permanently.
   */
  updateBodies(clock) {
    this.bodies.length = 0;
    this.plateBodies.length = 0;
    for (const g of this.ghosts) {
      const s = sampleAt(g.rec, clock, g.cur, g.stride);
      if (s.dead) continue;
      this.bodies.push({ x: s.x, y: s.y, z: s.z, vx: s.vx, vz: s.vz, ref: g });
      this.plateBodies.push({ x: s.x, y: s.y, z: s.z, ref: g });
    }
  }

  flagsNow() {
    const p = this.player;
    return (p.dead ? FLAG_DEAD : 0) | (p.grounded ? FLAG_GROUNDED : 0);
  }

  record(now) {
    const elapsed = now - this.playStart;
    if (elapsed < 0) return;
    let idx = Math.floor(elapsed / RECORD_INTERVAL_MS);
    if (idx > SAMPLES_PER_GHOST - 1) idx = SAMPLES_PER_GHOST - 1;
    if (idx <= this.recIdx) return;
    if (this.recIdx >= 0 && idx > this.recIdx + 1) fillForward(this.rec, this.recIdx, idx - 1);
    const p = this.player;
    writeSample(this.rec, idx, p.x, p.y, p.z, p.yaw, this.flagsNow());
    this.recIdx = idx;
  }

  readPlates(now, dt) {
    const p = this.player;
    const live = this.phase === PHASE.PLAY && !p.dead
      ? { x: p.x, y: p.y, z: p.z, ref: null }
      : null;
    if (live) this.plateBodies.push(live);

    evaluatePlates(this.plates, this.plateBodies, now, this.turnstiles);

    const doorWas = this.doorOpen;
    this.doorOpen = doorIsOpen(this.plates);
    if (this.doorOpen !== doorWas) this.emit('door', this.doorOpen);

    if (dt <= 0) return;

    let held = 0;
    for (const idx of this.required) {
      const st = this.plates[idx];
      if (!st.pressed) continue;
      held++;
      this.roundScore += dt;
      this.score += dt;
      for (const b of st.contributors) {
        if (b.ref) b.ref.plateSeconds += dt;
        else this.livePlateSeconds += dt;
      }
    }
    if (!this.roundSolved && held > 0 && held === this.required.length) {
      this.roundSolved = true;
      this.score += FULL_SET_BONUS;
      this.emit('solved', { round: this.round, bonus: FULL_SET_BONUS });
    }
  }

  pressedMask() {
    let m = 0;
    for (let i = 0; i < this.plates.length; i++) if (this.plates[i].pressed) m |= 1 << i;
    return m;
  }

  // ---- results ------------------------------------------------------------
  results() {
    let useless = null, obstructive = null, dying = null;
    for (const g of this.ghosts) {
      if (!useless || g.plateSeconds < useless.plateSeconds) useless = g;
      if (!obstructive || g.collisions > obstructive.collisions) obstructive = g;
      if (g.hasDeath && (!dying || g.loops > dying.loops)) dying = g;
    }

    const awards = [];
    if (useless) {
      awards.push({
        title: 'LEAST USEFUL SPECIMEN',
        who: `GENERATION ${useless.gen}`,
        detail: `${useless.plateSeconds.toFixed(1)} plate-seconds contributed across every loop it ran.`,
      });
    }
    if (obstructive) {
      awards.push({
        title: 'MOST OBSTRUCTIVE',
        who: `GENERATION ${obstructive.gen}`,
        detail: `${obstructive.collisions} separate collisions with the living.`,
      });
    }
    if (dying) {
      awards.push({
        title: 'STILL DYING',
        who: `GENERATION ${dying.gen}`,
        detail: `${dying.loops} completed deaths. It has not finished.`,
      });
    }
    if (this.firstMurder) {
      const m = this.firstMurder;
      awards.push({
        title: 'THE ONE YOU KILLED FIRST',
        who: `GENERATION ${m.gen}`,
        detail: `Knifed ${m.at.toFixed(1)} seconds into its loop, during observation ${m.round}. It still gets that far.`,
      });
    }

    const ghostSeconds = this.ghosts.reduce((n, g) => n + g.plateSeconds, 0);
    return {
      score: Math.round(this.score * 10) / 10,
      ghosts: this.ghosts.length,
      live: Math.round(this.livePlateSeconds * 10) / 10,
      ghostSeconds: Math.round(ghostSeconds * 10) / 10,
      history: this.history,
      murders: this.murders,
      awards,
      solvedRounds: this.history.filter((h) => h.solved).length,
    };
  }

  get spec() { return roundSpec(this.round || 1); }
  get plateDefs() { return PLATES; }
}

const ZERO = { x: 0, y: 0, jump: false, stab: false };
