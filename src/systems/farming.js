// Soil and crops on a GameMap. Pure rules; the caller supplies RNG and handles feedback.
// Soil: 0 none, 1 tilled, 2 irrigation channel. `cover` marks straw-covered soil (winter crops).
import { G } from '../world/gamemap.js';
import { CROPS, RIPE, stageOf, QUALITY_ODDS, inSeason } from '../data/crops.js';
import { SOIL, computeFlow, isFlooded } from './irrigation.js';

export function cropAt(map, x, y) {
  return map.inside(x, y) ? map.crops.get(map.i(x, y)) || null : null;
}

export function isRipe(crop) {
  return !!crop && !crop.dead && stageOf(crop.id, crop.growth) === RIPE;
}

export function canTill(map, x, y) {
  if (!map.def.farmable || !map.inside(x, y)) return false;
  const k = map.i(x, y);
  const g = map.ground[k];
  return (g === G.GRASS || g === G.DIRT) && !map.soil[k] && !map.blocked[k] && map.objAt[k] < 0;
}

export function till(map, x, y) {
  if (!canTill(map, x, y)) return false;
  const k = map.i(x, y);
  map.ground[k] = G.DIRT;
  map.soil[k] = SOIL.TILLED;
  map.touch(x, y);
  return true;
}

/** Hoe on empty tilled soil digs it deeper into an irrigation channel. */
export function digChannel(map, x, y) {
  if (!map.inside(x, y)) return false;
  const k = map.i(x, y);
  if (map.soil[k] !== SOIL.TILLED || map.crops.has(k) || map.objAt[k] >= 0) return false;
  map.soil[k] = SOIL.CHANNEL;
  map.wet[k] = 0;
  map.cover[k] = 0;
  map.touch(x, y);
  computeFlow(map);
  return true;
}

/** Turn empty soil or a channel back into plain earth (pickaxe). */
export function untill(map, x, y) {
  if (!map.inside(x, y)) return false;
  const k = map.i(x, y);
  if (!map.soil[k] || map.crops.has(k) || map.objAt[k] >= 0) return false;
  const wasChannel = map.soil[k] === SOIL.CHANNEL;
  map.soil[k] = SOIL.NONE;
  map.wet[k] = 0;
  map.cover[k] = 0;
  map.touch(x, y);
  if (wasChannel) computeFlow(map);
  return true;
}

export function water(map, x, y) {
  if (!map.inside(x, y)) return false;
  const k = map.i(x, y);
  if (map.soil[k] !== SOIL.TILLED) return false;
  if (!map.wet[k]) {
    map.wet[k] = 1;
    map.touch(x, y);
  }
  return true;
}

/** Spread straw (hay) over tilled soil so winter crops can grow there. */
export function coverSoil(map, x, y) {
  if (!map.inside(x, y)) return false;
  const k = map.i(x, y);
  if (map.soil[k] !== SOIL.TILLED || map.cover[k]) return false;
  map.cover[k] = 1;
  map.touch(x, y);
  return true;
}

/** Why a seed can't go here (a string key), or null when it can. */
export function plantProblem(map, x, y, cropId, seasonId) {
  if (!map.inside(x, y)) return 'no_soil';
  const k = map.i(x, y);
  if (map.soil[k] !== SOIL.TILLED || map.crops.has(k) || map.objAt[k] >= 0) return 'no_soil';
  const c = CROPS[cropId];
  if (seasonId && !inSeason(cropId, seasonId)) return 'wrong_season';
  if (c.paddy && !isFlooded(map, x, y)) return 'needs_paddy';
  if (c.cover && !map.cover[k]) return 'needs_cover';
  return null;
}

export function canPlant(map, x, y, cropId = 'daikon', seasonId = null) {
  return plantProblem(map, x, y, cropId, seasonId) === null;
}

export function plant(map, x, y, cropId, seasonId = null) {
  if (!CROPS[cropId]) throw new Error(`Unknown crop "${cropId}"`);
  if (!canPlant(map, x, y, cropId, seasonId)) return false;
  map.crops.set(map.i(x, y), { id: cropId, growth: 0 });
  return true;
}

/** Harvest quality: base odds (Fine, Excellent) raised by `bonus` (skill level and food buffs). */
export function rollQuality(rng, bonus = 0) {
  const r = rng.next();
  const excellent = QUALITY_ODDS[1] + bonus * 0.25, fine = QUALITY_ODDS[0] + bonus;
  if (r < excellent) return 2;
  if (r < excellent + fine) return 1;
  return 0;
}

/** Harvest a ripe crop: returns { item, n, q } or null. Regrowing crops stay and restart. */
export function harvest(map, x, y, rng, bonus = 0) {
  const crop = cropAt(map, x, y);
  if (!isRipe(crop)) return null;
  const def = CROPS[crop.id];
  const q = rollQuality(rng, bonus);
  const n = def.yield ? rng.int(def.yield[0], def.yield[1]) : 1;
  if (def.regrow) crop.growth = def.days - def.regrow;
  else map.crops.delete(map.i(x, y));
  return { item: crop.id, n, q };
}

/** Clear a withered crop (any tool). */
export function clearDead(map, x, y) {
  const crop = cropAt(map, x, y);
  if (!crop || !crop.dead) return false;
  map.crops.delete(map.i(x, y));
  map.touch(x, y);
  return true;
}

/** Does this crop get water tonight? */
export function watered(map, k) {
  const x = k % map.w, y = Math.floor(k / map.w);
  return !!map.wet[k] || isFlooded(map, x, y);
}

/**
 * Overnight: watered crops grow a day, crops that need a paddy or straw cover only grow when they
 * have it, then all soil dries. `seasonId` is tomorrow's season: crops out of season wither.
 * Returns { grew, withered }.
 */
export function growNight(map, seasonId = null, extra = null) {
  let grew = 0, withered = 0;
  computeFlow(map);
  for (const [k, crop] of map.crops) {
    if (crop.dead) continue;
    const def = CROPS[crop.id];
    const x = k % map.w, y = Math.floor(k / map.w);
    const ok = watered(map, k) && (!def.paddy || isFlooded(map, x, y)) && (!def.cover || map.cover[k]);
    if (ok && crop.growth < def.days) {
      crop.growth += extra?.() ? 2 : 1;
      crop.growth = Math.min(def.days, crop.growth);
      grew++;
    }
    if (seasonId && !inSeason(crop.id, seasonId)) { crop.dead = true; withered++; map.touch(x, y); }
  }
  for (let k = 0; k < map.wet.length; k++) {
    if (map.wet[k]) {
      map.wet[k] = 0;
      map.touch(k % map.w, Math.floor(k / map.w));
    }
  }
  return { grew, withered };
}

/** Rain waters every tilled tile. */
export function rainWater(map) {
  for (let k = 0; k < map.soil.length; k++) {
    if (map.soil[k] === SOIL.TILLED && !map.wet[k]) {
      map.wet[k] = 1;
      map.touch(k % map.w, Math.floor(k / map.w));
    }
  }
}

/** Typhoon night: unprotected crops may be torn out. Returns how many were lost. */
export function typhoonDamage(map, rng, chance = 0.2) {
  let lost = 0;
  for (const [k, crop] of [...map.crops]) {
    if (crop.dead || map.cover[k]) continue;
    if (rng.next() < chance) {
      map.crops.delete(k);
      map.touch(k % map.w, Math.floor(k / map.w));
      lost++;
    }
  }
  return lost;
}
