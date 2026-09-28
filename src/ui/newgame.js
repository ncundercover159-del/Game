// The new-farm screen, step by step: your name and your farm's (typed, or picked from a letter
// grid with a pad or a finger), how you look (with a turning preview), how hard the mountain is,
// how the farm has gone to seed (with a little map of it), then a last look before you begin.
// Cancel steps back; from the first step it returns to the title.
import { fonts } from '../core/text.js';
import { panel, thin, rect, hit, centre } from './widgets.js';
import { t } from '../data/strings.js';
import { LOOK_PARTS, DEFAULT_LOOK } from '../data/appearance.js';
import { LAYOUTS, LAYOUT_IDS } from '../data/layouts.js';
import { START } from '../data/start.js';
import { MAPS } from '../maps/index.js';
import { GameMap, G } from '../world/gamemap.js';
import { decorate, populate } from '../world/populate.js';
import { gridToCanvas } from '../art/compiler.js';
import { grid, set } from '../art/raster.js';

const STEPS = ['name', 'farm', 'look', 'difficulty', 'layout', 'confirm'];
const GRID = ['ABCDEFGHIJKLM', 'NOPQRSTUVWXYZ', 'abcdefghijklm', 'nopqrstuvwxyz'];
const SPECIAL = ['ō', 'ū', '-', '␣', '⌫', 'OK'];
const MAX_NAME = 12;
const ALLOWED = /^[A-Za-zÀ-ÿĀ-ſ' -]$/;
const DIFFS = ['relaxed', 'standard', 'warrior'];
const PARTS = Object.keys(LOOK_PARTS);
const KEY_W = 14, KEY_H = 13;

export class NewFarm {
  constructor(game, { slot, onDone, onCancel }) {
    this.game = game;
    this.slot = slot;
    this.onDone = onDone;
    this.onCancel = onCancel;
    this.seed = Number(game.params.get('seed')) || (Date.now() % 2147483647);
    this.opts = { name: START.name, farm: START.farm, look: { ...DEFAULT_LOOK }, difficulty: 'standard', layout: 'hinata' };
    this.step = 0;
    this.sel = 0;
    this.gx = 5; this.gy = GRID.length;        // the letter grid's cursor starts on OK
    this.t = 0;
    this.maps = {};
    this.enter(0);
  }

  get kind() { return STEPS[this.step]; }

  enter(i) {
    this.step = i;
    this.sel = 0;
    const g = this.game;
    if (this.kind === 'name' || this.kind === 'farm') {
      this.gx = SPECIAL.length - 1; this.gy = GRID.length;
      g.input.textListener = (key) => this.type(key);
    } else g.input.textListener = null;
    if (this.kind === 'difficulty') this.sel = DIFFS.indexOf(this.opts.difficulty);
    if (this.kind === 'layout') this.sel = LAYOUT_IDS.indexOf(this.opts.layout);
    g.wearLook(this.opts.look);
  }

  close() { this.game.input.textListener = null; }

  /** A typed key (or a grid key) into the name being edited. */
  type(key) {
    const field = this.kind, v = this.opts[field];
    if (key === 'Backspace') this.opts[field] = v.slice(0, -1);
    else if (key.length === 1 && ALLOWED.test(key) && v.length < MAX_NAME && !(key === ' ' && (!v || v.endsWith(' ')))) this.opts[field] = v + key;
    else return;
    this.game.sfx('ui');
  }

  next() {
    const g = this.game;
    if ((this.kind === 'name' || this.kind === 'farm') && !this.opts[this.kind].trim()) { g.sfx('deny'); return; }
    this.opts.name = this.opts.name.trim();
    this.opts.farm = this.opts.farm.trim();
    g.sfx('ui_ok');
    if (this.step === STEPS.length - 1) { this.close(); this.onDone({ ...this.opts, seed: this.seed }); return; }
    this.enter(this.step + 1);
  }

  back() {
    this.game.sfx('ui_back');
    if (this.step === 0) { this.close(); this.onCancel(); return; }
    this.enter(this.step - 1);
  }

  update(dt, input) {
    this.t += dt;
    // Backspace never gets here while a name is typed (it deletes); Escape or the pad's B steps back.
    if (input.pressed('cancel')) { this.back(); return; }
    this[`update_${this.kind === 'farm' ? 'name' : this.kind}`](input);
  }

  // ---------------------------------------------------------------- the letter grid

  keyAt(gx, gy) { return gy < GRID.length ? GRID[gy][gx] : SPECIAL[gx]; }
  rowLen(gy) { return gy < GRID.length ? GRID[gy].length : SPECIAL.length; }

  update_name(input) {
    const rows = GRID.length + 1;
    if (input.pressed('up')) { this.gy = (this.gy + rows - 1) % rows; this.gx = Math.min(this.gx, this.rowLen(this.gy) - 1); }
    if (input.pressed('down')) { this.gy = (this.gy + 1) % rows; this.gx = Math.min(this.gx, this.rowLen(this.gy) - 1); }
    if (input.pressed('left')) this.gx = (this.gx + this.rowLen(this.gy) - 1) % this.rowLen(this.gy);
    if (input.pressed('right')) this.gx = (this.gx + 1) % this.rowLen(this.gy);
    const m = input.mouse;
    if (input.pressed('click')) {
      for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < this.rowLen(gy); gx++) {
        const r = this.keyRect(gx, gy);
        if (hit(m.x, m.y, r.x, r.y, r.w, KEY_H)) { this.gx = gx; this.gy = gy; this.press(); }
      }
      return;
    }
    if (input.pressed('confirm')) this.press();
  }

  press() {
    const k = this.keyAt(this.gx, this.gy);
    if (k === 'OK') this.next();
    else if (k === '⌫') this.type('Backspace');
    else if (k === '␣') this.type(' ');
    else this.type(k);
  }

  // ---------------------------------------------------------------- the other steps

  update_look(input) {
    const n = PARTS.length + 1;
    if (input.pressed('up')) this.sel = (this.sel + n - 1) % n;
    if (input.pressed('down')) this.sel = (this.sel + 1) % n;
    const change = (d) => {
      const p = PARTS[this.sel], len = LOOK_PARTS[p].length;
      this.opts.look = { ...this.opts.look, [p]: (this.opts.look[p] + d + len) % len };
      this.game.wearLook(this.opts.look);
      this.game.sfx('ui');
    };
    const m = input.mouse;
    if (input.pressed('click')) {
      for (let i = 0; i < n; i++) if (hit(m.x, m.y, this.x + 12, this.y + 40 + i * 16, 150, 16)) { this.sel = i; if (i === PARTS.length) this.next(); else change(m.x < this.x + 90 ? -1 : 1); }
      return;
    }
    if (this.sel < PARTS.length) {
      if (input.pressed('left')) change(-1);
      if (input.pressed('right') || input.pressed('confirm')) change(1);
    } else if (input.pressed('confirm')) this.next();
  }

  pickFrom(input, list, field) {
    if (input.pressed('up')) { this.sel = (this.sel + list.length - 1) % list.length; this.game.sfx('ui'); }
    if (input.pressed('down')) { this.sel = (this.sel + 1) % list.length; this.game.sfx('ui'); }
    const m = input.mouse;
    let clicked = false;
    if (input.pressed('click')) for (let i = 0; i < list.length; i++) if (hit(m.x, m.y, this.x + 12, this.y + 40 + i * 16, 150, 16)) { this.sel = i; clicked = true; }
    this.opts[field] = list[this.sel];
    if (clicked || input.pressed('confirm')) this.next();
  }

  update_difficulty(input) { this.pickFrom(input, DIFFS, 'difficulty'); }
  update_layout(input) { this.pickFrom(input, LAYOUT_IDS, 'layout'); }

  update_confirm(input) {
    const m = input.mouse;
    if (input.pressed('up') || input.pressed('down')) { this.sel = 1 - this.sel; this.game.sfx('ui'); }
    let clicked = false;
    if (input.pressed('click')) for (let i = 0; i < 2; i++) if (hit(m.x, m.y, this.x + 12, this.y + this.h - 44 + i * 16, 120, 16)) { this.sel = i; clicked = true; }
    if (clicked || input.pressed('confirm')) { if (this.sel === 0) this.next(); else this.back(); }
  }

  // ---------------------------------------------------------------- drawing

  layout() {
    const { w, h } = this.game.screen;
    this.w = Math.min(380, w - 16);
    this.h = Math.min(220, h - 24);
    this.x = Math.floor(w / 2 - this.w / 2);
    this.y = Math.floor(h / 2 - this.h / 2);
  }

  keyRect(gx, gy) {
    const special = gy >= GRID.length, kw = special ? 26 : KEY_W;
    const rowW = this.rowLen(gy) * kw;
    return { x: Math.floor(this.x + this.w / 2 - rowW / 2) + gx * kw, y: this.y + 70 + gy * (KEY_H + 2), w: kw - 2 };
  }

  draw(ctx) {
    this.layout();
    const g = this.game;
    panel(ctx, g.atlas, this.x, this.y, this.w, this.h);
    fonts.small.draw(ctx, t('ng_title', { step: this.step + 1, of: STEPS.length }), this.x + 12, this.y + 8, 'wood3');
    fonts.big.draw(ctx, t(`ng_${this.kind}`), this.x + 12, this.y + 20, 'red1');
    this[`draw_${this.kind === 'farm' ? 'name' : this.kind}`](ctx);
    fonts.small.draw(ctx, t(this.kind === 'name' || this.kind === 'farm' ? 'ng_help_type' : 'ng_help'), this.x + 12, this.y + this.h - 13, 'wood3');
  }

  draw_name(ctx) {
    const g = this.game, v = this.opts[this.kind];
    const fw = 150, fx = Math.floor(this.x + this.w / 2 - fw / 2), fy = this.y + 42;
    thin(ctx, g.atlas, fx, fy, fw, 20);
    const shown = this.kind === 'farm' ? `${v}${t('ng_farm_suffix')}` : v;
    fonts.big.draw(ctx, shown, fx + 8, fy + 4, 'wood1');
    if (Math.floor(this.t * 2) % 2 === 0) rect(ctx, 'red2', fx + 8 + fonts.big.measure(v) + 1, fy + 4, 1, 12);
    for (let gy = 0; gy <= GRID.length; gy++) for (let gx = 0; gx < this.rowLen(gy); gx++) {
      const r = this.keyRect(gx, gy), on = gx === this.gx && gy === this.gy, k = this.keyAt(gx, gy);
      if (on) thin(ctx, g.atlas, r.x - 1, r.y - 1, r.w + 2, KEY_H + 2);
      centre(ctx, fonts.body, k, r.x + r.w / 2, r.y + 2, on ? 'red1' : k === 'OK' ? 'red2' : 'wood1');
    }
  }

  draw_look(ctx) {
    const g = this.game;
    PARTS.forEach((p, i) => {
      const y = this.y + 40 + i * 16, on = i === this.sel;
      if (on) fonts.big.draw(ctx, '▶', this.x + 12, y, 'red2');
      fonts.big.draw(ctx, t(`ng_look_${p}`), this.x + 24, y, on ? 'red1' : 'wood1');
      const v = `◀ ${t(`ng_${p}_${this.opts.look[p]}`)} ▶`;
      fonts.big.draw(ctx, v, this.x + 190 - fonts.big.measure(v), y, 'wood1');
    });
    const ny = this.y + 40 + PARTS.length * 16, on = this.sel === PARTS.length;
    if (on) fonts.big.draw(ctx, '▶', this.x + 12, ny + 4, 'red2');
    fonts.big.draw(ctx, t('ng_next'), this.x + 24, ny + 4, on ? 'red1' : 'wood2');
    this.preview(ctx, this.x + this.w - 90, this.y + 150);
  }

  /** The player at three times size, turning slowly on the spot. */
  preview(ctx, cx, by) {
    const dirs = ['down', 'right', 'up', 'right'], i = Math.floor(this.t / 1.2) % 4;
    thin(ctx, this.game.atlas, cx - 40, by - 110, 80, 118);
    ctx.save();
    ctx.scale(3, 3);
    this.game.atlas.draw(ctx, `player_${dirs[i]}_walk${Math.floor(this.t * 6) % 4}`, cx / 3, by / 3, i === 3);
    ctx.restore();
  }

  draw_difficulty(ctx) {
    this.list(ctx, DIFFS.map((d) => t(`diff_${d}`)));
    this.wrap(ctx, t(`ng_diff_${DIFFS[this.sel]}`), this.y + 100);
  }

  draw_layout(ctx) {
    const id = LAYOUT_IDS[this.sel], L = LAYOUTS[id];
    this.list(ctx, LAYOUT_IDS.map((l) => `${LAYOUTS[l].name} ${LAYOUTS[l].jp}`));
    this.wrap(ctx, L.desc, this.y + 100, this.w - 170);
    const map = this.miniMap(id);
    thin(ctx, this.game.atlas, this.x + this.w - map.width - 16, this.y + 36, map.width + 8, map.height + 8);
    ctx.drawImage(map, this.x + this.w - map.width - 12, this.y + 40);
  }

  draw_confirm(ctx) {
    const o = this.opts, lines = [
      t('ng_sum_name', { name: o.name }), t('ng_sum_farm', { farm: o.farm }),
      t('ng_sum_difficulty', { d: t(`diff_${o.difficulty}`) }), t('ng_sum_layout', { l: LAYOUTS[o.layout].name }),
    ];
    lines.forEach((l, i) => fonts.big.draw(ctx, l, this.x + 12, this.y + 42 + i * 16, 'wood1'));
    ['ng_begin', 'menu_back'].forEach((k, i) => {
      const y = this.y + this.h - 44 + i * 16, on = i === this.sel;
      if (on) fonts.big.draw(ctx, '▶', this.x + 12, y, 'red2');
      fonts.big.draw(ctx, t(k), this.x + 24, y, on ? 'red1' : 'wood1');
    });
    this.preview(ctx, this.x + this.w - 90, this.y + 150);
  }

  list(ctx, labels) {
    labels.forEach((l, i) => {
      const y = this.y + 40 + i * 16, on = i === this.sel;
      if (on) fonts.big.draw(ctx, '▶', this.x + 12, y, 'red2');
      fonts.big.draw(ctx, l, this.x + 24, y, on ? 'red1' : 'wood1');
    });
  }

  wrap(ctx, text, y, w = this.w - 24) {
    fonts.body.wrap(text, w).forEach((l, i) => fonts.body.draw(ctx, l, this.x + 12, y + i * 12, 'wood2'));
  }

  /** The farm as this layout grows it, two pixels a tile: ground, overgrowth, trees, buildings. */
  miniMap(id) {
    if (this.maps[id]) return this.maps[id];
    const map = new GameMap(MAPS.farm);
    decorate(map);
    populate(map, this.seed, LAYOUTS[id]);
    const GROUND = { [G.GRASS]: 'grass3', [G.DIRT]: 'wood3', [G.WATER]: 'water2', [G.PATH]: 'stone3', [G.BRIDGE]: 'wood2', [G.STEPS]: 'stone2' };
    const DOT = { weed: 'grass5', stone: 'stone3', twig: 'wood2', stump: 'wood1', tree: 'grass1', forest: 'grass0', bamboo: 'grass4', log: 'wood1', boulder: 'stone1', fence: 'wood2', ishigaki: 'stone2' };
    const s = 2, gr = grid(map.w * s, map.h * s);
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const o = map.objectAt(x, y), c = (o && DOT[o.type]) || GROUND[map.ground[map.i(x, y)]] || 'ink3';
      for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) set(gr, x * s + dx, y * s + dy, c);
    }
    for (const b of map.buildings) for (let y = b.ty * s; y < (b.ty + b.h) * s; y++) for (let x = b.tx * s; x < (b.tx + b.w) * s; x++) set(gr, x, y, 'wood0');
    this.maps[id] = gridToCanvas(gr);
    return this.maps[id];
  }
}
