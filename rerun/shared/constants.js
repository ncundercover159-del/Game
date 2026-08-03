// RERUN — tuning constants shared by client and server.
// Anything that affects simulation lives here so the client's local prediction
// and the server's authoritative sim run identical maths.

// ---- the numbers from the design doc -------------------------------------
export const ROUND_SECONDS = 20;
export const COUNTDOWN_SECONDS = 3;
export const SETTLING_SECONDS = 4;
export const TOTAL_ROUNDS = 6;
export const RECORD_HZ = 20;
export const MAX_GHOSTS = 60;
export const GHOST_PUSH_FORCE = 14;
export const PLATE_ACTIVATION_MASS = 1;
export const STEP_UP_HEIGHT = 0.45;
export const JUMP_VELOCITY = 7;
export const COYOTE_MS = 100;

// ---- derived -------------------------------------------------------------
export const ROUND_MS = ROUND_SECONDS * 1000;
export const COUNTDOWN_MS = COUNTDOWN_SECONDS * 1000;
export const SETTLING_MS = SETTLING_SECONDS * 1000;
export const RECORD_INTERVAL_MS = 1000 / RECORD_HZ;
export const SAMPLES_PER_GHOST = ROUND_SECONDS * RECORD_HZ; // 400

// ---- rates ---------------------------------------------------------------
export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;
export const BROADCAST_HZ = 20;
export const BROADCAST_MS = 1000 / BROADCAST_HZ;
export const INPUT_HZ = 30;
export const INPUT_MS = 1000 / INPUT_HZ;

// ---- bodies --------------------------------------------------------------
export const PLAYER_RADIUS = 0.38;
export const PLAYER_HEIGHT = 1.5; // feet to the top of the head
export const BODY_RADIUS = PLAYER_RADIUS; // ghosts are the same size
export const EYE_HEIGHT = 1.17;

// ---- movement ------------------------------------------------------------
// Grippy, not floaty: near-instant acceleration on the ground, a little less
// in the air. You are planning precise runs; slippery would just be annoying.
export const MOVE_SPEED = 4.2;
export const GROUND_ACCEL = 55;
export const AIR_ACCEL = 20;
export const GRAVITY = 18; // jump apex = 7^2 / (2*18) = 1.36m
export const MAX_FALL = 34;

// Falling below this is death; the body comes to rest down here so the
// recording stays inside int16 range and the ghost vanishes under the floor.
export const DEATH_Y = -4.5;
export const DEATH_REST_Y = -9.5;

// ---- rooms / match -------------------------------------------------------
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 8;
export const ROOM_IDLE_MS = 10 * 60 * 1000;
export const RECONNECT_MS = 30 * 1000;
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// ---- plates --------------------------------------------------------------
export const PLATE_RADIUS = 0.9;
export const PLATE_FOOT_BELOW = 0.22; // how far under the plate face a foot may be
export const PLATE_FOOT_ABOVE = 0.55; // ...and above, before it stops counting
export const MOMENTUM_HOLD_MS = 700; // how long an arrival keeps the turnstile down
export const FULL_SET_BONUS = 25; // awarded the first time a round's full set is held

// ---- phases --------------------------------------------------------------
export const PHASE = {
  LOBBY: 0,
  COUNTDOWN: 1,
  PLAY: 2,
  SETTLING: 3,
  RESULTS: 4,
};
export const PHASE_NAME = ['LOBBY', 'COUNTDOWN', 'PLAY', 'SETTLING', 'RESULTS'];

// ---- player colours ------------------------------------------------------
// One per slot. Ghosts desaturate from these by generation.
export const SLOT_COLORS = [
  0xff5566, 0x4fc3ff, 0xffd24a, 0x6ee06a,
  0xc77dff, 0xff9f45, 0x3fe6c8, 0xff7ad9,
];
