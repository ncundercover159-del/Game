// Village shops: stock lists (Yorozuya buys and sells; the teahouse and apothecary only sell) and
// Genzō's forge (iron, tool upgrades). Row lists work with keys, mouse and gamepad.
import { fonts } from '../core/text.js';
import { panel, thin, item, hit, rect, iconName } from './widgets.js';
import { t } from '../data/strings.js';
import { itemDef, sellPrice } from '../data/items.js';
import { SHOPS } from '../data/shops.js';
import { TIERS, UPGRADABLE, UPGRADE_DAYS } from '../data/tools.js';
import { dayIndex, SEASONS } from '../systems/calendar.js';
import { sellable } from './ship.js';

const ROW = 18;

class RowShop {
  constructor(game, title, greeting) {
    this.game = game;
    this.title = title;
    this.greeting = greeting;
    this.sel = 0;
    this.qty = 1;
    this.tab = 0;
    this.mx = game.input.mouse.x;
    this.my = game.input.mouse.y;
  }

  layout() {
    const { w, h } = this.game.screen;
    this.w = Math.min(320, w - 16);
    this.h = Math.min(210, h - 40);
    this.x = Math.floor(w / 2 - this.w / 2);
    this.y = Math.floor(h / 2 - this.h / 2) - 8;
    this.visible = Math.floor((this.h - 58) / ROW);
  }

  /** Common list navigation; returns true when the selected row was activated. */
  navigate(input, count) {
    if (input.pressed('up')) { this.sel = (this.sel + count - 1) % count; this.qty = 1; this.game.sfx('ui'); }
    if (input.pressed('down')) { this.sel = (this.sel + 1) % count; this.qty = 1; this.game.sfx('ui'); }
    if (input.pressed('left')) this.qty = Math.max(1, this.qty - 1);
    if (input.pressed('right')) this.qty = Math.min(99, this.qty + 1);
    const m = input.mouse;
    const top = this.scroll();
    let over = -1;
    for (let i = 0; i < Math.min(this.visible, count - top); i++) if (hit(m.x, m.y, this.x + 8, this.rowY(i), this.w - 16, ROW)) over = top + i;
    if (over >= 0 && (m.x !== this.mx || m.y !== this.my) && over !== this.sel) { this.sel = over; this.qty = 1; }
    this.mx = m.x; this.my = m.y;
    return input.pressed('confirm') || (input.pressed('click') && over >= 0);
  }

  scroll() { return Math.max(0, Math.min(this.sel - this.visible + 1, this.sel)); }
  rowY(i) { return this.y + 40 + i * ROW; }

  frame(ctx) {
    const g = this.game;
    this.layout();
    ctx.globalAlpha = 0.45;
    rect(ctx, 'ink0', 0, 0, g.screen.w, g.screen.h);
    ctx.globalAlpha = 1;
    panel(ctx, g.atlas, this.x, this.y, this.w, this.h);
    fonts.big.draw(ctx, this.title, this.x + 10, this.y + 6, 'red1');
    const money = `${g.money.toLocaleString('en-US')} 文`;
    fonts.body.draw(ctx, money, this.x + this.w - 12 - fonts.body.measure(money), this.y + 8, 'red1');
    fonts.body.draw(ctx, fonts.body.wrap(this.greeting, this.w - 20)[0], this.x + 10, this.y + 22, 'wood3');
  }

  drawRows(ctx, rows) {
    const g = this.game, top = this.scroll();
    rows.slice(top, top + this.visible).forEach((r, i) => {
      const y = this.rowY(i), on = top + i === this.sel;
      if (on) thin(ctx, g.atlas, this.x + 8, y - 1, this.w - 16, ROW);
      if (r.icon) g.atlas.draw(ctx, r.icon, this.x + 12, y);
      fonts.body.draw(ctx, r.label, this.x + 32, y + 4, r.disabled ? 'wood4' : on ? 'red1' : 'wood1');
      if (r.right) fonts.body.draw(ctx, r.right, this.x + this.w - 14 - fonts.body.measure(r.right), y + 4, r.disabled ? 'wood4' : 'wood2');
    });
  }
}

/** A shop's stock list; shops that `buys` also take your goods at full price on the Sell tab. */
export class ShopMenu extends RowShop {
  constructor(game, id) {
    const shop = SHOPS[id];
    super(game, `${shop.name} ${shop.jp}`, t(shop.hello));
    this.buys = !!shop.buys;
    this.stock = shop.stock(SEASONS[game.cal.season].id, dayIndex(game.cal) % 7);
  }

  price(s) { return Math.round(itemDef(s.id).price * s.mult); }

  update(dt, input) {
    const g = this.game;
    this.layout();
    if (input.pressed('cancel') || input.pressed('menu') || input.pressed('rclick')) { g.sfx('ui_back'); return false; }
    if (this.buys && (input.pressed('prev') || input.pressed('next'))) { this.tab = 1 - this.tab; this.sel = 0; g.sfx('ui'); }
    const m = input.mouse;
    if (this.buys && input.pressed('click')) [0, 1].forEach((i) => { if (hit(m.x, m.y, this.x + this.w - 120 + i * 56, this.y + this.h - 22, 52, 16)) { this.tab = i; this.sel = 0; } });
    if (this.tab === 0) {
      if (this.navigate(input, this.stock.length)) this.buy(this.stock[this.sel]);
    } else {
      const sellSlots = g.inventory.slots.map((s, i) => [s, i]).filter(([s]) => s && sellable(s.id));
      if (sellSlots.length && this.navigate(input, sellSlots.length)) this.sell(sellSlots[Math.min(this.sel, sellSlots.length - 1)][1]);
    }
    return true;
  }

  buy(s) {
    const g = this.game, cost = this.price(s) * this.qty;
    if (g.money < cost) { g.sfx('deny'); g.toast('shop_poor'); return; }
    if (g.inventory.room(s.id) < this.qty) { g.sfx('deny'); g.aside('tk_full'); return; }
    g.money -= cost;
    g.inventory.add(s.id, this.qty);
    g.sfx('pickup');
    g.toast('shop_bought', { n: this.qty, item: itemDef(s.id).name }, iconName(s.id));
  }

  sell(i) {
    const g = this.game, s = g.inventory.slots[i];
    const value = sellPrice(s.id, s.q) * s.n;
    g.inventory.slots[i] = null;
    g.money += value;
    g.stats.shippedValue += value;
    g.sfx('pickup');
    g.toast('shop_sold', { n: value }, 'icon_coin');
  }

  draw(ctx) {
    const g = this.game;
    this.frame(ctx);
    if (this.tab === 0) {
      this.drawRows(ctx, this.stock.map((s, i) => ({
        icon: iconName(s.id), label: itemDef(s.id).name + (i === this.sel && this.qty > 1 ? `  ×${this.qty}` : ''),
        right: `${this.price(s) * (i === this.sel ? this.qty : 1)} 文${s.mult < 1 ? ' ↓' : ''}`,
      })));
      fonts.small.draw(ctx, `◀ ▶ ${t('shop_qty', { n: this.qty })}`, this.x + 12, this.y + this.h - 18, 'wood3');
    } else {
      const rows = g.inventory.slots.filter((s) => s && sellable(s.id)).map((s) => ({
        icon: iconName(s.id), label: `${itemDef(s.id).name} ×${s.n}`, right: `${sellPrice(s.id, s.q) * s.n} 文`,
      }));
      this.drawRows(ctx, rows);
    }
    if (this.buys) ['shop_buy', 'shop_sell'].forEach((k, i) => {
      const bx = this.x + this.w - 120 + i * 56;
      thin(ctx, g.atlas, bx, this.y + this.h - 22, 52, 16);
      fonts.body.draw(ctx, t(k), Math.round(bx + 26 - fonts.body.measure(t(k)) / 2), this.y + this.h - 20, i === this.tab ? 'red1' : 'wood3');
    });
  }
}

/** Genzō's forge: iron bars and two-day tool upgrades. */
export class ForgeMenu extends RowShop {
  constructor(game) {
    super(game, `${SHOPS.kajiya.name} ${SHOPS.kajiya.jp}`, t(SHOPS.kajiya.hello));
  }

  rows() {
    const g = this.game;
    const rows = [{ icon: 'icon_iron_bar', label: itemDef('iron_bar').name + (this.sel === 0 && this.qty > 1 ? `  ×${this.qty}` : ''), right: `${itemDef('iron_bar').price * (this.sel === 0 ? this.qty : 1)} 文`, act: () => this.buyIron() }];
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

  buyIron() {
    const g = this.game, cost = itemDef('iron_bar').price * this.qty;
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
    g.sfx('harvest');
    g.toast('forge_back', { tool: itemDef(up.tool).name, tier: TIERS[up.tier].name }, iconName(up.tool, g.tiers));
  }

  update(dt, input) {
    const g = this.game;
    this.layout();
    if (input.pressed('cancel') || input.pressed('menu') || input.pressed('rclick')) { g.sfx('ui_back'); return false; }
    const rows = this.rows();
    if (this.navigate(input, rows.length)) {
      const r = rows[this.sel];
      if (r.disabled) g.sfx('deny');
      else r.act();
    }
    return true;
  }

  draw(ctx) {
    this.frame(ctx);
    this.drawRows(ctx, this.rows());
    fonts.small.draw(ctx, `◀ ▶ ${t('shop_qty', { n: this.qty })}`, this.x + 12, this.y + this.h - 18, 'wood3');
  }
}
