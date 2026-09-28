// More fittings for the new homes (M6): a temple altar, a wooden bath, pickling barrels, a
// carpenter's sawhorse, a magistrate's writing desk, a sword rack, the market stall (yatai), and
// (M7) the dōjō's makiwara post and kyūdō target.
import { grid, set, fillRect, ellipse, outline, polygon } from './raster.js';

const hline = (g, x0, x1, y, c) => { for (let x = x0; x <= x1; x++) set(g, x, y, c); };
const vline = (g, x, y0, y1, c) => { for (let y = y0; y <= y1; y++) set(g, x, y, c); };

/** A small Buddhist altar: black lacquer cabinet, gilt inside, candles and incense. 32x28. */
export function butsudan() {
  const g = grid(32, 28);
  fillRect(g, 2, 2, 28, 24, 'ink1');
  fillRect(g, 6, 6, 20, 14, 'gold1');
  fillRect(g, 8, 8, 16, 10, 'gold0');
  ellipse(g, 16, 13, 3, 4, 'gold2');
  set(g, 15, 11, 'gold3');
  for (const x of [9, 22]) { vline(g, x, 14, 18, 'ink6'); set(g, x, 13, 'red3'); }
  fillRect(g, 4, 21, 24, 4, 'wood1');
  hline(g, 4, 27, 21, 'wood3');
  vline(g, 16, 17, 20, 'stone3');
  hline(g, 2, 29, 2, 'ink3');
  return outline(g, { color: 'ink0' });
}

/** A square cypress bath with steam. 32x24. */
export function tub() {
  const g = grid(32, 24);
  fillRect(g, 1, 6, 30, 17, 'wood4');
  fillRect(g, 4, 9, 24, 11, 'water3');
  fillRect(g, 4, 9, 24, 2, 'water4');
  hline(g, 1, 30, 6, 'wood5');
  for (const x of [1, 30]) vline(g, x, 6, 22, 'wood2');
  for (const [x, y] of [[9, 3], [11, 1], [18, 4], [20, 2], [25, 3]]) { set(g, x, y, 'ink6'); set(g, x + 1, y - 1, 'ink5'); }
  return outline(g, { color: 'wood0' });
}

/** A row of three pickling barrels under stone weights. 32x20. */
export function barrels() {
  const g = grid(32, 20);
  for (const x0 of [1, 11, 21]) {
    fillRect(g, x0, 6, 10, 13, 'wood3');
    for (const y of [8, 15]) hline(g, x0, x0 + 9, y, 'straw1');
    vline(g, x0 + 9, 6, 18, 'wood1');
    ellipse(g, x0 + 5, 5, 3, 2, 'stone3');
    set(g, x0 + 4, 4, 'stone4');
  }
  return outline(g, { color: 'wood0' });
}

/** A sawhorse with a plank across it and a saw. 32x18. */
export function sawhorse() {
  const g = grid(32, 18);
  for (const x of [5, 25]) { polygon(g, [[x - 3, 17], [x, 8], [x + 3, 17]], 'wood2'); }
  fillRect(g, 1, 6, 30, 4, 'wood5');
  hline(g, 1, 30, 6, 'wood6');
  hline(g, 1, 30, 9, 'wood3');
  fillRect(g, 12, 2, 10, 3, 'stone3');
  hline(g, 12, 21, 4, 'stone1');
  fillRect(g, 22, 2, 4, 3, 'wood2');
  return outline(g, { color: 'wood0' });
}

/** A low writing desk with ledgers and an inkstone. 32x16. */
export function desk() {
  const g = grid(32, 16);
  fillRect(g, 1, 4, 30, 6, 'wood1');
  hline(g, 1, 30, 4, 'wood3');
  for (const x of [3, 28]) vline(g, x, 10, 15, 'wood0');
  fillRect(g, 5, 1, 8, 4, 'ink6');
  hline(g, 5, 12, 2, 'ink4');
  fillRect(g, 17, 2, 6, 3, 'ink1');
  set(g, 25, 2, 'red2'); set(g, 26, 2, 'red2');
  return outline(g, { color: 'ink0' });
}

/** A wall rack of wooden practice swords. 32x20. */
export function swordRack() {
  const g = grid(32, 20);
  for (const y of [3, 15]) { fillRect(g, 1, y, 30, 2, 'wood2'); hline(g, 1, 30, y, 'wood4'); }
  for (const x of [5, 11, 17, 23]) { vline(g, x, 1, 18, 'wood4'); vline(g, x + 1, 1, 18, 'wood3'); set(g, x, 12, 'ink1'); set(g, x + 1, 12, 'ink1'); }
  return outline(g, { color: 'wood0' });
}

/** A market stall (yatai): an awning on two posts high enough that the keeper standing behind the
 * counter shows between them, and goods set out on the counter. `c` is the awning's ramp. 48x62. */
export function yatai(c) {
  const g = grid(48, 62);
  for (const x of [3, 43]) { fillRect(g, x, 8, 3, 54, 'wood2'); vline(g, x, 8, 61, 'wood4'); }
  fillRect(g, 0, 2, 48, 8, c[1]);
  for (let x = 0; x < 48; x += 8) fillRect(g, x, 2, 4, 8, c[2]);
  hline(g, 0, 47, 2, c[3]);
  for (let x = 0; x < 48; x += 4) { set(g, x + 1, 10, c[0]); set(g, x + 2, 11, c[0]); }
  fillRect(g, 2, 48, 44, 14, 'wood2');
  fillRect(g, 2, 46, 44, 3, 'wood4');
  hline(g, 2, 45, 46, 'wood5');
  for (let x = 6; x < 44; x += 8) vline(g, x, 50, 61, 'wood1');
  const goods = [['red2', 'red0'], ['gold2', 'gold0'], ['water3', 'water1'], ['grass4', 'grass2'], ['sakura2', 'sakura0']];
  goods.forEach(([a, b], i) => { fillRect(g, 6 + i * 8, 41, 5, 5, a); vline(g, 10 + i * 8, 41, 45, b); hline(g, 7 + i * 8, 9 + i * 8, 41, 'ink6'); });
  return outline(g, { color: 'wood0' });
}

/** The shrine's charm stand: a little roofed rack of omamori and red threads. 16x26. */
export function omamoriStand() {
  const g = grid(16, 26);
  polygon(g, [[0, 6], [8, 0], [16, 6]], 'ink2');
  hline(g, 0, 15, 6, 'ink3');
  for (const x of [2, 13]) vline(g, x, 7, 25, 'wood2');
  fillRect(g, 2, 17, 12, 8, 'wood3');
  hline(g, 2, 13, 17, 'wood4');
  for (const [x, c] of [[4, 'red2'], [7, 'gold2'], [10, 'red3'], [5, 'water3'], [9, 'grass4']]) {
    fillRect(g, x, 9 + (x % 3) * 2, 2, 3, c);
    set(g, x, 8 + (x % 3) * 2, 'ink6');
  }
  fillRect(g, 5, 20, 6, 3, 'wood1');
  hline(g, 6, 9, 21, 'ink0');
  return outline(g, { color: 'wood0' });
}

/** A makiwara: a post bound in straw on a wooden foot, for striking practice. 12x28. */
export function makiwara() {
  const g = grid(12, 28);
  fillRect(g, 1, 24, 10, 4, 'wood2'); hline(g, 1, 10, 24, 'wood4');
  fillRect(g, 4, 2, 4, 23, 'wood3'); vline(g, 4, 2, 24, 'wood4');
  fillRect(g, 2, 4, 8, 14, 'straw2');
  for (let y = 4; y < 18; y++) { set(g, 2, y, 'straw1'); if (y % 2) set(g, 8, y, 'straw3'); }
  for (const y of [6, 11, 16]) hline(g, 2, 9, y, 'straw0');
  hline(g, 3, 8, 4, 'straw3');
  return outline(g, { color: 'wood0' });
}

/** A kyūdō target (mato) on its stand: rings of black and white on a wooden frame. 16x22. */
export function mato() {
  const g = grid(16, 22);
  for (const x of [3, 12]) { vline(g, x, 10, 21, 'wood2'); set(g, x, 21, 'wood1'); }
  hline(g, 2, 13, 18, 'wood3');
  const rings = ['ink0', 'ink6', 'ink0', 'ink6', 'ink0'];
  rings.forEach((c, i) => { const r = 7 - i * 1.4; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.hypot(x - 7.5, y - 7.5) <= r) set(g, x, y, c); });
  set(g, 5, 4, 'ink5'); set(g, 4, 5, 'ink5');
  return outline(g, { color: 'wood0' });
}
