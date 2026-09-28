// The kodama (a pale, seed-shaped tree spirit with a cap of moss and a sprout, rattling its head)
// and the hokora it lives in: a small wayside shrine of planks on a stone plinth, its copper roof
// gone green, with a straw rope and paper streamers.
import { grid, set, fillRect, polygon, outline, parse } from './raster.js';

const hline = (g, x0, x1, y, c) => { for (let x = x0; x <= x1; x++) set(g, x, y, c); };
const vline = (g, x, y0, y1, c) => { for (let y = y0; y <= y1; y++) set(g, x, y, c); };

const KOD = { g: 'grass4', G: 'grass5', m: 'grass2', M: 'grass3', o: 'stone2', w: 'ink6', s: 'ink5', e: 'ink1', t: 'sakura3', f: 'stone1' };

const IDLE = `
  .....gG.....
  ......g.....
  ....mMMm....
  ...mMMMMm...
  ..mmmmmmmm..
  ..owwwwwwo..
  .owwwwwwwso.
  .owewwwewso.
  .owtwwwtwso.
  .owwwwwwwso.
  ..owwwwwso..
  ..owwwwsso..
  ...oooooo...
  ...f....f...`;

// Bobbing down: the body squashes a row, the cap and sprout come with it.
const BOB = `
  ............
  .....gG.....
  ......g.....
  ....mMMm....
  ...mMMMMm...
  ..mmmmmmmm..
  .owwwwwwwwo.
  .owewwwewso.
  .owtwwwtwso.
  .owwwwwwwso.
  ..owwwwsso..
  ..owwwwsso..
  ...oooooo...
  ...f....f...`;

// Rattling its head: eyes shut, the cap and sprout thrown to one side.
const RATTLE = `
  ...Gg.......
  ....g.......
  ...mMMm.....
  ..mMMMMm....
  ..mmmmmmmm..
  ..owwwwwwo..
  .owwwwwwwso.
  .oeewwweeso.
  .owtwwwtwso.
  .owwwwwwwso.
  ..owwwwwso..
  ..owwwwsso..
  ...oooooo...
  ...f....f...`;

export function kodamaFrames() {
  return { kodama_0: parse(IDLE, KOD), kodama_1: parse(BOB, KOD), kodama_rattle: parse(RATTLE, KOD) };
}

export function hokora() {
  const g = grid(18, 24);
  // Stone plinth, two steps.
  fillRect(g, 1, 19, 16, 5, 'stone2'); hline(g, 1, 16, 19, 'stone3'); hline(g, 1, 16, 23, 'stone1');
  fillRect(g, 3, 17, 12, 2, 'stone3'); hline(g, 3, 14, 17, 'stone4');
  // The little hall: plank walls, a dark doorway with a round bronze mirror.
  fillRect(g, 4, 9, 10, 8, 'wood3'); for (const x of [4, 13]) vline(g, x, 9, 16, 'wood1');
  for (const x of [6, 11]) vline(g, x, 11, 16, 'wood2');
  fillRect(g, 7, 11, 4, 6, 'ink1');
  set(g, 8, 13, 'gold2'); set(g, 9, 13, 'gold3'); set(g, 8, 14, 'gold1'); set(g, 9, 14, 'gold2');
  // The roof: copper gone green, a dark eave, a wooden ridge.
  polygon(g, [[0, 10], [9, 3], [17, 10]], 'teal1');
  for (let x = 2; x < 16; x += 3) set(g, x, 9, 'teal0');
  hline(g, 0, 17, 10, 'teal0');
  fillRect(g, 7, 2, 4, 2, 'wood1'); hline(g, 7, 10, 2, 'wood3');
  // Straw rope across the front, with two zigzag paper streamers.
  hline(g, 4, 13, 11, 'straw3'); set(g, 4, 11, 'straw2'); set(g, 13, 11, 'straw2');
  for (const x of [5, 12]) { set(g, x, 12, 'ink6'); set(g, x + 1, 13, 'ink6'); set(g, x, 14, 'ink6'); }
  return outline(g, { color: 'ink0' });
}
