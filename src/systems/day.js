// End of day: overnight growth, Genki restoration, pass-out penalty, calendar rollover.
import { growNight, rainWater, typhoonDamage } from './farming.js';
import { nextDay, dayIndex, MIDNIGHT, SEASONS } from './calendar.js';
import { weatherFor, WEATHER } from './weather.js';
import { sellValue, hasPerk } from './skills.js';

export const PASS_OUT = { frac: 0.1, cap: 1000 };

/** Genki after sleeping: full before midnight, up to 25% less by 02:00, half if you passed out. */
export function sleepRestore(max, minutes, passedOut) {
  if (passedOut) return Math.floor(max * 0.5);
  if (minutes <= MIDNIGHT) return max;
  const late = Math.min(1, (minutes - MIDNIGHT) / 120);
  return Math.floor(max * (1 - 0.25 * late));
}

export function passOutLoss(money) {
  return Math.min(PASS_OUT.cap, Math.floor(money * PASS_OUT.frac));
}

/** Value of the shipping crate's contents: [{ id, n, q, value }] and the total. */
export function shippingValue(shipped, skills) {
  const lines = shipped.map((s) => ({ ...s, value: sellValue(skills, s.id, s.q) * s.n }));
  return { lines, total: lines.reduce((a, l) => a + l.value, 0) };
}

/**
 * The night between two days. Mutates the game's day state and returns a summary for the
 * end-of-day screen: shipping, growth, typhoon losses, tomorrow's forecast.
 */
export function endDay(game, passedOut) {
  // Anything left lying on the ground is gathered up overnight.
  for (const w of game.worlds.values()) for (const d of w.drops.drain()) game.inventory.add(d.id, d.n, d.q);
  const map = game.worldFor('farm').map;

  const ship = shippingValue(game.shipped, game.skills);
  game.money += ship.total;
  game.stats.shippedValue += ship.total;
  game.shipped = [];

  const typhoonLost = game.weather === 'typhoon' ? typhoonDamage(map, game.rng) : 0;
  const prev = game.cal;
  const { t, newSeason, newYear } = nextDay(prev);
  // Agriculturist: a watered crop sometimes grows two days in a night.
  const extra = hasPerk(game.skills, 'agriculturist') ? () => game.rng.next() < 0.1 : null;
  const { grew, withered } = growNight(map, SEASONS[t.season].id, extra);

  const lost = passedOut ? passOutLoss(game.money) : 0;
  game.money -= lost;
  game.genki = sleepRestore(game.genkiMax, prev.minutes, passedOut);
  game.cal = t;
  game.weather = game.tomorrow;
  game.tomorrow = weatherFor(game.seed, nextDay(t).t);
  if (WEATHER[game.weather].rain) rainWater(map);

  let upgraded = null;
  if (game.upgrade && dayIndex(t) >= game.upgrade.ready) upgraded = game.upgrade.tool;

  return { ship, grew, withered, typhoonLost, lost, prev, newSeason, newYear, upgraded };
}
