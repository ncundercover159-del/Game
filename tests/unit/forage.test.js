import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSpots, forageFor, digFind } from '../../src/systems/forage.js';
import { navMap } from '../../src/systems/nav.js';
import { GameMap } from '../../src/world/gamemap.js';
import { decorate } from '../../src/world/populate.js';
import { MAPS } from '../../src/maps/index.js';
import { FORAGE, ARTIFACTS } from '../../src/data/forage.js';
import { ITEMS } from '../../src/data/items.js';
import { Rng } from '../../src/core/rng.js';

const fresh = (id) => { const m = new GameMap(MAPS[id]); decorate(m); return m; };

test('every season has forage in the grove, and every forage item is an item', () => {
  for (const s of ['spring', 'summer', 'autumn', 'winter']) assert.ok(forageFor('grove', s).length >= 3, s);
  for (const id of [...Object.keys(FORAGE), ...Object.keys(ARTIFACTS)]) assert.ok(ITEMS[id], id);
});

test('spots are seeded by day, respect what was taken, and sit on open ground', () => {
  const a = spawnSpots(fresh('grove'), { seed: 3, day: 9, seasonId: 'spring' }).map((o) => [o.x, o.y, o.kind]);
  const b = spawnSpots(fresh('grove'), { seed: 3, day: 9, seasonId: 'spring' }).map((o) => [o.x, o.y, o.kind]);
  assert.deepEqual(a, b);
  assert.ok(a.filter((s) => s[2] !== 'dig').length >= 8);
  const taken = [`grove:${a[0][0]},${a[0][1]}`];
  const c = spawnSpots(fresh('grove'), { seed: 3, day: 9, seasonId: 'spring', taken }).map((o) => [o.x, o.y]);
  assert.ok(!c.some(([x, y]) => x === a[0][0] && y === a[0][1]));
  const m = navMap('grove');
  for (const [x, y] of a) assert.ok(!m.solid(x, y));
});

test('matsutake only grows at the roots of pines', () => {
  for (let day = 0; day < 20; day++) {
    const m = fresh('shrine');
    for (const o of spawnSpots(m, { seed: 1, day, seasonId: 'autumn' }).filter((x) => x.kind === 'matsutake')) {
      let pine = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (m.objectAt(o.x + dx, o.y + dy)?.kind === 'pine') pine = true;
      assert.ok(pine);
    }
  }
});

test('dig spots turn up artefacts (and winter yams)', () => {
  const r = new Rng(2);
  const seen = new Set();
  for (let i = 0; i < 300; i++) seen.add(digFind(r, 'spring'));
  assert.deepEqual([...seen].sort(), Object.keys(ARTIFACTS).sort());
  let yams = 0;
  for (let i = 0; i < 200; i++) if (digFind(r, 'winter') === 'yamaimo') yams++;
  assert.ok(yams > 30);
});
