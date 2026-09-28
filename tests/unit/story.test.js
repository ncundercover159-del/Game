import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORY } from '../../src/data/story.js';
import { EVENTS } from '../../src/data/events.js';
import { LETTERS } from '../../src/data/letters.js';
import { NPCS, SPEAKERS } from '../../src/data/npcs.js';
import { ITEMS } from '../../src/data/items.js';
import { MAPS } from '../../src/maps/index.js';
import { navMap } from '../../src/systems/nav.js';
import { parseScript } from '../../src/systems/script.js';
import { shippingAdjust, tollsActive, signatures, canSign, PETITION_NEEDED } from '../../src/systems/story.js';
import { COLLECTIONS, MILESTONES } from '../../src/data/archive.js';
import { newArchive, donate, donatable, collectionOf, progress, TOTAL } from '../../src/systems/archive.js';
import { newMail, deliverMail } from '../../src/systems/mail.js';

test('story scenes are in the event list and stage everyone on open ground', () => {
  for (const e of STORY) {
    assert.ok(EVENTS.includes(e));
    assert.ok(MAPS[e.map], e.flag);
    const nav = navMap(e.map);
    for (const o of parseScript(e.script).ops) {
      if (o.op === 'placePlayer' || o.op === 'placeNpc' || o.op === 'moveNpc') assert.ok(!nav.solid(o.tx, o.ty), `${e.flag}: ${o.op} ${o.tx},${o.ty}`);
      if (o.op === 'placeNpc' || o.op === 'moveNpc') assert.ok(NPCS[o.npc], `${e.flag}: ${o.npc}`);
      if (o.op === 'say' && o.who) assert.ok(NPCS[o.who] || SPEAKERS[o.who], `${e.flag}: ${o.who}`);
      if (o.op === 'bond') assert.ok(o.npc === 'all' || NPCS[o.npc], o.npc);
    }
  }
});

/** A stand-in game for event conditions and letters. */
const game = (cal, flags = {}) => ({
  cal: { minutes: 600, year: 1, ...cal }, flags, bonds: {}, stats: { shippedValue: 0 }, mail: newMail(), player: { tx: 0 },
});
const due = (g) => EVENTS.filter((e) => !g.flags[e.flag] && (!e.when || e.when(g))).map((e) => e.flag);

test('the story unfolds in order: tolls in summer, Rin in autumn, Kuroda after his letter', () => {
  assert.ok(!due(game({ season: 0, day: 20 }, { met_heibei: true, ev_welcome: true })).includes('tolls'), 'no tolls in spring');
  assert.ok(due(game({ season: 1, day: 1 }, { met_heibei: true, ev_welcome: true })).includes('tolls'));
  assert.ok(!due(game({ season: 1, day: 25 }, { tolls: true, ev_welcome: true })).includes('rin_arrived'));
  assert.ok(due(game({ season: 2, day: 1 }, { tolls: true, ev_welcome: true })).includes('rin_arrived'));
  const g = game({ season: 2, day: 5 }, { tolls: true, rin_arrived: true, ev_welcome: true, met_heibei: true });
  assert.ok(!due(g).includes('kuroda_offer'), 'waits for the letter');
  deliverMail(g);
  assert.ok(g.mail.sent.includes('kuroda_invite'));
  assert.ok(due(g).includes('kuroda_offer'));
  assert.ok(due(game({ season: 2, day: 20 })).includes('seal_split'));
  assert.ok(!due(game({ season: 2, day: 19 })).includes('seal_split'));
  // Five days after the petition went (day index 70), the castle's answer.
  assert.ok(!due(game({ season: 2, day: 18 }, { petition_sent: 70 })).includes('petition_won'));
  assert.ok(due(game({ season: 2, day: 20 }, { petition_sent: 70 })).includes('petition_won'));
  for (const l of LETTERS) for (const [item] of l.items) assert.ok(ITEMS[item], l.id);
});

test('tolls take a tenth until the petition wins; Kuroda pays over the price instead', () => {
  assert.deepEqual(shippingAdjust({}, 1000), { toll: 0, bonus: 0 });
  assert.equal(tollsActive({ tolls: true }), true);
  assert.deepEqual(shippingAdjust({ tolls: true }, 1000), { toll: 100, bonus: 0 });
  assert.deepEqual(shippingAdjust({ tolls: true, petition_won: true }, 1000), { toll: 0, bonus: 0 });
  assert.deepEqual(shippingAdjust({ tolls: true, kuroda_signed: true }, 1000), { toll: 0, bonus: 100 });
});

test('the petition: friends sign once, not the magistrate or a child, and the ledger counts triple', () => {
  const flags = { petition: true };
  assert.ok(!canSign({}, 'heibei', 5), 'no petition yet');
  assert.ok(canSign(flags, 'heibei', 3));
  assert.ok(!canSign(flags, 'heibei', 2), 'not enough trust');
  assert.ok(!canSign(flags, 'okubo', 10));
  assert.ok(!canSign(flags, 'kinta', 10));
  flags.signed_heibei = true;
  assert.ok(!canSign(flags, 'heibei', 5), 'once');
  assert.equal(signatures(flags), 1);
  flags.ledger_given = true;
  assert.equal(signatures(flags), 4);
  for (const id of ['okiku', 'genzo', 'tomoe', 'toyo']) flags[`signed_${id}`] = true;
  assert.ok(signatures(flags) >= PETITION_NEEDED);
  flags.petition_sent = 40;
  assert.ok(!canSign(flags, 'ume', 5), 'closed once sent');
});

test('the Archive: collections cover real items once each; donations pay milestones and completions', () => {
  const all = Object.values(COLLECTIONS).flatMap((c) => c.items);
  assert.equal(new Set(all).size, all.length, 'no item in two collections');
  for (const id of all) assert.ok(ITEMS[id], id);
  assert.equal(TOTAL, all.length);
  for (const m of MILESTONES) { assert.ok(m.n <= TOTAL); for (const [id] of m.items || []) assert.ok(ITEMS[id], id); }
  const st = newArchive();
  assert.equal(collectionOf('ayu'), 'fish');
  assert.ok(!donatable(st, 'hoe'));
  assert.ok(donatable(st, 'ayu'));
  assert.deepEqual(donate(st, 'ayu'), { milestones: [], completed: null });
  assert.equal(donate(st, 'ayu'), null, 'once each');
  let r;
  for (const id of COLLECTIONS.metals.items) r = donate(st, id);
  assert.equal(r.completed, 'metals');
  assert.deepEqual(st.claimed, [5]);
  assert.equal(progress(st, 'fish'), 1);
  for (const id of COLLECTIONS.crops.items.slice(0, 3)) r = donate(st, id);
  assert.deepEqual(r.milestones.map((m) => m.n), [10]);
});
