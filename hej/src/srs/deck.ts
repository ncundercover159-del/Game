// The player's SRS deck: every word and sentence they meet becomes a card.
// Cards live in memory and are written through to IndexedDB.

import { C, cardWords } from '../content';
import type { Line } from '../content/types';
import { db } from '../store/db';
import { type Card, type Grade, State, isDue, isWeak, newCard, review } from './fsrs';

const cards = new Map<string, Card>();
const dirty = new Set<string>();
let flushTimer: number | undefined;

export async function loadDeck() {
  cards.clear();
  for (const c of await db.all<Card>('cards')) cards.set(c.id, c);
}

function touch(c: Card) {
  cards.set(c.id, c);
  dirty.add(c.id);
  clearTimeout(flushTimer);
  flushTimer = window.setTimeout(flush, 400);
}

export async function flush() {
  if (!dirty.size) return;
  const vals = [...dirty].map((id) => cards.get(id)!).filter(Boolean);
  dirty.clear();
  await db.putMany('cards', vals);
}

export const sentenceId = (l: Line) => `s:${l.da}`;
export const wordId = (lexId: string) => `w:${lexId}`;

export function getCard(id: string) {
  return cards.get(id);
}
export function allCards() {
  return [...cards.values()];
}

function ensure(id: string, kind: 'w' | 's', ref: string, now: number): Card {
  let c = cards.get(id);
  if (!c) {
    c = newCard(id, kind, ref, now);
    touch(c);
  }
  return c;
}

/** Called whenever a line is heard in dialogue: exposure for the sentence and all its words. */
export function meetLine(l: Line, now = Date.now()): string[] {
  const added: string[] = [];
  const sid = sentenceId(l);
  if (!cards.has(sid)) added.push(sid);
  const s = ensure(sid, 's', l.id, now);
  touch({ ...s, seen: s.seen + 1 });
  for (const w of cardWords(l)) {
    const id = wordId(w);
    if (!cards.has(id)) added.push(id);
    const c = ensure(id, 'w', w, now);
    touch({ ...c, seen: c.seen + 1 });
  }
  return added;
}

export function addWord(lexId: string, star = true) {
  const c = ensure(wordId(lexId), 'w', lexId, Date.now());
  touch({ ...c, starred: star || c.starred });
}

export function grade(id: string, g: Grade, now = Date.now()): Card | undefined {
  const c = cards.get(id);
  if (!c) return;
  const next = review(c, g, now);
  touch(next);
  void db.add('log', { id, g, t: now, state: c.state });
  return next;
}

export function dueCards(now = Date.now()): Card[] {
  return allCards().filter((c) => isDue(c, now)).sort((a, b) => a.due - b.due);
}
export function newCards(): Card[] {
  return allCards()
    .filter((c) => c.state === State.New)
    .sort((a, b) => Number(b.starred) - Number(a.starred) || a.added - b.added);
}
export function weakCards(): Card[] {
  return allCards().filter(isWeak);
}

export interface BatchOpts {
  max: number;
  /** Prefer these card ids (e.g. met in the scene just finished). */
  prefer?: string[];
  /** How many new cards may still be introduced today. */
  newAllowance: number;
  /** Restrict to cards matching this predicate (e.g. lines by one NPC). */
  filter?: (c: Card) => boolean;
}

/** Pick cards for a review session: due (learning first), weak, then new. */
export function batch(o: BatchOpts, now = Date.now()): Card[] {
  const f = o.filter ?? (() => true);
  const out: Card[] = [];
  const push = (c: Card) => {
    if (out.length < o.max && !out.includes(c) && f(c) && refOk(c)) out.push(c);
  };
  const due = dueCards(now);
  for (const c of due) if (c.state !== State.Review) push(c);
  for (const id of o.prefer ?? []) {
    const c = cards.get(id);
    if (c && (c.state === State.New ? out.filter((x) => x.state === State.New).length < o.newAllowance : isDue(c, now))) push(c);
  }
  for (const c of due) push(c);
  for (const c of weakCards()) if (isDue(c, now)) push(c);
  let n = out.filter((x) => x.state === State.New).length;
  for (const c of newCards()) {
    if (n >= o.newAllowance) break;
    const before = out.length;
    push(c);
    if (out.length > before) n++;
  }
  return out;
}

/** Cards can outlive content edits; skip ones whose line or word no longer exists. */
function refOk(c: Card) {
  return c.kind === 'w' ? !!C.lexicon[c.ref] : !!C.lines[c.ref];
}

export function deckStats(now = Date.now()) {
  const all = allCards();
  return {
    total: all.length,
    words: all.filter((c) => c.kind === 'w').length,
    sentences: all.filter((c) => c.kind === 's').length,
    due: all.filter((c) => isDue(c, now)).length,
    fresh: all.filter((c) => c.state === State.New).length,
    known: all.filter((c) => c.state === State.Review && c.stability >= 7).length,
  };
}
