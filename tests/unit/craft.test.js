import { test } from 'node:test';
import assert from 'node:assert/strict';
import { craftNeeds, hasAll, accepts, load, isReady, collect, progressOf } from '../../src/systems/craft.js';
import { CRAFTS, MACHINES, DISHES, SCROLLS, GOODS } from '../../src/data/recipes.js';
import { ITEMS } from '../../src/data/items.js';

test('every recipe, machine output and dish ingredient is a real item', () => {
  for (const [id, c] of Object.entries(CRAFTS)) { assert.ok(ITEMS[id], id); for (const [i] of c.needs) assert.ok(ITEMS[i], `${id}: ${i}`); }
  for (const m of Object.values(MACHINES)) { assert.ok(ITEMS[m.out]); if (Array.isArray(m.input)) for (const i of m.input) assert.ok(ITEMS[i]); }
  for (const [id, d] of Object.entries(DISHES)) { assert.equal(ITEMS[id].kind, 'food', id); for (const [i] of d.needs) assert.ok(ITEMS[i], `${id}: ${i}`); }
  for (const id of SCROLLS) assert.equal(ITEMS[`scroll_${id}`].kind, 'recipe');
  for (const id of Object.keys(GOODS)) assert.ok(ITEMS[id].sell > 0);
  assert.ok(Object.keys(DISHES).length >= 14);
});

test('Thrifty trims materials; hasAll checks the pack', () => {
  assert.deepEqual(craftNeeds('sake_barrel'), [['wood', 30], ['iron_bar', 1]]);
  assert.deepEqual(craftNeeds('sake_barrel', true), [['wood', 23], ['iron_bar', 1]]);
  const bag = { wood: 30, iron_bar: 1 };
  assert.ok(hasAll(craftNeeds('sake_barrel'), (i) => bag[i] || 0));
  bag.wood = 29;
  assert.ok(!hasAll(craftNeeds('sake_barrel'), (i) => bag[i] || 0));
});

test('machines take the right inputs', () => {
  assert.ok(accepts('sake_barrel', 'rice'));
  assert.ok(!accepts('sake_barrel', 'daikon'));
  assert.ok(accepts('tsukemono_tub', 'daikon'));
  assert.ok(!accepts('tsukemono_tub', 'rice'), 'grain is not pickled');
  assert.ok(!accepts('tsukemono_tub', 'strawberry'), 'nor fruit');
  assert.ok(accepts('smoker', 'ayu'));
  assert.ok(!accepts('smoker', 'funa'), 'cheap fish are not worth the smoke');
});

test('a loaded machine is ready after its days, keeps quality, then empties', () => {
  const o = { type: 'machine', kind: 'sake_barrel' };
  assert.equal(load(o, 'rice', 2, 10), 17);
  assert.ok(!isReady(o, 16));
  assert.ok(progressOf(o, 13, 360) > 0.4 && progressOf(o, 13, 360) < 0.5);
  assert.ok(isReady(o, 17));
  assert.deepEqual(collect(o), { id: 'sake', n: 1, q: 2 });
  assert.ok(!o.input && !isReady(o, 99));
  const p = { kind: 'miso_barrel' };
  assert.equal(load(p, 'daizu', 0, 0, true), 11, 'Patient Hands: 14 days -> 11');
  assert.equal(collect(p, true).q, 1, 'Master Maker: at least Fine');
  const c = { kind: 'compost_bin' };
  load(c, 'hay', 0, 0);
  assert.equal(collect(c).n, 5, 'compost comes out five at a time');
});
