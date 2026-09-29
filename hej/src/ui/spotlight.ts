import { C, fill, line } from '../content';
import { who } from '../game/state';
import type { GrammarCard, Line } from '../content/types';
import { h, overlay, uiBtn, waitNext } from './dom';
import { lineTools, playLine, sentence } from './sentence';

function marks(card: GrammarCard, l: Line): Set<number> {
  const out = new Set<number>();
  if (card.highlight === 'verb') {
    const i = l.tokens.findIndex((t) => t.l && C.lexicon[t.l]?.pos === 'verb');
    if (i >= 0) out.add(i);
  } else if (card.highlight === 'definite') {
    l.tokens.forEach((t, i) => {
      const e = t.l ? C.lexicon[t.l] : undefined;
      const f = t.t.toLowerCase();
      if (e?.pos === 'noun' && (e.forms.def === f || e.forms.defpl === f)) out.add(i);
    });
  }
  return out;
}

/** "Pattern spotlight": the rule plus three examples the player just heard. */
export async function showSpotlight(card: GrammarCard): Promise<void> {
  const title = C.lines[`grammar.${card.id}.title`];
  const next = uiBtn('practiseNow', () => {}, 'primary');
  overlay.show(h('div', { class: 'panel sheet', role: 'dialog', 'aria-label': `Pattern: ${card.title.en}` },
    h('div', { class: 'kicker' }, 'Mønster', h('span', { class: 'en' }, ' · Pattern spotlight')),
    h('div', { class: 'row' },
      h('h2', { class: 'grow', lang: 'da' }, card.title.da),
      title ? h('button', { class: 'btn tool', type: 'button', 'aria-label': 'Hear the title', onclick: () => playLine(title) }, '🔊') : null),
    h('div', { class: 'muted' }, card.title.en),
    h('div', { class: 'spot-pattern' }, card.pattern),
    h('p', {}, card.rule),
    h('h3', {}, 'From what you just heard'),
    card.examples.map((id) => {
      const l = line(id);
      return h('div', { class: 'spot-ex' }, sentence(l, { mark: marks(card, l) }), h('div', { class: 'line-en en' }, fill(l.en, who().name)), lineTools(l));
    }),
    h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '12px' } }, next)));
  void playLine(line(card.examples[0]));
  next.focus();
  await waitNext(next);
  overlay.hide();
}
