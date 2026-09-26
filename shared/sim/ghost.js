// Time-trial ghosts: kart pose samples at 20 Hz, delta + zig-zag varint encoded
// into a compact URL-safe string. Used for the player's best ghost, staff
// ghosts (generated offline by expert AI) and share codes.
//
// Ghost object: { v, track, racer, vehicle, wheels, glider, time, laps: [...], hz, frames }
// frames: flat array [x, y, z, yaw, flags, ...] (x/y/z in cm, yaw in mrad)
//   flags: bit0 drift-left, bit1 drift-right, bit2 boosting, bit3 airborne, bit4 glider

export const GHOST_VERSION = 1;
export const GHOST_HZ = 20;
const FIELDS = 5;

export class GhostRecorder {
  constructor(kart, meta = {}) {
    this.k = kart;
    this.meta = meta;
    this.frames = [];
    this.tick = 0;
    this.every = Math.round(60 / GHOST_HZ);
  }

  // call once per sim tick while racing
  step() {
    if (this.tick++ % this.every) return;
    const k = this.k;
    const flags = (k.drift < 0 ? 1 : 0) | (k.drift > 0 ? 2 : 0) | (k.boostTime > 0 ? 4 : 0) | (!k.grounded ? 8 : 0) | (k.glider ? 16 : 0);
    const r = (v) => Math.round(v) || 0; // no negative zeros
    this.frames.push(r(k.x * 100), r(k.y * 100), r(k.z * 100), r(wrap(k.yaw) * 1000), flags);
  }

  finish(time, laps) {
    return { v: GHOST_VERSION, ...this.meta, time, laps: laps.map((t) => Math.round(t * 1000) / 1000), hz: GHOST_HZ, frames: this.frames };
  }
}

function wrap(a) {
  a %= Math.PI * 2;
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// --- playback --------------------------------------------------------------------------
// Pose at race time t (seconds since GO): interpolated position/yaw + flags.
export function ghostPose(g, t, out = {}) {
  const n = g.frames.length / FIELDS;
  if (!n) return null;
  const f = Math.max(0, Math.min(n - 1.001, t * g.hz));
  const i = Math.floor(f), u = f - i;
  const a = i * FIELDS, b = Math.min(n - 1, i + 1) * FIELDS;
  const F = g.frames;
  out.x = (F[a] + (F[b] - F[a]) * u) / 100;
  out.y = (F[a + 1] + (F[b + 1] - F[a + 1]) * u) / 100;
  out.z = (F[a + 2] + (F[b + 2] - F[a + 2]) * u) / 100;
  let dy = (F[b + 3] - F[a + 3]) / 1000;
  if (dy > Math.PI) dy -= Math.PI * 2;
  if (dy < -Math.PI) dy += Math.PI * 2;
  out.yaw = F[a + 3] / 1000 + dy * u;
  const fl = F[a + 4];
  out.drift = fl & 1 ? -1 : fl & 2 ? 1 : 0;
  out.boostTime = fl & 4 ? 1 : 0;
  out.grounded = !(fl & 8);
  out.glider = !!(fl & 16);
  out.done = f >= n - 1.01;
  return out;
}

// --- encoding --------------------------------------------------------------------------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function bytesToB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0;
    const n = (a << 16) | (b << 8) | c;
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) s += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) s += B64[n & 63];
  }
  return s;
}

function b64ToBytes(s) {
  const out = [];
  for (let i = 0; i < s.length; i += 4) {
    const v = [0, 1, 2, 3].map((k) => (i + k < s.length ? B64.indexOf(s[i + k]) : 0));
    if (v.some((x) => x < 0)) throw new Error('bad ghost code');
    const n = (v[0] << 18) | (v[1] << 12) | (v[2] << 6) | v[3];
    out.push((n >> 16) & 255);
    if (i + 2 < s.length) out.push((n >> 8) & 255);
    if (i + 3 < s.length) out.push(n & 255);
  }
  return out;
}

function writeVar(out, n) {
  let z = n < 0 ? -n * 2 - 1 : n * 2; // zig-zag
  while (z >= 128) { out.push((z & 127) | 128); z = Math.floor(z / 128); }
  out.push(z);
}

function readVar(bytes, pos) {
  let n = 0, mul = 1, b;
  do { b = bytes[pos.i++]; n += (b & 127) * mul; mul *= 128; } while (b & 128);
  return n & 1 ? -(n + 1) / 2 : n / 2;
}

const utf8 = (s) => [...new TextEncoder().encode(s)];

// Ghost -> "G1.<base64url>"
export function encodeGhost(g) {
  const head = JSON.stringify({ t: g.track, r: g.racer, v: g.vehicle, w: g.wheels, g: g.glider, tm: g.time, l: g.laps, hz: g.hz, n: g.name });
  const out = [];
  const hb = utf8(head);
  writeVar(out, hb.length);
  out.push(...hb);
  const F = g.frames;
  writeVar(out, F.length / FIELDS);
  const prev = [0, 0, 0, 0, 0];
  for (let i = 0; i < F.length; i += FIELDS) {
    for (let f = 0; f < FIELDS; f++) {
      writeVar(out, f === 4 ? F[i + f] : F[i + f] - prev[f]);
      prev[f] = F[i + f];
    }
  }
  return `G${GHOST_VERSION}.${bytesToB64(out)}`;
}

export function decodeGhost(code) {
  const m = /^G(\d+)\.([A-Za-z0-9_-]+)$/.exec(String(code).trim());
  if (!m) throw new Error('Not a ghost code');
  const bytes = b64ToBytes(m[2]);
  const pos = { i: 0 };
  const hl = readVar(bytes, pos);
  const head = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes.slice(pos.i, pos.i + hl))));
  pos.i += hl;
  const n = readVar(bytes, pos);
  const frames = new Array(n * FIELDS);
  const prev = [0, 0, 0, 0, 0];
  for (let k = 0; k < n; k++) {
    for (let f = 0; f < FIELDS; f++) {
      const d = readVar(bytes, pos);
      const v = f === 4 ? d : prev[f] + d;
      frames[k * FIELDS + f] = v;
      prev[f] = v;
    }
  }
  return { v: +m[1], track: head.t, racer: head.r, vehicle: head.v, wheels: head.w, glider: head.g, time: head.tm, laps: head.l, hz: head.hz, name: head.n, frames };
}

// Medal thresholds relative to the staff ghost time.
export function medalFor(time, staffTime) {
  if (!staffTime || !time) return null;
  if (time <= staffTime) return 'gold';
  if (time <= staffTime * 1.05) return 'silver';
  if (time <= staffTime * 1.12) return 'bronze';
  return null;
}
