// The notice board: today's postings (accept with confirm) and the requests you have taken on.
import { fonts } from '../core/text.js';
import { panel, thin, hit, rect } from './widgets.js';
import { t } from '../data/strings.js';
import { itemDef } from '../data/items.js';
import { NPCS } from '../data/npcs.js';
import { VIRTUES } from '../data/virtues.js';
import { dayIndex } from '../systems/calendar.js';
import { accept, MAX_ACTIVE } from '../systems/requests.js';

const ROW = 30;

function describe(q) {
  return q.type === 'bring'
    ? t('req_bring', { npc: NPCS[q.from].name, n: q.n, item: itemDef(q.item).name })
    : t('req_deliver', { from: NPCS[q.from].name, to: NPCS[q.to].name });
}

export class NoticeMenu {
  constructor(game) {
    this.game = game;
    this.sel = 0;
  }

  rows() {
    const r = this.game.requests;
    return [...r.posted.map((q) => ({ q, posted: true })), ...r.active.map((q) => ({ q, posted: false }))];
  }

  layout() {
    const { w, h } = this.game.screen;
    this.w = Math.min(330, w - 16);
    this.h = Math.min(48 + Math.max(2, this.rows().length) * ROW, h - 30);
    this.x = Math.floor(w / 2 - this.w / 2);
    this.y = Math.floor(h / 2 - this.h / 2) - 8;
  }

  update(dt, input) {
    const g = this.game;
    this.layout();
    if (input.pressed('cancel') || input.pressed('menu') || input.pressed('rclick')) { g.sfx('ui_back'); return false; }
    const rows = this.rows();
    if (!rows.length) return !(input.pressed('confirm') || input.pressed('click'));
    if (input.pressed('up')) { this.sel = (this.sel + rows.length - 1) % rows.length; g.sfx('ui'); }
    if (input.pressed('down')) { this.sel = (this.sel + 1) % rows.length; g.sfx('ui'); }
    const m = input.mouse;
    let clicked = false;
    rows.forEach((_, i) => { if (input.pressed('click') && hit(m.x, m.y, this.x + 8, this.y + 30 + i * ROW, this.w - 16, ROW - 2)) { this.sel = i; clicked = true; } });
    this.sel = Math.min(this.sel, rows.length - 1);
    if (input.pressed('confirm') || clicked) this.take(rows[this.sel]);
    return true;
  }

  take(row) {
    const g = this.game;
    if (!row.posted) { g.sfx('deny'); return; }
    if (g.requests.active.length >= MAX_ACTIVE) { g.sfx('deny'); g.toast('req_full', { n: MAX_ACTIVE }); return; }
    if (row.q.type === 'deliver' && g.inventory.room('parcel') < 1) { g.sfx('deny'); g.aside('tk_full'); return; }
    const q = accept(g.requests, row.q.id);
    if (q.type === 'deliver') g.pickUp('parcel', 1);
    g.sfx('ui_ok');
    g.toast('req_taken', null, q.type === 'deliver' ? 'icon_parcel' : `icon_${q.item}`);
  }

  draw(ctx) {
    const g = this.game, atlas = g.atlas;
    this.layout();
    ctx.globalAlpha = 0.45;
    rect(ctx, 'ink0', 0, 0, g.screen.w, g.screen.h);
    ctx.globalAlpha = 1;
    panel(ctx, atlas, this.x, this.y, this.w, this.h);
    fonts.big.draw(ctx, t('req_title'), this.x + 10, this.y + 7, 'red1');
    const rows = this.rows();
    if (!rows.length) fonts.body.draw(ctx, t('req_none'), this.x + 12, this.y + 34, 'wood3');
    const today = dayIndex(g.cal);
    rows.forEach(({ q, posted }, i) => {
      const y = this.y + 30 + i * ROW, on = i === this.sel;
      thin(ctx, atlas, this.x + 8, y, this.w - 16, ROW - 2);
      if (on) rect(ctx, 'red2', this.x + 9, y + 1, 2, ROW - 4);
      atlas.draw(ctx, q.type === 'deliver' ? 'icon_parcel' : `icon_${q.item}`, this.x + 14, y + 5);
      fonts.body.draw(ctx, describe(q), this.x + 34, y + 3, on ? 'red1' : 'wood1');
      const [v, n] = q.virtue;
      fonts.body.draw(ctx, t('req_reward', { mon: q.mon, virtue: VIRTUES[v].name, n }), this.x + 34, y + 15, 'wood2');
      const tag = posted ? t('req_take') : t('req_days', { n: q.due - today + 1 });
      fonts.body.draw(ctx, tag, this.x + this.w - 14 - fonts.body.measure(tag), y + 15, posted ? 'grass2' : 'red1');
    });
    fonts.small.draw(ctx, t('req_help', { n: g.requests.active.length, max: MAX_ACTIVE }), this.x + 10, this.y + this.h - 13, 'wood3');
  }
}
