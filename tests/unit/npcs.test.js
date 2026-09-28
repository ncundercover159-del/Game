import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NPCS, routeFor, stopAt } from '../../src/data/npcs.js';
import { MAPS } from '../../src/maps/index.js';
import { navMap, findPath, mapRoute, warpTile } from '../../src/systems/nav.js';

/** Walk a route stop to stop, crossing warps, the way a villager would. Returns false if stuck. */
function reachable(from, to) {
  let [map, x, y] = from;
  for (let legs = 0; legs < 8; legs++) {
    if (map === to[0]) return !!findPath(navMap(map), x, y, to[1], to[2]);
    const w = mapRoute(map, to[0])[0];
    const [wx, wy] = warpTile(w, x, y);
    if (!findPath(navMap(map), x, y, wx, wy)) return false;
    [map, x, y] = [w.to, w.tx, w.ty];
  }
  return false;
}

test('A* finds a path around walls and gives up on sealed goals', () => {
  const m = navMap('house_farm');
  const p = findPath(m, 6, 8, 3, 5);
  assert.ok(p && p.length >= 6);
  assert.deepEqual(p.at(-1), [3, 5]);
  for (const [x, y] of p) assert.ok(!m.solid(x, y));
  assert.equal(findPath(m, 6, 8, 0, 0), null);
});

test('map routes go through doors and roads', () => {
  const r = mapRoute('kajiya', 'shrine');
  assert.deepEqual(r.map((w) => w.to), ['village', 'shrine']);
  assert.equal(mapRoute('farm', 'farm').length, 0);
});

test('every schedule stop is walkable and reachable from home', () => {
  for (const [id, npc] of Object.entries(NPCS)) {
    for (const { route } of npc.schedule) {
      for (const [t, map, x, y] of route) {
        if (map === 'away') continue;   // out of the valley
        assert.ok(MAPS[map], `${id}: map ${map}`);
        assert.ok(!navMap(map).solid(x, y), `${id} @${t}: ${map} ${x},${y} is solid`);
      }
      for (let i = 1; i < route.length; i++) {
        const a = route[i - 1], b = route[i];
        assert.ok(b[0] > a[0], `${id}: stops in time order`);
        if (a[1] === 'away' || b[1] === 'away') continue;
        assert.ok(reachable([a[1], a[2], a[3]], [b[1], b[2], b[3]]), `${id}: ${a.slice(1, 4)} -> ${b.slice(1, 4)}`);
      }
    }
  }
});

test('schedule variants resolve by weekday, season and rain', () => {
  assert.equal(routeFor('genzo', { season: 'spring', weekday: 6, rain: false })[1][1], 'shrine');
  assert.equal(routeFor('genzo', { season: 'spring', weekday: 1, rain: false })[1][1], 'kajiya');
  assert.equal(routeFor('tomoe', { season: 'spring', weekday: 6, rain: true })[1][1], 'honden');
  const r = routeFor('okiku', { season: 'summer', weekday: 0, rain: false });
  assert.deepEqual(stopAt(r, 300), r[0]);
  assert.deepEqual(stopAt(r, 700), r[1]);
});
