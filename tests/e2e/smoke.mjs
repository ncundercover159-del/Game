// Headless smoke test (Playwright): boot, new game from the title menu, walk, till, plant, water,
// sleep through the door dialogue, check overnight growth, then reload and verify the save.
// Fails on any console error or page exception.
import assert from 'node:assert/strict';
import { withBrowser } from '../../tools/render-page.mjs';

const step = (name) => console.log(`- ${name}`);

/** Walk toward a tile by holding direction keys, one axis at a time. */
async function walkTo(page, tx, ty) {
  for (let guard = 0; guard < 400; guard++) {
    const s = await page.evaluate(() => window.__game.state().player);
    const dx = tx * 16 + 8 - s.x, dy = ty * 16 + 12 - s.y;
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    const key = Math.abs(dx) >= 3 ? (dx > 0 ? 'KeyD' : 'KeyA') : (dy > 0 ? 'KeyS' : 'KeyW');
    const ms = Math.min(120, Math.max(17, (Math.abs(Math.abs(dx) >= 3 ? dx : dy) / 72) * 1000));
    await page.evaluate(([k, t]) => { const G = window.__game; G.hold(k); G.advance(t); G.release(k); G.advance(17); }, [key, ms]);
  }
  throw new Error(`could not reach ${tx},${ty}`);
}

const face = (page, key) => page.evaluate((k) => { const G = window.__game; G.hold(k); G.advance(34); G.release(k); G.advance(17); }, key);
const press = (page, code, after = 0) => page.evaluate(([c, a]) => { window.__game.press(c); window.__game.advance(a); }, [code, after]);
const state = (page) => page.evaluate(() => window.__game.state());
/** Dismiss the end-of-day screen: keep confirming until no modal is left. */
async function wake(page) {
  for (let i = 0; i < 12; i++) {
    const s = await state(page);
    if (!s.modals.length) return;
    await press(page, 'Enter', 500);
  }
  throw new Error('stuck in the night');
}
const tile = (page, x, y) => page.evaluate(([a, b]) => window.__game.tile(a, b), [x, y]);

await withBrowser(async (browser, base) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));

  step('boots to the title');
  await page.goto(`${base}/index.html?seed=7`);
  await page.waitForFunction(() => window.__ready === true);
  assert.equal((await state(page)).scene, 'title');

  step('new farm from the title menu (New Farm -> first empty slot)');
  await press(page, 'Enter', 50);
  await press(page, 'Enter', 800);
  let s = await state(page);
  assert.equal(s.scene, 'play');
  assert.deepEqual(s.cal, { day: 1, season: 0, year: 1, minutes: 360 });

  step('walks down the path to the cleared patch');
  await walkTo(page, 29, 14);
  await walkTo(page, 24, 15);
  await walkTo(page, 24, 17);
  s = await state(page);
  assert.equal(s.player.tx, 24);

  step('tills, plants and waters the tile below');
  await face(page, 'KeyS');
  await press(page, 'Digit1');
  await press(page, 'KeyJ', 500);
  const t0 = (await state(page)).target;
  assert.deepEqual(t0, { x: 24, y: 18 });
  assert.equal((await tile(page, 24, 18)).soil, 1, 'tilled');
  await press(page, 'Digit6');
  await press(page, 'KeyJ', 100);
  assert.equal((await tile(page, 24, 18)).crop.id, 'daikon', 'planted');
  await press(page, 'Digit2');
  await press(page, 'KeyJ', 500);
  assert.equal((await tile(page, 24, 18)).wet, 1, 'watered');
  s = await state(page);
  assert.equal(s.genki, 196, 'two swings cost 4 genki');
  assert.equal(s.inventory.slots[5].n, 14, 'one seed used');

  step('clears a weed with the sickle and picks up the drop');
  // Put a weed on the clear strip south of the patch so the check does not depend on the seed.
  await page.evaluate(() => window.__game.game.world.map.addObject({ type: 'weed', x: 25, y: 23, v: 0 }));
  await walkTo(page, 25, 22);
  await face(page, 'KeyS');
  await press(page, 'Digit3');
  await press(page, 'KeyJ', 1500);
  assert.equal((await tile(page, 25, 23)).object, null, 'weed cleared');
  assert.equal(await page.evaluate(() => window.__game.game.world.drops.list.length), 0, 'drops collected');

  step('sleeps through the farmhouse door');
  await walkTo(page, 25, 17);
  await walkTo(page, 24, 15);
  await walkTo(page, 29, 14);
  await walkTo(page, 29, 11);
  await face(page, 'KeyW');
  await press(page, 'KeyK', 300);
  s = await state(page);
  assert.deepEqual(s.modals, ['Dialog'], 'sleep prompt open');
  await press(page, 'Enter', 50);
  await wake(page);
  s = await state(page);
  assert.deepEqual(s.modals, [], 'transition finished');
  assert.equal(s.cal.day, 2);
  assert.equal(s.cal.minutes, 360);
  assert.equal(s.genki, 200);
  const grown = await tile(page, 24, 18);
  assert.equal(grown.crop.growth, 1, 'watered crop grew overnight');
  assert.equal(grown.wet, 0, 'soil dried');

  step('harvests a ripe crop by hand');
  await page.evaluate(() => { const g = window.__game.game, m = g.world.map; m.crops.get(m.i(24, 18)).growth = 4; });
  await walkTo(page, 29, 14);
  await walkTo(page, 24, 15);
  await walkTo(page, 24, 17);
  await face(page, 'KeyS');
  await press(page, 'KeyK', 300);
  s = await state(page);
  assert.equal(s.inventory.slots.filter((x) => x && x.id === 'daikon').reduce((a, x) => a + x.n, 0), 1, 'one daikon in the pack');
  assert.equal((await tile(page, 24, 18)).crop, null, 'daikon does not regrow');

  step('refills the Jōro at the well');
  await page.evaluate(() => { window.__game.game.can = 3; });
  await walkTo(page, 24, 15);
  await walkTo(page, 29, 14);
  await walkTo(page, 29, 11);
  await walkTo(page, 33, 11);
  await walkTo(page, 33, 10);
  await face(page, 'KeyD');
  await press(page, 'Digit2');
  const genkiBefore = (await state(page)).genki;
  await press(page, 'KeyJ', 500);
  s = await state(page);
  assert.equal(s.can, 40, 'can full');
  assert.equal(s.genki, genkiBefore, 'refilling is free');

  step('saves from the menu');
  await press(page, 'Tab', 50);
  await press(page, 'BracketRight');
  await press(page, 'BracketRight');
  await press(page, 'Enter', 50);
  await press(page, 'Escape', 50);
  s = await state(page);
  assert.deepEqual(s.modals, []);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ronin.slot1')).state.can);
  assert.equal(saved, 40, 'menu save wrote the current state');

  step('reloads the save and finds the same farm');
  const before = await state(page);
  await page.goto(`${base}/index.html?slot=1`);
  await page.waitForFunction(() => window.__ready === true);
  const after = await state(page);
  assert.equal(after.scene, 'play');
  assert.equal(after.cal.day, before.cal.day);
  assert.ok(Math.abs(after.cal.minutes - before.cal.minutes) <= 10, 'saved within the last clock tick');
  assert.equal(after.money, before.money);
  assert.deepEqual(after.inventory.slots, before.inventory.slots);
  assert.equal((await tile(page, 24, 18)).crop, null);

  step('ships a stack in the crate and is paid overnight');
  await page.evaluate(() => { const g = window.__game.game; g.inventory.add('komatsuna', 4); });
  await walkTo(page, 33, 11);
  await walkTo(page, 26, 11);
  await walkTo(page, 26, 12);
  await walkTo(page, 25, 12);
  await face(page, 'KeyW');
  await press(page, 'KeyK', 100);
  assert.deepEqual((await state(page)).modals, ['ShipMenu']);
  const komSlot = (await state(page)).inventory.slots.findIndex((x) => x && x.id === 'komatsuna');
  await page.evaluate((i) => { window.__game.game.modals[0].cursor = i; }, komSlot);
  await press(page, 'Enter', 50);
  await press(page, 'Escape', 50);
  s = await state(page);
  assert.equal(s.shipped, 1);
  const cash = s.money;
  await page.evaluate(() => window.__game.game.sleep(false));
  await wake(page);
  assert.equal((await state(page)).money, cash + 4 * 50, 'paid for four komatsuna');

  step('an iron hoe charged for a second tills three tiles in a line');
  await page.evaluate(() => { const g = window.__game.game; g.tiers.hoe = 1; });
  await walkTo(page, 29, 12);
  await walkTo(page, 29, 14);
  await walkTo(page, 24, 15);
  await walkTo(page, 23, 16);
  await face(page, 'KeyS');
  await press(page, 'Digit1');
  await page.evaluate(() => { const G = window.__game; G.hold('KeyJ'); G.advance(900); G.release('KeyJ'); G.advance(600); });
  for (const y of [17, 18, 19]) assert.equal((await tile(page, 23, y)).soil, 1, `tilled 23,${y}`);

  step('passing out at 02:00 costs money and wakes you at home');
  await page.evaluate(() => { const g = window.__game.game; g.cal.minutes = 25 * 60 + 50; g.world.player.x = 40 * 16; g.world.player.y = 30 * 16; });
  const money = (await state(page)).money;
  await page.evaluate(() => window.__game.advance(9000));
  await wake(page);
  s = await state(page);
  assert.equal(s.cal.day, before.cal.day + 2);
  assert.equal(s.money, money - Math.floor(money * 0.1));
  assert.equal(s.genki, 100);
  assert.deepEqual([s.player.tx, s.player.ty], [29, 12], 'woke at the farmhouse');

  assert.deepEqual(errors, [], 'no console errors');
  console.log('smoke test passed');
});
