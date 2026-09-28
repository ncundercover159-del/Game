// Courting and marriage, as pure rules over the game's bonds and `romance` state
// ({ engaged: { npc, day } | null, spouse: npc | null }). The Red Thread starts courting at eight
// hearts; the Shrine Vow, at ten hearts and with the farmhouse extended, sets a wedding three days
// out. After the wedding the spouse lives at the farm and keeps their day's work in the valley.
import { NPCS, stopAt } from '../data/npcs.js';
import { hearts } from './bonds.js';

export const WEDDING_DELAY = 3;
export const COURT_HEARTS = 8;
export const VOW_HEARTS = 10;

export function newRomance() {
  return { engaged: null, spouse: null };
}

/** Whom you are courting (or married to), if anyone. */
export function partner(bonds) {
  return Object.keys(bonds).find((id) => bonds[id].courting) || null;
}

/**
 * What happens when `item` (red_thread or shrine_vow) is handed to `npc`: { ok: true } or
 * { ok: false, why } with why a key of NOT_YET, or { ok: false, why: null } to just talk instead.
 */
export function romanceCheck(g, npc, item) {
  const b = g.bonds[npc];
  const romanceable = !!NPCS[npc].romance;
  const other = partner(g.bonds);
  if (item === 'red_thread') {
    if (!romanceable) return { ok: false, why: 'other' };
    if (other === npc) return { ok: false, why: null };
    if (other) return { ok: false, why: 'taken' };
    if (hearts(b.pts) < COURT_HEARTS) return { ok: false, why: 'court' };
    return { ok: true };
  }
  if (!romanceable || other !== npc) return { ok: false, why: 'other' };
  if (g.romance.engaged || g.romance.spouse) return { ok: false, why: null };
  if (hearts(b.pts) < VOW_HEARTS) return { ok: false, why: 'vowHearts' };
  if (!g.flags.house_upgraded) return { ok: false, why: 'vowHouse' };
  return { ok: true };
}

/** Start courting: the eight-heart ceiling lifts. */
export function court(b) {
  b.courting = true;
  delete b.cap;
}

export function engage(romance, npc, today) {
  romance.engaged = { npc, day: today + WEDDING_DELAY };
}

/** Is the wedding today (or overdue)? */
export const weddingDue = (romance, today) => !!romance.engaged && today >= romance.engaged.day;

export function marry(romance) {
  romance.spouse = romance.engaged.npc;
  romance.engaged = null;
}

// Where the spouse spends the day: nights and breakfast at the farmhouse, a look over the fields,
// then from nine to nine whatever their own schedule gives them (shops stay open; never out of
// the valley). With nothing to do in the valley they stay on the farm.
export const HOME = {
  night: ['house_farm', 13, 4, 'down'],
  kitchen: ['house_farm', 12, 7, 'left'],
  porch: ['farm', 31, 11, 'down'],
};
const WORK = [540, 1260];

export function spouseRoute(route) {
  const work = [stopAt(route, WORK[0]), ...route.filter((s) => s[0] > WORK[0] && s[0] < WORK[1])]
    .filter((s) => s[1] !== 'away' && s[1] !== 'house_farm')
    .map((s) => [Math.max(WORK[0], s[0]), ...s.slice(1)]);
  return [
    [0, ...HOME.night],
    [420, ...HOME.kitchen],
    [480, ...HOME.porch],
    ...(work.length ? work : [[WORK[0], ...HOME.porch]]),
    [WORK[1], ...HOME.kitchen],
    [1380, ...HOME.night],
  ];
}

/** The wedding at the shrine: an officiant (Tomoe, or Heibei if you marry her) and a few guests. */
export function weddingScript(npc) {
  const off = npc === 'tomoe' ? 'heibei' : 'tomoe';
  const guests = ['okiku', 'genzo', 'yuzu', 'kinta', 'daigo'].filter((id) => id !== npc).slice(0, 4);
  const spots = [[16, 15], [17, 15], [21, 15], [22, 15]];
  return `
fade out 0
placePlayer 18 13 up
placeNpc ${npc} 20 13 up
placeNpc ${off} 19 11 down
${guests.map((id, i) => `placeNpc ${id} ${spots[i][0]} ${spots[i][1]} up`).join('\n')}
cameraPan 19 12 0
fade in 1.5
say "The whole valley has climbed the shrine steps at first light."
say ${off} happy "Before the kami of this hill, and before your neighbours: two lives are tied with one thread."
sfx bell
emote ${npc} heart
say ${npc} happy "{name}. I am here. I am staying."
say ${off} happy "Drink, three sips each. Then it is done, and it cannot be undone. Not that anyone wants it undone."
emote ${guests[0]} heart
say ${guests[0]} happy "Ahh, I promised myself I would not cry. Somebody pass me a sleeve."
sfx bell
say "The bell rings out over the valley. You walk home together."
`;
}
