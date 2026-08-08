// HAZARD PAY — JOB 01: THE WAREHOUSE
//
// The teaching level. One big shed, a quota, and a van. Everything valuable is
// either heavy, fragile, or on a shelf you cannot reach alone, so the level
// teaches all three verbs — haul, don't drop, boost a friend — without ever
// saying so.
//
// Layout, looking down (north = -Z):
//
//   +--------------------------------------------------+
//   |  [MEZZANINE 4.2m]          racking   racking      |
//   |         stairs                                    |
//   |                       CONVEYOR                    |
//   |  racking      +-----------+          racking      |
//   |               |   PIT     |                       |
//   |  racking      +-----------+          racking      |
//   |                                                   |
//   |          [====== LOADING DOCK ======]             |
//   +--------------------------------------------------+

import { box, shell, racking, stairs, catwalk, prop, scatter, light } from './build.js';

const W = 46, D = 34, H = 9.5;

const brushes = [
  ...shell(0, 0, W, D, H, 'concrete', 0.7, { wallMat: 'panel', ceilMat: 'deckplate' }),

  // --- the pit: an open inspection trench, dead centre, unlit ---------------
  box([0, -1.4, 1.0], [7.0, 0.6, 5.0], 'concrete', { tag: 'pitfloor' }),
  box([-3.8, -0.55, 1.0], [0.5, 1.7, 5.0], 'concrete'),
  box([3.8, -0.55, 1.0], [0.5, 1.7, 5.0], 'concrete'),
  box([0, -0.55, -1.8], [7.0, 1.7, 0.5], 'concrete'),
  box([0, -0.55, 3.8], [7.0, 1.7, 0.5], 'concrete'),
  // ...and the plank somebody left across it, which will not hold a piano
  box([0, 0.06, 2.2], [8.6, 0.12, 0.9], 'plank', { tag: 'plank' }),

  // --- racking rows --------------------------------------------------------
  ...racking(-15, -9, 4, 3),
  ...racking(-15, 2, 4, 3),
  ...racking(-15, 11, 3, 2),
  ...racking(14, -9, 4, 3),
  ...racking(14, 2, 4, 3),
  ...racking(14, 11, 3, 2),

  // --- mezzanine over the north-west corner --------------------------------
  box([-13, 4.2, -13.5], [18, 0.35, 6.5], 'deckplate', { tag: 'mezz' }),
  ...catwalk([2, 4.2, -13.5], [12, 0.3, 2.0]),
  ...stairs([-4.2, 0, -9.5], [-4.2, 4.2, -13.0], 1.5),
  box([-22, 2.1, -13.5], [0.2, 4.2, 6.5], 'railing', { tag: 'rail', thin: true }),

  // --- conveyor: a moving hazard that is also a shortcut --------------------
  box([0, 0.95, -6.5], [26, 0.25, 1.6], 'rubber', { tag: 'conveyor', drift: [1.9, 0, 0] }),
  box([0, 0.45, -6.5], [26, 0.7, 0.3], 'steelblue'),

  // --- loading dock: the van, and the ramp up to it ------------------------
  box([0, 0.6, 14.2], [12, 1.2, 5.0], 'deckplate', { tag: 'dock' }),
  box([0, 0.3, 10.8], [6.0, 0.6, 2.2], 'deckplate', { tag: 'ramp', ramp: true }),
  box([-6.4, 2.2, 14.2], [0.3, 3.2, 5.0], 'panel'),
  box([6.4, 2.2, 14.2], [0.3, 3.2, 5.0], 'panel'),
  box([0, 3.9, 14.2], [12.8, 0.3, 5.0], 'panel'),
];

export const warehouse = {
  id: 'warehouse',
  name: 'THE WAREHOUSE',
  subtitle: 'JOB 01 · UNIT 7, CRAYFORD',
  brief: 'Clear the unit. Anything not bolted down is billable. Mind the pit — '
    + 'the plank is rated for one contractor and you are going to test that.',

  env: {
    skyTop: '#20242c', skyBottom: '#3a3129',
    // The unit is 46m across its diagonal; fog starting at 14m and ending at
    // 74m never engages, so distance reads as flat.
    fog: { color: '#23252b', near: 6, far: 42 },
    sun: { dir: [-0.35, -0.82, -0.45], color: '#ffd9a8', intensity: 1.5 },
    ambient: { sky: '#5b6472', ground: '#2b2521', intensity: 0.85 },
    exposure: 1.0,
  },

  // On the dock (its deck is at y=1.2), well inside the shell — the spawn ring
  // has to fit within the level or the last contractor starts in a wall.
  spawn: [0, 1.35, 13.4],
  spawnYaw: Math.PI,
  spawnSpread: 1.7,

  // The van bed, sitting on the dock. A prop that comes to rest in here and
  // stays put is money.
  extract: { p: [0, 2.05, 15.4], s: [8.0, 1.9, 2.4] },

  quota: 5200,
  timeLimit: 330,

  brushes,

  lights: [
    light([-14, 8.4, -9], { intensity: 34, range: 22, color: '#ffe2b4' }),
    light([14, 8.4, -9], { intensity: 34, range: 22, color: '#ffe2b4' }),
    light([-14, 8.4, 5], { intensity: 34, range: 22, color: '#ffe2b4' }),
    light([14, 8.4, 5], { intensity: 34, range: 22, color: '#ffe2b4' }),
    light([0, 8.4, -14], { intensity: 26, range: 20, color: '#ffd9a0' }),
    light([0, 3.6, 13.6], { intensity: 40, range: 15, color: '#cfe4ff' }),
    // the pit has one failing tube, because of course it does
    light([0, 1.2, 1.0], { intensity: 7, range: 8, color: '#9fffc0', flicker: 0.55 }),
  ],

  props: [
    // top decks: the payday, and out of reach without a boost
    prop('safe', [-15.2, 6.6, -9]),
    prop('serverrack', [14.4, 6.6, 2]),
    prop('elk', [-14, 6.6, 2]),
    prop('chandelier', [13.6, 6.6, -9]),

    // mid decks: reachable, awkward
    prop('crt', [-16.4, 4.4, -9]), prop('crt', [-14.0, 4.4, -9]),
    prop('printer', [15.0, 4.4, -9]), prop('printer', [12.8, 4.4, 2]),
    prop('vending', [-13.0, 2.3, 11]),
    prop('cheque', [14.0, 4.4, 11], [0, 0.4, 0]),

    // floor: the two-person problems
    prop('piano', [-7.5, 0.7, -2.5], [0, 0.3, 0]),
    prop('bathtub', [8.0, 0.6, 6.5], [0, -0.5, 0]),
    prop('generator', [6.5, 0.6, -12.0]),

    // mezzanine
    prop('officechair', [-16, 4.6, -13.5]),
    prop('officechair', [-11, 4.6, -13.5], [0, 1.2, 0]),
    prop('fishbowl', [-8.0, 4.6, -13.5]),
    prop('ladder', [2, 4.6, -13.5], [0, 0, 1.4]),

    // the conveyor, which will deliver these to somebody's shins
    prop('extinguisher', [-9, 1.3, -6.5], [0, 0, 1.57]),
    prop('mug', [-6, 1.2, -6.5]),
    prop('stapler', [-3, 1.2, -6.5]),

    ...scatter('mug', [0, 0.2, 6], [22, 0.1, 10], 9, 3),
    ...scatter('stapler', [0, 0.2, 0], [24, 0.1, 16], 6, 7),
    ...scatter('extinguisher', [0, 0.4, -3], [26, 0.1, 18], 5, 11),
  ],

  tasks: [
    {
      id: 'quota', type: 'extract_value', target: 5200,
      title: 'MEET THE QUOTA',
      detail: 'Load £5,200 of stock into the van.',
    },
    {
      id: 'fragile', type: 'no_breakages', limit: 3,
      title: 'BREAK LESS THAN FOUR THINGS',
      detail: 'Breakages come out of your pay. Three is tolerated.',
      bonus: 600,
    },
    {
      id: 'piano', type: 'extract_kind', kind: 'piano', count: 1,
      title: 'THE PIANO',
      detail: 'It weighs 220kg. It is not going to move itself.',
      bonus: 900,
    },
  ],
};
