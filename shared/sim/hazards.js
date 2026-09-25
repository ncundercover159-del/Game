// Hazard effects on karts (server/local authoritative). Geometry and timing
// live in shared/track/hazardState.js so the renderer and probe share them.
import { hitKart, cancelDrift } from '../physics/kart.js';
import { hazardState } from '../track/hazardState.js';

export class HazardSystem {
  constructor(race) {
    this.race = race;
    this.world = race.world;
    this.list = race.world.hazards || [];
    // collapse timing needs the leader's lap; the probe reads it from here
    this.world.hazardRace = race;
  }

  postStep(race, dt) {
    if (race.phase === 'countdown') return;
    const time = race.time;
    for (const h of this.list) {
      const st = hazardState(h, time, race);
      if (!st.active) continue;
      switch (h.type) {
        case 'windGust': {
          for (const k of race.karts) {
            if (!inZone(k, h) || k.rescue > 0 || (k.ribbon || 0) !== 0) continue;
            const f = (h.force ?? 9) * (k.grounded ? 1 : 1.5) / Math.max(0.8, k.mass);
            // dir +1 pushes towards the right of the road (+lane)
            k.ex += -(k.tdz ?? 0) * (h.dir ?? 1) * f * dt;
            k.ez += (k.tdx ?? 1) * (h.dir ?? 1) * f * dt;
          }
          break;
        }
        case 'conveyor': {
          for (const k of race.karts) {
            if (!inZone(k, h) || !k.grounded || k.rescue > 0 || (k.ribbon || 0) !== (h.ribbon || 0)) continue;
            if (h.lane0 !== undefined && ((k.lane ?? 0) < Math.min(h.lane0, h.lane1) || (k.lane ?? 0) > Math.max(h.lane0, h.lane1))) continue;
            const v = (h.speed ?? 8) * (h.dir ?? 1);
            k.ex += (k.tdx ?? 0) * v * dt * 3;
            k.ez += (k.tdz ?? 1) * v * dt * 3;
          }
          break;
        }
        case 'geyser':
          for (const k of race.karts) {
            if (near(k, h, h.r ?? 2.8) && k.grounded && k.invuln <= 0) {
              cancelDrift(k);
              k.vy = 14; k.grounded = false; k.spin = Math.max(k.spin, 0.7); k.speed *= 0.6;
              k.invuln = 1.2;
              race.emit('hazardHit', k.id, { kind: 'geyser' });
            }
          }
          break;
        case 'boulder':
          for (const k of race.karts) {
            if ((k.x - st.x) ** 2 + (k.z - st.z) ** 2 < ((h.r ?? 2.4) + 1) ** 2 && Math.abs(k.y - (st.y - (h.r ?? 2.4))) < 3) {
              if (hitKart(k, 'squish', race.emit, { by: null })) race.emit('hazardHit', k.id, { kind: 'boulder' });
            }
          }
          break;
        case 'carousel': {
          const arms = h.arms ?? 3, R = h.r ?? 8;
          for (const k of race.karts) {
            const dx = k.x - h.x, dz = k.z - h.z;
            const d = Math.hypot(dx, dz);
            if (d > R + 1.5 || d < 1.2 || Math.abs(k.y - h.y) > 3) continue;
            const ka = Math.atan2(dz, dx);
            for (let i = 0; i < arms; i++) {
              let diff = ((ka - (st.angle + (i / arms) * Math.PI * 2)) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
              if (Math.abs(diff * d) < 1.4) {
                if (hitKart(k, 'spin', race.emit, { by: null })) {
                  k.ex += (dx / d) * 10; k.ez += (dz / d) * 10;
                  race.emit('hazardHit', k.id, { kind: 'carousel' });
                }
                break;
              }
            }
          }
          break;
        }
        case 'crusher':
          for (const k of race.karts) {
            const w = (h.w ?? 7) / 2;
            const lx = (k.x - h.x) * (h.rx ?? 1) + (k.z - h.z) * (h.rz ?? 0);
            const lz = (k.x - h.x) * -(h.rz ?? 0) + (k.z - h.z) * (h.rx ?? 1);
            if (Math.abs(lx) < w && Math.abs(lz) < (h.d ?? 3) / 2 && Math.abs(k.y - h.y) < 3) {
              if (hitKart(k, 'squish', race.emit, { by: null })) race.emit('hazardHit', k.id, { kind: 'crusher' });
            }
          }
          break;
        case 'laser':
          for (const k of race.karts) {
            // crossing line at hazard s
            if (k.s === undefined) continue;
            let ds = k.s - (h.t * (this.world.length || 1));
            if (Math.abs(ds) < 1.3 && Math.abs(k.y - h.y) < 3) {
              if (hitKart(k, 'spin', race.emit, { by: null, time: 0.9 })) race.emit('hazardHit', k.id, { kind: 'laser' });
            }
          }
          break;
        case 'ghost': {
          if (!this.world.at) break;
          const p = this.world.at(h.t, st.lane, h.ribbon || 0);
          for (const k of race.karts) {
            if ((k.x - p.x) ** 2 + (k.z - p.z) ** 2 < 4 && Math.abs(k.y - p.y) < 3) {
              if (hitKart(k, 'spin', race.emit, { by: null })) race.emit('hazardHit', k.id, { kind: 'ghost' });
            }
          }
          break;
        }
        default: break;
      }
    }
  }
}

function inZone(k, h) {
  if (k.s === undefined || h.s0 === undefined) return false;
  if (h.s1 >= h.s0) return k.s >= h.s0 && k.s <= h.s1;
  return k.s >= h.s0 || k.s <= h.s1;
}

function near(k, h, r) {
  return (k.x - h.x) ** 2 + (k.z - h.z) ** 2 < r * r && Math.abs(k.y - h.y) < 3;
}
