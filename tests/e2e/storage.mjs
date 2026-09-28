// Headless test of storage chests (Playwright): a small chest crafted in the Craft tab, set down
// beside the farmhouse, a stack put in through the chest screen with the real keys, the chest and
// its stack surviving a save and reload, the axe refusing a full chest and taking up an empty one.
// Fails on any console error or page exception.
import assert from 'node:assert/strict';
import { withBrowser } from '../../tools/render-page.mjs';

const step = (name) => console.log(`- ${name}`);

await withBrowser(async (browser, base) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  const run = (fn, arg) => page.evaluate(fn, arg);

  await page.goto(`${base}/index.html?play=1&seed=7&time=10:00&weather=clear`);
  await page.waitForFunction(() => window.__ready === true);
  await run(() => {
    const G = window.__game, g = G.game;
    G.freeze(); G.advance(800);
    Object.assign(g.flags, { ev_welcome: true, met_heibei: true });
    g.modals = []; g.hud.aside = null;
    g.inventory.resize(24);
    g.inventory.add('wood', 80);
  });

  step('a small chest is crafted in the Craft tab');
  const made = await run(() => {
    const G = window.__game, g = G.game;
    G.press('Escape'); G.advance(100);
    const menu = g.modals[0];
    menu.tab = 1; G.advance(50);
    menu.craft.sel = menu.craft.rows().findIndex((r) => r.id === 'box_small');
    G.press('Enter'); G.advance(100);
    G.press('Escape'); G.advance(100);
    return { box: g.inventory.count('box_small'), wood: g.inventory.count('wood'), open: g.modals.length };
  });
  assert.deepEqual(made, { box: 1, wood: 55, open: 0 });

  step('set down in front of you with the Use key');
  const placed = await run(() => {
    const G = window.__game, g = G.game, w = g.world, m = w.map, p = g.player;
    p.dir = 'right'; G.advance(20);
    const { x, y } = w.target;
    const o = m.objectAt(x, y); if (o) m.removeObject(o);
    m.soil[m.i(x, y)] = 0;
    g.inventory.select(g.inventory.find('box_small'));
    G.press('KeyJ', 60); G.advance(300);
    const c = m.objectAt(x, y);
    return { type: c?.type, kind: c?.kind, slots: c?.items?.length, left: g.inventory.count('box_small'), x, y };
  });
  assert.equal(placed.type, 'store');
  assert.equal(placed.kind, 'box_small');
  assert.equal(placed.slots, 12);
  assert.equal(placed.left, 0);

  step('opened with Interact; the wood goes in, from the pack row, with the arrows and Enter');
  const stored = await run(() => {
    const G = window.__game, g = G.game;
    G.press('KeyE', 60); G.advance(100);
    const menu = g.modals.at(-1), name = menu?.constructor.name;
    const at = g.inventory.find('wood');
    G.press('ArrowDown', 30);                                   // from the chest's row into the pack's
    for (let i = 0; i < at; i++) G.press('ArrowRight', 30);
    G.press('Enter', 30); G.advance(60);
    G.press('Escape'); G.advance(100);
    const o = g.world.map.objectAt(g.world.target.x, g.world.target.y);
    return { name, chest: o.items[0], packWood: g.inventory.count('wood'), open: g.modals.length };
  });
  assert.equal(stored.name, 'StoreMenu');
  assert.deepEqual(stored.chest, { id: 'wood', n: 55, q: 0 });
  assert.equal(stored.packWood, 0);
  assert.equal(stored.open, 0);

  step('the chest and its wood survive a save and a reload');
  await run(() => window.__game.game.saveNow(true));
  const slot = await run(() => window.__game.game.slot);
  await page.goto(`${base}/index.html?slot=${slot}&seed=7`);
  await page.waitForFunction(() => window.__ready === true);
  const back = await run(([x, y]) => {
    const G = window.__game, g = G.game;
    G.freeze(); G.advance(300);
    const o = g.worldFor('farm').map.objectAt(x, y);
    return { type: o?.type, first: o?.items?.[0] };
  }, [placed.x, placed.y]);
  assert.equal(back.type, 'store');
  assert.deepEqual(back.first, { id: 'wood', n: 55, q: 0 });

  step('the axe will not take up a full chest, and takes up an empty one');
  const axe = await run(([x, y]) => {
    const G = window.__game, g = G.game, w = g.world, p = g.player;
    g.modals = []; g.hud.aside = null;
    p.x = (x - 1) * 16 + 8; p.y = y * 16 + 12; p.dir = 'right'; G.advance(30);
    g.inventory.select(g.inventory.find('axe'));
    G.press('KeyJ', 60); G.advance(500);
    const full = !!w.map.objectAt(x, y);
    w.map.objectAt(x, y).items[0] = null;
    G.advance(200);
    G.press('KeyJ', 60); G.advance(500);
    return { full, gone: !w.map.objectAt(x, y) };
  }, [placed.x, placed.y]);
  assert.ok(axe.full, 'a full chest stays put');
  assert.ok(axe.gone, 'an empty one comes up');

  assert.deepEqual(errors, [], errors.join('\n'));
  console.log('storage e2e: ok');
});
