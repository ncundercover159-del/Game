import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameMap } from '../../src/world/gamemap.js';
import { till, digChannel, untill } from '../../src/systems/farming.js';
import { computeFlow, isFlooded, watery } from '../../src/systems/irrigation.js';

// Pond on the left; a channel dug east along row 1, a field beside it.
const def = { id: 'i', farmable: true, ground: ['~.......', '~.......', '~.......'] };
function dig(m, x, y) { till(m, x, y); return digChannel(m, x, y); }

test('water flows from the pond along connected channel tiles only', () => {
  const m = new GameMap(def);
  for (let x = 1; x <= 4; x++) assert.ok(dig(m, x, 1));
  dig(m, 6, 1);                     // disconnected
  assert.equal(computeFlow(m), 4);
  assert.equal(m.flow[m.i(4, 1)], 1);
  assert.equal(m.flow[m.i(6, 1)], 0, 'gap stops the water');
  dig(m, 5, 1);
  assert.equal(computeFlow(m), 6, 'closing the gap reconnects it');
});

test('a closed sluice gate stops the flow downstream; opening it lets water through', () => {
  const m = new GameMap(def);
  for (let x = 1; x <= 5; x++) dig(m, x, 1);
  const gate = m.addObject({ type: 'sluice', x: 3, y: 1, v: 0, open: false });
  computeFlow(m);
  assert.deepEqual([1, 2, 3, 4, 5].map((x) => m.flow[m.i(x, 1)]), [1, 1, 0, 0, 0]);
  gate.open = true;
  computeFlow(m);
  assert.deepEqual([1, 2, 3, 4, 5].map((x) => m.flow[m.i(x, 1)]), [1, 1, 1, 1, 1]);
});

test('tilled soil beside running water is a flooded paddy', () => {
  const m = new GameMap(def);
  for (let x = 1; x <= 3; x++) dig(m, x, 1);
  till(m, 3, 2); till(m, 5, 2);
  computeFlow(m);
  assert.ok(watery(m, 3, 1));
  assert.ok(isFlooded(m, 3, 2));
  assert.equal(isFlooded(m, 5, 2), false);
  untill(m, 1, 1);                  // break the channel at its mouth
  assert.equal(isFlooded(m, 3, 2), false, 'no source, no paddy');
});
