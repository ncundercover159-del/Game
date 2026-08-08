// HAZARD PAY — the job board.
//
// Levels are plain data and nothing else imports them by name, so adding a job
// means writing one file and adding one line here.

import { warehouse } from './warehouse.js';
import { tower } from './tower.js';

// flooded.js is present but NOT registered: it was cut off mid-write and
// throws on import (BED_Y2 undefined), which broke every other agent's build.
// The levels pass re-adds it once leveltest.js passes against it.
export const LEVELS = [warehouse, tower];
export const LEVEL_BY_ID = Object.fromEntries(LEVELS.map((l) => [l.id, l]));
export const DEFAULT_LEVEL = warehouse.id;

/** Everything a level must have before the server will load it. */
export function validateLevel(l) {
  const errs = [];
  const need = (c, m) => { if (!c) errs.push(m); };

  need(typeof l.id === 'string' && l.id, 'missing id');
  need(typeof l.name === 'string' && l.name, 'missing name');
  need(Array.isArray(l.brushes) && l.brushes.length, 'no brushes');
  need(Array.isArray(l.props), 'no props array');
  need(Array.isArray(l.tasks) && l.tasks.length, 'no tasks');
  need(Array.isArray(l.spawn) && l.spawn.length === 3, 'bad spawn');
  need(l.extract && Array.isArray(l.extract.p) && Array.isArray(l.extract.s),
    'bad extract volume');
  need(Number.isFinite(l.quota) && l.quota > 0, 'bad quota');
  need(Number.isFinite(l.timeLimit) && l.timeLimit > 0, 'bad timeLimit');

  (l.brushes || []).forEach((b, i) => {
    if (!Array.isArray(b.p) || b.p.length !== 3) errs.push(`brush ${i}: bad p`);
    else if (b.p.some((v) => !Number.isFinite(v))) errs.push(`brush ${i}: non-finite p`);
    if (!Array.isArray(b.s) || b.s.length !== 3) errs.push(`brush ${i}: bad s`);
    else if (b.s.some((v) => !(v > 0))) errs.push(`brush ${i}: non-positive s`);
  });

  (l.props || []).forEach((p, i) => {
    if (!p.kind) errs.push(`prop ${i}: no kind`);
    if (!Array.isArray(p.p) || p.p.length !== 3) errs.push(`prop ${i}: bad p`);
  });

  return errs;
}
