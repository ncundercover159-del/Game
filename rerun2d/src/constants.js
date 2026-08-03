// RERUN 2D — tuning.
//
// Side-on. The vertical axis is the whole point: you climb by standing on
// your own past selves, and in a cutaway section that reads instantly.

export const ROUND_SECONDS = 20;
export const COUNTDOWN_SECONDS = 3;
export const SETTLING_SECONDS = 4;
export const TOTAL_ROUNDS = 20;
export const RECORD_HZ = 20;
export const MAX_GHOSTS = 60;
export const GHOST_PUSH_FORCE = 14;
export const PLATE_ACTIVATION_MASS = 1;
export const STEP_UP_HEIGHT = 0.45;
export const JUMP_VELOCITY = 7;
export const COYOTE_MS = 100;

export const ROUND_MS = ROUND_SECONDS * 1000;
export const COUNTDOWN_MS = COUNTDOWN_SECONDS * 1000;
export const SETTLING_MS = SETTLING_SECONDS * 1000;
export const RECORD_INTERVAL_MS = 1000 / RECORD_HZ;
export const SAMPLES_PER_GHOST = ROUND_SECONDS * RECORD_HZ; // 400

export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;

// --- bodies ---------------------------------------------------------------
export const PLAYER_W = 0.72;
export const PLAYER_H = 1.5;
export const HALF_W = PLAYER_W / 2;

// --- movement -------------------------------------------------------------
export const MOVE_SPEED = 4.2;
export const GROUND_ACCEL = 55;
export const AIR_ACCEL = 20;
export const GRAVITY = 18; // apex = 7^2 / (2*18) = 1.36m
export const MAX_FALL = 34;

export const DEATH_Y = -3.0;
export const DEATH_REST_Y = -9.0;

// --- the knife -------------------------------------------------------------
// Reach is a little over a body's width, so you have to actually be on top of
// the past self you are about to murder.
export const STAB_REACH = 1.05;
export const STAB_HEIGHT = 1.15;
export const STAB_COOLDOWN_MS = 320;

// --- plates ---------------------------------------------------------------
export const PLATE_HALF = 0.62; // plates are 1.24m wide
export const PLATE_FOOT_BELOW = 0.18;
export const PLATE_FOOT_ABOVE = 0.5;
export const MOMENTUM_HOLD_MS = 700;
export const FULL_SET_BONUS = 25;

// --- phases ---------------------------------------------------------------
export const PHASE = { COUNTDOWN: 0, PLAY: 1, SETTLING: 2, RESULTS: 3 };

// --- the plate ------------------------------------------------------------
// A chronophotograph: warm black ground, bone line work, one amber accent for
// the objective and one cold accent for the turnstiles. Nothing else.
export const INK = {
  ground: '#0b0a0d',
  bone: '#efe7d8',
  boneDim: 'rgba(239,231,216,0.30)',
  boneFaint: 'rgba(239,231,216,0.13)',
  amber: '#f5a623',
  amberDim: 'rgba(245,166,35,0.30)',
  cold: '#6fd3ff',
  coldDim: 'rgba(111,211,255,0.30)',
  blood: '#e0483b',
};

// Exposure colours for the living figure across a match. Warm inks, all
// legible as line work on black.
export const PLAYER_INK = '#f7ead3';
