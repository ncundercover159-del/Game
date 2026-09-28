import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newBond, hearts, tierOf, talk, giveGift, giftBlock, decay, taste, pickLine, parseLine, isBirthday } from '../../src/systems/bonds.js';
import { NPCS, BOND } from '../../src/data/npcs.js';
import { ITEMS } from '../../src/data/items.js';
import DIALOGUE from '../../src/data/dialogue/index.js';
import { EXPRESSIONS } from '../../src/art/portraits.js';

test('hearts and tiers', () => {
  assert.equal(hearts(249), 0);
  assert.equal(hearts(250), 1);
  assert.equal(hearts(99999), 10);
  assert.deepEqual([0, 500, 1000, 1500, 2000, 2500].map(tierOf), [0, 1, 2, 3, 4, 4]);
});

test('talking earns points once a day', () => {
  const b = newBond();
  assert.ok(talk(b, 3));
  assert.ok(!talk(b, 3));
  assert.ok(talk(b, 4));
  assert.equal(b.pts, 2 * BOND.talk);
});

test('gifts: tastes, one a day, two a week, birthdays count eight times', () => {
  const b = newBond();
  assert.equal(taste('genzo', 'iron_bar'), 'loved');
  assert.equal(taste('genzo', 'hay'), 'hated');
  assert.equal(taste('genzo', 'wood'), 'neutral');
  assert.equal(giveGift(b, 'genzo', 'iron_bar', 7, false).delta, 80);
  assert.equal(giftBlock(b, 7), 'today');
  assert.equal(giftBlock(b, 8), null);
  giveGift(b, 'genzo', 'wood', 8, false);
  assert.equal(giftBlock(b, 9), 'week');
  assert.equal(giftBlock(b, 14), null, 'a new week');
  assert.equal(giveGift(b, 'genzo', 'daikon', 14, true).delta, 45 * 8);
  const hater = newBond();
  giveGift(hater, 'genzo', 'hay', 0, false);
  assert.equal(hater.pts, 0, 'points never go below zero');
});

test('neglect decays a bond after a week without a word', () => {
  const b = newBond();
  talk(b, 0);
  const bonds = { genzo: b };
  decay(bonds, 5);
  assert.equal(b.pts, BOND.talk);
  decay(bonds, 9);
  assert.equal(b.pts, BOND.talk - BOND.decay);
});

test('every villager has complete data: 5 tiers of 6+ lines, gifts, conditionals, real items', () => {
  for (const [id, npc] of Object.entries(NPCS)) {
    const d = DIALOGUE[id];
    assert.ok(d, id);
    assert.equal(d.tiers.length, 5, id);
    for (const tier of d.tiers) assert.ok(tier.length >= 6, `${id} tier`);
    assert.ok(d.when.length >= 6, `${id} conditionals`);
    for (const k of ['loved', 'liked', 'neutral', 'disliked', 'hated']) assert.ok(d.gift[k], `${id} gift ${k}`);
    assert.ok(d.birthday && d.intro);
    for (const list of Object.values(npc.gifts)) for (const item of list) assert.ok(ITEMS[item], `${id}: ${item}`);
    const all = [d.intro, d.birthday, ...d.tiers.flat(), ...d.when.map((w) => w.text), ...Object.values(d.gift)];
    for (const line of all) assert.ok(EXPRESSIONS.includes(parseLine(line).face), `${id}: bad face in "${line.slice(0, 30)}"`);
  }
});

test('line choice: intro first, then deterministic per day, conditionals when they apply', () => {
  const b = newBond();
  const ctx = { season: 'spring', weekday: 0, rain: false, minutes: 600, place: 'kajiya', stop: null, flags: {}, seed: 1, day: 0 };
  assert.equal(pickLine('genzo', b, ctx).text, parseLine(DIALOGUE.genzo.intro).text);
  talk(b, 0);
  const a = pickLine('genzo', b, { ...ctx, day: 5 });
  assert.deepEqual(pickLine('genzo', b, { ...ctx, day: 5 }), a, 'same line all day');
  const seen = new Set();
  for (let day = 0; day < 60; day++) seen.add(pickLine('genzo', b, { ...ctx, day, rain: true }).text);
  assert.ok(seen.has(DIALOGUE.genzo.when.find((w) => w.rain).text), 'the rain line comes up on rainy days');
  assert.ok(seen.size >= 5, 'variety across days');
});

test('birthdays', () => {
  assert.ok(isBirthday('okiku', { season: 0, day: 9 }));
  assert.ok(!isBirthday('okiku', { season: 1, day: 9 }));
});
