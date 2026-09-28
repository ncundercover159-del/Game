// The Archive's rules: what can be donated, and what a donation completes. State is
// { donated: [ids], claimed: [milestone n] } in the save.
import { COLLECTIONS, MILESTONES } from '../data/archive.js';

export function newArchive() {
  return { donated: [], claimed: [] };
}

export function collectionOf(id) {
  return Object.keys(COLLECTIONS).find((c) => COLLECTIONS[c].items.includes(id)) || null;
}

export const TOTAL = Object.values(COLLECTIONS).reduce((a, c) => a + c.items.length, 0);

/** Can this item be donated now (it belongs to a collection and isn't there yet)? */
export const donatable = (st, id) => !!collectionOf(id) && !st.donated.includes(id);

export const progress = (st, c) => COLLECTIONS[c].items.filter((id) => st.donated.includes(id)).length;

/**
 * Donate one item. Returns { milestones: [..newly reached], completed: collection id or null },
 * or null if it can't be donated.
 */
export function donate(st, id) {
  if (!donatable(st, id)) return null;
  st.donated.push(id);
  const n = st.donated.length;
  const milestones = MILESTONES.filter((m) => m.n <= n && !st.claimed.includes(m.n));
  for (const m of milestones) st.claimed.push(m.n);
  const c = collectionOf(id);
  return { milestones, completed: progress(st, c) === COLLECTIONS[c].items.length ? c : null };
}
