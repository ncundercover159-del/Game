// FSRS-4.5 scheduler (Free Spaced Repetition Scheduler) with short learning steps.
// Pure functions — no storage, no clock — so it's easy to test.
//
// Grades: 1 Again · 2 Hard · 3 Good · 4 Easy. The game derives them from exercise results:
// wrong → 1, right but needed help (slow replay, show text, tile mistakes) → 2, right → 3,
// right and fast → 4.

export type Grade = 1 | 2 | 3 | 4;

export const State = { New: 0, Learning: 1, Review: 2, Relearning: 3 } as const;
export type State = (typeof State)[keyof typeof State];

export interface Card {
  id: string; // "w:<lexicon id>" or "s:<danish sentence>"
  kind: 'w' | 's';
  /** Lexicon id for words; a line id for sentences. */
  ref: string;
  state: State;
  due: number; // epoch ms
  stability: number; // days
  difficulty: number; // 1..10
  reps: number;
  lapses: number;
  last: number; // epoch ms of last review, 0 if never
  step: number; // learning step index
  starred: boolean;
  /** Times met in dialogue (exposure, not review). */
  seen: number;
  added: number;
}

// Default FSRS-4.5 parameters.
const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5;
const FACTOR = 19 / 81;
const RETENTION = 0.9;
const DAY = 86_400_000;
const MIN = 60_000;
/** Learning steps for new cards, and relearning steps after a lapse. */
export const LEARN_STEPS = [1 * MIN, 10 * MIN];
export const RELEARN_STEPS = [10 * MIN];
const MAX_IVL_DAYS = 365;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function newCard(id: string, kind: 'w' | 's', ref: string, now: number): Card {
  return {
    id, kind, ref, state: State.New, due: now, stability: 0, difficulty: 0,
    reps: 0, lapses: 0, last: 0, step: 0, starred: false, seen: 0, added: now,
  };
}

export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + FACTOR * (elapsedDays / stability), DECAY);
}

function initStability(g: Grade) {
  return Math.max(W[g - 1], 0.1);
}
function initDifficulty(g: Grade) {
  return clamp(W[4] - (g - 3) * W[5], 1, 10);
}
function nextDifficulty(d: number, g: Grade) {
  const next = d - W[6] * (g - 3);
  return clamp(W[7] * initDifficulty(4) + (1 - W[7]) * next, 1, 10);
}
function recallStability(d: number, s: number, r: number, g: Grade) {
  const hard = g === 2 ? W[15] : 1;
  const easy = g === 4 ? W[16] : 1;
  return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy);
}
function forgetStability(d: number, s: number, r: number) {
  return W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
}
/** Interval in days for the target retention. */
export function intervalDays(s: number): number {
  const ivl = (s / FACTOR) * (Math.pow(RETENTION, 1 / DECAY) - 1);
  return clamp(Math.round(ivl), 1, MAX_IVL_DAYS);
}

/** Apply a review. Returns a new card; the input is not mutated. */
export function review(card: Card, g: Grade, now: number): Card {
  const c: Card = { ...card, reps: card.reps + 1 };
  const elapsed = card.last ? Math.max(0, (now - card.last) / DAY) : 0;

  if (c.state === State.New) {
    c.stability = initStability(g);
    c.difficulty = initDifficulty(g);
    c.state = State.Learning;
    c.step = 0;
  } else {
    const r = retrievability(elapsed, c.stability);
    c.difficulty = nextDifficulty(c.difficulty, g);
    if (c.state === State.Review) {
      if (g === 1) {
        c.stability = Math.max(0.1, forgetStability(c.difficulty, c.stability, r));
        c.lapses++;
        c.state = State.Relearning;
        c.step = 0;
      } else {
        c.stability = recallStability(c.difficulty, c.stability, r, g);
      }
    } else if (elapsed > 0) {
      // (re)learning: short-term review — nudge stability without the long-term formula
      c.stability = Math.max(0.1, c.stability * Math.exp(0.4 * (g - 3)));
    }
  }
  c.last = now;

  if (c.state === State.Learning || c.state === State.Relearning) {
    const steps = c.state === State.Learning ? LEARN_STEPS : RELEARN_STEPS;
    if (g === 1) {
      c.step = 0;
      c.due = now + steps[0];
    } else if (g === 2) {
      c.due = now + steps[Math.min(c.step, steps.length - 1)] * 1.5;
    } else if (g === 3 && c.step + 1 < steps.length) {
      c.step++;
      c.due = now + steps[c.step];
    } else {
      c.state = State.Review;
      c.step = 0;
      c.due = now + intervalDays(c.stability) * DAY;
    }
    return c;
  }
  c.due = now + intervalDays(c.stability) * DAY;
  return c;
}

export function isDue(c: Card, now: number): boolean {
  return c.state !== State.New && c.due <= now;
}

/** Weak = forgotten repeatedly or still shaky; these get reused in dialogue and reviews. */
export function isWeak(c: Card): boolean {
  return c.lapses >= 2 || (c.state === State.Relearning) || (c.state === State.Review && c.stability < 2 && c.reps >= 3);
}
