import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waterKind, fishFor, rollCatch, Reel, TRACK, trapsNight } from '../../src/systems/fishing.js';
import { FISH, JUNK } from '../../src/data/fish.js';
import { ITEMS } from '../../src/data/items.js';
import { navMap } from '../../src/systems/nav.js';
import { GameMap } from '../../src/world/gamemap.js';
import { Rng } from '../../src/core/rng.js';

const ctx = (o = {}) => ({ season: 'summer', minutes: 600, weather: 'clear', cal: { day: 3, season: 1 }, ...o });

test('every fish and junk item exists; there are at least 24 fish', () => {
  assert.ok(Object.keys(FISH).length >= 24);
  for (const id of [...Object.keys(FISH), ...Object.keys(JUNK)]) assert.ok(ITEMS[id], id);
});

test('water kinds come from map regions', () => {
  assert.equal(waterKind(navMap('farm'), 50, 20), 'pond');
  assert.equal(waterKind(navMap('farm'), 10, 45), 'river');
  assert.equal(waterKind(navMap('grove'), 27, 8), 'falls');
  assert.equal(waterKind(navMap('grove'), 20, 11), 'pool');
  assert.equal(waterKind(navMap('grove'), 23, 30), 'stream');
  assert.equal(waterKind(navMap('farm'), 29, 12), null, 'land is not water');
});

test('something bites in every water in every season during the day', () => {
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    for (const where of ['river', 'pond', 'pool', 'falls', 'stream']) {
      assert.ok(fishFor(where, ctx({ season })).length, `${where} in ${season}`);
    }
  }
});

test('hours wrap past midnight, rain fish need rain, the Moon Carp needs everything', () => {
  assert.ok(fishFor('river', ctx({ minutes: 1500 })).includes('unagi'), 'eels at 01:00');
  assert.ok(!fishFor('river', ctx({ minutes: 600 })).includes('unagi'));
  assert.ok(!fishFor('pond', ctx()).includes('namazu'));
  assert.ok(fishFor('pond', ctx({ weather: 'rain' })).includes('namazu'));
  const moon = { season: 'autumn', minutes: 1380, weather: 'clear', cal: { day: 15, season: 2 } };
  assert.ok(fishFor('falls', moon).includes('tsukigoi'));
  assert.ok(!fishFor('falls', { ...moon, cal: { day: 14, season: 2 } }).includes('tsukigoi'));
  assert.ok(!fishFor('falls', { ...moon, weather: 'rain' }).includes('tsukigoi'));
  assert.ok(!fishFor('falls', { ...moon, caught: { tsukigoi: true } }).includes('tsukigoi'), 'only once');
});

test('catches favour easy fish and bring up some junk', () => {
  const r = new Rng(4), ids = fishFor('pond', ctx({ season: 'spring' }));
  const n = {};
  for (let i = 0; i < 2000; i++) { const id = rollCatch(r, ids, 1); n[id] = (n[id] || 0) + 1; }
  assert.ok((n.funa || 0) > (n.tanago || 0));
  assert.ok(Object.keys(JUNK).some((j) => n[j] > 50));
});

test('the reel is won by tracking the fish and lost by letting go', () => {
  const track = (id, seed) => {
    const reel = new Reel(id, { level: 3, rng: new Rng(seed) });
    for (let t = 0; t < 60 && !reel.done; t += 1 / 60) reel.step(1 / 60, reel.fish > reel.bar + reel.barH / 2);
    return reel.done;
  };
  let wins = 0;
  for (let s = 1; s <= 10; s++) if (track('funa', s) === 'caught') wins++;
  assert.ok(wins >= 8, `tracked an easy fish ${wins}/10`);
  const idle = new Reel('wakasagi', { level: 1, rng: new Rng(1) });
  for (let t = 0; t < 60 && !idle.done; t += 1 / 60) idle.step(1 / 60, false);
  assert.equal(idle.done, 'lost');
  const steady = new Reel('funa', { level: 1, steady: true, rng: new Rng(1) });
  assert.ok(steady.barH > new Reel('funa', { level: 1, rng: new Rng(1) }).barH);
  assert.ok(steady.barH < TRACK);
});

test('traps fill overnight, always with the Trapper perk, and keep their catch', () => {
  const m = new GameMap({ id: 't', ground: ['~~~', '...'] });
  m.addObject({ type: 'trap', x: 1, y: 0, v: 0 });
  trapsNight(m, new Rng(1), true);
  const got = m.objects[0].catch;
  assert.ok(got && ITEMS[got]);
  trapsNight(m, new Rng(2), true);
  assert.equal(m.objects[0].catch, got, 'an unemptied trap keeps what it has');
});
