// Bonds (kizuna 絆) with villagers, and choosing what a villager says. Pure rules over a plain
// state object { [npc]: bond } so they can be unit-tested and saved as-is.
import { NPCS, BOND } from '../data/npcs.js';
import { hash } from '../core/rng.js';
import { itemDef } from '../data/items.js';
import DIALOGUE from '../data/dialogue/index.js';

export function newBond() {
  return { pts: 0, met: false, talkedDay: -1, giftDay: -1, giftWeek: -1, giftsThisWeek: 0, lastSeen: -1 };
}

export function hearts(pts) {
  return Math.min(BOND.maxHearts, Math.floor(pts / BOND.perHeart));
}

/** Dialogue tier 0-4 for a number of hearts: 0-1, 2-3, 4-5, 6-7, 8-10. */
export function tierOf(pts) {
  return Math.min(4, Math.floor(hearts(pts) / 2));
}

export function addBond(b, n) {
  b.pts = Math.max(0, Math.min(BOND.perHeart * BOND.maxHearts, b.pts + n));
}

/** Talking once a day earns bond points; returns true the first time today. */
export function talk(b, day) {
  b.met = true;
  b.lastSeen = day;
  if (b.talkedDay === day) return false;
  b.talkedDay = day;
  addBond(b, BOND.talk);
  return true;
}

export function isGiftable(id) {
  const kind = itemDef(id).kind;
  return kind !== 'tool' && kind !== 'quest';
}

export function taste(npc, id) {
  const g = NPCS[npc].gifts;
  for (const k of ['loved', 'liked', 'disliked', 'hated']) if (g[k].includes(id)) return k;
  return 'neutral';
}

/** Why a gift can't be given today, or null. */
export function giftBlock(b, day) {
  if (b.giftDay === day) return 'today';
  if (b.giftWeek === Math.floor(day / 7) && b.giftsThisWeek >= BOND.giftsPerWeek) return 'week';
  return null;
}

/** Give a gift: returns { taste, delta }. Birthdays multiply the effect. */
export function giveGift(b, npc, id, day, birthday) {
  const k = taste(npc, id);
  const delta = BOND.gift[k] * (birthday ? BOND.birthdayMult : 1);
  addBond(b, delta);
  const week = Math.floor(day / 7);
  if (b.giftWeek !== week) { b.giftWeek = week; b.giftsThisWeek = 0; }
  b.giftsThisWeek++;
  b.giftDay = day;
  b.met = true;
  b.lastSeen = day;
  return { taste: k, delta };
}

/** Overnight: villagers you have met but not spoken to for a week drift apart a little. */
export function decay(bonds, day) {
  for (const b of Object.values(bonds)) {
    if (b.met && b.pts > 0 && day - b.lastSeen > BOND.decayAfterDays) addBond(b, -BOND.decay);
  }
}

export function isBirthday(npc, cal) {
  const bd = NPCS[npc].birthday;
  return bd.season === cal.season && bd.day === cal.day;
}

/** Split "[face] text" into { face, text }. */
export function parseLine(line) {
  const m = /^\[(\w+)\]\s*(.*)$/s.exec(line);
  return m ? { face: m[1], text: m[2] } : { face: 'neutral', text: line };
}

/**
 * What a villager says when you talk to them today. `ctx` = { season (id), weekday, rain, minutes,
 * place (their map), stop ([map, x, y]), flags, seed, day }. Deterministic per day, so talking twice
 * repeats the same line. Conditional lines win a third of the time when they apply.
 */
export function pickLine(npc, b, ctx) {
  const d = DIALOGUE[npc];
  if (!b.met) return parseLine(d.intro);
  const h = hash(ctx.seed, ctx.day, npc.length, 31);
  const cond = d.when.filter((w) => matches(w, ctx));
  if (cond.length && h % 3 === 0) return parseLine(cond[(h >>> 4) % cond.length].text);
  const lines = d.tiers[tierOf(b.pts)];
  return parseLine(lines[(h >>> 8) % lines.length]);
}

function matches(w, ctx) {
  if (w.season !== undefined && w.season !== ctx.season) return false;
  if (w.weekday !== undefined && w.weekday !== ctx.weekday) return false;
  if (w.rain !== undefined && w.rain !== ctx.rain) return false;
  if (w.hour !== undefined && ctx.minutes < w.hour) return false;
  if (w.place !== undefined && w.place !== ctx.place) return false;
  if (w.flag !== undefined && !ctx.flags[w.flag]) return false;
  if (w.at !== undefined && (!ctx.stop || w.at.some((v, i) => v !== ctx.stop[i]))) return false;
  return true;
}
