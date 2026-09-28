// Headless test of M7e (Playwright): the parallax title, its Settings (text size re-fits the
// screen) and Credits; a new farm typed and chosen step by step (name, farm, look, difficulty,
// Riverside) that survives a save and a reload; rebinding Use to F (and it persists); the run key;
// instant text; colour-blind signals; and the touch controls: the stick walks, Use swings, a tap
// on the menu button opens it, a tap closes a dialogue. Fails on any console error.
import assert from 'node:assert/strict';
import { withBrowser } from '../../tools/render-page.mjs';

const step = (name) => console.log(`- ${name}`);

await withBrowser(async (browser, base) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  const run = (fn, arg) => page.evaluate(fn, arg);
  const press = (code, after = 60) => run(([c, a]) => { window.__game.press(c); window.__game.advance(a); }, [code, after]);
  const boot = async () => {
    await page.goto(`${base}/index.html?seed=7`);
    await page.waitForFunction(() => window.__ready === true);
    await run(() => { window.__game.freeze(); window.__game.advance(300); });
  };
  const title = () => run(() => ({ scene: window.__game.game.scene, mode: window.__game.game.title?.mode, step: window.__game.game.title?.newfarm?.kind }));

  step('the title: Settings (a larger text size means bigger pixels) and the Credits');
  await boot();
  assert.equal((await title()).scene, 'title');
  const h0 = await run(() => window.__game.game.screen.h);
  await press('ArrowDown');                                        // New Farm -> (Load is disabled) -> Settings
  await press('Enter');
  assert.equal((await title()).mode, 'settings');
  for (let i = 0; i < 3; i++) await press('ArrowDown');            // Text size
  await press('ArrowRight'); await press('ArrowRight');             // Larger
  const h1 = await run(() => ({ h: window.__game.game.screen.h, s: window.__game.game.settings.textSize }));
  assert.equal(h1.s, 'larger');
  assert.ok(h1.h < h0, `${h1.h} < ${h0}`);
  await press('ArrowLeft'); await press('ArrowLeft');
  assert.equal(await run(() => window.__game.game.screen.h), h0);
  await press('Escape');
  await press('ArrowDown');                                        // Credits
  await press('Enter', 2000);
  assert.equal((await title()).mode, 'credits');
  await press('Escape');
  assert.equal((await title()).mode, 'main');

  step('a new farm, typed and chosen: Mitsuki of Kiri Farm, cropped grey hair, Warrior, Riverside');
  for (let i = 0; i < 4; i++) await press('ArrowUp');              // back to New Farm
  await run(() => { const t = window.__game.game.title; t.main.sel = 1; });
  await press('Enter'); await press('Enter');                      // New Farm, first slot
  assert.equal((await title()).step, 'name');
  await run(() => window.__game.type('\b\b\b\b\b\bMitsuki'));
  await press('Enter');
  assert.equal((await title()).step, 'farm');
  await run(() => window.__game.type('\b\b\b\b\b\bKiri'));
  await press('Enter');
  assert.equal((await title()).step, 'look');
  await press('ArrowRight');                                       // Hair: Cropped
  await press('ArrowDown'); await press('ArrowLeft');              // Hair colour: Grey (wraps back)
  await press('ArrowDown'); await press('ArrowDown'); await press('ArrowRight'); // Kosode: Madder
  await press('ArrowDown'); await press('ArrowDown'); await press('Enter');      // Next
  assert.equal((await title()).step, 'difficulty');
  await press('ArrowDown'); await press('Enter');                  // Warrior
  await press('ArrowDown'); await press('ArrowDown'); await press('Enter');      // Riverside
  assert.equal((await title()).step, 'confirm');
  await press('Enter', 1200);
  const farm = await run(() => { const g = window.__game.game; return { scene: g.scene, name: g.state.name, farm: g.state.farm, look: g.state.look, layout: g.state.layout, diff: g.difficulty, traps: g.inventory.count('uke'), worn: g.lookWorn }; });
  assert.equal(farm.scene, 'play');
  assert.equal(farm.name, 'Mitsuki');
  assert.equal(farm.farm, 'Kiri');
  assert.deepEqual(farm.look, { style: 1, hair: 3, skin: 0, kosode: 1, hakama: 0 });
  assert.equal(farm.diff, 'warrior');
  assert.equal(farm.layout, 'kawabe');
  assert.equal(farm.traps, 2, 'Riverside starts with two fish traps');
  assert.equal(farm.worn, JSON.stringify(farm.look));

  step('saved, reloaded, continued: the same farmer on the same farm');
  await run(() => { const g = window.__game.game; g.modals = []; g.saveNow(true); });
  await boot();
  await press('Enter', 800);                                       // Continue
  const back = await run(() => { const g = window.__game.game; return { name: g.state.name, look: g.state.look, layout: g.state.layout, worn: g.lookWorn }; });
  assert.equal(back.name, 'Mitsuki');
  assert.deepEqual(back.look, farm.look);
  assert.equal(back.layout, 'kawabe');
  assert.equal(back.worn, JSON.stringify(farm.look), 'the look is painted on again');

  step('rebinding: Use to F from the Options tab, and it survives a reload');
  await run(() => { const g = window.__game.game; g.modals = []; g.hud.aside = null; });
  await press('Escape');
  await run(() => { const m = window.__game.game.modals[0]; m.tab = 4; });
  const rows = await run(() => window.__game.game.modals[0].settings.rows().map((r) => r.label));
  const ctl = rows.indexOf('Controls');
  for (let i = 0; i < ctl; i++) await press('ArrowDown');
  await press('Enter');                                            // Controls
  for (let i = 0; i < 4; i++) await press('ArrowDown');            // Use tool
  await press('Enter');
  await press('KeyF');
  const bound = await run(() => ({ use: window.__game.game.input.bindings.use[0], saved: JSON.parse(localStorage.getItem('ronin.settings')).keys }));
  assert.equal(bound.use, 'KeyF');
  assert.deepEqual(bound.saved, { use: 'KeyF' });
  await press('Escape'); await press('Escape');
  assert.equal(await run(() => window.__game.game.modals.length), 0);
  await run(() => { const g = window.__game.game; g.inventory.select(0); });
  await press('KeyF', 30);
  assert.ok(await run(() => !!window.__game.game.player.swing || window.__game.game.player.charge), 'F swings the hoe');
  await boot();
  assert.equal(await run(() => window.__game.game.input.bindings.use[0]), 'KeyF', 'kept across a reload');
  await run(() => { const g = window.__game.game; g.input.resetKeys(); g.setSetting('keys', {}); });

  step('the run key, instant text, colour-blind signals');
  await press('Enter', 800);
  const walk = (shift) => run((shift) => {
    const G = window.__game, g = G.game, p = g.player;
    g.modals = []; g.hud.aside = null;
    // A clear strip of ground to walk down.
    const m = g.world.map;
    for (let y = 20; y < 26; y++) { const o = m.objectAt(30, y); if (o) m.removeObject(o); }
    p.x = 30 * 16 + 8; p.y = 20 * 16 + 12;
    if (shift) G.hold('ShiftLeft');
    G.hold('KeyS'); G.advance(400); G.release('KeyS');
    if (shift) G.release('ShiftLeft');
    G.advance(50);
    return p.y - (20 * 16 + 12);
  }, shift);
  const plain = await walk(false), ran = await walk(true);
  assert.ok(ran > plain * 1.2, `${ran} > ${plain}`);
  const text = await run(async () => {
    const G = window.__game, g = G.game, { Dialog } = await import('./src/ui/dialog.js'), { signal } = await import('./src/ui/widgets.js');
    g.setSetting('textSpeed', 'instant');
    const d = new Dialog(g, { text: 'A long line of text that would normally take a moment to appear.' });
    g.modals.push(d);
    G.advance(34);
    const shown = d.finished;
    g.modals = [];
    g.setSetting('textSpeed', 'normal');
    g.setSetting('colourblind', true);
    const cb = signal(g, 'good');
    g.setSetting('colourblind', false);
    return { shown, cb, normal: signal(g, 'good') };
  });
  assert.ok(text.shown, 'instant text is all there at once');
  assert.equal(text.cb, 'water4');
  assert.equal(text.normal, 'grass5');

  step('touch: the stick walks, Use swings, the menu button opens the menu, a tap closes a dialogue');
  const touch = (type, id, lx, ly) => run(([type, id, lx, ly]) => {
    const s = window.__game.game.screen, c = document.getElementById('screen'), r = c.getBoundingClientRect();
    const clientX = r.left + (lx * s.scale) / s.dpr + 1, clientY = r.top + (ly * s.scale) / s.dpr + 1;
    (type === 'pointerdown' || type === 'pointermove' ? c : window).dispatchEvent(new PointerEvent(type, { pointerType: 'touch', pointerId: id, clientX, clientY, bubbles: true }));
  }, [type, id, lx, ly]);
  const dims = await run(() => {
    const g = window.__game.game, m = g.world.map;
    g.modals = []; g.hud.aside = null;
    for (let x = 30; x < 36; x++) { const o = m.objectAt(x, 20); if (o) m.removeObject(o); }
    g.player.x = 30 * 16 + 8; g.player.y = 20 * 16 + 12;
    return { w: g.screen.w, h: g.screen.h };
  });
  const x0 = await run(() => window.__game.game.player.x);
  await touch('pointerdown', 7, 40, dims.h - 50);
  await touch('pointermove', 7, 70, dims.h - 50);
  await run(() => window.__game.advance(400));
  await touch('pointerup', 7, 70, dims.h - 50);
  await run(() => window.__game.advance(50));
  const x1 = await run(() => ({ x: window.__game.game.player.x, shown: window.__game.game.touch.shown }));
  assert.ok(x1.shown, 'the controls show after a touch');
  assert.ok(x1.x > x0 + 20, `walked right: ${x0} -> ${x1.x}`);
  await run(() => window.__game.game.inventory.select(0));
  await touch('pointerdown', 8, dims.w - 26, dims.h - 108);
  await run(() => window.__game.advance(30));
  const swung = await run(() => !!window.__game.game.player.swing || !!window.__game.game.player.charge);
  await touch('pointerup', 8, dims.w - 26, dims.h - 108);
  await run(() => window.__game.advance(400));
  assert.ok(swung, 'Use swings');
  await touch('pointerdown', 9, 14, dims.h - 14);
  await run(() => window.__game.advance(30));
  await touch('pointerup', 9, 14, dims.h - 14);
  await run(() => window.__game.advance(30));
  assert.equal(await run(() => window.__game.game.modals[0]?.constructor.name), 'Menu');
  await run(async () => { const g = window.__game.game, { Dialog } = await import('./src/ui/dialog.js'); g.modals = [new Dialog(g, { text: 'Tap me.' })]; window.__game.advance(500); });
  await touch('pointerdown', 10, dims.w / 2, dims.h / 2);
  await run(() => window.__game.advance(30));
  await touch('pointerup', 10, dims.w / 2, dims.h / 2);
  await run(() => window.__game.advance(30));
  assert.equal(await run(() => window.__game.game.modals.length), 0, 'the tap closed it');

  assert.deepEqual(errors, [], errors.join('\n'));
  console.log('newgame e2e: ok');
});
