// Notice-board requests (kōsatsuba 高札場). Each morning one or two are posted, seeded by the day:
// "bring" (hand a villager some goods) and "deliver" (carry a parcel from one villager to another).
// Accepted requests stay open until done or past their deadline; missing a deadline costs nothing
// but the reward. Rewards: mon, bond points and virtue.
import { hash } from '../core/rng.js';
import { CROPS } from '../data/crops.js';
import { sellPrice } from '../data/items.js';
import { NPC_IDS } from '../data/npcs.js';

export const MAX_ACTIVE = 3;
export const DAYS_TO_DO = 3;

// Goods villagers ask for outside the crop list, with typical amounts.
const GOODS = [['wood', 20], ['stone', 15], ['hay', 10], ['bamboo', 6], ['iron_bar', 1]];

export function newRequests() {
  return { posted: [], active: [], day: -1, done: 0 };
}

/** What can be asked for in a season: its crops (with sensible counts) and common goods. */
function pool(seasonId) {
  const crops = Object.keys(CROPS).filter((id) => CROPS[id].seasons.includes(seasonId));
  return [...crops.map((id) => [id, CROPS[id].sell >= 100 ? 1 : CROPS[id].sell >= 60 ? 2 : 4]), ...GOODS];
}

/** The day's postings (deterministic from seed and day). */
export function postingsFor(seed, day, seasonId) {
  const n = 1 + (hash(seed, day, 0, 61) % 2);
  const items = pool(seasonId);
  const out = [];
  for (let i = 0; i < n; i++) {
    const h = hash(seed, day, i, 62);
    const from = NPC_IDS[h % NPC_IDS.length];
    const id = `r${day}_${i}`;
    if ((h >>> 5) % 3 === 0) {
      let to = NPC_IDS[(h >>> 9) % NPC_IDS.length];
      if (to === from) to = NPC_IDS[(NPC_IDS.indexOf(from) + 1) % NPC_IDS.length];
      out.push({ id, type: 'deliver', from, to, mon: 120, bond: 60, virtue: ['makoto', 2], posted: day, due: day + DAYS_TO_DO });
    } else {
      const [item, n0] = items[(h >>> 9) % items.length];
      const n = n0 * (1 + ((h >>> 13) % 2));
      const mon = Math.round((sellPrice(item) * n * 1.6 + 60) / 10) * 10;
      out.push({ id, type: 'bring', from, item, n, mon, bond: 60, virtue: ['jin', 2], posted: day, due: day + DAYS_TO_DO });
    }
  }
  return out;
}

/** Morning: post today's requests (replacing yesterday's unaccepted ones) and drop expired ones. */
export function refresh(r, seed, day, seasonId) {
  if (r.day === day) return [];
  r.day = day;
  const expired = r.active.filter((q) => q.due < day);
  r.active = r.active.filter((q) => q.due >= day);
  r.posted = postingsFor(seed, day, seasonId);
  return expired;
}

export function accept(r, id) {
  const i = r.posted.findIndex((q) => q.id === id);
  if (i < 0 || r.active.length >= MAX_ACTIVE) return null;
  const [q] = r.posted.splice(i, 1);
  r.active.push(q);
  return q;
}

/** The active request a villager can settle now: they asked for goods, or the parcel is for them. */
export function dueWith(r, npc, count) {
  return r.active.find((q) =>
    (q.type === 'bring' && q.from === npc && count(q.item) >= q.n) ||
    (q.type === 'deliver' && q.to === npc && count('parcel') >= 1)) || null;
}

export function complete(r, q) {
  r.active = r.active.filter((x) => x !== q);
  r.done++;
}
