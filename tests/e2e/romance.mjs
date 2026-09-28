// Headless test of M6 romance (Playwright): Tatsu builds the farmhouse extension, the Red Thread
// and the Shrine Vow with Tomoe, the wedding at the shrine, and married life (her schedule, her
// lines, morning help). Setup uses test hooks; menus and dialogue go through the real keys. Fails
// on any console error or page exception.
import assert from 'node:assert/strict';
import { withBrowser } from '../../tools/render-page.mjs';

const step = (name) => console.log(`- ${name}`);

await withBrowser(async (browser, base) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  const run = (fn, arg) => page.evaluate(fn, arg);
  const press = (code, ms = 50) => run(([c, t]) => { window.__game.press(c); window.__game.advance(t); }, [code, ms]);
  const modals = () => run(() => window.__game.game.modals.map((m) => m.constructor.name));
  const select = (id) => run((i) => { const g = window.__game.game; g.inventory.select(g.inventory.find(i)); }, id);
  /** Press Enter through dialogue, wipes and scenes until nothing is open. */
  const settle = async () => {
    for (let i = 0; i < 80; i++) {
      const open = await run(() => window.__game.game.modals.length + (window.__game.game.pendingScene ? 1 : 0));
      if (!open) return;
      await press('Enter', 300);
    }
    throw new Error(`still open: ${await modals()}`);
  };
  const sleep = async () => { await run(() => window.__game.game.sleep(false)); await settle(); await run(() => { window.__game.game.hud.aside = null; }); };
  /** Stand beside a villager (moved onto the player's map) and talk to them. */
  const talkTo = (id) => run((i) => {
    const G = window.__game, g = G.game, n = g.villagers.get(i), p = g.player;
    n.placeAt(g.world.map.id, p.tx, p.ty - 1, 'down');
    n.pause = 99;
    g.talkTo(n);
    G.advance(100);
  }, id);

  await page.goto(`${base}/index.html?play=1&seed=7&time=10:00&day=3&weather=clear`);
  await page.waitForFunction(() => window.__ready === true);
  await run(() => { const G = window.__game, g = G.game; G.advance(800); g.flags.ev_welcome = true; g.flags.rin_arrived = true; g.modals = []; g.hud.aside = null; });

  step('Tatsu will not start the extension without the timber and stone');
  await run(() => { const g = window.__game.game; g.money = 30000; g.inventory.resize(36); g.villagers.snap(); g.enter('tatsu', 7, 6, 'up'); });
  await run(() => { window.__game.game.openShop('tatsu'); window.__game.advance(100); });
  assert.deepEqual(await modals(), ['ShopMenu']);
  await press('Enter', 100);
  assert.equal(await run(() => window.__game.game.construction), null, 'nothing started');
  assert.equal(await run(() => window.__game.game.money), 30000, 'nothing paid');

  step('with 150 wood and 50 stone he takes the order: three days of work');
  await run(() => { const g = window.__game.game; g.inventory.add('wood', 150); g.inventory.add('stone', 50); });
  await press('Enter', 100);
  const c = await run(() => ({ c: window.__game.game.construction, wood: window.__game.game.inventory.count('wood'), money: window.__game.game.money, day: window.__game.game.dayIndex }));
  assert.equal(c.c.ready, c.day + 3);
  assert.equal(c.wood, 0);
  assert.ok(c.money < 30000);
  await press('Escape', 100);
  await settle();
  for (let i = 0; i < 2; i++) await sleep();
  assert.ok(!(await run(() => window.__game.game.flags.house_upgraded)), 'not yet');
  await sleep();
  assert.ok(await run(() => window.__game.game.flags.house_upgraded), 'built on the third morning');
  const house = await run(() => { const w = window.__game.game.world; return { map: w.map.id, w: w.map.w, px: window.__game.game.player.tx, py: window.__game.game.player.ty }; });
  assert.equal(house.map, 'house_farm');
  assert.equal(house.w, 17, 'the wider farmhouse');
  assert.deepEqual([house.px, house.py], [3, 5], 'woke in the same bed');

  step('the Red Thread: too early at seven hearts, taken at eight; she is courted');
  await run(() => { const g = window.__game.game; g.enter('farm', 29, 12, 'down'); g.inventory.add('red_thread', 1); g.inventory.add('shrine_vow', 1); g.bonds.tomoe = { pts: 7 * 250, met: true, talkedDay: -1, giftDay: -1, giftWeek: -1, giftsThisWeek: 0, lastSeen: g.dayIndex }; });
  await select('red_thread');
  await talkTo('tomoe');
  await press('Enter', 100); // "Offer it"
  assert.ok(!(await run(() => window.__game.game.bonds.tomoe.courting)), 'refused at seven hearts');
  assert.equal(await run(() => window.__game.game.inventory.count('red_thread')), 1, 'kept the thread');
  await settle();
  await run(() => { window.__game.game.bonds.tomoe.pts = 8 * 250; });
  await select('red_thread');
  await talkTo('tomoe');
  await press('Enter', 100);
  await settle();
  const courted = await run(() => ({ b: window.__game.game.bonds.tomoe, n: window.__game.game.inventory.count('red_thread') }));
  assert.equal(courted.b.courting, true);
  assert.equal(courted.b.cap, undefined, 'the eight-heart ceiling is gone');
  assert.equal(courted.n, 0);

  step('the Shrine Vow at ten hearts: engaged, the wedding in three days');
  await run(() => { window.__game.game.bonds.tomoe.pts = 2500; });
  await select('shrine_vow');
  await talkTo('tomoe');
  await press('Enter', 100);
  await settle();
  const eng = await run(() => ({ r: window.__game.game.romance, day: window.__game.game.dayIndex }));
  assert.deepEqual(eng.r.engaged, { npc: 'tomoe', day: eng.day + 3 });

  step('the wedding morning: you wake on the shrine steps, the scene plays, then home to the farm');
  for (let i = 0; i < 2; i++) await sleep();
  assert.equal(await run(() => window.__game.game.romance.spouse), null);
  await run(() => window.__game.game.sleep(false));
  let sawShrine = false, sawHeibei = false;
  for (let i = 0; i < 80; i++) {
    const s = await run(() => { const g = window.__game.game; return { map: g.world.map.id, open: g.modals.length + (g.pendingScene ? 1 : 0), heibei: g.villagers.get('heibei').map, scene: g.modals.some((m) => m.constructor.name === 'Cutscene') }; });
    if (s.scene && s.map === 'shrine') { sawShrine = true; if (s.heibei === 'shrine') sawHeibei = true; }
    if (!s.open) break;
    await press('Enter', 300);
  }
  assert.ok(sawShrine, 'the wedding scene played at the shrine');
  assert.ok(sawHeibei, 'Heibei officiates when you marry Tomoe');
  const wed = await run(() => ({ r: window.__game.game.romance, map: window.__game.game.world.map.id }));
  assert.deepEqual(wed.r, { engaged: null, spouse: 'tomoe' });
  assert.equal(wed.map, 'farm', 'walked home');

  step('married life: she sleeps at the farmhouse, works at the shrine, and says married things');
  const route = await run(() => window.__game.game.villagers.routes.tomoe);
  assert.equal(route[0][1], 'house_farm');
  assert.ok(route.some((s) => s[1] === 'shrine' || s[1] === 'shamusho'), 'still keeps the shrine by day');
  const lines = await run(async () => (await import('./src/data/romance.js')).ROMANCE.tomoe.spouse.map((l) => l.replace(/^\[\w+\]\s*/, '')));
  let home = 0;
  for (let d = 0; d < 6; d++) {
    await run(() => { const g = window.__game.game; g.modals = []; g.cal.day = (g.cal.day % 28) + 1; });
    await talkTo('tomoe');
    const text = await run(() => window.__game.game.modals.at(-1)?.text || '');
    if (lines.some((l) => text.startsWith(l.slice(0, 20)))) home++;
  }
  assert.ok(home >= 1, `married lines in ${home} of 6 talks`);

  step('the save carries the marriage and the extension');
  await run(() => { window.__game.game.modals = []; window.__game.game.saveNow(true); window.__game.game.loadSlot(1); });
  const back = await run(() => { const g = window.__game.game; return { r: g.romance, up: g.flags.house_upgraded, w: g.worldFor('house_farm').map.w }; });
  assert.equal(back.r.spouse, 'tomoe');
  assert.equal(back.up, true);
  assert.equal(back.w, 17);

  assert.deepEqual(errors, [], errors.join('\n'));
  console.log('romance e2e: ok');
});
