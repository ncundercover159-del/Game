// Icons for M7 items: the new dishes (mostly bowls, from craft.js), the fighting buffs, the
// goldfish in its bag and the kodama's little shrine. 16x16.
import { grid, set, fillRect, ellipse, line, polygon, outline, crop } from './raster.js';
import { bowl, rice, iconOf } from './craft.js';
import { hokora } from './kodama.js';

function icon(draw, color = 'ink0') {
  const g = grid(16, 16);
  draw(g);
  return crop(outline(g, { color, pad: 0 }), 0, 0, 16, 16);
}

const hline = (g, x0, x1, y, c) => { for (let x = x0; x <= x1; x++) set(g, x, y, c); };
const vline = (g, x, y0, y1, c) => { for (let y = y0; y <= y1; y++) set(g, x, y, c); };

export function lateIcons() {
  return {
    zenzai: bowl((g) => { ellipse(g, 7, 6, 5.5, 2.5, 'red0'); fillRect(g, 5, 4, 5, 3, 'ink6'); hline(g, 5, 9, 4, 'straw3'); for (const [x, y] of [[3, 6], [11, 6], [10, 5]]) set(g, x, y, 'red1'); }, ['ink0', 'ink1', 'ink2']),
    chawanmushi: icon((g) => {
      ellipse(g, 8, 4, 5, 1.5, 'stone4'); set(g, 8, 2, 'ink6');
      fillRect(g, 3, 5, 11, 8, 'stone3'); hline(g, 3, 13, 5, 'gold3'); hline(g, 4, 12, 6, 'gold2');
      for (let y = 5; y < 13; y++) set(g, 3, y, 'stone2');
      hline(g, 5, 11, 13, 'stone1'); set(g, 10, 6, 'red2');
    }),
    dengaku: icon((g) => {
      for (const x of [4, 10]) {
        vline(g, x + 1, 1, 15, 'wood3');
        fillRect(g, x, 5, 4, 6, 'ink6'); fillRect(g, x, 5, 4, 2, 'wood2'); set(g, x + 1, 5, 'wood4');
      }
    }, 'wood0'),
    kenchin: bowl((g) => { ellipse(g, 7, 6, 5.5, 2.5, 'wood3'); for (const [x, y, c] of [[4, 5, 'ink6'], [8, 6, 'straw4'], [10, 5, 'wood1'], [6, 7, 'ink6'], [9, 4, 'grass4']]) fillRect(g, x, y, 2, 1, c); }, ['wood0', 'wood2', 'wood3']),
    kabocha_nimono: icon((g) => {
      ellipse(g, 8, 11, 7, 3, 'ink4'); ellipse(g, 8, 10, 6, 2, 'ink5');
      for (const [x, y] of [[4, 7], [9, 6], [7, 9]]) { fillRect(g, x, y, 4, 3, 'gold2'); hline(g, x, x + 3, y, 'grass2'); set(g, x + 1, y + 1, 'gold3'); }
    }),
    kappamaki: icon((g) => {
      for (const [x, y] of [[2, 7], [7, 4], [8, 10]]) {
        ellipse(g, x + 3, y + 2, 3, 2.5, 'teal0'); ellipse(g, x + 3, y + 2, 2, 1.5, 'ink6'); set(g, x + 3, y + 2, 'grass4'); set(g, x + 2, y + 2, 'grass3');
      }
    }),
    yamakake: bowl((g) => { rice(g); ellipse(g, 7, 5, 4, 1.8, 'ink5'); ellipse(g, 7, 5, 2.5, 1, 'ink6'); set(g, 7, 4, 'gold3'); set(g, 10, 6, 'teal0'); }, ['ink0', 'ink1', 'ink2']),
    kitsune_soba: bowl((g) => { ellipse(g, 7, 6, 5.5, 2.5, 'wood1'); for (let x = 3; x < 12; x += 2) line(g, x, 4, x + 1, 7, 'stone2'); fillRect(g, 5, 4, 5, 3, 'gold1'); hline(g, 5, 9, 4, 'gold2'); set(g, 10, 6, 'grass4'); }, ['ink0', 'ink1', 'red1']),
    hoba_miso: icon((g) => {
      ellipse(g, 8, 9, 7, 4, 'wood1'); line(g, 1, 9, 15, 9, 'wood0');
      ellipse(g, 8, 8, 4, 2.2, 'wood3'); for (const [x, y, c] of [[6, 7, 'grass4'], [9, 8, 'ink6'], [8, 7, 'wood4'], [10, 7, 'grass4']]) set(g, x, y, c);
    }, 'wood0'),
    kasujiru: bowl((g) => { ellipse(g, 7, 6, 5.5, 2.5, 'ink5'); fillRect(g, 4, 5, 2, 2, 'red3'); fillRect(g, 8, 4, 3, 2, 'ink6'); set(g, 10, 7, 'grass4'); }, ['ink0', 'ink1', 'ink2']),
    ishikari_nabe: icon((g) => {
      fillRect(g, 2, 7, 12, 6, 'ink1'); hline(g, 1, 14, 7, 'ink2'); set(g, 1, 8, 'ink2'); set(g, 14, 8, 'ink2');
      ellipse(g, 8, 7, 5.5, 2, 'wood3');
      for (const [x, y, c] of [[4, 6, 'red3'], [7, 7, 'grass3'], [10, 6, 'red3'], [9, 7, 'ink6']]) fillRect(g, x, y, 2, 1, c);
      for (const x of [5, 10]) { set(g, x, 3, 'ink5'); set(g, x + 1, 2, 'ink5'); }
    }),
    jinchu_bento: icon((g) => {
      polygon(g, [[1, 7], [14, 7], [14, 13], [1, 13]], 'wood2'); hline(g, 1, 14, 7, 'wood3'); line(g, 1, 13, 14, 7, 'wood1');
      polygon(g, [[3, 3], [6, 1], [8, 5], [4, 6]], 'ink6'); fillRect(g, 4, 5, 3, 1, 'teal0');
      polygon(g, [[8, 2], [11, 1], [12, 6], [9, 6]], 'ink6'); fillRect(g, 9, 5, 3, 1, 'teal0');
      set(g, 13, 5, 'gold2'); set(g, 12, 4, 'gold2');
    }, 'wood0'),
    hokora: iconOf(hokora()),
    kingyo: icon((g) => {
      // A water bag tied at the top, a red goldfish inside.
      ellipse(g, 8, 10, 5.5, 4.5, 'water3'); ellipse(g, 7, 9, 3.5, 3, 'water4');
      polygon(g, [[6, 5], [10, 5], [9, 2], [7, 2]], 'water4'); for (const x of [6, 7, 8, 9, 10]) set(g, x, 4, 'red2');
      fillRect(g, 7, 9, 3, 2, 'red2'); set(g, 9, 9, 'red3'); set(g, 6, 9, 'red1'); set(g, 5, 10, 'red1'); set(g, 9, 10, 'ink0');
    }, 'water1'),
    // Buffs on the HUD: a fist of flame for Might, a lacquered sleeve-plate for Guard.
    buff_might: icon((g) => {
      polygon(g, [[8, 1], [11, 6], [13, 4], [13, 10], [8, 14], [3, 10], [3, 5], [5, 7]], 'red2');
      polygon(g, [[8, 5], [10, 9], [8, 12], [6, 9]], 'gold2'); set(g, 8, 9, 'gold3');
    }, 'red0'),
    buff_guard: icon((g) => {
      polygon(g, [[3, 2], [13, 2], [13, 9], [8, 14], [3, 9]], 'indigo2');
      for (const y of [5, 8]) hline(g, 4, 12, y, 'indigo0');
      hline(g, 3, 13, 2, 'indigo3'); vline(g, 8, 3, 12, 'gold2'); set(g, 8, 3, 'gold3');
    }, 'ink0'),
  };
}
