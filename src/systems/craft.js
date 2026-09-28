// Crafting, artisan machines and cooking as pure rules. A machine is a map object
// { type: 'machine', kind, input, q, ready } where `ready` is the day index its goods are done.
import { MACHINES, CRAFTS, DISHES, PICKLE_EXCLUDE } from '../data/recipes.js';
import { itemDef } from '../data/items.js';
import { CROPS } from '../data/crops.js';

/** Materials a craft needs (Thrifty: a quarter fewer, rounded up). */
export function craftNeeds(id, thrifty = false) {
  return CRAFTS[id].needs.map(([item, n]) => [item, thrifty ? Math.ceil(n * 0.75) : n]);
}

export const hasAll = (needs, count) => needs.every(([id, n]) => count(id) >= n);

/** Does this machine take this item? */
export function accepts(machine, id) {
  const m = MACHINES[machine];
  if (Array.isArray(m.input)) return m.input.includes(id);
  const def = itemDef(id);
  if (m.input === 'vegetable') return def.kind === 'crop' && !!CROPS[id] && !PICKLE_EXCLUDE.has(id);
  if (m.input === 'fish50') return def.kind === 'fish' && def.sell >= 50;
  return false;
}

/** Load a machine; returns the day its goods will be ready. Patient Hands: a quarter faster. */
export function load(o, id, q, day, patient = false) {
  const days = MACHINES[o.kind].days;
  o.input = id;
  o.q = q;
  o.ready = day + Math.max(1, patient ? Math.ceil(days * 0.75) : days);
  return o.ready;
}

export const isReady = (o, day) => !!o.input && day >= o.ready;

/** 0..1 how far along a loaded machine is. */
export function progressOf(o, day, minutes) {
  if (!o.input) return 0;
  const days = MACHINES[o.kind].days;
  const start = o.ready - days;
  return Math.max(0, Math.min(1, (day - start + (minutes - 360) / 1200) / days));
}

/** Take the goods out: { id, n, q } (Master Maker: at least Fine). */
export function collect(o, master = false) {
  const m = MACHINES[o.kind];
  const out = { id: m.out, n: m.outN || 1, q: master ? Math.max(1, o.q || 0) : o.q || 0 };
  o.input = null;
  o.q = 0;
  o.ready = 0;
  return out;
}

/** Ingredients for a dish. */
export const dishNeeds = (id) => DISHES[id].needs;
