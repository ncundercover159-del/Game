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
};
