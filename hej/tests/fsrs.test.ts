import { describe, expect, it } from 'vitest';
import { LEARN_STEPS, State, intervalDays, isDue, newCard, retrievability, review } from '../src/srs/fsrs';

const DAY = 86_400_000;
const t0 = Date.UTC(2026, 0, 1);

describe('fsrs', () => {
  it('walks a new card through learning steps into review', () => {
    let c = newCard('w:hej', 'w', 'hej', t0);
    expect(c.state).toBe(State.New);
    c = review(c, 3, t0);
    expect(c.state).toBe(State.Learning);
    expect(c.due).toBe(t0 + LEARN_STEPS[1]);
    c = review(c, 3, c.due);
    expect(c.state).toBe(State.Review);
    expect(c.due - c.last).toBeGreaterThanOrEqual(DAY);
  });

  it('easy graduates immediately, again resets the step', () => {
    const c = review(newCard('x', 'w', 'x', t0), 4, t0);
    expect(c.state).toBe(State.Review);
    const again = review(review(newCard('y', 'w', 'y', t0), 3, t0), 1, t0 + 60_000);
    expect(again.state).toBe(State.Learning);
    expect(again.step).toBe(0);
  });

  it('grows intervals on success and shrinks stability on a lapse', () => {
    let c = review(newCard('z', 's', 'z', t0), 4, t0);
    const ivls: number[] = [];
    for (let i = 0; i < 4; i++) {
      const now = c.due;
      c = review(c, 3, now);
      ivls.push((c.due - now) / DAY);
    }
    expect(ivls[3]).toBeGreaterThan(ivls[0]);
    const before = c.stability;
    const lapsed = review(c, 1, c.due);
    expect(lapsed.state).toBe(State.Relearning);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.stability).toBeLessThan(before);
  });

  it('retrievability is 0.9 after one stability-length interval', () => {
    expect(retrievability(10, 10)).toBeCloseTo(0.9, 2);
    expect(intervalDays(10)).toBe(10);
  });

  it('never marks a new card as due (it is introduced, not reviewed)', () => {
    expect(isDue(newCard('n', 'w', 'n', t0), t0 + DAY)).toBe(false);
  });
});
