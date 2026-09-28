// Seeded, deterministic randomness. The simulation never calls Math.random.

/** 32-bit integer hash of up to three integers plus a seed (lowbias32-style mixing). */
export function hash(a, b = 0, c = 0, seed = 0) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (a | 0), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15) ^ (b | 0), 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 13) ^ (c | 0), 0x27d4eb2f);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  return h >>> 0;
}

/** Hash to a float in [0, 1). */
export function hashf(a, b = 0, c = 0, seed = 0) {
  return hash(a, b, c, seed) / 4294967296;
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export class Rng {
  constructor(seed = 1) {
    this.s = (seed >>> 0) || 1;
  }
  /** mulberry32 */
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  float(a = 0, b = 1) { return a + (b - a) * this.next(); }
  /** Integer in [a, b] inclusive. */
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  /** Weighted pick from [[value, weight], ...]. */
  weighted(pairs) {
    let total = 0;
    for (const [, w] of pairs) total += w;
    let r = this.next() * total;
    for (const [v, w] of pairs) if ((r -= w) < 0) return v;
    return pairs[pairs.length - 1][0];
  }
  state() { return this.s; }
  setState(s) { this.s = s >>> 0; }
}

/** Smooth value noise on a lattice of `cell` pixels, tileable with period `period` pixels. */
export function valueNoise(x, y, cell, period, seed) {
  const cells = Math.max(1, Math.round(period / cell));
  const gx = x / cell, gy = y / cell;
  const x0 = Math.floor(gx), y0 = Math.floor(gy);
  const fx = gx - x0, fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const m = (v) => ((v % cells) + cells) % cells;
  const v00 = hashf(m(x0), m(y0), 0, seed), v10 = hashf(m(x0 + 1), m(y0), 0, seed);
  const v01 = hashf(m(x0), m(y0 + 1), 0, seed), v11 = hashf(m(x0 + 1), m(y0 + 1), 0, seed);
  return (v00 * (1 - sx) + v10 * sx) * (1 - sy) + (v01 * (1 - sx) + v11 * sx) * sy;
}
