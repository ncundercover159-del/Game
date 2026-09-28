// Village shops: stock lists (Yorozuya buys and sells; the teahouse and apothecary only sell).
// Row lists work with keys, mouse and gamepad; Genzō's forge (ui/forge.js) shares them.
import { fonts } from '../core/text.js';
import { panel, thin, item, hit, rect, iconName } from './widgets.js';
import { t } from '../data/strings.js';
import { itemDef } from '../data/items.js';
import { sellValue } from '../systems/skills.js';
import { adopt } from '../systems/animals.js';
import { buyMult } from '../systems/virtues.js';
import { SHOPS } from '../data/shops.js';
import { dayIndex, SEASONS } from '../systems/calendar.js';
import { sellable } from './ship.js';
import { orderHouse } from '../home.js';

const ROW = 18;

export class RowShop {
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
    this.stock = shop.stock(SEASONS[game.cal.season].id, dayIndex(game.cal) % 7, game);
  }

  price(s) { return Math.round(itemDef(s.id).price * s.mult * buyMult(this.game.virtues)); }

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
    const def = itemDef(s.id);
    if (def.kind === 'upgrade') {
      if (g.inventory.size >= def.slots) { g.sfx('deny'); g.toast('pack_have'); return; }
      g.money -= this.price(s);
      g.inventory.resize(def.slots);
      g.sfx('harvest');
      g.toast('pack_bought', { n: def.slots }, iconName(s.id));
      this.stock = this.stock.filter((x) => x !== s);
      this.sel = Math.min(this.sel, this.stock.length - 1);
      return;
    }
    if (def.kind === 'building') {
      if (!orderHouse(g, def)) return;
      g.money -= this.price(s);
      g.sfx('harvest');
      this.stock = this.stock.filter((x) => x !== s);
      this.sel = Math.min(this.sel, this.stock.length - 1);
      return;
    }
    if (def.kind === 'livestock') {
      // Animals go straight to the coop, one at a time.
      const a = adopt(g.animals, def.animal, g.seed + g.animals.nextId);
      if (!a) { g.sfx('deny'); g.toast('coop_full'); return; }
      g.money -= this.price(s);
      g.sfx('pickup');
      g.toast('coop_new', { name: a.name, kind: def.name }, iconName(s.id));
      return;
    }
    if (g.inventory.room(s.id) < this.qty) { g.sfx('deny'); g.aside('tk_full'); return; }
    g.money -= cost;
    g.inventory.add(s.id, this.qty);
    g.sfx('pickup');
    g.toast('shop_bought', { n: this.qty, item: itemDef(s.id).name }, iconName(s.id));
  }

  sell(i) {
    const g = this.game, s = g.inventory.slots[i];
    const value = sellValue(g.skills, s.id, s.q) * s.n;
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
        icon: iconName(s.id), label: `${itemDef(s.id).name} ×${s.n}`, right: `${sellValue(g.skills, s.id, s.q) * s.n} 文`,
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
