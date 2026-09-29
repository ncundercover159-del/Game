import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHOPS } from '../../src/data/shops.js';
import { itemDef } from '../../src/data/items.js';

test('everything every shop stocks, on every day of the year, has a real price', () => {
  const bad = new Set();
  for (const [shop, def] of Object.entries(SHOPS).filter(([, d]) => d.stock)) {
    for (const season of ['spring', 'summer', 'autumn', 'winter']) {
      for (let day = 0; day < 112; day++) {
        const g = { seed: 7, dayIndex: day, recipes: [], flags: {}, construction: null, inventory: { size: 12 + (day % 2) * 12 } };
        for (const s of def.stock(season, day % 7, g)) {
          const p = itemDef(s.id).price * s.mult;
          if (!Number.isFinite(p) || p <= 0) bad.add(`${shop}: ${s.id} (${p})`);
        }
      }
    }
  }
  assert.deepEqual([...bad], []);
});
