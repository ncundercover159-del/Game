// Headless test of M5 (Playwright): through the shrine's rear gate to the mine, a fight on floor 1
// (combo, parry on the glint, dodge), mining ore, the ladder and the rope, a defeat and the lost
// bundle, Jūbei's iai stand-off and his fate, and reforging the old sword. Setup uses test hooks;
// the fighting goes through the real keys. Fails on any console error or page exception.
import assert from 'node:assert/strict';
import { withBrowser } from '../../tools/render-page.mjs';

const step = (name) => console.log(`- ${name}`);

await withBrowser(async (browser, base) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  const run = (fn, arg) => page.evaluate(fn, arg);
  const state = () => run(() => window.__game.state());
  const press = (code, ms = 50) => run(([c, t]) => { window.__game.press(c); window.__game.advance(t); }, [code, ms]);
  const advance = (ms) => run((t) => window.__game.advance(t), ms);
  const count = (id) => run((i) => window.__game.game.inventory.count(i), id);
  const select = (id) => run((i) => { const g = window.__game.game; g.inventory.select(g.inventory.find(i)); }, id);
  const clear = () => run(() => { const g = window.__game.game; g.modals = []; g.hud.aside = null; });
  /** Wait (in game time) until the wipe or scene is done and the map is `id`. */
  const until = async (fn, ms = 6000) => { for (let t = 0; t < ms; t += 100) { if (await run(fn)) return true; await advance(100); } return false; };
  const confirmAll = async () => { for (let i = 0; i < 30 && (await state()).modals.length; i++) await press('Enter', 300); };

  await page.goto(`${base}/index.html?play=1&seed=7&time=09:00&day=3&weather=clear`);
  await page.waitForFunction(() => window.__ready === true);
  // Frozen: only advance() moves the game, so the parry timing below is exact.
  await run(() => { const G = window.__game, g = G.game; G.freeze(); G.advance(800); g.flags.ev_welcome = true; g.flags.restored_bridge = true; g.modals = []; });

  step('the open rear gate leads up to Mount Kurayama, and the mine mouth down to floor 1');
  await run(() => { const G = window.__game, g = G.game; g.enter('shrine', 19, 3, 'up'); G.advance(50); g.hud.aside = null; });
  await run(() => { window.__game.hold('KeyW'); });
  assert.ok(await until(() => window.__game.game.world.map.id === 'kurayama'), 'reached Kurayama');
  await run(() => { window.__game.release('KeyW'); });
  await clear();
  await run(() => { const g = window.__game.game; g.world.place(14, 7, 'up'); window.__game.hold('KeyW'); });
  assert.ok(await until(() => window.__game.game.world.map.id === 'cave'), 'went down the mine');
  await run(() => { window.__game.release('KeyW'); });
  await advance(600);
  await clear();
  assert.equal(await run(() => window.__game.game.world.map.def.floor), 1);
  assert.equal((await state()).caves.deepest, 1);

  step('a light combo cuts down a karakasa; Swordsmanship XP');
  await select('katana_rusted');
  await run(() => {
    const g = window.__game.game, w = g.world, p = g.player;
    w.combat.foes.length = 0;
    const t = p.facingTile();
    const f = w.combat.spawn('karakasa', t.x, t.y);
    f.setState('recover');
  });
  const xp0 = await run(() => window.__game.game.skills.sword.xp);
  for (let i = 0; i < 12 && (await run(() => window.__game.game.world.combat.foes.length)); i++) {
    await run(() => { const g = window.__game.game, f = g.world.combat.foes[0]; if (f) { f.setState('recover'); const p = g.player; f.x = p.x + { down: [0, 18], up: [0, -18], left: [-18, 0], right: [18, 0] }[p.dir][0]; f.y = p.y + { down: [0, 18], up: [0, -18], left: [-18, 0], right: [18, 0] }[p.dir][1]; } });
    await press('KeyJ', 120);
  }
  assert.equal(await run(() => window.__game.game.world.combat.foes.length), 0, 'karakasa down');
  assert.ok((await run(() => window.__game.game.skills.sword.xp)) > xp0, 'sword XP');

  step('parrying a nobushi on the glint staggers him and refunds Ki');
  await advance(800);   // let the last swing finish
  await run(() => {
    const g = window.__game.game, w = g.world, p = g.player;
    p.dir = 'down';
    const f = w.combat.spawn('bandit', p.tx, p.ty + 1);
    f.y = p.y + 16; f.x = p.x;
    f.dir = 'up';
    f.setState('tell');
    f.mem.windup = 0.5;
    g.ki = 50;
  });
  await until(() => window.__game.game.world.combat.foes[0].mem.glinted, 1000);
  await press('KeyL', 30);
  await advance(300);
  const parried = await run(() => { const g = window.__game.game; return { parries: g.stats.parries || 0, state: g.world.combat.foes[0].state, hp: g.hp, ki: g.ki }; });
  assert.equal(parried.parries, 1, 'one parry');
  assert.equal(parried.state, 'stagger');
  assert.equal(parried.hp, 100, 'no damage taken');
  assert.ok(parried.ki > 50 - 8, 'Ki refunded');

  step('a dodge step costs Ki and gives a moment of invulnerability');
  await run(() => { const g = window.__game.game; g.world.combat.foes.length = 0; g.ki = 100; g.kiIdle = 0; });
  await run(() => { window.__game.press('Space', 20); });
  const dodge = await run(() => { const g = window.__game.game, fi = g.world.combat.fighter; return { act: fi.act?.kind, ifr: fi.iframes, ki: g.ki }; });
  assert.equal(dodge.act, 'dodge');
  assert.ok(dodge.ifr > 0 && dodge.ki < 100);
  await advance(400);

  step('the pickaxe breaks a copper vein');
  await select('pickaxe');
  await run(() => {
    const g = window.__game.game, m = g.world.map, t = g.player.facingTile();
    const o = m.objectAt(t.x, t.y); if (o) m.removeObject(o);
    m.ground[m.i(t.x, t.y)] = 15; m.blocked[m.i(t.x, t.y)] = 0;
    m.addObject({ type: 'ore', x: t.x, y: t.y, kind: 'copper', zone: 1, hp: 3 });
  });
  for (let i = 0; i < 4; i++) await press('KeyJ', 450);
  await advance(1500);
  assert.ok((await count('copper_ore')) >= 1, 'copper ore');

  step('the ladder goes down to floor 2; the rope climbs out to the mouth');
  await run(() => { const g = window.__game.game, e = g.world.map.def.exit; g.world.place(e.tx, e.ty + 1, 'up'); });
  await press('KeyK', 50);
  assert.ok(await until(() => window.__game.game.world.map.def.floor === 2), 'floor 2');
  await clear();
  await run(() => { const g = window.__game.game, s = g.world.map.def.spawn; g.world.place(s.tx, s.ty, 'up'); });
  await press('KeyK', 50);
  assert.ok(await until(() => window.__game.game.world.map.id === 'kurayama'), 'climbed out');
  await clear();

  step('a defeat: waking in Ume\'s care, poorer, with the lost bundle waiting at the mouth');
  await run(async () => { const g = window.__game.game; g.money = 2000; g.inventory.add('wood', 20); g.inventory.add('stone', 10); const { enterFloor } = await import('/src/caves.js'); enterFloor(g, 1); });
  await until(() => window.__game.game.world.map.id === 'cave');
  await advance(500);
  await clear();
  await run(() => {
    const g = window.__game.game, w = g.world, p = g.player;
    w.combat.foes.length = 0;
    g.hp = 5;
    const f = w.combat.spawn('bandit', p.tx, p.ty + 1);
    f.x = p.x; f.y = p.y + 14; f.dir = 'up';
    f.setState('attack'); f.mem.struck = false;
  });
  assert.ok(await until(() => window.__game.game.world.map.id === 'yakuya', 8000), 'woke at the apothecary');
  await advance(500);
  await confirmAll();
  const after = await state();
  assert.equal(after.money, 1800, 'lost a tenth of the purse');
  assert.equal(after.hp, 50, 'half Inochi');
  assert.ok(after.caves.bundle.length > 0, 'something went into the bundle');
  const lost = after.caves.bundle.map((s) => s.id);
  await run(() => { const g = window.__game.game; g.enter('kurayama', 17, 8, 'up'); });
  await clear();
  assert.equal((await run(() => window.__game.tile(17, 7).object)), 'bundle');
  await press('KeyK', 100);
  assert.deepEqual((await state()).caves.bundle, [], 'bundle taken back');
  for (const id of lost) assert.ok((await count(id)) > 0, `got ${id} back`);

  step('Jūbei on floor 20: the stand-off, won on the bell, and his fate');
  await run(async () => { const g = window.__game.game; const { enterFloor } = await import('/src/caves.js'); enterFloor(g, 20); });
  await until(() => window.__game.game.world.map.id === 'cave');
  await advance(500);
  await clear();
  await run(() => { const g = window.__game.game, f = g.world.combat.foes[0]; g.player.x = f.x; g.player.y = f.y + 40; f.hp = Math.round(f.maxHp * 0.25); });
  assert.ok(await until(() => window.__game.state().modals.includes('IaiDuel'), 8000), 'the stand-off begins');
  await run(() => { window.__game.game.hud.aside = null; });
  for (let round = 0; round < 2; round++) {
    assert.ok(await until(() => { const m = window.__game.game.modals.find((x) => x.duel); return m && m.duel.round.phase === 'cue'; }, 6000), 'the bell');
    await press('KeyJ', 20);
    await advance(1500);
  }
  assert.ok(await until(() => window.__game.game.flags.boss_jubei, 3000), 'Jūbei down');
  assert.ok(await until(() => window.__game.state().modals.includes('Cutscene'), 3000));
  // Two lines, then the choice: spare him.
  for (let i = 0; i < 2; i++) await press('Enter', 400);
  await press('Enter', 400);
  await confirmAll();
  // The pack is full: the blade lands at your feet; make room and pick it up.
  await run(() => { const g = window.__game.game; g.inventory.remove('bamboo', g.inventory.count('bamboo')); });
  await advance(1500);
  assert.equal(await count('kurogane'), 1, 'his blade');
  assert.ok((await run(() => window.__game.game.flags.jubei_spared)), 'spared');
  assert.ok((await state()).virtues.yu >= 5, 'Yū from the fight');
  assert.equal(await run(() => window.__game.tile(15, 6).object), 'ladder', 'the way down opens');

  step('Genzō reforges the rusted katana around iron (you leave the hammering to him)');
  await run(() => { const g = window.__game.game; g.cal.minutes = 600; g.money = 5000; g.inventory.remove('seed_daikon', g.inventory.count('seed_daikon')); g.inventory.add('iron_bar', 3); g.enter('kajiya', 4, 6, 'up'); g.modals = []; g.openShop('kajiya'); });
  await press('BracketRight', 50);
  await press('Enter', 50);
  // "Striking, or watching?" Leave it to him this time (the anvil minigame is in minigames.mjs).
  await press('Enter', 600);
  await press('ArrowDown', 50);
  await press('Enter', 50);
  await confirmAll();
  assert.equal(await count('katana_tetsu'), 1, 'Tetsu Katana');
  assert.equal(await count('katana_rusted'), 0);

  assert.deepEqual(errors, [], 'no console errors');
  console.log('combat test passed');
});
