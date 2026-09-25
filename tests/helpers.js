// Shared test helpers: load data, build worlds/races, and a simple pursuit driver.
import { loadNodeData } from '../shared/data/nodeLoader.js';
import '../shared/track/track.js';
import { createWorld } from '../shared/track/world.js';
import { Race } from '../shared/sim/race.js';
import { BTN } from '../shared/physics/input.js';

export const DATA = loadNodeData();

export const entrant = (id, extra = {}) => ({ id, racerId: 'draxo', vehicleId: 'ember_roadster', wheelsId: 'standard', gliderId: 'sky_wing', human: true, ...extra });

export function makeRace(trackId, opts = {}) {
  const def = DATA.tracks[trackId] || DATA.arenas[trackId];
  const world = createWorld(def, { mirror: opts.mirror });
  return new Race({ world, laps: opts.laps || 3, seed: 7, skipCountdown: opts.skipCountdown ?? true, entrants: opts.entrants || [entrant('a')], ...opts });
}

// pure pursuit of the main centre line
export function pursuit(world, k, lane = 0) {
  const tgt = world.at(((k.s ?? 0) + 14 + Math.abs(k.speed) * 0.5) / world.length, lane);
  let d = Math.atan2(tgt.x - k.x, tgt.z - k.z) - k.yaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return { steer: Math.max(-1, Math.min(1, -d * 2.5)), btn: BTN.ACCEL };
}
