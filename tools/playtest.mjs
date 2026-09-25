// Headless playtest driver (Playwright + Chromium). Loads the game in a phone
// landscape viewport, runs a scripted input sequence, captures console errors
// and screenshots. Usage:
//   node tools/playtest.mjs --url http://localhost:5173/?dev --script drift --out /tmp/shots
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
const url = args.url || 'http://localhost:5173/';
const out = args.out || '/tmp/skykart-shots';
const W = +(args.w || 844), H = +(args.h || 390);
fs.mkdirSync(out, { recursive: true });

// Scripts: list of [timeMs, action, arg]
const SCRIPTS = {
  idle: [[2500, 'shot', 'idle']],
  drift: [
    [1500, 'shot', 'start'],
    [3800, 'down', 'ArrowUp'], [4200, 'shot', 'go'],
    [6000, 'shot', 'speed'],
    [6100, 'down', 'ArrowLeft'], [6150, 'down', 'Space'], [6700, 'shot', 'drift-start'],
    [8200, 'shot', 'drift-orange'], [9800, 'shot', 'drift-purple'], [10000, 'up', 'Space'], [10050, 'up', 'ArrowLeft'],
    [10300, 'shot', 'mt-boost'],
    [12000, 'shot', 'after'],
  ],
  flow: [
    [800, 'shot', 'f-intro1'], [2500, 'shot', 'f-intro2'], [4400, 'shot', 'f-intro3'], [5600, 'shot', 'f-count'],
    [8200, 'shot', 'f-go'], [14000, 'shot', 'f-race'],
  ],
  results: [[38000, 'shot', 'r-finish'], [45000, 'shot', 'r-results']],
  items: [
    [5500, 'eval', "(() => { const k = __skykart.session.localKart(); k.item = 'orb3'; k.itemCount = 3; return 'ok'; })()"],
    [8000, 'shot', 'i-slot'],
    [8100, 'down', 'KeyE'], [8200, 'up', 'KeyE'], [8700, 'shot', 'i-orbit'],
    [8900, 'down', 'KeyE'], [9000, 'up', 'KeyE'], [9200, 'shot', 'i-fire'],
    [9500, 'eval', "(() => { const k = __skykart.session.localKart(); k.item = 'peel'; return 'ok'; })()"],
    [9700, 'down', 'KeyE'], [10200, 'shot', 'i-trail'], [10300, 'up', 'KeyE'],
    [10500, 'eval', "(() => { const k = __skykart.session.localKart(); k.item = 'boulder'; return 'ok'; })()"],
    [10700, 'down', 'KeyE'], [10800, 'up', 'KeyE'], [11400, 'shot', 'i-boulder'],
    [11700, 'eval', "(() => { const k = __skykart.session.localKart(); k.item = 'flail'; return 'ok'; })()"],
    [11800, 'down', 'KeyE'], [11900, 'up', 'KeyE'], [12400, 'shot', 'i-flail'],
    [12700, 'eval', "(() => { const k = __skykart.session.localKart(); k.item = 'clone'; return 'ok'; })()"],
    [12800, 'down', 'KeyE'], [12900, 'up', 'KeyE'], [13400, 'shot', 'i-clone'],
    [13700, 'eval', "(() => { const k = __skykart.session.localKart(); k.item = 'comet'; return 'ok'; })()"],
    [13800, 'down', 'KeyE'], [13900, 'up', 'KeyE'], [14500, 'shot', 'i-comet'],
    [15500, 'shot', 'i-comet2'],
  ],
  dbgitem: [
    [3000, 'eval', "(() => { const k = __skykart.session.localKart(); k.item = 'orb3'; k.itemCount = 3; return 'ok'; })()"],
    [5600, 'eval', "(() => { const k = __skykart.session.localKart(); return {phase: __skykart.session.race.phase, item: k.item, held: k.itemHeld, spin: k.spin, tumble: k.tumble, rescue: k.rescue, btn: __skykart.lastInput.btn}; })()"],
    [5650, 'down', 'KeyE'],
    [5750, 'eval', "(() => { const k = __skykart.session.localKart(); return {item: k.item, held: k.itemHeld, orbit: k.orbit, btn: __skykart.lastInput.btn}; })()"],
    [5800, 'up', 'KeyE'],
    [5900, 'eval', "(() => { const k = __skykart.session.localKart(); return {item: k.item, held: k.itemHeld, orbit: k.orbit, btn: __skykart.lastInput.btn}; })()"],
  ],
  menus: [
    [1500, 'tap', [420, 300]], [2300, 'shot', 'm-main'],
    [2400, 'click', '.tile.gp'], [3000, 'shot', 'm-class'],
    [3100, 'click', '.choice:nth-child(3)'], [4200, 'shot', 'm-racer'],
    [4300, 'click', '.screen:not(.covered) .bottom-bar .btn'], [5400, 'shot', 'm-kart'],
    [5500, 'click', '.screen:not(.covered) .bottom-bar .btn'], [6200, 'shot', 'm-cup'],
    [6300, 'click', '.screen:not(.covered) .cup'], [7500, 'shot', 'm-race'],
  ],
  gp1: [
    [1500, 'tap', [420, 300]], [2400, 'click', '.tile.gp'], [3100, 'click', '.choice:nth-child(3)'],
    [4300, 'click', '.screen:not(.covered) .bottom-bar .btn'], [5500, 'click', '.screen:not(.covered) .bottom-bar .btn'],
    [6300, 'click', '.screen:not(.covered) .cup'],
    [14000, 'shot', 'g-race'],
    [14500, 'eval', "(() => { const r = __skykart.session.race; r.lapSystem.end(r); return r.phase; })()"],
    [19000, 'shot', 'g-results'],
    [19500, 'click', '.screen:not(.covered) .bottom-bar .btn:last-child'], [23000, 'shot', 'g-podium'],
  ],
  lap: [
    [1500, 'shot', 'l0'], [6000, 'shot', 'l1'], [9000, 'shot', 'l2'], [12000, 'shot', 'l3'], [16000, 'shot', 'l4'],
    [20000, 'shot', 'l5'], [24000, 'shot', 'l6'], [28000, 'shot', 'l7'], [30500, 'shot', 'l8'], [33000, 'shot', 'l9'],
  ],
  touch: [
    [1500, 'shot', 't-start'],
    [4200, 'eval', 'JSON.stringify({yaw: __skykart.session.localKart().yaw, speed: __skykart.session.localKart().speed})'],
    [4300, 'touch', { type: 'touchStart', points: [[110, 290, 1]] }],
    [4400, 'touch', { type: 'touchMove', points: [[170, 292, 1]] }],
    [4500, 'touch', { type: 'touchStart', points: [[170, 292, 1], [730, 290, 2]] }],
    [5600, 'shot', 't-steer-drift'],
    [5700, 'eval', 'JSON.stringify({yaw: __skykart.session.localKart().yaw, drift: __skykart.session.localKart().drift, tier: __skykart.session.localKart().driftTier, steer: __skykart.input.touch.state.steer})'],
    [6400, 'touch', { type: 'touchEnd', points: [] }],
    [6600, 'eval', 'JSON.stringify({boost: __skykart.session.localKart().boostKind})'],
  ],
  ramp: [
    [1500, 'shot', 'start'], [3800, 'down', 'ArrowUp'],
    [8000, 'shot', 'r1'], [8600, 'shot', 'r2'], [9200, 'shot', 'r3'], [9800, 'shot', 'r4'], [10400, 'shot', 'r5'],
  ],
};

const script = SCRIPTS[args.script || 'idle'];
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: !!args.touch, isMobile: !!args.touch });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto(url, { waitUntil: 'load' });
const t0 = Date.now();
let cdp = null;
for (const [t, action, arg] of script) {
  const wait = t - (Date.now() - t0);
  if (wait > 0) await page.waitForTimeout(wait);
  if (action === 'shot') await page.screenshot({ path: path.join(out, `${arg}.png`) });
  else if (action === 'down') await page.keyboard.down(arg);
  else if (action === 'up') await page.keyboard.up(arg);
  else if (action === 'eval') console.log(arg, '=>', JSON.stringify(await page.evaluate(arg)));
  else if (action === 'tap') await page.mouse.click(arg[0], arg[1]);
  else if (action === 'click') await page.click(arg, { timeout: 3000 }).catch((e) => console.log('click failed', arg, e.message));
  else if (action === 'clickText') await page.getByText(arg, { exact: true }).first().click({ timeout: 3000 }).catch((e) => console.log('click failed', arg, e.message));
  else if (action === 'mdown') { await page.mouse.move(arg[0], arg[1]); await page.mouse.down(); }
  else if (action === 'mmove') await page.mouse.move(arg[0], arg[1], { steps: 4 });
  else if (action === 'mup') await page.mouse.up();
  else if (action === 'touch') {
    // multi-touch via CDP: arg = { type: 'touchStart'|'touchMove'|'touchEnd', points: [[x,y,id],...] }
    cdp ??= await ctx.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: arg.type, touchPoints: arg.points.map(([x, y, id]) => ({ x, y, id })) });
  }
}
if (args.eval) console.log('EVAL', JSON.stringify(await page.evaluate(args.eval)));
const errs = logs.filter((l) => l.includes('error') || l.includes('Error'));
const uniq = [...new Set(logs)];
console.log(uniq.slice(0, 60).map((l) => l.slice(0, 3000)).join('\n'));
console.log(`\n${errs.length} error lines. Screenshots in ${out}`);
await browser.close();
