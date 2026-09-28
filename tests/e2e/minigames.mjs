// Headless test of M7c (Playwright): a kodama befriended on the shrine stair at dusk, a hokora
// crafted and set among the beds, and the beds watered overnight; kata with Rin and kyūdō at the
// dōjō; striking with Genzō at the anvil for Excellent steel; the goldfish tub at Hanabi. The
// minigames are played through the real keys by small bots that read the screen's state.
// Fails on any console error or page exception.
import assert from 'node:assert/strict';
import { withBrowser } from '../../tools/render-page.mjs';

const step = (name) => console.log(`- ${name}`);
const KEY = { use: 'KeyJ', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

await withBrowser(async (browser, base) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  const run = (fn, arg) => page.evaluate(fn, arg);
  const top = () => run(() => window.__game.game.modals.at(-1)?.constructor.name || null);
  /** Confirm through dialogue until `name` is on top (or nothing is open). */
  const until = async (name) => {
    for (let i = 0; i < 80; i++) {
      const t = await top();
      if (t === name || (!t && !(await run(() => window.__game.game.pendingScene)))) return t;
      await run(() => { window.__game.press('Enter', 50); window.__game.advance(250); });
    }
    throw new Error(`never reached ${name}`);
  };
  const boot = async (q) => {
    await page.goto(`${base}/index.html?play=1&seed=7&weather=clear&${q}`);
    await page.waitForFunction(() => window.__ready === true);
    await run(() => { const G = window.__game, g = G.game; G.freeze(); G.advance(800); g.flags.ev_welcome = true; g.flags.rin_arrived = true; g.modals = []; g.hud.aside = null; g.inventory.resize(36); g.villagers.snap(); });
  };
  /** Play the rhythm game on top: every note on its beat, never a rest. */
  const playRhythm = () => run((KEY) => {
    const G = window.__game, r = G.game.modals.at(-1).r;
    while (!r.done) {
      const n = r.notes.find((x) => !x.judge && !x.rest);
      if (!n) { G.advance(100); continue; }
      const wait = (n.t - r.t) * 1000;
      if (wait > 20) { G.advance(wait - 8); continue; }
      G.hold(KEY[n.key]); G.advance(17); G.release(KEY[n.key]); G.advance(17);
    }
    return r.tally;
  }, KEY);

  step('a kodama waits on the shrine stair at dusk; a fern from the forest and it is a friend');
  await boot('time=18:10&day=3');
  const met = await run(() => {
    const G = window.__game, g = G.game;
    g.flags.restored_kodama = true;
    g.enter('shrine', 19, 30, 'down'); G.advance(900); g.modals = []; g.hud.aside = null;
    g.world.spawnSpots();
    const k = g.world.map.objects.find((o) => o.type === 'kodama');
    g.player.x = (k.x - 1) * 16 + 8; g.player.y = k.y * 16 + 12; g.player.dir = 'right';
    g.inventory.slots[10] = { id: 'warabi', n: 2, q: 0 }; g.inventory.select(10);
    G.advance(100);
    G.press('KeyE', 60); G.advance(300);
    return { friends: g.flags.kodama_friends, gone: !g.world.map.objects.some((o) => o.type === 'kodama'), ferns: g.inventory.count('warabi') };
  });
  assert.equal(met.friends, 1);
  assert.ok(met.gone);
  assert.equal(met.ferns, 1);
  await until(null);

  step('a hokora from the Craft tab, set among the beds; overnight its kodama waters them');
  const placed = await run(async () => {
    const G = window.__game, g = G.game;
    const { CraftPage } = await import('./src/ui/cook.js');
    g.inventory.add('wood', 20); g.inventory.add('stone', 20); g.inventory.add('bamboo', 5);
    const page = new CraftPage(g), row = page.rows().find((r) => r.id === 'hokora');
    page.craft(row);
    g.enter('farm', 30, 14, 'down'); G.advance(900); g.modals = []; g.hud.aside = null;
    const m = g.world.map, p = g.player, cx = p.tx, cy = p.ty + 4;
    for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 4; x <= cx + 4; x++) {
      const o = m.objectAt(x, y); if (o) m.removeObject(o);
      const k = m.i(x, y); m.soil[k] = 0; m.crops.delete(k); m.touch(x, y);
    }
    for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 3; x <= cx + 3; x++) {
      if (x === cx && y === cy) continue;
      const k = m.i(x, y); m.soil[k] = 1; m.wet[k] = 0; m.crops.set(k, { id: 'daikon', growth: 1, q: 0 });
    }
    // Stand above the middle, facing down: the hokora goes on the one bare tile.
    p.x = cx * 16 + 8; p.y = (cy - 1) * 16 + 12; p.dir = 'down';
    m.soil[m.i(cx, cy - 1)] = 0; m.crops.delete(m.i(cx, cy - 1));
    g.inventory.select(g.inventory.find('hokora'));
    G.advance(50);
    G.press('KeyJ', 60); G.advance(100);
    return { cx, cy, hokora: m.objects.some((o) => o.type === 'hokora' && o.x === cx && o.y === cy), left: g.inventory.count('hokora') };
  });
  assert.ok(placed.hokora, 'the hokora stands among the beds');
  assert.equal(placed.left, 0);
  const night = await run(async ({ cx, cy }) => {
    const G = window.__game, g = G.game;
    g.hud.aside = null; g.modals = [];
    g.tomorrow = 'clear';
    g.sleep(false);
    for (let i = 0; i < 40 && g.modals.length; i++) { G.advance(300); G.press('Enter', 50); }
    const m = g.worldFor('farm').map;
    let wet = 0, dry = 0;
    for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 3; x <= cx + 3; x++) { const k = m.i(x, y); if (m.crops.has(k)) (m.wet[k] ? wet++ : dry++); }
    return { wet, dry };
  }, placed);
  assert.ok(night.wet >= 30 && night.dry === 0, JSON.stringify(night));

  step('kata with Rin: follow her forms on the beat for a splendid grade; Swordsmanship rises');
  await boot('time=07:00&day=3');
  const xp0 = await run(() => {
    const G = window.__game, g = G.game;
    g.enter('dojo', 3, 5, 'up'); G.advance(900); g.modals = []; g.hud.aside = null;
    return { xp: g.skills.sword.xp, rin: g.villagers.get('rin').map };
  });
  assert.equal(xp0.rin, 'dojo', 'Rin is at the dōjō in the morning');
  await run(() => { window.__game.press('KeyE', 60); window.__game.advance(100); });
  assert.equal(await top(), 'RhythmGame');
  const kata = await playRhythm();
  assert.equal(kata.miss + kata.ouch, 0, JSON.stringify(kata));
  await until(null);
  const kataXp = await run(() => ({ xp: window.__game.game.skills.sword.xp, day: window.__game.game.flags.kata_day }));
  assert.equal(kataXp.xp - xp0.xp, 60, 'a splendid round');
  assert.ok(kataXp.day !== undefined);

  step('kyūdō: four arrows, aimed off for the wind, all in the target');
  await run(() => { const G = window.__game, g = G.game; g.player.x = 12 * 16 + 8; g.player.y = 5 * 16 + 12; g.player.dir = 'up'; G.advance(50); G.press('KeyE', 60); G.advance(100); });
  assert.equal(await top(), 'KyudoGame');
  const kyudo = await run((KEY) => {
    const G = window.__game, k = G.game.modals.at(-1).k;
    const held = new Set();
    const set = (code, on) => { if (on && !held.has(code)) { G.hold(code); held.add(code); } if (!on && held.has(code)) { G.release(code); held.delete(code); } };
    for (let i = 0; i < 60 * 40 && !k.done; i++) {
      const want = { x: -k.wind.x, y: -k.wind.y }, ex = want.x - k.aim.x, ey = want.y - k.aim.y;
      const full = k.phase === 'full', settled = full && Math.hypot(ex, ey) < 0.05;
      set(KEY.right, full && ex > 0.03); set(KEY.left, full && ex < -0.03);
      set(KEY.down, full && ey > 0.03); set(KEY.up, full && ey < -0.03);
      set(KEY.use, (k.phase === 'ready' || k.phase === 'draw' || full) && !settled);
      G.advance(17);
    }
    for (const c of held) G.release(c);
    return { total: k.total, hits: k.hits, done: k.done };
  }, KEY);
  assert.ok(kyudo.done);
  assert.equal(kyudo.hits, 4, JSON.stringify(kyudo));
  assert.ok(kyudo.total >= 28, JSON.stringify(kyudo));
  await run(() => { window.__game.press('Enter', 50); window.__game.advance(200); });
  await until(null);
  const quiver = await run(() => ({ arrows: window.__game.game.inventory.count('arrow'), kaichu: window.__game.game.flags.kaichu }));
  assert.ok(quiver.kaichu && quiver.arrows >= 20, 'kaichū earns a quiver');

  step('the forge: strike with Genzō at the anvil and the Tetsu katana comes out Excellent');
  const forge0 = await run(async () => {
    const G = window.__game, g = G.game;
    const { ForgeMenu } = await import('./src/ui/forge.js');
    g.money = 5000;
    g.inventory.add('katana_rusted', 1); g.inventory.add('iron_bar', 3);
    const m = new ForgeMenu(g);
    m.tab = 1;
    m.sel = m.bladeRows().findIndex((r) => r.label === 'Tetsu Katana');
    g.modals.push(m);
    G.advance(50);
    G.press('Enter', 50); G.advance(200);
    return g.modals.at(-1).constructor.name;
  });
  assert.equal(forge0, 'Dialog', 'Genzō asks: striking, or watching?');
  await run(() => { const G = window.__game; for (let i = 0; i < 20; i++) G.advance(100); G.press('Enter', 50); G.advance(200); });
  assert.equal(await top(), 'RhythmGame');
  const forged = await playRhythm();
  assert.equal(forged.miss + forged.ouch, 0);
  await run(() => { const G = window.__game; for (let i = 0; i < 6; i++) { G.advance(300); G.press('Enter', 50); } });
  const blade = await run(() => { const g = window.__game.game, i = g.inventory.find('katana_tetsu'); return i >= 0 ? g.inventory.slots[i].q : null; });
  assert.equal(blade, 2, 'Excellent steel');

  step('Hanabi: the goldfish tub before the fireworks; a few goldfish come home in a bag');
  await boot('season=summer&day=27&time=19:10');
  await run(() => { const g = window.__game.game; g.enter('village', 40, 36, 'down'); window.__game.advance(100); });
  // Kon's offer is the first choice in the scene: take it.
  assert.equal(await until('KingyoGame'), 'KingyoGame');
  const fish = await run((KEY) => {
    const G = window.__game, k = G.game.modals.at(-1).k;
    const held = new Set();
    const set = (code, on) => { if (on && !held.has(code)) { G.hold(code); held.add(code); } if (!on && held.has(code)) { G.release(code); held.delete(code); } };
    const steer = (x, y) => { const dx = x - k.poi.x, dy = y - k.poi.y; set(KEY.right, dx > 1.5); set(KEY.left, dx < -1.5); set(KEY.down, dy > 1.5); set(KEY.up, dy < -1.5); };
    for (let tries = 0; tries < 12 && !k.done && k.caught.length < 3; tries++) {
      // Pick the nearest fish, come alongside it dry, dip beside it, slide under and lift.
      const f = k.fish.slice().sort((a, b) => Math.hypot(a.x - k.poi.x, a.y - k.poi.y) - Math.hypot(b.x - k.poi.x, b.y - k.poi.y))[0];
      for (let i = 0; i < 120 && Math.hypot(f.x - k.poi.x, f.y - k.poi.y) > 22; i++) { steer(f.x, f.y); G.advance(17); }
      set(KEY.use, true);
      for (let i = 0; i < 90 && !k.done && Math.hypot(f.x - k.poi.x, f.y - k.poi.y) > 3; i++) { steer(f.x, f.y); G.advance(17); }
      set(KEY.use, false); for (const c of [KEY.up, KEY.down, KEY.left, KEY.right]) set(c, false);
      G.advance(34);
    }
    for (const c of held) G.release(c);
    return { caught: k.caught.length, paper: k.paper };
  }, KEY);
  assert.ok(fish.caught >= 1, JSON.stringify(fish));
  await run(() => { const G = window.__game, k = G.game.modals.at(-1).k; k.t = 999; G.advance(100); G.advance(700); G.press('Enter', 50); G.advance(200); });
  await until(null);
  const bag = await run(() => window.__game.game.inventory.count('kingyo'));
  assert.ok(bag >= 1, 'goldfish in a bag');

  assert.deepEqual(errors, [], errors.join('\n'));
  console.log('minigames e2e: ok');
});
