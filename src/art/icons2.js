// Icons for M6 items: courting charms, the farmhouse extension, bath salt, festival goods and
// keepsakes, haiku scrolls and the Archive's spirit relics. 16x16 with a 1px margin.
import { grid, set, line, fillRect, ellipse, polygon, outline, crop } from './raster.js';

function icon(draw, color = 'ink0') {
  const g = grid(16, 16);
  draw(g);
  return crop(outline(g, { color }), 1, 1, 16, 16);
}

const hline = (g, x0, x1, y, c) => { for (let x = x0; x <= x1; x++) set(g, x, y, c); };
const vline = (g, x, y0, y1, c) => { for (let y = y0; y <= y1; y++) set(g, x, y, c); };

export function valleyIcons() {
  return {
    red_thread: icon((g) => {
      for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; set(g, Math.round(8 + Math.cos(a) * 4), Math.round(6 + Math.sin(a) * 3), i % 3 ? 'red2' : 'red3'); }
      line(g, 8, 9, 5, 14, 'red2'); line(g, 8, 9, 11, 14, 'red1');
      set(g, 8, 9, 'gold2');
    }),
    shrine_vow: icon((g) => {
      polygon(g, [[4, 3], [12, 3], [12, 14], [4, 14]], 'wood5');
      polygon(g, [[4, 3], [8, 0], [12, 3]], 'wood5');
      hline(g, 4, 12, 3, 'wood3');
      vline(g, 8, 5, 12, 'ink1');
      hline(g, 6, 10, 7, 'ink1');
      set(g, 7, 10, 'red2'); set(g, 9, 10, 'red2');
    }),
    house_ext: icon((g) => {
      polygon(g, [[1, 8], [8, 2], [15, 8]], 'straw2');
      hline(g, 1, 15, 8, 'straw3');
      fillRect(g, 3, 9, 10, 6, 'wood2');
      fillRect(g, 6, 10, 4, 5, 'ink6');
      vline(g, 8, 10, 14, 'wood1');
      line(g, 10, 1, 14, 5, 'wood4');
    }),
    bath_salt: icon((g) => {
      ellipse(g, 8, 10, 5, 4, 'ink6');
      ellipse(g, 8, 9, 5, 2, 'ink5');
      for (const [x, y] of [[6, 8], [9, 9], [8, 7]]) set(g, x, y, 'gold2');
      ellipse(g, 11, 5, 2.5, 2.5, 'gold2'); set(g, 10, 4, 'gold3'); set(g, 12, 3, 'grass4');
    }),
    toyo_knife: icon((g) => {
      polygon(g, [[3, 12], [12, 3], [13, 4], [5, 13]], 'stone4');
      line(g, 4, 12, 12, 4, 'ink6');
      fillRect(g, 1, 12, 4, 3, 'wood2'); set(g, 2, 13, 'wood4');
    }),
    bokken: icon((g) => {
      line(g, 3, 13, 13, 2, 'wood4'); line(g, 4, 13, 14, 2, 'wood3');
      fillRect(g, 3, 11, 3, 2, 'wood1'); line(g, 1, 15, 3, 13, 'wood2');
    }),
    fox_whisker: icon((g) => {
      fillRect(g, 3, 5, 10, 8, 'ink6'); for (let x = 3; x < 13; x += 3) set(g, x, 12, 'ink5');
      line(g, 2, 3, 14, 11, 'ink4'); set(g, 14, 11, 'gold2');
    }),
  };
}
