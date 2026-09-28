import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEART_EVENTS, heartEventFor, heartFlag } from '../../src/systems/hearts.js';
import { parseScript } from '../../src/systems/script.js';
import { NPCS } from '../../src/data/npcs.js';
import { ITEMS } from '../../src/data/items.js';
import { DISHES } from '../../src/data/recipes.js';
import { MAPS } from '../../src/maps/index.js';
import { navMap } from '../../src/systems/nav.js';
import { newBond, addBond, ROMANCE_CAP } from '../../src/systems/bonds.js';

test('every villager has five heart events at 2, 4, 6, 8 and 10 hearts', () => {
  for (const id of Object.keys(NPCS)) {
    const evs = HEART_EVENTS[id];
    assert.ok(evs, id);
    assert.deepEqual(evs.map((e) => e.h), [2, 4, 6, 8, 10], id);
  }
});

test('every heart scene parses, stages on walkable tiles, and gives real things', () => {
  for (const [id, evs] of Object.entries(HEART_EVENTS)) {
    for (const e of evs) {
      const where = `${id} ${e.h}`;
      assert.ok(MAPS[e.map], `${where}: map ${e.map}`);
      assert.ok(e.from < e.to, where);
      const { ops } = parseScript(e.script);
      const nav = navMap(e.map);
      for (const o of ops) {
        if (o.op === 'placePlayer' || o.op === 'placeNpc') assert.ok(!nav.solid(o.tx, o.ty), `${where}: ${o.op} ${o.tx},${o.ty} solid on ${e.map}`);
        if (o.op === 'placeNpc' || o.op === 'say' && o.who) assert.ok(NPCS[o.npc || o.who], `${where}: who ${o.npc || o.who}`);
        if (o.op === 'give' || o.op === 'take') assert.ok(ITEMS[o.item], `${where}: item ${o.item}`);
        if (o.op === 'learn') assert.ok(DISHES[o.dish], `${where}: dish ${o.dish}`);
        if (o.op === 'bond') assert.ok(NPCS[o.npc], `${where}: bond ${o.npc}`);
      }
      assert.ok(ops.some((o) => o.op === 'placeNpc' && o.npc === id), `${where}: the villager appears`);
    }
  }
});

/** A stand-in game on a given day and minute with some bonds. */
const game = (bonds, { minutes = 600, day = 3, flags = {} } = {}) => ({
  bonds, flags, cal: { minutes }, dayIndex: day, seasonId: 'spring', rain: false, weather: 'clear',
});
const bond = (hearts, extra = {}) => ({ ...newBond(), met: true, pts: hearts * 250, ...extra });

test('heart scenes play in order, at their place and hour, once the hearts are there', () => {
  assert.equal(heartEventFor(game({ genzo: bond(1) }), 'kajiya'), null, 'not enough hearts');
  const first = heartEventFor(game({ genzo: bond(3) }), 'kajiya');
  assert.equal(first.npc, 'genzo');
  assert.equal(first.event.h, 2);
  assert.equal(heartEventFor(game({ genzo: bond(3) }, { minutes: 300 }), 'kajiya'), null, 'wrong hour');
  assert.equal(heartEventFor(game({ genzo: bond(3) }), 'chaya'), null, 'wrong place');
  // Seen the first: the second waits for four hearts, on the shrine, on Nichi.
  const seen = { [heartFlag('genzo', 2)]: true };
  assert.equal(heartEventFor(game({ genzo: bond(9) }, { flags: seen, day: 3, minutes: 700 }), 'shrine'), null, 'only on Nichi');
  assert.equal(heartEventFor(game({ genzo: bond(9) }, { flags: seen, day: 6, minutes: 700 }), 'shrine').event.h, 4);
});

test('romance: eight hearts until courting, and the tenth scene only when courting', () => {
  const b = { ...newBond(), cap: ROMANCE_CAP };
  addBond(b, 5000);
  assert.equal(b.pts, ROMANCE_CAP);
  const flags = Object.fromEntries([2, 4, 6, 8].map((h) => [heartFlag('tomoe', h), true]));
  assert.equal(heartEventFor(game({ tomoe: bond(10) }, { flags, minutes: 1200 }), 'shrine'), null);
  assert.equal(heartEventFor(game({ tomoe: bond(10, { courting: true }) }, { flags, minutes: 1200 }), 'shrine').event.h, 10);
});

test('villagers out of the valley have no scenes', () => {
  // Sakuya is only here on market days; her first scene needs one.
  assert.equal(heartEventFor(game({ sakuya: bond(3) }, { day: 0 }), 'village'), null);
  assert.equal(heartEventFor(game({ sakuya: bond(3) }, { day: 3 }), 'village').npc, 'sakuya');
});
