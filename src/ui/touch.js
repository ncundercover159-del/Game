// Touch controls, shown on touch screens (or always, by setting): a stick that appears under the
// left thumb, Use / Interact / Back-and-dodge (and Parry underground) under the right thumb, and the
// menu in the bottom-left corner. Anywhere else a tap is a click, so lists, menus, the hotbar, the new-farm
// letters and dialogue all answer to a finger. It drives Input through touch sources.
import { fonts } from '../core/text.js';
import { rect } from './widgets.js';
import { t } from '../data/strings.js';

const DEAD = 6;          // px the thumb moves before the stick counts
const REACH = 22;        // px of stick travel drawn

export class TouchControls {
  constructor(game, screen, input) {
    this.game = game;
    this.screen = screen;
    this.input = input;
    this.seen = false;         // a touch has happened (the Auto setting shows the controls then)
    this.stick = null;         // { id, ox, oy, x, y }
    this.dirs = new Set();
    this.held = new Map();     // pointerId -> button id
    const c = screen.display;
    if (!c) return;
    c.addEventListener('pointerdown', (e) => this.down(e));
    c.addEventListener('pointermove', (e) => this.move(e));
    addEventListener('pointerup', (e) => this.up(e));
    addEventListener('pointercancel', (e) => this.up(e));
  }

  get shown() {
    const s = this.game.settings.touch;
    return s === 'on' || (s === 'auto' && this.seen);
  }

  /** The stick works in play with nothing open, or under a minigame that steers. */
  get stickable() {
    const g = this.game, top = g.modals.at(-1);
    return g.scene === 'play' && (!top || top.stick);
  }

  buttons() {
    const { w, h } = this.screen, g = this.game;
    const cave = g.scene === 'play' && g.world.map.def.cave;
    // Above the Inochi and Genki gauges and clear of the hotbar; the menu in the bottom-left corner.
    return [
      { id: 'use', label: t('touch_use'), x: w - 26, y: h - 108, r: 15, actions: ['use'] },
      { id: 'act', label: t('touch_act'), x: w - 60, y: h - 96, r: 12, actions: ['interact', 'confirm'] },
      { id: 'back', label: t(cave ? 'touch_dodge' : 'touch_back'), x: w - 94, y: h - 122, r: 11, actions: ['dodge', 'cancel'] },
      ...(cave ? [{ id: 'parry', label: t('touch_parry'), x: w - 94, y: h - 92, r: 11, actions: ['parry'] }] : []),
      ...(g.scene === 'play' ? [{ id: 'menu', label: t('touch_menu'), x: 14, y: h - 14, r: 10, actions: ['menu'] }] : []),
    ];
  }

  at(e) { return this.screen.toLogical(e.clientX, e.clientY); }

  down(e) {
    if (e.pointerType === 'mouse') return;
    e.preventDefault?.();
    this.seen = true;
    const p = this.at(e);
    if (this.shown) {
      const b = this.buttons().find((x) => Math.hypot(p.x - x.x, p.y - x.y) <= x.r + 4);
      if (b) { this.held.set(e.pointerId, b.id); this.input.touchDown(b.id, b.actions); return; }
      const hotbar = this.game.scene === 'play' && this.game.hud.slotAt(p.x, p.y) >= 0;
      if (this.stickable && !this.stick && !hotbar && p.x < this.screen.w * 0.45 && p.y > this.screen.h * 0.3) {
        this.stick = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y };
        return;
      }
    }
    this.input.tap(p.x, p.y);
  }

  move(e) {
    if (!this.stick || e.pointerId !== this.stick.id) return;
    const p = this.at(e);
    this.stick.x = p.x;
    this.stick.y = p.y;
    this.steer();
  }

  up(e) {
    const b = this.held.get(e.pointerId);
    if (b) { this.held.delete(e.pointerId); this.input.touchUp(b); }
    if (this.stick && e.pointerId === this.stick.id) { this.stick = null; this.steer(); }
  }

  /** The stick's direction as held arrows: eight ways, like the keys. */
  steer() {
    const want = new Set(), s = this.stick;
    if (s) {
      const dx = s.x - s.ox, dy = s.y - s.oy;
      if (Math.hypot(dx, dy) > DEAD) {
        const a = Math.atan2(dy, dx), oct = Math.round(a / (Math.PI / 4));
        const map = { 0: ['right'], 1: ['right', 'down'], 2: ['down'], 3: ['down', 'left'], 4: ['left'], '-4': ['left'], '-3': ['left', 'up'], '-2': ['up'], '-1': ['up', 'right'] };
        for (const d of map[oct]) want.add(d);
      }
    }
    for (const d of ['up', 'down', 'left', 'right']) {
      if (want.has(d) && !this.dirs.has(d)) this.input.touchDown(`stick_${d}`, [d]);
      if (!want.has(d) && this.dirs.has(d)) this.input.touchUp(`stick_${d}`);
    }
    this.dirs = want;
  }

  draw(ctx) {
    if (!this.shown) return;
    const s = this.stick;
    if (this.stickable) {
      const ox = s ? s.ox : 44, oy = s ? s.oy : this.screen.h - 52;
      ctx.globalAlpha = s ? 0.4 : 0.2;
      ring(ctx, 'ink6', ox, oy, REACH);
      if (s) {
        const dx = s.x - ox, dy = s.y - oy, d = Math.hypot(dx, dy) || 1, k = Math.min(1, REACH / d);
        disc(ctx, 'ink6', ox + dx * k, oy + dy * k, 9);
      }
      ctx.globalAlpha = 1;
    }
    for (const b of this.buttons()) {
      const on = [...this.held.values()].includes(b.id);
      ctx.globalAlpha = on ? 0.6 : 0.32;
      disc(ctx, 'ink0', b.x, b.y, b.r);
      ctx.globalAlpha = on ? 1 : 0.6;
      ring(ctx, 'ink6', b.x, b.y, b.r);
      const f = b.r >= 12 ? fonts.body : fonts.small;
      f.draw(ctx, b.label, Math.round(b.x - f.measure(b.label) / 2), Math.round(b.y - f.size / 2), 'ink6');
      ctx.globalAlpha = 1;
    }
  }
}

function disc(ctx, c, cx, cy, r) {
  for (let y = -r; y <= r; y++) { const hw = Math.round(Math.sqrt(r * r - y * y)); rect(ctx, c, Math.round(cx - hw), Math.round(cy + y), hw * 2, 1); }
}

function ring(ctx, c, cx, cy, r) {
  for (let i = 0; i < r * 6; i++) { const a = (i / (r * 6)) * Math.PI * 2; rect(ctx, c, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1); }
}
