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
  // Overrides must win over the catch-all recorder, so the get trap checks
  // the target for an own property first.
  const record = (name, overrides) => new Proxy(overrides || {}, {
    get: (target, method) => {
      if (Object.prototype.hasOwnProperty.call(target, method)) return target[method];
      return (...args) => {
        window.__nativeCalls.push(name + '.' + String(method) +
          (args.length && typeof args[0] === 'object' ? ' ' + JSON.stringify(args[0]) : ''));
        return Promise.resolve({ value: true });
      };
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
      AdMob: record('AdMob', {
        // A watched ad resolves with a reward item; closing it early does not.
        showRewardVideoAd: () => {
          window.__nativeCalls.push('AdMob.showRewardVideoAd');
          return window.__rewardOutcome === false
            ? Promise.resolve(null)
            : Promise.resolve({ type: 'coins', amount: 1 });
        },
      }),
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

  // --- ads: initialise, preload, gate, reward ---------------------------
  const ads = await page.evaluate(async () => {
    const out = { issues: [] };
    window.__nativeCalls.length = 0;

    await Ads.init();
    out.initCalls = window.__nativeCalls.slice();
    if (!Ads.native) out.issues.push('Ads.native false with the AdMob plugin present');

    // banner belongs on the map only
    window.__nativeCalls.length = 0;
    UI.showScreen('home');
    await new Promise(r => setTimeout(r, 50));
    out.bannerOnHome = window.__nativeCalls.some(c => c.startsWith('AdMob.showBanner'));
    window.__nativeCalls.length = 0;
    UI.showScreen('game');
    await new Promise(r => setTimeout(r, 50));
    out.bannerHiddenInGame = window.__nativeCalls.some(c => c.startsWith('AdMob.hideBanner'));
    UI.showScreen('home');

    // rewarded video pays out only when the ad reports a reward
    window.__rewardOutcome = true;
    Ads._rewardedLoaded = true;
    out.rewardWatched = await Ads.showRewarded();
    window.__rewardOutcome = false;
    Ads._rewardedLoaded = true;
    out.rewardClosedEarly = await Ads.showRewarded();

    // interstitial frequency cap
    Store.data.level = 10;
    Store.data.ads = { levelEnds: 0, lastInterstitial: 0, lastFreeCoins: 0 };
    out.cappedAtZero = Ads.canShowInterstitial();
    Ads.noteLevelEnd();
    Ads.noteLevelEnd();
    out.allowedAfterN = Ads.canShowInterstitial();
    Ads._interstitialLoaded = true;
    await Ads.maybeShowInterstitial();
    out.blockedImmediatelyAfter = Ads.canShowInterstitial();

    // early levels are exempt
    Store.data.level = 2;
    Store.data.ads.levelEnds = 5;
    Store.data.ads.lastInterstitial = 0;
    out.skippedEarlyLevels = Ads.canShowInterstitial();
    Store.data.level = 10;
    return out;
  });

  if (!ads.initCalls.some(c => c.startsWith('AdMob.initialize'))) problems.push('AdMob.initialize was not called');
  if (!ads.bannerOnHome) problems.push('no banner requested on the home screen');
  if (!ads.bannerHiddenInGame) problems.push('banner not hidden when entering a level');
  if (ads.rewardWatched !== true) problems.push('watching a rewarded ad did not report success');
  if (ads.rewardClosedEarly !== false) problems.push('closing a rewarded ad early still paid out');
  if (ads.cappedAtZero !== false) problems.push('interstitial allowed before the level-end threshold');
  if (ads.allowedAfterN !== true) problems.push('interstitial not allowed after the threshold');
  if (ads.blockedImmediatelyAfter !== false) problems.push('interstitial not rate-limited after showing one');
  if (ads.skippedEarlyLevels !== false) problems.push('interstitial shown during the early levels');
  console.log(`ads: init ok, banner home-only, reward gating ok, frequency cap ok`);

  // --- remove ads entitlement -------------------------------------------
  const iap = await page.evaluate(async () => {
    const out = { issues: [] };
    Store.data.removeAds = false;
    const coinsBefore = Store.coins();

    out.bannerBefore = Ads.shouldShow('banner');
    out.interstitialBefore = Ads.shouldShow('interstitial');

    IAP.grant(true);

    out.owned = IAP.owned;
    out.coinsAdded = Store.coins() - coinsBefore;
    out.bannerAfter = Ads.shouldShow('banner');
    out.interstitialAfter = Ads.shouldShow('interstitial');
    out.rewardedAfter = Ads.shouldShow('rewarded');

    // granting twice must not pay the bonus twice
    const again = IAP.grant(true);
    out.grantedTwice = again;

    // survives a reload of the save file
    Store.save();
    Store.load();
    out.persisted = !!Store.data.removeAds;

    Store.data.removeAds = false;
    Store.save();
    return out;
  });

  if (!iap.owned) problems.push('grant() did not set the removeAds entitlement');
  if (iap.coinsAdded <= 0) problems.push('purchase bonus coins were not awarded');
  if (!(iap.bannerBefore && iap.interstitialBefore)) problems.push('ads were not showing before the purchase');
  if (iap.bannerAfter || iap.interstitialAfter) problems.push('banner/interstitial still enabled after Remove Ads');
  if (!iap.rewardedAfter) problems.push('rewarded video was disabled by Remove Ads (it should stay opt-in)');
  if (iap.grantedTwice) problems.push('entitlement granted twice — bonus coins could be farmed');
  if (!iap.persisted) problems.push('Remove Ads did not survive a save/load round trip');
  console.log(`remove ads: entitlement ok, +${iap.coinsAdded} bonus coins, rewarded still available`);

  await browser.close();

  if (problems.length) {
    console.error('\nFAILED:');
    problems.forEach(p => console.error('  - ' + p));
    process.exit(1);
  }
  console.log('\nNative bridge checks passed.');
}

main().catch(e => { console.error(e); process.exit(1); });
