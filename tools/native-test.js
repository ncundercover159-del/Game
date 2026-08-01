/* Exercises the Capacitor code path without a Mac.
 *
 *   node tools/native-test.js
 *
 * A stub bridge is injected before the page scripts run, so `Native` takes
 * the native branch exactly as it would inside the iOS WebView. This catches
 * typos in plugin names and calls that would only blow up on a device.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const INDEX = 'file://' + path.join(__dirname, '..', 'index.html');

function launchOptions() {
  for (const exe of [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium', '/usr/bin/chromium'].filter(Boolean)) {
    if (fs.existsSync(exe)) return { executablePath: exe };
  }
  return {};
}

/* Mirrors the surface Capacitor injects into the WebView: every plugin call
 * returns a promise and is recorded so we can assert on it afterwards. */
const BRIDGE_STUB = `
window.__nativeCalls = [];
(function () {
  const record = (name) => new Proxy({}, {
    get: (_, method) => (...args) => {
      window.__nativeCalls.push(name + '.' + String(method) +
        (args.length && typeof args[0] === 'object' ? ' ' + JSON.stringify(args[0]) : ''));
      return Promise.resolve({ value: true });
    },
  });
  window.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'ios',
    Plugins: {
      Haptics: record('Haptics'),
      StatusBar: record('StatusBar'),
      SplashScreen: record('SplashScreen'),
      App: record('App'),
    },
  };
})();
`;

async function main() {
  const problems = [];
  const browser = await chromium.launch(launchOptions());
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  page.on('console', m => { if (m.type() === 'error') problems.push('console error: ' + m.text()); });
  page.on('pageerror', e => problems.push('page error: ' + (e.stack || e.message)));

  await page.addInitScript(BRIDGE_STUB);
  await page.goto(INDEX);
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.game, null, { timeout: 10000 });
  await page.evaluate(() => { UI.game.speed = 8; });
  await page.waitForTimeout(300);

  // --- boot behaviour ---------------------------------------------------
  const boot = await page.evaluate(() => ({
    detected: Native.available,
    platform: Native.platform,
    htmlClass: document.documentElement.className,
    calls: window.__nativeCalls.slice(),
  }));

  if (!boot.detected) problems.push('Native.available was false with the bridge present');
  if (boot.platform !== 'ios') problems.push('platform was ' + boot.platform);
  if (!boot.htmlClass.includes('is-native')) problems.push('is-native class was not applied');

  const expectBoot = ['StatusBar.hide', 'SplashScreen.hide', 'App.addListener'];
  for (const want of expectBoot) {
    if (!boot.calls.some(c => c.startsWith(want))) problems.push('missing boot call: ' + want);
  }
  console.log('boot calls:', boot.calls.join(' | '));

  // --- haptics during real play ----------------------------------------
  const play = await page.evaluate(async () => {
    window.__nativeCalls.length = 0;
    const g = UI.game;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const idle = async () => { let n = 0; while (g.busy && g.state === 'playing' && n++ < 900) await sleep(20); };

    UI.startLevel(1);
    await sleep(500);
    await idle();

    let turns = 0;
    while (g.state === 'playing' && turns < 12) {
      const moves = g.board.findAllMoves();
      if (!moves.length) break;
      const m = moves[Math.floor(Math.random() * moves.length)];
      if (m.tap) await g.tapPower(m.a, g.board.gemAt(m.a.r, m.a.c));
      else await g.attemptSwap(m.a, m.b);
      turns++;
      await idle();
    }
    return { turns, calls: window.__nativeCalls.slice() };
  });

  const haptics = play.calls.filter(c => c.startsWith('Haptics.'));
  if (!haptics.length) problems.push('no haptics fired across ' + play.turns + ' turns');
  const kinds = [...new Set(haptics.map(h => h.replace(/\s.*/, '') + (h.match(/"style":"(\w+)"/) ? ':' + h.match(/"style":"(\w+)"/)[1] : '')))];
  console.log(`played ${play.turns} turns — ${haptics.length} haptics: ${kinds.join(', ')}`);

  // --- backgrounding must silence audio ---------------------------------
  const bg = await page.evaluate(async () => {
    SFX.init();
    const before = SFX.ctx ? SFX.ctx.state : 'none';
    Native.onAppState(false);
    await new Promise(r => setTimeout(r, 200));
    const after = SFX.ctx ? SFX.ctx.state : 'none';
    Native.onAppState(true);
    return { before, after };
  });
  if (bg.before === 'running' && bg.after !== 'suspended') {
    problems.push(`audio was not suspended on background (${bg.before} -> ${bg.after})`);
  }
  console.log(`audio on background: ${bg.before} -> ${bg.after}`);

  await browser.close();

  if (problems.length) {
    console.error('\nFAILED:');
    problems.forEach(p => console.error('  - ' + p));
    process.exit(1);
  }
  console.log('\nNative bridge checks passed.');
}

main().catch(e => { console.error(e); process.exit(1); });
