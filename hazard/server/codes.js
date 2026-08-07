// HAZARD PAY — room codes.
//
// Four letters, because a code is read aloud over a headset by somebody who is
// already holding a piano. Two rules shape the alphabet:
//
//   No I and no O. On half the screens this will run on they are 1 and 0, and a
//   player who types what they see should land in the right job.
//
//   No vowels at all. Four letters drawn at random will eventually spell
//   something you cannot put on a stream, and a word list is a losing game
//   played in several languages. Without vowels there is nothing to spell. It
//   costs a third of the keyspace, which at 160,000 live rooms is not a problem
//   anybody in this codebase will ever have.

import { CODE_LENGTH } from '../shared/tune.js';

export const CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ';

function draw(n) {
  let out = '';
  for (let i = 0; i < n; i++) {
    out += CODE_ALPHABET[(Math.random() * CODE_ALPHABET.length) | 0];
  }
  return out;
}

/** A code no live room is using. `taken` is anything with a `.has(code)`. */
export function makeCode(taken) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const code = draw(CODE_LENGTH);
    if (!taken.has(code)) return code;
  }
  // Every four-letter code is live. Grow rather than spin: a fifth letter is
  // uglier than the birthday problem it solves, and both beat an infinite loop.
  let code;
  do { code = draw(CODE_LENGTH + 1); } while (taken.has(code));
  return code;
}

/** What the player typed, as a code — or '' if it cannot be one. */
export function normaliseCode(raw) {
  const s = String(raw ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  if (s.length < CODE_LENGTH || s.length > CODE_LENGTH + 1) return '';
  for (const ch of s) if (!CODE_ALPHABET.includes(ch)) return '';
  return s;
}
