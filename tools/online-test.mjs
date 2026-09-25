// Two headless browsers play online through the real UI: create, join by code,
// ready, vote, race. Screenshots both clients. Needs `npm run dev` (5173) and
// `npm run server` (8787) running.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const out = process.argv[2] || '/tmp/skykart-online';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const mk = async (name) => {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[${name}] pageerror`, e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log(`[${name}]`, m.text()); });
  await page.goto('http://localhost:5173/', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.mouse.click(420, 300);
  await page.waitForTimeout(700);
  await page.click('.tile.online');
  await page.waitForTimeout(600);
  await page.fill('.text-in', name);
  return page;
};
const a = await mk('Alice');
await a.click('text=Create room');
await a.waitForSelector('.room-code', { timeout: 8000 });
const code = (await a.textContent('.room-code')).trim();
console.log('room code', code);
const b = await mk('Bob');
await b.fill('.code-in', code);
await b.click('text=Join');
await b.waitForSelector('.room-code', { timeout: 8000 });
await a.waitForTimeout(800);
await a.screenshot({ path: `${out}/lobby-a.png` });
// host sets 1 lap, both ready
await a.click('.opt:nth-child(4) .segb:nth-child(1)').catch(() => {});
await a.click('text=Ready!');
await b.click('text=Ready!');
await a.waitForSelector('.vote', { timeout: 8000 });
await a.screenshot({ path: `${out}/vote-a.png` });
await a.click('.vote .tcard');
await b.click('.vote .tcard');
await a.waitForSelector('.hud:not(.hidden)', { timeout: 15000 });
console.log('race started');
await a.keyboard.down('ArrowUp');
await b.keyboard.down('ArrowUp');
await a.waitForTimeout(9000);
await a.screenshot({ path: `${out}/race-a.png` });
await b.screenshot({ path: `${out}/race-b.png` });
await a.keyboard.down('ArrowLeft');
await a.waitForTimeout(1500);
await a.keyboard.up('ArrowLeft');
await a.waitForTimeout(3000);
await a.screenshot({ path: `${out}/race-a2.png` });
const info = await a.evaluate(() => {
  const s = __skykart.session;
  const k = s.localKart();
  return { online: s.isOnline, phase: s.phase, speed: k.speed, place: k.place, karts: s.karts.length, rtt: __skykart.net.rtt, hist: s.history.length };
});
console.log(JSON.stringify(info));
await browser.close();
