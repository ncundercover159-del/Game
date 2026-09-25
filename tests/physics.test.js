import { describe, it, expect } from 'vitest';
import { makeRace, pursuit, DATA, entrant } from './helpers.js';
import { createKart, stepKart } from '../shared/physics/kart.js';
import { ArenaWorld } from '../shared/track/arena.js';
import { BTN } from '../shared/physics/input.js';
import { KART } from '../shared/config.js';
import { makeRng } from '../shared/math.js';

function runScripted(seed) {
  const world = new ArenaWorld(DATA.arenas.test_plane);
  const k = createKart('a', { x: 0, y: 0, z: -120 });
  const rng = makeRng(seed);
  const ctx = { emit: () => {}, countdown: 0, racing: true };
  for (let i = 0; i < 1200; i++) {
    const steer = Math.round((rng() * 2 - 1) * 127) / 127;
    let btn = BTN.ACCEL;
    if (rng() < 0.3) btn |= BTN.DRIFT;
    stepKart(k, { steer, btn }, world, 1 / 60, ctx);
  }
  return [k.x, k.y, k.z, k.yaw, k.speed, k.driftCharge];
}

describe('kart physics', () => {
  it('is deterministic for identical input streams', () => {
    expect(runScripted(42)).toEqual(runScripted(42));
    expect(runScripted(42)).not.toEqual(runScripted(43));
  });

  it('accelerates to top speed and no further', () => {
    const world = new ArenaWorld(DATA.arenas.test_plane);
    const k = createKart('a', { x: 0, y: 0, z: -120 });
    const ctx = { emit: () => {}, countdown: 0, racing: true };
    for (let i = 0; i < 60 * 5; i++) stepKart(k, { steer: 0, btn: BTN.ACCEL }, world, 1 / 60, ctx);
    expect(k.speed).toBeGreaterThan(KART.baseTopSpeed * 0.97);
    expect(k.speed).toBeLessThanOrEqual(KART.baseTopSpeed * 1.001);
  });

  it('charges mini-turbo tiers and boosts on release', () => {
    const world = new ArenaWorld(DATA.arenas.test_plane);
    const k = createKart('a', { x: 0, y: 0, z: -120 });
    const events = [];
    const ctx = { emit: (t, id, d) => events.push({ t, ...d }), countdown: 0, racing: true };
    for (let i = 0; i < 120; i++) stepKart(k, { steer: 0, btn: BTN.ACCEL }, world, 1 / 60, ctx);
    for (let i = 0; i < 60 * 3; i++) stepKart(k, { steer: -1, btn: BTN.ACCEL | BTN.DRIFT }, world, 1 / 60, ctx);
    expect(k.drift).toBe(-1);
    expect(k.driftTier).toBe(3);
    stepKart(k, { steer: 0, btn: BTN.ACCEL }, world, 1 / 60, ctx);
    expect(k.drift).toBe(0);
    expect(k.boostTime).toBeGreaterThan(1);
    expect(events.some((e) => e.t === 'miniTurbo' && e.tier === 3)).toBe(true);
  });

  it('gives a start boost only inside the window', () => {
    const run = (pressAt) => {
      const race = makeRace('sky_cloudtop', { skipCountdown: false });
      const k = race.karts[0];
      while (race.phase === 'countdown') {
        const press = race.countdown <= pressAt;
        race.setInput('a', { steer: 0, btn: BTN.ACCEL | (press ? BTN.REV : 0) });
        race.step();
      }
      race.step();
      return k;
    };
    expect(run(0.3).boostKind).toBe('start');
    expect(run(2.0).burnout).toBeGreaterThan(0);
    expect(run(-1).boostTime).toBe(0);
  });
});

describe('track + laps', () => {
  it('completes 3 laps with the pursuit driver and records lap times', () => {
    const race = makeRace('sky_cloudtop');
    const k = race.karts[0];
    for (let i = 0; i < 60 * 200 && race.phase !== 'finished'; i++) {
      race.setInput('a', pursuit(race.world, k));
      race.step();
    }
    expect(race.phase).toBe('finished');
    expect(k.lapTimes.length).toBe(3);
    for (const t of k.lapTimes) expect(t).toBeGreaterThan(25);
  });

  it('does not count a lap when reversing over the line and back', () => {
    const race = makeRace('sky_cloudtop');
    const k = race.karts[0];
    const w = race.world;
    // place just past the line then drive backwards over it and forward again
    const p = w.at((w.startS + 10) / w.length, 0);
    Object.assign(k, { x: p.x, y: p.y, z: p.z, yaw: p.yaw, hint: p.idx });
    race.lapSystem.initKart(k);
    const lapsBefore = k.lap;
    for (let i = 0; i < 200; i++) { race.setInput('a', { steer: 0, btn: BTN.BRAKE }); race.step(); }
    for (let i = 0; i < 240; i++) { race.setInput('a', { steer: 0, btn: BTN.ACCEL }); race.step(); }
    expect(k.lap).toBe(lapsBefore);
  });

  it('rescues a kart that falls into a gap and respawns it past the gap', () => {
    const race = makeRace('sky_cloudtop');
    const k = race.karts[0];
    const w = race.world;
    const p = w.at(0.807, 0);
    Object.assign(k, { x: p.x, y: p.y, z: p.z, yaw: p.yaw, hint: p.idx, speed: 6, safeHint: p.idx - 1 });
    race.lapSystem.initKart(k);
    const types = [];
    for (let i = 0; i < 60 * 4; i++) {
      race.setInput('a', { steer: 0, btn: BTN.ACCEL });
      race.step();
      race.drainEvents().forEach((e) => types.push(e.type));
    }
    expect(types).toContain('rescue');
    expect(types).toContain('respawn');
    expect(k.rescue).toBe(0);
    expect(k.s / w.length).toBeGreaterThan(0.82);
  });

  it('flags wrong-way driving', () => {
    const race = makeRace('sky_cloudtop');
    const k = race.karts[0];
    const q = race.world.at(0.3, 0);
    Object.assign(k, { x: q.x, y: q.y, z: q.z, yaw: q.yaw + Math.PI, hint: q.idx, speed: 10 });
    for (let i = 0; i < 120; i++) { race.setInput('a', { steer: 0, btn: BTN.ACCEL }); race.step(); }
    expect(k.isWrongWay).toBe(true);
  });

  it('lets karts take the shortcut branch and hands them back to the main ribbon', () => {
    const race = makeRace('sky_cloudtop');
    const k = race.karts[0];
    const w = race.world;
    const p = w.at(0.575, 0);
    Object.assign(k, { x: p.x, y: p.y, z: p.z, yaw: p.yaw, hint: p.idx, speed: 25 });
    race.lapSystem.initKart(k);
    const d0 = k.raceDist;
    const B = w.ribbons[1];
    const seen = new Set();
    for (let i = 0; i < 60 * 8; i++) {
      let tgt;
      if (k.ribbon === 1) tgt = w.at(Math.min(1, (k.hint + 8) / B.n), 0, 1);
      else if (!seen.has(1)) tgt = w.at(0.5, 0, 1);
      else tgt = w.at((k.s + 15) / w.length, 0);
      let d = Math.atan2(tgt.x - k.x, tgt.z - k.z) - k.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      race.setInput('a', { steer: Math.max(-1, Math.min(1, -d * 2.5)), btn: BTN.ACCEL });
      race.step();
      seen.add(k.ribbon);
      if (seen.has(1) && k.ribbon === 0) break;
    }
    expect(seen.has(1)).toBe(true);
    expect(k.ribbon).toBe(0);
    expect(k.raceDist - d0).toBeGreaterThan(100);
  });

  it('supports mirror mode', () => {
    const race = makeRace('sky_cloudtop', { mirror: true });
    const k = race.karts[0];
    for (let i = 0; i < 60 * 60 && k.lap < 1; i++) { race.setInput('a', pursuit(race.world, k)); race.step(); }
    expect(k.lap).toBe(1);
    expect(race.world.def.mirrored).toBe(true);
  });
});
