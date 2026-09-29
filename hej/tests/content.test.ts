import { describe, expect, it } from 'vitest';
import content from '../src/generated/content.json';
import type { Content } from '../src/content/types';
import { resolve } from '../src/content/tokenize';
import { TILES } from '../src/engine/tiledefs';

const C = content as unknown as Content;

describe('compiled content', () => {
  it('links every word token of every line to the lexicon', () => {
    for (const l of Object.values(C.lines)) {
      for (const t of l.tokens) {
        if (t.k === 'w') expect(C.lexicon[t.l!], `${l.id}: ${t.t}`).toBeTruthy();
        if (t.p) expect(C.lexicon[t.p].pos).toBe('phrase');
      }
      expect(l.reviewed).toBeTypeOf('boolean');
      expect(l.audio).toBeTruthy();
    }
  });
  it('gives nouns en/et and verbs their forms', () => {
    const nouns = Object.values(C.lexicon).filter((e) => e.pos === 'noun');
    expect(nouns.length).toBeGreaterThan(30);
    for (const n of nouns) expect(['en', 'et']).toContain(n.g);
    expect(C.lexicon['hedde'].forms.pres).toBe('hedder');
    expect(C.lexicon['nøgle'].forms.defpl).toBe('nøglerne');
  });
  it('voices player lines in both voices and every player name', () => {
    const l = Object.values(C.lines).find((x) => x.who === 'you' && x.da === 'Jeg hedder {name}.')!;
    expect(typeof l.audio).toBe('object');
    expect(Object.keys(l.audio as object)).toHaveLength(2 * C.names.length);
  });
  it('has a playable chapter 1 with spotlights whose examples exist', () => {
    const ch = C.chapters[0];
    expect(ch.scenes.length).toBeGreaterThanOrEqual(3);
    for (const g of Object.values(C.grammar)) {
      expect(g.examples).toHaveLength(3);
      for (const id of g.examples) expect(C.lines[id]).toBeTruthy();
    }
  });
  it('keeps maps consistent with the tile catalogue', () => {
    for (const m of Object.values(C.maps)) {
      expect(m.tiles).toHaveLength(m.w * m.h);
      for (const t of m.tiles) expect(TILES[t]).toBeTruthy();
    }
  });
  it('resolves ambiguous forms and phrases at runtime', () => {
    const numbers: Record<number, string> = {};
    const phrases: Record<string, [string, string[]][]> = {};
    for (const e of Object.values(C.lexicon)) {
      if (e.value !== undefined) numbers[e.value] ??= e.id;
      if (e.pos === 'phrase') {
        const w = e.lemma.split(' ');
        (phrases[w[0]] ??= []).push([e.id, w]);
      }
    }
    const r = resolve('Tak for sidst! Så er det på plads.', { forms: C.forms, ambiguous: C.ambiguous, numbers, phrases });
    expect(r.unknown).toEqual([]);
    expect(r.tokens[0].p).toBe('tak for sidst');
    expect(r.tokens.find((t) => t.t === 'Så')?.l).toBe('så#adv');
  });
});
