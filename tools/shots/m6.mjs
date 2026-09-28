// Milestone 6 screenshots: the fuller village on market day, a heart event, the wedding and the
// extended farmhouse, festivals and their minigames (the haiku composer, the Bon Odori, mochi
// pounding, fireworks, Tanabata, the Hyakki Yagyō), the story's tolls and Kuroda's offer, and the
// Village Archive.
const ready = `
  const G = window.__game, g = G.game;
  G.freeze();
  G.advance(1200);
  Object.assign(g.flags, { ev_welcome: true, met_heibei: true, restored_bridge: true });
  g.modals = []; g.hud.aside = null;
  g.inventory.resize(36);
`;

/** Walk into `map` at (tx, ty), let its scene start, then confirm `presses` times. */
const scene = (map, tx, ty, presses, after = 0, setup = '') => `(() => {
  ${ready}
  ${setup}
  g.villagers.snap();
  g.enter('${map}', ${tx}, ${ty}, 'up');
  G.advance(300);
  for (let i = 0; i < ${presses}; i++) { G.press('Enter', 40); G.advance(700); }
  G.advance(${after});
  g.hud.aside = null;
})()`;

export default async function m6({ page, base, boot, shot }) {
  // Market day in the square: Sakuya's stall, the new faces about their business.
  await boot(page, base, 'play=1&seed=7&season=spring&day=4&time=11:00&weather=clear');
  await page.evaluate(`(() => { ${ready} g.flags.rin_arrived = true; g.villagers.snap(); g.enter('village', 55, 20, 'up'); G.advance(400); g.hud.aside = null; })()`);
  await shot('56-market-square');

  // Rin's first heart event: an iai bout at the dōjō at dawn.
  await boot(page, base, 'play=1&seed=7&season=spring&day=3&time=07:00&weather=clear');
  await page.evaluate(scene('dojo', 7, 7, 3, 0, `g.flags.rin_arrived = true; g.bonds.rin = { pts: 600, met: true, talkedDay: -1, giftDay: -1, giftWeek: -1, giftsThisWeek: 0, lastSeen: 0 };`));
  await shot('57-heart-rin');

  // The wedding at the shrine: Ume, with Tomoe officiating.
  await boot(page, base, 'play=1&seed=7&season=spring&day=20&time=06:00&weather=clear');
  await page.evaluate(`(async () => {
    ${ready}
    const r = await import('/src/systems/romance.js');
    g.villagers.snap(); g.enter('shrine', 18, 13, 'up');
    g.pendingScene = r.weddingScript('ume'); G.advance(200);
    for (let i = 0; i < 5; i++) { G.press('Enter', 40); G.advance(1200); }
    g.hud.aside = null;
  })()`);
  await shot('58-wedding');

  // The extended farmhouse at night, the spouse home from the shrine.
  await boot(page, base, 'play=1&seed=7&season=summer&day=5&time=22:30&weather=clear');
  await page.evaluate(`(async () => {
    ${ready}
    g.flags.house_upgraded = true;
    (await import('/src/home.js')).settleHouse(g);
    g.romance.spouse = 'tomoe';
    g.bonds.tomoe = { pts: 2500, met: true, courting: true, talkedDay: -1, giftDay: -1, giftWeek: -1, giftsThisWeek: 0, lastSeen: 0 };
    g.villagers.snap(); g.enter('house_farm', 9, 7, 'up'); G.advance(300); g.hud.aside = null;
  })()`);
  await shot('59-farmhouse-extended');

  // Hanami: the haiku composer, a verse half written.
  await boot(page, base, 'play=1&seed=7&season=spring&day=14&time=11:00&weather=clear');
  await page.evaluate(scene('village', 56, 20, 7));
  await page.evaluate(() => {
    const G = window.__game, h = G.game.modals.at(-1);
    const pick = (s) => h.tray.findIndex((x, i) => x.s === s && !h.lines.flat().includes(x) && i >= 0);
    for (const s of [2, 3]) { h.sel = pick(s); G.press('Enter', 30); }
    h.sel = 5;
    G.advance(100);
  });
  await shot('60-hanami-haiku');

  // Obon: the Bon Odori round the yagura, mid-dance.
  await boot(page, base, 'play=1&seed=7&season=summer&day=20&time=19:00&weather=clear');
  await page.evaluate(scene('village', 56, 21, 7));
  await page.evaluate(() => {
    const G = window.__game, r = G.game.modals.at(-1).r;
    const key = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', use: 'KeyJ' };
    while (r.t < 5) {
      const n = r.notes.find((x) => !x.judge);
      const wait = (n.t - r.t) * 1000;
      if (wait > 20) { G.advance(Math.min(wait - 8, 5000)); continue; }
      G.hold(key[n.key]); G.advance(17); G.release(key[n.key]); G.advance(60);
    }
  });
  await shot('61-obon-bon-odori');

  // Ōmisoka: pounding the New Year's mochi with Okiku, the kine coming down.
  await boot(page, base, 'play=1&seed=7&season=winter&day=28&time=20:30&weather=clear');
  await page.evaluate(scene('village', 55, 20, 4));
  await page.evaluate(() => {
    const G = window.__game, r = G.game.modals.at(-1).r;
    while (r.t < 6) {
      const n = r.notes.find((x) => !x.judge && !x.rest);
      const wait = (n.t - r.t) * 1000;
      if (wait > 20) { G.advance(Math.min(wait - 8, 5000)); continue; }
      G.hold('KeyJ'); G.advance(17); G.release('KeyJ'); G.advance(30);
    }
  });
  await shot('62-omisoka-mochi');

  // Hanabi: fireworks over the river from the bridge.
  await boot(page, base, 'play=1&seed=7&season=summer&day=27&time=20:30&weather=clear');
  await page.evaluate(scene('village', 40, 39, 0));
  await page.evaluate(() => {
    const G = window.__game, g = G.game, cs = g.modals[0];
    for (let i = 0; i < 20 && !cs.fw; i++) { G.press('Enter', 40); G.advance(500); }
    // Catch a chrysanthemum at full bloom.
    for (let i = 0; i < 100 && !cs.fw.bursts.some((b) => b.t > 0.8 && b.t < 0.95); i++) G.advance(20);
    g.hud.aside = null;
  });
  await shot('63-hanabi');

  // Tanabata: wish strips on the bamboo, the precinct crowded at dusk.
  await boot(page, base, 'play=1&seed=7&season=summer&day=7&time=19:30&weather=clear');
  await page.evaluate(`(() => { ${ready} g.flags.fest_tanabata_1 = true; g.villagers.snap(); g.enter('shrine', 19, 13, 'up'); G.advance(400); g.hud.aside = null; })()`);
  await shot('64-tanabata');

  // The Hyakki Yagyō: Kon sees what the others cannot.
  await boot(page, base, 'play=1&seed=7&season=autumn&day=28&time=21:00&weather=clear');
  await page.evaluate(scene('shrine', 19, 14, 7, 400));
  await shot('65-hyakki-yagyo');

  // Summer: Ōkubo posts the toll at the crossroads.
  await boot(page, base, 'play=1&seed=7&season=summer&day=1&time=10:00&weather=clear');
  await page.evaluate(scene('village', 60, 13, 5, 300));
  await shot('66-tolls');

  // Kuroda's offer at his counting house door.
  await boot(page, base, 'play=1&seed=7&season=autumn&day=6&time=11:00&weather=clear');
  await page.evaluate(scene('village', 60, 13, 4, 600, `Object.assign(g.flags, { tolls: true, rin_arrived: true }); g.mail.sent.push('kuroda_invite');`));
  await shot('67-kuroda-offer');

  // The Village Archive's Collection tab, a few shelves filled.
  await boot(page, base, 'play=1&seed=7&season=autumn&day=6&time=11:00&weather=clear');
  await page.evaluate(`(() => {
    ${ready}
    g.flags.restored_archive = true;
    for (const id of ['ayu', 'koi', 'iwana', 'unagi', 'kosen', 'magatama', 'jade', 'iron_ore', 'daikon', 'warabi']) g.archive.donated.push(id);
    g.enter('archive', 6, 5, 'up'); G.advance(200);
    G.press('KeyK', 40); G.advance(100); G.press('BracketRight', 40); G.advance(200);
    g.hud.aside = null;
  })()`);
  await shot('68-archive');
}
