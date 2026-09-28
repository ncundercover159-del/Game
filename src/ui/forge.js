// Genzō's forge, three tabs ([ and ] switch): Tools (iron bars, two-day tool upgrades), Blades
// (weapons forged on the spot from bars, ore and your old sword), Smelt (ore and charcoal into bars).
import { fonts } from '../core/text.js';
import { thin, hit, iconName } from './widgets.js';
import { t } from '../data/strings.js';
import { itemDef } from '../data/items.js';
import { SHOPS } from '../data/shops.js';
import { TIERS, UPGRADABLE, UPGRADE_DAYS } from '../data/tools.js';
import { WEAPONS, SMELT } from '../data/weapons.js';
import { buyMult } from '../systems/virtues.js';
import { dayIndex, SEASONS } from '../systems/calendar.js';
import { RowShop } from './shop.js';

const TABS = ['forge_tab_tools', 'forge_tab_blades', 'forge_tab_smelt'];

export class ForgeMenu extends RowShop {
  constructor(game) {
    super(game, `${SHOPS.kajiya.name} ${SHOPS.kajiya.jp}`, t(SHOPS.kajiya.hello));
  }

  rows() {
    return [this.toolRows, this.bladeRows, this.smeltRows][this.tab].call(this);
  }

  toolRows() {
    const g = this.game;
    const price = Math.round(itemDef('iron_bar').price * buyMult(g.virtues));
    const rows = [{ icon: 'icon_iron_bar', label: itemDef('iron_bar').name + (this.sel === 0 && this.qty > 1 ? `  ×${this.qty}` : ''), right: `${price * (this.sel === 0 ? this.qty : 1)} 文`, act: () => this.buyIron(price) }];
    const up = g.upgrade;
    if (up) {
      const ready = dayIndex(g.cal) >= up.ready;
      const name = itemDef(up.tool).name;
      rows.push(ready
        ? { icon: `icon_${up.tool}@${up.tier}`, label: t('forge_collect', { tool: name }), act: () => this.collect() }
        : { icon: `icon_${up.tool}@${up.tier}`, label: t('forge_busy', { tool: name, day: `${SEASONS[g.cal.season].name} ${g.cal.day + (up.ready - dayIndex(g.cal))}` }), disabled: true });
    }
    for (const tool of UPGRADABLE) {
      const next = (g.tiers[tool] || 0) + 1;
      const name = itemDef(tool).name;
      if (next >= TIERS.length) { rows.push({ icon: `icon_${tool}@${next - 1}`, label: t('forge_max', { tool: name }), disabled: true }); continue; }
      const cost = TIERS[next].cost;
      const [mat, n] = Object.entries(cost.items)[0];
      rows.push({
        icon: iconName(tool, g.tiers), label: t('forge_upgrade', { tool: name, tier: TIERS[next].name }),
        right: t('forge_needs', { mon: cost.mon, n, item: itemDef(mat).name }), disabled: !!up, act: () => this.upgrade(tool, next),
      });
    }
    return rows;
  }

  /** Blades you can have made now: their needs shown as icons, ones you own greyed. */
  bladeRows() {
    const g = this.game;
    return Object.entries(WEAPONS).filter(([, w]) => w.forge && (!w.after || g.flags[w.after])).map(([id, w]) => {
      const owned = g.inventory.count(id) > 0;
      return { icon: `icon_${id}`, label: w.name, needs: w.forge.items, mon: w.forge.mon, disabled: owned, note: owned ? t('forge_owned') : null, act: () => this.forgeBlade(id) };
    });
  }

  smeltRows() {
    const g = this.game;
    return Object.entries(SMELT).filter(([, s]) => !s.after || g.flags[s.after]).map(([id, s]) => ({
      icon: `icon_${id}`, label: itemDef(id).name + (this.qty > 1 ? `  ×${this.qty}` : ''), needs: s.in.map(([i, n]) => [i, n * this.qty]), mon: s.mon * this.qty, act: () => this.smelt(id),
    }));
  }

  has(needs, mon) {
    const g = this.game;
    return g.money >= mon && needs.every(([id, n]) => g.inventory.count(id) >= n);
  }

  forgeBlade(id) {
    const g = this.game, f = WEAPONS[id].forge;
    if (!this.has(f.items, f.mon)) { g.sfx('deny'); g.toast('shop_poor'); return; }
    // Reforging your old sword frees its own slot; anything else needs a free one.
    const reforge = f.items.some(([i]) => itemDef(i).kind === 'weapon');
    if (!reforge && g.inventory.room(id) < 1) { g.sfx('deny'); g.aside('tk_full'); return; }
    for (const [i, n] of f.items) g.inventory.remove(i, n);
    g.money -= f.mon;
    g.inventory.add(id, 1);
    g.sfx('crit');
    g.xp('craft', 20);
    g.say(`forge_made_${id === 'katana_tetsu' ? 'tetsu' : 'blade'}`, { item: WEAPONS[id].name });
  }

  smelt(id) {
    const g = this.game, s = SMELT[id], needs = s.in.map(([i, n]) => [i, n * this.qty]), mon = s.mon * this.qty;
    if (!this.has(needs, mon)) { g.sfx('deny'); g.toast('shop_poor'); return; }
    if (g.inventory.room(id) < this.qty) { g.sfx('deny'); g.aside('tk_full'); return; }
    for (const [i, n] of needs) g.inventory.remove(i, n);
    g.money -= mon;
    g.inventory.add(id, this.qty);
    g.sfx('rock');
    g.toast('shop_bought', { n: this.qty, item: itemDef(id).name }, `icon_${id}`);
  }

  buyIron(price) {
    const g = this.game, cost = price * this.qty;
    if (g.money < cost) { g.sfx('deny'); g.toast('shop_poor'); return; }
    if (g.inventory.room('iron_bar') < this.qty) { g.sfx('deny'); g.aside('tk_full'); return; }
    g.money -= cost;
    g.inventory.add('iron_bar', this.qty);
    g.sfx('pickup');
  }

  upgrade(tool, tier) {
    const g = this.game, cost = TIERS[tier].cost;
    const [mat, n] = Object.entries(cost.items)[0];
    const slot = g.inventory.find(tool);
    if (slot < 0) { g.sfx('deny'); g.say('forge_no_tool'); return; }
    if (g.money < cost.mon || g.inventory.count(mat) < n) { g.sfx('deny'); g.toast('shop_poor'); return; }
    g.money -= cost.mon;
    g.inventory.remove(mat, n);
    g.inventory.slots[slot] = null;
    g.upgrade = { tool, tier, ready: dayIndex(g.cal) + UPGRADE_DAYS };
    g.sfx('rock');
    g.say('forge_left', { tool: itemDef(tool).name });
  }

  collect() {
    const g = this.game, up = g.upgrade;
    if (g.inventory.room(up.tool) < 1) { g.sfx('deny'); g.aside('tk_full'); return; }
    g.tiers[up.tool] = up.tier;
    if (up.tool === 'can') g.can = TIERS[up.tier].can;
    g.inventory.add(up.tool, 1);
    g.upgrade = null;
    g.flags.upgraded_once = true;
    g.sfx('harvest');
    g.toast('forge_back', { tool: itemDef(up.tool).name, tier: TIERS[up.tier].name }, iconName(up.tool, g.tiers));
  }

  update(dt, input) {
    const g = this.game;
    this.layout();
    if (input.pressed('cancel') || input.pressed('menu') || input.pressed('rclick')) { g.sfx('ui_back'); return false; }
    if (input.pressed('prev') || input.pressed('next')) { this.tab = (this.tab + (input.pressed('next') ? 1 : 2)) % 3; this.sel = 0; this.qty = 1; g.sfx('ui'); }
    if (input.pressed('click')) TABS.forEach((_, i) => { if (hit(input.mouse.x, input.mouse.y, this.x + 10 + i * 64, this.y + this.h - 22, 60, 16) && i !== this.tab) { this.tab = i; this.sel = 0; g.sfx('ui'); } });
    const rows = this.rows();
    if (rows.length && this.navigate(input, rows.length)) {
      const r = rows[this.sel];
      if (r.disabled) g.sfx('deny');
      else r.act();
    }
    return true;
  }

  draw(ctx) {
    const g = this.game;
    this.frame(ctx);
    const rows = this.rows();
    this.drawRows(ctx, rows.map((r) => (r.needs ? { ...r, right: r.note || '' } : r)));
    // Needs as icons with counts (red when short), then the price.
    const top = this.scroll();
    rows.slice(top, top + this.visible).forEach((r, i) => {
      if (!r.needs || r.note) return;
      const y = this.rowY(i);
      let x = this.x + this.w - 14;
      const price = `${r.mon} 文`;
      x -= fonts.body.measure(price);
      fonts.body.draw(ctx, price, x, y + 4, g.money >= r.mon ? 'wood2' : 'red2');
      for (const [id, n] of [...r.needs].reverse()) {
        x -= 30;
        g.atlas.draw(ctx, `icon_${id}`, x, y);
        fonts.small.draw(ctx, `${n}`, x + 16, y + 8, g.inventory.count(id) >= n ? 'wood1' : 'red2');
      }
    });
    TABS.forEach((k, i) => {
      const bx = this.x + 10 + i * 64;
      thin(ctx, g.atlas, bx, this.y + this.h - 22, 60, 16);
      fonts.body.draw(ctx, t(k), Math.round(bx + 30 - fonts.body.measure(t(k)) / 2), this.y + this.h - 20, i === this.tab ? 'red1' : 'wood3');
    });
    if (this.tab !== 1) fonts.small.draw(ctx, `◀ ▶ ${t('shop_qty', { n: this.qty })}`, this.x + this.w - 70, this.y + this.h - 18, 'wood3');
  }
}
