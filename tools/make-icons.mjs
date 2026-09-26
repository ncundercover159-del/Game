// Renders the app icons (PWA / home screen) with headless Chromium.
//   node tools/make-icons.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { PATHS } from '../shared/data/nodeLoader.js';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const svg = (maskable) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f7fe0"/><stop offset="1" stop-color="#9fd8ff"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6a0"/><stop offset=".45" stop-color="#ffd23f"/><stop offset="1" stop-color="#ff8a1e"/></linearGradient>
  </defs>
  <rect width="512" height="512" rx="${maskable ? 0 : 112}" fill="url(#sky)"/>
  <g transform="translate(256 262) scale(${maskable ? 0.78 : 1})">
    <ellipse cx="0" cy="150" rx="190" ry="26" fill="#1a1426" opacity=".25"/>
    <path d="M-150 60 Q-150 10 -100 0 L110 0 Q160 10 160 60 L160 95 Q160 115 140 115 L-130 115 Q-150 115 -150 95 Z" fill="#a84cff" stroke="#1a1426" stroke-width="14"/>
    <path d="M-60 0 Q-40 -60 20 -60 Q70 -60 80 0 Z" fill="#7fe7f2" stroke="#1a1426" stroke-width="14"/>
    <circle cx="-95" cy="118" r="44" fill="#2a2530" stroke="#1a1426" stroke-width="12"/><circle cx="-95" cy="118" r="16" fill="#ffd23f"/>
    <circle cx="110" cy="118" r="44" fill="#2a2530" stroke="#1a1426" stroke-width="12"/><circle cx="110" cy="118" r="16" fill="#ffd23f"/>
    <path d="M-235 40 L-175 40 M-250 80 L-180 80" stroke="#fff" stroke-width="14" stroke-linecap="round" opacity=".9"/>
    <text x="0" y="-95" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="150" font-weight="900" font-style="italic"
      fill="url(#gold)" stroke="#1a1426" stroke-width="14" paint-order="stroke">SK</text>
  </g>
</svg>`;

const b = await chromium.launch();
const p = await b.newPage();
const out = path.join(PATHS.ROOT, 'client/public/icons');
for (const [name, size, mask] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['maskable-512.png', 512, true], ['favicon-64.png', 64, false]]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<body style="margin:0;background:transparent">${svg(mask).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
  await p.screenshot({ path: path.join(out, name), omitBackground: true });
  console.log('wrote', name);
}
await b.close();
