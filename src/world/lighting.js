// Day/night lighting: a multiply overlay keyed to the time of day, plus warm light pools added at
// night. Pools are stepped discs built from palette colours (no gradients, no blur).
import { COLORS } from '../art/palette.js';
import { grid, ellipse } from '../art/raster.js';
import { gridToCanvas, makeCanvas } from '../art/compiler.js';

// [minutes, palette colour, strength 0..1 toward that colour from white]
const KEYS = [
  [360, 'sakura4', 0.55], [420, 'gold3', 0.2], [480, null, 0], [990, null, 0],
  [1050, 'gold3', 0.45], [1110, 'red4', 0.35], [1170, 'indigo3', 0.75], [1230, 'indigo2', 0.85],
  [1320, 'indigo2', 1], [1440, 'indigo1', 0.78], [1560, 'indigo1', 0.85],
];

const rgb = (name) => {
  if (!name) return [255, 255, 255];
  const h = COLORS[name];
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
};
const mixWhite = (name, s) => rgb(name).map((c) => Math.round(255 + (c - 255) * s));

/** Ambient multiply colour for a time of day (minutes may exceed 1440). */
export function ambientAt(minutes) {
  let a = KEYS[0], b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (minutes >= KEYS[i][0] && minutes <= KEYS[i + 1][0]) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  }
  if (minutes < KEYS[0][0]) b = a;
  const t = b[0] === a[0] ? 0 : (minutes - a[0]) / (b[0] - a[0]);
  const ca = mixWhite(a[1], a[2]), cb = mixWhite(b[1], b[2]);
  return ca.map((c, i) => Math.round(c + (cb[i] - c) * t));
}

/** 0 at full day, 1 at deepest night: drives light pools and fireflies. */
export function darkness(amb) {
  return Math.max(0, Math.min(1, 1 - (amb[0] + amb[1] + amb[2]) / 3 / 255) * 1.6);
}

function pool(radius, bands) {
  const size = radius * 2 + 2;
  const g = grid(size, size);
  bands.forEach(([frac, colour]) => ellipse(g, size / 2, size / 2, radius * frac, radius * frac * 0.8, colour));
  return gridToCanvas(g);
}

export class Lighting {
  constructor() {
    this.map = makeCanvas(8, 8);
    this.ctx = this.map.getContext('2d');
    this.pools = {
      window: pool(26, [[1, 'red0'], [0.72, 'wood2'], [0.45, 'wood4']]),
      lantern: pool(34, [[1, 'red0'], [0.7, 'wood2'], [0.42, 'wood4'], [0.2, 'gold1']]),
    };
  }

  /** Multiply the scene in ctx by the ambient colour, with light pools at `lights` (world px). */
  apply(ctx, w, h, minutes, lights, cam) {
    const amb = ambientAt(minutes);
    if (amb[0] === 255 && amb[1] === 255 && amb[2] === 255) return amb;
    if (this.map.width !== w || this.map.height !== h) {
      this.map.width = w;
      this.map.height = h;
    }
    const c = this.ctx;
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = `rgb(${amb[0]},${amb[1]},${amb[2]})`;
    c.fillRect(0, 0, w, h);
    const dark = darkness(amb);
    if (dark > 0.05) {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = Math.min(1, dark);
      for (const l of lights) {
        const img = this.pools[l.kind];
        const x = Math.round(l.x - cam.ix - img.width / 2), y = Math.round(l.y - cam.iy - img.height / 2);
        if (x > w || y > h || x + img.width < 0 || y + img.height < 0) continue;
        c.drawImage(img, x, y);
      }
      c.globalAlpha = 1;
    }
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.map, 0, 0);
    ctx.restore();
    return amb;
  }
}
