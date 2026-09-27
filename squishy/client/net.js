// WebSocket client: room create/join, automatic reconnect with the room token,
// input batching, own-squishy prediction + reconciliation, and a snapshot
// buffer for interpolating the partner.

import { newPlayer, copyPlayer, stepPlayer, buildColliders, newWorld, DT } from '../shared/physics.js';
import { unpackPlayer } from '../shared/protocol.js';
import { GATE_IDS } from '../shared/level.js';

const INTERP_DELAY = 110; // ms behind the newest snapshot for the partner
const STORE = 'squishy.session';

export class Net {
  constructor(handlers) {
    this.h = handlers;
    this.ws = null;
    this.code = null;
    this.token = null;
    this.you = 0;
    this.connected = false;
    this.wantRoom = false;
    this.retry = 0;
    this.queue = [];
    this.snaps = [];
    this.latest = null;
    this.offset = null; // estimate of (serverSimMs - performance.now())
    this.world = newWorld();
    this.col = buildColliders(this.world);
    this.pred = new Predictor();
    this.outbox = [];
    this.lastFlush = 0;
    this.lastSt = -1;
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE) || 'null');
      if (saved && saved.code && saved.token) { this.code = saved.code; this.token = saved.token; }
    } catch { /* storage unavailable */ }
  }

  url() {
    const q = new URLSearchParams(location.search).get('server');
    if (q) return q;
    return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  }

  connect() {
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;
    const ws = new WebSocket(this.url());
    this.ws = ws;
    ws.onopen = () => {
      this.connected = true;
      this.retry = 0;
      if (this.wantRoom && this.code && this.token) this.raw({ t: 'resume', code: this.code, token: this.token });
      for (const m of this.queue) this.raw(m);
      this.queue = [];
      this.h.onConnection?.(true);
    };
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      this.receive(msg);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.connected = false;
      this.h.onConnection?.(false);
      if (this.wantRoom) {
        const delay = Math.min(4000, 400 * 2 ** this.retry++);
        setTimeout(() => this.connect(), delay);
      }
    };
  }

  raw(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  send(m) { if (this.connected) this.raw(m); else { this.queue.push(m); this.connect(); } }

  hasSavedRoom() { return !!(this.code && this.token); }
  resumeSaved() { this.wantRoom = true; this.send({ t: 'resume', code: this.code, token: this.token }); }
  create() { this.wantRoom = true; this.send({ t: 'create' }); }
  join(code) { this.wantRoom = true; this.send({ t: 'join', code }); }
  leave() {
    this.raw({ t: 'leave' });
    this.forget();
  }
  forget() {
    this.wantRoom = false;
    this.code = this.token = null;
    try { sessionStorage.removeItem(STORE); } catch { /* ignore */ }
  }

  receive(msg) {
    switch (msg.t) {
      case 'joined':
        this.code = msg.code; this.token = msg.token; this.you = msg.you;
        try { sessionStorage.setItem(STORE, JSON.stringify({ code: msg.code, token: msg.token })); } catch { /* ignore */ }
        this.h.onJoined?.(msg);
        break;
      case 'meta': this.h.onMeta?.(msg); break;
      case 's': this.onSnapshot(msg); break;
      case 'err': this.wantRoom = false; this.h.onError?.(msg.msg); break;
      case 'gone': this.forget(); this.h.onGone?.(); break;
      case 'ended': this.forget(); this.h.onEnded?.(msg.reason); break;
    }
  }

  // ---- snapshots -----------------------------------------------------------------

  resetClock() { this.offset = null; this.snaps = []; }

  onSnapshot(s) {
    const now = performance.now();
    if (s.st < this.lastSt) { this.snaps = []; this.offset = null; } // new run
    this.lastSt = s.st;
    const sample = s.st - now;
    if (this.offset === null || sample > this.offset) this.offset = sample;
    else this.offset += (sample - this.offset) * 0.02;
    s.recv = now;
    s.players = s.p.map((a) => unpackPlayer(a, {}));
    this.snaps.push(s);
    if (this.snaps.length > 40) this.snaps.shift();
    this.latest = s;

    const w = this.world;
    GATE_IDS.forEach((id, i) => { w.open[id] = s.w[i]; });
    w.stairs = s.w[5]; w.stones = s.w[6];
    this.col = buildColliders(w);

    this.h.onSnapshot?.(s);
  }

  // Estimated current server simulation time in seconds.
  serverTime() {
    if (this.offset === null) return 0;
    return (performance.now() + this.offset) / 1000;
  }

  // Partner state interpolated INTERP_DELAY behind the newest snapshot.
  interpolated(slot, out) {
    const n = this.snaps.length;
    if (!n) return null;
    const target = performance.now() + (this.offset ?? 0) - INTERP_DELAY;
    let a = this.snaps[0], b = null;
    for (let i = n - 1; i >= 0; i--) {
      if (this.snaps[i].st <= target) { a = this.snaps[i]; b = this.snaps[i + 1] || null; break; }
    }
    const pa = a.players[slot];
    if (!b) return Object.assign(out, pa);
    const pb = b.players[slot];
    const u = Math.max(0, Math.min(1, (target - a.st) / Math.max(1, b.st - a.st)));
    Object.assign(out, pb);
    out.x = pa.x + (pb.x - pa.x) * u;
    out.y = pa.y + (pb.y - pa.y) * u;
    out.z = pa.z + (pb.z - pa.z) * u;
    out.vx = pa.vx + (pb.vx - pa.vx) * u;
    out.vy = pa.vy + (pb.vy - pa.vy) * u;
    out.vz = pa.vz + (pb.vz - pa.vz) * u;
    let dy = pb.yaw - pa.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    out.yaw = pa.yaw + dy * u;
    return out;
  }

  // ---- input -------------------------------------------------------------------------

  queueInput(cmd) {
    this.outbox.push([cmd.seq, +cmd.jx.toFixed(3), +cmd.jz.toFixed(3), cmd.act ? 1 : 0]);
  }

  flush(now) {
    if (!this.outbox.length) return;
    if (now - this.lastFlush < 45 && this.outbox.length < 4) return;
    this.lastFlush = now;
    this.raw({ t: 'in', c: this.outbox });
    this.outbox = [];
  }
}

// Client-side prediction of our own squishy only.
export class Predictor {
  constructor() {
    this.p = newPlayer(0, 0);
    this.pending = [];
    this.seq = 0;
    this.err = { x: 0, y: 0, z: 0 }; // visual smoothing of corrections
    this.ready = false;
  }

  reset(serverState) {
    copyPlayer(this.p, serverState);
    this.pending = [];
    this.err.x = this.err.y = this.err.z = 0;
    this.ready = true;
  }

  step(input, col, other) {
    const cmd = { seq: ++this.seq, jx: input.jx, jz: input.jz, act: input.act ? 1 : 0 };
    stepPlayer(this.p, cmd, col, other ? [other] : [], DT, 0.5);
    this.pending.push(cmd);
    if (this.pending.length > 120) this.pending.shift();
    return cmd;
  }

  reconcile(server, col, other) {
    if (!this.ready) { this.reset(server); return; }
    const ox = this.p.x, oy = this.p.y, oz = this.p.z;
    const ev = this.p.ev;
    copyPlayer(this.p, server);
    this.pending = this.pending.filter((c) => c.seq > server.ack);
    for (const c of this.pending) stepPlayer(this.p, c, col, other ? [other] : [], DT, 0.5);
    this.p.ev = ev;
    const dx = ox - this.p.x, dy = oy - this.p.y, dz = oz - this.p.z;
    if (dx * dx + dy * dy + dz * dz > 6) { this.err.x = this.err.y = this.err.z = 0; return; }
    this.err.x += dx; this.err.y += dy; this.err.z += dz;
  }

  decay(dt) {
    const k = Math.exp(-dt * 12);
    this.err.x *= k; this.err.y *= k; this.err.z *= k;
  }
}
