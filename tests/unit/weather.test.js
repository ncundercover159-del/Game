import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weatherFor, typhoonDays, WEATHER } from '../../src/systems/weather.js';
import { shippingValue } from '../../src/systems/day.js';
import { newSkills } from '../../src/systems/skills.js';
import { swingArea } from '../../src/systems/tools.js';
import { makeDoc, upgrade } from '../../src/core/save.js';
import '../../src/state.js';

test('weather is deterministic per seed and date, and valid for the season', () => {
  const t = { day: 9, season: 3, year: 2 };
  assert.equal(weatherFor(5, t), weatherFor(5, t));
  for (let d = 1; d <= 28; d++) {
    assert.ok(['snow', 'clear', 'cloudy', 'blizzard'].includes(weatherFor(5, { day: d, season: 3, year: 1 })));
    assert.ok(WEATHER[weatherFor(5, { day: d, season: 0, year: 1 })]);
  }
  assert.equal(weatherFor(99, { day: 1, season: 0, year: 1 }), 'clear', 'the first morning is always fine');
});

test('tsuyu dominates early summer; exactly two typhoon days each autumn', () => {
  const rainy = [...Array(10).keys()].filter((d) => weatherFor(3, { day: d + 1, season: 1, year: 1 }) === 'tsuyu').length;
  assert.ok(rainy >= 4);
  const days = [...Array(28).keys()].filter((d) => weatherFor(3, { day: d + 1, season: 2, year: 1 }) === 'typhoon').map((d) => d + 1);
  assert.deepEqual(days, typhoonDays(3, 1));
});

test('shipping pays full price with quality bonuses', () => {
  const r = shippingValue([{ id: 'daikon', n: 3, q: 0 }, { id: 'strawberry', n: 2, q: 2 }], newSkills());
  assert.equal(r.total, 3 * 40 + 2 * Math.floor(75 * 1.25));
  assert.equal(r.lines.length, 2);
});

test('charged swings cover a line of 3, a line of 5, then a 3x3 block', () => {
  assert.deepEqual(swingArea(5, 5, 5, 6, 0), [[5, 6]]);
  assert.deepEqual(swingArea(5, 5, 5, 6, 1), [[5, 6], [5, 7], [5, 8]]);
  assert.equal(swingArea(5, 5, 6, 5, 2).length, 5);
  assert.equal(swingArea(5, 5, 6, 5, 3).length, 9);
});

test('M1 (v1) saves migrate through every version to the current one', () => {
  const v1 = makeDoc({ seed: 7, cal: { day: 3, season: 0, year: 1, minutes: 400 }, money: 10 }, {});
  v1.version = 1;
  const up = upgrade(v1);
  assert.equal(up.version, 6);
  assert.ok(WEATHER[up.state.weather] && WEATHER[up.state.tomorrow]);
  assert.deepEqual(up.state.shipped, []);
  assert.equal(up.state.tiers.hoe, 0);
  assert.deepEqual(up.state.bonds, {});
  assert.equal(up.state.virtues.jin, 0);
  assert.equal(up.state.skills.farming.xp, 0);
  assert.equal(up.state.hp, 100);
  assert.equal(up.state.difficulty, 'standard');
  assert.deepEqual(up.state.caves.lanterns, []);
  assert.equal(up.state.flags.needs_katana, true);
  assert.deepEqual(up.state.romance, { engaged: null, spouse: null });
  assert.equal(up.state.construction, null);
});
