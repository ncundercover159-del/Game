/* Generates the App Store icon and launch images.
 *
 *   node tools/make-app-assets.js  ->  assets/icon.png, assets/splash*.png
 *
 * The artwork is rendered in headless Chromium and then flattened with sharp:
 * the App Store rejects icons that carry an alpha channel, so the output is
 * deliberately opaque sRGB.
 *
 * `npx capacitor-assets generate --ios` turns these three sources into every
 * size Xcode needs.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets');

const NAVY = '#1b1246';
const DEEP = '#0e0a2a';
const OUTLINE = '#4a2c0d';

function launchOptions() {
  for (const exe of [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium', '/usr/bin/chromium'].filter(Boolean)) {
    if (fs.existsSync(exe)) return { executablePath: exe };
  }
  return {};
}

/* ------------------------------------------------------------------ *
 * The mascot. Everything is laid out inside a 400x400 viewBox with a
 * deliberate margin on every side — the previous version let the crown's
 * centre jewel run past the top edge, where it got sliced off.
 * ------------------------------------------------------------------ */
function kingLogo(size) {
  return `
  <svg viewBox="0 0 400 400" width="${size}" height="${size}" overflow="visible">
    <defs>
      <linearGradient id="goldG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff6d5"/>
        <stop offset=".38" stop-color="#ffc531"/>
        <stop offset="1" stop-color="#c98600"/>
      </linearGradient>
      <linearGradient id="bandG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffe9a3"/>
        <stop offset="1" stop-color="#b57200"/>
      </linearGradient>
      <radialGradient id="skinG" cx=".38" cy=".32" r=".85">
        <stop offset="0" stop-color="#ffe6c9"/>
        <stop offset="1" stop-color="#f2bd8d"/>
      </radialGradient>
      <linearGradient id="beardG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff"/>
        <stop offset="1" stop-color="#d8dced"/>
      </linearGradient>
      <linearGradient id="robeG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ff5470"/>
        <stop offset="1" stop-color="#b3122f"/>
      </linearGradient>
    </defs>

    <!-- shoulders, just enough to sit the head on -->
    <path d="M74 400 C82 344 132 316 200 316 C268 316 318 344 326 400 Z"
          fill="url(#robeG)" stroke="${OUTLINE}" stroke-width="9" stroke-linejoin="round"/>

    <!-- ears -->
    <ellipse cx="104" cy="232" rx="21" ry="25" fill="url(#skinG)" stroke="${OUTLINE}" stroke-width="9"/>
    <ellipse cx="296" cy="232" rx="21" ry="25" fill="url(#skinG)" stroke="${OUTLINE}" stroke-width="9"/>

    <!-- head -->
    <ellipse cx="200" cy="222" rx="104" ry="99" fill="url(#skinG)" stroke="${OUTLINE}" stroke-width="9"/>

    <!-- beard: big, fluffy, frames the smile -->
    <path d="M99 214
             C 92 300, 132 372, 200 372
             C 268 372, 308 300, 301 214
             C 292 268, 256 286, 200 286
             C 144 286, 108 268, 99 214 Z"
          fill="url(#beardG)" stroke="${OUTLINE}" stroke-width="9" stroke-linejoin="round"/>

    <!-- cheeks -->
    <ellipse cx="132" cy="243" rx="24" ry="17" fill="#ff8fa0" opacity=".55"/>
    <ellipse cx="268" cy="243" rx="24" ry="17" fill="#ff8fa0" opacity=".55"/>

    <!-- eyes -->
    <ellipse cx="163" cy="205" rx="19" ry="21" fill="#fff" stroke="${OUTLINE}" stroke-width="7"/>
    <ellipse cx="237" cy="205" rx="19" ry="21" fill="#fff" stroke="${OUTLINE}" stroke-width="7"/>
    <circle cx="167" cy="209" r="11" fill="#2b2033"/>
    <circle cx="241" cy="209" r="11" fill="#2b2033"/>
    <circle cx="171.5" cy="204" r="4.4" fill="#fff"/>
    <circle cx="245.5" cy="204" r="4.4" fill="#fff"/>

    <!-- brows: mostly tucked behind the crown band, so only the soft ends
         show above the eyes -->
    <path d="M138 184 Q163 173 190 182" fill="none" stroke="#f7f9ff" stroke-width="16" stroke-linecap="round"/>
    <path d="M210 182 Q237 173 262 184" fill="none" stroke="#f7f9ff" stroke-width="16" stroke-linecap="round"/>

    <!-- nose -->
    <ellipse cx="200" cy="238" rx="19" ry="14" fill="#f0ac79" stroke="${OUTLINE}" stroke-width="6"/>

    <!-- open, delighted smile -->
    <path d="M166 268 Q200 264 234 268 Q228 306 200 306 Q172 306 166 268 Z"
          fill="#8c2036" stroke="${OUTLINE}" stroke-width="7" stroke-linejoin="round"/>
    <path d="M180 296 Q200 288 220 296 Q212 306 200 306 Q188 306 180 296 Z" fill="#ff7a92"/>

    <!-- moustache over the top of the smile -->
    <path d="M200 262 C 176 250, 150 252, 140 266 C 154 276, 180 276, 200 268
             C 220 276, 246 276, 260 266 C 250 252, 224 250, 200 262 Z"
          fill="url(#beardG)" stroke="${OUTLINE}" stroke-width="8" stroke-linejoin="round"/>

    <!-- crown: tall points, band riding low on the brow -->
    <path d="M96 140 L110 54 L148 102 L200 42 L252 102 L290 54 L304 140 Z"
          fill="url(#goldG)" stroke="${OUTLINE}" stroke-width="10" stroke-linejoin="round"/>
    <rect x="92" y="132" width="216" height="42" rx="21"
          fill="url(#bandG)" stroke="${OUTLINE}" stroke-width="10"/>
    <circle cx="110" cy="54" r="18" fill="#ff3d5a" stroke="${OUTLINE}" stroke-width="8"/>
    <circle cx="200" cy="42" r="21" fill="#2f96ff" stroke="${OUTLINE}" stroke-width="8"/>
    <circle cx="290" cy="54" r="18" fill="#2fd160" stroke="${OUTLINE}" stroke-width="8"/>
    <circle cx="147" cy="153" r="12" fill="#ff3d5a"/>
    <circle cx="200" cy="153" r="12" fill="#2fd160"/>
    <circle cx="253" cy="153" r="12" fill="#a45cff"/>
  </svg>`;
}

/* A couple of the game's own jewels, tucked into the lower corners so the
 * icon says "match-3" and not just "king". */
function cornerGems(size) {
  const gem = (fill, dark, d, x, y, s, rot) => `
    <g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
      <path d="${d}" fill="${fill}" stroke="${dark}" stroke-width="7" stroke-linejoin="round"/>
      <ellipse cx="-12" cy="-16" rx="12" ry="7" fill="#fff" opacity=".7" transform="rotate(-30)"/>
    </g>`;
  const heart = 'M0 34 C-48 -4 -22 -42 0 -15 C22 -42 48 -4 0 34 Z';
  const diamond = 'M0 -38 L31 -5 L0 38 L-31 -5 Z';
  const hex = 'M0 -36 L31 -18 L31 18 L0 36 L-31 18 L-31 -18 Z';
  return `
  <svg viewBox="0 0 400 400" width="${size}" height="${size}" style="position:absolute;inset:0">
    ${gem('#ff3d5a', '#8f0c23', heart, 58, 330, 0.92, -14)}
    ${gem('#2f96ff', '#0a4392', diamond, 344, 322, 0.86, 12)}
    ${gem('#ffc21f', '#a56800', hex, 356, 118, 0.6, 8)}
  </svg>`;
}

/* Sunburst behind the mascot — fixed geometry so rebuilds are identical. */
function rays(size) {
  const n = 18;
  let out = '';
  for (let i = 0; i < n; i++) {
    if (i % 2) continue;
    const a0 = (i / n) * 360;
    const a1 = ((i + 1) / n) * 360;
    const p = (a) => {
      const r = 300;
      const rad = (a - 90) * Math.PI / 180;
      return `${(200 + Math.cos(rad) * r).toFixed(1)} ${(200 + Math.sin(rad) * r).toFixed(1)}`;
    };
    out += `<path d="M200 200 L${p(a0)} L${p(a1)} Z" fill="rgba(255,255,255,.075)"/>`;
  }
  return `<svg viewBox="0 0 400 400" width="${size}" height="${size}" style="position:absolute;inset:0">${out}</svg>`;
}

function sparkles() {
  return [[14, 20, 11], [86, 16, 13], [8, 62, 9], [93, 55, 10], [24, 88, 8], [78, 90, 9]]
    .map(([x, y, r]) => `<div style="position:absolute;left:${x}%;top:${y}%;width:${r}px;height:${r}px;
      border-radius:50%;background:#fff;opacity:.85;
      box-shadow:0 0 ${r * 2.5}px rgba(255,255,255,.75);transform:translate(-50%,-50%)"></div>`).join('');
}

function page(inner, w, h, bg) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${w}px; height: ${h}px; overflow: hidden; }
    body {
      background: ${bg};
      display: flex; align-items: center; justify-content: center;
      font-family: "Trebuchet MS", Verdana, sans-serif;
    }
  </style></head><body>${inner}</body></html>`;
}

const ICON_BG = `radial-gradient(circle at 50% 40%, #7a45d8 0%, #4a2a9c 42%, ${NAVY} 76%, ${DEEP} 100%)`;

function iconHtml(size) {
  // The mascot is inset to ~86% so nothing collides with the rounded mask
  // iOS applies over the icon.
  const inner = size * 0.86;
  return page(`
    <div style="position:relative;width:${size}px;height:${size}px;overflow:hidden">
      ${rays(size)}
      ${sparkles()}
      <div style="position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);
                  width:${inner}px;height:${inner}px;
                  filter:drop-shadow(0 ${size * 0.022}px ${size * 0.03}px rgba(0,0,0,.45))">
        ${kingLogo(inner)}
      </div>
      ${cornerGems(size)}
    </div>`, size, size, ICON_BG);
}

function splashHtml(size, dark) {
  const bg = dark
    ? `radial-gradient(circle at 50% 42%, #37207a 0%, ${NAVY} 45%, ${DEEP} 100%)`
    : `radial-gradient(circle at 50% 42%, #7a45d8 0%, #3d2192 44%, ${NAVY} 100%)`;
  const logo = size * 0.30;
  return page(`
    <div style="display:flex;flex-direction:column;align-items:center;gap:${size * 0.022}px">
      <div style="filter:drop-shadow(0 ${size * 0.008}px ${size * 0.014}px rgba(0,0,0,.5))">
        ${kingLogo(logo)}
      </div>
      <div style="
        font-size:${size * 0.066}px; font-weight:900; letter-spacing:${size * 0.003}px;
        background:linear-gradient(180deg,#fff 8%,#ffe9a3 46%,#ffc531 72%,#b57200 100%);
        -webkit-background-clip:text; background-clip:text; color:transparent;
        padding-bottom:${size * 0.012}px;">Crown Quest</div>
    </div>`, size, size, bg);
}

async function shoot(page_, html, w, h) {
  await page_.setViewportSize({ width: w, height: h });
  await page_.setContent(html, { waitUntil: 'load' });
  return page_.screenshot({ type: 'png' });
}

/* App Store icons must be opaque — flatten drops the alpha channel. */
async function writeOpaque(buffer, file, bg) {
  await sharp(buffer).flatten({ background: bg }).toColourspace('srgb')
    .png({ compressionLevel: 9 }).toFile(file);
  const meta = await sharp(file).metadata();
  console.log(`  ${path.relative(ROOT, file)} — ${meta.width}x${meta.height}, ` +
    `${meta.channels} channels, alpha: ${meta.hasAlpha}`);
  if (meta.hasAlpha) throw new Error(file + ' still has an alpha channel');
}

/* Guards against the bug this artwork already had once: art that runs past
 * the edge gets silently sliced. Fails if any edge row/column is not the
 * flat background, which is what clipped artwork looks like. */
async function assertNothingClipped(file) {
  const img = sharp(file);
  const { width, height } = await img.metadata();
  const raw = await img.raw().toBuffer();
  const at = (x, y) => {
    const i = (y * width + x) * 3;
    return [raw[i], raw[i + 1], raw[i + 2]];
  };
  const bright = ([r, g, b]) => r + g + b > 300;   // gold/skin/white, vs the dark ground
  const edges = [];
  for (let x = 0; x < width; x += 4) {
    if (bright(at(x, 1))) edges.push(`top x=${x}`);
    if (bright(at(x, height - 2))) edges.push(`bottom x=${x}`);
  }
  for (let y = 0; y < height; y += 4) {
    if (bright(at(1, y))) edges.push(`left y=${y}`);
    if (bright(at(width - 2, y))) edges.push(`right y=${y}`);
  }
  if (edges.length) {
    throw new Error(`${path.basename(file)}: artwork touches the canvas edge (${edges.slice(0, 4).join(', ')}` +
      `${edges.length > 4 ? ', …' : ''}) — it is being clipped`);
  }
  console.log(`  ${path.basename(file)} — nothing clipped at the edges`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch(launchOptions());
  const p = await browser.newPage();

  console.log('rendering app assets:');
  const icon = path.join(OUT, 'icon.png');
  await writeOpaque(await shoot(p, iconHtml(1024), 1024, 1024), icon, NAVY);
  await writeOpaque(await shoot(p, splashHtml(2732, false), 2732, 2732), path.join(OUT, 'splash.png'), NAVY);
  await writeOpaque(await shoot(p, splashHtml(2732, true), 2732, 2732), path.join(OUT, 'splash-dark.png'), DEEP);

  console.log('checking:');
  await assertNothingClipped(icon);

  await browser.close();
  console.log('done — run `npx capacitor-assets generate --ios` on macOS to fan these out');
}

main().catch(e => { console.error(e); process.exit(1); });
