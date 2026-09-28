// Turning the live game into a save document and back to disk. A floor of the caves is never saved:
// saving down there records the mine mouth instead (floors regenerate on every visit).
import { makeDoc, writeSlot } from './core/save.js';

export function snapshot(g, fields) {
  const out = Object.fromEntries(fields.map((k) => [k, structuredClone(g[k])]));
  const inCave = g.world.map.id === 'cave';
  const player = inCave ? { x: 14 * 16 + 8, y: 6 * 16 + 14, dir: 'down', map: 'kurayama' } : { ...g.player.serialize(), map: g.world.map.id };
  return {
    ...out, name: g.state.name, farm: g.state.farm, look: g.state.look, layout: g.state.layout,
    inventory: g.inventory.serialize(), rng: g.rng.state(),
    player, maps: mapsSnapshot(g),
  };
}

/** Saved state of every map that keeps any (farm, coop), visited this session or not. */
function mapsSnapshot(g) {
  const out = { ...g.savedMaps };
  for (const [id, w] of g.worlds) if (w.map.def.persist) out[id] = w.map.serialize();
  return out;
}

export function docOf(g, fields) {
  const c = g.cal;
  return makeDoc(snapshot(g, fields), { name: g.state.name, farm: g.state.farm, day: c.day, season: c.season, year: c.year, money: g.money });
}

export function saveNow(g, fields, quiet = false) {
  const ok = writeSlot(g.slot, docOf(g, fields));
  if (!quiet) g.toast(ok ? 'toast_saved' : 'menu_corrupt', { n: g.slot });
  return ok;
}
