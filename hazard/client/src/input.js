// HAZARD PAY — keyboard, mouse, pointer lock.
//
// Produces the same input object shape the server's Actor.step expects, so the
// client can run its own prediction through identical code paths.

import { BUTTON } from '../../shared/tune.js';

const PITCH_LIMIT = Math.PI / 2 - 0.02;

export class Controls {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.yaw = Math.PI;
    this.pitch = 0;
    this.sensitivity = 0.0022;
    this.locked = false;
    this.holdDist = 1.85;
    this.wheel = 0;

    canvas.addEventListener('click', () => {
      if (!this.locked) canvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      document.body.classList.toggle('locked', this.locked);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * this.sensitivity;
      this.pitch -= e.movementY * this.sensitivity;
      if (this.pitch > PITCH_LIMIT) this.pitch = PITCH_LIMIT;
      if (this.pitch < -PITCH_LIMIT) this.pitch = -PITCH_LIMIT;
      // Keep yaw bounded: it goes on the wire as a fixed-point angle with a
      // range of +/-3.2767 radians, and an unbounded yaw would wrap into
      // nonsense after a few hundred spins.
      while (this.yaw > Math.PI) this.yaw -= Math.PI * 2;
      while (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
    });

    window.addEventListener('keydown', (e) => {
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    this.mouse = 0;
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      e.preventDefault();
      this.mouse |= 1 << e.button;
    });
    window.addEventListener('mouseup', (e) => { this.mouse &= ~(1 << e.button); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      if (!this.locked) return;
      e.preventDefault();
      this.wheel += Math.sign(e.deltaY);
    }, { passive: false });
  }

  /** The input frame to send this tick. */
  sample() {
    const k = this.keys;
    const moveY = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0)
      - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const moveX = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0)
      - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);

    let buttons = 0;
    if (k.has('Space')) buttons |= BUTTON.JUMP;
    if (k.has('ShiftLeft') || k.has('ShiftRight')) buttons |= BUTTON.SPRINT;
    if (k.has('ControlLeft') || k.has('KeyC')) buttons |= BUTTON.CROUCH;
    // Left mouse or E grabs; right mouse or Q throws. Both bindings exist
    // because half of this genre's players reach for one and half the other.
    if (k.has('KeyE') || (this.mouse & 1)) buttons |= BUTTON.GRAB;
    if (k.has('KeyQ') || (this.mouse & 2)) buttons |= BUTTON.THROW;
    if (k.has('KeyG') || k.has('KeyF')) buttons |= BUTTON.USE;
    if (k.has('KeyR')) buttons |= BUTTON.PULL;
    if (k.has('KeyT')) buttons |= BUTTON.PUSH;

    if (this.wheel) {
      this.holdDist = clamp(this.holdDist - this.wheel * 0.18, 1.0, 3.2);
      this.wheel = 0;
    }

    const m = Math.hypot(moveX, moveY) || 1;
    return {
      moveX: moveX / m, moveY: moveY / m,
      yaw: this.yaw, pitch: this.pitch,
      buttons, holdDist: this.holdDist,
    };
  }
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
