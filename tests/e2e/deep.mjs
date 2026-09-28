// Headless test of M7 deep zones (Playwright): a kitsune in the Foxfire Halls splits into shadowless
// illusions that pop at a touch; a foundry vent glows before it breathes fire; Kurenai's armour
// comes off to a heavy strike; the Kappa Elder falls, bows, leaves his dish and hardens your
// Inochi, and Genzō will now work steel; the Yomi Slope's modifiers; the Shade of Lord Aizawa, the
// choice of the sword, the epilogue and the credits. Setup uses test hooks; the fighting goes
// through the real keys. Fails on any console error or page exception.
import assert from 'node:assert/strict';
import { withBrowser } from '../../tools/render-page.mjs';

const step = (name) => console.log(`- ${name}`);

await withBrowser(async (browser, base) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  const run = (fn, arg) => page.evaluate(fn, arg);
  const floor = (n) => run(async (n) => {
    const G = window.__game, g = G.game;
    g.modals = []; g.hud.aside = null;
    const { enterFloor } = await import('./src/caves.js');
    enterFloor(g, n);
    G.advance(1400);
    g.modals = []; g.hud.aside = null;
  }, n);
  /** Put the named foe right in front of the player, facing it. */
  const front = (i = 0) => run((i) => {
    const g = window.__game.game, p = g.player, f = g.world.combat.foes[i];
    p.dir = 'right';
    f.x = p.x + 20; f.y = p.y;
    return f.kind;
  }, i);

  await page.goto(`${base}/index.html?play=1&seed=7&time=10:00&weather=clear`);
  await page.waitForFunction(() => window.__ready === true);
  await run(() => {
    const G = window.__game, g = G.game;
    G.freeze(); G.advance(800);
    g.flags.ev_welcome = true; g.modals = [];
    g.inventory.resize(24);
    g.inventory.slots[5] = { id: 'kurogane', n: 1, q: 0 };
    g.inventory.select(5);
    g.skills.sword.xp = 1400;
  });

  step('Foxfire Halls: a hurt kitsune splits; the copies cast no shadow and pop at a touch');
  await floor(41);
  const split = await run(() => {
    const G = window.__game, g = G.game, w = g.world, c = w.combat, p = g.player;
    c.foes.length = 0;
    const k = c.spawn('kitsune', p.tx + 2, p.ty);
    k.hp = Math.round(k.maxHp * 0.5);
    k.setState('approach');
    for (let i = 0; i < 90 && !k.mem.split; i++) G.advance(20);
    return { split: k.mem.split, illusions: c.foes.filter((f) => f.illusion).length, xp: g.skills.sword.xp };
  });
  assert.ok(split.split, 'the kitsune split');
  assert.equal(split.illusions, 2);
  await run(() => {
    const g = window.__game.game, c = g.world.combat, p = g.player, clone = c.foes.find((f) => f.illusion);
    for (const f of c.foes) f.setState('recover');
    clone.x = p.x + 18; clone.y = p.y; p.dir = 'right';
  });
  await run(() => { window.__game.press('KeyJ', 60); window.__game.advance(200); });
  const popped = await run(() => ({ illusions: window.__game.game.world.combat.foes.filter((f) => f.illusion).length, xp: window.__game.game.skills.sword.xp }));
  assert.equal(popped.illusions, 1, 'one copy popped');
  assert.equal(popped.xp, split.xp, 'no XP for cutting a copy');

  step('Oni Foundry: a vent glows before it breathes fire, and the fire burns');
  await floor(61);
  const vent = await run(() => {
    const G = window.__game, g = G.game, w = g.world, c = w.combat, p = g.player;
    c.foes.length = 0;
    const v = w.map.objects.find((o) => o.type === 'vent');
    if (!v) return null;
    p.x = v.x * 16 + 8; p.y = v.y * 16 + 12;
    c.fighter.iframes = 0;
    g.hp = g.hpMax;
    const seen = [];
    for (let i = 0; i < 400 && g.hp === g.hpMax; i++) { G.advance(20); if (v.phase && seen.at(-1) !== v.phase) seen.push(v.phase); }
    return { seen, hurt: g.hpMax - g.hp };
  });
  assert.ok(vent, 'the floor has vents');
  assert.ok(vent.hurt > 0, 'the fire burned');
  assert.equal(vent.seen.at(-1), 'fire');
  assert.equal(vent.seen.at(-2), 'glow', 'it glowed first');

  step('Kurenai: light blows glance off her armour; a heavy strike knocks a plate off');
  await floor(80);
  await run(() => { const g = window.__game.game; g.hp = g.hpMax; g.ki = 100; g.world.combat.foes[0].setState('recover'); g.world.combat.foes[0].mem.phase = 1; });
  await front();
  const before = await run(() => ({ armour: window.__game.game.world.combat.foes[0].armour }));
  await run(() => { const G = window.__game; G.game.world.combat.foes[0].t = 0; G.hold('KeyJ'); G.advance(700); G.release('KeyJ'); G.advance(300); });
  const after = await run(() => window.__game.game.world.combat.foes[0].armour);
  assert.equal(before.armour, 3);
  assert.equal(after, 2, 'a plate came off');

  step('The Kappa Elder falls: his dish, more Inochi, the ladder down, and steel at the forge');
  await run(() => { window.__game.game.hp = window.__game.game.hpMax; });
  await floor(40);
  const hp0 = await run(() => window.__game.game.hpMax);
  await run(() => { const c = window.__game.game.world.combat; c.foes[0].hp = 30; c.foes[0].setState('recover'); });
  for (let i = 0; i < 20 && (await run(() => window.__game.game.world.combat.foes.length)); i++) {
    await front();
    await run(() => { const f = window.__game.game.world.combat.foes[0]; if (f) { f.hidden = false; f.setState('recover'); } window.__game.press('KeyJ', 60); window.__game.advance(250); });
  }
  for (let i = 0; i < 40 && (await run(() => window.__game.game.modals.length || window.__game.game.pendingScene)); i++) await run(() => { window.__game.press('Enter', 50); window.__game.advance(250); });
  const won = await run(() => {
    const g = window.__game.game;
    return { flag: g.flags.boss_kappa_elder, hpMax: g.hpMax, dish: g.inventory.count('kappa_dish'), ladder: g.world.map.objects.some((o) => o.type === 'ladder') };
  });
  assert.ok(won.flag);
  assert.equal(won.hpMax, hp0 + 15);
  assert.equal(won.dish, 1);
  assert.ok(won.ladder);
  const forge = await run(async () => {
    const { ForgeMenu } = await import('./src/ui/forge.js');
    const g = window.__game.game;
    g.tiers.hoe = 1;
    const m = new ForgeMenu(g);
    return m.toolRows().map((r) => r.label);
  });
  assert.ok(forge.some((l) => /Steel/.test(l) && !/not yet/.test(l)), forge.join(' | '));

  step('the Yomi Slope: its floors carry modifiers, shown by the floor name');
  await floor(85);
  const yomi = await run(() => ({ mods: window.__game.game.world.map.def.mods, zone: window.__game.game.world.map.def.name }));
  assert.ok(yomi.zone.startsWith('Yomi Slope'));
  assert.equal(yomi.mods.length, 1);

  step('the Shade of Lord Aizawa falls; the sword is laid to rest; the epilogue at the shrine; the credits');
  await floor(100);
  await run(() => { const c = window.__game.game.world.combat; c.foes[0].hp = 20; c.foes[0].mem.phase = 3; c.foes[0].mem.duelCd = 99; c.foes[0].setState('recover'); });
  for (let i = 0; i < 20 && (await run(() => window.__game.game.world.combat.foes.some((f) => f.kind === 'aizawa'))); i++) {
    await run(() => { const g = window.__game.game, c = g.world.combat, f = c.foes.find((x) => x.kind === 'aizawa'), p = g.player; if (!f) return; f.setState('recover'); f.mem.duelCd = 99; p.dir = 'right'; f.x = p.x + 20; f.y = p.y; });
    await run(() => { window.__game.press('KeyJ', 60); window.__game.advance(250); });
  }
  // Through the Shade's words to the choice; take the first ("Lay the sword to rest").
  const seen = [];
  for (let i = 0; i < 120; i++) {
    const s = await run(() => { const g = window.__game.game; return { top: g.modals.at(-1)?.constructor.name || null, map: g.world.map.id, pending: !!g.pendingScene }; });
    if (s.top === 'Credits') break;
    if (!seen.includes(s.map)) seen.push(s.map);
    await run(() => { window.__game.press('Enter', 50); window.__game.advance(300); });
  }
  const end = await run(() => { const g = window.__game.game; return { rest: g.flags.sword_rest, done: g.flags.act3_done, boss: g.flags.boss_aizawa, map: g.world.map.id, top: g.modals.at(-1)?.constructor.name }; });
  assert.ok(end.boss && end.rest && end.done);
  assert.ok(seen.includes('shrine'), 'the epilogue at the shrine');
  assert.equal(end.top, 'Credits');
  await run(() => { window.__game.press('Escape', 50); window.__game.advance(200); });
  assert.equal(await run(() => window.__game.game.modals.length), 0, 'and the game goes on');

  assert.deepEqual(errors, [], errors.join('\n'));
  console.log('deep e2e: ok');
});
