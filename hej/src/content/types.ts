// Shared content model. The build script (scripts/build-content.ts) compiles the
// YAML sources in /content into this shape; the game only ever reads the compiled form.

export interface Lang {
  da: string;
  en: string;
}

/** One token of a pre-tokenised sentence. */
export interface Token {
  /** Surface text exactly as written. */
  t: string;
  /** Kind: w = word, p = punctuation, n = player-name slot, num = digits. */
  k: 'w' | 'p' | 'n' | 'num';
  /** Lexicon entry id (lemma link). Always set for k = 'w'. */
  l?: string;
  /** Phrase entry id if this token is part of a multi-word expression. */
  p?: string;
  /** Meaning in this context, when it differs from the entry's default gloss. */
  c?: string;
  /** 1 if a space precedes this token. */
  s?: 0 | 1;
}

/**
 * Audio reference. A plain string is a clip key; a record maps a variant key to a clip
 * key. Variant keys: "f" / "m" (player voice), "|Alex" (player name), "f|Alex" (both).
 */
export type AudioRef = string | Record<string, string>;

export interface Line {
  id: string;
  who: string; // npc id, "you" or "narrator"
  da: string;
  en: string;
  /** "How it's actually said" note. */
  say?: string;
  tags: string[];
  tokens: Token[];
  audio: AudioRef;
  reviewed: boolean;
  /** Scene id where this line lives (or "npc:<id>", "sign:<map>", "ui"). */
  src: string;
}

export type Quality = 'natural' | 'ok' | 'awkward' | 'wrong';

export type Exercise =
  | {
      type: 'listen';
      line?: string;
      word?: string;
      /** Custom options (e.g. digits); answer must be one of them. */
      options?: string[];
      answer?: string;
    }
  | {
      type: 'tiles';
      line: string;
      extra: string[];
      /** Alternative accepted token orders (lower-case words only, no punctuation). */
      accept: string[][];
      prompt?: Lang;
    };

export interface Cond {
  flag?: string;
  eq?: string | number | boolean;
  rel?: { npc: string; gte: number };
}

export interface ChoiceOpt {
  line: string;
  q: Quality;
  why?: string;
  rel: number;
  set?: Record<string, string | number | boolean>;
  then: ScriptNode[];
}

export type ScriptNode =
  | { k: 'line'; line: string }
  | { k: 'choice'; opts: ChoiceOpt[] }
  | { k: 'build'; line: string; extra: string[]; prompt?: Lang; promptLine?: string; show?: string }
  | { k: 'ex'; ex: Exercise }
  | { k: 'spot'; card: string }
  | { k: 'set'; flags: Record<string, string | number | boolean> }
  | { k: 'obj'; line: string }
  | { k: 'if'; cond: Cond; then: ScriptNode[]; else: ScriptNode[] };

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface CastSpot {
  map: string;
  x: number;
  y: number;
  dir: Dir;
  /** Only present while this flag is truthy. */
  when?: string;
}

export interface Scene {
  id: string;
  title: Lang;
  objective: string; // line id
  /** Main NPC (relationship target, dialogue focus). */
  npc?: string;
  start: { npc?: string; near?: number; enterMap?: string };
  cast: Record<string, CastSpot>;
  script: ScriptNode[];
}

export interface Chapter {
  id: string;
  n: number;
  cefr: string;
  title: Lang;
  passMark: number;
  testSize: number;
  intro: ScriptNode[];
  scenes: Scene[];
  outro: ScriptNode[];
}

export type Pos =
  | 'noun' | 'verb' | 'adj' | 'adv' | 'pron' | 'prep' | 'conj' | 'interj'
  | 'num' | 'art' | 'name' | 'phrase' | 'part';

export interface LexEntry {
  id: string;
  lemma: string;
  pos: Pos;
  en: string;
  /** en / et for nouns. */
  g?: 'en' | 'et';
  /** Named inflections, e.g. def, pl, defpl, pres, past, perf, imp, t, e, obj, poss. */
  forms: Record<string, string>;
  say?: string;
  note?: string;
  /** Approximate frequency rank in spoken/written Danish (1 = most common). */
  rank?: number;
  /** Numeric value for numbers. */
  value?: number;
  audio: string;
  /** Lower-case surface form → clip key. */
  formAudio: Record<string, string>;
}

export interface GrammarCard {
  id: string;
  title: Lang;
  pattern: string;
  rule: string;
  /** What to highlight in the examples: the finite verb, or definite noun forms. */
  highlight?: 'verb' | 'definite';
  examples: string[]; // line ids
  practice: Exercise[];
}

export interface Look {
  skin: string;
  hair: string;
  style: 'short' | 'long' | 'bun' | 'cap' | 'bald' | 'curly' | 'bob';
  shirt: string;
  pants: string;
  accent?: string;
}

export interface Npc {
  id: string;
  name: string;
  role: Lang;
  register: string;
  voice: string;
  look: Look;
  home?: CastSpot;
  greet: { low: string[]; mid: string[]; high: string[] };
  /** Conditional small-talk lines, first matching wins. */
  idle: { cond?: Cond; line: string }[];
  review: string[];
  praise: string[];
  retry: string[];
}

export interface SignDef {
  x: number;
  y: number;
  line: string;
}

export interface WarpDef {
  x: number;
  y: number;
  to: string;
  tx: number;
  ty: number;
  dir: Dir;
  needFlag?: string;
  locked?: string; // line id
}

export interface MapDef {
  id: string;
  name: Lang;
  w: number;
  h: number;
  /** Row-major tile names. */
  tiles: string[];
  spawn: { x: number; y: number; dir: Dir };
  signs: SignDef[];
  warps: WarpDef[];
  mailbox?: { x: number; y: number };
}

export interface UiString {
  da: string;
  en: string;
  audio: string;
}

export interface VoiceDef {
  name: string;
  gender: 'f' | 'm';
  rate: number;
  slowRate: number;
  /** speechSynthesis fallback shaping. */
  pitch: number;
}

/** Free-conversation ("Snak") turn for the offline conversation engine. */
export interface TalkTurn {
  id: string;
  hint: string;
  /** NPC question (line id, voiced by the topic's NPC). */
  ask: string;
  /** Accepted answer patterns (see src/talk/match.ts) with optional specific reactions. */
  accept: { p: string; react?: string }[];
  /** Default reaction (line id). */
  react: string;
  /** Model answers (player line ids). */
  model: string[];
}

export interface TalkTopic {
  id: string;
  npc: string;
  ch: number;
  /** Scene id that must be completed first. */
  after: string;
  title: Lang;
  opener: string;
  closer: string;
  turns: TalkTurn[];
}

export interface CoachRule {
  re: string;
  why: string;
  fix?: string;
}

export interface Content {
  version: string;
  chapters: Chapter[];
  lines: Record<string, Line>;
  lexicon: Record<string, LexEntry>;
  grammar: Record<string, GrammarCard>;
  npcs: Record<string, Npc>;
  maps: Record<string, MapDef>;
  ui: Record<string, UiString>;
  voices: Record<string, VoiceDef>;
  names: string[];
  nameAudio: Record<string, string>;
  talk: { topics: Record<string, TalkTopic>; slots: Record<string, string[]>; coach: CoachRule[] };
  /** lower-case surface form → lexicon ids (for tokenising runtime text). */
  forms: Record<string, string[]>;
  ambiguous: Record<string, string>;
}
