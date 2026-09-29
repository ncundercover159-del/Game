// Procedural 16×16 pixel art. Every tile and character is painted from a small palette
// at start-up, so there are no image assets to license. To swap in a real tileset later,
// replace `tileCanvas()` / `characterFrames()` with image-atlas lookups — the rest of the
// engine only asks for canvases by tile name.

import type { Dir, Look } from '../content/types';

export const T = 16;

type Ctx = CanvasRenderingContext2D;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w = T, h = T): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  return [c, x];
}

const px = (x: Ctx, c: string, X: number, Y: number, w = 1, h = 1) => {
  x.fillStyle = c;
  x.fillRect(X, Y, w, h);
};

const P = {
  grass: '#6fb34f', grassD: '#579a3f', grassL: '#8ccf64',
  path: '#d8c7a0', pathD: '#bfae86',
  walk: '#bdbab4', walkD: '#a19e98', walkL: '#cfccc6',
  road: '#4b4d57', roadD: '#42444d', roadL: '#5a5c66',
  roof: '#b3472f', roofD: '#8c3522', roofL: '#c95c40',
  brick: '#e2bf6c', brickD: '#c49e4f', mortar: '#d4b060',
  glass: '#5f8fb8', glassL: '#a9cbe6', frame: '#f3efe6',
  wood: '#8a5733', woodD: '#6b4125', woodL: '#a86d44',
  leaf: '#3f8a3a', leafD: '#2e6b2c', leafL: '#58a84f', trunk: '#6b4a2e',
  hedge: '#3c7d35', hedgeD: '#2c5f28',
  wall: '#ece5d7', wallD: '#d3c8b3', base: '#9b8e78',
  stone: '#cfc7b9', stoneD: '#bbb2a3', stoneL: '#ddd6ca',
  floor: '#c99760', floorD: '#a97a47', floorL: '#d8a970',
  metal: '#8c939c', metalD: '#666d75',
  red: '#c8102e', yellow: '#ffd400', black: '#1e1e24', white: '#ffffff',
  cardboard: '#c99b5c', cardboardD: '#a77c42', tape: '#e3cf9a',
};

function noise(x: Ctx, seed: number, base: string, dots: [string, number][]) {
  px(x, base, 0, 0, T, T);
  const r = rng(seed);
  for (const [c, n] of dots) for (let i = 0; i < n; i++) px(x, c, Math.floor(r() * T), Math.floor(r() * T));
}

const grass = (x: Ctx, v: number) => {
  noise(x, 11 + v, P.grass, [[P.grassD, 10], [P.grassL, 6]]);
  const r = rng(99 + v);
  for (let i = 0; i < 3; i++) {
    const a = Math.floor(r() * 14) + 1, b = Math.floor(r() * 13) + 2;
    px(x, P.grassD, a, b, 1, 2);
    px(x, P.grassL, a + 1, b - 1);
  }
};
const walkway = (x: Ctx, v: number) => {
  noise(x, 21 + v, P.walk, [[P.walkL, 6], [P.walkD, 4]]);
  px(x, P.walkD, 0, 15, T, 1);
  px(x, P.walkD, 7 + (v % 2) * 8, 8, 1, 8);
  px(x, P.walkD, 0, 7, T, 1);
  px(x, P.walkD, (v % 2) * 8 + 3, 0, 1, 7);
};
const stoneFloor = (x: Ctx, v: number) => {
  noise(x, 31 + v, P.stone, [[P.stoneD, 7], [P.stoneL, 7]]);
  px(x, P.stoneD, 0, 0, T, 1);
  px(x, P.stoneD, 0, 0, 1, T);
};
const woodFloor = (x: Ctx, v: number) => {
  px(x, P.floor, 0, 0, T, T);
  for (let row = 0; row < 4; row++) {
    px(x, P.floorD, 0, row * 4 + 3, T, 1);
    px(x, P.floorL, 0, row * 4, T, 1);
    px(x, P.floorD, ((row * 7 + v * 5) % 14) + 1, row * 4, 1, 3);
  }
};
const brickWall = (x: Ctx, v: number) => {
  px(x, P.mortar, 0, 0, T, T);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 4 : 0;
    for (let col = -1; col < 3; col++) {
      const bx = col * 8 + off;
      px(x, (row + col + v) % 5 === 0 ? P.brickD : P.brick, bx + 1, row * 4 + 1, 7, 3);
    }
  }
};
const window_ = (x: Ctx, X: number, Y: number, w: number, h: number) => {
  px(x, P.frame, X, Y, w, h);
  px(x, P.glass, X + 1, Y + 1, w - 2, h - 2);
  px(x, P.glassL, X + 2, Y + 2, 2, 1);
  px(x, P.glassL, X + 2, Y + 3, 1, 1);
  px(x, P.frame, X + Math.floor(w / 2), Y + 1, 1, h - 2);
};
const intWall = (x: Ctx) => {
  px(x, P.wall, 0, 0, T, T);
  px(x, P.wallD, 0, 11, T, 1);
  px(x, P.base, 0, 13, T, 3);
  px(x, P.wallD, 0, 0, T, 1);
};
const shadowBase = (x: Ctx, X: number, Y: number, w: number) => px(x, 'rgba(0,0,0,0.22)', X, Y, w, 2);

const PAINT: Record<string, (x: Ctx, v: number) => void> = {
  grass,
  path: (x, v) => noise(x, 41 + v, P.path, [[P.pathD, 14], ['#e6d8b5', 8]]),
  flowers: (x, v) => {
    grass(x, v);
    const r = rng(50 + v);
    const cols = ['#f4d35e', '#ee6c6c', '#ffffff', '#c79bf2'];
    for (let i = 0; i < 6; i++) {
      const a = Math.floor(r() * 13) + 1, b = Math.floor(r() * 13) + 1;
      px(x, cols[i % 4], a, b, 2, 2);
      px(x, '#f7ecb5', a, b);
    }
  },
  sidewalk: walkway,
  road: (x, v) => noise(x, 61 + v, P.road, [[P.roadD, 12], [P.roadL, 8]]),
  road_line: (x, v) => {
    noise(x, 71 + v, P.road, [[P.roadD, 12], [P.roadL, 8]]);
    px(x, '#e9e9e0', 2, 7, 8, 2);
  },
  roof: (x, v) => {
    px(x, P.roof, 0, 0, T, T);
    for (let row = 0; row < 4; row++) {
      px(x, P.roofD, 0, row * 4 + 3, T, 1);
      for (let c = 0; c < 4; c++) px(x, P.roofL, c * 4 + (row % 2) * 2 + (v % 2), row * 4, 2, 1);
    }
  },
  brick: brickWall,
  brick_window: (x, v) => {
    brickWall(x, v);
    window_(x, 3, 2, 10, 12);
    px(x, P.brickD, 2, 14, 12, 1);
  },
  door: (x, v) => {
    brickWall(x, v);
    px(x, P.woodD, 3, 1, 10, 15);
    px(x, P.wood, 4, 2, 8, 14);
    px(x, P.woodL, 5, 3, 2, 5);
    px(x, P.woodL, 9, 3, 2, 5);
    px(x, P.woodL, 5, 10, 2, 4);
    px(x, P.woodL, 9, 10, 2, 4);
    px(x, P.yellow, 10, 9, 1, 1);
    px(x, P.glassL, 5, 2, 6, 1);
  },
  bakery_window: (x, v) => {
    brickWall(x, v);
    for (let i = 0; i < 8; i++) px(x, i % 2 ? '#f5efe2' : P.red, i * 2, 0, 2, 4);
    px(x, '#9c1b2c', 0, 4, T, 1);
    window_(x, 1, 5, 14, 10);
    px(x, '#d9a05b', 4, 11, 4, 2);
    px(x, '#c28140', 9, 11, 3, 2);
    px(x, '#e8c07a', 5, 10, 2, 1);
  },
  netto_front: (x, v) => {
    px(x, P.black, 0, 0, T, 5);
    px(x, P.yellow, 0, 1, T, 3);
    if (v % 2 === 0) {
      px(x, P.black, 5, 2, 4, 1);
      px(x, P.black, 6, 1, 1, 3);
    }
    window_(x, 0, 5, T, 11);
  },
  tree: (x, v) => {
    grass(x, v);
    shadowBase(x, 3, 13, 10);
    px(x, P.trunk, 7, 10, 2, 4);
    px(x, P.leafD, 2, 2, 12, 9);
    px(x, P.leafD, 4, 1, 8, 11);
    px(x, P.leaf, 3, 2, 10, 7);
    px(x, P.leaf, 5, 1, 6, 9);
    px(x, P.leafL, 5, 3, 3, 2);
    px(x, P.leafL, 9, 5, 2, 2);
  },
  hedge: (x, v) => {
    noise(x, 81 + v, P.hedge, [[P.hedgeD, 20], [P.leafL, 6]]);
    px(x, P.hedgeD, 0, 13, T, 3);
  },
  bench: (x, v) => {
    grass(x, v);
    shadowBase(x, 1, 12, 14);
    px(x, P.woodD, 1, 4, 14, 2);
    px(x, P.wood, 1, 7, 14, 3);
    px(x, P.woodL, 1, 7, 14, 1);
    px(x, P.metalD, 2, 10, 1, 3);
    px(x, P.metalD, 13, 10, 1, 3);
  },
  bike_rack: (x, v) => {
    walkway(x, v);
    shadowBase(x, 2, 13, 12);
    px(x, P.metal, 3, 5, 1, 8);
    px(x, P.metal, 12, 5, 1, 8);
    px(x, P.metal, 3, 5, 10, 1);
    px(x, P.black, 1, 8, 5, 5);
    px(x, P.walk, 2, 9, 3, 3);
    px(x, P.black, 9, 8, 5, 5);
    px(x, P.walk, 10, 9, 3, 3);
    px(x, '#2d7fc1', 4, 8, 7, 1);
  },
  bus_sign: (x, v) => {
    walkway(x, v);
    px(x, P.metalD, 7, 5, 2, 10);
    px(x, P.yellow, 3, 0, 10, 6);
    px(x, P.black, 3, 0, 10, 1);
    px(x, P.black, 5, 2, 6, 2);
  },
  lamp: (x, v) => {
    walkway(x, v);
    shadowBase(x, 5, 14, 6);
    px(x, P.metalD, 7, 3, 2, 12);
    px(x, P.black, 5, 1, 6, 3);
    px(x, '#fff2b0', 6, 3, 4, 1);
  },
  wall_int: (x) => intWall(x),
  window_int: (x) => {
    intWall(x);
    window_(x, 2, 1, 12, 10);
  },
  floor_stone: stoneFloor,
  floor_wood: woodFloor,
  stairs: (x) => {
    px(x, P.stoneD, 0, 0, T, T);
    for (let i = 0; i < 4; i++) {
      px(x, P.stoneL, 0, i * 4, T, 2);
      px(x, P.stone, 0, i * 4 + 2, T, 1);
      px(x, '#9e968a', 0, i * 4 + 3, T, 1);
    }
    px(x, P.woodD, 0, 0, 1, T);
    px(x, P.woodD, 15, 0, 1, T);
  },
  rug: (x, v) => {
    woodFloor(x, v);
    px(x, '#a8354a', 0, 1, T, 14);
    px(x, '#e7c26b', 0, 3, T, 1);
    px(x, '#e7c26b', 0, 12, T, 1);
    px(x, '#2f4f7a', 2 + (v % 2) * 6, 6, 6, 4);
  },
  door_int: (x) => {
    intWall(x);
    px(x, P.woodD, 2, 0, 12, 16);
    px(x, P.wood, 3, 1, 10, 15);
    px(x, P.woodL, 4, 2, 8, 1);
    px(x, '#f0e0a0', 5, 5, 6, 2);
    px(x, P.metal, 11, 9, 1, 2);
  },
  door_exit: (x) => {
    intWall(x);
    px(x, P.woodD, 2, 0, 12, 16);
    px(x, '#5b7a8c', 3, 1, 10, 15);
    px(x, '#7f9dad', 4, 2, 8, 5);
    px(x, P.metal, 11, 9, 1, 2);
    px(x, '#8a6c4b', 3, 14, 10, 2);
  },
  plant: (x, v) => {
    stoneFloor(x, v);
    shadowBase(x, 4, 13, 8);
    px(x, '#b5653b', 5, 10, 6, 4);
    px(x, P.leafD, 3, 3, 10, 7);
    px(x, P.leaf, 4, 2, 8, 7);
    px(x, P.leafL, 6, 3, 2, 2);
  },
  mailboxes: (x) => {
    intWall(x);
    px(x, P.metalD, 1, 1, 14, 11);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      px(x, P.metal, 2 + c * 4 + (c > 0 ? c - 1 : 0) - (c > 0 ? c - 1 : 0), 2 + r * 3, 3, 2);
      px(x, P.black, 2 + c * 4, 2 + r * 3, 3, 1);
    }
  },
  counter: (x, v) => {
    woodFloor(x, v);
    px(x, '#e9e9ea', 0, 0, T, 12);
    px(x, '#b9bcc2', 0, 4, T, 1);
    px(x, '#d1d3d8', 1, 6, 6, 5);
    px(x, '#d1d3d8', 9, 6, 6, 5);
    px(x, P.metalD, 6, 8, 1, 1);
    px(x, P.metalD, 9, 8, 1, 1);
    px(x, '#9fb8c8', 3, 1, 6, 3);
  },
  fridge: (x, v) => {
    woodFloor(x, v);
    px(x, '#f4f6f8', 2, 0, 12, 15);
    px(x, '#c9ced4', 2, 6, 12, 1);
    px(x, P.metalD, 11, 2, 1, 3);
    px(x, P.metalD, 11, 8, 1, 4);
  },
  bed_head: (x, v) => {
    woodFloor(x, v);
    px(x, P.woodD, 1, 0, 14, 16);
    px(x, '#f4f1ea', 2, 1, 12, 15);
    px(x, '#ffffff', 3, 2, 10, 5);
    px(x, '#6b8fc9', 2, 10, 12, 6);
  },
  bed_foot: (x, v) => {
    woodFloor(x, v);
    px(x, P.woodD, 1, 0, 14, 14);
    px(x, '#6b8fc9', 2, 0, 12, 12);
    px(x, '#5577b0', 2, 5, 12, 1);
    shadowBase(x, 1, 14, 14);
  },
  table: (x, v) => {
    // seamless left-right so neighbouring table tiles form one long table
    woodFloor(x, v);
    px(x, 'rgba(0,0,0,0.22)', 0, 13, T, 2);
    px(x, P.woodD, 0, 3, T, 10);
    px(x, P.woodL, 0, 3, T, 8);
    px(x, P.wood, 0, 4, T, 6);
    if (v % 2 === 0) px(x, '#ffffff', 5, 5, 5, 3);
    else px(x, '#e0664f', 6, 5, 3, 3);
  },
  boxes: (x, v) => {
    woodFloor(x, v);
    shadowBase(x, 1, 14, 14);
    px(x, P.cardboardD, 1, 6, 14, 9);
    px(x, P.cardboard, 1, 6, 14, 7);
    px(x, P.tape, 7, 6, 2, 7);
    px(x, P.cardboardD, 4, 0, 9, 7);
    px(x, P.cardboard, 4, 0, 9, 5);
    px(x, P.tape, 8, 0, 1, 5);
  },
  floor_tile: (x, v) => {
    px(x, '#e9e4d8', 0, 0, T, T);
    px(x, '#d6cfbf', 0, 0, 8, 8);
    px(x, '#d6cfbf', 8, 8, 8, 8);
    if (v === 1) px(x, '#cfc7b6', 3, 3, 1, 1);
  },
  carpet: (x, v) => noise(x, 91 + v, '#6d7f99', [['#61728b', 16], ['#7a8ca6', 10]]),
  cobble: (x, v) => {
    px(x, '#a9a197', 0, 0, T, T);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const off = r % 2 ? 2 : 0;
      px(x, (r + c + v) % 3 ? '#bdb5aa' : '#c7c0b6', c * 4 + off, r * 4, 3, 3);
    }
  },
  rails: (x, v) => {
    PAINT.cobble(x, v);
    px(x, '#6b6258', 0, 3, T, 2);
    px(x, '#6b6258', 0, 11, T, 2);
    px(x, '#d0d4d8', 0, 3, T, 1);
    px(x, '#d0d4d8', 0, 11, T, 1);
    for (let i = 0; i < 4; i++) px(x, '#7a5b3f', i * 4 + 1, 2, 2, 12);
    px(x, '#d0d4d8', 0, 3, T, 1);
    px(x, '#d0d4d8', 0, 11, T, 1);
  },
  water: (x, v) => {
    noise(x, 101 + v, '#3f7fb3', [['#3571a3', 14], ['#5b9bd0', 8]]);
    px(x, '#8cc4ee', (v * 5) % 12, 5, 4, 1);
    px(x, '#8cc4ee', (v * 3 + 6) % 12, 11, 3, 1);
  },
  shelf: (x, v) => {
    PAINT.floor_tile(x, v);
    px(x, '#8a6a4a', 0, 0, T, 14);
    const goods = ['#e74c3c', '#f1c40f', '#27ae60', '#2980b9', '#ecf0f1', '#e67e22'];
    for (let r = 0; r < 3; r++) {
      px(x, '#6b4f36', 0, r * 4 + 4, T, 1);
      for (let c = 0; c < 5; c++) px(x, goods[(r * 5 + c + v) % goods.length], c * 3 + 1, r * 4 + 1, 2, 3);
    }
  },
  cooler: (x, v) => {
    PAINT.floor_tile(x, v);
    px(x, '#dfe6ec', 0, 0, T, 14);
    px(x, '#a9d3f0', 1, 1, 14, 11);
    for (let c = 0; c < 4; c++) px(x, ['#ffffff', '#f4d03f', '#e74c3c', '#ffffff'][(c + v) % 4], c * 4 + 2, 5, 2, 5);
  },
  pastry_counter: (x, v) => {
    PAINT.floor_tile(x, v);
    px(x, '#f3efe6', 0, 2, T, 12);
    px(x, '#bfe0f2', 1, 3, 14, 6);
    const c = ['#d9a05b', '#c28140', '#e8c07a', '#b5652f'];
    for (let i = 0; i < 3; i++) px(x, c[(i + v) % 4], 2 + i * 4, 5, 3, 3);
    px(x, '#8a5733', 0, 10, T, 4);
  },
  register: (x, v) => {
    PAINT.floor_tile(x, v);
    px(x, '#8a5733', 0, 6, T, 8);
    px(x, '#2d2d38', 4, 1, 8, 6);
    px(x, '#7fd67f', 5, 2, 6, 2);
    px(x, '#c9ced4', 3, 7, 10, 2);
  },
  coffee_bar: (x, v) => {
    PAINT.floor_wood(x, v);
    px(x, '#5b3a24', 0, 5, T, 9);
    px(x, '#d9c3a0', 0, 5, T, 2);
    if (v % 2 === 0) {
      px(x, '#b8bcc2', 3, 0, 9, 6);
      px(x, '#2d2d38', 5, 2, 5, 2);
      px(x, '#ffffff', 6, 5, 3, 1);
    } else {
      px(x, '#ffffff', 3, 3, 3, 3);
      px(x, '#ffffff', 9, 3, 3, 3);
    }
  },
  desk: (x, v) => {
    PAINT.carpet(x, v);
    px(x, 'rgba(0,0,0,0.2)', 0, 13, T, 2);
    px(x, '#d8c3a0', 0, 4, T, 9);
    px(x, '#2d2d38', 3, 0, 9, 7);
    px(x, '#6fb7e9', 4, 1, 7, 5);
    px(x, '#2d2d38', 7, 7, 2, 1);
    px(x, '#555', 4, 9, 8, 2);
  },
  bookshelf: (x, v) => {
    PAINT.carpet(x, v);
    px(x, '#6b4a2e', 0, 0, T, 15);
    const c = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#f39c12', '#ecf0f1'];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) px(x, c[(r * 3 + i + v) % 6], 1 + i * 2 + (i > 2 ? 1 : 0), r * 5 + 1, 2, 4);
  },
  bar_counter: (x, v) => {
    PAINT.floor_wood(x, v);
    px(x, '#3b2416', 0, 3, T, 11);
    px(x, '#8a5733', 0, 3, T, 3);
    if (v % 2) { px(x, '#f4d03f', 4, 0, 3, 4); px(x, '#ffffff', 4, 0, 3, 1); }
  },
  bottles: (x) => {
    intWall(x);
    px(x, '#3b2416', 0, 9, T, 2);
    const c = ['#2e8b57', '#8b4513', '#c0c0c0', '#b22222'];
    for (let i = 0; i < 5; i++) px(x, c[i % 4], 1 + i * 3, 3, 2, 6);
  },
  xmas_tree: (x, v) => {
    PAINT.floor_wood(x, v);
    px(x, '#6b4a2e', 7, 12, 2, 3);
    px(x, '#1e6b33', 6, 1, 4, 3);
    px(x, '#1e6b33', 4, 4, 8, 4);
    px(x, '#1e6b33', 2, 8, 12, 4);
    px(x, '#ffd400', 7, 0, 2, 2);
    px(x, '#c8102e', 5, 6, 1, 1); px(x, '#ffffff', 10, 5, 1, 1); px(x, '#c8102e', 9, 10, 1, 1); px(x, '#ffffff', 4, 10, 1, 1);
  },
  cafe_front: (x, v) => {
    brickWall(x, v);
    for (let i = 0; i < 8; i++) px(x, i % 2 ? '#f5efe2' : '#2e7d4f', i * 2, 0, 2, 4);
    window_(x, 1, 5, 14, 10);
    px(x, '#6b4125', 5, 11, 6, 2);
  },
  pharmacy_front: (x, v) => {
    px(x, '#f2f2ee', 0, 0, T, T);
    px(x, '#2e8b57', 0, 0, T, 4);
    if (v % 2 === 0) { px(x, '#ffffff', 7, 0, 2, 4); px(x, '#ffffff', 5, 1, 6, 2); }
    window_(x, 1, 5, 14, 10);
  },
  glass_front: (x, v) => {
    px(x, '#8c939c', 0, 0, T, T);
    px(x, '#6fa4cf', 1, 1, 14, 14);
    px(x, '#a9cbe6', 2 + (v % 3), 2, 3, 1);
    px(x, '#8c939c', 7, 0, 1, T);
  },
  dokk_front: (x, v) => {
    px(x, '#cfd3d6', 0, 0, T, T);
    px(x, '#4b5563', 0, 6, T, 10);
    px(x, '#8fb3cc', 1, 7, 14, 7);
    px(x, '#b8bcc2', (v * 4) % 16, 0, 4, 6);
  },
  bar_front: (x, v) => {
    px(x, '#2b2230', 0, 0, T, T);
    window_(x, 2, 4, 12, 9);
    px(x, '#f4a261', 3, 5, 10, 7);
    px(x, '#e9c46a', 4 + (v % 3), 6, 3, 2);
  },
  white_wall: (x, v) => {
    px(x, '#f3efe6', 0, 0, T, T);
    px(x, '#e3dccd', 0, 15, T, 1);
    if (v === 2) px(x, '#e3dccd', 4, 6, 1, 1);
  },
  white_window: (x, v) => {
    PAINT.white_wall(x, v);
    window_(x, 3, 2, 10, 11);
  },
  fence: (x, v) => {
    grass(x, v);
    px(x, '#f3efe6', 0, 6, T, 2);
    px(x, '#f3efe6', 0, 11, T, 2);
    for (let i = 0; i < 4; i++) px(x, '#ffffff', i * 4 + 1, 3, 2, 12);
  },
  tram_stop: (x, v) => {
    PAINT.cobble(x, v);
    px(x, '#6b6258', 7, 5, 2, 10);
    px(x, '#1f4e8c', 3, 0, 10, 6);
    px(x, '#ffffff', 5, 2, 6, 2);
  },
  exam_bed: (x, v) => {
    PAINT.floor_tile(x, v);
    px(x, '#8c939c', 1, 10, 14, 4);
    px(x, '#cfe8f5', 1, 2, 14, 9);
    px(x, '#ffffff', 2, 3, 12, 3);
  },
  dining_table: (x, v) => {
    woodFloor(x, v);
    px(x, 'rgba(0,0,0,0.22)', 0, 13, T, 2);
    px(x, '#f5f1e6', 0, 3, T, 10);
    px(x, '#ffffff', 3, 5, 5, 4);
    px(x, '#c8102e', 10, 6, 2, 2);
    px(x, ['#b5652f', '#e8c07a', '#6fb34f', '#d9a05b'][v], 4, 6, 3, 2);
  },
  sofa: (x, v) => {
    woodFloor(x, v);
    shadowBase(x, 1, 14, 14);
    px(x, '#415a77', 1, 0, 6, 15);
    px(x, '#56739a', 3, 0, 10, 14);
    px(x, '#6a89b3', 4, 1, 8, 12);
  },
};

const VARIANTS = 4;
const cache = new Map<string, HTMLCanvasElement[]>();

export function tileCanvas(name: string, x: number, y: number): HTMLCanvasElement {
  let vs = cache.get(name);
  if (!vs) {
    vs = [];
    for (let v = 0; v < VARIANTS; v++) {
      const [c, ctx] = canvas();
      (PAINT[name] ?? PAINT.grass)(ctx, v);
      vs.push(c);
    }
    cache.set(name, vs);
  }
  const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
  return vs[h % VARIANTS];
}

// ─── characters ──────────────────────────────────────────────────────────────

const OUTLINE = '#1c1a24';
const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

function drawCharacter(x: Ctx, look: Look, dir: Dir, frame: number) {
  const skin = look.skin, hair = look.hair, shirt = look.shirt, pants = look.pants;
  const step = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  // legs
  const lx = dir === 'left' || dir === 'right' ? [6, 8] : [5, 9];
  px(x, pants, lx[0], 11, 2, 3 - Math.max(0, step));
  px(x, pants, lx[1], 11, 2, 3 - Math.max(0, -step));
  px(x, '#2a2a30', lx[0], 14 - Math.max(0, step), 2, 1);
  px(x, '#2a2a30', lx[1], 14 - Math.max(0, -step), 2, 1);
  // body
  px(x, shirt, 4, 7, 8, 5);
  px(x, shade(shirt, 0.8), 4, 11, 8, 1);
  if (dir === 'down' || dir === 'up') {
    px(x, shade(shirt, 0.85), 3, 8 + (step > 0 ? 1 : 0), 1, 3);
    px(x, shade(shirt, 0.85), 12, 8 + (step < 0 ? 1 : 0), 1, 3);
    px(x, skin, 3, 11 + (step > 0 ? 1 : 0), 1, 1);
    px(x, skin, 12, 11 + (step < 0 ? 1 : 0), 1, 1);
  } else {
    const ax = dir === 'left' ? 7 + step : 7 - step;
    px(x, shade(shirt, 0.8), ax, 8, 2, 3);
    px(x, skin, ax, 11, 2, 1);
  }
  if (look.accent && dir === 'down') px(x, look.accent, 7, 7, 2, 1);
  // head
  px(x, skin, 4, 1, 8, 7);
  px(x, shade(skin, 0.9), 4, 7, 8, 1);
  // face
  if (dir === 'down') {
    px(x, OUTLINE, 6, 4, 1, 2);
    px(x, OUTLINE, 9, 4, 1, 2);
    px(x, shade(skin, 0.8), 7, 6, 2, 1);
  } else if (dir === 'left') {
    px(x, OUTLINE, 5, 4, 1, 2);
    px(x, shade(skin, 0.85), 4, 6, 1, 1);
  } else if (dir === 'right') {
    px(x, OUTLINE, 10, 4, 1, 2);
    px(x, shade(skin, 0.85), 11, 6, 1, 1);
  }
  // hair
  const H = hair;
  const HD = shade(hair, 0.8);
  switch (look.style) {
    case 'bald':
      px(x, H, 4, 3, 1, 3);
      px(x, H, 11, 3, 1, 3);
      if (dir === 'up') px(x, H, 4, 4, 8, 3);
      break;
    case 'cap': {
      const cap = look.accent ?? '#c0392b';
      px(x, cap, 4, 0, 8, 3);
      px(x, shade(cap, 0.75), 4, 2, 8, 1);
      if (dir === 'down') px(x, shade(cap, 0.7), 4, 3, 8, 1);
      if (dir === 'left') px(x, shade(cap, 0.7), 2, 2, 4, 1);
      if (dir === 'right') px(x, shade(cap, 0.7), 10, 2, 4, 1);
      px(x, H, 4, 3, 1, 2);
      px(x, H, 11, 3, 1, 2);
      if (dir === 'up') px(x, H, 4, 3, 8, 4);
      break;
    }
    default: {
      px(x, H, 4, 0, 8, 3);
      px(x, HD, 4, 2, 8, 1);
      if (dir === 'down') {
        px(x, H, 4, 3, 1, 2);
        px(x, H, 11, 3, 1, 2);
        px(x, H, 5, 3, 2, 1);
      } else if (dir === 'left') {
        px(x, H, 7, 3, 5, 2);
        px(x, H, 11, 3, 1, 4);
      } else if (dir === 'right') {
        px(x, H, 4, 3, 5, 2);
        px(x, H, 4, 3, 1, 4);
      } else {
        px(x, H, 4, 3, 8, 4);
      }
      if (look.style === 'long') {
        const sides = dir === 'left' ? [11] : dir === 'right' ? [3] : [3, 12];
        for (const sx of sides) px(x, H, sx, 2, 1, 8);
        if (dir === 'up') px(x, H, 4, 7, 8, 3);
      }
      if (look.style === 'bob') {
        px(x, H, 3, 2, 1, 5);
        px(x, H, 12, 2, 1, 5);
        if (dir === 'up') px(x, H, 4, 7, 8, 1);
      }
      if (look.style === 'bun') {
        px(x, H, 6, -1 + 1, 4, 1);
        px(x, HD, 6, 0, 4, 1);
        if (dir === 'up' || dir === 'left' || dir === 'right') px(x, H, 6, 0, 4, 2);
      }
      if (look.style === 'curly') {
        for (let i = 0; i < 4; i++) px(x, HD, 4 + i * 2, 0, 1, 1);
        px(x, H, 3, 1, 1, 4);
        px(x, H, 12, 1, 1, 4);
      }
    }
  }
}

function outline(c: HTMLCanvasElement) {
  const x = c.getContext('2d')!;
  const img = x.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const w = c.width, h = c.height;
  const solid = (X: number, Y: number) => X >= 0 && Y >= 0 && X < w && Y < h && d[(Y * w + X) * 4 + 3] > 200;
  const out: [number, number][] = [];
  for (let Y = 0; Y < h; Y++) for (let X = 0; X < w; X++) {
    if (solid(X, Y)) continue;
    if (solid(X - 1, Y) || solid(X + 1, Y) || solid(X, Y - 1) || solid(X, Y + 1)) out.push([X, Y]);
  }
  x.fillStyle = OUTLINE;
  for (const [X, Y] of out) x.fillRect(X, Y, 1, 1);
}

export type Frames = Record<Dir, HTMLCanvasElement[]>;
const charCache = new Map<string, Frames>();

/** 4 frames per direction: stand, step A, stand, step B. Canvas is 16×17 (1px headroom). */
export function characterFrames(look: Look): Frames {
  const key = JSON.stringify(look);
  const hit = charCache.get(key);
  if (hit) return hit;
  const f = {} as Frames;
  for (const dir of ['down', 'up', 'left', 'right'] as Dir[]) {
    f[dir] = [0, 1, 2, 3].map((fr) => {
      const [c, x] = canvas(T, T + 1);
      x.translate(0, 1);
      drawCharacter(x, look, dir, fr);
      x.setTransform(1, 0, 0, 1, 0, 0);
      outline(c);
      return c;
    });
  }
  charCache.set(key, f);
  return f;
}

/** Head-and-shoulders portrait as a data URL for the dialogue box. */
export function portrait(look: Look, scale = 4): string {
  const src = characterFrames(look).down[0];
  const [c, x] = canvas(14 * scale, 12 * scale);
  x.drawImage(src, 1, 0, 14, 12, 0, 0, 14 * scale, 12 * scale);
  return c.toDataURL();
}

export const PLAYER_LOOKS: Record<'f' | 'm', Look> = {
  f: { skin: '#f1c6a1', hair: '#6b3f26', style: 'bob', shirt: '#f2a541', pants: '#3b4a6b', accent: '#ffffff' },
  m: { skin: '#eab892', hair: '#3a2a1c', style: 'short', shirt: '#f2a541', pants: '#3b4a6b', accent: '#ffffff' },
};

export function drawShadow(x: Ctx, X: number, Y: number) {
  x.fillStyle = 'rgba(0,0,0,0.25)';
  x.fillRect(X + 3, Y + 14, 10, 2);
  x.fillRect(X + 4, Y + 13, 8, 1);
}
