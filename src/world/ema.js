// The ema rack at the shrine: each look reads the next plaque along the pegs. Read eight in one
// day (an eight stood on its side is ∞) and you find the one hung apart from the rest, tied on
// with a red thread. The seventh plaque says there is something more to find.
import { TILE } from '../config.js';
import { dayIndex } from '../systems/calendar.js';

const PLAQUES = 7;   // ema_1 .. ema_7, then the one on the highest peg

export function readEma(w, o) {
  const g = w.game, day = dayIndex(g.cal);
  if (o.readDay !== day) { o.readDay = day; o.reads = 0; }
  o.reads++;
  if (o.reads <= PLAQUES) { g.say(`ema_${o.reads}`); return; }
  o.reads = 0;
  g.sfx('bell');
  // Hearts rising slowly off the rack, no gravity to bring them down.
  for (let i = 0; i < 6; i++) {
    w.fx.spawn('emote_heart', o.x * TILE + 2 + i * 2.5, o.y * TILE + 4, { vx: (i - 2.5) * 4, vz: 14 + (i % 3) * 5, life: 1.8, g: 0 });
  }
  g.say('ema_love');
}
