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

  // CHEVRONS ON THE LIP.
  //
  // The pit used to announce itself by being the brightest object in the shed —
  // a mint-green tube down in the trench, dead centre of frame, out-glowing the
  // van. That is exactly backwards: the hazard was the beacon and the
  // destination was unlit, so the eye was pulled to the one place you must not
  // go. The warning now lives on the LIP, where a real trench marks itself, and
  // the hole behind it is allowed to be dark.
  //
  // `decal: true` — drawn, never collided with. These are 30mm proud of a
  // 300mm kerb, which autostep (420mm) walks over without noticing, so they
  // looked harmless as solid brushes. They were not: four thin colliders on the
  // kerb changed where the bots walked by enough that a whole shift ended with
  // the crew downed and the quota missed, and the crushing happened ten metres
  // away on the far side of the shed. `railing` is the safety-yellow-and-black
  // chevron texture.
  box([-3.8, 0.315, 1.0], [0.5, 0.03, 5.0], 'railing', { tag: 'pitmark', decal: true }),
  box([3.8, 0.315, 1.0], [0.5, 0.03, 5.0], 'railing', { tag: 'pitmark', decal: true }),
  box([0, 0.315, -1.8], [7.0, 0.03, 0.5], 'railing', { tag: 'pitmark', decal: true }),
  box([0, 0.315, 3.8], [7.0, 0.03, 0.5], 'railing', { tag: 'pitmark', decal: true }),

  // A WAY BACK OUT OF THE PIT.
  //
  // Without these the trench is a soft-lock. Its floor is at -1.10 and its lip
  // at +0.30, so getting out is a 1.40m climb, and a contractor can manage
  // 0.99m — a 0.57m jump plus 0.42m of autostep. Anyone who fell in, or was
  // knocked in, stayed there for the rest of the job with no way to say so.
  //
  // Two crates somebody stacked against the north wall, at 0.60m and 0.75m.
  // Both are under the 0.99m limit with room to spare for a bad approach, and
  // "there is junk in the inspection pit" needs no explaining to anyone.
  box([-2.2, -0.80, -1.0], [1.4, 0.60, 1.0], 'crate', { tag: 'pitstep' }),
  box([-2.2, -0.35, 0.0], [1.2, 0.75, 0.9], 'crate', { tag: 'pitstep' }),

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
  // The canopy sits at 4.9, not 3.9.
  //
  // A bay light has to clear a standing contractor — the deck is at 1.2 and a
  // contractor is 1.8, so nothing can hang below about 3.1 — and the old lid
  // was at 3.9 with its underside at 3.75. That left 650mm between the lamp and
  // a large flat panel, which is not a lighting position, it is a way to make
  // the ceiling the brightest object in the shot. One extra metre of canopy is
  // what buys the fixtures somewhere to be.
  box([-6.4, 2.7, 14.2], [0.3, 4.2, 5.0], 'panel'),
  box([6.4, 2.7, 14.2], [0.3, 4.2, 5.0], 'panel'),
  box([0, 4.9, 14.2], [12.8, 0.3, 5.0], 'panel'),
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

    // --- THE VAN, WHICH IS THE BRIGHTEST THING IN THE SHED -------------------
    //
    // Every pound in this level ends up in the volume at z=15.4, so that volume
    // has to be the thing the eye goes to from anywhere on the floor. It was
    // the opposite: one lamp at the MOUTH of the bay, dropped by the pendant
    // rule to 2.0m — head height, in front of the van rather than in it — which
    // lit the side panels flat and left the bed itself in shade.
    //
    // Two bolted fixtures in the throat instead, up under the canopy and
    // inboard of the panels. Range 9 keeps the pool inside the bay: this is a
    // lit box at the end of a dark shed, not a second sun. Cool white against
    // the shed's sodium, because the destination should not look like more
    // warehouse.
    //
    // POSITION IS MOSTLY ABOUT WHAT IS NEAREST. The first attempt put these at
    // (±2.2, 3.1, 15.6): 650mm under the lid and 1.4m off the shell's south
    // wall, which is also the van's back wall. Inverse square does not care
    // what a surface is for, so the lid and the back wall each got several
    // times what the deck got and the bay rendered as a glowing white box with
    // a dim floor in it. The deck reported 0% clipped throughout, because the
    // crop that measures it looks straight down and never sees a wall.
    //
    // 3.9 is a metre under the raised canopy and 2.7m over the deck; z=14.6 is
    // 2.4m off the back wall instead of 1.4. Nothing in the bay is now nearer
    // to a lamp than the thing the lamp is there for.
    //
    // The first of them casts — see SHADOW_LAMPS. A prop that has been paid for
    // should sit in the bed with a shadow under it rather than hover over it.
    light([-2.4, 3.9, 14.6], { intensity: 24, range: 9, color: '#dfeaff', mount: 'fixed', shadow: true }),
    light([2.4, 3.9, 14.6], { intensity: 24, range: 9, color: '#dfeaff', mount: 'fixed' }),
    // and one over the ramp, so the approach is legible without being in shot
    light([0, 3.9, 11.8], { intensity: 11, range: 8, color: '#dfeaff', mount: 'fixed' }),

    // --- THE PIT, WHICH IS THE DIMMEST ---------------------------------------
    //
    // Was intensity 7 of '#9fffc0' sitting 700mm off the trench floor: 243 lux
    // on the slab under it against 12 for the shed, i.e. the principal fall
    // hazard was twenty times brighter than the room and dead centre of three
    // frames out of five. Now a failing amber strip at the lip, dimmer than the
    // floor it interrupts. The chevrons above do the warning; the hole is a
    // hole, and you are meant to lose your footing in it.
    light([0, 0.15, 1.0], { intensity: 0.55, range: 4.2, color: '#ff9d3c', flicker: 0.7, mount: 'fixed' }),
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
    // y must stay under 0.548: gravity is -22, so a 700mm drop lands at
    // 6.22m/s against this piano's 5.5m/s fragility and it shatters on load.
    prop('piano', [-7.5, 0.52, -2.5], [0, 0.3, 0]),
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
      id: 'piano', type: 'extract_kind', kind: 'piano', count: 1, intact: true,
      title: 'THE PIANO',
      detail: 'It weighs 220kg. It is not going to move itself.',
      bonus: 900,
    },
  ],
};
