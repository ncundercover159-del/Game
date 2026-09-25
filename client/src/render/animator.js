// Procedural animation for figures. Works on any figure: bones that don't exist
// are simply skipped. A base "driving" layer plus one-shot actions and poses.
import * as THREE from 'three';

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();

class Spring {
  constructor(k = 120, d = 14, v = 0) { this.k = k; this.d = d; this.x = v; this.v = 0; this.target = v; }
  update(dt) {
    const a = (this.target - this.x) * this.k - this.v * this.d;
    this.v += a * dt;
    this.x += this.v * dt;
    return this.x;
  }
  kick(v) { this.v += v; }
}

// Action library: t = time since start (s). Returns false when finished.
const ACTIONS = {
  throw: { dur: 0.45, fn: (o, t, side = 1) => {
    const p = Math.sin(Math.min(1, t / 0.45) * Math.PI);
    const arm = side > 0 ? 'armL' : 'armR';
    o.rot(arm, -2.2 * p, 0, side * 0.6 * p);
    o.rot('body', 0, side * 0.35 * p, 0);
    o.rot('head', 0, side * 0.3 * p, 0);
  } },
  throwBack: { dur: 0.5, fn: (o, t) => {
    const p = Math.sin(Math.min(1, t / 0.5) * Math.PI);
    o.rot('armL', -1.2 * p, 0, 0.8 * p);
    o.rot('body', 0, 1.1 * p, 0);
    o.rot('head', 0, 1.6 * p, 0);
  } },
  block: { dur: 0.5, fn: (o, t) => {
    const p = Math.sin(Math.min(1, t / 0.5) * Math.PI);
    o.rot('armL', -1.6 * p, 0, -0.6 * p);
    o.rot('armR', -1.6 * p, 0, 0.6 * p);
    o.rot('head', 0.4 * p, 0, 0);
    o.scl('body', 1, 1 - 0.1 * p, 1);
  } },
  hit: { dur: 0.6, fn: (o, t) => {
    const p = Math.exp(-t * 5) * Math.sin(t * 30);
    o.rot('head', -0.6 * Math.exp(-t * 6), p * 0.5, 0);
    o.rot('armL', -2.4 * Math.exp(-t * 4), 0, 0.5);
    o.rot('armR', -2.4 * Math.exp(-t * 4), 0, -0.5);
    o.jaw(0.6 * Math.exp(-t * 3));
  } },
  cheer: { dur: 1.0, fn: (o, t) => {
    const p = Math.sin(Math.min(1, t) * Math.PI);
    const w = Math.sin(t * 18) * 0.3;
    o.rot('armL', -2.6 * p, 0, 0.4 * p + w * p);
    o.rot('armR', -2.6 * p, 0, -0.4 * p - w * p);
    o.pos('hips', 0, Math.abs(Math.sin(t * 9)) * 0.08 * p, 0);
    o.jaw(0.5 * p);
  } },
  taunt: { dur: 1.3, fn: (o, t) => {
    const p = Math.sin(Math.min(1, t / 1.3) * Math.PI);
    o.rot('body', 0, Math.sin(t * 6) * 0.3 * p, 0);
    o.rot('head', -0.3 * p, Math.PI * 0.55 * p, 0.3 * p);
    o.rot('armL', -1.8 * p, 0, 0.9 * p);
    o.jaw(0.7 * p);
    o.rot('tail', 0, Math.sin(t * 14) * 0.6 * p, 0);
    o.flap(p);
  } },
  smug: { dur: 1.2, fn: (o, t) => {
    const p = Math.sin(Math.min(1, t / 1.2) * Math.PI);
    o.rot('head', -0.35 * p, 0, 0.25 * p);
    o.rot('armL', -0.6 * p, 0, 1.2 * p);
    o.rot('tail', 0.5 * p, Math.sin(t * 10) * 0.4 * p, 0);
  } },
  sad: { dur: 1.4, fn: (o, t) => {
    const p = Math.sin(Math.min(1, t / 1.4) * Math.PI);
    o.rot('head', 0.5 * p, 0, 0);
    o.rot('body', 0.3 * p, 0, 0);
    o.scl('body', 1, 1 - 0.08 * p, 1);
  } },
  whoo: { dur: 0.7, fn: (o, t) => {
    const p = Math.sin(Math.min(1, t / 0.7) * Math.PI);
    o.rot('head', -0.4 * p, 0, 0);
    o.jaw(0.8 * p);
    o.flap(p);
  } },
};

export class Animator {
  constructor(fig, opts = {}) {
    this.fig = fig;
    this.bones = fig.bones;
    this.bind = fig.bind;
    this.opts = opts;
    this.t = Math.random() * 10;
    this.lean = new Spring(90, 12);
    this.yaw = new Spring(90, 12);
    this.headYaw = new Spring(70, 11);
    this.squash = new Spring(260, 12, 1);
    this.stretch = new Spring(160, 12, 1);
    this.jawS = new Spring(200, 16);
    this.wing = new Spring(120, 10);
    this.actions = [];
    this.mode = 'drive'; // drive | select | victory | defeat | parade | podium
    this.off = {};
    for (const n in this.bones) this.off[n] = { r: [0, 0, 0], p: [0, 0, 0], s: [1, 1, 1] };
    const self = this;
    this.api = {
      rot(n, x, y, z) { const o = self.off[n]; if (o) { o.r[0] += x; o.r[1] += y; o.r[2] += z; } },
      pos(n, x, y, z) { const o = self.off[n]; if (o) { o.p[0] += x; o.p[1] += y; o.p[2] += z; } },
      scl(n, x, y, z) { const o = self.off[n]; if (o) { o.s[0] *= x; o.s[1] *= y; o.s[2] *= z; } },
      jaw(v) { self.jawExtra = Math.max(self.jawExtra, v); },
      flap(v) { self.flapExtra = Math.max(self.flapExtra, v); },
    };
  }

  play(name, arg) {
    const a = ACTIONS[name];
    if (!a) return;
    this.actions = this.actions.filter((x) => x.name !== name);
    this.actions.push({ name, t: 0, arg, dur: a.dur, fn: a.fn });
  }

  landed(strength) { this.squash.kick(-Math.min(6, strength * 0.6)); }
  boosted(strength = 1) { this.stretch.kick(3 * strength); }

  // s: { steer, drift, speed01, air, boost, spin, dizzy, look, glide }
  update(dt, s = {}) {
    this.t += dt;
    const t = this.t;
    for (const n in this.off) { const o = this.off[n]; o.r[0] = o.r[1] = o.r[2] = 0; o.p[0] = o.p[1] = o.p[2] = 0; o.s[0] = o.s[1] = o.s[2] = 1; }
    this.jawExtra = 0;
    this.flapExtra = 0;
    const A = this.api;

    if (this.mode === 'drive') {
      const steer = s.steer || 0, drift = s.drift || 0;
      this.lean.target = -(steer * 0.18 + drift * 0.32);
      this.yaw.target = steer * 0.12 + drift * 0.2;
      this.headYaw.target = s.look ? 2.4 : steer * 0.4 + drift * 0.35;
      this.stretch.target = s.boost ? 1.08 : 1;
      this.wing.target = s.glide ? 1 : s.boost ? 0.6 : s.air ? 0.8 : 0;
      const lean = this.lean.update(dt), yaw = this.yaw.update(dt), hy = this.headYaw.update(dt);
      const sq = this.squash.update(dt), st = this.stretch.update(dt);
      const vib = (s.speed01 || 0) * 0.012 * Math.sin(t * 60);
      A.rot('hips', 0, 0, lean * 0.4);
      A.rot('body', -0.05 * (s.speed01 || 0) + vib, yaw, lean);
      A.rot('head', Math.sin(t * 2.1) * 0.03, hy, -lean * 0.5);
      A.scl('body', 1 / Math.sqrt(sq * st), sq * st, 1 / Math.sqrt(sq * st));
      A.pos('hips', 0, Math.abs(Math.sin(t * 7)) * 0.01 * (s.speed01 || 0) + (sq - 1) * 0.05, 0);
      // hands on the wheel: steering turns arms
      A.rot('armL', steer * 0.25, 0, steer * 0.25);
      A.rot('armR', -steer * 0.25, 0, steer * 0.25);
      if (this.opts.bike) {
        // riding position: lean forward, arms reaching for the handlebars
        A.rot('body', 0.28, 0, lean * 0.6);
        A.rot('head', -0.2, 0, 0);
        A.rot('armL', -0.55, 0, 0.1);
        A.rot('armR', -0.55, 0, -0.1);
        A.rot('legL', 0, 0, 0.25);
        A.rot('legR', 0, 0, -0.25);
      }
      A.rot('tail', Math.sin(t * 3) * 0.08, -steer * 0.5 + Math.sin(t * 4.2) * 0.12 - drift * 0.4, 0);
      A.rot('tail2', 0, -steer * 0.3 + Math.sin(t * 4.2 - 0.8) * 0.2, 0);
      if (s.spin) {
        A.rot('armL', -2.5, 0, 0.6 + Math.sin(t * 25) * 0.4);
        A.rot('armR', -2.5, 0, -0.6 - Math.sin(t * 25) * 0.4);
        this.jawExtra = 0.7;
      }
      if (s.dizzy) {
        A.rot('head', Math.sin(t * 7) * 0.15, 0, Math.cos(t * 7) * 0.25);
      }
      if (s.air && !s.glide) {
        A.rot('armL', -0.6, 0, 0.5);
        A.rot('armR', -0.6, 0, -0.5);
      }
      if (s.trick) {
        A.rot('armL', -2.6, 0, 0.8);
        A.rot('armR', -2.6, 0, -0.8);
        this.jawExtra = 0.8;
      }
    } else if (this.mode === 'select' || this.mode === 'parade') {
      const b = Math.sin(t * 2.4);
      A.pos('hips', 0, Math.abs(b) * 0.03, 0);
      A.rot('body', 0, Math.sin(t * 0.9) * 0.15, Math.sin(t * 1.3) * 0.05);
      A.rot('head', Math.sin(t * 1.7) * 0.08, Math.sin(t * 0.7) * 0.3, 0);
      A.rot('armL', -0.4 + Math.sin(t * 2.4) * 0.15, 0, 0.3);
      A.rot('armR', -0.4 - Math.sin(t * 2.4) * 0.15, 0, -0.3);
      A.rot('tail', 0, Math.sin(t * 3) * 0.4, 0);
      A.rot('tail2', 0, Math.sin(t * 3 - 0.7) * 0.4, 0);
      this.wing.target = 0.35 + 0.25 * Math.sin(t * 2);
      this.wing.update(dt);
    } else if (this.mode === 'victory') {
      const hop = Math.abs(Math.sin(t * 5));
      A.pos('hips', 0, hop * 0.12, 0);
      A.rot('armL', -2.7, 0, 0.5 + Math.sin(t * 10) * 0.25);
      A.rot('armR', -2.7, 0, -0.5 - Math.sin(t * 10) * 0.25);
      A.rot('head', -0.3, Math.sin(t * 2) * 0.3, 0);
      A.rot('tail', 0.3, Math.sin(t * 12) * 0.6, 0);
      A.scl('body', 1 - hop * 0.04, 1 + hop * 0.06, 1 - hop * 0.04);
      this.jawExtra = 0.6;
      this.wing.target = 0.5 + 0.5 * Math.sin(t * 9);
      this.wing.update(dt);
    } else if (this.mode === 'defeat') {
      A.rot('head', 0.55, Math.sin(t * 0.8) * 0.2, 0);
      A.rot('body', 0.35, 0, 0);
      A.rot('armL', 0.4, 0, -0.2);
      A.rot('armR', 0.4, 0, 0.2);
      A.rot('tail', 0.6, 0, 0);
      A.scl('body', 1.02, 0.94, 1.02);
    }

    // one-shot actions layered on top
    for (let i = this.actions.length - 1; i >= 0; i--) {
      const a = this.actions[i];
      a.t += dt;
      if (a.t > a.dur) { this.actions.splice(i, 1); continue; }
      a.fn(A, a.t, a.arg);
    }

    // jaw & wings
    this.jawS.target = this.jawExtra;
    const jaw = this.jawS.update(dt);
    A.rot('jaw', jaw * 0.6, 0, 0);
    const wing = Math.max(this.wing.x, this.flapExtra);
    const flap = Math.sin(t * 16) * 0.5 * wing;
    A.rot('wingL', 0, -wing * 0.3, -flap - wing * 0.4);
    A.rot('wingR', 0, wing * 0.3, flap + wing * 0.4);
    // ears / antenna jiggle
    A.rot('earL', Math.sin(t * 5) * 0.06, 0, Math.sin(t * 3.3) * 0.08);
    A.rot('earR', Math.sin(t * 5 + 1) * 0.06, 0, -Math.sin(t * 3.3 + 1) * 0.08);
    A.rot('extra', Math.sin(t * 4) * 0.1, Math.sin(t * 2.7) * 0.2, 0);

    this.apply();
  }

  apply() {
    for (const n in this.off) {
      const bone = this.bones[n];
      const b = this.bind[n];
      if (!bone || !b) continue;
      const o = this.off[n];
      bone.position.set(b.pos.x + o.p[0], b.pos.y + o.p[1], b.pos.z + o.p[2]);
      _e.set(o.r[0], o.r[1], o.r[2], 'YXZ');
      _q.setFromEuler(_e);
      bone.quaternion.copy(b.quat).multiply(_q);
      bone.scale.set(o.s[0], o.s[1], o.s[2]);
    }
  }
}
