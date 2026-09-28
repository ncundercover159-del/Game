// What a tool swing does when it lands. `w` is the World (map, rng, fx, drops, game).
// Tools have tiers (0 Basic, 1 Iron, 2 Steel, 3 Tamahagane): heavier hits, bigger cans, and a
// charged swing for the hoe and can that covers more tiles.
import { TILE } from '../config.js';
import { OBJECT_TYPES } from '../data/objects.js';
import { itemDef } from '../data/items.js';
import { TIERS } from '../data/tools.js';
import { till, untill, water, cropAt, isRipe, clearDead, digChannel, coverSoil, plantProblem } from './farming.js';
import { SOIL, computeFlow } from './irrigation.js';
import { hasPerk } from './skills.js';
import { dig } from '../world/interact.js';

export const GENKI_COST = 2;
export const canCapacity = (tier) => TIERS[tier].can;

/** Tiles covered by a swing charged to `level`, starting at the target and extending away. */
export function swingArea(px, py, tx, ty, level) {
  const dx = Math.sign(tx - px), dy = Math.sign(ty - py);
  if (level <= 0 || (dx && dy)) return [[tx, ty]];
  if (level < 3) return Array.from({ length: level * 2 + 1 }, (_, i) => [tx + dx * i, ty + dy * i]);
  const out = [];
  for (let a = 0; a < 3; a++) for (let b = -1; b <= 1; b++) out.push(dx ? [tx + dx * a, ty + b] : [tx + b, ty + dy * a]);
  return out;
}

export function applyTool(w, tool, tiles, level = 0) {
  const { map, game } = w;
  const [tx, ty] = tiles[0];
  const b = map.buildingAt(tx, ty);

  // Refilling the can is free and happens before anything else.
  if (tool === 'can' && ((map.inside(tx, ty) && map.isWater(tx, ty)) || (b && b.water) || map.flow[map.i(tx, ty)])) {
    game.can = canCapacity(game.tiers.can);
    w.fx.burst('fx_drop', tx * TILE + 8, ty * TILE + 12, 8, { speed: 30, up: 70 });
    game.sfx('refill');
    game.toast('toast_refill', null, 'icon_can');
    return 'refill';
  }

  // Quarryman: breaking rock with the pickaxe costs nothing.
  const rock = tool === 'pickaxe' && ['stone', 'boulder', 'ore'].includes(map.objectAt(tx, ty)?.type) && hasPerk(game.skills, 'quarryman');
  if (!rock) game.spendGenki(GENKI_COST * (level + 1));
  let result = 'miss';
  for (const [x, y] of tiles) {
    const r = applyOne(w, tool, x, y);
    if (r !== 'miss' && result === 'miss') result = r;
    if (r === 'empty') break;
  }
  if (result === 'miss') game.sfx('swing');
  return result;
}

function applyOne(w, tool, tx, ty) {
  const { map, game, fx } = w;
  const cx = tx * TILE + 8, cy = ty * TILE + 12;
  const o = map.objectAt(tx, ty);
  if (o && o.type === 'dig' && tool === 'hoe') { dig(w, o); return 'dig'; }
  if (o && o.type === 'forage') return 'miss';
  if (o && o.type === 'machine' && (tool === 'axe' || tool === 'pickaxe')) return pickUpMachine(w, o);
  if (o && o.type === 'urn') { w.combat.breakUrn(o); return 'destroy'; }
  if (o) return hitObject(w, o, tool);
  // Village soil is somebody else's: tools only work the farm's.
  if (!map.def.farmable) return 'miss';
  if (clearDead(map, tx, ty)) { fx.burst('fx_hay', cx, cy, 5); game.sfx('cut'); return 'clear'; }
  const k = map.inside(tx, ty) ? map.i(tx, ty) : -1;

  switch (tool) {
    case 'hoe':
      if (till(map, tx, ty)) {
        fx.burst('fx_dirt', cx, cy, 6, { speed: 26, up: 50 });
        game.sfx('till');
        game.tutorial('till');
        return 'till';
      }
      if (k >= 0 && map.soil[k] === SOIL.TILLED && digChannel(map, tx, ty)) {
        fx.burst('fx_dirt', cx, cy, 8, { speed: 30, up: 60 });
        game.sfx('till');
        game.tutorial('channel');
        return 'channel';
      }
      break;
    case 'can':
      if (game.can <= 0) { game.sfx('deny'); game.aside('tk_can_empty'); return 'empty'; }
      if (k < 0 || map.soil[k] !== SOIL.TILLED) break;
      game.can--;
      fx.burst('fx_drop', cx, cy - 4, 6, { speed: 18, up: 30 });
      game.sfx('water');
      water(map, tx, ty);
      game.tutorial('water');
      return 'water';
    case 'pickaxe':
      if (untill(map, tx, ty)) { fx.burst('fx_dirt', cx, cy, 5); game.sfx('till'); return 'untill'; }
      break;
    case 'sickle':
      if (isRipe(cropAt(map, tx, ty))) return w.harvestAt(tx, ty) ? 'harvest' : 'full';
      break;
    default: break;
  }
  return 'miss';
}

function hitObject(w, o, tool) {
  const { map, game, fx, rng } = w;
  const def = OBJECT_TYPES[o.type];
  const cx = o.x * TILE + 8, cy = o.y * TILE + 10;
  const tier = game.tiers[tool] || 0;
  // Ore veins look their numbers up by kind.
  const kd = def.byKind ? def.byKind[o.kind] : null;
  const minTier = kd ? kd.tier : def.minTier;
  if (def.static || !def.tools || !def.tools[tool]) {
    game.sfx('deny');
    o.shake = 0.2;
    if (def.hint && def.hint !== tool) game.aside(`tk_wrong_tool_${def.hint}`, { once: true });
    return 'deny';
  }
  if (minTier && tier < minTier) {
    game.sfx('deny');
    o.shake = 0.25;
    game.aside('tk_need_upgrade', { once: `upgrade_${o.type}` });
    return 'deny';
  }
  o.hp -= def.tools[tool] * (1 + tier);
  o.shake = 0.25;
  fx.burst(def.fx, cx, cy - (o.type === 'tree' ? 10 : 0), 4, { speed: 30, up: 60 });
  game.sfx(def.sfx);
  if (o.hp > 0) return 'hit';

  // Destroyed: drops, then maybe leave something behind (a felled tree leaves its stump).
  const table = kd ? kd.drops : (def.drops && (def.drops[tool] || def.drops.any)) || [];
  const perk = (id) => hasPerk(game.skills, id);
  for (const [id, min, max, chance = 1] of table) {
    if (rng.next() >= chance) continue;
    let n = rng.int(min, max);
    if (id === 'wood' && perk('woodsman')) n = Math.ceil(n * 1.25);
    if (id === 'stone' && perk('miner')) n++;
    if (n > 0) w.drops.spawn(rng, id, n, 0, cx, cy);
  }
  if (o.type === 'boulder' && perk('prospector') && rng.next() < 0.25) w.drops.spawn(rng, 'iron_bar', 1, 0, cx, cy);
  if (kd) game.xp('mining', kd.xp);
  else if (def.xp) game.xp(def.xp[0], def.xp[1]);
  fx.burst(def.fx, cx, cy, 10, { speed: 45, up: 80, life: 0.7 });
  map.removeObject(o);
  if (o.type === 'sluice') computeFlow(map);
  if (def.becomes) {
    map.addObject({ type: def.becomes, x: o.x, y: o.y, v: 0 });
    game.sfx('fall');
    game.shake(0.25);
  } else {
    game.sfx('break');
  }
  return 'destroy';
}

/** Machines (and a kodama's hokora) stand on any open, dry, unplanted tile of your own maps (farm,
 * farmhouse, coop). */
function placeMachine(w, slot, tx, ty) {
  const { game, map } = w;
  const k = map.inside(tx, ty) ? map.i(tx, ty) : -1;
  if (!map.def.persist || k < 0 || map.solid(tx, ty) || map.objectAt(tx, ty) || map.isWater(tx, ty) || map.crops.has(k) || map.soil[k]) {
    game.sfx('deny');
    game.aside(map.def.persist ? 'tk_machine_where' : 'tk_machine_farm', { once: true });
    return false;
  }
  const id = game.inventory.slots[slot].id;
  map.addObject(id === 'hokora' ? { type: 'hokora', x: tx, y: ty, v: 0 } : { type: 'machine', x: tx, y: ty, v: 0, kind: id });
  game.inventory.takeFrom(slot, 1);
  if (id === 'hokora') game.aside('tk_hokora', { once: true });
  game.sfx('rock');
  return true;
}

/** Work compost into tilled soil: finer crops from it from now on. */
export function fertilise(w, slot, tx, ty) {
  const { game, map } = w;
  const k = map.inside(tx, ty) ? map.i(tx, ty) : -1;
  if (k < 0 || map.soil[k] !== SOIL.TILLED || map.fert[k]) { game.sfx('deny'); game.aside('tk_compost_where', { once: true }); return false; }
  map.fert[k] = 1;
  map.touch(tx, ty);
  game.inventory.takeFrom(slot, 1);
  w.fx.burst('fx_dirt', tx * TILE + 8, ty * TILE + 12, 5, { speed: 16, up: 24 });
  game.sfx('plant');
  return true;
}

function placeTrap(w, slot, tx, ty) {
  const { game, map } = w;
  const bank = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => map.inside(tx + dx, ty + dy) && !map.isWater(tx + dx, ty + dy));
  if (!map.def.persist || !map.inside(tx, ty) || !map.isWater(tx, ty) || !bank || map.objectAt(tx, ty)) {
    game.sfx('deny');
    game.aside(map.def.persist ? 'tk_trap_where' : 'tk_trap_farm', { once: true });
    return false;
  }
  map.addObject({ type: 'trap', x: tx, y: ty, v: 0 });
  game.inventory.takeFrom(slot, 1);
  w.fx.burst('fx_drop', tx * TILE + 8, ty * TILE + 10, 6, { speed: 20, up: 30 });
  game.sfx('water');
  return true;
}

/** An empty machine comes back into the pack when struck with the axe or pickaxe. */
function pickUpMachine(w, o) {
  const { game, map } = w;
  if (o.input) { game.sfx('deny'); o.shake = 0.2; game.aside('tk_machine_busy', { once: true }); return 'deny'; }
  map.removeObject(o);
  w.drops.spawn(w.rng, o.kind, 1, 0, o.x * TILE + 8, o.y * TILE + 10);
  game.sfx('chop');
  return 'destroy';
}

/** Planting from the selected seed slot. Returns false (with a hint) when it can't go there. */
export function plantSeed(w, slot, tx, ty) {
  const { game, map } = w;
  const s = game.inventory.slots[slot];
  const crop = s.id.slice(5);
  const problem = plantProblem(map, tx, ty, crop, game.seasonId);
  if (problem) {
    if (problem !== 'no_soil') { game.sfx('deny'); game.aside(`tk_${problem}`); }
    return false;
  }
  w.plant(tx, ty, crop);
  game.inventory.takeFrom(slot, 1);
  w.fx.burst('fx_dirt', tx * TILE + 8, ty * TILE + 12, 3, { speed: 14, up: 30 });
  game.sfx('plant');
  game.tutorial('plant');
  return true;
}

/** Hay spread on tilled soil makes a straw-covered plot (winter crops, typhoon protection). */
export function spreadStraw(w, slot, tx, ty) {
  const { game, map } = w;
  if (!coverSoil(map, tx, ty)) return false;
  game.inventory.takeFrom(slot, 1);
  w.fx.burst('fx_hay', tx * TILE + 8, ty * TILE + 12, 6, { speed: 20, up: 40 });
  game.sfx('plant');
  return true;
}

/** Place a placeable item: a sluice gate on a channel, a fish trap in the water by a bank. */
export function placeItem(w, slot, tx, ty) {
  const { game, map } = w;
  const s = game.inventory.slots[slot];
  if (s.id === 'uke') return placeTrap(w, slot, tx, ty);
  if (itemDef(s.id).kind === 'machine' || s.id === 'hokora') return placeMachine(w, slot, tx, ty);
  if (s.id !== 'sluice') return false;
  if (!map.inside(tx, ty) || map.soil[map.i(tx, ty)] !== SOIL.CHANNEL || map.objectAt(tx, ty)) {
    game.sfx('deny');
    game.aside('tk_sluice_where', { once: true });
    return false;
  }
  map.addObject({ type: 'sluice', x: tx, y: ty, v: 0, open: true });
  game.inventory.takeFrom(slot, 1);
  computeFlow(map);
  game.sfx('chop');
  return true;
}
