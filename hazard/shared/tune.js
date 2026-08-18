// HAZARD PAY — every number that matters, in one file.
//
// Server and client both import this. If a value affects simulation it lives
// here and nowhere else, because the server is authoritative and the client
// predicts against the same constants.

// --- time -------------------------------------------------------------------
export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;
export const TICK_DT = 1 / TICK_HZ;

export const SNAPSHOT_HZ = 20;
export const SNAPSHOT_MS = 1000 / SNAPSHOT_HZ;
export const INPUT_HZ = 30;
export const INPUT_MS = 1000 / INPUT_HZ;

// The client renders this far in the past so it always has two snapshots to
// interpolate between. One snapshot of slack absorbs a dropped packet.
export const INTERP_DELAY_MS = 110;

// --- room -------------------------------------------------------------------
export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 8;
export const ROOM_IDLE_MS = 10 * 60 * 1000;
export const CODE_LENGTH = 4;

// --- the body ---------------------------------------------------------------
// A contractor is a capsule while alive and eleven boxes while ragdolled.
export const PLAYER_RADIUS = 0.34;
export const PLAYER_HEIGHT = 1.72;      // eye height is a shade under this
export const EYE_HEIGHT = 1.58;
export const CROUCH_HEIGHT = 1.05;
export const CROUCH_EYE = 0.92;
export const PLAYER_MASS = 72;

export const WALK_SPEED = 4.1;
export const SPRINT_SPEED = 6.6;
export const CROUCH_SPEED = 1.9;
export const AIR_CONTROL = 0.22;
export const GROUND_ACCEL = 48;
export const AIR_ACCEL = 12;
export const GROUND_FRICTION = 11;
export const JUMP_VELOCITY = 5.0;
export const GRAVITY = -22;             // punchier than real gravity, as always
export const MAX_FALL = 45;
export const COYOTE_MS = 110;
export const JUMP_BUFFER_MS = 130;
export const MAX_STEP = 0.42;
export const MAX_SLOPE = 0.86;          // radians, ~49 degrees

// Stamina: sprinting and hauling both burn it. Empty means you walk.
export const STAMINA_MAX = 100;
export const STAMINA_SPRINT = 17;       // per second
export const STAMINA_REGEN = 21;
export const STAMINA_REGEN_DELAY_MS = 700;
export const STAMINA_HAUL_PER_KG = 0.30; // per second, per kg over the free ride
export const HAUL_FREE_KG = 8;

// --- damage and ragdoll -----------------------------------------------------
export const HEALTH_MAX = 100;
export const FALL_SAFE_SPEED = 9.5;     // below this a landing is free
export const FALL_DAMAGE_PER_MS = 6.2;  // per m/s over the safe speed
// ENERGY, NOT MOMENTUM. Momentum is linear in mass, so a fixed threshold plus a
// fixed rate gives every prop the same ABSOLUTE window between "free" and
// "fatal" — 111 kg·m/s under the old numbers — and that window then divides by
// the prop's mass. For a 12kg extinguisher it was a sensible 2.2 to 11.4 m/s.
// For a 132kg safe it was 0.20 to 1.04 m/s, and for the 220kg piano 0.12 to
// 0.62. In other words every heavy object in the catalogue killed a contractor
// outright at a speed slower than walking, so nudging the safe you had come to
// pick up was a one-shot kill, and the piano — the level's headline task, the
// one that needs four hands — could not be moved by anybody without flattening
// whoever was helping. Two co-op assertions had been quarantined as untestable
// because of it.
//
// Kinetic energy is the honest measure of what an impact does to a person: it
// goes as the SQUARE of speed, so heavy-and-slow stops being interchangeable
// with light-and-fast. At these numbers a safe shrugs off being pushed at
// 1.5m/s, bruises at 2.5, hurts properly at 4 and kills at 9; the extinguisher
// is harmless off the conveyor and dangerous thrown; and the piano still
// flattens anyone it lands on from the mezzanine.
export const IMPACT_SAFE_ENERGY = 220;  // joules a prop can hit you with, free
export const IMPACT_DAMAGE_PER_J = 0.030;

// Getting knocked down is the joke, so the bar is low and the recovery is slow.
export const RAGDOLL_TRIGGER_DAMAGE = 12;
export const RAGDOLL_MIN_MS = 1400;
export const RAGDOLL_SETTLE_SPEED = 0.55; // must be this still to get up
export const REVIVE_RADIUS = 1.5;
export const REVIVE_SECONDS = 3.0;
export const DOWNED_BLEEDOUT_MS = 55000;

// --- the grab ---------------------------------------------------------------
// Carrying is a spring, never a parent. The object keeps its own momentum, so
// it swings, clips doorframes, and knocks your friends over. That is the game.
export const GRAB_RANGE = 3.0;
export const GRAB_RADIUS = 0.45;        // fat raycast, so grabbing is forgiving
export const HOLD_DISTANCE = 1.85;
export const HOLD_DISTANCE_MIN = 1.0;
export const HOLD_DISTANCE_MAX = 3.2;
export const GRAB_SPRING = 620;         // N per metre of error
export const GRAB_DAMPING = 42;
export const GRAB_TORQUE_SPRING = 42;
export const GRAB_TORQUE_DAMPING = 7.5;
// What one pair of hands can push with, in newtons — TOTAL, including whatever
// is being spent holding the thing up.
//
// It was 5200, which is 236kg of lift against a stated limit of 140, so one
// contractor could raise a piano over their head and the co-operative carry was
// decorative. Then it was 3080 — exactly 140kg of weight — and that was too
// tight in a way that only showed up over a whole haul: a 132kg safe spends
// 2904N of it merely hovering and has 176N left to be steered with, which is
// 1.3m/s² and not enough to walk it up a ramp. A bot shift banked £0.
//
// 3800 leaves real headroom at the top of the solo range: the safe keeps 896N
// to move with, or 6.8m/s². The ceiling it implies is 173kg of solo lift, and
// the catalogue has a clean gap between the safe at 132 and the bathtub at 190,
// so everything still needs the number of people it was designed to need.
export const GRAB_MAX_FORCE = 3800;
// Three limits, and each governs a different thing. Getting them confused is
// how a hold turns into a catapult:
//   MAX_SPEED  — how fast a carried object may move. The binding constraint.
//   MAX_ACCEL  — how briskly it reaches that speed. Must be GENEROUS: set it
//                low and the servo saturates permanently, which turns a smooth
//                controller into a bang-bang one that oscillates to 40m/s.
//   MAX_FORCE  — absolute strength, i.e. what you cannot lift at all.
export const GRAB_MAX_ACCEL = 260;
// The floor under HORIZONTAL control effort, and only horizontal.
//
// Paying for weight support first is right, but at the top of the solo range it
// leaves almost nothing over: a 132kg safe keeps 896N, and the load trailed 2.9m
// behind a walking contractor against a 3.9m break distance — you could pick a
// safe up and not get it anywhere, which is what a bot shift banking £0 looks
// like from the inside.
//
// Dragging is not lifting, though, and the two deserve separate budgets. You can
// shove a piano across a floor with your shoulder and you cannot raise it an
// inch, so the vertical axis stays limited by what is left after holding the
// thing up, and the horizontal axis gets a floor. That keeps the heavy props
// unliftable alone while making them exactly what the top of this file always
// claimed they were: things that physically drag behind you.
export const GRAB_TRACK_ACCEL = 9.0;
// The hold is a velocity servo, not a spring. A spring plus a force cap looks
// equivalent and is not: the moment the cap bites, the damping term is scaled
// down with everything else, the damper stops damping, and the whole thing
// becomes a bang-bang controller that oscillates a mug up to 34m/s and fires it
// through the floor. A servo clamps the TARGET VELOCITY, so it cannot wind up.
export const GRAB_RESPOND = 15;         // 1/s — how hard it chases the error
// 6.5 rather than 9: overshoot is v^2/2a, so the tracking speed and the accel
// cap together set how far a carried object sails past where you stopped it.
export const GRAB_MAX_SPEED = 6.5;      // m/s — how fast a carry can track
// And chase the hand position rather than teleporting to it, so a fast turn
// drags the object round instead of whipping it.
export const GRAB_TARGET_SPEED = 11;
export const GRAB_BREAK_DISTANCE = 3.9; // yanked this far past the hold, let go
export const GRAB_MAX_MASS = 140;       // heavier than this needs two people
export const THROW_IMPULSE = 7.4;

// Two contractors on one object share the load and each pay half the stamina.
export const COOP_GRAB_BONUS = 2.4;     // mass multiplier per extra pair of hands

// --- props ------------------------------------------------------------------
export const PROP_SLEEP_LINVEL = 0.08;
export const PROP_SLEEP_ANGVEL = 0.12;
export const BREAK_FLASH_MS = 260;

// --- extraction -------------------------------------------------------------
export const EXTRACT_DWELL_MS = 900;    // a prop must sit still in the van
export const QUOTA_GRACE = 0.0;

// --- valves -----------------------------------------------------------------
// Shorter than GRAB_RANGE on purpose. A grab wants to be forgiving because
// missing one costs you a second; a valve wants to be deliberate because
// turning the wrong one costs you a tank.
export const VALVE_REACH = 2.4;
export const VALVE_TURN_MS = 1200;      // they are wheels, not switches

// --- water ------------------------------------------------------------------
// A prop whose origin has been under the line this long is written off. Same
// dwell as extraction, and for the same reason: one frame of contact is noise,
// a second of it is a fact.
export const FLOOD_WRITEOFF_MS = 900;
export const DROWN_DAMAGE_PER_S = 12;   // survivable dunk, fatal trap
// Wading is slow. Applied to the target speed only — acceleration and friction
// are unchanged, so it feels like weight rather than ice.
export const WATER_SPEED_SCALE = 0.55;
// Under this much water over your feet, you are splashing, not swimming.
export const WATER_WADE_DEPTH = 0.35;

// --- wire quantisation ------------------------------------------------------
// 1cm over +/-327m. Levels are nowhere near that big, so this never clips.
export const POS_SCALE = 100;
export const VEL_SCALE = 64;

export const BUTTON = {
  JUMP: 1 << 0,
  SPRINT: 1 << 1,
  CROUCH: 1 << 2,
  GRAB: 1 << 3,
  THROW: 1 << 4,
  USE: 1 << 5,
  PULL: 1 << 6,   // reel a held object in
  PUSH: 1 << 7,   // push it away
};

export const PHASE = {
  LOBBY: 0,
  BRIEFING: 1,
  ACTIVE: 2,
  DEBRIEF: 3,
  RESULTS: 4,
};

export const BRIEFING_MS = 6000;
export const DEBRIEF_MS = 9000;
