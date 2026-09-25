import { describe, it, expect } from 'vitest';
import { makeRace, entrant } from './helpers.js';
import { RUBBER_BAND } from '../shared/config.js';

const field = (n) => Array.from({ length: n }, (_, i) => entrant('k' + i, { human: false, name: 'AI' + i }));

function runRace(opts) {
  const race = makeRace('sky_cloudtop', { skipCountdown: false, entrants: field(opts.n || 8), ...opts });
  let ticks = 0;
  const counts = {};
  while (race.phase !== 'finished' && ticks < 60 * 260) {
    race.step(); ticks++;
    for (const e of race.drainEvents()) counts[e.type] = (counts[e.type] || 0) + 1;
  }
  return { race, counts };
}

describe('AI drivers', () => {
  it('all AI finish a 3-lap race without estimated times, using drifts and items', () => {
    const { race, counts } = runRace({ difficulty: 'hard', n: 8, seed: 3 });
    expect(race.phase).toBe('finished');
    const finishers = race.karts.filter((k) => !k.estimated);
    expect(finishers.length).toBeGreaterThanOrEqual(7);
    expect(counts.driftStart).toBeGreaterThan(30);
    expect(counts.miniTurbo).toBeGreaterThan(5);
    expect(counts.itemUse).toBeGreaterThan(5);
  });

  it('harder AI are faster on average than easy AI', () => {
    const avg = (d) => {
      const { race } = runRace({ difficulty: d, n: 6, seed: 11, items: false });
      return race.karts.reduce((s, k) => s + k.finishTime, 0) / race.karts.length;
    };
    expect(avg('expert')).toBeLessThan(avg('easy'));
  });

  it('rubber-banding stays within the configured bounds', () => {
    const race = makeRace('sky_cloudtop', { entrants: field(6) });
    race.karts.forEach((k, i) => { k.raceDist = 400 - i * 80; });
    race.lapSystem.updatePlaces(race);
    race.ai.applyRubberBand(race);
    for (const k of race.karts) {
      expect(k.rubberMul).toBeGreaterThanOrEqual(1 - RUBBER_BAND.leaderPenalty - 1e-9);
      expect(k.rubberMul).toBeLessThanOrEqual(1 + RUBBER_BAND.catchUpMax * RUBBER_BAND.aiCatchUpScale + 1e-9);
    }
    const last = race.ranked[race.ranked.length - 1];
    expect(last.rubberMul).toBeGreaterThan(1);
    expect(race.ranked[0].rubberMul).toBeLessThanOrEqual(1);
  });
});
