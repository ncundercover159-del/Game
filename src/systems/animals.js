// Coop animals over a plain state { list: [animal], hay, nextId }. An animal is
// { id, kind, name, affection 0-1000, petDay, fed }. Each night fed animals lay by morning; the
// better loved, the finer the egg. Pure rules; the coop room and its wanderers live in world/coop.js.
import { hash } from '../core/rng.js';

export const ANIMALS = {
  chicken: { name: 'Chicken', jp: '鶏', price: 400, product: 'egg', names: ['Kome', 'Mochi', 'Hana', 'Tama', 'Kiku', 'Momo', 'Sora', 'Yuki'] },
  duck: { name: 'Duck', jp: '鴨', price: 700, product: 'duck_egg', names: ['Gā', 'Kamo', 'Nori', 'Ao', 'Mizu', 'Tsuyu'] },
};
export const COOP_SIZE = 6;
const PET = 25, FED = 10, HUNGRY = -40, NEGLECT = -15;

export function newAnimals() {
  return { list: [], hay: 0, nextId: 1 };
}

/** Buy an animal into the coop; returns it, or null when the coop is full. */
export function adopt(st, kind, seed) {
  if (st.list.length >= COOP_SIZE) return null;
  const names = ANIMALS[kind].names;
  const taken = new Set(st.list.map((a) => a.name));
  const name = names.find((n, i) => !taken.has(n) && hash(seed, st.nextId, i, 81) % 2 === 0) || names.find((n) => !taken.has(n)) || `${names[0]} ${st.nextId}`;
  const a = { id: st.nextId++, kind, name, affection: 100, petDay: -1, fed: false };
  st.list.push(a);
  return a;
}

/** Petting once a day raises affection; returns true the first time today. */
export function pet(a, day, mult = 1) {
  if (a.petDay === day) return false;
  a.petDay = day;
  a.affection = Math.min(1000, a.affection + Math.round(PET * mult));
  return true;
}

export const allPetted = (st, day) => st.list.length > 0 && st.list.every((a) => a.petDay === day);

/**
 * The night: each animal eats one hay from the hopper if there is any. Fed animals lay (quality
 * from affection); hungry ones don't and sulk; unpetted ones cool a little. Returns the products
 * [{ id, q, animal }] to set out on the coop floor.
 */
export function coopNight(st, day, rng) {
  const out = [];
  for (const a of st.list) {
    const fed = st.hay > 0;
    if (fed) st.hay--;
    a.affection = Math.max(0, Math.min(1000, a.affection + (fed ? FED : HUNGRY) + (a.petDay === day ? 0 : NEGLECT)));
    a.fed = fed;
    if (!fed) continue;
    const r = rng.next();
    const q = a.affection >= 900 ? (r < 0.4 ? 2 : r < 0.9 ? 1 : 0) : a.affection >= 600 && r < 0.5 ? 1 : 0;
    out.push({ id: ANIMALS[a.kind].product, q, animal: a.id });
  }
  return out;
}

export const hasDucks = (st) => st.list.some((a) => a.kind === 'duck');
