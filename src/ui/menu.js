// Pause menu (Esc/Tab): Items (rearrange the backpack, item details), Options, Save.
import { fonts } from '../core/text.js';
import { panel, thin, item, hit, rect, iconName } from './widgets.js';
import { List } from './list.js';
import { t } from '../data/strings.js';
import { itemDef, sellPrice, QUALITY } from '../data/items.js';

const TABS = ['menu_items', 'menu_options', 'menu_save'];
const SLOT = 20;

export class Menu {
  constructor(game) {
    this.game = game;
    this.tab = 0;
    this.cursor = game.inventory.selected;
    this.held = -1;          // slot index picked up for moving
    this.optSel = 0;
    this.saveList = this.makeSaveList();
    this.layout();
  }

  layout() {
    const { w, h } = this.game.screen;
    this.w = Math.min(300, w - 16);
    this.h = 150;
    this.x = Math.floor(w / 2 - this.w / 2);
    this.y = Math.floor(h / 2 - this.h / 2) - 4;
  }

  makeSaveList() {
    const g = this.game;
    return new List(g, [
      { label: t('menu_save_slot', { n: g.slot }), act: () => g.saveNow() },
      { label: t('menu_export'), act: () => g.exportSave() },
      { label: t('menu_import'), act: () => g.importSave() },
      { label: t('menu_quit'), act: () => g.toTitle() },
    ]);
  }

  options() {
    const g = this.game;
    const s = g.settings;
    return [
      { label: t('opt_sfx'), value: `${Math.round(s.sfx * 10)}`, change: (d) => g.setSetting('sfx', Math.max(0, Math.min(1, Math.round((s.sfx + d * 0.1) * 10) / 10))) },
      { label: t('opt_speed'), value: t(`opt_speed_${s.speed}`), change: (d) => {
        const order = ['normal', 'slow', 'relaxed'];
        g.setSetting('speed', order[(order.indexOf(s.speed) + d + 3) % 3]);
      } },
      { label: t('opt_shake'), value: t(s.shake ? 'on' : 'off'), change: () => g.setSetting('shake', !s.shake) },
    ];
  }

  update(dt, input) {
    const g = this.game;
    if (input.pressed('menu') || (input.pressed('cancel') && this.held < 0)) { g.sfx('ui_back'); return false; }
    if (input.pressed('prev')) { this.tab = (this.tab + 2) % 3; g.sfx('ui'); }
    if (input.pressed('next')) { this.tab = (this.tab + 1) % 3; g.sfx('ui'); }
    const m = input.mouse;
    if (input.pressed('click')) {
      TABS.forEach((_, i) => { if (hit(m.x, m.y, this.x + 6 + i * 70, this.y - 20, 66, 20)) { this.tab = i; g.sfx('ui'); } });
    }
    if (this.tab === 0) this.updateItems(input);
    else if (this.tab === 1) this.updateOptions(input);
    else {
      const it = this.saveList.update(input);
      if (it) { it.act(); if (!g.menuOpen) return false; }
    }
    return true;
  }

  slotRect(i) {
    const cols = 12;
    const gx = this.x + Math.floor((this.w - cols * SLOT) / 2);
    return { x: gx + (i % cols) * SLOT, y: this.y + 12 + Math.floor(i / cols) * SLOT };
  }

  updateItems(input) {
    const g = this.game;
    const inv = g.inventory;
    const n = inv.size;
    if (input.pressed('left')) this.cursor = (this.cursor + n - 1) % n;
    if (input.pressed('right')) this.cursor = (this.cursor + 1) % n;
    if (input.pressed('up') && this.cursor >= 12) this.cursor -= 12;
    if (input.pressed('down') && this.cursor + 12 < n) this.cursor += 12;
    const m = input.mouse;
    for (let i = 0; i < n; i++) {
      const r = this.slotRect(i);
      if (hit(m.x, m.y, r.x, r.y, SLOT, SLOT) && (m.x !== this.mx || m.y !== this.my || input.pressed('click'))) this.cursor = i;
    }
    this.mx = m.x;
    this.my = m.y;
    const overSlot = [...Array(n).keys()].some((i) => { const r = this.slotRect(i); return hit(m.x, m.y, r.x, r.y, SLOT, SLOT); });
    if (input.pressed('confirm') || (input.pressed('click') && overSlot)) {
      if (this.held < 0) {
        if (inv.slots[this.cursor]) { this.held = this.cursor; g.sfx('ui'); }
      } else {
        inv.swap(this.held, this.cursor);
        this.held = -1;
        g.sfx('ui_ok');
      }
    }
    if (input.pressed('cancel') && this.held >= 0) this.held = -1;
  }

  updateOptions(input) {
    const opts = this.options();
    if (input.pressed('up')) this.optSel = (this.optSel + opts.length - 1) % opts.length;
    if (input.pressed('down')) this.optSel = (this.optSel + 1) % opts.length;
    const o = opts[this.optSel];
    if (input.pressed('left')) { o.change(-1); this.game.sfx('ui'); }
    if (input.pressed('right') || input.pressed('confirm')) { o.change(1); this.game.sfx('ui'); }
    const m = input.mouse;
    if (input.pressed('click')) opts.forEach((opt, i) => {
      if (hit(m.x, m.y, this.x + 10, this.y + 16 + i * 20, this.w - 20, 18)) { this.optSel = i; opt.change(1); this.game.sfx('ui'); }
    });
  }

  draw(ctx) {
    const g = this.game;
    const atlas = g.atlas;
    this.layout();
    ctx.globalAlpha = 0.45;
    rect(ctx, 'ink0', 0, 0, g.screen.w, g.screen.h);
    ctx.globalAlpha = 1;
    // Folder tabs sit on the panel's top edge; the active one is taller and drawn over it.
    const tab = (k, i) => {
      const tx = this.x + 6 + i * 70, on = i === this.tab;
      const ty = this.y - (on ? 20 : 17);
      panel(ctx, atlas, tx, ty, 66, on ? 24 : 19);
      fonts.body.draw(ctx, t(k), Math.round(tx + 33 - fonts.body.measure(t(k)) / 2), ty + 5, on ? 'red1' : 'wood2');
    };
    TABS.forEach((k, i) => { if (i !== this.tab) tab(k, i); });
    panel(ctx, atlas, this.x, this.y, this.w, this.h);
    tab(TABS[this.tab], this.tab);
    rect(ctx, 'wood6', this.x + 6 + this.tab * 70 + 4, this.y + 1, 58, 3);
    if (this.tab === 0) this.drawItems(ctx, atlas);
    else if (this.tab === 1) this.drawOptions(ctx);
    else {
      fonts.body.draw(ctx, `${g.state.name} · ${g.state.farm} Farm`, this.x + 12, this.y + 12, 'wood2');
      this.saveList.draw(ctx, this.x + 10, this.y + 32, this.w - 20);
    }
    fonts.small.draw(ctx, t('help_keys'), this.x + 8, this.y + this.h - 12, 'wood3');
  }

  drawItems(ctx, atlas) {
    const inv = this.game.inventory;
    for (let i = 0; i < inv.size; i++) {
      const r = this.slotRect(i);
      atlas.draw(ctx, 'ui_slot', r.x + 1, r.y + 1);
      if (i !== this.held) item(ctx, atlas, inv.slots[i], r.x + 2, r.y + 2, this.game.tiers);
    }
    const c = this.slotRect(this.cursor);
    atlas.draw(ctx, 'ui_slot_sel', c.x, c.y);
    if (this.held >= 0) item(ctx, atlas, inv.slots[this.held], c.x + 6, c.y - 6, this.game.tiers);
    const s = inv.slots[this.held >= 0 ? this.held : this.cursor];
    if (!s) return;
    const d = itemDef(s.id);
    const x = this.x + 12, y = this.y + 46;
    thin(ctx, atlas, x - 4, y - 4, this.w - 16, 86);
    atlas.draw(ctx, iconName(s.id, this.game.tiers), x, y);
    fonts.big.draw(ctx, d.name, x + 22, y, 'wood1');
    fonts.big.draw(ctx, d.jp, x + 26 + fonts.big.measure(d.name), y, 'red1');
    if (s.q) fonts.body.draw(ctx, `${'★'.repeat(QUALITY[s.q].stars)} ${QUALITY[s.q].name}`, x + 22, y + 15, 'gold0');
    fonts.body.wrap(d.desc, this.w - 40).forEach((l, i) => fonts.body.draw(ctx, l, x, y + 28 + i * 12, 'wood2'));
    if (d.sell) fonts.body.draw(ctx, t('sell', { n: sellPrice(s.id, s.q) }), x, y + 66, 'red1');
  }

  drawOptions(ctx) {
    this.options().forEach((o, i) => {
      const y = this.y + 16 + i * 20;
      const on = i === this.optSel;
      if (on) fonts.big.draw(ctx, '▶', this.x + 10, y, 'red2');
      fonts.big.draw(ctx, o.label, this.x + 22, y, on ? 'red1' : 'wood1');
      const v = `◀ ${o.value} ▶`;
      fonts.big.draw(ctx, v, this.x + this.w - 16 - fonts.big.measure(v), y, 'wood1');
    });
  }
}
