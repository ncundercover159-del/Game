// RERUN — the arena.
//
// One small, cramped, portrait-shaped room. 12m wide, 18m deep. Everything is
// an axis-aligned box because the physics is hand-rolled and boxes are the
// only shape worth hand-rolling.
//
// Layout, looking down (north = -Z at the top of the screen):
//
//   +-------------------------------+
//   |  [CLOSET]   |     [ LEDGE ]   |   north: the closet (door + inner
//   |   P6        |        P3       |   plate) and the 2.1m ledge
//   |======[D]====|                 |
//   |  P5              P1           |
//   |                               |
//   |   P8      ###PIT###      P7   |   middle: the pit, dead centre
//   |           ###   ###           |
//   |                               |
//   |   P4                    P2    |   south: spawns, turnstile, far plate
//   +-------------------------------+

// 10.4m wide, 18m deep. Portrait-shaped on purpose: the camera is a fixed
// high angle and a phone screen is tall, so a tall arena wastes less of it.
export const ARENA = { minX: -5.2, maxX: 5.2, minZ: -9, maxZ: 9 };

export const LEDGE_TOP = 2.1; // out of jump reach from the floor (1.36 + 0.45 step)
export const WALL_TOP = 3.4;
export const ROOM_TOP = 2.4;
export const DOOR_TOP = 2.4;

const box = (x0, x1, y0, y1, z0, z1, kind) => ({ x0, x1, y0, y1, z0, z1, kind });

// --- static collision geometry -------------------------------------------
export const STATIC_BOXES = [
  // floor slabs, cut around the pit
  box(-5.2, 5.2, -1, 0, -9, 0.4, 'floor'),
  box(-5.2, 5.2, -1, 0, 3.6, 9, 'floor'),
  box(-5.2, -1.6, -1, 0, 0.4, 3.6, 'floor'),
  box(2.4, 5.2, -1, 0, 0.4, 3.6, 'floor'),

  // outer walls
  box(-5.6, 5.6, 0, WALL_TOP, -9.4, -9, 'wall'),
  box(-5.6, 5.6, 0, WALL_TOP, 9, 9.4, 'wall'),
  box(-5.6, -5.2, 0, WALL_TOP, -9.4, 9.4, 'wall'),
  box(5.2, 5.6, 0, WALL_TOP, -9.4, 9.4, 'wall'),

  // the ledge (north-east). Only reachable by standing on a body.
  box(1.6, 5.2, -1, LEDGE_TOP, -9, -5.8, 'ledge'),

  // the closet (north-west). North side is the arena wall.
  box(-5.2, -4.8, 0, ROOM_TOP, -9, -5.6, 'room'),
  box(-1.6, -1.25, 0, ROOM_TOP, -9, -5.6, 'room'),
  box(-5.2, -4.2, 0, ROOM_TOP, -5.95, -5.6, 'room'),
  box(-3.0, -1.25, 0, ROOM_TOP, -5.95, -5.6, 'room'),
];

// The door fills the closet doorway. Solid unless the door plate is held.
export const DOOR_BOX = box(-4.2, -3.0, 0, DOOR_TOP, -5.95, -5.6, 'door');
export const DOOR_OPEN_DROP = 2.55; // how far it sinks into the floor when open

export const BOXES_DOOR_CLOSED = STATIC_BOXES.concat([DOOR_BOX]);
export const BOXES_DOOR_OPEN = STATIC_BOXES;

// --- the pit --------------------------------------------------------------
export const PIT = { x0: -1.6, x1: 2.4, z0: 0.4, z1: 3.6 };

// --- plates ---------------------------------------------------------------
// `y` is the height of the plate face. Plates exist in every round; only the
// round's required set is lit and scored, but the door switch always works so
// players can discover it early.
export const PLATES = [
  { id: 'P1', name: 'CENTRE', x: 0, y: 0, z: -2.2 },
  { id: 'P2', name: 'THE LONG WAY', x: 3.8, y: 0, z: 7.2 },
  { id: 'P3', name: 'THE LEDGE', x: 3.4, y: LEDGE_TOP, z: -7.3 },
  { id: 'P4', name: 'THE TURNSTILE', x: -3.8, y: 0, z: 7.2, momentum: true },
  // Deliberately off to the side of the doorway, so the doorman doesn't also
  // plug the door they are holding open.
  { id: 'P5', name: 'DOOR SWITCH', x: -1.9, y: 0, z: -4.4, holdsDoor: true },
  { id: 'P6', name: 'THE CLOSET', x: -3.4, y: 0, z: -7.5 },
  { id: 'P7', name: 'PIT EAST', x: 3.8, y: 0, z: 2.0 },
  { id: 'P8', name: 'PIT WEST', x: -3.6, y: 0, z: 2.0 },
];

export const PLATE_INDEX = Object.fromEntries(PLATES.map((p, i) => [p.id, i]));

// --- rounds ---------------------------------------------------------------
// Each round needs strictly more simultaneous presses than the last.
export const ROUNDS = [
  {
    n: 1,
    plates: ['P1'],
    title: 'ONE PLATE',
    goal: 'Stand on it. This is the whole round.',
  },
  {
    n: 2,
    plates: ['P1', 'P2'],
    title: 'TWO PLATES, FAR APART',
    goal: 'Split up. Enjoy this while it lasts.',
  },
  {
    n: 3,
    plates: ['P1', 'P2', 'P3'],
    title: 'THREE PLATES',
    goal: 'The ledge is out of jump range. Stand on somebody.',
  },
  {
    n: 4,
    plates: ['P1', 'P2', 'P3', 'P4'],
    title: 'FOUR PLATES',
    goal: 'The turnstile only counts arrivals. Standing on it does nothing.',
  },
  {
    n: 5,
    plates: ['P1', 'P2', 'P3', 'P5', 'P6'],
    title: 'FIVE PLATES',
    goal: 'The closet door needs a doorman. Forever.',
  },
  {
    n: 6,
    plates: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
    title: 'THE RECKONING',
    goal: 'Every plate. Every ghost. Total plate-seconds.',
  },
];

export function roundSpec(roundNumber) {
  return ROUNDS[Math.max(0, Math.min(ROUNDS.length - 1, roundNumber - 1))];
}

export function requiredPlateIndices(roundNumber) {
  return roundSpec(roundNumber).plates.map((id) => PLATE_INDEX[id]);
}

// --- spawns ---------------------------------------------------------------
// South end, spread out so round one isn't a stampede.
export const SPAWNS = [
  { x: -4.0, z: 7.9 }, { x: -2.4, z: 8.3 }, { x: -0.8, z: 7.9 }, { x: 0.8, z: 8.3 },
  { x: 2.4, z: 7.9 }, { x: 4.0, z: 8.3 }, { x: -4.6, z: 5.6 }, { x: 4.6, z: 5.6 },
];

export function spawnFor(slot) {
  return SPAWNS[slot % SPAWNS.length];
}

// --- helpers --------------------------------------------------------------

/** Highest solid surface at (x,z) at or below `fromY`. -Infinity over the pit. */
export function surfaceBelow(boxes, x, z, fromY) {
  let best = -Infinity;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
    if (b.y1 <= fromY + 0.02 && b.y1 > best) best = b.y1;
  }
  return best;
}
