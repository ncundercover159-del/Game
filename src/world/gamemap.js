// A map instance: ground types, farm soil, world objects, crops and buildings, plus the dirty-tile
// set the ground renderer consumes. Everything dynamic here round-trips through serialize().
import { TILE } from '../config.js';
import { OBJECT_TYPES } from '../data/objects.js';

export const G = { GRASS: 0, DIRT: 1, WATER: 2, PATH: 3, WALL: 4, WOOD: 5, TATAMI: 6, TATAMI_R: 7, DOMA: 8, BRIDGE: 9, STEPS: 10, VOID: 11, CLIFF: 12, FALLS: 13 };
// Ground legend shared by every map (see src/maps/*.js headers).
const GROUND_OF = {
  T: G.GRASS, '.': G.GRASS, o: G.GRASS, f: G.GRASS, s: G.GRASS, t: G.GRASS, ',': G.DIRT, ':': G.DIRT,
  '~': G.WATER, '=': G.PATH, '#': G.WALL, w: G.WOOD, m: G.TATAMI, n: G.TATAMI_R, d: G.DOMA,
  b: G.BRIDGE, S: G.STEPS, x: G.VOID, X: G.GRASS, p: G.DIRT, c: G.DIRT, C: G.CLIFF, W: G.FALLS, B: G.GRASS,
};
// Soil laid out by the map itself (village paddies and their channels).
const SOIL_OF = { p: 1, c: 2 };
// X: grass that can't be walked on (hedges, cliffs and the like drawn by objects or edges).
const BLOCKING = new Set(['T', '~', 'f', '#', 'x', 'X', 'C', 'W']);

export class GameMap {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.w = def.ground[0].length;
    this.h = def.ground.length;
    this.pw = this.w * TILE;
    this.ph = this.h * TILE;
    const n = this.w * this.h;
    this.ground = new Uint8Array(n);
    this.soil = new Uint8Array(n);
    this.wet = new Uint8Array(n);
    this.cover = new Uint8Array(n);
    this.flow = new Uint8Array(n);
    this.blocked = new Uint8Array(n);
    this.objAt = new Int32Array(n).fill(-1);
    this.objects = [];
    this.crops = new Map();
    this.dirty = new Set();
    this.lights = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const ch = def.ground[y][x];
      const g = GROUND_OF[ch];
      if (g === undefined) throw new Error(`Map ${def.id}: unknown ground "${ch}" at ${x},${y}`);
      this.ground[y * this.w + x] = g;
      if (BLOCKING.has(ch)) this.blocked[y * this.w + x] = 1;
      if (SOIL_OF[ch]) this.soil[y * this.w + x] = SOIL_OF[ch];
    }
    this.buildings = (def.buildings || []).map((b) => ({ ...b }));
    for (const b of this.buildings) {
      for (let y = b.ty; y < b.ty + b.h; y++) for (let x = b.tx; x < b.tx + b.w; x++) this.blocked[this.i(x, y)] = 1;
      // A door that leads inside is walked through; a shut one stays part of the wall.
      if (b.door?.to) this.blocked[this.i(b.door.tx, b.door.ty)] = 0;
      // Light offsets are from the sprite's top-left when it has (px, py), else from its bottom-centre.
      const [sx, sy] = this.spriteOrigin(b);
      for (const [lx, ly] of b.lights || []) this.lights.push({ x: sx + lx, y: sy + ly, kind: 'window' });
    }
    for (const p of def.props || []) {
      const { tx, ty, block, light, ...rest } = p;
      this.addObject({ ...rest, x: tx, y: ty });
      // `block: [w, h]` makes a wide piece solid: w tiles right and h tiles up from its anchor tile.
      if (block) for (let y = ty - block[1] + 1; y <= ty; y++) for (let x = tx; x < tx + block[0]; x++) this.blocked[this.i(x, y)] = 1;
      if (light) this.lights.push({ x: tx * TILE + 8 + light[0], y: ty * TILE + light[1], kind: 'lantern' });
    }
  }

  /** Origin of a building's light offsets in world px (see above). */
  spriteOrigin(b) {
    if (b.px !== undefined) return [b.tx * TILE + b.px, b.ty * TILE + b.py];
    return [b.tx * TILE + (b.w * TILE) / 2, (b.ty + b.h) * TILE];
  }

  i(x, y) { return y * this.w + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  /** Ground type with coordinates clamped to the map (so edges don't autotile as borders). */
  groundAt(x, y) {
    x = Math.max(0, Math.min(this.w - 1, x));
    y = Math.max(0, Math.min(this.h - 1, y));
    return this.ground[y * this.w + x];
  }

  isWater(x, y) { return this.groundAt(x, y) === G.WATER; }

  /** Water for drawing purposes: bridges sit over water, and waterfalls pour into it. */
  isWaterish(x, y) {
    const g = this.groundAt(x, y);
    return g === G.WATER || g === G.BRIDGE || g === G.FALLS;
  }

  objectAt(x, y) {
    if (!this.inside(x, y)) return null;
    const k = this.objAt[this.i(x, y)];
    return k < 0 ? null : this.objects[k];
  }

  addObject(o) {
    const def = OBJECT_TYPES[o.type];
    if (!def) throw new Error(`Unknown object type "${o.type}"`);
    if (o.hp === undefined) o.hp = def.hp || 0;
    o.shake = 0;
    const k = this.i(o.x, o.y);
    if (this.objAt[k] >= 0) return null;
    this.objAt[k] = this.objects.length;
    this.objects.push(o);
    return o;
  }

  removeObject(o) {
    const k = this.objAt[this.i(o.x, o.y)];
    if (k < 0 || this.objects[k] !== o) return;
    const last = this.objects.pop();
    if (last !== o) {
      this.objects[k] = last;
      this.objAt[this.i(last.x, last.y)] = k;
    }
    this.objAt[this.i(o.x, o.y)] = -1;
  }

  /** True if a walker can't enter tile (x, y). */
  solid(x, y) {
    if (!this.inside(x, y)) return true;
    const k = this.i(x, y);
    if (this.blocked[k]) return true;
    const o = this.objAt[k];
    return o >= 0 && OBJECT_TYPES[this.objects[o].type].solid;
  }

  buildingAt(x, y) {
    return this.buildings.find((b) => x >= b.tx && x < b.tx + b.w && y >= b.ty && y < b.ty + b.h) || null;
  }

  /** Mark a tile and its neighbours for ground redraw (autotile masks depend on neighbours). */
  touch(x, y) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (this.inside(x + dx, y + dy)) this.dirty.add(this.i(x + dx, y + dy));
    }
  }

  serialize() {
    const dyn = this.objects.filter((o) => !OBJECT_TYPES[o.type].static);
    return {
      ground: Array.from(this.ground).join(''),
      soil: Array.from(this.soil).join(''),
      wet: Array.from(this.wet).join(''),
      cover: Array.from(this.cover).join(''),
      objects: dyn.map(({ type, x, y, hp, v, kind, open, catch: got }) => {
        const o = { type, x, y, hp, v };
        if (kind) o.kind = kind;
        if (open !== undefined) o.open = open;
        if (got) o.catch = got;
        return o;
      }),
      crops: [...this.crops.entries()].map(([k, c]) => ({ k, ...c })),
    };
  }

  restore(data) {
    for (let k = 0; k < this.ground.length; k++) {
      this.ground[k] = Number(data.ground[k]);
      this.soil[k] = Number(data.soil[k]);
      this.wet[k] = Number(data.wet[k]);
      this.cover[k] = data.cover ? Number(data.cover[k]) : 0;
    }
    for (const o of this.objects.filter((o) => !OBJECT_TYPES[o.type].static)) this.removeObject(o);
    for (const o of data.objects) this.addObject({ ...o });
    this.crops.clear();
    for (const { k, ...c } of data.crops) this.crops.set(k, c);
    for (let k = 0; k < this.ground.length; k++) this.dirty.add(k);
  }
}
