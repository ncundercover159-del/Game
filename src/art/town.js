// Village and shrine architecture, painted procedurally: a parametric townhouse (tile or thatch roof,
// plaster or timber walls, koshi lattice, noren and signboard), plus the torii, shrine hall and
// street props. Light from the top-left; outlines in each material's darkest tone.
import { grid, set, get, fillRect, line, polygon, ellipse, outline, parse } from './raster.js';
import { hashf } from '../core/rng.js';

const hline = (g, x0, x1, y, c) => { for (let x = x0; x <= x1; x++) set(g, x, y, c); };
const vline = (g, x, y0, y1, c) => { for (let y = y0; y <= y1; y++) set(g, x, y, c); };

function tileRoof(g, x0, x1, y0, y1, seed, glaze = 'ink') {
  const inset = Math.round((y1 - y0) * 0.45);
  polygon(g, [[x0, y1], [x0 + inset, y0], [x1 - inset, y0], [x1, y1]], `${glaze}2`);
  for (let y = y0 + 2; y < y1; y += 3) for (let x = x0; x <= x1; x++) if (get(g, x, y)) set(g, x, y, `${glaze}1`);
  const mid = (x0 + x1) / 2;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!get(g, x, y) || (y - y0) % 3 === 2) continue;
    if (x < mid && (x + y) % 4 === 0) set(g, x, y, `${glaze}3`);
    if (hashf(x, y, seed, 2) > 0.95) set(g, x, y, 'teal0');
  }
  fillRect(g, x0 + inset - 2, y0 - 2, x1 - x0 - inset * 2 + 5, 3, `${glaze}1`);
  hline(g, x0 + inset - 2, x1 - inset + 2, y0 - 2, `${glaze}3`);
  set(g, x0 + inset - 3, y0 - 3, `${glaze}2`);
  set(g, x1 - inset + 3, y0 - 3, `${glaze}2`);
  hline(g, x0, x1, y1, 'ink0');
}

function thatchRoof(g, x0, x1, y0, y1, seed) {
  const inset = Math.round((y1 - y0) * 0.4);
  const mask = grid(g.w, g.h);
  polygon(mask, [[x0, y1], [x0 + inset, y0], [x1 - inset, y0], [x1, y1]], 'straw2');
  const mid = (x0 + x1) / 2;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (!get(mask, x, y)) continue;
    const strand = hashf(x, Math.floor(y / 3 + hashf(x, 0, seed, 2) * 3), seed, 1);
    let s = x < mid ? 3 : 2;
    if (strand > 0.78) s++;
    if (strand < 0.2) s--;
    if (y > y1 - 4) s = Math.min(s, 1 + (y1 - y) % 2);
    set(g, x, y, `straw${Math.max(0, Math.min(4, s))}`);
  }
  fillRect(g, x0 + inset - 1, y0 - 3, x1 - x0 - inset * 2 + 3, 4, 'wood1');
  hline(g, x0 + inset - 1, x1 - inset + 1, y0 - 3, 'wood3');
  hline(g, x0, x1, y1, 'wood0');
}

/**
 * A townhouse. `w` px wide; the wall is `wallH` tall under a roof `roofH` tall; the door is
 * centred at `door` px from the left. Returns the outlined grid (1 px padding).
 */
export function townhouse({ w, wallH = 30, roofH = 28, roof = 'tile', wall = 'wood', noren = null, sign = null, door = null, lattice = true, seed = 1, glaze = 'ink' }) {
  const h = roofH + wallH + 1;
  const g = grid(w, h);
  const wy = roofH - 4;
  const wx0 = 4, wx1 = w - 5;
  // Walls.
  if (wall === 'plaster') {
    fillRect(g, wx0, wy, wx1 - wx0 + 1, wallH, 'ink6');
    fillRect(g, wx1 - 3, wy, 4, wallH, 'ink5');
    fillRect(g, wx0, wy + wallH - 8, wx1 - wx0 + 1, 8, 'wood2');
    hline(g, wx0, wx1, wy + wallH - 8, 'wood3');
  } else {
    fillRect(g, wx0, wy, wx1 - wx0 + 1, wallH, 'wood2');
    for (let y = wy; y < wy + wallH; y += 4) hline(g, wx0, wx1, y, 'wood1');
  }
  for (let x = wx0; x <= wx1; x += 16) { fillRect(g, x, wy, 3, wallH, 'wood1'); vline(g, x, wy, wy + wallH - 1, 'wood3'); }
  const dc = door ?? Math.round(w / 2);
  // Koshi lattice windows either side of the door.
  if (lattice) {
    for (const cx of [dc - 22, dc + 22]) {
      if (cx - 7 < wx0 + 3 || cx + 7 > wx1 - 3) continue;
      fillRect(g, cx - 7, wy + 6, 14, 12, 'wood0');
      for (let x = cx - 6; x <= cx + 6; x += 2) vline(g, x, wy + 6, wy + 17, 'wood3');
      hline(g, cx - 7, cx + 7, wy + 5, 'wood4');
    }
  }
  // Doorway with noren.
  fillRect(g, dc - 7, wy + 4, 14, wallH - 4, 'wood0');
  vline(g, dc, wy + 12, wy + wallH - 1, 'wood1');
  if (noren) {
    fillRect(g, dc - 9, wy + 3, 18, 11, `${noren}2`);
    for (let x = dc - 9; x < dc + 9; x += 6) vline(g, x, wy + 3, wy + 13, `${noren}1`);
    hline(g, dc - 9, dc + 8, wy + 13, `${noren}1`);
    ellipse(g, dc, wy + 8, 2.6, 2.6, 'ink6');
  }
  // Roof and signboard.
  if (roof === 'thatch') thatchRoof(g, 0, w - 1, 4, roofH, seed);
  else tileRoof(g, 0, w - 1, 5, roofH - 2, seed, glaze);
  fillRect(g, wx0, wy, wx1 - wx0 + 1, 2, 'wood0');
  if (sign) {
    fillRect(g, dc - 10, roofH - 12, 20, 7, 'wood4');
    hline(g, dc - 10, dc + 9, roofH - 12, 'wood5');
    for (let x = dc - 7; x <= dc + 6; x += 3) vline(g, x, roofH - 10, roofH - 8, sign);
  }
  // Stone plinth.
  for (let x = 2; x < w - 3; x += 6) {
    fillRect(g, x, h - 4, 5, 4, 'stone2');
    hline(g, x, x + 4, h - 4, 'stone3');
  }
  return outline(g, { color: 'ink0' });
}

/** Vermilion torii gate, `w` wide (posts stand just inside each end), 44 tall. */
export function torii(w = 76) {
  const g = grid(w, 44);
  fillRect(g, 0, 2, w, 4, 'ink1');
  hline(g, 0, w - 1, 2, 'ink3');
  set(g, 0, 1, 'ink1'); set(g, w - 1, 1, 'ink1');
  fillRect(g, 3, 6, w - 6, 3, 'red2');
  hline(g, 3, w - 4, 6, 'red3');
  fillRect(g, 4, 13, w - 8, 3, 'red2');
  hline(g, 4, w - 5, 13, 'red3');
  fillRect(g, w / 2 - 4, 8, 8, 6, 'ink1');
  for (const x of [6, w - 11]) {
    fillRect(g, x, 6, 5, 38, 'red2');
    vline(g, x, 6, 43, 'red3');
    vline(g, x + 4, 6, 43, 'red1');
    fillRect(g, x - 1, 40, 7, 4, 'ink1');
  }
  return outline(g, { color: 'red0' });
}

/** Shrine hall (honden): vermilion pillars, cypress-bark roof with crossed chigi. 112x84. */
export function honden() {
  const w = 112, h = 84;
  const g = grid(w, h);
  fillRect(g, 10, 46, 92, 30, 'ink6');
  for (const x of [10, 30, 50, 58, 78, 98]) { fillRect(g, x, 44, 4, 32, 'red2'); vline(g, x, 44, 75, 'red3'); vline(g, x + 3, 44, 75, 'red1'); }
  fillRect(g, 46, 52, 20, 24, 'wood1');
  for (let x = 47; x < 66; x += 3) vline(g, x, 52, 75, 'wood3');
  // Offering box and bell rope.
  fillRect(g, 48, 66, 16, 8, 'wood3');
  for (let x = 49; x < 64; x += 2) vline(g, x, 66, 69, 'wood1');
  vline(g, 56, 40, 60, 'red3');
  vline(g, 57, 40, 60, 'ink6');
  ellipse(g, 56.5, 40, 3, 2.5, 'gold1');
  // Steps and veranda.
  fillRect(g, 4, 76, 104, 3, 'wood4');
  hline(g, 4, 107, 76, 'wood5');
  fillRect(g, 42, 79, 28, 5, 'stone3');
  hline(g, 42, 69, 81, 'stone1');
  // Roof: dark bark with a curved eave.
  polygon(g, [[0, 48], [16, 14], [96, 14], [112, 48]], 'wood1');
  for (let y = 16; y < 48; y += 2) for (let x = 0; x < w; x++) if (get(g, x, y) && x < 56 && (x + y) % 5 === 0) set(g, x, y, 'wood2');
  fillRect(g, 0, 44, w, 4, 'wood0');
  hline(g, 0, w - 1, 44, 'wood3');
  fillRect(g, 14, 10, 84, 5, 'wood2');
  hline(g, 14, 97, 10, 'gold1');
  for (const x of [30, 44, 58, 72]) fillRect(g, x, 6, 6, 4, 'wood3');
  line(g, 12, 2, 20, 12, 'wood3'); line(g, 20, 2, 12, 12, 'wood3');
  line(g, 92, 2, 100, 12, 'wood3'); line(g, 100, 2, 92, 12, 'wood3');
  return outline(g, { color: 'ink0' });
}

/** Roofed notice board (kōsatsuba) with paper notices pinned. 40x36. */
export function noticeBoard() {
  const g = grid(40, 36);
  polygon(g, [[0, 9], [6, 1], [34, 1], [40, 9]], 'ink2');
  hline(g, 0, 39, 9, 'ink0');
  for (let y = 3; y < 9; y += 2) hline(g, 4, 35, y, 'ink1');
  fillRect(g, 4, 10, 32, 16, 'wood3');
  hline(g, 4, 35, 10, 'wood4');
  for (const [x, y, c] of [[7, 13, 'ink6'], [16, 12, 'straw4'], [26, 14, 'ink6'], [11, 19, 'straw4'], [22, 20, 'ink6']]) {
    fillRect(g, x, y, 7, 6, c);
    hline(g, x + 1, x + 5, y + 2, 'ink3');
    hline(g, x + 1, x + 4, y + 4, 'ink3');
    set(g, x + 3, y, 'red2');
  }
  for (const x of [5, 32]) { fillRect(g, x, 10, 3, 26, 'wood2'); vline(g, x, 10, 35, 'wood4'); }
  return outline(g, { color: 'wood0' });
}

/** Stone Jizō with a red bib and cap, 14x20. */
export function jizo() {
  return parse(`
    ....rrrr......
    ...rRRRRr.....
    ...oooooo.....
    ..ollhhhdo....
    ..olhhhhddo...
    ..ohhoohddo...
    ...ohhhhdo....
    ..rrRRRRrr....
    .rRRRRRRRRr...
    .oRRRRRRRRo...
    olllhhhhhddo..
    ollhhhhhhhddo.
    ollhhhhhhhddo.
    olhhhhhhhhddo.
    olhhhhhhhdddo.
    .ooooooooooo..
    oddddddddddddo
    oooooooooooooo`, { o: 'stone0', d: 'stone1', l: 'stone2', h: 'stone3', r: 'red1', R: 'red2' });
}

/** Wooden bench with a red felt cover (teahouse), 26x12. */
export function bench() {
  const g = grid(26, 12);
  fillRect(g, 0, 2, 26, 4, 'red2');
  hline(g, 0, 25, 2, 'red3');
  fillRect(g, 0, 6, 26, 2, 'wood2');
  for (const x of [2, 22]) fillRect(g, x, 8, 2, 4, 'wood1');
  return outline(g, { color: 'wood0' });
}

/** Paper parasol (nodate-gasa) over the teahouse bench, 30x34. */
export function parasol() {
  const g = grid(30, 34);
  ellipse(g, 15, 9, 15, 8, 'red2');
  for (let a = 0; a < 8; a++) line(g, 15, 3, Math.round(15 + Math.cos(a * 0.45 + 0.2) * 14), 12, 'red1');
  ellipse(g, 11, 6, 6, 3, 'red3');
  vline(g, 15, 9, 33, 'wood1');
  return outline(g, { color: 'red0' });
}

/** Straw rice bales stacked (Kuroda-ya), 28x20. */
export function riceBales() {
  const g = grid(28, 20);
  for (const [x, y] of [[0, 8], [14, 8], [7, 0]]) {
    ellipse(g, x + 7, y + 6, 7, 6, 'straw2');
    ellipse(g, x + 6, y + 5, 5, 4, 'straw3');
    vline(g, x + 3, y + 1, y + 11, 'straw1');
    vline(g, x + 10, y + 1, y + 11, 'straw1');
  }
  return outline(g, { color: 'straw0' });
}

/** Mailbox post by the farmhouse, 12x20. */
export function mailbox() {
  const g = grid(12, 20);
  fillRect(g, 1, 1, 10, 8, 'red2');
  hline(g, 1, 10, 1, 'red3');
  fillRect(g, 3, 4, 6, 2, 'red0');
  fillRect(g, 5, 9, 2, 11, 'wood2');
  vline(g, 5, 9, 19, 'wood4');
  return outline(g, { color: 'red0' });
}

/** Rack of wooden ema prayer plaques under a little roof, 34x30. */
export function emaRack() {
  const g = grid(34, 30);
  polygon(g, [[0, 7], [5, 1], [29, 1], [34, 7]], 'ink2');
  hline(g, 0, 33, 7, 'ink0');
  for (const x of [3, 29]) { fillRect(g, x, 8, 2, 22, 'wood2'); vline(g, x, 8, 29, 'wood4'); }
  for (const y of [11, 19]) hline(g, 3, 30, y, 'wood1');
  for (const [x, y] of [[6, 12], [12, 13], [18, 12], [24, 13], [8, 20], [15, 21], [22, 20]]) {
    polygon(g, [[x, y + 2], [x + 2, y], [x + 4, y + 2], [x + 4, y + 6], [x, y + 6]], 'wood4');
    set(g, x + 2, y + 3, 'red2');
    set(g, x + 1, y + 5, 'ink3');
  }
  return outline(g, { color: 'wood0' });
}

/** Shimenawa rope with zigzag paper shide, wrapped round the sacred tree's trunk. 22x12. */
export function shimenawa() {
  const g = grid(22, 12);
  for (let x = 0; x < 22; x++) {
    const y = 2 + Math.round(Math.sin((x / 21) * Math.PI) * 2);
    set(g, x, y, 'straw3');
    set(g, x, y + 1, (x % 3) ? 'straw2' : 'straw1');
  }
  for (const x of [5, 11, 16]) {
    const y = 5 + Math.round(Math.sin((x / 21) * Math.PI) * 2) - 1;
    for (const [dx, dy] of [[0, 0], [1, 1], [0, 2], [1, 3], [0, 4]]) set(g, x + dx, y + dy, 'ink6');
  }
  return outline(g, { color: 'straw0' });
}

/** The sealed rear gate of the precinct: a plank door between posts under a small tile roof. 36x40. */
export function rearGate() {
  const g = grid(36, 40);
  fillRect(g, 6, 12, 24, 28, 'wood2');
  for (let x = 8; x < 30; x += 4) vline(g, x, 12, 39, 'wood1');
  hline(g, 6, 29, 22, 'wood0');
  hline(g, 6, 29, 30, 'wood0');
  for (const x of [2, 30]) { fillRect(g, x, 8, 4, 32, 'wood1'); vline(g, x, 8, 39, 'wood3'); }
  tileRoof(g, 0, 35, 4, 11, 5);
  // A shimenawa across the gate and a lock bar: sealed.
  for (let x = 4; x < 32; x++) set(g, x, 14 + Math.round(Math.sin(((x - 4) / 27) * Math.PI) * 2), 'straw3');
  fillRect(g, 14, 25, 8, 3, 'ink2');
  hline(g, 14, 21, 25, 'ink4');
  return outline(g, { color: 'ink0' });
}
