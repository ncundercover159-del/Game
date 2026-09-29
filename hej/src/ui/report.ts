import { C } from '../content';
import { addReport } from '../store/save';
import { h, popup, toast } from './dom';

const CATS: [string, string][] = [
  ['danish', 'The Danish is wrong or unnatural'],
  ['english', 'The English translation is off'],
  ['audio', 'The audio is wrong'],
  ['note', 'The pronunciation note is wrong'],
  ['other', 'Something else'],
];

/** "Report a mistake": stored locally (IndexedDB), exportable from Settings. */
export function openReport(r: { kind: 'line' | 'word' | 'talk'; id: string; da: string; en: string }) {
  let cat = 'danish';
  const note = h('textarea', { rows: '3', placeholder: 'What should it be? (optional)' }) as HTMLTextAreaElement;
  const cats = h('div', { class: 'list' }, CATS.map(([k, label]) =>
    h('label', { class: 'check' },
      h('input', { type: 'radio', name: 'cat', value: k, checked: k === cat, onchange: () => (cat = k) }), label)));
  popup.show(h('div', { class: 'panel lookup', role: 'dialog', 'aria-label': 'Report a mistake' },
    h('h3', { style: { margin: '0 0 6px' } }, '⚑ Report a mistake'),
    h('div', { lang: 'da' }, h('b', {}, r.da)),
    h('div', { class: 'small muted' }, r.en),
    h('div', { style: { margin: '8px 0' } }, cats),
    note,
    h('div', { class: 'row', style: { marginTop: '10px', justifyContent: 'flex-end' } },
      h('button', { class: 'btn', type: 'button', onclick: () => popup.hide() }, 'Cancel'),
      h('button', {
        class: 'btn primary', type: 'button',
        onclick: async () => {
          await addReport({ t: Date.now(), kind: r.kind, id: r.id, da: r.da, en: r.en, cat, note: note.value, version: C.version });
          popup.hide();
          toast('Thanks — saved. Export reports from Settings.');
        },
      }, 'Save report'))));
}
