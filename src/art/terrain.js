// Procedural terrain tiles with autotiled, hand-made-looking borders.
//
// Every layered terrain (land, grass, tilled soil, path) is generated per 3x3 neighbourhood mask:
// occupancy of the 48x48 super-tile is box-blurred and thresholded against tileable noise, which
// yields rounded outer corners, filled inner corners and slightly ragged, seam-free edges.
// Masks are reduced to the canonical 47 "blob" cases before generation (see canonical9).
import { grid, set } from './raster.js';
import { idx } from './palette.js';
import { hashf, valueNoise } from '../core/rng.js';

export const T = 16;
const S = 48;

// 3x3 bit layout: bit = ty * 3 + tx, centre is bit 4.
export const BIT = { NW: 0, N: 1, NE: 2, W: 3, C: 4, E: 5, SW: 6, S: 7, SE: 8 };

/** Drop diagonal bits whose two adjacent orthogonal neighbours are not both set. */
export function canonical9(m) {
  const has = (b) => (m >> b) & 1;
  let out = m;
  if (!(has(BIT.N) && has(BIT.W))) out &= ~(1 << BIT.NW);
  if (!(has(BIT.N) && has(BIT.E))) out &= ~(1 << BIT.NE);
  if (!(has(BIT.S) && has(BIT.W))) out &= ~(1 << BIT.SW);
  if (!(has(BIT.S) && has(BIT.E))) out &= ~(1 << BIT.SE);
  return out;
}

/** All canonical masks with the centre set: exactly the 47 blob tiles. */
export function blobMasks() {
  const set47 = new Set();
  for (let m = 0; m < 512; m++) if (m & (1 << BIT.C)) set47.add(canonical9(m));
  return [...set47].sort((a, b) => a - b);
}

/** Build a 3x3 mask for tile (x, y) where pred(x, y) says whether a cell belongs to the terrain. */
export function mask9At(pred, x, y) {
  let m = 0;
  for (let ty = 0; ty < 3; ty++) for (let tx = 0; tx < 3; tx++) {
    if (pred(x + tx - 1, y + ty - 1)) m |= 1 << (ty * 3 + tx);
  }
  return m;
}

// Blurred occupancy of the 48x48 super-tile, via a summed-area table.
function blurField(m, r) {
  const occ = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    occ[y * S + x] = (m >> (((y / T) | 0) * 3 + ((x / T) | 0))) & 1;
  }
  const sat = new Float32Array((S + 1) * (S + 1));
  for (let y = 0; y < S; y++) {
    let row = 0;
    for (let x = 0; x < S; x++) {
      row += occ[y * S + x];
      sat[(y + 1) * (S + 1) + x + 1] = sat[y * (S + 1) + x + 1] + row;
    }
  }
  const out = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r);
    const x1 = Math.min(S, x + r + 1), y1 = Math.min(S, y + r + 1);
    const sum = sat[y1 * (S + 1) + x1] - sat[y0 * (S + 1) + x1] - sat[y1 * (S + 1) + x0] + sat[y0 * (S + 1) + x0];
    out[y * S + x] = sum / ((x1 - x0) * (y1 - y0));
  }
  return out;
}

/**
 * Inside/outside map for the super-tile. `jitter` scales the tileable noise on the threshold so
 * edges are organic; noise uses tile-local coordinates (period 16) so neighbouring tiles agree.
 */
function insideMap(m, { r = 5, t = 0.6, jitter = 0.1, seed = 1 } = {}) {
  const f = blurField(m, r);
  const inside = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = jitter ? (valueNoise(x & 15, y & 15, 2, 16, seed) - 0.5) * 2 * jitter : 0;
    inside[y * S + x] = f[y * S + x] > t + n ? 1 : 0;
  }
  return inside;
}

// Distance (in pixels, capped) from centre-tile pixel (x, y) to the first outside pixel going (dx, dy).
function run(inside, x, y, dx, dy, cap = 6) {
  for (let k = 1; k <= cap; k++) {
    const sx = x + T + dx * k, sy = y + T + dy * k;
    if (sx < 0 || sy < 0 || sx >= S || sy >= S) return cap + 1;
    if (!inside[sy * S + sx]) return k;
  }
  return cap + 1;
}

const I = (name) => idx(name);

// Textures repeat every 64px. A tile's variant v (0-15) picks which 16px window of that space it
// shows, so neighbouring tiles continue the same texture without visible repetition.
const P = 64;
export const variantAt = (tx, ty) => (tx & 3) | ((ty & 3) << 2);
const wx = (x, v) => x + ((v & 3) << 4);
const wy = (y, v) => y + ((v >> 2) << 4);

// ---------------------------------------------------------------- base textures (tileable, 16px)

/** Grass: dense 2x1 speckle in four greens with sparse blade marks, like the reference turf. */
export function grassTex(x, y, pal = GRASS_PAL) {
  const low = valueNoise(x, y, 4, P, 101) * 0.6 + valueNoise(x, y, 16, P, 102) * 0.4;
  const dash = hashf((x + (y & 1)) >> 1, y, 0, 7);
  const t = low * 0.3 + dash * 0.7;
  // Blade marks: a light tip over a dark stroke, scattered by hash.
  if (hashf(x, y, 0, 33) > 0.96) return pal.hi;
  if (hashf(x, (y - 1) & 63, 0, 33) > 0.96) return pal.deep;
  if (t < 0.2) return pal.dark;
  if (t < 0.64) return pal.mid;
  if (t < 0.93) return pal.light;
  return pal.hi;
}
const GRASS_PAL = { deep: 'grass2', dark: 'grass3', mid: 'grass4', light: 'grass5', hi: 'grass6', edge: 'grass1', lip: 'grass2' };

/** Bare earth: warm brown grit in 2x1 flecks with the odd pebble. */
export function dirtTex(x, y) {
  const low = valueNoise(x, y, 4, P, 211) * 0.6 + valueNoise(x, y, 16, P, 212) * 0.4;
  const h = hashf((x + (y & 1)) >> 1, y, 0, 17);
  const p = hashf(x, y, 0, 18);
  if (p > 0.988) return 'stone4';
  if (hashf((x - 1) & 63, y, 0, 18) > 0.988) return 'stone2';
  // Sparse lumps: a lit top over a shadowed underside.
  const lump = (lx, ly) => hashf(lx >> 1, ly & 63, 0, 19) > 0.955;
  if (lump(x, y)) return 'wood5';
  if (lump(x, (y - 1) & 63)) return 'wood2';
  const t = low * 0.35 + h * 0.65;
  if (t < 0.2) return 'wood3';
  if (t > 0.86) return 'wood5';
  return 'wood4';
}

/** Tilled soil: dark loam broken into clods, each lit on top and shadowed below. Wet is darker. */
export function tilledTex(x, y, wet) {
  const w = (n) => 'wood' + Math.max(0, n - (wet ? 1 : 0));
  const clod = (cx, cy) => hashf(cx >> 1, cy & 63, 0, 19) > 0.62 && ((cy + (cx >> 2)) % 3) !== 0;
  if (clod(x, y)) return hashf(x, y, 0, 20) > 0.7 ? w(4) : w(3);
  if (clod(x, y - 1)) return w(1);
  return hashf(x, y, 0, 21) < 0.1 ? w(1) : w(2);
}

/** Water: deep blue with short ripple dashes that shimmer in and out over 4 frames. */
export function waterTex(x, y, frame) {
  const low = valueNoise(x, y, 16, P, 404) * 0.5 + valueNoise(x, y, 4, P, 405) * 0.5;
  if ((y & 3) === 1) {
    const off = Math.floor(hashf(y >> 2, 0, 0, 55) * P);
    const cx = ((x + off) & 63) >> 3;              // eight dash cells per 64px row
    const lx = (x + off) & 7;
    const phase = Math.floor(hashf(cx, y >> 2, 0, 56) * 4);
    const len = [1, 3, 4, 2][(frame + phase) & 3];
    const start = 2 + Math.floor(hashf(cx, y >> 2, 0, 57) * 2);
    if (lx >= start && lx < start + len) return len >= 3 && lx === start + 1 ? 'water4' : 'water3';
  }
  return low < 0.45 ? 'water1' : 'water2';
}

// Cobbles: jittered Voronoi cells on a 12x12 lattice that tiles over the 64px texture period.
const CN = 12, CS = P / CN;
function cobble(x, y) {
  let best = 1e9, second = 1e9, bestId = 0;
  const gx0 = Math.floor(x / CS), gy0 = Math.floor(y / CS);
  for (let gy = gy0 - 1; gy <= gy0 + 1; gy++) for (let gx = gx0 - 1; gx <= gx0 + 1; gx++) {
    const cx = ((gx % CN) + CN) % CN, cy = ((gy % CN) + CN) % CN;
    const px = (gx + 0.2 + hashf(cx, cy, 0, 71) * 0.6) * CS;
    const py = (gy + 0.2 + hashf(cx, cy, 0, 72) * 0.6) * CS;
    const d = (x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2;
    if (d < best) { second = best; best = d; bestId = cy * CN + cx; } else if (d < second) second = d;
  }
  return { edge: Math.sqrt(second) - Math.sqrt(best), id: bestId };
}

export function pathTex(x, y) {
  const { edge, id } = cobble(x, y);
  if (edge < 0.8) return 'wood2';
  if (edge < 1.5) return 'stone1';
  // Light from the top-left: pixels near a stone's upper-left rim are lighter.
  const tone = hashf(id, 0, 0, 5) > 0.5 ? 3 : 2;
  if (cobble(x - 1, y - 1).edge < 1.5) return 'stone' + Math.min(4, tone + 1);
  if (cobble(x + 1, y + 1).edge < 1.5) return 'stone' + (tone - 1);
  return 'stone' + tone;
}

// ---------------------------------------------------------------- layered tile generators

/**
 * Land tile: the earth surface, opaque up to the tile edge except rounded corners where it meets
 * water. The bank's vertical face is drawn by the water tile below it (3/4 view).
 */
export function landTile(m, v) {
  const inside = insideMap(m, LAND_EDGE);
  const g = grid(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    if (!inside[(y + T) * S + x + T]) continue;
    const s = run(inside, x, y, 0, 1, 2), n = run(inside, x, y, 0, -1, 2);
    const e = run(inside, x, y, 1, 0, 2), w = run(inside, x, y, -1, 0, 2);
    let c = dirtTex(wx(x, v), wy(y, v));
    if (n === 1 || e === 1 || w === 1) c = 'wood2';
    else if (s === 1) c = 'wood5';
    set(g, x, y, I(c));
  }
  return g;
}
const LAND_EDGE = { r: 5, t: 0.5, jitter: 0.08, seed: 11 };
const BANK = 4;

/**
 * Water under and around land. `m` is the water occupancy of the 3x3 (the centre may be land,
 * so rounded land corners reveal water). Land to the north casts a striated earth bank face and
 * a shadow band; foam hugs every other shoreline.
 */
export function waterTile(m, v, frame) {
  const land = insideMap(~m & 511, LAND_EDGE);
  const g = grid(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    let c = waterTex(wx(x, v), wy(y, v), frame);
    const up = landAbove(land, x, y);
    const near = nearLand(land, x, y);
    if (land[(y + T) * S + x + T]) c = 'wood1';
    else if (up <= BANK) c = up === BANK ? 'wood1' : (x * 5 + up * 3) % 7 === 0 ? 'wood2' : up === 1 ? 'wood3' : 'wood2';
    else if (up <= BANK + 2) c = up === BANK + 1 && hashf(x, frame, 0, 3) > 0.5 ? 'water3' : 'water0';
    else if (near === 1) c = hashf(x, y, frame, 3) > 0.3 ? 'water4' : 'water3';
    else if (near === 2 && hashf(x >> 1, y, frame, 4) > 0.65) c = 'water3';
    set(g, x, y, I(c));
  }
  return g;
}

function nearLand(land, x, y) {
  let best = 9;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (land[(y + T + dy) * S + x + T + dx]) best = Math.min(best, Math.max(Math.abs(dx), Math.abs(dy)));
  }
  return best;
}

function landAbove(land, x, y) {
  for (let k = 1; k <= BANK + 3; k++) if (land[(y + T - k) * S + x + T]) return k;
  return 99;
}

/** Grass overlay: grass texture inside, a dark rim at the edge, a shadow lip on south edges. */
export function grassTile(m, v, pal = GRASS_PAL) {
  const inside = insideMap(m, { r: 5, t: 0.58, jitter: 0.14, seed: 23 });
  const g = grid(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    if (!inside[(y + T) * S + x + T]) {
      // The turf's lip casts a thin shadow on the earth below it.
      if (inside[(y + T - 1) * S + x + T]) set(g, x, y, I('wood2'));
      continue;
    }
    const s = run(inside, x, y, 0, 1, 3), n = run(inside, x, y, 0, -1, 3);
    const e = run(inside, x, y, 1, 0, 3), w = run(inside, x, y, -1, 0, 3);
    let c;
    if (s === 1 || n === 1 || e === 1 || w === 1) c = pal.edge;
    else if (s === 2) c = pal.lip;
    else if (n === 2) c = pal.light;
    else c = grassTex(wx(x, v), wy(y, v), pal);
    set(g, x, y, I(c));
  }
  return g;
}

/** Tilled soil overlay with a crisp dark rim; wet soil uses the darker ramp window. */
export function tilledTile(m, v, wet) {
  const inside = insideMap(m, { r: 3, t: 0.56, jitter: 0.04, seed: 31 });
  const g = grid(T, T);
  const d = wet ? 1 : 0;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    if (!inside[(y + T) * S + x + T]) continue;
    const s = run(inside, x, y, 0, 1, 3), n = run(inside, x, y, 0, -1, 3);
    const e = run(inside, x, y, 1, 0, 3), w = run(inside, x, y, -1, 0, 3);
    let c;
    if (s === 1 || e === 1 || w === 1 || n === 1) c = wet ? 'wood0' : 'wood1';
    else if (n === 2) c = wet ? 'wood2' : 'wood3';
    else if (s === 2) c = wet ? 'wood0' : 'wood1';
    else c = tilledTex(wx(x, v), wy(y, v), wet);
    set(g, x, y, I(c));
  }
  return g;
}

/** Cobbled path overlay. */
export function pathTile(m, v) {
  const inside = insideMap(m, { r: 4, t: 0.6, jitter: 0.1, seed: 41 });
  const g = grid(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    if (!inside[(y + T) * S + x + T]) continue;
    set(g, x, y, I(pathTex(wx(x, v), wy(y, v))));
  }
  return g;
}
