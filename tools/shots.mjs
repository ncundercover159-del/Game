// Milestone screenshots: `npm run shots` writes shots/m1/*.png. Every shot is set up through the
// game's test hooks so the images are reproducible (fixed seed, fixed times).
import { mkdirSync, writeFileSync } from 'node:fs';
import { withBrowser } from './render-page.mjs';

const OUT = 'shots/m1';
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

  // Smaller window: 1280x720 picks 3x and a 427x240 view.
  await page.setViewportSize({ width: 1280, height: 720 });
  await boot(page, base, 'play=1&seed=7&time=15:30');
  await page.evaluate(() => { const G = window.__game; G.advance(1500); G.game.hud.aside = null; G.advance(50); });
  await shot('10-720p');

  if (errors.length) {
    console.error('Console errors:\n' + errors.join('\n'));
    process.exitCode = 1;
  }
});
