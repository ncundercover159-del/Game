// Structural tiles that don't autotile like terrain: tatami, plank and earth floors, plaster walls,
// stone steps and bridge planks. Each is a 16x16 tile; variants break up repetition.
import { grid, set, fillRect } from './raster.js';
import { hashf } from '../core/rng.js';

const T = 16;
const hline = (g, x0, x1, y, c) => { for (let x = x0; x <= x1; x++) set(g, x, y, c); };
const vline = (g, x, y0, y1, c) => { for (let y = y0; y <= y1; y++) set(g, x, y, c); };

/** Tatami: woven straw with an indigo cloth border (heri) along the long edges; 1x2 mats. */
export function tatami(half, rotated) {
  const g = grid(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const weave = rotated ? x : y;
    set(g, x, y, weave % 2 ? 'straw3' : (hashf(x, y, half, 3) > 0.85 ? 'straw4' : 'straw3'));
    if (weave % 2 === 0 && hashf(x >> 2, y >> 2, half, 4) > 0.5) set(g, x, y, 'straw2');
  }
  // Heri borders on the long sides, a seam at the mat's short end.
  if (rotated) { hline(g, 0, 15, 0, 'indigo0'); hline(g, 0, 15, 1, 'indigo1'); hline(g, 0, 15, 15, 'straw1'); }
  else { vline(g, 0, 0, 15, 'indigo0'); vline(g, 1, 0, 15, 'indigo1'); vline(g, 15, 0, 15, 'straw1'); }
  if (half === 1) (rotated ? vline(g, 15, 0, 15, 'straw1') : hline(g, 0, 15, 15, 'straw1'));
  return g;
}

/** Polished floorboards running away from the viewer: 4 px boards, butt joints far apart. */
export function planks(v) {
  const g = grid(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const board = x >> 2, k = x & 3;
    // Each board has at most one joint per tile, and only on some tiles.
    const joint = hashf(board, v, 0, 5) > 0.55 ? Math.floor(hashf(board, v, 0, 6) * 16) : -1;
    let c = k === 3 ? 'wood2' : k === 0 ? 'wood5' : 'wood4';
    if (y === joint && k !== 3) c = 'wood2';
    else if (k === 1 && hashf(x, y >> 1, v, 7) > 0.88) c = 'wood3';
    set(g, x, y, c);
  }
  return g;
}

/** Doma: tamped earth floor of kitchens, workshops and shops. */
export function doma(v) {
  const g = grid(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const h = hashf(x + v * 16, y, 0, 9);
    set(g, x, y, h > 0.93 ? 'wood4' : h < 0.12 ? 'wood2' : 'wood3');
  }
  return g;
}

/** Wall face: plaster above a timber wainscot, a beam along the top. */
export function wallFace(v) {
  const g = grid(T, T);
  fillRect(g, 0, 0, T, 3, 'wood1');
  hline(g, 0, 15, 2, 'wood2');
  fillRect(g, 0, 3, T, 8, 'ink6');
  for (let y = 3; y < 11; y++) set(g, 15, y, 'ink5');
  if (v % 3 === 0) { vline(g, 0, 3, 15, 'wood1'); vline(g, 1, 3, 15, 'wood2'); }
  fillRect(g, 0, 11, T, 5, 'wood2');
  hline(g, 0, 15, 11, 'wood3');
  hline(g, 0, 15, 15, 'wood0');
  for (let x = 4 + (v % 4); x < T; x += 8) vline(g, x, 12, 14, 'wood1');
  return g;
}

/** Top of a wall seen from above (ceiling edge / partition cap). */
export function wallTop() {
  const g = grid(T, T);
  fillRect(g, 0, 0, T, T, 'ink1');
  for (let x = 0; x < T; x += 4) set(g, x, 7, 'ink2');
  return g;
}

/** Stone steps: treads lit from above, dark risers every 4 px. */
export function steps(v) {
  const g = grid(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const k = y & 3;
    let c = k === 3 ? 'stone1' : k === 0 ? 'stone4' : 'stone3';
    if (k !== 3 && hashf(x, y, v, 8) > 0.9) c = 'stone2';
    if (((x + (y >> 2) * 5 + v * 3) % 11) === 0 && k !== 0) c = 'stone1';
    set(g, x, y, c);
  }
  return g;
}

/** Bridge planks across the span, with the side rail on the tile's west or east edge. */
export function bridge(v, railW, railE) {
  const g = grid(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    let c = (y & 3) === 3 ? 'wood1' : (y & 3) === 0 ? 'wood5' : 'wood4';
    if ((y & 3) !== 3 && hashf(x, y >> 2, v, 12) > 0.92) c = 'wood3';
    set(g, x, y, c);
  }
  if (railW) { fillRect(g, 0, 0, 3, T, 'red2'); vline(g, 0, 0, 15, 'red1'); vline(g, 2, 0, 15, 'red3'); }
  if (railE) { fillRect(g, 13, 0, 3, T, 'red2'); vline(g, 15, 0, 15, 'red0'); vline(g, 13, 0, 15, 'red3'); }
  return g;
}

export function voidTile() {
  const g = grid(T, T);
  fillRect(g, 0, 0, T, T, 'ink0');
  return g;
}

/** Cliff face: layered rock, lit on top, a mossy lip when grass is above, shadowed at its foot. */
export function cliff(v, lip, foot) {
  const g = grid(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const band = (y + (v * 3) + ((x >> 2) % 2)) % 5;
    let c = band === 0 ? 'stone1' : band === 1 ? 'stone3' : 'stone2';
    if (hashf(x, y, v, 21) > 0.9) c = 'stone0';
    set(g, x, y, c);
  }
  if (lip) { hline(g, 0, 15, 0, 'grass3'); hline(g, 0, 15, 1, 'grass2'); for (let x = v % 3; x < T; x += 3) set(g, x, 2, 'grass1'); }
  if (foot) { hline(g, 0, 15, 13, 'stone1'); hline(g, 0, 15, 14, 'stone0'); hline(g, 0, 15, 15, 'ink1'); }
  return g;
}

/** Waterfall column, 4 frames: streaks sliding down, darker edges, foam where it meets the pool. */
export function falls(v, frame, left, right, foot) {
  const g = grid(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const s = (hashf(x, 0, v, 23) * 16 + y - frame * 4 + 64) % 16;
    let c = s < 3 ? 'ink6' : s < 7 ? 'water4' : s < 12 ? 'water3' : 'water2';
    if ((left && x < 2) || (right && x > 13)) c = 'water1';
    set(g, x, y, c);
  }
  if (foot) for (let x = 0; x < T; x++) for (let y = 12; y < T; y++) if (hashf(x, y, frame, 24) > 0.35) set(g, x, y, y > 13 ? 'ink6' : 'water4');
  return g;
}
