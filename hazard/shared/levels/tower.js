// HAZARD PAY — JOB 02: THE TOWER
//
// The warehouse taught you to carry things ACROSS a floor. This one only has
// one verb and it is DOWN. Five plates of a half-finished office block, no
// lift, no edge protection worth the name, and a skip in the yard nineteen
// metres below everything that is worth money.
//
// The level is a sorting problem disguised as a climb. A safe does not care
// how it reaches the ground, so a safe goes down the lift shaft. A chandelier
// cares enormously, so a chandelier walks down five flights of site stair in
// somebody's hands while their colleague throws vending machines past them.
// Which of the two you are is decided in the first thirty seconds and argued
// about for the remaining seven minutes.
//
// Layout, looking down (north = -Z):
//
//                       [ NORTH SCAFFOLD, ground -> L3 ]
//                    ====== ladders and 600mm boards ======
//   +----------------------------------------------------------+
//   |  [STAIR]  ==bridge==  +----------------+                  |
//   |  [TOWER]              |   CORE PLATES  |  ==board==       |
//   |  [ 0-L5]  ==bridge==  |  L1..L5   [][] |  [EAST DECK]     |
//   |                       |    chute  [][] |    \             |
//   |                       +----------------+     \ COLLAPSED  |
//   |                                               \  SLAB     |
//   |            [SKIP]                     [HUT]               |
//   +----------------------------------------------------------+
//
// Vertical circulation, and it is deliberately asymmetric:
//
//   UP    the site stair tower, west. Wide, gentle, boring, and the only way
//         a piano ever reaches the yard. Five storeys of switchback.
//   UP    the north scaffold, ground to L3 only. Steep ladders and a 600mm
//         board over the gap at each plate. Quick. No handrail.
//   DOWN  the collapsed slab, L4 to the east deck. Forty-five degrees, which
//         is inside the character controller's climb limit and well outside
//         its slide limit, so it is a slide and never a climb. Props slide
//         down it too, which is either a delivery system or a disaster.
//   DOWN  the lift shaft. A 3.4m hole through all five plates onto bare
//         concrete. Free, instant, and it destroys anything with a fragility
//         rating. This is the level.

import { box, shell, catwalk, prop, scatter, light } from './build.js';

// --- local helpers ----------------------------------------------------------
// build.js owns the shared vocabulary; these two are specific to a building
// with holes in its floors, so they live here rather than widening that file.

/**
 * A floor plate with one rectangular void in it, as four boxes.
 *
 * `y` is the WALKING SURFACE, not the centre — every other number in a level
 * file is a height you can stand on, and a plate that is the exception is how
 * you end up authoring a prop 300mm inside its own floor. The void must sit
 * strictly inside the plate; four strips with shared edges leave no seam for a
 * mug to fall through.
 */
function plate(y, x0, x1, z0, z1, hole, mat = 'deckplate', t = 0.3) {
  const [hx0, hx1, hz0, hz1] = hole;
  const cy = y - t / 2;
  const strip = (a0, a1, b0, b1) => box(
    [(a0 + a1) / 2, cy, (b0 + b1) / 2], [a1 - a0, t, b1 - b0], mat, { tag: 'plate' },
  );
  return [
    strip(x0, x1, z0, hz0),   // south of the void
    strip(x0, x1, hz1, z1),   // north of it
    strip(x0, hx0, hz0, hz1), // west
    strip(hx1, x1, hz0, hz1), // east
  ];
}

/**
 * A straight run of steps between two heights, along one axis.
 *
 * Unlike build.js's `stairs`, every step is a closed box that reaches down to
 * the one below it rather than to the ground — which is the only way to put a
 * flight at the fourth storey without also putting a nineteen-metre column of
 * concrete underneath it.
 *
 * `rise` is a maximum, not a target. MAX_STEP is 0.42m: at 0.42 the autostep
 * is deciding on a knife edge every frame and at 0.43 the staircase is a wall.
 * 0.30 for something you carry a bath down, 0.38 for something called a ladder.
 */
function flight(from, to, width, rise = 0.30, mat = 'grate') {
  const dy = to[1] - from[1];
  const n = Math.max(1, Math.ceil(dy / rise));
  const dx = (to[0] - from[0]) / n;
  const dz = (to[2] - from[2]) / n;
  const step = dy / n;
  const alongX = Math.abs(to[0] - from[0]) > Math.abs(to[2] - from[2]);
  const out = [];
  for (let i = 0; i < n; i++) {
    const top = from[1] + step * (i + 1);
    const h = step + 0.06;  // overlap the step below, so there is no daylight
    out.push(box(
      [from[0] + dx * (i + 0.5), top - h / 2, from[2] + dz * (i + 0.5)],
      alongX ? [Math.abs(dx) + 0.02, h, width] : [width, h, Math.abs(dz) + 0.02],
      mat, { tag: 'stair' },
    ));
  }
  return out;
}

/** A flat deck panel whose TOP sits at y. */
const deck = (y, x0, x1, z0, z1, mat = 'grate', t = 0.18, tag = 'catwalk') => box(
  [(x0 + x1) / 2, y - t / 2, (z0 + z1) / 2], [x1 - x0, t, z1 - z0], mat, { tag },
);

// --- the numbers everything else is derived from ----------------------------
const LV = [0, 4.0, 7.8, 11.6, 15.4, 19.2];   // walking surface of each plate

const PX0 = -6.5, PX1 = 6.5;                  // core plate footprint
const PZ0 = -6.5, PZ1 = 6.5;
const HX0 = 2.0, HX1 = 5.4;                   // the lift shaft, through all five
const HZ0 = 2.0, HZ1 = 5.4;
const HOLE = [HX0, HX1, HZ0, HZ1];

const SA = -13.75, SB = -11.65;               // stair tower: the two flight bays
const SW = 2.1;                               // flight width
const SZ0 = -3.2, SZ1 = 3.2;                  // flight run
const SLS = -3.9, SLN = 3.9;                  // landing centres, south and north

const brushes = [
  // --- the site ------------------------------------------------------------
  // Open to the sky. The walls are the neighbours' flank walls and they are the
  // only reason a thrown extinguisher is ever seen again.
  ...shell(0, 0, 44, 44, 26, 'concrete', 0.8, { open: true, wallMat: 'panel' }),

  // --- the frame -----------------------------------------------------------
  ...[[-5.9, -5.9], [5.9, -5.9], [-5.9, 5.9], [5.9, 5.9],
    [0, -5.9], [0, 5.9], [-5.9, 0], [5.9, 0]].map(
    ([x, z]) => box([x, 9.75, z], [0.5, 19.5, 0.5], 'steelblue', { tag: 'column' }),
  ),

  // --- the plates ----------------------------------------------------------
  // Kick rails on the east and south edges only. The north edge is where the
  // boards land and the west edge is where the bridges land; the missing two
  // sides are, broadly, why anybody is being paid hazard rates.
  ...LV.slice(1).flatMap((y) => [
    ...plate(y, PX0, PX1, PZ0, PZ1, HOLE),
    box([PX1 - 0.06, y + 0.15, 0], [0.12, 0.3, PZ1 - PZ0], 'railing', { tag: 'rail', thin: true }),
    box([0, y + 0.15, PZ1 - 0.06], [PX1 - PX0, 0.3, 0.12], 'railing', { tag: 'rail', thin: true }),
  ]),

  // --- the site stair tower, west ------------------------------------------
  // Two bays, switchback, a landing at every plate. The east face is open,
  // because the east face is where the scaffold used to be tied in.
  ...LV.slice(0, 5).flatMap((base, k) => {
    const top = LV[k + 1];
    const mid = (base + top) / 2;
    return [
      ...flight([SA, base, SZ0], [SA, mid, SZ1], SW),
      deck(mid, -14.8, -10.6, SLN - 0.7, SLN + 0.7),
      ...flight([SB, mid, SZ1], [SB, top, SZ0], SW),
      deck(top, -14.8, -10.6, SLS - 0.7, SLS + 0.7),
      // ...and the bridge from that landing to the plate it serves.
      ...catwalk([-8.55, top - 0.125, SLS], [4.3, 0.25, 1.8]),
    ];
  }),
  box([-14.9, 9.8, 0], [0.1, 19.6, 9.4], 'panel', { tag: 'wall', thin: true }),
  box([-12.7, 9.8, 4.65], [4.4, 19.6, 0.1], 'panel', { tag: 'wall', thin: true }),
  box([-12.7, 9.8, -4.65], [4.4, 19.6, 0.1], 'panel', { tag: 'wall', thin: true }),

  // --- the north scaffold, ground to L3 ------------------------------------
  // Three ladder runs, alternating direction, with a lift board at each plate.
  // The 700mm gap between the scaffold and the building is spanned by one
  // 600mm board with nothing either side of it. It is a legal working platform
  // in the sense that nobody has yet fallen off it.
  ...flight([-4.6, LV[0], -9.4], [-0.4, LV[1], -9.4], 1.1, 0.38),
  ...flight([4.6, LV[1], -9.4], [0.4, LV[2], -9.4], 1.1, 0.38),
  ...flight([-4.6, LV[2], -9.4], [-0.4, LV[3], -9.4], 1.1, 0.38),
  deck(LV[1], -0.4, 4.8, -10.6, -7.2),
  deck(LV[2], -4.8, 0.4, -10.6, -7.2),
  deck(LV[3], -0.4, 4.8, -10.6, -7.2),
  box([2.6, LV[1] - 0.05, -6.85], [0.6, 0.1, 1.7], 'plank', { tag: 'plank' }),
  box([-2.6, LV[2] - 0.05, -6.85], [0.6, 0.1, 1.7], 'plank', { tag: 'plank' }),
  box([2.6, LV[3] - 0.05, -6.85], [0.6, 0.1, 1.7], 'plank', { tag: 'plank' }),
  ...[[-4.9, -10.4], [-4.9, -7.4], [0, -10.4], [0, -7.4], [4.9, -10.4], [4.9, -7.4]].map(
    ([x, z]) => box([x, 6.0, z], [0.12, 12.0, 0.12], 'steelblue', { tag: 'strut' }),
  ),

  // --- the east deck and the collapsed slab --------------------------------
  // A floor of L4 came down in one piece and landed against the east deck at
  // forty-five degrees. MAX_SLOPE is 0.86rad so the controller calls it ground;
  // the slide angle is 0.62rad so it never lets you stand still on it. You go
  // down it whether or not that was the plan.
  deck(LV[3], 8.4, 11.8, -3.6, -0.4),
  box([7.45, LV[3] - 0.05, -2.0], [2.1, 0.1, 0.6], 'plank', { tag: 'plank' }),
  ...[[8.6, -3.4], [8.6, -0.6], [11.6, -3.4], [11.6, -0.6]].map(
    ([x, z]) => box([x, 5.8, z], [0.14, 11.6, 0.14], 'steelblue', { tag: 'strut' }),
  ),
  box([8.55, 13.35, -2.0], [5.38, 0.42, 3.2], 'concrete', {
    tag: 'slab', r: [0, 0, -Math.PI / 4],
  }),

  // --- the hoist frame, roof ----------------------------------------------
  // It has no motor. It has never had a motor.
  box([1.7, 20.75, 3.7], [0.3, 3.1, 0.3], 'steelblue', { tag: 'strut' }),
  box([5.7, 20.75, 3.7], [0.3, 3.1, 0.3], 'steelblue', { tag: 'strut' }),
  box([3.7, 22.15, 3.7], [4.3, 0.3, 0.3], 'steelblue', { tag: 'beam' }),

  // --- the yard ------------------------------------------------------------
  // The skip is a 150mm steel pad with a 300mm kerb on three sides, open to
  // the west. Low on purpose: you have to be able to CROUCH beside it and set
  // a chandelier down, because a chandelier dropped 200mm is a bag of glass.
  box([12.5, 0.075, 11.0], [7.0, 0.15, 5.0], 'deckplate', { tag: 'dock' }),
  box([16.15, 0.35, 11.0], [0.3, 0.4, 5.0], 'steelblue', { tag: 'kerb' }),
  box([12.5, 0.35, 13.35], [7.6, 0.4, 0.3], 'steelblue', { tag: 'kerb' }),
  box([12.5, 0.35, 8.65], [7.6, 0.4, 0.3], 'steelblue', { tag: 'kerb' }),

  // the site hut, which is locked, which is why nothing in it is on this list
  box([19.5, 1.3, 3.0], [4.0, 2.6, 3.2], 'panel', { tag: 'hut' }),
];

export const tower = {
  id: 'tower',
  name: 'THE TOWER',
  subtitle: 'JOB 02 · PHASE 2, HARROW WEALD',
  brief: 'Five plates, no lift, and a skip in the yard. Everything on this job '
    + 'has to reach the ground. Only some of it minds how.',

  env: {
    skyTop: '#0d1420', skyBottom: '#1d2634',
    fog: { color: '#131a26', near: 20, far: 96 },
    sun: { dir: [-0.30, -0.52, 0.80], color: '#a9bedd', intensity: 1.15 },
    ambient: { sky: '#3a4d68', ground: '#241f1a', intensity: 0.8 },
    exposure: 1.05,
  },

  // In the yard by the gate, on flat slab, a long way from anything that can
  // land on you. The ring at 1.8m is still bare concrete in every direction.
  spawn: [14.0, 0.1, -13.0],
  spawnYaw: 0.82,
  spawnSpread: 1.8,

  // The skip. Its floor is at 0.15 and the volume starts at 0.1, so a mug that
  // rolls in still counts and a mug that lands on the kerb does not.
  extract: { p: [12.5, 1.0, 11.0], s: [6.2, 1.8, 4.2] },

  quota: 7600,
  timeLimit: 450,

  brushes,

  lights: [
    // Site floods on the stair tower, pointing at the only route a piano has.
    light([-11.0, 5.4, 0], { intensity: 26, range: 17, color: '#ffe0ac' }),
    light([-11.0, 13.0, 0], { intensity: 26, range: 17, color: '#ffe0ac' }),
    light([-11.0, 19.6, 0], { intensity: 24, range: 16, color: '#ffe0ac' }),
    // Scaffold lamps, one per lift, wired off the same generator and it shows.
    light([1.6, 5.2, -9.0], { intensity: 20, range: 14, color: '#ffd79a' }),
    light([-1.6, 9.0, -9.0], { intensity: 20, range: 14, color: '#ffd79a', flicker: 0.3 }),
    light([1.6, 12.8, -9.0], { intensity: 20, range: 14, color: '#ffd79a' }),
    // The plates themselves, dimly.
    light([-2.0, 6.6, 1.0], { intensity: 16, range: 15, color: '#cfd8e8' }),
    light([2.0, 14.2, -1.0], { intensity: 16, range: 15, color: '#cfd8e8' }),
    light([0.0, 21.2, 0.0], { intensity: 30, range: 22, color: '#dfe8f6' }),
    // The yard: the skip is lit and the shaft's landing zone is not.
    light([12.5, 4.2, 11.0], { intensity: 34, range: 16, color: '#bcd8ff' }),
    light([16.0, 3.4, -6.0], { intensity: 18, range: 18, color: '#ffd6a0' }),
  ],

  // Every prop is authored AT its resting height plus 20mm. Gravity is -22 and
  // a contact resolves at roughly 1.12x the impact speed, so the drop a fragile
  // thing survives is fragile^2 / 55 metres — 186mm for a mug, 82mm for a
  // chandelier. 20mm settles in three ticks and breaks nothing at all.
  props: [
    // --- L5, the roof: the reason for the job ------------------------------
    prop('chandelier', [-2.6, 19.29, -1.2]),
    prop('piano', [1.4, 19.22, -3.4], [0, 0.25, 0]),
    prop('elk', [-4.4, 19.53, 2.4], [0, 2.1, 0]),
    prop('cheque', [-1.0, 19.25, 4.6], [Math.PI / 2, 0, 0]),
    prop('fishbowl', [4.6, 19.41, -4.8]),
    prop('mug', [-5.4, 19.275, -5.0]),
    prop('mug', [-5.0, 19.275, -5.6]),
    prop('stapler', [6.0, 19.265, -0.4]),
    prop('stapler', [0.2, 19.265, 6.0]),

    // --- L4: heavy, indifferent, and directly above the shaft --------------
    prop('safe', [-3.4, 15.73, -3.0]),
    prop('serverrack', [-4.8, 16.39, 1.4]),
    prop('vending', [3.8, 16.35, -4.6]),
    prop('crt', [0.6, 15.63, -1.2]),
    prop('crt', [1.6, 15.63, 0.4]),
    prop('officechair', [-1.4, 15.435, 4.4]),
    prop('printer', [-5.8, 15.56, -5.6]),
    prop('extinguisher', [6.0, 15.68, 2.6]),

    // --- L3: the two-person floor ------------------------------------------
    prop('bathtub', [-3.6, 11.64, 1.2], [0, 0.35, 0]),
    prop('generator', [3.2, 12.08, -3.8]),
    prop('printer', [-5.6, 11.76, -2.2]),
    prop('crt', [0.4, 11.83, 4.8]),
    prop('ladder', [-1.2, 11.85, -5.2], [0, 0, Math.PI / 2]),
    prop('extinguisher', [5.8, 11.88, -1.4]),
    prop('mug', [-4.6, 11.675, 4.2]),
    prop('mug', [-4.2, 11.675, 3.6]),
    prop('stapler', [1.8, 11.665, -1.8]),

    // --- L2 ------------------------------------------------------------------
    prop('vending', [-4.6, 8.75, 3.4]),
    prop('officechair', [1.8, 7.835, -4.2]),
    prop('printer', [5.6, 7.96, -1.0]),
    prop('fishbowl', [-1.4, 8.01, -2.4]),
    prop('extinguisher', [-6.0, 8.08, 5.6]),
    prop('extinguisher', [6.0, 8.08, -5.8]),
    prop('mug', [-2.0, 7.875, 5.4]),
    prop('mug', [-2.6, 7.875, 4.8]),
    prop('stapler', [3.4, 7.865, 4.0]),

    // --- L1: whatever was too heavy to get any further up ------------------
    prop('crt', [4.6, 4.23, -3.2]),
    prop('printer', [-3.2, 4.16, 3.6]),
    prop('officechair', [-5.2, 4.035, -1.6]),
    prop('ladder', [-2.6, 4.25, 5.4], [0, 0, Math.PI / 2]),
    prop('extinguisher', [5.4, 4.28, 5.6]),
    prop('stapler', [-4.0, 4.065, -4.6]),
    prop('stapler', [0.8, 4.065, -5.4]),
    prop('mug', [3.0, 4.075, -5.0]),

    // --- the yard ------------------------------------------------------------
    prop('crt', [10.4, 0.23, -3.0]),
    prop('officechair', [17.0, 0.035, 8.0]),
    prop('extinguisher', [8.6, 0.28, 13.0]),
    prop('extinguisher', [-8.0, 0.28, 12.0]),
    ...scatter('mug', [13, 0.055, 0], [8, 0.1, 16], 6, 3),
    ...scatter('stapler', [-11, 0.045, 9], [10, 0.1, 6], 5, 7),
  ],

  tasks: [
    {
      id: 'quota', type: 'extract_value', target: 7600,
      title: 'MEET THE QUOTA',
      detail: 'Get £7,600 of it into the skip. How it gets there is between '
        + 'you and the coroner.',
    },
    {
      id: 'chandelier', type: 'extract_kind', kind: 'chandelier', count: 1,
      // No bonus, so this one gates the job: room.js treats an unbonused task
      // as mandatory. It is the only object on site that cannot be thrown.
      title: 'THE CHANDELIER',
      detail: 'Nineteen metres, in your hands, one flight at a time. It breaks '
        + 'at 2.2m/s, which is a fall of eighty millimetres.',
    },
    {
      id: 'intact', type: 'no_breakages', limit: 3,
      title: 'BREAK LESS THAN FOUR THINGS',
      detail: 'The shaft is not a chute. It is, in practice, a chute.',
      bonus: 700,
    },
    {
      id: 'piano', type: 'extract_kind', kind: 'piano', count: 1,
      title: 'THE PIANO, AGAIN',
      detail: 'Somebody got it onto the roof. That was their afternoon. '
        + 'Two of you, five flights, and it does not fit down the shaft.',
      bonus: 1200,
    },
  ],
};
