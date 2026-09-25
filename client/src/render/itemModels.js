// Item/projectile/hazard models in the figure format (merged, vertex-coloured).
export const ITEM_MODELS = {
  orb: {
    palette: { core: '#c04fff', hi: '#ffb8ff' },
    parts: [
      { shape: 'sphere', r: 0.5, c: 'core', m: 'gloss' },
      { shape: 'sphere', r: 0.58, c: 'hi', m: 'soft', s: [1, 1, 1], p: [0, 0, 0], hemi: true, rot: [0, 0, 180] },
      { shape: 'sphere', r: 0.16, p: [-0.18, 0.24, 0.34], c: 'hi', m: 'glow' },
    ],
  },
  seeker: {
    palette: { core: '#ff3d4f', ring: '#ffffff', eye: '#1a1426' },
    parts: [
      { shape: 'sphere', r: 0.55, c: 'core' },
      { shape: 'torus', r: 0.7, tube: 0.08, rot: [90, 0, 0], c: 'ring', m: 'glow' },
      { shape: 'sphere', r: 0.14, p: [0.18, 0.12, 0.5], c: 'eye', mirror: true },
    ],
  },
  peel: {
    palette: { peel: '#ffe04f', tip: '#8a5a32', inner: '#fff6c8' },
    parts: [
      { shape: 'sphere', r: 0.45, s: [0.5, 0.25, 1.2], p: [0.3, 0.1, 0.25], rot: [0, 35, 0], c: 'peel' },
      { shape: 'sphere', r: 0.45, s: [0.5, 0.25, 1.2], p: [-0.3, 0.1, 0.25], rot: [0, -35, 0], c: 'peel' },
      { shape: 'sphere', r: 0.45, s: [0.5, 0.25, 1.2], p: [0, 0.1, -0.35], c: 'peel' },
      { shape: 'sphere', r: 0.28, s: [1, 1.3, 1], p: [0, 0.35, 0], c: 'inner' },
      { shape: 'cone', r: 0.12, h: 0.3, p: [0, 0.6, 0], c: 'tip' },
    ],
  },
  comet: {
    palette: { core: '#3d7bff', spike: '#9fe3ff', wing: '#ffffff', eye: '#1a1426' },
    parts: [
      { shape: 'sphere', r: 0.9, c: 'core', m: 'glow' },
      { shape: 'cone', r: 0.3, h: 0.9, p: [0, 0.7, 0], c: 'spike' },
      { shape: 'cone', r: 0.3, h: 0.9, p: [0, -0.7, 0], rot: [180, 0, 0], c: 'spike' },
      { shape: 'cone', r: 0.3, h: 0.9, p: [0.7, 0, 0], rot: [0, 0, -90], c: 'spike', mirror: true },
      { shape: 'cone', r: 0.3, h: 0.9, p: [0, 0, -0.7], rot: [-90, 0, 0], c: 'spike' },
      { shape: 'extrude', points: [[0, 0], [1.4, 0.6], [1.6, 0.1], [0.8, -0.3]], depth: 0.08, p: [0.6, 0.2, -0.2], rot: [0, 20, 0], c: 'wing', mirror: true },
      { shape: 'sphere', r: 0.14, p: [0.28, 0.2, 0.82], c: 'eye', mirror: true },
    ],
  },
  boulder: {
    palette: { rock: '#9a6b3f', rock2: '#7a5230', moss: '#6faf3a' },
    parts: [
      { shape: 'sphere', r: 2.2, c: 'rock', m: 'matte' },
      { shape: 'sphere', r: 0.9, p: [1.4, 0.8, 0.6], c: 'rock2', m: 'matte' },
      { shape: 'sphere', r: 0.8, p: [-1.2, -0.4, 1.3], c: 'rock2', m: 'matte' },
      { shape: 'sphere', r: 1.0, s: [1.2, 0.4, 1.2], p: [0, 1.8, 0], c: 'moss', m: 'matte' },
    ],
  },
  tornado: {
    palette: { a: '#f4fbff', b: '#cfeaff' },
    parts: [
      { shape: 'torus', r: 0.5, tube: 0.25, rot: [90, 0, 0], p: [0, 0.3, 0], c: 'a', m: 'soft' },
      { shape: 'torus', r: 0.9, tube: 0.3, rot: [90, 0, 0], p: [0.2, 1.2, 0], c: 'b', m: 'soft' },
      { shape: 'torus', r: 1.4, tube: 0.35, rot: [90, 0, 0], p: [-0.2, 2.2, 0], c: 'a', m: 'soft' },
      { shape: 'torus', r: 1.9, tube: 0.4, rot: [90, 0, 0], p: [0.2, 3.3, 0], c: 'b', m: 'soft' },
    ],
  },
  harpoon: {
    palette: { shaft: '#5a5f6e', tip: '#d8dee6', rope: '#c89a5e' },
    parts: [
      { shape: 'cyl', r: 0.08, h: 1.6, rot: [90, 0, 0], c: 'shaft', m: 'metal' },
      { shape: 'cone', r: 0.25, h: 0.6, p: [0, 0, 0.8], rot: [90, 0, 0], c: 'tip', m: 'metal' },
      { shape: 'cone', r: 0.12, h: 0.35, p: [0.18, 0, 0.75], rot: [-60, 0, 0], c: 'tip', mirror: true },
    ],
  },
  bolt: {
    palette: { c: '#3de0ff', w: '#ffffff' },
    parts: [{ shape: 'sphere', r: 0.28, c: 'c', m: 'glow' }, { shape: 'sphere', r: 0.14, c: 'w', m: 'glow', p: [0, 0, 0.2] }],
  },
  drone: {
    palette: { body: '#2f66c7', trim: '#e8b53a', lens: '#fff6a8', prop: '#1a1426' },
    parts: [
      { shape: 'box', size: [0.9, 0.5, 0.9], round: 0.15, c: 'body' },
      { shape: 'sphere', r: 0.18, p: [0, 0, 0.45], c: 'lens', m: 'glow' },
      { shape: 'cyl', r: 0.05, h: 0.3, p: [0.45, 0.3, 0.45], c: 'trim', mirror: true },
      { shape: 'cyl', r: 0.05, h: 0.3, p: [0.45, 0.3, -0.45], c: 'trim', mirror: true },
      { shape: 'box', size: [0.5, 0.03, 0.08], p: [0.45, 0.46, 0.45], c: 'prop', mirror: true },
      { shape: 'box', size: [0.5, 0.03, 0.08], p: [0.45, 0.46, -0.45], c: 'prop', mirror: true },
    ],
  },
  roots: {
    palette: { bark: '#6b4a2e', thorn: '#d9b98a', leaf: '#5daf3a' },
    parts: [
      { shape: 'tube', points: [[-1.8, 0, 0], [-0.8, 0.9, 0.2], [0.4, 0.5, -0.2], [1.8, 0.1, 0]], r0: 0.35, r1: 0.12, c: 'bark', m: 'matte' },
      { shape: 'tube', points: [[-1.2, 0, 0.6], [0, 1.3, 0.3], [1.2, 0.2, 0.5]], r0: 0.28, r1: 0.1, c: 'bark', m: 'matte' },
      { shape: 'cone', r: 0.12, h: 0.45, p: [-0.8, 1.1, 0.2], c: 'thorn' },
      { shape: 'cone', r: 0.12, h: 0.45, p: [0.1, 1.45, 0.3], c: 'thorn' },
      { shape: 'cone', r: 0.12, h: 0.45, p: [0.7, 0.7, -0.1], rot: [0, 0, -30], c: 'thorn' },
      { shape: 'sphere', r: 0.25, s: [1, 0.4, 1.6], p: [0.9, 0.5, 0.5], c: 'leaf' },
    ],
  },
  chest: {
    palette: { wood: '#a0642e', band: '#ffc21a', dark: '#5a3418' },
    parts: [
      { shape: 'box', size: [1.4, 0.8, 1], round: 0.08, p: [0, 0.4, 0], c: 'wood' },
      { shape: 'cyl', r: 0.5, h: 1.4, p: [0, 0.8, 0], rot: [0, 0, 90], s: [1, 1, 1], c: 'wood' },
      { shape: 'box', size: [0.16, 1.4, 1.08], p: [0.45, 0.6, 0], c: 'band', m: 'metal', mirror: true },
      { shape: 'box', size: [0.25, 0.3, 0.1], p: [0, 0.75, 0.52], c: 'band', m: 'metal' },
    ],
  },
  ball: {
    palette: { ball: '#3a3a44', spike: '#9a9da8' },
    parts: [
      { shape: 'sphere', r: 0.55, c: 'ball', m: 'metal' },
      { shape: 'cone', r: 0.14, h: 0.4, p: [0, 0.5, 0], c: 'spike' },
      { shape: 'cone', r: 0.14, h: 0.4, p: [0, -0.5, 0], rot: [180, 0, 0], c: 'spike' },
      { shape: 'cone', r: 0.14, h: 0.4, p: [0.5, 0, 0], rot: [0, 0, -90], c: 'spike', mirror: true },
      { shape: 'cone', r: 0.14, h: 0.4, p: [0, 0, 0.5], rot: [90, 0, 0], c: 'spike' },
      { shape: 'cone', r: 0.14, h: 0.4, p: [0, 0, -0.5], rot: [-90, 0, 0], c: 'spike' },
    ],
  },
  shroom: {
    palette: { cap: '#ff5a3d', dot: '#ffffff', stem: '#fff2d6' },
    parts: [
      { shape: 'cyl', rt: 0.28, rb: 0.32, h: 0.5, p: [0, 0.25, 0], c: 'stem' },
      { shape: 'sphere', r: 0.6, s: [1, 0.7, 1], hemi: true, p: [0, 0.45, 0], c: 'cap' },
      { shape: 'sphere', r: 0.12, s: [1, 0.5, 1], p: [0.3, 0.75, 0.2], c: 'dot', mirror: true },
    ],
  },
};
