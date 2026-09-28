// M7e: the new-farm choices (looks, layouts, what a new state starts with), the text-size screen
// scaling, and rebinding keys.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playerLook, LOOK_PARTS, DEFAULT_LOOK, HAIR_STYLES } from '../../src/data/appearance.js';
import { LAYOUTS, LAYOUT_IDS } from '../../src/data/layouts.js';
import { composeFrame } from '../../src/art/characters.js';
import { COLORS } from '../../src/art/palette.js';
import { newState } from '../../src/state.js';
import { GameMap } from '../../src/world/gamemap.js';
import { decorate, populate } from '../../src/world/populate.js';
import { MAPS } from '../../src/maps/index.js';
import { chooseScale } from '../../src/core/screen.js';
import { Input, DEFAULT_BINDINGS, REBINDABLE } from '../../src/core/input.js';
import { keyName } from '../../src/ui/settings.js';

test('every look is real: palette colours, every hairstyle, frames all the same size', () => {
  for (const [part, options] of Object.entries(LOOK_PARTS)) for (let i = 0; i < options.length; i++) {
    const look = playerLook({ ...DEFAULT_LOOK, [part]: i });
    for (const k of ['hair', 'skin', 'kosode', 'hakama']) for (const c of look[k]) assert.ok(COLORS[c], `${part} ${i}: ${c}`);
    for (const dir of ['down', 'up', 'right']) {
      const g = composeFrame(look, dir, 'stand', 'stand', 0, 0);
      assert.equal(g.w, 16); assert.equal(g.h, 32);
    }
  }
  assert.equal(playerLook({ style: 99, hair: -1 }).style, HAIR_STYLES[0], 'out of range falls back');
});

test('a new state carries the choices: name, farm, look, difficulty, and the layout\'s starting kit', () => {
  const s = newState(7, { name: 'Mitsuki', farm: 'Kiri', look: { hair: 2 }, layout: 'kawabe', difficulty: 'warrior' });
  assert.equal(s.name, 'Mitsuki');
  assert.equal(s.farm, 'Kiri');
  assert.deepEqual(s.look, { ...DEFAULT_LOOK, hair: 2 });
  assert.equal(s.difficulty, 'warrior');
  assert.equal(s.layout, 'kawabe');
  assert.equal(s.inventory.slots.filter((x) => x.id === 'uke').reduce((a, x) => a + x.n, 0), 2);
  const plain = newState(7);
  assert.equal(plain.name, 'Hayato');
  assert.equal(plain.layout, 'hinata');
  assert.ok(!plain.inventory.slots.some((x) => x.id === 'uke'));
  assert.equal(newState(7, { layout: 'nowhere' }).layout, 'hinata');
});

test('layouts grow differently: the woodland thick with trees, the riverside lighter and less stony', () => {
  const count = (id) => {
    const m = new GameMap(MAPS.farm);
    decorate(m);
    populate(m, 7, LAYOUTS[id]);
    const by = {};
    for (const o of m.objects) by[o.type] = (by[o.type] || 0) + 1;
    return { all: m.objects.length, woody: (by.tree || 0) + (by.stump || 0) + (by.log || 0), stone: by.stone || 0 };
  };
  const [h, m, k] = LAYOUT_IDS.map(count);
  assert.deepEqual(LAYOUT_IDS, ['hinata', 'mori', 'kawabe']);
  assert.ok(m.woody > h.woody * 1.8, `woodland ${m.woody} vs ${h.woody}`);
  assert.ok(k.stone < h.stone * 0.6, `riverside stones ${k.stone} vs ${h.stone}`);
  assert.ok(k.all < h.all, 'riverside is lighter');
  for (const L of Object.values(LAYOUTS)) assert.ok(L.name && L.jp && L.desc && L.growth.length);
});

test('text size: bigger text means fewer, bigger pixels, but never below the panels\' floor', () => {
  assert.equal(chooseScale(1920, 1080, 270), 4);          // 480x270
  assert.equal(chooseScale(1920, 1080, 200), 5);          // 384x216
  assert.equal(chooseScale(1280, 720, 270), 3);           // 427x240
  assert.equal(chooseScale(1280, 720, 200), 3, '320x180 would be too small: stays at 240');
  assert.equal(chooseScale(2560, 1440, 230), 6);          // 427x240
});

test('rebinding: a key moves to its new action, the old owner takes the old key, confirm follows', () => {
  const input = new Input(null, null);
  input.rebind('use', 'KeyF');
  assert.equal(input.bindings.use[0], 'KeyF');
  assert.ok(input.codeMap.get('KeyF').includes('use') && input.codeMap.get('KeyF').includes('confirm'));
  assert.ok(!input.bindings.confirm.includes('KeyJ'), 'J no longer confirms');
  input.rebind('interact', 'KeyF');
  assert.equal(input.bindings.interact[0], 'KeyF');
  assert.equal(input.bindings.use[0], 'KeyK', 'the two swapped');
  assert.deepEqual(input.customKeys(), { use: 'KeyK', interact: 'KeyF' });
  input.resetKeys();
  assert.deepEqual(input.bindings, DEFAULT_BINDINGS);
  for (const a of REBINDABLE) assert.ok(DEFAULT_BINDINGS[a], a);
  assert.equal(keyName('KeyJ'), 'J');
  assert.equal(keyName('ArrowUp'), '↑');
  assert.equal(keyName('ShiftLeft'), 'Shift');
});
