// Storage chests (pure): how many stacks each holds, and moving a stack between two rows of slots
// (a chest's and the pack's) the way a player would: onto matching stacks first, then empty slots.
import { isStackable, STACK } from '../data/items.js';

export const CHESTS = { box_small: 12, box_large: 36 };

/** A new chest's slots. */
export const emptyChest = (kind) => Array(CHESTS[kind]).fill(null);

/** Move the stack in `from[i]` into `to` (up to `size` slots of it). Whatever does not fit stays
 * behind. Returns how many moved. */
export function moveStack(from, i, to, size = to.length) {
  const s = from[i];
  if (!s) return 0;
  let n = s.n;
  const stacks = isStackable(s.id);
  if (stacks) {
    for (let j = 0; j < size && n > 0; j++) {
      const d = to[j];
      if (d && d.id === s.id && (d.q || 0) === (s.q || 0) && d.n < STACK) { const k = Math.min(n, STACK - d.n); d.n += k; n -= k; }
    }
  }
  for (let j = 0; j < size && n > 0; j++) {
    if (to[j]) continue;
    const k = stacks ? Math.min(n, STACK) : 1;
    to[j] = { ...s, n: k };
    n -= k;
  }
  const moved = s.n - n;
  if (n > 0) s.n = n; else from[i] = null;
  return moved;
}

/** Is there anything in the chest? */
export const holdsAnything = (o) => !!o.items?.some(Boolean);
