import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newAnimals, adopt, pet, allPetted, coopNight, hasDucks, COOP_SIZE, ANIMALS } from '../../src/systems/animals.js';
import { ITEMS } from '../../src/data/items.js';
import { Rng } from '../../src/core/rng.js';

test('adopting fills the coop with named animals up to its size', () => {
  const st = newAnimals();
  for (let i = 0; i < COOP_SIZE; i++) assert.ok(adopt(st, i % 2 ? 'duck' : 'chicken', 7));
  assert.equal(adopt(st, 'chicken', 7), null);
  assert.equal(new Set(st.list.map((a) => a.name)).size, COOP_SIZE, 'names are unique');
  assert.ok(hasDucks(st));
  for (const k of Object.keys(ANIMALS)) assert.ok(ITEMS[ANIMALS[k].product]);
});

test('fed animals lay; the hopper empties one hay each; hungry ones sulk', () => {
  const st = newAnimals();
  adopt(st, 'chicken', 1); adopt(st, 'chicken', 1);
  st.hay = 1;
  const eggs = coopNight(st, 0, new Rng(1));
  assert.equal(eggs.length, 1);
  assert.equal(st.hay, 0);
  const [fed, hungry] = st.list;
  assert.ok(fed.fed && !hungry.fed);
  assert.ok(fed.affection > hungry.affection);
});

test('petting once a day raises affection; loved animals lay finer eggs', () => {
  const st = newAnimals();
  const a = adopt(st, 'duck', 3);
  assert.ok(pet(a, 5));
  assert.ok(!pet(a, 5));
  assert.ok(allPetted(st, 5));
  a.affection = 1000;
  st.hay = 200;
  const r = new Rng(9);
  let fine = 0;
  for (let d = 0; d < 100; d++) { pet(a, d); if (coopNight(st, d, r)[0].q > 0) fine++; }
  assert.ok(fine > 60, `${fine} fine or better`);
});
