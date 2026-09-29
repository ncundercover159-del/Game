// "Snak" — free conversation. The player builds sentences from scratch (typing with
// æ/ø/å keys, the word bank, or the microphone) and an NPC answers.
//   Offline: scripted topics with pattern-matched answers and a mistake coach.
//   AI (optional, own API key): open-ended generated conversation with corrections.

import { C, fill, line, voiceOf } from '../content';
import type { Line, TalkTopic, TalkTurn } from '../content/types';
import { resolve, type ResolveCtx } from '../content/tokenize';
import { play, stopAudio } from '../audio/audio';
import type { Game } from '../game/game';
import { S, who } from '../game/state';
import { allCards, meetLine } from '../srs/deck';
import { h, overlay, toast, ui, uiBtn } from '../ui/dom';
import { openReport } from '../ui/report';
import { playLine, sentence, speakerHeader } from '../ui/sentence';
import { AiChat, describeError, levelOf } from './ai';
import { coach, matchAny, suggest } from './match';

// ─── runtime tokenising (typed text, AI replies) ─────────────────────────────
let rctx: ResolveCtx | null = null;
function ctx(): ResolveCtx {
  if (rctx) return rctx;
  const numbers: Record<number, string> = {};
  const phrases: ResolveCtx['phrases'] = {};
  for (const e of Object.values(C.lexicon)) {
    if (e.value !== undefined) numbers[e.value] ??= e.id;
    if (e.pos === 'phrase') {
      const w = e.lemma.toLowerCase().split(/\s+/);
      (phrases[w[0]] ??= []).push([e.id, w]);
    }
  }
  rctx = { forms: C.forms, ambiguous: C.ambiguous, numbers, phrases };
  return rctx;
}

function freeLine(text: string, whoId: string, en = '', gloss: Record<string, string> = {}): Line & { unknown: string[] } {
  const r = resolve(text, ctx(), {}, Object.fromEntries(Object.entries(gloss).map(([k, v]) => [k.toLowerCase(), v])));
  return { id: 'talk', who: whoId, da: text, en, tags: [], tokens: r.tokens, audio: '', reviewed: false, src: 'talk', unknown: r.unknown };
}

function speakFree(text: string, whoId: string, slow = false) {
  const { gender } = who();
  return play(undefined, { text, voice: voiceOf(whoId, gender), slow });
}

// ─── known vocabulary (word bank) ───────────────────────────────────────────
function knownForms(): string[] {
  const out = new Set<string>();
  for (const c of allCards()) {
    if (c.kind !== 'w') continue;
    const e = C.lexicon[c.ref];
    if (!e || e.pos === 'phrase') continue;
    out.add(e.pos === 'name' ? e.lemma : e.lemma.toLowerCase());
    for (const [k, v] of Object.entries(e.forms)) if (k !== 'aux') for (const f of v.split('/')) {
      const w = f.trim().replace(/^(at|har|er) /, '');
      if (w && !w.includes(' ')) out.add(w);
    }
  }
  return [...out].sort((a, b) => a.localeCompare(b, 'da'));
}
function knownLemmas(): string[] {
  return [...new Set(allCards().filter((c) => c.kind === 'w').map((c) => C.lexicon[c.ref]?.lemma).filter(Boolean))] as string[];
}

// ─── hub ─────────────────────────────────────────────────────────────────────
export function openTalkHub(game: Game, npcId?: string) {
  const save = game.save;
  const topics = Object.values(C.talk.topics).filter((t) => !npcId || t.npc === npcId);
  const metNpcs = Object.values(C.npcs).filter((n) => game.met(n.id));
  const hasKey = !!S.settings.aiKey;
  const rows = topics.map((t) => {
    const open = save.done.includes(t.after);
    const npc = C.npcs[t.npc];
    return h('div', { class: 'item' },
      speakerHeader(t.npc),
      h('div', { class: 'grow' }, h('b', { lang: 'da' }, t.title.da), h('div', { class: 'small muted' }, open ? t.title.en : `Unlocks after you meet ${npc.name}`)),
      open ? h('button', { class: 'btn primary', type: 'button', onclick: () => void runTopic(game, t) }, 'Snak') : h('span', { class: 'small' }, '🔒'));
  });
  overlay.show(h('div', { class: 'panel sheet' },
    h('div', { class: 'kicker' }, ui('talk').da, h('span', { class: 'en' }, ' · Free conversation')),
    h('h2', {}, 'Byg dine egne sætninger', h('div', { class: 'muted', style: { fontSize: '14px', fontWeight: '400' } }, 'Build your own sentences — type, use the word bank, or speak.')),
    h('h3', {}, 'Conversations'),
    h('div', { class: 'list' }, rows.length ? rows : h('p', { class: 'muted' }, 'Meet someone first!')),
    h('h3', {}, 'Open conversation ', h('span', { class: 'small muted' }, '(AI, optional)')),
    hasKey
      ? h('div', { class: 'list' }, metNpcs.length ? metNpcs.map((n) => h('div', { class: 'item' },
        speakerHeader(n.id),
        h('div', { class: 'grow small muted' }, 'Anything goes — generated at your level, with corrections.'),
        h('button', { class: 'btn good', type: 'button', onclick: () => void runAi(game, n.id) }, 'Snak'))) : h('p', { class: 'muted' }, 'Meet someone first!'))
      : h('p', { class: 'small muted' }, 'Add an Anthropic API key in Settings (⚙) to chat about anything with the characters you’ve met. Without a key, the conversations above work fully offline.'),
    h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '12px' } }, uiBtn('close', () => overlay.hide()))));
}

// ─── chat view & composer ───────────────────────────────────────────────────
type Action = { kind: 'send'; text: string } | { kind: 'skip' } | { kind: 'hint' } | { kind: 'end' };

class ChatView {
  chat = h('div', { class: 'chat', 'aria-live': 'polite' });
  input = h('input', { type: 'text', lang: 'da', autocomplete: 'off', autocapitalize: 'sentences', spellcheck: 'false', 'aria-label': 'Your reply in Danish', placeholder: ui('typeHere').da }) as HTMLInputElement;
  private waiting: ((a: Action) => void) | null = null;
  private bank = h('div', { class: 'bank', style: { display: 'none' } });
  root: HTMLElement;

  constructor(title: string, sub: string, opts: { skip: boolean }) {
    const send = uiBtn('send', () => this.fire({ kind: 'send', text: this.input.value }), 'primary');
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.fire({ kind: 'send', text: this.input.value });
      }
    });
    const key = (ch: string) => h('button', { class: 'btn', type: 'button', onclick: () => this.insert(ch, false) }, ch);
    const bankBtn = uiBtn('wordBank', () => {
      this.bank.style.display = this.bank.style.display === 'none' ? 'flex' : 'none';
      if (!this.bank.childElementCount) this.fillBank();
    });
    const hint = uiBtn('hint', () => this.fire({ kind: 'hint' }));
    const extra: HTMLElement[] = [];
    const Rec = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (Rec) {
      const mic = h('button', { class: 'btn', type: 'button', title: 'Speak (Danish speech recognition)', 'aria-label': 'Speak your reply' }, '🎤');
      mic.addEventListener('click', () => {
        const r = new Rec();
        r.lang = 'da-DK';
        r.interimResults = false;
        mic.textContent = '…';
        r.onresult = (e: any) => {
          this.input.value = e.results[0][0].transcript;
          this.input.focus();
        };
        r.onend = () => (mic.textContent = '🎤');
        r.onerror = () => { mic.textContent = '🎤'; toast('Speech recognition unavailable'); };
        r.start();
      });
      extra.push(mic);
    }
    const end = h('button', { class: 'btn', type: 'button', onclick: () => this.fire({ kind: 'end' }) }, opts.skip ? 'Skip' : 'End');
    this.root = h('div', { class: 'panel sheet' },
      h('div', { class: 'row' },
        h('div', { class: 'grow' }, h('div', { class: 'kicker' }, 'Snak'), h('h2', { lang: 'da' }, title), h('div', { class: 'muted small' }, sub)),
        h('button', { class: 'btn tool', type: 'button', 'aria-label': 'Close', onclick: () => this.fire({ kind: 'end' }, true) }, '✕')),
      this.chat,
      h('div', { class: 'composer' },
        this.input,
        h('div', { class: 'keys' }, key('æ'), key('ø'), key('å'), ...extra, h('span', { class: 'grow' }), send),
        h('div', { class: 'row' }, bankBtn, hint, h('span', { class: 'grow' }), end),
        this.bank));
  }
  closed = false;

  private insert(text: string, word: boolean) {
    const i = this.input;
    const start = i.selectionStart ?? i.value.length;
    const before = i.value.slice(0, start);
    const after = i.value.slice(i.selectionEnd ?? start);
    const pad = word && before && !before.endsWith(' ') ? ' ' : '';
    const ins = pad + text + (word ? ' ' : '');
    i.value = before + ins + after;
    i.focus();
    i.setSelectionRange(before.length + ins.length, before.length + ins.length);
  }
  private fillBank() {
    const words = [...knownForms(), who().name];
    this.bank.replaceChildren(...words.map((w) => h('button', { class: 'btn tile', type: 'button', lang: 'da', onclick: () => this.insert(w, true) }, w)));
  }

  private fire(a: Action, close = false) {
    if (close) this.closed = true;
    const w = this.waiting;
    this.waiting = null;
    w?.(a);
  }
  next(): Promise<Action> {
    this.input.focus();
    return new Promise((r) => (this.waiting = r));
  }
  clearInput() {
    this.input.value = '';
  }

  add(el: HTMLElement) {
    this.chat.append(el);
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return el;
  }
  /** NPC bubble for a content line (pre-voiced). */
  them(l: Line) {
    meetLine(l);
    const b = this.add(h('div', { class: 'bubble them' }, sentence(l), h('div', { class: 'line-en en small' }, fill(l.en, who().name)),
      h('div', { class: 'row' }, h('button', { class: 'btn tool', type: 'button', 'aria-label': 'Listen', onclick: () => playLine(l) }, '▶'),
        h('button', { class: 'btn tool', type: 'button', 'aria-label': 'Slowly', onclick: () => playLine(l, true) }, '🐢'))));
    void playLine(l);
    return b;
  }
  /** Bubble for free text (typed or generated). */
  free(text: string, whoId: string, en = '', gloss: Record<string, string> = {}, mine = false) {
    const l = freeLine(text, whoId, en, gloss);
    const sent = sentence(l);
    if (mine) {
      const unknown = new Set(l.unknown.map((u) => u.toLowerCase()));
      sent.querySelectorAll('span').forEach((s) => {
        if (unknown.has((s.textContent ?? '').toLowerCase())) s.classList.add('unknown');
      });
    }
    const b = this.add(h('div', { class: `bubble ${mine ? 'me' : 'them'}` }, sent,
      en ? h('div', { class: 'line-en en small' }, en) : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn tool', type: 'button', 'aria-label': 'Listen', onclick: () => speakFree(text, whoId) }, '▶'),
        h('button', { class: 'btn tool', type: 'button', 'aria-label': 'Slowly', onclick: () => speakFree(text, whoId, true) }, '🐢'),
        !mine ? h('button', { class: 'btn tool ghost', type: 'button', title: 'Report', onclick: () => openReport({ kind: 'talk', id: 'ai', da: text, en }) }, '⚑') : null)));
    return { el: b, line: l };
  }
  note(el: HTMLElement) {
    return this.add(el);
  }
}

function modelBox(lines: Line[], label = ui('sayIt').da) {
  return h('div', { class: 'coach' }, h('b', {}, `💡 ${label}`), h('span', { class: 'en small' }, ` · ${ui('sayIt').en}`),
    lines.map((l) => h('div', { class: 'row', style: { marginTop: '4px' } }, sentence(l),
      h('button', { class: 'btn tool', type: 'button', 'aria-label': 'Listen', onclick: () => playLine(l) }, '🔊'))));
}

// ─── offline topic ──────────────────────────────────────────────────────────
async function runTopic(game: Game, t: TalkTopic) {
  const npc = C.npcs[t.npc];
  const view = new ChatView(t.title.da, `${t.title.en} · with ${npc.name}`, { skip: true });
  overlay.show(view.root);
  view.them(line(t.opener));
  const turns = t.turns.slice().sort(() => Math.random() - 0.5).slice(0, 4);
  let good = 0;
  for (const turn of turns) {
    if (view.closed) break;
    const r = await offlineTurn(view, turn);
    if (r === 'closed') break;
    if (r === 'ok') good++;
  }
  if (!view.closed) {
    view.them(line(t.closer));
    game.save.rel[t.npc] = Math.min(100, (game.save.rel[t.npc] ?? 20) + good * 2);
    view.note(h('div', { class: 'feedback good' }, h('h4', {}, `${good} / ${turns.length} answered in your own words`),
      h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, uiBtn('done', () => { stopAudio(); overlay.hide(); game.hud(); }, 'primary'))));
  } else {
    stopAudio();
    overlay.hide();
  }
  game.persist();
}

async function offlineTurn(view: ChatView, turn: TalkTurn): Promise<'ok' | 'miss' | 'closed'> {
  view.them(line(turn.ask));
  const models = turn.model.map((id) => line(id));
  let attempts = 0;
  let hints = 0;
  const known = Object.keys(C.forms);
  for (;;) {
    const a = await view.next();
    if (view.closed) return 'closed';
    if (a.kind === 'hint') {
      hints++;
      view.note(hints === 1 ? h('div', { class: 'coach' }, `💡 ${turn.hint}`) : modelBox(models));
      continue;
    }
    if (a.kind === 'skip' || a.kind === 'end') {
      view.note(modelBox(models));
      return 'miss';
    }
    const text = a.text.trim();
    if (!text) continue;
    view.clearInput();
    const mine = view.free(text, 'you', '', {}, true);
    attempts++;
    const c = coach(C.talk.coach, text);
    if (c) {
      const fix = c.fix ? freeLine(c.fix, 'you') : null;
      view.note(h('div', { class: 'coach' }, h('b', {}, '≈ '), c.why, fix ? h('div', { style: { marginTop: '4px' } }, sentence(fix)) : null));
      if (attempts >= 3) {
        view.note(modelBox(models));
        return 'miss';
      }
      continue;
    }
    const m = matchAny(turn.accept.map((x) => x.p), text, { ...C.talk.slots, name: C.names });
    if (m) {
      const react = turn.accept[m.index].react ?? turn.react;
      mine.el.classList.add('ok');
      view.note(h('div', { class: 'small', style: { alignSelf: 'flex-end', color: 'var(--green)', fontWeight: '800' } }, `✓ ${ui('correct').da}`));
      view.them(line(react));
      return 'ok';
    }
    const unknown = mine.line.unknown.filter((u) => !/^[A-ZÆØÅ]/.test(u));
    const tips = unknown.map((u) => {
      const s = suggest(u, known);
      return h('div', {}, h('b', { class: 'unknown' }, u), s.length ? ` — did you mean ${s.map((x) => `“${x}”`).join(' or ')}?` : ' — not a word I know yet.');
    });
    view.note(h('div', { class: 'coach' },
      h('b', {}, `${ui('wrong').da} `), h('span', { class: 'en small' }, 'I didn’t quite understand that as an answer.'),
      tips, attempts >= 2 ? null : h('div', { class: 'small' }, 'Try again, or press Hjælp for a hint.')));
    if (attempts >= 2) {
      view.note(modelBox(models));
      return 'miss';
    }
  }
}

// ─── AI conversation ────────────────────────────────────────────────────────
async function runAi(game: Game, npcId: string) {
  const npc = C.npcs[npcId];
  const chat = new AiChat(S.settings.aiKey, S.settings.aiModel, npc, levelOf(game.save.chapter), knownLemmas());
  const view = new ChatView(`Snak med ${npc.name}`, 'Open conversation · generated at your level', { skip: false });
  overlay.show(view.root);
  const thinking = () => view.note(h('div', { class: 'small muted' }, `${npc.name} skriver …`));
  const say = async (text: string | null) => {
    const dots = thinking();
    try {
      const t = await chat.send(text);
      dots.remove();
      return t;
    } catch (e) {
      dots.remove();
      view.note(h('div', { class: 'coach' }, `⚠ ${describeError(e)}`));
      return null;
    }
  };
  const first = await say(null);
  if (first) {
    view.free(first.reply_da, npcId, first.reply_en, Object.fromEntries(first.glossary.map((g) => [g.da, g.en])));
    void speakFree(first.reply_da, npcId);
  }
  for (;;) {
    const a = await view.next();
    if (view.closed || a.kind === 'end') break;
    if (a.kind === 'hint') {
      view.note(h('div', { class: 'coach' }, '💡 Answer the question in a short Danish sentence. Tap any word above to look it up; open the word bank for words you know.'));
      continue;
    }
    if (a.kind !== 'send' || !a.text.trim()) continue;
    const text = a.text.trim();
    view.clearInput();
    view.free(text, 'you', '', {}, true);
    const t = await say(text);
    if (!t) continue;
    if (!t.ok && t.corrected_da) {
      view.note(h('div', { class: 'coach' }, h('b', {}, '≈ Danes would say: '),
        sentence(freeLine(t.corrected_da, 'you')),
        h('button', { class: 'btn tool', type: 'button', 'aria-label': 'Listen', onclick: () => speakFree(t.corrected_da, 'you') }, '🔊'),
        h('div', { class: 'small' }, t.explanation_en)));
    }
    view.free(t.reply_da, npcId, t.reply_en, Object.fromEntries(t.glossary.map((g) => [g.da, g.en])));
    void speakFree(t.reply_da, npcId);
  }
  stopAudio();
  overlay.hide();
  game.relUp(npcId, 1);
  game.persist();
}

