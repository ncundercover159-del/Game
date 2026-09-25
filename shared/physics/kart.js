// Arcade kart physics shared by client prediction, single-player and the server.
// A kart is a plain object; stepKart() advances it one fixed tick against a
// "world" (track ribbons or battle arena) that answers ground/wall probes.
import { KART } from '../config.js';
import { BTN } from './input.js';
import { clamp, damp, sign, wrapAngle, fwdX, fwdZ, rightX, rightZ } from '../math.js';
import { NEUTRAL_PHYSICS } from './stats.js';

// Surface table. `offroad` surfaces use the kart's off-road multiplier.
export const SURFACES = {
  road:    { offroad: false, grip: 1.0 },
  offroad: { offroad: true,  grip: 0.85 },
  sand:    { offroad: true,  grip: 0.8 },
  snow:    { offroad: true,  grip: 0.7 },
  ice:     { offroad: false, grip: 0.35 },
  metal:   { offroad: false, grip: 1.0 },
  boost:   { offroad: false, grip: 1.0, boost: true },
  lava:    { offroad: true,  grip: 1.0, kill: true },
  void:    { offroad: true,  grip: 1.0, kill: true },
  water:   { offroad: true,  grip: 0.9, splash: true },
};

export function createKart(id, opts = {}) {
  return {
    id,
    x: opts.x || 0, y: opts.y || 0, z: opts.z || 0,
    yaw: opts.yaw || 0,
    speed: 0,         // forward speed along heading (m/s)
    lat: 0,           // sideways slip along the right vector (m/s)
    vy: 0,            // vertical velocity
    vyGround: 0,      // vertical velocity of the ground we are riding
    ex: 0, ez: 0,     // external velocity (knockback, wind, conveyors)
    steer: 0,         // smoothed steering value
    grounded: true,
    airTime: 0,
    trickable: false,
    trickDone: false,
    glider: false,
    gliderAvail: false,
    rampKick: 0,
    hopping: false,
    driftArmed: false,
    drift: 0,         // -1 left, +1 right, 0 none
    driftTime: 0,
    driftCharge: 0,
    driftTier: 0,
    boostTime: 0,
    boostMul: 1,
    boostKind: '',
    padCooldown: 0,
    surface: 'road',
    gnx: 0, gny: 1, gnz: 0,
    groundH: opts.y || 0,
    lastGroundY: opts.y || 0,
    // track-space bookkeeping, written by the world
    ribbon: 0, hint: -1, lateral: 0,
    safeRibbon: 0, safeHint: -1,
    // status effects (seconds remaining)
    spin: 0, tumble: 0, squish: 0, shrink: 0, star: 0, invuln: 0,
    ink: 0, blind: 0, burrow: 0, ghost: 0,
    rescue: 0, rescuePhase: 0,
    stuckTime: 0,
    burnout: 0,
    startRev: -1,     // countdown time at which REV was first pressed
    coins: 0,
    prevBtn: 0,
    phys: opts.phys || NEUTRAL_PHYSICS,
    classMul: opts.classMul || 1,
    rubberMul: 1,
    mass: (opts.phys || NEUTRAL_PHYSICS).mass,
    mirrorSteer: false,
  };
}

// Is the kart currently able to respond to steering/throttle?
export const canControl = (k) => k.spin <= 0 && k.tumble <= 0 && k.rescue <= 0 && k.burnout <= 0;

export function applyBoost(k, time, mul, kind, emit) {
  if (k.rescue > 0) return;
  if (k.boostTime <= 0 || mul >= k.boostMul) k.boostMul = mul;
  k.boostTime = Math.max(k.boostTime, time);
  k.boostKind = kind;
  if (emit) emit('boost', k.id, { kind });
}

export function cancelDrift(k) {
  k.drift = 0;
  k.driftCharge = 0;
  k.driftTier = 0;
  k.driftTime = 0;
}

// Apply a hit. Returns true if it landed. Shield checks happen in the item system.
export function hitKart(k, kind, emit, opts = {}) {
  if (k.rescue > 0 || k.burrow > 0) return false;
  if (k.star > 0 && !opts.ignoreStar) return false;
  if (k.invuln > 0 && !opts.ignoreInvuln) return false;
  cancelDrift(k);
  k.boostTime = 0;
  const lost = Math.min(k.coins, KART.coinsLostOnHit);
  k.coins -= lost;
  if (kind === 'tumble') {
    k.tumble = KART.tumbleTime;
    k.vy = KART.tumbleLaunch;
    k.grounded = false;
    k.speed *= 0.4;
    k.invuln = KART.tumbleTime + KART.invulnAfterHit;
  } else if (kind === 'squish') {
    k.squish = KART.squishTime;
    k.spin = 0.5;
    k.speed *= 0.3;
    k.invuln = 0.6 + KART.invulnAfterHit;
  } else if (kind === 'shrink') {
    k.shrink = opts.time || KART.shrinkTime;
    k.spin = 0.8;
    k.invuln = 0.8;
  } else {
    k.spin = opts.time || KART.spinTime;
    k.invuln = k.spin + KART.invulnAfterHit;
  }
  if (emit) emit('hit', k.id, { kind, lost, by: opts.by });
  return true;
}

export function startRescue(k, emit) {
  if (k.rescue > 0) return;
  k.rescue = KART.rescueTime;
  k.rescuePhase = 0;
  cancelDrift(k);
  k.boostTime = 0;
  k.star = 0;
  k.glider = false;
  if (emit) emit('rescue', k.id, {});
}

const probe = {
  ground: false, h: 0, nx: 0, ny: 1, nz: 0, surface: 'road',
  pen: 0, wnx: 0, wnz: 0, glider: false, ramp: false, rampBoost: 0,
};

// Advance one kart by dt. ctx: { emit(type,id,data), countdown (>0 while counting down), racing }
export function stepKart(k, input, world, dt, ctx) {
  const btn = input.btn | 0;
  const pressed = btn & ~k.prevBtn;
  k.prevBtn = btn;
  const emit = ctx.emit;
  let steerIn = clamp(input.steer || 0, -1, 1);
  if (k.mirrorSteer) steerIn = -steerIn;

  // --- timers -------------------------------------------------------------
  const tick = (key) => { if (k[key] > 0) k[key] = Math.max(0, k[key] - dt); };
  tick('spin'); tick('tumble'); tick('squish'); tick('shrink'); tick('star');
  tick('invuln'); tick('ink'); tick('blind'); tick('burrow'); tick('ghost');
  tick('burnout'); tick('padCooldown');
  if (k.boostTime > 0) {
    k.boostTime -= dt;
    if (k.boostTime <= 0) { k.boostTime = 0; k.boostMul = 1; k.boostKind = ''; }
  }

  // --- rescue: the cloud critter carries the kart back to the track ----------
  if (k.rescue > 0) {
    const before = k.rescue;
    k.rescue -= dt;
    const T = KART.rescueTime;
    if (before > T * 0.45 && k.rescue <= T * 0.45) {
      const sp = world.respawnPoint(k);
      k.x = sp.x; k.y = sp.y + 3.2; k.z = sp.z; k.yaw = sp.yaw;
      k.speed = 0; k.lat = 0; k.vy = 0; k.ex = 0; k.ez = 0;
      k.ribbon = sp.ribbon ?? k.ribbon; k.hint = sp.hint ?? k.hint;
      k.groundH = sp.y; k.lastGroundY = sp.y;
      k.rescuePhase = 1;
      if (emit) emit('respawn', k.id, {});
    }
    if (k.rescuePhase === 1) {
      // lower gently onto the road during the last part of the rescue
      const f = clamp(k.rescue / (T * 0.45), 0, 1);
      k.y = k.groundH + 3.2 * f * f;
    }
    if (k.rescue <= 0) {
      k.rescue = 0;
      k.rescuePhase = 0;
      k.grounded = true;
      k.invuln = Math.max(k.invuln, 1.2);
      k.stuckTime = 0;
    }
    return;
  }

  const st = k.phys;
  const counting = ctx.countdown > 0;
  const control = canControl(k) && !counting && ctx.racing !== false;

  // --- start boost: first REV press during the countdown ------------------------
  if (counting) {
    if ((pressed & (BTN.REV | BTN.DRIFT)) && k.startRev < 0) k.startRev = ctx.countdown;
  } else if (k.startRev !== -2 && ctx.racing !== false) {
    const w = KART.startBoostWindow;
    if (k.startRev >= w[0] && k.startRev <= w[1]) {
      applyBoost(k, KART.startBoostTime, KART.startBoostMul, 'start', emit);
      k.speed = Math.max(k.speed, 12);
      if (emit) emit('startBoost', k.id, {});
    } else if (k.startRev > 1.0) {
      k.burnout = KART.startBurnoutTime;
      if (emit) emit('burnout', k.id, {});
    }
    k.startRev = -2;
  }

  // --- steering smoothing ----------------------------------------------------
  const steerTarget = control ? steerIn : 0;
  k.steer = damp(k.steer, steerTarget, KART.steerResponse, dt);

  // --- target speeds -----------------------------------------------------------
  const surf = SURFACES[k.surface] || SURFACES.road;
  const boosting = k.boostTime > 0;
  let top = KART.baseTopSpeed * k.classMul * st.topSpeedMul * k.rubberMul;
  top *= 1 + Math.min(k.coins, KART.coinMax) * KART.coinSpeedBonus;
  if (k.shrink > 0) top *= KART.shrinkSpeedMul;
  if (k.squish > 0) top *= KART.squishSpeedMul;
  if (k.star > 0) top *= 1.3;
  if (surf.offroad && k.grounded && !boosting && k.star <= 0) top *= st.offroadMul;
  const boostTop = boosting ? top * k.boostMul : top;

  const accel = control && (btn & BTN.ACCEL) && !(btn & BTN.BRAKE);
  const brake = control && (btn & BTN.BRAKE);

  if (k.spin > 0 || k.tumble > 0) {
    k.speed = damp(k.speed, top * KART.spinSpeedMul, 2.6, dt);
  } else if (k.burnout > 0) {
    k.speed = damp(k.speed, 0, 6, dt);
  } else if (boosting) {
    if (k.speed < boostTop) k.speed = Math.min(boostTop, k.speed + KART.boostKickAccel * dt);
    else k.speed = damp(k.speed, boostTop, KART.overspeedDecay, dt);
  } else if (accel) {
    if (k.speed < top) {
      const a = st.accelMul;
      const expo = (top - k.speed) * (1 - Math.exp(-KART.accelRate * a * dt));
      const kick = KART.accelKick * a * dt * clamp(1 - k.speed / top, 0, 1);
      k.speed = Math.min(top, k.speed + expo + kick);
    } else {
      const decay = surf.offroad ? KART.overspeedDecay + KART.offroadDrag : KART.overspeedDecay;
      k.speed = damp(k.speed, top, decay, dt);
    }
  } else if (brake) {
    if (k.speed > 0.5) k.speed = Math.max(0, k.speed - KART.brakeDecel * dt);
    else k.speed = Math.max(-KART.reverseSpeed * st.accelMul, k.speed - 14 * dt);
  } else {
    k.speed = damp(k.speed, 0, KART.coastDrag + (surf.offroad ? KART.offroadDrag : 0), dt);
  }

  // hills: gravity along the slope while grounded
  if (k.grounded && k.gny > 0.2) {
    const fx = fwdX(k.yaw), fz = fwdZ(k.yaw);
    const slope = -(k.gnx * fx + k.gnz * fz) / k.gny; // rise per metre along heading
    k.speed -= KART.slopeGravity * clamp(slope, -0.8, 0.8) * dt;
  }

  // --- hop & drift ----------------------------------------------------------------
  const driftHeld = (btn & BTN.DRIFT) !== 0 && control;
  if (control && (pressed & BTN.DRIFT) && k.grounded && k.speed > 4) {
    k.vy = KART.hopVelocity;
    k.grounded = false;
    k.hopping = true;
    k.trickable = false;
    k.driftArmed = true;
    if (emit) emit('hop', k.id, {});
  }
  if (!driftHeld) {
    if (k.drift !== 0) {
      if (k.driftTier > 0 && control) {
        const tier = k.driftTier;
        applyBoost(k, KART.mtBoostTime[tier - 1] * (0.9 + 0.1 * st.mtChargeMul), KART.mtBoostMul, 'mt' + tier, null);
        if (emit) emit('miniTurbo', k.id, { tier });
      }
      cancelDrift(k);
    }
    k.driftArmed = false;
  } else if (k.drift === 0 && k.driftArmed && k.grounded && k.speed >= KART.driftMinSpeed && Math.abs(steerIn) > 0.3) {
    k.drift = sign(steerIn);
    k.driftCharge = 0;
    k.driftTier = 0;
    k.driftTime = 0;
    if (emit) emit('driftStart', k.id, { dir: k.drift });
  }
  if (k.drift !== 0 && (k.speed < KART.driftMinSpeed * 0.6 || !control)) cancelDrift(k);

  // --- turning -------------------------------------------------------------------
  let yawRate = 0;
  const airFactor = k.grounded ? 1 : k.glider ? KART.gliderTurnFactor : KART.airTurnFactor;
  if (k.drift !== 0) {
    const into = clamp(k.steer * k.drift, -1, 1);
    yawRate = k.drift * (KART.driftBaseTurn + KART.driftRangeTurn * into) * st.driftMul * airFactor;
    k.driftTime += dt;
    if (k.grounded) {
      k.driftCharge += dt * (1 + KART.mtChargeInward * Math.max(0, into)) * st.mtChargeMul;
      let tier = 0;
      for (let i = 0; i < 3; i++) if (k.driftCharge >= KART.mtCharge[i]) tier = i + 1;
      if (tier > k.driftTier) {
        k.driftTier = tier;
        if (emit) emit('mtTier', k.id, { tier });
      }
    }
  } else {
    const spd = Math.abs(k.speed);
    const lowFade = clamp(spd / KART.turnLowSpeed, 0, 1);
    const hiLoss = 1 - KART.highSpeedTurnLoss * clamp(spd / (KART.baseTopSpeed * k.classMul), 0, 1.2);
    yawRate = k.steer * KART.turnRate * st.handlingMul * lowFade * hiLoss * airFactor;
    if (k.speed < 0) yawRate = -yawRate;
  }
  if (k.spin > 0 || k.tumble > 0) yawRate = 0;
  k.yaw = wrapAngle(k.yaw - yawRate * dt); // positive steer = right = yaw decreases

  // lateral slip: outward slide while drifting, grip otherwise
  const grip = (k.drift !== 0 ? KART.driftGripLateral : KART.gripLateral) * surf.grip;
  const latTarget = k.drift !== 0 ? -k.drift * k.speed * KART.driftSlip : -k.steer * k.speed * 0.025;
  k.lat = damp(k.lat, k.grounded ? latTarget : k.lat, grip, dt);

  // external velocity decays
  k.ex = damp(k.ex, 0, KART.extDecay, dt);
  k.ez = damp(k.ez, 0, KART.extDecay, dt);

  // --- integrate horizontal motion ----------------------------------------------------
  const fx = fwdX(k.yaw), fz = fwdZ(k.yaw), rx = rightX(k.yaw), rz = rightZ(k.yaw);
  let vx = fx * k.speed + rx * k.lat + k.ex;
  let vz = fz * k.speed + rz * k.lat + k.ez;
  const px = k.x, pz = k.z;
  k.x += vx * dt;
  k.z += vz * dt;

  // --- vertical: airborne integration ------------------------------------------------
  if (!k.grounded) {
    const g = k.glider && k.vy < 0 ? KART.gliderGravity : KART.gravity;
    k.vy -= g * dt;
    if (k.glider && k.vy < -5) k.vy = -5;
    k.y += k.vy * dt;
    k.airTime += dt;
  }

  // --- world probe -------------------------------------------------------------------
  world.probe(k, k.x, k.y, k.z, probe);

  // walls: push out and reflect the velocity component going into the wall
  if (probe.pen > 0) {
    const nx = probe.wnx, nz = probe.wnz;
    k.x += nx * probe.pen;
    k.z += nz * probe.pen;
    const vn = vx * nx + vz * nz;
    if (vn < 0) {
      const impact = -vn;
      vx -= (1 + KART.wallBounce) * vn * nx;
      vz -= (1 + KART.wallBounce) * vn * nz;
      const speedAbs = Math.hypot(vx, vz) + 1e-6;
      const headOn = impact / (speedAbs + impact);
      const loss = 1 - KART.wallSpeedLoss * headOn * headOn;
      k.speed = (vx * fx + vz * fz) * loss;
      k.lat = (vx * rx + vz * rz) * 0.5;
      const exn = k.ex * nx + k.ez * nz;
      if (exn < 0) { k.ex -= exn * nx; k.ez -= exn * nz; }
      // steer the nose away from the wall so you slide along it instead of scraping
      let tx = nz, tz = -nx;
      if (tx * fx + tz * fz < 0) { tx = -tx; tz = -tz; }
      const side = tx * rx + tz * rz > 0 ? -1 : 1;
      k.yaw = wrapAngle(k.yaw + side * Math.min(0.08, impact * 0.012));
      if (impact > 3 && emit) emit('wallHit', k.id, { impact });
    }
  }

  const takeoff = () => {
    // the ground fell away (ramp lip, crest, ledge, gap): take off
    k.grounded = false;
    k.vy = Math.max(k.vyGround, 0) + (k.rampKick || 0);
    k.airTime = 0;
    k.trickable = true;
    k.trickDone = false;
    k.glider = probe.glider || k.gliderAvail;
    if (k.glider && emit) emit('glider', k.id, {});
    if (emit) emit('takeoff', k.id, { glider: k.glider });
  };
  if (k.grounded) {
    const moved = Math.hypot(k.x - px, k.z - pz);
    const allowDrop = KART.maxStepDown * moved + 0.02;
    if (probe.ground && probe.h >= k.y - allowDrop) {
      k.vyGround = clamp((probe.h - k.y) / dt, -40, 40);
      k.y = probe.h;
      k.gliderAvail = probe.glider;
      k.rampKick = probe.rampBoost;
    } else {
      takeoff();
    }
  } else if (probe.ground && k.y <= probe.h && k.y >= probe.h - Math.max(1.2, -k.vy * dt * 2.5)) {
    // landing (also catches the ground rising into us while still going up)
    const impactV = Math.max(0, -k.vy);
    k.y = probe.h;
    const wasHop = k.hopping;
    k.hopping = false;
    if (!wasHop && impactV > 15 && k.tumble <= 0 && k.airTime > 0.3) {
      k.vy = Math.min(2.2, impactV * KART.landingBounce);
    } else {
      k.vy = 0;
      k.grounded = true;
    }
    k.vyGround = 0;
    if (k.trickDone && k.airTime >= KART.trickMinAir) {
      applyBoost(k, KART.trickBoostTime, KART.trickBoostMul, 'trick', emit);
    }
    if (!wasHop && emit) emit('land', k.id, { air: k.airTime, impact: impactV });
    k.airTime = 0;
    k.trickDone = false;
    k.trickable = false;
    k.glider = false;
    k.gliderAvail = false;
  }
  if (probe.ground) {
    k.groundH = probe.h;
    if (k.grounded) {
      k.gnx = probe.nx; k.gny = probe.ny; k.gnz = probe.nz;
      k.surface = probe.surface;
      if (!SURFACES[probe.surface]?.kill) {
        k.lastGroundY = probe.h;
        k.safeRibbon = k.ribbon;
        k.safeHint = k.hint;
      }
    }
  }

  // tricks: tap TRICK while airborne off a ramp or ledge
  if (!k.grounded && k.trickable && !k.trickDone && (pressed & (BTN.TRICK | BTN.DRIFT)) && control) {
    k.trickDone = true;
    if (emit) emit('trick', k.id, {});
  }

  // --- surfaces ---------------------------------------------------------------------
  if (k.grounded) {
    const s = SURFACES[k.surface] || SURFACES.road;
    if (s.boost && k.padCooldown <= 0) {
      applyBoost(k, KART.padBoostTime, KART.padBoostMul, 'pad', emit);
      k.padCooldown = 0.25;
    }
    if (s.kill && k.burrow <= 0) startRescue(k, emit);
  }

  // --- falls and stuck detection -------------------------------------------------------
  if (k.rescue <= 0 && k.y < k.lastGroundY - KART.fallDepth) startRescue(k, emit);
  if (k.rescue <= 0 && control && (btn & BTN.ACCEL) && Math.abs(k.speed) < 1.2 && k.grounded) {
    k.stuckTime += dt;
    if (k.stuckTime > KART.stuckTime) { k.stuckTime = 0; startRescue(k, emit); }
  } else {
    k.stuckTime = 0;
  }
}

// Kart-vs-kart sphere collisions with weight-based impulses.
export function collideKarts(karts, emit) {
  const R = KART.radius;
  for (let i = 0; i < karts.length; i++) {
    const a = karts[i];
    if (a.rescue > 0 || a.burrow > 0 || a.eliminated) continue;
    for (let j = i + 1; j < karts.length; j++) {
      const b = karts[j];
      if (b.rescue > 0 || b.burrow > 0 || b.eliminated) continue;
      const ra = R * (a.shrink > 0 ? 0.6 : 1) * (a.ghost > 0 ? 1.6 : 1);
      const rb = R * (b.shrink > 0 ? 0.6 : 1) * (b.ghost > 0 ? 1.6 : 1);
      const dx = b.x - a.x, dz = b.z - a.z, dy = b.y - a.y;
      if (Math.abs(dy) > 2) continue;
      const d2 = dx * dx + dz * dz;
      const minD = ra + rb;
      if (d2 >= minD * minD || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d, nz = dz / d;
      const pen = minD - d;
      const ma = a.mass * (a.star > 0 ? 4 : 1), mb = b.mass * (b.star > 0 ? 4 : 1);
      const wa = mb / (ma + mb), wb = ma / (ma + mb);
      a.x -= nx * pen * wa; a.z -= nz * pen * wa;
      b.x += nx * pen * wb; b.z += nz * pen * wb;
      // relative closing velocity along the normal
      const avx = fwdX(a.yaw) * a.speed + a.ex, avz = fwdZ(a.yaw) * a.speed + a.ez;
      const bvx = fwdX(b.yaw) * b.speed + b.ex, bvz = fwdZ(b.yaw) * b.speed + b.ez;
      const closing = (avx - bvx) * nx + (avz - bvz) * nz;
      const imp = KART.bumpImpulse + Math.max(0, closing) * 0.35;
      a.ex -= nx * imp * wa; a.ez -= nz * imp * wa;
      b.ex += nx * imp * wb; b.ez += nz * imp * wb;
      // star power / shrunk squish
      if (a.star > 0 && b.star <= 0) hitKart(b, 'tumble', emit, { by: a.id });
      else if (b.star > 0 && a.star <= 0) hitKart(a, 'tumble', emit, { by: b.id });
      else if (a.shrink > 0 && b.shrink <= 0) hitKart(a, 'squish', emit, { by: b.id, ignoreInvuln: false });
      else if (b.shrink > 0 && a.shrink <= 0) hitKart(b, 'squish', emit, { by: a.id, ignoreInvuln: false });
      if (emit) emit('bump', a.id, { other: b.id, strength: imp });
    }
  }
}
