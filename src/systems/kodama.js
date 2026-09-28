// Kodama rules (pure): whether one waits on the shrine stair tonight and where, what it will take,
// which hokora are lived in, and the watering they do overnight.
import { KODAMA } from '../data/kodama.js';
import { itemDef } from '../data/items.js';
import { hash } from '../core/rng.js';
import { SOIL } from './irrigation.js';

export const friends = (flags) => flags.kodama_friends || 0;

/** A kodama comes to the stair once the Altar of Chūgi is full, until all of them live with you. */
export const waiting = (flags) => !!flags.restored_kodama && friends(flags) < KODAMA.max;

/** Is it the hour when one is out among the cedars? */
export const out = (minutes) => minutes >= KODAMA.hours[0] && minutes < KODAMA.hours[1];

/** Today's spot on the shrine stair. */
export const spotFor = (seed, day) => KODAMA.spots[hash(seed, day, 0, 97) % KODAMA.spots.length];

/** A gift from the forest, or rice. */
export function accepts(id) {
  return itemDef(id).kind === 'forage' || id === 'rice' || id === 'onigiri';
}

/** The hokora on a map with a kodama living in them: the first `n`, in reading order. */
export function homes(map, n) {
  return map.objects.filter((o) => o.type === 'hokora').sort((a, b) => a.y - b.y || a.x - b.x).slice(0, n);
}

/** Overnight: each kodama at home waters the dry, planted soil around its hokora. Returns how many
 * crops were watered (a crop in reach of two hokora counts once). */
export function kodamaNight(map, n) {
  const r = KODAMA.radius;
  let watered = 0;
  for (const h of homes(map, n)) {
    for (let y = h.y - r; y <= h.y + r; y++) for (let x = h.x - r; x <= h.x + r; x++) {
      if (!map.inside(x, y)) continue;
      const k = map.i(x, y);
      if (map.soil[k] !== SOIL.TILLED || map.wet[k] || !map.crops.has(k)) continue;
      map.wet[k] = 1;
      map.touch(x, y);
      watered++;
    }
  }
  return watered;
}
