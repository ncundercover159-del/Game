// 16x16 icons for wild forage and dug-up artefacts, plus the forage-spot and dig-spot sprites.
// Shapes are small painters (buds, fiddleheads, mushrooms, nuts, fruit) plus a few typed grids.
import { grid, set, fillRect, ellipse, line, outline, parse, crop } from './raster.js';

const icon = (paint) => {
  const g = grid(14, 14);
  paint(g);
  return crop(outline(g), 0, 0, 16, 16);
};

// A fiddlehead fern: a stem curling into a spiral head.
function fiddle(g, stem, head) {
  line(g, 7, 13, 7, 6, stem);
  line(g, 8, 13, 8, 7, stem);
  for (const [x, y] of [[7, 5], [6, 4], [6, 3], [7, 2], [8, 2], [9, 3], [9, 4], [8, 5], [7, 4], [8, 4]]) set(g, x, y, head);
  set(g, 7, 3, 'grass6');
}

// A mushroom: cap ellipse over a stem, lit top-left.
function mushroom(g, cap, stem, { wide = 5, tall = 3, spots = null, cx = 7 } = {}) {
  fillRect(g, cx - 1, 7, 3, 6, stem[0]);
  set(g, cx - 1, 8, stem[1]);
  ellipse(g, cx, 6, wide, tall, cap[0]);
  ellipse(g, cx - 1, 5, wide - 2, tall - 1, cap[1]);
  set(g, cx - 2, 4, cap[2]);
  if (spots) for (const [x, y] of [[cx - 2, 6], [cx + 2, 5], [cx, 4]]) set(g, x, y, spots);
}

// Round fruit or nut with a highlight and a leaf.
function fruit(g, body, { r = 4, leaf = true, cx = 7, cy = 8 } = {}) {
  ellipse(g, cx, cy, r, r, body[0]);
  ellipse(g, cx - 1, cy - 1, r - 1.5, r - 1.5, body[1]);
  set(g, cx - 2, cy - 2, body[2]);
  if (leaf) { set(g, cx + 1, cy - r - 1, 'grass3'); set(g, cx + 2, cy - r - 1, 'grass4'); set(g, cx + 2, cy - r - 2, 'grass4'); }
}

export function forageIcons() {
  return {
    warabi: icon((g) => fiddle(g, 'grass3', 'grass4')),
    zenmai: icon((g) => { fiddle(g, 'wood3', 'wood4'); set(g, 9, 2, 'straw3'); set(g, 6, 5, 'straw3'); }),
    fukinoto: icon((g) => {
      ellipse(g, 7, 8, 5, 5, 'grass3'); ellipse(g, 6, 7, 3.5, 3.5, 'grass5');
      for (const [x, y] of [[7, 3], [3, 8], [11, 8], [7, 12]]) set(g, x, y, 'grass2');
      ellipse(g, 7, 8, 1.8, 1.8, 'straw4');
    }),
    taranome: icon((g) => {
      line(g, 7, 13, 7, 8, 'wood3');
      ellipse(g, 7, 6, 3, 4, 'grass4'); ellipse(g, 6, 5, 2, 3, 'grass5');
      set(g, 7, 1, 'red3'); set(g, 5, 3, 'red3'); set(g, 9, 3, 'red3');
    }),
    takenoko: icon((g) => {
      for (let y = 2; y < 14; y++) { const w = Math.floor((y - 1) / 2.4); fillRect(g, 7 - w, y, w * 2 + 1, 1, y % 3 ? 'wood3' : 'wood2'); }
      set(g, 7, 1, 'grass3'); line(g, 6, 5, 5, 12, 'wood4'); set(g, 7, 2, 'straw3');
    }),
    myoga: icon((g) => {
      ellipse(g, 7, 8, 3.5, 5, 'sakura1'); ellipse(g, 6, 7, 2, 3.5, 'red3');
      line(g, 7, 3, 7, 12, 'sakura0'); set(g, 7, 2, 'straw4');
    }),
    yamajiso: icon((g) => {
      for (const [cx, cy] of [[5, 6], [9, 6], [7, 10]]) { ellipse(g, cx, cy, 3, 2.5, 'grass2'); set(g, cx - 1, cy - 1, 'grass4'); }
      line(g, 7, 13, 7, 8, 'grass1');
    }),
    ajisai: icon((g) => {
      for (const [cx, cy, c] of [[5, 5, 'indigo2'], [9, 5, 'indigo3'], [4, 9, 'water3'], [8, 8, 'indigo2'], [10, 10, 'water3'], [6, 11, 'indigo3']]) {
        ellipse(g, cx, cy, 2, 2, c); set(g, cx, cy, 'ink6');
      }
    }),
    yamamomo: icon((g) => { fruit(g, ['red1', 'red2', 'red4'], { r: 3, cx: 5, cy: 9 }); fruit(g, ['red0', 'red1', 'red3'], { r: 3, cx: 9, cy: 7, leaf: false }); }),
    matsutake: icon((g) => { mushroom(g, ['wood2', 'wood3', 'wood4'], ['straw3', 'straw4'], { wide: 3.5, tall: 2.5 }); fillRect(g, 6, 7, 3, 6, 'straw3'); }),
    shiitake: icon((g) => mushroom(g, ['wood1', 'wood2', 'wood4'], ['straw3', 'straw4'], { spots: 'straw4' })),
    maitake: icon((g) => {
      for (const [cx, cy] of [[4, 9], [7, 6], [10, 9], [6, 11], [9, 12], [7, 9]]) { ellipse(g, cx, cy, 2.8, 1.8, 'wood2'); set(g, cx - 1, cy - 1, 'wood4'); }
    }),
    kuri: icon((g) => { chestnut(g); set(g, 7, 2, 'wood1'); }),
    ginnan: icon((g) => { for (const [cx, cy] of [[5, 7], [9, 6], [7, 10]]) { ellipse(g, cx, cy, 2.5, 2, 'straw3'); set(g, cx - 1, cy - 1, 'straw4'); } }),
    akebi: icon((g) => {
      ellipse(g, 7, 8, 3.5, 5.5, 'sakura0'); ellipse(g, 6, 7, 2, 4, 'sakura1');
      line(g, 8, 4, 8, 12, 'ink6'); set(g, 7, 2, 'wood2');
    }),
    momiji: parse(`
      ................
      .......o........
      ......oro.......
      ..o...oro...o...
      ..oro.oRo..oro..
      ...orooRoooro...
      .ooorrrRrrrrooo.
      .orrrrRRRrrrrro.
      ..oorrrRrrrroo..
      ....orrRrrro....
      ...orroRoorro...
      ...ooo.o..ooo...
      .......o........
      .......w........
      .......w........
      ................`, { o: 'red0', r: 'red2', R: 'red3', w: 'wood2' }),
    yuzu: icon((g) => fruit(g, ['gold1', 'gold2', 'gold3'], { r: 4.5 })),
    nanten: icon((g) => {
      line(g, 7, 12, 7, 3, 'wood2'); line(g, 7, 6, 4, 4, 'wood2'); line(g, 7, 7, 10, 5, 'wood2');
      for (const [x, y] of [[4, 5], [3, 7], [5, 8], [10, 6], [11, 8], [9, 9], [7, 10], [6, 11], [8, 12]]) { set(g, x, y, 'red2'); set(g, x, y - 1, 'red3'); }
    }),
    tsubaki: icon((g) => {
      for (const [cx, cy] of [[7, 4], [4, 7], [10, 7], [5, 10], [9, 10]]) ellipse(g, cx, cy, 2.5, 2.5, 'red2');
      ellipse(g, 7, 7, 2, 2, 'gold2'); set(g, 6, 6, 'gold3'); set(g, 5, 3, 'red3');
    }),
    yamaimo: icon((g) => {
      for (let i = 0; i < 10; i++) { const x = 3 + i, y = 11 - Math.round(i * 0.7); fillRect(g, x, y, 2, 3, i % 3 ? 'wood3' : 'wood2'); }
      set(g, 12, 3, 'grass3'); set(g, 13, 2, 'grass4');
    }),
    // Artefacts from dig spots.
    kosen: icon((g) => { ellipse(g, 7, 7, 5, 5, 'teal0'); ellipse(g, 6, 6, 3.5, 3.5, 'teal1'); fillRect(g, 6, 6, 3, 3, 'ink0'); set(g, 4, 4, 'grass5'); }),
    toki: icon((g) => {
      // A curved shard of glazed pottery with a painted band.
      fillRect(g, 3, 4, 9, 7, 'red1');
      for (const [x, y] of [[3, 4], [11, 4], [3, 10], [11, 10], [4, 11], [12, 7]]) set(g, x, y, 0);
      fillRect(g, 4, 5, 5, 2, 'red3');
      line(g, 3, 8, 11, 8, 'ink1');
    }),
    yajiri: parse(`
      ................
      .......o........
      ......oLo.......
      ......oLo.......
      .....oLlko......
      .....oLlko......
      ....oLllkko.....
      ....oLllkko.....
      ...oLlllkkko....
      ...ooooRoooo....
      .......R........
      .......w........
      .......w........
      .......w........
      ................
      ................`, { o: 'ink0', L: 'ink4', l: 'ink3', k: 'ink2', R: 'red1', w: 'wood2' }),
    magatama: icon((g) => {
      ellipse(g, 6, 7, 4, 4, 'grass2'); ellipse(g, 5, 6, 2.5, 2.5, 'grass4');
      for (const [x, y] of [[9, 9], [10, 10], [10, 11], [9, 12], [8, 12]]) set(g, x, y, 'grass2');
      set(g, 5, 6, 'ink0'); set(g, 4, 5, 'grass6');
    }),
  };
}

// A chestnut: spiky husk split open around a glossy nut.
function chestnut(g) {
  ellipse(g, 7, 8, 5.5, 5, 'grass3');
  for (let a = 0; a < 16; a++) {
    const x = Math.round(7 + Math.cos(a * 0.39) * 6.5), y = Math.round(8 + Math.sin(a * 0.39) * 6);
    set(g, x, y, 'grass4');
  }
  ellipse(g, 7, 8, 3, 3, 'wood2'); ellipse(g, 6, 7, 1.8, 1.8, 'wood3'); set(g, 6, 6, 'straw4');
}

/** A dig spot: churned earth with wriggling worms, seen on grass or dirt. 16x10. */
export function digSpot() {
  const g = grid(16, 10);
  for (const [x, y] of [[3, 5], [6, 3], [9, 6], [12, 4], [5, 7], [10, 2]]) { set(g, x, y, 'wood1'); set(g, x + 1, y, 'wood2'); }
  for (const [x, y] of [[4, 2], [8, 5], [11, 7]]) { set(g, x, y, 'sakura2'); set(g, x + 1, y - 1, 'sakura2'); set(g, x + 2, y, 'sakura2'); }
  return g;
}

/** Forage lies on the ground as its icon, a little smaller, with a sparkle. */
export function sparkle() {
  return parse(`
    .a.
    aba
    .a.`, { a: 'gold3', b: 'ink6' });
}
