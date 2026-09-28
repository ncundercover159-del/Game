// HUD: clock plate with sun/moon dial, money, Genki bar, 12-slot hotbar, pickup toasts and
// Tsukikage's asides.
import { fonts } from '../core/text.js';
import { panel, thin, dark, rect, item, hit } from './widgets.js';
import { t } from '../data/strings.js';
import { itemDef } from '../data/items.js';
import { SEASONS, weekday, formatTime, zodiacHour, DAY_START, DAY_END, dayIndex } from '../systems/calendar.js';
import { stamp } from '../systems/skills.js';
import { canCapacity } from '../systems/tools.js';

const SLOT = 18;
const TOAST_LIFE = 2.6;
const BUFF_ICONS = { speed: 'icon_waraji', farming: 'icon_daikon', foraging: 'icon_warabi', fishing: 'icon_rod' };
const ASIDE_LIFE = 7;

export class Hud {
  constructor(game) {
    this.game = game;
    this.toasts = [];
    this.aside = null;
    this.asideQueue = [];
    this.flash = 0;
  }

  hotbarRect() {
    const { w, h } = this.game.screen;
    const n = this.game.inventory.size >= 12 ? 12 : this.game.inventory.size;
    const bw = n * SLOT + 8;
    return { x: Math.floor(w / 2 - bw / 2), y: h - 30, w: bw, h: 26, n };
  }

  /** Slot index under the mouse, or -1. */
  slotAt(mx, my) {
    const r = this.hotbarRect();
    if (!hit(mx, my, r.x, r.y, r.w, r.h)) return -1;
    const i = Math.floor((mx - r.x - 4) / SLOT);
    return i >= 0 && i < r.n ? i : -1;
  }

  toast(text, icon) {
    const last = this.toasts[this.toasts.length - 1];
    if (last && last.key === text + icon && last.t < TOAST_LIFE - 0.4) {
      last.t = 0;
      return;
    }
    this.toasts.push({ text, icon, t: 0, key: text + icon });
    if (this.toasts.length > 5) this.toasts.shift();
  }

  /** Update a merged pickup toast: "+3 Wood" instead of three separate toasts. */
  pickup(id, n) {
    const found = this.toasts.find((q) => q.id === id && q.t < TOAST_LIFE - 0.3);
    if (found) {
      found.n += n;
      found.t = 0;
      found.text = t('toast_got', { n: found.n, item: itemDef(id).name });
      return;
    }
    this.toasts.push({ id, n, text: t('toast_got', { n, item: itemDef(id).name }), icon: `icon_${id}`, t: 0 });
    if (this.toasts.length > 5) this.toasts.shift();
  }

  say(text) {
    if (this.aside && this.aside.text === text) return;
    if (this.aside) this.asideQueue.push(text);
    else this.aside = { text, t: 0 };
  }

  update(dt) {
    for (const q of this.toasts) q.t += dt;
    this.toasts = this.toasts.filter((q) => q.t < TOAST_LIFE);
    if (this.aside) {
      this.aside.t += dt;
      if (this.aside.t > ASIDE_LIFE) this.aside = this.asideQueue.length ? { text: this.asideQueue.shift(), t: 0 } : null;
    }
    this.flash = Math.max(0, this.flash - dt);
  }

  draw(ctx) {
    const g = this.game;
    const atlas = g.atlas;
    const { w, h } = g.screen;
    this.drawClock(ctx, atlas, w);
    this.drawGenki(ctx, atlas, w, h);
    this.drawHotbar(ctx, atlas);
    this.drawToasts(ctx, atlas, h);
    this.drawAside(ctx, atlas);
  }

  drawClock(ctx, atlas, w) {
    const g = this.game;
    const cal = g.cal;
    const x = w - 100, y = 4;
    panel(ctx, atlas, x, y, 96, 42);
    // Dial: sky half-disc with the sun (day) or moon (night) travelling along the arc.
    const night = cal.minutes >= 19 * 60 || cal.minutes < DAY_START;
    const dx = x + 5, dy = y + 5;
    rect(ctx, 'wood1', dx - 1, dy - 1, 28, 16);
    atlas.draw(ctx, night ? 'ui_dial_night' : 'ui_dial_day', dx, dy);
    const span = night ? [19 * 60, DAY_END] : [DAY_START, 19 * 60];
    const f = Math.max(0, Math.min(1, (g.smoothMinutes() - span[0]) / (span[1] - span[0])));
    const ang = Math.PI * (1 - f);
    atlas.draw(ctx, night ? 'ui_moon' : 'ui_sun', Math.round(dx + 13 + Math.cos(ang) * 10), Math.round(dy + 13 - Math.sin(ang) * 10));
    rect(ctx, 'wood1', dx - 1, dy + 14, 28, 1);
    const s = SEASONS[cal.season];
    fonts.big.draw(ctx, s.jp, dx - 1, dy + 18, 'red1');
    atlas.draw(ctx, `wx_${g.weather}`, dx + 14, dy + 21);
    // Date and time.
    const tx = x + 36;
    fonts.body.draw(ctx, `${s.name} ${cal.day}`, tx, y + 6, 'wood1');
    fonts.body.draw(ctx, weekday(cal).jp, x + 82, y + 6, 'wood2');
    rect(ctx, 'wood3', tx, y + 18, 54, 1);
    fonts.big.draw(ctx, formatTime(cal.minutes), tx, y + 22, 'red1');
    fonts.body.draw(ctx, zodiacHour(cal.minutes).jp, x + 82, y + 24, 'wood2');
    // Money.
    const my = y + 44;
    thin(ctx, atlas, x + 6, my, 90, 16);
    atlas.draw(ctx, 'icon_coin', x + 10, my + 4);
    const str = t('hud_money', { n: g.money.toLocaleString('en-US') });
    fonts.body.draw(ctx, str, x + 92 - fonts.body.measure(str), my + 3, 'red1');
    this.drawBuffs(ctx, atlas, x + 96, my + 20);
  }

  /** Food buffs under the money plate, right to left, each with its hours left. */
  drawBuffs(ctx, atlas, right, y) {
    const g = this.game, now = stamp(dayIndex(g.cal), g.cal.minutes);
    g.buffs.forEach((b, i) => {
      const x = right - (i + 1) * 22;
      dark(ctx, atlas, x, y, 20, 22);
      atlas.draw(ctx, BUFF_ICONS[b.kind], x + 2, y + 1);
      fonts.small.draw(ctx, `${Math.max(1, Math.ceil((b.until - now) / 60))}h`, x + 4, y + 15, 'ink6');
    });
  }

  drawGenki(ctx, atlas, w, h) {
    const g = this.game;
    const bh = 64, bx = w - 16, by = h - bh - 6;
    panel(ctx, atlas, bx - 2, by, 14, bh);
    const inner = bh - 10;
    const f = Math.max(0, g.genki / g.genkiMax);
    const fill = Math.round(inner * f);
    rect(ctx, 'ink1', bx + 3, by + 5, 4, inner);
    const col = f > 0.5 ? ['grass3', 'grass5'] : f > 0.2 ? ['gold1', 'gold2'] : ['red1', 'red3'];
    if (this.flash > 0 && Math.floor(this.flash * 12) % 2) col[0] = col[1] = 'ink6';
    rect(ctx, col[0], bx + 3, by + 5 + inner - fill, 4, fill);
    rect(ctx, col[1], bx + 3, by + 5 + inner - fill, 1, fill);
    dark(ctx, atlas, bx - 3, by - 13, 16, 13);
    fonts.body.draw(ctx, t('genki'), bx, by - 12, 'gold2');
  }

  drawHotbar(ctx, atlas) {
    const g = this.game;
    const r = this.hotbarRect();
    panel(ctx, atlas, r.x, r.y, r.w, r.h);
    const inv = g.inventory;
    for (let i = 0; i < r.n; i++) {
      const sx = r.x + 4 + i * SLOT, sy = r.y + 4;
      atlas.draw(ctx, 'ui_slot', sx, sy);
      const s = inv.slots[i];
      item(ctx, atlas, s, sx + 1, sy + 1, g.tiers);
      if (s && s.id === 'can') {
        rect(ctx, 'ink1', sx + 2, sy + 15, 14, 2);
        rect(ctx, 'water3', sx + 2, sy + 15, Math.round((14 * g.can) / canCapacity(g.tiers.can)), 2);
      }
    }
    atlas.draw(ctx, 'ui_slot_sel', r.x + 3 + inv.selected * SLOT, r.y + 3);
    const cur = inv.current;
    if (cur && !g.modals.length) {
      const d = itemDef(cur.id);
      const label = `${d.name} ${d.jp}`;
      const lw = fonts.body.measure(label);
      const lx = Math.round(r.x + r.w / 2 - lw / 2 - 5);
      dark(ctx, atlas, lx, r.y - 16, lw + 10, 14);
      fonts.body.draw(ctx, label, lx + 5, r.y - 14, 'ink6');
    }
  }

  drawToasts(ctx, atlas, h) {
    let y = h - 52;
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const q = this.toasts[i];
      const slide = Math.min(1, q.t * 8);
      const fade = q.t > TOAST_LIFE - 0.4 ? (TOAST_LIFE - q.t) / 0.4 : 1;
      const tw = fonts.body.measure(q.text) + (q.icon ? 24 : 10);
      const x = Math.round(-tw + (tw + 6) * slide);
      ctx.globalAlpha = Math.max(0, fade);
      thin(ctx, atlas, x, y, tw, 20);
      if (q.icon) atlas.draw(ctx, q.icon, x + 3, y + 2);
      fonts.body.draw(ctx, q.text, x + (q.icon ? 21 : 5), y + 4, 'wood1');
      ctx.globalAlpha = 1;
      y -= 22;
    }
  }

  drawAside(ctx, atlas) {
    const a = this.aside;
    if (!a) return;
    const maxW = Math.min(250, this.game.screen.w - 120);
    const lines = fonts.body.wrap(a.text, maxW);
    const bw = maxW + 12, bh = 18 + lines.length * 12;
    const fade = a.t > ASIDE_LIFE - 0.5 ? (ASIDE_LIFE - a.t) / 0.5 : Math.min(1, a.t * 6);
    ctx.globalAlpha = Math.max(0, fade);
    dark(ctx, atlas, 4, 4, bw, bh);
    fonts.body.draw(ctx, `${t('tk_name')} 月影`, 10, 7, 'gold2');
    lines.forEach((l, i) => fonts.body.draw(ctx, l, 10, 20 + i * 12, 'ink6'));
    ctx.globalAlpha = 1;
  }
}
