// Headless smoke test (Playwright): boot, new game from the title menu, walk, till, plant, water,
// go indoors and sleep in the futon, check overnight growth, walk to the village and shop, then
// reload and verify the save.
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
/** Confirm through whatever is open (end-of-day screen, dialogue, cutscene) until nothing is. */
async function wake(page) {
  for (let i = 0; i < 40; i++) {
    const s = await state(page);
    if (!s.modals.length) return;
    await press(page, 'Enter', 500);
  }
  throw new Error('stuck in the night');
}
const tile = (page, x, y, map) => page.evaluate(([a, b, m]) => window.__game.tile(a, b, m), [x, y, map]);
/** Step through a warp tile by walking one tile in `key`'s direction, then let the wipe finish. */
async function through(page, key, map) {
  await page.evaluate((k) => { const G = window.__game; G.hold(k); G.advance(400); G.release(k); G.advance(1200); }, key);
  assert.equal((await state(page)).map, map, `arrived in ${map}`);
}
/** From the farmhouse bed-side back out to the doorstep. */
async function leaveHouse(page) {
  await walkTo(page, 6, 8);
  await through(page, 'KeyS', 'farm');
}

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

  step('goes indoors and sleeps in the futon');
  await walkTo(page, 25, 17);
  await walkTo(page, 24, 15);
  await walkTo(page, 29, 14);
  await walkTo(page, 29, 11);
  await through(page, 'KeyW', 'house_farm');
  await walkTo(page, 3, 5);
  await face(page, 'KeyA');
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
  assert.equal(s.map, 'house_farm', 'woke up indoors');
  const grown = await tile(page, 24, 18, 'farm');
  assert.equal(grown.crop.growth, 1, 'watered crop grew overnight');
  assert.equal(grown.wet, 0, 'soil dried');

  step('harvests a ripe crop by hand');
  await page.evaluate(() => { const m = window.__game.game.worldFor('farm').map; m.crops.get(m.i(24, 18)).growth = 4; });
  await leaveHouse(page);
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
  await leaveHouse(page);
  await walkTo(page, 29, 12);
  await walkTo(page, 29, 14);
  await walkTo(page, 24, 15);
  await walkTo(page, 23, 16);
  await face(page, 'KeyS');
  await press(page, 'Digit1');
  await page.evaluate(() => { const G = window.__game; G.hold('KeyJ'); G.advance(900); G.release('KeyJ'); G.advance(600); });
  for (const y of [17, 18, 19]) assert.equal((await tile(page, 23, y)).soil, 1, `tilled 23,${y}`);

  step('walks the valley road to the village, buys at the teahouse counter and eats');
  await page.evaluate(() => { window.__game.game.cal.minutes = 600; });
  await walkTo(page, 23, 15);
  await walkTo(page, 1, 15);
  await through(page, 'KeyA', 'village');
  step('the headman meets you on the road (welcome cutscene)');
  assert.deepEqual((await state(page)).modals.slice(0, 1), ['Cutscene']);
  await wake(page);
  s = await state(page);
  assert.ok(s.inventory.slots.some((x) => x && x.id === 'dango'), 'Heibei gave dango');
  assert.ok(s.bonds.heibei.met && s.bonds.heibei.pts >= 40, 'met Heibei');
  await walkTo(page, 16, 12);
  await through(page, 'KeyW', 'chaya');
  await walkTo(page, 2, 5);
  await face(page, 'KeyW');
  await press(page, 'KeyK', 100);
  assert.deepEqual((await state(page)).modals, ['Dialog'], 'Okiku asks what you want');
  for (let i = 0; i < 4 && (await state(page)).modals[0] !== 'ShopMenu'; i++) await press(page, 'Enter', 50);
  assert.deepEqual((await state(page)).modals, ['ShopMenu'], 'counter opens the shop');
  const purse = (await state(page)).money;
  await press(page, 'ArrowDown');
  await press(page, 'ArrowDown');
  await press(page, 'Enter', 50);
  await press(page, 'Escape', 50);
  s = await state(page);
  assert.equal(s.money, purse - 90, 'paid for an onigiri');
  const onigiri = s.inventory.slots.findIndex((x) => x && x.id === 'onigiri');
  await page.evaluate((i) => { const g = window.__game.game; g.genki = 100; g.inventory.select(i); }, onigiri);
  await press(page, 'KeyJ', 100);
  assert.equal((await state(page)).genki, 170, 'eating restores Genki');
  await walkTo(page, 6, 7);
  await through(page, 'KeyS', 'village');
  s = await state(page);
  assert.deepEqual([s.player.tx, s.player.ty], [16, 12], 'back on the street');

  step('talks to a villager and the bond grows');
  const okiku = await page.evaluate(() => { const g = window.__game.game, n = g.villagers.get('okiku'); return { map: n.map, tx: n.tx, ty: n.ty }; });
  assert.equal(okiku.map, 'chaya', 'Okiku keeps her teahouse at 10:00');
  await page.evaluate(() => { const g = window.__game.game; g.talkTo(g.villagers.get('kaito')); });
  await wake(page);
  assert.ok((await state(page)).bonds.kaito.pts >= 20, 'talking to Kaito earned bond points');

  step('passing out at 02:00 costs money and wakes you in the farmhouse');
  await page.evaluate(() => { const g = window.__game.game; g.cal.minutes = 25 * 60 + 50; });
  const money = (await state(page)).money;
  await page.evaluate(() => window.__game.advance(9000));
  await wake(page);
  s = await state(page);
  assert.equal(s.cal.day, before.cal.day + 2);
  assert.equal(s.money, money - Math.floor(money * 0.1));
  assert.equal(s.genki, 100);
  assert.equal(s.map, 'house_farm');
  assert.deepEqual([s.player.tx, s.player.ty], [3, 5], 'woke beside the futon');

  assert.deepEqual(errors, [], 'no console errors');
  console.log('smoke test passed');
});
