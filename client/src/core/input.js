// Merges keyboard, touch, tilt and gamepad into one input frame { steer, btn }.
import { BTN } from '@shared/physics/input.js';
import { settings } from './settings.js';
import { clamp } from '@shared/math.js';

const DEFAULT_KEYS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  accel: ['ArrowUp', 'KeyW'],
  brake: ['ArrowDown', 'KeyS'],
  drift: ['Space', 'ShiftLeft', 'ShiftRight', 'KeyK'],
  item: ['KeyE', 'KeyX', 'KeyL', 'KeyJ'],
  trick: ['KeyT', 'KeyI'],
  look: ['KeyC', 'KeyQ'],
  pause: ['Escape', 'KeyP'],
};

export class InputManager {
  constructor() {
    this.keys = new Set();
    this.touch = null;
    this.tilt = { available: false, angle: 0, neutral: 0, enabled: false };
    this.lastDevice = 'keyboard';
    this.onPause = null;
    this.keySteer = 0;
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.keys.clear());
  }

  keyMap() {
    return { ...DEFAULT_KEYS, ...(settings().keyMap || {}) };
  }

  onKey(e, down) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const map = this.keyMap();
    const isGameKey = Object.values(map).some((arr) => arr.includes(e.code));
    if (!isGameKey) return;
    if (down) {
      if (map.pause.includes(e.code) && !e.repeat) this.onPause?.();
      this.keys.add(e.code);
      this.lastDevice = 'keyboard';
    } else {
      this.keys.delete(e.code);
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  }

  held(action) {
    const codes = this.keyMap()[action];
    for (const c of codes) if (this.keys.has(c)) return true;
    return false;
  }

  attachTouch(tc) { this.touch = tc; }

  // --- tilt steering (devicemotion gravity vector) ------------------------------
  async enableTilt() {
    if (this.tilt.enabled) return true;
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const r = await DeviceMotionEvent.requestPermission();
        if (r !== 'granted') return false;
      }
    } catch { return false; }
    window.addEventListener('devicemotion', (e) => {
      const g = e.accelerationIncludingGravity;
      if (!g || g.x == null) return;
      const ang = (screen.orientation?.angle ?? window.orientation ?? 0) | 0;
      // project gravity onto the screen plane, rotate by screen orientation
      let gx = g.x, gy = g.y;
      const a = (ang * Math.PI) / 180;
      const sx = gx * Math.cos(a) + gy * Math.sin(a);
      const sy = -gx * Math.sin(a) + gy * Math.cos(a);
      this.tilt.angle = Math.atan2(sx, -sy);
      this.tilt.available = true;
    });
    this.tilt.enabled = true;
    return true;
  }

  calibrateTilt() { this.tilt.neutral = this.tilt.angle; }

  tiltSteer() {
    if (!this.tilt.available) return 0;
    const s = settings();
    let d = this.tilt.angle - this.tilt.neutral;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    let v = (d / 0.42) * s.tiltSensitivity * (s.tiltInvert ? -1 : 1);
    return clamp(v, -1, 1);
  }

  // --- gamepad -------------------------------------------------------------
  pad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  // Build the current frame. `racing` enables auto-accelerate.
  sample() {
    const s = settings();
    let steer = 0, btn = 0;
    const kb = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    steer += kb; // physics smooths digital steering
    const accelKey = this.held('accel');
    let brake = this.held('brake');
    let drift = this.held('drift');
    let item = this.held('item');
    let trick = this.held('trick');
    let look = this.held('look');
    let back = brake && item;

    const t = this.touch?.state;
    if (t) {
      if (s.steering === 'tilt' && this.tilt.available) steer += this.tiltSteer();
      else steer += t.steer;
      drift ||= t.drift;
      item ||= t.item;
      brake ||= t.brake;
      trick ||= t.trick;
      look ||= t.look;
      back ||= t.itemBack || (t.look && t.item);
      if (t.touched) this.lastDevice = 'touch';
    }

    const p = this.pad();
    let padAccel = false;
    if (p) {
      const b = (i) => p.buttons[i]?.pressed;
      const ax = p.axes[0] || 0;
      if (Math.abs(ax) > 0.12 || p.buttons.some((x) => x.pressed)) this.lastDevice = 'gamepad';
      steer += Math.abs(ax) > 0.12 ? ax : 0;
      if (b(14)) steer -= 1;
      if (b(15)) steer += 1;
      padAccel = b(0) || b(7);
      brake ||= b(2) || b(6);
      drift ||= b(5);
      item ||= b(4) || b(3);
      look ||= b(1);
      trick ||= b(12);
      back ||= (p.axes[1] || 0) > 0.6 && item;
    }

    const auto = s.autoAccel;
    if ((auto || accelKey || padAccel) && !brake) btn |= BTN.ACCEL;
    if (accelKey || padAccel) btn |= BTN.REV;
    if (brake) btn |= BTN.BRAKE;
    if (drift) btn |= BTN.DRIFT;
    if (item) btn |= BTN.ITEM;
    if (trick) btn |= BTN.TRICK;
    if (look) btn |= BTN.LOOK;
    if (back) btn |= BTN.BACK;
    return { steer: clamp(steer, -1, 1), btn };
  }
}
