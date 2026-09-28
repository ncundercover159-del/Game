// A map instance: ground types, farm soil, world objects, crops and buildings, plus the dirty-tile
// set the ground renderer consumes. Everything dynamic here round-trips through serialize().
import { TILE } from '../config.js';
import { OBJECT_TYPES } from '../data/objects.js';

export const G = { GRASS: 0, DIRT: 1, WATER: 2, PATH: 3 };
const GROUND_OF = { T: G.GRASS, '.': G.GRASS, o: G.GRASS, f: G.GRASS, s: G.GRASS, t: G.GRASS, ',': G.DIRT, ':': G.DIRT, '~': G.WATER, '=': G.PATH };
const BLOCKING = new Set(['T', '~', 'f']);

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
    }
    this.buildings = (def.buildings || []).map((b) => ({ ...b }));
    for (const b of this.buildings) {
      for (let y = b.ty; y < b.ty + b.h; y++) for (let x = b.tx; x < b.tx + b.w; x++) this.blocked[this.i(x, y)] = 1;
      for (const [lx, ly] of b.lights || []) this.lights.push({ x: b.tx * TILE + b.px + lx, y: b.ty * TILE + b.py + ly, r: 1, kind: 'window' });
    }
    for (const p of def.props || []) {
      this.addObject({ type: p.type, x: p.tx, y: p.ty, text: p.text });
      if (p.light) this.lights.push({ x: p.tx * TILE + 8, y: (p.ty + 1) * TILE - 16 + p.light[1], r: 0, kind: 'lantern' });
    }
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
      objects: dyn.map(({ type, x, y, hp, v, kind }) => (kind ? { type, x, y, hp, v, kind } : { type, x, y, hp, v })),
      crops: [...this.crops.entries()].map(([k, c]) => ({ k, ...c })),
    };
  }

  restore(data) {
    for (let k = 0; k < this.ground.length; k++) {
      this.ground[k] = Number(data.ground[k]);
      this.soil[k] = Number(data.soil[k]);
      this.wet[k] = Number(data.wet[k]);
    }
    for (const o of this.objects.filter((o) => !OBJECT_TYPES[o.type].static)) this.removeObject(o);
    for (const o of data.objects) this.addObject({ ...o });
    this.crops.clear();
    for (const { k, ...c } of data.crops) this.crops.set(k, c);
    for (let k = 0; k < this.ground.length; k++) this.dirty.add(k);
  }
}
