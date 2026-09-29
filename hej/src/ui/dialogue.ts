import { fill, line } from '../content';
import type { ChoiceOpt, Line, Quality } from '../content/types';
import { stopAudio } from '../audio/audio';
import { S, who } from '../game/state';
import { h, overlay, panel, uiBtn, waitNext } from './dom';
import { type Result, type TilesSpec, runExercise, runTiles } from './exercise';
import type { Exercise } from '../content/types';
import { lineView, playLine, sentence, speakerHeader } from './sentence';

let current: Line | null = null;
window.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement;
  if (!current || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'))) return;
  if (e.key === 'r' || e.key === 'R') void playLine(current);
  if (e.key === 't' || e.key === 'T') void playLine(current, true);
});

function box(...kids: Node[]) {
  return h('div', { class: 'panel dlg' }, ...kids);
}

/** Show one line in the dialogue panel; resolves when the player continues. */
export async function showLine(l: Line, fresh?: Set<string>): Promise<void> {
  current = l;
  const next = uiBtn('next', () => {}, 'primary');
  const view = lineView(l, { fresh });
  view.querySelector('.line-tools')?.append(next);
  panel.show(box(view));
  if (S.settings.autoplay) void playLine(l);
  next.focus({ preventScroll: true });
  await waitNext(next);
  stopAudio();
  current = null;
}

const orders = new WeakMap<ChoiceOpt[], number[]>();
function displayOrder(opts: ChoiceOpt[]): number[] {
  let o = orders.get(opts);
  if (!o) {
    o = opts.map((_, i) => i).sort(() => Math.random() - 0.5);
    orders.set(opts, o);
  }
  return o;
}

/** Offer reply options. Words stay tappable; tap the row (or its ➜) to choose. */
export function choose(opts: ChoiceOpt[], used: Set<number>): Promise<number> {
  const { name } = who();
  return new Promise((resolveRaw) => {
    const resolve = (i: number) => {
      window.removeEventListener('keydown', onKey);
      resolveRaw(i);
    };
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= opts.length && !used.has(order[n - 1])) resolve(order[n - 1]);
    };
    // Show replies in a stable random order so the natural one isn't always first.
    const order = displayOrder(opts);
    const rows = order.map((i) => {
      const o = opts[i];
      const l = line(o.line);
      const pick = () => resolve(i);
      const row = h('div', { class: `choice ${used.has(i) ? 'used' : ''}`, role: 'button', tabindex: '0', 'data-q': o.q },
        h('button', {
          class: 'btn tool', type: 'button', 'aria-label': 'Hear this reply',
          onclick: (e: Event) => { e.stopPropagation(); void playLine(l); },
        }, '🔊'),
        h('div', { class: 'body' }, sentence(l), h('div', { class: 'line-en en' }, fill(l.en, name))),
        h('span', { 'aria-hidden': 'true', style: { fontSize: '20px' } }, '➜'));
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.w')) return; // word lookup, not a choice
        pick();
      });
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') pick();
      });
      return row;
    });
    const u = { da: 'Hvad siger du?', en: 'What do you say?' };
    panel.show(box(
      speakerHeader('you'),
      h('div', { class: 'kicker' }, u.da, h('span', { class: 'en' }, ` · ${u.en}`)),
      h('div', { class: 'choices' }, rows),
      h('div', { class: 'small muted hint', style: { marginTop: '6px' } }, 'Tap a word to look it up. Tap the reply to say it.')));
    (rows.find((_, j) => !used.has(order[j])) as HTMLElement | undefined)?.focus({ preventScroll: true });
    window.addEventListener('keydown', onKey); // keys 1-4 pick
  });
}

export async function feedback(q: Quality, why: string): Promise<void> {
  const title = q === 'wrong' ? '✗ Try again' : q === 'awkward' ? '≈ Understandable, but not how Danes say it' : '✓';
  const next = uiBtn('next', () => {}, 'primary');
  panel.show(box(
    h('div', { class: `feedback ${q === 'wrong' ? 'bad' : 'meh'}` }, h('h4', {}, title), h('div', {}, why)),
    h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, next)));
  next.focus();
  await waitNext(next);
}

/** Build a reply from word tiles inside the dialogue panel. */
export async function buildInPanel(spec: TilesSpec): Promise<Result> {
  const host = h('div');
  panel.show(box(speakerHeader('you'), host));
  return runTiles({ ...spec, build: true }, host);
}

/** A stand-alone exercise on a full-screen sheet. */
export async function exerciseSheet(ex: Exercise, progress?: [number, number]): Promise<Result> {
  panel.hide();
  const host = h('div');
  const bar = progress ? h('div', { class: 'progress' }, h('div', { style: { width: `${(progress[0] / progress[1]) * 100}%` } })) : null;
  overlay.show(h('div', { class: 'panel sheet' }, bar ?? '', host));
  const r = await runExercise(ex, host);
  overlay.hide();
  return r;
}

export function closeDialogue() {
  panel.hide();
  current = null;
}
