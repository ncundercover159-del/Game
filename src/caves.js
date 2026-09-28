// Mount Kurayama as the game sees it: building a floor's map from the generator, going down and up,
// lanterns, chests, defeat (waking in Ume's care, the lost bundle) and the end of Jūbei's fight.
import { MAPS } from './maps/index.js';
import { generateFloor } from './systems/cavegen.js';
import { defeatCost, kiMax } from './systems/combat.js';
import { ORES, CHEST_LOOT, zoneOf, BOSS_FLOORS, LANTERN_EVERY, modsOf } from './data/caves.js';
import { DIFFICULTY } from './data/enemies.js';
import { OUTCOMES } from './data/bosses.js';
import { startEpilogue } from './epilogue.js';
import { InkWipe } from './ui/transition.js';
import { Dialog } from './ui/dialog.js';
import { t } from './data/strings.js';
import { dayIndex, DAY_END } from './systems/calendar.js';
import { virtueTier } from './systems/virtues.js';
import { TILE } from './config.js';

export const newCaves = () => ({ deepest: 0, lanterns: [], bundle: [], opened: { day: -1, keys: [] } });

/** The map definition of a floor: generated ground and props, plus today's opened chests. */
export function caveDef(g, floor) {
  const gen = generateFloor(g.seed, floor);
  const zone = zoneOf(floor);
  const day = dayIndex(g.cal);
  if (g.caves.opened.day !== day) g.caves.opened = { day, keys: [] };
  const opened = new Set(g.caves.opened.keys);
  const lit = g.caves.lanterns.includes(floor);
  const props = gen.props.map((p) => {
    const q = { ...p };
    if (p.type === 'ore') q.hp = ORES[p.kind].hp;
    if (p.type === 'chest' && opened.has(`${floor}:${p.tx},${p.ty}`)) q.open = true;
    if (p.type === 'cave_lantern') { q.lit = lit; if (!lit) delete q.light; }
    return q;
  });
  // Lava glows: a soft light over every third tile of it.
  if (zone.lava) gen.ground.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '~' && (x + y) % 3 === 0) props.push({ type: 'lava_glow', tx: x, ty: y, light: [0, -8] }); }));
  const boss = BOSS_FLOORS[floor];
  const beaten = boss && g.flags[`boss_${boss}`];
  if (beaten) props.push({ type: 'ladder', tx: gen.exit.tx, ty: gen.exit.ty });
  return {
    id: 'cave', name: `${zone.name} B${floor}`, jp: zone.jp, cave: true, floor, zone: gen.zone, boss: beaten ? null : boss, lava: !!zone.lava, mods: modsOf(floor),
    ground: gen.ground, props, warps: [], exit: gen.exit,
    spawn: { tx: gen.start.tx, ty: gen.start.ty, dir: 'down' },
    spawns: beaten ? [] : gen.spawns,
  };
}

/** Go to a floor behind the ink wipe. New depths raise Yū. */
export function enterFloor(g, floor) {
  g.sfx('door');
  g.modals.push(new InkWipe(g, {
    sweep: 0.3, hold: 0.1,
    onCovered: () => {
      MAPS.cave = caveDef(g, floor);
      g.worlds.delete('cave');
      const c = g.caves;
      if (floor > c.deepest) {
        if (Math.floor(floor / LANTERN_EVERY) > Math.floor(c.deepest / LANTERN_EVERY)) g.addVirtue('yu', 2);
        c.deepest = floor;
      }
      const sp = MAPS.cave.spawn;
      g.enter('cave', sp.tx, sp.ty, sp.dir);
      const first = { 1: 'tk_cave_first', 41: 'tk_cave_zone3', 61: 'tk_cave_zone4', 81: 'tk_cave_zone5' }[floor] || null;
      g.aside(first || (BOSS_FLOORS[floor] && !g.flags[`boss_${BOSS_FLOORS[floor]}`] ? 'tk_boss_floor' : 'tk_cave_floor'), { once: first ? first : `floor${floor}`, vars: { n: floor } });
    },
  }));
}

/** Walking into the mine mouth: straight down, or to a lit lantern's floor. */
export function askFloor(g) {
  const lit = [...g.caves.lanterns].sort((a, b) => a - b);
  if (!lit.length) { enterFloor(g, 1); return; }
  const floors = [1, ...lit];
  g.modals.push(new Dialog(g, {
    text: t('cave_which'),
    choices: [...floors.map((f) => t(f === 1 ? 'cave_floor1' : 'cave_lantern_floor', { n: f })), t('cave_not_now')],
    onChoose: (i) => {
      if (i < floors.length) enterFloor(g, floors[i]);
      else { const p = g.player; g.world.place(p.tx, p.ty + 1, 'down'); }
    },
  }));
}

export function descend(g) {
  const floor = g.world.map.def.floor;
  enterFloor(g, floor + 1);
}

/** Up the rope to the mouth. */
export function climbOut(g) {
  g.sfx('door');
  g.modals.push(new InkWipe(g, { sweep: 0.3, hold: 0.1, onCovered: () => g.enter('kurayama', 14, 6, 'down') }));
}

export function lightLantern(g, w, o) {
  const floor = w.map.def.floor;
  if (o.lit) { g.say('cave_lantern_lit'); return; }
  o.lit = true;
  w.map.lights.push({ x: o.x * TILE + 8, y: o.y * TILE - 8, kind: 'lantern' });
  if (!g.caves.lanterns.includes(floor)) g.caves.lanterns.push(floor);
  w.fx.burst('fx_sparkle', o.x * TILE + 8, o.y * TILE - 4, 6, { speed: 20, up: 40 });
  g.sfx('bell');
  g.say('cave_lantern_new', { n: floor });
}

export function openChest(g, w, o) {
  if (o.open) { g.say('chest_empty'); return; }
  const table = CHEST_LOOT[o.zone || 1];
  let r = w.combat.rng.next() * table.reduce((s, x) => s + x[3], 0);
  const [id, min, max] = table.find((x) => (r -= x[3]) < 0) || table[0];
  const n = w.combat.rng.int(min, max);
  o.open = true;
  g.caves.opened.keys.push(`${w.map.def.floor}:${o.x},${o.y}`);
  g.sfx('harvest');
  w.fx.burst('fx_sparkle', o.x * TILE + 8, o.y * TILE + 4, 8, { speed: 30, up: 50 });
  if (id === 'mon') { g.money += n; g.toast('toast_found_mon', { n }, 'icon_coin'); } else w.drops.spawn(w.combat.rng, id, n, 0, o.x * TILE + 8, o.y * TILE + 18);
}

/** The lost bundle sits by the mine mouth while it holds anything. */
export function placeBundle(g, w) {
  const at = w.map.def.bundleAt;
  if (!at || !g.caves.bundle.length || w.map.objects.some((o) => o.type === 'bundle')) return;
  w.map.addObject({ type: 'bundle', x: at.tx, y: at.ty });
}

/** Take back what the last defeat left at the mouth. */
export function takeBundle(g, w, o) {
  const keep = [];
  for (const s of g.caves.bundle) {
    const left = g.pickUp(s.id, s.n, s.q);
    if (left > 0) keep.push({ ...s, n: left });
  }
  g.caves.bundle = keep;
  if (!keep.length) w.map.removeObject(o);
}

/** Inochi ran out: wake in Ume's care, a little poorer; some things wait at the mine mouth. */
export function defeat(g) {
  if (g.defeating) return;
  g.defeating = true;
  const cost = defeatCost(g.money, g.inventory.slots, g.difficulty, g.rng);
  g.sfx('fall');
  g.modals.push(new InkWipe(g, {
    sweep: 0.6, hold: 0.5,
    onCovered: () => {
      g.money -= cost.mon;
      const lost = cost.slots.map((i) => g.inventory.slots[i]).filter(Boolean).map((s) => ({ ...s }));
      for (const i of cost.slots) g.inventory.slots[i] = null;
      g.caves.bundle.push(...lost);
      g.hp = Math.ceil(g.hpMax / 2);
      g.ki = kiMax(g.virtues);
      g.cal.minutes = Math.min(g.cal.minutes + 120, DAY_END - 60);
      g.stats.defeats = (g.stats.defeats || 0) + 1;
      g.enter('yakuya', MAPS.yakuya.spawn.tx, MAPS.yakuya.spawn.ty - 1, 'down');
      g.defeating = false;
      const lines = [`say ume sad "${t('defeat_ume')}"`];
      if (cost.mon || lost.length) lines.push(`say "${t(lost.length ? 'defeat_lost_items' : 'defeat_lost_mon', { mon: cost.mon, n: lost.length })}"`);
      else if (!DIFFICULTY[g.difficulty]?.loss) lines.push(`say "${t('defeat_relaxed')}"`);
      g.pendingScene = lines.join('\n');
    },
  }));
}

/** A boss falls: Yū, XP, the ladder down, then its scene and what it leaves (see data/bosses.js). */
export function bossDown(g, f) {
  const w = g.world;
  g.flags[`boss_${f.kind}`] = true;
  g.addVirtue('yu', 5);
  g.xp('sword', f.def.xp);
  g.stats.kills = g.stats.kills || {};
  g.stats.kills[f.kind] = 1;
  const exit = w.map.def.exit;
  w.map.addObject({ type: 'ladder', x: exit.tx, y: exit.ty });
  for (const foe of w.combat.foes) if (!foe.dead) { foe.dead = true; w.fx.burst('fx_smoke1', foe.x, foe.y - 8, 4); }
  w.combat.shots = [];
  const out = OUTCOMES[f.kind];
  if (out) {
    g.hpMax += out.inochi;
    g.hp = g.hpMax;
    g.addVirtue(...out.virtue);
    if (out.inochi) g.toast('toast_inochi', { n: out.inochi }, null);
    const script = [out.script, ...out.items.map(([id, n]) => `give ${id} ${n}`)].join('\n');
    g.pendingScene = out.epilogue ? { script, onEnd: () => startEpilogue(g) } : script;
    return;
  }
  jubeiFate(g);
}

/** Jūbei on his knees: spare him, hand him to the magistrate, or (with Jin) give him honest work. */
function jubeiFate(g) {
  const kind = virtueTier(g.virtues, 'jin') >= 1;
  g.pendingScene = `
    say jubei "${t('jubei_down1')}"
    say jubei "${t('jubei_down2')}"
    choice "${t('jubei_spare')}" @spare "${t('jubei_magistrate')}" @jail${kind ? ` "${t('jubei_work')}" @work` : ''}
    @spare
    say jubei "${t('jubei_spared')}"
    virtue gi 3
    virtue meiyo 4
    setFlag jubei_spared
    goto @end
    @jail
    say "${t('jubei_jailed')}"
    virtue makoto 3
    money 1500
    setFlag jubei_jailed
    goto @end
    @work
    say jubei "${t('jubei_working')}"
    virtue jin 5
    virtue gi 2
    setFlag jubei_farmhand
    @end
    give kurogane 1
    say "${t('jubei_after')}"
  `;
}
