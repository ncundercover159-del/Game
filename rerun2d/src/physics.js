// RERUN 2D — physics. Axis-aligned boxes in X and Y, nothing else.
//
// Same contract as the 3D build: ghosts are kinematic, they push living
// players, they are never pushed, and they are climbable.

import {
  HALF_W, PLAYER_H, MOVE_SPEED, GROUND_ACCEL, AIR_ACCEL, GRAVITY, MAX_FALL,
  JUMP_VELOCITY, COYOTE_MS, STEP_UP_HEIGHT, GHOST_PUSH_FORCE,
  DEATH_Y, DEATH_REST_Y,
} from './constants.js';
import { ARENA } from './arena.js';

const SKIN = 0.002;
const ITERATIONS = 4;
const POP_CEILING = ARENA.y1 - PLAYER_H - 1;

export function createPlayer(x, y) {
  return {
    x, y, vx: 0, vy: 0,
    facing: 1,
    grounded: false,
    lastGroundedAt: -1e9,
    jumpLatch: false,
    dead: false,
    platVx: 0,
    dist: 0, // metres walked, drives the stride
  };
}

export function resetPlayer(p, x, y) {
  p.x = x; p.y = y; p.vx = 0; p.vy = 0;
  p.facing = 1;
  p.grounded = false;
  p.lastGroundedAt = -1e9;
  p.jumpLatch = false;
  p.dead = false;
  p.platVx = 0;
  p.dist = 0;
}

const approach = (v, t, m) => (t - v > m ? v + m : t - v < -m ? v - m : t);

/** Is there headroom for a body whose feet sit at `feetY`? */
function headroomFree(boxes, x, feetY) {
  const lo = feetY + 0.06;
  const hi = feetY + PLAYER_H;
  for (const b of boxes) {
    if (b.y0 >= hi || b.y1 <= lo) continue;
    if (x + HALF_W > b.x0 && x - HALF_W < b.x1) return false;
  }
  return true;
}

/**
 * world = { boxes:[...], bodies:[{x,y,vx}] }
 * contacts (optional) collects touched ghost indices.
 */
export function stepPlayer(p, input, dt, world, now, contacts) {
  if (p.dead) {
    p.vy = Math.max(p.vy - GRAVITY * dt, -MAX_FALL);
    p.y += p.vy * dt;
    if (p.y <= DEATH_REST_Y) { p.y = DEATH_REST_Y; p.vy = 0; }
    p.vx = 0;
    return;
  }

  const ix = Math.max(-1, Math.min(1, input.x || 0));
  const accel = (p.grounded ? GROUND_ACCEL : AIR_ACCEL) * dt;
  p.vx = approach(p.vx, ix * MOVE_SPEED, accel);
  if (Math.abs(ix) > 0.15) p.facing = ix > 0 ? 1 : -1;

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

  const x0 = p.x;

  // carry whatever we stood on last step
  p.x += p.platVx * dt;
  p.platVx = 0;

  p.x += p.vx * dt;
  resolveX(p, world, dt, now, contacts);

  const prevY = p.y;
  p.y += p.vy * dt;
  resolveY(p, world, prevY, now);

  if (p.grounded) p.dist += Math.abs(p.x - x0);

  if (p.y < DEATH_Y) p.dead = true;

  // Whatever the resolver did, you are still in the building.
  if (p.x < ARENA.x0 + HALF_W) { p.x = ARENA.x0 + HALF_W; if (p.vx < 0) p.vx = 0; }
  if (p.x > ARENA.x1 - HALF_W) { p.x = ARENA.x1 - HALF_W; if (p.vx > 0) p.vx = 0; }
}

function resolveX(p, world, dt, now, contacts) {
  const { boxes, bodies } = world;
  let unresolved = false;
  let bodyContact = false;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    let touched = false;
    bodyContact = false;

    for (const b of boxes) {
      if (b.y1 <= p.y + 0.02 || b.y0 >= p.y + PLAYER_H - 0.02) continue;
      if (p.x + HALF_W <= b.x0 || p.x - HALF_W >= b.x1) continue;

      // Step up — generous, and it works airborne too, so climbing onto a
      // shoulder never needs precision.
      const rise = b.y1 - p.y;
      if (rise > 0 && rise <= STEP_UP_HEIGHT && headroomFree(boxes, p.x, b.y1)) {
        p.y = b.y1;
        if (p.vy < 0) p.vy = 0;
        p.grounded = true;
        p.lastGroundedAt = now;
        touched = true;
        continue;
      }

      // push out the shallow way
      const left = b.x0 - (p.x + HALF_W);
      const right = b.x1 - (p.x - HALF_W);
      if (-left < right) { p.x += left - SKIN; if (p.vx > 0) p.vx = 0; }
      else { p.x += right + SKIN; if (p.vx < 0) p.vx = 0; }
      touched = true;
    }

    for (let i = 0; i < bodies.length; i++) {
      const g = bodies[i];
      if (g.y + PLAYER_H <= p.y + 0.02 || g.y >= p.y + PLAYER_H - 0.02) continue;
      const dx = p.x - g.x;
      if (Math.abs(dx) >= HALF_W * 2) continue;

      if (contacts) contacts.add(i);
      bodyContact = true;

      const gTop = g.y + PLAYER_H;
      const rise = gTop - p.y;
      if (rise > 0 && rise <= STEP_UP_HEIGHT && headroomFree(boxes, p.x, gTop)) {
        p.y = gTop;
        if (p.vy < 0) p.vy = 0;
        p.grounded = true;
        p.lastGroundedAt = now;
        touched = true;
        continue;
      }

      // The living player takes all of the separation; ghosts do not move.
      const n = dx === 0 ? 1 : Math.sign(dx);
      p.x = g.x + n * (HALF_W * 2 + SKIN);
      // ...and gets shoved along the ghost's own direction of travel.
      const dir = Math.abs(g.vx) > 0.25 ? Math.sign(g.vx) : n;
      p.vx += dir * GHOST_PUSH_FORCE * dt;
      touched = true;
    }

    if (!touched) { unresolved = false; break; }
    unresolved = true;
  }

  // A ghost walked through you and there is wall on the other side. Pop up.
  // It looks bad. It is very funny. It stops below the ceiling.
  if (unresolved && bodyContact && p.y < POP_CEILING) {
    p.y += 0.11;
    if (p.vy < 5) p.vy = 5;
    p.grounded = false;
  }
}

function resolveY(p, world, prevY, now) {
  const { boxes, bodies } = world;

  if (p.vy > 0) {
    for (const b of boxes) {
      if (p.x + HALF_W <= b.x0 || p.x - HALF_W >= b.x1) continue;
      if (b.y0 >= p.y + PLAYER_H || b.y1 <= p.y) continue;
      if (prevY + PLAYER_H <= b.y0 + 0.02) { p.y = b.y0 - PLAYER_H; p.vy = 0; break; }
    }
  }

  let top = -Infinity;
  let ridden = -1;
  if (p.vy <= 0.0001) {
    for (const b of boxes) {
      if (p.x + HALF_W <= b.x0 || p.x - HALF_W >= b.x1) continue;
      // swept against the top plane, so a fast fall cannot tunnel through
      if (prevY >= b.y1 - 0.02 && p.y <= b.y1 && b.y1 > top) { top = b.y1; ridden = -1; }
    }
    for (let i = 0; i < bodies.length; i++) {
      const g = bodies[i];
      if (Math.abs(p.x - g.x) >= HALF_W * 2) continue;
      const gTop = g.y + PLAYER_H;
      if (prevY >= gTop - 0.30 && p.y <= gTop + 0.02 && gTop > top) { top = gTop; ridden = i; }
    }
  }

  if (top > -Infinity) {
    p.y = top;
    p.vy = 0;
    p.grounded = true;
    p.lastGroundedAt = now;
    if (ridden >= 0) p.platVx = bodies[ridden].vx;
  } else {
    p.grounded = false;
  }
}
