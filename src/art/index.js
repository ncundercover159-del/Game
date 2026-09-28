// Builds the game's texture atlas at boot from every art module. Frame names are the contract
// between art and game code; tools/gallery.html lists them all.
import { Atlas } from './compiler.js';
import { addCharacter, LOOKS } from './characters.js';
import { addHeldTools } from './held.js';
import { treeParts, STONES, TWIGS, STUMP, weed, bamboo, DECALS, shadow } from './nature.js';
import { minka, kura, well, toro, sign, fence } from './buildings.js';
import { cropGrids } from './crops.js';
import { toolIcons, itemIcons, coinIcon } from './icons.js';
import { FRAME, FRAME_THIN, FRAME_DARK, SLOT, SLOT_SEL, TARGET, dialSky, SUN, MOON } from './ui.js';
import { parse } from './raster.js';

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
  addHeldTools(atlas);

  for (const kind of TREE_KINDS) {
    for (let v = 0; v < TREE_VARIANTS; v++) {
      const t = treeParts(kind, 17 + v * 101 + kind.length * 7);
      add(`tree_${kind}${v}_trunk`, t.trunk, Math.floor(t.trunk.w / 2), t.trunk.h);
      // Canopy anchor: its bottom-centre sits `canopyY + canopy.h` above the trunk base.
      add(`tree_${kind}${v}_canopy`, t.canopy, Math.floor(t.canopy.w / 2), -t.canopyY);
    }
  }
  STONES.forEach((g, i) => add(`stone${i}`, g, undefined, g.h + 2));
  TWIGS.forEach((g, i) => add(`twig${i}`, g, undefined, g.h + 3));
  add('stump', STUMP, 8, STUMP.h + 1);
  for (let i = 0; i < 3; i++) add(`weed${i}`, weed(40 + i * 13, false), 10, 18);
  add('weed_flower', weed(91, true), 10, 18);
  for (let i = 0; i < 2; i++) add(`bamboo${i}`, bamboo(5 + i * 9), undefined, 49);
  for (const [k, g] of Object.entries(DECALS)) add(`decal_${k}`, g, 0, 0);
  add('shadow_s', shadow(12, 4), 6, 2);
  add('shadow_m', shadow(20, 6), 10, 3);
  add('shadow_l', shadow(34, 9), 17, 4);

  add('minka', minka(), 0, 0);
  add('kura', kura(), 0, 0);
  add('well', well(), 0, 0);
  add('toro', toro());
  add('sign', sign());
  add('fence_post', fence(true), 9, 21);
  add('fence', fence(false), 9, 21);

  for (const id of ['daikon', 'komatsuna', 'soramame', 'strawberry']) {
    cropGrids(id).forEach((g, stage) => add(`crop_${id}_${stage}`, g, 8, 20));
  }

  for (const [k, g] of Object.entries(toolIcons())) add(`icon_${k}`, g, 0, 0);
  for (const [k, g] of Object.entries(itemIcons())) add(`icon_${k}`, g, 0, 0);
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

  for (const [k, [rows, legend]] of Object.entries(FX)) {
    const g = parse(rows, legend);
    add(k, g, Math.floor(g.w / 2), Math.floor(g.h / 2));
  }
  return atlas.build();
}
