// Build a contact sheet (grid) of PNG screenshots using headless Chromium.
// Usage: node tools/contact.mjs out.png a.png b.png c.png ... [--cols 2] [--w 420]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}
const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf('--' + name);
  if (i < 0) return def;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
};
const cols = +opt('cols', 2);
const cw = +opt('w', 420);
const [out, ...files] = argv;
const imgs = files.map((f) => `<figure><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"><figcaption>${path.basename(f)}</figcaption></figure>`).join('');
const html = `<html><body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},${cw}px);gap:4px;font:11px sans-serif;color:#fff">
<style>figure{margin:0}img{width:${cw}px;display:block}figcaption{padding:2px}</style>${imgs}</body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: cols * (cw + 4), height: 200 } });
await page.setContent(html);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('wrote', out);
