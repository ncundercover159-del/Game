// End of day: overnight growth, Genki restoration, pass-out penalty, calendar rollover.
import { growNight } from './farming.js';
import { nextDay, MIDNIGHT } from './calendar.js';

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

/** Mutates the game's day state. Returns a summary for the end-of-day card. */
export function endDay(game, passedOut) {
  const w = game.world;
  for (const d of w.drops.drain()) game.inventory.add(d.id, d.n, d.q);
  const grew = growNight(w.map);
  const lost = passedOut ? passOutLoss(game.money) : 0;
  game.money -= lost;
  game.genki = sleepRestore(game.genkiMax, game.cal.minutes, passedOut);
  const prev = game.cal;
  const { t, newSeason, newYear } = nextDay(prev);
  game.cal = t;
  w.placeAtHome();
  return { grew, lost, prev, newSeason, newYear };
}
