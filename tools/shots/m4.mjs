// Milestone 4 screenshots: the grove, foraging, fishing, the coop, machines, crafting and cooking.
const settle = (map, tx, ty, dir, setup = '') => `(() => {
  const G = window.__game, g = G.game;
  G.advance(1200);
  g.flags.ev_welcome = true;
  g.modals = []; g.hud.aside = null;
  g.enter('${map}', ${tx}, ${ty}, '${dir}');
  ${setup}
  G.advance(120);
  g.hud.aside = null;
})()`;

export default async function m4({ page, base, boot, shot }) {
  // The waterfall and pool on a clear spring morning.
  await boot(page, base, 'play=1&seed=7&time=09:30&weather=clear');
  await page.evaluate(settle('grove', 34, 13, 'left'));
  await shot('35-grove-falls');

  // Light through the bamboo; autumn forage by the path.
  await boot(page, base, 'play=1&seed=7&time=10:00&season=autumn&weather=clear');
  await page.evaluate(settle('grove', 47, 18, 'up'));
  await shot('36-grove-bamboo-autumn');

  // A cast into the farm pond, float out on the water.
  await boot(page, base, 'play=1&seed=7&time=17:20&season=summer&weather=clear');
  await page.evaluate(settle('farm', 50, 26, 'up', `g.inventory.add('rod', 1); g.inventory.select(g.inventory.find('rod'));`));
  await page.evaluate(() => { const G = window.__game; G.hold('KeyJ'); G.advance(900); G.release('KeyJ'); G.advance(900); G.game.hud.aside = null; });
  await shot('37-fishing-cast');
  await page.evaluate(() => {
    const G = window.__game, f = G.game.world.fishing;
    for (let i = 0; i < 300 && f.state && f.state.phase !== 'bite'; i++) G.advance(50);
    G.press('KeyJ'); G.advance(20);
    for (let i = 0; i < 70; i++) { const r = G.game.modals[0]?.reel; if (r && r.fish > r.bar + r.barH / 2) G.hold('KeyJ'); else G.release('KeyJ'); G.advance(1000 / 60); }
    G.release('KeyJ');
  });
  await shot('38-reel-minigame');

  // The coop with chickens and ducks and the morning's eggs.
  await boot(page, base, 'play=1&seed=7&time=08:00&weather=clear');
  await page.evaluate(async () => {
    const { adopt } = await import('/src/systems/animals.js');
    const G = window.__game, g = G.game;
    G.advance(1200);
    g.modals = [];
    for (const k of ['chicken', 'chicken', 'duck', 'chicken', 'duck']) adopt(g.animals, k, 3);
    const m = g.worldFor('coop').map;
    for (const [x, y, id, q] of [[4, 4, 'egg', 0], [7, 5, 'egg', 1], [8, 4, 'duck_egg', 2]]) m.addObject({ type: 'produce', x, y, kind: id, q, v: 0 });
    g.enter('coop', 5, 6, 'up');
    G.advance(4000);
    g.hud.aside = null;
  });
  await shot('39-coop');

  // Machines in the yard, one ready and others working.
  await boot(page, base, 'play=1&seed=7&time=15:30&weather=clear');
  await page.evaluate(settle('farm', 27, 14, 'down', `
    const m = g.worldFor('farm').map;
    const spots = [[21, 16, 'sake_barrel', 'rice', 3], [22, 16, 'miso_barrel', 'daizu', 9], [23, 16, 'tsukemono_tub', 'daikon', 0], [24, 16, 'charcoal_kiln'], [25, 16, 'tofu_press', 'daizu', 1], [26, 16, 'smoker'], [27, 16, 'compost_bin', 'hay', 0]];
    for (const [x, y, kind, input, ready] of spots) {
      const k = m.i(x, y); if (m.objAt[k] >= 0) m.removeObject(m.objects[m.objAt[k]]);
      const o = m.addObject({ type: 'machine', x, y, v: 0, kind });
      if (input) { o.input = input; o.ready = ready; }
    }`));
  await shot('40-machines');

  // The Craft tab and the irori.
  await page.evaluate(() => { const G = window.__game, g = G.game; g.skills.craft.xp = 800; for (const [i, n] of [['wood', 60], ['stone', 40], ['hay', 30], ['bamboo', 10]]) g.inventory.add(i, n); G.press('Tab'); G.press('BracketRight'); G.press('ArrowDown'); G.advance(150); });
  await shot('41-craft-tab');
  await boot(page, base, 'play=1&seed=7&time=19:30&weather=clear');
  await page.evaluate(settle('house_farm', 9, 6, 'up', `
    g.recipes.push('sekihan', 'unadon', 'oden', 'soba_noodles');
    for (const [i, n] of [['rice', 4], ['egg', 3], ['azuki', 1], ['unagi', 1]]) g.inventory.add(i, n);`));
  await page.evaluate(() => { const G = window.__game; G.press('KeyK'); G.advance(150); });
  await shot('42-cooking');

  // Skills and virtues after a season of work, with a buff running.
  await boot(page, base, 'play=1&seed=7&time=11:00&weather=clear');
  await page.evaluate(settle('farm', 29, 14, 'down', `
    Object.assign(g.skills.farming, { xp: 1450, perks: ['tiller'] }); g.skills.foraging.xp = 720; g.skills.fishing.xp = 460; g.skills.mining.xp = 260; g.skills.craft.xp = 1000;
    g.skills.craft.perks = ['patient'];
    Object.assign(g.virtues, { gi: 22, yu: 14, jin: 48, rei: 35, makoto: 18, meiyo: 9, chugi: 40 });
    g.buffs.push({ kind: 'speed', amount: 0.12, until: g.dayIndex * 1440 + 660 + 150 }, { kind: 'fishing', amount: 0.1, until: g.dayIndex * 1440 + 660 + 260 });`));
  await page.evaluate(() => { const G = window.__game; G.press('Tab'); G.press('BracketRight'); G.press('BracketRight'); G.advance(150); });
  await shot('43-skills');

  // Okiku's recipe scrolls at the teahouse counter.
  await boot(page, base, 'play=1&seed=7&time=10:30&day=2&weather=clear');
  await page.evaluate(settle('chaya', 2, 5, 'up'));
  await page.evaluate(() => { const G = window.__game; G.game.openShop('chaya'); G.press('ArrowDown'); G.press('ArrowDown'); G.press('ArrowDown'); G.advance(100); });
  await shot('44-recipe-scrolls');
}
