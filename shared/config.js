// SkyKart tunables: every "feel" number lives here.
// Units are metres, seconds and radians. Stats run 0..10 and are
// mapped to multipliers by statToMul() in physics/stats.js.

export const SIM = {
  hz: 60,                 // fixed simulation rate (client and server)
  dt: 1 / 60,
  snapshotHz: 20,         // server -> client snapshot rate
  interpDelay: 0.1,       // remote kart interpolation delay (s)
  maxRacers: 12,
};

export const KART = {
  // --- speed -------------------------------------------------------------
  baseTopSpeed: 30,        // m/s at 150cc with a neutral (5/10) speed stat
  reverseSpeed: 9,
  accelRate: 1.15,         // exponential approach rate toward top speed (1/s)
  accelKick: 9,            // extra flat accel (m/s^2) at low speed so starts feel punchy
  overspeedDecay: 1.6,     // how fast speed above top bleeds off after boosts (1/s)
  coastDrag: 0.7,          // no throttle: exponential decay (1/s)
  brakeDecel: 34,          // m/s^2
  slopeGravity: 9,         // how much hills speed up/slow down (m/s^2 per unit slope)

  // --- steering ----------------------------------------------------------
  turnRate: 1.75,          // rad/s at full lock (scaled by handling)
  turnLowSpeed: 7,         // below this speed turn rate fades out (m/s)
  highSpeedTurnLoss: 0.18, // fraction of turn rate lost at top speed
  steerResponse: 12,       // how fast the steering value follows input (1/s)
  airTurnFactor: 0.45,
  gripLateral: 9,          // lateral slip decay while gripping (1/s)

  // --- drift / mini-turbo --------------------------------------------------
  hopVelocity: 3.6,
  driftMinSpeed: 11,
  driftBaseTurn: 1.25,     // rad/s turning while drifting with neutral stick
  driftRangeTurn: 0.85,    // +/- added by steering into / countering the drift
  driftSlip: 0.22,         // outward slide as a fraction of speed
  driftGripLateral: 3.2,
  driftVisualYaw: 0.34,    // extra body yaw (visual only) while drifting
  driftStartWindow: 0.35,  // after the hop, time allowed to pick a direction
  mtCharge: [0.95, 1.95, 3.05],   // charge needed for blue / orange / purple
  mtBoostTime: [0.55, 1.05, 1.6], // boost duration per tier (s)
  mtBoostMul: 1.26,        // top speed multiplier during mini-turbo boost
  mtChargeInward: 0.4,     // extra charge rate when steering into the drift

  // --- boosts ------------------------------------------------------------
  boostKickAccel: 42,      // how hard a boost pushes toward boosted top speed (m/s^2)
  padBoostTime: 1.1,
  padBoostMul: 1.34,
  shroomBoostTime: 1.3,
  shroomBoostMul: 1.4,
  startBoostTime: 1.2,
  startBoostMul: 1.36,
  startBoostWindow: [0.05, 0.42], // seconds before GO in which a rev press is perfect
  startBurnoutTime: 0.9,   // rev too early -> wheelspin
  trickBoostTime: 0.55,
  trickBoostMul: 1.25,
  trickMinAir: 0.22,       // air time needed for a trick to count

  // --- surfaces ----------------------------------------------------------
  offroadMul: 0.55,        // top speed on off-road for offroad stat 0
  offroadMulBest: 0.78,    // ... for offroad stat 10
  offroadDrag: 1.6,

  // --- vertical ----------------------------------------------------------
  gravity: 30,
  gliderGravity: 9,
  gliderTurnFactor: 0.9,
  maxStepDown: 0.55,       // per-metre drop allowed while staying glued to ground
  landingBounce: 0.18,

  // --- collisions ----------------------------------------------------------
  radius: 1.05,
  wallBounce: 0.35,        // restitution against walls
  wallSpeedLoss: 0.55,     // fraction of speed lost at a head-on wall hit
  bumpImpulse: 7.5,        // kart-vs-kart base impulse (m/s)
  extDecay: 3.2,           // external velocity decay (1/s)

  // --- coins ---------------------------------------------------------------
  coinMax: 10,
  coinSpeedBonus: 0.012,   // +1.2 % top speed per coin
  coinsLostOnHit: 3,

  // --- hit states ------------------------------------------------------------
  spinTime: 1.15,
  spinSpeedMul: 0.25,
  tumbleTime: 1.7,
  tumbleLaunch: 9,
  squishTime: 1.6,
  squishSpeedMul: 0.6,
  shrinkTime: 6,
  shrinkSpeedMul: 0.72,
  invulnAfterHit: 1.2,

  // --- rescue ------------------------------------------------------------
  rescueTime: 1.9,
  stuckTime: 4.5,
  fallDepth: 9,            // below last ground height -> rescue
};

// Engine classes: speed multiplier plus AI difficulty default.
export const CLASSES = {
  '50cc':   { speedMul: 0.72, label: '50cc',   ai: 'easy' },
  '100cc':  { speedMul: 0.86, label: '100cc',  ai: 'normal' },
  '150cc':  { speedMul: 1.0,  label: '150cc',  ai: 'hard' },
  'mirror': { speedMul: 1.0,  label: 'Mirror', ai: 'hard', mirror: true },
  '200cc':  { speedMul: 1.2,  label: '200cc',  ai: 'expert', brakeDriftBonus: true },
};

// Rubber-banding. Applied to top speed and item odds for everyone
// (humans and AI) based on position and distance to the leader.
export const RUBBER_BAND = {
  enabled: true,
  catchUpMax: 0.075,        // max top speed bonus far behind the leader
  catchUpDistance: 180,     // metres behind leader for full bonus
  aiCatchUpScale: 1.25,     // AI gets slightly more (still "fair" physics)
  leaderPenalty: 0.025,     // leader loses this much top speed when far ahead
  leaderLeadDistance: 90,   // lead (m) over 2nd for full penalty
  humanScale: 0.7,          // humans get a milder effect
};

export const RACE = {
  countdown: 3.0,           // 3-2-1 (GO at 0)
  introTime: 4.0,           // camera fly-through before countdown
  finishGrace: 25,          // seconds after 1st human finishes before remaining are placed
  wrongWayTime: 1.1,
  gridRowGap: 5.2,
  gridColGap: 4.2,
  points: [15, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  coinsPerPlace: [40, 32, 26, 22, 18, 15, 12, 10, 8, 6, 5, 4],
};

// Item odds by normalised position bucket (0 = leader ... 1 = last).
// Each row: [bucketMax, {itemId: weight}]. Signature items replace a roll
// with probability ITEMS.signatureChance.
export const ITEM_ODDS = [
  [0.0,  { peel: 30, orb: 28, coinPack: 14, peel3: 8, magnet: 10, horn: 6, seeker: 4 }],
  [0.25, { peel: 14, orb: 18, seeker: 16, shroom: 12, peel3: 8, orb3: 8, magnet: 8, ink: 8, horn: 5, coinPack: 3 }],
  [0.5,  { orb: 10, seeker: 16, shroom: 16, orb3: 10, seeker3: 8, ink: 10, shroom3: 10, magnet: 6, comet: 4, horn: 4, peel3: 6 }],
  [0.75, { seeker: 12, seeker3: 14, shroom3: 18, star: 10, goldShroom: 10, comet: 8, bolt: 4, ink: 8, orb3: 8, horn: 3 }],
  [1.0,  { shroom3: 18, star: 20, goldShroom: 18, bolt: 10, seeker3: 12, comet: 10, ink: 6, horn: 2 }],
];

export const ITEMS = {
  signatureChance: 0.12,
  rouletteTime: 1.6,
  boxRespawn: 2.2,
  orbSpeed: 52,
  orbLife: 7,
  orbBounces: 5,
  seekerSpeed: 48,
  seekerTurn: 5,
  seekerLife: 10,
  cometSpeed: 70,
  cometWarn: 3.2,          // warning time before impact on the leader
  cometRadius: 7,
  boltShrink: 6.5,
  inkTime: 4.5,
  starTime: 7.5,
  starMul: 1.3,
  goldShroomTime: 7,
  magnetRadius: 14,
  magnetTime: 3,
  hornRadius: 12,
  peelRadius: 1.2,
  hitRadius: 1.9,          // forgiving projectile-vs-kart radius
  trailDistance: 2.6,      // distance of trailing (held behind) items
  orbitRadius: 2.3,
};

export const BATTLE = {
  balloons: 3,
  timeLimit: 180,
  coinRunnersTime: 120,
  coinsDroppedOnHit: 5,
  respawnInvuln: 2.5,
};

export const AI = {
  difficulties: {
    easy:   { lineNoise: 0.45, lookAhead: 0.95, driftTier: 1, reaction: 0.9, itemDelay: [2.5, 6], mistake: 0.06, shortcuts: false, brakeTurns: 0.7, pace: 0.94 },
    normal: { lineNoise: 0.28, lookAhead: 1.0,  driftTier: 2, reaction: 0.55, itemDelay: [1.2, 4], mistake: 0.03, shortcuts: false, brakeTurns: 0.85, pace: 0.97 },
    hard:   { lineNoise: 0.14, lookAhead: 1.05, driftTier: 2, reaction: 0.3, itemDelay: [0.6, 2.5], mistake: 0.012, shortcuts: true, brakeTurns: 1.0, pace: 1.0 },
    expert: { lineNoise: 0.08, lookAhead: 1.1,  driftTier: 3, reaction: 0.18, itemDelay: [0.3, 1.6], mistake: 0.005, shortcuts: true, brakeTurns: 1.0, pace: 1.025 },
  },
  personalities: {
    aggressive: { fireForward: 0.9, holdShield: 0.2, bumpiness: 0.8, itemEagerness: 1.5 },
    hoarder:    { fireForward: 0.4, holdShield: 0.95, bumpiness: 0.2, itemEagerness: 0.5 },
    clean:      { fireForward: 0.6, holdShield: 0.6, bumpiness: 0.1, itemEagerness: 0.9 },
    chaotic:    { fireForward: 0.5, holdShield: 0.3, bumpiness: 0.6, itemEagerness: 1.3, wobble: 0.5 },
  },
};

export const NET = {
  reconnectGrace: 60,
  maxInputRate: 70,        // inputs per second accepted per client
  lagWarnMs: 250,
  roomCodeChars: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
};

export const PROGRESSION = {
  coinsPerRaceCoin: 1,     // each coin collected in a race banks this many
  trophyBonus: { gold: 150, silver: 90, bronze: 50 },
};
