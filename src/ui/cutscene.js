// Cutscene modal: runs an event script (systems/script.js) against the live game. Dialogue boxes
// are pushed above it; villagers walk, the camera pans and the screen fades while it waits.
import { TILE } from '../config.js';
import { parseScript, ScriptRunner } from '../systems/script.js';
import { itemDef } from '../data/items.js';
import { EMOTE_ALIAS } from '../art/emotes.js';
import { rect } from './widgets.js';
import { Dialog } from './dialog.js';
import { IaiDuel } from './iai.js';
import { RhythmGame } from './rhythm.js';
import { HaikuComposer } from './haiku.js';
import { Rng } from '../core/rng.js';
import { t } from '../data/strings.js';
import { bestCrop, judgeGrade } from '../systems/festivals.js';
import { speak, bondOf } from '../world/talk.js';
import { addBond } from '../systems/bonds.js';

export class Cutscene {
  constructor(game, source, { onEnd = null } = {}) {
    this.game = game;
    this.runner = new ScriptRunner(this, parseScript(source));
    this.onEnd = onEnd;
    this.fadeA = 0;
    this.fadeTo = null;       // { from, to, t, dur, handle }
    this.panTo = null;        // { x0, y0, x1, y1, t, dur, handle }
    this.lastText = '';
    this.moved = new Set();
    this.fw = null;           // { t, dur, next, bursts, rng, handle } while fireworks go up
  }

  // ---------------------------------------------------------------- host verbs

  say(who, face, text) {
    const handle = { done: false };
    this.lastText = text;
    const onClose = () => { handle.done = true; };
    const g = this.game;
    g.modals.push(who ? speak(g, who, { face, text }, { onClose }) : new Dialog(g, { text, onClose }));
    this.lastWho = who;
    this.lastFace = face;
    return handle;
  }

  choice(texts) {
    const handle = { done: false, value: 0 };
    const g = this.game;
    const onClose = (i) => { handle.value = i; handle.done = true; };
    const extra = { choices: texts, onClose };
    g.modals.push(this.lastWho ? speak(g, this.lastWho, { face: this.lastFace, text: this.lastText }, extra) : new Dialog(g, { text: this.lastText, ...extra }));
    return handle;
  }

  npc(id) {
    const n = this.game.villagers.get(id);
    this.moved.add(n);
    return n;
  }

  moveNpc(id, tx, ty, dir) { return this.game.villagers.scriptMove(this.npc(id), tx, ty, dir); }

  placeNpc(id, tx, ty, dir) {
    const n = this.npc(id);
    n.placeAt(this.game.world.map.id, tx, ty, dir);
    this.game.villagers.scriptMove(n, tx, ty, dir);
  }

  face(id, dir) {
    const n = this.npc(id);
    if (dir === 'player') n.face(this.game.player.tx, this.game.player.ty);
    else n.dir = dir;
  }

  emote(id, kind) { this.npc(id).showEmote(EMOTE_ALIAS[kind] || kind); }

  pan(target, dur) {
    const cam = this.game.camera, p = this.game.player;
    const [x, y] = target === 'player' ? [p.x, p.y - 12] : [target.tx * TILE + 8, target.ty * TILE + 8];
    const handle = { done: false };
    this.panTo = { x0: cam.x + cam.w / 2, y0: cam.y + cam.h / 2, x1: x, y1: y, t: 0, dur: Math.max(0.01, dur), handle };
    return handle;
  }

  fade(dir, dur) {
    const handle = { done: false };
    this.fadeTo = { from: this.fadeA, to: dir === 'out' ? 1 : 0, t: 0, dur: Math.max(0.01, dur), handle };
    return handle;
  }

  give(id, n) {
    const g = this.game, left = g.pickUp(id, n);
    // Whatever doesn't fit lands at your feet rather than vanishing (the pickup toast covers the rest).
    if (left > 0) {
      g.world.drops.spawn(g.rng, id, left, 0, g.player.x, g.player.y);
      g.toast('toast_got', { n: left, item: itemDef(id).name }, `icon_${id}`);
    }
  }
  placePlayer(tx, ty, dir) {
    this.game.world.place(tx, ty, dir || this.game.player.dir);
    const p = this.game.player, m = this.game.world.map;
    this.game.camera.follow(p.x, p.y - 12, m.pw, m.ph, 1);
  }

  learn(dish) {
    const g = this.game;
    if (g.recipes.includes(dish)) return;
    g.recipes.push(dish);
    g.toast('recipe_learned', { dish: itemDef(dish).name }, `icon_${dish}`);
  }

  sfx(name) { this.game.sfx(name); }

  /** An iai stand-off inside a scene; the handle's value is 0 when you win, 1 when you lose. */
  duel(rival) {
    const handle = { done: false, value: 0 };
    this.game.modals.push(new IaiDuel(this.game, { rival, onEnd: (won) => { handle.value = won ? 0 : 1; handle.done = true; } }));
    return handle;
  }

  /** A festival minigame; the handle's value is its grade (0 best .. 2). */
  play(kind) {
    const g = this.game, handle = { done: false, value: 2 };
    const onEnd = (grade) => { handle.value = grade; handle.done = true; };
    if (kind === 'haiku') g.modals.push(new HaikuComposer(g, { onEnd }));
    else if (kind === 'judge') {
      const entry = bestCrop(g.inventory.slots);
      const text = entry ? t('judge_present', { item: itemDef(entry.id).name }) : t('judge_nothing');
      g.modals.push(new Dialog(g, { text, onClose: () => onEnd(judgeGrade(entry)) }));
    } else {
      const crowd = g.villagers.onMap(g.world.map.id).map((n) => n.id);
      const partner = { mochi: 'okiku' }[kind];
      g.modals.push(new RhythmGame(g, { kind, partner, crowd, onEnd }));
    }
    return handle;
  }

  fireworks(dur) {
    const handle = { done: false };
    this.fw = { t: 0, dur, next: 0, bursts: [], rng: new Rng((this.game.seed ^ this.game.dayIndex) >>> 0), handle };
    return handle;
  }

  take(id, n) { if (this.game.inventory.count(id) < n) return false; this.game.inventory.remove(id, n); return true; }
  money(n) { this.game.money += n; }
  pay(n) { if (this.game.money < n) return false; this.game.money -= n; return true; }
  /** `bond all n` moves everyone you have met. */
  bond(id, n) {
    if (id === 'all') { for (const b of Object.values(this.game.bonds)) if (b.met) addBond(b, n); return; }
    const b = bondOf(this.game, id);
    addBond(b, n);
    b.met = true;
  }
  virtue(name, n) { this.game.addVirtue(name, n); }
  flag(name) { return this.game.flags[name]; }
  setFlag(name, v) { this.game.flags[name] = v; }

  // ---------------------------------------------------------------- modal

  update(dt) {
    const g = this.game;
    g.villagers.update(dt);
    g.world.time += dt;
    const cam = g.camera, m = g.world.map;
    if (this.panTo) {
      const p = this.panTo;
      p.t += dt;
      const k = Math.min(1, p.t / p.dur), e = k * k * (3 - 2 * k);
      cam.follow(p.x0 + (p.x1 - p.x0) * e, p.y0 + (p.y1 - p.y0) * e, m.pw, m.ph, 1);
      if (k >= 1) p.handle.done = true;
    }
    if (this.fadeTo) {
      const f = this.fadeTo;
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      this.fadeA = f.from + (f.to - f.from) * k;
      if (k >= 1) { f.handle.done = true; this.fadeTo = null; }
    }
    if (this.fw) this.updateFireworks(dt);
    this.runner.update(dt);
    if (!this.runner.finished) return true;
    for (const n of this.moved) g.villagers.release(n);
    // A scene may have changed who is where today (someone arrives, a festival is joined).
    g.villagers.planDay();
    this.onEnd?.();
    return false;
  }

  updateFireworks(dt) {
    const f = this.fw, g = this.game;
    f.t += dt;
    for (const b of f.bursts) b.t += dt;
    f.bursts = f.bursts.filter((b) => b.t < 2.1);
    if (f.t < f.dur && f.t >= f.next) {
      const r = f.rng, colors = [['red3', 'gold3'], ['sakura3', 'ink6'], ['gold2', 'gold3'], ['water4', 'ink6'], ['grass5', 'gold3']];
      f.bursts.push({ x: 0.15 + r.next() * 0.7, y: 0.42 + r.next() * 0.3, t: 0, size: 55 + r.next() * 30, c: colors[Math.floor(r.next() * colors.length)] });
      f.next = f.t + 0.45 + r.next() * 0.5;
      g.sfx('firework');
    }
    if (f.t >= f.dur && !f.bursts.length) { f.handle.done = true; this.fw = null; }
  }

  /** Chrysanthemum bursts over the river: a rising trail, a flash, then rings of sparks that droop and fade. */
  drawFireworks(ctx) {
    const { w, h } = this.game.screen;
    for (const b of this.fw.bursts) if (b.t >= 0.5 && b.t < 0.62) {
      ctx.globalAlpha = 0.12;
      rect(ctx, b.c[0], 0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    for (const b of this.fw.bursts) {
      const cx = Math.round(b.x * w), cy = Math.round(b.y * h);
      if (b.t < 0.5) { rect(ctx, 'gold3', cx, Math.round(cy + (0.5 - b.t) * 200), 1, 3); continue; }
      const k = (b.t - 0.5) / 1.6, rad = b.size * Math.sqrt(k), fall = k * k * 18;
      ctx.globalAlpha = Math.max(0, 1 - k * k);
      for (const [ring, n, c, px] of [[1, 36, b.c[1], 2], [0.72, 24, b.c[0], 2], [0.4, 12, b.c[1], 1]]) {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + ring, r = rad * ring;
          const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r + fall * ring);
          rect(ctx, c, x, y, px, px);
          if (px > 1) rect(ctx, b.c[0], Math.round(cx + Math.cos(a) * r * 0.9), Math.round(cy + Math.sin(a) * r * 0.9 + fall * ring), 1, 1);
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  draw(ctx) {
    if (this.fw) this.drawFireworks(ctx);
    if (this.fadeA <= 0) return;
    ctx.globalAlpha = this.fadeA;
    rect(ctx, 'ink0', 0, 0, this.game.screen.w, this.game.screen.h);
    ctx.globalAlpha = 1;
  }
}
