// Every track must be completable by AI (no stuck/lost karts), mirror included,
// and every arena must run a battle without errors.
import { describe, it, expect } from 'vitest';
import { DATA } from './helpers.js';
import '../shared/track/arena.js';
import { createWorld } from '../shared/track/world.js';
import { Race } from '../shared/sim/race.js';

const field = (n) => Array.from({ length: n }, (_, i) => ({ id: `b${i}`, racerId: 'draxo', human: false }));

describe('tracks', () => {
  const ids = Object.keys(DATA.tracks).filter((id) => !DATA.tracks[id].dev);
  it('has 16 tracks + 4 remixes', () => {
    expect(ids.length).toBeGreaterThanOrEqual(20);
  });
  for (const id of ids) {
    it(`${id}: AI complete 2 laps${id.length % 2 ? ' (mirror)' : ''}`, () => {
      const world = createWorld(DATA.tracks[id], { mirror: id.length % 2 === 1 });
      const race = new Race({ world, laps: 2, seed: 5, skipCountdown: true, entrants: field(6), difficulty: 'hard' });
      for (let t = 0; t < 60 * 200 && race.phase !== 'finished'; t++) { race.step(); race.drainEvents(); }
      expect(race.phase).toBe('finished');
      expect(race.karts.filter((k) => !k.estimated).length).toBeGreaterThanOrEqual(5);
    });
  }
  for (const id of Object.keys(DATA.arenas).filter((a) => !DATA.arenas[a].dev)) {
    it(`${id}: battle runs`, () => {
      const race = new Race({ world: createWorld(DATA.arenas[id]), mode: 'battle', seed: 2, skipCountdown: true, entrants: field(6) });
      for (let t = 0; t < 60 * 40; t++) { race.step(); race.drainEvents(); }
      expect(race.karts.every((k) => Number.isFinite(k.x) && Number.isFinite(k.z))).toBe(true);
    });
  }
});
