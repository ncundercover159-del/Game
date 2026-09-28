// Offering rules over a plain state { [altar]: [[deposited per slot], ...] }.
import { ALTARS } from '../data/offerings.js';

export function newOfferings() {
  return Object.fromEntries(Object.entries(ALTARS).map(([id, a]) => [id, a.sets.map((s) => s.items.map(() => 0))]));
}

export const setDone = (st, altar, i) => ALTARS[altar].sets[i].items.every(([, n], k) => st[altar][i][k] >= n);
export const altarDone = (st, altar) => ALTARS[altar].sets.every((_, i) => setDone(st, altar, i));

/**
 * Put what you have toward one set. `count(id)` and `take(id, n)` reach the backpack.
 * Returns { gave, setComplete, altarComplete }.
 */
export function offer(st, altar, i, count, take) {
  const wasDone = setDone(st, altar, i);
  let gave = 0;
  ALTARS[altar].sets[i].items.forEach(([id, need], k) => {
    const n = Math.min(need - st[altar][i][k], count(id));
    if (n > 0) { take(id, n); st[altar][i][k] += n; gave += n; }
  });
  const setComplete = !wasDone && setDone(st, altar, i);
  return { gave, setComplete, altarComplete: setComplete && altarDone(st, altar) };
}
