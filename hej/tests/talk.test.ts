import { describe, expect, it } from 'vitest';
import content from '../src/generated/content.json';
import type { Content } from '../src/content/types';
import { coach, matchAny } from '../src/talk/match';

const C = content as unknown as Content;

describe('Snak topics', () => {
  it('accept their own model answers, and the coach stays quiet on them', () => {
    const problems: string[] = [];
    for (const t of Object.values(C.talk.topics)) {
      for (const turn of t.turns) {
        for (const id of turn.model) {
          const text = C.lines[id].da.replaceAll('{name}', 'Sam');
          if (!matchAny(turn.accept.map((a) => a.p), text, { ...C.talk.slots, name: C.names })) problems.push(`${t.id}/${turn.id}: model "${text}" not accepted`);
          const c = coach(C.talk.coach, text);
          if (c) problems.push(`${t.id}/${turn.id}: coach fires on model "${text}" (${c.re})`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
  it('coach catches the classic mistakes', () => {
    const fire = (s: string) => !!coach(C.talk.coach, s);
    expect(fire('Jeg er fin')).toBe(true);
    expect(fire('Giv mig en kaffe')).toBe(true);
    expect(fire('Nej')).toBe(true);
    expect(fire('Jeg har enig')).toBe(true);
    expect(fire('fordi jeg gider ikke')).toBe(true);
    expect(fire('Hvis det regner, vi bliver hjemme')).toBe(true);
    expect(fire('Hvis det regner, bliver vi hjemme')).toBe(false);
    expect(fire('Jeg synes, det er en god idé')).toBe(false);
  });
});
