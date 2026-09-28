// Festival decorations (M6): strings of paper lanterns, nobori banners, the Bon yagura, a mochi
// mortar, a Tanabata bamboo with wish strips, the moon-viewing stand, snow lanterns and a
// kamakura, a picnic mat and a festival drum. Drawn in the house style: 1px dark outline, 3-4
// tones per ramp, light from the upper left.
import { grid, set, fillRect, ellipse, outline, polygon, line } from './raster.js';

const hline = (g, x0, x1, y, c) => { for (let x = x0; x <= x1; x++) set(g, x, y, c); };
const vline = (g, x, y0, y1, c) => { for (let y = y0; y <= y1; y++) set(g, x, y, c); };

/** One paper lantern, 6x8, top-left at (x, y). */
function chochin(g, x, y, body, lit) {
  set(g, x + 2, y, 'ink1'); set(g, x + 3, y, 'ink1');
  fillRect(g, x, y + 1, 6, 6, body[1]);
  fillRect(g, x + 1, y + 1, 4, 6, body[2]);
  fillRect(g, x + 1, y + 2, 2, 3, lit);
  for (const yy of [y + 2, y + 4, y + 6]) set(g, x, yy, body[0]);
  hline(g, x + 1, x + 4, y + 7, 'ink1');
}

/** A rope of lanterns strung between two poles. 48x30. */
export function lanternString() {
  const g = grid(48, 30);
  for (const x of [1, 46]) { vline(g, x, 2, 29, 'wood2'); set(g, x, 2, 'wood4'); }
  // The rope sags in a shallow curve.
  const sag = (x) => 4 + Math.round(4 * Math.sin((Math.PI * (x - 1)) / 45));
  for (let x = 2; x <= 45; x++) set(g, x, sag(x), 'ink2');
  const reds = ['red0', 'red2', 'red3'], whites = ['stone2', 'ink5', 'ink6'];
  [8, 17, 26, 35].forEach((x, i) => {
    const y = sag(x + 2) + 1;
    vline(g, x + 2, y, y + 1, 'ink2');
    chochin(g, x, y + 1, i % 2 ? whites : reds, 'gold3');
  });
  return outline(g, { color: 'ink0' });
}

/** A nobori: a tall narrow banner on a bamboo pole. 12x42. */
export function nobori(ramp) {
  const g = grid(12, 42);
  vline(g, 2, 0, 41, 'straw2');
  vline(g, 3, 0, 41, 'straw3');
  hline(g, 2, 10, 2, 'straw2');
  fillRect(g, 4, 3, 7, 30, ramp[1]);
  vline(g, 4, 3, 32, ramp[2]);
  for (let y = 7; y < 30; y += 5) hline(g, 6, 9, y, ramp[3]);
  for (let y = 5; y < 33; y += 3) set(g, 10, y, ramp[0]);
  return outline(g, { color: 'ink0' });
}

/** The Bon-dance tower: a wooden stage on legs with a drum, lanterns and a red-white skirt. 52x60. */
export function yagura() {
  const g = grid(52, 60);
  for (const x of [5, 46]) fillRect(g, x, 26, 3, 34, 'wood2');
  for (const x of [18, 33]) fillRect(g, x, 30, 2, 30, 'wood1');
  line(g, 7, 58, 44, 34, 'wood1');
  line(g, 44, 58, 7, 34, 'wood1');
  // Stage and its striped skirt.
  fillRect(g, 2, 24, 48, 4, 'wood3');
  hline(g, 2, 49, 24, 'wood5');
  for (let x = 2; x < 50; x++) fillRect(g, x, 28, 1, 6, Math.floor(x / 4) % 2 ? 'red2' : 'ink6');
  hline(g, 2, 49, 34, 'ink2');
  // Railing, drum and the roof of lanterns.
  hline(g, 3, 48, 16, 'wood3');
  for (const x of [3, 14, 25, 36, 48]) vline(g, x, 16, 23, 'wood2');
  ellipse(g, 26, 17, 7, 6, 'wood3');
  ellipse(g, 26, 17, 5, 5, 'stone4');
  set(g, 24, 15, 'ink6');
  hline(g, 19, 33, 23, 'wood1');
  hline(g, 0, 51, 2, 'ink2');
  [2, 11, 20, 29, 38].forEach((x, i) => chochin(g, x + 2, 3, i % 2 ? ['stone2', 'ink5', 'ink6'] : ['red0', 'red2', 'red3'], 'gold3'));
  return outline(g, { color: 'ink0' });
}

/** A stone mochi mortar (usu) with the wooden mallet (kine) leaning on it. 22x20. */
export function usu() {
  const g = grid(22, 20);
  fillRect(g, 3, 8, 14, 11, 'wood2');
  fillRect(g, 4, 8, 4, 11, 'wood3');
  ellipse(g, 10, 7, 7, 3, 'wood3');
  ellipse(g, 10, 7, 5, 2, 'ink6');
  set(g, 8, 6, 'stone4');
  hline(g, 3, 16, 12, 'wood1');
  line(g, 16, 18, 20, 2, 'wood4');
  fillRect(g, 17, 0, 5, 4, 'wood3');
  hline(g, 17, 21, 0, 'wood5');
  return outline(g, { color: 'wood0' });
}

/** A Tanabata bamboo hung with paper wish strips. 22x50. */
export function sasa() {
  const g = grid(22, 50);
  vline(g, 10, 4, 49, 'grass3');
  vline(g, 11, 4, 49, 'grass4');
  for (const y of [14, 26, 38]) hline(g, 10, 11, y, 'grass2');
  const leaves = [[3, 6], [15, 4], [2, 16], [17, 14], [4, 28], [16, 25], [6, 36]];
  for (const [x, y] of leaves) { ellipse(g, x + 2, y + 2, 3, 1, 'grass4'); set(g, x + 1, y + 1, 'grass6'); line(g, x + 3, y + 2, 10, y + 5, 'grass3'); }
  const strips = [[5, 10, 'red2'], [15, 9, 'gold2'], [3, 21, 'water3'], [17, 19, 'sakura3'], [6, 31, 'grass5'], [15, 30, 'indigo2'], [8, 40, 'red3']];
  for (const [x, y, c] of strips) { fillRect(g, x, y, 2, 6, c); set(g, x, y, 'ink2'); }
  return outline(g, { color: 'ink0' });
}

/** The moon-viewing offering: a stand of dango and a vase of pampas grass. 22x26. */
export function tsukimiStand() {
  const g = grid(22, 26);
  // Susuki plumes.
  for (const [x, top] of [[16, 1], [18, 4], [14, 5]]) { line(g, x, top + 4, 17, 20, 'straw2'); fillRect(g, x - 1, top, 2, 5, 'straw4'); }
  fillRect(g, 14, 17, 6, 8, 'stone2');
  fillRect(g, 15, 17, 2, 8, 'stone3');
  // Sanbō stand with a pyramid of dango.
  fillRect(g, 1, 18, 12, 3, 'wood4');
  fillRect(g, 3, 21, 8, 4, 'wood3');
  hline(g, 1, 12, 18, 'wood6');
  for (const [x, y] of [[3, 16], [7, 16], [11, 16], [5, 13], [9, 13], [7, 10]]) { ellipse(g, x, y, 2, 2, 'ink6'); set(g, x - 1, y - 1, 'stone4'); }
  return outline(g, { color: 'ink0' });
}

/** A snow lantern: a mound of packed snow with a candle glowing inside. 14x16. */
export function yukidoro() {
  const g = grid(14, 16);
  ellipse(g, 7, 10, 6, 5, 'ink5');
  ellipse(g, 6, 9, 4, 4, 'ink6');
  fillRect(g, 5, 9, 4, 4, 'gold2');
  fillRect(g, 6, 10, 2, 2, 'gold3');
  hline(g, 2, 12, 15, 'stone3');
  return outline(g, { color: 'indigo1' });
}

/** A kamakura snow hut with a lit doorway. 34x24. */
export function kamakura() {
  const g = grid(34, 24);
  ellipse(g, 17, 14, 16, 10, 'ink5');
  ellipse(g, 14, 11, 11, 7, 'ink6');
  ellipse(g, 17, 18, 6, 6, 'gold1');
  ellipse(g, 17, 19, 4, 5, 'gold2');
  fillRect(g, 11, 22, 13, 2, 'ink5');
  hline(g, 2, 31, 23, 'indigo3');
  return outline(g, { color: 'indigo1' });
}

/** A woven picnic mat (goza) with a lacquer box of food. 34x18, lies flat. */
export function goza() {
  const g = grid(34, 18);
  polygon(g, [[4, 2], [33, 2], [30, 17], [1, 17]], 'straw3');
  for (let y = 4; y < 17; y += 3) hline(g, 3, 30, y, 'straw2');
  hline(g, 4, 33, 2, 'straw4');
  fillRect(g, 12, 6, 9, 6, 'ink1');
  fillRect(g, 13, 7, 7, 4, 'red1');
  for (const [x, c] of [[14, 'ink6'], [16, 'grass4'], [18, 'gold2']]) set(g, x, 8, c);
  return outline(g, { color: 'straw0' });
}

/** A festival taiko drum on its wooden stand. 22x22. */
export function taiko() {
  const g = grid(22, 22);
  line(g, 3, 21, 8, 12, 'wood1');
  line(g, 18, 21, 13, 12, 'wood1');
  ellipse(g, 11, 9, 9, 8, 'red1');
  ellipse(g, 11, 9, 6, 7, 'wood6');
  ellipse(g, 10, 8, 4, 5, 'ink6');
  for (const [x, y] of [[3, 4], [3, 14], [19, 4], [19, 14]]) set(g, x, y, 'gold2');
  return outline(g, { color: 'ink0' });
}
