import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROMANCE, NOT_YET } from '../../src/data/romance.js';
import { NPCS, routeFor } from '../../src/data/npcs.js';
import { MAPS, fitHouse } from '../../src/maps/index.js';
import { HOUSE_PLAN } from '../../src/maps/interiors.js';
import { navMap, forgetNav } from '../../src/systems/nav.js';
import { parseScript } from '../../src/systems/script.js';
import { newBond, pickLine, isGiftable, addBond } from '../../src/systems/bonds.js';
import { romanceCheck, court, engage, weddingDue, marry, newRomance, spouseRoute, weddingScript, partner } from '../../src/systems/romance.js';

const ROMANCEABLE = Object.keys(NPCS).filter((id) => NPCS[id].romance);

test('everyone you can court has courting, vow and six married lines', () => {
  assert.deepEqual(Object.keys(ROMANCE).sort(), ROMANCEABLE.sort());
  for (const [id, r] of Object.entries(ROMANCE)) {
    assert.ok(r.court && r.vow, id);
    assert.equal(r.spouse.length, 6, id);
  }
  for (const k of ['court', 'vowHearts', 'vowHouse', 'other', 'taken']) assert.ok(NOT_YET[k], k);
});

/** A stand-in game with some bonds (in hearts). */
const game = (hearts, { flags = {} } = {}) => ({
  bonds: Object.fromEntries(Object.entries(hearts).map(([id, h]) => [id, { ...newBond(), met: true, pts: h * 250 }])),
  romance: newRomance(), flags,
});

test('the Red Thread courts at eight hearts, only someone who could say yes, and only one at a time', () => {
  assert.deepEqual(romanceCheck(game({ genzo: 10 }), 'genzo', 'red_thread'), { ok: false, why: 'other' });
  assert.deepEqual(romanceCheck(game({ tomoe: 7 }), 'tomoe', 'red_thread'), { ok: false, why: 'court' });
  const g = game({ tomoe: 8, rin: 9 });
  assert.equal(romanceCheck(g, 'tomoe', 'red_thread').ok, true);
  court(g.bonds.tomoe);
  assert.equal(partner(g.bonds), 'tomoe');
  assert.deepEqual(romanceCheck(g, 'rin', 'red_thread'), { ok: false, why: 'taken' });
  assert.deepEqual(romanceCheck(g, 'tomoe', 'red_thread'), { ok: false, why: null }, 'already courting: just talk');
  // Courting lifts the eight-heart ceiling.
  g.bonds.tomoe.cap = 2000;
  court(g.bonds.tomoe);
  addBond(g.bonds.tomoe, 1000);
  assert.equal(g.bonds.tomoe.pts, 2500, 'past eight hearts, to ten');
  assert.equal(isGiftable('red_thread'), false, 'never handed over as an ordinary gift');
});

test('the Shrine Vow needs courting, ten hearts and the extended farmhouse; the wedding is three days on', () => {
  const g = game({ ume: 10, kaito: 10 });
  assert.equal(romanceCheck(g, 'ume', 'shrine_vow').why, 'other', 'not courting');
  court(g.bonds.ume);
  g.bonds.ume.pts = 9 * 250;
  assert.equal(romanceCheck(g, 'ume', 'shrine_vow').why, 'vowHearts');
  g.bonds.ume.pts = 10 * 250;
  assert.equal(romanceCheck(g, 'ume', 'shrine_vow').why, 'vowHouse');
  g.flags.house_upgraded = true;
  assert.equal(romanceCheck(g, 'ume', 'shrine_vow').ok, true);
  assert.equal(romanceCheck(g, 'kaito', 'shrine_vow').why, 'other');
  engage(g.romance, 'ume', 20);
  assert.equal(romanceCheck(g, 'ume', 'shrine_vow').why, null, 'engaged: just talk');
  assert.equal(weddingDue(g.romance, 22), false);
  assert.equal(weddingDue(g.romance, 23), true);
  marry(g.romance);
  assert.deepEqual(g.romance, { engaged: null, spouse: 'ume' });
});

test('the extended farmhouse keeps the door, spawn and bed, and adds room', () => {
  const { small, big } = HOUSE_PLAN;
  assert.deepEqual(big.door, small.door);
  assert.deepEqual(big.spawn, small.spawn);
  assert.deepEqual(big.wake, small.wake);
  assert.ok(big.ground[0].length > small.ground[0].length);
  assert.equal(big.ground.length, small.ground.length);
  fitHouse(true);
  forgetNav('house_farm');
  const nav = navMap('house_farm');
  assert.equal(nav.w, big.ground[0].length);
  assert.ok(!nav.solid(big.wake.tx, big.wake.ty));
  fitHouse(false);
  forgetNav('house_farm');
  assert.equal(navMap('house_farm').w, small.ground[0].length);
});

test('a spouse lives at the farm, works in the valley by day, and never leaves it', () => {
  fitHouse(true);
  forgetNav('house_farm');
  for (const id of ROMANCEABLE) for (const weekday of [0, 3, 5]) {
    const base = routeFor(id, { season: 'spring', weekday, rain: false, flags: { rin_arrived: true } });
    const r = spouseRoute(base);
    for (let i = 1; i < r.length; i++) assert.ok(r[i][0] >= r[i - 1][0], `${id}: in order`);
    for (const [, map, tx, ty] of r) {
      assert.notEqual(map, 'away', id);
      assert.ok(!navMap(map).solid(tx, ty), `${id} ${weekday}: ${map} ${tx},${ty} is solid`);
    }
    assert.equal(r[0][1], 'house_farm');
    assert.equal(r[r.length - 1][1], 'house_farm');
  }
  fitHouse(false);
  forgetNav('house_farm');
});

test('the wedding scene parses and stages everyone on open ground at the shrine', () => {
  const nav = navMap('shrine');
  for (const id of ROMANCEABLE) {
    const { ops } = parseScript(weddingScript(id));
    for (const o of ops) {
      if (o.op === 'placePlayer' || o.op === 'placeNpc') assert.ok(!nav.solid(o.tx, o.ty), `${id}: ${o.tx},${o.ty}`);
      if (o.op === 'placeNpc') assert.ok(NPCS[o.npc], o.npc);
    }
    assert.ok(ops.some((o) => o.op === 'placeNpc' && o.npc === id));
    assert.equal(ops.filter((o) => o.op === 'placeNpc').length, new Set(ops.filter((o) => o.op === 'placeNpc').map((o) => o.npc)).size, 'nobody twice');
  }
});

test('a spouse says one of their married lines about half the time', () => {
  const b = { ...newBond(), met: true, pts: 2500 };
  const ctx = (day, spouse) => ({ season: 'spring', weekday: day % 7, rain: false, minutes: 600, place: 'farm', stop: null, flags: {}, seed: 5, day, spouse });
  const lines = ROMANCE.tomoe.spouse.map((l) => l.replace(/^\[\w+\]\s*/, ''));
  let home = 0;
  for (let d = 0; d < 60; d++) if (lines.includes(pickLine('tomoe', b, ctx(d, ROMANCE.tomoe.spouse)).text)) home++;
  assert.ok(home > 15 && home < 45, `${home} of 60`);
  for (let d = 0; d < 20; d++) assert.ok(!lines.includes(pickLine('tomoe', b, ctx(d, null)).text));
});
