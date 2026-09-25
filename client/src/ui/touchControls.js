// On-screen touch controls: floating steering wheel (or tilt), drift, item,
// brake, trick and look-back buttons. Positions come from settings.layout.
import { settings, onSettings } from '../core/settings.js';
import { ICONS } from './icons.js';
import { haptic } from '../core/haptics.js';

export class TouchControls {
  constructor(root) {
    this.state = { steer: 0, drift: false, item: false, itemBack: false, brake: false, trick: false, look: false, touched: false };
    this.el = document.createElement('div');
    this.el.className = 'tc-root';
    root.appendChild(this.el);
    this.pointers = new Map(); // pointerId -> control name
    this.wheel = null;
    this.visible = false;
    this.build();
    this.unsub = onSettings(() => this.applyLayout());
  }

  build() {
    const s = settings();
    this.el.innerHTML = `
      <div class="tc-zone tc-left" data-ctrl="wheelzone"></div>
      <div class="tc-wheel" data-ctrl="wheel"><div class="tc-wheel-inner">${ICONS.wheel}</div></div>
      <button class="tc-btn tc-drift" data-ctrl="drift"><span class="ic">${ICONS.drift}</span><b>DRIFT</b></button>
      <button class="tc-btn tc-item" data-ctrl="item"><span class="ic">${ICONS.item}</span></button>
      <button class="tc-btn tc-brake" data-ctrl="brake"><span class="ic">${ICONS.brake}</span><b>BRAKE</b></button>
      <button class="tc-btn tc-trick" data-ctrl="trick"><span class="ic">${ICONS.trick}</span></button>
      <button class="tc-btn tc-look" data-ctrl="look"><span class="ic">${ICONS.look}</span></button>
    `;
    this.wheel = this.el.querySelector('.tc-wheel');
    this.wheelInner = this.el.querySelector('.tc-wheel-inner');
    this.btns = {};
    for (const b of this.el.querySelectorAll('.tc-btn')) this.btns[b.dataset.ctrl] = b;
    this.el.addEventListener('pointerdown', (e) => this.onDown(e), { passive: false });
    window.addEventListener('pointermove', (e) => this.onMove(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.applyLayout(s);
  }

  applyLayout() {
    const s = settings();
    const L = s.layout;
    const scale = s.controlScale || 1;
    const place = (el, cfg) => {
      if (!el || !cfg) return;
      const size = cfg.size * scale;
      el.style.left = `calc(var(--sal) + (100% - var(--sal) - var(--sar)) * ${cfg.x / 100} - ${size / 2}px)`;
      el.style.top = `calc(var(--sat) + (100% - var(--sat) - var(--sab)) * ${cfg.y / 100} - ${size / 2}px)`;
      el.style.width = el.style.height = `${size}px`;
      el.style.opacity = cfg.opacity;
    };
    let layout = L;
    if (s.oneHanded) {
      // everything on the right; steering by tilt or by the right-side wheel
      layout = { ...L, wheel: { ...L.wheel, x: 62, y: 70, size: 120 }, drift: { ...L.drift, x: 88, y: 76 }, brake: { ...L.brake, x: 88, y: 30 }, look: { ...L.look, x: 74, y: 28 } };
    }
    this.layout = layout;
    place(this.wheel, layout.wheel);
    for (const k in this.btns) place(this.btns[k], layout[k]);
    this.wheel.classList.toggle('hidden', s.steering === 'tilt');
    this.el.querySelector('.tc-left').classList.toggle('one-handed', !!s.oneHanded);
  }

  setVisible(v) {
    this.visible = v;
    this.el.classList.toggle('show', v);
    if (!v) this.reset();
  }

  reset() {
    this.pointers.clear();
    Object.assign(this.state, { steer: 0, drift: false, item: false, itemBack: false, brake: false, trick: false, look: false });
    for (const b of Object.values(this.btns)) b.classList.remove('down');
    this.restWheel();
  }

  setItemIcon(html) {
    this.btns.item.querySelector('.ic').innerHTML = html || ICONS.item;
  }

  onDown(e) {
    const t = e.target.closest('[data-ctrl]');
    if (!t) return;
    e.preventDefault();
    this.state.touched = true;
    const name = t.dataset.ctrl;
    if (name === 'wheelzone' || name === 'wheel') {
      if (settings().steering === 'tilt') return;
      this.pointers.set(e.pointerId, { name: 'wheel', x0: e.clientX, y0: e.clientY });
      // floating wheel: jump to the thumb
      const r = this.el.getBoundingClientRect();
      const size = this.wheel.offsetWidth;
      this.wheel.style.left = `${e.clientX - r.left - size / 2}px`;
      this.wheel.style.top = `${e.clientY - r.top - size / 2}px`;
      this.wheel.classList.add('active');
      return;
    }
    this.pointers.set(e.pointerId, { name, x0: e.clientX, y0: e.clientY });
    this.btns[name]?.classList.add('down');
    this.state[name] = true;
    if (name === 'drift' || name === 'item') haptic(8);
  }

  onMove(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    if (p.name === 'wheel') {
      const s = settings();
      const radius = this.wheel.offsetWidth * 0.42;
      let v = (e.clientX - p.x0) / radius;
      v *= s.sensitivity;
      const dz = s.deadZone;
      const a = Math.abs(v);
      v = a < dz ? 0 : Math.sign(v) * Math.min(1, (a - dz) / (1 - dz));
      // gentle response curve for fine control around centre
      v = Math.sign(v) * Math.pow(Math.abs(v), 1.25);
      this.state.steer = v;
      this.wheelInner.style.transform = `rotate(${v * 100}deg)`;
    } else if (p.name === 'item') {
      this.state.itemBack = e.clientY - p.y0 > 26;
      this.btns.item.classList.toggle('back', this.state.itemBack);
    }
  }

  onUp(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (p.name === 'wheel') {
      this.state.steer = 0;
      this.restWheel();
      return;
    }
    // stay pressed if another finger holds the same control
    for (const q of this.pointers.values()) if (q.name === p.name) return;
    this.state[p.name] = false;
    if (p.name === 'item') {
      // keep the back flag for one more frame so the release reads it
      setTimeout(() => { this.state.itemBack = false; this.btns.item.classList.remove('back'); }, 50);
    }
    this.btns[p.name]?.classList.remove('down');
  }

  restWheel() {
    this.wheel.classList.remove('active');
    this.wheelInner.style.transform = '';
    const cfg = this.layout?.wheel;
    if (cfg) {
      const size = cfg.size * (settings().controlScale || 1);
      this.wheel.style.left = `calc(var(--sal) + (100% - var(--sal) - var(--sar)) * ${cfg.x / 100} - ${size / 2}px)`;
      this.wheel.style.top = `calc(var(--sat) + (100% - var(--sat) - var(--sab)) * ${cfg.y / 100} - ${size / 2}px)`;
    }
  }

  destroy() {
    this.unsub?.();
    this.el.remove();
  }
}
