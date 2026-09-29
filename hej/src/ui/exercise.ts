import { C, fill, lex, line, wordCount } from '../content';
import type { Exercise, Lang, Line } from '../content/types';
import { play, stopAudio } from '../audio/audio';
import { getCard, sentenceId, wordId } from '../srs/deck';
import type { Grade } from '../srs/fsrs';
import { who } from '../game/state';
import { addReport } from '../store/save';
import { attachSpeak, h, speakUi, toast, ui, uiBtn, waitNext } from './dom';
import { lineView, playLine, sentence } from './sentence';

export interface Result {
  correct: boolean;
  grade: Grade;
}

const shuffle = <T,>(a: T[]): T[] => {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

function prompt(key: string, sub?: string): HTMLElement {
  const u = ui(key);
  const el = h('div', { class: 'row', style: { marginBottom: '6px' } },
    h('div', { class: 'grow' },
      h('div', { class: 'kicker' }, 'Øvelse', h('span', { class: 'en' }, ' · Exercise')),
      h('h2', { lang: 'da' }, u.da),
      h('div', { class: 'en muted' }, sub ?? u.en)),
    h('button', { class: 'btn tool', type: 'button', 'aria-label': 'Hear the instruction', onclick: () => speakUi(key) }, '🔊'));
  attachSpeak(el, key);
  return el;
}

// ─── distractors ────────────────────────────────────────────────────────────
function lineDistractors(target: Line, n: number): string[] {
  const { name } = who();
  const want = wordCount(target);
  const pool = Object.values(C.lines).filter((l) =>
    l.id !== target.id && /^ch\d/.test(l.src) && l.en && fill(l.en, name) !== fill(target.en, name) && l.da !== target.da);
  const met = pool.filter((l) => getCard(sentenceId(l)));
  const base = met.length >= n * 2 ? met : pool;
  const scored = shuffle(base).sort((a, b) => Math.abs(wordCount(a) - want) - Math.abs(wordCount(b) - want));
  const out: string[] = [];
  for (const l of scored.slice(0, 12)) {
    const e = fill(l.en, name);
    if (!out.includes(e)) out.push(e);
    if (out.length >= n) break;
  }
  return shuffle(out);
}

function wordDistractors(id: string, n: number): string[] {
  const e = C.lexicon[id];
  const pool = Object.values(C.lexicon).filter((x) => x.id !== id && x.pos !== 'name' && x.en !== e.en);
  const same = shuffle(pool.filter((x) => x.pos === e.pos && getCard(wordId(x.id))));
  const rest = shuffle(pool.filter((x) => getCard(wordId(x.id))));
  const any = shuffle(pool);
  const out: string[] = [];
  for (const x of [...same, ...rest, ...any]) {
    if (!out.includes(x.en)) out.push(x.en);
    if (out.length >= n) break;
  }
  return out;
}

// ─── listen & choose ────────────────────────────────────────────────────────
export async function runListen(ex: Extract<Exercise, { type: 'listen' }>, host: HTMLElement): Promise<Result> {
  const { name } = who();
  const l = ex.line ? line(ex.line) : undefined;
  const e = ex.word ? lex(ex.word) : undefined;
  let hinted = false;
  const t0 = performance.now();
  const doPlay = (slow = false) => {
    if (slow) hinted = true;
    if (l) return playLine(l, slow);
    if (e) return play(e.audio, { text: e.lemma, voice: 'narrator', slow });
    return Promise.resolve();
  };

  let correct: string, options: string[];
  if (ex.options) {
    correct = ex.answer!;
    options = shuffle(ex.options);
  } else if (l) {
    correct = fill(l.en, name);
    options = shuffle([correct, ...lineDistractors(l, 3)]);
  } else {
    correct = e!.en;
    options = shuffle([correct, ...wordDistractors(e!.id, 3)]);
  }
  const digits = !!ex.options && options.every((o) => /^[\d ]+$/.test(o));

  const textBox = h('div', { style: { minHeight: '8px', textAlign: 'center' } });
  const reveal = uiBtn('showText', () => {
    hinted = true;
    reveal.remove();
    textBox.append(h('div', { class: 'sent', lang: 'da' }, l ? fill(l.da, name) : e!.lemma));
  }, 'tool');
  const optsEl = h('div', { class: `options ${digits ? 'digits' : ''}` });
  const after = h('div');
  host.replaceChildren(
    prompt(ex.options ? 'listenChoose' : 'whatMeans', ex.options ? 'Listen and pick what you heard.' : 'Listen. What does it mean?'),
    h('div', { class: 'big-play' },
      h('button', { class: 'btn', type: 'button', 'aria-label': 'Play', onclick: () => doPlay() }, '▶'),
      h('button', { class: 'btn', type: 'button', 'aria-label': 'Play slowly', onclick: () => doPlay(true) }, '🐢')),
    h('div', { class: 'row', style: { justifyContent: 'center' } }, reveal),
    textBox, optsEl, after);
  void doPlay();

  return new Promise((resolve) => {
    const buttons = options.map((o) => h('button', { class: 'btn opt', type: 'button' }, o));
    buttons.forEach((b, i) => {
      b.addEventListener('click', async () => {
        const ok = options[i] === correct;
        buttons.forEach((x, j) => {
          x.setAttribute('disabled', '');
          x.style.opacity = '1';
          if (options[j] === correct) x.classList.add('right');
        });
        if (!ok) b.classList.add('wrong');
        const ms = performance.now() - t0;
        const grade: Grade = !ok ? 1 : hinted ? 2 : e && ms < 3500 ? 4 : 3;
        reveal.remove();
        textBox.replaceChildren();
        after.append(h('div', { class: `feedback ${ok ? 'good' : 'bad'}` },
          h('h4', {}, ok ? `✓ ${ui('correct').da}` : `✗ ${ui('wrong').da}`),
          l ? lineView(l, { header: false }) : e ? h('div', {}, h('b', { lang: 'da' }, e.lemma), ' — ', e.en) : null));
        speakUi(ok ? 'correct' : 'wrong');
        setTimeout(() => void doPlay(), 700);
        const next = uiBtn('next', () => {}, 'primary');
        after.append(h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '8px' } }, next));
        next.focus();
        await waitNext(next);
        stopAudio();
        resolve({ correct: ok, grade });
      });
      optsEl.append(b);
    });
  });
}

// ─── word-order tiles (also used to build replies in dialogue) ──────────────
export interface TilesSpec {
  line: string;
  extra: string[];
  accept?: string[][];
  prompt?: Lang;
  show?: string;
  /** Line id of the voiced prompt. */
  promptLine?: string;
  /** Dialogue reply building rather than a stand-alone exercise. */
  build?: boolean;
}

const normWord = (s: string) => s.toLowerCase();

export async function runTiles(spec: TilesSpec, host: HTMLElement): Promise<Result> {
  const { name } = who();
  const l = line(spec.line);
  const words = l.tokens.filter((t) => t.k !== 'p').map((t) => {
    if (t.k === 'n') return name;
    const e = lex(t.l);
    return e?.pos === 'name' || t.t === 'USA' ? t.t : t.t.toLowerCase();
  });
  const target = words.map(normWord);
  const accepts = [target, ...(spec.accept ?? [])];
  const pool = shuffle([...words.map((w, i) => ({ w, i })), ...spec.extra.map((w, i) => ({ w, i: 100 + i }))]);
  // never show the tiles already in the right order
  if (pool.length > 2 && pool.every((p, i) => p.i === i)) pool.push(pool.shift()!);

  const answer = h('div', { class: 'tiles-answer', 'aria-label': 'Your answer', role: 'list' });
  const bank = h('div', { class: 'tiles-bank', role: 'list' });
  const after = h('div');
  const placed: { w: string; i: number; b: HTMLButtonElement }[] = [];
  const check = uiBtn('check', () => {}, 'primary');
  check.setAttribute('disabled', '');

  const bankBtns = pool.map((p) => {
    const b = h('button', { class: 'btn tile', type: 'button', lang: 'da' }, p.w);
    b.addEventListener('click', () => {
      if (b.classList.contains('placeholder') || done) return;
      b.classList.add('placeholder');
      const a = h('button', { class: 'btn tile', type: 'button', lang: 'da' }, p.w);
      const entry = { w: p.w, i: p.i, b: a };
      placed.push(entry);
      a.addEventListener('click', () => {
        if (done) return;
        placed.splice(placed.indexOf(entry), 1);
        a.remove();
        b.classList.remove('placeholder');
        refresh();
      });
      answer.append(a);
      refresh();
    });
    return b;
  });
  bank.append(...bankBtns);
  let done = false;
  const refresh = () => (placed.length ? check.removeAttribute('disabled') : check.setAttribute('disabled', ''));

  const key = spec.build ? 'buildReply' : 'order';
  const pLine = spec.promptLine ? C.lines[spec.promptLine] : undefined;
  const promptEl = spec.prompt
    ? h('div', { class: 'row', style: { marginBottom: '6px' } },
      h('div', { class: 'grow' },
        h('div', { class: 'kicker' }, spec.build ? 'Dit svar' : 'Øvelse', h('span', { class: 'en' }, spec.build ? ' · Your reply' : ' · Exercise')),
        pLine ? sentence(pLine) : h('div', { lang: 'da', style: { fontWeight: '800', fontSize: '18px' } }, spec.prompt.da),
        h('div', { class: 'en muted' }, spec.prompt.en)),
      pLine ? h('button', { class: 'btn tool', type: 'button', 'aria-label': 'Hear the instruction', onclick: () => playLine(pLine) }, '🔊') : null)
    : prompt(key, spec.build ? 'Build your reply from the words.' : 'Put the words in the right order.');
  let hinted = false;
  const listen = (slow: boolean) => {
    hinted = true;
    void playLine(l, slow);
  };
  const kids: (HTMLElement | null)[] = [
    promptEl,
    spec.show ? h('div', { class: 'show-digits' }, spec.show) : null,
    spec.show ? null : h('div', { class: 'hint en muted', style: { fontStyle: 'italic' } }, `“${fill(l.en, name)}”`),
    spec.build ? null : h('div', { class: 'row' },
      h('button', { class: 'btn tool', type: 'button', 'aria-label': 'Listen', onclick: () => listen(false) }, '▶'),
      h('button', { class: 'btn tool', type: 'button', 'aria-label': 'Listen slowly', onclick: () => listen(true) }, '🐢'),
      h('span', { class: 'small muted hint' }, 'Stuck? Listen (counts as a hint).')),
    answer, bank,
    h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '10px' } }, check),
    after,
  ];
  host.replaceChildren(...(kids.filter(Boolean) as HTMLElement[]));
  if (pLine && spec.build) void playLine(pLine);

  return new Promise((resolve) => {
    check.addEventListener('click', async () => {
      if (done || !placed.length) return;
      done = true;
      const got = placed.map((p) => normWord(p.w));
      const ok = accepts.some((a) => a.length === got.length && a.every((w, i) => w === got[i]));
      answer.classList.add(ok ? 'right' : 'wrong');
      check.remove();
      bank.remove();
      const fb = h('div', { class: `feedback ${ok ? 'good' : 'bad'}` },
        h('h4', {}, ok ? `✓ ${ui('correct').da}` : `✗ ${ui('wrong').da} — the answer:`),
        lineView(l, { header: false }));
      after.append(fb);
      speakUi(ok ? 'correct' : 'wrong');
      setTimeout(() => void playLine(l), 600);
      let grade: Grade = ok ? (hinted ? 2 : 3) : 1;
      if (!ok) {
        const alsoRight = h('button', {
          class: 'btn tool', type: 'button',
          onclick: async () => {
            await addReport({
              t: Date.now(), kind: 'line', id: l.id, da: l.da, en: l.en, cat: 'tiles-alternative',
              note: `Player thinks this order is also correct: "${placed.map((p) => p.w).join(' ')}"`, version: C.version,
            });
            grade = 2;
            alsoRight.replaceWith(h('span', { class: 'small' }, 'Noted — a reviewer will check it. Counted as “hard”, not wrong.'));
            toast('Saved for review');
          },
        }, 'Mine was also correct');
        fb.append(h('div', { style: { marginTop: '6px' } }, alsoRight));
      }
      const next = uiBtn('next', () => {}, 'primary');
      after.append(h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '8px' } }, next));
      next.focus();
      await waitNext(next);
      stopAudio();
      resolve({ correct: ok, grade });
    });
  });
}

export function runExercise(ex: Exercise, host: HTMLElement): Promise<Result> {
  if (ex.type === 'listen') return runListen(ex, host);
  return runTiles({ line: ex.line, extra: ex.extra, accept: ex.accept, prompt: ex.prompt }, host);
}
