// Combat rules as pure functions: timings, damage, crits, parries, Ki and what a defeat costs.
// The world code (world/fighter.js, world/enemies.js) calls these and owns the moving parts.
import { WEAPONS, SICKLE } from '../data/weapons.js';
import { DIFFICULTY } from '../data/enemies.js';
import { itemDef } from '../data/items.js';
import { levelOf, hasPerk } from './skills.js';
import { virtueTier } from './virtues.js';

export const INOCHI_MAX = 100;
export const KI_MAX = 100;
export const KI_REGEN = 42;          // per second, after KI_DELAY without spending
export const KI_DELAY = 0.6;
export const DODGE = { ki: 18, time: 0.26, iframes: 0.24, speed: 185 };
export const PARRY = { ki: 8, window: 0.15, refund: 26, stagger: 1.1, counter: 1.0 };
export const HEAVY = { hold: 0.3, full: 0.6, mult: 2.2 };
export const COMBO = 3;
export const HURT_IFRAMES = 0.7;
// Light swing phases (s) before speed scaling: wind-up, active, recovery.
export const SWING = [0.07, 0.08, 0.15];

/** The weapon in hand, or null when the selected item is not one. */
export function weaponFor(itemId) {
  if (itemId === 'sickle') return SICKLE;
  return WEAPONS[itemId] || null;
}

export const kiMax = (virtues) => KI_MAX + virtueTier(virtues, 'yu') * 5;

/** Seconds the parry stays open (Guardian lengthens it). */
export const parryWindow = (skills) => PARRY.window + (hasPerk(skills, 'guardian') ? 0.06 : 0);

/** Crit chance: the weapon's, Kensei, and Meiyo. */
export function critChance(weapon, skills, virtues) {
  return weapon.crit + (hasPerk(skills, 'kensei') ? 0.06 : 0) + virtueTier(virtues, 'meiyo') * 0.01;
}

/**
 * Damage of one hit. `hit`: { combo (0-2), heavy, counter } ; `target`: { weak, guard, facingAway }.
 * Returns { dmg, crit, blocked }.
 */
export function hitDamage(weapon, hit, target, { skills, virtues, rng }) {
  const lv = levelOf(skills.sword.xp);
  let dmg = weapon.dmg * (1 + (lv - 1) * 0.05);
  if (hasPerk(skills, 'fighter')) dmg *= 1.15;
  if (hit.combo === COMBO - 1) dmg *= 1.5;
  if (hit.heavy) dmg *= HEAVY.mult;
  if (weapon.element && target.weak === weapon.element) dmg *= 1.5;
  const crit = hit.counter || rng.next() < critChance(weapon, skills, virtues);
  if (crit) dmg *= 2;
  // A guarding enemy turns aside light blows from the front; heavy strikes and counters break it.
  const blocked = !!target.guard && !hit.heavy && !hit.counter && !target.facingAway;
  if (blocked) dmg *= 0.2;
  return { dmg: Math.max(1, Math.round(dmg)), crit, blocked };
}

/** What an enemy's blow costs the player. */
export function damageTaken(base, difficulty, skills) {
  const d = DIFFICULTY[difficulty] || DIFFICULTY.standard;
  return Math.max(1, Math.round(base * d.dmg * (hasPerk(skills, 'mountain') ? 0.75 : 1)));
}

/** How much tougher foes are on a floor: +4% health and +2% damage per floor down to the foundry's
 * last, then half that on the Yomi Slope (it never ends, so it has to climb gently). */
export const depthMult = (floor) => {
  const upper = Math.min(floor - 1, 79), slope = Math.max(0, floor - 80);
  return { hp: 1 + upper * 0.04 + slope * 0.02, dmg: 1 + upper * 0.02 + slope * 0.01 };
};

/** Enemy health on this difficulty. */
export const enemyHp = (base, difficulty) => Math.round(base * (DIFFICULTY[difficulty] || DIFFICULTY.standard).hp);

/** Ki after `dt` seconds: regenerates once `idle` (seconds since spending) passes KI_DELAY. */
export function regenKi(ki, max, idle, dt) {
  return idle < KI_DELAY ? ki : Math.min(max, ki + KI_REGEN * dt);
}

/**
 * What a defeat costs: mon lost (a share of money, capped) and which pack slots go into the lost
 * bundle (never tools or weapons). Relaxed costs nothing.
 */
export function defeatCost(money, slots, difficulty, rng) {
  const d = DIFFICULTY[difficulty] || DIFFICULTY.standard;
  const mon = Math.min(Math.floor(money * d.loss), d.lossCap || 0);
  const candidates = slots.map((s, i) => [s, i]).filter(([s]) => s && !['tool', 'weapon', 'quest'].includes(itemDef(s.id).kind)).map(([, i]) => i);
  const lost = [];
  for (let n = 0; n < d.items && candidates.length; n++) lost.push(candidates.splice(Math.floor(rng.next() * candidates.length), 1)[0]);
  return { mon, slots: lost.sort((a, b) => a - b) };
}
