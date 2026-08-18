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

  // --- loading dock, and THE VAN, WHICH UNTIL NOW DID NOT EXIST ------------
  //
  // The task text says "load £5,200 of stock into the van". There was no van.
  // The extraction volume sat inside two flat cladding panels and a lid four
  // metres up, over a stretch of the same dock decking the player was standing
  // on, and the whole reason the bay kept blowing out under every lighting
  // scheme tried on it is that a 12m-wide alcove of pale corrugated cladding is
  // not a thing light can be put inside. The reference plate for this is the
  // inside of R.E.P.O.'s extraction truck: a DARK RIBBED BOX whose bright
  // element is the rectangular opening, not its surfaces — 74% of that frame
  // sits below sRGB 32.
  //
  // So the dock now stops at the loading edge and a box body is parked against
  // it, bed flush with the deck so nothing has to be lifted over a step. Inside
  // is 8.5m x 2.6m x 2.4m clear, which wraps the extraction volume with room to
  // walk. Lined in ply over rubber matting, because those are the two materials
  // in the set that are dark AND carry real texture — the critic measured the
  // old deckplate bed at p90/p10 1.01, which is to say no material at all.
  box([0, 0.6, 12.95], [12, 1.2, 2.5], 'deckplate', { tag: 'dock' }),
  box([0, 0.3, 10.8], [6.0, 0.6, 2.2], 'deckplate', { tag: 'ramp', ramp: true }),

  // the body: bed, two sides, bulkhead, roof
  box([0, 1.075, 15.5], [8.8, 0.25, 2.6], 'rubber', { tag: 'vanbed' }),
  box([-4.4, 2.4, 15.5], [0.3, 2.4, 2.6], 'crate', { tag: 'vanwall' }),
  box([4.4, 2.4, 15.5], [0.3, 2.4, 2.6], 'crate', { tag: 'vanwall' }),
  box([0, 2.4, 16.95], [9.1, 2.4, 0.3], 'crate', { tag: 'vanwall' }),
  box([0, 3.75, 15.4], [9.1, 0.3, 2.8], 'crate', { tag: 'vanroof' }),

  // the rear frame, which is what actually reads as "a van" from across the
  // shed: two uprights and a header outlining the opening
  box([-4.4, 2.4, 14.05], [0.3, 2.4, 0.3], 'steelblue'),
  box([4.4, 2.4, 14.05], [0.3, 2.4, 0.3], 'steelblue'),
  box([0, 3.45, 14.05], [9.1, 0.3, 0.3], 'steelblue'),
  // sill lip you set a safe down over
  box([0, 1.26, 14.16], [8.8, 0.12, 0.22], 'steelblue', { tag: 'vansill' }),

  // both doors swung back flat against the sides. `decal: true` — they are
  // dressing, and dressing that can move the simulation is dressing nobody can
  // safely add. Four 30mm chevrons on the pit kerb once ended a whole shift
  // with the crew downed and the quota missed.
  box([-4.72, 2.4, 13.0], [0.12, 2.4, 2.2], 'steelblue', { tag: 'vandoor', decal: true }),
  box([4.72, 2.4, 13.0], [0.12, 2.4, 2.2], 'steelblue', { tag: 'vandoor', decal: true }),

  // chassis and bumper under the bed line. No wheels: brushes are axis-aligned
  // boxes, so a wheel would be a cube, and from a dock at deck height you never
  // see below the sill anyway. Round geometry is what that needs and the brush
  // system has none.
  box([0, 0.75, 15.5], [9.0, 0.4, 2.6], 'steelblue', { tag: 'vanchassis' }),
  box([0, 0.5, 14.05], [7.4, 0.22, 0.3], 'steelblue'),
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

    // --- INSIDE THE VAN ------------------------------------------------------
    //
    // These used to be bay lamps hung in an alcove, and every value tried on
    // them was wrong for the same reason: there was nothing to put the light
    // INSIDE. Now there is a box, so they go in it, and the thing the player
    // sees from across the shed is a lit rectangular opening rather than a
    // glowing wall — which is what the reference plate actually does.
    //
    // Back to 24 from 15. Backing off to 15 was my call and it was wrong: the
    // critic measured attention properly, as the share of the frame's brightest
    // 1% falling inside the bay, and got 38% at 24 against 26% at 15. 34 buys
    // no more attention than 24 and costs 17 sRGB of near-field blowout, so 24
    // is the top of the useful range. My reason for backing off — "the cladding
    // is legible again" — was true of the WALL and false of the DECK, which was
    // never flat because of the lamp. It was flat because deckplate carries a
    // 2.75m rib pitch and a 5m bed shows under two ribs of it. That bed is
    // rubber matting now.
    //
    // 3.15 is 450mm under the roof lining and just clear of the load volume,
    // which tops out at 3.0.
    light([-2.3, 3.15, 15.7], { intensity: 24, range: 8, color: '#dfeaff', mount: 'fixed', shadow: true }),
    light([2.3, 3.15, 15.7], { intensity: 24, range: 8, color: '#dfeaff', mount: 'fixed' }),
    // and one over the ramp, so the approach is legible without being in shot
    light([0, 3.4, 11.6], { intensity: 10, range: 8, color: '#dfeaff', mount: 'fixed' }),

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
