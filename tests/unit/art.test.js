import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE_SIZE, RAMPS } from '../../src/art/palette.js';
import { ITEMS } from '../../src/data/items.js';
import { CROPS } from '../../src/data/crops.js';
import { toolIcons, itemIcons } from '../../src/art/icons.js';
import { foodIcons } from '../../src/art/food.js';
import { forageIcons } from '../../src/art/forage.js';
import { fishIcons } from '../../src/art/fish.js';
import { cropGrids, CROP_ART } from '../../src/art/crops.js';
import { genCropStages } from '../../src/art/cropgen.js';
import { composeFrame, LOOKS, ANIMS, DIRS } from '../../src/art/characters.js';

test('palette stays within 64 colours, all distinct', () => {
  assert.ok(PALETTE_SIZE <= 64);
  const all = Object.values(RAMPS).flat();
  assert.equal(new Set(all).size, all.length);
});

test('every item has a 16x16 icon', () => {
  const icons = { ...toolIcons(), ...itemIcons(), ...foodIcons(), ...forageIcons(), ...fishIcons() };
  for (const id of Object.keys(ITEMS)) {
    const g = icons[id];
    assert.ok(g, `icon for ${id}`);
    assert.equal(g.w, 16, id);
    assert.equal(g.h, 16, id);
  }
});

test('every crop has 5 growth stages at 16x20 and points at real items', () => {
  for (const id of Object.keys(CROPS)) {
    const stages = CROP_ART[id] ? cropGrids(id) : genCropStages(id);
    assert.equal(stages.length, 5, id);
    for (const g of stages) assert.deepEqual([g.w, g.h], [16, 20], id);
    assert.ok(ITEMS[id] && ITEMS[`seed_${id}`], id);
  }
});

test('every character frame composes to 16x32', () => {
  for (const dir of DIRS) for (const def of Object.values(ANIMS)) for (const [tp, lp, bob] of def.frames) {
    const g = composeFrame(LOOKS.player, dir, tp, lp, bob);
    assert.deepEqual([g.w, g.h], [16, 32]);
  }
});
