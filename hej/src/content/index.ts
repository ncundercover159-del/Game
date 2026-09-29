import raw from '../generated/content.json';
import type { Content, LexEntry, Line } from './types';

export const C = raw as unknown as Content;

export function line(id: string): Line {
  const l = C.lines[id];
  if (!l) throw new Error(`unknown line ${id}`);
  return l;
}

export const fill = (s: string, name: string) => s.replaceAll('{name}', name);

/** Clip key for a line given the player's voice and name. */
export function audioKey(l: Line, gender: 'f' | 'm', name: string): string | undefined {
  if (typeof l.audio === 'string') return l.audio;
  const a = l.audio;
  return a[`${gender}|${name}`] ?? a[`|${name}`] ?? a[gender] ?? a[`${gender}|${C.names[0]}`] ?? Object.values(a)[0];
}

export function lex(id: string | undefined): LexEntry | undefined {
  return id ? C.lexicon[id] : undefined;
}

/** Lexicon ids (words and phrases) in a line that should become SRS cards. */
export function cardWords(l: Line): string[] {
  const ids = new Set<string>();
  for (const t of l.tokens) {
    if (t.l && t.k === 'w' && C.lexicon[t.l]?.pos !== 'name') ids.add(t.l);
    if (t.p) ids.add(t.p);
  }
  return [...ids];
}

export function wordCount(l: Line): number {
  return l.tokens.filter((t) => t.k !== 'p').length;
}

export function voiceOf(who: string, gender: 'f' | 'm'): string {
  if (who === 'you') return gender === 'f' ? 'you_f' : 'you_m';
  if (who === 'narrator' || who === 'ui') return 'narrator';
  return C.npcs[who]?.voice ?? 'narrator';
}
