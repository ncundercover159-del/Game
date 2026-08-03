// RERUN — pressure plates.
//
// Evaluated on the server only. The client's ghost positions are interpolated
// and will disagree at the boundaries, so plate state is always taken from the
// server's tick, never computed locally.

import { PLATES } from './arena.js';
import {
  PLATE_RADIUS,
  PLATE_ACTIVATION_MASS,
  PLATE_FOOT_ABOVE,
  PLATE_FOOT_BELOW,
  MOMENTUM_HOLD_MS,
} from './constants.js';

const R2 = PLATE_RADIUS * PLATE_RADIUS;

export function createPlateStates() {
  return PLATES.map((p) => ({
    id: p.id,
    mass: 0,
    prevMass: 0,
    pressed: false,
    momentumUntil: 0,
    contributors: [],
  }));
}

export function resetPlateStates(states) {
  for (const s of states) {
    s.mass = 0;
    s.prevMass = 0;
    s.pressed = false;
    s.momentumUntil = 0;
    s.contributors.length = 0;
  }
}

/**
 * bodies: [{ x, y, z, kind: 'live'|'ghost', ref }]
 * Returns nothing; mutates `states`. `contributors` holds the bodies standing
 * on each pressed plate so plate-seconds can be attributed.
 */
export function evaluatePlates(states, bodies, now) {
  for (let i = 0; i < PLATES.length; i++) {
    const plate = PLATES[i];
    const st = states[i];
    st.contributors.length = 0;

    let mass = 0;
    for (let b = 0; b < bodies.length; b++) {
      const body = bodies[b];
      const dy = body.y - plate.y;
      if (dy < -PLATE_FOOT_BELOW || dy > PLATE_FOOT_ABOVE) continue;
      const dx = body.x - plate.x;
      const dz = body.z - plate.z;
      if (dx * dx + dz * dz > R2) continue;
      mass++;
      st.contributors.push(body);
    }

    st.prevMass = st.mass;
    st.mass = mass;

    if (plate.momentum) {
      // Only stays down while weight is *increasing*. It wants arrivals, not
      // residents.
      if (mass > st.prevMass) st.momentumUntil = now + MOMENTUM_HOLD_MS;
      st.pressed = mass >= PLATE_ACTIVATION_MASS && now < st.momentumUntil;
    } else {
      st.pressed = mass >= PLATE_ACTIVATION_MASS;
    }
  }
}

export function doorIsOpen(states) {
  for (let i = 0; i < PLATES.length; i++) {
    if (PLATES[i].holdsDoor && states[i].pressed) return true;
  }
  return false;
}

export function pressedMask(states) {
  let m = 0;
  for (let i = 0; i < states.length; i++) if (states[i].pressed) m |= 1 << i;
  return m;
}

