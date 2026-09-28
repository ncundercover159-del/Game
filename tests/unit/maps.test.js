import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../../src/maps/index.js';
import { GameMap } from '../../src/world/gamemap.js';
import { decorate } from '../../src/world/populate.js';
import { STRINGS } from '../../src/data/strings.js';
import { OBJECT_TYPES } from '../../src/data/objects.js';

const built = Object.fromEntries(Object.values(MAPS).map((def) => {
  const m = new GameMap(def);
  decorate(m);
  return [def.id, m];
}));

test('every map is rectangular and the farm is 64x48', () => {
  for (const def of Object.values(MAPS)) {
    const w = def.ground[0].length;
    for (const row of def.ground) assert.equal(row.length, w, def.id);
  }
  assert.deepEqual([built.farm.w, built.farm.h], [64, 48]);
});

test('every text key used by a map exists', () => {
  for (const def of Object.values(MAPS)) {
    for (const p of def.props || []) {
      if (p.text) assert.ok(STRINGS[p.text], p.text);
      assert.ok(OBJECT_TYPES[p.type], `${def.id}: ${p.type}`);
      const say = OBJECT_TYPES[p.type].say;
      if (say) assert.ok(STRINGS[say], say);
    }
    for (const e of def.edges || []) assert.ok(STRINGS[e.text], e.text);
    for (const b of def.buildings || []) if (b.door?.say) assert.ok(STRINGS[b.door.say], b.door.say);
  }
});

test('every warp is walkable at both ends and lands off any warp', () => {
  for (const def of Object.values(MAPS)) {
    const m = built[def.id];
    for (const wp of def.warps) {
      // A gated warp (the shrine's rear gate) is checked with its gate open.
      if (wp.ifFlag) for (const [k, o] of m.blockOwner) if (o.openIf === wp.ifFlag) { m.blocked[k] = 0; o.passable = true; }
      for (let y = wp.y; y < wp.y + wp.h; y++) for (let x = wp.x; x < wp.x + wp.w; x++) assert.ok(!m.solid(x, y), `${def.id} warp tile ${x},${y}`);
      if (wp.cave) continue;   // the mine mouth leads to generated floors (tests/unit/caves.test.js)
      const to = built[wp.to];
      assert.ok(to, `${def.id} -> ${wp.to}`);
      assert.ok(!to.solid(wp.tx, wp.ty), `${def.id} -> ${wp.to} lands on solid ${wp.tx},${wp.ty}`);
      const onWarp = MAPS[wp.to].warps.some((r) => wp.tx >= r.x && wp.tx < r.x + r.w && wp.ty >= r.y && wp.ty < r.y + r.h);
      assert.ok(!onWarp, `${def.id} -> ${wp.to} lands on a warp`);
    }
  }
});

test('every interior is reachable through a door and leads back out', () => {
  for (const def of Object.values(MAPS)) {
    if (!def.indoor) continue;
    assert.ok(def.outside, `${def.id} has no door in`);
    assert.ok(def.warps.some((w) => w.to === def.outside), def.id);
  }
});

test('the farmhouse has a bed to sleep in and a spot to wake', () => {
  const house = built.house_farm;
  assert.ok(house.objects.some((o) => o.action === 'sleep'));
  const wake = MAPS.house_farm.wake;
  assert.ok(!house.solid(wake.tx, wake.ty));
});
