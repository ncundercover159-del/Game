// The haiku composer's rules: deal a tray of word tiles for the season, check a verse's 5-7-5
// shape, and score it on imagery, a season word (kigo) for now, and a cutting word (kireji).
import { KIGO, CUTS, WORDS } from '../data/words.js';

export const SHAPE = [5, 7, 5];
export const TRAY = 16;
export const GRADES = [16, 11];   // score for first prize, second prize

/** The tiles on offer: three season words for now, one out of season, the cuts, and plain words
 * (always including one- and two-syllable tiles, so every line can be filled). */
export function dealTray(season, rng) {
  const pick = (list, n) => {
    const pool = [...list], out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
    return out;
  };
  const others = Object.keys(KIGO).filter((s) => s !== season);
  const wrong = pick(KIGO[others[Math.floor(rng.next() * others.length)]], 1).map((x) => ({ ...x, kigo: 'wrong' }));
  const kigo = pick(KIGO[season], 3).map((x) => ({ ...x, kigo: season }));
  const short = [pick(WORDS.filter((x) => x.s === 1), 1)[0], pick(WORDS.filter((x) => x.s === 2), 1)[0]];
  const rest = pick(WORDS.filter((x) => !short.includes(x)), TRAY - kigo.length - wrong.length - CUTS.length - short.length);
  return pick([...kigo, ...wrong, ...CUTS, ...short, ...rest], TRAY);
}

export const syllables = (line) => line.reduce((a, x) => a + x.s, 0);

/** Can `tile` go on line `i` without overflowing it? */
export const fits = (lines, i, tile) => syllables(lines[i]) + tile.s <= SHAPE[i];

export const complete = (lines) => lines.every((l, i) => syllables(l) === SHAPE[i]);

/**
 * Score a finished verse: imagery, +5 for a season word of now (none: -6), -3 for each word of
 * another season, +2 for one cutting word (more is fussy: -2 each), -2 for each repeated tile.
 */
export function scoreVerse(lines, season) {
  const all = lines.flat();
  let score = all.reduce((a, x) => a + x.img, 0);
  const now = all.filter((x) => x.kigo === season).length;
  score += now ? 5 : -6;
  score -= 3 * all.filter((x) => x.kigo && x.kigo !== season).length;
  const cuts = all.filter((x) => x.cut).length;
  score += cuts === 1 ? 2 : -2 * Math.max(0, cuts - 1);
  const seen = new Set();
  for (const x of all) { if (seen.has(x.w)) score -= 2; seen.add(x.w); }
  return { score, kigo: now > 0 };
}

/** 0 first prize, 1 second, 2 none. */
export const verseGrade = (score) => (score >= GRADES[0] ? 0 : score >= GRADES[1] ? 1 : 2);

/** The verse as text, one line each. */
export const recite = (lines) => lines.map((l) => l.map((x) => x.w).join(' ')).join(' / ');
