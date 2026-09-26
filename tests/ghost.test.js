import { describe, it, expect } from 'vitest';
import { makeRace, entrant, pursuit } from './helpers.js';
import { GhostRecorder, encodeGhost, decodeGhost, ghostPose, medalFor } from '../shared/sim/ghost.js';

describe('ghosts', () => {
  it('records, round-trips through a share code and replays positions', () => {
    const race = makeRace('sky_cloudtop', { laps: 1, mode: 'timetrial', items: false, entrants: [entrant('a')] });
    const k = race.karts[0];
    const rec = new GhostRecorder(k, { track: 'sky_cloudtop', racer: 'draxo', vehicle: 'ember_roadster', wheels: 'standard', glider: 'sky_wing' });
    const truth = [];
    for (let t = 0; t < 60 * 20; t++) {
      race.setInput('a', pursuit(race.world, k));
      race.step(); race.drainEvents(); rec.step();
      if (t % 60 === 0) truth.push({ t: race.time, x: k.x, z: k.z });
    }
    const g = rec.finish(race.time, [race.time]);
    const code = encodeGhost(g);
    expect(code.startsWith('G1.')).toBe(true);
    const back = decodeGhost(code);
    expect(back.track).toBe('sky_cloudtop');
    expect(back.frames).toEqual(g.frames);
    for (const p of truth.slice(1)) {
      const q = ghostPose(back, p.t);
      expect(Math.hypot(q.x - p.x, q.z - p.z)).toBeLessThan(1.5);
    }
  });
  it('awards medals against the staff time', () => {
    expect(medalFor(99, 100)).toBe('gold');
    expect(medalFor(104, 100)).toBe('silver');
    expect(medalFor(111, 100)).toBe('bronze');
    expect(medalFor(130, 100)).toBe(null);
  });
  it('rejects garbage codes', () => {
    expect(() => decodeGhost('hello')).toThrow();
  });
});
