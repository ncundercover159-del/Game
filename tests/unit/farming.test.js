import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameMap, G } from '../../src/world/gamemap.js';
import { till, untill, water, plant, harvest, growNight, cropAt, isRipe, canTill } from '../../src/systems/farming.js';
import { stageOf, RIPE } from '../../src/data/crops.js';
import { Rng } from '../../src/core/rng.js';

const def = { id: 't', ground: ['.....', '.,,,.', '.,~,.', '.....'] };
const fresh = () => new GameMap(def);

test('stages advance from seeds to ripe over the crop\'s days', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((g) => stageOf('daikon', g)), [0, 1, 2, 3, RIPE]);
  const s = [...Array(9).keys()].map((g) => stageOf('strawberry', g));
  assert.equal(s[0], 0);
  assert.equal(s[8], RIPE);
  for (let i = 1; i < s.length; i++) assert.ok(s[i] >= s[i - 1], 'stages never go backwards');
});

test('tilling works on grass and dirt, not water or occupied tiles', () => {
  const m = fresh();
  assert.ok(till(m, 0, 0));
  assert.equal(m.ground[m.i(0, 0)], G.DIRT);
  assert.ok(till(m, 1, 1));
  assert.equal(canTill(m, 2, 2), false, 'water');
  assert.equal(till(m, 1, 1), false, 'already tilled');
  m.addObject({ type: 'stone', x: 3, y: 3, v: 0 });
  assert.equal(till(m, 3, 3), false, 'stone in the way');
});

test('a watered crop grows one day per night; dry soil does not grow', () => {
  const m = fresh();
  till(m, 1, 1); till(m, 3, 1);
  assert.ok(plant(m, 1, 1, 'daikon'));
  assert.ok(plant(m, 3, 1, 'daikon'));
  assert.equal(plant(m, 1, 1, 'daikon'), false, 'occupied');
  water(m, 1, 1);
  assert.equal(growNight(m), 1);
  assert.equal(cropAt(m, 1, 1).growth, 1);
  assert.equal(cropAt(m, 3, 1).growth, 0);
  assert.equal(m.wet[m.i(1, 1)], 0, 'soil dries overnight');
});

test('harvest a ripe crop; regrowing crops stay and restart', () => {
  const m = fresh();
  const rng = new Rng(3);
  till(m, 1, 1); plant(m, 1, 1, 'daikon');
  till(m, 3, 1); plant(m, 3, 1, 'strawberry');
  assert.equal(harvest(m, 1, 1, rng), null, 'not ripe yet');
  for (let d = 0; d < 8; d++) { water(m, 1, 1); water(m, 3, 1); growNight(m); }
  assert.ok(isRipe(cropAt(m, 1, 1)));
  const got = harvest(m, 1, 1, rng);
  assert.equal(got.item, 'daikon');
  assert.ok(got.q >= 0 && got.q <= 2);
  assert.equal(cropAt(m, 1, 1), null);
  assert.equal(harvest(m, 3, 1, rng).item, 'strawberry');
  const berry = cropAt(m, 3, 1);
  assert.equal(berry.growth, 4, 'regrow starts 4 days before ripe');
  for (let d = 0; d < 4; d++) { water(m, 3, 1); growNight(m); }
  assert.ok(isRipe(cropAt(m, 3, 1)));
});

test('the pickaxe untills empty soil but never a planted tile', () => {
  const m = fresh();
  till(m, 1, 1); till(m, 3, 1);
  plant(m, 3, 1, 'daikon');
  assert.ok(untill(m, 1, 1));
  assert.equal(m.soil[m.i(1, 1)], 0);
  assert.equal(untill(m, 3, 1), false);
});

test('map state round-trips through serialize/restore', () => {
  const m = fresh();
  till(m, 1, 1); plant(m, 1, 1, 'komatsuna'); water(m, 1, 1);
  m.addObject({ type: 'weed', x: 4, y: 0, v: 2 });
  const data = JSON.parse(JSON.stringify(m.serialize()));
  const n = fresh();
  n.restore(data);
  assert.deepEqual(n.serialize(), m.serialize());
  assert.equal(n.objectAt(4, 0).type, 'weed');
});
