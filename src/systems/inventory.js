// Backpack slots. A slot is null or { id, n, q } (q = quality 0-3). Tools never stack.
import { isStackable, STACK } from '../data/items.js';

export class Inventory {
  constructor(size = 12, slots = null) {
    this.size = size;
    this.slots = slots ? slots.slice(0, size) : [];
    while (this.slots.length < size) this.slots.push(null);
    this.selected = 0;
  }

  get current() {
    return this.slots[this.selected];
  }

  /** How many of (id, q) could be added right now. */
  room(id, q = 0) {
    let n = 0;
    for (const s of this.slots) {
      if (!s) n += isStackable(id) ? STACK : 1;
      else if (isStackable(id) && s.id === id && s.q === q) n += STACK - s.n;
    }
    return n;
  }

  /** Add up to n items; returns how many did not fit. */
  add(id, n = 1, q = 0) {
    if (isStackable(id)) {
      for (const s of this.slots) {
        if (n <= 0) break;
        if (s && s.id === id && s.q === q && s.n < STACK) {
          const k = Math.min(n, STACK - s.n);
          s.n += k;
          n -= k;
        }
      }
    }
    for (let i = 0; i < this.size && n > 0; i++) {
      if (this.slots[i]) continue;
      const k = isStackable(id) ? Math.min(n, STACK) : 1;
      this.slots[i] = { id, n: k, q };
      n -= k;
    }
    return n;
  }

  count(id) {
    return this.slots.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0);
  }

  /** Remove n from a specific slot index. */
  takeFrom(i, n = 1) {
    const s = this.slots[i];
    if (!s || s.n < n) return false;
    s.n -= n;
    if (s.n <= 0) this.slots[i] = null;
    return true;
  }

  /** Remove n of an item across stacks (any quality, lowest first). Returns false if short. */
  remove(id, n) {
    if (this.count(id) < n) return false;
    const order = this.slots.map((s, i) => [s, i]).filter(([s]) => s && s.id === id).sort((a, b) => a[0].q - b[0].q);
    for (const [s, i] of order) {
      const k = Math.min(n, s.n);
      this.takeFrom(i, k);
      n -= k;
      if (!n) break;
    }
    return true;
  }

  /** Grow the pack (a bought upgrade); never shrinks. */
  resize(size) {
    while (this.slots.length < size) this.slots.push(null);
    this.size = Math.max(this.size, size);
  }

  swap(a, b) {
    [this.slots[a], this.slots[b]] = [this.slots[b], this.slots[a]];
  }

  select(i) {
    this.selected = ((i % this.size) + this.size) % this.size;
  }

  /** Index of the first slot holding a tool of this kind, or -1. */
  find(id) {
    return this.slots.findIndex((s) => s && s.id === id);
  }

  serialize() {
    return { size: this.size, slots: this.slots.map((s) => (s ? { ...s } : null)), selected: this.selected };
  }

  static from(data) {
    const inv = new Inventory(data.size, data.slots);
    inv.selected = data.selected || 0;
    return inv;
  }
}
