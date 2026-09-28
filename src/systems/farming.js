// Soil and crops on a GameMap. Pure rules; the caller supplies RNG and handles feedback.
import { G } from '../world/gamemap.js';
import { CROPS, RIPE, stageOf, QUALITY_ODDS } from '../data/crops.js';

export function cropAt(map, x, y) {
  return map.inside(x, y) ? map.crops.get(map.i(x, y)) || null : null;
}

export function isRipe(crop) {
  return !!crop && stageOf(crop.id, crop.growth) === RIPE;
}

export function canTill(map, x, y) {
  if (!map.inside(x, y)) return false;
  const k = map.i(x, y);
  const g = map.ground[k];
  return (g === G.GRASS || g === G.DIRT) && !map.soil[k] && !map.blocked[k] && map.objAt[k] < 0;
}

export function till(map, x, y) {
  if (!canTill(map, x, y)) return false;
  const k = map.i(x, y);
  map.ground[k] = G.DIRT;
  map.soil[k] = 1;
  map.touch(x, y);
  return true;
}

/** Turn empty soil back into plain earth (pickaxe). */
export function untill(map, x, y) {
  if (!map.inside(x, y)) return false;
  const k = map.i(x, y);
  if (!map.soil[k] || map.crops.has(k)) return false;
  map.soil[k] = 0;
  map.wet[k] = 0;
  map.touch(x, y);
  return true;
}

export function water(map, x, y) {
  if (!map.inside(x, y)) return false;
  const k = map.i(x, y);
  if (!map.soil[k]) return false;
  if (!map.wet[k]) {
    map.wet[k] = 1;
    map.touch(x, y);
  }
  return true;
}

export function canPlant(map, x, y) {
  return map.inside(x, y) && map.soil[map.i(x, y)] === 1 && !map.crops.has(map.i(x, y)) && map.objAt[map.i(x, y)] < 0;
}

export function plant(map, x, y, cropId) {
  if (!CROPS[cropId]) throw new Error(`Unknown crop "${cropId}"`);
  if (!canPlant(map, x, y)) return false;
  map.crops.set(map.i(x, y), { id: cropId, growth: 0 });
  return true;
}

export function rollQuality(rng) {
  const r = rng.next();
  if (r < QUALITY_ODDS[1]) return 2;
  if (r < QUALITY_ODDS[1] + QUALITY_ODDS[0]) return 1;
  return 0;
}

/** Harvest a ripe crop: returns { item, q } or null. Regrowing crops stay and restart. */
export function harvest(map, x, y, rng) {
  const crop = cropAt(map, x, y);
  if (!isRipe(crop)) return null;
  const def = CROPS[crop.id];
  const q = rollQuality(rng);
  if (def.regrow) crop.growth = def.days - def.regrow;
  else map.crops.delete(map.i(x, y));
  return { item: def.item, q };
}

/** Overnight: watered crops grow a day, then all soil dries. Returns the number that grew. */
export function growNight(map) {
  let grew = 0;
  for (const [k, crop] of map.crops) {
    if (map.wet[k] && crop.growth < CROPS[crop.id].days) {
      crop.growth++;
      grew++;
    }
  }
  for (let k = 0; k < map.wet.length; k++) {
    if (map.wet[k]) {
      map.wet[k] = 0;
      map.touch(k % map.w, Math.floor(k / map.w));
    }
  }
  return grew;
}
