// What pressing Interact does, by what is in front of you: villagers, animals, forage, machines,
// shop counters, boards, altars, beds, crops, signs, and the cave's ladders, ropes, lanterns and
// chests. Split out of world.js.
import { TILE } from '../config.js';
import { OBJECT_TYPES } from '../data/objects.js';
import { itemDef } from '../data/items.js';
import { MACHINES } from '../data/recipes.js';
import { XP } from '../data/skills.js';
import { cropAt, isRipe, canPlant, rollQuality } from '../systems/farming.js';
import { plantSeed } from '../systems/tools.js';
import { computeFlow } from '../systems/irrigation.js';
import { digFind } from '../systems/forage.js';
import { hasPerk } from '../systems/skills.js';
import { accepts, load, isReady, collect } from '../systems/craft.js';
import { dayIndex } from '../systems/calendar.js';
import { openNotice, openMailbox, openAltar, openCooking, openArchive } from '../flow.js';
import { descend, climbOut, lightLantern, openChest, takeBundle } from '../caves.js';
import { meetKodama, visitHokora } from './kodama.js';
import { startKata, startKyudo } from '../dojo.js';

// Object types that answer Interact directly.
const BY_TYPE = {
  forage: pickForage,
  produce: (w, o) => {
    const g = w.game;
    if (g.pickUp(o.kind, 1, o.q || 0) === 0) { w.map.removeObject(o); g.xp('farming', XP.animal); }
  },
  hopper: fillHopper,
  machine: useMachine,
  sluice: (w, o) => { o.open = !o.open; computeFlow(w.map); w.game.sfx(o.open ? 'refill' : 'chop'); },
  crate: (w) => w.game.openShipping(),
  jizo: (w) => w.game.bow(),
  trap: (w, o) => {
    const g = w.game;
    if (!o.catch) { g.say('trap_empty'); return; }
    if (g.pickUp(o.catch, 1) === 0) { o.catch = null; g.xp('fishing', XP.trap); }
  },
  notice: (w) => openNotice(w.game),
  mailbox: (w) => openMailbox(w.game),
  altar: (w, o) => openAltar(w.game, o.kind),
  irori: (w) => (w.map.id === 'house_farm' ? openCooking(w.game) : w.game.say('irori')),
  ladder: (w) => descend(w.game),
  rope: (w) => climbOut(w.game),
  cave_lantern: (w, o) => lightLantern(w.game, w, o),
  chest: (w, o) => openChest(w.game, w, o),
  bundle: (w, o) => takeBundle(w.game, w, o),
  brazier: (w) => w.game.say('brazier'),
  kodama: meetKodama,
  hokora: visitHokora,
  makiwara: (w) => startKata(w.game),
  mato: (w) => startKyudo(w.game),
};

export function interact(w) {
  const g = w.game, map = w.map;
  const { x, y } = w.target;
  const npc = g.villagers.at(map.id, x, y);
  if (npc) { g.talkTo(npc); return; }
  const beast = w.flock?.at(x, y);
  if (beast) { w.flock.pet(beast); return; }
  const o = map.objectAt(x, y);
  if (o && BY_TYPE[o.type]) { BY_TYPE[o.type](w, o); return; }
  if (isRipe(cropAt(map, x, y))) { w.harvestAt(x, y); return; }
  const cur = g.inventory.current;
  if (cur && itemDef(cur.id).kind === 'seed' && canPlant(map, x, y, cur.id.slice(5))) { plantSeed(w, g.inventory.selected, x, y); return; }
  if (o && o.action === 'sleep') { g.askSleep(); return; }
  if (o && o.action === 'archive') { openArchive(g); return; }
  if (o && o.shop) {
    // With the keeper behind the counter you can shop or chat; otherwise it's just the shop.
    const keeper = [0, -1, 1].map((dx) => g.villagers.at(map.id, x + dx, y - 1)).find(Boolean);
    if (keeper) g.counter(o.shop, keeper); else g.openShop(o.shop);
    return;
  }
  const b = map.buildingAt(x, y);
  if (b) {
    if (b.door?.say && b.door.tx === x && b.door.ty === y && !(b.door.ifFlag && g.flags[b.door.ifFlag])) g.say(b.door.say);
    else g.say(b.id === 'kura' ? 'kura' : b.id === 'well' ? 'well' : null);
    return;
  }
  if (o) {
    // Some signs read differently once a flag is set: textIf: [flag, key].
    const key = (o.textIf && g.flags[o.textIf[0]] ? o.textIf[1] : o.text) || OBJECT_TYPES[o.type].say;
    if (key) g.say(key);
  }
}

/** Pick up forage by hand: quality from Foraging, a second one sometimes (Gatherer). */
function pickForage(w, o) {
  const g = w.game;
  if (g.inventory.room(o.kind) <= 0) { g.aside('tk_full'); return; }
  let q = rollQuality(w.rng, g.qualityBonus('foraging'));
  if (hasPerk(g.skills, 'botanist')) q = Math.max(1, q);
  const n = hasPerk(g.skills, 'gatherer') && w.rng.next() < 0.2 ? 2 : 1;
  w.map.removeObject(o);
  g.foraged.keys.push(`${w.map.id}:${o.x},${o.y}`);
  g.pickUp(o.kind, n, q);
  g.xp('foraging', XP.forage);
  w.fx.burst('fx_leaf', o.x * TILE + 8, o.y * TILE + 10, 5);
  g.sfx('harvest');
}

/** The hoe turns over a dig spot: an artefact, or a winter root. */
export function dig(w, o) {
  const g = w.game;
  w.map.removeObject(o);
  g.foraged.keys.push(`${w.map.id}:${o.x},${o.y}`);
  const id = digFind(w.rng, g.seasonId);
  w.drops.spawn(w.rng, id, 1, 0, o.x * TILE + 8, o.y * TILE + 10);
  w.fx.burst('fx_dirt', o.x * TILE + 8, o.y * TILE + 12, 8, { speed: 30, up: 60 });
  g.xp('foraging', XP.dig);
  g.sfx('till');
}

/** Hay goes into the hopper (all of it); otherwise say how much is left. */
function fillHopper(w) {
  const g = w.game, n = g.inventory.count('hay');
  if (g.inventory.current?.id === 'hay' && n > 0) {
    g.inventory.remove('hay', n);
    g.animals.hay += n;
    g.sfx('plant');
    g.toast('hopper_filled', { n: g.animals.hay }, 'icon_hay');
    return;
  }
  g.say('hopper', { n: g.animals.hay, animals: g.animals.list.length });
}

/** An artisan machine: collect when ready, load with what you hold, or say what it wants. */
function useMachine(w, o) {
  const g = w.game, m = MACHINES[o.kind], day = dayIndex(g.cal);
  if (isReady(o, day)) {
    if (g.inventory.room(m.out) < (m.outN || 1)) { g.aside('tk_full'); return; }
    const out = collect(o, hasPerk(g.skills, 'master'));
    g.pickUp(out.id, out.n, out.q);
    g.xp('craft', XP.machine);
    w.fx.burst('fx_sparkle', o.x * TILE + 8, o.y * TILE, 4, { speed: 20, up: 40 });
    return;
  }
  if (o.input) { g.say('machine_busy', { name: m.name, days: Math.max(1, o.ready - day) }); return; }
  const cur = g.inventory.current;
  if (!cur || !accepts(o.kind, cur.id)) { g.say(`machine_${o.kind}`); return; }
  if (g.inventory.count(cur.id) < m.n) { g.sfx('deny'); g.toast('machine_needs', { n: m.n, item: itemDef(cur.id).name }); return; }
  const q = cur.q;
  g.inventory.remove(cur.id, m.n);
  load(o, cur.id, q, day, hasPerk(g.skills, 'patient'));
  g.sfx('plant');
  g.toast('machine_loaded', { name: m.name, days: o.ready - day }, `icon_${o.kind}`);
}
