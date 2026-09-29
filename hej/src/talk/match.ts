// Offline answer checking for free conversation ("Snak").
// Pure functions: no DOM, no storage — unit-tested in tests/match.test.ts.

import type { CoachRule } from '../content/types';

/** Lower-case, unify apostrophes, drop punctuation, collapse spaces. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’`´]/g, "'")
    .replace(/[.,!?;:"«»()\[\]…–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type Item =
  | { k: 'star' }
  | { k: 'lit'; alts: string[][]; opt: boolean }
  | { k: 'slot'; name: string; opt: boolean };

const cache = new Map<string, Item[]>();

export function parsePattern(p: string): Item[] {
  const hit = cache.get(p);
  if (hit) return hit;
  const items: Item[] = [];
  let i = 0;
  while (i < p.length) {
    const ch = p[i];
    if (ch === ' ') {
      i++;
      continue;
    }
    if (ch === '(' || ch === '[') {
      const close = ch === '(' ? ')' : ']';
      const end = p.indexOf(close, i);
      if (end < 0) throw new Error(`unclosed ${ch} in pattern "${p}"`);
      const body = p.slice(i + 1, end);
      const opt = ch === '[';
      const slot = body.match(/^\{(\w+)\}$/);
      if (slot) items.push({ k: 'slot', name: slot[1], opt });
      else items.push({ k: 'lit', alts: body.split('|').map((a) => a.trim().split(/\s+/).filter(Boolean)), opt });
      i = end + 1;
      continue;
    }
    const end = p.indexOf(' ', i);
    const word = p.slice(i, end < 0 ? p.length : end);
    const slot = word.match(/^\{(\w+)\}$/);
    if (word === '*') items.push({ k: 'star' });
    else if (slot) items.push({ k: 'slot', name: slot[1], opt: false });
    else items.push({ k: 'lit', alts: [[word]], opt: false });
    i = end < 0 ? p.length : end;
  }
  cache.set(p, items);
  return items;
}

export interface MatchResult {
  ok: boolean;
  captures: string[];
}

/** Match a normalised answer against one pattern. */
export function matchPattern(pattern: string, answer: string, slots: Record<string, string[]>): MatchResult {
  const items = parsePattern(pattern);
  const words = normalize(answer).split(' ').filter(Boolean);
  const caps: string[] = [];
  const go = (ii: number, wi: number): boolean => {
    if (ii === items.length) return wi === words.length;
    const it = items[ii];
    if (it.k === 'star') {
      // any number of words (0+), e.g. the open end of "jeg skal *"
      for (let k = words.length; k >= wi; k--) if (go(ii + 1, k)) return true;
      return false;
    }
    if (it.k === 'slot') {
      const w = words[wi];
      if (w !== undefined && (it.name === 'any' || (slots[it.name] ?? []).includes(w) || (it.name === 'num' && /^\d+$/.test(w)))) {
        caps.push(w);
        if (go(ii + 1, wi + 1)) return true;
        caps.pop();
      }
      return it.opt ? go(ii + 1, wi) : false;
    }
    for (const alt of it.alts) {
      if (alt.every((a, j) => words[wi + j] === a) && go(ii + 1, wi + alt.length)) return true;
    }
    return it.opt ? go(ii + 1, wi) : false;
  };
  const ok = go(0, 0);
  return { ok, captures: ok ? caps : [] };
}

export function matchAny(patterns: string[], answer: string, slots: Record<string, string[]>): { index: number; captures: string[] } | null {
  for (let i = 0; i < patterns.length; i++) {
    const r = matchPattern(patterns[i], answer, slots);
    if (r.ok) return { index: i, captures: r.captures };
  }
  return null;
}

/** First "typical mistake" rule that fires, if any. */
export function coach(rules: CoachRule[], answer: string): CoachRule | null {
  const n = normalize(answer);
  return rules.find((r) => new RegExp(r.re).test(n)) ?? null;
}

// ─── unknown-word help ───────────────────────────────────────────────────────
const fold = (s: string) => s.replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').replace(/aa/g, 'a');

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** Closest known forms for a word the lexicon doesn't know (typos, missing æ/ø/å). */
export function suggest(word: string, known: string[], max = 3): string[] {
  const w = word.toLowerCase();
  const fw = fold(w);
  return known
    .map((k) => ({ k, d: fold(k) === fw ? 0 : levenshtein(w, k) }))
    .filter((x) => x.d <= (w.length > 5 ? 2 : 1))
    .sort((a, b) => a.d - b.d || a.k.length - b.k.length)
    .slice(0, max)
    .map((x) => x.k);
}
