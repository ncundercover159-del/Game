// A storage chest: its slots above, the pack below. Confirm (or a click) on a stack moves the whole
// stack to the other side, onto matching stacks first. Rules live in systems/storage.js.
import { fonts } from '../core/text.js';
import { panel, item, hit, rect } from './widgets.js';
import { t } from '../data/strings.js';
import { itemDef } from '../data/items.js';
import { moveStack } from '../systems/storage.js';

const SLOT = 20, COLS = 12;

export class StoreMenu {
  constructor(game, chest) {
    this.game = game;
    this.chest = chest;
    this.side = 0;               // 0 the chest, 1 the pack
    this.cursor = 0;
    this.mx = game.input.mouse.x;
    this.my = game.input.mouse.y;
  }

  /** Each side's slots and how many of them are in use. */
  sides() {
    const inv = this.game.inventory;
    return [{ slots: this.chest.items, size: this.chest.items.length }, { slots: inv.slots, size: inv.size }];
  }

  layout() {
    const { w, h } = this.game.screen, [c, p] = this.sides();
    this.rows = [Math.ceil(c.size / COLS), Math.ceil(p.size / COLS)];
    this.w = Math.min(COLS * SLOT + 24, w - 16);
    this.hint = fonts.small.wrap(t('store_hint'), this.w - 24);
    this.h = 68 + this.hint.length * 10 + (this.rows[0] + this.rows[1]) * SLOT;
    this.x = Math.floor(w / 2 - this.w / 2);
    this.y = Math.floor(h / 2 - this.h / 2) - 10;
    this.top = [this.y + 22, this.y + 38 + this.rows[0] * SLOT];
  }

  slotRect(side, i) {
    const gx = this.x + Math.floor((this.w - COLS * SLOT) / 2);
    return { x: gx + (i % COLS) * SLOT, y: this.top[side] + Math.floor(i / COLS) * SLOT };
  }

  move(side, i) {
    const g = this.game, all = this.sides(), from = all[side], to = all[1 - side];
    if (!from.slots[i]) return;
    if (moveStack(from.slots, i, to.slots, to.size)) g.sfx('pickup'); else g.sfx('deny');
  }

  /** Arrow keys: along a row, and up or down through the chest's rows into the pack's. */
  step(input) {
    const all = this.sides(), n = all[this.side].size, col = this.cursor % COLS;
    if (input.pressed('left')) this.cursor = (this.cursor + n - 1) % n;
    if (input.pressed('right')) this.cursor = (this.cursor + 1) % n;
    if (input.pressed('up')) {
      if (this.cursor >= COLS) this.cursor -= COLS;
      else if (this.side === 1) { this.side = 0; this.cursor = Math.min(all[0].size - 1, (this.rows[0] - 1) * COLS + col); }
    }
    if (input.pressed('down')) {
      if (this.cursor + COLS < n) this.cursor += COLS;
      else if (this.side === 0) { this.side = 1; this.cursor = Math.min(all[1].size - 1, col); }
    }
  }

  update(dt, input) {
    const g = this.game;
    this.layout();
    if (input.pressed('cancel') || input.pressed('menu') || input.pressed('rclick')) { g.sfx('ui_back'); return false; }
    this.step(input);
    const m = input.mouse, all = this.sides();
    let over = null;
    for (const side of [0, 1]) for (let i = 0; i < all[side].size; i++) {
      const r = this.slotRect(side, i);
      if (hit(m.x, m.y, r.x, r.y, SLOT, SLOT)) over = [side, i];
    }
    if (over && (m.x !== this.mx || m.y !== this.my || input.pressed('click'))) [this.side, this.cursor] = over;
    this.mx = m.x; this.my = m.y;
    if (input.pressed('confirm') || (input.pressed('click') && over)) this.move(this.side, this.cursor);
    return true;
  }

  draw(ctx) {
    const g = this.game, atlas = g.atlas, all = this.sides(), def = itemDef(this.chest.kind);
    this.layout();
    ctx.globalAlpha = 0.45;
    rect(ctx, 'ink0', 0, 0, g.screen.w, g.screen.h);
    ctx.globalAlpha = 1;
    panel(ctx, atlas, this.x, this.y, this.w, this.h);
    fonts.big.draw(ctx, def.name, this.x + 10, this.y + 6, 'red1');
    fonts.big.draw(ctx, def.jp, this.x + 14 + fonts.big.measure(def.name), this.y + 6, 'wood3');
    fonts.body.draw(ctx, t('store_pack'), this.x + 10, this.top[1] - 13, 'wood2');
    for (const side of [0, 1]) {
      for (let i = 0; i < all[side].size; i++) {
        const r = this.slotRect(side, i);
        atlas.draw(ctx, 'ui_slot', r.x + 1, r.y + 1);
        item(ctx, atlas, all[side].slots[i], r.x + 2, r.y + 2, g.tiers);
      }
    }
    const c = this.slotRect(this.side, this.cursor);
    atlas.draw(ctx, 'ui_slot_sel', c.x, c.y);
    const s = all[this.side].slots[this.cursor], by = this.top[1] + this.rows[1] * SLOT + 4;
    if (s) fonts.body.draw(ctx, `${itemDef(s.id).name}${s.n > 1 ? ` ×${s.n}` : ''}`, this.x + 12, by, 'wood1');
    this.hint.forEach((l, i) => fonts.small.draw(ctx, l, this.x + 12, by + 14 + i * 10, 'wood3'));
  }
}
