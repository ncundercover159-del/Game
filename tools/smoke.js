/* Headless smoke test: boots the game in a mobile Chromium viewport, plays
 * several levels automatically and asserts the board never breaks.
 *
 *   npm run test
 */
const path = require('path');
const { chromium } = require('playwright');

const INDEX = 'file://' + path.join(__dirname, '..', 'index.html');
const LEVELS_TO_PLAY = Number(process.env.SMOKE_LEVELS || 3);

/* Use a preinstalled Chromium when one is available (CI images often pin a
 * build that does not match this Playwright release). */
function launchOptions() {
  const fs = require('fs');
  const candidates = [
    process.env.CHROMIUM_PATH,
    '/opt/pw-browsers/chromium',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
  ].filter(Boolean);
  for (const exe of candidates) {
    try { if (fs.existsSync(exe)) return { executablePath: exe }; } catch (e) { /* ignore */ }
  }
  return {};
}

async function main() {
  const problems = [];
  const browser = await chromium.launch(launchOptions());
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  page.on('console', (m) => {
    if (m.type() === 'error') problems.push('console error: ' + m.text());
    if (m.type() === 'warning' && m.text().includes('[Levels]')) problems.push('level warning: ' + m.text());
  });
  page.on('pageerror', (e) => problems.push('page error: ' + (e.stack || e.message)));

  await page.goto(INDEX);
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.game, null, { timeout: 10000 });
  // Run animations fast so a whole level takes seconds, not minutes.
  await page.evaluate((s) => { UI.game.speed = s; }, Number(process.env.SMOKE_SPEED || 8));

  // --- start level 1 through the real UI --------------------------------
  await page.click('#btn-play');
  await page.waitForSelector('#overlay:not(.hidden)');
  await page.click('#dialog .btn-green');
  await page.waitForFunction(() => UI.game.state === 'playing', null, { timeout: 10000 });
  console.log('level 1 started');

  // --- one swap driven by real touch input ------------------------------
  const swiped = await page.evaluate(async () => {
    const g = UI.game;
    const moves = g.board.findAllMoves().filter(m => m.b);
    if (!moves.length) return null;
    const m = moves[0];
    const rect = g.canvas.getBoundingClientRect();
    const from = g.cellToPx(m.a.c, m.a.r);
    const to = g.cellToPx(m.b.c, m.b.r);
    return {
      x0: rect.left + from.x, y0: rect.top + from.y,
      x1: rect.left + to.x, y1: rect.top + to.y,
      before: g.movesLeft,
    };
  });
  if (!swiped) problems.push('no legal opening move on level 1');
  else {
    await page.mouse.move(swiped.x0, swiped.y0);
    await page.mouse.down();
    await page.mouse.move(swiped.x1, swiped.y1, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(() => !UI.game.busy, null, { timeout: 15000 });
    const after = await page.evaluate(() => UI.game.movesLeft);
    if (after !== swiped.before - 1) problems.push(`touch swipe did not consume a move (${swiped.before} -> ${after})`);
    else console.log('touch swipe consumed a move');
  }

  // --- autoplay a run of levels -----------------------------------------
  for (let i = 0; i < LEVELS_TO_PLAY; i++) {
    const report = await page.evaluate(async () => {
      const g = UI.game;
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      // The win/lose sequences deliberately keep `busy` set once the level
      // is finished, so leaving 'playing' also counts as settled.
      const waitIdle = async () => {
        let n = 0;
        while (g.busy && g.state === 'playing' && n++ < 900) await sleep(20);
        return n < 900;
      };

      const issues = [];
      let turns = 0;

      const checkInvariants = (tag) => {
        // Render positions must agree with the grid once everything is idle.
        for (let r = 0; r < g.board.rows; r++) {
          for (let c = 0; c < g.board.cols; c++) {
            const gem = g.board.cells[r][c].gem;
            if (!gem) continue;
            if (Math.abs(gem.x - c) > 0.01 || Math.abs(gem.y - r) > 0.01) {
              issues.push(`${tag}: gem at ${r},${c} rendered at ${gem.x.toFixed(2)},${gem.y.toFixed(2)}`);
              return;
            }
          }
        }
        // Gravity must be at a fixed point: another pass may not move
        // anything. (Cells trapped under crates are legitimately empty, so
        // "no empty cell" would be too strict.)
        const moved = g.board.settleStep();
        const spawned = g.board.refillStep();
        if (moved.length || spawned.length) {
          issues.push(`${tag}: board was not settled — ${moved.length} gems could still fall, ${spawned.length} could spawn`);
          return;
        }
        if (g.board.findMatches().length) issues.push(`${tag}: unresolved match left on the board`);
      };

      if (!(await waitIdle())) issues.push('board never became idle at level start');
      checkInvariants('start');

      while (g.state === 'playing' && turns < 120) {
        const moves = g.board.findAllMoves();
        if (!moves.length) { issues.push('no moves available and no shuffle happened'); break; }
        const m = moves[Math.floor(Math.random() * moves.length)];
        if (m.tap) {
          await g.tapPower(m.a, g.board.gemAt(m.a.r, m.a.c));
        } else {
          await g.attemptSwap(m.a, m.b);
        }
        turns++;
        if (!(await waitIdle())) { issues.push('board stuck busy after turn ' + turns); break; }
        if (g.state === 'playing') checkInvariants('turn ' + turns);
      }

      return {
        level: g.level.id,
        turns,
        state: g.state,
        score: g.score,
        movesLeft: g.movesLeft,
        goals: g.goals.map(x => `${x.type}${x.type === 'color' ? x.color : ''} ${x.done}/${x.count}`),
        issues,
      };
    });

    console.log(
      `level ${report.level}: ${report.state} after ${report.turns} turns — ` +
      `score ${report.score}, goals [${report.goals.join(', ')}]`
    );
    report.issues.forEach(p => problems.push(`level ${report.level}: ${p}`));

    // Every finished level must present a win or lose dialog.
    await page.waitForSelector('#overlay:not(.hidden)', { timeout: 20000 }).catch(() => {
      problems.push(`level ${report.level}: no result dialog appeared`);
    });

    const advanced = await page.evaluate(async (idx) => {
      // Skip past whatever result dialog is showing and open the next level.
      UI.closeDialog();
      UI.game.stop();
      const next = Math.min(idx + 2, UI.MAX_LEVEL);
      Store.data.level = Math.max(Store.data.level, next);
      Store.addLives(5);
      UI.startLevel(next);
      await new Promise(r => setTimeout(r, 400));
      return UI.game.level.id;
    }, i);
    await page.waitForFunction(() => UI.game.state === 'playing', null, { timeout: 15000 })
      .catch(() => problems.push('level ' + advanced + ' did not start'));
  }

  // --- power-up sanity: build each combo and make sure it resolves -------
  const comboReport = await page.evaluate(async () => {
    const g = UI.game;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const waitIdle = async () => { let n = 0; while (g.busy && g.state === 'playing' && n++ < 900) await sleep(20); };
    const issues = [];

    const combos = [
      [POWER.ROCKET_H, POWER.ROCKET_V],
      [POWER.ROCKET_H, POWER.TNT],
      [POWER.TNT, POWER.TNT],
      [POWER.LIGHT, POWER.ROCKET_V],
      [POWER.LIGHT, POWER.TNT],
      [POWER.LIGHT, POWER.LIGHT],
      [POWER.LIGHT, null],
    ];

    for (const [pa, pb] of combos) {
      await waitIdle();
      // find two adjacent free cells in the middle of the board
      let a = null, b = null;
      for (let r = 2; r < g.board.rows - 2 && !a; r++) {
        for (let c = 2; c < g.board.cols - 3; c++) {
          if (g.board.isPlayable(r, c) && g.board.isPlayable(r, c + 1)
              && g.board.gemAt(r, c) && g.board.gemAt(r, c + 1)) {
            a = { r, c }; b = { r, c: c + 1 }; break;
          }
        }
      }
      if (!a) { issues.push('no space to test combo'); break; }

      const ga = g.board.gemAt(a.r, a.c), gb = g.board.gemAt(b.r, b.c);
      ga.ice = ga.chain = gb.ice = gb.chain = 0;
      ga.power = pa; if (pa === POWER.LIGHT) ga.color = -1;
      gb.power = pb; if (pb === POWER.LIGHT) gb.color = -1;
      g.state = 'playing';
      g.busy = false;
      g.movesLeft = Math.max(g.movesLeft, 5);

      const label = `${pa}+${pb}`;
      try {
        await g.attemptSwap(a, b);
        await waitIdle();
      } catch (e) {
        issues.push(`${label} threw: ${e.message}`);
      }
      if (!g.board.isSettled()) issues.push(`${label} left holes in the board`);
      if (g.board.findMatches().length) issues.push(`${label} left an unresolved match`);
    }
    return issues;
  });
  comboReport.forEach(p => problems.push('combo: ' + p));
  console.log(`combo checks done (${comboReport.length} issues)`);

  await page.screenshot({ path: path.join(__dirname, 'screenshot-board.png') });

  await browser.close();

  if (problems.length) {
    console.error('\nFAILED:');
    problems.forEach(p => console.error('  - ' + p));
    process.exit(1);
  }
  console.log('\nAll smoke checks passed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
