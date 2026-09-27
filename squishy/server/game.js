// One play-through: authoritative simulation of both squishies, puzzles,
// gates, trivia and the finale.

import {
  SPAWNS, PLATES, CIRCLE, GATES, TRIVIA_GATES, BELL, FIREFLIES, fireflyPos, POND,
} from '../shared/level.js';
import {
  DT, EV, newPlayer, newWorld, buildColliders, stepPlayer, onPlate,
} from '../shared/physics.js';
import { packPlayer } from '../shared/protocol.js';

const PLATE_IDS = Object.keys(PLATES);
const SYNC_WINDOW = 0.6;      // plates count as "together" if squished within this many seconds
const TIMER_SECONDS = 15;
const STONE_HOLD = 9;
const BELL_WINDOW = 1.0;
const MAX_QUEUE = 40;
const STARVE_S = 0.35;
const IDLE = Object.freeze({ jx: 0, jz: 0, act: 0 });

const GATE_SPEED = { forest: 0.55, timer: 1.6, tg1: 0.5, tg2: 0.5, tg3: 0.5 };

function approach(v, target, rate, dt) {
  if (v < target) return Math.min(target, v + rate * dt);
  if (v > target) return Math.max(target, v - rate * dt);
  return v;
}

export class Session {
  constructor(pickQuestions) {
    this.pickQuestions = pickQuestions;
    this.inputs = [0, 1].map(() => ({ queue: [], last: IDLE, ack: 0, starve: 0 }));
    this.stepEv = [0, 0];
    this.metaVersion = 0;
    this.runs = 0;
    this.reset();
  }

  reset() {
    this.runs++;
    this.seed = (Math.random() * 0x7fffffff) | 0;
    this.season = this.runs === 1 ? (this.seed & 1 ? 'autumn' : 'spring') : (this.season === 'autumn' ? 'spring' : 'autumn');
    this.questions = this.pickQuestions(3);
    this.players = SPAWNS.map((s) => newPlayer(s.x, s.z));
    this.evAcc = [0, 0];
    for (const inp of this.inputs) { inp.queue.length = 0; inp.last = IDLE; inp.starve = 0; }
    this.w = newWorld();
    this.col = buildColliders(this.w);
    this.flags = { forest: false, timerLatched: false, stairs: false, court: false, trivia: [false, false, false], finale: false };
    this.timerT = 0;
    this.stoneHold = 0;
    this.plateT = Object.fromEntries(PLATE_IDS.map((id) => [id, -99]));
    this.plateMask = 0;
    this.trivia = null;
    this.moments = { fireflies: 0, stones: 0, harmony: 0 };
    this.crossed = [false, false];
    this.ffMask = 0;
    this.bellT = [-99, -99];
    this.t = 0;
    this.events = [];
    this.finaleInfo = null;
    this.bump();
  }

  bump() { this.metaVersion++; }

  pushInput(slot, cmds) {
    const inp = this.inputs[slot];
    for (const c of cmds) {
      if (!Array.isArray(c) || c.length < 4) continue;
      const seq = c[0] | 0;
      if (seq <= inp.ack || (inp.queue.length && seq <= inp.queue[inp.queue.length - 1].seq)) continue;
      const jx = Math.max(-1, Math.min(1, +c[1] || 0));
      const jz = Math.max(-1, Math.min(1, +c[2] || 0));
      inp.queue.push({ seq, jx, jz, act: c[3] ? 1 : 0 });
    }
    if (inp.queue.length > 64) inp.queue.splice(0, inp.queue.length - 64);
  }

  // ---- simulation ---------------------------------------------------------

  step() {
    const dt = DT;
    this.t += dt;
    const frozen = !!this.trivia || this.flags.finale;

    // Each client's commands drive its own squishy one-for-one, so client
    // prediction matches exactly even on slow devices. A short gap in input
    // just pauses that squishy; a backlog is worked off two commands per step;
    // a long silence (tab in background, lag spike) steps with idle input so
    // gravity and pushes still apply.
    for (let i = 0; i < 2; i++) {
      const inp = this.inputs[i];
      if (inp.queue.length > MAX_QUEUE) inp.queue.splice(0, inp.queue.length - MAX_QUEUE);
      const p = this.players[i];
      const other = this.players[1 - i];
      this.stepEv[i] = 0;
      let n = inp.queue.length > 4 ? 2 : inp.queue.length ? 1 : 0;
      if (n) inp.starve = 0;
      else if ((inp.starve += dt) > STARVE_S) n = -1;
      for (let k = 0; k < Math.abs(n); k++) {
        let cmd;
        if (n > 0) { cmd = inp.queue.shift(); inp.last = cmd; inp.ack = cmd.seq; } else cmd = IDLE;
        stepPlayer(p, frozen ? IDLE : cmd, this.col, [other], dt, 0.5);
        this.stepEv[i] |= p.ev;
      }
      this.evAcc[i] |= this.stepEv[i];
      if (this.stepEv[i] & EV.SPLASH) this.events.push({ k: 'splash', s: i });
      if (this.stepEv[i] & EV.SPRING) this.events.push({ k: 'spring', s: i });
    }
    if (frozen) {
      this.stepTrivia();
      this.animateWorld(dt);
      return;
    }

    this.updatePlates();
    this.updatePuzzles(dt);
    this.updateFireflies();
    this.updateTriviaTriggers();
    this.updateBell();
    this.animateWorld(dt);
  }

  updatePlates() {
    let mask = 0;
    PLATE_IDS.forEach((id, bit) => {
      const plate = PLATES[id];
      if (this.players.some((p) => onPlate(p, plate))) {
        if (this.t - this.plateT[id] > 0.25) this.events.push({ k: 'plate', id });
        this.plateT[id] = this.t;
        mask |= 1 << bit;
      }
    });
    this.plateMask = mask;
  }

  recent(id) { return this.t - this.plateT[id] <= SYNC_WINDOW; }

  updatePuzzles(dt) {
    const f = this.flags;
    const [a, b] = this.players;

    if (!f.forest && this.recent('f1') && this.recent('f2')) {
      f.forest = true; this.events.push({ k: 'solve', id: 'forest' }); this.bump();
    }

    // Bamboo timer gate: the leaf stone opens it for a while; once both
    // squishies are through it stays open.
    if (!f.timerLatched) {
      if (this.plateT.timer === this.t) {
        if (this.timerT <= 0) this.events.push({ k: 'timer' });
        this.timerT = TIMER_SECONDS;
      } else this.timerT = Math.max(0, this.timerT - dt);
      if (a.z > GATES.timer.z + 0.6 && b.z > GATES.timer.z + 0.6) {
        f.timerLatched = true; this.timerT = 0; this.events.push({ k: 'solve', id: 'timer' }); this.bump();
      }
    }

    // Pond: both in the ring (or one on the far switch) raises the stones.
    const inRing = (p) => {
      const dx = p.x - CIRCLE.x, dz = p.z - CIRCLE.z;
      return dx * dx + dz * dz < CIRCLE.r * CIRCLE.r && p.y > -0.2 && p.y < 0.5;
    };
    if ((inRing(a) && inRing(b)) || this.plateT.pondFar === this.t) {
      if (this.stoneHold <= 0 && this.w.stones < 0.5) this.events.push({ k: 'stones' });
      this.stoneHold = STONE_HOLD;
    } else this.stoneHold = Math.max(0, this.stoneHold - dt);
    this.players.forEach((p, i) => {
      if (!this.crossed[i] && p.z > POND.z1 + 0.5 && p.y > -0.1) {
        this.crossed[i] = true; this.moments.stones++; this.bump();
      }
    });

    if (!f.stairs && this.plateT.stairs === this.t) {
      f.stairs = true; this.events.push({ k: 'solve', id: 'stairs' }); this.bump();
    }

    if (!f.court && this.recent('c1') && this.recent('c2')) {
      f.court = true; this.events.push({ k: 'solve', id: 'court' }); this.bump();
    }
  }

  updateFireflies() {
    const tmp = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < FIREFLIES.length; i++) {
      if (this.ffMask & (1 << i)) continue;
      fireflyPos(i, this.t, tmp);
      for (let s = 0; s < 2; s++) {
        const p = this.players[s];
        const dx = p.x - tmp.x, dz = p.z - tmp.z;
        const dy = tmp.y - (p.y + 0.45);
        if (dx * dx + dz * dz + dy * dy < 0.85 * 0.85) {
          this.ffMask |= 1 << i;
          this.moments.fireflies++;
          this.events.push({ k: 'firefly', i, s });
          this.bump();
          break;
        }
      }
    }
  }

  updateTriviaTriggers() {
    if (this.trivia) return;
    TRIVIA_GATES.forEach((id, i) => {
      if (this.trivia || this.flags.trivia[i]) return;
      if (i === 2 && !this.flags.court) return;
      const g = GATES[id];
      const near = (p) => p.z > g.z - 5.5 && p.z < g.z - 0.2 && Math.abs(p.y - g.y) < 1 && p.g;
      if (near(this.players[0]) && near(this.players[1])) this.startTrivia(i);
    });
  }

  updateBell() {
    if (!this.flags.trivia[2] || this.flags.finale) return;
    this.players.forEach((p, i) => {
      if (!(this.stepEv[i] & EV.SQUISH)) return;
      const dx = p.x - BELL.x, dz = p.z - BELL.z;
      if (dx * dx + dz * dz > BELL.r * BELL.r) return;
      this.bellT[i] = this.t;
      if (Math.abs(this.bellT[0] - this.bellT[1]) <= BELL_WINDOW) {
        this.flags.finale = true;
        this.finaleInfo = { dur: Math.round(this.t), moments: { ...this.moments } };
        this.events.push({ k: 'bell' });
        this.bump();
      } else this.events.push({ k: 'bellsolo', s: i });
    });
  }

  animateWorld(dt) {
    const f = this.flags, w = this.w;
    w.open.forest = approach(w.open.forest, f.forest ? 1 : 0, GATE_SPEED.forest, dt);
    w.open.timer = approach(w.open.timer, f.timerLatched || this.timerT > 0 ? 1 : 0, GATE_SPEED.timer, dt);
    TRIVIA_GATES.forEach((id, i) => { w.open[id] = approach(w.open[id], f.trivia[i] ? 1 : 0, GATE_SPEED[id], dt); });
    w.stairs = approach(w.stairs, f.stairs ? 1 : 0, 0.45, dt);
    w.stones = approach(w.stones, this.stoneHold > 0 ? 1 : 0, this.stoneHold > 0 ? 0.9 : 0.35, dt);
    this.col = buildColliders(w);
  }

  // ---- trivia -------------------------------------------------------------

  startTrivia(i) {
    const src = this.questions[i];
    const order = [0, 1, 2].sort(() => Math.random() - 0.5);
    this.trivia = {
      gate: i,
      text: src.q,
      options: order.map((k) => src.a[k]),
      correct: order.indexOf(0), // pool stores the right answer first
      fact: src.fact,
      attempt: 1,
      phase: 'ask',
      picks: [null, null],
      cont: [false, false],
      outcome: null,
      until: 0,
    };
    this.events.push({ k: 'trivia' });
    this.bump();
  }

  pick(slot, choice) {
    const tr = this.trivia;
    if (!tr || tr.phase !== 'ask') return;
    choice |= 0;
    if (choice < 0 || choice > 2) return;
    tr.picks[slot] = choice;
    if (tr.picks[0] !== null && tr.picks[1] !== null) { tr.phase = 'reveal'; tr.until = this.t + 1.6; }
    this.bump();
  }

  cont(slot) {
    const tr = this.trivia;
    if (!tr || tr.phase !== 'result') return;
    tr.cont[slot] = true;
    if (tr.cont[0] && tr.cont[1]) this.closeTrivia();
    else this.bump();
  }

  stepTrivia() {
    const tr = this.trivia;
    if (!tr || this.t < tr.until) return;
    if (tr.phase === 'reveal') {
      const agree = tr.picks[0] === tr.picks[1];
      const right = agree && tr.picks[0] === tr.correct;
      if (right) {
        tr.phase = 'result'; tr.outcome = 'harmony'; tr.until = this.t + 20;
        this.moments.harmony++;
        this.events.push({ k: 'correct' });
      } else if (tr.attempt === 1) {
        tr.phase = 'retry'; tr.outcome = agree ? 'wrong' : 'disagree'; tr.until = this.t + 2.6;
        this.events.push({ k: 'retry' });
      } else {
        tr.phase = 'result'; tr.outcome = 'gentle'; tr.until = this.t + 20;
        this.events.push({ k: 'gentle' });
      }
      this.bump();
    } else if (tr.phase === 'retry') {
      tr.phase = 'ask'; tr.attempt = 2; tr.picks = [null, null]; tr.outcome = null;
      this.bump();
    } else if (tr.phase === 'result') {
      this.closeTrivia();
    }
  }

  closeTrivia() {
    const i = this.trivia.gate;
    this.flags.trivia[i] = true;
    this.trivia = null;
    this.events.push({ k: 'solve', id: TRIVIA_GATES[i] });
    this.bump();
  }

  // Dev-only (SQUISHY_DEBUG=1): teleport both squishies / set puzzle flags.
  debug(msg) {
    if (typeof msg.z === 'number') {
      this.players.forEach((p, i) => {
        Object.assign(p, { x: (msg.x || 0) + (i ? 1.2 : -1.2), z: msg.z, y: msg.y || 0, vx: 0, vy: 0, vz: 0 });
      });
    }
    if (msg.flags) {
      for (const [k, v] of Object.entries(msg.flags)) if (k in this.flags) this.flags[k] = v;
      this.bump();
    }
    if (msg.stones) this.stoneHold = 60;
  }

  // ---- serialisation ------------------------------------------------------

  snapshot(ms) {
    const w = this.w;
    const q2 = (v) => Math.round(v * 1000) / 1000;
    const snap = {
      t: 's',
      st: Math.round(this.t * 1000),
      at: ms,
      p: this.players.map((p, i) => packPlayer(p, this.inputs[i].ack, this.evAcc[i])),
      w: [w.open.forest, w.open.timer, w.open.tg1, w.open.tg2, w.open.tg3, w.stairs, w.stones].map(q2),
      pm: this.plateMask,
      tm: q2(this.timerT),
      sh: q2(this.stoneHold),
    };
    if (this.events.length) snap.ev = this.events;
    this.events = [];
    this.evAcc = [0, 0];
    return snap;
  }

  meta() {
    const tr = this.trivia;
    let trivia = null;
    if (tr) {
      trivia = {
        gate: tr.gate, text: tr.text, options: tr.options, attempt: tr.attempt,
        phase: tr.phase, outcome: tr.outcome, cont: tr.cont,
        // Hide the partner's pick until both have answered.
        picks: tr.phase === 'ask' ? tr.picks.map((p) => (p === null ? null : -1)) : tr.picks,
        correct: tr.phase === 'result' ? tr.correct : null,
        fact: tr.phase === 'result' ? tr.fact : null,
      };
    }
    return {
      seed: this.seed,
      season: this.season,
      run: this.runs,
      flags: this.flags,
      trivia,
      moments: this.moments,
      ff: this.ffMask,
      finale: this.finaleInfo,
    };
  }

  // Own pick is revealed to its owner during 'ask'.
  metaFor(slot) {
    const m = this.meta();
    if (m.trivia && this.trivia.phase === 'ask') m.trivia.picks[slot] = this.trivia.picks[slot];
    return m;
  }
}
