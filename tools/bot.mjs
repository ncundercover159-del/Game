// The two-year bot run: a new farm made through the title's steps, then tools/bot/driver.js plays
// it a day at a time for two in-game years (224 days). It saves every week and reloads the page
// (Continue from the title) every season of the first year; the second year is one long sitting
// (a session's caches must hold up, not only the save), reloaded once at the end. After each day it checks the game still holds together:
// the calendar moved on by exactly one day, numbers are numbers, the pack holds real items, every
// villager is somewhere real, the player stands on the map; any console error, broken invariant,
// or anything that will not close (a softlock) fails the run. Prints what it saw.
// Usage: node tools/bot.mjs [days=224] [seed=11]
import { withBrowser } from './render-page.mjs';

const DAYS = Number(process.argv[2]) || 224;
const SEED = Number(process.argv[3]) || 11;
const t0 = Date.now();

await withBrowser(async (browser, base) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  const run = (fn, arg) => page.evaluate(fn, arg);
  const press = (code, after = 60) => run(([c, a]) => { window.__game.press(c); window.__game.advance(a); }, [code, after]);

  /** Load the page and the bot (its log kept across reloads in localStorage). */
  const boot = async () => {
    await page.goto(`${base}/index.html?seed=${SEED}`);
    await page.waitForFunction(() => window.__ready === true);
    await run(async (seed) => {
      window.__game.freeze();
      const { Bot } = await import('/tools/bot/driver.js');
      window.__bot = new Bot(seed);
      try { Object.assign(window.__bot.log, JSON.parse(localStorage.getItem('bot.log') || '{}')); } catch { /* fresh */ }
      window.__game.advance(300);
    }, SEED);
  };

  await boot();
  await run(() => { localStorage.removeItem('bot.log'); for (let n = 1; n <= 3; n++) localStorage.removeItem(`ronin.slot${n}`); });
  await boot();
  // New Farm, the first slot, then the steps as offered (up to Next on the look), Begin.
  await press('Enter'); await press('Enter');
  await press('Enter'); await press('Enter'); await press('ArrowUp');
  for (let i = 0; i < 4; i++) await press('Enter', i === 3 ? 1200 : 60);
  const started = await run(() => window.__game.game.scene);
  if (started !== 'play') throw new Error('the new farm did not start');

  const failures = [];
  let last = await run(() => window.__game.game.dayIndex);
  for (let d = 1; d <= DAYS; d++) {
    const r = await run(() => {
      const bot = window.__bot;
      try {
        const notes = bot.day();
        localStorage.setItem('bot.log', JSON.stringify(bot.log));
        return { ok: true, notes };
      } catch (e) { return { ok: false, error: String(e.stack || e) }; }
    });
    if (!r.ok) { failures.push(`day ${d}: ${r.error}`); break; }
    const inv = await run(async () => {
      const { ITEMS } = await import('/src/data/items.js');
      const { MAPS } = await import('/src/maps/index.js');
      const g = window.__game.game, bad = [], num = (v) => Number.isFinite(v);
      if (!num(g.money) || g.money < 0) bad.push(`money ${g.money}`);
      if (!num(g.hp) || !num(g.genki) || g.hp <= 0) bad.push(`hp ${g.hp} genki ${g.genki}`);
      for (const s of g.inventory.slots) if (s && (!ITEMS[s.id] || !(s.n > 0))) bad.push(`slot ${JSON.stringify(s)}`);
      for (const n of g.villagers.list) if ((!MAPS[n.map] && n.map !== 'away') || !num(n.x) || !num(n.y)) bad.push(`villager ${n.id} at ${n.map} ${n.x},${n.y}`);
      const p = g.player, m = g.world.map;
      if (!m.inside(p.tx, p.ty)) bad.push(`player outside ${m.id} at ${p.tx},${p.ty}`);
      if (g.modals.length || g.pendingScene) bad.push(`still open: ${g.modals.map((x) => x.constructor.name)}`);
      return { bad, day: g.dayIndex, date: `Y${g.cal.year} ${g.seasonId} ${g.cal.day}`, money: g.money, map: m.id };
    });
    if (inv.day !== last + 1) inv.bad.push(`the calendar went from ${last} to ${inv.day}`);
    last = inv.day;
    if (inv.bad.length) { failures.push(`day ${d} (${inv.date}): ${inv.bad.join('; ')}`); break; }
    if (errors.length) { failures.push(`day ${d} (${inv.date}): console: ${errors.join(' | ')}`); break; }
    if (r.notes.length) console.log(`${inv.date.padEnd(16)} ${String(inv.money).padStart(7)} 文  ${r.notes.join(', ')}`);
    if (d % 7 === 0 || d === DAYS) {
      const ok = await run(() => window.__game.game.saveNow(true));
      if (!ok) { failures.push(`day ${d}: the save failed`); break; }
    }
    if ((d % 28 === 0 && d <= DAYS / 2) || d === DAYS) {
      await boot();
      await press('Enter', 1200);                                   // Continue
      const back = await run(() => ({ scene: window.__game.game.scene, day: window.__game.game.dayIndex }));
      if (back.scene !== 'play' || back.day !== last) { failures.push(`day ${d}: reload came back to ${JSON.stringify(back)}`); break; }
      console.log(`--- saved and reloaded at ${inv.date} ---`);
    }
  }

  const summary = await run(() => {
    const g = window.__game.game, f = g.flags, bot = window.__bot;
    const story = ['tolls', 'rin_arrived', 'kuroda_signed', 'kuroda_refused', 'petition_sent', 'petition_won', 'seal_split', 'aizawa_named', 'act3', 'sword_rest', 'sword_carry', 'act3_done'].filter((k) => f[k] !== undefined && f[k] !== false);
    return {
      date: `Year ${g.cal.year}, ${g.seasonId} ${g.cal.day}`, money: g.money, shipped: g.stats.shippedValue,
      bosses: ['jubei', 'kappa_elder', 'kyubi', 'kurenai', 'aizawa'].filter((b) => f[`boss_${b}`]),
      deepest: g.caves.deepest, spouse: g.romance.spouse, kodama: f.kodama_friends || 0,
      archive: g.archive.donated.length, restored: Object.keys(f).filter((k) => k.startsWith('restored_')).length,
      heartEvents: Object.keys(f).filter((k) => k.startsWith('heart_')).length, festivals: Object.keys(f).filter((k) => k.startsWith('fest_')).length,
      story, log: bot.log,
    };
  });
  console.log('\n=== two-year run ===');
  console.log(JSON.stringify(summary, null, 1));
  console.log(`${Math.round((Date.now() - t0) / 1000)} s`);
  if (failures.length) { console.log(`\nFAILED\n${failures.join('\n')}`); process.exitCode = 1; } else console.log('\nno crashes, no softlocks, no broken invariants');
}, { port: 8141 });
