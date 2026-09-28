// Deterministic placement of world objects.
// decorate(): fixed scenery from the map itself (forest edge, fences) - the same on every farm.
// populate(): the overgrowth for a new game, driven by the save seed.
import { hash, hashf, valueNoise } from '../core/rng.js';

const FOREST_KINDS = ['pine', 'pine', 'broadleaf', 'pine', 'broadleaf', 'sakura'];

export function decorate(map) {
  const def = map.def;
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const ch = def.ground[y][x];
    if (ch === 'f') map.addObject({ type: 'fence', x, y, v: x % 3 === 0 ? 1 : 0 });
    // Forest edge: a staggered lattice so canopies overlap into a continuous treeline.
    if (ch === 'T' && y % 2 === 0 && (x + (y % 4 === 0 ? 0 : 1)) % 2 === 0) {
      const h = hash(x, y, 0, 77);
      map.addObject({ type: 'forest', x, y, kind: FOREST_KINDS[h % FOREST_KINDS.length], v: (h >>> 8) % 3 });
    }
  }
}

// Overgrowth table: weights for what grows on an overgrown cell.
const GROWTH = [
  ['weed', 60], ['stone', 12], ['twig', 10], ['stump', 3], ['tree', 3], ['bamboo', 1.5],
];
const TREE_KINDS = ['broadleaf', 'broadleaf', 'pine', 'sakura'];

export function populate(map, seed) {
  const def = map.def;
  const total = GROWTH.reduce((a, [, w]) => a + w, 0);
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const ch = def.ground[y][x];
    if (ch === 's' || ch === 't') {
      map.addObject({ type: 'tree', x, y, kind: ch === 's' ? 'sakura' : 'broadleaf', v: hash(x, y, seed, 5) % 3 });
      continue;
    }
    if (ch !== 'o' && ch !== ':') continue;
    // Density varies in broad patches so the field has thickets and clearings.
    const density = 0.12 + 0.55 * valueNoise(x, y, 6, 1 << 16, seed);
    if (hashf(x, y, seed, 1) > density) continue;
    let r = hashf(x, y, seed, 2) * total;
    let type = 'weed';
    for (const [t, w] of GROWTH) if ((r -= w) < 0) { type = t; break; }
    if ((type === 'tree' || type === 'bamboo') && crowded(map, x, y)) type = 'weed';
    const h = hash(x, y, seed, 3);
    const o = { type, x, y };
    if (type === 'weed') o.v = h % 23 === 0 ? 3 : h % 3;
    else if (type === 'stone') o.v = h % 3;
    else if (type === 'twig' || type === 'bamboo') o.v = h % 2;
    else if (type === 'tree') { o.kind = TREE_KINDS[h % TREE_KINDS.length]; o.v = (h >>> 4) % 3; }
    else o.v = 0;
    map.addObject(o);
  }
}

// Trees and bamboo need breathing room: no other tall object within 2 tiles.
function crowded(map, x, y) {
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const o = map.objectAt(x + dx, y + dy);
    if (o && (o.type === 'tree' || o.type === 'bamboo' || o.type === 'forest')) return true;
  }
  return false;
}
