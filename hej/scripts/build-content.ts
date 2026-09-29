// Compiles /content/*.yaml into src/generated/content.json (the only thing the game reads)
// and src/generated/clips.json (every piece of text that needs audio, for scripts/tts.ts).
//
// It also validates: every word must resolve to a lexicon entry, every reference must
// exist, maps must be well-formed. Problems are errors (build fails); pedagogy checks
// (recycling, frequency) go to content/REPORT.md.
//
//   npm run content

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { resolve as resolveTokens, type ResolveCtx } from '../src/content/tokenize.ts';
import { TILES } from '../src/engine/tiledefs.ts';
import type {
  AudioRef, Chapter, ChoiceOpt, CoachRule, Content, Exercise, GrammarCard, LexEntry, Line, MapDef,
  Npc, Scene, ScriptNode, TalkTopic, TalkTurn, UiString, VoiceDef,
} from '../src/content/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = (p: string) => join(ROOT, 'content', p);
const load = (p: string): any => YAML.parse(readFileSync(p, 'utf8'));

const errors: string[] = [];
const warnings: string[] = [];
const err = (m: string) => errors.push(m);

// ─── voices & clip keys ──────────────────────────────────────────────────────
const voiceSrc = load(C('voices.yaml'));
const PROVIDER: string = voiceSrc.provider;
const voices: Record<string, VoiceDef> = {};
for (const [id, v] of Object.entries<any>(voiceSrc.voices)) {
  voices[id] = {
    name: v.name,
    gender: v.gender,
    rate: v.rate ?? voiceSrc.defaults.rate,
    slowRate: v.slowRate ?? voiceSrc.defaults.slowRate,
    pitch: v.pitch ?? 1,
  };
}

interface Clip { key: string; text: string; voice: string; slow: boolean }
const clips = new Map<string, Clip>();

/** Clip key = hash of everything that affects the audio, so edits regenerate only that clip. */
function clip(text: string, voiceId: string, slow: boolean): string {
  const v = voices[voiceId];
  if (!v) {
    err(`unknown voice "${voiceId}"`);
    return 'missing';
  }
  const key = createHash('sha1')
    .update(JSON.stringify([PROVIDER, v.name, v.rate, slow ? v.slowRate : 0, text]))
    .digest('hex')
    .slice(0, 16);
  const prev = clips.get(key);
  clips.set(key, { key, text, voice: voiceId, slow: slow || !!prev?.slow });
  return key;
}

// ─── lexicon ─────────────────────────────────────────────────────────────────
const lexSrc = load(C('lexicon.yaml'));
const lexicon: Record<string, LexEntry> = {};
const forms: Record<string, string[]> = {};
const numbers: Record<number, string> = {};
const phrases: ResolveCtx['phrases'] = {};
const addForm = (form: string, id: string) => {
  const k = form.toLowerCase();
  const list = (forms[k] ??= []);
  if (!list.includes(id)) list.push(id);
};
for (const [id, e] of Object.entries<any>(lexSrc.entries)) {
  const lemma: string = e.lemma ?? id.split('#')[0];
  const f: Record<string, string> = {};
  for (const [k, v] of Object.entries<any>(e.forms ?? {})) f[k] = String(v);
  const entry: LexEntry = {
    id, lemma, pos: e.pos, en: String(e.en), forms: f,
    audio: clip(lemma, 'narrator', false), formAudio: {},
  };
  if (e.g) entry.g = e.g;
  if (e.say) entry.say = e.say;
  if (e.note) entry.note = e.note;
  if (e.rank) entry.rank = e.rank;
  if (e.value !== undefined) {
    entry.value = e.value;
    numbers[e.value] ??= id;
  }
  if (!e.pos) err(`lexicon ${id}: missing pos`);
  if (e.pos === 'noun' && !e.g) err(`lexicon ${id}: noun without en/et`);
  if (e.pos === 'phrase') {
    const words = lemma.toLowerCase().split(/\s+/);
    (phrases[words[0]] ??= []).push([id, words]);
    for (const m of e.match ?? []) {
      const mw = String(m).toLowerCase().split(/\s+/);
      (phrases[mw[0]] ??= []).push([id, mw]);
    }
  } else {
    addForm(lemma, id);
    for (const [fk, v] of Object.entries(f)) {
      if (fk === 'aux') continue;
      for (const part of v.split('/')) {
        const w = part.trim().replace(/^(at|har|er) /, '');
        if (!w || w.includes(' ')) continue;
        addForm(w, id);
        if (w.toLowerCase() !== lemma.toLowerCase()) entry.formAudio[w.toLowerCase()] = clip(w, 'narrator', false);
      }
    }
    for (const x of e.also ?? []) addForm(String(x), id);
  }
  lexicon[id] = entry;
}
const ambiguous: Record<string, string> = lexSrc.ambiguous ?? {};
for (const [form, id] of Object.entries(ambiguous)) if (!lexicon[id]) err(`ambiguous default ${form} → unknown entry ${id}`);
const rctx: ResolveCtx = { forms, ambiguous, numbers, phrases };

// ─── lines ───────────────────────────────────────────────────────────────────
const npcSrc = load(C('npcs.yaml'));
const NAMES: string[] = npcSrc.names;
const lines: Record<string, Line> = {};
const META = new Set(['en', 'say', 'id', 'tags', 'lx', 'ctx', 'reviewed', 'q', 'why', 'rel', 'set', 'then',
  'tts', 'extra', 'prompt', 'show', 'accept', 'cond', 'x', 'y', 'da']);
const speakers = new Set(['you', 'narrator', ...Object.keys(npcSrc.npcs)]);
const counters: Record<string, number> = {};

function speakerOf(o: any): [string, string] | null {
  for (const k of Object.keys(o)) if (!META.has(k) && speakers.has(k)) return [k, String(o[k])];
  return null;
}

function audioFor(da: string, who: string, tts?: string): AudioRef {
  const text = tts ?? da;
  const slow = who !== 'ui';
  const voiceIds = who === 'you' ? { f: 'you_f', m: 'you_m' } : null;
  const hasName = text.includes('{name}');
  const npcVoice = who === 'ui' ? 'narrator' : who === 'narrator' ? 'narrator' : npcSrc.npcs[who]?.voice ?? who;
  if (!voiceIds && !hasName) return clip(text, npcVoice, slow);
  const out: Record<string, string> = {};
  const gs = voiceIds ? (['f', 'm'] as const) : ([''] as const);
  const ns = hasName ? NAMES : [''];
  for (const g of gs) for (const n of ns) {
    const t = text.replaceAll('{name}', n);
    const v = g ? voiceIds![g] : npcVoice;
    out[hasName ? `${g}|${n}` : g] = clip(t, v, slow);
  }
  return out;
}

/** Register a line. `o` is either `{<speaker>: text, ...}` or `{da, en, ...}` with `who`. */
function addLine(src: string, o: any, who?: string, forcedId?: string): string {
  let da: string;
  if (who) da = String(o.da);
  else {
    const sp = speakerOf(o);
    if (!sp) {
      err(`${src}: line has no speaker: ${JSON.stringify(o)}`);
      return 'missing';
    }
    [who, da] = sp;
  }
  if (o.en === undefined) err(`${src}: "${da}" has no English`);
  counters[src] = (counters[src] ?? 0) + 1;
  const id: string = forcedId ?? o.id ?? `${src}.${String(counters[src]).padStart(2, '0')}`;
  if (lines[id]) {
    // identical text under the same id (e.g. shared sign) is fine
    if (lines[id].da !== da) err(`duplicate line id ${id}`);
    return id;
  }
  const lxRaw: Record<string, string> = o.lx ?? {};
  for (const target of Object.values(lxRaw)) if (!lexicon[target]) err(`${id}: lx → unknown entry "${target}"`);
  const r = resolveTokens(da, rctx, lxRaw, o.ctx ?? {});
  for (const u of r.unknown) err(`${id}: unknown word "${u}" in "${da}"`);
  for (const a of r.ambiguous) err(`${id}: ambiguous "${a.word}" (${a.options.join(' / ')}) in "${da}" — add lx`);
  lines[id] = {
    id, who: who!, da, en: String(o.en ?? ''), tags: o.tags ?? [], tokens: r.tokens,
    audio: audioFor(da, who!, o.tts), reviewed: o.reviewed === true, src,
  };
  if (o.say) lines[id].say = o.say;
  return id;
}

// ─── exercises & script nodes ────────────────────────────────────────────────
const lineRefs: { from: string; id: string }[] = [];
function compileExercise(from: string, e: any): Exercise {
  if (e.type === 'listen') {
    const ex: Exercise = { type: 'listen' };
    if (e.line) { ex.line = e.line; lineRefs.push({ from, id: e.line }); }
    if (e.word) ex.word = e.word;
    if (e.options) { ex.options = e.options.map(String); ex.answer = String(e.answer); }
    if (ex.options && !ex.options.includes(ex.answer!)) err(`${from}: listen answer not among options`);
    return ex;
  }
  if (e.type === 'tiles') {
    lineRefs.push({ from, id: e.line });
    return {
      type: 'tiles', line: e.line, extra: (e.extra ?? []).map(String),
      accept: (e.accept ?? []).map((a: string) => a.toLowerCase().split(/\s+/)),
      ...(e.prompt ? { prompt: e.prompt } : {}),
    };
  }
  err(`${from}: unknown exercise type ${e.type}`);
  return { type: 'listen' };
}

function compileNodes(src: string, list: any[]): ScriptNode[] {
  const out: ScriptNode[] = [];
  for (const n of list ?? []) {
    if (n.choose) {
      const opts: ChoiceOpt[] = n.choose.map((o: any) => {
        if (!o.you) err(`${src}: choice option must be spoken by "you"`);
        const opt: ChoiceOpt = {
          line: addLine(src, o),
          q: o.q ?? 'natural',
          rel: o.rel ?? (o.q === 'natural' || !o.q ? 1 : 0),
          then: compileNodes(src, o.then ?? []),
        };
        if (o.why) opt.why = o.why;
        if (o.set) opt.set = o.set;
        if (opt.q !== 'natural' && opt.q !== 'ok' && !opt.why) err(`${src}: ${opt.q} option without "why"`);
        return opt;
      });
      if (!opts.some((o) => o.q === 'natural' || o.q === 'ok')) err(`${src}: choice with no acceptable option`);
      out.push({ k: 'choice', opts });
    } else if (n.build) {
      const b = n.build;
      const node: ScriptNode = { k: 'build', line: addLine(src, b), extra: (b.extra ?? []).map(String) };
      if (b.prompt) {
        node.prompt = { da: b.prompt.da, en: b.prompt.en };
        node.promptLine = addLine(src + '.prompt', b.prompt, 'narrator');
      }
      if (b.show) node.show = String(b.show);
      out.push(node);
    } else if (n.exercise) {
      out.push({ k: 'ex', ex: compileExercise(src, n.exercise) });
    } else if (n.spotlight) {
      out.push({ k: 'spot', card: n.spotlight });
    } else if (n.set) {
      out.push({ k: 'set', flags: n.set });
    } else if (n.objective) {
      out.push({ k: 'obj', line: addLine(src + '.obj', n.objective, 'narrator') });
    } else if (n.if) {
      out.push({ k: 'if', cond: n.if, then: compileNodes(src, n.then ?? []), else: compileNodes(src, n.else ?? []) });
    } else {
      out.push({ k: 'line', line: addLine(src, n) });
    }
  }
  return out;
}

// ─── npcs ────────────────────────────────────────────────────────────────────
const npcs: Record<string, Npc> = {};
for (const [id, n] of Object.entries<any>(npcSrc.npcs)) {
  const src = `npc.${id}`;
  const L = (arr: any[]) => (arr ?? []).map((o) => addLine(src, o));
  npcs[id] = {
    id, name: n.name, role: n.role, register: n.register, voice: n.voice, look: n.look,
    greet: { low: L(n.greet.low), mid: L(n.greet.mid), high: L(n.greet.high) },
    idle: (n.idle ?? []).map((o: any) => ({ ...(o.cond ? { cond: o.cond } : {}), line: addLine(src, o) })),
    review: L(n.review), praise: L(n.praise), retry: L(n.retry),
  };
  if (n.home) npcs[id].home = n.home;
  if (!voices[n.voice]) err(`${src}: unknown voice ${n.voice}`);
}
const nameAudio: Record<string, string> = {};
for (const n of NAMES) nameAudio[n] = clip(n, 'narrator', false);

// ─── ui strings ──────────────────────────────────────────────────────────────
const ui: Record<string, UiString> = {};
for (const [k, v] of Object.entries<any>(load(C('ui.yaml')).ui)) {
  const id = addLine('ui', { da: String(v.da), en: v.en }, 'ui', `ui.${k}`);
  ui[k] = { da: String(v.da), en: v.en, audio: lines[id].audio as string };
}

// ─── maps ────────────────────────────────────────────────────────────────────
const maps: Record<string, MapDef> = {};
for (const f of readdirSync(C('maps')).filter((f) => f.endsWith('.yaml')).sort()) {
  const m = load(C(`maps/${f}`));
  const rows: string[] = String(m.tiles).replace(/\n+$/, '').split('\n');
  const w = rows[0].length;
  const tiles: string[] = [];
  rows.forEach((row, y) => {
    if ([...row].length !== w) err(`map ${m.id}: row ${y} has length ${[...row].length}, expected ${w}`);
    for (const ch of row) {
      const name = m.legend[ch];
      if (!name || !TILES[name]) err(`map ${m.id}: unknown tile char "${ch}" (${name})`);
      tiles.push(name ?? 'grass');
    }
  });
  const src = `sign.${m.id}`;
  maps[m.id] = {
    id: m.id, name: m.name, w, h: rows.length, tiles, spawn: m.spawn,
    signs: (m.signs ?? []).map((s: any) => ({ x: s.x, y: s.y, line: addLine(src, s, 'narrator') })),
    warps: (m.warps ?? []).map((wp: any) => {
      const out: any = { x: wp.x, y: wp.y, to: wp.to, tx: wp.tx, ty: wp.ty, dir: wp.dir };
      if (wp.needFlag) out.needFlag = wp.needFlag;
      if (wp.locked) out.locked = addLine(src, wp.locked, 'narrator');
      return out;
    }),
  };
  if (m.mailbox) maps[m.id].mailbox = m.mailbox;
}
const solidAt = (mapId: string, x: number, y: number) => {
  const m = maps[mapId];
  if (!m || x < 0 || y < 0 || x >= m.w || y >= m.h) return true;
  return TILES[m.tiles[y * m.w + x]]?.solid ?? true;
};
for (const m of Object.values(maps)) {
  for (const wp of m.warps) {
    if (!maps[wp.to]) err(`map ${m.id}: warp to unknown map ${wp.to}`);
    else if (solidAt(wp.to, wp.tx, wp.ty)) err(`map ${m.id}: warp target ${wp.to} ${wp.tx},${wp.ty} is solid`);
  }
  if (solidAt(m.id, m.spawn.x, m.spawn.y)) err(`map ${m.id}: spawn is solid`);
}
for (const n of Object.values(npcs)) {
  if (n.home && solidAt(n.home.map, n.home.x, n.home.y)) err(`npc ${n.id}: home is on a solid tile`);
}

// ─── grammar cards ───────────────────────────────────────────────────────────
const grammar: Record<string, GrammarCard> = {};
for (const [id, g] of Object.entries<any>(load(C('grammar.yaml')).cards)) {
  grammar[id] = {
    id, title: g.title, pattern: g.pattern, rule: g.rule, examples: g.examples, highlight: g.highlight,
    practice: (g.practice ?? []).map((e: any) => compileExercise(`grammar.${id}`, e)),
  };
  for (const ex of g.examples) lineRefs.push({ from: `grammar.${id}`, id: ex });
  addLine('grammar', { da: g.title.da, en: g.title.en }, 'narrator', `grammar.${id}.title`);
}

// ─── chapters ────────────────────────────────────────────────────────────────
const chapters: Chapter[] = [];
for (const f of readdirSync(C('chapters')).filter((f) => f.endsWith('.yaml')).sort()) {
  const ch = load(C(`chapters/${f}`));
  const scenes: Scene[] = ch.scenes.map((s: any) => {
    const src = `${ch.id}.${s.id}`;
    const scene: Scene = {
      id: src, title: s.title,
      objective: addLine(src + '.obj', s.objective, 'narrator'),
      start: s.start, cast: s.cast ?? {}, script: compileNodes(src, s.script),
    };
    if (s.npc) scene.npc = s.npc;
    for (const [npc, spot] of Object.entries(scene.cast)) {
      if (!npcs[npc]) err(`${src}: cast has unknown npc ${npc}`);
      if (solidAt(spot.map, spot.x, spot.y)) err(`${src}: ${npc} placed on solid tile ${spot.map} ${spot.x},${spot.y}`);
    }
    return scene;
  });
  chapters.push({
    id: ch.id, n: ch.n, cefr: ch.cefr, title: ch.title, passMark: ch.passMark ?? 0.8, testSize: ch.testSize ?? 10,
    intro: compileNodes(`${ch.id}.intro`, ch.intro ?? []), scenes,
    outro: compileNodes(`${ch.id}.outro`, ch.outro ?? []),
  });
}
chapters.sort((a, b) => a.n - b.n);

// ─── talk (free conversation) ────────────────────────────────────────────────
const talkSrc = load(C('talk.yaml'));
const topics: Record<string, TalkTopic> = {};
for (const [tid, t] of Object.entries<any>(talkSrc.topics)) {
  const src = `talk.${tid}`;
  const npcLine = (o: any, suffix: string) => addLine(src, { [t.npc]: o.da, en: o.en, say: o.say }, undefined, `${src}.${suffix}`);
  const turns: TalkTurn[] = t.turns.map((turnId: string) => {
    const tt = talkSrc.turns[turnId];
    if (!tt) {
      err(`${src}: unknown turn ${turnId}`);
      return null;
    }
    return {
      id: turnId, hint: tt.hint,
      ask: npcLine(tt.ask, `${turnId}.ask`),
      accept: tt.accept.map((a: any, i: number) => ({
        p: a.p, ...(a.react ? { react: npcLine(a.react, `${turnId}.r${i}`) } : {}),
      })),
      react: npcLine(tt.react, `${turnId}.react`),
      model: tt.model.map((m: any, i: number) => addLine(src, { you: m.da, en: m.en }, undefined, `talk.${turnId}.model${i}`)),
    };
  }).filter(Boolean);
  topics[tid] = {
    id: tid, npc: t.npc, ch: t.ch, after: `ch${t.ch}.${t.after}`, title: t.title,
    opener: npcLine(t.opener, 'opener'), closer: npcLine(t.closer, 'closer'), turns,
  };
  if (!npcs[t.npc]) err(`${src}: unknown npc ${t.npc}`);
}
const coach: CoachRule[] = talkSrc.coach ?? [];
for (const c of coach) {
  try { new RegExp(c.re); } catch { err(`talk coach: bad regex ${c.re}`); }
}
const slots: Record<string, string[]> = talkSrc.slots ?? {};
for (const [slot, words] of Object.entries(slots)) for (const w of words) {
  if (!forms[w.toLowerCase()]) err(`talk slot ${slot}: "${w}" is not in the lexicon`);
}

// ─── reference checks ────────────────────────────────────────────────────────
for (const r of lineRefs) if (!lines[r.id]) err(`${r.from}: unknown line ${r.id}`);
const cardIds = new Set<string>();
for (const ch of chapters) for (const sc of ch.scenes) {
  const heard: string[] = [];
  const walk = (nodes: ScriptNode[]) => {
    for (const n of nodes) {
      if (n.k === 'line') heard.push(n.line);
      if (n.k === 'choice') for (const o of n.opts) { heard.push(o.line); walk(o.then); }
      if (n.k === 'build') heard.push(n.line);
      if (n.k === 'if') { walk(n.then); walk(n.else); }
      if (n.k === 'ex' && n.ex.type === 'tiles') checkTiles(sc.id, n.ex.line);
      if (n.k === 'spot') {
        const card = grammar[n.card];
        if (!card) { err(`${sc.id}: unknown grammar card ${n.card}`); continue; }
        if (cardIds.has(n.card)) warnings.push(`${sc.id}: spotlight ${n.card} shown more than once`);
        cardIds.add(n.card);
        for (const ex of card.examples) if (!heard.includes(ex)) err(`${sc.id}: spotlight ${n.card} example ${ex} not heard earlier in this scene`);
        for (const p of card.practice) if (p.type === 'tiles') checkTiles(`grammar.${n.card}`, p.line);
      }
    }
  };
  walk(sc.script);
}
function checkTiles(from: string, id: string) {
  const l = lines[id];
  if (!l) return;
  const n = l.tokens.filter((t) => t.k !== 'p').length;
  if (n < 2 || n > 10) err(`${from}: tiles exercise on ${id} needs 2–10 words (has ${n})`);
}

if (errors.length) {
  console.error(`\n✗ content has ${errors.length} error(s):\n` + errors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
}

// ─── pedagogy report: recycling & frequency ─────────────────────────────────
// Order of exposure: chapter intro → each scene (script, then NPC lines unlocked by it,
// then talk topics unlocked by it) → outro.
const order: string[] = [];
const pushScript = (nodes: ScriptNode[]) => {
  for (const n of nodes) {
    if (n.k === 'line' || n.k === 'build' || n.k === 'obj') order.push(n.line);
    if (n.k === 'choice') for (const o of n.opts) { order.push(o.line); pushScript(o.then); }
    if (n.k === 'if') { pushScript(n.then); pushScript(n.else); }
  }
};
const firstScene: Record<string, string> = {};
for (const ch of chapters) {
  pushScript(ch.intro);
  for (const sc of ch.scenes) {
    const before = order.length;
    order.push(sc.objective);
    pushScript(sc.script);
    for (const npc of Object.keys(sc.cast)) {
      const n = npcs[npc];
      if (!n || (firstScene[npc] && firstScene[npc] !== sc.id)) continue;
      firstScene[npc] = sc.id;
      order.push(...n.greet.low, ...n.greet.mid, ...n.greet.high, ...n.idle.map((i) => i.line), ...n.review, ...n.praise, ...n.retry);
    }
    for (const t of Object.values(topics)) if (t.after === sc.id) {
      order.push(t.opener, ...t.turns.flatMap((x) => [x.ask, x.react, ...x.accept.flatMap((a) => (a.react ? [a.react] : [])), ...x.model]), t.closer);
    }
    void before;
  }
  pushScript(ch.outro);
}
const firstSeen: Record<string, number> = {};
const contexts: Record<string, Set<string>> = {};
order.forEach((id, i) => {
  const l = lines[id];
  if (!l) return;
  for (const t of l.tokens) {
    if (!t.l || t.k !== 'w') continue;
    firstSeen[t.l] ??= i;
    (contexts[t.l] ??= new Set()).add(l.da.toLowerCase());
  }
});
const recycle: string[] = [];
const lateRank: string[] = [];
for (const [id, set] of Object.entries(contexts)) {
  const e = lexicon[id];
  if (e.pos === 'name') continue;
  if (set.size < 5) recycle.push(`| ${e.lemma} | ${e.pos} | ${set.size} | ${e.rank ?? '–'} |`);
  if (!e.rank) lateRank.push(`| ${e.lemma} | no rank |`);
  else if (e.rank > 3000) lateRank.push(`| ${e.lemma} | ${e.rank} |`);
}
const unusedLex = Object.values(lexicon).filter((e) => !contexts[e.id] && e.pos !== 'phrase').map((e) => e.lemma);
const allLines = Object.values(lines).filter((l) => l.src !== 'ui');
const report = `# Content report

Generated by \`npm run content\`. Do not edit by hand.

- Lines: **${allLines.length}** (${allLines.filter((l) => l.reviewed).length} reviewed by a native speaker)
- Lexicon entries: **${Object.keys(lexicon).length}** · distinct lemmas used: **${Object.keys(contexts).length}**
- Audio clips needed: **${clips.size}**

## Recycling

Rule: every word should reappear in at least 5 different sentences. Words below that
(many are introduced late in Chapter 1 and are scheduled to recur in Chapters 2–3):

| word | pos | contexts so far | rank |
|---|---|---|---|
${recycle.sort().join('\n')}

## Frequency

Words with an approximate frequency rank above 3000, or no rank yet:

| word | rank |
|---|---|
${lateRank.sort().join('\n')}

## Lexicon entries not yet used in any sentence

${unusedLex.sort().join(', ') || '(none)'}

${warnings.length ? '## Warnings\n\n' + warnings.map((w) => `- ${w}`).join('\n') : ''}
`;

// ─── write ───────────────────────────────────────────────────────────────────
const content: Content = {
  version: createHash('sha1').update(JSON.stringify([lines, lexicon])).digest('hex').slice(0, 10),
  chapters, lines, lexicon, grammar, npcs, maps, ui, voices, names: NAMES, nameAudio,
  talk: { topics, slots, coach }, forms, ambiguous,
};
mkdirSync(join(ROOT, 'src/generated'), { recursive: true });
writeFileSync(join(ROOT, 'src/generated/content.json'), JSON.stringify(content));
writeFileSync(join(ROOT, 'src/generated/clips.json'), JSON.stringify({ provider: PROVIDER, voices, clips: [...clips.values()] }, null, 1));
writeFileSync(C('REPORT.md'), report);
console.log(`✓ content: ${allLines.length} lines, ${Object.keys(lexicon).length} lexicon entries, ${clips.size} audio clips, ${recycle.length} words below the recycling target (see content/REPORT.md)`);
if (warnings.length) console.log(warnings.map((w) => '  ! ' + w).join('\n'));
