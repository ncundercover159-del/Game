// SVG icons for every item (HUD slot, touch button, ticker, results).
const svg = (body) => `<svg viewBox="0 0 64 64">${body}</svg>`;
const O = 'stroke="#1a1426" stroke-width="3.5" stroke-linejoin="round"';

const orb = (cx, cy, r, c = '#c04fff', c2 = '#ffb8ff') =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" ${O}/><circle cx="${cx - r * 0.35}" cy="${cy - r * 0.35}" r="${r * 0.35}" fill="${c2}"/>`;
const seeker = (cx, cy, r) =>
  `${orb(cx, cy, r, '#ff3d4f', '#ffc0c8')}<circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="none" stroke="#fff" stroke-width="2.5"/><path d="M${cx} ${cy - r * 0.9}v${r * 0.5}M${cx} ${cy + r * 0.9}v-${r * 0.5}M${cx - r * 0.9} ${cy}h${r * 0.5}M${cx + r * 0.9} ${cy}h-${r * 0.5}" stroke="#fff" stroke-width="2.5"/>`;
const peel = (x, y, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-14 8c2-14 10-20 14-22 4 2 12 8 14 22-6-4-10-6-14-6s-8 2-14 6z" fill="#ffe04f" ${O}/><path d="M0-14v10" stroke="#8a5a32" stroke-width="3"/></g>`;
const shroom = (x, y, s = 1, cap = '#ff5a3d', dots = '#fff') =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-8 2h16v14a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4z" fill="#fff2d6" ${O}/><path d="M-20 4c0-14 9-22 20-22s20 8 20 22z" fill="${cap}" ${O}/><circle cx="-8" cy="-6" r="4" fill="${dots}"/><circle cx="7" cy="-9" r="5" fill="${dots}"/><path d="M-2 10l4-6-2 0 2-6" stroke="#1a1426" stroke-width="2" fill="none"/></g>`;

export const ITEM_ICONS = {
  orb: svg(orb(32, 32, 20)),
  orb3: svg(orb(20, 40, 12) + orb(44, 40, 12) + orb(32, 20, 12)),
  seeker: svg(seeker(32, 32, 20)),
  seeker3: svg(seeker(20, 42, 12) + seeker(44, 42, 12) + seeker(32, 20, 12)),
  peel: svg(peel(32, 36, 1.3)),
  peel3: svg(peel(20, 44, 0.8) + peel(44, 44, 0.8) + peel(32, 24, 0.8)),
  shroom: svg(shroom(32, 32, 1.3)),
  shroom3: svg(shroom(19, 42, 0.8) + shroom(45, 42, 0.8) + shroom(32, 20, 0.8)),
  goldShroom: svg(shroom(32, 32, 1.3, '#ffc21a', '#fff6a0')),
  comet: svg(`<path d="M8 20l14 6-6-14 12 10 4-14 4 14 12-10-6 14 14-6-10 12 12 6-14 2 8 12-14-6-2 14-6-12-6 12-2-14-14 6 8-12-14-2 12-6z" fill="#3d7bff" ${O}/><circle cx="32" cy="32" r="9" fill="#9fe3ff" ${O}/><path d="M22 22l-6-8M42 22l6-8" stroke="#fff" stroke-width="3"/>`),
  bolt: svg(`<path d="M36 4L12 36h14l-6 24 26-34H32z" fill="#ffe04f" ${O}/>`),
  ink: svg(`<path d="M32 8c10 0 16 8 16 18 0 6-2 10-6 13l4 12-8-7-6 9-6-9-8 7 4-12c-4-3-6-7-6-13 0-10 6-18 16-18z" fill="#3a2a6a" ${O}/><circle cx="26" cy="26" r="5" fill="#fff"/><circle cx="38" cy="26" r="5" fill="#fff"/><circle cx="27" cy="27" r="2" fill="#1a1426"/><circle cx="39" cy="27" r="2" fill="#1a1426"/>`),
  star: svg(`<defs><linearGradient id="rb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5a5a"/><stop offset=".35" stop-color="#ffe04f"/><stop offset=".7" stop-color="#56d23e"/><stop offset="1" stop-color="#3db4ff"/></linearGradient></defs><path d="M32 4l8 18 20 2-15 13 5 20-18-11-18 11 5-20L4 24l20-2z" fill="url(#rb)" ${O}/><circle cx="26" cy="30" r="3" fill="#1a1426"/><circle cx="38" cy="30" r="3" fill="#1a1426"/>`),
  magnet: svg(`<path d="M14 10h12v20a6 6 0 0 0 12 0V10h12v20a18 18 0 0 1-36 0z" fill="#ff3d4f" ${O}/><path d="M14 10h12v8H14zM38 10h12v8H38z" fill="#d8dee6" ${O}/><circle cx="50" cy="48" r="7" fill="#ffc21a" ${O}/>`),
  horn: svg(`<path d="M8 26h10l22-14v40L18 38H8z" fill="#ffc21a" ${O}/><path d="M46 22c4 4 4 16 0 20M52 16c8 8 8 24 0 32" stroke="#1a1426" stroke-width="4" fill="none" stroke-linecap="round"/>`),
  coinPack: svg(`<ellipse cx="24" cy="40" rx="14" ry="15" fill="#f7b21b" ${O}/><ellipse cx="40" cy="34" rx="14" ry="15" fill="#ffd84d" ${O}/><rect x="37" y="26" width="6" height="16" rx="2" fill="#e79a0c"/>`),
  // signature items
  swap: svg(`<path d="M16 24a16 16 0 0 1 30-6l4-6 2 18-18-2 6-4a10 10 0 0 0-18 4z" fill="#a84cff" ${O}/><path d="M48 40a16 16 0 0 1-30 6l-4 6-2-18 18 2-6 4a10 10 0 0 0 18-4z" fill="#ff9bf5" ${O}/>`),
  harpoon: svg(`<path d="M8 56L44 20" stroke="#5a5f6e" stroke-width="6" stroke-linecap="round"/><path d="M40 12l14-2-2 14-4-6-6 6-4-4 6-6z" fill="#d8dee6" ${O}/><path d="M8 56c-4-8 6-10 2-18" stroke="#c89a5e" stroke-width="3" fill="none"/>`),
  tongue: svg(`<circle cx="20" cy="30" r="16" fill="#2f6fd6" ${O}/><path d="M30 34c10 0 14 4 24 2 4 0 6 6 0 8-10 2-14-2-24-2z" fill="#e8394f" ${O}/><circle cx="16" cy="24" r="5" fill="#9be22d" ${O}/>`),
  drone: svg(`<rect x="18" y="24" width="28" height="20" rx="6" fill="#2f66c7" ${O}/><circle cx="32" cy="34" r="6" fill="#fff6a8" ${O}/><path d="M10 18h16M38 18h16M18 18v6M46 18v6" stroke="#1a1426" stroke-width="4"/>`),
  flail: svg(`<path d="M10 54c6-10 10-20 16-26" stroke="#8c8f99" stroke-width="4" stroke-dasharray="4 3"/><circle cx="38" cy="24" r="12" fill="#3a3a44" ${O}/><path d="M38 6v8M38 34v8M20 24h8M48 24h8M26 12l5 5M50 12l-5 5M26 36l5-5M50 36l-5-5" stroke="#9a9da8" stroke-width="4"/>`),
  flame: svg(`<path d="M32 6c6 12 18 16 18 32a18 18 0 0 1-36 0c0-8 4-12 8-16 0 6 2 9 5 10-2-10 1-18 5-26z" fill="#ff7a1a" ${O}/><path d="M32 30c3 5 8 7 8 14a8 8 0 0 1-16 0c0-4 4-8 8-14z" fill="#ffe04f"/>`),
  eruption: svg(`<path d="M6 58l18-30h16l18 30z" fill="#3b3036" ${O}/><path d="M24 28c-4-8 2-12 4-20 2 6 6 4 8-2 2 8 4 14 0 22z" fill="#ff7a1a" ${O}/>`),
  wave: svg(`<path d="M4 44c8-20 20-28 32-24 10 4 8 16-2 14 6 10 22 6 26-8v30H4z" fill="#1e9bff" ${O}/><path d="M36 26c4 2 4 6 0 8" stroke="#fff" stroke-width="3" fill="none"/>`),
  boulder: svg(`<path d="M12 44c-6-14 4-30 20-32 16 0 26 12 22 28-2 10-12 16-22 16s-18-4-20-12z" fill="#9a6b3f" ${O}/><path d="M22 26c4-2 8-2 10 2M36 40c4 0 6-2 8-6" stroke="#6b4a2e" stroke-width="3" fill="none"/>`),
  tunnel: svg(`<ellipse cx="32" cy="46" rx="24" ry="10" fill="#6b4a2e" ${O}/><path d="M22 44c0-14 4-26 10-30 6 4 10 16 10 30" fill="#ffc21a" ${O}/><circle cx="32" cy="24" r="4" fill="#fff6a8"/>`),
  tornado: svg(`<path d="M8 12h48c-2 6-8 8-14 10 6 2 8 6 4 10-4 2-8 4-8 8 0 4 2 8-2 14-2-6-6-8-6-12s4-6 2-10c-8-2-16-4-22-10 4-2 10-2 14-4-8 0-14-2-16-6z" fill="#e8f7ff" ${O}/>`),
  vine: svg(`<path d="M8 56c8-12 20-10 24-22s14-18 24-20" stroke="#3fa34d" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M20 44c-6-2-8 2-8 2s4 4 8-2zM36 30c0-6-4-6-4-6s-2 6 4 6z" fill="#7ed957" ${O}/><path d="M50 10l8 4-6 6" stroke="#1a1426" stroke-width="3" fill="none"/>`),
  roots: svg(`<path d="M4 50c10-2 14-14 20-14s8 12 14 12 10-12 22-10v14H4z" fill="#6b4a2e" ${O}/><path d="M16 38l-4-10M30 36l2-12M46 38l6-10" stroke="#1a1426" stroke-width="4" stroke-linecap="round"/>`),
  emp: svg(`<circle cx="32" cy="32" r="22" fill="none" stroke="#3de0ff" stroke-width="5"/><circle cx="32" cy="32" r="13" fill="none" stroke="#3de0ff" stroke-width="3" stroke-dasharray="5 4"/><path d="M34 14L22 34h9l-3 16 14-22h-9z" fill="#ffe04f" ${O}/>`),
  flash: svg(`<circle cx="32" cy="32" r="12" fill="#fff6a0" ${O}/><path d="M32 4v12M32 48v12M4 32h12M48 32h12M12 12l9 9M43 43l9 9M12 52l9-9M43 21l9-9" stroke="#ffc21a" stroke-width="5" stroke-linecap="round"/>`),
  clone: svg(`<path d="M16 50c0-12 4-22 12-22s12 10 12 22z" fill="#2a2240" opacity=".6" ${O}/><circle cx="28" cy="20" r="9" fill="#2a2240" opacity=".6" ${O}/><path d="M28 54c0-12 4-22 12-22s12 10 12 22z" fill="#2a2240" ${O}/><circle cx="40" cy="24" r="9" fill="#2a2240" ${O}/><circle cx="37" cy="23" r="2" fill="#e07bff"/><circle cx="43" cy="23" r="2" fill="#e07bff"/>`),
};

// Cycle list for the roulette animation
export const ROULETTE_CYCLE = ['orb', 'shroom', 'peel', 'seeker', 'star', 'magnet', 'ink', 'horn', 'bolt', 'comet', 'orb3', 'goldShroom'];
