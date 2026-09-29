import { C, lex } from '../content';
import type { LexEntry, Line, Token } from '../content/types';
import { play } from '../audio/audio';
import { addWord, getCard, wordId } from '../srs/deck';
import { State } from '../srs/fsrs';
import { who } from '../game/state';
import { h, popup, toast, uiBtn } from './dom';
import { openReport } from './report';

const LABELS: Record<string, Record<string, string>> = {
  noun: { def: 'definite (the …)', pl: 'plural', defpl: 'definite plural' },
  verb: { inf: 'infinitive', pres: 'present', past: 'past', perf: 'perfect', imp: 'imperative', passive: 'passive' },
  adj: { t: 'with et-words', e: 'plural / definite', pl: 'plural', comp: 'comparative', sup: 'superlative' },
  pron: { obj: 'object form', poss: 'possessive', et: 'with et-words', pl: 'with plurals' },
  num: { et: 'with et-words' },
  art: { et: 'with et-words' },
};
const POS: Record<string, string> = {
  noun: 'noun', verb: 'verb', adj: 'adjective', adv: 'adverb', pron: 'pronoun', prep: 'preposition',
  conj: 'conjunction', interj: 'interjection', num: 'number', art: 'article', name: 'name', phrase: 'phrase', part: 'particle',
};

function sayBtn(key: string | undefined, text: string, label = '🔊') {
  return h('button', {
    class: 'btn tool', type: 'button', 'aria-label': `Play ${text}`,
    onclick: () => play(key, { text, voice: 'narrator' }),
  }, label);
}

function formRows(e: LexEntry): HTMLElement | null {
  const labels = LABELS[e.pos] ?? {};
  const rows: HTMLElement[] = [];
  if (e.pos === 'noun' && e.g) rows.push(row('indefinite', `${e.g} ${e.lemma}`, e.audio));
  for (const [k, v] of Object.entries(e.forms)) {
    if (k === 'aux') continue;
    let shown = v;
    if (e.pos === 'verb' && k === 'perf') shown = `${e.forms.aux ?? 'har'} ${v}`;
    if (e.pos === 'verb' && k === 'imp') shown = `${v}!`;
    rows.push(row(labels[k] ?? k, shown, e.formAudio[v.replace(/^at /, '').toLowerCase()] ?? (k === 'inf' ? e.audio : undefined)));
  }
  if (!rows.length) return null;
  return h('table', {}, h('tbody', {}, rows));
}
function row(label: string, form: string, key?: string) {
  return h('tr', {}, h('td', {}, label), h('td', {}, h('b', {}, form), ' ', key ? sayBtn(key, form, '🔊') : null));
}

function when(due: number) {
  const d = due - Date.now();
  if (d <= 0) return 'due now';
  const m = Math.round(d / 60000);
  if (m < 60) return `in ${m} min`;
  const hrs = Math.round(m / 60);
  if (hrs < 36) return `in ${hrs} h`;
  return `in ${Math.round(hrs / 24)} days`;
}

function deckRow(id: string) {
  const box = h('div', { class: 'row', style: { marginTop: '10px' } });
  const render = () => {
    box.replaceChildren();
    const c = getCard(wordId(id));
    if (c && c.starred) {
      box.append(h('span', { class: 'pill' }, '★ in my deck'), ' ',
        h('span', { class: 'small muted' }, c.state === State.New ? 'not practised yet' : `next review ${when(c.due)}`));
    } else {
      box.append(uiBtn('addToDeck', () => {
        addWord(id, true);
        toast('★ Added to your deck');
        render();
      }, 'good'));
      if (c) box.append(h('span', { class: 'small muted' }, c.state === State.New ? ' met, not practised yet' : ` next review ${when(c.due)}`));
    }
  };
  render();
  return box;
}

export function openLookup(t: Token, l: Line | undefined, onClose?: () => void) {
  const { name } = who();
  const e = lex(t.l);
  const surface = t.k === 'n' ? name : t.t;
  const content = h('div', { class: 'panel lookup', role: 'dialog', 'aria-label': `Word: ${surface}` });
  const formKey = e ? e.formAudio[surface.toLowerCase()] ?? e.audio : undefined;

  content.append(h('div', { class: 'row' },
    h('div', { class: 'word grow', lang: 'da' }, surface),
    sayBtn(t.k === 'n' ? C.nameAudio[name] : formKey, surface),
    h('button', { class: 'btn tool', type: 'button', 'aria-label': 'Close', onclick: () => popup.hide() }, '✕')));

  if (t.k === 'n') {
    content.append(h('div', { class: 'gloss' }, 'Your name.'));
  } else if (e) {
    content.append(h('div', { class: 'lemma' },
      e.lemma.toLowerCase() !== surface.toLowerCase() ? h('span', {}, 'from ', h('b', { lang: 'da' }, e.lemma), ' ', sayBtn(e.audio, e.lemma), ' · ') : null,
      POS[e.pos] ?? e.pos, ' ',
      e.g ? h('span', { class: `pill ${e.g}` }, `${e.g}-word`) : null));
    if (t.c) content.append(h('div', { class: 'gloss' }, h('span', { class: 'muted small' }, 'Here: '), h('b', {}, t.c)));
    content.append(h('div', { class: t.c ? 'small muted' : 'gloss' }, t.c ? `Dictionary: ${e.en}` : e.en));
    const f = formRows(e);
    if (f) content.append(f);
    if (e.say) content.append(h('div', { class: 'say' }, h('b', {}, '🗣 '), e.say));
    if (e.note) content.append(h('p', { class: 'small' }, e.note));
    if (e.rank) content.append(h('div', { class: 'small muted' }, `Frequency: about #${e.rank} most common word`));
  } else if (t.c) {
    content.append(h('div', { class: 'gloss' }, t.c), h('div', { class: 'small muted' }, 'Not in the game’s dictionary yet.'));
  } else if (t.k === 'num') {
    content.append(h('div', { class: 'gloss' }, `The number ${t.t}.`));
  }

  const ph = lex(t.p);
  if (ph) {
    content.append(h('div', { class: 'phrase-box' },
      h('div', { class: 'row' }, h('div', { class: 'grow' }, 'Part of the phrase ', h('b', { lang: 'da' }, ph.lemma)), sayBtn(ph.audio, ph.lemma)),
      h('div', {}, ph.en),
      ph.note ? h('div', { class: 'small' }, ph.note) : null,
      deckRow(ph.id)));
  }
  if (e && e.pos !== 'name') content.append(deckRow(e.id));
  content.append(h('div', { class: 'row', style: { marginTop: '8px' } },
    h('span', { class: 'grow' }),
    h('button', {
      class: 'btn tool ghost', type: 'button',
      onclick: () => openReport({ kind: 'word', id: e?.id ?? t.t, da: `${surface}${l ? ` — in “${l.da}”` : ''}`, en: e?.en ?? '' }),
    }, '⚑ Report')));
  popup.show(content);
  if (e && formKey) void play(formKey, { text: surface, voice: 'narrator' });
  const obs = new MutationObserver(() => {
    if (!popup.open) {
      obs.disconnect();
      onClose?.();
    }
  });
  obs.observe(popup.el, { attributes: true, attributeFilter: ['class'] });
}
