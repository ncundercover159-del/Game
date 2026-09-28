// Milestone 5 screenshots: the open rear gate, Mount Kurayama, fighting in the mine and the flooded
// cellars (tells, glints, parries, foxfire, a yūrei gathering), Jūbei's hall and the iai stand-off,
// the forge's blades, waking in Ume's care, and the virtues at work.
const ready = `
  const G = window.__game, g = G.game;
  G.freeze();
  G.advance(1200);
  g.flags.ev_welcome = true;
  g.flags.restored_bridge = true;
  g.modals = []; g.hud.aside = null;
`;

/** Go down to a floor, clear the modals and put the katana in hand. */
const floor = (n, weapon = 'katana_tetsu') => `(async () => {
  ${ready}
  g.inventory.slots[5] = { id: '${weapon}', n: 1, q: 0 };
  g.inventory.select(5);
  const { enterFloor } = await import('/src/caves.js');
  enterFloor(g, ${n});
  G.advance(1500);
  g.modals = []; g.hud.aside = null;
})()`;

export default async function m5({ page, base, boot, shot }) {
  // The rear gate stands open after the Altar of Yū is restored.
  await boot(page, base, 'play=1&seed=7&time=16:30&weather=clear');
  await page.evaluate(`(() => { ${ready} g.enter('shrine', 19, 5, 'up'); G.advance(200); g.hud.aside = null; })()`);
  await shot('45-shrine-gate-open');

  // Mount Kurayama's foot and the mine mouth, the lost bundle waiting by it.
  await page.evaluate(`(() => { ${ready} g.caves.bundle = [{ id: 'wood', n: 12, q: 0 }]; g.enter('kurayama', 14, 10, 'up'); G.advance(200); g.hud.aside = null; })()`);
  await shot('46-kurayama-mouth');

  // Floor 3: mid-combo against a karakasa, a nobushi raising his blade (the glint) behind it.
  await boot(page, base, 'play=1&seed=7&time=10:00');
  await page.evaluate(floor(3, 'katana_rusted'));
  await page.evaluate(() => {
    const G = window.__game, g = G.game, w = g.world, p = g.player;
    w.combat.foes.length = 0;
    p.dir = 'right';
    const k = w.combat.spawn('karakasa', p.tx + 1, p.ty); k.x = p.x + 20; k.y = p.y; k.setState('recover');
    const b = w.combat.spawn('bandit', p.tx + 3, p.ty - 1); b.x = p.x + 52; b.y = p.y - 10; b.dir = 'left'; b.setState('tell'); b.mem.windup = 5; b.t = 4.9; b.mem.glinted = true;
    w.combat.fighter.startSlash(1);
    G.advance(130);
  });
  await shot('47-mine-combo');

  // A parry: the nobushi's cut turned aside, sparks, the counter window open.
  await page.evaluate(() => {
    const G = window.__game, g = G.game, w = g.world, p = g.player;
    w.combat.foes.length = 0;
    p.dir = 'right';
    const b = w.combat.spawn('bandit', p.tx + 1, p.ty); b.x = p.x + 18; b.y = p.y; b.dir = 'left'; b.setState('tell'); b.mem.windup = 0.2;
    w.combat.fighter.act = null;
    G.advance(60);
    G.press('KeyL', 20);
    G.advance(190);
  });
  await shot('48-parry');

  // The flooded cellars: a kappa lurking, a chōchin-obake spitting foxfire, the Ki ring.
  await boot(page, base, 'play=1&seed=7&time=10:00');
  await page.evaluate(floor(24));
  await page.evaluate(() => {
    const G = window.__game, g = G.game, w = g.world, p = g.player;
    const k = w.combat.foes.find((f) => f.kind === 'kappa');
    if (k) { p.x = k.x - 64; p.y = k.y - 40; }
    w.combat.foes.filter((f) => f !== k).forEach((f) => { f.dead = true; });
    const c = w.combat.spawn('chochin', p.tx + 3, p.ty - 1); c.x = p.x + 50; c.y = p.y - 6; c.setState('tell'); c.t = 0.62; c.mem.glinted = true;
    const s = w.combat.spawn('chochin', p.tx + 2, p.ty + 2); s.x = p.x + 40; s.y = p.y + 36; s.setState('recover');
    w.combat.foxfire(s, p);
    g.ki = 62;
    G.advance(160);
  });
  await shot('49-flooded-cellars');

  // A yūrei's cold wisps gathering beside you before it appears.
  await page.evaluate(() => {
    const G = window.__game, g = G.game, w = g.world, p = g.player;
    const c = w.combat.foes.find((f) => f.kind === 'chochin');
    if (c) c.dead = true;
    const y = w.combat.spawn('yurei', p.tx - 2, p.ty); y.x = p.x - 30; y.y = p.y + 4; y.setState('drift'); y.t = 0;
    const o = w.combat.spawn('yurei', p.tx + 1, p.ty + 1); o.x = p.x + 18; o.y = p.y + 10; o.hidden = true; o.setState('omen'); o.mem.glinted = true;
    G.advance(200);
  });
  await shot('50-yurei-omen');

  // Jūbei's hall: braziers, pit-props, the chief closing in; his name and health above.
  await boot(page, base, 'play=1&seed=7&time=10:00');
  await page.evaluate(floor(20));
  await page.evaluate(() => {
    const G = window.__game, g = G.game, w = g.world, p = g.player, f = w.combat.foes[0];
    p.x = f.x - 8; p.y = f.y + 60; p.dir = 'up';
    f.setState('approach'); f.hp = Math.round(f.maxHp * 0.72);
    G.advance(700);
    g.hud.aside = null;
  });
  await shot('51-boss-jubei');

  // The stand-off: the bell.
  await page.evaluate(() => {
    const G = window.__game, g = G.game, f = g.world.combat.foes[0];
    f.hp = Math.round(f.maxHp * 0.25);
    for (let i = 0; i < 80 && !g.modals.some((m) => m.duel); i++) G.advance(100);
    g.hud.aside = null;
    const m = g.modals.find((x) => x.duel);
    for (let i = 0; i < 200 && m.duel.round.phase !== 'cue'; i++) G.advance(30);
    G.advance(60);
  });
  await shot('52-iai-standoff');

  // Genzō's blades.
  await boot(page, base, 'play=1&seed=7&time=11:00&day=2');
  await page.evaluate(`(() => { ${ready} g.flags.boss_jubei = true; g.money = 4000;
    g.inventory.slots.splice(6, 4, { id: 'iron_bar', n: 6, q: 0 }, { id: 'copper_bar', n: 2, q: 0 }, { id: 'jade', n: 3, q: 0 }, { id: 'wood', n: 40, q: 0 });
    g.enter('kajiya', 4, 6, 'up'); G.advance(100); g.openShop('kajiya'); G.press('BracketRight'); G.advance(100); })()`);
  await shot('53-forge-blades');

  // Waking in Ume's care after a defeat.
  await boot(page, base, 'play=1&seed=7&time=14:00');
  await page.evaluate(floor(4));
  await page.evaluate(() => {
    const G = window.__game, g = G.game, w = g.world, p = g.player;
    g.money = 3000;
    g.inventory.add('copper_ore', 8);
    w.combat.foes.length = 0;
    g.hp = 3;
    const f = w.combat.spawn('bandit', p.tx, p.ty + 1); f.x = p.x; f.y = p.y + 14; f.dir = 'up'; f.setState('attack'); f.mem.struck = false;
    for (let i = 0; i < 60 && g.world.map.id !== 'yakuya'; i++) G.advance(100);
    G.advance(2200);
  });
  await shot('54-defeat-ume');

  // Virtues at work: the Skills tab after a season of fights and good deeds.
  await boot(page, base, 'play=1&seed=7&time=11:00');
  await page.evaluate(`(() => { ${ready}
    Object.assign(g.virtues, { gi: 31, yu: 56, jin: 42, rei: 27, makoto: 18, meiyo: 38, chugi: 25 });
    Object.assign(g.skills.sword, { xp: 1450, perks: ['guardian'] }); g.skills.mining.xp = 760; g.skills.farming.xp = 900;
    g.enter('farm', 29, 14, 'down'); G.advance(100); G.press('Tab'); G.press('BracketRight'); G.press('BracketRight'); G.advance(150); })()`);
  await shot('55-skills-virtues');
}
