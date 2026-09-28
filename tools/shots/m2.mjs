// Milestone 2 screenshots (see tools/shots.mjs for the runner and helpers).
export default async function m2({ page, base, boot, shot }) {
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
}
