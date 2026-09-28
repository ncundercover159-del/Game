// M7c: kyūdō and goldfish scooping as pure rules, the kodama's nights, tempered blades and the
// fighting buffs, the new fish and dishes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Kyudo, ARROWS, DRAW_TIME, TIRE, FLIGHT, scoreAt } from '../../src/systems/kyudo.js';
import { Kingyo, KINDS, POI_R, LIMIT } from '../../src/systems/kingyo.js';
import { friends, waiting, out, spotFor, accepts, homes, kodamaNight } from '../../src/systems/kodama.js';
import { KODAMA } from '../../src/data/kodama.js';
import { weaponFor, hitDamage, damageTaken, TEMPER } from '../../src/systems/combat.js';
import { fishFor } from '../../src/systems/fishing.js';
import { FISH } from '../../src/data/fish.js';
import { DISHES, SCROLLS, CHAYA_SCROLLS, KON_SCROLLS, SAKUYA_SCROLLS, CRAFTS } from '../../src/data/recipes.js';
import { ITEMS } from '../../src/data/items.js';
import { GameMap } from '../../src/world/gamemap.js';
import { SOIL } from '../../src/systems/irrigation.js';
import { MAPS } from '../../src/maps/index.js';
import { navMap } from '../../src/systems/nav.js';
import { Rng } from '../../src/core/rng.js';
import { newSkills } from '../../src/systems/skills.js';

const DT = 1 / 60;

/** Shoot one arrow: draw, hold at full draw steering the aim to where the wind will carry it home. */
function shoot(k, { aimOff = true, early = false } = {}) {
  let ev = null;
  for (let i = 0; i < 600 && k.phase !== 'flight'; i++) {
    const full = k.phase === 'full';
    const want = aimOff ? { x: -k.wind.x, y: -k.wind.y } : { x: 0, y: 0 };
    const dx = full ? Math.sign(want.x - k.aim.x) * Math.min(1, Math.abs(want.x - k.aim.x) * 8) : 0;
    const dy = full ? Math.sign(want.y - k.aim.y) * Math.min(1, Math.abs(want.y - k.aim.y) * 8) : 0;
    const settled = full && Math.hypot(want.x - k.aim.x, want.y - k.aim.y) < 0.03;
    const down = early ? k.pull < 0.5 : !settled;
    ev = k.step(DT, { down, dx, dy });
  }
  while (k.phase === 'flight') ev = k.step(DT, { down: false });
  return ev;
}

test('kyūdō: aiming off for the wind scores; aiming dead centre in a wind misses the middle', () => {
  const k = new Kyudo(new Rng(5));
  for (let i = 0; i < ARROWS; i++) shoot(k);
  assert.ok(k.done);
  assert.equal(k.shots.length, ARROWS);
  assert.ok(k.shots.every((s) => s.score >= 7), JSON.stringify(k.shots));
  assert.equal(k.grade, 0);
  // Ignoring a stiff wind costs points.
  const naive = new Kyudo(new Rng(5));
  for (let i = 0; i < ARROWS; i++) shoot(naive, { aimOff: false });
  assert.ok(naive.total < k.total);
});

test('kyūdō: loosing before full draw drops short; holding too long looses anyway', () => {
  const k = new Kyudo(new Rng(9));
  assert.equal(shoot(k, { early: true }), 'short');
  assert.equal(k.shots[0].score, 0);
  const tired = new Kyudo(new Rng(9));
  let t = 0;
  while (tired.phase !== 'flight' && t < DRAW_TIME + TIRE + 1) { tired.step(DT, { down: true }); t += DT; }
  assert.equal(tired.phase, 'flight', 'the arms gave');
  assert.ok(t >= DRAW_TIME + TIRE - 0.05);
  for (let i = 0; i < FLIGHT / DT + 2; i++) tired.step(DT, { down: false });
  assert.equal(tired.shots.length, 1);
  assert.equal(scoreAt(0, 0), 10);
  assert.equal(scoreAt(1.2, 0), 0);
});

/** Move the poi to (x, y) above the water. */
function glide(k, x, y, wet) {
  for (let i = 0; i < 600; i++) {
    const dx = x - k.poi.x, dy = y - k.poi.y, d = Math.hypot(dx, dy);
    if (d < 1) return;
    k.step(DT, { dx: dx / Math.max(d, 4), dy: dy / Math.max(d, 4), dip: wet });
  }
}

test('goldfish: dip in open water, slide under a fish, lift, and it is in the bowl', () => {
  const k = new Kingyo(new Rng(2));
  // Hold the fish still so the test is about the paper, not the chase.
  const target = k.fish.find((f) => f.kind === 'wakin');
  const still = { ...KINDS };
  for (const id of Object.keys(KINDS)) KINDS[id] = { ...KINDS[id], speed: 0 };
  try {
    // Dip well away from it (so it does not dart), then slide under and lift.
    const ax = target.x > 75 ? target.x - 30 : target.x + 30;
    glide(k, ax, target.y, false);
    assert.equal(k.step(DT, { dip: true }), 'dip');
    glide(k, target.x, target.y, true);
    assert.equal(k.step(DT, { dip: false }), 'lift');
    assert.ok(k.caught.length >= 1, 'caught');
    assert.ok(k.paper < 1 && k.paper > 0.5);
  } finally { Object.assign(KINDS, still); }
});

test('goldfish: dragging the paper about underwater tears it; a startled fish darts off', () => {
  const k = new Kingyo(new Rng(4));
  k.step(DT, { dip: true });
  let ev = null;
  for (let i = 0; i < 60 * 30 && !k.done; i++) ev = k.step(DT, { dx: i % 240 < 120 ? 1 : -1, dy: 0, dip: true }) || ev;
  assert.ok(k.torn, 'torn');
  assert.equal(k.paper, 0);
  assert.equal(ev, 'tear');
  const s = new Kingyo(new Rng(4)), f = s.fish[0];
  s.poi.x = f.x + 4; s.poi.y = f.y;
  s.step(DT, { dip: true });
  assert.ok(f.dart > 0, 'it darted');
  const idle = new Kingyo(new Rng(4));
  for (let i = 0; i < (LIMIT + 1) / DT && !idle.done; i++) idle.step(DT, {});
  assert.ok(idle.done && !idle.torn, 'time runs out');
  assert.equal(idle.grade, 2);
  assert.ok(POI_R > 0);
});

test('kodama: one waits on the shrine stair after the Altar of Chūgi, on open ground, at dusk', () => {
  assert.ok(!waiting({}));
  assert.ok(waiting({ restored_kodama: true }));
  assert.ok(!waiting({ restored_kodama: true, kodama_friends: KODAMA.max }));
  assert.ok(out(18 * 60) && !out(12 * 60) && !out(23 * 60));
  const nav = navMap('shrine');
  for (const [x, y] of KODAMA.spots) assert.ok(!nav.solid(x, y) && !nav.objectAt(x, y), `spot ${x},${y}`);
  const seen = new Set();
  for (let d = 0; d < 40; d++) seen.add(spotFor(7, d).join());
  assert.ok(seen.size > 3, 'the spot moves from day to day');
  assert.deepEqual(spotFor(7, 3), spotFor(7, 3));
  assert.ok(accepts('warabi') && accepts('rice') && !accepts('stone') && !accepts('ayu'));
  assert.ok(ITEMS.hokora && CRAFTS.hokora.flag === 'restored_kodama');
});

test('kodama: at home, each waters the dry planted beds within reach of its hokora, once', () => {
  const ground = Array.from({ length: 12 }, () => '.'.repeat(20));
  const m = new GameMap({ id: 't', farmable: true, ground });
  const plantAt = (x, y) => { const k = m.i(x, y); m.soil[k] = SOIL.TILLED; m.crops.set(k, { id: 'daikon', growth: 0, q: 0 }); };
  for (let y = 0; y < 12; y++) for (let x = 0; x < 20; x++) plantAt(x, y);
  m.wet[m.i(5, 5)] = 1;                                     // already watered
  const k = m.i(6, 6); m.crops.delete(k);                   // tilled but empty
  const a = m.addObject({ type: 'hokora', x: 5, y: 5, v: 0 });
  m.addObject({ type: 'hokora', x: 7, y: 5, v: 0 });        // overlapping reach
  m.addObject({ type: 'hokora', x: 16, y: 9, v: 0 });       // nobody lives here (only two friends)
  assert.deepEqual(homes(m, 2).map((o) => o.x), [5, 7]);
  const n = kodamaNight(m, 2);
  const r = KODAMA.radius;
  // Two overlapping 7x7 squares make x 2..10 by y 2..8, less the bed already wet and the empty one.
  assert.ok(m.wet[m.i(2, 2)] && m.wet[m.i(10, 8)]);
  assert.ok(!m.wet[m.i(11, 5)] && !m.wet[m.i(16, 9)] && !m.wet[m.i(6, 6)]);
  assert.equal(n, (2 * r + 3) * (2 * r + 1) - 1 - 1);
  assert.equal(kodamaNight(m, 2), 0, 'nothing left to water');
  assert.ok(a && friends({ kodama_friends: 2 }) === 2);
});

test('a blade struck well at the forge hits harder; the fighting dishes work', () => {
  const plain = weaponFor('katana_tetsu'), fine = weaponFor('katana_tetsu', 2);
  assert.ok(Math.abs(fine.dmg - plain.dmg * (1 + TEMPER * 2)) < 1e-9);
  assert.equal(weaponFor('katana_tetsu', 0), plain, 'no copy for plain steel');
  const skills = newSkills(), virtues = {}, rng = { next: () => 0.99 };
  const base = hitDamage(plain, { combo: 0 }, {}, { skills, virtues, rng }).dmg;
  const hard = hitDamage(plain, { combo: 0 }, {}, { skills, virtues, rng, might: 0.2 }).dmg;
  assert.equal(hard, Math.round(base * 1.2));
  assert.ok(damageTaken(40, 'standard', skills, 0.15) < damageTaken(40, 'standard', skills));
  for (const [id, d] of Object.entries(DISHES)) if (d.buff) assert.ok(['speed', 'farming', 'foraging', 'fishing', 'might', 'guard'].includes(d.buff[0]), id);
});

test('new fish: the cellars and the Yomi Slope have their own, the lava none; storms bring the Namazu', () => {
  const at = (where, weather = 'clear', minutes = 12 * 60, season = 'summer') => fishFor(where, { season, minutes, weather, cal: { day: 3 }, caught: {} });
  const cave = at('cave'), yomi = at('yomi');
  assert.ok(cave.length >= 3 && cave.every((id) => FISH[id].where.includes('cave')));
  assert.ok(yomi.length >= 2 && yomi.every((id) => FISH[id].where.includes('yomi')));
  assert.deepEqual(at('lava'), []);
  assert.ok(!at('pond', 'rain').includes('onamazu'));
  assert.ok(at('pond', 'storm').includes('onamazu'));
  assert.ok(at('stream', 'rain', 22 * 60, 'spring').includes('osanshouo'));
  for (const s of ['spring', 'summer', 'autumn', 'winter']) assert.deepEqual(at('cave', 'clear', 12 * 60, s), cave, 'the same all year under the mountain');
});

test('dishes: every ingredient is real, every scroll teaches a dish, and every dish has a way to learn it', () => {
  for (const [id, d] of Object.entries(DISHES)) for (const [i] of d.needs) assert.ok(ITEMS[i], `${id}: ${i}`);
  for (const id of SCROLLS) assert.ok(DISHES[id] && ITEMS[`scroll_${id}`], id);
  const taught = new Set([...CHAYA_SCROLLS, ...KON_SCROLLS, ...SAKUYA_SCROLLS]);
  for (const [id, d] of Object.entries(DISHES)) assert.ok(d.known || taught.has(id), `${id} can be learned`);
  assert.ok(MAPS.dojo.props.some((p) => p.type === 'makiwara') && MAPS.dojo.props.some((p) => p.type === 'mato'));
});
