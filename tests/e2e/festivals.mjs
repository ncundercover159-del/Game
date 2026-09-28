// Headless test of M6 festivals (Playwright): the village dressed for Ōmisoka and the cast on their
// spots, mochi pounding played on the beat through the real key, a haiku composed tile by tile at
// Hanami, the crop judging at Niiname-sai, and the festival reminder on the end-of-day screen.
// Fails on any console error or page exception.
import assert from 'node:assert/strict';
import { withBrowser } from '../../tools/render-page.mjs';

const step = (name) => console.log(`- ${name}`);

await withBrowser(async (browser, base) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  const run = (fn, arg) => page.evaluate(fn, arg);
  const top = () => run(() => window.__game.game.modals.at(-1)?.constructor.name || null);
  /** Confirm through dialogue until `name` is on top (or nothing is open). */
  const until = async (name) => {
    for (let i = 0; i < 60; i++) {
      const t = await top();
      if (t === name || (!t && !(await run(() => window.__game.game.pendingScene)))) return t;
      await run(() => { window.__game.press('Enter', 50); window.__game.advance(250); });
    }
    throw new Error(`never reached ${name}`);
  };
  const boot = async (q) => {
    await page.goto(`${base}/index.html?play=1&seed=7&weather=clear&${q}`);
    await page.waitForFunction(() => window.__ready === true);
    await run(() => { const G = window.__game, g = G.game; G.freeze(); G.advance(800); g.flags.ev_welcome = true; g.modals = []; g.hud.aside = null; g.inventory.resize(36); g.villagers.snap(); });
  };

  step('Ōmisoka: the square is dressed and the village gathers on the spots');
  await boot('season=winter&day=28&time=20:30');
  await run(() => { const g = window.__game.game; g.enter('village', 55, 20, 'right'); window.__game.advance(100); });
  const dressed = await run(() => {
    const g = window.__game.game, m = g.world.map;
    return { decor: m.objects.filter((o) => o.festival).map((o) => o.kind), usuSolid: m.solid(56, 20), okiku: [g.villagers.get('okiku').map] };
  });
  assert.ok(dressed.decor.includes('usu') && dressed.decor.includes('lanterns'), dressed.decor.join());
  assert.equal(dressed.usuSolid, true);
  assert.equal(dressed.okiku[0], 'village');

  step('mochi pounding: strike on every beat, never on the hand, for a splendid grade');
  assert.equal(await until('RhythmGame'), 'RhythmGame');
  const mochi0 = await run(() => window.__game.game.inventory.count('mochi'));
  const tally = await run(() => {
    const G = window.__game, g = G.game, game = g.modals.at(-1), r = game.r;
    while (!r.done) {
      const n = r.notes.find((x) => !x.judge && !x.rest);
      if (!n) { G.advance(100); continue; }
      const wait = (n.t - r.t) * 1000;
      if (wait > 20) { G.advance(wait - 8); continue; }
      G.hold('KeyJ'); G.advance(17); G.release('KeyJ'); G.advance(17);
    }
    return r.tally;
  });
  assert.equal(tally.ouch, 0);
  assert.equal(tally.miss, 0);
  assert.ok(tally.perfect > tally.good, JSON.stringify(tally));
  await until(null);
  assert.ok((await run(() => window.__game.game.inventory.count('mochi'))) >= mochi0 + 8, 'a stack of mochi for splendid pounding');
  assert.ok(await run(() => window.__game.game.flags.fest_omisoka_1));

  step('Hanami: compose a 5-7-5 verse from the tray with arrows and confirm, and recite it');
  await boot('season=spring&day=14&time=11:00');
  await run(() => { window.__game.game.enter('village', 56, 20, 'up'); window.__game.advance(100); });
  await until('Dialog');
  // Past the lines to the choice, then take "Compose a verse".
  assert.equal(await until('HaikuComposer'), 'HaikuComposer');
  const verse = await run(() => {
    const G = window.__game, g = G.game, h = g.modals.at(-1), tray = h.tray, used = new Set();
    // One subset of unused tiles summing to n, preferring this season's words.
    const solve = (n) => {
      const order = tray.map((x, i) => i).filter((i) => !used.has(i) && tray[i].kigo !== 'wrong')
        .sort((a, b) => (tray[b].kigo === h.season) - (tray[a].kigo === h.season) || tray[b].img - tray[a].img);
      const go = (k, left, pick) => {
        if (left === 0) return pick;
        for (let j = k; j < order.length; j++) {
          const i = order[j];
          if (tray[i].s <= left) { const r = go(j + 1, left - tray[i].s, [...pick, i]); if (r) return r; }
        }
        return null;
      };
      return go(0, n, []);
    };
    const move = (to) => {
      while (h.sel !== to) {
        const row = Math.floor(h.sel / 4), want = Math.floor(to / 4);
        G.press(want > row ? 'ArrowDown' : want < row ? 'ArrowUp' : h.sel < to ? 'ArrowRight' : 'ArrowLeft', 20);
      }
    };
    for (const n of [5, 7, 5]) for (const i of solve(n)) { used.add(i); move(i); G.press('Enter', 20); }
    const ready = h.ready;
    move(tray.length);
    G.press('Enter', 20);
    return { ready, result: h.result };
  });
  assert.ok(verse.ready, 'three full lines');
  assert.equal(verse.result.kigo, true, 'with a season word of spring');
  assert.ok(verse.result.grade <= 1, `a prize (score ${verse.result.score}: ${verse.result.text})`);
  await run(() => { window.__game.advance(600); window.__game.press('Enter', 50); });
  await until(null);

  step('Niiname-sai: a fine kabocha takes first prize at the crop judging');
  await boot('season=autumn&day=24&time=10:00');
  const money0 = await run(() => { const g = window.__game.game; g.inventory.add('kabocha', 1, 2); return g.money; });
  await run(() => { window.__game.game.enter('village', 56, 20, 'up'); window.__game.advance(100); });
  await until(null);
  assert.equal(await run(() => window.__game.game.money), money0 + 1500);

  step('the night before a festival the end-of-day screen says so');
  await boot('season=summer&day=19&time=21:00');
  const notes = await run(async () => {
    const { summaryLines } = await import('./src/ui/summary.js');
    const g = window.__game.game;
    g.cal.day = 20;
    return summaryLines({ prev: { season: 1, day: 19, year: 1 }, ship: { lines: [], total: 0 } }, g).notes;
  });
  assert.ok(notes.some((n) => n.startsWith('Festival: Obon')), notes.join(' | '));

  assert.deepEqual(errors, [], errors.join('\n'));
  console.log('festivals e2e: ok');
});
