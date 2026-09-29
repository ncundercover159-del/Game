import { C, audioKey, fill, lex, voiceOf } from '../content';
import type { Line, Token } from '../content/types';
import { play } from '../audio/audio';
import { S, who } from '../game/state';
import { portrait, PLAYER_LOOKS } from '../engine/sprites';
import { h } from './dom';
import { openLookup } from './lookup';
import { openReport } from './report';

export function playLine(l: Line, slow = false): Promise<void> {
  const { gender, name } = who();
  return play(audioKey(l, gender, name), { slow, text: fill(l.da, name), voice: voiceOf(l.who, gender) });
}

export interface SentenceOpts {
  /** Lexicon ids that are new to the player (highlighted). */
  fresh?: Set<string>;
  /** Tokens to highlight (indexes). */
  mark?: Set<number>;
  /** Disable lookup (e.g. inside tiles). */
  plain?: boolean;
}

/** A sentence whose every word is tappable for lookup. */
export function sentence(l: Pick<Line, 'tokens' | 'da' | 'en' | 'id'> & { who?: string }, o: SentenceOpts = {}): HTMLElement {
  const { name } = who();
  const el = h('div', { class: 'sent', lang: 'da' });
  l.tokens.forEach((t, i) => {
    if (t.s) el.append(' ');
    const text = t.k === 'n' ? name : t.t;
    if (t.k === 'p' || o.plain || (!t.l && t.k !== 'n' && !t.p && !t.c)) {
      el.append(h('span', { class: o.mark?.has(i) ? 'hl-verb' : '' }, text));
      return;
    }
    const cls = ['w'];
    if (t.p) cls.push('phr');
    if (t.l && o.fresh?.has(t.l)) cls.push('new');
    if (o.mark?.has(i)) cls.push('hl-verb');
    const span = h('span', {
      class: cls.join(' '), role: 'button', tabindex: '0',
      'aria-label': `${text}: ${gloss(t)}`,
    }, text);
    const open = (e: Event) => {
      e.stopPropagation();
      span.classList.add('on');
      openLookup(t, l as Line, () => span.classList.remove('on'));
    };
    span.addEventListener('click', open);
    span.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') open(e);
    });
    el.append(span);
  });
  return el;
}

export function gloss(t: Token): string {
  if (t.c) return t.c;
  if (t.k === 'n') return 'your name';
  return lex(t.l)?.en ?? lex(t.p)?.en ?? '';
}

export interface LineViewOpts {
  header?: boolean;
  tools?: boolean;
  fresh?: Set<string>;
  mark?: Set<number>;
  /** Hide English even in "en" mode (used by listening exercises until answered). */
  hideEn?: boolean;
}

export function speakerHeader(whoId: string): HTMLElement {
  const { gender } = who();
  if (whoId !== 'you' && !C.npcs[whoId]) return h('div');
  const npc = C.npcs[whoId];
  const look = npc ? npc.look : PLAYER_LOOKS[gender];
  const nm = npc ? npc.name : S.save?.name ?? '';
  const role = npc ? npc.role : { da: 'dig', en: 'you' };
  const rel = npc ? S.save?.rel[npc.id] ?? 20 : null;
  return h('div', { class: 'speaker' },
    h('img', { src: portrait(look), alt: '' }),
    h('div', {},
      h('div', { class: 'name' }, nm, ' ', rel !== null ? h('span', { class: 'hearts', title: `relationship ${rel}/100` }, hearts(rel)) : null),
      h('div', { class: 'role' }, role.da, h('span', { class: 'en' }, ` · ${role.en}`))));
}

export function hearts(rel: number) {
  const n = Math.max(0, Math.min(5, Math.round(rel / 20)));
  return '♥'.repeat(n) + '♡'.repeat(5 - n);
}

/** Full line display: speaker, tappable sentence, subtitle, pronunciation note, tools. */
export function lineView(l: Line, o: LineViewOpts = {}): HTMLElement {
  const { name } = who();
  const cls = l.who === 'you' ? 'you' : C.npcs[l.who] ? '' : 'narr';
  const en = h('div', { class: `line-en en ${o.hideEn ? 'reveal-hidden' : ''}` }, fill(l.en, name));
  if (o.hideEn) en.style.display = 'none';
  const wrap = h('div', { class: cls },
    o.header !== false ? speakerHeader(l.who) : null,
    sentence(l, { fresh: o.fresh, mark: o.mark }),
    en,
    l.say ? h('div', { class: 'say' }, h('b', {}, '🗣 How it’s said: '), fill(l.say, name)) : null);
  if (o.tools !== false) wrap.append(lineTools(l, en));
  return wrap;
}

export function lineTools(l: Line, en?: HTMLElement): HTMLElement {
  const { name } = who();
  return h('div', { class: 'line-tools' },
    h('button', { class: 'btn tool', type: 'button', title: 'Listen again (R)', 'aria-label': 'Listen again', onclick: () => playLine(l) }, '▶'),
    h('button', { class: 'btn tool', type: 'button', title: 'Slowly (T)', 'aria-label': 'Play slowly', onclick: () => playLine(l, true) }, '🐢'),
    en ? h('button', {
      class: 'btn tool reveal-btn', type: 'button', title: 'Show English',
      onclick: () => { en.classList.add('reveal'); en.style.display = ''; },
    }, 'EN') : null,
    h('span', { class: 'spacer' }),
    h('button', {
      class: 'btn tool ghost', type: 'button', title: 'Report a mistake', 'aria-label': 'Report a mistake in this line',
      onclick: () => openReport({ kind: 'line', id: l.id, da: fill(l.da, name), en: fill(l.en, name) }),
    }, '⚑'));
}
