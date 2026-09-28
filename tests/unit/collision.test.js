import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameMap } from '../../src/world/gamemap.js';
import { moveBox, boxFree } from '../../src/world/collision.js';

const map = new GameMap({ id: 'c', ground: ['......', '..~...', '......', '......'] });

test('walls stop movement; free space allows it', () => {
  const p = { x: 24, y: 14 };             // tile (1, 0), feet near the bottom
  moveBox(map, p, 0, 8, 5, 6);            // into the water at (2,1)? no: column 1 is free
  assert.equal(p.y, 22);
  const q = { x: 8, y: 30 };
  moveBox(map, q, 30, 0, 5, 6);           // row 1 has water at x 32..48
  assert.ok(q.x + 5 <= 32, 'stopped at the water edge');
});

test('the map edge is solid', () => {
  assert.equal(boxFree(map, 3, 10, 5, 6), false);
  assert.equal(boxFree(map, 8, 10, 5, 6), true);
});

test('corner nudging slides past a corner the box only clips', () => {
  const p = { x: 26, y: 13 };             // just left of the water tile's column, clipping its top row
  const before = p.y;
  moveBox(map, p, 2, 0, 5, 6);
  assert.ok(p.x > 26 || p.y !== before, 'moved or slid');
});
