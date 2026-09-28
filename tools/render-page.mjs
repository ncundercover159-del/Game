// Dev helper: serve the repo, open a page, run optional in-page JS, screenshot. Used by shots and art iteration.
// Usage: node tools/render-page.mjs <url-path> <out.png> [width] [height] [waitMs]
import { chromium } from 'playwright';
import { startServer } from '../server.js';

export async function withBrowser(fn, { port = 8123 } = {}) {
  const server = await startServer(port);
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  try {
    return await fn(browser, `http://localhost:${port}`);
  } finally {
    await browser.close();
    server.close();
  }
}

if (process.argv[1] && process.argv[1].endsWith('render-page.mjs')) {
  const [, , path, out, w = '1440', h = '900', wait = '800'] = process.argv;
  await withBrowser(async (browser, base) => {
    const page = await browser.newPage({ viewport: { width: +w, height: +h } });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(base + path);
    await page.waitForTimeout(+wait);
    await page.screenshot({ path: out });
    if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
    else console.log('ok', out);
  });
}
