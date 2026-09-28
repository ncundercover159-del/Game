// What a tool swing does when it lands on a tile. `w` is the World (map, rng, fx, drops, game).
import { TILE } from '../config.js';
import { OBJECT_TYPES } from '../data/objects.js';
import { CROPS } from '../data/crops.js';
import { till, untill, water, cropAt, isRipe, harvest } from './farming.js';

export const GENKI_COST = 2;
export const CAN_CAPACITY = 40;

export function applyTool(w, tool, tx, ty) {
  const { map, game, fx } = w;
  const cx = tx * TILE + 8, cy = ty * TILE + 12;
  const b = map.buildingAt(tx, ty);

  // Refilling the can is free and happens before anything else.
  if (tool === 'can' && ((map.inside(tx, ty) && map.isWater(tx, ty)) || (b && b.water))) {
    game.can = CAN_CAPACITY;
    fx.burst('fx_drop', cx, cy, 8, { speed: 30, up: 70 });
    game.sfx('refill');
    game.toast('toast_refill', null, 'icon_can');
    return 'refill';
  }

  game.spendGenki(GENKI_COST);
  const o = map.objectAt(tx, ty);
  if (o) return hitObject(w, o, tool);

  switch (tool) {
    case 'hoe':
      if (till(map, tx, ty)) {
        fx.burst('fx_dirt', cx, cy, 6, { speed: 26, up: 50 });
        game.sfx('till');
        game.tutorial('till');
        return 'till';
      }
      break;
    case 'can':
      if (game.can <= 0) { game.sfx('deny'); game.aside('tk_can_empty'); return 'empty'; }
      game.can--;
      fx.burst('fx_drop', cx, cy - 4, 6, { speed: 18, up: 30 });
      game.sfx('water');
      if (water(map, tx, ty)) { game.tutorial('water'); return 'water'; }
      return 'splash';
    case 'pickaxe':
      if (untill(map, tx, ty)) { fx.burst('fx_dirt', cx, cy, 5); game.sfx('till'); return 'untill'; }
      break;
    case 'sickle': {
      const crop = cropAt(map, tx, ty);
      if (isRipe(crop)) return w.harvestAt(tx, ty) ? 'harvest' : 'full';
      break;
    }
    default: break;
  }
  game.sfx('swing');
  return 'miss';
}

function hitObject(w, o, tool) {
  const { map, game, fx, rng } = w;
  const def = OBJECT_TYPES[o.type];
  const cx = o.x * TILE + 8, cy = o.y * TILE + 10;
  if (def.static || !def.tools || !def.tools[tool]) {
    game.sfx('deny');
    o.shake = 0.2;
    if (def.hint && def.hint !== tool) game.aside(`tk_wrong_tool_${def.hint}`, { once: true });
    return 'deny';
  }
  o.hp -= def.tools[tool];
  o.shake = 0.25;
  fx.burst(def.fx, cx, cy - (o.type === 'tree' ? 10 : 0), 4, { speed: 30, up: 60 });
  game.sfx(def.sfx);
  if (o.hp > 0) return 'hit';

  // Destroyed: drops, then maybe leave something behind (a felled tree leaves its stump).
  const table = (def.drops && (def.drops[tool] || def.drops.any)) || [];
  for (const [id, min, max, chance = 1] of table) {
    if (rng.next() >= chance) continue;
    const n = rng.int(min, max);
    if (n > 0) w.drops.spawn(rng, id, n, 0, cx, cy);
  }
  fx.burst(def.fx, cx, cy, 10, { speed: 45, up: 80, life: 0.7 });
  map.removeObject(o);
  if (def.becomes) {
    map.addObject({ type: def.becomes, x: o.x, y: o.y, v: 0 });
    game.sfx('fall');
    game.shake(0.25);
  } else {
    game.sfx('break');
  }
  return 'destroy';
}

/** Planting from the selected seed slot. */
export function plantSeed(w, slot, tx, ty) {
  const { game } = w;
  const s = game.inventory.slots[slot];
  const crop = Object.keys(CROPS).find((k) => CROPS[k].seed === s.id);
  if (!crop || !w.plant(tx, ty, crop)) return false;
  game.inventory.takeFrom(slot, 1);
  w.fx.burst('fx_dirt', tx * TILE + 8, ty * TILE + 12, 3, { speed: 14, up: 30 });
  game.sfx('plant');
  game.tutorial('plant');
  return true;
}
