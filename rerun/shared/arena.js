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
  box(-0.9, -0.55, 0, ROOM_TOP, -9, -5.6, 'room'),
  box(-5.2, -4.2, 0, ROOM_TOP, -5.95, -5.6, 'room'),
  box(-3.0, -0.55, 0, ROOM_TOP, -5.95, -5.6, 'room'),
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
  { id: 'P3', name: 'THE LEDGE', x: 4.2, y: LEDGE_TOP, z: -7.6 },
  { id: 'P4', name: 'THE TURNSTILE', x: -3.8, y: 0, z: 7.2, momentum: true },
  // Deliberately off to the side of the doorway, so the doorman doesn't also
  // plug the door they are holding open.
  { id: 'P5', name: 'DOOR SWITCH', x: -1.9, y: 0, z: -4.4, holdsDoor: true },
  { id: 'P6', name: 'THE CLOSET', x: -3.8, y: 0, z: -7.5 },
  { id: 'P7', name: 'PIT EAST', x: 3.8, y: 0, z: 2.0 },
  { id: 'P8', name: 'PIT WEST', x: -3.6, y: 0, z: 2.0 },

  // Twenty rounds need more than eight plates to escalate against.
  { id: 'P9', name: 'THE SHELF', x: 2.5, y: LEDGE_TOP, z: -6.9 },
  { id: 'P10', name: 'BACK OF THE CLOSET', x: -1.9, y: 0, z: -7.5 },
  { id: 'P11', name: 'THE GAP', x: 0.5, y: 0, z: -7.4 },
  { id: 'P12', name: 'THE CORNER', x: -4.2, y: 0, z: 4.9 },
  { id: 'P13', name: 'THE OTHER TURNSTILE', x: 1.3, y: 0, z: 8.0, momentum: true },
  { id: 'P14', name: 'THE NARROWS', x: 4.2, y: 0, z: -3.4 },
];

export const PLATE_INDEX = Object.fromEntries(PLATES.map((p, i) => [p.id, i]));

// --- rounds ---------------------------------------------------------------
// Twenty rounds. One to fourteen escalate by plate count. Fifteen to twenty
// hold all fourteen and start converting them to turnstiles — plates that only
// stay down while weight is *increasing* — so a wall of parked ghosts stops
// being enough and the room needs a permanent stream of arrivals.
const R = (n, plates, title, goal, momentumExtra) => ({
  n, plates, title, goal, ...(momentumExtra ? { momentumExtra } : {}),
});

const ORDER = [
  'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P11', 'P7',
  'P8', 'P9', 'P10', 'P14', 'P12', 'P13',
];
const upTo = (k) => ORDER.slice(0, k);

export const ROUNDS = [
  R(1, upTo(1), 'ONE PLATE', 'Stand on it. This is the whole round.'),
  R(2, upTo(2), 'TWO PLATES, FAR APART', 'Split up. Enjoy this while it lasts.'),
  R(3, upTo(3), 'THREE PLATES', 'The ledge is out of jump range. Stand on somebody.'),
  R(4, upTo(4), 'FOUR PLATES', 'The turnstile only counts arrivals. Standing on it does nothing.'),
  R(5, upTo(5), 'FIVE PLATES', 'The door switch holds the closet open. Someone has to hold it.'),
  R(6, upTo(6), 'SIX PLATES', 'And someone has to be inside the closet when they do.'),
  R(7, upTo(7), 'SEVEN PLATES', 'The gap between the closet and the ledge counts now.'),
  R(8, upTo(8), 'EIGHT PLATES', 'East of the pit. Mind the pit.'),
  R(9, upTo(9), 'NINE PLATES', 'And west of it. You are running out of people.'),
  R(10, upTo(10), 'TEN PLATES', 'A second plate on the ledge. Build a taller pile.'),
  R(11, upTo(11), 'ELEVEN PLATES', 'Two in the closet, one door, one doorman.'),
  R(12, upTo(12), 'TWELVE PLATES', 'The narrows, on the far side of everything.'),
  R(13, upTo(13), 'THIRTEEN PLATES', 'The corner nobody has visited yet.'),
  R(14, upTo(14), 'FOURTEEN PLATES', 'Every plate in the room. This is not the last round.'),

  R(15, upTo(14), 'THE FIRST CONVERSION', 'Centre is a turnstile now. Parking a ghost on it is no longer enough.',
    ['P1']),
  R(16, upTo(14), 'THE SECOND', 'The long way is a turnstile too. Someone has to keep arriving.',
    ['P1', 'P2']),
  R(17, upTo(14), 'THE THIRD', 'The ledge joins them. Arrivals, up there, forever.',
    ['P1', 'P2', 'P3']),
  R(18, upTo(14), 'THE FOURTH', 'The door switch. Hold it by arriving at it, repeatedly.',
    ['P1', 'P2', 'P3', 'P5']),
  R(19, upTo(14), 'THE FIFTH', 'The closet. You knew this was coming.',
    ['P1', 'P2', 'P3', 'P5', 'P6']),
  R(20, upTo(14), 'THE RECKONING',
    'Every plate. Half of them turnstiles. Every ghost you have ever been.',
    ['P1', 'P2', 'P3', 'P5', 'P6', 'P11', 'P7']),
];

export function roundSpec(roundNumber) {
  return ROUNDS[Math.max(0, Math.min(ROUNDS.length - 1, roundNumber - 1))];
}

export function requiredPlateIndices(roundNumber) {
  return roundSpec(roundNumber).plates.map((id) => PLATE_INDEX[id]);
}

/** Plate indices behaving as turnstiles this round: the permanently-momentum
 *  ones, plus whatever the round converts. */
export function momentumPlateIndices(roundNumber) {
  const out = new Set();
  PLATES.forEach((p, i) => { if (p.momentum) out.add(i); });
  for (const id of roundSpec(roundNumber).momentumExtra || []) out.add(PLATE_INDEX[id]);
  return out;
}

// --- spawns ---------------------------------------------------------------
// South end, spread out so round one isn't a stampede.
// Kept clear of the walls and the pit by at least the spawn spiral's radius,
// so the per-round offset below never has to be clamped.
export const SPAWNS = [
  { x: -3.1, z: 6.9 }, { x: -1.85, z: 6.3 }, { x: -0.6, z: 6.9 }, { x: 0.6, z: 6.3 },
  { x: 1.85, z: 6.9 }, { x: 3.1, z: 6.3 }, { x: -2.4, z: 5.6 }, { x: 2.4, z: 5.6 },
];

// Six rounds, six points on a hexagon: every pair is at least SPAWN_RING
// apart, which is comfortably more than a body is wide (0.76m).
const SPAWN_RINGS = 6;
const SPAWN_RING = 0.98;

/**
 * Where a player starts a given round.
 *
 * Every ghost's recording begins at its owner's spawn, so a fixed spawn would
 * put you inside all of your past selves at t=0 of every round and the
 * resolver would fire you out of the room. Each round gets its own corner of a
 * small hexagon instead, so your past selves line up beside you rather than
 * inside you.
 */
export function spawnFor(slot, round = 1) {
  const base = SPAWNS[slot % SPAWNS.length];
  const k = (Math.max(1, round) - 1) % SPAWN_RINGS;
  // Per-slot phase so neighbouring players' rings aren't aligned.
  const a = (k / SPAWN_RINGS) * Math.PI * 2 + slot * 0.4;
  return {
    x: clampTo(base.x + Math.cos(a) * SPAWN_RING, ARENA.minX + 0.75, ARENA.maxX - 0.75),
    z: clampTo(base.z + Math.sin(a) * SPAWN_RING, ARENA.minZ + 0.75, ARENA.maxZ - 0.75),
  };
}

function clampTo(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

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
