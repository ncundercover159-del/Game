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

import { randomInt } from 'node:crypto';
import { CODE_LENGTH } from '../shared/tune.js';

export const CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ';

/** How many distinct codes of a given length exist. Startup logging, mostly. */
export const codeSpace = (len = CODE_LENGTH) => CODE_ALPHABET.length ** len;

/**
 * Draw n letters.
 *
 * crypto rather than Math.random, because the code IS the access control: there
 * is no password on a job and no invite list, so anyone who can predict the next
 * code can walk into the next room opened. Math.random is a seeded PRNG whose
 * state is recoverable from a handful of observed outputs, and a server hands
 * out an observed output every time somebody starts a game. randomInt is also
 * rejection-sampled, so a 20-letter alphabet stays uniform — `random() * 20 | 0`
 * is fine, but only by accident of 20 dividing nothing in particular, and the
 * next person to widen the alphabet would not check.
 */
function draw(n) {
  let out = '';
  for (let i = 0; i < n; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
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
  // Keep growing if the fifth is somehow exhausted too, so this can never
  // become the hang that takes the server down.
  for (let len = CODE_LENGTH + 1; ; len++) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const code = draw(len);
      if (!taken.has(code)) return code;
    }
  }
}

/**
 * What the player typed, as a code — or '' if it cannot be one.
 *
 * Deliberately strict about the alphabet rather than clever about it. A code
 * containing O or I or a digit is not a near miss to be repaired: those glyphs
 * are excluded precisely BECAUSE each is indistinguishable from another, so
 * there is no single letter the player can be assumed to have meant. Guessing
 * would drop them into a stranger's job, which is worse than saying no.
 */
export function normaliseCode(raw) {
  const s = String(raw ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  if (s.length < CODE_LENGTH || s.length > CODE_LENGTH + 1) return '';
  for (const ch of s) if (!CODE_ALPHABET.includes(ch)) return '';
  return s;
}

/** True if this string is exactly a well-formed code. */
export const isCode = (raw) => normaliseCode(raw) === String(raw ?? '').toUpperCase();
