// THE LUMPS — tuning and palette.
//
// The simulation numbers are not re-invented here. The top-down view needs
// X/Z movement with a height axis, which is exactly what the 3D game already
// runs and has already been argued with, so this build imports that wholesale
// and only adds what is genuinely its own: the knife, and the look.

export {
  ROUND_SECONDS, COUNTDOWN_SECONDS, SETTLING_SECONDS, TOTAL_ROUNDS,
  RECORD_HZ, MAX_GHOSTS, PLATE_ACTIVATION_MASS, STEP_UP_HEIGHT,
  JUMP_VELOCITY, ROUND_MS, COUNTDOWN_MS, SETTLING_MS, RECORD_INTERVAL_MS,
  SAMPLES_PER_GHOST, TICK_HZ, TICK_MS, PLAYER_RADIUS, PLAYER_HEIGHT,
  MOVE_SPEED, GRAVITY, DEATH_Y, DEATH_REST_Y, PLATE_RADIUS,
  PLATE_FOOT_ABOVE, PLATE_FOOT_BELOW, MOMENTUM_HOLD_MS, FULL_SET_BONUS,
  PHASE,
} from '@shared/constants.js';

// --- the knife --------------------------------------------------------------
// Reach is a shade over the distance at which two bodies are already touching
// (0.38 + 0.38), so you have to be pressed against the specimen you are about
// to murder. Omnidirectional: aiming a knife with a thumbstick is not a game.
export const STAB_REACH = 1.02;
export const STAB_HEIGHT = 1.1;
export const STAB_COOLDOWN_MS = 320;

// --- projection -------------------------------------------------------------
// Plan view, but not a flat one: a body is lifted up the screen in proportion
// to how far it is above whatever it is standing on, and leaves its shadow
// behind on the floor. The gap between the two is the only height cue there
// is, so it has to be generous.
export const LIFT = 0.62; // screen-metres per world-metre of height

// --- the notebook -----------------------------------------------------------
// Aged paper, one ink, and three pigments used sparingly enough that they mean
// something. Everything structural is drawn as if someone measured it.
export const PAPER = {
  page: '#e6dcc4',
  pageDark: '#d8ccae',
  grid: 'rgba(60,48,38,0.075)',
  gridBold: 'rgba(60,48,38,0.14)',

  floor: '#f3ecda',
  floorGrid: 'rgba(60,48,38,0.055)',
  ledge: '#e3d8ba',
  room: '#cbbc9b',
  pit: '#221c19',
  pitRim: '#3a302a',

  ink: '#241d1c',
  inkSoft: 'rgba(36,29,28,0.55)',
  inkFaint: 'rgba(36,29,28,0.26)',
  inkHair: 'rgba(36,29,28,0.13)',

  red: '#d0402f',
  redSoft: 'rgba(208,64,47,0.30)',
  blue: '#2f7fb8',
  blueSoft: 'rgba(47,127,184,0.30)',
  amber: '#f0b429',
  shadow: 'rgba(60,44,30,0.34)',
};

// Ten pigments off the specimen chart. Generations walk the list, so a full
// tank is a riot rather than a gradient.
export const PIGMENTS = [
  '#e8734a', '#f0b429', '#c8d44e', '#6fbf5e',
  '#3fb8a0', '#4a9fd8', '#7a7ee0', '#b874d4',
  '#e8659a', '#d4553f',
];

export function pigmentFor(gen) { return PIGMENTS[(gen * 3) % PIGMENTS.length]; }
export function hatFor(gen) { return PIGMENTS[(gen * 7 + 4) % PIGMENTS.length]; }

/** Blend two hex colours. Used for shading a pigment without a second palette. */
export function mix(a, b, t) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((A >> sh) & 255) + (((B >> sh) & 255) - ((A >> sh) & 255)) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
