// RERUN 2D — recordings.
//
// Transforms, not inputs. In two dimensions a sample is x, y and a flag byte
// (dead / grounded / facing), so a whole twenty-second ghost is 2000 bytes in
// a fixed buffer that is allocated once and never grown.

import {
  SAMPLES_PER_GHOST, RECORD_INTERVAL_MS, ROUND_MS, GRAVITY, MAX_FALL,
  DEATH_REST_Y,
} from './constants.js';

export const POS_SCALE = 1000; // millimetres
export const F_DEAD = 1;
export const F_GROUNDED = 2;
export const F_FACE_LEFT = 4;

export function createRecording() {
  return {
    pos: new Int16Array(SAMPLES_PER_GHOST * 2),
    flags: new Uint8Array(SAMPLES_PER_GHOST),
    stride: new Float32Array(SAMPLES_PER_GHOST),
  };
}

const q = (v) => Math.max(-32767, Math.min(32767, Math.round(v * POS_SCALE)));

export function writeSample(rec, i, x, y, flags) {
  rec.pos[i * 2] = q(x);
  rec.pos[i * 2 + 1] = q(y);
  rec.flags[i] = flags;
}

export function fillForward(rec, from, to) {
  const x = rec.pos[from * 2], y = rec.pos[from * 2 + 1], f = rec.flags[from];
  for (let i = from + 1; i <= to; i++) {
    rec.pos[i * 2] = x; rec.pos[i * 2 + 1] = y; rec.flags[i] = f;
  }
}

/**
 * Cumulative ground distance, one entry per sample.
 * The walk cycle runs off this rather than off wall-clock time, so the feet
 * match the floor instead of skating, and the phase is a property of the tape.
 */
export function buildStride(rec) {
  let d = 0;
  rec.stride[0] = 0;
  for (let i = 1; i < SAMPLES_PER_GHOST; i++) {
    d += Math.abs(rec.pos[i * 2] - rec.pos[(i - 1) * 2]) / POS_SCALE;
    rec.stride[i] = d;
  }
  return rec.stride;
}

/**
 * Murder, written into the tape.
 *
 * Nothing is erased — the ghost still runs its first `i` samples exactly as it
 * always did. From `i` onward it is dead, and falls out of the building. So the
 * killing replays too: every twenty seconds, at the same instant, forever.
 * Returns false if it was already dead there.
 */
export function killFrom(rec, i) {
  if (rec.flags[i] & F_DEAD) return false;
  let x = rec.pos[i * 2] / POS_SCALE;
  let y = rec.pos[i * 2 + 1] / POS_SCALE;
  let vy = 0;
  const dt = RECORD_INTERVAL_MS / 1000;
  const held = rec.stride[i];
  for (let k = i; k < SAMPLES_PER_GHOST; k++) {
    writeSample(rec, k, x, y, F_DEAD | (rec.flags[k] & F_FACE_LEFT));
    rec.stride[k] = held; // a corpse covers no ground
    vy = Math.max(vy - GRAVITY * dt, -MAX_FALL);
    y += vy * dt;
    if (y <= DEATH_REST_Y) { y = DEATH_REST_Y; vy = 0; }
  }
  return true;
}

export function makeSample() {
  return { x: 0, y: 0, vx: 0, vy: 0, facing: 1, dead: false, grounded: true, dist: 0, index: 0 };
}

/** Sample the loop at `tMs`, interpolating between the 20Hz keyframes. */
export function sampleAt(rec, tMs, out) {
  let t = tMs % ROUND_MS;
  if (t < 0) t += ROUND_MS;
  const f = t / RECORD_INTERVAL_MS;
  let i0 = Math.floor(f);
  if (i0 < 0) i0 = 0;
  if (i0 > SAMPLES_PER_GHOST - 1) i0 = SAMPLES_PER_GHOST - 1;
  const i1 = Math.min(i0 + 1, SAMPLES_PER_GHOST - 1);
  const a = f - i0;

  const x0 = rec.pos[i0 * 2] / POS_SCALE, y0 = rec.pos[i0 * 2 + 1] / POS_SCALE;
  const x1 = rec.pos[i1 * 2] / POS_SCALE, y1 = rec.pos[i1 * 2 + 1] / POS_SCALE;
  const per = 1000 / RECORD_INTERVAL_MS;

  out.x = x0 + (x1 - x0) * a;
  out.y = y0 + (y1 - y0) * a;
  out.vx = (x1 - x0) * per;
  out.vy = (y1 - y0) * per;
  const fl = rec.flags[i0];
  out.dead = (fl & F_DEAD) !== 0;
  out.grounded = (fl & F_GROUNDED) !== 0;
  out.facing = (fl & F_FACE_LEFT) ? -1 : 1;
  out.dist = rec.stride[i0] + (rec.stride[i1] - rec.stride[i0]) * a;
  out.index = i0;
  return out;
}
