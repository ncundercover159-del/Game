// Settings, one scrolling list shared by the pause menu's Options tab and the title screen: the
// sound (music, effects, ambience), the text (size, speed), accessibility (colour-blind signals,
// flashing effects, screen shake), play (time speed, auto-run, touch controls, and in a game its
// difficulty), the controls (rebind the main keys) and fullscreen. Left/right change a value;
// confirm cycles it or opens it. Everything is saved at once (settings live on this machine).
import { fonts } from '../core/text.js';
import { hit, thin } from './widgets.js';
import { t } from '../data/strings.js';
import { REBINDABLE } from '../core/input.js';

const ROW = 16;
const cycle = (list, v, d) => list[(list.indexOf(v) + d + list.length) % list.length];

/** A key code as it is printed on the key. */
export function keyName(code) {
  if (!code) return '—';
  const arrows = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
  if (arrows[code]) return arrows[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return { ShiftLeft: 'Shift', ShiftRight: 'R-Shift', ControlLeft: 'Ctrl', Escape: 'Esc', BracketLeft: '[', BracketRight: ']', Backspace: 'Bksp' }[code] || code;
}

export class SettingsPage {
  constructor(game, { inGame = false } = {}) {
    this.game = game;
    this.inGame = inGame;
    this.page = 'main';        // main | keys
    this.sel = 0;
    this.waiting = null;       // the action waiting for a key
    this.visible = 8;
  }

  rows() {
    const g = this.game, s = g.settings, set = (k, v) => g.setSetting(k, v);
    if (this.page === 'keys') {
      return [
        ...REBINDABLE.map((a) => ({ label: t(`act_${a}`), value: this.waiting === a ? t('keys_press') : keyName(g.input.bindings[a][0]), act: () => this.listen(a) })),
        { label: t('keys_reset'), act: () => { g.input.resetKeys(); set('keys', {}); g.sfx('ui_ok'); } },
        { label: t('menu_back'), act: () => { this.page = 'main'; this.sel = 0; } },
      ];
    }
    const vol = (k) => ({ label: t(`opt_${k}`), value: `${Math.round(s[k] * 10)}`, change: (d) => set(k, Math.max(0, Math.min(1, Math.round((s[k] + d * 0.1) * 10) / 10))) });
    const pick = (k, list, label = `opt_${k}`) => ({ label: t(label), value: t(`opt_${k}_${s[k]}`), change: (d) => set(k, cycle(list, s[k], d)) });
    const onOff = (k) => ({ label: t(`opt_${k}`), value: t(s[k] ? 'on' : 'off'), change: () => set(k, !s[k]) });
    return [
      vol('music'), vol('sfx'), vol('ambience'),
      pick('textSize', ['normal', 'large', 'larger']),
      pick('textSpeed', ['slow', 'normal', 'fast', 'instant']),
      onOff('colourblind'), onOff('flashes'), onOff('shake'),
      pick('speed', ['normal', 'slow', 'relaxed']),
      onOff('autorun'),
      pick('touch', ['auto', 'on', 'off']),
      // Difficulty belongs to the farm (it is saved with it), not to the machine.
      ...(this.inGame ? [{ label: t('opt_difficulty'), value: t(`diff_${g.difficulty}`), change: (d) => { g.difficulty = cycle(['relaxed', 'standard', 'warrior'], g.difficulty, d); } }] : []),
      { label: t('opt_controls'), value: '…', act: () => { this.page = 'keys'; this.sel = 0; } },
      { label: t('opt_fullscreen'), value: t(document.fullscreenElement ? 'on' : 'off'), act: () => toggleFullscreen() },
    ];
  }

  /** Waiting for a key, or in the Controls list (where Back returns to the settings). */
  get busy() { return !!this.waiting || this.page === 'keys'; }

  /** Wait for the next key and give it to `action` (Escape keeps the old one). */
  listen(action) {
    this.waiting = action;
    this.game.input.lastKey = null;
  }

  /** Returns false when Back is asked for on the main page (the caller closes). */
  update(input, x, y, w, h) {
    const g = this.game;
    this.visible = Math.max(3, Math.floor((h - 12) / ROW));
    if (this.waiting) {
      const code = g.input.lastKey;
      if (code) {
        if (code !== 'Escape' && code !== 'Tab') {
          g.input.rebind(this.waiting, code);
          g.setSetting('keys', g.input.customKeys());
          g.sfx('ui_ok');
        } else g.sfx('ui_back');
        this.waiting = null;
      }
      return true;
    }
    const rows = this.rows();
    if (input.pressed('cancel') && this.page === 'keys') { this.page = 'main'; this.sel = 0; g.sfx('ui_back'); return true; }
    if (input.pressed('up')) { this.sel = (this.sel + rows.length - 1) % rows.length; g.sfx('ui'); }
    if (input.pressed('down')) { this.sel = (this.sel + 1) % rows.length; g.sfx('ui'); }
    const r = rows[this.sel];
    if (r.change && input.pressed('left')) { r.change(-1); g.sfx('ui'); }
    if (r.change && input.pressed('right')) { r.change(1); g.sfx('ui'); }
    if (input.pressed('confirm')) { if (r.act) r.act(); else r.change(1); g.sfx('ui'); }
    const m = input.mouse, top = this.top(rows.length);
    if (input.pressed('click')) {
      for (let k = 0; k < Math.min(this.visible, rows.length - top); k++) {
        if (!hit(m.x, m.y, x, y + k * ROW, w, ROW)) continue;
        const row = rows[top + k];
        this.sel = top + k;
        // A click on the left half steps a value down, on the right half up.
        if (row.act) row.act(); else row.change(m.x < x + w / 2 ? -1 : 1);
        g.sfx('ui');
      }
    }
    return true;
  }

  top(n) { return Math.max(0, Math.min(this.sel - this.visible + 1, n - this.visible)); }

  draw(ctx, x, y, w, h) {
    const g = this.game, rows = this.rows(), top = this.top(rows.length);
    this.visible = Math.max(3, Math.floor((h - 12) / ROW));
    rows.slice(top, top + this.visible).forEach((r, k) => {
      const i = top + k, yy = y + k * ROW, on = i === this.sel;
      if (on) fonts.big.draw(ctx, '▶', x, yy, 'red2');
      fonts.big.draw(ctx, r.label, x + 12, yy, on ? 'red1' : 'wood1');
      if (r.value !== undefined) {
        const v = r.change ? `◀ ${r.value} ▶` : r.value;
        fonts.big.draw(ctx, v, x + w - fonts.big.measure(v), yy, this.waiting && on ? 'red2' : 'wood1');
      }
    });
    // A scroll hint when there is more above or below.
    if (top > 0) fonts.small.draw(ctx, '▲', x + w / 2, y - 9, 'wood3');
    if (top + this.visible < rows.length) fonts.small.draw(ctx, '▼', x + w / 2, y + this.visible * ROW - 3, 'wood3');
    if (this.page === 'keys') {
      const note = t('keys_note');
      thin(ctx, g.atlas, x - 4, y + h - 14, w + 8, 14);
      fonts.small.draw(ctx, note, x, y + h - 11, 'wood3');
    }
  }
}

export function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

