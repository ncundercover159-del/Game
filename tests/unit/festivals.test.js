import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FESTIVALS } from '../../src/data/festivals.js';
import { NPCS, NPC_IDS, routeFor, stopAt } from '../../src/data/npcs.js';
import { ITEMS } from '../../src/data/items.js';
import { OBJECT_TYPES } from '../../src/data/objects.js';
import { MAPS } from '../../src/maps/index.js';
import { navMap } from '../../src/systems/nav.js';
import { parseScript } from '../../src/systems/script.js';
import { DAY_END } from '../../src/systems/calendar.js';
import { festivalOn, festivalRoute, castFor, bestCrop, judgeGrade, JUDGING } from '../../src/systems/festivals.js';
import { Rhythm, CHARTS, WINDOW, LEAD } from '../../src/systems/rhythm.js';
import { dealTray, fits, complete, scoreVerse, verseGrade, SHAPE, syllables, TRAY } from '../../src/systems/verse.js';
import { Rng } from '../../src/core/rng.js';

test('eleven festivals on the brief\'s dates, each within the waking day', () => {
  assert.equal(FESTIVALS.length, 11);
  const dates = FESTIVALS.map((f) => `${f.season}-${f.day}`);
  assert.deepEqual(dates, ['0-8', '0-14', '1-7', '1-20', '1-27', '2-15', '2-24', '2-28', '3-8', '3-25', '3-28']);
  for (const f of FESTIVALS) {
    assert.ok(MAPS[f.map], f.id);
    assert.ok(f.from >= 360 && f.from < f.to && f.to <= DAY_END, f.id);
    assert.equal(festivalOn({ season: f.season, day: f.day }), f);
  }
  assert.equal(festivalOn({ season: 0, day: 9 }), null);
});

test('festival places: decor is real, spots and scene staging are open ground, nobody on a fixture', () => {
  for (const f of FESTIVALS) {
    const nav = navMap(f.map);
    const fixed = new Set();
    for (const d of f.decor) {
      assert.ok(OBJECT_TYPES[d.type], `${f.id}: ${d.type}`);
      assert.ok(!nav.solid(d.tx, d.ty) && !nav.objectAt(d.tx, d.ty), `${f.id}: decor on ${d.tx},${d.ty}`);
      if (d.type === 'fixture') {
        const [bw, bh] = d.block || [1, 1];
        for (let y = d.ty - bh + 1; y <= d.ty; y++) for (let x = d.tx; x < d.tx + bw; x++) { assert.ok(!nav.solid(x, y), `${f.id}: fixture ${x},${y}`); fixed.add(`${x},${y}`); }
      }
    }
    const open = (x, y) => !nav.solid(x, y) && !fixed.has(`${x},${y}`);
    const spots = new Set();
    for (const [x, y] of f.spots) {
      assert.ok(open(x, y), `${f.id}: spot ${x},${y}`);
      spots.add(`${x},${y}`);
    }
    assert.equal(spots.size, f.spots.length, `${f.id}: spots are distinct`);
    const { ops } = parseScript(f.script);
    for (const o of ops) {
      if (o.op === 'placePlayer' || o.op === 'placeNpc') assert.ok(open(o.tx, o.ty), `${f.id}: ${o.op} ${o.tx},${o.ty}`);
      if (o.op === 'placeNpc' || (o.op === 'say' && o.who)) assert.ok(NPCS[o.npc || o.who], `${f.id}: ${o.npc || o.who}`);
      if (o.op === 'give') assert.ok(ITEMS[o.item], `${f.id}: ${o.item}`);
      if (o.op === 'choice' && o.play) assert.ok(['haiku', 'judge', 'kingyo', 'mochi', 'bonodori', 'otaue', 'mamemaki'].includes(o.play), o.play);
    }
  }
});

test('on the day the cast go to their spots for the hours, then back to their own day', () => {
  const f = FESTIVALS.find((x) => x.id === 'obon');
  const cast = castFor(f, {});
  assert.ok(!cast.includes('rin'), 'Rin has not come to the valley yet');
  assert.ok(castFor(f, { rin_arrived: true }).includes('rin'));
  assert.ok(cast.length <= f.spots.length);
  assert.deepEqual(castFor(FESTIVALS.find((x) => x.id === 'hyakki'), {}), ['tomoe', 'soken', 'kon']);
  for (const id of NPC_IDS) {
    const base = routeFor(id, { season: 'summer', weekday: 2, rain: false, flags: {} });
    const r = festivalRoute(base, f, f.spots[0]);
    for (let i = 1; i < r.length; i++) assert.ok(r[i][0] >= r[i - 1][0], `${id} in order`);
    const at = r.find((s) => s[0] === f.from);
    assert.equal(at[1], f.map);
    assert.deepEqual(r.find((s) => s[0] === f.to).slice(1), stopAt(base, f.to).slice(1), `${id}: home after`);
  }
});

test('crop judging: your best crop by worth (quality counts), against the rivals', () => {
  assert.equal(bestCrop([null, { id: 'hoe', n: 1 }]), null);
  assert.equal(judgeGrade(null), 2);
  const e = bestCrop([{ id: 'daikon', n: 3, q: 0 }, { id: 'kabocha', n: 1, q: 2 }, { id: 'satsumaimo', n: 1, q: 0 }]);
  assert.equal(e.id, 'kabocha');
  assert.ok(e.value >= JUDGING.first);
  assert.equal(judgeGrade(e), 0);
  assert.equal(judgeGrade(bestCrop([{ id: 'satsumaimo', n: 1, q: 0 }])), 1);
  assert.equal(judgeGrade(bestCrop([{ id: 'daikon', n: 1, q: 0 }])), 2);
});

/** Play a chart perfectly (optionally pressing on the rests too, or missing everything). */
function playChart(notes, { hitRests = false, press = true } = {}) {
  const r = new Rhythm(notes);
  const dt = 1 / 120;
  while (!r.done) {
    const k = new Set();
    if (press) for (const n of r.notes) if (!n.judge && (hitRests || !n.rest) && Math.abs(n.t - r.t) < dt / 2 + 1e-9) k.add(n.key);
    r.step(dt, k);
  }
  return r;
}

test('rhythm charts: on the beat is splendid, missing everything is clumsy, and the hand hurts', () => {
  for (const [kind, chart] of Object.entries(CHARTS)) {
    const notes = chart(new Rng(3));
    for (let i = 1; i < notes.length; i++) assert.ok(notes[i].t >= notes[i - 1].t, `${kind} sorted`);
    // Any two notes on the same key are far enough apart to judge unambiguously.
    const byKey = {};
    for (const n of notes) (byKey[n.key] ||= []).push(n.t);
    for (const ts of Object.values(byKey)) for (let i = 1; i < ts.length; i++) assert.ok(ts[i] - ts[i - 1] > WINDOW.good * 2, `${kind} spacing`);
    const best = playChart(notes);
    assert.equal(best.grade, 0, kind);
    assert.equal(best.tally.miss, 0);
    assert.equal(best.maxCombo, best.beats);
    assert.equal(playChart(notes, { press: false }).grade, 2, kind);
  }
  const mochi = CHARTS.mochi(new Rng(3));
  const reckless = playChart(mochi, { hitRests: true });
  assert.ok(reckless.tally.ouch > 10);
  assert.equal(reckless.grade, 2, 'pounding the hand ruins it');
  // A press a little off the beat is only good; far off, nothing.
  const r = new Rhythm([{ t: 0, key: 'use', rest: false }]);
  r.step(LEAD - 0.1, new Set());
  assert.equal(r.step(0, new Set(['use']))[0].judge, 'good');
});

test('haiku: a tray that can always be filled, the 5-7-5 shape, and scoring that wants a season word', () => {
  const rng = new Rng(11);
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    const tray = dealTray(season, rng);
    assert.equal(tray.length, TRAY);
    assert.equal(new Set(tray.map((x) => x.w)).size, TRAY, 'no duplicate tiles');
    assert.ok(tray.some((x) => x.s === 1) && tray.some((x) => x.s === 2));
    assert.equal(tray.filter((x) => x.kigo === season).length, 3);
    assert.equal(tray.filter((x) => x.kigo === 'wrong').length, 1);
  }
  const w = (s, img = 1, extra = {}) => ({ w: `w${s}${img}${JSON.stringify(extra)}${Math.random()}`, s, img, ...extra });
  const lines = [[], [], []];
  const five = w(5, 0);
  assert.ok(fits(lines, 0, five));
  lines[0].push(five);
  assert.ok(!fits(lines, 0, w(1)));
  lines[1].push(w(4, 3), w(3, 3));
  lines[2].push(w(3, 3, { kigo: 'autumn' }), w(1, 0, { cut: true }), w(1, 2));
  assert.ok(complete(lines));
  assert.deepEqual(lines.map(syllables), SHAPE);
  const good = scoreVerse(lines, 'autumn');
  assert.equal(good.score, 3 + 3 + 3 + 2 + 5 + 2);
  assert.equal(verseGrade(good.score), 0);
  const off = scoreVerse(lines, 'spring');
  assert.equal(off.kigo, false);
  assert.equal(verseGrade(off.score), 2, 'the wrong season sinks it');
});
