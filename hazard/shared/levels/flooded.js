// HAZARD PAY — JOB 03: THE FLOODED PLANT
//
// The tower was one verb repeated nineteen metres. This is the opposite shape:
// three tanks sunk into a pumping station's deck, everything worth money at the
// bottom of one of them, and a lorry parked two metres up where the water will
// not reach. Nothing here has to be thrown anywhere. Everything has to come UP,
// out of a hole, in an order, before the hole fills.
//
// The order is the level. The intake gate feeds the filter bed, the filter bed
// drains to the main sump, and the sump is what the pumps are supposed to be
// emptying, which they are not, because the pump motor is sitting in nine
// inches of water at the bottom of it and is worth two thousand two hundred
// pounds. Shut the valves in the wrong order and you flood the tank you were
// about to climb into.
//
// Layout, looking down (north = -Z):
//
//   +---------------------------------------------------------------+
//   |  [CONTROL ROOM 4.6m]        gantry, 4.6m, over the lot         |
//   |     V1                                                         |
//   |  +-----------+     +-----------------+     +-----------+       |
//   |  | FILTER BED|     |    MAIN SUMP    |     |  SLUDGE   |       |
//   |  |   -2.0    |     |      -4.4       |     |   -2.8    |       |
//   |  +-----------+     +--------------V2-+     +---V3------+       |
//   |                                                                |
//   |                         plant deck, 0.0      [== LORRY 2.2 ==] |
//   +---------------------------------------------------------------+
//
// The tanks are not equally generous. The filter bed has a ramp, so the bath
// comes out of it. The main sump has a fourteen-tread stair down its north
// side, which is the only reason the pump motor is theoretically movable. The
// sludge tank has a companionway and nothing else, so whatever is at the bottom
// of it either fits in one pair of hands or stays there.
//
// WHAT IS NOT WIRED YET. The valves are real geometry and real level data and
// the server has no idea what they are: there is no `operate_in_order` task and
// no flood. The job below is complete and winnable without either — the clock
// is the deadline and the depth is the hazard — and shared/levels/README.md
// specifies exactly what the two new task types need to do.

import { box, shell, prop, scatter, light } from './build.js';

// --- local helpers ----------------------------------------------------------

/**
 * A tank sunk into the deck: its floor and its four linings.
 *
 * The linings sit OUTSIDE the named rectangle and run from below the tank floor
 * up to deck level, so the rectangle is the clear internal dimension and the
 * deck strips that butt onto it never have to know how thick anything is.
 */
function tank(x0, x1, z0, z1, floor, mat = 'concrete', t = 0.4) {
  const h = -floor + 0.6;
  const cy = floor + h / 2 - 0.6;
  return [
    box([(x0 + x1) / 2, floor - 0.25, (z0 + z1) / 2],
      [x1 - x0 + t * 2, 0.5, z1 - z0 + t * 2], mat, { tag: 'tankfloor' }),
    box([x0 - t / 2, cy, (z0 + z1) / 2], [t, h, z1 - z0 + t * 2], mat, { tag: 'tankwall' }),
    box([x1 + t / 2, cy, (z0 + z1) / 2], [t, h, z1 - z0 + t * 2], mat, { tag: 'tankwall' }),
    box([(x0 + x1) / 2, cy, z0 - t / 2], [x1 - x0, h, t], mat, { tag: 'tankwall' }),
    box([(x0 + x1) / 2, cy, z1 + t / 2], [x1 - x0, h, t], mat, { tag: 'tankwall' }),
  ];
}

/** A slab of deck whose TOP sits at y. */
const slab = (y, x0, x1, z0, z1, mat = 'concrete', t = 0.7, tag = 'floor') => box(
  [(x0 + x1) / 2, y - t / 2, (z0 + z1) / 2], [x1 - x0, t, z1 - z0], mat, { tag },
);

/** A length of handrail along one edge, at 1.1m. */
const rail = (y, x0, x1, z0, z1) => box(
  [(x0 + x1) / 2, y + 0.55, (z0 + z1) / 2],
  [Math.max(0.06, x1 - x0), 1.1, Math.max(0.06, z1 - z0)],
  'railing', { tag: 'rail', thin: true },
);

/**
 * A walkway, railed along its two LONG sides.
 *
 * build.js's `catwalk` rails the two Z faces, which is right for a walkway
 * running along X and walls off both ends of one running along Z. Every gantry
 * on this job runs one way or the other, so the helper works out which.
 */
function walkway(y, x0, x1, z0, z1, t = 0.25) {
  const out = [slab(y, x0, x1, z0, z1, 'grate', t, 'catwalk')];
  if (x1 - x0 >= z1 - z0) {
    out.push(rail(y, x0, x1, z0, z0), rail(y, x0, x1, z1, z1));
  } else {
    out.push(rail(y, x0, x0, z0, z1), rail(y, x1, x1, z0, z1));
  }
  return out;
}

/**
 * Steps between two heights along one axis, closed underneath.
 *
 * The same shape as the tower's, and the same hard-won number: a rise over
 * 0.30 turns the character controller's autostep into a negotiation. Down here
 * that matters more than it did up there, because everything on this job is
 * carried UP one of these with a hundred and ninety kilos of bath in front of
 * it, and a stair you have to fight is a stair nobody uses twice.
 */
function flight(from, to, width, rise = 0.30, mat = 'grate') {
  const dy = to[1] - from[1];
  const n = Math.max(1, Math.ceil(Math.abs(dy) / rise));
  const dx = (to[0] - from[0]) / n;
  const dz = (to[2] - from[2]) / n;
  const step = dy / n;
  const alongX = Math.abs(to[0] - from[0]) > Math.abs(to[2] - from[2]);
  const out = [];
  for (let i = 0; i < n; i++) {
    const top = from[1] + step * (i + 1);
    const h = Math.abs(step) + 0.06;
    out.push(box(
      [from[0] + dx * (i + 0.5), top - h / 2, from[2] + dz * (i + 0.5)],
      alongX ? [Math.abs(dx) + 0.02, h, width] : [width, h, Math.abs(dz) + 0.02],
      mat, { tag: 'stair' },
    ));
  }
  return out;
}

/**
 * A valve stand. Geometry today, an interaction the day the server grows one.
 *
 * Carries its own id and running order in the brush so the renderer can label
 * it and the server can find it without a second table to keep in step.
 */
const valve = (id, order, p, label) => box(
  p, [0.5, 1.15, 0.5], 'steelblue',
  { tag: 'valve', valve: id, order, label },
);

// --- the plant ---------------------------------------------------------------
const DECK = 0;                                  // the plant deck
const BED = [-21, -12, -5, 5], BED_Y = -2.0;     // filter bed
const SUMP = [-7, 5, -5, 5], SUMP_Y = -4.4;      // main sump
const SLUDGE = [9, 17, -5, 5], SLUDGE_Y = -2.8;  // sludge tank
const GANTRY = 4.6;

const brushes = [
  // Shell without its floor: the deck below is cut into three holes, and a slab
  // with a hole in it is not a shell. Walls and roof only.
  ...shell(0, 0, 52, 32, 13, 'concrete', 0.7, { wallMat: 'panel', ceilMat: 'deckplate' })
    .filter((b) => b.tag !== 'floor'),

  // --- the plant deck, as six strips around three holes --------------------
  slab(DECK, -26, 26, -16, -5),
  slab(DECK, -26, 26, 5, 16),
  slab(DECK, -26, BED[0], -5, 5),
  slab(DECK, BED[1], SUMP[0], -5, 5),
  slab(DECK, SUMP[1], SLUDGE[0], -5, 5),
  slab(DECK, SLUDGE[1], 26, -5, 5),

  // --- the three tanks -----------------------------------------------------
  ...tank(...BED, BED_Y),
  ...tank(...SUMP, SUMP_Y),
  ...tank(...SLUDGE, SLUDGE_Y),

  // Every way into a tank starts flush with the deck edge it cuts through. Set
  // one 800mm short and the first step of the descent is a four metre fall into
  // the gap behind it, which is invisible from the deck and fatal from it.
  //
  // filter bed: the wash-down ramp, 15 degrees, the only slope on this job a
  // cast iron bath will come back up.
  ...flight([-19.5, DECK, 4.9], [-19.5, BED_Y, -0.5], 2.4),
  // main sump: fifteen treads down the north side, 4.4m, the width of a pallet.
  // Everything expensive here comes out of the sump and it comes out up these.
  ...flight([-6.9, DECK, 3.6], [4.2, SUMP_Y, 3.6], 2.2),
  // ...and a companionway at the south-west for people in a hurry
  ...flight([-6.9, DECK, -3.8], [-0.4, SUMP_Y, -3.8], 1.0),
  // sludge tank: one companionway, no second option
  ...flight([16.9, DECK, -3.4], [11.4, SLUDGE_Y, -3.4], 1.0),

  // --- the gantry, 4.6m, dry until the very end ----------------------------
  // Up from the south deck at the west end, north along the wall, then east
  // over all three tanks. One spine, one branch, one junction.
  ...flight([-23.5, DECK, -12.0], [-23.5, GANTRY, -4.6], 1.8),
  slab(GANTRY, -24.4, -22.6, -4.6, 6.0, 'grate', 0.25, 'catwalk'),
  rail(GANTRY, -24.4, -24.4, -4.6, 6.0),
  // ...with the east handrail broken where the spine leaves it
  rail(GANTRY, -22.6, -22.6, -4.6, -1.3),
  rail(GANTRY, -22.6, -22.6, 1.3, 6.0),
  ...walkway(GANTRY, -22.6, 14, -1.3, 1.3),

  // --- the control room, north-west, off the top of the branch -------------
  slab(GANTRY, -25.2, -16.8, 6.0, 13.2, 'deckplate', 0.3, 'floor'),
  rail(GANTRY, -22.6, -16.8, 6.0, 6.0),
  rail(GANTRY, -25.2, -24.4, 6.0, 6.0),
  box([-21.0, GANTRY + 1.4, 13.4], [8.4, 2.8, 0.25], 'panel', { tag: 'wall' }),
  box([-25.4, GANTRY + 1.4, 9.6], [0.25, 2.8, 7.2], 'panel', { tag: 'wall' }),
  box([-16.6, GANTRY + 1.4, 9.6], [0.25, 2.8, 7.2], 'panel', { tag: 'wall' }),
  box([-21.0, GANTRY + 2.95, 9.6], [8.9, 0.3, 7.7], 'deckplate', { tag: 'ceiling' }),

  // --- the loading platform, south-east: the only dry ground at the end ----
  box([19.5, 1.1, -12.0], [11.0, 2.2, 7.0], 'deckplate', { tag: 'dock' }),
  box([19.5, 2.55, -15.6], [11.0, 0.7, 0.4], 'steelblue', { tag: 'kerb' }),
  box([24.8, 2.55, -12.0], [0.4, 0.7, 7.0], 'steelblue', { tag: 'kerb' }),
  ...flight([9.6, DECK, -11.7], [14.0, 2.2, -11.7], 1.8),

  // --- the valves ----------------------------------------------------------
  // Three stands, in the order the plant's own drawings say to shut them.
  valve('V1', 1, [-21.0, GANTRY + 0.575, -0.9], 'INTAKE'),
  valve('V2', 2, [3.2, DECK + 0.575, 6.0], 'FILTER BYPASS'),
  valve('V3', 3, [13.0, DECK + 0.575, 6.0], 'SLUDGE RETURN'),

  // --- pipework, because a pumping station without any is a swimming pool --
  box([-9.5, 1.4, 7.4], [33, 0.7, 0.7], 'steelblue', { tag: 'pipe' }),
  box([-9.5, 2.3, 8.6], [33, 0.5, 0.5], 'steelblue', { tag: 'pipe' }),
  box([-25.0, 1.4, 11.0], [0.7, 0.7, 8.0], 'steelblue', { tag: 'pipe' }),
  box([21.0, 3.0, 7.4], [0.7, 3.9, 0.7], 'steelblue', { tag: 'pipe' }),
];

export const flooded = {
  id: 'flooded',
  name: 'THE FLOODED PLANT',
  subtitle: 'JOB 03 · BECKTON STW, OUTFALL 4',
  brief: 'Decommissioned, allegedly. The pumps are off, the sump is filling, '
    + 'and everything on the inventory is at the bottom of it. Valves in order, '
    + 'stock on the lorry, and do not be down there when it comes up.',

  env: {
    skyTop: '#0b1412', skyBottom: '#16201d',
    fog: { color: '#101a18', near: 10, far: 58 },
    sun: { dir: [0.25, -0.86, 0.44], color: '#89a8b8', intensity: 0.55 },
    ambient: { sky: '#39525c', ground: '#1a221f', intensity: 0.9 },
    exposure: 1.0,
  },

  // On the lorry platform, which is the one surface on this job that is dry at
  // the end of it. The ring at 1.6m is all deckplate.
  spawn: [19.5, 2.35, -10.4],
  spawnYaw: 1.75,
  spawnSpread: 1.6,

  // The flatbed. You stand on it to load it, so a fishbowl can be crouched down
  // onto the deck rather than dropped the 200mm that destroys it.
  extract: { p: [19.5, 3.05, -13.2], s: [8.4, 1.8, 3.6] },

  quota: 6900,
  timeLimit: 400,

  brushes,

  lights: [
    // Emergency lighting: the green circuit is the one still on its own supply.
    light([-21.0, 6.4, 9.6], { intensity: 30, range: 13, color: '#dfeaff' }),
    light([-16.0, 3.2, 0], { intensity: 20, range: 15, color: '#a8f0c4', flicker: 0.4 }),
    light([-1.0, 3.6, 0], { intensity: 24, range: 18, color: '#cfe0e8' }),
    light([13.0, 3.2, 0], { intensity: 18, range: 14, color: '#a8f0c4', flicker: 0.55 }),
    // Down in the tanks, where the money is and the lamps are not.
    light([-16.5, -0.8, 0], { intensity: 9, range: 9, color: '#9fd8c0' }),
    light([-1.0, -2.6, 1.0], { intensity: 11, range: 11, color: '#bfe6d8' }),
    light([13.0, -1.4, 0], { intensity: 7, range: 8, color: '#9fd8c0', flicker: 0.6 }),
    // The lorry, lit like the only thing anybody cares about, which it is.
    light([19.5, 5.4, -12.0], { intensity: 40, range: 17, color: '#cfe4ff' }),
    light([-24.0, 6.0, -11.0], { intensity: 16, range: 12, color: '#ffd9a0' }),
  ],

  // Authored at rest + 20mm, same as the tower. The deepest floor on this job
  // is -4.4 and nothing is allowed to arrive there under its own steam.
  props: [
    // --- the main sump, -4.4: the payday and the drowning risk -------------
    prop('generator', [-1.0, -3.92, 1.2]),            // THE PUMP MOTOR
    prop('safe', [-4.6, -4.07, -2.6]),
    prop('serverrack', [3.2, -3.41, 0.4], [0, 0.3, 0]),
    prop('fishbowl', [1.4, -4.19, -3.6]),
    prop('crt', [-3.0, -4.17, -1.4]),
    prop('crt', [3.6, -4.17, -1.2]),
    prop('extinguisher', [-5.6, -4.12, 0.6]),
    ...scatter('mug', [0, -4.345, -1.2], [7, 0.1, 3], 4, 5),
    ...scatter('stapler', [-4.0, -4.355, -1.0], [3, 0.1, 2.4], 3, 9),

    // --- the filter bed, -2.0: heavy, and the only tank with a ramp --------
    prop('bathtub', [-16.8, -1.96, 1.6], [0, 0.5, 0]),
    prop('vending', [-14.2, -1.05, -2.2]),
    prop('elk', [-16.2, -1.67, 3.4], [0, 1.2, 0]),
    prop('printer', [-13.0, -1.84, 2.6]),
    prop('crt', [-18.6, -1.77, -3.0]),
    prop('extinguisher', [-12.8, -1.72, -1.0]),
    prop('extinguisher', [-19.4, -1.72, -3.4]),

    // --- the sludge tank, -2.8: one way in, one way out -------------------
    prop('officechair', [11.4, -2.765, 1.6]),
    prop('officechair', [14.6, -2.765, -1.8], [0, 1.9, 0]),
    prop('cheque', [12.6, -2.75, 3.4], [Math.PI / 2, 0, 0]),
    prop('fishbowl', [15.4, -2.59, 2.6]),
    prop('printer', [10.4, -2.64, -2.6]),
    prop('crt', [15.8, -2.57, 0.6]),
    prop('ladder', [13.2, -2.55, -4.4], [0, 0, Math.PI / 2]),
    ...scatter('mug', [13.0, -2.745, 0], [5, 0.1, 4], 4, 13),

    // --- the plant deck ----------------------------------------------------
    prop('piano', [-9.6, 0.02, -9.2], [0, 0.2, 0]),
    prop('vending', [6.6, 0.95, 11.4]),
    prop('officechair', [-2.0, 0.035, 11.0]),
    prop('extinguisher', [-24.2, 0.28, -2.0]),
    prop('extinguisher', [6.6, 0.28, -13.4]),
    prop('extinguisher', [23.0, 0.28, 8.0]),
    prop('crt', [-11.0, 0.23, 12.6]),
    ...scatter('mug', [0, 0.055, -11.0], [16, 0.1, 6], 5, 3),
    ...scatter('stapler', [-15.0, 0.045, -11.0], [10, 0.1, 6], 4, 17),

    // --- the control room, floor at 4.6 -----------------------------------
    prop('safe', [-21.4, 4.93, 10.8]),
    prop('serverrack', [-19.2, 5.59, 12.2]),
    prop('cheque', [-23.6, 4.65, 8.0], [Math.PI / 2, 0, 0]),
    prop('printer', [-18.0, 4.76, 7.6]),
    prop('mug', [-22.0, 4.675, 7.2]),
    prop('mug', [-21.4, 4.675, 7.8]),
    prop('stapler', [-19.6, 4.665, 9.4]),
  ],

  // Sequence data. The server does not read this yet; README.md says what it
  // should do with it. The level is complete and winnable without it.
  sequence: {
    id: 'shutdown',
    valves: [
      { id: 'V1', order: 1, label: 'INTAKE', p: [-21.0, 5.175, -0.9], floods: 'bed' },
      { id: 'V2', order: 2, label: 'FILTER BYPASS', p: [3.2, 0.575, 6.0], floods: 'sump' },
      { id: 'V3', order: 3, label: 'SLUDGE RETURN', p: [13.0, 0.575, 6.0], floods: 'sludge' },
    ],
    // Out of order and the tank named by the valve you skipped fills early.
    penalty: { kind: 'flood_zone', metres: 2.2 },
  },

  // Rising water. Also unwired: no buoyancy, no drag, no drowning, no plane.
  // Depths are absolute Y, not depths below the deck.
  flood: {
    start: -3.6,
    // Ends 400mm over the plant deck, so the deck is wet and the gantry and the
    // lorry are not. Reaching the top of the sump stair at t=340 is the job.
    end: 0.4,
    startsAt: 40,
    reaches: [
      { y: -2.8, at: 120, note: 'the sludge tank floor is gone' },
      { y: -2.0, at: 190, note: 'the filter bed floor is gone' },
      { y: -0.6, at: 300, note: 'only the sump stair head is above it' },
      { y: 0.4, at: 360, note: 'the deck' },
    ],
  },

  tasks: [
    {
      id: 'quota', type: 'extract_value', target: 6900,
      title: 'MEET THE QUOTA',
      detail: 'Six thousand nine hundred pounds, onto the flatbed, above the '
        + 'water line. Everything below the water line is a write-off.',
    },
    {
      id: 'fish', type: 'extract_kind', kind: 'fishbowl', count: 2,
      // Unbonused, so this one gates the job. Both are at the bottom of a tank
      // and both shatter at 2.6m/s, which is a fall of 110mm.
      title: 'THE OCCUPANTS',
      detail: 'Two of them. One in the sump, one in the sludge tank. They are, '
        + 'admittedly, in their element. Get them out anyway.',
    },
    {
      id: 'motor', type: 'extract_kind', kind: 'generator', count: 1,
      title: 'THE PUMP MOTOR',
      detail: '260kg, at the bottom of the deep one, up fourteen treads. Two of '
        + 'you, and neither of you can put it down halfway.',
      bonus: 1400,
    },
    {
      id: 'intact', type: 'no_breakages', limit: 5,
      title: 'BREAK LESS THAN SIX THINGS',
      detail: 'A tank floor is concrete and so is everything above it.',
      bonus: 650,
    },
  ],
};
