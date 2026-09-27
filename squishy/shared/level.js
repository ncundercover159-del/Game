// Level layout shared by the server simulation and the client (for rendering and
// for client-side prediction). World units are metres; +z runs from the forest
// entrance (south) to the shrine (north). The camera sits south of the player
// looking north, so screen-up on the joystick is +z.

export const ZONES = [
  { id: 'forest',    z0: -4,  z1: 42,  hw: 9,  jp: '森の入口', en: 'Forest Entrance' },
  { id: 'bamboo',    z0: 42,  z1: 84,  hw: 8,  jp: '竹林',     en: 'Bamboo Grove' },
  { id: 'pond',      z0: 84,  z1: 124, hw: 11, jp: '鯉の池',   en: 'Koi Pond' },
  { id: 'approach',  z0: 124, z1: 164, hw: 10, jp: '参道',     en: 'Shrine Approach' },
  { id: 'courtyard', z0: 164, z1: 208, hw: 14, jp: '境内',     en: 'Shrine Courtyard' },
];

export function zoneIndexAt(z) {
  for (let i = ZONES.length - 1; i >= 0; i--) if (z >= ZONES[i].z0) return i;
  return 0;
}

export function halfWidthAt(z) {
  return ZONES[zoneIndexAt(z)].hw;
}

export const TERRACE = { z0: 138, z1: 208, h: 2.2 };
export const SPAWNS = [{ x: -1.3, z: 3 }, { x: 1.3, z: 3 }];

export const POND = { x0: -12, x1: 12, z0: 92, z1: 112, water: -0.35, floor: -1.7 };
export const POND_RESPAWN = { near: 89.6, far: 114.4, split: 102 };

// Floor switches. `y` is the surface height they sit on.
export const PLATES = {
  f1:     { x: -5.5, z: 26,    r: 1.1, y: 0 },
  f2:     { x: 5.5,  z: 26,    r: 1.1, y: 0 },
  timer:  { x: 3.6,  z: 52.5,  r: 1.1, y: 0 },
  pondFar:{ x: 3.2,  z: 116.5, r: 1.1, y: 0 },
  stairs: { x: 4.5,  z: 141.5, r: 1.1, y: TERRACE.h },
  c1:     { x: -9,   z: 172,   r: 1.2, y: TERRACE.h },
  c2:     { x: 9,    z: 172,   r: 1.2, y: TERRACE.h },
};

// Both squishies inside this ring raise the stepping stones.
export const CIRCLE = { x: 0, z: 87.6, r: 2.5 };

// Gates are a door (dynamic, `dw` half-width) set in a fence spanning the path.
export const GATES = {
  forest: { z: 34,  y: 0,         dw: 2.4, kind: 'wood' },
  timer:  { z: 64,  y: 0,         dw: 2.0, kind: 'bamboo' },
  tg1:    { z: 80,  y: 0,         dw: 2.2, kind: 'stone', trivia: 0 },
  tg2:    { z: 151, y: TERRACE.h, dw: 3.0, kind: 'torii', trivia: 1 },
  tg3:    { z: 182, y: TERRACE.h, dw: 3.0, kind: 'rope',  trivia: 2 },
};
export const GATE_IDS = ['forest', 'timer', 'tg1', 'tg2', 'tg3'];
export const TRIVIA_GATES = ['tg1', 'tg2', 'tg3'];
export const GATE_DEPTH = 0.5;

// A wall of bamboo with a single opening blocked by a fallen stalk at knee
// height: only a flattened squishy fits underneath.
export const SQUEEZE = { z0: 57.4, z1: 58.8, x0: -1.3, x1: 1.3, clear: 0.42 };

// Stepping stones across the pond (tops sit flush with the shore when raised).
export const STONES = [
  { x: 0,    z: 93.6 },
  { x: 1.5,  z: 96.4 },
  { x: -0.4, z: 99.2 },
  { x: 1.0,  z: 102.0 },
  { x: -1.0, z: 104.8 },
  { x: 0.5,  z: 107.6 },
  { x: -0.2, z: 110.4 },
].map((s) => ({ ...s, r: 1.15 }));
export const STONE_DOWN = -1.4;
export const STONE_UP = 0.0;

// Stone steps that rise against the terrace wall once opened from above.
export const STAIRS = { x0: -2.2, x1: 2.2, z0: 132, z1: TERRACE.z0, n: 6 };

export const BELL = { x: 0, z: 191.2, y: TERRACE.h, r: 3.4 };
export const SHRINE = { x0: -6, x1: 6, z0: 194, z1: 204 };
export const TORII = { z: 150, halfSpan: 3.3 };

// ---- deterministic decoration placement -------------------------------------

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tree trunks inside the forest path (things to weave between).
export const FOREST_TRUNKS = [
  { x: -3.2, z: 10, r: 0.38, kind: 'maple' },
  { x: 4.6,  z: 14, r: 0.42, kind: 'pine' },
  { x: -6.4, z: 18, r: 0.4,  kind: 'pine' },
  { x: 2.0,  z: 20, r: 0.36, kind: 'maple' },
  { x: 7.0,  z: 6,  r: 0.4,  kind: 'maple' },
  { x: -7.0, z: 31, r: 0.38, kind: 'maple' },
  { x: 7.2,  z: 30, r: 0.4,  kind: 'pine' },
  { x: -1.4, z: 38.5, r: 0.36, kind: 'maple' },
];

// A few bamboo stalks inside the grove path to slalom through.
export const GROVE_STALKS = (() => {
  const rnd = mulberry32(7);
  const out = [];
  const clusters = [[-4, 46], [4.5, 48], [-1.5, 50.5], [-5.5, 54], [5, 61], [-3.5, 62], [4, 68], [-5, 70], [2.5, 73], [-2, 75.5]];
  for (const [cx, cz] of clusters) {
    const n = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) out.push({ x: cx + (rnd() - 0.5) * 1.1, z: cz + (rnd() - 0.5) * 1.1, r: 0.09 + rnd() * 0.05 });
  }
  return out;
})();

export const LANTERNS_POND = [
  { x: -4.5, z: 86 }, { x: 4.5, z: 86 }, { x: -4.5, z: 90.4 }, { x: 5.8, z: 90.4 },
  { x: -4.5, z: 114 }, { x: -3.8, z: 120 }, { x: 4.4, z: 120 },
];
export const LANTERNS_APPROACH = [
  { x: -4.2, z: 127 }, { x: 4.2, z: 127 }, { x: -4.4, z: 145 }, { x: 4.4, z: 145 },
];
export const KOMAINU = [{ x: -3.9, z: 148.4 }, { x: 3.9, z: 148.4 }];
// Poles carrying the strings of paper lanterns along the courtyard path.
export const POLES = [165, 176, 187].flatMap((z) => [{ x: -5.5, z }, { x: 5.5, z }]);

export const LANTERNS_COURT = [
  { x: -6.5, z: 168 }, { x: 6.5, z: 168 }, { x: -11, z: 186 }, { x: 11, z: 186 },
];

// Catchable fireflies in the courtyard. Some drift high enough that one
// squishy has to bounce off the other to reach them.
export const FIREFLIES = (() => {
  const rnd = mulberry32(1234);
  const out = [];
  for (let i = 0; i < 14; i++) {
    const high = i % 5 === 4;
    out.push({
      x: (rnd() - 0.5) * 22,
      z: 166 + rnd() * 26,
      y: TERRACE.h + (high ? 2.6 : 0.5 + rnd() * 0.6),
      ph: rnd() * Math.PI * 2,
      sp: 0.25 + rnd() * 0.3,
    });
  }
  return out;
})();

export function fireflyPos(i, tSec, out = { x: 0, y: 0, z: 0 }) {
  const f = FIREFLIES[i];
  const a = tSec * f.sp + f.ph;
  out.x = f.x + Math.sin(a) * 0.9 + Math.sin(a * 2.3) * 0.25;
  out.z = f.z + Math.cos(a * 0.8) * 0.9;
  out.y = f.y + Math.sin(a * 1.7) * 0.25;
  return out;
}
