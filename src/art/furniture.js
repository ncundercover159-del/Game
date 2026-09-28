// Interior furniture and fittings (palette-indexed, lit from the top-left).
import { grid, set, fillRect, ellipse, outline, line } from './raster.js';

const hline = (g, x0, x1, y, c) => { for (let x = x0; x <= x1; x++) set(g, x, y, c); };
const vline = (g, x, y0, y1, c) => { for (let y = y0; y <= y1; y++) set(g, x, y, c); };

/** Futon laid on the tatami: indigo quilt, white sheet, pillow. 16x28 (1x2 tiles). */
export function futon() {
  const g = grid(16, 28);
  fillRect(g, 1, 1, 14, 26, 'ink6');
  fillRect(g, 1, 9, 14, 18, 'indigo1');
  for (let y = 11; y < 27; y += 4) hline(g, 2, 13, y, 'indigo2');
  vline(g, 13, 9, 26, 'indigo0');
  fillRect(g, 4, 2, 8, 5, 'straw4');
  hline(g, 4, 11, 6, 'straw2');
  return outline(g, { color: 'ink3' });
}

/** Sunken hearth (irori) with coals and a hanging kettle. 32x28. */
export function irori() {
  const g = grid(32, 28);
  fillRect(g, 0, 8, 32, 20, 'wood1');
  fillRect(g, 3, 11, 26, 14, 'stone1');
  fillRect(g, 5, 13, 22, 10, 'ink2');
  for (const [x, y] of [[9, 17], [14, 16], [19, 18], [23, 16], [12, 20], [17, 20]]) { set(g, x, y, 'red3'); set(g, x + 1, y, 'gold2'); set(g, x, y + 1, 'red2'); }
  hline(g, 0, 31, 8, 'wood3');
  vline(g, 16, 0, 12, 'ink1');
  ellipse(g, 16, 13, 5, 3.5, 'ink1');
  ellipse(g, 15, 12, 3, 2, 'ink3');
  return outline(g, { color: 'wood0' });
}

/** Tall chest of drawers (tansu). 16x24. */
export function tansu() {
  const g = grid(16, 24);
  fillRect(g, 0, 0, 16, 24, 'wood3');
  for (let y = 3; y < 24; y += 5) { hline(g, 1, 14, y, 'wood1'); set(g, 5, y + 2, 'gold1'); set(g, 10, y + 2, 'gold1'); }
  vline(g, 15, 0, 23, 'wood2');
  hline(g, 0, 15, 0, 'wood5');
  return outline(g, { color: 'wood0' });
}

/** Paper floor lantern (andon), glows at night. 10x18. */
export function andon() {
  const g = grid(10, 18);
  fillRect(g, 1, 2, 8, 12, 'straw4');
  fillRect(g, 3, 5, 4, 6, 'gold3');
  for (const x of [1, 8]) vline(g, x, 0, 17, 'wood1');
  hline(g, 1, 8, 2, 'wood1');
  hline(g, 1, 8, 14, 'wood1');
  return outline(g, { color: 'wood0' });
}

/** Shop counter segment. 16x18. */
export function counter() {
  const g = grid(16, 18);
  fillRect(g, 0, 4, 16, 14, 'wood2');
  fillRect(g, 0, 2, 16, 3, 'wood4');
  hline(g, 0, 15, 2, 'wood5');
  for (let x = 3; x < 16; x += 5) vline(g, x, 6, 17, 'wood1');
  return g;
}

/** Wall shelf with jars and bundles (goes against the top wall). 32x20. */
export function shelf(kind = 'goods') {
  const g = grid(32, 20);
  for (const y of [6, 14]) { fillRect(g, 0, y, 32, 2, 'wood3'); hline(g, 0, 31, y, 'wood4'); }
  const goods = kind === 'herbs'
    ? [['grass3', 'grass2'], ['straw3', 'straw1'], ['grass4', 'grass2'], ['sakura2', 'sakura0']]
    : [['wood4', 'wood2'], ['ink5', 'ink3'], ['red2', 'red0'], ['straw3', 'straw1'], ['water3', 'water1']];
  let i = 0;
  for (const y of [1, 9]) for (let x = 2; x < 30; x += 7) {
    const [a, b] = goods[i++ % goods.length];
    fillRect(g, x, y, 5, 5, a);
    vline(g, x + 4, y, y + 4, b);
    hline(g, x + 1, x + 3, y, 'ink6');
  }
  return outline(g, { color: 'wood0' });
}

/** Low table with a tea set. 24x14. */
export function teaTable() {
  const g = grid(24, 14);
  fillRect(g, 0, 4, 24, 5, 'wood3');
  hline(g, 0, 23, 4, 'wood5');
  for (const x of [2, 20]) fillRect(g, x, 9, 2, 5, 'wood1');
  ellipse(g, 8, 3, 3, 2.5, 'teal1');
  set(g, 7, 2, 'ink6');
  for (const x of [14, 18]) { fillRect(g, x, 1, 3, 3, 'ink6'); set(g, x + 1, 1, 'grass3'); }
  return outline(g, { color: 'wood0' });
}

/** Floor cushion (zabuton). 14x10. */
export function zabuton(color = 'red') {
  const g = grid(14, 10);
  fillRect(g, 1, 1, 12, 8, `${color}2`);
  hline(g, 1, 12, 1, `${color}3`);
  set(g, 7, 5, `${color}1`);
  return outline(g, { color: `${color}0` });
}

/** Forge hearth with glowing coals under a hood. 32x34. */
export function forge() {
  const g = grid(32, 34);
  fillRect(g, 6, 0, 20, 14, 'stone1');
  for (let y = 2; y < 14; y += 4) hline(g, 6, 25, y, 'stone0');
  fillRect(g, 2, 14, 28, 20, 'stone2');
  hline(g, 2, 29, 14, 'stone3');
  fillRect(g, 7, 19, 18, 9, 'ink0');
  for (const [x, y] of [[10, 24], [14, 22], [18, 25], [21, 23], [12, 26], [16, 26]]) { set(g, x, y, 'gold2'); set(g, x + 1, y, 'red3'); set(g, x, y + 1, 'red2'); }
  return outline(g, { color: 'stone0' });
}

/** Anvil on a stump. 18x16. */
export function anvil() {
  const g = grid(18, 16);
  fillRect(g, 4, 8, 10, 8, 'wood2');
  vline(g, 4, 8, 15, 'wood4');
  fillRect(g, 0, 2, 18, 4, 'ink2');
  hline(g, 0, 17, 2, 'ink4');
  fillRect(g, 5, 6, 8, 3, 'ink1');
  return outline(g, { color: 'ink0' });
}

/** Wall of medicine drawers (hyakumi-dansu). 32x24. */
export function drawers() {
  const g = grid(32, 24);
  fillRect(g, 0, 0, 32, 24, 'wood3');
  for (let y = 0; y < 24; y += 6) for (let x = 0; x < 32; x += 8) {
    fillRect(g, x + 1, y + 1, 6, 4, 'wood4');
    set(g, x + 4, y + 3, 'gold1');
  }
  return outline(g, { color: 'wood0' });
}

/** Fishing nets and floats hung on the wall. 32x20. */
export function nets() {
  const g = grid(32, 20);
  for (let x = 0; x < 32; x += 3) line(g, x, 0, x + 6, 19, 'straw2');
  for (let y = 2; y < 20; y += 3) hline(g, 0, 31, y, 'straw1');
  for (const [x, y] of [[6, 16], [16, 17], [26, 15]]) ellipse(g, x, y, 2.5, 2.5, 'water3');
  return outline(g, { color: 'straw0' });
}

/** Offering altar for one virtue: a small shrine with a coloured cloth. 20x24. */
export function altar(cloth) {
  const g = grid(20, 24);
  fillRect(g, 2, 8, 16, 16, 'wood2');
  fillRect(g, 0, 5, 20, 4, 'wood4');
  hline(g, 0, 19, 5, 'wood5');
  fillRect(g, 5, 12, 10, 8, `${cloth}2`);
  hline(g, 5, 14, 12, `${cloth}3`);
  hline(g, 7, 12, 0, 'gold1');
  ellipse(g, 10, 3, 3, 2.5, 'gold2');
  return outline(g, { color: 'wood0' });
}

/** Household shrine shelf (kamidana) on the wall. 24x16. */
export function kamidana() {
  const g = grid(24, 16);
  fillRect(g, 0, 10, 24, 3, 'wood4');
  fillRect(g, 7, 3, 10, 7, 'wood5');
  hline(g, 5, 18, 2, 'wood3');
  vline(g, 12, 4, 9, 'ink6');
  for (const x of [2, 20]) { fillRect(g, x, 6, 2, 4, 'grass3'); set(g, x, 5, 'grass5'); }
  line(g, 0, 13, 23, 13, 'ink6');
  return outline(g, { color: 'wood0' });
}
