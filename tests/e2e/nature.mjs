// Headless test of the M4 loops (Playwright): forage in the grove, fish the farm pond through the
// reel minigame, buy a chick and collect its egg, craft and run a compost bin, cook at the irori.
// Setup uses the test hooks; the actions themselves go through the real keys. Fails on any
// console error or page exception.
import assert from 'node:assert/strict';
import { withBrowser } from '../../tools/render-page.mjs';

const step = (name) => console.log(`- ${name}`);

await withBrowser(async (browser, base) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  const run = (fn, arg) => page.evaluate(fn, arg);
  const count = (id) => run((i) => window.__game.game.inventory.count(i), id);
  const modals = () => run(() => window.__game.state().modals);
  const press = (code, ms = 50) => run(([c, t]) => { window.__game.press(c); window.__game.advance(t); }, [code, ms]);
  const select = (id) => run((i) => { const g = window.__game.game; g.inventory.select(g.inventory.find(i)); }, id);
  /** Stand on (x, y) of a map facing `dir` (warping there directly). */
  const standAt = (map, x, y, dir) => run(([m, a, b, d]) => { const G = window.__game, g = G.game; g.modals = []; g.enter(m, a, b, d); G.advance(50); g.hud.aside = null; }, [map, x, y, dir]);
  const confirmAll = async () => { for (let i = 0; i < 20 && (await modals()).length; i++) await press('Enter', 400); };

  await page.goto(`${base}/index.html?play=1&seed=7&time=09:00&season=summer&day=3&weather=clear`);
  await page.waitForFunction(() => window.__ready === true);
  await run(() => {
    const G = window.__game, g = G.game;
    G.advance(800);
    g.flags.ev_welcome = true;
    // Room to work: the starter seed packets are not needed here.
    g.inventory.slots = g.inventory.slots.map((s) => (s && s.id.startsWith('seed_') ? null : s));
  });

  step('picks forage in the Hollow Grove');
  const spot = await run(() => {
    const g = window.__game.game, m = g.worldFor('grove').map;
    const o = m.objects.find((x) => x.type === 'forage' && !m.solid(x.x, x.y + 1));
    return { x: o.x, y: o.y, kind: o.kind };
  });
  await standAt('grove', spot.x, spot.y + 1, 'up');
  const xp0 = await run(() => window.__game.game.skills.foraging.xp);
  await press('KeyK', 100);
  assert.equal(await count(spot.kind), 1, `picked ${spot.kind}`);
  assert.ok((await run(() => window.__game.game.skills.foraging.xp)) > xp0, 'foraging XP');

  step('casts into the farm pond, strikes on the bite and reels the fish in');
  await run(() => window.__game.game.inventory.add('rod', 1));
  await standAt('farm', 50, 26, 'up');
  await select('rod');
  await run(() => { const G = window.__game; G.hold('KeyJ'); G.advance(900); G.release('KeyJ'); G.advance(600); });
  assert.equal(await run(() => window.__game.game.world.fishing.state.phase), 'wait', 'float settled on the water');
  await run(() => { const G = window.__game, f = G.game.world.fishing; for (let i = 0; i < 300 && f.state.phase !== 'bite'; i++) G.advance(50); });
  await press('KeyJ', 20);
  const reeled = await run(() => {
    const G = window.__game, g = G.game;
    if (!g.modals.length) return 'junk';
    // Play the reel: hold while the fish is above the middle of the catch bar.
    for (let i = 0; i < 60 * 40 && g.modals.length; i++) {
      const r = g.modals[g.modals.length - 1].reel;
      if (r && r.fish > r.bar + r.barH / 2) G.hold('KeyJ'); else G.release('KeyJ');
      G.advance(1000 / 60);
    }
    G.release('KeyJ');
    return g.modals.length ? 'stuck' : 'done';
  });
  assert.notEqual(reeled, 'stuck');
  assert.ok((await run(() => window.__game.game.stats.fish || 0)) >= 1 || reeled === 'junk', 'landed a fish');

  step('buys a chick at the Yorozuya; fed with hay, it lays by morning');
  await run(() => { const g = window.__game.game; g.money = 5000; g.cal.day = 4; g.cal.minutes = 600; g.villagers.snap(); g.openShop('yorozuya'); const m = g.modals[0]; m.sel = m.stock.findIndex((s) => s.id === 'chick'); });
  await press('Enter', 50);
  await press('Escape', 50);
  assert.equal(await run(() => window.__game.game.animals.list.length), 1, 'a chick in the coop');
  await run(() => window.__game.game.inventory.add('hay', 5));
  await standAt('coop', 1, 4, 'up');
  await select('hay');
  await press('KeyK', 100);
  assert.equal(await run(() => window.__game.game.animals.hay), 5, 'hay in the hopper');

  step('crafts a compost bin from the Craft tab and sets it up with hay');
  await run(() => { const g = window.__game.game; g.inventory.add('wood', 15); g.inventory.add('hay', 20); });
  await standAt('farm', 30, 16, 'down');
  await press('Tab', 50);
  await press('BracketRight', 50);
  await press('Enter', 50);
  await press('Escape', 50);
  assert.equal(await count('compost_bin'), 1, 'crafted');
  await select('compost_bin');
  await run(() => { const g = window.__game.game, m = g.world.map, k = m.i(30, 17); if (m.objAt[k] >= 0) m.removeObject(m.objects[m.objAt[k]]); });
  await press('KeyJ', 100);
  assert.equal(await run(() => window.__game.tile(30, 17).object), 'machine', 'placed');
  await select('hay');
  await press('KeyK', 100);
  assert.equal(await run(() => window.__game.game.world.map.objectAt(30, 17).input), 'hay', 'loaded');

  step('three nights later: an egg in the coop and compost in the bin');
  for (let n = 0; n < 3; n++) { await run(() => window.__game.game.sleep(false)); await run(() => window.__game.advance(1500)); await confirmAll(); }
  await standAt('farm', 30, 16, 'down');
  await press('KeyK', 100);
  assert.equal(await count('compost'), 5, 'five compost');
  const egg = await run(() => { const m = window.__game.game.worldFor('coop').map; const o = m.objects.find((x) => x.type === 'produce'); return o && { x: o.x, y: o.y }; });
  assert.ok(egg, 'an egg was laid');
  await standAt('coop', egg.x, egg.y + 1, 'up');
  await run(() => { const w = window.__game.game.world; w.flock.beasts.forEach((b) => { b.x = 16 * 8 + 8; b.y = 16 * 6 + 12; b.tx = 8; b.ty = 6; }); });
  await press('KeyK', 100);
  assert.ok((await count('egg')) >= 1, 'collected the egg');

  step('cooks tamagoyaki at the irori and eats it for a buff');
  await run(() => window.__game.game.inventory.add('egg', 2));
  await standAt('house_farm', 9, 6, 'up');
  await press('KeyK', 100);
  assert.deepEqual(await modals(), ['CookMenu']);
  await press('ArrowDown');
  await press('ArrowDown');
  await press('Enter', 50);
  await press('Escape', 50);
  assert.equal(await count('tamagoyaki'), 1, 'cooked');
  await run(() => { const g = window.__game.game; g.genki = 50; });
  await select('tamagoyaki');
  await press('KeyJ', 100);
  const after = await run(() => ({ genki: window.__game.game.genki, buffs: window.__game.game.buffs.map((b) => b.kind) }));
  assert.equal(after.genki, 140);
  assert.deepEqual(after.buffs, ['farming']);

  assert.deepEqual(errors, [], 'no console errors');
  console.log('nature test passed');
});
