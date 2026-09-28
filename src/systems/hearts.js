// Heart events: which villager's next scene plays when you walk onto a map. Scenes go in order at
// 2, 4, 6, 8 and 10 hearts; a romanceable villager's tenth needs you to be courting them, and a
// villager who is out of the valley today has no scene.
import { NPCS, routeFor, stopAt } from '../data/npcs.js';
import { hearts } from './bonds.js';
import H1 from '../data/hearts/hearts1.js';
import H2 from '../data/hearts/hearts2.js';
import H3 from '../data/hearts/hearts3.js';

export const HEART_EVENTS = { ...H1, ...H2, ...H3 };

export const heartFlag = (npc, h) => `heart_${npc}_${h}`;

/** The heart scene that should play now on `mapId`, as { npc, event, flag }, or null. */
export function heartEventFor(g, mapId) {
  const m = g.cal.minutes;
  const ctx = { season: g.seasonId, weekday: g.dayIndex % 7, rain: !!g.rain, flags: g.flags };
  for (const [npc, events] of Object.entries(HEART_EVENTS)) {
    const b = g.bonds[npc];
    if (!b?.met) continue;
    const e = events.find((x) => !g.flags[heartFlag(npc, x.h)]);
    if (!e || e.map !== mapId || hearts(b.pts) < e.h || m < e.from || m >= e.to) continue;
    if (e.h === 10 && NPCS[npc].romance && !b.courting) continue;
    if (e.when && !e.when(g)) continue;
    if (stopAt(routeFor(npc, ctx), m)[1] === 'away') continue;
    return { npc, event: e, flag: heartFlag(npc, e.h) };
  }
  return null;
}
