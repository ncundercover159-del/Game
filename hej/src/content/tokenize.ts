import type { Token } from './types';

// Shared by the content compiler (build time) and the free-conversation mode (runtime,
// for text the player types or the AI generates).

const TOKEN_RE = /\{name\}|[\p{L}\p{N}]+(?:['’][\p{L}]*)?(?:-[\p{L}\p{N}]+)*|\S/gu;

export interface RawToken {
  t: string;
  k: Token['k'];
  s: 0 | 1;
}

export function splitTokens(text: string): RawToken[] {
  const out: RawToken[] = [];
  let m: RegExpExecArray | null;
  let last = 0;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text))) {
    const t = m[0];
    const s: 0 | 1 = m.index > last && /\s/.test(text.slice(last, m.index)) ? 1 : 0;
    last = m.index + t.length;
    let k: Token['k'];
    if (t === '{name}') k = 'n';
    else if (/^\p{N}+$/u.test(t)) k = 'num';
    else if (/^[\p{L}\p{N}]/u.test(t)) k = 'w';
    else k = 'p';
    out.push({ t, k, s: out.length === 0 ? 0 : s });
  }
  return out;
}

export function norm(word: string): string {
  return word.toLowerCase().replace(/’/g, "'");
}

export interface ResolveCtx {
  forms: Record<string, string[]>;
  ambiguous: Record<string, string>;
  /** numeric value → lexicon id */
  numbers: Record<number, string>;
  /** multi-word expressions: first word → list of [phrase id, words] */
  phrases: Record<string, [string, string[]][]>;
}

export interface ResolveResult {
  tokens: Token[];
  unknown: string[];
  ambiguous: { word: string; options: string[] }[];
}

/**
 * Tokenise and link every word to a lexicon entry.
 * `lx` overrides by lower-case surface form, or "form@n" for the n-th occurrence (1-based).
 */
export function resolve(
  text: string,
  ctx: ResolveCtx,
  lx: Record<string, string> = {},
  glosses: Record<string, string> = {},
): ResolveResult {
  const raw = splitTokens(text);
  const unknown: string[] = [];
  const ambiguous: { word: string; options: string[] }[] = [];
  const seen: Record<string, number> = {};
  const tokens: Token[] = raw.map((r) => {
    const tok: Token = { t: r.t, k: r.k };
    if (r.s) tok.s = 1;
    if (r.k === 'num') {
      const id = ctx.numbers[Number(r.t)];
      if (id) tok.l = id;
    }
    if (r.k !== 'w') return tok;
    const key = norm(r.t);
    seen[key] = (seen[key] ?? 0) + 1;
    const override = lx[`${key}@${seen[key]}`] ?? lx[key];
    const cands = ctx.forms[key] ?? [];
    if (override) {
      tok.l = override;
    } else if (cands.length === 1) {
      tok.l = cands[0];
    } else if (cands.length > 1) {
      if (ctx.ambiguous[key]) tok.l = ctx.ambiguous[key];
      else ambiguous.push({ word: r.t, options: cands });
    } else {
      unknown.push(r.t);
    }
    const gloss = glosses[key];
    if (gloss) tok.c = gloss;
    return tok;
  });

  // Mark multi-word expressions (longest match first).
  const words = tokens.map((t, i) => ({ i, w: t.k === 'w' ? norm(t.t) : null })).filter((x) => x.w);
  for (let a = 0; a < words.length; a++) {
    const cands = (ctx.phrases[words[a].w!] ?? []).slice().sort((x, y) => y[1].length - x[1].length);
    for (const [pid, pw] of cands) {
      if (a + pw.length > words.length) continue;
      let ok = true;
      for (let j = 0; j < pw.length; j++) if (words[a + j].w !== pw[j]) ok = false;
      if (!ok) continue;
      for (let j = 0; j < pw.length; j++) {
        const t = tokens[words[a + j].i];
        if (!t.p) t.p = pid;
      }
      break;
    }
  }
  return { tokens, unknown, ambiguous };
}

/** Render tokens back to text, substituting the player's name. */
export function tokensToText(tokens: Token[], name = ''): string {
  return tokens.map((t) => (t.s ? ' ' : '') + (t.k === 'n' ? name : t.t)).join('');
}
