// HAZARD PAY — the wire.
//
// Control traffic is JSON because it is rare and readable. State is binary
// because it is 20Hz and full of transforms, and JSON floats would be four
// times the size for no benefit.
//
// The one bandwidth trick that matters: Rapier puts idle bodies to sleep, and a
// job site is mostly idle. Snapshots carry only awake props plus the final
// resting transform of anything that fell asleep this tick, so a warehouse with
// two hundred crates costs almost nothing until somebody knocks a shelf over.

import { POS_SCALE } from './tune.js';

export const MSG = {
  INPUT: 1,      // client -> server
  SNAPSHOT: 2,   // server -> client
  LEVEL: 3,      // server -> client, the static build (sent once on join)
};

export const PFLAG = {
  ALIVE: 1 << 0,
  RAGDOLL: 1 << 1,
  DOWNED: 1 << 2,
  GROUNDED: 1 << 3,
  SPRINT: 1 << 4,
  CROUCH: 1 << 5,
  HAULING: 1 << 6,
};

export const OFLAG = {
  ASLEEP: 1 << 0,
  HELD: 1 << 1,
  BROKEN: 1 << 2,
  EXTRACTED: 1 << 3,
};

// --- a growable little-endian writer ---------------------------------------
export class Writer {
  constructor(size = 2048) {
    this.buf = new ArrayBuffer(size);
    this.dv = new DataView(this.buf);
    this.u8 = new Uint8Array(this.buf);
    this.o = 0;
  }

  need(n) {
    if (this.o + n <= this.buf.byteLength) return;
    let cap = this.buf.byteLength * 2;
    while (cap < this.o + n) cap *= 2;
    const next = new ArrayBuffer(cap);
    new Uint8Array(next).set(this.u8);
    this.buf = next;
    this.dv = new DataView(next);
    this.u8 = new Uint8Array(next);
  }

  u8w(v) { this.need(1); this.dv.setUint8(this.o, v); this.o += 1; }
  i8w(v) { this.need(1); this.dv.setInt8(this.o, v); this.o += 1; }
  u16w(v) { this.need(2); this.dv.setUint16(this.o, v, true); this.o += 2; }
  i16w(v) { this.need(2); this.dv.setInt16(this.o, v, true); this.o += 2; }
  u32w(v) { this.need(4); this.dv.setUint32(this.o, v >>> 0, true); this.o += 4; }
  f32w(v) { this.need(4); this.dv.setFloat32(this.o, v, true); this.o += 4; }

  /** Position, centimetre precision, +/-327m. */
  posw(x, y, z) {
    this.i16w(clampI16(Math.round(x * POS_SCALE)));
    this.i16w(clampI16(Math.round(y * POS_SCALE)));
    this.i16w(clampI16(Math.round(z * POS_SCALE)));
  }

  quatw(x, y, z, w) { this.u32w(packQuat(x, y, z, w)); }

  /** Angle in radians, +/-3.2767. */
  angw(a) { this.i16w(clampI16(Math.round(a * 10000))); }

  bytes() { return this.buf.slice(0, this.o); }
}

export class Reader {
  constructor(buf) {
    this.dv = new DataView(buf);
    this.u8 = new Uint8Array(buf);
    this.o = 0;
    this.len = buf.byteLength;
  }

  get done() { return this.o >= this.len; }

  u8r() { const v = this.dv.getUint8(this.o); this.o += 1; return v; }
  i8r() { const v = this.dv.getInt8(this.o); this.o += 1; return v; }
  u16r() { const v = this.dv.getUint16(this.o, true); this.o += 2; return v; }
  i16r() { const v = this.dv.getInt16(this.o, true); this.o += 2; return v; }
  u32r() { const v = this.dv.getUint32(this.o, true); this.o += 4; return v; }
  f32r() { const v = this.dv.getFloat32(this.o, true); this.o += 4; return v; }

  posr(out) {
    out.x = this.i16r() / POS_SCALE;
    out.y = this.i16r() / POS_SCALE;
    out.z = this.i16r() / POS_SCALE;
    return out;
  }

  quatr(out) { return unpackQuat(this.u32r(), out); }
  angr() { return this.i16r() / 10000; }
}

// --- smallest-three quaternion compression ---------------------------------
// A unit quaternion has three degrees of freedom, so storing four floats wastes
// a third of the bits before you even start. Drop the largest component (it is
// recoverable, and its sign can be normalised away), store its index in two
// bits and the other three in ten bits each: 32 bits for a rotation that is
// accurate to about a tenth of a degree. At 20Hz with two hundred bodies that
// is the difference between 48KB/s and 26KB/s.

const SQRT1_2 = Math.SQRT1_2;
const TEN_BIT = 511;

export function packQuat(x, y, z, w) {
  // Normalise, and flip so the largest component is positive — that makes its
  // sign redundant, which is what buys the fourth component's bits.
  let n = Math.hypot(x, y, z, w);
  if (n < 1e-8) return 3 << 30; // identity
  n = 1 / n;
  x *= n; y *= n; z *= n; w *= n;

  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z), aw = Math.abs(w);
  let largest = 0, maxv = ax;
  if (ay > maxv) { largest = 1; maxv = ay; }
  if (az > maxv) { largest = 2; maxv = az; }
  if (aw > maxv) { largest = 3; maxv = aw; }

  const comps = [x, y, z, w];
  if (comps[largest] < 0) { x = -x; y = -y; z = -z; w = -w; comps[0] = x; comps[1] = y; comps[2] = z; comps[3] = w; }

  let out = largest << 30;
  let shift = 20;
  for (let i = 0; i < 4; i++) {
    if (i === largest) continue;
    const q = Math.round((comps[i] / SQRT1_2) * TEN_BIT);
    const c = q < -TEN_BIT ? -TEN_BIT : q > TEN_BIT ? TEN_BIT : q;
    out |= ((c + 512) & 0x3ff) << shift;
    shift -= 10;
  }
  return out >>> 0;
}

export function unpackQuat(packed, out) {
  const largest = (packed >>> 30) & 3;
  const c = [0, 0, 0, 0];
  let shift = 20;
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    if (i === largest) continue;
    const raw = ((packed >>> shift) & 0x3ff) - 512;
    const v = (raw / TEN_BIT) * SQRT1_2;
    c[i] = v;
    sum += v * v;
    shift -= 10;
  }
  c[largest] = Math.sqrt(Math.max(0, 1 - sum));
  out.x = c[0]; out.y = c[1]; out.z = c[2]; out.w = c[3];
  return out;
}

function clampI16(v) { return v < -32768 ? -32768 : v > 32767 ? 32767 : v; }

// --- input ------------------------------------------------------------------
// 30Hz, twelve bytes. The sequence number is what the server echoes back so the
// client knows how much of its predicted movement has been confirmed.
export function writeInput(w, seq, moveX, moveY, yaw, pitch, buttons, holdDist) {
  w.u8w(MSG.INPUT);
  w.u32w(seq);
  w.i8w(Math.max(-127, Math.min(127, Math.round(moveX * 127))));
  w.i8w(Math.max(-127, Math.min(127, Math.round(moveY * 127))));
  w.angw(yaw);
  w.angw(pitch);
  w.u8w(buttons);
  w.u8w(Math.max(0, Math.min(255, Math.round(holdDist * 64))));
}

export function readInput(r) {
  return {
    seq: r.u32r(),
    moveX: r.i8r() / 127,
    moveY: r.i8r() / 127,
    yaw: r.angr(),
    pitch: r.angr(),
    buttons: r.u8r(),
    holdDist: r.u8r() / 64,
  };
}
