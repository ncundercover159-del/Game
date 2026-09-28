import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Foe } from '../../src/world/foes.js';
import '../../src/world/boss.js';
import { ENEMIES } from '../../src/data/enemies.js';
import { GameMap } from '../../src/world/gamemap.js';
import { Rng } from '../../src/core/rng.js';

const TELLS = new Set(['tell', 'omen', 'dashTell']);

/** An open 20x14 room with a pond in one corner (for kappa), and a stand-in world around it. */
function arena() {
  const rows = [];
  for (let y = 0; y < 14; y++) {
    let r = '';
    for (let x = 0; x < 20; x++) r += x === 0 || y === 0 || x === 19 || y === 13 ? 'R' : x > 14 && y > 9 ? '~' : 'g';
    rows.push(r);
  }
  const map = new GameMap({ id: 'test', ground: rows, zone: 1 });
  const blows = [];
  const w = {
    map,
    time: 0,
    fx: { burst() {} },
    game: { player: { x: 80, y: 110, dir: 'down' }, sfx() {}, aside() {}, shake() {}, modals: [], difficulty: 'standard' },
    combat: {
      rng: new Rng(11),
      enemyBlow: (f) => { blows.push({ t: w.time, f }); return 'hit'; },
      foxfire: (f) => blows.push({ t: w.time, f }),
      spawn: () => ({ setState() {} }),
      smoke() {},
    },
  };
  return { w, blows };
}

for (const kind of [...Object.keys(ENEMIES), 'jubei']) {
  test(`${kind}: every blow comes after a readable tell`, () => {
    const { w, blows } = arena();
    const home = kind === 'kappa' ? [16, 11] : [12, 5];
    const f = new Foe(kind, home[0] * 16 + 8, home[1] * 16 + 14, 'standard');
    const p = w.game.player;
    let tellStart = null, lastTell = -1, lastTellLen = 0;
    const dt = 1 / 60;
    for (let i = 0; i < 60 * 40; i++) {
      w.time += dt;
      // The player drifts around the room a little, staying in reach now and then.
      p.x = 150 + Math.sin(w.time * 0.7) * 90;
      p.y = 130 + Math.cos(w.time * 0.5) * 40;
      const before = f.state;
      f.update(w, dt);
      if (kind === 'jubei' && f.state === 'sheathe') f.setState('approach');
      if (TELLS.has(f.state) && !TELLS.has(before)) tellStart = w.time;
      if (!TELLS.has(f.state) && TELLS.has(before)) { lastTell = w.time; lastTellLen = w.time - tellStart; }
      const n = blows.length;
      if (n && blows[n - 1].t === w.time && !blows[n - 1].checked) {
        blows[n - 1].checked = true;
        assert.ok(w.time - lastTell < 1.2, `${kind} struck ${(w.time - lastTell).toFixed(2)} s after its last tell`);
        assert.ok(lastTellLen >= 0.28, `${kind} tell only ${lastTellLen.toFixed(2)} s`);
      }
      // Wear the boss down through its phases.
      if (kind === 'jubei' && i % 240 === 0) f.hp = Math.max(1, f.hp - 30);
    }
    assert.ok(blows.length > 0, `${kind} attacked at all`);
  });
}
