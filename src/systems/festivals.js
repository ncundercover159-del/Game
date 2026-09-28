// Festival rules: which festival falls on a date, who comes and where they stand, and the crop
// judging at Niiname-sai. Pure; the game side (dressing the place, the scene) is in festivals.js.
import { FESTIVALS } from '../data/festivals.js';
import { NPC_IDS, stopAt } from '../data/npcs.js';
import { itemDef, sellPrice } from '../data/items.js';

export function festivalOn(cal) {
  return FESTIVALS.find((f) => f.season === cal.season && f.day === cal.day) || null;
}

/** The festival tomorrow, if any (for the end-of-day reminder). */
export function festivalAfter(cal) {
  return FESTIVALS.find((f) => f.season === cal.season && f.day === cal.day + 1) || null;
}

export const festivalLive = (f, minutes) => minutes >= f.from && minutes < f.to;

/** Seen this year's? */
export const festFlag = (f, year) => `fest_${f.id}_${year}`;

/** Who comes, in the order they take the spots: the festival's cast, or everyone who is here. */
export function castFor(f, flags) {
  const all = f.who || NPC_IDS.filter((id) => id !== 'rin' || flags.rin_arrived);
  return all.slice(0, f.spots.length);
}

/** A villager's day with the festival in it: their own day, then the festival spot, then home. */
export function festivalRoute(route, f, spot) {
  const after = stopAt(route, f.to);
  return [
    ...route.filter((s) => s[0] < f.from),
    [f.from, f.map, ...spot],
    [f.to, ...after.slice(1)],
    ...route.filter((s) => s[0] > f.to),
  ];
}

// Niiname-sai: the judges look at your best crop's worth (quality counts); Kaito's entry and the
// headman's own daikon are what you have to beat.
export const JUDGING = { first: 150, second: 80 };

/** Your best crop in the pack: { id, q, value } or null. */
export function bestCrop(slots) {
  let best = null;
  for (const s of slots) {
    if (!s || itemDef(s.id).kind !== 'crop') continue;
    const value = sellPrice(s.id, s.q || 0);
    if (!best || value > best.value) best = { id: s.id, q: s.q || 0, value };
  }
  return best;
}

/** 0 first prize, 1 second, 2 nothing. */
export function judgeGrade(entry) {
  if (!entry) return 2;
  return entry.value >= JUDGING.first ? 0 : entry.value >= JUDGING.second ? 1 : 2;
}
