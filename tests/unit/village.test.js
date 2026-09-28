import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRequests, postingsFor, refresh, accept, dueWith, complete, MAX_ACTIVE } from '../../src/systems/requests.js';
import { newOfferings, offer, setDone, altarDone } from '../../src/systems/offerings.js';
import { ALTARS } from '../../src/data/offerings.js';
import { RESTORATIONS } from '../../src/data/restorations.js';
import { VIRTUE_IDS } from '../../src/data/virtues.js';
import { ITEMS } from '../../src/data/items.js';
import { CROPS } from '../../src/data/crops.js';
import { SHOPS } from '../../src/data/shops.js';
import { newMail, deliverMail, letterOf, unread } from '../../src/systems/mail.js';
import { LETTERS } from '../../src/data/letters.js';
import { parseScript } from '../../src/systems/script.js';
import { EVENTS } from '../../src/data/events.js';

test('requests: 1-2 postings a day, deterministic, only for goods that exist', () => {
  for (let day = 0; day < 40; day++) {
    const a = postingsFor(9, day, 'summer');
    assert.deepEqual(a, postingsFor(9, day, 'summer'));
    assert.ok(a.length >= 1 && a.length <= 2);
    for (const q of a) {
      if (q.type === 'bring') assert.ok(ITEMS[q.item] && q.n > 0 && q.mon > 0);
      else assert.notEqual(q.from, q.to);
    }
  }
});

test('requests: accept, settle when carrying the goods, expire after the deadline', () => {
  const r = newRequests();
  refresh(r, 3, 10, 'spring');
  const q = r.posted[0];
  assert.ok(accept(r, q.id));
  assert.equal(r.active.length, 1);
  const bag = {};
  const count = (id) => bag[id] || 0;
  const who = q.type === 'bring' ? q.from : q.to;
  assert.equal(dueWith(r, who, count), null, 'nothing to hand over yet');
  if (q.type === 'bring') bag[q.item] = q.n; else bag.parcel = 1;
  assert.equal(dueWith(r, who, count), q);
  complete(r, q);
  assert.equal(r.active.length, 0);
  assert.equal(r.done, 1);
  // A request left too long simply lapses.
  refresh(r, 3, 11, 'spring');
  accept(r, r.posted[0].id);
  assert.deepEqual(refresh(r, 3, 20, 'spring').length, 1);
  assert.equal(r.active.length, 0);
});

test('requests: at most MAX_ACTIVE at once', () => {
  const r = newRequests();
  for (let d = 0; d < 6; d++) { refresh(r, 1, d, 'autumn'); for (const q of [...r.posted]) accept(r, q.id); r.active.forEach((q) => { q.due = 99; }); }
  assert.equal(r.active.length, MAX_ACTIVE);
});

test('offerings: seven altars of four sets, all obtainable, each with a restoration', () => {
  assert.deepEqual(Object.keys(ALTARS).sort(), [...VIRTUE_IDS].sort());
  const buyable = new Set(Object.values(SHOPS).flatMap((s) => (s.stock ? s.stock('spring', 0, { inventory: { size: 12 }, recipes: [], seed: 1, dayIndex: 0, flags: {} }).map((x) => x.id) : [])).concat(['iron_bar']));
  for (const [id, a] of Object.entries(ALTARS)) {
    assert.equal(a.sets.length, 4, id);
    assert.ok(RESTORATIONS[id] && parseScript(RESTORATIONS[id].script), id);
    for (const s of a.sets) for (const [item] of s.items) {
      assert.ok(ITEMS[item], `${id}: ${item}`);
      assert.ok(CROPS[item] || ['wood', 'stone', 'hay', 'bamboo'].includes(item) || buyable.has(item), `${id}: ${item} obtainable`);
    }
  }
});

test('offerings: partial offers accumulate; the last one completes set and altar', () => {
  const st = newOfferings();
  const bag = { komatsuna: 2 };
  const count = (id) => bag[id] || 0, take = (id, n) => { bag[id] -= n; };
  let r = offer(st, 'jin', 0, count, take);
  assert.equal(r.gave, 2);
  assert.ok(!r.setComplete);
  Object.assign(bag, { komatsuna: 5, daikon: 3, soramame: 2 });
  r = offer(st, 'jin', 0, count, take);
  assert.ok(r.setComplete && !r.altarComplete);
  assert.equal(bag.komatsuna, 4, 'only what was still needed is taken');
  for (let i = 1; i < 4; i++) for (const [id, n] of ALTARS.jin.sets[i].items) st.jin[i][ALTARS.jin.sets[i].items.findIndex((x) => x[0] === id)] = n - (i === 3 ? 1 : 0);
  assert.ok(setDone(st, 'jin', 1) && !altarDone(st, 'jin'));
  const [lastId] = ALTARS.jin.sets[3].items[0];
  bag[lastId] = 1;
  r = offer(st, 'jin', 3, count, take);
  assert.equal(r.gave, 1);
  assert.ok(!r.setComplete, 'other slots of the last set are still one short');
});

test('mail: letters arrive once when due; birthday gossip for villagers you know', () => {
  const g = { cal: { day: 1, season: 0, year: 1, minutes: 360 }, flags: {}, bonds: {}, stats: { shippedValue: 0 }, mail: newMail() };
  assert.equal(deliverMail(g), 0);
  g.cal.day = 2;
  assert.ok(deliverMail(g) >= 1);
  assert.equal(deliverMail(g), 0, 'no duplicates');
  assert.equal(g.mail.inbox[0].id, 'uncle_1');
  assert.ok(letterOf(g.mail.inbox[0]).items.length);
  g.bonds.okiku = { met: true };
  g.cal.day = 8;
  deliverMail(g);
  assert.ok(g.mail.inbox.some((l) => l.npc === 'okiku'), 'the day before Okiku\'s birthday (Spring 9)');
  assert.equal(unread(g.mail), g.mail.inbox.length);
  for (const l of LETTERS) for (const [item] of l.items) assert.ok(ITEMS[item], l.id);
});

test('story event scripts parse', () => {
  for (const e of EVENTS) assert.ok(parseScript(e.script).ops.length);
});
