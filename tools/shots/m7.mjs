// Milestone 7 screenshots: the parallax title and the new-farm steps, the deep (the Foxfire Halls,
// the Oni Foundry, the Yomi Slope, Kyūbi, Kurenai, the Shade of Lord Aizawa's stand-off) and the
// epilogue, the kodama at home, the dōjō's kata and kyūdō, striking at Genzō's anvil, the goldfish
// tub, and the settings and touch controls.
const ready = `
  const G = window.__game, g = G.game;
  G.freeze();
  G.advance(1200);
  Object.assign(g.flags, { ev_welcome: true, met_heibei: true, restored_bridge: true, rin_arrived: true });
  g.modals = []; g.hud.aside = null;
  g.inventory.resize(36);
`;

/** Down to `floor` with a blade in hand, the floor's scene cleared away; then `setup`. */
const floor = (n, blade, setup = '') => `(async () => {
  ${ready}
  g.hp = g.hpMax = 300;
  g.inventory.slots[5] = { id: '${blade}', n: 1, q: 0 }; g.inventory.select(5);
  const { enterFloor } = await import('/src/caves.js');
  enterFloor(g, ${n}); G.advance(1400); g.modals = []; g.hud.aside = null;
  const w = g.world, c = w.combat, p = g.player, f = c.foes[0];
  ${setup}
  g.hud.aside = null;
})()`;

/** Push a minigame modal and let it run for `ms`, holding nothing. */
const game = (path, cls, opts, ms, extra = '') => `(async () => {
  ${ready}
  const m = await import('${path}');
  g.modals.push(new m.${cls}(g, { ...${JSON.stringify(opts)}, onEnd: () => {} }));
  ${extra}
  G.advance(${ms});
})()`;

export default async function m7({ page, base, boot, shot }) {
  // The title in spring: the valley in parallax, petals on the wind.
  await boot(page, base, 'seed=7');
  await page.evaluate(async () => {
    const G = window.__game, g = G.game, { TitleScene } = await import('/src/ui/titleScene.js');
    G.freeze(); g.title.scene = new TitleScene('spring'); G.advance(6000);
  });
  await shot('69-title');

  // A new farm: how you look, and the Woodland layout's little map.
  await page.evaluate(() => {
    const G = window.__game;
    G.press('Enter'); G.press('Enter'); G.advance(200);
    G.type('\b\b\b\b\b\bAkane'); G.press('Enter'); G.press('Enter');
    for (const k of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight']) G.press(k);
    G.advance(900);
  });
  await shot('70-new-farm-look');
  await page.evaluate(() => {
    const G = window.__game;
    G.press('ArrowDown'); G.press('ArrowDown'); G.press('Enter'); G.press('Enter'); G.press('ArrowDown'); G.advance(300);
  });
  await shot('71-new-farm-layout');

  // The Foxfire Halls: a hurt kitsune splits; the copies cast no shadow.
  await boot(page, base, 'play=1&seed=7&time=10:00&weather=clear');
  await page.evaluate(floor(47, 'kurogane', `
    c.foes.length = 0;
    const k = c.spawn('kitsune', p.tx + 3, p.ty); k.hp = Math.round(k.maxHp * 0.5); k.setState('approach');
    c.spawn('onibi', p.tx - 3, p.ty + 2);
    for (let i = 0; i < 90 && !k.mem.split; i++) G.advance(20);
    G.advance(300);`));
  await shot('72-foxfire-halls');

  // The Oni Foundry: lava light, a vent breathing fire, an oni winding up.
  await boot(page, base, 'play=1&seed=7&time=10:00&weather=clear');
  await page.evaluate(floor(66, 'kitsunebi', `
    const v = w.map.objects.find((o) => o.type === 'vent');
    if (v) { p.x = v.x * 16 + 40; p.y = v.y * 16 + 12; }
    c.foes.length = 0; const o = c.spawn('oni', p.tx + 3, p.ty); o.setState('approach');
    for (let i = 0; i < 200 && !(v && v.phase === 'fire'); i++) G.advance(20);`));
  await shot('73-oni-foundry');

  // The Yomi Slope: a modified floor, the ghostly retainers.
  await boot(page, base, 'play=1&seed=7&time=10:00&weather=clear');
  await page.evaluate(floor(95, 'onikiri', `
    c.foes.length = 0; const r = c.spawn('retainer', p.tx + 3, p.ty); r.setState('approach'); c.spawn('yurei', p.tx - 3, p.ty + 1); G.advance(600);`));
  await shot('74-yomi-slope');

  // Kyūbi's orbs, and Kurenai leaping.
  await boot(page, base, 'play=1&seed=7&time=10:00&weather=clear');
  await page.evaluate(floor(60, 'kitsunebi', `p.x = f.x; p.y = f.y + 60; f.hp = f.maxHp * 0.5; G.advance(2400);`));
  await shot('75-boss-kyubi');
  await boot(page, base, 'play=1&seed=7&time=10:00&weather=clear');
  await page.evaluate(floor(80, 'onikiri', `p.x = f.x - 20; p.y = f.y + 70; G.advance(1800);`));
  await shot('76-boss-kurenai');

  // The Shade of Lord Aizawa: the last stand-off.
  await boot(page, base, 'play=1&seed=7&time=10:00&weather=clear');
  await page.evaluate(floor(100, 'tsukikage', `p.x = f.x; p.y = f.y + 50; f.hp = f.maxHp * 0.25; for (let i = 0; i < 200 && !g.modals.some((m) => m.duel); i++) G.advance(30); G.advance(600);`));
  await shot('77-shade-duel');

  // The epilogue on the shrine stair at dawn.
  await boot(page, base, 'play=1&seed=7&season=spring&day=2&time=06:00&weather=clear');
  await page.evaluate(`(async () => {
    ${ready}
    Object.assign(g.flags, { petition_won: true, sword_rest: true, act3_done: true });
    g.romance.spouse = 'tomoe';
    const { startEpilogue } = await import('/src/epilogue.js');
    startEpilogue(g); G.advance(1500);
    for (let i = 0; i < 3; i++) { G.press('Enter', 40); G.advance(1500); }
    g.hud.aside = null;
  })()`);
  await shot('78-epilogue');

  // Kodama at home by their hokora among the beds, glowing after dark.
  await boot(page, base, 'play=1&seed=7&season=summer&day=5&time=20:30&weather=clear');
  await page.evaluate(`(() => {
    ${ready}
    Object.assign(g.flags, { restored_kodama: true, kodama_friends: 2 });
    const m = g.world.map, p = g.player, cx = p.tx, cy = p.ty + 4;
    for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 5; x <= cx + 5; x++) {
      const o = m.objectAt(x, y); if (o) m.removeObject(o);
      const k = m.i(x, y); m.soil[k] = 1; m.wet[k] = 1; m.crops.set(k, { id: 'nasu', growth: 4, q: 0 }); m.touch(x, y);
    }
    for (const x of [cx - 3, cx + 3]) { const k = m.i(x, cy); m.crops.delete(k); m.soil[k] = 0; m.touch(x, cy); m.addObject({ type: 'hokora', x, y: cy, v: 0 }); }
    p.x = cx * 16 + 8; p.y = (cy - 3) * 16 + 12; p.dir = 'down';
    G.advance(600); g.hud.aside = null;
  })()`);
  await shot('79-kodama');

  // The dōjō: kata with Rin; kyūdō, the arrow drawn and the wind blowing.
  await boot(page, base, 'play=1&seed=7&season=spring&day=3&time=07:00&weather=clear');
  await page.evaluate(game('/src/ui/rhythm.js', 'RhythmGame', { kind: 'kata', partner: 'rin' }, 3200));
  await shot('80-kata');
  await boot(page, base, 'play=1&seed=7&season=spring&day=3&time=07:00&weather=clear');
  await page.evaluate(game('/src/ui/kyudo.js', 'KyudoGame', {}, 1600, `G.advance(100); G.hold('KeyJ');`));
  await shot('81-kyudo');

  // Striking at Genzō's anvil, sparks off the bar.
  await boot(page, base, 'play=1&seed=7&season=spring&day=3&time=10:00&weather=clear');
  await page.evaluate(`(async () => {
    ${ready}
    const { RhythmGame } = await import('/src/ui/rhythm.js');
    const m = new RhythmGame(g, { kind: 'forge', partner: 'genzo', onEnd: () => {} });
    g.modals.push(m);
    const r = m.r;
    while (r.t < 4) {
      const n = r.notes.find((x) => !x.judge && !x.rest);
      const wait = (n.t - r.t) * 1000;
      if (wait > 20) { G.advance(Math.min(wait - 8, 5000)); continue; }
      G.hold('KeyJ'); G.advance(17); G.release('KeyJ'); G.advance(40);
    }
  })()`);
  await shot('82-forge');

  // The goldfish tub at Hanabi, the paper wet.
  await boot(page, base, 'play=1&seed=7&season=summer&day=27&time=19:10&weather=clear');
  await page.evaluate(game('/src/ui/kingyo.js', 'KingyoGame', {}, 900, `G.advance(100); G.hold('ArrowRight'); G.advance(500); G.release('ArrowRight'); G.hold('KeyJ');`));
  await shot('83-kingyo');

  // Settings at Larger text, and the touch controls in play.
  await page.addInitScript(() => localStorage.setItem('ronin.settings', JSON.stringify({ textSize: 'larger', touch: 'on' })));
  await boot(page, base, 'play=1&seed=7&season=spring&day=3&time=10:00&weather=clear');
  await page.evaluate(`(() => { ${ready} G.press('Escape'); G.advance(100); g.modals[0].tab = 4; G.advance(100); })()`);
  await shot('84-settings-large-text');
  await page.evaluate(`(() => { ${ready} G.advance(300); })()`);
  await shot('85-touch-controls');
}
