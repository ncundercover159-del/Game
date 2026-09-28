import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSkills, levelOf, gainXp, progress, hasPerk, priceMult, sellValue, addBuff, expireBuffs, buffAmount } from '../../src/systems/skills.js';
import { LEVEL_XP, PERKS, SKILL_IDS } from '../../src/data/skills.js';
import { rollQuality } from '../../src/systems/farming.js';
import { Rng } from '../../src/core/rng.js';

test('levels climb with XP and cap at 10', () => {
  assert.equal(levelOf(0), 1);
  assert.equal(levelOf(LEVEL_XP[2] - 1), 1);
  assert.equal(levelOf(LEVEL_XP[2]), 2);
  assert.equal(levelOf(1e9), 10);
  assert.equal(progress(1e9), 1);
  assert.ok(progress(50) > 0.49 && progress(50) < 0.51);
});

test('gainXp reports every level crossed, including Lv 5 for perks', () => {
  const s = newSkills();
  assert.deepEqual(gainXp(s, 'farming', LEVEL_XP[5]), [2, 3, 4, 5]);
  assert.deepEqual(gainXp(s, 'farming', 1), []);
});

test('every skill offers two perks at Lv 5 and two at Lv 10, all distinct', () => {
  const ids = [];
  for (const id of SKILL_IDS) {
    assert.equal(PERKS[id].length, 2);
    for (const pair of PERKS[id]) { assert.equal(pair.length, 2); ids.push(...pair.map((p) => p.id)); }
  }
  assert.equal(new Set(ids).size, ids.length);
});

test('perks raise the right sell prices', () => {
  const s = newSkills();
  assert.equal(priceMult(s, 'daikon'), 1);
  s.farming.perks.push('tiller');
  assert.ok(hasPerk(s, 'tiller'));
  assert.equal(priceMult(s, 'daikon'), 1.1);
  assert.equal(priceMult(s, 'wood'), 1);
  assert.equal(sellValue(s, 'daikon', 0), 44);
  s.mining.perks.push('smelter');
  assert.equal(priceMult(s, 'iron_bar'), 1.5);
});

test('quality bonus shifts harvest odds upward', () => {
  const count = (bonus) => { const r = new Rng(5); let n = 0; for (let i = 0; i < 4000; i++) if (rollQuality(r, bonus) > 0) n++; return n; };
  assert.ok(count(0.2) > count(0) * 2);
});

test('buffs refresh, stack by strength and expire', () => {
  const b = [];
  addBuff(b, 'speed', 0.1, 600);
  addBuff(b, 'speed', 0.05, 900);
  assert.equal(b.length, 1);
  assert.deepEqual([buffAmount(b, 'speed'), b[0].until], [0.1, 900]);
  expireBuffs(b, 899);
  assert.equal(b.length, 1);
  expireBuffs(b, 900);
  assert.equal(buffAmount(b, 'speed'), 0);
});
