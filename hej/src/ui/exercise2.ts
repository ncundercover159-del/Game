// Exercise types beyond listen-and-choose and word tiles: dictation, cloze, pick the
// natural reply, speak aloud / shadowing, and match audio to picture.

import { C, fill, lex, line } from '../content';
import type { Exercise, Line } from '../content/types';
import { play, stopAudio } from '../audio/audio';
import { S, who } from '../game/state';
import { getCard, wordId } from '../srs/deck';
import type { Grade } from '../srs/fsrs';
import { levenshtein, normalize } from '../talk/match';
import { attachSpeak, h, speakUi, ui, uiBtn, waitNext } from './dom';
import type { Result } from './exercise';
import { lineView, playLine, sentence, speakerHeader } from './sentence';

const TEST = typeof location !== 'undefined' && /[?&]test\b/.test(location.search);
const shuffle = <T,>(a: T[]): T[] => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

function header(key: string, sub?: string) {
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

function playRow(l: Line, onSlow?: () => void) {
  return h('div', { class: 'big-play' },
    h('button', { class: 'btn', type: 'button', 'aria-label': 'Play', onclick: () => playLine(l) }, '▶'),
    h('button', { class: 'btn', type: 'button', 'aria-label': 'Play slowly', onclick: () => { onSlow?.(); void playLine(l, true); } }, '🐢'));
}

async function finish(after: HTMLElement, ok: boolean, body: Node | null, grade: Grade, title?: string): Promise<Result> {
  after.append(h('div', { class: `feedback ${ok ? 'good' : 'bad'}` },
    h('h4', {}, title ?? (ok ? `✓ ${ui('correct').da}` : `✗ ${ui('wrong').da}`)), body));
  speakUi(ok ? 'correct' : 'wrong');
  const next = uiBtn('next', () => {}, 'primary');
  after.append(h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '8px' } }, next));
  next.focus();
  await waitNext(next);
  stopAudio();
  return { correct: ok, grade };
}

function keyRow(input: HTMLInputElement) {
  const ins = (ch: string) => {
    const a = input.selectionStart ?? input.value.length;
    input.value = input.value.slice(0, a) + ch + input.value.slice(input.selectionEnd ?? a);
    input.focus();
    input.setSelectionRange(a + 1, a + 1);
  };
  return h('div', { class: 'keys row', style: { margin: '6px 0' } },
    ['æ', 'ø', 'å'].map((c) => h('button', { class: 'btn', type: 'button', onclick: () => ins(c) }, c)));
}

// ─── dictation ───────────────────────────────────────────────────────────────
export async function runDictation(ex: Extract<Exercise, { type: 'dictation' }>, host: HTMLElement): Promise<Result> {
  const { name } = who();
  const l = line(ex.line);
  const target = fill(l.da, name);
  let slowUsed = false;
  const input = h('input', { type: 'text', lang: 'da', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'sentences', 'aria-label': 'Type what you hear' }) as HTMLInputElement;
  if (TEST) input.dataset.answer = target;
  const check = uiBtn('check', () => {}, 'primary');
  const after = h('div');
  host.replaceChildren(header('dictation'), playRow(l, () => (slowUsed = true)), input, keyRow(input),
    h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, check), after);
  void playLine(l);
  input.focus();
  await new Promise<void>((r) => {
    check.addEventListener('click', () => r(), { once: true });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); r(); } });
  });
  check.remove();
  input.disabled = true;
  const got = normalize(input.value), want = normalize(target);
  const dist = levenshtein(got, want);
  const exact = got === want;
  const close = !exact && dist <= Math.max(1, Math.floor(want.length / 12));
  // word-by-word comparison for feedback
  const gw = got.split(' '), ww = want.split(' ');
  const diff = h('div', { class: 'sent', style: { fontSize: '18px' } },
    ww.map((w, i) => h('span', { style: { background: gw[i] === w ? '' : '#ffd0d0', marginRight: '6px', borderRadius: '3px' } }, w)));
  const ok = exact || close;
  return finish(after, ok, h('div', {}, exact ? null : h('div', { class: 'small' }, close ? 'Almost — check the spelling:' : 'The sentence was:'),
    exact ? lineView(l, { header: false }) : h('div', {}, diff, lineView(l, { header: false }))),
  exact ? (slowUsed ? 2 : 3) : close ? 2 : 1, close ? '≈ Nearly there' : undefined);
}

// ─── cloze ───────────────────────────────────────────────────────────────────
function pickGap(l: Line, word?: string): number {
  const idx = l.tokens.map((t, i) => ({ t, i })).filter(({ t }) => t.k === 'w' && t.l);
  if (word) {
    const hit = idx.find(({ t }) => t.t.toLowerCase() === word.toLowerCase());
    if (hit) return hit.i;
  }
  const good = idx.filter(({ t }) => ['verb', 'noun', 'adj', 'adv', 'num', 'pron'].includes(C.lexicon[t.l!]?.pos));
  const pool = good.length ? good : idx;
  return pool[Math.floor(Math.random() * pool.length)].i;
}

function clozeOptions(correct: string, lexId: string | undefined): string[] {
  const out = new Set<string>([correct.toLowerCase()]);
  const e = lex(lexId);
  if (e) {
    for (const [k, v] of Object.entries(e.forms)) if (k !== 'aux') for (const f of v.split('/')) {
      const w = f.trim().replace(/^(at|har|er) /, '').toLowerCase();
      if (w && !w.includes(' ')) out.add(w);
    }
    out.add(e.lemma.toLowerCase());
    if (out.size < 4) {
      const same = shuffle(Object.values(C.lexicon).filter((x) => x.pos === e.pos && x.id !== e.id && getCard(wordId(x.id))));
      for (const x of same) {
        if (out.size >= 4) break;
        out.add(x.lemma.toLowerCase());
      }
    }
  }
  return shuffle([...out].slice(0, 4));
}

export async function runCloze(ex: Extract<Exercise, { type: 'cloze' }>, host: HTMLElement): Promise<Result> {
  const { name } = who();
  const l = line(ex.line);
  const gi = pickGap(l, ex.word);
  const tok = l.tokens[gi];
  const correct = tok.t.toLowerCase();
  const options = ex.options ? shuffle(ex.options.map((o) => o.toLowerCase())) : clozeOptions(correct, tok.l);
  if (!options.includes(correct)) options.splice(0, 1, correct);
  const shown = h('div', { class: 'sent', lang: 'da' }, l.tokens.map((t, i) =>
    h('span', {}, t.s ? ' ' : '', i === gi ? h('span', { class: 'gap', style: { borderBottom: '3px solid var(--ink)', padding: '0 18px' } }, ' ') : t.k === 'n' ? name : t.t)));
  const after = h('div');
  const opts = h('div', { class: 'options' });
  host.replaceChildren(header('cloze'), shown, h('div', { class: 'line-en en hint' }, fill(l.en, name)), playRow(l), opts, after);
  return new Promise((resolve) => {
    const btns = shuffle(options).map((o) => {
      const b = h('button', { class: 'btn opt', type: 'button', lang: 'da' }, o);
      if (TEST && o === correct) b.dataset.answer = '1';
      b.addEventListener('click', async () => {
        const ok = o === correct;
        btns.forEach((x) => { x.setAttribute('disabled', ''); x.style.opacity = '1'; if (x.textContent === correct) x.classList.add('right'); });
        if (!ok) b.classList.add('wrong');
        (shown.querySelector('.gap') as HTMLElement).textContent = tok.t;
        setTimeout(() => void playLine(l), 400);
        const e = lex(tok.l);
        resolve(await finish(after, ok, h('div', {}, lineView(l, { header: false }),
          e ? h('div', { class: 'small' }, h('b', {}, tok.t), ` — from `, h('b', {}, e.lemma), ` (${e.pos}): ${e.en}`) : null), ok ? 3 : 1));
      });
      return b;
    });
    opts.append(...btns);
  });
}

// ─── pick the natural reply ──────────────────────────────────────────────────
export async function runReply(ex: Extract<Exercise, { type: 'reply' }>, host: HTMLElement): Promise<Result> {
  const { name } = who();
  const p = line(ex.prompt);
  const good = line(ex.good);
  const bads = ex.bad.map((id) => line(id));
  const pair = C.replies.find((r) => r.prompt === ex.prompt);
  const why = (id: string) => pair?.bad.find((b) => b.line === id)?.why ?? '';
  const opts = shuffle([good, ...bads]);
  const after = h('div');
  const box = h('div', { class: 'choices' });
  host.replaceChildren(header('replyPick', 'Pick the reply a Dane would give.'),
    h('div', { class: 'bubble them', style: { margin: '6px 0 10px' } }, speakerHeader(p.who), sentence(p), h('div', { class: 'line-en en small' }, fill(p.en, name)),
      h('button', { class: 'btn tool', type: 'button', 'aria-label': 'Listen', onclick: () => playLine(p) }, '▶')),
    box, after);
  void playLine(p);
  return new Promise((resolve) => {
    const rows = opts.map((o) => {
      const row = h('button', { class: 'btn opt', type: 'button', lang: 'da' }, fill(o.da, name), h('div', { class: 'small muted en' }, fill(o.en, name)));
      if (TEST && o.id === good.id) row.dataset.answer = '1';
      row.addEventListener('click', async () => {
        const ok = o.id === good.id;
        rows.forEach((r) => r.setAttribute('disabled', ''));
        row.classList.add(ok ? 'right' : 'wrong');
        void playLine(ok ? o : good);
        resolve(await finish(after, ok, h('div', {}, ok ? null : h('p', {}, why(o.id)), lineView(good, { header: false })), ok ? 3 : 1));
      });
      return row;
    });
    box.append(...rows);
  });
}

// ─── speak aloud / shadowing ─────────────────────────────────────────────────
const Rec: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition : undefined;

/** Share of target words heard in order (longest common subsequence). */
export function wordScore(heard: string, target: string): number {
  const a = normalize(heard).split(' ').filter(Boolean), b = normalize(target).split(' ').filter(Boolean);
  if (!b.length) return 0;
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp[a.length][b.length] / b.length;
}

function recognise(): Promise<string> {
  return new Promise((resolve) => {
    const r = new Rec();
    r.lang = 'da-DK';
    r.interimResults = false;
    r.maxAlternatives = 3;
    let text = '';
    r.onresult = (e: any) => { text = e.results[0][0].transcript; };
    r.onerror = () => resolve('');
    r.onend = () => resolve(text);
    r.start();
  });
}

export async function runSpeak(ex: Extract<Exercise, { type: 'speak' }>, host: HTMLElement): Promise<Result> {
  const { name } = who();
  const l = line(ex.line);
  const target = fill(l.da, name);
  const after = h('div');
  const status = h('div', { class: 'small', style: { minHeight: '20px', margin: '6px 0' } });
  let recUrl: string | null = null;
  const mine = h('button', { class: 'btn', type: 'button', disabled: true }, '▶ Mig');
  const compare = uiBtn('compare', async () => {
    await playLine(l);
    if (recUrl) await new Audio(recUrl).play().catch(() => {});
  });
  compare.setAttribute('disabled', '');
  mine.addEventListener('click', () => { if (recUrl) void new Audio(recUrl).play(); });

  // Shadowing: record yourself with MediaRecorder, then compare with the native clip.
  const canRecord = typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const recBtn = uiBtn('record', async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      const stopped = new Promise<void>((r) => (mr.onstop = () => r()));
      mr.start();
      status.textContent = '⏺ Recording… say the sentence';
      recBtn.setAttribute('disabled', '');
      const spoken = Rec && S.settings.speaking ? recognise() : new Promise<string>((r) => setTimeout(() => r(''), Math.max(2500, target.length * 120)));
      const heard = await spoken;
      mr.stop();
      await stopped;
      stream.getTracks().forEach((t) => t.stop());
      recUrl = URL.createObjectURL(new Blob(chunks, { type: mr.mimeType }));
      mine.removeAttribute('disabled');
      compare.removeAttribute('disabled');
      recBtn.removeAttribute('disabled');
      if (heard) judge(heard);
      else status.textContent = 'Recorded. Compare with the native speaker, then rate yourself.';
    } catch {
      status.textContent = 'No microphone access — say it aloud, then rate yourself.';
    }
  }, 'primary');
  if (!canRecord) recBtn.setAttribute('disabled', '');

  let resolveFn: (r: Result) => void = () => {};
  let done = false;
  const conclude = async (ok: boolean, grade: Grade, note?: string) => {
    if (done) return;
    done = true;
    selfRow.remove();
    recBtn.setAttribute('disabled', '');
    recBtn.classList.remove('primary');
    cantBtn.remove();
    resolveFn(await finish(after, ok, h('div', {}, note ? h('p', {}, note) : null, lineView(l, { header: false })), grade));
  };
  let tries = 0;
  const judge = (heard: string) => {
    tries++;
    const score = wordScore(heard, target);
    status.replaceChildren(h('span', {}, 'I heard: '), h('b', { lang: 'da' }, `“${heard}”`), ` — ${Math.round(score * 100)}% of the words`);
    if (score >= 0.8) void conclude(true, tries === 1 ? 3 : 2);
    else if (tries >= 3) void conclude(score >= 0.5, score >= 0.5 ? 2 : 1, 'Speech recognition struggles with accents — listen and shadow a few more times.');
    else status.append(h('div', {}, 'Try again — listen first, then speak at the same pace.'));
  };
  const selfRow = h('div', { class: 'row', style: { marginTop: '8px' } },
    uiBtn('selfRight', () => void conclude(true, 3), 'good'),
    uiBtn('selfAlmost', () => void conclude(true, 2)),
    uiBtn('selfNo', () => void conclude(false, 1)));
  if (TEST) selfRow.firstElementChild!.setAttribute('data-answer', '1');
  const cantBtn = h('div', { style: { marginTop: '8px' } }, h('button', {
    class: 'btn ghost small', type: 'button',
    onclick: () => { S.settings.speaking = false; void conclude(true, 2, 'Speaking exercises are paused — turn them back on in Settings.'); },
  }, ui('cantSpeak').da));
  host.replaceChildren(header('speak', Rec ? 'Listen, then record yourself. Speech recognition checks your words.' : 'Listen, record yourself, and compare with the native speaker.'),
    lineView(l, { header: false }), status,
    h('div', { class: 'row' }, recBtn, mine, compare),
    h('div', { class: 'small muted', style: { marginTop: '10px' } }, 'Or rate yourself after saying it aloud:'), selfRow,
    cantBtn,
    after);
  void playLine(l);
  return new Promise((r) => (resolveFn = r));
}

// ─── match audio to picture ──────────────────────────────────────────────────
export async function runPicture(ex: Extract<Exercise, { type: 'picture' }>, host: HTMLElement): Promise<Result> {
  const e = lex(ex.word)!;
  const pool = shuffle(Object.values(C.lexicon).filter((x) => x.pic && x.id !== e.id && x.pic !== e.pic));
  const met = pool.filter((x) => getCard(wordId(x.id)));
  const others = [...met, ...pool.filter((x) => !met.includes(x))].slice(0, 3);
  const opts = shuffle([e, ...others]);
  const after = h('div');
  const grid = h('div', { class: 'options digits' });
  const say = () => play(e.audio, { text: e.lemma, voice: 'narrator' });
  host.replaceChildren(header('picture'),
    h('div', { class: 'big-play' },
      h('button', { class: 'btn', type: 'button', 'aria-label': 'Play', onclick: say }, '▶'),
      h('button', { class: 'btn', type: 'button', 'aria-label': 'Play slowly', onclick: () => play(e.audio, { text: e.lemma, voice: 'narrator', slow: true }) }, '🐢')),
    grid, after);
  void say();
  return new Promise((resolve) => {
    const btns = opts.map((o) => {
      const b = h('button', { class: 'btn opt', type: 'button', style: { fontSize: '44px', minHeight: '90px' }, 'aria-label': o.en }, o.pic!);
      if (TEST && o.id === e.id) b.dataset.answer = '1';
      b.addEventListener('click', async () => {
        const ok = o.id === e.id;
        btns.forEach((x) => x.setAttribute('disabled', ''));
        b.classList.add(ok ? 'right' : 'wrong');
        void say();
        resolve(await finish(after, ok, h('div', {}, h('span', { style: { fontSize: '30px' } }, e.pic!), ' ', h('b', { lang: 'da' }, `${e.g ? e.g + ' ' : ''}${e.lemma}`), ` — ${e.en}`), ok ? 3 : 1));
      });
      return b;
    });
    grid.append(...btns);
  });
}
