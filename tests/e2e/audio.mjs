// Headless test of M7d (Playwright): with a real AudioContext, the director follows the moment:
// the spring farm theme, the village, the dōjō's hush for a rhythm game, the mine, a boss, and
// silence late at night with only the crickets; notes are scheduled under the voice cap; the
// ambience beds run; the volume sliders reach the buses; footsteps know the ground. Runs in real
// time (not frozen) so the audio clock and the game agree. Fails on any console error.
import assert from 'node:assert/strict';
import { withBrowser } from '../../tools/render-page.mjs';

const step = (name) => console.log(`- ${name}`);

await withBrowser(async (browser, base) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  const run = (fn, arg) => page.evaluate(fn, arg);
  const settle = (ms = 700) => page.waitForTimeout(ms);
  const now = () => run(() => { const d = window.__game.game.director; return { wanted: d.wanted, playing: d.playing, hushed: d.hushed, voices: window.__game.game.audio.mvoices }; });

  step('the title has its own theme before a key is pressed; the first key starts the sound');
  await page.goto(`${base}/index.html?seed=7&weather=clear&time=10:00`);
  await page.waitForFunction(() => window.__ready === true);
  await settle(300);
  assert.equal((await now()).wanted, 'title');
  await page.keyboard.press('ArrowDown');
  await settle();
  const ctx = await run(() => ({ has: !!window.__game.game.audio.ctx, state: window.__game.game.audio.ctx?.state }));
  assert.ok(ctx.has, 'a key press unlocked the audio');
  assert.equal((await now()).playing, 'title');

  step('a spring morning on the farm: its theme, notes scheduled ahead, the beds running');
  await run(() => { const g = window.__game.game; g.startNew(1); g.flags.ev_welcome = true; g.modals = []; });
  await settle(1200);
  const farm = await now();
  assert.equal(farm.playing, 'farm_spring');
  assert.ok(farm.voices > 0, 'notes are sounding');
  assert.ok(farm.voices <= 20, 'under the cap');
  assert.ok(await run(() => !!window.__game.game.director.ambience.beds), 'ambience beds');

  step('into the village: the theme changes with the place');
  await run(() => { const g = window.__game.game; g.enter('village', 40, 30, 'down'); g.modals = []; });
  await settle();
  assert.equal((await now()).playing, 'village');

  step('a rhythm game hushes the music; it comes back after');
  await run(async () => {
    const g = window.__game.game, { RhythmGame } = await import('./src/ui/rhythm.js');
    g.modals.push(new RhythmGame(g, { kind: 'kata', partner: 'rin', onEnd: () => {} }));
  });
  await settle(400);
  assert.equal((await now()).hushed, true);
  await run(() => { window.__game.game.modals = []; });
  await settle(400);
  assert.equal((await now()).hushed, false);

  step('the old mine, then Jūbei\'s hall: the cave theme, then the boss');
  await run(async () => { const g = window.__game.game, { enterFloor } = await import('./src/caves.js'); g.modals = []; enterFloor(g, 3); });
  await settle(1500);
  assert.equal((await now()).playing, 'cave_1');
  await run(async () => { const g = window.__game.game, { enterFloor } = await import('./src/caves.js'); g.modals = []; enterFloor(g, 20); });
  await settle(1500);
  assert.equal((await now()).playing, 'boss');

  step('late at night on the farm: no music, only the valley');
  await run(() => { const g = window.__game.game; g.modals = []; g.cal.season = 1; g.cal.minutes = 23 * 60; g.enter('farm', 30, 14, 'down'); g.modals = []; });
  await settle();
  assert.equal((await now()).playing, null);

  step('a night of frogs and crickets: no calls queue while the browser holds the sound, and never a pile of them after');
  const calls = await run(async () => {
    const G = window.__game, g = G.game, ctx = g.audio.ctx, { CALLS } = await import('./src/core/ambience.js');
    g.cal.season = 0; g.cal.minutes = 21 * 60; g.modals = [];
    const count = { n: 0 }, orig = { ...CALLS };
    for (const k of Object.keys(CALLS)) CALLS[k] = (...a) => { count.n++; return orig[k](...a); };
    await ctx.suspend();
    G.advance(20000);                 // twenty seconds of game with the sound held
    const held = count.n;
    await ctx.resume();
    count.n = 0;
    for (let i = 0; i < 20; i++) G.advance(17);    // the first frames after it comes back
    const burst = count.n;
    Object.assign(CALLS, orig);
    return { held, burst };
  });
  assert.equal(calls.held, 0, 'nothing queued against a frozen clock');
  assert.ok(calls.burst <= 4, `at most four calls at once, not ${calls.burst}`);

  step('the sliders reach the buses; footsteps know the ground');
  const vol = await run(() => {
    const g = window.__game.game, a = g.audio;
    g.setSetting('music', 0); g.setSetting('ambience', 0.5);
    return { music: a.musicBus.gain.value, amb: a.ambBus.gain.value, saved: JSON.parse(localStorage.getItem('ronin.settings')).music };
  });
  assert.equal(vol.music, 0);
  assert.equal(vol.amb, 0.5);
  assert.equal(vol.saved, 0);
  const steps = await run(() => {
    const g = window.__game.game, played = [], orig = g.audio.play.bind(g.audio);
    g.audio.play = (n) => { if (n.startsWith('step')) played.push(n); orig(n); };
    g.cal.minutes = 10 * 60;
    g.enter('shrine', 19, 40, 'up');
    g.modals = [];
    return new Promise((res) => {
      window.__game.hold('ArrowUp');
      setTimeout(() => { window.__game.release('ArrowUp'); g.audio.play = orig; res(played); }, 1200);
    });
  });
  assert.ok(steps.includes('step_stone'), steps.join());

  assert.deepEqual(errors, [], errors.join('\n'));
  console.log(`audio e2e: ok (context ${ctx.state})`);
});
