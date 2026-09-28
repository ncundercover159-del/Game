import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blobMasks, canonical9, mask9At, BIT, grassTile, landTile, waterTile, tilledTile, pathTile, variantAt } from '../../src/art/terrain.js';

test('exactly 47 canonical blob masks', () => {
  assert.equal(blobMasks().length, 47);
});

test('canonical reduction ignores diagonals without both orthogonal neighbours', () => {
  const lone = (1 << BIT.C) | (1 << BIT.NE);
  assert.equal(canonical9(lone), 1 << BIT.C);
  const full = 511;
  assert.equal(canonical9(full), 511);
  for (const m of blobMasks()) assert.equal(canonical9(m), m, 'idempotent');
});

test('mask9At samples the 3x3 neighbourhood', () => {
  const pred = (x, y) => x >= 0 && y >= 0;
  assert.equal(mask9At(pred, 0, 0), (1 << BIT.C) | (1 << BIT.E) | (1 << BIT.S) | (1 << BIT.SE));
});

test('every generator yields a 16x16 tile; interior tiles are fully opaque', () => {
  for (const gen of [(m) => grassTile(m, 0), (m) => landTile(m, 3), (m) => tilledTile(m, 1, true), (m) => pathTile(m, 2)]) {
    for (const m of blobMasks()) {
      const g = gen(m);
      assert.equal(g.w, 16);
      assert.equal(g.h, 16);
    }
    assert.ok(gen(511).px.every((c) => c > 0));
  }
  assert.ok(waterTile(511, 0, 2).px.every((c) => c > 0));
  assert.equal(variantAt(5, 6), (5 & 3) | ((6 & 3) << 2));
});
