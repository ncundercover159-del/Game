import { describe, expect, it } from 'vitest';
import { coach, levenshtein, matchAny, matchPattern, normalize, suggest } from '../src/talk/match';

const slots = { num: ['tyve', 'tolv', 'nitten', 'fjorten'], feeling: ['godt', 'fint'], ordinal: ['tredje'] };

describe('talk matcher', () => {
  it('normalises punctuation and case', () => {
    expect(normalize('  Ja, det ER jeg!  ')).toBe('ja det er jeg');
  });
  it('handles optional groups, alternatives and slots', () => {
    expect(matchPattern('[jeg hedder] {any}', 'Jeg hedder Sam.', slots)).toEqual({ ok: true, captures: ['sam'] });
    expect(matchPattern('[jeg hedder] {any}', 'Sam', slots).ok).toBe(true);
    expect(matchPattern('[det går] {feeling} [tak]', 'Det går godt, tak!', slots).ok).toBe(true);
    expect(matchPattern('[det går] {feeling} [tak]', 'Det går dårligt', slots).ok).toBe(false);
    expect(matchPattern('[jeg bor] (her|i aarhus)', 'Jeg bor i Aarhus', slots).ok).toBe(true);
    expect(matchPattern('[det er|mit nummer er] {num} {num} {num} {num}', 'Mit nummer er tyve tolv nitten fjorten', slots).ok).toBe(true);
    expect(matchPattern('{num} {num}', '20 12', slots).ok).toBe(true);
  });
  it('supports * for open-ended answers', () => {
    expect(matchPattern('jeg skal *', 'Jeg skal til fødselsdag hos Amalie.', slots).ok).toBe(true);
    expect(matchPattern('jeg skal *', 'Jeg skal', slots).ok).toBe(true);
    expect(matchPattern('jeg skal *', 'Du skal noget', slots).ok).toBe(false);
    expect(matchPattern('(ja|nej) * tak', 'nej det er fint tak', slots).ok).toBe(true);
  });
  it('picks the first matching pattern', () => {
    expect(matchAny(['nej tak', 'ja [tak]'], 'Ja tak', slots)?.index).toBe(1);
    expect(matchAny(['nej tak'], 'måske', slots)).toBeNull();
  });
  it('coaches typical English-speaker mistakes', () => {
    const rules = [
      { re: '^jeg er fin', why: 'fin' },
      { re: '^(nu|i morgen) (jeg|du) [a-zæøå]+', why: 'v2' },
      { re: '^(jeg|du) ikke [a-zæøå]+', why: 'ikke' },
    ];
    expect(coach(rules, 'Jeg er fin, tak')?.why).toBe('fin');
    expect(coach(rules, 'I morgen jeg viser dig byen')?.why).toBe('v2');
    expect(coach(rules, 'I morgen viser jeg dig byen')).toBeNull();
    expect(coach(rules, 'Jeg ikke drikker kaffe')?.why).toBe('ikke');
  });
  it('suggests known words for typos and missing æøå', () => {
    expect(levenshtein('hedder', 'heder')).toBe(1);
    expect(suggest('gar', ['går', 'gå', 'godt'])).toContain('går');
    expect(suggest('hedr', ['hedder', 'her'])[0]).toBe('her');
  });
});
