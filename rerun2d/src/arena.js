// RERUN 2D — the section.
//
// A cutaway of a narrow six-storey tower, 9m wide and 17m tall. Floors sit
// 2.8m apart, which is the number everything else hangs off:
//
//   jump from the floor      1.36 + 0.45 step = 1.81m   -> not enough
//   jump off a ghost's head  1.50 + 1.81      = 3.31m   -> enough
//
// So you cannot go up a storey alone, ever. You go up by standing on someone
// you used to be.
//
//   +-----------------------+  17.0  ceiling
//   | [PERCH]     [ATTIC]   |  14.0  fifth
//   |    [SPINE][OVERLOOK]  |  11.2  fourth
//   | [2L]           [2R]   |   8.4  third
//   |  [DOOR]|[  CLOSET  ]  |   5.6  second, closet behind a door
//   | [1L]           [1R*]  |   2.8  first  (* turnstile)
//   | [GL] [GL2] ## [GR][GR2]   0.0  ground, ## is the shaft
//   +-----------------------+

export const ARENA = { x0: 0, y0: 0, x1: 9, y1: 16.4 };

const box = (x0, y0, x1, y1, kind) => ({ x0, y0, x1, y1, kind });

// The ground floor simply stops. The drop has to be wider than a running
// player can cross before gravity takes them below the step-up assist —
// under 1.7m and they stroll over it without noticing.
export const SHAFT = { x0: 6.6, x1: 9 };

// Every floor has a hole, and the holes alternate sides. That is the whole
// route: stand a past self under the hole, climb it, walk to the next hole.
// Under a hole the clearance is two storeys, which is the only place a body
// is tall enough to be stood on — 2.5m of headroom is not.
export const STATIC_BOXES = [
  // ground, ending at the shaft
  box(0, -1.2, SHAFT.x0, 0, 'floor'),

  box(3.0, 2.5, 9, 2.8, 'floor'),    // first,  hole 0..3
  box(0, 5.3, 6.0, 5.6, 'floor'),    // second, hole 6..9
  box(3.0, 8.1, 9, 8.4, 'floor'),    // third,  hole 0..3
  box(0, 10.9, 6.0, 11.2, 'floor'),  // fourth, hole 6..9
  box(3.0, 13.7, 9, 14.0, 'floor'),  // fifth,  hole 0..3

  // shell
  box(-0.45, -1.2, 0, 16.4, 'wall'),
  box(9, -1.2, 9.45, 16.4, 'wall'),
  box(-0.45, 16.4, 9.45, 16.7, 'wall'),

  // the closet, top floor: its ceiling is the roof, so it blocks no route
  box(6.05, 15.9, 6.4, 16.4, 'room'),
];

// Slides into the floor while the door switch, three storeys down, is held.
export const DOOR_BOX = box(6.05, 14.0, 6.4, 15.9, 'door');
export const DOOR_DROP = 1.95;

export const BOXES_DOOR_CLOSED = STATIC_BOXES.concat([DOOR_BOX]);
export const BOXES_DOOR_OPEN = STATIC_BOXES;

// --- plates ---------------------------------------------------------------
export const PLATES = [
  { id: 'GL', name: 'GROUND LEFT', x: 1.2, y: 0 },
  { id: 'GR', name: 'GROUND RIGHT', x: 5.4, y: 0 },
  { id: 'L1', name: 'FIRST FLOOR', x: 4.2, y: 2.8 },
  { id: 'R1', name: 'THE TURNSTILE', x: 6.6, y: 2.8, momentum: true },
  { id: 'GL2', name: 'GROUND MIDDLE', x: 3.2, y: 0 },
  { id: 'L2', name: 'SECOND FLOOR', x: 1.2, y: 5.6 },
  { id: 'M2', name: 'SECOND MIDDLE', x: 3.4, y: 5.6 },
  { id: 'R2', name: 'SECOND FAR', x: 5.2, y: 5.6 },
  { id: 'L3', name: 'THIRD FLOOR', x: 4.2, y: 8.4 },
  { id: 'SP', name: 'THE SPINE', x: 1.4, y: 11.2 },
  { id: 'OV', name: 'THE OVERLOOK', x: 4.4, y: 11.2 },
  { id: 'DS', name: 'THE DOOR SWITCH', x: 7.4, y: 8.4, holdsDoor: true },
  { id: 'PE', name: 'THE PERCH', x: 4.4, y: 14.0 },
  { id: 'AT', name: 'THE ATTIC', x: 7.8, y: 14.0 },
];

export const PLATE_INDEX = Object.fromEntries(PLATES.map((p, i) => [p.id, i]));

// --- rounds ---------------------------------------------------------------
// One to fourteen escalate by plate count, climbing the tower a storey at a
// time. Fifteen to twenty hold all fourteen and convert one more of them to a
// turnstile each round, so a wall of parked ghosts stops being enough.
const ORDER = [
  'GL', 'GR', 'L1', 'R1', 'GL2', 'L2', 'M2',
  'R2', 'L3', 'SP', 'OV', 'DS', 'PE', 'AT',
];
const upTo = (k) => ORDER.slice(0, k);
const R = (n, plates, title, goal, momentumExtra) => ({
  n, plates, title, goal, ...(momentumExtra ? { momentumExtra } : {}),
});

export const ROUNDS = [
  R(1, upTo(1), 'ONE PLATE', 'Stand on it. That is the whole round.'),
  R(2, upTo(2), 'TWO PLATES', 'Opposite ends of the ground floor. Mind the shaft.'),
  R(3, upTo(3), 'UPSTAIRS', 'The hole on the left is the only way up. Stand a past self under it.'),
  R(4, upTo(4), 'THE TURNSTILE', 'It only counts arrivals. Standing on it does nothing at all.'),
  R(5, upTo(5), 'FIVE', 'Back down to the ground. You have run out of people.'),
  R(6, upTo(6), 'THE SECOND FLOOR', 'The next hole is on the right. Two storeys, two bodies.'),
  R(7, upTo(7), 'SEVEN', 'And along it.'),
  R(8, upTo(8), 'EIGHT', 'All the way along it.'),
  R(9, upTo(9), 'THE THIRD FLOOR', 'Left hole again. You are building a staircase out of yourself.'),
  R(10, upTo(10), 'THE SPINE', 'Fourth floor. Right hole.'),
  R(11, upTo(11), 'THE OVERLOOK', 'Nobody has stood there twice yet.'),
  R(12, upTo(12), 'THE DOOR SWITCH', 'It holds the attic open, three storeys above it.'),
  R(13, upTo(13), 'THE PERCH', 'The top floor. Five storeys of past selves.'),
  R(14, upTo(14), 'THE ATTIC', 'Behind the door somebody downstairs is holding. This is not the last round.'),

  R(15, upTo(14), 'THE FIRST CONVERSION',
    'Ground left is a turnstile now. A parked ghost will not hold it.', ['GL']),
  R(16, upTo(14), 'THE SECOND', 'Ground right joins it. Keep arriving.', ['GL', 'GR']),
  R(17, upTo(14), 'THE THIRD', 'The first floor. Arrivals, up there, forever.', ['GL', 'GR', 'L1']),
  R(18, upTo(14), 'THE FOURTH', 'The door switch. Hold it by arriving at it, again and again.',
    ['GL', 'GR', 'L1', 'DS']),
  R(19, upTo(14), 'THE FIFTH', 'The attic. You knew this was coming.',
    ['GL', 'GR', 'L1', 'DS', 'AT']),
  R(20, upTo(14), 'THE RECKONING',
    'Every plate in the tower. Half of them turnstiles. Every one of you.',
    ['GL', 'GR', 'L1', 'DS', 'AT', 'L2', 'M2']),
];

export function roundSpec(n) {
  return ROUNDS[Math.max(0, Math.min(ROUNDS.length - 1, n - 1))];
}
export function requiredPlateIndices(n) {
  return roundSpec(n).plates.map((id) => PLATE_INDEX[id]);
}
export function momentumPlateIndices(n) {
  const out = new Set();
  PLATES.forEach((p, i) => { if (p.momentum) out.add(i); });
  for (const id of roundSpec(n).momentumExtra || []) out.add(PLATE_INDEX[id]);
  return out;
}

// --- spawns ---------------------------------------------------------------
// Ground floor, under the first hole. Each round steps along the line by more
// than a body is wide, so you never begin standing inside your past selves.
const SPAWN_X = 0.9;
const SPAWN_STEP = 0.8;

export function spawnFor(round = 1) {
  const k = (Math.max(1, round) - 1) % 6;
  return { x: SPAWN_X + k * SPAWN_STEP, y: 0 };
}

/** Highest solid top at or below `fromY` under x. -Infinity over the shaft. */
export function surfaceBelow(boxes, x, fromY) {
  let best = -Infinity;
  for (const b of boxes) {
    if (x < b.x0 || x > b.x1) continue;
    if (b.y1 <= fromY + 0.02 && b.y1 > best) best = b.y1;
  }
  return best;
}
