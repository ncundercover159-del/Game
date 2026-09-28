// Fish icons painted from a few body plans (slim, deep, small, eel, flat, prawn, crab) in each
// species' colours, lit from the top-left; plus the fishing rod, bobber, fish trap and junk.
import { grid, set, get, fillRect, ellipse, line, outline, parse, crop, bounds } from './raster.js';
import { FISH } from '../data/fish.js';

const T = 16;

function body(g, look, [dark, mid, light], pattern) {
  switch (look) {
    case 'eel':
      for (let x = 1; x < 14; x++) { const y = 7 + Math.round(Math.sin(x * 0.7) * 1.5); fillRect(g, x, y - 1, 1, 3, mid); set(g, x, y - 1, light); set(g, x, y + 1, dark); }
      set(g, 13, 6, 'ink0'); set(g, 1, 8, dark);
      return;
    case 'crab':
      ellipse(g, 7, 8, 5, 3.5, mid); ellipse(g, 6, 7, 3, 2, light);
      for (const s of [-1, 1]) { line(g, 7 + s * 5, 7, 7 + s * 7, 4, dark); set(g, 7 + s * 7, 3, mid); set(g, 7 + s * 6, 3, mid); for (let k = 0; k < 3; k++) line(g, 7 + s * 4, 9 + k, 7 + s * 6, 11 + k, dark); }
      set(g, 5, 5, 'ink0'); set(g, 9, 5, 'ink0');
      return;
    case 'prawn':
      for (let i = 0; i < 9; i++) { const x = 3 + i, y = 9 - Math.round(Math.sin(i * 0.35) * 3); fillRect(g, x, y, 1, 3, i % 2 ? mid : light); set(g, x, y + 2, dark); }
      line(g, 12, 6, 15, 2, dark); line(g, 12, 7, 15, 9, dark); set(g, 11, 6, 'ink0');
      return;
    default: break;
  }
  const [rx, ry, cx] = { slim: [6, 2.6, 7], deep: [5.5, 4, 7], small: [4, 2.2, 7], flat: [6, 2.2, 7] }[look];
  const cy = 8;
  ellipse(g, cx, cy, rx, ry, mid);
  for (let x = 0; x < T; x++) for (let y = 0; y < T; y++) if (get(g, x, y) && y > cy) set(g, x, y, look === 'flat' ? mid : light);
  for (let x = 0; x < T; x++) if (get(g, x, Math.ceil(cy - ry))) set(g, x, Math.ceil(cy - ry), dark);
  // Tail fin.
  const tx = Math.round(cx - rx);
  for (let d = 0; d < 3; d++) { set(g, tx - 1 - d, cy - 1 - d, dark); set(g, tx - 1 - d, cy + 1 + d, dark); set(g, tx - 1 - d, cy, mid); }
  // Dorsal fin and eye.
  set(g, cx, Math.floor(cy - ry) - 1, dark); set(g, cx + 1, Math.floor(cy - ry) - 1, dark);
  set(g, Math.round(cx + rx) - 2, cy - 1, 'ink0');
  if (pattern === 'spots') for (const [x, y] of [[cx - 3, cy - 1], [cx, cy], [cx + 2, cy - 1], [cx - 1, cy - 2]]) set(g, x, y, light);
  if (pattern === 'bars') for (const x of [cx - 3, cx - 1, cx + 1]) { set(g, x, cy - 1, dark); set(g, x, cy, dark); }
}

function fishIcon(def) {
  const g = grid(T, T);
  body(g, def.look, def.colors, def.pattern);
  return crop(outline(g, { color: 'ink0', pad: 0 }), 0, 0, T, T);
}

export function fishIcons() {
  const out = {};
  for (const [id, def] of Object.entries(FISH)) out[id] = fishIcon(def);
  // The legendary glows: a halo of moonlight around the carp.
  const moon = out.tsukigoi;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    if (get(moon, x, y)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (get(moon, x + dx, y + dy) && ((x + y) & 1)) { set(moon, x, y, 'gold3'); break; }
  }
  out.waraji = parse(`
    ................
    ................
    ....oooooo......
    ...osssssso.....
    ..ossSssSsso....
    ..osSsssssSo....
    ..ossssSssso....
    ..osSssssSso....
    ..osssSsssso....
    ..osSssssSso....
    ...ossssSso.....
    ...rrrrrrrr.....
    ....osssso......
    .....oooo.......
    ................
    ................`, { o: 'straw0', s: 'straw2', S: 'straw1', r: 'red1' });
  out.driftwood = crop(outline((() => { const g = grid(T, T); line(g, 2, 11, 13, 5, 'stone3'); line(g, 2, 12, 13, 6, 'stone2'); line(g, 3, 12, 13, 7, 'stone2'); line(g, 7, 9, 5, 5, 'stone3'); return g; })(), { pad: 0 }), 0, 0, T, T);
  out.rod = parse(`
    ..............ab
    .............ab.
    ............ab..
    ...........ab...
    ..........cb....
    .........ab.....
    ........ab......
    .......ab.......
    ......cb....l...
    .....ab.....l...
    ....ab......l...
    ...rr.......l...
    ..rr........r...
    .dd.........w...
    dd..............
    ................`, { a: 'straw3', b: 'straw1', c: 'straw0', r: 'red1', d: 'wood1', l: 'ink5', w: 'ink6' });
  out.uke = trapIcon();
  return out;
}

/** A woven bamboo fish trap (uke), cone-shaped. */
function trapIcon() {
  const g = grid(T, T);
  for (let x = 2; x < 14; x++) {
    const h = Math.round(2 + (x - 2) * 0.35);
    for (let y = 8 - h; y <= 8 + h; y++) set(g, x, y, (x + y) % 2 ? 'straw2' : 'straw3');
  }
  for (let y = 5; y <= 11; y++) set(g, 13, y, 'straw1');
  ellipse(g, 13, 8, 1.5, 2.5, 'straw0');
  for (let x = 4; x < 13; x += 3) line(g, x, 8 - Math.round(2 + (x - 2) * 0.35), x, 8 + Math.round(2 + (x - 2) * 0.35), 'straw1');
  return crop(outline(g, { color: 'straw0', pad: 0 }), 0, 0, T, T);
}

/** The trap sitting in the water: its icon, half submerged. */
export function trapInWater() {
  const g = trapIcon();
  for (let y = 10; y < T; y++) for (let x = 0; x < T; x++) if (get(g, x, y)) set(g, x, y, (x + y) % 3 ? 'water2' : 'water3');
  return g;
}

/** A red-and-white float, 5x7. */
export function bobber() {
  return parse(`
    ..o..
    .oro.
    orrro
    owwwo
    .owo.
    ..o..
    .....`, { o: 'ink0', r: 'red2', w: 'ink6' });
}

/** Rod tips relative to the player's feet for each facing and pose (for drawing the line). */
export const ROD_TIPS = {
  down: { raise: [4, -46], strike: [1, 12] },
  up: { raise: [-2, -2], strike: [0, -48] },
  right: { raise: [-14, -42], strike: [24, -26] },
};

/** Held rod sprites (a long bamboo pole), anchored at the feet like other held tools. */
export function rodSprite(dir, pose) {
  const PAD = 48;
  const g = grid(16 + PAD * 2, 32 + PAD * 2);
  const hand = { down: { raise: [9, 16], strike: [8, 22] }, up: { raise: [8, 18], strike: [8, 16] }, right: { raise: [9, 17], strike: [11, 21] } }[dir][pose];
  const [tx, ty] = ROD_TIPS[dir][pose];
  const ex = 8 + tx, ey = 32 + ty;
  line(g, hand[0] + PAD, hand[1] + PAD, ex + PAD, ey + PAD, 'straw2');
  line(g, hand[0] + PAD + 1, hand[1] + PAD, ex + PAD + 1, ey + PAD, 'straw1');
  set(g, hand[0] + PAD, hand[1] + PAD, 'wood1');
  set(g, hand[0] + PAD + 1, hand[1] + PAD, 'wood1');
  const out = outline(g, { color: 'ink0', pad: 0 });
  const b = bounds(out);
  return { g: crop(out, ...b), ax: 8 + PAD - b[0], ay: 32 + PAD - b[1] };
}
