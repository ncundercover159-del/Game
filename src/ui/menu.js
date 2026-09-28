// Pause menu (Esc/Tab): Items (rearrange the backpack, item details), Craft, Skills, Bonds,
// Options, Save.
import { fonts } from '../core/text.js';
import { panel, thin, item, hit, rect, iconName } from './widgets.js';
import { List } from './list.js';
import { BondsPage } from './bonds.js';
import { drawSkillsPage } from './skills.js';
import { CraftPage } from './cook.js';
import { SettingsPage } from './settings.js';
import { t } from '../data/strings.js';
import { itemDef, QUALITY } from '../data/items.js';
import { sellValue } from '../systems/skills.js';

const TABS = ['menu_items', 'menu_craft', 'menu_skills', 'menu_bonds', 'menu_options', 'menu_save'];
const TAB_W = 62;
const SLOT = 20;

export class Menu {
  constructor(game) {
    this.game = game;
    this.tab = 0;
    this.cursor = game.inventory.selected;
    this.held = -1;          // slot index picked up for moving
    this.settings = new SettingsPage(game, { inGame: true });
    this.saveList = this.makeSaveList();
    this.bonds = new BondsPage(game);
    this.craft = new CraftPage(game);
    this.layout();
  }

  layout() {
    const { w, h } = this.game.screen;
    this.w = Math.min(TABS.length * TAB_W + 12, w - 16);
    // A bigger pack adds rows of slots above the item details.
    this.rows = Math.ceil(this.game.inventory.size / 12);
    this.h = Math.min(150 + (this.rows - 1) * 20, h - 36);
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

  update(dt, input) {
    const g = this.game;
    // Rebinding a key, or in the Controls list: the settings page has the keys to itself.
    if (this.tab === 4 && this.settings.busy) return this.settings.update(input, this.x + 10, this.y + 14, this.w - 20, this.h - 30);
    if (input.pressed('menu') || (input.pressed('cancel') && this.held < 0)) { g.sfx('ui_back'); return false; }
    if (input.pressed('prev')) { this.tab = (this.tab + TABS.length - 1) % TABS.length; g.sfx('ui'); }
    if (input.pressed('next')) { this.tab = (this.tab + 1) % TABS.length; g.sfx('ui'); }
    const m = input.mouse;
    if (input.pressed('click')) {
      TABS.forEach((_, i) => { if (hit(m.x, m.y, this.x + 6 + i * TAB_W, this.y - 20, TAB_W - 4, 20)) { this.tab = i; g.sfx('ui'); } });
    }
    if (this.tab === 0) this.updateItems(input);
    else if (this.tab === 1) this.craft.update(input, this.x, this.y, this.w, this.h);
    else if (this.tab === 3) this.bonds.update(input, this.x, this.y);
    else if (this.tab === 4) this.settings.update(input, this.x + 10, this.y + 14, this.w - 20, this.h - 30);
    else if (this.tab === 5) {
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

  draw(ctx) {
    const g = this.game;
    const atlas = g.atlas;
    this.layout();
    ctx.globalAlpha = 0.45;
    rect(ctx, 'ink0', 0, 0, g.screen.w, g.screen.h);
    ctx.globalAlpha = 1;
    // Folder tabs sit on the panel's top edge; the active one is taller and drawn over it.
    const tab = (k, i) => {
      const tx = this.x + 6 + i * TAB_W, on = i === this.tab;
      const ty = this.y - (on ? 20 : 17);
      panel(ctx, atlas, tx, ty, TAB_W - 4, on ? 24 : 19);
      fonts.body.draw(ctx, t(k), Math.round(tx + (TAB_W - 4) / 2 - fonts.body.measure(t(k)) / 2), ty + 5, on ? 'red1' : 'wood2');
    };
    TABS.forEach((k, i) => { if (i !== this.tab) tab(k, i); });
    panel(ctx, atlas, this.x, this.y, this.w, this.h);
    tab(TABS[this.tab], this.tab);
    rect(ctx, 'wood6', this.x + 6 + this.tab * TAB_W + 4, this.y + 1, TAB_W - 12, 3);
    if (this.tab === 0) this.drawItems(ctx, atlas);
    else if (this.tab === 1) this.craft.draw(ctx, this.x, this.y, this.w, this.h);
    else if (this.tab === 2) drawSkillsPage(ctx, g, this.x, this.y, this.w, this.h);
    else if (this.tab === 3) this.bonds.draw(ctx, this.x, this.y, this.w, this.h);
    else if (this.tab === 4) this.settings.draw(ctx, this.x + 10, this.y + 14, this.w - 20, this.h - 30);
    else {
      fonts.body.draw(ctx, `${g.state.name} · ${g.state.farm} Farm`, this.x + 12, this.y + 12, 'wood2');
      this.saveList.draw(ctx, this.x + 10, this.y + 32, this.w - 20);
    }
    if (this.tab !== 2) fonts.small.draw(ctx, t('help_keys'), this.x + 8, this.y + this.h - 12, 'wood3');
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
    const x = this.x + 12, y = this.y + 26 + this.rows * 20;
    thin(ctx, atlas, x - 4, y - 4, this.w - 16, 86);
    atlas.draw(ctx, iconName(s.id, this.game.tiers), x, y);
    fonts.big.draw(ctx, d.name, x + 22, y, 'wood1');
    fonts.big.draw(ctx, d.jp, x + 26 + fonts.big.measure(d.name), y, 'red1');
    if (s.q) fonts.body.draw(ctx, `${'★'.repeat(QUALITY[s.q].stars)} ${QUALITY[s.q].name}`, x + 22, y + 15, 'gold0');
    fonts.body.wrap(d.desc, this.w - 40).forEach((l, i) => fonts.body.draw(ctx, l, x, y + 28 + i * 12, 'wood2'));
    if (d.sell) fonts.body.draw(ctx, t('sell', { n: sellValue(this.game.skills, s.id, s.q) }), x, y + 66, 'red1');
  }
}
