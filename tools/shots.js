/* Captures screenshots of each screen at phone size, for eyeballing the UI.
 *   node tools/shots.js
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const INDEX = 'file://' + path.join(__dirname, '..', 'index.html');
const OUT = path.join(__dirname, 'shots');

function launchOptions() {
  const candidates = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium', '/usr/bin/chromium'].filter(Boolean);
  for (const exe of candidates) if (fs.existsSync(exe)) return { executablePath: exe };
  return {};
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch(launchOptions());
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  page.on('pageerror', e => console.error('page error:', e.message));

  await page.goto(INDEX);
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.game);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '1-home.png') });

  await page.click('#btn-play');
  await page.waitForSelector('#overlay:not(.hidden)');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '2-level-start.png') });

  await page.click('#dialog .btn-green');
  await page.waitForFunction(() => UI.game.state === 'playing');
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, '3-board.png') });

  // a level with every obstacle type
  await page.evaluate(async () => {
    UI.game.stop();
    Store.data.level = 15;
    Store.addLives(5);
    UI.startLevel(15);
    await new Promise(r => setTimeout(r, 900));
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, '4-obstacles.png') });

  // win dialog
  await page.evaluate(async () => {
    UI.showWin({ score: 28450, stars: 3, level: Levels.get(15) });
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, '5-win.png') });

  await browser.close();
  console.log('screenshots written to ' + OUT);
}

main().catch(e => { console.error(e); process.exit(1); });
