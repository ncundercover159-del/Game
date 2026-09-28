// Mount Kurayama floor generator: rooms joined by two-wide tunnels (a spanning tree plus a loop or
// two), the rope up in the first room and the ladder down in the farthest, ore along the walls, urns
// in corners, sometimes a chest, sometimes a sealed side room behind cracked rock, pools in the
// flooded cellars, and the floor's foes. Pure and deterministic per (seed, floor).
// Legend: R rock, g floor, ~ water.
import { Rng } from '../core/rng.js';
import { zoneOf, LANTERN_EVERY, BOSS_FLOORS, LAST_FLOOR } from '../data/caves.js';

export const CAVE_W = 48, CAVE_H = 36;

const pick = (rng, table) => {
  let r = rng.next() * table.reduce((s, x) => s + x[1], 0);
  return (table.find((x) => (r -= x[1]) < 0) || table[0])[0];
};

class Grid {
  constructor(w, h, fill) { this.w = w; this.h = h; this.c = new Array(w * h).fill(fill); }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? 'R' : this.c[y * this.w + x]; }
  set(x, y, v) { if (x > 0 && y > 0 && x < this.w - 1 && y < this.h - 1) this.c[y * this.w + x] = v; }
  rows() { return Array.from({ length: this.h }, (_, y) => this.c.slice(y * this.w, y * this.w + this.w).join('')); }
}

/** Tiles reachable on foot from (x, y), avoiding water and `blocked` tiles. */
export function reach(grid, x, y, blocked = new Set()) {
  const seen = new Set([y * grid.w + x]);
  const q = [[x, y]];
  while (q.length) {
    const [cx, cy] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, k = ny * grid.w + nx;
      if (seen.has(k) || grid.get(nx, ny) !== 'g' || blocked.has(k)) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return seen;
}

function carveRooms(g, rng) {
  const rooms = [];
  for (let tries = 0; tries < 80 && rooms.length < 9; tries++) {
    const w = rng.int(5, 11), h = rng.int(4, 8);
    const x = rng.int(2, g.w - w - 3), y = rng.int(3, g.h - h - 3);
    if (rooms.some((r) => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y)) continue;
    rooms.push({ x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) });
  }
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) g.set(x, y, 'g');
  return rooms;
}

function tunnel(g, a, b, rng) {
  const horizontalFirst = rng.next() < 0.5;
  const [mx, my] = horizontalFirst ? [b.cx, a.cy] : [a.cx, b.cy];
  const run = (x0, y0, x1, y1) => {
    const sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
    let x = x0, y = y0;
    for (;;) {
      g.set(x, y, 'g'); g.set(x + (sy ? 1 : 0), y + (sx ? 1 : 0), 'g');
      if (x === x1 && y === y1) break;
      x += sx; y += sy;
    }
  };
  run(a.cx, a.cy, mx, my);
  run(mx, my, b.cx, b.cy);
}

/** Prim's tree over room centres, then one or two extra links for loops. */
function connect(g, rooms, rng) {
  const inTree = [rooms[0]];
  const rest = rooms.slice(1);
  const d = (a, b) => Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy);
  while (rest.length) {
    let best = null;
    for (const a of inTree) for (const b of rest) if (!best || d(a, b) < best[2]) best = [a, b, d(a, b)];
    tunnel(g, best[0], best[1], rng);
    inTree.push(best[1]);
    rest.splice(rest.indexOf(best[1]), 1);
  }
  for (let i = 0; i < 2; i++) {
    const a = rooms[rng.int(0, rooms.length - 1)], b = rooms[rng.int(0, rooms.length - 1)];
    if (a !== b && rng.next() < 0.6) tunnel(g, a, b, rng);
  }
}

/** Floor tiles against the rock (for ore, urns and pit-props). */
function wallSide(g, x, y) {
  return g.get(x, y) === 'g' && [[1, 0], [-1, 0], [0, -1], [0, 1]].some(([dx, dy]) => g.get(x + dx, y + dy) === 'R');
}

export function generateFloor(seed, floor) {
  if (BOSS_FLOORS[floor]) return bossFloor(seed, floor);
  const zone = zoneOf(floor), zi = zone === zoneOf(1) ? 1 : 2;
  const rng = new Rng(((seed >>> 0) * 31 + floor * 7919) >>> 0);
  let g, rooms;
  // A floor needs at least five rooms; retry the (deterministic) sequence until it has them.
  do { g = new Grid(CAVE_W, CAVE_H, 'R'); rooms = carveRooms(g, rng); } while (rooms.length < 5);
  connect(g, rooms, rng);

  const entry = rooms[0];
  const start = { x: entry.cx, y: entry.cy };
  // Farthest room by walking distance takes the ladder.
  const dist = bfsDist(g, start.x, start.y);
  const exit = rooms.slice(1).reduce((a, b) => (dist.get(b.cy * g.w + b.cx) > dist.get(a.cy * g.w + a.cx) ? b : a));

  const taken = new Set();
  const take = (x, y) => taken.add(y * g.w + x);
  const free = (x, y) => g.get(x, y) === 'g' && !taken.has(y * g.w + x);
  const props = [];
  const spawns = [];

  props.push({ type: 'rope', tx: start.x, ty: start.y - 1 });
  take(start.x, start.y - 1); take(start.x, start.y);
  if (floor < LAST_FLOOR) { props.push({ type: 'ladder', tx: exit.cx, ty: exit.cy }); take(exit.cx, exit.cy); }
  else { props.push({ type: 'deep', tx: exit.cx, ty: exit.cy }); take(exit.cx, exit.cy); }
  if (floor % LANTERN_EVERY === 0) { props.push({ type: 'cave_lantern', tx: start.x + 2, ty: start.y - 1, light: [0, -8] }); take(start.x + 2, start.y - 1); }

  // Pools in the flooded cellars, kept only if every room stays reachable.
  if (zone.water) {
    for (const r of rooms) {
      if (r === entry || r === exit || r.w < 6 || r.h < 5 || rng.next() > 0.55) continue;
      const pool = [];
      const rx = (r.w - 2) / 2, ry = (r.h - 2) / 2, ox = r.x + r.w / 2 - 0.5, oy = r.y + r.h / 2 - 0.5;
      for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
        if (((x - ox) / rx) ** 2 + ((y - oy) / ry) ** 2 <= 1 && !taken.has(y * g.w + x)) pool.push([x, y]);
      }
      for (const [x, y] of pool) g.set(x, y, '~');
      const ok = reach(g, start.x, start.y);
      if (!rooms.every((q) => ok.has(q.cy * g.w + q.cx) || g.get(q.cx, q.cy) === '~')) for (const [x, y] of pool) g.set(x, y, 'g');
      else r.pool = pool;
    }
  }

  // Ore veins along the walls.
  const edges = [];
  for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) if (wallSide(g, x, y)) edges.push([x, y]);
  const onPath = pathTiles(g, start, { x: exit.cx, y: exit.cy });
  const ores = rng.int(7, 11);
  for (let i = 0, n = 0; i < 200 && n < ores; i++) {
    const [x, y] = edges[rng.int(0, edges.length - 1)];
    if (!free(x, y) || onPath.has(y * g.w + x) || Math.abs(x - start.x) + Math.abs(y - start.y) < 3) continue;
    props.push({ type: 'ore', tx: x, ty: y, kind: pick(rng, zone.ores), zone: zi });
    take(x, y);
    n++;
  }
  // Urns in room corners, a chest now and then, pit-props in the old mine.
  for (const r of rooms) {
    if (rng.next() < 0.7) for (const [x, y] of [[r.x, r.y], [r.x + r.w - 1, r.y], [r.x, r.y + r.h - 1], [r.x + r.w - 1, r.y + r.h - 1]]) {
      if (rng.next() < 0.45 && free(x, y) && !onPath.has(y * g.w + x)) { props.push({ type: 'urn', tx: x, ty: y }); take(x, y); }
    }
    if (r !== entry && rng.next() < 0.18) {
      const x = r.x + 1 + rng.int(0, Math.max(0, r.w - 3)), y = r.y;
      if (free(x, y) && !onPath.has(y * g.w + x)) { props.push({ type: 'chest', tx: x, ty: y, zone: zi }); take(x, y); }
    }
    if (zone.timbers && rng.next() < 0.5) {
      const x = r.x + rng.int(1, r.w - 2), y = r.y;
      if (free(x, y) && g.get(x, y - 1) === 'R') { props.push({ type: 'timbers', tx: x, ty: y }); take(x, y); }
    }
  }
  secretRoom(g, rng, rooms, props, take, zi);

  // Foes: more the deeper you go, never in the first room.
  const count = Math.min(12, 4 + Math.floor((floor - zone.from) / 3) + (zi - 1) * 2);
  const far = [...reach(g, start.x, start.y)].filter((k) => {
    const x = k % g.w, y = Math.floor(k / g.w);
    return Math.abs(x - start.x) + Math.abs(y - start.y) > 9 && !taken.has(k);
  });
  const water = rooms.flatMap((r) => r.pool || []);
  for (let i = 0; i < count && far.length; i++) {
    const kind = pick(rng, zone.enemies);
    if (kind === 'kappa' && water.length) {
      const [x, y] = water.splice(rng.int(0, water.length - 1), 1)[0];
      spawns.push({ kind, tx: x, ty: y });
      continue;
    }
    const k = far.splice(rng.int(0, far.length - 1), 1)[0];
    spawns.push({ kind, tx: k % g.w, ty: Math.floor(k / g.w) });
  }
  return { ground: g.rows(), props, spawns, start: { tx: start.x, ty: start.y }, exit: { tx: exit.cx, ty: exit.cy }, zone: zi };
}

function bfsDist(g, x, y) {
  const out = new Map([[y * g.w + x, 0]]);
  const q = [[x, y]];
  for (let i = 0; i < q.length; i++) {
    const [cx, cy] = q[i], d = out.get(cy * g.w + cx);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, k = ny * g.w + nx;
      if (out.has(k) || g.get(nx, ny) !== 'g') continue;
      out.set(k, d + 1);
      q.push([nx, ny]);
    }
  }
  return out;
}

/** Tiles on one shortest walk from a to b (kept clear of props). */
function pathTiles(g, a, b) {
  const d = bfsDist(g, b.x, b.y);
  const out = new Set();
  let [x, y] = [a.x, a.y];
  for (let i = 0; i < 400 && !(x === b.x && y === b.y); i++) {
    out.add(y * g.w + x);
    let next = null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = (y + dy) * g.w + x + dx;
      if (d.has(k) && (!next || d.get(k) < d.get(next[2]))) next = [x + dx, y + dy, k];
    }
    if (!next) break;
    [x, y] = next;
  }
  out.add(b.y * g.w + b.x);
  return out;
}

/** A small sealed room beside a big one, behind one cracked wall tile; a chest inside. */
function secretRoom(g, rng, rooms, props, take, zone) {
  if (rng.next() > 0.35) return;
  for (const r of rooms.slice(1)) {
    for (const [dx, sx, sy] of [[1, r.x + r.w + 1, r.cy - 1], [-1, r.x - 5, r.cy - 1]]) {
      let clear = true;
      for (let y = sy - 1; y <= sy + 3 && clear; y++) for (let x = sx - 1; x <= sx + 4 && clear; x++) if (g.get(x, y) !== 'R' || x <= 0 || y <= 0 || x >= g.w - 1 || y >= g.h - 1) clear = false;
      if (!clear) continue;
      for (let y = sy; y < sy + 3; y++) for (let x = sx; x < sx + 4; x++) g.set(x, y, 'g');
      const cx = dx > 0 ? r.x + r.w : r.x - 1;
      g.set(cx, r.cy, 'g');
      props.push({ type: 'cracked', tx: cx, ty: r.cy, zone });
      props.push({ type: 'chest', tx: sx + 1 + (dx > 0 ? 1 : 0), ty: sy, zone });
      take(cx, r.cy);
      return;
    }
  }
}

/** Floor 20: Jūbei's hall. A tunnel from the rope into a round arena; the ladder after he falls. */
function bossFloor(seed, floor) {
  const g = new Grid(30, 30, 'R');
  for (let y = 21; y < 28; y++) for (let x = 13; x < 17; x++) g.set(x, y, 'g');
  for (let y = 3; y < 22; y++) for (let x = 3; x < 27; x++) if (((x - 14.5) / 11.5) ** 2 + ((y - 12) / 9.5) ** 2 <= 1) g.set(x, y, 'g');
  const props = [
    { type: 'rope', tx: 15, ty: 26 },
    { type: 'cave_lantern', tx: 13, ty: 25, light: [0, -8] },
    { type: 'timbers', tx: 8, ty: 5 }, { type: 'timbers', tx: 21, ty: 5 },
    { type: 'brazier', tx: 6, ty: 12, light: [0, -10] }, { type: 'brazier', tx: 23, ty: 12, light: [0, -10] },
  ];
  return { ground: g.rows(), props, spawns: [{ kind: 'jubei', tx: 15, ty: 7 }], start: { tx: 15, ty: 27 }, exit: { tx: 15, ty: 6 }, zone: 1, boss: 'jubei' };
}
