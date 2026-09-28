// Ground rendering. Static layers (land, soil, grass, path, decals) are pre-rendered into 32x32-tile
// chunk canvases; only dirty tiles are redrawn. Water is animated and drawn underneath every frame.
import { TILE } from '../config.js';
import { G } from './gamemap.js';
import { makeCanvas } from '../art/compiler.js';
import { canonical9, mask9At, variantAt, landTile, waterTile, grassTile, tilledTile, pathTile, channelTile, GRASS_PALS } from '../art/terrain.js';
import { SOIL, isFlooded } from '../systems/irrigation.js';
import { tatami, planks, doma, wallFace, wallTop, steps, bridge, voidTile, cliff, falls, compostSpecks } from '../art/interior.js';
import { rockTop, rockFace, caveFloor } from '../art/cave.js';
import { hash } from '../core/rng.js';
import { recolor } from '../art/raster.js';

// The foundry's pools are lava: the water tiles in fire colours.
const LAVA = { water0: 'red0', water1: 'red1', water2: 'red2', water3: 'gold1', water4: 'gold2', ink6: 'gold3', ink5: 'gold2' };

const CHUNK = 32;
const WATER_FRAME = 0.25;

// Decal choice per grass tile and season: [threshold, frame] checked against a stable hash.
const DECALS = [
  [[0.035, 'decal_tuft'], [0.06, 'decal_tuft2'], [0.072, 'decal_flowerW'], [0.08, 'decal_flowerP'], [0.086, 'decal_flowerB']],
  [[0.04, 'decal_tuft'], [0.07, 'decal_tuft2'], [0.082, 'decal_flowerB'], [0.088, 'decal_flowerW']],
  [[0.03, 'decal_tuft2'], [0.06, 'decal_leafR'], [0.085, 'decal_leafY'], [0.09, 'decal_flowerR']],
  [[0.02, 'decal_twig'], [0.03, 'decal_pebble']],
];
const DIRT_DECALS = [[0.05, 'decal_pebble']];

export class GroundRenderer {
  constructor(map, cells, atlas, season = 0) {
    this.map = map;
    this.season = season;
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
    this.paint(function* all() { for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) yield [x, y]; });
    map.dirty.clear();
  }

  /**
   * Paint tiles in two passes: first make any tile art not yet in the cell cache, then draw. Writing
   * new cells between draws from the same cache canvas stalls the canvas pipeline on every one;
   * batching them first costs one stall at most.
   */
  paint(tiles) {
    this.prep = true;
    for (const [x, y] of tiles()) this.drawTile(x, y);
    this.prep = false;
    for (const [x, y] of tiles()) this.drawTile(x, y);
  }

  /** Water mask per tile (or -1 when no water is needed under it). */
  rebuildWater() {
    const m = this.map;
    const water = (x, y) => m.isWaterish(x, y);
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
    if (!this.prep) ctx.clearRect(lx, ly, TILE, TILE);
    const k = y * m.w + x;
    const g = m.ground[k];
    if (g === G.WATER) return;
    const v = variantAt(x, y);
    const put = (key, gen) => {
      const c = this.cells.get(key, gen);
      if (!this.prep) ctx.drawImage(c.canvas, c.sx, c.sy, TILE, TILE, lx, ly, TILE, TILE);
    };
    if (g >= G.WALL) { this.structure(g, x, y, v, put); return; }
    const se = this.season, snow = se === 3;
    const land = canonical9(mask9At((a, b) => !m.isWaterish(a, b), x, y));
    put(`L${land}.${v}.${snow ? 1 : 0}`, () => landTile(land, v, snow));
    const soil = m.soil[k];
    if (soil === SOIL.CHANNEL) {
      const cm = canonical9(mask9At((a, b) => m.isWater(a, b) || (m.inside(a, b) && m.soil[a + b * m.w] === SOIL.CHANNEL), x, y));
      const flowing = m.flow[k] ? 1 : 0;
      put(`C${cm}.${v}.${flowing}`, () => channelTile(cm, v, !!flowing));
      return;
    }
    if (soil === SOIL.TILLED) {
      const wet = !!m.wet[k];
      const kind = isFlooded(m, x, y) ? 'paddy' : m.cover[k] ? 'straw' : 'soil';
      const sm = canonical9(mask9At((a, b) => m.inside(a, b) && m.soil[a + b * m.w] === SOIL.TILLED, x, y));
      put(`S${sm}.${v}.${wet ? 1 : 0}.${kind}`, () => tilledTile(sm, v, wet, kind));
      if (m.fert[k] && kind === 'soil') put(`Xcompost${v % 4}`, () => compostSpecks(v % 4));
      return;
    }
    if (g === G.GRASS) {
      const gm = canonical9(mask9At((a, b) => m.groundAt(a, b) === G.GRASS && !(m.inside(a, b) && m.soil[a + b * m.w]), x, y));
      put(`G${gm}.${v}.${se}`, () => grassTile(gm, v, GRASS_PALS[se]));
      if (gm === 511) this.decal(ctx, x, y, lx, ly, DECALS[se]);
    } else if (g === G.PATH) {
      const pm = canonical9(mask9At((a, b) => m.groundAt(a, b) === G.PATH, x, y));
      put(`P${pm}.${v}`, () => pathTile(pm, v));
    } else if (g === G.DIRT && !snow) {
      this.decal(ctx, x, y, lx, ly, DIRT_DECALS);
    }
  }

  /** Floors, walls, steps and bridges: plain tiles chosen by type and neighbours. */
  structure(g, x, y, v, put) {
    const m = this.map;
    switch (g) {
      case G.WALL: {
        const below = m.groundAt(x, y + 1);
        if (below === G.WALL || below === G.VOID || y + 1 >= m.h) put('Xtop', wallTop);
        else put(`Xwall${v % 6}`, () => wallFace(v));
        break;
      }
      case G.WOOD: put(`Xwood${v % 4}`, () => planks(v % 4)); break;
      case G.TATAMI: put(`Xtat${y % 2}`, () => tatami(y % 2, false)); break;
      case G.TATAMI_R: put(`Xtatr${x % 2}`, () => tatami(x % 2, true)); break;
      case G.DOMA: put(`Xdoma${v % 4}`, () => doma(v % 4)); break;
      case G.STEPS: put(`Xstep${v % 3}`, () => steps(v % 3)); break;
      case G.CLIFF: {
        const lip = m.groundAt(x, y - 1) !== G.CLIFF && y > 0;
        const foot = m.groundAt(x, y + 1) !== G.CLIFF;
        put(`Xcliff${v % 5}${lip ? 1 : 0}${foot ? 1 : 0}`, () => cliff(v % 5, lip, foot));
        break;
      }
      case G.FALLS: break; // drawn animated with the water, under the chunks
      case G.ROCK: {
        const z = m.def.zone || 1, below = m.groundAt(x, y + 1);
        if (y + 1 < m.h && below !== G.ROCK) put(`Xrf${z}.${v % 6}`, () => rockFace(z, v % 6));
        else put(`Xrt${z}.${v % 6}`, () => rockTop(z, v % 6));
        break;
      }
      case G.CAVE: {
        const z = m.def.zone || 1, shade = m.groundAt(x, y - 1) === G.ROCK && y > 0 ? 1 : 0;
        put(`Xcf${z}.${v % 8}.${shade}`, () => caveFloor(z, v % 8, !!shade));
        break;
      }
      case G.BRIDGE: {
        const w = m.groundAt(x - 1, y) !== G.BRIDGE, e = m.groundAt(x + 1, y) !== G.BRIDGE;
        put(`Xbr${v % 4}${w ? 1 : 0}${e ? 1 : 0}`, () => bridge(v % 4, w, e));
        break;
      }
      default: put('Xvoid', voidTile);
    }
  }

  /** Restyle the whole map for a new season. */
  setSeason(season) {
    if (season === this.season) return;
    this.season = season;
    const map = this.map;
    this.paint(function* all() { for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) yield [x, y]; });
  }

  decal(ctx, x, y, lx, ly, table) {
    if (this.prep) return;
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
    const keys = [...m.dirty];
    this.paint(function* dirty() { for (const k of keys) yield [k % m.w, Math.floor(k / m.w)]; });
    m.dirty.clear();
  }

  drawWater(ctx, cam, time) {
    const m = this.map;
    const frame = Math.floor(time / WATER_FRAME) & 3;
    const x0 = Math.max(0, Math.floor(cam.ix / TILE)), y0 = Math.max(0, Math.floor(cam.iy / TILE));
    const x1 = Math.min(m.w - 1, Math.floor((cam.ix + cam.w) / TILE)), y1 = Math.min(m.h - 1, Math.floor((cam.iy + cam.h) / TILE));
    const cell = (mask, v) => (m.def.lava
      ? this.cells.get(`L${mask}.${v}.${frame}`, () => recolor(waterTile(mask, v, frame), LAVA))
      : this.cells.get(`W${mask}.${v}.${frame}`, () => waterTile(mask, v, frame)));
    // New animation frames' cells first (see paint), then the drawing.
    for (let pass = 0; pass < 2; pass++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const mask = this.waterMask[y * m.w + x];
      if (mask < 0) continue;
      const c = cell(mask, variantAt(x, y));
      if (pass) ctx.drawImage(c.canvas, c.sx, c.sy, TILE, TILE, x * TILE - cam.ix, y * TILE - cam.iy, TILE, TILE);
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (m.ground[y * m.w + x] !== G.FALLS) continue;
      const l = m.groundAt(x - 1, y) !== G.FALLS, r = m.groundAt(x + 1, y) !== G.FALLS, foot = m.groundAt(x, y + 1) === G.WATER;
      const v = x % 4;
      const c = this.cells.get(`F${v}${l ? 1 : 0}${r ? 1 : 0}${foot ? 1 : 0}.${frame}`, () => falls(v, frame, l, r, foot));
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
