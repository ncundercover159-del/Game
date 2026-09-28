// Builds the game's texture atlas at boot from every art module. Frame names are the contract
// between art and game code; tools/gallery.html lists them all.
import { Atlas } from './compiler.js';
import { addCharacter, LOOKS } from './characters.js';
import { NPC_LOOKS } from './looks.js';
import { portrait, EXPRESSIONS } from './portraits.js';
import { emotes, heartIcon, smallHeart } from './emotes.js';
import { addHeldTools } from './held.js';
import { treeParts, STONES, TWIGS, STUMP, weed, bamboo, DECALS, shadow, bareCanopy, bigLog, boulder } from './nature.js';
import { minka, kura, well, toro, sign, fence, crate, sluice, ishigaki } from './buildings.js';
import { cropGrids, CROP_ART } from './crops.js';
import { genCropStages, witheredStage } from './cropgen.js';
import { toolIcons, itemIcons, coinIcon, tierToolIcons } from './icons.js';
import { foodIcons } from './food.js';
import { forageIcons, digSpot } from './forage.js';
import { fishIcons, bobber, rodSprite, trapInWater } from './fish.js';
import { townhouse, torii, honden, noticeBoard, jizo, bench, parasol, riceBales, mailbox, emaRack, shimenawa, rearGate } from './town.js';
import { futon, irori, tansu, andon, counter, shelf, teaTable, zabuton, forge, anvil, drawers, nets, altar, kamidana } from './furniture.js';
import { CROPS } from '../data/crops.js';
import { FRAME, FRAME_THIN, FRAME_DARK, SLOT, SLOT_SEL, TARGET, dialSky, SUN, MOON, WEATHER_ICONS } from './ui.js';
import { parse, recolor } from './raster.js';

export const SEASON_IDS = ['spring', 'summer', 'autumn', 'winter'];

// Seasonal recolours: [summer, autumn, winter]; 'bare' swaps in leafless branches.
const LEAF_SUMMER = { grass6: 'grass5', grass5: 'grass4', grass4: 'grass3', grass3: 'grass2' };
const LEAF_MAPLE = { grass0: 'red0', grass1: 'red1', grass2: 'red2', grass3: 'red3', grass4: 'red4', grass5: 'gold2', grass6: 'gold3' };
const LEAF_GINKGO = { grass0: 'wood1', grass1: 'gold0', grass2: 'gold0', grass3: 'gold1', grass4: 'gold1', grass5: 'gold2', grass6: 'gold3' };
const SEASONS_OF = {
  broadleaf: (v) => [LEAF_SUMMER, v === 1 ? LEAF_GINKGO : LEAF_MAPLE, 'bare'],
  sakura: () => [{ sakura0: 'grass0', sakura1: 'grass2', sakura2: 'grass3', sakura3: 'grass4', sakura4: 'grass5' },
    { sakura0: 'red0', sakura1: 'red1', sakura2: 'red3', sakura3: 'red4', sakura4: 'gold2' }, 'bare'],
  pine: () => [null, null, { teal1: 'ink5', grass3: 'ink6' }],
  weed: () => [null, { grass0: 'wood0', grass1: 'straw0', grass2: 'straw1', grass3: 'straw2', grass4: 'straw3', grass5: 'straw4', grass6: 'straw4' },
    { grass0: 'ink3', grass1: 'ink4', grass2: 'ink4', grass3: 'ink5', grass4: 'ink6', grass5: 'ink6', grass6: 'ink6' }],
  bamboo: () => [null, null, { grass5: 'ink6', grass6: 'ink6' }],
};

/** Register `name@summer|autumn|winter` variants of a grid. */
function addSeasonal(add, name, g, kind, v, ax, ay, seed) {
  SEASONS_OF[kind](v).forEach((map, i) => {
    if (!map) return;
    const sg = map === 'bare' ? bareCanopy(seed, g.w - 2, g.h - 2) : recolor(g, map);
    add(`${name}@${SEASON_IDS[i + 1]}`, sg, map === 'bare' ? Math.floor(sg.w / 2) : ax, ay);
  });
}

// Village buildings: townhouse parameters per building (see art/town.js).
const TOWN = {
  b_yorozuya: { w: 116, wall: 'plaster', noren: 'indigo', sign: 'ink1', seed: 3 },
  b_chaya: { w: 116, roof: 'thatch', noren: 'red', seed: 5 },
  b_kajiya: { w: 116, sign: 'red2', seed: 7 },
  b_yakuya: { w: 116, wall: 'plaster', noren: 'grass', sign: 'grass1', seed: 9 },
  b_daikansho: { w: 180, wallH: 40, roofH: 36, wall: 'plaster', noren: 'indigo', seed: 11 },
  b_daigo: { w: 84, roof: 'thatch', noren: 'water', lattice: false, seed: 13 },
  b_dojo: { w: 148, wallH: 34, sign: 'ink1', seed: 15 },
  b_kuroda: { w: 116, wall: 'plaster', noren: 'gold', seed: 17 },
  b_kaito: { w: 84, roof: 'thatch', seed: 19 },
  b_shamusho: { w: 84, wall: 'plaster', noren: 'red', glaze: 'water', seed: 21 },
  b_house1: { w: 84, roof: 'thatch', noren: 'indigo', seed: 23 },
  b_house2: { w: 84, wall: 'plaster', noren: 'sakura', seed: 25 },
};
// Snow on tile roofs (by glaze) and on thatch.
const SNOW_TILE = { ink: { ink2: 'ink5', ink3: 'ink6' }, water: { water2: 'ink5', water3: 'ink6' } };
const SNOW_THATCH = { straw4: 'ink6', straw3: 'ink6', straw2: 'ink5', teal1: 'ink5' };
// Altar cloth colour for each of the seven virtues.
export const VIRTUE_CLOTH = { gi: 'indigo', yu: 'red', jin: 'grass', rei: 'sakura', makoto: 'water', meiyo: 'gold', chugi: 'straw' };

export const TREE_KINDS = ['broadleaf', 'sakura', 'pine'];
export const TREE_VARIANTS = 3;

// Tiny particle sprites (effects layer).
const FX = {
  fx_sparkle: [`
    ..a..
    ..b..
    abcba
    ..b..
    ..a..`, { a: 'gold2', b: 'gold3', c: 'ink6' }],
  fx_drop: [`
    a
    b`, { a: 'water4', b: 'water3' }],
  fx_leaf: [`
    ab
    b.`, { a: 'grass5', b: 'grass3' }],
  fx_chip: [`
    ab
    bb`, { a: 'wood4', b: 'wood2' }],
  fx_pebble: [`
    ab
    bc`, { a: 'stone4', b: 'stone2', c: 'stone1' }],
  fx_dirt: [`
    .a.
    abb
    .b.`, { a: 'wood4', b: 'wood3' }],
  fx_hay: [`
    a.
    .a
    a.`, { a: 'straw3' }],
};

export function buildArt() {
  const atlas = new Atlas(1024);
  const add = (name, g, ax, ay) => atlas.add(name, g, ax ?? Math.floor(g.w / 2), ay ?? g.h);

  addCharacter(atlas, 'player', LOOKS.player);
  for (const [id, look] of Object.entries(NPC_LOOKS)) {
    addCharacter(atlas, id, look, ['idle', 'walk']);
    for (const ex of EXPRESSIONS) add(`portrait_${id}_${ex}`, portrait(look, ex), 0, 0);
  }
  addHeldTools(atlas);

  for (const kind of TREE_KINDS) {
    for (let v = 0; v < TREE_VARIANTS; v++) {
      const t = treeParts(kind, 17 + v * 101 + kind.length * 7);
      add(`tree_${kind}${v}_trunk`, t.trunk, Math.floor(t.trunk.w / 2), t.trunk.h);
      // Canopy anchor: its bottom-centre sits `canopyY + canopy.h` above the trunk base.
      add(`tree_${kind}${v}_canopy`, t.canopy, Math.floor(t.canopy.w / 2), -t.canopyY);
      addSeasonal(add, `tree_${kind}${v}_canopy`, t.canopy, kind, v, Math.floor(t.canopy.w / 2), -t.canopyY, v * 7 + kind.length);
    }
  }
  STONES.forEach((g, i) => add(`stone${i}`, g, undefined, g.h + 2));
  TWIGS.forEach((g, i) => add(`twig${i}`, g, undefined, g.h + 3));
  add('stump', STUMP, 8, STUMP.h + 1);
  for (let i = 0; i < 4; i++) {
    const name = i === 3 ? 'weed_flower' : `weed${i}`;
    const g = i === 3 ? weed(91, true) : weed(40 + i * 13, false);
    add(name, g, 10, 18);
    addSeasonal(add, name, g, 'weed', 0, 10, 18);
  }
  for (let i = 0; i < 2; i++) {
    const g = bamboo(5 + i * 9);
    add(`bamboo${i}`, g, undefined, 49);
    addSeasonal(add, `bamboo${i}`, g, 'bamboo', 0, Math.floor(g.w / 2), 49);
  }
  add('log', bigLog(), 16, 15);
  add('boulder', boulder(), 12, 19);
  add('crate', crate(), 12, 21);
  add('ishigaki', ishigaki(), 8, 20);
  add('ishigaki@winter', recolor(ishigaki(), { grass3: 'ink5', grass4: 'ink6', grass5: 'ink6' }), 8, 20);
  add('sluice_open', sluice(true), 9, 19);
  add('sluice_shut', sluice(false), 9, 19);
  for (const [k, g] of Object.entries(DECALS)) add(`decal_${k}`, g, 0, 0);
  add('shadow_s', shadow(12, 4), 6, 2);
  add('shadow_m', shadow(20, 6), 10, 3);
  add('shadow_l', shadow(34, 9), 17, 4);

  // Snow settles on the thatch in winter.
  for (const [name, g] of [['minka', minka()], ['well', well()]]) {
    add(name, g, 0, 0);
    add(`${name}@winter`, recolor(g, SNOW_THATCH), 0, 0);
  }
  add('kura', kura(), 0, 0);
  add('toro', toro());
  add('sign', sign());
  add('fence_post', fence(true), 9, 21);
  add('fence', fence(false), 9, 21);

  for (const [name, opts] of Object.entries(TOWN)) {
    const g = townhouse(opts);
    add(name, g);
    add(`${name}@winter`, recolor(g, opts.roof === 'thatch' ? SNOW_THATCH : SNOW_TILE[opts.glaze || 'ink']));
  }
  add('honden', honden());
  add('torii', torii());
  add('notice', noticeBoard());
  add('jizo', jizo());
  add('bench', bench());
  add('parasol', parasol());
  add('bales', riceBales());
  add('mailbox', mailbox());
  add('ema', emaRack());
  add('shimenawa', shimenawa(), 12, 0);
  add('gate', rearGate());
  add('gate@winter', recolor(rearGate(), SNOW_TILE.ink));

  // Furniture.
  add('futon', futon());
  add('irori', irori());
  add('tansu', tansu());
  add('andon', andon());
  add('counter', counter());
  add('shelf_goods', shelf('goods'));
  add('shelf_herbs', shelf('herbs'));
  add('teaTable', teaTable());
  add('zabuton_red', zabuton('red'));
  add('zabuton_indigo', zabuton('indigo'));
  add('forge', forge());
  add('anvil', anvil());
  add('drawers', drawers());
  add('nets', nets());
  add('kamidana', kamidana());
  for (const [v, cloth] of Object.entries(VIRTUE_CLOTH)) add(`altar_${v}`, altar(cloth));

  for (const id of Object.keys(CROPS)) {
    (CROP_ART[id] ? cropGrids(id) : genCropStages(id)).forEach((g, stage) => add(`crop_${id}_${stage}`, g, 8, 20));
  }
  add('crop_withered', witheredStage(), 8, 20);

  for (const [k, g] of Object.entries(toolIcons())) add(`icon_${k}`, g, 0, 0);
  for (const [k, g] of Object.entries(itemIcons())) add(`icon_${k}`, g, 0, 0);
  for (const [k, g] of Object.entries(tierToolIcons())) add(`icon_${k}`, g, 0, 0);
  for (const [k, g] of Object.entries(foodIcons())) add(`icon_${k}`, g, 0, 0);
  // Forage doubles as its own ground sprite, anchored at the feet.
  for (const [k, g] of Object.entries(forageIcons())) { add(`icon_${k}`, g, 0, 0); add(`forage_${k}`, g, 8, 15); }
  add('dig_spot', digSpot(), 8, 12);
  for (const [k, g] of Object.entries(fishIcons())) add(`icon_${k}`, g, 0, 0);
  add('bobber', bobber(), 2, 5);
  add('uke', trapInWater(), 8, 14);
  for (const dir of ['down', 'up', 'right']) for (const pose of ['raise', 'strike']) {
    const s = rodSprite(dir, pose);
    add(`held_rod_${dir}_${pose}`, s.g, s.ax, s.ay);
  }
  add('icon_coin', coinIcon(), 0, 0);

  add('ui_frame', FRAME, 0, 0);
  add('ui_frame_thin', FRAME_THIN, 0, 0);
  add('ui_frame_dark', FRAME_DARK, 0, 0);
  add('ui_slot', SLOT, 0, 0);
  add('ui_slot_sel', SLOT_SEL, 0, 0);
  add('ui_target', TARGET, 0, 0);
  add('ui_dial_day', dialSky(false), 0, 0);
  add('ui_dial_night', dialSky(true), 0, 0);
  add('ui_sun', SUN, 2, 2);
  add('ui_moon', MOON, 2, 2);
  for (const [k, g] of Object.entries(WEATHER_ICONS)) add(`wx_${k}`, g, 0, 0);
  for (const [k, g] of Object.entries(emotes())) add(`emote_${k}`, g, 6, 12);
  add('icon_heart', heartIcon(), 0, 0);
  add('ui_heart_s', smallHeart(true), 0, 0);
  add('ui_heart_s_empty', smallHeart(false), 0, 0);

  for (const [k, [rows, legend]] of Object.entries(FX)) {
    const g = parse(rows, legend);
    add(k, g, Math.floor(g.w / 2), Math.floor(g.h / 2));
  }
  return atlas.build();
}
