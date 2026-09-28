// Trees, weeds, stones, twigs, stumps, bamboo and ground decals: procedural or hand-drawn grids.
import { grid, set, parse, line, ellipse, outline, blit } from './raster.js';
import { idx } from './palette.js';
import { Rng, hashf } from '../core/rng.js';

/**
 * Leafy canopy made of overlapping clusters, lit from the top-left. `tones` runs dark -> light.
 * Lower clusters sit in front; where a front cluster overlaps a back one, the back one gets a dark
 * seam so every clump reads as its own ball of leaves (as in the reference foliage).
 */
export function canopy(w, h, tones, seed, { count = 14, rMin = 5, rMax = 8 } = {}) {
  const rng = new Rng(seed);
  const cl = [];
  for (let i = 0; i < count; i++) {
    const a = rng.float(0, Math.PI * 2), d = Math.sqrt(rng.next());
    const r = rng.float(rMin, rMax);
    cl.push({
      x: w / 2 + Math.cos(a) * d * (w / 2 - r - 1),
      y: h / 2 + Math.sin(a) * d * (h / 2 - r - 1),
      r,
    });
  }
  // A crown cluster and a wide base keep the silhouette dome-shaped.
  cl.push({ x: w / 2, y: rMax + 1, r: rMax }, { x: w / 2 - w / 4, y: h - rMax - 2, r: rMax }, { x: w / 2 + w / 4, y: h - rMax - 2, r: rMax });
  cl.sort((a, b) => a.y - b.y);
  const owner = new Int16Array(w * h).fill(-1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    for (let k = cl.length - 1; k >= 0; k--) {
      const c = cl[k];
      const ang = Math.atan2(y + 0.5 - c.y, x + 0.5 - c.x);
      const bump = 1 + 0.12 * Math.sin(ang * 5 + k) + (hashf(x, y, seed, 3) - 0.5) * 0.12;
      if ((x + 0.5 - c.x) ** 2 + (y + 0.5 - c.y) ** 2 <= (c.r * bump) ** 2) { owner[y * w + x] = k; break; }
    }
  }
  const g = grid(w, h);
  const n = tones.length;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = owner[y * w + x];
    if (k < 0) continue;
    const c = cl[k];
    const nx = (x + 0.5 - c.x) / c.r, ny = (y + 0.5 - c.y) / c.r;
    const local = -(nx * 0.55 + ny * 0.85);
    const global = -((x / w - 0.5) * 0.5 + (y / h - 0.4) * 0.9);
    let t = 0.55 + local * 0.3 + global * 0.45 + (hashf(x, y, seed, 9) - 0.5) * 0.2;
    // Seam: a back cluster's pixel sitting just above a front cluster gets a (broken) dark line.
    const below = y + 1 < h ? owner[(y + 1) * w + x] : -1;
    if (below > k && hashf(x, y, seed, 12) > 0.25) t = Math.min(t, 0.05);
    const step = Math.max(0, Math.min(n - 1, Math.floor(t * (n - 1) + 0.5)));
    g.px[y * w + x] = idx(tones[step]);
  }
  return outline(g, { color: tones[0] });
}

/** Trunk with root flare and vertical bark, lit from the left. */
export function trunk(w, h, seed, tones = ['wood0', 'wood1', 'wood2', 'wood3']) {
  const g = grid(w + 6, h);
  const cx = (w + 6) / 2;
  for (let y = 0; y < h; y++) {
    const flare = y > h - 5 ? (y - (h - 5)) * 0.8 : 0;
    const half = w / 2 + flare;
    for (let x = Math.floor(cx - half); x < Math.ceil(cx + half); x++) {
      const u = (x + 0.5 - (cx - half)) / (half * 2);
      let s = u < 0.25 ? 3 : u < 0.6 ? 2 : 1;
      if (hashf(x, y >> 1, seed, 4) > 0.8) s = Math.max(1, s - 1);
      set(g, x, y, tones[s]);
    }
  }
  return outline(g, { color: tones[0] });
}

const PAL = {
  broadleaf: ['grass0', 'grass1', 'grass2', 'grass3', 'grass4', 'grass5'],
  pine: ['grass0', 'teal0', 'grass1', 'teal1', 'grass3'],
  sakura: ['sakura0', 'sakura1', 'sakura2', 'sakura3', 'sakura4'],
};

/** Japanese cedar (sugi): stacked drooping tiers. */
function pineCanopy(seed) {
  const w = 34, h = 50;
  const g = grid(w, h);
  const tones = PAL.pine;
  const tiers = 6;
  for (let i = 0; i < tiers; i++) {
    const ty = 4 + i * 7.2;
    const half = 5 + i * 2.4;
    for (let y = 0; y < 11; y++) {
      const yy = Math.round(ty + y);
      const spread = half * Math.min(1, (y + 2) / 9);
      for (let x = Math.floor(w / 2 - spread); x < Math.ceil(w / 2 + spread); x++) {
        const edge = Math.abs(x + 0.5 - w / 2) / spread;
        if (y > 7 && edge < 0.9 - (y - 7) * 0.1 + hashf(x, i, seed, 1) * 0.3) continue;
        const lit = (x + 0.5 < w / 2 ? 1 : 0) + (y < 4 ? 1 : 0);
        let s = 1 + lit + (hashf(x, yy, seed, 2) > 0.7 ? 1 : 0);
        if (y >= 8) s = 0;
        set(g, x, yy, tones[Math.min(tones.length - 1, s)]);
      }
    }
  }
  return outline(g, { color: 'grass0' });
}

export function treeParts(kind, seed) {
  if (kind === 'pine') return { canopy: pineCanopy(seed), trunk: trunk(6, 14, seed), canopyY: -58, trunkH: 14 };
  return {
    canopy: canopy(44, 38, PAL[kind], seed, { count: kind === 'sakura' ? 16 : 14 }),
    trunk: trunk(kind === 'sakura' ? 7 : 8, 20, seed, kind === 'sakura' ? ['wood0', 'wood1', 'wood2', 'wood2'] : undefined),
    canopyY: -52,
    trunkH: 20,
  };
}

// ---------------------------------------------------------------- small props (hand-drawn)

const STONE_L = { o: 'stone0', d: 'stone1', m: 'stone2', l: 'stone3', h: 'stone4', g: 'grass2' };
export const STONES = [
  parse(`
    ....oooo....
    ..ooolhhoo..
    .olllhhhmmo.
    .ollhhmmmmdo
    olllmmmmmmdo
    olmmmmmmmddo
    .ommmmmmddo.
    ..ddddddddo.
    ...oooooo...`, STONE_L),
  parse(`
    ...ooo.......
    ..olhhoooo...
    .ollhhlllmo..
    .olllmmmmmdo.
    ..ommmmmdddo.
    ..ooddddddo..
    ....oooooo...`, STONE_L),
  parse(`
    .....oooo..
    ..oooohhmo.
    .ollhhhmmdo
    ollhmmmmmdo
    olmmmmmmddo
    .oddddddddo
    ..oooooooo.`, STONE_L),
];

const TWIG_L = { o: 'wood0', d: 'wood1', m: 'wood2', l: 'wood3', g: 'grass4' };
export const TWIGS = [
  parse(`
    oo...........
    oldo.........
    .omldo....oo.
    ..odmldoooldo
    ...oomlmmmmo.
    ..oldddoooo..
    .olmoo.......
    .ooo.........`, TWIG_L),
  parse(`
    ........oo..
    .......oldo.
    ..oo..olmo..
    .oldoolmo...
    ..omlmmo....
    ...odmdoo...
    ..oldo.oldo.
    ..ooo...oo..`, TWIG_L),
];

export const STUMP = parse(`
  ....oooooooo....
  ..oollllllllloo.
  .olhhhllllllllo.
  .ollhlmmmmmllld.
  .olllmllllmllld.
  .odllmlmmlmlldo.
  .oddlllmmllldoo.
  .oommddddddmmdo.
  .ommmmmdmmmmmdo.
  .olmmmmdmmmmddo.
  .olmmmmdmmmdddo.
  oolmmmdmmmmmddoo
  olmmmmdmmmmmmddo
  ooooooooooooooo.`, { o: 'wood0', d: 'wood1', m: 'wood2', l: 'wood4', h: 'wood5' });

/**
 * A clump of wild grass (zassō): pointed leaves fanning from the root, each lit on its left half
 * with a bright midrib; back leaves darker. Outlined so it reads against the turf.
 */
export function weed(seed, flowers = false) {
  const g = grid(18, 18);
  const rng = new Rng(seed);
  const n = rng.int(6, 8);
  const leaves = [];
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n - 0.5) * 2.5 + rng.float(-0.2, 0.2);
    leaves.push({ a, len: rng.float(10, 15) * (1 - Math.abs(a) * 0.2), w: rng.float(3.4, 4.6), z: rng.next() });
  }
  leaves.sort((p, q) => p.z - q.z);
  const bx = 9, by = 16.5;
  leaves.forEach((L, i) => {
    const back = i < n / 2;
    const [dark, mid, lit, rib] = back ? ['grass2', 'grass2', 'grass3', 'grass4'] : ['grass2', 'grass3', 'grass4', 'grass5'];
    const ca = Math.cos(L.a), sa = Math.sin(L.a);
    for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) {
      const dx = x + 0.5 - bx, dy = y + 0.5 - by;
      const u = dx * sa - dy * ca;            // along the leaf, from the root
      const v = dx * ca + dy * sa;            // across the leaf
      if (u < 0 || u > L.len) continue;
      const half = (L.w / 2) * Math.pow(Math.sin((Math.PI * u) / L.len), 0.8);
      if (Math.abs(v) > half) continue;
      let c = v < 0 ? lit : mid;
      if (Math.abs(v) < 0.5 && u > 2) c = rib;
      if (Math.abs(v) > half - 0.8) c = dark;
      if (u > L.len - 2) c = back ? 'grass4' : 'grass6';
      set(g, x, y, c);
    }
  });
  if (flowers) for (let i = 0; i < 3; i++) {
    const fx = rng.int(4, 13), fy = rng.int(4, 9);
    set(g, fx, fy, 'sakura3'); set(g, fx + 1, fy, 'sakura2'); set(g, fx, fy - 1, 'sakura4'); set(g, fx - 1, fy, 'sakura2');
  }
  return outline(g, { color: 'grass0' });
}

/** Bamboo clump: three-tone culms with dark nodes, and leaf sprays near the top. */
export function bamboo(seed) {
  const w = 24, h = 46;
  const g = grid(w, h);
  const rng = new Rng(seed);
  const culms = [4, 9, 14, 18].map((x) => ({ x: x + rng.int(-1, 1), top: rng.int(6, 14) }));
  for (const c of culms) {
    for (let y = c.top; y < h; y++) {
      const node = (y - c.top) % 8 === 7;
      set(g, c.x, y, node ? 'teal0' : 'grass5');
      set(g, c.x + 1, y, node ? 'teal0' : 'grass4');
      set(g, c.x + 2, y, node ? 'teal0' : 'teal1');
    }
  }
  for (let k = 0; k < 7; k++) {
    const sx = rng.int(2, w - 6), sy = rng.int(1, 16);
    const leaves = canopy(8, 5, ['teal0', 'grass2', 'grass3', 'grass5'], seed * 31 + k, { count: 3, rMin: 1.6, rMax: 2.4 });
    blit(g, leaves, sx, sy);
  }
  return outline(g, { color: 'grass0' });
}

// ---------------------------------------------------------------- ground decals (drawn into chunks)

export const DECALS = {
  flowerW: parse(`
    .a.
    aya
    .a.
    .g.`, { a: 'ink6', y: 'gold2', g: 'grass2' }),
  flowerP: parse(`
    .a.
    aya
    .a.`, { a: 'sakura3', y: 'gold3' }),
  flowerB: parse(`
    .a..
    aya.
    .a.a
    ..aya
    ...a.`, { a: 'indigo3', y: 'ink6' }),
  tuft: parse(`
    l...l
    dl.ld
    .d.d.`, { l: 'grass5', d: 'grass2' }),
  tuft2: parse(`
    ..l..
    l.d.l
    d.d.d`, { l: 'grass5', d: 'grass2' }),
  pebble: parse(`
    .ll.
    lmmd
    .dd.`, { l: 'stone4', m: 'stone3', d: 'stone1' }),
  petal: parse(`
    ab
    .a`, { a: 'sakura3', b: 'sakura4' }),
};

/** Soft oval drop shadows (single colour; drawn with alpha at runtime). */
export function shadow(w, h) {
  const g = grid(w, h);
  ellipse(g, w / 2, h / 2, w / 2, h / 2, 'ink0');
  return g;
}

