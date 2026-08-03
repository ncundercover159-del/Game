// RERUN 2D — the match. Owns the recordings, the playback clock, the plates
// and the score. Runs locally; there is no server to disagree with.

import {
  PHASE, TICK_MS, ROUND_MS, COUNTDOWN_MS, SETTLING_MS, TOTAL_ROUNDS,
  MAX_GHOSTS, RECORD_INTERVAL_MS, SAMPLES_PER_GHOST, SETTLING_SECONDS,
  PLATE_HALF, PLATE_ACTIVATION_MASS, PLATE_FOOT_ABOVE, PLATE_FOOT_BELOW,
  MOMENTUM_HOLD_MS, FULL_SET_BONUS, STAB_REACH, STAB_HEIGHT, STAB_COOLDOWN_MS,
} from './constants.js';
import {
  PLATES, BOXES_DOOR_CLOSED, BOXES_DOOR_OPEN, roundSpec,
  requiredPlateIndices, momentumPlateIndices, spawnFor,
} from './arena.js';
import { createPlayer, resetPlayer, stepPlayer } from './physics.js';
import {
  createRecording, writeSample, fillForward, buildStride, sampleAt, makeSample,
  killFrom, F_DEAD, F_GROUNDED, F_FACE_LEFT,
} from './ghostbuf.js';

let nextGhostId = 1;

export class Room {
  constructor(name) {
    this.name = (name || 'YOU').slice(0, 10).toUpperCase();
    this.player = createPlayer(0, 0);
    this.rec = createRecording();
    this.recIdx = -1;

    this.ghosts = [];
    this.bodies = [];
    this.plates = PLATES.map(() => ({
      mass: 0, prevMass: 0, pressed: false, momentumUntil: 0, contributors: [],
    }));

    this.round = 0;
    this.phase = PHASE.COUNTDOWN;
    this.playStart = 0;
    this.phaseEndsAt = 0;
    this.required = [];
    this.turnstiles = new Set();
    this.doorOpen = false;

    this.score = 0;
    this.roundScore = 0;
    this.roundSolved = false;
    this.history = [];
    this.livePlateSeconds = 0;
    this.murders = 0;
    this.firstMurder = null;
    this.target = null;      // the past self currently within reach
    this.stabLatch = false;
    this.lastStabAt = -1e9;
    this.eulogies = [];
    this.events = [];      // drained by the client each frame
    this.retiredIds = [];

    this.beginCountdown(1);
  }

  emit(type, detail) { this.events.push({ type, detail }); }

  drain() {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ---- flow --------------------------------------------------------------
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
    for (const s of this.plates) {
      s.mass = 0; s.prevMass = 0; s.pressed = false; s.momentumUntil = 0;
      s.contributors.length = 0;
    }
    const sp = spawnFor(round);
    resetPlayer(this.player, sp.x, sp.y);
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
      writeSample(this.rec, 0, this.player.x, this.player.y, this.flagsNow());
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
      // Schedule the next play phase now, so the ghost clock stays continuous
      // straight through settling and the countdown.
      this.playStart = now + SETTLING_MS + COUNTDOWN_MS;
    }
    this.emit('phase', { phase: this.phase, round: this.round });
  }

  mintGhost() {
    const rec = createRecording();
    rec.pos.set(this.rec.pos);
    rec.flags.set(this.rec.flags);
    buildStride(rec);

    let hasDeath = false;
    for (let i = 0; i < SAMPLES_PER_GHOST; i++) {
      if (rec.flags[i] & F_DEAD) { hasDeath = true; break; }
    }

    const g = {
      id: nextGhostId++,
      gen: this.ghosts.length + 1,
      round: this.round,
      rec,
      hasDeath,
      plateSeconds: 0,
      collisions: 0,
      lastHitAt: 0,
      loops: 0,
      revealAt: performance.now() + SETTLING_SECONDS * 1000 * 0.28,
      stabbedAt: -1,
      cur: makeSample(),
    };
    this.ghosts.push(g);
    this.emit('ghost', g);

    while (this.ghosts.length > MAX_GHOSTS) {
      const victim = this.ghosts.shift();
      this.retiredIds.push(victim.id);
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

  // ---- tick --------------------------------------------------------------
  tick(now) {
    const dt = TICK_MS / 1000;

    if (this.phase === PHASE.COUNTDOWN && now >= this.playStart) this.beginPlay();
    else if (this.phase === PHASE.PLAY && now >= this.phaseEndsAt) this.endPlay();
    else if (this.phase === PHASE.SETTLING && now >= this.phaseEndsAt) this.advance();

    const clock = this.ghostClock(now);
    if (this.phase !== PHASE.RESULTS && clock < (this.lastClock || 0)) {
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
      const wasDead = this.player.dead;
      stepPlayer(this.player, this.input || { x: 0, jump: false }, dt, world, now, contacts);
      if (this.player.dead && !wasDead) this.emit('death', this.player);

      for (const i of contacts) {
        const g = this.bodies[i] && this.bodies[i].ref;
        if (g && now - g.lastHitAt > 500) { g.lastHitAt = now; g.collisions++; }
      }

      this.target = this.player.dead ? null : this.findTarget();
      const wantsStab = !!(this.input && this.input.stab);
      if (wantsStab && !this.stabLatch) this.stab(now, clock);
      this.stabLatch = wantsStab;

      this.record(now);
      this.readPlates(now, dt);
    } else {
      this.target = null;
      this.stabLatch = false;
      this.readPlates(now, 0);
    }
  }

  /** The nearest past self within knife reach that is still alive right now. */
  findTarget() {
    let best = null;
    let bestD = Infinity;
    for (const b of this.bodies) {
      if (b.ref.cur.dead) continue;
      if (Math.abs(b.y - this.player.y) > STAB_HEIGHT) continue;
      const d = Math.abs(b.x - this.player.x);
      if (d > STAB_REACH || d >= bestD) continue;
      bestD = d;
      best = b.ref;
    }
    return best;
  }

  /**
   * Put the knife in. The ghost is not removed — its tape is rewritten from
   * this instant onward, so from now on it walks its old route up to here and
   * then dies, on the loop, for the rest of the plate.
   */
  stab(now, clock) {
    if (now - this.lastStabAt < STAB_COOLDOWN_MS) return false;
    const g = this.target;
    if (!g) return false;
    const i = Math.min(SAMPLES_PER_GHOST - 1,
      Math.max(0, Math.floor(clock / RECORD_INTERVAL_MS)));
    if (!killFrom(g.rec, i)) return false;

    this.lastStabAt = now;
    g.hasDeath = true;
    g.stabbedAt = i;
    this.murders++;
    if (!this.firstMurder) {
      this.firstMurder = { gen: g.gen, at: i * RECORD_INTERVAL_MS / 1000, round: this.round };
    }
    this.emit('stab', {
      gen: g.gen,
      x: g.cur.x, y: g.cur.y,
      fromX: this.player.x, fromY: this.player.y,
    });
    return true;
  }

  ghostClock(now) {
    if (!this.playStart) return 0;
    let t = (now - this.playStart) % ROUND_MS;
    if (t < 0) t += ROUND_MS;
    return t;
  }

  updateBodies(clock) {
    this.bodies.length = 0;
    for (const g of this.ghosts) {
      const s = sampleAt(g.rec, clock, g.cur);
      this.bodies.push({ x: s.x, y: s.y, vx: s.vx, ref: g });
    }
  }

  flagsNow() {
    const p = this.player;
    return (p.dead ? F_DEAD : 0) | (p.grounded ? F_GROUNDED : 0) |
      (p.facing < 0 ? F_FACE_LEFT : 0);
  }

  record(now) {
    const elapsed = now - this.playStart;
    if (elapsed < 0) return;
    let idx = Math.floor(elapsed / RECORD_INTERVAL_MS);
    if (idx > SAMPLES_PER_GHOST - 1) idx = SAMPLES_PER_GHOST - 1;
    if (idx <= this.recIdx) return;
    if (this.recIdx >= 0 && idx > this.recIdx + 1) fillForward(this.rec, this.recIdx, idx - 1);
    writeSample(this.rec, idx, this.player.x, this.player.y, this.flagsNow());
    this.recIdx = idx;
  }

  readPlates(now, dt) {
    const live = this.phase === PHASE.PLAY && !this.player.dead ? this.player : null;

    for (let i = 0; i < PLATES.length; i++) {
      const plate = PLATES[i];
      const st = this.plates[i];
      st.contributors.length = 0;
      let mass = 0;

      for (const b of this.bodies) {
        if (b.ref.cur.dead) continue; // the dead hold nothing down
        const dy = b.y - plate.y;
        if (dy < -PLATE_FOOT_BELOW || dy > PLATE_FOOT_ABOVE) continue;
        if (Math.abs(b.x - plate.x) > PLATE_HALF) continue;
        mass++;
        st.contributors.push(b.ref);
      }
      if (live) {
        const dy = live.y - plate.y;
        if (dy >= -PLATE_FOOT_BELOW && dy <= PLATE_FOOT_ABOVE &&
            Math.abs(live.x - plate.x) <= PLATE_HALF) {
          mass++;
          st.contributors.push(null); // null means you, right now
        }
      }

      st.prevMass = st.mass;
      st.mass = mass;

      if (this.turnstiles.has(i)) {
        // Only down while weight is increasing. It wants arrivals.
        if (mass > st.prevMass) st.momentumUntil = now + MOMENTUM_HOLD_MS;
        st.pressed = mass >= PLATE_ACTIVATION_MASS && now < st.momentumUntil;
      } else {
        st.pressed = mass >= PLATE_ACTIVATION_MASS;
      }
    }

    const doorWas = this.doorOpen;
    this.doorOpen = PLATES.some((p, i) => p.holdsDoor && this.plates[i].pressed);
    if (this.doorOpen !== doorWas) this.emit('door', this.doorOpen);

    if (dt <= 0) return;

    let held = 0;
    for (const idx of this.required) {
      const st = this.plates[idx];
      if (!st.pressed) continue;
      held++;
      this.roundScore += dt;
      this.score += dt;
      for (const ref of st.contributors) {
        if (ref) ref.plateSeconds += dt;
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

  // ---- results -----------------------------------------------------------
  results() {
    let useless = null, obstructive = null, falling = null;
    for (const g of this.ghosts) {
      if (!useless || g.plateSeconds < useless.plateSeconds) useless = g;
      if (!obstructive || g.collisions > obstructive.collisions) obstructive = g;
      const f = g.hasDeath ? g.loops : 0;
      const bf = falling ? (falling.hasDeath ? falling.loops : 0) : -1;
      if (f > bf) falling = g;
    }

    const awards = [];
    if (useless) {
      awards.push({
        title: 'MOST USELESS GHOST',
        who: `GENERATION ${useless.gen}`,
        detail: `${useless.plateSeconds.toFixed(1)} plate-seconds contributed across every loop it ran.`,
      });
    }
    if (obstructive) {
      awards.push({
        title: 'MOST OBSTRUCTIVE',
        who: `GENERATION ${obstructive.gen}`,
        detail: `${obstructive.collisions} collisions with the living.`,
      });
    }
    if (falling && falling.hasDeath) {
      awards.push({
        title: 'STILL FALLING',
        who: `GENERATION ${falling.gen}`,
        detail: `${falling.loops} completed descents. It has not stopped.`,
      });
    }

    if (this.firstMurder) {
      const m = this.firstMurder;
      awards.push({
        title: 'THE ONE YOU KILLED FIRST',
        who: `GENERATION ${m.gen}`,
        detail: `Knifed ${m.at.toFixed(1)} seconds into its loop, during exposure ${m.round}. It still gets that far.`,
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
}
