// The mailbox: letters listed on the left, the open one on a sheet of washi on the right.
// Reading a letter for the first time collects anything tied to it.
import { fonts } from '../core/text.js';
import { panel, thin, hit, rect } from './widgets.js';
import { t } from '../data/strings.js';
import { NPCS } from '../data/npcs.js';
import { itemDef } from '../data/items.js';
import { letterOf } from '../systems/mail.js';

const ROW = 16;

export class MailMenu {
  constructor(game) {
    this.game = game;
    const i = game.mail.inbox.findIndex((l) => !l.read);
    this.sel = Math.max(0, i);
    this.open(this.sel);
  }

  /** Mark read and collect attachments (what doesn't fit stays tied to the letter). */
  open(i) {
    const g = this.game, entry = g.mail.inbox[i];
    if (!entry) return;
    entry.read = true;
    const left = [];
    for (const [id, n] of entry.left || letterOf(entry).items) {
      const rest = g.pickUp(id, n);
      if (rest > 0) left.push([id, rest]);
    }
    entry.left = left;
  }

  from(l) { return NPCS[l.from] ? `${NPCS[l.from].name} ${NPCS[l.from].jp}` : l.from; }

  layout() {
    const { w, h } = this.game.screen;
    this.w = Math.min(380, w - 16);
    this.h = Math.min(210, h - 30);
    this.x = Math.floor(w / 2 - this.w / 2);
    this.y = Math.floor(h / 2 - this.h / 2) - 8;
  }

  update(dt, input) {
    const g = this.game, n = g.mail.inbox.length;
    this.layout();
    if (input.pressed('cancel') || input.pressed('menu') || input.pressed('rclick')) { g.sfx('ui_back'); return false; }
    let sel = this.sel;
    if (input.pressed('up')) sel = (sel + n - 1) % n;
    if (input.pressed('down')) sel = (sel + 1) % n;
    const m = input.mouse;
    if (input.pressed('click')) g.mail.inbox.forEach((_, i) => { if (hit(m.x, m.y, this.x + 6, this.y + 26 + i * ROW, 104, ROW)) sel = i; });
    if (sel !== this.sel) { this.sel = sel; this.open(sel); g.sfx('ui'); }
    return true;
  }

  draw(ctx) {
    const g = this.game, atlas = g.atlas;
    this.layout();
    ctx.globalAlpha = 0.45;
    rect(ctx, 'ink0', 0, 0, g.screen.w, g.screen.h);
    ctx.globalAlpha = 1;
    panel(ctx, atlas, this.x, this.y, this.w, this.h);
    fonts.big.draw(ctx, t('mail_title'), this.x + 10, this.y + 7, 'red1');
    const visible = Math.floor((this.h - 34) / ROW);
    const top = Math.max(0, Math.min(this.sel - visible + 1, g.mail.inbox.length - visible));
    g.mail.inbox.slice(top, top + visible).forEach((l, k) => {
      const i = top + k, y = this.y + 26 + k * ROW;
      if (i === this.sel) thin(ctx, atlas, this.x + 6, y - 2, 106, ROW);
      const from = letterOf(l).from;
      fonts.body.draw(ctx, NPCS[from] ? NPCS[from].name : from, this.x + 12, y + 1, i === this.sel ? 'red1' : l.read ? 'wood3' : 'wood1');
      if (!l.read) rect(ctx, 'red2', this.x + 104, y + 4, 3, 3);
    });
    const entry = g.mail.inbox[this.sel];
    if (!entry) return;
    const l = letterOf(entry);
    const px = this.x + 118, py = this.y + 24, pw = this.w - 128;
    rect(ctx, 'ink6', px, py, pw, this.h - 34);
    rect(ctx, 'ink5', px + pw - 2, py, 2, this.h - 34);
    const text = l.gossip ? t('mail_gossip', { npc: l.gossip.name, item: itemDef(l.gossip.loved).name }) : l.text;
    const lines = fonts.body.wrap(text.replace(/\{name\}/g, g.state.name), pw - 14);
    lines.forEach((line, i) => fonts.body.draw(ctx, line, px + 7, py + 6 + i * 11, 'ink1'));
    fonts.body.draw(ctx, `— ${this.from(l)}`, px + pw - 10 - fonts.body.measure(`— ${this.from(l)}`), py + 10 + lines.length * 11, 'red1');
    (entry.left || []).forEach(([id, n], i) => {
      atlas.draw(ctx, `icon_${id}`, px + 7 + i * 20, py + this.h - 56);
      fonts.small.draw(ctx, `${n}`, px + 19 + i * 20, py + this.h - 46, 'red1');
    });
  }
}
