// Milestone screenshots: `npm run shots` writes the latest milestone's set to shots/m3/;
// `npm run shots -- m1` (or m2) regenerates an earlier set. Every shot is set up through the
// game's test hooks so the images are reproducible (fixed seed, fixed times).
import { mkdirSync } from 'node:fs';
import { withBrowser } from './render-page.mjs';
import m1 from './shots/m1.mjs';
import m2 from './shots/m2.mjs';
import m3 from './shots/m3.mjs';

const SETS = { m1, m2, m3 };
const which = process.argv[2] || 'm3';
if (!SETS[which]) throw new Error(`Unknown set "${which}" (${Object.keys(SETS).join(', ')})`);
const OUT = `shots/${which}`;
mkdirSync(OUT, { recursive: true });

const boot = (page, base) => async (query) => {
  await page.goto(`${base}/index.html?${query}`);
  await page.waitForFunction(() => window.__ready === true);
};

await withBrowser(async (browser, base) => {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log(`  ${OUT}/${name}.png`); };
  const b = boot(page, base);
  await SETS[which]({ page, base, boot: (_p, _b, q) => b(q), shot, OUT });
  if (errors.length) {
    console.error('Console errors:\n' + errors.join('\n'));
    process.exitCode = 1;
  }
});
