import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng, hash, valueNoise } from '../../src/core/rng.js';
import { GameMap } from '../../src/world/gamemap.js';
import { decorate, populate } from '../../src/world/populate.js';
import farm from '../../src/maps/farm.js';

test('same seed, same sequence; state can be saved and resumed', () => {
  const a = new Rng(42), b = new Rng(42);
  const seqA = [...Array(5)].map(() => a.next());
  assert.deepEqual(seqA, [...Array(5)].map(() => b.next()));
  const s = a.state();
  const next = a.int(1, 6);
  const c = new Rng(1);
  c.setState(s);
  assert.equal(c.int(1, 6), next);
  for (let i = 0; i < 200; i++) { const v = a.int(3, 5); assert.ok(v >= 3 && v <= 5); }
});

test('hash and noise are deterministic and noise tiles with its period', () => {
  assert.equal(hash(1, 2, 3, 4), hash(1, 2, 3, 4));
  assert.notEqual(hash(1, 2, 3, 4), hash(2, 1, 3, 4));
  assert.equal(valueNoise(0, 5, 4, 16, 9), valueNoise(16, 5, 4, 16, 9));
});

test('the farm overgrowth is identical for the same seed and differs between seeds', () => {
  const build = (seed) => { const m = new GameMap(farm); decorate(m); populate(m, seed); return JSON.stringify(m.serialize().objects); };
  assert.equal(build(7), build(7));
  assert.notEqual(build(7), build(8));
});
