// Stat totals (0..10) = size-class base + racer mods + vehicle + wheels + glider.
// statsToPhysics() maps totals to the multipliers the kart physics uses.
import { KART } from '../config.js';
import { clamp, lerp } from '../math.js';

export const STAT_KEYS = ['speed', 'accel', 'weight', 'handling', 'drift', 'offroad', 'miniTurbo'];

export const SIZE_BASE = {
  light:  { speed: 3.5, accel: 6.5, weight: 2.0, handling: 6.5, drift: 6.0, offroad: 5.5, miniTurbo: 6.0 },
  medium: { speed: 5.0, accel: 5.0, weight: 5.0, handling: 5.0, drift: 5.0, offroad: 5.0, miniTurbo: 5.0 },
  heavy:  { speed: 6.5, accel: 3.5, weight: 8.0, handling: 3.5, drift: 4.0, offroad: 4.5, miniTurbo: 4.0 },
};

export function totalStats(racer, vehicle, wheels, glider) {
  const base = SIZE_BASE[racer?.size || 'medium'] || SIZE_BASE.medium;
  const out = {};
  for (const key of STAT_KEYS) {
    let v = base[key];
    v += racer?.stats?.[key] || 0;
    v += vehicle?.stats?.[key] || 0;
    v += wheels?.stats?.[key] || 0;
    v += glider?.stats?.[key] || 0;
    out[key] = clamp(v, 0, 10);
  }
  return out;
}

export function statsToPhysics(s) {
  return {
    topSpeedMul: 0.92 + 0.016 * s.speed,
    accelMul: 0.72 + 0.07 * s.accel,
    handlingMul: 0.82 + 0.036 * s.handling,
    driftMul: 0.88 + 0.024 * s.drift,
    mass: 0.75 + 0.07 * s.weight,
    offroadMul: lerp(KART.offroadMul, KART.offroadMulBest, s.offroad / 10),
    mtChargeMul: 0.84 + 0.036 * s.miniTurbo,
  };
}

export const NEUTRAL_PHYSICS = statsToPhysics(SIZE_BASE.medium);
