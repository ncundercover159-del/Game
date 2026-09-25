// Procedural prop library in the figure format (see figure.js). Props are
// merged into single geometries; scatter props are drawn instanced.
// Bones named "spin" are rotated by the track view (windmill blades etc).
export const PROPS = {
  tree: {
    palette: { leaf: '#58c24a', leaf2: '#7bd85a', trunk: '#8a5a32' },
    parts: [
      { shape: 'cyl', rt: 0.35, rb: 0.5, h: 3.2, p: [0, 1.6, 0], c: 'trunk', m: 'matte' },
      { shape: 'sphere', r: 2.2, s: [1, 0.9, 1], p: [0, 4.4, 0], c: 'leaf' },
      { shape: 'sphere', r: 1.5, p: [1.3, 3.7, 0.5], c: 'leaf2' },
      { shape: 'sphere', r: 1.4, p: [-1.2, 3.9, -0.6], c: 'leaf2' },
    ],
  },
  pine: {
    palette: { leaf: '#2f8f4a', leaf2: '#3aa85a', trunk: '#6a4424' },
    parts: [
      { shape: 'cyl', r: 0.35, h: 1.6, p: [0, 0.8, 0], c: 'trunk', m: 'matte' },
      { shape: 'cone', r: 2.2, h: 3, p: [0, 1.4, 0], c: 'leaf' },
      { shape: 'cone', r: 1.7, h: 2.6, p: [0, 3.0, 0], c: 'leaf2' },
      { shape: 'cone', r: 1.1, h: 2.2, p: [0, 4.6, 0], c: 'leaf' },
    ],
  },
  bush: {
    palette: { leaf: '#4fb040', leaf2: '#6ccf55', flower: '#ff7fb0' },
    parts: [
      { shape: 'sphere', r: 1.0, s: [1.2, 0.8, 1], p: [0, 0.6, 0], c: 'leaf' },
      { shape: 'sphere', r: 0.75, p: [0.9, 0.5, 0.2], c: 'leaf2' },
      { shape: 'sphere', r: 0.18, p: [0.3, 1.25, 0.5], c: 'flower', m: 'glow' },
      { shape: 'sphere', r: 0.16, p: [-0.5, 1.1, 0.4], c: 'flower', m: 'glow' },
    ],
  },
  rock: {
    palette: { rock: '#9a8a7a', rock2: '#b8a898' },
    parts: [
      { shape: 'sphere', r: 1.3, s: [1.3, 0.8, 1], p: [0, 0.5, 0], c: 'rock', m: 'matte' },
      { shape: 'sphere', r: 0.8, s: [1, 0.8, 1], p: [1.1, 0.35, 0.4], c: 'rock2', m: 'matte' },
    ],
  },
  cloudPuff: {
    palette: { c: '#ffffff', c2: '#e8f4ff' },
    parts: [
      { shape: 'sphere', r: 4, p: [0, 0, 0], c: 'c', m: 'soft' },
      { shape: 'sphere', r: 3, p: [4.5, -0.5, 0.5], c: 'c2', m: 'soft' },
      { shape: 'sphere', r: 3.2, p: [-4, -0.3, -0.5], c: 'c2', m: 'soft' },
      { shape: 'sphere', r: 2.4, p: [1.5, 2.6, 0], c: 'c', m: 'soft' },
    ],
  },
  island: {
    palette: { grass: '#62c046', rock: '#c9a46c', rock2: '#a47a48', dark: '#6a4a2a' },
    parts: [
      { shape: 'cyl', rt: 9, rb: 8, h: 1.2, p: [0, -0.6, 0], c: 'grass', m: 'matte' },
      { shape: 'cone', r: 8, h: 14, p: [0, -1.2, 0], rot: [180, 0, 0], c: 'rock', m: 'matte' },
      { shape: 'cone', r: 4, h: 8, p: [2, -8, 1], rot: [180, 0, 0], c: 'rock2', m: 'matte' },
    ],
  },
  windmill: {
    palette: { wall: '#f4ecd8', roof: '#e8402a', wood: '#8a5a32', sail: '#ffffff' },
    bones: { spin: { pos: [0, 9, 2.2] } },
    parts: [
      { shape: 'cyl', rt: 1.8, rb: 2.6, h: 9, p: [0, 4.5, 0], c: 'wall', m: 'matte' },
      { shape: 'cone', r: 2.6, h: 3, p: [0, 9, 0], c: 'roof' },
      { bone: 'spin', shape: 'cyl', r: 0.35, h: 0.8, rot: [90, 0, 0], c: 'wood' },
      { bone: 'spin', shape: 'box', size: [0.8, 7, 0.15], p: [0, 3.6, 0.2], c: 'sail', array: { n: 1 } },
      { bone: 'spin', shape: 'box', size: [0.8, 7, 0.15], p: [0, -3.6, 0.2], c: 'sail' },
      { bone: 'spin', shape: 'box', size: [7, 0.8, 0.15], p: [3.6, 0, 0.2], c: 'sail' },
      { bone: 'spin', shape: 'box', size: [7, 0.8, 0.15], p: [-3.6, 0, 0.2], c: 'sail' },
    ],
  },
  tower: {
    palette: { wall: '#e8dcc4', roof: '#3d6fd8', trim: '#ffd23f' },
    parts: [
      { shape: 'cyl', r: 3, h: 16, p: [0, 8, 0], c: 'wall', m: 'matte' },
      { shape: 'cyl', r: 3.4, h: 1, p: [0, 16, 0], c: 'trim' },
      { shape: 'cone', r: 3.8, h: 7, p: [0, 16.5, 0], c: 'roof' },
      { shape: 'box', size: [1.2, 2, 0.4], p: [0, 11, 2.9], c: 'roof' },
    ],
  },
  skyship: {
    palette: { hull: '#8a5a32', deck: '#c89a5e', balloon: '#ff5a8a', balloon2: '#ffd23f', sail: '#ffffff' },
    bones: { spin: { pos: [0, 1.2, -7] } },
    parts: [
      { shape: 'sphere', r: 4, s: [1, 0.6, 2.2], p: [0, 0, 0], c: 'hull' },
      { shape: 'box', size: [5.6, 0.4, 14], p: [0, 1.6, 0], c: 'deck', m: 'matte' },
      { shape: 'sphere', r: 5, s: [1, 0.8, 2], p: [0, 10, 0], c: 'balloon' },
      { shape: 'torus', r: 5.1, tube: 0.5, p: [0, 10, 0], rot: [90, 0, 0], s: [1, 2, 1], c: 'balloon2' },
      { shape: 'cyl', r: 0.15, h: 6, p: [2, 5, 3], c: 'hull', mirror: true },
      { shape: 'cyl', r: 0.15, h: 6, p: [2, 5, -3], c: 'hull', mirror: true },
      { bone: 'spin', shape: 'box', size: [0.3, 3.2, 0.3], c: 'sail' },
      { bone: 'spin', shape: 'box', size: [3.2, 0.3, 0.3], c: 'sail' },
    ],
  },
  startArch: {
    palette: { post: '#2f6fe0', trim: '#ffd23f', banner: '#ffffff', dark: '#1a1426' },
    parts: [
      { shape: 'box', size: [1.6, 9, 1.6], round: 0.3, p: [14, 4.5, 0], c: 'post', mirror: true },
      { shape: 'box', size: [2.0, 0.6, 2.0], round: 0.2, p: [14, 9.2, 0], c: 'trim', mirror: true },
      { shape: 'box', size: [30, 3, 1.2], round: 0.4, p: [0, 10, 0], c: 'post' },
      { shape: 'box', size: [30.4, 0.5, 1.4], round: 0.2, p: [0, 11.6, 0], c: 'trim' },
      { shape: 'box', size: [30.4, 0.5, 1.4], round: 0.2, p: [0, 8.4, 0], c: 'trim' },
    ],
  },
  rainbowArch: {
    palette: { r: '#ff4f4f', o: '#ff9a1e', y: '#ffe04f', g: '#56d23e', b: '#3db4ff', v: '#a84cff', cloud: '#ffffff' },
    parts: [
      { shape: 'torus', r: 19, tube: 0.7, arc: 180, c: 'r', m: 'glow' },
      { shape: 'torus', r: 17.6, tube: 0.7, arc: 180, c: 'o', m: 'glow' },
      { shape: 'torus', r: 16.2, tube: 0.7, arc: 180, c: 'y', m: 'glow' },
      { shape: 'torus', r: 14.8, tube: 0.7, arc: 180, c: 'g', m: 'glow' },
      { shape: 'torus', r: 13.4, tube: 0.7, arc: 180, c: 'b', m: 'glow' },
      { shape: 'torus', r: 12, tube: 0.7, arc: 180, c: 'v', m: 'glow' },
      { shape: 'sphere', r: 3, s: [1.6, 1, 1.2], p: [15.5, 0.5, 0], c: 'cloud', m: 'soft', mirror: true },
    ],
  },
  lamp: {
    palette: { post: '#2a2530', light: '#fff2b0' },
    parts: [
      { shape: 'cyl', r: 0.18, h: 6, p: [0, 3, 0], c: 'post' },
      { shape: 'box', size: [0.9, 1.2, 0.9], round: 0.2, p: [0, 6.3, 0], c: 'light', m: 'glow' },
    ],
  },
  puff: {
    palette: { cloud: '#ffffff', cloud2: '#e6f2ff', eye: '#1a1426', cheek: '#ff9bc0', rod: '#8a5a32', mouth: '#1a1426' },
    outline: 0.03,
    parts: [
      { shape: 'sphere', r: 0.9, s: [1.2, 0.85, 1], c: 'cloud', m: 'soft' },
      { shape: 'sphere', r: 0.6, p: [0.9, -0.1, 0], c: 'cloud2', m: 'soft', mirror: true },
      { shape: 'sphere', r: 0.55, p: [0.3, 0.55, -0.2], c: 'cloud2', m: 'soft' },
      { shape: 'eye', r: 0.2, p: [0.3, 0.12, 0.72], iris: 'eye', iris_size: 0.75, pupil_size: 0.5, mirror: true },
      { shape: 'sphere', r: 0.12, s: [1.3, 0.7, 0.5], p: [0.55, -0.12, 0.72], c: 'cheek', m: 'matte', mirror: true },
      { shape: 'torus', r: 0.14, tube: 0.035, arc: 180, p: [0, -0.18, 0.84], rot: [0, 0, 180], c: 'mouth' },
      { shape: 'cyl', r: 0.05, h: 2.6, p: [0.9, -0.2, 0.8], rot: [55, 0, -20], c: 'rod', m: 'matte' },
    ],
  },
  // --- Skyland extras ---------------------------------------------------------------
  barn: {
    // open-ended so karts can drive straight through it
    palette: { wall: '#d8402a', trim: '#ffffff', roof: '#5a3a2a', hay: '#f2cc5a' },
    parts: [
      { shape: 'box', size: [0.8, 6, 14], p: [5.4, 3, 0], c: 'wall', m: 'matte', mirror: true },
      { shape: 'box', size: [7.8, 0.5, 14.6], p: [2.8, 7.6, 0], rot: [0, 0, -38], c: 'roof', m: 'matte', mirror: true },
      { shape: 'box', size: [0.4, 6.2, 0.5], p: [5.2, 3.1, 7.1], c: 'trim', mirror: true },
      { shape: 'box', size: [0.4, 6.2, 0.5], p: [5.2, 3.1, -7.1], c: 'trim', mirror: true },
      { shape: 'box', size: [10.8, 0.5, 0.5], p: [0, 6.2, 7.1], c: 'trim' },
      { shape: 'box', size: [10.8, 0.5, 0.5], p: [0, 6.2, -7.1], c: 'trim' },
      { shape: 'cyl', r: 1, h: 1.4, rot: [0, 0, 90], p: [4.2, 1, 3], c: 'hay', m: 'matte', mirror: true },
    ],
  },
  hayBale: {
    palette: { hay: '#f2cc5a', band: '#b8862a' },
    parts: [
      { shape: 'cyl', r: 1.1, h: 1.6, rot: [0, 0, 90], p: [0, 1.1, 0], c: 'hay', m: 'matte' },
      { shape: 'torus', r: 1.12, tube: 0.07, rot: [0, 90, 0], p: [0.4, 1.1, 0], c: 'band', mirror: true },
    ],
  },
  lighthouse: {
    palette: { a: '#ffffff', b: '#e8402a', lamp: '#fff2a0', roof: '#2a2530' },
    parts: [
      { shape: 'cyl', rt: 2.2, rb: 3, h: 5, p: [0, 2.5, 0], c: 'a', m: 'matte' },
      { shape: 'cyl', rt: 1.9, rb: 2.2, h: 5, p: [0, 7.5, 0], c: 'b', m: 'matte' },
      { shape: 'cyl', rt: 1.6, rb: 1.9, h: 5, p: [0, 12.5, 0], c: 'a', m: 'matte' },
      { shape: 'cyl', r: 1.5, h: 2.2, p: [0, 16, 0], c: 'lamp', m: 'glow' },
      { shape: 'cone', r: 2, h: 2.4, p: [0, 17, 0], c: 'roof' },
    ],
  },
  dockPost: {
    palette: { wood: '#8a5a32', rope: '#e8d8a8' },
    parts: [
      { shape: 'cyl', r: 0.45, h: 5, p: [0, 1, 0], c: 'wood', m: 'matte' },
      { shape: 'torus', r: 0.5, tube: 0.1, rot: [90, 0, 0], p: [0, 2.8, 0], c: 'rope', m: 'matte' },
    ],
  },
  balloon: {
    palette: { a: '#ffd23f', b: '#3db4ff', basket: '#8a5a32', rope: '#2a2530' },
    parts: [
      { shape: 'sphere', r: 4, s: [1, 1.15, 1], p: [0, 8, 0], c: 'a' },
      { shape: 'torus', r: 3.95, tube: 0.35, rot: [0, 0, 0], p: [0, 8, 0], s: [1, 1.15, 1], c: 'b' },
      { shape: 'torus', r: 3.95, tube: 0.35, rot: [0, 90, 0], p: [0, 8, 0], s: [1, 1.15, 1], c: 'b' },
      { shape: 'box', size: [1.8, 1.2, 1.8], round: 0.2, p: [0, 1.6, 0], c: 'basket', m: 'matte' },
      { shape: 'cyl', r: 0.05, h: 3.4, p: [0.8, 3.6, 0.8], c: 'rope', mirror: true },
      { shape: 'cyl', r: 0.05, h: 3.4, p: [0.8, 3.6, -0.8], c: 'rope', mirror: true },
    ],
  },
  crate: {
    palette: { wood: '#c89a5e', band: '#8a5a32' },
    parts: [
      { shape: 'box', size: [2, 2, 2], round: 0.1, p: [0, 1, 0], c: 'wood', m: 'matte' },
      { shape: 'box', size: [2.05, 0.3, 2.05], p: [0, 1.6, 0], c: 'band', m: 'matte' },
      { shape: 'box', size: [2.05, 0.3, 2.05], p: [0, 0.4, 0], c: 'band', m: 'matte' },
    ],
  },
  // --- Molten ----------------------------------------------------------------------
  lavaRock: {
    palette: { rock: '#3b3036', rock2: '#524448', glow: '#ff7a1a' },
    parts: [
      { shape: 'cone', r: 1.8, h: 5, p: [0, 0, 0], c: 'rock', m: 'matte' },
      { shape: 'cone', r: 1.2, h: 3.4, p: [1.4, 0, 0.6], rot: [0, 0, -12], c: 'rock2', m: 'matte' },
      { shape: 'cone', r: 1, h: 2.4, p: [-1.2, 0, -0.5], rot: [8, 0, 10], c: 'rock2', m: 'matte' },
      { shape: 'torus', r: 1.5, tube: 0.12, rot: [90, 0, 0], p: [0, 0.8, 0], c: 'glow', m: 'glow' },
    ],
  },
  crystal: {
    palette: { c: '#ff9a3a', c2: '#ffd06a', base: '#3b3036' },
    parts: [
      { shape: 'sphere', r: 1.2, s: [1.3, 0.5, 1.2], p: [0, 0.2, 0], c: 'base', m: 'matte' },
      { shape: 'cone', r: 0.6, h: 3.6, p: [0, 0.2, 0], c: 'c', m: 'glow' },
      { shape: 'cone', r: 0.45, h: 2.4, p: [0.6, 0.2, 0.3], rot: [0, 0, -25], c: 'c2', m: 'glow' },
      { shape: 'cone', r: 0.4, h: 2, p: [-0.5, 0.2, -0.3], rot: [15, 0, 22], c: 'c', m: 'glow' },
    ],
  },
  volcano: {
    palette: { rock: '#3b2a2a', rock2: '#5a3a30', lava: '#ff6a1a', smoke: '#6a5a5a' },
    parts: [
      { shape: 'cyl', rt: 10, rb: 38, h: 40, p: [0, 20, 0], c: 'rock', m: 'matte' },
      { shape: 'cyl', rt: 9, rb: 9.5, h: 1, p: [0, 40, 0], c: 'lava', m: 'glow' },
      { shape: 'cone', r: 2.2, h: 36, p: [8, 2, 20], rot: [-38, 0, 0], c: 'lava', m: 'glow' },
      { shape: 'sphere', r: 8, s: [1.4, 0.8, 1.4], p: [0, 50, 0], c: 'smoke', m: 'soft' },
    ],
  },
  forge: {
    palette: { wall: '#4a3a36', roof: '#2a2226', fire: '#ff7a1a', trim: '#ffb000' },
    parts: [
      { shape: 'box', size: [12, 8, 10], p: [0, 4, 0], c: 'wall', m: 'matte' },
      { shape: 'box', size: [13, 1, 11], p: [0, 8.5, 0], c: 'roof' },
      { shape: 'cyl', rt: 1.2, rb: 1.6, h: 10, p: [3.5, 12, -2], c: 'wall', m: 'matte' },
      { shape: 'sphere', r: 1.4, p: [3.5, 17.4, -2], c: 'fire', m: 'glow' },
      { shape: 'box', size: [5, 4, 0.3], p: [0, 2, 5.05], c: 'fire', m: 'glow' },
      { shape: 'box', size: [5.6, 0.5, 0.6], p: [0, 4.2, 5.1], c: 'trim' },
    ],
  },
  lavaFall: {
    palette: { lava: '#ff7a1a', lava2: '#ffd23f', rock: '#3b3036' },
    parts: [
      { shape: 'box', size: [10, 24, 6], p: [0, 12, -3], c: 'rock', m: 'matte' },
      { shape: 'box', size: [5, 24, 0.6], p: [0, 12, 0.2], c: 'lava', m: 'glow' },
      { shape: 'box', size: [2, 24, 0.7], p: [0, 12, 0.3], c: 'lava2', m: 'glow' },
      { shape: 'sphere', r: 4, s: [1.4, 0.4, 1], p: [0, 0, 2], c: 'lava', m: 'glow' },
    ],
  },
  // --- Haunted ---------------------------------------------------------------------
  deadTree: {
    palette: { bark: '#4a3a44', bark2: '#5e4a56' },
    parts: [
      { shape: 'tube', r0: 0.55, r1: 0.12, points: [[0, 0, 0], [0.2, 2.5, 0], [-0.3, 5, 0.2], [0.4, 7, -0.1]], c: 'bark', m: 'matte' },
      { shape: 'tube', r0: 0.25, r1: 0.05, points: [[0.1, 3.4, 0], [1.4, 4.4, 0.3], [2.4, 4.6, 0.1]], c: 'bark2', m: 'matte' },
      { shape: 'tube', r0: 0.22, r1: 0.05, points: [[-0.2, 4.6, 0.1], [-1.6, 5.6, -0.2], [-2.2, 6.4, 0]], c: 'bark2', m: 'matte' },
      { shape: 'tube', r0: 0.18, r1: 0.04, points: [[0.1, 5.8, 0], [0.9, 6.4, 1.2]], c: 'bark2', m: 'matte' },
    ],
  },
  gravestone: {
    palette: { stone: '#8a8498', stone2: '#6a6478', moss: '#5a7a4a' },
    parts: [
      { shape: 'box', size: [1.4, 1.6, 0.4], round: 0.12, p: [0, 0.8, 0], c: 'stone', m: 'matte' },
      { shape: 'cyl', r: 0.7, h: 0.4, rot: [90, 0, 0], p: [0, 1.6, 0], c: 'stone', m: 'matte' },
      { shape: 'box', size: [0.8, 0.12, 0.05], p: [0, 1.4, 0.21], c: 'stone2' },
      { shape: 'box', size: [0.12, 0.6, 0.05], p: [0, 1.3, 0.21], c: 'stone2' },
      { shape: 'sphere', r: 0.4, s: [1.6, 0.4, 1], p: [0, 0.05, 0.4], c: 'moss', m: 'matte' },
    ],
  },
  pumpkin: {
    palette: { p: '#ff8a1e', stem: '#4a6a2a', glow: '#ffe45c' },
    parts: [
      { shape: 'sphere', r: 0.9, s: [1.2, 0.85, 1.2], p: [0, 0.75, 0], c: 'p' },
      { shape: 'sphere', r: 0.7, s: [0.8, 0.9, 1.2], p: [0.55, 0.75, 0], c: 'p', mirror: true },
      { shape: 'cyl', r: 0.12, h: 0.5, p: [0, 1.6, 0], rot: [0, 0, 10], c: 'stem', m: 'matte' },
      { shape: 'cone', r: 0.16, h: 0.22, p: [0.3, 0.95, 0.98], rot: [90, 0, 0], c: 'glow', m: 'glow', mirror: true },
      { shape: 'box', size: [0.7, 0.14, 0.1], p: [0, 0.55, 1.02], c: 'glow', m: 'glow' },
    ],
  },
  crypt: {
    palette: { stone: '#6a6478', stone2: '#4e4860', door: '#2a2230', glow: '#7cffb2' },
    parts: [
      { shape: 'box', size: [8, 6, 8], p: [0, 3, 0], c: 'stone', m: 'matte' },
      { shape: 'cone', r: 6.4, h: 4, p: [0, 6, 0], rot: [0, 45, 0], c: 'stone2', m: 'matte' },
      { shape: 'box', size: [1, 7, 1], p: [3.6, 3.5, 4], c: 'stone2', m: 'matte', mirror: true },
      { shape: 'box', size: [3, 4, 0.3], p: [0, 2, 4.05], c: 'door' },
      { shape: 'sphere', r: 0.35, p: [0, 5, 4.2], c: 'glow', m: 'glow' },
    ],
  },
  mansion: {
    palette: { wall: '#5a4e66', roof: '#2b2346', window: '#ffe45c', trim: '#8a7ad0' },
    parts: [
      { shape: 'box', size: [22, 12, 12], p: [0, 6, 0], c: 'wall', m: 'matte' },
      { shape: 'cone', r: 13, h: 7, p: [0, 12, 0], rot: [0, 45, 0], s: [1.2, 1, 0.65], c: 'roof' },
      { shape: 'cyl', r: 3, h: 20, p: [11, 10, 0], c: 'wall', m: 'matte', mirror: true },
      { shape: 'cone', r: 3.6, h: 7, p: [11, 20, 0], c: 'roof', mirror: true },
      { shape: 'box', size: [1.6, 2.4, 0.2], p: [4, 4, 6.05], c: 'window', m: 'glow', mirror: true, array: { n: 2, dp: [0, 4, 0] } },
      { shape: 'box', size: [1.6, 2.4, 0.2], p: [0, 8, 6.05], c: 'window', m: 'glow' },
      { shape: 'box', size: [3, 4.6, 0.3], p: [0, 2.3, 6.05], c: 'roof' },
    ],
  },
  tent: {
    palette: { a: '#ff5a8a', b: '#ffffff', flag: '#ffd23f', pole: '#2a2530' },
    parts: [
      { shape: 'cyl', r: 6, h: 5, p: [0, 2.5, 0], c: 'a', m: 'matte' },
      { shape: 'box', size: [1.4, 5.02, 12.04], p: [0, 2.5, 0], c: 'b', m: 'matte', ring: { n: 4, r: 0 } },
      { shape: 'cone', r: 6.6, h: 5, p: [0, 5, 0], c: 'b' },
      { shape: 'cyl', r: 0.1, h: 2.4, p: [0, 10.8, 0], c: 'pole' },
      { shape: 'box', size: [1.4, 0.8, 0.05], p: [0.7, 11.6, 0], c: 'flag' },
    ],
  },
  ferrisWheel: {
    palette: { frame: '#8a7ad0', hub: '#ffd23f', cab: '#ff5a8a', cab2: '#7cffb2', light: '#fff2b0' },
    bones: { spin: { pos: [0, 14, 0] } },
    parts: [
      { shape: 'box', size: [0.6, 16, 0.6], p: [4, 7, 0], rot: [0, 0, 15], c: 'frame', mirror: true },
      { bone: 'spin', shape: 'torus', r: 11, tube: 0.3, c: 'frame' },
      { bone: 'spin', shape: 'torus', r: 11.2, tube: 0.12, c: 'light', m: 'glow' },
      { bone: 'spin', shape: 'cyl', r: 1, h: 1.4, rot: [90, 0, 0], c: 'hub' },
      { bone: 'spin', shape: 'box', size: [0.25, 22, 0.25], c: 'frame', array: { n: 4, dr: [0, 0, 45] } },
      { bone: 'spin', shape: 'box', size: [1.6, 1.6, 1.6], round: 0.4, p: [0, 11, 0], c: 'cab' },
      { bone: 'spin', shape: 'box', size: [1.6, 1.6, 1.6], round: 0.4, p: [0, -11, 0], c: 'cab2' },
      { bone: 'spin', shape: 'box', size: [1.6, 1.6, 1.6], round: 0.4, p: [11, 0, 0], c: 'cab2' },
      { bone: 'spin', shape: 'box', size: [1.6, 1.6, 1.6], round: 0.4, p: [-11, 0, 0], c: 'cab' },
    ],
  },
  lantern: {
    palette: { post: '#2b2346', light: '#7cffb2' },
    parts: [
      { shape: 'cyl', r: 0.15, h: 4.5, p: [0, 2.25, 0], c: 'post' },
      { shape: 'box', size: [0.8, 0.2, 0.2], p: [0.4, 4.4, 0], c: 'post' },
      { shape: 'sphere', r: 0.4, p: [0.8, 3.9, 0], c: 'light', m: 'glow' },
    ],
  },
  log: {
    palette: { bark: '#6a4a34', ring: '#c89a5e', moss: '#5a7a4a' },
    parts: [
      { shape: 'cyl', r: 1, h: 3.2, rot: [0, 0, 90], c: 'bark', m: 'matte' },
      { shape: 'cyl', r: 0.8, h: 3.25, rot: [0, 0, 90], c: 'ring', m: 'matte' },
      { shape: 'sphere', r: 0.5, s: [1.6, 0.5, 1], p: [0.4, 0.9, 0], c: 'moss', m: 'matte' },
    ],
  },
  // --- Gearworks -------------------------------------------------------------------
  gear: {
    palette: { steel: '#ffc21a', dark: '#8a6a1a', hub: '#3e4450' },
    bones: { spin: { pos: [0, 7, 0] } },
    parts: [
      { shape: 'box', size: [1.2, 7, 1.2], p: [0, 3.5, -0.8], c: 'hub', m: 'metal' },
      { bone: 'spin', shape: 'cyl', r: 5, h: 1, rot: [90, 0, 0], c: 'steel', m: 'metal' },
      { bone: 'spin', shape: 'cyl', r: 1.4, h: 1.3, rot: [90, 0, 0], c: 'hub', m: 'metal' },
      { bone: 'spin', shape: 'box', size: [1.4, 12, 1], c: 'steel', m: 'metal', array: { n: 6, dr: [0, 0, 30] } },
      { bone: 'spin', shape: 'torus', r: 3.3, tube: 0.4, c: 'dark', m: 'metal' },
    ],
  },
  smokestack: {
    palette: { brick: '#8a4a3a', band: '#ffc21a', dark: '#2a2226', smoke: '#9a9490' },
    parts: [
      { shape: 'cyl', rt: 1.6, rb: 2.4, h: 22, p: [0, 11, 0], c: 'brick', m: 'matte' },
      { shape: 'cyl', r: 1.9, h: 1, p: [0, 20, 0], c: 'band' },
      { shape: 'cyl', r: 1.7, h: 0.6, p: [0, 22.2, 0], c: 'dark' },
      { shape: 'sphere', r: 3, s: [1.2, 0.8, 1.2], p: [0.8, 25, 0], c: 'smoke', m: 'soft' },
      { shape: 'sphere', r: 2.2, p: [2.6, 27.5, 0.6], c: 'smoke', m: 'soft' },
    ],
  },
  tank: {
    palette: { steel: '#7a8292', band: '#ffc21a', pipe: '#4a5262' },
    parts: [
      { shape: 'cyl', r: 3.2, h: 7, p: [0, 3.5, 0], c: 'steel', m: 'metal' },
      { shape: 'sphere', r: 3.2, hemi: true, p: [0, 7, 0], c: 'steel', m: 'metal' },
      { shape: 'torus', r: 3.25, tube: 0.18, rot: [90, 0, 0], p: [0, 2, 0], c: 'band', array: { n: 2, dp: [0, 3, 0] } },
      { shape: 'cyl', r: 0.4, h: 6, rot: [0, 0, 90], p: [4.5, 1.2, 0], c: 'pipe', m: 'metal' },
    ],
  },
  pipeArch: {
    palette: { pipe: '#4a8a5a', joint: '#ffc21a' },
    parts: [
      { shape: 'cyl', r: 0.9, h: 11, p: [14, 5.5, 0], c: 'pipe', m: 'metal', mirror: true },
      { shape: 'cyl', r: 0.9, h: 28, rot: [0, 0, 90], p: [0, 11, 0], c: 'pipe', m: 'metal' },
      { shape: 'cyl', r: 1.2, h: 0.8, p: [14, 11, 0], rot: [0, 0, 90], c: 'joint', m: 'metal', mirror: true },
      { shape: 'cyl', r: 1.2, h: 0.8, p: [0, 11, 0], rot: [0, 0, 90], c: 'joint', m: 'metal' },
    ],
  },
  crane: {
    palette: { frame: '#ffc21a', dark: '#2a2e38', hook: '#7a8292' },
    parts: [
      { shape: 'box', size: [1.4, 26, 1.4], p: [0, 13, 0], c: 'frame', m: 'metal' },
      { shape: 'box', size: [22, 1.2, 1.2], p: [7, 26, 0], c: 'frame', m: 'metal' },
      { shape: 'box', size: [3, 3, 3], p: [-3, 24.5, 0], c: 'dark' },
      { shape: 'cyl', r: 0.06, h: 10, p: [15, 21, 0], c: 'dark' },
      { shape: 'torus', r: 0.6, tube: 0.18, arc: 250, p: [15, 15.6, 0], c: 'hook', m: 'metal' },
    ],
  },
  robot: {
    palette: { body: '#7a8292', eye: '#6dfff0', trim: '#ffc21a' },
    parts: [
      { shape: 'box', size: [3, 3.6, 2.4], round: 0.4, p: [0, 3.4, 0], c: 'body', m: 'metal' },
      { shape: 'box', size: [2.2, 1.8, 2], round: 0.4, p: [0, 6.2, 0], c: 'body', m: 'metal' },
      { shape: 'sphere', r: 0.35, p: [0.5, 6.3, 1], c: 'eye', m: 'glow', mirror: true },
      { shape: 'cyl', r: 0.4, h: 1.8, p: [0.8, 0.9, 0], c: 'trim', m: 'metal', mirror: true },
      { shape: 'capsule', r: 0.35, len: 2, p: [2, 3.6, 0], rot: [0, 0, 20], c: 'trim', m: 'metal', mirror: true },
      { shape: 'cyl', r: 0.06, h: 1, p: [0, 7.5, 0], c: 'trim' },
      { shape: 'sphere', r: 0.2, p: [0, 8, 0], c: 'eye', m: 'glow' },
    ],
  },
};
