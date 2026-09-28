// Shipping crate: pick stacks from the backpack to ship; they are paid for overnight.
import { fonts } from '../core/text.js';
import { panel, thin, item, hit, rect, iconName } from './widgets.js';
import { t } from '../data/strings.js';
import { itemDef } from '../data/items.js';
import { sellValue } from '../systems/skills.js';
import { shippingValue } from '../systems/day.js';

const SLOT = 20;

export function sellable(id) {
  const d = itemDef(id);
  return d.kind !== 'tool' && d.kind !== 'weapon' && (d.sell || 0) > 0;
}

export class ShipMenu {
  constructor(game) {
    this.game = game;
    this.cursor = game.inventory.selected;
    this.mx = game.input.mouse.x;
    this.my = game.input.mouse.y;
  }

  layout() {
    const { w, h } = this.game.screen;
    this.w = Math.min(300, w - 16);
    this.h = 108 + Math.ceil(this.game.inventory.size / 12) * 20;
    this.x = Math.floor(w / 2 - this.w / 2);
    this.y = Math.floor(h / 2 - this.h / 2) - 10;
  }

  slotRect(i) {
    const gx = this.x + Math.floor((this.w - 12 * SLOT) / 2);
    return { x: gx + (i % 12) * SLOT, y: this.y + 24 + Math.floor(i / 12) * SLOT };
  }

  ship(i) {
    const g = this.game;
    const s = g.inventory.slots[i];
    if (!s) return;
    if (!sellable(s.id)) { g.sfx('deny'); g.toast('ship_cant'); return; }
    g.shipped.push({ id: s.id, n: s.n, q: s.q });
    g.inventory.slots[i] = null;
    g.sfx('pickup');
  }

  undo() {
    const g = this.game;
    const last = g.shipped[g.shipped.length - 1];
    if (!last || g.inventory.room(last.id, last.q) < last.n) { g.sfx('deny'); return; }
    g.shipped.pop();
    g.inventory.add(last.id, last.n, last.q);
    g.sfx('ui_back');
  }

  update(dt, input) {
    const g = this.game, n = g.inventory.size;
    this.layout();
    if (input.pressed('cancel') || input.pressed('menu') || input.pressed('rclick')) { g.sfx('ui_back'); return false; }
    if (input.pressed('left')) this.cursor = (this.cursor + n - 1) % n;
    if (input.pressed('right')) this.cursor = (this.cursor + 1) % n;
    if (input.pressed('up') && this.cursor >= 12) this.cursor -= 12;
    if (input.pressed('down') && this.cursor + 12 < n) this.cursor += 12;
    const m = input.mouse;
    let over = -1;
    for (let i = 0; i < n; i++) { const r = this.slotRect(i); if (hit(m.x, m.y, r.x, r.y, SLOT, SLOT)) over = i; }
    if (over >= 0 && (m.x !== this.mx || m.y !== this.my)) this.cursor = over;
    this.mx = m.x; this.my = m.y;
    const undoHit = hit(m.x, m.y, this.x + this.w - 96, this.y + this.h - 22, 88, 14);
    if (input.pressed('click') && undoHit) { this.undo(); return true; }
    if (input.pressed('prev')) this.undo();
    if (input.pressed('confirm') || (input.pressed('click') && over >= 0)) this.ship(over >= 0 && input.pressed('click') ? over : this.cursor);
    return true;
  }

  draw(ctx) {
    const g = this.game, atlas = g.atlas;
    this.layout();
    ctx.globalAlpha = 0.45;
    rect(ctx, 'ink0', 0, 0, g.screen.w, g.screen.h);
    ctx.globalAlpha = 1;
    panel(ctx, atlas, this.x, this.y, this.w, this.h);
    fonts.big.draw(ctx, t('ship_title'), this.x + 10, this.y + 6, 'red1');
    for (let i = 0; i < g.inventory.size; i++) {
      const r = this.slotRect(i);
      atlas.draw(ctx, 'ui_slot', r.x + 1, r.y + 1);
      const s = g.inventory.slots[i];
      if (s) {
        if (!sellable(s.id)) ctx.globalAlpha = 0.4;
        item(ctx, atlas, s, r.x + 2, r.y + 2, g.tiers);
        ctx.globalAlpha = 1;
      }
    }
    const c = this.slotRect(this.cursor);
    atlas.draw(ctx, 'ui_slot_sel', c.x, c.y);
    const s = g.inventory.slots[this.cursor];
    const iy = this.y + 50;
    if (s && sellable(s.id)) {
      const d = itemDef(s.id);
      fonts.body.draw(ctx, `${d.name} ×${s.n}  →  ${sellValue(this.game.skills, s.id, s.q) * s.n} 文`, this.x + 12, iy, 'wood1');
    }
    fonts.body.draw(ctx, t('ship_hint'), this.x + 12, iy + 14, 'wood3');
    // Crate contents: last few stacks and the running total.
    thin(ctx, atlas, this.x + 8, this.y + this.h - 44, this.w - 16, 20);
    g.shipped.slice(-8).forEach((q, i) => atlas.draw(ctx, iconName(q.id, null), this.x + 12 + i * 18, this.y + this.h - 42));
    const total = t('ship_total', { n: shippingValue(g.shipped, g.skills).total });
    fonts.body.draw(ctx, total, this.x + this.w - 14 - fonts.body.measure(total), this.y + this.h - 39, 'red1');
    fonts.body.draw(ctx, `[ ${t('ship_undo')}`, this.x + this.w - 96, this.y + this.h - 20, g.shipped.length ? 'wood2' : 'wood4');
  }
}
