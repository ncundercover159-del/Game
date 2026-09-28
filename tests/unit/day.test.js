import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sleepRestore, passOutLoss } from '../../src/systems/day.js';

test('sleep before midnight restores fully; later restores less; passing out restores half', () => {
  assert.equal(sleepRestore(200, 22 * 60, false), 200);
  assert.equal(sleepRestore(200, 24 * 60, false), 200);
  assert.equal(sleepRestore(200, 25 * 60, false), 175);
  assert.equal(sleepRestore(200, 26 * 60, false), 150);
  assert.equal(sleepRestore(200, 26 * 60, true), 100);
});

test('passing out costs 10% of money, capped at 1000', () => {
  assert.equal(passOutLoss(500), 50);
  assert.equal(passOutLoss(0), 0);
  assert.equal(passOutLoss(50000), 1000);
});
