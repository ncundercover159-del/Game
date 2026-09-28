// Headless test of M6 story (Playwright): the magistrate's tolls in summer and the tenth they take
// from the crate, Rin at the bridge in autumn, Kuroda's offer refused, the petition signed by
// friends and answered by the castle, and donating to the restored Village Archive. Setup uses
// test hooks (dates, bonds); scenes, choices and menus go through the real keys. Fails on any
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
  const flags = () => run(() => window.__game.game.flags);
  /** Confirm through everything open; at a choice, first press Down `pick` times. */
  const settle = async (pick = 0) => {
    for (let i = 0; i < 80; i++) {
      const s = await run(() => { const g = window.__game.game, m = g.modals.at(-1); return { open: g.modals.length + (g.pendingScene ? 1 : 0), choice: !!m?.choices && m.shown >= m.text?.length }; });
      if (!s.open) return;
      if (s.choice) for (let k = 0; k < pick; k++) await run(() => window.__game.press('ArrowDown', 30));
      await run(() => { window.__game.press('Enter', 50); window.__game.advance(250); });
    }
    throw new Error('scene never ended');
  };
  const goto = (season, day, map, tx, ty) => run(([s, d, m, x, y]) => {
    const G = window.__game, g = G.game;
    Object.assign(g.cal, { season: s, day: d, minutes: 600 });
    g.villagers.snap();
    g.enter(m, x, y, 'up');
    G.advance(100);
  }, [season, day, map, tx, ty]);
  const sleep = async () => { await run(() => window.__game.game.sleep(false)); await settle(); await run(() => { window.__game.game.hud.aside = null; }); };

  await page.goto(`${base}/index.html?play=1&seed=7&time=10:00&weather=clear`);
  await page.waitForFunction(() => window.__ready === true);
  await run(() => { const G = window.__game, g = G.game; G.freeze(); G.advance(800); Object.assign(g.flags, { ev_welcome: true, met_heibei: true }); g.modals = []; g.hud.aside = null; g.inventory.resize(36); });

  step('no tolls in spring; on the first summer visit Ōkubo posts them at the crossroads');
  await goto(0, 20, 'village', 60, 13);
  assert.ok(!(await flags()).tolls);
  await goto(1, 1, 'village', 60, 13);
  assert.equal(await run(() => window.__game.game.modals[0]?.constructor.name), 'Cutscene', 'the scene plays');
  await settle();
  assert.ok((await flags()).tolls);

  step('the toll takes a tenth of the crate overnight');
  const shipped = await run(() => { const g = window.__game.game; g.shipped.push({ id: 'kabocha', n: 10, q: 0 }); return g.money; });
  await sleep();
  assert.equal((await run(() => window.__game.game.money)) - shipped, 1300 - 130, 'ten kabocha at 130, less the tenth');

  step('autumn: Rin walks up to the bridge toll, and stays');
  await goto(2, 1, 'village', 60, 13);
  await settle();
  // (Getsu and Ka she spends on the road; look at a Sui.)
  const rin = await run(() => { const g = window.__game.game; g.cal.day = 3; g.villagers.planDay(); return { f: g.flags.rin_arrived, route: g.villagers.routes.rin.map((s) => s[1]) }; });
  assert.ok(rin.f);
  assert.ok(!rin.route.includes('away'), 'Rin lives in the valley now');

  step('Kuroda\'s letter, then his offer at the counting house: refused');
  await goto(2, 4, 'farm', 29, 12);
  await sleep();
  assert.ok(await run(() => window.__game.game.mail.sent.includes('kuroda_invite')));
  await goto(2, 5, 'village', 60, 13);
  const money0 = await run(() => window.__game.game.money);
  await settle(1);
  const f1 = await flags();
  assert.ok(f1.kuroda_offer && f1.petition && !f1.kuroda_signed);
  assert.equal(await run(() => window.__game.game.money), money0, 'no Kuroda money');

  step('friends sign the petition as you talk to them; eight names and it goes to the castle');
  await run(() => { const g = window.__game.game; for (const id of ['heibei', 'okiku', 'genzo', 'tomoe', 'toyo', 'daigo', 'ume', 'chobei', 'kinta']) g.bonds[id] = { pts: 3 * 250, met: true, talkedDay: -1, giftDay: -1, giftWeek: -1, giftsThisWeek: 0, lastSeen: g.dayIndex }; });
  for (const id of ['kinta', 'heibei', 'okiku', 'genzo', 'tomoe', 'toyo', 'daigo', 'ume', 'chobei']) {
    await run((i) => {
      const G = window.__game, g = G.game, n = g.villagers.get(i), p = g.player;
      n.placeAt(g.world.map.id, p.tx, p.ty - 1, 'down');
      n.pause = 99;
      g.inventory.select(g.inventory.find('hoe'));
      g.talkTo(n);
      G.advance(100);
    }, id);
    await settle();
  }
  const f2 = await flags();
  assert.ok(!f2.signed_kinta, 'children do not sign');
  assert.equal(Object.keys(f2).filter((k) => k.startsWith('signed_')).length, 8);
  assert.ok(f2.petition_sent !== undefined, 'sent');

  step('five days later the castle answers: the tolls burn');
  await run(() => { window.__game.game.cal.day += 5; });
  await goto(2, 10, 'village', 60, 13);
  await settle();
  const f3 = await flags();
  assert.ok(f3.petition_won);
  const noToll = await run(() => { const g = window.__game.game; g.shipped.push({ id: 'kabocha', n: 10, q: 0 }); return g.money; });
  await sleep();
  assert.equal((await run(() => window.__game.game.money)) - noToll, 1300, 'no toll any more');

  step('the restored Archive opens; an ayu is donated at the ledger desk');
  await run(() => { const g = window.__game.game; g.flags.restored_archive = true; g.inventory.add('ayu', 2); });
  const warp = await run(() => window.__game.game.worldFor('village').map.def.warps.find((w) => w.to === 'archive'));
  assert.equal(warp.ifFlag, 'restored_archive');
  await goto(2, 11, 'archive', 6, 5);
  await run(() => { window.__game.press('KeyK', 50); window.__game.advance(100); });
  assert.equal(await run(() => window.__game.game.modals.at(-1)?.constructor.name), 'ArchiveMenu');
  await run(() => { const g = window.__game.game, m = g.modals.at(-1); m.sel = m.donateRows().findIndex((r) => r.id === 'ayu'); window.__game.press('Enter', 50); });
  const arc = await run(() => ({ a: window.__game.game.archive, ayu: window.__game.game.inventory.count('ayu') }));
  assert.deepEqual(arc.a.donated, ['ayu']);
  assert.equal(arc.ayu, 1);
  await run(() => { window.__game.press('BracketRight', 50); window.__game.advance(100); });
  assert.equal(await run(() => window.__game.game.modals.at(-1).tab), 1, 'the Collection tab');

  step('the other branch: signing with Kuroda pays at once, chills the village and waters the fields');
  await page.goto(`${base}/index.html?play=1&seed=8&time=10:00&weather=clear`);
  await page.waitForFunction(() => window.__ready === true);
  const before = await run(() => {
    const G = window.__game, g = G.game;
    G.freeze(); G.advance(800);
    Object.assign(g.flags, { ev_welcome: true, met_heibei: true, tolls: true, rin_arrived: true });
    g.mail.sent.push('kuroda_invite');
    g.bonds.okiku = { pts: 1000, met: true, talkedDay: -1, giftDay: -1, giftWeek: -1, giftsThisWeek: 0, lastSeen: 0 };
    g.modals = []; g.hud.aside = null;
    return { money: g.money, gi: g.virtues.gi };
  });
  await goto(2, 6, 'village', 60, 13);
  await settle(0);
  const signed = await run(() => { const g = window.__game.game; return { f: g.flags.kuroda_signed, money: g.money, okiku: g.bonds.okiku.pts }; });
  assert.ok(signed.f);
  assert.equal(signed.money, before.money + 5000);
  assert.equal(signed.okiku, 1000 - 120, 'a colder village');
  await run(() => { const g = window.__game.game, farm = g.worldFor('farm').map; g.tomorrow = 'clear'; farm.soil[farm.i(30, 14)] = 1; farm.wet[farm.i(30, 14)] = 0; });
  await sleep();
  assert.equal(await run(() => { const farm = window.__game.game.worldFor('farm').map; return farm.wet[farm.i(30, 14)]; }), 1, 'Kuroda\'s man watered it');

  assert.deepEqual(errors, [], errors.join('\n'));
  console.log('story e2e: ok');
});
