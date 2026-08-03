// RERUN — hand-rolled physics.
//
// A living player is a vertical capsule (a circle in XZ with a height span).
// The world is axis-aligned boxes plus a list of kinematic ghost bodies.
// Ghosts push. Ghosts are never pushed. This file is the entire simulation and
// it runs byte-identically on the server and in the client's local prediction.

import {
  PLAYER_RADIUS as R,
  PLAYER_HEIGHT as H,
  BODY_RADIUS,
  MOVE_SPEED,
  GROUND_ACCEL,
  AIR_ACCEL,
  GRAVITY,
  MAX_FALL,
  JUMP_VELOCITY,
  COYOTE_MS,
  STEP_UP_HEIGHT,
  GHOST_PUSH_FORCE,
  DEATH_Y,
  DEATH_REST_Y,
} from './constants.js';

const BODY_SUM_R = R + BODY_RADIUS;

export function createPlayerState(x, z, yaw = Math.PI) {
  return {
    x, y: 0, z, yaw,
    vx: 0, vy: 0, vz: 0,
    platVx: 0, platVz: 0,
    grounded: false,
    lastGroundedAt: -1e9,
    jumpLatch: false,
    dead: false,
    deadAt: 0,
    onBody: -1, // index into world.bodies, or -1
  };
}

export function resetPlayerState(p, x, z, yaw = Math.PI) {
  p.x = x; p.y = 0; p.z = z; p.yaw = yaw;
  p.vx = 0; p.vy = 0; p.vz = 0;
  p.platVx = 0; p.platVz = 0;
  p.grounded = false;
  p.lastGroundedAt = -1e9;
  p.jumpLatch = false;
  p.dead = false;
  p.deadAt = 0;
  p.onBody = -1;
}

function approach(v, target, maxDelta) {
  const d = target - v;
  if (d > maxDelta) return v + maxDelta;
  if (d < -maxDelta) return v - maxDelta;
  return target;
}

function clampN(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Is there room for a body whose feet sit at `feetY` at (x,z)? */
function headroomFree(boxes, x, z, feetY) {
  const lo = feetY + 0.06;
  const hi = feetY + H;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (b.y0 >= hi || b.y1 <= lo) continue;
    const cx = clampN(x, b.x0, b.x1);
    const cz = clampN(z, b.z0, b.z1);
    const dx = x - cx, dz = z - cz;
    if (dx * dx + dz * dz < R * R - 1e-6) return false;
  }
  return true;
}

/**
 * Advance one living player by dt.
 *
 * world = { boxes: [...], bodies: [{x,y,z,vx,vz}] }
 * contacts (optional) receives the indices of ghost bodies touched this step.
 */
export function stepPlayer(p, input, dt, world, now, contacts) {
  if (p.dead) {
    // Deaths replay too, so keep simulating the fall — the ghost needs the
    // whole descent on tape.
    p.vy = Math.max(p.vy - GRAVITY * dt, -MAX_FALL);
    p.y += p.vy * dt;
    if (p.y <= DEATH_REST_Y) { p.y = DEATH_REST_Y; p.vy = 0; }
    p.vx = 0; p.vz = 0;
    return;
  }

  // --- stick -> target velocity ------------------------------------------
  let ix = input.x || 0;
  let iz = -(input.y || 0); // stick up (screen) is north (-Z)
  const mag = Math.hypot(ix, iz);
  if (mag > 1) { ix /= mag; iz /= mag; }

  const accel = (p.grounded ? GROUND_ACCEL : AIR_ACCEL) * dt;
  p.vx = approach(p.vx, ix * MOVE_SPEED, accel);
  p.vz = approach(p.vz, iz * MOVE_SPEED, accel);
  if (mag > 0.12) p.yaw = Math.atan2(ix, iz);

  // --- jump: fixed height, no double jump, ~100ms of coyote ---------------
  if (input.jump) {
    if (!p.jumpLatch && (p.grounded || now - p.lastGroundedAt <= COYOTE_MS)) {
      p.vy = JUMP_VELOCITY;
      p.grounded = false;
      p.lastGroundedAt = -1e9;
    }
    p.jumpLatch = true;
  } else {
    p.jumpLatch = false;
  }

  p.vy -= GRAVITY * dt;
  if (p.vy < -MAX_FALL) p.vy = -MAX_FALL;

  // --- ride whatever we were standing on last step ------------------------
  p.x += p.platVx * dt;
  p.z += p.platVz * dt;
  p.platVx = 0;
  p.platVz = 0;

  // --- horizontal ---------------------------------------------------------
  p.x += p.vx * dt;
  p.z += p.vz * dt;
  resolveHorizontal(p, world, dt, now, contacts);

  // --- vertical -----------------------------------------------------------
  const prevY = p.y;
  p.y += p.vy * dt;
  resolveVertical(p, world, prevY, now);

  if (!p.dead && p.y < DEATH_Y) {
    p.dead = true;
    p.deadAt = now;
  }
}

const RESOLVE_ITERATIONS = 4;
// Separate a hair past contact. Without this, float residue leaves the body
// touching after every push and the resolver can never report convergence —
// which would make every ordinary bump look like a pin.
const SKIN = 0.002;

function resolveHorizontal(p, world, dt, now, contacts) {
  const boxes = world.boxes;
  const bodies = world.bodies;

  // If the resolver is still pushing after the last iteration, the constraints
  // conflict — which in practice means a ghost has walked into you and a wall
  // is on the other side.
  let unresolved = false;
  let bodyContact = false;

  for (let iter = 0; iter < RESOLVE_ITERATIONS; iter++) {
    let touched = false;
    bodyContact = false;

    // --- boxes ---
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const feet = p.y;
      if (b.y1 <= feet + 0.02 || b.y0 >= feet + H - 0.02) continue;

      const cx = clampN(p.x, b.x0, b.x1);
      const cz = clampN(p.z, b.z0, b.z1);
      const dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= R * R - 1e-6) continue;

      // Step up. Generous, and it works in the air too — climbing shouldn't
      // require precision.
      const rise = b.y1 - feet;
      if (rise > 0 && rise <= STEP_UP_HEIGHT && headroomFree(boxes, p.x, p.z, b.y1)) {
        p.y = b.y1;
        if (p.vy < 0) p.vy = 0;
        p.grounded = true;
        p.lastGroundedAt = now;
        touched = true;
        continue;
      }

      const d = Math.sqrt(d2);
      if (d < 1e-5) {
        // Centre is inside the box: eject along the shallowest axis.
        const px0 = p.x - b.x0, px1 = b.x1 - p.x;
        const pz0 = p.z - b.z0, pz1 = b.z1 - p.z;
        const mn = Math.min(px0, px1, pz0, pz1);
        if (mn === px0) p.x = b.x0 - R - SKIN;
        else if (mn === px1) p.x = b.x1 + R + SKIN;
        else if (mn === pz0) p.z = b.z0 - R - SKIN;
        else p.z = b.z1 + R + SKIN;
      } else {
        const nx = dx / d, nz = dz / d;
        const push = R - d + SKIN;
        p.x += nx * push;
        p.z += nz * push;
        const vn = p.vx * nx + p.vz * nz;
        if (vn < 0) { p.vx -= vn * nx; p.vz -= vn * nz; }
      }
      touched = true;
    }

    // --- ghost bodies ---
    for (let i = 0; i < bodies.length; i++) {
      const g = bodies[i];
      const feet = p.y;
      const gTop = g.y + H;
      if (gTop <= feet + 0.02 || g.y >= feet + H - 0.02) continue;

      let dx = p.x - g.x, dz = p.z - g.z;
      let d2 = dx * dx + dz * dz;
      if (d2 >= BODY_SUM_R * BODY_SUM_R) continue;

      if (contacts) contacts.add(i);
      bodyContact = true;

      // Shoulders are climbable.
      const rise = gTop - feet;
      if (rise > 0 && rise <= STEP_UP_HEIGHT && headroomFree(boxes, p.x, p.z, gTop)) {
        p.y = gTop;
        if (p.vy < 0) p.vy = 0;
        p.grounded = true;
        p.lastGroundedAt = now;
        p.onBody = i;
        touched = true;
        continue;
      }

      let d = Math.sqrt(d2);
      let nx, nz;
      if (d < 1e-5) { nx = 1; nz = 0; d = 1e-5; } else { nx = dx / d; nz = dz / d; }

      // The living player takes 100% of the separation. Ghosts do not move.
      const push = BODY_SUM_R - d + SKIN;
      p.x += nx * push;
      p.z += nz * push;

      // ...and gets shoved along the ghost's velocity vector.
      const gspeed = Math.hypot(g.vx, g.vz);
      let sx = nx, sz = nz;
      if (gspeed > 0.25) { sx = g.vx / gspeed; sz = g.vz / gspeed; }
      p.vx += sx * GHOST_PUSH_FORCE * dt;
      p.vz += sz * GHOST_PUSH_FORCE * dt;

      touched = true;
    }

    if (!touched) { unresolved = false; break; }
    unresolved = true;
  }

  // Degenerate case: a ghost walked through you and there is geometry on the
  // other side, so the resolver can't satisfy both. Pop upward.
  // It looks bad. It is very funny. It is not fixed further than this.
  if (unresolved && bodyContact) {
    p.y += 0.11;
    if (p.vy < 5.0) p.vy = 5.0;
    p.grounded = false;
    p.onBody = -1;
  }
}

function resolveVertical(p, world, prevY, now) {
  const boxes = world.boxes;
  const bodies = world.bodies;

  // Head bumps first.
  if (p.vy > 0) {
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (b.y0 >= p.y + H || b.y1 <= p.y) continue;
      const cx = clampN(p.x, b.x0, b.x1);
      const cz = clampN(p.z, b.z0, b.z1);
      const dx = p.x - cx, dz = p.z - cz;
      if (dx * dx + dz * dz >= R * R) continue;
      if (prevY + H <= b.y0 + 0.02) {
        p.y = b.y0 - H;
        p.vy = 0;
        break;
      }
    }
  }

  let top = -Infinity;
  let ridden = -1;

  if (p.vy <= 0.0001) {
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const cx = clampN(p.x, b.x0, b.x1);
      const cz = clampN(p.z, b.z0, b.z1);
      const dx = p.x - cx, dz = p.z - cz;
      if (dx * dx + dz * dz >= R * R) continue;
      // Swept against the top plane so a fast fall can't tunnel through.
      if (prevY >= b.y1 - 0.02 && p.y <= b.y1 && b.y1 > top) {
        top = b.y1;
        ridden = -1;
      }
    }

    for (let i = 0; i < bodies.length; i++) {
      const g = bodies[i];
      const gTop = g.y + H;
      const dx = p.x - g.x, dz = p.z - g.z;
      if (dx * dx + dz * dz >= BODY_SUM_R * BODY_SUM_R) continue;
      // Ghosts move vertically too, so landing gets a fat tolerance.
      if (prevY >= gTop - 0.30 && p.y <= gTop + 0.02 && gTop > top) {
        top = gTop;
        ridden = i;
      }
    }
  }

  if (top > -Infinity) {
    p.y = top;
    p.vy = 0;
    p.grounded = true;
    p.lastGroundedAt = now;
    p.onBody = ridden;
    if (ridden >= 0) {
      // Stand on a moving ghost and you go where it goes.
      p.platVx = bodies[ridden].vx;
      p.platVz = bodies[ridden].vz;
    }
  } else {
    p.grounded = false;
    p.onBody = -1;
  }
}
