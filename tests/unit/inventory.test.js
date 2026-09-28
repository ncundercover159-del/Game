import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Inventory } from '../../src/systems/inventory.js';

test('stackables merge up to 99 and spill into new slots', () => {
  const inv = new Inventory(3);
  assert.equal(inv.add('wood', 150), 0);
  assert.deepEqual(inv.slots.map((s) => s && s.n), [99, 51, null]);
  assert.equal(inv.count('wood'), 150);
});

test('quality keeps stacks apart; tools never stack', () => {
  const inv = new Inventory(4);
  inv.add('daikon', 2, 0);
  inv.add('daikon', 1, 1);
  inv.add('hoe', 1);
  assert.equal(inv.add('hoe', 1), 0);
  assert.deepEqual(inv.slots.map((s) => s && `${s.id}:${s.n}:${s.q}`), ['daikon:2:0', 'daikon:1:1', 'hoe:1:0', 'hoe:1:0']);
});

test('overflow is returned, room() predicts it', () => {
  const inv = new Inventory(1);
  assert.equal(inv.room('stone'), 99);
  assert.equal(inv.add('stone', 120), 21);
  assert.equal(inv.room('stone'), 0);
  assert.equal(inv.room('wood'), 0);
});

test('take, swap, select wraps, serialize round-trip', () => {
  const inv = new Inventory(3);
  inv.add('seed_daikon', 2);
  assert.ok(inv.takeFrom(0, 2));
  assert.equal(inv.slots[0], null);
  inv.add('hay', 5);
  inv.swap(0, 2);
  assert.equal(inv.slots[2].id, 'hay');
  inv.select(-1);
  assert.equal(inv.selected, 2);
  assert.deepEqual(Inventory.from(inv.serialize()).serialize(), inv.serialize());
});
