// Festivals on the game side: dressing the place on the day, playing the festival's scene when you
// arrive during its hours, and the reminders. Rules live in systems/festivals.js, the festivals
// themselves in data/festivals.js.
import { TILE } from './config.js';
import { MAPS } from './maps/index.js';
import { formatTime } from './systems/calendar.js';
import { festivalOn, festivalLive, festFlag } from './systems/festivals.js';

/**
 * Put up (or take down) the festival dressing on a world: decorations are added as map objects
 * tagged `festival`; wide fixtures block their tiles, lanterns light at night. Called on entering
 * a map, so a place is dressed on its day and back to normal after.
 */
export function dressWorld(g, w) {
  const f = festivalOn(g.cal);
  const want = f && f.map === w.map.id ? `${f.id}_${g.cal.year}` : null;
  const cur = w.festival;
  if ((cur?.key || null) === want) return;
  const m = w.map;
  if (cur) {
    for (const o of cur.objs) m.removeObject(o);
    for (const k of cur.blocked) { m.blocked[k] = 0; m.blockOwner.delete(k); }
    m.lights = m.lights.filter((l) => !cur.lights.includes(l));
    w.festival = null;
  }
  if (!want) return;
  const next = { key: want, objs: [], blocked: [], lights: [] };
  for (const d of f.decor) {
    const { tx, ty, block, light, ...rest } = d;
    const o = m.addObject({ ...rest, x: tx, y: ty, festival: true });
    if (!o) continue;
    next.objs.push(o);
    if (block) for (let y = ty - block[1] + 1; y <= ty; y++) for (let x = tx; x < tx + block[0]; x++) {
      const k = m.i(x, y);
      if (m.blocked[k]) continue;
      m.blocked[k] = 1;
      m.blockOwner.set(k, o);
      next.blocked.push(k);
    }
    if (light) {
      const l = { x: tx * TILE + 8 + light[0], y: ty * TILE + light[1], kind: 'lantern' };
      m.lights.push(l);
      next.lights.push(l);
    }
  }
  w.festival = next;
}

/** The festival's scene, if you are at its place during its hours and haven't seen it this year. */
export function festivalScene(g, mapId) {
  const f = festivalOn(g.cal);
  if (!f || f.map !== mapId || !festivalLive(f, g.cal.minutes)) return null;
  const flag = festFlag(f, g.cal.year);
  if (g.flags[flag]) return null;
  return { flag, script: f.script };
}

/** Tsukikage's morning note on a festival day. */
export function festivalMorning(g) {
  const f = festivalOn(g.cal);
  if (f) g.aside('tk_festival', { vars: { name: `${f.name} ${f.jp}`, place: MAPS[f.map].name, time: formatTime(f.from) } });
}
