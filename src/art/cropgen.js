// Generated crop art: growth stages (16x20, anchor bottom-centre) and 16x16 produce icons for every
// crop that is not hand-drawn in crops.js. Plants are built from a handful of forms (rosette, bush,
// vine, trellis, grass) out of the same leaf-fan primitive as the weeds; produce is painted with a
// shaded ellipse ("blob") lit from the top-left.
import { grid, set, line, outline, crop, blit } from './raster.js';
import { leafFan, canopy } from './nature.js';
import { sharedStages } from './crops.js';
import { Rng } from '../core/rng.js';

const LEAF_BACK = ['grass1', 'grass2', 'grass3', 'grass4'];
const LEAF_FRONT = ['grass2', 'grass3', 'grass4', 'grass5'];

/** Filled, rotated ellipse shaded across `ramp` (dark -> light) with light from the top-left. */
export function blob(g, cx, cy, rx, ry, ramp, angle = 0) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const r = Math.ceil(Math.max(rx, ry)) + 1;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    const u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry;
    const d = u * u + v * v;
    if (d > 1) continue;
    const lit = -(dx / r) * 0.6 - (dy / r) * 0.8;
    const t = 0.45 + lit * 0.7 - d * 0.25;
    const i = Math.max(0, Math.min(ramp.length - 1, Math.floor(t * ramp.length)));
    set(g, x, y, ramp[i]);
  }
  // Specular dot on the lit shoulder.
  set(g, Math.round(cx - rx * 0.45), Math.round(cy - ry * 0.45), ramp[ramp.length - 1]);
}

// ----------------------------------------------------------------------------- produce

// Each produce: icon(g) paints a 16x16 icon; small(g, x, y) paints it on the plant.
const P = {
  satoimo: {
    icon: (g) => { blob(g, 8, 9, 4.6, 5.2, ['wood1', 'wood2', 'wood3', 'wood4']); for (const y of [6, 9, 12]) line(g, 5, y, 11, y + 1, 'wood1'); leafSprout(g, 8, 4); },
    small: (g, x, y) => blob(g, x, y, 2, 2.2, ['wood1', 'wood2', 'wood3']),
  },
  rice: {
    icon: (g, rng) => { for (let i = 0; i < 6; i++) line(g, 6 + i, 15, 3 + i * 2, 4 + (i % 2), 'straw2'); for (let i = 0; i < 14; i++) set(g, rng.int(2, 13), rng.int(2, 8), rng.chance(0.5) ? 'gold2' : 'gold1'); line(g, 6, 11, 11, 11, 'wood1'); },
    small: () => {},
  },
  edamame: {
    icon: (g) => { [[-0.5, 6, 8], [0.2, 9, 8], [0.8, 10, 10]].forEach(([a, x, y]) => pod(g, x, y, a, LEAF_FRONT)); },
    small: (g, x, y) => pod(g, x, y, 0.3, LEAF_FRONT, 0.55),
  },
  nasu: {
    icon: (g) => { blob(g, 8, 10, 3.8, 5.5, ['sakura0', 'sakura0', 'indigo1', 'indigo2', 'sakura2'], 0.35); leafCap(g, 7, 4); },
    small: (g, x, y) => { blob(g, x, y, 1.6, 2.6, ['sakura0', 'indigo1', 'indigo2'], 0.2); set(g, x, y - 3, 'grass2'); },
  },
  kyuri: {
    icon: (g, rng) => { blob(g, 8, 8, 2.4, 7.2, ['grass1', 'grass2', 'grass3', 'grass4'], 0.7); for (let i = 0; i < 6; i++) set(g, rng.int(5, 11), rng.int(3, 13), 'grass5'); set(g, 12, 2, 'gold2'); },
    small: (g, x, y) => blob(g, x, y, 1, 3, ['grass1', 'grass2', 'grass4']),
  },
  kabocha: {
    icon: (g) => { blob(g, 8, 9.5, 6.4, 5, ['grass0', 'grass1', 'grass2', 'teal1']); for (const x of [5, 8, 11]) line(g, x, 6, x + (x - 8) / 3, 13, 'grass0'); for (const [x, y] of [[6, 8], [10, 11], [9, 7]]) set(g, x, y, 'gold1'); line(g, 8, 3, 9, 5, 'wood2'); },
    small: (g, x, y) => blob(g, x, y, 3.5, 2.8, ['grass0', 'grass1', 'grass2', 'teal1']),
  },
  suika: {
    icon: (g) => { blob(g, 8, 9, 6.6, 6, ['grass1', 'grass3', 'grass4', 'grass5']); for (const x of [4, 7, 10, 13]) for (let y = 4; y < 15; y++) if (((y + x) % 3) !== 0) set(g, x + (y % 2), y, 'grass1'); set(g, 5, 5, 'grass6'); },
    small: (g, x, y) => { blob(g, x, y, 4, 3.2, ['grass1', 'grass3', 'grass4', 'grass5']); for (let k = -3; k <= 3; k += 3) line(g, x + k, y - 2, x + k, y + 2, 'grass1'); },
  },
  shoga: {
    icon: (g) => { [[6, 10, 3], [10, 9, 2.6], [8, 12, 2.4], [11, 12, 2]].forEach(([x, y, r]) => blob(g, x, y, r, r * 0.8, ['straw1', 'straw2', 'straw3', 'straw4'])); set(g, 6, 7, 'sakura2'); set(g, 10, 6, 'sakura2'); },
    small: (g, x, y) => blob(g, x, y, 2.2, 1.6, ['straw1', 'straw2', 'straw3']),
  },
  shiso: {
    icon: (g, rng) => leafFan(g, rng, { bx: 8, by: 15, n: 2, lenMin: 12, lenMax: 13, spread: 0.6, wMin: 7, wMax: 8, back: ['sakura0', 'sakura1', 'grass3', 'grass4'], front: ['grass1', 'grass2', 'grass3', 'grass4'], tipFront: 'grass5' }),
    small: () => {},
  },
  satsumaimo: {
    icon: (g) => { blob(g, 8, 9, 3.4, 6.8, ['sakura0', 'red1', 'red2', 'sakura2'], 1.0); set(g, 3, 13, 'wood1'); set(g, 13, 4, 'wood1'); },
    small: (g, x, y) => blob(g, x, y, 1.6, 3, ['sakura0', 'red1', 'red2'], 1.2),
  },
  soba: {
    icon: (g, rng) => { for (let i = 0; i < 5; i++) line(g, 8, 15, Math.round(3 + i * 2.5), 5, i % 2 ? 'sakura1' : 'grass3'); for (let i = 0; i < 16; i++) set(g, rng.int(2, 13), rng.int(1, 6), rng.chance(0.3) ? 'sakura3' : 'ink6'); line(g, 6, 12, 10, 12, 'straw1'); },
    small: () => {},
  },
  daizu: {
    icon: (g) => { [[5, 11], [8, 10], [11, 11], [6.5, 13], [9.5, 13], [8, 7.5], [11, 8]].forEach(([x, y]) => blob(g, x, y, 1.9, 1.7, ['straw1', 'straw2', 'straw3', 'straw4'])); },
    small: (g, x, y) => pod(g, x, y, 0.2, ['straw1', 'straw2', 'straw3', 'straw4'], 0.55),
  },
  azuki: {
    icon: (g) => { [[5, 11], [8, 10], [11, 11], [6.5, 13], [9.5, 13], [8, 7.5], [11, 8], [5, 8]].forEach(([x, y]) => { blob(g, x, y, 1.6, 1.4, ['red0', 'red1', 'red2', 'red3']); set(g, Math.round(x), Math.round(y), 'ink6'); }); },
    small: (g, x, y) => pod(g, x, y, 0.2, ['wood1', 'wood2', 'red1', 'red2'], 0.55),
  },
  kabu: {
    icon: (g, rng) => { leafFan(g, rng, { bx: 8, by: 7, n: 3, lenMin: 6, lenMax: 7, spread: 1.4, back: LEAF_BACK, front: LEAF_FRONT }); blob(g, 8, 10.5, 5, 4.3, ['ink4', 'ink5', 'ink6', 'ink6']); line(g, 4, 8, 12, 8, 'sakura2'); set(g, 8, 15, 'ink4'); },
    small: (g, x, y) => { blob(g, x, y, 2.6, 2.1, ['ink5', 'ink6', 'ink6']); line(g, x - 2, y - 2, x + 2, y - 2, 'sakura2'); },
  },
  gobo: {
    icon: (g) => { blob(g, 8, 8, 1.7, 7.6, ['wood1', 'wood2', 'wood3', 'wood4'], 0.8); leafSprout(g, 13, 2); },
    small: (g, x, y) => blob(g, x, y, 1.2, 2, ['wood1', 'wood2', 'wood3']),
  },
  hakusai: {
    icon: (g) => { blob(g, 8, 8.5, 5, 6.8, ['grass3', 'grass4', 'grass5', 'grass6']); blob(g, 8, 10, 3, 5, ['grass6', 'ink5', 'ink6', 'ink6']); line(g, 8, 5, 8, 14, 'ink5'); },
    small: () => {},
  },
  negi: {
    icon: (g, rng) => { blob(g, 7, 10.5, 1.8, 5, ['ink4', 'ink5', 'ink6', 'ink6'], 0.45); leafFan(g, rng, { bx: 10, by: 6, n: 3, lenMin: 6, lenMax: 7, spread: 0.8, center: 0.45, wMin: 1.8, wMax: 2.4, back: LEAF_BACK, front: LEAF_FRONT }); },
    small: () => {},
  },
  shungiku: {
    icon: (g, rng) => { leafFan(g, rng, { bx: 8, by: 15, n: 6, lenMin: 9, lenMax: 12, spread: 2, wMin: 3.2, wMax: 3.8, back: LEAF_BACK, front: LEAF_FRONT }); blob(g, 11, 4, 1.8, 1.8, ['gold1', 'gold2', 'gold3']); },
    small: () => {},
  },
};

/** Paint produce on its own layer, outline it, and lay it over the plant so it reads. */
function onPlant(g, id, spots) {
  const layer = grid(g.w, g.h);
  for (const [x, y] of spots) P[id].small(layer, x, y);
  blit(g, outline(layer, { color: 'grass0', pad: 0 }), 0, 0);
}

function pod(g, x, y, angle, ramp, scale = 1) {
  blob(g, x, y, 1.6 * scale + 0.4, 4.2 * scale, ramp, angle);
}
function leafCap(g, x, y) {
  line(g, x - 2, y + 1, x + 3, y + 1, 'grass2');
  line(g, x - 1, y, x + 2, y, 'grass3');
  set(g, x, y - 1, 'grass1');
  set(g, x + 1, y - 2, 'grass1');
}
function leafSprout(g, x, y) {
  line(g, x, y, x - 2, y - 2, 'grass3');
  line(g, x, y, x + 2, y - 2, 'grass4');
}

// ----------------------------------------------------------------------------- plant forms

// crop id -> [form, options]
const FORMS = {
  satoimo: ['rosette', { lenMax: 12, w: 6.5, n: 4 }], kabu: ['rosette', { lenMax: 9, n: 6, root: true }],
  gobo: ['rosette', { lenMax: 11, w: 5, n: 5 }], hakusai: ['rosette', { lenMax: 9, n: 7, spread: 1.4, pale: true }],
  shungiku: ['rosette', { lenMax: 10, n: 8, w: 3.2 }], shiso: ['bush', { tones: 'shiso' }],
  nasu: ['bush', {}], edamame: ['bush', {}], daizu: ['bush', { dry: true }], azuki: ['bush', {}],
  kabocha: ['vine', {}], suika: ['vine', {}], satsumaimo: ['vine', { root: true }],
  kyuri: ['trellis', {}],
  rice: ['grass', { heads: 'gold' }], soba: ['grass', { heads: 'flower' }], negi: ['grass', { tubes: true }],
  shoga: ['grass', { root: true }],
};

function rosette(g, rng, s, o, ripe) {
  leafFan(g, rng, {
    bx: 8, by: 18.5 - (ripe && o.root ? 3 : 0), n: o.n || 6, lenMin: (o.lenMax || 10) * 0.6 * s, lenMax: (o.lenMax || 10) * s,
    spread: o.spread || 2.4, wMin: (o.w || 4) * 0.8, wMax: o.w || 4.4,
    back: o.pale ? ['grass2', 'grass3', 'grass4', 'grass5'] : LEAF_BACK,
    front: o.pale ? ['grass3', 'grass5', 'grass6', 'ink6'] : LEAF_FRONT,
  });
}

function bush(g, rng, s, o, stage, id) {
  const h = Math.round(6 + 10 * s);
  line(g, 8, 19, 8, 19 - h, o.dry && stage === 4 ? 'straw2' : 'grass2');
  const shiso = o.tones === 'shiso';
  const back = shiso ? ['sakura0', 'sakura1', 'grass2', 'grass3'] : LEAF_BACK;
  const front = shiso ? ['grass1', 'grass2', 'grass3', 'grass4'] : LEAF_FRONT;
  for (let k = 0; k < 3; k++) {
    const y = 19 - h + 2 + k * (h / 3);
    leafFan(g, rng, { bx: 8, by: y, n: 3, lenMin: 4 * s + 2, lenMax: 6 * s + 2, spread: 2.6, wMin: 2.6, wMax: 3.4, back, front });
  }
  if (stage === 3 && !shiso) for (let k = 0; k < 3; k++) set(g, rng.int(4, 12), rng.int(20 - h, 16), 'ink6');
  if (stage === 4) onPlant(g, id, [[5, 12], [11, 10], [7, 16], [11, 15]]);
}

function vine(g, rng, s, o, stage, id) {
  const leaves = canopy(Math.round(10 + 6 * s), Math.round(5 + 4 * s), ['grass1', 'grass2', 'grass3', 'grass4', 'grass5'], rng.int(1, 999), { count: 6, rMin: 2, rMax: 3.2 });
  blit(g, crop(leaves, 0, 0, Math.min(16, leaves.w), leaves.h), Math.round(8 - Math.min(16, leaves.w) / 2), 19 - leaves.h);
  if (stage === 3) set(g, 6, 20 - leaves.h, 'gold2');
  if (stage === 4) {
    onPlant(g, id, o.root ? [[5, 18], [11, 19]] : [[8, 17]]);
  }
}

function trellis(g, rng, s, stage, id) {
  line(g, 11, 19, 11, 19 - Math.round(8 + 10 * s), 'straw2');
  line(g, 5, 19, 5, 19 - Math.round(6 + 10 * s), 'straw1');
  for (let k = 0; k < Math.round(2 + 3 * s); k++) {
    leafFan(g, rng, { bx: rng.int(5, 11), by: 19 - k * 3.5, n: 2, lenMin: 3, lenMax: 5, spread: 2.8, wMin: 3, wMax: 3.6, back: LEAF_BACK, front: LEAF_FRONT });
  }
  if (stage === 3) { set(g, 7, 8, 'gold2'); set(g, 10, 12, 'gold2'); }
  if (stage === 4) onPlant(g, id, [[7, 10], [10, 14]]);
}

function grassForm(g, rng, s, o, stage, id) {
  const n = o.tubes ? 6 : 11;
  const ripeRice = stage === 4 && o.heads === 'gold';
  for (let i = 0; i < n; i++) {
    const x0 = Math.round(8 + rng.float(-3.5, 3.5)), len = (8 + rng.float(0, 8)) * s + 3;
    const lean = rng.float(-0.45, 0.45);
    const x1 = Math.round(x0 + lean * len * 0.6), y1 = Math.round(21 - len);
    const lit = ripeRice ? 'straw3' : o.tubes ? 'grass5' : i % 2 ? 'grass4' : 'grass5';
    const dark = ripeRice ? 'straw1' : 'grass2';
    line(g, x0 + 1, 21, x1 + 1, y1 + 1, dark);
    line(g, x0, 21, x1, y1, lit);
    if (o.tubes) line(g, x0 - 1, 21, x1 - 1, y1 + 2, 'grass3');
    if (stage >= 3 && o.heads === 'gold') for (let k = 0; k < 4; k++) set(g, x1 + (lean > 0 ? k >> 1 : -(k >> 1)), y1 + k, ripeRice ? (k % 2 ? 'gold1' : 'gold2') : 'grass6');
    if (stage >= 3 && o.heads === 'flower') { set(g, x1, y1, 'ink6'); set(g, x1 + 1, y1, stage === 4 ? 'ink5' : 'sakura3'); set(g, x1, y1 - 1, 'ink6'); }
  }
  if (stage === 4 && o.tubes) for (let x = 5; x <= 11; x++) { set(g, x, 19, 'ink6'); set(g, x, 20, 'ink5'); }
  if (stage === 4 && o.root) onPlant(g, id, [[8, 20]]);
}

/** Five growth-stage grids (16x20) for a generated crop. */
export function genCropStages(id) {
  const [seeds, sprout] = sharedStages();
  const [form, o] = FORMS[id];
  const out = [seeds, sprout];
  for (const stage of [2, 3, 4]) {
    const rng = new Rng(id.length * 97 + id.charCodeAt(0) * 13);
    const s = stage === 2 ? 0.45 : stage === 3 ? 0.8 : 1;
    const g = grid(16, 22);
    if (form === 'rosette') {
      rosette(g, rng, s, o, stage === 4);
      if (stage === 4 && P[id].small) P[id].small(g, 8, 18);
      if (stage === 4 && id === 'hakusai') blob(g, 8, 15, 3, 4, ['grass6', 'ink5', 'ink6']);
    } else if (form === 'bush') bush(g, rng, s, o, stage, id);
    else if (form === 'vine') vine(g, rng, s, o, stage, id);
    else if (form === 'trellis') trellis(g, rng, s, stage, id);
    else grassForm(g, rng, s, o, stage, id);
    // Outline (grasses stay open and airy), then trim back to the 16x20 frame.
    out.push(form === 'grass' ? crop(g, 0, 2, 16, 20) : crop(outline(g, { color: 'grass0' }), 1, 3, 16, 20));
  }
  return out;
}

/** Withered crop: a slumped brown plant (any tool clears it). */
export function witheredStage() {
  const g = grid(16, 22);
  const rng = new Rng(404);
  leafFan(g, rng, { bx: 8, by: 20, n: 5, lenMin: 5, lenMax: 8, spread: 2.9, wMin: 2.6, wMax: 3.4, back: ['wood0', 'wood1', 'wood2', 'wood2'], front: ['wood1', 'wood2', 'straw1', 'straw2'], tipBack: 'wood2', tipFront: 'straw2' });
  return crop(outline(g, { color: 'wood0' }), 1, 3, 16, 20);
}

export const GENERATED_CROPS = Object.keys(FORMS);

/** 16x16 produce icon. */
export function produceIcon(id) {
  const g = grid(16, 16);
  P[id].icon(g, new Rng(id.length * 31 + 7));
  const o = outline(g, { color: null });
  return crop(o, 1, 1, 16, 16);
}
