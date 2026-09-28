// Compiles indexed grids into canvases and packs them into texture atlases with named frames.
import { RGBA, COLORS } from './palette.js';

export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined' && !globalThis.__FORCE_DOM_CANVAS) return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Write an indexed grid into ctx at (dx, dy) via ImageData (no smoothing, exact palette colours). */
export function putGrid(ctx, g, dx, dy) {
  const img = ctx.createImageData(g.w, g.h);
  const u32 = new Uint32Array(img.data.buffer);
  for (let i = 0; i < g.px.length; i++) u32[i] = RGBA[g.px[i]];
  // putImageData ignores compositing, so only write the rect when it is fully owned by this grid.
  ctx.putImageData(img, dx, dy);
}

export function gridToCanvas(g) {
  const c = makeCanvas(g.w, g.h);
  putGrid(c.getContext('2d'), g, 0, 0);
  return c;
}

/**
 * Shelf-packed atlas. Frames are { x, y, w, h, ax, ay } where (ax, ay) is the anchor point
 * (e.g. a character's feet) relative to the frame's top-left.
 */
export class Atlas {
  constructor(width = 1024) {
    this.width = width;
    this.pending = [];
    this.frames = new Map();
    this.canvas = null;
  }

  add(name, g, ax = 0, ay = 0) {
    if (this.frames.has(name) || this.pending.some((p) => p.name === name)) {
      throw new Error(`Duplicate atlas frame "${name}"`);
    }
    this.pending.push({ name, g, ax, ay });
    return name;
  }

  has(name) {
    return this.frames.has(name);
  }

  build() {
    const items = this.pending.sort((a, b) => b.g.h - a.g.h || b.g.w - a.g.w);
    let x = 0, y = 0, shelfH = 0;
    const placed = [];
    for (const it of items) {
      if (x + it.g.w > this.width) { x = 0; y += shelfH + 1; shelfH = 0; }
      placed.push({ it, x, y });
      x += it.g.w + 1;
      shelfH = Math.max(shelfH, it.g.h);
    }
    const height = y + shelfH + 1;
    this.canvas = makeCanvas(this.width, height);
    const ctx = this.canvas.getContext('2d');
    for (const { it, x: px, y: py } of placed) {
      putGrid(ctx, it.g, px, py);
      this.frames.set(it.name, { x: px, y: py, w: it.g.w, h: it.g.h, ax: it.ax, ay: it.ay });
    }
    this.pending = [];
    return this;
  }

  frame(name) {
    const f = this.frames.get(name);
    if (!f) throw new Error(`Missing atlas frame "${name}"`);
    return f;
  }

  /** Draw a frame as a solid `ink6` silhouette (the white flash of a hit). */
  drawWhite(ctx, name, x, y, flip = false) {
    if (!this.white) {
      this.white = makeCanvas(this.canvas.width, this.canvas.height);
      const c = this.white.getContext('2d');
      c.drawImage(this.canvas, 0, 0);
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = COLORS.ink6;
      c.fillRect(0, 0, this.white.width, this.white.height);
    }
    this.draw(ctx, name, x, y, flip, this.white);
  }

  /** Draw a frame so its anchor lands on (x, y). Coordinates are rounded to whole pixels. */
  draw(ctx, name, x, y, flip = false, src = this.canvas) {
    const f = this.frame(name);
    const dx = Math.round(x) - (flip ? f.w - f.ax : f.ax);
    const dy = Math.round(y) - f.ay;
    if (flip) {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(src, f.x, f.y, f.w, f.h, -dx - f.w, dy, f.w, f.h);
      ctx.restore();
    } else {
      ctx.drawImage(src, f.x, f.y, f.w, f.h, dx, dy, f.w, f.h);
    }
  }
}

/**
 * Lazily-filled grid of fixed-size cells (used for autotile variants generated on demand).
 * get(key, genFn) returns { canvas, sx, sy, w, h }.
 */
export class CellCache {
  constructor(cell = 16, cols = 64, rows = 64) {
    this.cell = cell;
    this.cols = cols;
    this.rows = rows;
    this.canvas = makeCanvas(cell * cols, cell * rows);
    this.ctx = this.canvas.getContext('2d');
    this.map = new Map();
    this.next = 0;
  }

  get(key, gen) {
    let e = this.map.get(key);
    if (e) return e;
    if (this.next >= this.cols * this.rows) throw new Error('CellCache full');
    const sx = (this.next % this.cols) * this.cell;
    const sy = Math.floor(this.next / this.cols) * this.cell;
    this.next++;
    putGrid(this.ctx, gen(), sx, sy);
    e = { canvas: this.canvas, sx, sy, w: this.cell, h: this.cell };
    this.map.set(key, e);
    return e;
  }
}
