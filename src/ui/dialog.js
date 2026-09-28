// Modal dialogue box: typewriter text, optional speaker with portrait and voice blips, optional
// choices. Time is frozen while open.
import { fonts } from '../core/text.js';
import { panel, thin, hit } from './widgets.js';

const CPS = 70;
const PORTRAIT = 48;

export class Dialog {
  constructor(game, { text, speaker = null, portrait = null, voice = 0, choices = null, onChoose = null, onClose = null, noCancel = false }) {
    this.game = game;
    this.text = text;
    this.speaker = speaker;
    this.portrait = portrait;
    this.voice = voice;
    this.choices = choices;
    this.onChoose = onChoose;
    this.onClose = onClose;
    this.noCancel = noCancel;
    this.shown = 0;
    this.sel = 0;
    this.done = false;
    this.mx = game.input.mouse.x;
    this.my = game.input.mouse.y;
    this.layout();
  }

  layout() {
    const { w, h } = this.game.screen;
    this.bw = Math.min(360, w - 24);
    this.tx = this.portrait ? PORTRAIT + 14 : 10;
    this.lines = fonts.big.wrap(this.text, this.bw - this.tx - 10);
    this.bh = Math.max(22 + this.lines.length * 15, this.portrait ? PORTRAIT + 12 : 0);
    this.bx = Math.floor(w / 2 - this.bw / 2);
    this.by = h - this.bh - 36;
    if (this.choices) {
      this.cw = Math.max(...this.choices.map((c) => fonts.big.measure(c))) + 26;
      this.ch = this.choices.length * 16 + 10;
      this.cx = this.bx + this.bw - this.cw;
      this.cy = this.by - this.ch - 2;
    }
  }

  get finished() { return this.shown >= this.text.length; }

  update(dt, input) {
    const before = Math.floor(this.shown);
    this.shown = Math.min(this.text.length, this.shown + dt * CPS);
    if (Math.floor(this.shown) !== before && before % 3 === 0 && this.text[before] !== ' ') {
      if (this.voice) this.game.audio.blip(this.voice + (before % 7) * 6);
      else this.game.sfx('ui');
    }
    const m = input.mouse;
    if (this.choices && this.finished) {
      if (input.pressed('up')) { this.sel = (this.sel + this.choices.length - 1) % this.choices.length; this.game.sfx('ui'); }
      if (input.pressed('down')) { this.sel = (this.sel + 1) % this.choices.length; this.game.sfx('ui'); }
      if (m.x !== this.mx || m.y !== this.my) {
        this.mx = m.x;
        this.my = m.y;
        for (let i = 0; i < this.choices.length; i++) if (hit(m.x, m.y, this.cx, this.cy + 5 + i * 16, this.cw, 16)) this.sel = i;
      }
    }
    const confirm = input.pressed('confirm') || input.pressed('click');
    const cancel = !this.noCancel && (input.pressed('cancel') || input.pressed('rclick'));
    if (confirm || cancel) {
      if (!this.finished) { this.shown = this.text.length; return true; }
      if (this.choices) {
        if (cancel) this.sel = this.choices.length - 1;
        if (input.pressed('click') && !hit(m.x, m.y, this.cx, this.cy, this.cw, this.ch)) return true;
        this.game.sfx(cancel ? 'ui_back' : 'ui_ok');
        this.done = true;
        this.onChoose?.(this.sel);
        this.onClose?.(this.sel);
        return false;
      }
      this.game.sfx('ui_ok');
      this.done = true;
      this.onClose?.(0);
      return false;
    }
    return true;
  }

  draw(ctx) {
    const atlas = this.game.atlas;
    panel(ctx, atlas, this.bx, this.by, this.bw, this.bh);
    if (this.speaker) {
      const sw = fonts.body.measure(this.speaker) + 12;
      thin(ctx, atlas, this.bx + 8, this.by - 10, sw, 14);
      fonts.body.draw(ctx, this.speaker, this.bx + 14, this.by - 8, 'red1');
    }
    if (this.portrait) {
      thin(ctx, atlas, this.bx + 6, this.by + 6, PORTRAIT + 2, PORTRAIT + 2);
      atlas.draw(ctx, this.portrait, this.bx + 7, this.by + 7);
    }
    let left = Math.floor(this.shown);
    this.lines.forEach((line, i) => {
      const part = line.slice(0, Math.max(0, left));
      left -= line.length + 1;
      fonts.big.draw(ctx, part, this.bx + this.tx, this.by + 9 + i * 15, 'wood1');
    });
    if (this.finished && !this.choices && Math.floor(this.game.clockTime * 3) % 2) {
      fonts.body.draw(ctx, '▼', this.bx + this.bw - 16, this.by + this.bh - 14, 'red2');
    }
    if (this.choices && this.finished) {
      panel(ctx, atlas, this.cx, this.cy, this.cw, this.ch);
      this.choices.forEach((c, i) => {
        const y = this.cy + 5 + i * 16;
        if (i === this.sel) fonts.big.draw(ctx, '▶', this.cx + 6, y, 'red2');
        fonts.big.draw(ctx, c, this.cx + 17, y, i === this.sel ? 'red1' : 'wood1');
      });
    }
  }
}
