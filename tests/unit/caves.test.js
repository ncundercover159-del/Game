import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateFloor, reach } from '../../src/systems/cavegen.js';
import { LAST_FLOOR, BOSS_FLOORS, LANTERN_EVERY, ORES, zoneOf, URN_LOOT, CHEST_LOOT } from '../../src/data/caves.js';
import { ENEMIES } from '../../src/data/enemies.js';
import { OBJECT_TYPES } from '../../src/data/objects.js';
import { ITEMS } from '../../src/data/items.js';
import { GameMap } from '../../src/world/gamemap.js';
import { Duel } from '../../src/systems/iai.js';
import { Rng } from '../../src/core/rng.js';

const SEEDS = [7, 20260928, 123456789];

/** A grid view of generated rows that reach() understands. */
const gridOf = (rows) => ({ w: rows[0].length, h: rows.length, get: (x, y) => (x < 0 || y < 0 || x >= rows[0].length || y >= rows.length ? 'R' : rows[y][x]) });

test('floors are the same for the same seed and floor, different otherwise', () => {
  assert.deepEqual(generateFloor(7, 3), generateFloor(7, 3));
  assert.notDeepEqual(generateFloor(7, 3).ground, generateFloor(7, 4).ground);
  assert.notDeepEqual(generateFloor(7, 3).ground, generateFloor(8, 3).ground);
});

test('on every floor the ladder, every room and every pickup can be reached on foot from the rope', () => {
  for (const seed of SEEDS) for (let floor = 1; floor <= LAST_FLOOR; floor++) {
    const f = generateFloor(seed, floor);
    const g = gridOf(f.ground);
    // The rope stands in the wall-side of the first room; everything else must be walkable to.
    const cracked = new Set(f.props.filter((p) => p.type === 'cracked').map((p) => p.ty * g.w + p.tx));
    const ok = reach(g, f.start.tx, f.start.ty);
    const exit = f.exit.ty * g.w + f.exit.tx;
    assert.ok(ok.has(exit), `seed ${seed} floor ${floor}: exit reachable`);
    for (const p of f.props) {
      if (p.type === 'rope' || p.type === 'cracked') continue;
      const k = p.ty * g.w + p.tx;
      // A prop blocks its own tile: some neighbour must be reachable (secret rooms via the crack).
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => ok.has(k + dy * g.w + dx) || [...cracked].some((c) => reach(g, c % g.w, Math.floor(c / g.w)).has(k + dy * g.w + dx)));
      assert.ok(near || ok.has(k), `seed ${seed} floor ${floor}: ${p.type} at ${p.tx},${p.ty}`);
    }
  }
});

test('floors hold the right things: lanterns every five, the boss on 20, no ladder on the last', () => {
  for (let floor = 1; floor <= LAST_FLOOR; floor++) {
    const f = generateFloor(7, floor);
    const types = f.props.map((p) => p.type);
    assert.equal(types.includes('cave_lantern'), floor % LANTERN_EVERY === 0, `lantern on ${floor}`);
    if (BOSS_FLOORS[floor]) assert.deepEqual(f.spawns.map((s) => s.kind), [BOSS_FLOORS[floor]]);
    else if (floor === LAST_FLOOR) assert.ok(types.includes('deep') && !types.includes('ladder'));
    else assert.ok(types.includes('ladder'), `ladder on ${floor}`);
  }
});

test('foes come from their zone and stand on floor or water; none near the rope', () => {
  for (let floor = 1; floor <= LAST_FLOOR; floor++) {
    if (BOSS_FLOORS[floor]) continue;
    const f = generateFloor(20260928, floor), zone = zoneOf(floor);
    assert.ok(f.spawns.length >= 4);
    for (const s of f.spawns) {
      assert.ok(zone.enemies.some(([k]) => k === s.kind), `${s.kind} on ${floor}`);
      const ch = f.ground[s.ty][s.tx];
      assert.ok(ch === 'g' || (ch === '~' && ENEMIES[s.kind].water), `${s.kind} on "${ch}" at floor ${floor}`);
      assert.ok(Math.abs(s.tx - f.start.tx) + Math.abs(s.ty - f.start.ty) > 6, `${s.kind} too close to the rope`);
    }
  }
});

test('generated floors build as maps; ores, urns and chests use known kinds and loot', () => {
  for (const floor of [1, 10, 20, 25, 40]) {
    const f = generateFloor(7, floor);
    const m = new GameMap({ id: 'cave', ground: f.ground, props: f.props, zone: f.zone });
    assert.ok(!m.solid(f.start.tx, f.start.ty), 'start is free');
    for (const p of f.props) assert.ok(OBJECT_TYPES[p.type], p.type);
    for (const p of f.props.filter((q) => q.type === 'ore')) assert.ok(ORES[p.kind], p.kind);
  }
  for (const t of [URN_LOOT, CHEST_LOOT]) for (const rows of Object.values(t)) for (const [id] of rows) assert.ok(id === 'mon' || id === 'nothing' || ITEMS[id], id);
});

test('the iai duel: early draws and late draws lose, a draw on the bell wins, best of three', () => {
  const step = (d, pressAt) => {
    // Step until the round resolves; press at the cue plus `pressAt` seconds (or at 0.3 s if early).
    for (let t = 0; t < 10; t += 1 / 60) {
      const r = d.round;
      const press = pressAt === 'early' ? r.t >= 0.3 && r.phase === 'still' : r.phase === 'cue' && r.t - r.cueAt >= pressAt;
      const ev = d.step(1 / 60, press);
      if (ev && ev !== 'cue') return ev;
    }
    return null;
  };
  const d = new Duel(new Rng(5));
  assert.equal(step(d, 'early'), 'lost-early');
  while (d.step(1 / 60, false) !== 'round');
  assert.equal(step(d, 0.1), 'won');
  while (d.step(1 / 60, false) !== 'round');
  assert.equal(step(d, 0.9), 'lost-late');
  while (d.step(1 / 60, false) !== 'over');
  assert.equal(d.done, 'lost');
  const win = new Duel(new Rng(9));
  for (let i = 0; i < 2; i++) { assert.equal(step(win, 0.05), 'won'); while (win.step(1 / 60, false) !== 'round' && !win.done); }
  assert.equal(win.done, 'won');
});
