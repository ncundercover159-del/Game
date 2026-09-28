import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameMap, G } from '../../src/world/gamemap.js';
import { till, untill, water, plant, harvest, growNight, cropAt, isRipe, canTill, digChannel, coverSoil, plantProblem, rainWater, typhoonDamage, clearDead } from '../../src/systems/farming.js';
import { computeFlow, isFlooded, SOIL } from '../../src/systems/irrigation.js';
import { stageOf, RIPE, CROPS } from '../../src/data/crops.js';
import { Rng } from '../../src/core/rng.js';

const def = { id: 't', farmable: true, ground: ['.....', '.,,,.', '.,~,.', '.....'] };
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
  assert.deepEqual(growNight(m), { grew: 1, withered: 0 });
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
  const { days, regrow } = CROPS.strawberry;
  assert.equal(berry.growth, days - regrow, `regrow starts ${regrow} days before ripe`);
  for (let d = 0; d < regrow; d++) { water(m, 3, 1); growNight(m); }
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

test('a harvest can yield several (rice gives 2-3)', () => {
  const m = new GameMap({ id: 'p', farmable: true, ground: ['~....', '.....'] });
  till(m, 1, 0);
  assert.ok(isFlooded(m, 1, 0), 'next to the pond');
  assert.ok(plant(m, 1, 0, 'rice', 'spring'));
  m.crops.get(m.i(1, 0)).growth = 8;
  const got = harvest(m, 1, 0, new Rng(1));
  assert.equal(got.item, 'rice');
  assert.ok(got.n >= 2 && got.n <= 3);
});

test('seeds refuse the wrong season, dry soil for rice, bare soil for winter crops', () => {
  const m = new GameMap({ id: 'p', farmable: true, ground: ['.....', '.....'] });
  till(m, 1, 0);
  assert.equal(plantProblem(m, 1, 0, 'nasu', 'spring'), 'wrong_season');
  assert.equal(plantProblem(m, 1, 0, 'rice', 'spring'), 'needs_paddy');
  assert.equal(plantProblem(m, 1, 0, 'hakusai', 'winter'), 'needs_cover');
  assert.ok(coverSoil(m, 1, 0));
  assert.equal(plantProblem(m, 1, 0, 'hakusai', 'winter'), null);
});

test('crops wither when the season they need ends; any tool clears them', () => {
  const m = new GameMap({ id: 'p', farmable: true, ground: ['.....'] });
  till(m, 1, 0); plant(m, 1, 0, 'daikon', 'spring');
  till(m, 3, 0); plant(m, 3, 0, 'rice', null);
  assert.deepEqual(growNight(m, 'summer').withered, 1, 'daikon dies, rice lives on in summer');
  assert.equal(cropAt(m, 1, 0).dead, true);
  assert.equal(isRipe(cropAt(m, 1, 0)), false);
  assert.ok(clearDead(m, 1, 0));
  assert.equal(cropAt(m, 1, 0), null);
});

test('rain waters tilled soil; typhoons spare straw-covered beds', () => {
  const m = new GameMap({ id: 'p', farmable: true, ground: ['......'] });
  for (let x = 0; x < 6; x++) { till(m, x, 0); plant(m, x, 0, 'daikon'); }
  rainWater(m);
  assert.ok([0, 1, 2, 3, 4, 5].every((x) => m.wet[x] === 1));
  for (let x = 0; x < 6; x++) coverSoil(m, x, 0);
  assert.equal(typhoonDamage(m, new Rng(2), 1), 0);
});

test('only farmable maps can be tilled', () => {
  const m = new GameMap({ id: 'v', ground: ['...'] });
  assert.equal(canTill(m, 1, 0), false);
  assert.equal(till(m, 1, 0), false);
});
