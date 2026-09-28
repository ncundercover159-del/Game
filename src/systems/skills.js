// Skill levels, XP and perks over a plain state { [skill]: { xp, perks: [] } }; timed buffs from
// food over a plain list. Pure rules for tests; the game shows the toasts and perk choices.
import { SKILL_IDS, LEVEL_XP, MAX_LEVEL } from '../data/skills.js';
import { itemDef, sellPrice } from '../data/items.js';

export function newSkills() {
  return Object.fromEntries(SKILL_IDS.map((id) => [id, { xp: 0, perks: [] }]));
}

export function levelOf(xp) {
  let lv = 1;
  while (lv < MAX_LEVEL && xp >= LEVEL_XP[lv + 1]) lv++;
  return lv;
}

/** Add XP; returns the levels newly reached (e.g. [5]) so the caller can celebrate or offer perks. */
export function gainXp(skills, id, n) {
  const s = skills[id];
  const before = levelOf(s.xp);
  s.xp += n;
  const after = levelOf(s.xp);
  const out = [];
  for (let lv = before + 1; lv <= after; lv++) out.push(lv);
  return out;
}

/** Progress 0..1 toward the next level. */
export function progress(xp) {
  const lv = levelOf(xp);
  if (lv >= MAX_LEVEL) return 1;
  return (xp - LEVEL_XP[lv]) / (LEVEL_XP[lv + 1] - LEVEL_XP[lv]);
}

export const hasPerk = (skills, perk) => SKILL_IDS.some((id) => skills[id].perks.includes(perk));

const BARS = new Set(['iron_bar', 'steel_bar', 'tamahagane']);

/** Sell-price multiplier from perks for an item. */
export function priceMult(skills, id) {
  const kind = itemDef(id).kind, p = (perk) => hasPerk(skills, perk);
  if (kind === 'crop') return p('tiller') ? 1.1 : 1;
  if (kind === 'animal') return p('rancher') ? 1.2 : 1;
  if (kind === 'artisan') return p('artisan') ? 1.3 : 1;
  if (kind === 'fish') return p('angler') ? 1.5 : p('fisher') ? 1.25 : 1;
  if (BARS.has(id)) return p('smelter') ? 1.5 : 1;
  return 1;
}

/** What one of an item sells for, with quality and perks. */
export const sellValue = (skills, id, q = 0) => Math.floor(sellPrice(id, q) * priceMult(skills, id));

// ---------------------------------------------------------------- buffs

/** Absolute minute stamp for a calendar time (for buff expiry). */
export const stamp = (day, minutes) => day * 1440 + minutes;

/** Add or refresh a buff; the stronger/longer one wins for the same kind. */
export function addBuff(buffs, kind, amount, until) {
  const b = buffs.find((x) => x.kind === kind);
  if (b) { b.amount = Math.max(b.amount, amount); b.until = Math.max(b.until, until); } else buffs.push({ kind, amount, until });
}

export function expireBuffs(buffs, now) {
  for (let i = buffs.length - 1; i >= 0; i--) if (buffs[i].until <= now) buffs.splice(i, 1);
}

export const buffAmount = (buffs, kind) => buffs.find((b) => b.kind === kind)?.amount || 0;
