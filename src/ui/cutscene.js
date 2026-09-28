// Cutscene modal: runs an event script (systems/script.js) against the live game. Dialogue boxes
// are pushed above it; villagers walk, the camera pans and the screen fades while it waits.
import { TILE } from '../config.js';
import { parseScript, ScriptRunner } from '../systems/script.js';
import { itemDef } from '../data/items.js';
import { EMOTE_ALIAS } from '../art/emotes.js';
import { rect } from './widgets.js';
import { Dialog } from './dialog.js';
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

  give(id, n) { this.game.pickUp(id, n); this.game.toast('toast_got', { n, item: itemDef(id).name }, `icon_${id}`); }
  take(id, n) { if (this.game.inventory.count(id) < n) return false; this.game.inventory.remove(id, n); return true; }
  money(n) { this.game.money += n; }
  bond(id, n) { const b = bondOf(this.game, id); addBond(b, n); b.met = true; }
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
    this.runner.update(dt);
    if (!this.runner.finished) return true;
    for (const n of this.moved) g.villagers.release(n);
    this.onEnd?.();
    return false;
  }

  draw(ctx) {
    if (this.fadeA <= 0) return;
    ctx.globalAlpha = this.fadeA;
    rect(ctx, 'ink0', 0, 0, this.game.screen.w, this.game.screen.h);
    ctx.globalAlpha = 1;
  }
}
