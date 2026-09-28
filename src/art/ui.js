// UI kit: nine-slice wooden frames, inset slots, selection frame, dial, bar caps and small icons.
import { parse, grid, ellipse, set } from './raster.js';

// Wooden frame (ref 2): dark outline, lit top-left bevel, orange body, dark inner line, cream inset.
export const FRAME = parse(`
  .oooooooooo.
  ohhhhhhhhhmo
  ohmmmmmmmmdo
  ohmIIIIIIddo
  ohmIccccIddo
  ohmIccccIddo
  ohmIccccIddo
  ohmIccccIddo
  ohmIIIIIIddo
  ohdddddddddo
  omddddddddmo
  .oooooooooo.`, { o: 'wood0', h: 'wood5', m: 'wood4', d: 'wood3', I: 'wood1', c: 'wood6' });
export const FRAME_CORNER = 4;

// Thin frame for tooltips and text boxes.
export const FRAME_THIN = parse(`
  .oooooo.
  ohhhhhmo
  ohccccdo
  ohccccdo
  ohccccdo
  ohccccdo
  omddddmo
  .oooooo.`, { o: 'wood0', h: 'wood5', m: 'wood4', d: 'wood3', c: 'wood6' });
export const FRAME_THIN_CORNER = 2;

// Dark translucent-looking panel (drawn opaque in ink) for world captions and prompts.
export const FRAME_DARK = parse(`
  .oooooo.
  oiiiiiio
  oiIIIIio
  oiIIIIio
  oiIIIIio
  oiIIIIio
  oiiiiiio
  .oooooo.`, { o: 'ink0', i: 'ink3', I: 'ink1' });

// Inset slot: shaded top-left inner edge so the slot reads as recessed.
export const SLOT = parse(`
  dddddddddddddddddd
  dsssssssssssssssss
  dscccccccccccccccc
  dscccccccccccccccc
  dscccccccccccccccc
  dscccccccccccccccc
  dscccccccccccccccc
  dscccccccccccccccc
  dscccccccccccccccc
  dscccccccccccccccc
  dscccccccccccccccc
  dscccccccccccccccc
  dscccccccccccccccc
  dscccccccccccccccc
  dscccccccccccccccc
  dscccccccccccccccc
  dscccccccccccccccc
  dscccccccccccccccc`, { d: 'wood3', s: 'wood4', c: 'wood5' });

export const SLOT_SEL = parse(`
  ..rrrrrrrrrrrrrrrr..
  .rRRRRRRRRRRRRRRRRr.
  rR................Rr
  rR................Rr
  rR................Rr
  rR................Rr
  rR................Rr
  rR................Rr
  rR................Rr
  rR................Rr
  rR................Rr
  rR................Rr
  rR................Rr
  rR................Rr
  rR................Rr
  rR................Rr
  rR................Rr
  rR................Rr
  .rRRRRRRRRRRRRRRRRr.
  ..rrrrrrrrrrrrrrrr..`, { r: 'red1', R: 'red3' });

// Target-tile highlight (corner brackets).
export const TARGET = parse(`
  hhhh........hhhh
  hooo........oooh
  ho............oh
  ho............oh
  ................
  ................
  ................
  ................
  ................
  ................
  ................
  ................
  ho............oh
  ho............oh
  hooo........oooh
  hhhh........hhhh`, { h: 'ink6', o: 'ink0' });

/** Clock dial sky: a 26x14 half disc, day and night variants. */
export function dialSky(night) {
  const g = grid(26, 14);
  ellipse(g, 13, 14, 13, 14, night ? 'indigo1' : 'water3');
  ellipse(g, 13, 14, 9, 10, night ? 'indigo0' : 'water4');
  if (night) for (const [x, y] of [[6, 7], [11, 3], [18, 5], [21, 10], [14, 8]]) set(g, x, y, 'ink6');
  return g;
}

export const SUN = parse(`
  .yyy.
  yYYYy
  yYYYy
  yYYYy
  .yyy.`, { y: 'gold1', Y: 'gold2' });

export const MOON = parse(`
  .mmm.
  mMMm.
  mMm..
  mMMm.
  .mmm.`, { m: 'ink5', M: 'ink6' });

// Weather icons for the clock plate and the forecast (12x10).
const WX_L = { y: 'gold2', Y: 'gold1', c: 'ink6', C: 'ink5', d: 'ink4', r: 'water3', R: 'water2', s: 'ink6', l: 'gold3', g: 'grass4', G: 'grass3', u: 'red2', U: 'red1', w: 'wood2' };
const SUN_ROWS = `
  .....y......
  ..y..y..y...
  ...YYYYY....
  ..YyyyyyY...
  yyYyyyyyYyy.
  ..YyyyyyY...
  ...YYYYY....
  ..y..y..y...
  .....y......
  ............`;
const CLOUD_TOP = [
  '....cccc....',
  '..ccccccc...',
  '.cccccccccc.',
  'cccccccccccC',
  '.CCCCCCCCCC.',
];
export const WEATHER_ICONS = {
  clear: parse(SUN_ROWS, WX_L),
  cloudy: parse(['............', '...ccc......', '..cccccccc..', ...CLOUD_TOP.slice(1), '............', '............'], WX_L),
  rain: parse([...CLOUD_TOP, '..r..r..r...', '.r..r..r....', '............', '..r..r..r...', '.r..r..r....'], WX_L),
  tsuyu: parse(['.....w......', '...uuuuu....', '..uUuUuUu...', '.uuuuuuuuu..', '.....w..r...', '.....w.r..r.', '.r...w.....r', '....ww..r...', '.r.......r..', '............'], WX_L),
  storm: parse([...CLOUD_TOP, '...yl..r....', '..yl..r..r..', '..ly........', '...y..r..r..', '..y..r......'], WX_L),
  wind: parse(['............', 'ccccccc.....', '.......c....', '..ccccc.c...', '........c...', 'cccccccc....', '............', '..g..cccccc.', '.gG.......c.', '..........c.'], WX_L),
  typhoon: parse(['...cccccc...', '.cc......c..', 'c...cccc..c.', 'c..c....c.c.', 'c..c.cc.c.c.', 'c..c..c.c.c.', '.c..cc..c.c.', '..c....c..c.', '...cccc..c..', '.rr....cc...'], WX_L),
  snow: parse([...CLOUD_TOP, '..s...s..s..', '....s.......', '.s.....s..s.', '...s..s.....', '.......s....'], WX_L),
  blizzard: parse([...CLOUD_TOP, 'ss.s.ss.s.ss', '.s.ss.s.ss.s', 'ss.s.ss.s.ss', '.s.ss.s.ss.s', '............'], WX_L),
};
