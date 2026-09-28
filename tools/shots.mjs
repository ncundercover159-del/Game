// Milestone screenshots: `npm run shots` writes shots/m1/*.png. Every shot is set up through the
// game's test hooks so the images are reproducible (fixed seed, fixed times).
import { mkdirSync, writeFileSync } from 'node:fs';
import { withBrowser } from './render-page.mjs';

// Output folder: `npm run shots -- shots/m1` regenerates an older set's layout into that folder.
const OUT = process.argv[2] || 'shots/m2';
mkdirSync(OUT, { recursive: true });

const boot = async (page, base, query) => {
  await page.goto(`${base}/index.html?${query}`);
  await page.waitForFunction(() => window.__ready === true);
};

// Lays out a showcase field: each crop in a row, one plant per growth stage, some watered.
const showcase = () => {
  const G = window.__game, g = G.game, m = g.world.map;
  const crops = ['daikon', 'komatsuna', 'soramame', 'strawberry'];
  const days = { daikon: 4, komatsuna: 5, soramame: 6, strawberry: 8 };
  crops.forEach((id, row) => {
    for (let st = 0; st < 5; st++) {
      const x = 22 + st, y = 18 + row;
      const k = m.i(x, y);
      m.ground[k] = 1; m.soil[k] = 1; m.wet[k] = st % 2; m.touch(x, y);
      const growth = st === 0 ? 0 : st === 4 ? days[id] : Math.ceil((st * days[id]) / 4) - (st === 3 ? 1 : 0);
      m.crops.set(k, { id, growth });
    }
  });
  const p = g.world.player;
  p.x = 27 * 16 + 8; p.y = 21 * 16 + 14; p.dir = 'left';
  g.hud.aside = null;
  G.advance(100);
};

await withBrowser(async (browser, base) => {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log(`  ${OUT}/${name}.png`); };

  await boot(page, base, 'seed=7');
  await page.evaluate(() => window.__game.advance(500));
  await shot('01-title');

  await boot(page, base, 'play=1&seed=7');
  await page.evaluate(() => window.__game.advance(1500));
  await shot('02-first-morning');

  await boot(page, base, 'play=1&seed=7&time=10:20');
  await page.evaluate(() => window.__game.advance(1200));
  await page.evaluate(showcase);
  await shot('03-crop-stages');

  // Axe mid-strike on a stump, chips flying.
  await boot(page, base, 'play=1&seed=7&time=13:00');
  await page.evaluate(() => {
    const G = window.__game, g = G.game, m = g.world.map;
    G.advance(1200);
    g.hud.aside = null;
    const stump = m.objects.find((o) => o.type === 'stump' && o.y > 14 && !m.solid(o.x + 1, o.y) && !m.solid(o.x + 1, o.y - 1));
    const p = g.world.player;
    p.x = (stump.x + 1) * 16 + 8; p.y = stump.y * 16 + 14; p.dir = 'left';
    g.inventory.select(3);
    G.advance(50);
    G.hold('KeyJ'); G.advance(380); G.advance(170);
  });
  await shot('04-axe-swing');
  await page.evaluate(() => window.__game.release('KeyJ'));

  for (const [time, name] of [['17:50', '05-golden-hour'], ['21:40', '06-night']]) {
    await boot(page, base, `play=1&seed=7&time=${time}`);
    await page.evaluate(() => { const G = window.__game; G.advance(1500); G.game.hud.aside = null; G.advance(50); });
    await shot(name);
  }

  await boot(page, base, 'play=1&seed=7&time=09:00');
  await page.evaluate(() => {
    const G = window.__game;
    G.advance(1200);
    G.game.hud.aside = null;
    G.game.pickUp('wood', 23); G.game.pickUp('daikon', 3, 1); G.game.pickUp('stone', 8);
    G.press('Tab'); G.press('ArrowRight'); G.press('ArrowRight'); G.press('ArrowRight'); G.press('ArrowRight'); G.press('ArrowRight');
    G.advance(200);
  });
  await shot('07-menu-items');

  await page.evaluate(() => { const G = window.__game; G.press('Escape'); G.advance(50); G.game.sleep(false); G.advance(1400); });
  await shot('08-day-end');

  // The whole farm at 1x, rendered straight from the world drawer.
  await boot(page, base, 'play=1&seed=7&time=11:00');
  const url = await page.evaluate(async () => {
    const { drawWorld } = await import('/src/world/draw.js');
    const G = window.__game, g = G.game;
    G.advance(1200);
    const m = g.world.map;
    const c = document.createElement('canvas');
    c.width = m.pw; c.height = m.ph;
    const ctx = c.getContext('2d');
    drawWorld(g.world, ctx, { x: 0, y: 0, ix: 0, iy: 0, w: m.pw, h: m.ph });
    return c.toDataURL('image/png');
  });
  writeFileSync(`${OUT}/09-farm-overview.png`, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`  ${OUT}/09-farm-overview.png`);

  // M2: seasons and weather.
  for (const [name, q] of [['11-summer', 'season=summer&day=14&weather=clear&time=11:00'], ['12-autumn-wind', 'season=autumn&day=10&weather=wind&time=15:00'],
    ['13-winter-snow', 'season=winter&day=5&weather=snow&time=12:00'], ['14-spring-rain', 'season=spring&day=5&weather=rain&time=10:00'],
    ['15-summer-storm-night', 'season=summer&day=20&weather=storm&time=20:30']]) {
    await boot(page, base, `play=1&seed=7&${q}`);
    await page.evaluate(() => { const G = window.__game; G.advance(1500); G.game.hud.aside = null; G.advance(30); });
    await shot(name);
  }

  // Irrigation: a channel from the pond, a sluice gate, rice in flooded paddies either side.
  await boot(page, base, 'play=1&seed=7&season=spring&day=6&time=10:00&weather=clear');
  await page.evaluate(async () => {
    const G = window.__game, g = G.game, m = g.world.map;
    const { computeFlow } = await import('/src/systems/irrigation.js');
    G.advance(1500);
    g.hud.aside = null;
    const clear = (x, y) => { const k = m.i(x, y); if (m.objAt[k] >= 0) m.removeObject(m.objects[m.objAt[k]]); m.ground[k] = 1; m.touch(x, y); return k; };
    for (let x = 38; x <= 45; x++) m.soil[clear(x, 21)] = 2;
    for (let x = 38; x <= 44; x++) for (const y of [20, 22]) {
      const k = clear(x, y);
      m.soil[k] = 1;
      if (x % 2) m.crops.set(k, { id: 'rice', growth: x % 4 === 1 ? 8 : 4 });
    }
    m.addObject({ type: 'sluice', x: 41, y: 21, v: 0, open: true });
    computeFlow(m);
    g.world.player.x = 40 * 16; g.world.player.y = 19 * 16 + 12;
    G.advance(100);
  });
  await shot('16-irrigation-paddies');

  await boot(page, base, 'play=1&seed=7&season=spring&day=6&time=10:00');
  await page.evaluate(() => { const G = window.__game; G.advance(1500); G.game.hud.aside = null; G.game.openShop('yorozuya'); G.press('ArrowDown'); G.advance(100); });
  await shot('17-yorozuya');
  await page.evaluate(() => { const G = window.__game, g = G.game; g.modals = []; g.money = 9000; g.inventory.add('iron_bar', 5); g.openShop('kajiya'); G.advance(100); });
  await shot('18-forge');

  await boot(page, base, 'play=1&seed=7&season=spring&day=28&time=21:00');
  await page.evaluate(() => {
    const G = window.__game, g = G.game;
    G.advance(1500);
    g.shipped = [{ id: 'daikon', n: 12, q: 0 }, { id: 'strawberry', n: 5, q: 1 }, { id: 'wood', n: 40, q: 0 }];
    g.sleep(false);
    G.advance(2500);
  });
  await shot('19-end-of-day');

  // Every crop, ripe, in rows of six (generated and hand-drawn alike).
  await boot(page, base, 'play=1&seed=7&season=summer&day=6&time=11:00&weather=clear');
  await page.evaluate(async () => {
    const { CROPS } = await import('/src/data/crops.js');
    const G = window.__game, g = G.game, m = g.world.map;
    G.advance(1500);
    g.hud.aside = null;
    Object.keys(CROPS).forEach((id, i) => {
      const x = 22 + (i % 6), y = 17 + Math.floor(i / 6);
      const k = m.i(x, y);
      if (m.objAt[k] >= 0) m.removeObject(m.objects[m.objAt[k]]);
      m.ground[k] = 1; m.soil[k] = 1; m.touch(x, y);
      m.crops.set(k, { id, growth: CROPS[id].days });
    });
    g.world.player.x = 28 * 16 + 8; g.world.player.y = 16 * 16 + 14; g.world.player.dir = 'down';
    G.advance(100);
  });
  await shot('21-all-crops-ripe');

  // Smaller window: 1280x720 picks 3x and a 427x240 view.
  await page.setViewportSize({ width: 1280, height: 720 });
  await boot(page, base, 'play=1&seed=7&time=15:30');
  await page.evaluate(() => { const G = window.__game; G.advance(1500); G.game.hud.aside = null; G.advance(50); });
  await shot('20-720p');

  if (errors.length) {
    console.error('Console errors:\n' + errors.join('\n'));
    process.exitCode = 1;
  }
});
