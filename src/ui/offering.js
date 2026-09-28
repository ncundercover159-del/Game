// An altar in the shrine hall: its four offering sets, what each still needs, and "Offer" to put
// what you carry toward the selected set.
import { fonts } from '../core/text.js';
import { panel, thin, hit, rect } from './widgets.js';
import { t } from '../data/strings.js';
import { ALTARS, SET_VIRTUE, ALTAR_VIRTUE } from '../data/offerings.js';
import { VIRTUES } from '../data/virtues.js';
import { offer, setDone } from '../systems/offerings.js';
import { restore } from '../flow.js';

const ROW = 36;

export class OfferingMenu {
  constructor(game, altar) {
    this.game = game;
    this.altar = altar;
    this.sel = ALTARS[altar].sets.findIndex((_, i) => !setDone(game.offerings, altar, i));
    if (this.sel < 0) this.sel = 0;
  }

  layout() {
    const { w, h } = this.game.screen;
    this.w = Math.min(340, w - 16);
    this.h = Math.min(4 * ROW + 50, h - 24);
    this.x = Math.floor(w / 2 - this.w / 2);
    this.y = Math.floor(h / 2 - this.h / 2) - 8;
  }

  update(dt, input) {
    const g = this.game, sets = ALTARS[this.altar].sets;
    this.layout();
    if (input.pressed('cancel') || input.pressed('menu') || input.pressed('rclick')) { g.sfx('ui_back'); return false; }
    if (input.pressed('up')) { this.sel = (this.sel + sets.length - 1) % sets.length; g.sfx('ui'); }
    if (input.pressed('down')) { this.sel = (this.sel + 1) % sets.length; g.sfx('ui'); }
    const m = input.mouse;
    let clicked = false;
    sets.forEach((_, i) => { if (input.pressed('click') && hit(m.x, m.y, this.x + 8, this.y + 28 + i * ROW, this.w - 16, ROW - 2)) { this.sel = i; clicked = true; } });
    if (input.pressed('confirm') || clicked) return this.give();
    return true;
  }

  /** Offer toward the selected set; returns false when the menu should close for a restoration. */
  give() {
    const g = this.game, altar = this.altar, set = ALTARS[altar].sets[this.sel];
    const r = offer(g.offerings, altar, this.sel, (id) => g.inventory.count(id), (id, n) => g.inventory.remove(id, n));
    if (!r.gave) { g.sfx('deny'); g.toast('offer_nothing'); return true; }
    g.sfx('plant');
    if (!r.setComplete) return true;
    g.sfx('harvest');
    g.addVirtue(altar, SET_VIRTUE);
    const rw = set.reward;
    if (rw.mon) { g.money += rw.mon; g.toast('offer_mon', { n: rw.mon }, 'icon_coin'); }
    for (const [id, n] of rw.items || []) g.pickUp(id, n);
    g.toast('offer_set', { name: set.name });
    if (!r.altarComplete) return true;
    g.addVirtue(altar, ALTAR_VIRTUE);
    restore(g, altar);
    return false;
  }

  draw(ctx) {
    const g = this.game, atlas = g.atlas, v = VIRTUES[this.altar];
    this.layout();
    ctx.globalAlpha = 0.45;
    rect(ctx, 'ink0', 0, 0, g.screen.w, g.screen.h);
    ctx.globalAlpha = 1;
    panel(ctx, atlas, this.x, this.y, this.w, this.h);
    fonts.big.draw(ctx, t('altar_title', { virtue: v.name, jp: v.jp, en: v.en }), this.x + 10, this.y + 7, 'red1');
    ALTARS[this.altar].sets.forEach((set, i) => {
      const y = this.y + 28 + i * ROW, on = i === this.sel, done = setDone(g.offerings, this.altar, i);
      thin(ctx, atlas, this.x + 8, y, this.w - 16, ROW - 2);
      if (on) rect(ctx, 'red2', this.x + 9, y + 1, 2, ROW - 4);
      fonts.body.draw(ctx, set.name, this.x + 16, y + 3, done ? 'grass2' : on ? 'red1' : 'wood1');
      if (done) fonts.body.draw(ctx, t('offer_done'), this.x + this.w - 16 - fonts.body.measure(t('offer_done')), y + 3, 'grass2');
      set.items.forEach(([id, need], k) => {
        const have = g.offerings[this.altar][i][k];
        const ix = this.x + 16 + k * 56;
        if (have < need) ctx.globalAlpha = 0.55;
        atlas.draw(ctx, `icon_${id}`, ix, y + 15);
        ctx.globalAlpha = 1;
        fonts.small.draw(ctx, `${have}/${need}`, ix + 18, y + 20, have >= need ? 'grass2' : 'wood2');
      });
    });
    fonts.small.draw(ctx, t('offer_help'), this.x + 10, this.y + this.h - 13, 'wood3');
  }
}
