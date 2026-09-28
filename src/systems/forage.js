// Forage and dig spots: each morning every map gets a fresh, seeded set (minus anything already
// picked today). Picking forage and digging are handled by the World; this module places them.
import { hash } from '../core/rng.js';
import { G } from '../world/gamemap.js';
import { FORAGE, ARTIFACTS, SPOTS } from '../data/forage.js';

const MAP_SALT = { farm: 1, village: 2, shrine: 3, grove: 4 };

/** Forage that can appear on a map in a season. */
export function forageFor(mapId, seasonId) {
  return Object.keys(FORAGE).filter((id) => FORAGE[id].seasons.includes(seasonId) && FORAGE[id].where.includes(mapId));
}

function nearPine(map, x, y) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const o = map.objectAt(x + dx, y + dy);
    if (o && (o.type === 'forest' || o.type === 'tree') && o.kind === 'pine') return true;
  }
  return false;
}

/** Can a spot go on this tile? Open grass (or bare earth for dig spots), no object, no warp. */
function free(map, x, y, dirt) {
  if (!map.inside(x, y) || map.solid(x, y) || map.objectAt(x, y)) return false;
  const k = map.i(x, y);
  if (map.soil[k] || map.crops.has(k)) return false;
  const g = map.ground[k];
  if (!(g === G.GRASS || (dirt && g === G.DIRT))) return false;
  return !map.def.warps.some((w) => x >= w.x - 1 && x <= w.x + w.w && y >= w.y - 1 && y <= w.y + w.h);
}

/**
 * Replace a map's forage and dig spots with today's. `taken` holds "map:x,y" keys already picked
 * today; `digMult` doubles dig spots for the Tracker perk. Returns the spots placed.
 */
export function spawnSpots(map, { seed, day, seasonId, taken = [], digMult = 1 }) {
  for (const o of map.objects.filter((x) => x.type === 'forage' || x.type === 'dig')) map.removeObject(o);
  const conf = SPOTS[map.id];
  if (!conf) return [];
  const salt = MAP_SALT[map.id];
  const kinds = forageFor(map.id, seasonId);
  const placed = [];
  const place = (type, count, tries, pick) => {
    let n = 0;
    for (let i = 0; i < tries && n < count; i++) {
      const h = hash(seed, day, salt * 1000 + i, type === 'dig' ? 73 : 71);
      const x = h % map.w, y = (h >>> 12) % map.h;
      if (taken.includes(`${map.id}:${x},${y}`) || !free(map, x, y, type === 'dig')) continue;
      const kind = pick(h, x, y);
      if (!kind) continue;
      placed.push(map.addObject({ type, x, y, kind, v: 0 }));
      n++;
    }
  };
  if (kinds.length) {
    place('forage', conf.forage, conf.forage * 40, (h, x, y) => {
      const k = kinds[(h >>> 20) % kinds.length];
      return FORAGE[k].pine && !nearPine(map, x, y) ? null : k;
    });
  }
  place('dig', conf.dig * digMult, conf.dig * digMult * 40, () => 'dig');
  return placed;
}

/** What a dig spot turns up: an artefact by weight, or in winter sometimes a mountain yam. */
export function digFind(rng, seasonId) {
  if (seasonId === 'winter' && rng.next() < 0.35) return 'yamaimo';
  const ids = Object.keys(ARTIFACTS);
  let r = rng.next() * ids.reduce((a, id) => a + ARTIFACTS[id].weight, 0);
  for (const id of ids) if ((r -= ARTIFACTS[id].weight) < 0) return id;
  return ids[0];
}
