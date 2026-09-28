// Navigation for villagers: A* over a map's tiles, and routes across maps through warps (doors and
// roads). Maps nobody is looking at are navigated on a static copy (buildings, props, scenery);
// the live World's map is used when it exists so crops and felled trees count.
import { GameMap } from '../world/gamemap.js';
import { decorate } from '../world/populate.js';
import { MAPS } from '../maps/index.js';

const statics = new Map();

/** A map to navigate on: the live one if given, else a cached static copy. */
export function navMap(id, live = null) {
  if (live) return live;
  let m = statics.get(id);
  if (!m) {
    m = new GameMap(MAPS[id]);
    decorate(m);
    statics.set(id, m);
  }
  return m;
}

/** Drop a map's static copy after its layout changes (the extended farmhouse). */
export function forgetNav(id) { statics.delete(id); }

/** Min-heap on `f` for the open set. */
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(n) {
    const a = this.a;
    a.push(n);
    for (let i = a.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      for (let i = 0; ;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Shortest 4-connected path from (sx, sy) to (gx, gy) as [[x, y], ...] excluding the start, or null.
 * The goal may be solid (e.g. a counter someone stands behind is not, but a bed is): then the path
 * ends on the nearest free neighbour. `limit` caps the nodes explored.
 */
export function findPath(map, sx, sy, gx, gy, limit = 6000) {
  if (sx === gx && sy === gy) return [];
  const goalFree = !map.solid(gx, gy);
  const W = map.w;
  const key = (x, y) => y * W + x;
  const from = new Map();
  const cost = new Map([[key(sx, sy), 0]]);
  const open = new Heap();
  const h = (x, y) => Math.abs(x - gx) + Math.abs(y - gy);
  open.push({ x: sx, y: sy, f: h(sx, sy) });
  let seen = 0;
  while (open.size && seen++ < limit) {
    const c = open.pop();
    const done = goalFree ? c.x === gx && c.y === gy : h(c.x, c.y) === 1;
    if (done) {
      const path = [];
      for (let k = key(c.x, c.y); k !== key(sx, sy); k = from.get(k)) path.push([k % W, Math.floor(k / W)]);
      return path.reverse();
    }
    const g0 = cost.get(key(c.x, c.y));
    for (const [dx, dy] of STEPS) {
      const x = c.x + dx, y = c.y + dy;
      if (map.solid(x, y)) continue;
      const k = key(x, y), g = g0 + 1;
      if (g >= (cost.get(k) ?? Infinity)) continue;
      cost.set(k, g);
      from.set(k, key(c.x, c.y));
      open.push({ x, y, f: g + h(x, y) });
    }
  }
  return null;
}

/** Warps to take, in order, to get from one map to another (breadth-first over maps). */
export function mapRoute(from, to) {
  if (from === to) return [];
  const prev = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const id = queue.shift();
    for (const w of MAPS[id].warps) {
      if (prev.has(w.to)) continue;
      prev.set(w.to, { id, w });
      if (w.to === to) {
        const route = [];
        for (let at = to; prev.get(at); at = prev.get(at).id) route.push(prev.get(at).w);
        return route.reverse();
      }
      queue.push(w.to);
    }
  }
  return null;
}

/** The tile of a warp rectangle nearest to (x, y). */
export function warpTile(w, x, y) {
  return [Math.max(w.x, Math.min(w.x + w.w - 1, x)), Math.max(w.y, Math.min(w.y + w.h - 1, y))];
}
