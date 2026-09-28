import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hitDamage, damageTaken, defeatCost, regenKi, parryWindow, critChance, kiMax, KI_MAX, PARRY, weaponFor } from '../../src/systems/combat.js';
import { virtueTier, effectText, buyMult, talkBonus, rewardMult, petMult, decayMult } from '../../src/systems/virtues.js';
import { WEAPONS, SMELT } from '../../src/data/weapons.js';
import { ENEMIES, DIFFICULTY } from '../../src/data/enemies.js';
import { ITEMS } from '../../src/data/items.js';
import { newSkills } from '../../src/systems/skills.js';
import { newVirtues } from '../../src/data/virtues.js';
import { Rng } from '../../src/core/rng.js';

const noCrit = { next: () => 0.99 };
const alwaysCrit = { next: () => 0 };
const ctx = (o = {}) => ({ skills: newSkills(), virtues: newVirtues(), rng: noCrit, ...o });
const katana = WEAPONS.katana_tetsu;

test('light hits, the third of a combo, heavies and crits scale damage', () => {
  const base = hitDamage(katana, { combo: 0 }, {}, ctx()).dmg;
  assert.equal(base, katana.dmg);
  assert.equal(hitDamage(katana, { combo: 2 }, {}, ctx()).dmg, Math.round(katana.dmg * 1.5));
  assert.equal(hitDamage(katana, { combo: 0, heavy: true }, {}, ctx()).dmg, Math.round(katana.dmg * 2.2));
  const c = hitDamage(katana, { combo: 0 }, {}, ctx({ rng: alwaysCrit }));
  assert.ok(c.crit && c.dmg === katana.dmg * 2);
  assert.ok(hitDamage(katana, { combo: 0, counter: true }, {}, ctx()).crit, 'a counter after a parry always crits');
});

test('a guard turns light blows from the front, not heavies, counters or blows from behind', () => {
  const g = { guard: true };
  assert.ok(hitDamage(katana, { combo: 0 }, g, ctx()).blocked);
  assert.ok(!hitDamage(katana, { combo: 0, heavy: true }, g, ctx()).blocked);
  assert.ok(!hitDamage(katana, { combo: 0, counter: true }, g, ctx()).blocked);
  assert.ok(!hitDamage(katana, { combo: 0 }, { guard: true, facingAway: true }, ctx()).blocked);
});

test('elements bite harder against a weakness; level and Fighter add damage', () => {
  const plain = hitDamage(WEAPONS.hisui, { combo: 0 }, {}, ctx()).dmg;
  assert.equal(hitDamage(WEAPONS.hisui, { combo: 0 }, { weak: 'spirit' }, ctx()).dmg, Math.round(WEAPONS.hisui.dmg * 1.5));
  const skills = newSkills();
  skills.sword.xp = 3200;
  skills.sword.perks.push('fighter');
  assert.ok(hitDamage(WEAPONS.hisui, { combo: 0 }, {}, ctx({ skills })).dmg > plain * 1.4);
});

test('damage taken follows difficulty and Unmoving Mountain', () => {
  const s = newSkills();
  assert.equal(damageTaken(10, 'standard', s), 10);
  assert.equal(damageTaken(10, 'relaxed', s), 6);
  assert.ok(damageTaken(10, 'warrior', s) > 10);
  s.sword.perks.push('mountain');
  assert.equal(damageTaken(20, 'standard', s), 15);
});

test('Ki waits after spending, then refills to its maximum; Yū raises the maximum', () => {
  assert.equal(regenKi(50, 100, 0.2, 0.5), 50);
  assert.ok(regenKi(50, 100, 1, 0.5) > 50);
  assert.equal(regenKi(99, 100, 1, 1), 100);
  const v = newVirtues();
  assert.equal(kiMax(v), KI_MAX);
  v.yu = 50;
  assert.equal(kiMax(v), KI_MAX + 10);
});

test('the parry window is about 150 ms; Guardian widens it', () => {
  const s = newSkills();
  assert.equal(parryWindow(s), PARRY.window);
  assert.ok(PARRY.window >= 0.12 && PARRY.window <= 0.18);
  s.sword.perks.push('guardian');
  assert.ok(parryWindow(s) > PARRY.window);
});

test('Kensei and Meiyo raise the crit chance', () => {
  const s = newSkills(), v = newVirtues();
  const base = critChance(katana, s, v);
  s.sword.perks.push('kensei');
  v.meiyo = 100;
  assert.ok(critChance(katana, s, v) > base + 0.09);
});

test('a defeat costs mon (capped) and a few stacks, never tools or weapons; Relaxed costs nothing', () => {
  const slots = [{ id: 'hoe', n: 1 }, { id: 'katana_rusted', n: 1 }, { id: 'wood', n: 30 }, { id: 'stone', n: 5 }, { id: 'onigiri', n: 2 }, null];
  const std = defeatCost(5000, slots, 'standard', new Rng(3));
  assert.equal(std.mon, 500);
  assert.equal(std.slots.length, DIFFICULTY.standard.items);
  for (const i of std.slots) assert.ok(!['hoe', 'katana_rusted'].includes(slots[i].id));
  assert.equal(defeatCost(1e6, slots, 'standard', new Rng(3)).mon, DIFFICULTY.standard.lossCap);
  const relaxed = defeatCost(5000, slots, 'relaxed', new Rng(3));
  assert.deepEqual(relaxed, { mon: 0, slots: [] });
});

test('every weapon, forge need, smelt input and enemy drop is a real item', () => {
  for (const [id, w] of Object.entries(WEAPONS)) {
    assert.equal(ITEMS[id].kind, 'weapon', id);
    for (const [i] of w.forge?.items || []) assert.ok(ITEMS[i], `${id} needs ${i}`);
  }
  for (const [id, s] of Object.entries(SMELT)) { assert.ok(ITEMS[id], id); for (const [i] of s.in) assert.ok(ITEMS[i], i); }
  for (const [id, e] of Object.entries(ENEMIES)) for (const [i] of e.drops) assert.ok(ITEMS[i], `${id} drops ${i}`);
  assert.equal(weaponFor('hoe'), null);
  assert.ok(weaponFor('sickle'));
});

test('virtues give a benefit per 25 points, capped at four tiers', () => {
  const v = newVirtues();
  assert.equal(effectText(v, 'gi'), null);
  Object.assign(v, { gi: 25, rei: 50, makoto: 75, jin: 100, chugi: 100 });
  assert.equal(virtueTier(v, 'gi'), 1);
  assert.equal(virtueTier(v, 'jin'), 4);
  assert.equal(buyMult(v), 0.98);
  assert.equal(talkBonus(v), 4);
  assert.equal(rewardMult(v), 1.15);
  assert.equal(petMult(v), 1.4);
  assert.equal(decayMult(v), 0);
  assert.match(effectText(v, 'gi'), /2%/);
});
