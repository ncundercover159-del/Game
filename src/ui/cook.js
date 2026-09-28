// Cooking at the farmhouse irori and crafting from the menu share one list layout: a recipe per row
// with its ingredients (have/need), confirm to make one. Locked recipes show what unlocks them.
import { fonts } from '../core/text.js';
import { panel, thin, hit, rect, iconName } from './widgets.js';
import { t } from '../data/strings.js';
import { itemDef } from '../data/items.js';
import { DISHES, CRAFTS } from '../data/recipes.js';
import { XP } from '../data/skills.js';
import { hasAll, craftNeeds } from '../systems/craft.js';
import { levelOf, hasPerk } from '../systems/skills.js';

const ROW = 22;

/** Draw recipe rows (shared by cooking and the Craft tab). */
export function drawRecipes(ctx, g, rows, sel, x, y, w, visible) {
  const top = Math.max(0, Math.min(sel - visible + 1, rows.length - visible));
  rows.slice(top, top + visible).forEach((r, k) => {
    const i = top + k, ry = y + k * ROW, on = i === sel;
    if (on) thin(ctx, g.atlas, x, ry - 1, w, ROW);
    if (r.locked) {
      fonts.body.draw(ctx, t('recipe_locked', { lv: r.locked }), x + 6, ry + 5, 'wood3');
      return;
    }
    g.atlas.draw(ctx, iconName(r.id), x + 3, ry + 2);
    fonts.body.draw(ctx, itemDef(r.id).name, x + 22, ry + 5, r.ok ? (on ? 'red1' : 'wood1') : 'wood3');
    r.needs.forEach(([id, n], j) => {
      const ix = x + w - 4 - (r.needs.length - j) * 36;
      if (g.inventory.count(id) < n) ctx.globalAlpha = 0.45;
      g.atlas.draw(ctx, iconName(id), ix, ry + 2);
      ctx.globalAlpha = 1;
      fonts.small.draw(ctx, `${n}`, ix + 17, ry + 9, g.inventory.count(id) >= n ? 'wood1' : 'red2');
    });
  });
}

/** Move a selection through rows with keys and mouse; returns true when a row was activated. */
export function pickRow(input, state, count, x, y, w) {
  if (!count) return false;
  if (input.pressed('up')) state.sel = (state.sel + count - 1) % count;
  if (input.pressed('down')) state.sel = (state.sel + 1) % count;
  const m = input.mouse;
  let clicked = false;
  if (input.pressed('click')) for (let i = 0; i < count; i++) if (hit(m.x, m.y, x, y + i * ROW, w, ROW)) { state.sel = i; clicked = true; }
  return input.pressed('confirm') || clicked;
}

export class CookMenu {
  constructor(game) {
    this.game = game;
    this.sel = 0;
  }

  rows() {
    const g = this.game;
    return g.recipes.map((id) => ({ id, needs: DISHES[id].needs, ok: hasAll(DISHES[id].needs, (i) => g.inventory.count(i)) }));
  }

  layout() {
    const { w, h } = this.game.screen;
    this.w = Math.min(320, w - 16);
    this.h = Math.min(220, h - 24);
    this.x = Math.floor(w / 2 - this.w / 2);
    this.y = Math.floor(h / 2 - this.h / 2) - 8;
  }

  update(dt, input) {
    const g = this.game;
    this.layout();
    if (input.pressed('cancel') || input.pressed('menu') || input.pressed('rclick')) { g.sfx('ui_back'); return false; }
    const rows = this.rows();
    if (pickRow(input, this, rows.length, this.x + 8, this.y + 28, this.w - 16)) this.cook(rows[this.sel]);
    return true;
  }

  cook(r) {
    const g = this.game;
    if (!r.ok) { g.sfx('deny'); g.toast('cook_missing'); return; }
    if (g.inventory.room(r.id) < 1) { g.sfx('deny'); g.aside('tk_full'); return; }
    for (const [id, n] of r.needs) g.inventory.remove(id, n);
    g.pickUp(r.id, 1);
    g.xp('craft', XP.cook);
    g.sfx('eat');
  }

  draw(ctx) {
    const g = this.game;
    this.layout();
    ctx.globalAlpha = 0.45;
    rect(ctx, 'ink0', 0, 0, g.screen.w, g.screen.h);
    ctx.globalAlpha = 1;
    panel(ctx, g.atlas, this.x, this.y, this.w, this.h);
    fonts.big.draw(ctx, t('cook_title'), this.x + 10, this.y + 7, 'red1');
    drawRecipes(ctx, g, this.rows(), this.sel, this.x + 8, this.y + 28, this.w - 16, Math.floor((this.h - 44) / ROW));
    fonts.small.draw(ctx, t('cook_help'), this.x + 10, this.y + this.h - 13, 'wood3');
  }
}

/** The Craft tab of the pause menu: machines and tools, unlocked by Craftsmanship. */
export class CraftPage {
  constructor(game) {
    this.game = game;
    this.sel = 0;
  }

  rows() {
    const g = this.game, lv = levelOf(g.skills.craft.xp), thrifty = hasPerk(g.skills, 'thrifty');
    return Object.entries(CRAFTS).map(([id, c]) => {
      if (c.lv > lv) return { id, locked: c.lv, needs: [] };
      const needs = craftNeeds(id, thrifty);
      return { id, needs, ok: hasAll(needs, (i) => g.inventory.count(i)) };
    });
  }

  update(input, x, y, w) {
    const rows = this.rows();
    if (pickRow(input, this, rows.length, x + 8, y + 8, w - 16)) this.craft(rows[this.sel]);
  }

  craft(r) {
    const g = this.game;
    if (r.locked || !r.ok) { g.sfx('deny'); return; }
    if (g.inventory.room(r.id) < 1) { g.sfx('deny'); g.aside('tk_full'); return; }
    for (const [id, n] of r.needs) g.inventory.remove(id, n);
    g.pickUp(r.id, CRAFTS[r.id].n || 1);
    g.xp('craft', XP.craft);
    g.sfx('rock');
  }

  draw(ctx, x, y, w, h) {
    drawRecipes(ctx, this.game, this.rows(), this.sel, x + 8, y + 8, w - 16, Math.floor((h - 26) / ROW));
  }
}
