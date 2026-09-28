// Palette-indexed pixel grids: the authoring format for all art. Pure logic (runs in Node for tests).
// A grid is { w, h, px: Uint8Array } where px holds palette indices and 0 is transparent.
import { RAMPS, INDEX, idx } from './palette.js';

// index -> { ramp, step, len } so outlines and shading can move along an object's own ramp.
export const RAMP_OF = [null];
for (const [ramp, hexes] of Object.entries(RAMPS)) {
  hexes.forEach((_, step) => { RAMP_OF[INDEX[ramp + step]] = { ramp, step, len: hexes.length }; });
}

export function grid(w, h) {
  return { w, h, px: new Uint8Array(w * h) };
}

export function clone(g) {
  return { w: g.w, h: g.h, px: g.px.slice() };
}

const toIdx = (c) => (typeof c === 'number' ? c : c == null ? 0 : idx(c));

/**
 * Parse a string grid. `rows` is a template string (blank lines and leading indentation are
 * trimmed) and `legend` maps single characters to palette names; '.' and ' ' are transparent.
 */
export function parse(rows, legend) {
  const lines = (Array.isArray(rows) ? rows : rows.split('\n'))
    .map((l) => l.replace(/^\s+|\s+$/g, ''))
    .filter((l) => l.length);
  const h = lines.length;
  const w = Math.max(...lines.map((l) => l.length));
  const g = grid(w, h);
  for (let y = 0; y < h; y++) {
    const line = lines[y];
    for (let x = 0; x < line.length; x++) {
      const ch = line[x];
      if (ch === '.' || ch === ' ') continue;
      const name = legend[ch];
      if (name === undefined) throw new Error(`Legend has no entry for "${ch}"`);
      g.px[y * w + x] = toIdx(name);
    }
  }
  return g;
}

export function get(g, x, y) {
  return x < 0 || y < 0 || x >= g.w || y >= g.h ? 0 : g.px[y * g.w + x];
}

export function set(g, x, y, c) {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return;
  g.px[y * g.w + x] = toIdx(c);
}

export function fillRect(g, x, y, w, h, c) {
  const i = toIdx(c);
  for (let yy = Math.max(0, y); yy < Math.min(g.h, y + h); yy++) {
    for (let xx = Math.max(0, x); xx < Math.min(g.w, x + w); xx++) g.px[yy * g.w + xx] = i;
  }
}

export function line(g, x0, y0, x1, y1, c) {
  const i = toIdx(c);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    set(g, x0, y0, i);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** Filled ellipse centred on (cx, cy) with radii rx, ry (pixel-centre test). */
export function ellipse(g, cx, cy, rx, ry, c) {
  const i = toIdx(c);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) set(g, x, y, i);
    }
  }
}

/** Filled polygon (even-odd rule) from [[x,y],...] vertices in pixel coordinates. */
export function polygon(g, pts, c) {
  const i = toIdx(c);
  const ys = pts.map((p) => p[1]);
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y < Math.min(g.h, Math.ceil(Math.max(...ys))); y++) {
    const cy = y + 0.5;
    const xs = [];
    for (let k = 0; k < pts.length; k++) {
      const [ax, ay] = pts[k], [bx, by] = pts[(k + 1) % pts.length];
      if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) set(g, x, y, i);
    }
  }
}

/** Copy opaque pixels of src onto dst at (ox, oy); optional horizontal flip. */
export function blit(dst, src, ox, oy, flip = false) {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const c = src.px[y * src.w + (flip ? src.w - 1 - x : x)];
      if (c) set(dst, ox + x, oy + y, c);
    }
  }
  return dst;
}

/** Palette swap: map is { fromName: toName }. */
export function recolor(g, map) {
  const lut = new Map(Object.entries(map).map(([a, b]) => [idx(a), idx(b)]));
  const out = clone(g);
  for (let i = 0; i < out.px.length; i++) if (lut.has(out.px[i])) out.px[i] = lut.get(out.px[i]);
  return out;
}

/** Darkest tone on the ramp of palette index i (for selective outlines). */
export function rampDark(i, steps = 0) {
  const r = RAMP_OF[i];
  return INDEX[r.ramp + Math.min(steps, r.len - 1)];
}

/**
 * Selective outline: every transparent pixel touching an opaque one (4-neighbour) becomes an
 * outline pixel coloured with the darkest tone of that neighbour's own ramp (or `color`).
 * Grows the grid by `pad` on each side so the outline has room.
 */
export function outline(g, { color = null, pad = 1, diagonal = false } = {}) {
  const out = grid(g.w + pad * 2, g.h + pad * 2);
  blit(out, g, pad, pad);
  const src = clone(out);
  const n4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const n8 = diagonal ? [...n4, [1, 1], [-1, 1], [1, -1], [-1, -1]] : n4;
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      if (get(src, x, y)) continue;
      for (const [dx, dy] of n8) {
        const c = get(src, x + dx, y + dy);
        if (c) { out.px[y * out.w + x] = color ? toIdx(color) : rampDark(c); break; }
      }
    }
  }
  return out;
}

/** Crop to [x, y, w, h]. */
export function crop(g, x, y, w, h) {
  const out = grid(w, h);
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) out.px[yy * w + xx] = get(g, x + xx, y + yy);
  return out;
}

/** Bounding box of opaque pixels: [x, y, w, h] or null when empty. */
export function bounds(g) {
  let x0 = g.w, y0 = g.h, x1 = -1, y1 = -1;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (g.px[y * g.w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}
