import { C, cardWords, line, wordCount } from '../content';
import type { Chapter, Cond, Dir, Exercise, Line, Scene, ScriptNode } from '../content/types';
import { Input } from '../engine/input';
import { PLAYER_LOOKS } from '../engine/sprites';
import { World } from '../engine/world';
import { stopAudio } from '../audio/audio';
import {
  type BatchOpts, batch, dueCards, flush, getCard, grade, meetLine, sentenceId, wordId,
} from '../srs/deck';
import { type Card, State } from '../srs/fsrs';
import { today, writeSave } from '../store/save';
import { buildInPanel, choose, closeDialogue, exerciseSheet, feedback, showLine } from '../ui/dialogue';
import { h, overlay, panel, toast, ui, uiBtn, waitNext } from '../ui/dom';
import type { Result } from '../ui/exercise';
import { renderHud } from '../ui/hud';
import { showSpotlight } from '../ui/spotlight';
import { S } from './state';

const REL_STEP = 5;
const shuffle = <T,>(a: T[]) => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

export class Game {
  world: World;
  input: Input;
  private ctx: CanvasRenderingContext2D;
  busy = false;
  private sceneAdded: string[] = [];
  private last = 0;
  private saveTimer = 0;
  private started = false;
  onOpenTalk: (npc?: string) => void = () => {};

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.world = new World(PLAYER_LOOKS[S.save?.gender ?? 'f'], {
      bump: (x, y) => this.bump(x, y),
      step: (x, y) => this.step(x, y),
      interact: (x, y) => this.interact(x, y),
    });
    this.input = new Input(canvas);
    this.input.onInteract = () => {
      if (this.busy || this.world.busy) return;
      const [x, y] = this.world.facing();
      this.interact(x, y);
    };
    this.input.onTap = (cx, cy) => {
      if (this.busy) return;
      const [tx, ty] = this.world.screenToTile(cx, cy, canvas);
      const p = this.world.player;
      if (tx === p.x && ty === p.y) return;
      this.world.walkTo(tx, ty, this.interesting(tx, ty));
      document.querySelector('.hint-tap')?.remove();
    };
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  // ─── state helpers ────────────────────────────────────────────────────────
  get save() {
    return S.save!;
  }
  chapter(): Chapter {
    return C.chapters[this.save.chapter];
  }
  scene(): Scene | undefined {
    return this.chapter().scenes[this.save.scene];
  }
  chapterComplete() {
    return this.save.scene >= this.chapter().scenes.length;
  }
  cond(c: Cond): boolean {
    if (c.rel) return (this.save.rel[c.rel.npc] ?? 20) >= c.rel.gte;
    if (c.flag) {
      const v = this.save.flags[c.flag];
      return c.eq !== undefined ? v === c.eq : !!v;
    }
    return true;
  }
  met(npc: string) {
    return this.chapter().scenes.some((s) => s.cast[npc] && this.save.done.includes(s.id));
  }
  newAllowance() {
    const s = this.save;
    if (s.newToday.day !== today()) s.newToday = { day: today(), n: 0 };
    return Math.max(0, S.settings.newPerDay - s.newToday.n);
  }

  // ─── lifecycle ────────────────────────────────────────────────────────────
  async begin() {
    this.world.player.look = PLAYER_LOOKS[this.save.gender];
    this.loadMap(this.save.map, this.save.x, this.save.y, this.save.dir);
    if (!this.started) {
      this.started = true;
      requestAnimationFrame((t) => this.frame(t));
    }
    this.hud();
    if (!this.save.introDone) {
      await this.ui(async () => {
        await this.runNodes(this.chapter().intro, {});
        this.save.introDone = true;
      });
      document.body.append(h('div', { class: 'hint-tap' }, 'Tap to walk · tap people to talk · arrows + Space on a keyboard'));
      setTimeout(() => document.querySelector('.hint-tap')?.remove(), 12000);
    }
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = window.innerWidth, hgt = window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(hgt * dpr);
    this.world.resize(w, hgt, dpr);
  }

  private frame(t: number) {
    const dt = Math.min(0.05, (t - (this.last || t)) / 1000);
    this.last = t;
    if (this.world.map) {
      if (!this.busy) this.world.update(dt, this.input.dir());
      const dpr = this.canvas.width / Math.max(1, window.innerWidth);
      const panelEl = document.getElementById('panel')!;
      const bottom = panelEl.classList.contains('open') ? panelEl.getBoundingClientRect().height : 0;
      const hudEl = document.getElementById('hud')!;
      const top = hudEl.getBoundingClientRect().bottom;
      this.world.draw(this.ctx, this.canvas.width, this.canvas.height, top * dpr, bottom * dpr);
      this.saveTimer += dt;
      if (this.saveTimer > 8 && !this.busy) {
        this.saveTimer = 0;
        this.persist();
      }
    }
    requestAnimationFrame((n) => this.frame(n));
  }

  persist() {
    const p = this.world.player;
    Object.assign(this.save, { map: this.world.map.id, x: p.x, y: p.y, dir: p.dir });
    void writeSave(this.save);
    void flush();
  }

  /** Run a UI flow with the world paused. */
  async ui(fn: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true;
    this.input.enabled = false;
    this.input.clear();
    this.world.stop();
    try {
      await fn();
    } catch (e) {
      console.error(e);
      toast('Something went wrong — see console');
    } finally {
      stopAudio();
      closeDialogue();
      overlay.hide();
      this.busy = false;
      this.input.enabled = true;
      this.placeNpcs();
      this.hud();
      this.persist();
    }
  }

  hud() {
    renderHud({
      objective: this.objectiveLine(),
      due: dueCards().length,
      onReview: () => this.onOpenReview(),
      onTalk: () => this.onOpenTalk(),
      onSettings: () => this.onOpenSettings(),
      onObjective: this.chapterComplete() && !this.save.passed.includes(this.chapter().id) ? () => void this.runChapterTest() : undefined,
    });
    this.refreshMarkers();
  }
  onOpenReview: () => void = () => {};
  onOpenSettings: () => void = () => {};

  objectiveLine(): Line | undefined {
    const sc = this.scene();
    if (sc) return line(sc.objective);
    const ch = this.chapter();
    if (!this.save.passed.includes(ch.id)) {
      const last = [...ch.outro].reverse().find((n) => n.k === 'line');
      return last && last.k === 'line' ? line(last.line) : line('ui.chapterTest');
    }
    return line('ui.comingSoon');
  }

  // ─── map & npcs ───────────────────────────────────────────────────────────
  loadMap(id: string, x: number, y: number, dir: Dir) {
    const map = C.maps[id];
    this.world.setMap(map, x, y, dir, []);
    this.placeNpcs();
    this.save.map = id;
  }

  /** Where each NPC stands right now: home, overridden by the casts of reached scenes. */
  placeNpcs() {
    const ch = this.chapter();
    const upTo = Math.min(this.save.scene, ch.scenes.length - 1);
    const out: { id: string; look: any; x: number; y: number; dir: any }[] = [];
    for (const npc of Object.values(C.npcs)) {
      let spot = npc.home;
      let appears = false;
      for (let i = 0; i <= upTo; i++) {
        const c = ch.scenes[i].cast[npc.id];
        if (c) {
          spot = c;
          appears = true;
        }
      }
      if (!appears || !spot || spot.map !== this.world.map.id) continue;
      if (spot.when && !this.save.flags[spot.when]) continue;
      const prev = this.world.npcs.find((n) => n.id === npc.id);
      out.push({ id: npc.id, look: npc.look, x: spot.x, y: spot.y, dir: prev?.dir ?? spot.dir });
    }
    // keep entities stable where possible
    const p = this.world.player;
    this.world.npcs = out
      .filter((n) => !(n.x === p.x && n.y === p.y))
      .map((n) => ({ id: n.id, look: n.look, x: n.x, y: n.y, dir: n.dir, fromX: n.x, fromY: n.y, t: 1, walk: 0, marker: null }));
    this.refreshMarkers();
  }

  refreshMarkers() {
    const sc = this.scene();
    const due = dueCards().length;
    for (const n of this.world.npcs) {
      n.marker = sc?.start.npc === n.id ? 'talk' : due > 0 && this.met(n.id) ? 'review' : null;
    }
    this.world.mailboxMarker = due > 0 && this.save.mailDay !== today();
  }

  private interesting(x: number, y: number) {
    const m = this.world.map;
    return !!(this.world.npcAt(x, y) || m.signs.some((s) => s.x === x && s.y === y) ||
      m.warps.some((w) => w.x === x && w.y === y) || (m.mailbox && m.mailbox.x === x && m.mailbox.y === y));
  }

  // ─── world hooks ──────────────────────────────────────────────────────────
  private bump(x: number, y: number): boolean {
    if (this.busy) return false;
    const m = this.world.map;
    const warp = m.warps.find((w) => w.x === x && w.y === y);
    if (warp) {
      if (warp.needFlag && !this.save.flags[warp.needFlag]) {
        if (warp.locked) void this.ui(() => this.say(line(warp.locked!)));
        return true;
      }
      this.loadMap(warp.to, warp.tx, warp.ty, warp.dir);
      this.persist();
      const sc = this.scene();
      if (sc?.start.enterMap === warp.to) void this.runScene(sc);
      return true;
    }
    if (m.mailbox && m.mailbox.x === x && m.mailbox.y === y) {
      void this.mail();
      return true;
    }
    const sign = m.signs.find((s) => s.x === x && s.y === y);
    if (sign) {
      void this.ui(() => this.say(line(sign.line)));
      return true;
    }
    return false;
  }

  private step(x: number, y: number) {
    const sc = this.scene();
    if (!sc?.start.near || !sc.start.npc) return;
    const n = this.world.npcs.find((e) => e.id === sc.start.npc);
    if (n && Math.abs(n.x - x) + Math.abs(n.y - y) <= sc.start.near) void this.runScene(sc);
  }

  private interact(x: number, y: number) {
    if (this.busy) return;
    const n = this.world.npcAt(x, y);
    if (n) {
      void this.talkTo(n.id);
      return;
    }
    this.bump(x, y);
  }

  // ─── script interpreter ───────────────────────────────────────────────────
  private fresh(l: Line): Set<string> {
    return new Set(cardWords(l).filter((id) => !getCard(wordId(id))));
  }

  /** Show a line and record the exposure. */
  async say(l: Line) {
    const fresh = this.fresh(l);
    this.sceneAdded.push(...meetLine(l));
    if (C.npcs[l.who]) this.world.faceNpcToPlayer(l.who);
    await showLine(l, fresh);
  }

  relUp(npc: string | undefined, steps: number) {
    if (!npc || !steps) return;
    this.save.rel[npc] = Math.max(0, Math.min(100, (this.save.rel[npc] ?? 20) + steps * REL_STEP));
  }

  private gradeEx(ex: Exercise, r: Result) {
    const id = ex.type === 'tiles' || ex.line ? sentenceId(line(ex.type === 'tiles' ? ex.line : ex.line!)) : wordId(ex.word!);
    this.gradeCard(id, r);
  }
  private gradeCard(id: string, r: Result) {
    const before = getCard(id);
    if (!before) return;
    if (before.state === State.New) this.save.newToday.n++;
    grade(id, r.grade);
    this.save.stats.reviews++;
    if (r.correct) this.save.stats.correct++;
  }

  async runNodes(nodes: ScriptNode[], ctx: { npc?: string }): Promise<void> {
    for (const n of nodes) {
      switch (n.k) {
        case 'line':
          await this.say(line(n.line));
          break;
        case 'choice': {
          const used = new Set<number>();
          for (;;) {
            const i = await choose(n.opts, used);
            const o = n.opts[i];
            await this.say(line(o.line));
            if (o.q === 'wrong') {
              await feedback('wrong', o.why ?? '');
              used.add(i);
              continue;
            }
            if (o.q === 'awkward') await feedback('awkward', o.why ?? '');
            else this.relUp(ctx.npc, o.rel);
            if (o.set) Object.assign(this.save.flags, o.set);
            await this.runNodes(o.then, ctx);
            break;
          }
          break;
        }
        case 'build': {
          const l = line(n.line);
          this.sceneAdded.push(...meetLine(l));
          const r = await buildInPanel({ line: n.line, extra: n.extra, prompt: n.prompt, promptLine: n.promptLine, show: n.show });
          this.gradeCard(sentenceId(l), r);
          if (r.correct) this.relUp(ctx.npc, 1);
          break;
        }
        case 'ex': {
          const r = await exerciseSheet(n.ex);
          this.gradeEx(n.ex, r);
          break;
        }
        case 'spot': {
          const card = C.grammar[n.card];
          panel.hide();
          await showSpotlight(card);
          for (let i = 0; i < card.practice.length; i++) {
            const r = await exerciseSheet(card.practice[i], [i + 1, card.practice.length]);
            this.gradeEx(card.practice[i], r);
          }
          break;
        }
        case 'set':
          Object.assign(this.save.flags, n.flags);
          this.placeNpcs();
          break;
        case 'obj':
          break;
        case 'if':
          await this.runNodes(this.cond(n.cond) ? n.then : n.else, ctx);
          break;
      }
    }
  }

  // ─── scenes ───────────────────────────────────────────────────────────────
  async runScene(sc: Scene) {
    await this.ui(async () => {
      this.sceneAdded = [];
      if (sc.npc) this.world.faceNpcToPlayer(sc.npc);
      await this.runNodes(sc.script, { npc: sc.npc });
      await this.sceneDone(sc);
    });
  }

  private async sceneDone(sc: Scene) {
    this.save.done.push(sc.id);
    this.save.scene++;
    this.placeNpcs();
    this.persist();
    closeDialogue();
    const words = new Set(this.sceneAdded.filter((id) => id.startsWith('w:'))).size;
    const sents = new Set(this.sceneAdded.filter((id) => id.startsWith('s:'))).size;
    const go = uiBtn('review', () => {}, 'primary');
    overlay.show(h('div', { class: 'panel sheet', role: 'dialog' },
      h('div', { class: 'kicker' }, 'Scene klaret', h('span', { class: 'en' }, ' · Scene complete')),
      h('h2', { lang: 'da' }, `${ui('sceneDone').da} — ${sc.title.da}`),
      h('div', { class: 'muted' }, sc.title.en),
      h('div', { class: 'stat-grid' },
        h('div', { class: 'stat' }, h('b', {}, String(words)), 'new words'),
        h('div', { class: 'stat' }, h('b', {}, String(sents)), 'new sentences'),
        h('div', { class: 'stat' }, h('b', {}, `${this.chapter().scenes.indexOf(sc) + 1}/${this.chapter().scenes.length}`), 'scenes')),
      h('p', {}, 'Quick practice of what you just met — it goes into your spaced-repetition deck.'),
      h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, go)));
    go.focus();
    await waitNext(go);
    overlay.hide();
    await this.reviewSession({ max: 5, prefer: [...new Set(this.sceneAdded)], newAllowance: Math.max(3, this.newAllowance()) }, false);
    if (this.chapterComplete()) await this.chapterEnd();
  }

  private async chapterEnd() {
    await this.runNodes(this.chapter().outro, {});
    closeDialogue();
    const take = uiBtn('chapterTest', () => {}, 'primary');
    const later = h('button', { class: 'btn', type: 'button' }, 'Later');
    overlay.show(h('div', { class: 'panel sheet' },
      h('div', { class: 'kicker' }, `Kapitel ${this.chapter().n} · ${this.chapter().cefr}`),
      h('h2', {}, `${this.chapter().title.da} — ${ui('sceneDone').da}`),
      h('p', {}, `Pass the chapter test (${Math.round(this.chapter().passMark * 100)}%) to unlock the next chapter. You can take it any time from Practice (Øv).`),
      h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, later, take)));
    const choice = await Promise.race([
      new Promise<'take'>((r) => take.addEventListener('click', () => r('take'))),
      new Promise<'later'>((r) => later.addEventListener('click', () => r('later'))),
    ]);
    overlay.hide();
    if (choice === 'take') await this.chapterTest();
  }

  // ─── exercises from cards ─────────────────────────────────────────────────
  makeExercise(c: Card, allowTiles = true): Exercise {
    if (c.kind === 'w') return { type: 'listen', word: c.ref };
    const l = C.lines[c.ref];
    const n = wordCount(l);
    const hasName = l.tokens.some((t) => t.k === 'n');
    if (allowTiles && n >= 3 && n <= 7 && !hasName && Math.random() < 0.5) return { type: 'tiles', line: l.id, extra: [], accept: [] };
    return { type: 'listen', line: l.id };
  }

  /** A practice session on the review sheet. `standalone` shows a summary at the end. */
  async reviewSession(o: BatchOpts, standalone = true): Promise<void> {
    const cards = batch(o);
    if (!cards.length) {
      if (standalone) toast(`${ui('nothingDue').da} — ${ui('nothingDue').en}`);
      return;
    }
    let right = 0;
    for (let i = 0; i < cards.length; i++) {
      const ex = this.makeExercise(cards[i]);
      const r = await exerciseSheet(ex, [i + 1, cards.length]);
      this.gradeCard(cards[i].id, r);
      if (r.correct) right++;
    }
    this.persist();
    if (standalone) {
      const done = uiBtn('done', () => {}, 'primary');
      overlay.show(h('div', { class: 'panel sheet' },
        h('h2', {}, `${right} / ${cards.length} ${ui('correct').da.toLowerCase().replace('!', '')}`),
        h('p', { class: 'muted' }, 'Cards you missed come back in a few minutes; the rest are scheduled further out.'),
        h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, done)));
      await waitNext(done);
      overlay.hide();
    }
  }

  async practice() {
    await this.ui(() => this.reviewSession({ max: 10, newAllowance: this.newAllowance() }));
  }

  async chapterTest() {
    const ch = this.chapter();
    const lines = ch.scenes.flatMap((s) => collectLines(s.script)).map((id) => C.lines[id])
      .filter((l) => l.who !== 'narrator' && !l.tokens.some((t) => t.k === 'n'));
    const tiles = shuffle(lines.filter((l) => wordCount(l) >= 3 && wordCount(l) <= 6)).slice(0, 4);
    const listen = shuffle(lines.filter((l) => !tiles.includes(l))).slice(0, 3);
    const wordIds = [...new Set(lines.flatMap((l) => cardWords(l)))].filter((id) => C.lexicon[id].pos !== 'phrase');
    const words = shuffle(wordIds).slice(0, ch.testSize - tiles.length - listen.length);
    const items: Exercise[] = shuffle([
      ...tiles.map((l): Exercise => ({ type: 'tiles', line: l.id, extra: [], accept: [] })),
      ...listen.map((l): Exercise => ({ type: 'listen', line: l.id })),
      ...words.map((w): Exercise => ({ type: 'listen', word: w })),
    ]);
    let right = 0;
    for (let i = 0; i < items.length; i++) {
      const r = await exerciseSheet(items[i], [i + 1, items.length]);
      this.gradeEx(items[i], r);
      if (r.correct) right++;
    }
    const pass = right / items.length >= ch.passMark;
    if (pass && !this.save.passed.includes(ch.id)) this.save.passed.push(ch.id);
    const done = uiBtn(pass ? 'done' : 'tryAgain', () => {}, 'primary');
    const next = C.chapters[this.save.chapter + 1];
    overlay.show(h('div', { class: 'panel sheet' },
      h('div', { class: 'kicker' }, ui('chapterTest').da),
      h('h2', {}, pass ? `🎉 ${ui('passed').da}` : ui('notPassed').da),
      h('p', {}, `${right} / ${items.length} correct (you need ${Math.ceil(ch.passMark * items.length)}).`),
      pass ? h('p', {}, next ? `Chapter ${next.n} is unlocked.` : `Chapter 2 — ${ui('comingSoon').da} (Coming soon: groceries, the bakery and café ordering.)`) : null,
      h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, done)));
    await waitNext(done);
    overlay.hide();
    if (pass && next) {
      this.save.chapter++;
      this.save.scene = 0;
      this.save.introDone = false;
      await this.begin();
    }
  }

  async runChapterTest() {
    await this.ui(() => this.chapterTest());
  }

  // ─── NPC small talk & reviews woven into the world ────────────────────────
  async talkTo(id: string) {
    const sc = this.scene();
    if (sc && sc.start.npc === id) {
      await this.runScene(sc);
      return;
    }
    await this.ui(async () => {
      const npc = C.npcs[id];
      this.world.faceNpcToPlayer(id);
      const rel = this.save.rel[id] ?? 20;
      const pool = rel >= 60 ? npc.greet.high : rel >= 30 ? npc.greet.mid : npc.greet.low;
      await this.say(line(pool[Math.floor(Math.random() * pool.length)]));
      const due = batch({ max: 3, newAllowance: 0 });
      if (due.length) {
        // An NPC asks you something again: spaced repetition inside the world.
        await this.say(line(npc.review[0]));
        let right = 0;
        for (let i = 0; i < due.length; i++) {
          const r = await exerciseSheet(this.makeExercise(due[i]), [i + 1, due.length]);
          this.gradeCard(due[i].id, r);
          if (r.correct) right++;
        }
        await this.say(line(right >= due.length - 1 ? npc.praise[0] : npc.retry[0]));
        this.relUp(id, 1);
      } else {
        const idle = npc.idle.find((i) => !i.cond || this.cond(i.cond));
        if (idle) await this.say(line(idle.line));
      }
      const topics = Object.values(C.talk.topics).filter((t) => t.npc === id && this.save.done.includes(t.after));
      if (topics.length) {
        const chat = uiBtn('talk', () => {}, 'primary', h('span', { class: 'small' }, ' 💬'));
        const bye = uiBtn('bye', () => {});
        panel.show(h('div', { class: 'panel dlg' },
          h('p', { class: 'small muted', style: { margin: '0 0 8px' } }, `Chat freely with ${npc.name} — build your own sentences.`),
          h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, bye, chat)));
        const pick = await Promise.race([
          new Promise<boolean>((r) => chat.addEventListener('click', () => r(true))),
          new Promise<boolean>((r) => bye.addEventListener('click', () => r(false))),
        ]);
        if (pick) setTimeout(() => this.onOpenTalk(id), 0);
      }
    });
  }

  async mail() {
    await this.ui(async () => {
      if (this.save.mailDay === today()) {
        await this.say(line('ui.noMail'));
        return;
      }
      const cards = batch({ max: 8, newAllowance: Math.min(3, this.newAllowance()) });
      if (!cards.length) {
        await this.say(line('ui.noMail'));
        return;
      }
      await this.say(line('ui.mail'));
      this.save.mailDay = today();
      await this.reviewSession({ max: 8, newAllowance: Math.min(3, this.newAllowance()) });
    });
  }
}

function collectLines(nodes: ScriptNode[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    if (n.k === 'line' || n.k === 'build') out.push(n.line);
    if (n.k === 'choice') for (const o of n.opts) if (o.q === 'natural') out.push(o.line);
    if (n.k === 'choice') for (const o of n.opts) out.push(...collectLines(o.then));
    if (n.k === 'if') out.push(...collectLines(n.then), ...collectLines(n.else));
  }
  return [...new Set(out)];
}

