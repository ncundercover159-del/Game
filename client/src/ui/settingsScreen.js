// Settings: controls (steering mode, auto-accelerate, sensitivity, tilt
// calibration, one-handed, haptics, on-screen layout editor), audio volumes,
// accessibility (colour-blind palettes, reduce motion, subtitles, high-contrast
// HUD), graphics (quality, FPS counter), keyboard remapping and data reset.
import { h, button, uiSound } from './ui.js';
import { topbar } from './screens.js';
import { settings, setSetting, resetSettings, DEFAULT_LAYOUT } from '../core/settings.js';
import { resetProfile } from '../core/profile.js';

const TABS = [['controls', 'Controls'], ['audio', 'Audio'], ['access', 'Accessibility'], ['graphics', 'Graphics'], ['keys', 'Keys'], ['data', 'Data']];
const KEY_ACTIONS = [['left', 'Steer left'], ['right', 'Steer right'], ['accel', 'Accelerate'], ['brake', 'Brake / reverse'], ['drift', 'Hop / drift'], ['item', 'Use item'], ['trick', 'Trick'], ['look', 'Look back'], ['pause', 'Pause']];

export class SettingsScreen {
  constructor() { this.tab = 'controls'; this.listening = null; }

  build() {
    const s = settings();
    const seg = (label, key, values, fmt = (v) => v, after) => h('div.opt', h('span', label), h('div.seg', values.map((v) => h(`button.segb${s[key] === v ? '.on' : ''}`, {
      onclick: () => { uiSound.click(); setSetting(key, v); after?.(v); this.rerender(); },
    }, fmt(v)))));
    const slider = (label, key, min, max, step, fmt = (v) => `${Math.round(v * 100)}%`) => {
      const out = h('b.val', fmt(s[key]));
      const inp = h('input', { type: 'range', min, max, step, value: s[key] });
      inp.addEventListener('input', () => { setSetting(key, +inp.value); out.textContent = fmt(+inp.value); });
      return h('div.opt.slider', h('span', label), inp, out);
    };
    const onOff = [true, false], oo = (v) => (v ? 'On' : 'Off');
    let body;
    switch (this.tab) {
      case 'controls': body = [
        seg('Steering', 'steering', ['wheel', 'tilt', 'buttons'], (v) => ({ wheel: 'Wheel', tilt: 'Tilt', buttons: 'Arrows' }[v]), (v) => { if (v === 'tilt') this.app.input.enableTilt().then((ok) => { if (!ok) this.app.toast('Tilt needs motion-sensor permission'); }); }),
        seg('Auto-accelerate', 'autoAccel', onOff, oo),
        slider('Steering sensitivity', 'sensitivity', 0.5, 1.8, 0.05),
        s.steering === 'tilt' ? slider('Tilt sensitivity', 'tiltSensitivity', 0.5, 2, 0.05) : null,
        s.steering === 'tilt' ? h('div.row', seg('Invert tilt', 'tiltInvert', onOff, oo), button('Calibrate (hold level)', () => { this.app.input.calibrateTilt(); this.app.toast('Tilt calibrated'); }, 'alt')) : null,
        slider('Dead zone', 'deadZone', 0, 0.3, 0.01),
        seg('One-handed mode', 'oneHanded', onOff, oo),
        seg('Vibration', 'haptics', onOff, oo),
        slider('Button size', 'controlScale', 0.7, 1.4, 0.05),
        h('div.row', button('Edit button layout', () => this.editLayout(), 'alt'), button('Reset layout', () => { resetSettings('layout'); this.app.toast('Layout reset'); }, 'alt')),
      ]; break;
      case 'audio': body = [
        slider('Master', 'masterVolume', 0, 1, 0.05), slider('Music', 'musicVolume', 0, 1, 0.05),
        slider('Sound effects', 'sfxVolume', 0, 1, 0.05), slider('Voices', 'voiceVolume', 0, 1, 0.05),
        button('Test sound', () => { this.app.audio?.unlock(); this.app.audio?.play('finish'); this.app.audio?.bark('draxo', 'win'); }, 'alt'),
      ]; break;
      case 'access': body = [
        seg('Colour-blind palette', 'colorblind', ['none', 'protanopia', 'deuteranopia', 'tritanopia'], (v) => ({ none: 'Off', protanopia: 'Protan', deuteranopia: 'Deutan', tritanopia: 'Tritan' }[v])),
        h('div.small', 'Changes drift-spark, boost and warning colours to pairs that stay distinguishable.'),
        seg('Reduce motion', 'reduceMotion', onOff, oo), h('div.small', 'Less camera shake, fewer speed lines and calmer menus.'),
        seg('Subtitles / captions', 'subtitles', onOff, oo),
        seg('High-contrast HUD', 'highContrastHud', onOff, oo),
      ]; break;
      case 'graphics': body = [
        seg('Quality', 'quality', ['auto', 'low', 'medium', 'high'], (v) => v[0].toUpperCase() + v.slice(1), (v) => this.app.renderer.quality.setMode(v)),
        seg('FPS counter', 'showFps', onOff, oo),
        h('div.small', `Currently rendering at "${this.app.renderer.quality.q.name}" · ${Math.round(this.app.renderer.quality.fps)} fps`),
      ]; break;
      case 'keys': {
        const map = this.app.input.keyMap();
        body = [h('div.small', 'Tap an action, then press the key to bind (Esc cancels). Keyboard and gamepad also work alongside touch.'),
          h('div.keymap', KEY_ACTIONS.map(([id, label]) => h(`button.keybind${this.listening === id ? '.listen' : ''}`, { onclick: () => { this.listening = id; this.rerender(); } },
            h('span', label), h('b', this.listening === id ? 'Press a key…' : map[id].map((c) => c.replace(/^Key|^Arrow/, '')).join(' / '))))),
          button('Reset keys', () => { setSetting('keyMap', null); this.rerender(); }, 'alt')];
        break;
      }
      case 'data': body = [
        h('div.small', 'Progress is stored only on this device.'),
        button('Reset all settings', () => { resetSettings(); this.app.toast('Settings reset'); this.rerender(); }, 'alt'),
        button('Erase ALL progress', () => { if (confirm('Erase coins, unlocks, trophies, times and ghosts?')) { resetProfile(); this.app.toast('Progress erased'); } }, 'pink'),
      ]; break;
      default: body = [];
    }
    return h('div.dim-bg.settings-screen', topbar(this, 'Settings'),
      h('div.tabs', TABS.map(([id, label]) => button(label, () => { this.tab = id; this.listening = null; this.rerender(); }, id === this.tab ? 'on' : ''))),
      h('div.panel.settings-body', body));
  }

  rerender() { const n = this.build(); this.el.replaceChildren(...n.childNodes); }

  enter() {
    this.keyHandler = (e) => {
      if (!this.listening) return;
      e.preventDefault(); e.stopPropagation();
      if (e.code !== 'Escape') {
        const map = { ...(settings().keyMap || {}) };
        map[this.listening] = [e.code];
        setSetting('keyMap', map);
      }
      this.listening = null;
      this.rerender();
    };
    window.addEventListener('keydown', this.keyHandler, true);
    if (this.app.mode !== 'race') this.app.showMenuStage('title');
  }
  exit() { window.removeEventListener('keydown', this.keyHandler, true); }

  // Drag the real on-screen buttons around; sizes via the controlScale slider.
  editLayout() {
    const app = this.app;
    const tc = app.touch;
    const wasVisible = !tc.el.classList.contains('hidden');
    tc.setVisible(true);
    const overlay = h('div.layout-editor', h('div.le-top', h('b', 'Drag the controls · pinch-free: use the size buttons'), button('Done', () => close(), 'big green')));
    const layout = structuredClone(settings().layout || DEFAULT_LAYOUT);
    const handles = [];
    for (const key of Object.keys(DEFAULT_LAYOUT)) {
      const cfg = layout[key];
      const hd = h('div.le-handle', h('span', key), h('div.le-size', h('button', { onclick: (e) => { e.stopPropagation(); cfg.size = Math.max(40, cfg.size - 8); commit(); } }, '−'), h('button', { onclick: (e) => { e.stopPropagation(); cfg.size = Math.min(220, cfg.size + 8); commit(); } }, '+')));
      const pos = () => { hd.style.left = `${cfg.x}%`; hd.style.top = `${cfg.y}%`; };
      pos();
      hd.addEventListener('pointerdown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        hd.setPointerCapture(e.pointerId);
        const move = (ev) => {
          const r = overlay.getBoundingClientRect();
          cfg.x = Math.max(4, Math.min(96, ((ev.clientX - r.left) / r.width) * 100));
          cfg.y = Math.max(8, Math.min(96, ((ev.clientY - r.top) / r.height) * 100));
          pos(); commit();
        };
        const up = () => { hd.removeEventListener('pointermove', move); hd.removeEventListener('pointerup', up); };
        hd.addEventListener('pointermove', move);
        hd.addEventListener('pointerup', up);
      });
      handles.push(hd);
      overlay.appendChild(hd);
    }
    function commit() { setSetting('layout', structuredClone(layout)); }
    const close = () => { overlay.remove(); document.body.classList.remove('editing-layout'); if (!wasVisible) tc.setVisible(false); uiSound.confirm(); };
    document.body.classList.add('editing-layout');
    document.getElementById('ui').appendChild(overlay);
  }
}

export function installSettings(App) {
  App.prototype.openSettings = function (manager) { (manager || this.screens).push(new SettingsScreen()); };
}
