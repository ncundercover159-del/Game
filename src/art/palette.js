// The master palette. Every colour drawn in the game comes from here (see STYLE_GUIDE.md).
// Ramps run dark -> light; shadows drift to indigo/violet, highlights to warm yellow/peach.
// 63 colours in use, 1 slot spare (budget is 64).

export const RAMPS = {
  ink:    ['#140f1c', '#241c30', '#3a3048', '#5a4f68', '#847a90', '#bdb4c4', '#f6efe6'],
  grass:  ['#0a2b33', '#0d4a33', '#146b2c', '#268419', '#3b9c10', '#68c21d', '#b3df5c'],
  teal:   ['#1b4b4a', '#2f7a68'],
  water:  ['#0f1b4d', '#16378f', '#1f5fc4', '#3b8fe0', '#86cbf2'],
  wood:   ['#2b130d', '#4c2718', '#6e3f24', '#91592f', '#b3773f', '#d49c5c', '#efcd8f'],
  stone:  ['#2f2b33', '#4f4952', '#766e6e', '#9f968a', '#c9bfa9'],
  straw:  ['#4a3512', '#7d6122', '#b08f3c', '#d9bf6b', '#f4e3a4'],
  red:    ['#4e1020', '#8b1a2b', '#c72e2a', '#ea5a37', '#f89c5c'],
  gold:   ['#a05e10', '#dc9a1c', '#f8d04a', '#fff1a3'],
  sakura: ['#5b1f6b', '#a24aa6', '#de7cbe', '#f6b4d0', '#fde2ea'],
  indigo: ['#231a4d', '#3e3787', '#6b66c7', '#a6a6ec'],
  skin:   ['#3d2219', '#62372a', '#8e5536', '#b97851', '#dc9a6c', '#f0bd91', '#fbdcbd'],
};

// Flat lookup: 'grass3' -> '#288a1c'. Also indexable by number for indexed pixel grids.
export const COLORS = {};
export const INDEX = {};      // name -> palette index (1-based; 0 = transparent)
export const LIST = [null];   // index -> hex
export const RGBA = [0];      // index -> packed ABGR uint32 for ImageData writes

for (const [ramp, hexes] of Object.entries(RAMPS)) {
  hexes.forEach((hex, i) => {
    const name = ramp + i;
    COLORS[name] = hex;
    INDEX[name] = LIST.length;
    LIST.push(hex);
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    RGBA.push(((255 << 24) | (b << 16) | (g << 8) | r) >>> 0);
  });
}

export const PALETTE_SIZE = LIST.length - 1;

/** Palette index for a colour name; throws on unknown names so typos surface at boot. */
export function idx(name) {
  const i = INDEX[name];
  if (i === undefined) throw new Error(`Unknown palette colour "${name}"`);
  return i;
}

export function hex(name) {
  const h = COLORS[name];
  if (!h) throw new Error(`Unknown palette colour "${name}"`);
  return h;
}

/** CSS rgba() string for a palette colour with alpha (used for shadows and light overlays). */
export function rgba(name, a) {
  const h = hex(name);
  return `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;
}

/** Colour one step darker/lighter on the same ramp (clamped). */
export function shift(name, steps) {
  const m = /^([a-z]+)(\d+)$/.exec(name);
  const ramp = RAMPS[m[1]];
  const i = Math.max(0, Math.min(ramp.length - 1, Number(m[2]) + steps));
  return m[1] + i;
}
