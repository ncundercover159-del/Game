// Kodama in the world: the one waiting on the shrine stair at dusk (placed each morning with the
// forage), befriending it with a gift, the kodama at home beside their hokora on the farm, and how
// both are drawn. Rules live in systems/kodama.js.
import { TILE } from '../config.js';
import { KODAMA, KODAMA_LINES } from '../data/kodama.js';
import { itemDef } from '../data/items.js';
import { dayIndex } from '../systems/calendar.js';
import { friends, waiting, out, spotFor, accepts, homes } from '../systems/kodama.js';
import { Dialog } from '../ui/dialog.js';

/** Each morning: today's kodama on the shrine stair, if one is still to be befriended. */
export function placeKodama(w) {
  const g = w.game, map = w.map, day = dayIndex(g.cal);
  for (const o of map.objects.filter((x) => x.type === 'kodama')) map.removeObject(o);
  if (map.id !== 'shrine' || !waiting(g.flags) || g.flags.kodama_day === day) return null;
  const [x, y] = spotFor(g.seed, day);
  const there = map.objectAt(x, y);
  if (there && there.type !== 'forage' && there.type !== 'dig') return null;
  if (there) map.removeObject(there);
  return map.addObject({ type: 'kodama', x, y, v: 0 });
}

/** Offer the kodama what you hold: something from the forest, or rice, and it comes home with you. */
export function meetKodama(w, o) {
  const g = w.game;
  if (!out(g.cal.minutes)) return;
  const slot = g.inventory.selected, s = g.inventory.slots[slot];
  o.rattle = 0.6;
  g.sfx('rattle');
  if (!s || !accepts(s.id)) { g.say('kodama_shy'); return; }
  const item = itemDef(s.id).name;
  g.inventory.takeFrom(slot, 1);
  g.flags.kodama_friends = friends(g.flags) + 1;
  g.flags.kodama_day = dayIndex(g.cal);
  w.map.removeObject(o);
  w.fx.burst('fx_leaf', o.x * TILE + 8, o.y * TILE + 8, 8, { speed: 30, up: 50 });
  g.addVirtue('jin', 2);
  const n = friends(g.flags), housed = homes(g.worldFor('farm').map, KODAMA.max).length;
  g.say(housed >= n ? 'kodama_follows' : 'kodama_homeless', { item, n, max: KODAMA.max });
}

/** The hokora on this map that have a kodama living in them (memoised until the objects change). */
export function homeSet(w) {
  const n = friends(w.game.flags), key = `${w.map.objects.length}:${n}`;
  if (w.kodamaKey !== key) { w.kodamaKey = key; w.kodamaHomes = new Set(homes(w.map, n)); }
  return w.kodamaHomes;
}

export function visitHokora(w, o) {
  const g = w.game;
  if (!homeSet(w).has(o)) { g.say('hokora_empty'); return; }
  o.rattle = 0.6;
  g.sfx('rattle');
  const line = KODAMA_LINES[(dayIndex(g.cal) + o.x + o.y) % KODAMA_LINES.length];
  g.modals.push(new Dialog(g, { text: line }));
}

/** Draw a kodama or a hokora (and its kodama). The stair kodama is only there in its hours. */
export function drawKodamaObject(w, ctx, o, bx, by) {
  const g = w.game;
  if (o.type === 'kodama') { if (out(g.cal.minutes)) spirit(w, ctx, o, bx, by); return; }
  g.atlas.draw(ctx, 'hokora', bx, by);
  if (homeSet(w).has(o)) spirit(w, ctx, o, bx + 14, by + 1);
}

/** Kodama glow faintly after dark: a small pale light for each one out (world px). */
export function kodamaLights(w) {
  const map = w.map;
  if (map.id === 'shrine') {
    const k = out(w.game.cal.minutes) && map.objects.find((o) => o.type === 'kodama');
    return k ? [{ x: k.x * TILE + 8, y: k.y * TILE + 8, kind: 'spirit' }] : [];
  }
  if (!map.def.persist || !friends(w.game.flags)) return [];
  return [...homeSet(w)].map((o) => ({ x: o.x * TILE + 22, y: o.y * TILE + 8, kind: 'spirit' }));
}

function spirit(w, ctx, o, x, y) {
  const atlas = w.game.atlas, t = w.time + o.x * 0.7 + o.y * 0.3;
  // Now and then, unprompted, it rattles its head.
  const rattle = o.rattle > 0 || Math.sin(t * 0.8) > 0.985;
  atlas.draw(ctx, rattle ? 'kodama_rattle' : `kodama_${Math.floor(t * 1.6) % 2}`, x, y, rattle && Math.floor(t * 16) % 2 === 0);
}
