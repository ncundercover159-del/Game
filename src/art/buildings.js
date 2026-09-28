// Architecture, painted procedurally into indexed grids: thatched minka farmhouse, kura storehouse,
// well, stone lantern, notice sign and bamboo fence. Light from the top-left throughout.
import { grid, set, get, fillRect, line, polygon, ellipse, outline, parse } from './raster.js';
import { hashf } from '../core/rng.js';

function hline(g, x0, x1, y, c) { for (let x = x0; x <= x1; x++) set(g, x, y, c); }
function vline(g, x, y0, y1, c) { for (let y = y0; y <= y1; y++) set(g, x, y, c); }

/** Thatch fill inside a polygon: vertical strands, lit on the left half, darker toward the eave. */
function thatch(g, pts, seed, x0, x1) {
  const mask = grid(g.w, g.h);
  polygon(mask, pts, 'straw2');
  const mid = (x0 + x1) / 2;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (!get(mask, x, y)) continue;
    const strand = hashf(x, Math.floor(y / 3 + hashf(x, 0, seed, 2) * 3), seed, 1);
    let s = x < mid ? 3 : 2;
    if (strand > 0.78) s += 1;
    if (strand < 0.2) s -= 1;
    if ((x + Math.floor(y / 5)) % 7 === 0) s -= 1;
    set(g, x, y, 'straw' + Math.max(0, Math.min(4, s)));
  }
}

/** Thatched minka farmhouse, 112x108. Door centre at (56, 100). */
export function minka() {
  const W = 112, H = 108;
  const g = grid(W, H);
  // Walls and posts.
  fillRect(g, 8, 58, 96, 36, 'wood2');
  for (let y = 58; y < 94; y++) for (let x = 8; x < 104; x++) if ((y + (x >> 3)) % 6 === 0) set(g, x, y, 'wood1');
  const posts = [8, 29, 44, 66, 81, 100];
  // Shōji panels (paper with lattice) that glow at night.
  for (const [x0, x1] of [[12, 28], [33, 43], [70, 80], [85, 99]]) {
    fillRect(g, x0, 64, x1 - x0 + 1, 22, 'ink6');
    for (let x = x0; x <= x1; x += 4) vline(g, x, 64, 85, 'wood3');
    for (let y = 64; y <= 85; y += 5) hline(g, x0, x1, y, 'wood3');
    hline(g, x0, x1, 86, 'wood1');
    vline(g, x1, 64, 85, 'ink5');
  }
  // Door: dark sliding boards under an indigo noren with a white crest.
  fillRect(g, 48, 62, 16, 32, 'wood1');
  for (let x = 50; x < 64; x += 3) vline(g, x, 62, 93, 'wood0');
  vline(g, 56, 62, 93, 'wood0');
  fillRect(g, 46, 60, 20, 12, 'indigo1');
  for (let x = 46; x < 66; x += 5) vline(g, x, 60, 71, 'indigo0');
  hline(g, 46, 65, 71, 'indigo0');
  ellipse(g, 56, 65, 3, 3, 'ink6');
  set(g, 56, 65, 'indigo1');
  for (const x of posts) {
    fillRect(g, x, 58, 4, 36, 'wood1');
    vline(g, x, 58, 93, 'wood3');
  }
  // Engawa veranda planks and the stepping stone.
  fillRect(g, 4, 92, 104, 6, 'wood4');
  for (let x = 4; x < 108; x += 8) vline(g, x, 92, 97, 'wood3');
  hline(g, 4, 107, 92, 'wood5');
  hline(g, 4, 107, 97, 'wood2');
  fillRect(g, 4, 98, 104, 4, 'wood1');
  for (const x of [6, 30, 54, 78, 102]) fillRect(g, x, 98, 3, 6, 'wood0');
  // Stone foundation under the veranda.
  for (let x = 2; x < 110; x += 6) {
    fillRect(g, x, 102, 5, 5, 'stone2');
    hline(g, x, x + 4, 102, 'stone3');
    vline(g, x + 4, 103, 106, 'stone1');
  }
  ellipse(g, 56, 104, 7, 3, 'stone3');
  hline(g, 51, 61, 103, 'stone4');
  // Eave shadow on the wall.
  fillRect(g, 8, 58, 96, 3, 'wood0');
  // Roof: hipped thatch with a gabled top, overhanging the walls.
  thatch(g, [[0, 62], [22, 14], [90, 14], [112, 62]], 7, 0, 112);
  // Thick cut eave edge.
  fillRect(g, 0, 56, 112, 7, 'straw1');
  for (let x = 0; x < 112; x++) {
    set(g, x, 56, hashf(x, 0, 7, 5) > 0.5 ? 'straw3' : 'straw2');
    if (hashf(x, 1, 7, 5) > 0.6) set(g, x, 57, 'straw2');
    set(g, x, 62, 'wood0');
    if (hashf(x, 2, 7, 5) > 0.7) set(g, x, 61, 'straw0');
  }
  // Gable triangle with lattice and smoke vent.
  polygon(g, [[38, 34], [56, 14], [74, 34]], 'wood1');
  for (let x = 42; x < 72; x += 4) line(g, x, 34, 56, 16, 'wood2');
  fillRect(g, 52, 24, 8, 5, 'wood0');
  hline(g, 38, 74, 34, 'straw1');
  // Ridge cap with crossed ridge logs.
  fillRect(g, 22, 8, 68, 7, 'wood1');
  hline(g, 22, 89, 8, 'wood3');
  hline(g, 22, 89, 14, 'wood0');
  for (const x of [26, 40, 56, 72, 86]) {
    line(g, x - 3, 4, x + 3, 12, 'wood2');
    line(g, x + 3, 4, x - 3, 12, 'wood2');
    set(g, x - 3, 4, 'wood4'); set(g, x + 3, 4, 'wood4');
  }
  // A few moss patches on the thatch.
  for (const [x, y] of [[16, 44], [94, 50], [70, 40], [30, 28]]) {
    ellipse(g, x, y, 3, 2, 'teal1');
    set(g, x - 1, y - 1, 'grass4');
  }
  return outline(g, { color: 'wood0' });
}

/** Kura storehouse, 56x78: white plaster, tiled roof, namako lattice wall. */
export function kura() {
  const W = 56, H = 78;
  const g = grid(W, H);
  fillRect(g, 6, 20, 44, 50, 'ink6');
  fillRect(g, 42, 20, 8, 50, 'ink5');
  // Namako-kabe: dark tiles with raised white joints in a diagonal lattice.
  fillRect(g, 6, 50, 44, 20, 'stone1');
  for (let y = 50; y < 70; y++) for (let x = 6; x < 50; x++) {
    if ((x + y) % 6 === 0 || (x - y + 60) % 6 === 0) set(g, x, y, (x > 42) ? 'ink5' : 'ink6');
  }
  // Iron-clad door with gold hinges.
  fillRect(g, 21, 38, 14, 32, 'ink2');
  fillRect(g, 21, 38, 14, 2, 'ink3');
  vline(g, 28, 38, 69, 'ink1');
  for (const y of [44, 56, 64]) { set(g, 23, y, 'gold2'); set(g, 33, y, 'gold2'); }
  // Small window with iron shutter.
  fillRect(g, 24, 26, 8, 6, 'ink1');
  fillRect(g, 25, 27, 6, 4, 'ink2');
  // Tiled roof, lit on the left, with a ridge and upturned ends.
  polygon(g, [[0, 24], [8, 6], [48, 6], [56, 24]], 'ink2');
  for (let y = 7; y < 24; y += 3) hline(g, 0, 55, y, 'ink1');
  for (let y = 6; y < 24; y++) for (let x = 0; x < 28; x++) if (get(g, x, y) && (x + y) % 5 === 0) set(g, x, y, 'ink3');
  fillRect(g, 6, 2, 44, 5, 'ink1');
  hline(g, 6, 49, 2, 'ink3');
  set(g, 5, 1, 'ink1'); set(g, 50, 1, 'ink1'); set(g, 4, 0, 'ink2'); set(g, 51, 0, 'ink2');
  hline(g, 0, 55, 24, 'ink0');
  fillRect(g, 6, 25, 44, 2, 'ink4');
  // Stone plinth.
  fillRect(g, 4, 70, 48, 7, 'stone2');
  hline(g, 4, 51, 70, 'stone3');
  for (let x = 4; x < 52; x += 8) vline(g, x, 71, 76, 'stone1');
  return outline(g, { color: 'ink0' });
}

/** Stone well with a small thatched roof and pulley, 28x40. */
export function well() {
  const g = grid(28, 40);
  // Posts and roof.
  fillRect(g, 3, 8, 3, 24, 'wood2');
  fillRect(g, 22, 8, 3, 24, 'wood1');
  thatch(g, [[0, 12], [5, 2], [23, 2], [28, 12]], 3, 0, 28);
  hline(g, 0, 27, 12, 'straw1');
  hline(g, 2, 25, 13, 'wood0');
  // Pulley rope and bucket.
  vline(g, 14, 13, 22, 'straw3');
  fillRect(g, 12, 22, 5, 4, 'wood3');
  hline(g, 12, 16, 22, 'wood5');
  // Stone ring.
  ellipse(g, 14, 30, 12, 5, 'stone2');
  fillRect(g, 2, 30, 25, 8, 'stone2');
  ellipse(g, 14, 37, 12, 3, 'stone1');
  ellipse(g, 14, 29, 9, 3, 'water0');
  hline(g, 7, 20, 28, 'water1');
  for (let x = 3; x < 26; x += 5) vline(g, x, 31, 38, 'stone1');
  for (let x = 3; x < 12; x++) set(g, x, 31, 'stone4');
  return outline(g, { color: 'stone0' });
}

/** Stone lantern (tōrō); the fire box window glows at night (light source at (7, 9)). */
export function toro() {
  return parse(`
    .....oo.....
    ....oddo....
    ..oollllo...
    .olllllddo..
    oooooooooooo
    ..odlggldo..
    ..odlggldo..
    ..odllllddo.
    .oooooooooo.
    ....odldo...
    ....odldo...
    ....odldo...
    ....odldo...
    ...olllddo..
    ..olllllddo.
    ..oooooooooo`, { o: 'stone0', d: 'stone1', l: 'stone3', g: 'gold2' });
}

/** Notice sign (tatefuda) on a post, 16x20. */
export function sign() {
  return parse(`
    .oooooooooooooo.
    ollllllllllllddo
    olddddddddddlddo
    olllllllllllllddo
    oldddddddddlddo.
    ollllllllllllddo
    oooooooooooooooo
    ......oldo......
    ......oldo......
    ......oldo......
    ......oldo......
    .....olldoo.....
    .....oooooo.....`, { o: 'wood0', d: 'wood2', l: 'wood4' });
}

/** Bamboo rail fence tile (horizontal run); `post` adds the tied post at the left edge. */
export function fence(post = true) {
  const g = grid(16, 20);
  for (const y of [8, 13]) {
    hline(g, 0, 15, y, 'grass5');
    hline(g, 0, 15, y + 1, 'teal1');
    for (let x = 3; x < 16; x += 7) set(g, x, y, 'teal0');
  }
  if (post) {
    fillRect(g, 1, 4, 3, 15, 'wood3');
    vline(g, 3, 4, 18, 'wood1');
    hline(g, 1, 3, 4, 'wood5');
    for (const y of [8, 13]) hline(g, 0, 4, y + 1, 'straw1');
  }
  return outline(g, { color: 'wood0' });
}

