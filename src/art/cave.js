// Mount Kurayama: rock and floor tiles per zone, and the props of the tunnels (ore veins, urns,
// chests, the ladder down and the rope up, lanterns, timber props, cracked walls, the lost bundle)
// plus the cave mouth on the mountainside. Zone 1 is earthy brown-grey, zone 2 wet blue-grey.
import { grid, set, fillRect, ellipse, polygon, line, outline, parse } from './raster.js';
import { hashf } from '../core/rng.js';

const T = 16;
const hline = (g, x0, x1, y, c) => { for (let x = x0; x <= x1; x++) set(g, x, y, c); };
const vline = (g, x, y0, y1, c) => { for (let y = y0; y <= y1; y++) set(g, x, y, c); };

// [darkest .. lightest] rock, floor tones, and an accent (dust or moss).
const ZONE_PAL = {
  1: { rock: ['ink1', 'stone0', 'stone1', 'stone2', 'stone3'], floor: ['wood0', 'wood1', 'stone1', 'wood2'], accent: 'wood3' },
  2: { rock: ['ink1', 'indigo0', 'ink2', 'stone1', 'stone2'], floor: ['ink1', 'ink2', 'stone0', 'indigo0'], accent: 'teal1' },
};

/** Rock mass seen from above: dark, knobbly, a few lit edges. */
export function rockTop(zone, v) {
  const p = ZONE_PAL[zone].rock, g = grid(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const h = hashf((x >> 1) + v * 8, y >> 1, zone, 41);
    set(g, x, y, h > 0.82 ? p[2] : h > 0.45 ? p[1] : p[0]);
  }
  return g;
}

/** The face of the rock where the floor meets it: strata lit from above, a dark foot. */
export function rockFace(zone, v) {
  const p = ZONE_PAL[zone].rock, g = grid(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const band = (y + v * 2 + ((x + v) >> 2) % 3) % 6;
    let c = band === 0 ? p[1] : band < 3 ? p[3] : p[2];
    if (hashf(x, y, v, 42) > 0.9) c = p[4];
    if (hashf(x, y, v, 43) > 0.93) c = p[1];
    set(g, x, y, c);
  }
  hline(g, 0, 15, 0, p[4]);
  hline(g, 0, 15, 14, p[1]); hline(g, 0, 15, 15, p[0]);
  if (zone === 2) for (let x = v % 4; x < T; x += 5) { set(g, x, 1, 'teal1'); set(g, x, 2, 'teal0'); }
  return g;
}

/** Tunnel floor: packed earth and grit; `shade` darkens the row under a wall. */
export function caveFloor(zone, v, shade) {
  const p = ZONE_PAL[zone].floor, g = grid(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    // Grit in 2x2 clumps reads as texture rather than static.
    const h = hashf((x >> 1) + v * 8, y >> 1, zone, 44);
    set(g, x, y, h > 0.96 ? p[3] : h > 0.86 ? p[2] : h < 0.05 ? p[0] : p[1]);
  }
  for (let i = 0; i < 3; i++) {
    const x = Math.floor(hashf(v, i, zone, 45) * 14) + 1, y = Math.floor(hashf(i, v, zone, 46) * 14) + 1;
    set(g, x, y, ZONE_PAL[zone].accent);
  }
  if (shade) { hline(g, 0, 15, 0, 'ink0'); hline(g, 0, 15, 1, p[0]); for (let x = 0; x < T; x += 2) set(g, x, 2, p[0]); }
  return g;
}

// ---------------------------------------------------------------- props (anchored at their feet)

const ORE_VEIN = { copper: ['teal1', 'red3'], iron: ['red1', 'wood3'], jade: ['grass2', 'grass5'], crystal: ['water3', 'ink6'], stone: null };

/** A knee-high lump of rock, with a vein of ore or a crystal cluster. */
export function oreNode(kind, zone) {
  const p = ZONE_PAL[zone].rock, g = grid(16, 16);
  polygon(g, [[1, 15], [2, 8], [5, 4], [10, 3], [14, 7], [15, 15]], p[2]);
  polygon(g, [[3, 9], [6, 5], [10, 5], [12, 8], [8, 10]], p[3]);
  hline(g, 2, 14, 15, p[1]);
  const vein = ORE_VEIN[kind];
  if (vein && kind !== 'crystal') for (const [x, y] of [[4, 11], [8, 8], [11, 11], [6, 13], [10, 6]]) { set(g, x, y, vein[0]); set(g, x + 1, y, vein[1]); set(g, x, y + 1, vein[0]); }
  if (kind === 'crystal') {
    for (const [x, h] of [[5, 7], [8, 10], [11, 6]]) { fillRect(g, x, 12 - h, 2, h, 'water3'); vline(g, x, 12 - h, 11, 'water4'); set(g, x, 12 - h, 'ink6'); }
  }
  return outline(g, { color: 'ink0' });
}

/** A tsubo storage urn with a rope collar. */
export function urn() {
  return outline(parse(`
    ...aaaaaa...
    ..abbbbbba..
    ...cccccc...
    ..dddddddd..
    .deeeeeeeed.
    deeefeeeeeed
    deefeeeeeeed
    deefeeeeeeed
    deeeeeeeeeed
    .deeeeeeeed.
    ..dddddddd..
    ...dddddd...`, { a: 'wood1', b: 'wood3', c: 'straw2', d: 'wood1', e: 'wood2', f: 'wood4' }), { color: 'ink0' });
}

/** A lacquered chest, shut or open with a glint inside. */
export function chest(open) {
  const g = parse(open ? `
    .aaaaaaaaaaaa.
    abbbbbbbbbbbba
    acccccccccccca
    aeeeeeeeeeeeea
    aegggegggegeea
    abbbbbbbbbbbba
    abrrrrrrrrrrba
    abrrrrffrrrrba
    abrrrrffrrrrba
    abrrrrrrrrrrba
    abbbbbbbbbbbba
    aaaaaaaaaaaaaa` : `
    ..............
    ..............
    ..............
    .aaaaaaaaaaaa.
    abbbbbbbbbbbba
    arrrrrrrrrrrra
    abbbbbffbbbbba
    abrrrrffrrrrba
    abrrrrrrrrrrba
    abrrrrrrrrrrba
    abbbbbbbbbbbba
    aaaaaaaaaaaaaa`, { a: 'ink0', b: 'gold1', c: 'red0', e: 'ink1', g: 'gold3', r: 'red1', f: 'gold2' });
  return g;
}

/** The ladder down: a square shaft with the top rungs showing. */
export function ladderHole() {
  const g = grid(16, 16);
  fillRect(g, 1, 2, 14, 13, 'wood1');
  fillRect(g, 2, 3, 12, 11, 'ink0');
  for (const x of [4, 11]) vline(g, x, 3, 13, 'wood3');
  for (let y = 5; y < 14; y += 3) hline(g, 4, 11, y, 'wood4');
  hline(g, 1, 14, 2, 'wood3');
  return g;
}

/** A rope hanging from a hole in the roof: the way back up. */
export function ropeUp() {
  const g = grid(12, 30);
  ellipse(g, 6, 3, 5, 2.5, 'ink0');
  for (let y = 3; y < 27; y++) { set(g, 5 + ((y >> 2) & 1), y, 'straw2'); set(g, 6 + ((y >> 2) & 1), y, 'straw3'); }
  ellipse(g, 6, 27, 3, 1.5, 'straw1');
  return outline(g, { color: 'wood0' });
}

/** A stone lantern checkpoint, dark or lit. */
export function caveLantern(lit) {
  const g = parse(`
    ....aaaa....
    ..aabbbbaa..
    .abbbbbbbba.
    ...cccccc...
    ...cddddc...
    ...cddddc...
    ...cccccc...
    ..aaaaaaaa..
    ....bbbb....
    ....bccb....
    ....bccb....
    ...abbbba...
    ..aaaaaaaa..`, { a: 'stone1', b: 'stone3', c: 'stone2', d: lit ? 'gold3' : 'ink1' });
  if (lit) { set(g, 5, 4, 'ink6'); set(g, 6, 5, 'gold2'); }
  return outline(g, { color: 'ink0' });
}

/** Pit-props of the old mine: two posts and a lintel. */
export function timbers() {
  const g = grid(20, 30);
  for (const x of [1, 16]) { fillRect(g, x, 4, 3, 26, 'wood2'); vline(g, x, 4, 29, 'wood3'); }
  fillRect(g, 0, 1, 20, 4, 'wood2'); hline(g, 0, 19, 1, 'wood4'); hline(g, 0, 19, 4, 'wood1');
  return outline(g, { color: 'ink0' });
}

/** A cracked patch of rock face: the pickaxe can open it. */
export function crackedWall(zone) {
  const g = rockFace(zone, 3);
  for (const [x0, y0, x1, y1] of [[3, 2, 7, 8], [7, 8, 5, 13], [7, 8, 12, 10], [12, 10, 13, 14]]) line(g, x0, y0, x1, y1, 'ink0');
  return g;
}

/** The furoshiki bundle your lost things wait in. */
export function bundle() {
  return outline(parse(`
    ....aa..aa....
    ...abba.aba...
    ....aabba.....
    ..aabbbbbbaa..
    .abbcbbbbcbba.
    abbbbbcbbbbbba
    abcbbbbbbbcbba
    abbbbbcbbbbbba
    .abbbbbbbbbba.
    ..aaaaaaaaaa..`, { a: 'indigo0', b: 'indigo2', c: 'ink6' }), { color: 'ink0' });
}

/** The cave mouth in the mountainside, a shimenawa across the lintel. */
export function caveMouth() {
  const g = grid(64, 48);
  polygon(g, [[0, 48], [2, 18], [10, 6], [24, 0], [42, 1], [56, 8], [63, 22], [64, 48]], 'stone2');
  polygon(g, [[6, 20], [14, 8], [28, 3], [44, 5], [54, 12], [40, 14], [22, 12]], 'stone3');
  for (let i = 0; i < 40; i++) set(g, Math.floor(hashf(i, 1, 0, 51) * 60) + 2, Math.floor(hashf(i, 2, 0, 51) * 40) + 6, 'stone1');
  polygon(g, [[18, 48], [18, 30], [22, 22], [32, 18], [42, 22], [46, 30], [46, 48]], 'ink0');
  polygon(g, [[21, 48], [21, 31], [24, 25], [32, 22], [40, 25], [43, 31], [43, 48]], 'ink1');
  for (const x of [16, 46]) { fillRect(g, x, 26, 3, 22, 'wood2'); vline(g, x, 26, 47, 'wood3'); }
  fillRect(g, 14, 22, 36, 4, 'wood2'); hline(g, 14, 49, 22, 'wood4');
  for (let x = 16; x < 48; x++) set(g, x, 27 + Math.round(Math.sin((x - 16) / 31 * Math.PI) * 3), 'straw3');
  for (const x of [22, 30, 38]) for (let y = 0; y < 5; y++) set(g, x, 30 + y + Math.round(Math.sin((x - 16) / 31 * Math.PI) * 3), y % 2 ? 'ink6' : 'ink5');
  return outline(g, { color: 'ink0' });
}

/** An iron fire-basket on a tripod (Jūbei's hall). */
export function brazier() {
  const g = grid(14, 24);
  for (const [x0, x1] of [[2, 5], [11, 8], [7, 7]]) line(g, x0, 23, x1, 12, 'ink2');
  ellipse(g, 7, 11, 6, 2.5, 'ink1'); ellipse(g, 7, 10, 5, 1.5, 'ink2');
  for (const [x, y, c] of [[5, 7, 'red2'], [7, 5, 'red3'], [9, 7, 'red2'], [6, 3, 'gold2'], [8, 2, 'gold3'], [7, 8, 'red4'], [4, 9, 'red1'], [10, 9, 'red1']]) { set(g, x, y, c); set(g, x, y + 1, c); }
  return outline(g, { color: 'ink0' });
}

/** The last stair of the cellars, drowned: black water to the brim. */
export function deepStair() {
  const g = grid(16, 16);
  fillRect(g, 1, 2, 14, 13, 'stone1');
  fillRect(g, 2, 3, 12, 11, 'water0');
  for (let y = 5; y < 14; y += 3) line(g, 3, y, 12, y, 'water1');
  set(g, 5, 6, 'water3'); set(g, 10, 9, 'water3');
  return g;
}
