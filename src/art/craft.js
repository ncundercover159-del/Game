// Artisan machines (sprites and icons), artisan goods, dishes (mostly bowls with what is in them),
// recipe scrolls and backpacks. 16x16 icons; machines stand about 16x22.
import { grid, set, get, fillRect, ellipse, line, outline, parse, crop, polygon } from './raster.js';

const hline = (g, x0, x1, y, c) => { for (let x = x0; x <= x1; x++) set(g, x, y, c); };
const vline = (g, x, y0, y1, c) => { for (let y = y0; y <= y1; y++) set(g, x, y, c); };

// ---------------------------------------------------------------- machines (16 wide)

function barrel(g, y0, y1, hoop = 'ink2') {
  for (let y = y0; y <= y1; y++) {
    const bulge = Math.round(Math.sin(((y - y0) / (y1 - y0)) * Math.PI) * 1.5);
    fillRect(g, 2 - bulge, y, 12 + bulge * 2, 1, 'wood3');
    set(g, 2 - bulge, y, 'wood1'); set(g, 13 + bulge, y, 'wood1');
    for (const x of [5, 9]) set(g, x, y, 'wood2');
  }
  for (const y of [y0 + 2, y1 - 2]) hline(g, 1, 14, y, hoop);
}

const MACHINE_ART = {
  sake_barrel(g) {
    barrel(g, 5, 21);
    ellipse(g, 8, 5, 6, 2, 'wood4'); hline(g, 3, 13, 4, 'wood5');
    fillRect(g, 5, 10, 6, 6, 'ink6'); for (const [x, y] of [[6, 11], [8, 12], [7, 14], [9, 14]]) set(g, x, y, 'ink1');
    polygon(g, [[4, 3], [12, 3], [10, 0], [6, 0]], 'straw3');
  },
  miso_barrel(g) {
    barrel(g, 6, 21, 'straw1');
    fillRect(g, 3, 4, 10, 3, 'wood2'); hline(g, 3, 12, 4, 'wood4');
    for (const [x, y] of [[5, 1], [9, 2], [7, 0]]) fillRect(g, x, y, 3, 3, 'stone3');
  },
  tsukemono_tub(g) {
    barrel(g, 10, 21, 'straw1');
    fillRect(g, 3, 8, 10, 3, 'wood4'); hline(g, 3, 12, 8, 'wood5');
    ellipse(g, 8, 6, 3.5, 2.5, 'stone3'); ellipse(g, 7, 5, 2, 1.2, 'stone4');
  },
  tofu_press(g) {
    fillRect(g, 2, 10, 12, 11, 'wood3');
    for (let y = 12; y < 21; y += 3) hline(g, 2, 13, y, 'wood2');
    fillRect(g, 3, 6, 10, 4, 'wood4'); hline(g, 3, 12, 6, 'wood5');
    fillRect(g, 5, 2, 6, 4, 'stone2'); hline(g, 5, 10, 2, 'stone3');
    for (const x of [1, 14]) vline(g, x, 4, 21, 'wood1');
  },
  smoker(g) {
    for (const x of [1, 14]) vline(g, x, 2, 21, 'wood1');
    for (const y of [5, 10, 15]) hline(g, 1, 14, y, 'wood2');
    for (const [x, y] of [[3, 6], [8, 6], [5, 11], [10, 11]]) { fillRect(g, x, y, 3, 3, 'wood4'); set(g, x, y + 2, 'wood2'); }
    fillRect(g, 3, 18, 10, 3, 'stone1'); for (const x of [5, 8, 10]) set(g, x, 17, 'red3');
  },
  charcoal_kiln(g) {
    ellipse(g, 8, 14, 7, 8, 'stone2');
    ellipse(g, 6, 11, 4, 4, 'stone3');
    fillRect(g, 5, 16, 6, 5, 'ink0'); for (const [x, y] of [[6, 19], [8, 18], [9, 20]]) set(g, x, y, 'red3');
    fillRect(g, 11, 2, 3, 6, 'stone1'); hline(g, 11, 13, 2, 'stone3');
  },
  compost_bin(g) {
    fillRect(g, 1, 8, 14, 13, 'wood2');
    for (let x = 1; x < 15; x += 4) vline(g, x, 8, 20, 'wood1');
    hline(g, 1, 14, 8, 'wood4');
    for (const [x, y] of [[3, 6], [6, 5], [9, 6], [12, 6], [5, 7], [10, 7]]) { set(g, x, y, 'straw2'); set(g, x, y + 1, 'wood1'); }
  },
};

/** Machine sprites (16x24 with outline) keyed by machine id. */
export function machineSprites() {
  const out = {};
  for (const [id, paint] of Object.entries(MACHINE_ART)) {
    const g = grid(16, 22);
    paint(g);
    out[id] = outline(g, { color: 'ink0' });
  }
  return out;
}

/** Shrink a sprite to a 16x16 icon (nearest neighbour; these shapes are chunky enough). */
export function iconOf(g) {
  const s = Math.min(1, 15 / g.h, 15 / g.w);
  const out = grid(16, 16);
  const w = Math.round(g.w * s), h = Math.round(g.h * s), ox = Math.floor((16 - w) / 2), oy = 16 - h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(out, ox + x, oy + y, get(g, Math.floor(x / s), Math.floor(y / s)));
  return out;
}

// ---------------------------------------------------------------- goods and dishes

/** A lacquered bowl with a filling painted by `fill`. */
function bowl(fill, lacquer = ['red0', 'red1', 'red2']) {
  const g = grid(14, 14);
  ellipse(g, 7, 7, 6.5, 2.5, lacquer[1]);
  fill(g);
  for (let y = 8; y < 13; y++) { const w = Math.round(6.5 - (y - 8) * 0.9); hline(g, 7 - w, 7 + w, y, y === 8 ? lacquer[2] : lacquer[1]); set(g, 7 - w, y, lacquer[2]); }
  hline(g, 5, 9, 13, lacquer[0]);
  return crop(outline(g, { color: 'ink0' }), 0, 0, 16, 16);
}
const rice = (g, c = 'ink6') => { ellipse(g, 7, 6, 5.5, 2.5, c); for (const [x, y] of [[4, 5], [8, 4], [10, 6], [6, 7]]) set(g, x, y, 'ink5'); };

export function goodsIcons() {
  const sprites = machineSprites();
  const out = {};
  for (const [id, g] of Object.entries(sprites)) out[id] = iconOf(g);
  Object.assign(out, {
    compost: parse(`
      ................
      ......oooo......
      .....oSSSSo.....
      ....oSssssSo....
      ...oSsbbbbsSo...
      ..oSsbBbbBbsSo..
      ..oSbbbbbbbbSo..
      ..oSbBbbbBbbSo..
      ..oSbbbbbbbbSo..
      ..oSbbbBbbbbSo..
      ..oSsbbbbbbsSo..
      ...oSssssssSo...
      ....oooooooo....
      ................
      ................
      ................`, { o: 'wood0', S: 'straw2', s: 'straw1', b: 'wood1', B: 'grass1' }),
    tofu: (() => { const g = grid(16, 16); fillRect(g, 3, 5, 10, 8, 'ink6'); fillRect(g, 3, 11, 10, 2, 'ink5'); fillRect(g, 11, 5, 2, 8, 'ink5'); hline(g, 3, 12, 5, 'ink6'); return outline(g, { color: 'ink3', pad: 0 }); })(),
    tsukemono: bowl((g) => { for (const [x, c] of [[3, 'gold2'], [6, 'grass4'], [9, 'sakura1'], [11, 'gold2']]) { fillRect(g, x, 4, 2, 3, c); } }, ['wood0', 'wood2', 'wood3']),
    kunsei: (() => { const g = grid(16, 16); line(g, 1, 14, 14, 1, 'wood3'); ellipse(g, 8, 7, 5, 2.5, 'wood2'); ellipse(g, 7, 6, 3, 1.5, 'wood4'); set(g, 11, 6, 'ink0'); for (const [x, y] of [[2, 8], [2, 6], [3, 7]]) set(g, x, y, 'wood1'); return outline(g, { color: 'wood0', pad: 0 }); })(),
    sumi: (() => { const g = grid(16, 16); for (const [x, y] of [[2, 9], [5, 7], [8, 9], [4, 11], [9, 5]]) { fillRect(g, x, y, 6, 2, 'ink1'); set(g, x, y, 'ink3'); } return outline(g, { color: 'ink0', pad: 0 }); })(),
    miso: bowl((g) => { ellipse(g, 7, 6, 5.5, 2.5, 'wood2'); set(g, 5, 5, 'wood4'); set(g, 9, 6, 'wood3'); }, ['wood0', 'wood3', 'wood4']),
    sake: parse(`
      ................
      ......ooo.......
      ......oWo.......
      ......oWo.......
      .....oWWWo......
      ....oWWWWWo.....
      ...oWWWWWwWo....
      ...oWrrrrwWo....
      ...oWrRRrwWo....
      ...oWrrrrwWo....
      ...oWWWWWwWo....
      ...oWWWWwwWo....
      ....oWWWwWo.....
      .....ooooo......
      ................
      ................`, { o: 'ink2', W: 'ink6', w: 'ink5', r: 'red2', R: 'ink6' }),
    yakiimo: (() => { const g = grid(16, 16); ellipse(g, 8, 8, 6, 3.5, 'sakura0'); ellipse(g, 7, 7, 4, 2, 'sakura1'); fillRect(g, 9, 6, 3, 4, 'gold2'); set(g, 10, 6, 'gold3'); return outline(g, { color: 'wood0', pad: 0 }); })(),
    tamagoyaki: (() => { const g = grid(16, 16); fillRect(g, 2, 6, 12, 6, 'gold2'); for (const x of [5, 9]) vline(g, x, 6, 11, 'gold1'); hline(g, 2, 13, 6, 'gold3'); hline(g, 2, 13, 11, 'gold0'); return outline(g, { color: 'wood0', pad: 0 }); })(),
    miso_soup: bowl((g) => { ellipse(g, 7, 6, 5.5, 2.5, 'wood3'); for (const [x, y] of [[4, 5], [8, 6], [10, 5]]) set(g, x, y, 'grass4'); set(g, 6, 6, 'ink6'); }),
    shioyaki: (() => { const g = grid(16, 16); line(g, 1, 13, 14, 2, 'wood3'); ellipse(g, 8, 7, 5, 2.5, 'stone3'); ellipse(g, 7, 6, 3, 1.5, 'stone4'); for (const [x, y] of [[5, 7], [8, 6], [10, 8]]) set(g, x, y, 'ink6'); set(g, 11, 6, 'ink0'); return outline(g, { color: 'ink0', pad: 0 }); })(),
    tempura: (() => { const g = grid(16, 16); for (const [x, y] of [[4, 8], [9, 7], [7, 10]]) { ellipse(g, x, y, 3.5, 2.5, 'gold2'); set(g, x - 1, y - 1, 'gold3'); set(g, x + 1, y, 'grass3'); } return outline(g, { color: 'gold0', pad: 0 }); })(),
    soba_noodles: bowl((g) => { ellipse(g, 7, 6, 5.5, 2.5, 'wood1'); for (let x = 3; x < 12; x += 2) line(g, x, 4, x + 1, 7, 'stone2'); set(g, 9, 5, 'grass4'); }, ['ink0', 'ink1', 'ink2']),
    sekihan: bowl((g) => { rice(g, 'sakura3'); for (const [x, y] of [[5, 5], [8, 6], [10, 5], [6, 7], [9, 4]]) set(g, x, y, 'red1'); }),
    yudofu: bowl((g) => { ellipse(g, 7, 6, 5.5, 2.5, 'water4'); fillRect(g, 4, 5, 3, 2, 'ink6'); fillRect(g, 8, 4, 3, 2, 'ink6'); set(g, 10, 7, 'grass4'); }, ['ink0', 'ink2', 'ink3']),
    kinpira: bowl((g) => { ellipse(g, 7, 6, 5.5, 2.5, 'wood2'); for (let x = 3; x < 12; x += 2) line(g, x, 7, x + 2, 4, 'wood4'); set(g, 6, 5, 'red2'); }, ['ink0', 'ink1', 'ink2']),
    ochazuke: bowl((g) => { ellipse(g, 7, 6, 5.5, 2.5, 'grass5'); for (const [x, y] of [[5, 5], [8, 6], [7, 4], [4, 6]]) set(g, x, y, 'ink6'); set(g, 9, 5, 'teal1'); }, ['ink0', 'ink2', 'ink3']),
    kurigohan: bowl((g) => { rice(g); for (const [x, y] of [[5, 5], [9, 5]]) { fillRect(g, x, y, 2, 2, 'gold2'); set(g, x, y, 'gold3'); } }),
    matsutake_gohan: bowl((g) => { rice(g, 'straw4'); for (const [x, y] of [[5, 5], [9, 4]]) { fillRect(g, x, y, 2, 3, 'wood3'); set(g, x, y, 'wood2'); } set(g, 7, 6, 'grass4'); }),
    unadon: bowl((g) => { rice(g); fillRect(g, 3, 4, 9, 3, 'wood2'); for (let x = 4; x < 11; x += 2) set(g, x, 4, 'wood4'); set(g, 11, 5, 'grass4'); }, ['ink0', 'ink1', 'red1']),
    oden: (() => { const g = grid(16, 16); line(g, 8, 1, 8, 15, 'wood3'); ellipse(g, 8, 4, 3, 2.5, 'straw3'); fillRect(g, 5, 7, 6, 3, 'ink6'); ellipse(g, 8, 12, 3, 2, 'ink5'); set(g, 7, 11, 'gold2'); return outline(g, { color: 'wood0', pad: 0 }); })(),
    inari: (() => {
      const g = grid(16, 16);
      for (const [x, y] of [[3, 6], [9, 8]]) { ellipse(g, x + 2.5, y + 3, 3.5, 2.8, 'gold1'); ellipse(g, x + 2, y + 2, 2.5, 1.8, 'gold2'); set(g, x + 1, y + 1, 'straw4'); }
      return outline(g, { color: 'wood0', pad: 0 });
    })(),
    pack24: parse(`
      ................
      ....oooooooo....
      ...oWwWWWWwWo...
      ...ow......wo...
      ..oWWWWWWWWWWo..
      ..oWwwwwwwwwWo..
      ..oWwRRRRRRwWo..
      ..oWwwwwwwwwWo..
      ..oWwwwwwwwwWo..
      ..oWwRRRRRRwWo..
      ..oWwwwwwwwwWo..
      ..oWWWWWWWWWWo..
      ...oooooooooo...
      ................
      ................
      ................`, { o: 'wood0', W: 'wood2', w: 'wood3', R: 'wood1' }),
  });
  out.pack36 = parse(`
      ................
      ....oooooooo....
      ...oWwWWWWwWo...
      ...ow......wo...
      ..oWWWWWWWWWWo..
      ..oWwwwwwwwwWo..
      ..oWwRRRRRRwWo..
      ..oWwwwwwwwwWo..
      ..oWwRRRRRRwWo..
      ..oWwwwwwwwwWo..
      ..oWwRRRRRRwWo..
      ..oWWWWWWWWWWo..
      ...oooooooooo...
      ................
      ................
      ................`, { o: 'indigo0', W: 'indigo1', w: 'indigo2', R: 'gold1' });
  return out;
}

/** A tied recipe scroll. */
export function scrollIcon() {
  const g = grid(16, 16);
  fillRect(g, 3, 4, 10, 8, 'ink6');
  for (const y of [6, 8, 10]) hline(g, 5, 11, y, 'ink3');
  for (const x of [2, 13]) { fillRect(g, x, 3, 1, 10, 'wood2'); set(g, x, 3, 'wood4'); }
  vline(g, 8, 4, 11, 'red2');
  return outline(g, { color: 'wood0', pad: 0 });
}
