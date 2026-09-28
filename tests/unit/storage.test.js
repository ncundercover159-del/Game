import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHESTS, emptyChest, moveStack, holdsAnything } from '../../src/systems/storage.js';
import { CRAFTS } from '../../src/data/recipes.js';
import { itemDef } from '../../src/data/items.js';

test('two chests to craft: a small one from the start, a large one later', () => {
  assert.deepEqual(Object.keys(CHESTS), ['box_small', 'box_large']);
  assert.ok(CHESTS.box_large > CHESTS.box_small);
  assert.equal(CRAFTS.box_small.lv, 1);
  assert.ok(CRAFTS.box_large.lv > 1);
  for (const id of Object.keys(CHESTS)) assert.equal(itemDef(id).kind, 'place');
  assert.equal(emptyChest('box_small').length, 12);
});

test('a stack goes onto a matching stack first, then into the first empty slot', () => {
  const chest = [null, { id: 'wood', n: 90, q: 0 }, null];
  const pack = [{ id: 'wood', n: 30, q: 0 }];
  assert.equal(moveStack(pack, 0, chest), 30);
  assert.deepEqual(chest, [{ id: 'wood', n: 21, q: 0 }, { id: 'wood', n: 99, q: 0 }, null]);
  assert.equal(pack[0], null);
});

test('different qualities keep their own stacks; tools move one at a time', () => {
  const chest = [{ id: 'daikon', n: 3, q: 0 }, null];
  const pack = [{ id: 'daikon', n: 2, q: 1 }, { id: 'hoe', n: 1 }];
  moveStack(pack, 0, chest);
  assert.deepEqual(chest[1], { id: 'daikon', n: 2, q: 1 });
  assert.equal(moveStack(pack, 1, chest), 0, 'no room left');
  assert.deepEqual(pack[1], { id: 'hoe', n: 1 });
});

test('what does not fit stays behind, and only the used part of the pack is filled', () => {
  const chest = [{ id: 'stone', n: 50, q: 0 }];
  const pack = [{ id: 'stone', n: 99, q: 0 }, null, null];
  assert.equal(moveStack(chest, 0, pack, 2), 50);
  assert.deepEqual(pack, [{ id: 'stone', n: 99, q: 0 }, { id: 'stone', n: 50, q: 0 }, null]);
  assert.equal(chest[0], null);
  const full = [{ id: 'wood', n: 99, q: 0 }];
  const more = [{ id: 'wood', n: 5, q: 0 }];
  assert.equal(moveStack(more, 0, full), 0);
  assert.equal(more[0].n, 5);
});

test('a chest is empty until something is put in it', () => {
  const o = { items: emptyChest('box_large') };
  assert.ok(!holdsAnything(o));
  o.items[20] = { id: 'wood', n: 1, q: 0 };
  assert.ok(holdsAnything(o));
});
