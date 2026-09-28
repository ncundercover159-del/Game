// Ground rendering. Static layers (land, soil, grass, path, decals) are pre-rendered into 32x32-tile
// chunk canvases; only dirty tiles are redrawn. Water is animated and drawn underneath every frame.
import { TILE } from '../config.js';
import { G } from './gamemap.js';
import { makeCanvas } from '../art/compiler.js';
import { canonical9, mask9At, variantAt, landTile, waterTile, grassTile, tilledTile, pathTile } from '../art/terrain.js';
import { hash } from '../core/rng.js';

const CHUNK = 32;
const WATER_FRAME = 0.25;

// Decal choice per grass tile: [threshold, frame] checked against a stable hash.
const DECALS = [[0.035, 'decal_tuft'], [0.06, 'decal_tuft2'], [0.072, 'decal_flowerW'], [0.08, 'decal_flowerP'], [0.086, 'decal_flowerB']];
const DIRT_DECALS = [[0.05, 'decal_pebble']];

export class GroundRenderer {
  constructor(map, cells, atlas) {
    this.map = map;
    this.cells = cells;
    this.atlas = atlas;
    this.cols = Math.ceil(map.w / CHUNK);
    this.rows = Math.ceil(map.h / CHUNK);
    this.chunks = [];
    for (let cy = 0; cy < this.rows; cy++) for (let cx = 0; cx < this.cols; cx++) {
      const canvas = makeCanvas(CHUNK * TILE, CHUNK * TILE);
      this.chunks.push({ cx, cy, canvas, ctx: canvas.getContext('2d') });
    }
    this.waterMask = new Int16Array(map.w * map.h).fill(-1);
    this.rebuildWater();
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) this.drawTile(x, y);
    map.dirty.clear();
  }

  /** Water mask per tile (or -1 when no water is needed under it). */
  rebuildWater() {
    const m = this.map;
    const water = (x, y) => m.isWater(x, y);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const mask = mask9At(water, x, y);
      this.waterMask[y * m.w + x] = mask ? mask : -1;
    }
  }

  drawTile(x, y) {
    const m = this.map;
    const chunk = this.chunks[Math.floor(y / CHUNK) * this.cols + Math.floor(x / CHUNK)];
    const ctx = chunk.ctx;
    const lx = (x % CHUNK) * TILE, ly = (y % CHUNK) * TILE;
    ctx.clearRect(lx, ly, TILE, TILE);
    const k = y * m.w + x;
    const g = m.ground[k];
    if (g === G.WATER) return;
    const v = variantAt(x, y);
    const put = (key, gen) => {
      const c = this.cells.get(key, gen);
      ctx.drawImage(c.canvas, c.sx, c.sy, TILE, TILE, lx, ly, TILE, TILE);
    };
    const land = canonical9(mask9At((a, b) => !m.isWater(a, b), x, y));
    put(`L${land}.${v}`, () => landTile(land, v));
    if (m.soil[k]) {
      const wet = !!m.wet[k];
      const sm = canonical9(mask9At((a, b) => m.inside(a, b) && m.soil[a + b * m.w] === 1, x, y));
      put(`S${sm}.${v}.${wet ? 1 : 0}`, () => tilledTile(sm, v, wet));
      return;
    }
    if (g === G.GRASS) {
      const gm = canonical9(mask9At((a, b) => m.groundAt(a, b) === G.GRASS && !(m.inside(a, b) && m.soil[a + b * m.w]), x, y));
      put(`G${gm}.${v}`, () => grassTile(gm, v));
      if (gm === 511) this.decal(ctx, x, y, lx, ly, DECALS);
    } else if (g === G.PATH) {
      const pm = canonical9(mask9At((a, b) => m.groundAt(a, b) === G.PATH, x, y));
      put(`P${pm}.${v}`, () => pathTile(pm, v));
    } else if (g === G.DIRT) {
      this.decal(ctx, x, y, lx, ly, DIRT_DECALS);
    }
  }

  decal(ctx, x, y, lx, ly, table) {
    const h = hash(x, y, 0, 909);
    const r = (h & 0xffff) / 65536;
    const hit = table.find(([t]) => r < t);
    if (!hit) return;
    const f = this.atlas.frame(hit[1]);
    const ox = 1 + ((h >>> 16) % Math.max(1, TILE - f.w - 1));
    const oy = 1 + ((h >>> 24) % Math.max(1, TILE - f.h - 1));
    ctx.drawImage(this.atlas.canvas, f.x, f.y, f.w, f.h, lx + ox, ly + oy, f.w, f.h);
  }

  /** Redraw tiles the simulation marked dirty (tilling, watering, ...). */
  flush() {
    const m = this.map;
    if (!m.dirty.size) return;
    for (const k of m.dirty) this.drawTile(k % m.w, Math.floor(k / m.w));
    m.dirty.clear();
  }

  drawWater(ctx, cam, time) {
    const m = this.map;
    const frame = Math.floor(time / WATER_FRAME) & 3;
    const x0 = Math.max(0, Math.floor(cam.ix / TILE)), y0 = Math.max(0, Math.floor(cam.iy / TILE));
    const x1 = Math.min(m.w - 1, Math.floor((cam.ix + cam.w) / TILE)), y1 = Math.min(m.h - 1, Math.floor((cam.iy + cam.h) / TILE));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const mask = this.waterMask[y * m.w + x];
      if (mask < 0) continue;
      const v = variantAt(x, y);
      const c = this.cells.get(`W${mask}.${v}.${frame}`, () => waterTile(mask, v, frame));
      ctx.drawImage(c.canvas, c.sx, c.sy, TILE, TILE, x * TILE - cam.ix, y * TILE - cam.iy, TILE, TILE);
    }
  }

  draw(ctx, cam) {
    const size = CHUNK * TILE;
    for (const c of this.chunks) {
      const dx = c.cx * size - cam.ix, dy = c.cy * size - cam.iy;
      if (dx > cam.w || dy > cam.h || dx + size < 0 || dy + size < 0) continue;
      ctx.drawImage(c.canvas, dx, dy);
    }
  }
}
