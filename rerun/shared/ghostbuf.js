// RERUN — ghost recordings.
//
// We record TRANSFORMS, not inputs. Floating point physics is not
// deterministic across machines and input replay desyncs within seconds.
// 20Hz x 20s = 400 samples. Quantised to int16 (millimetres) that is
// 400 * (3 + 1) * 2 + 400 flag bytes = 3600 bytes per ghost. Fixed size,
// allocated once, never grown.

import { SAMPLES_PER_GHOST, RECORD_INTERVAL_MS, ROUND_MS } from './constants.js';

export const POS_SCALE = 1000; // mm  -> +/- 32.7m
export const YAW_SCALE = 10000; // -> +/- 3.2767 rad

export const FLAG_DEAD = 1;
export const FLAG_GROUNDED = 2;

export const GHOST_BYTES =
  SAMPLES_PER_GHOST * 3 * 2 + SAMPLES_PER_GHOST * 2 + SAMPLES_PER_GHOST;

/** A fixed-size recording buffer. One per ghost, allocated once. */
export function createRecording() {
  return {
    pos: new Int16Array(SAMPLES_PER_GHOST * 3),
    yaw: new Int16Array(SAMPLES_PER_GHOST),
    flags: new Uint8Array(SAMPLES_PER_GHOST),
  };
}

export function writeSample(rec, i, x, y, z, yaw, flags) {
  const o = i * 3;
  rec.pos[o] = Math.max(-32767, Math.min(32767, Math.round(x * POS_SCALE)));
  rec.pos[o + 1] = Math.max(-32767, Math.min(32767, Math.round(y * POS_SCALE)));
  rec.pos[o + 2] = Math.max(-32767, Math.min(32767, Math.round(z * POS_SCALE)));
  rec.yaw[i] = Math.max(-32767, Math.min(32767, Math.round(yaw * YAW_SCALE)));
  rec.flags[i] = flags;
}

/** Copy sample `from` forward into `to` (inclusive) — fills gaps after a stall. */
export function fillForward(rec, from, to) {
  const src = from * 3;
  const x = rec.pos[src], y = rec.pos[src + 1], z = rec.pos[src + 2];
  const yaw = rec.yaw[from], f = rec.flags[from];
  for (let i = from + 1; i <= to; i++) {
    const o = i * 3;
    rec.pos[o] = x; rec.pos[o + 1] = y; rec.pos[o + 2] = z;
    rec.yaw[i] = yaw;
    rec.flags[i] = f;
  }
}

/**
 * Sample a recording at `tMs` within the 20s loop, interpolating between the
 * 20Hz keyframes. Writes into `out` to avoid allocating 60 objects a frame.
 * The same maths runs on the server, so client and server agree.
 * Pass `stride` (from buildStride) to get cumulative distance for animation.
 */
export function sampleAt(rec, tMs, out, stride) {
  let t = tMs % ROUND_MS;
  if (t < 0) t += ROUND_MS;
  const f = t / RECORD_INTERVAL_MS;
  let i0 = Math.floor(f);
  if (i0 < 0) i0 = 0;
  if (i0 > SAMPLES_PER_GHOST - 1) i0 = SAMPLES_PER_GHOST - 1;
  let i1 = i0 + 1;
  if (i1 > SAMPLES_PER_GHOST - 1) i1 = SAMPLES_PER_GHOST - 1;
  const a = f - i0;

  const o0 = i0 * 3, o1 = i1 * 3;
  const x0 = rec.pos[o0] / POS_SCALE, y0 = rec.pos[o0 + 1] / POS_SCALE, z0 = rec.pos[o0 + 2] / POS_SCALE;
  const x1 = rec.pos[o1] / POS_SCALE, y1 = rec.pos[o1 + 1] / POS_SCALE, z1 = rec.pos[o1 + 2] / POS_SCALE;

  out.x = x0 + (x1 - x0) * a;
  out.y = y0 + (y1 - y0) * a;
  out.z = z0 + (z1 - z0) * a;

  const yw0 = rec.yaw[i0] / YAW_SCALE;
  let dyaw = rec.yaw[i1] / YAW_SCALE - yw0;
  while (dyaw > Math.PI) dyaw -= Math.PI * 2;
  while (dyaw < -Math.PI) dyaw += Math.PI * 2;
  out.yaw = yw0 + dyaw * a;

  const perSecond = 1000 / RECORD_INTERVAL_MS;
  out.vx = (x1 - x0) * perSecond;
  out.vy = (y1 - y0) * perSecond;
  out.vz = (z1 - z0) * perSecond;

  out.dead = (rec.flags[i0] & FLAG_DEAD) !== 0;
  out.grounded = (rec.flags[i0] & FLAG_GROUNDED) !== 0;
  out.index = i0;

  if (stride) {
    out.dist = stride[i0] + (stride[i1] - stride[i0]) * a;
  } else {
    out.dist = 0;
  }
  return out;
}

export function makeSampleOut() {
  return {
    x: 0, y: 0, z: 0, yaw: 0, vx: 0, vy: 0, vz: 0,
    dead: false, grounded: true, dist: 0, index: 0,
  };
}

/**
 * Cumulative horizontal distance travelled, one entry per sample.
 *
 * The walk cycle is driven off this rather than off wall-clock time, so a
 * ghost's feet match the ground it covers and every client derives the same
 * phase from the same recording. Computed once when a ghost is decoded — it is
 * derived from the tape, never transmitted.
 */
export function buildStride(rec) {
  const n = rec.yaw.length;
  const out = new Float32Array(n);
  let d = 0;
  for (let i = 1; i < n; i++) {
    const a = (i - 1) * 3, b = i * 3;
    const dx = (rec.pos[b] - rec.pos[a]) / POS_SCALE;
    const dz = (rec.pos[b + 2] - rec.pos[a + 2]) / POS_SCALE;
    d += Math.sqrt(dx * dx + dz * dz);
    out[i] = d;
  }
  return out;
}

// --- wire format ----------------------------------------------------------
// Binary because 400 floats of JSON per ghost is absurd. Sent over the same
// WebSocket; permessage-deflate squeezes the late-join archive burst.
//
//  u8   MSG_GHOSTS
//  u8   isArchive
//  u16  count
//  per ghost:
//    u32 id, u8 slot, u8 gen, u8 round, u8 pad,
//    u32 revealDelayMs, u16 sampleCount,
//    i16 pos[n*3], i16 yaw[n], u8 flags[n]

export const MSG_GHOSTS = 1;
const HEADER = 4;
const PER_GHOST_HEADER = 14;

export function encodeGhosts(ghosts, isArchive) {
  let bytes = HEADER;
  for (const g of ghosts) bytes += PER_GHOST_HEADER + GHOST_BYTES;
  const buf = new ArrayBuffer(bytes);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);

  dv.setUint8(0, MSG_GHOSTS);
  dv.setUint8(1, isArchive ? 1 : 0);
  dv.setUint16(2, ghosts.length);

  let o = HEADER;
  for (const g of ghosts) {
    dv.setUint32(o, g.id); o += 4;
    dv.setUint8(o, g.slot); o += 1;
    dv.setUint8(o, g.gen); o += 1;
    dv.setUint8(o, g.round); o += 1;
    dv.setUint8(o, 0); o += 1;
    dv.setUint32(o, g.revealDelayMs | 0); o += 4;
    dv.setUint16(o, SAMPLES_PER_GHOST); o += 2;

    const n = SAMPLES_PER_GHOST;
    for (let i = 0; i < n * 3; i++) { dv.setInt16(o, g.rec.pos[i]); o += 2; }
    for (let i = 0; i < n; i++) { dv.setInt16(o, g.rec.yaw[i]); o += 2; }
    u8.set(g.rec.flags, o); o += n;
  }
  return buf;
}

export function decodeGhosts(buf) {
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  if (dv.getUint8(0) !== MSG_GHOSTS) return null;
  const isArchive = dv.getUint8(1) === 1;
  const count = dv.getUint16(2);

  const out = [];
  let o = HEADER;
  for (let k = 0; k < count; k++) {
    const id = dv.getUint32(o); o += 4;
    const slot = dv.getUint8(o); o += 1;
    const gen = dv.getUint8(o); o += 1;
    const round = dv.getUint8(o); o += 1;
    o += 1;
    const revealDelayMs = dv.getUint32(o); o += 4;
    const n = dv.getUint16(o); o += 2;

    const rec = {
      pos: new Int16Array(n * 3),
      yaw: new Int16Array(n),
      flags: new Uint8Array(n),
    };
    for (let i = 0; i < n * 3; i++) { rec.pos[i] = dv.getInt16(o); o += 2; }
    for (let i = 0; i < n; i++) { rec.yaw[i] = dv.getInt16(o); o += 2; }
    rec.flags.set(u8.subarray(o, o + n)); o += n;

    out.push({ id, slot, gen, round, revealDelayMs, rec });
  }
  return { isArchive, ghosts: out };
}
