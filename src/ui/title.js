// Title screen (M1 version): the farm drifts behind a wordmark; New Farm / Continue / Load.
// The animated seasonal parallax title and full new-game flow arrive in M7.
import { fonts } from '../core/text.js';
import { panel, rect, centre } from './widgets.js';
import { List } from './list.js';
import { t } from '../data/strings.js';
import { listSlots } from '../core/save.js';
import { SEASONS } from '../systems/calendar.js';
import { SAVE_SLOTS } from '../config.js';

export class Title {
  constructor(game) {
    this.game = game;
    this.mode = 'main';
    this.refresh();
  }

  refresh() {
    const g = this.game;
    this.slots = listSlots();
    const latest = this.slots.filter((s) => s.doc).sort((a, b) => b.doc.savedAt - a.doc.savedAt)[0];
    this.main = new List(g, [
      { label: t('menu_continue'), disabled: !latest, act: () => g.loadSlot(latest.n) },
      { label: t('menu_new'), act: () => this.pick('new') },
      { label: t('menu_load'), disabled: !latest, act: () => this.pick('load') },
    ]);
  }

  slotLabel(s) {
    if (s.doc) {
      const m = s.doc.meta;
      return t('menu_slot', { n: s.n, name: m.name, date: `${SEASONS[m.season].name} ${m.day}`, year: m.year, money: m.money });
    }
    if (s.error) return t('menu_corrupt', { n: s.n });
    return t('menu_empty_slot', { n: s.n });
  }

  pick(mode) {
    const g = this.game;
    this.mode = mode;
    const items = this.slots.map((s) => ({
      label: this.slotLabel(s),
      disabled: mode === 'load' && !s.doc,
      act: () => (mode === 'new' ? g.startNew(s.n) : g.loadSlot(s.n)),
    }));
    items.push({ label: t('menu_back'), act: () => { this.mode = 'main'; } });
    this.sub = new List(g, items);
    // New farms default to the first empty slot.
    if (mode === 'new') {
      const empty = this.slots.findIndex((s) => !s.doc);
      this.sub.sel = empty >= 0 ? empty : 0;
    }
  }

  update(dt, input) {
    const list = this.mode === 'main' ? this.main : this.sub;
    if (this.mode !== 'main' && input.pressed('cancel')) { this.mode = 'main'; this.game.sfx('ui_back'); return; }
    const it = list.update(input);
    if (it) it.act();
  }

  draw(ctx) {
    const { w, h } = this.game.screen;
    ctx.globalAlpha = 0.35;
    rect(ctx, 'ink0', 0, 0, w, h);
    ctx.globalAlpha = 1;
    const cy = Math.floor(h * 0.2);
    // Wordmark: the title in the big pixel font drawn at 2x via an offscreen copy keeps it crisp.
    drawBig(ctx, t('menu_title'), w / 2, cy, 2);
    centre(ctx, fonts.big, t('menu_subtitle'), w / 2, cy + 30, 'gold2', 'ink0');
    const list = this.mode === 'main' ? this.main : this.sub;
    const lw = this.mode === 'main' ? 120 : Math.min(w - 20, list.width() + 8);
    const lh = list.items.length * 16 + 12;
    const lx = Math.floor(w / 2 - lw / 2), ly = Math.floor(h * 0.52);
    panel(ctx, this.game.atlas, lx, ly, lw, lh);
    list.draw(ctx, lx + 4, ly + 6, lw - 8);
    centre(ctx, fonts.small, `v0.1 · M1 · ${SAVE_SLOTS} save slots`, w / 2, h - 12, 'ink5', 'ink0');
  }
}

let bigCache = null;
function drawBig(ctx, str, cx, y, scale) {
  const f = fonts.big;
  if (!bigCache || bigCache.str !== str) {
    const w = f.measure(str) + 2, h = f.cell + 2;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const cc = c.getContext('2d');
    f.draw(cc, str, 1, 2, 'ink0');
    f.draw(cc, str, 2, 1, 'red1');
    f.draw(cc, str, 1, 1, 'ink6');
    bigCache = { str, c };
  }
  const c = bigCache.c;
  ctx.drawImage(c, Math.round(cx - (c.width * scale) / 2), y, c.width * scale, c.height * scale);
}
