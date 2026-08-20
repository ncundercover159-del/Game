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

    // Pointer lock is a mouse idea. On a touch device there is no cursor to
    // capture and asking for it either does nothing or eats the first tap.
    this.touchy = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    canvas.addEventListener('click', () => {
      if (!this.locked && !this.touchy) canvas.requestPointerLock();
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

    // --- touch ---------------------------------------------------------------
    this.stick = { x: 0, y: 0 };
    this.touchBtns = 0;
    if (this.touchy) this.buildTouch();
  }

  /**
   * On-screen controls, built here rather than in index.html.
   *
   * Injected so there is exactly one definition of them: the dist build and the
   * single-file artifact are the same bundle, and anything added to the markup
   * would have to be duplicated into whatever wrapper the artifact is assembled
   * with, then kept in step by hand. This way a touch device gets them and a
   * desktop never builds them at all.
   *
   * Three zones that cannot overlap by construction: a stick pinned bottom
   * left, a button cluster pinned bottom right, and look-drag which is every
   * touch that started on NEITHER of those. The HUD's own bottom row is lifted
   * clear at the same time — vitals sit bottom left and the held-item readout
   * bottom right, which is exactly where the two control zones land.
   */
  buildTouch() {
    const canvas = this.canvas;
    document.body.classList.add('touch');
    const css = document.createElement('style');
    css.textContent = `
      /* Clear of the button pad, measured rather than guessed: on a 393x727
         phone the pad's top edge lands at y=507, so anything below 220px from
         the bottom collides with it. 168 did, and the vitals row sat under the
         GRAB button. */
      body.touch #hud-bottom { bottom: 236px; }
      body.touch #tasks { font-size: 11px; }
      body.touch #lock-hint { display: none !important; }
      .tc { position: fixed; z-index: 40; touch-action: none; user-select: none;
            -webkit-user-select: none; }
      #tc-stick { left: 18px; bottom: 18px; width: 132px; height: 132px;
        border-radius: 50%; background: rgba(20,22,27,.42);
        border: 2px solid rgba(242,183,5,.30); }
      #tc-knob { position: absolute; left: 50%; top: 50%; width: 54px; height: 54px;
        margin: -27px 0 0 -27px; border-radius: 50%;
        background: rgba(242,183,5,.55); border: 2px solid rgba(255,255,255,.35);
        pointer-events: none; }
      #tc-pad { right: 14px; bottom: 14px; display: grid; gap: 10px;
        grid-template-columns: repeat(3, 62px); }
      /* Flex centring, not line-height: a fixed line-height centres ONE line
         and turns a wrapped one into a double-height box, which is what the
         old REEL OUT label did to its own circle. Labels are short enough not
         to wrap now, and this makes a longer one unable to break the grid.
         (No backticks in here - this whole block is a JS template literal.) */
      .tc-b { width: 62px; height: 62px; border-radius: 50%;
        background: rgba(20,22,27,.46); border: 2px solid rgba(255,255,255,.22);
        color: #f4f1e8; font: 600 11px/1.1 ui-sans-serif, system-ui, sans-serif;
        display: flex; align-items: center; justify-content: center;
        text-align: center; letter-spacing: .06em; }
      .tc-b.on { background: rgba(242,183,5,.55); border-color: rgba(242,183,5,.9);
        color: #14161b; }
    `;
    document.head.appendChild(css);

    const stick = document.createElement('div');
    stick.id = 'tc-stick'; stick.className = 'tc';
    const knob = document.createElement('div');
    knob.id = 'tc-knob';
    stick.appendChild(knob);

    const pad = document.createElement('div');
    pad.id = 'tc-pad'; pad.className = 'tc';
    // Sprint and crouch latch; the rest are held. A latch is the right shape
    // for a modifier you hold for twenty seconds at a time and the wrong one
    // for a grab, which has to release exactly when you let go.
    const defs = [
      ['IN', BUTTON.PULL, false], ['USE', BUTTON.USE, false], ['JUMP', BUTTON.JUMP, false],
      ['OUT', BUTTON.PUSH, false], ['THROW', BUTTON.THROW, false], ['GRAB', BUTTON.GRAB, false],
      ['SPRINT', BUTTON.SPRINT, true], ['CROUCH', BUTTON.CROUCH, true],
    ];
    for (const [label, bit, latch] of defs) {
      const b = document.createElement('div');
      b.className = 'tc-b'; b.textContent = label;
      const set = (on) => {
        if (on) this.touchBtns |= bit; else this.touchBtns &= ~bit;
        b.classList.toggle('on', !!(this.touchBtns & bit));
      };
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (latch) set(!(this.touchBtns & bit)); else set(true);
      });
      if (!latch) {
        for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
          b.addEventListener(ev, (e) => { e.preventDefault(); set(false); });
        }
      }
      pad.appendChild(b);
    }

    document.body.appendChild(stick);
    document.body.appendChild(pad);

    // The stick: absolute finger position inside the pad, clamped to the rim.
    const R = 46;
    let stickId = null;
    stick.addEventListener('pointerdown', (e) => {
      e.preventDefault(); stickId = e.pointerId; stick.setPointerCapture(e.pointerId);
    });
    const moveStick = (e) => {
      if (e.pointerId !== stickId) return;
      const r = stick.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.stick.x = dx / R;
      this.stick.y = -dy / R;   // screen y is down, forward is up
    };
    stick.addEventListener('pointermove', moveStick);
    const dropStick = (e) => {
      if (e.pointerId !== stickId) return;
      stickId = null; this.stick.x = 0; this.stick.y = 0;
      knob.style.transform = '';
    };
    for (const ev of ['pointerup', 'pointercancel']) stick.addEventListener(ev, dropStick);

    // Look: any drag that did not start on a control.
    let lookId = null, lx = 0, ly = 0;
    canvas.addEventListener('pointerdown', (e) => {
      if (lookId !== null) return;
      lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookId) return;
      e.preventDefault();
      this.yaw -= (e.clientX - lx) * 0.0042;
      this.pitch -= (e.clientY - ly) * 0.0042;
      lx = e.clientX; ly = e.clientY;
      if (this.pitch > PITCH_LIMIT) this.pitch = PITCH_LIMIT;
      if (this.pitch < -PITCH_LIMIT) this.pitch = -PITCH_LIMIT;
      while (this.yaw > Math.PI) this.yaw -= Math.PI * 2;
      while (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
    }, { passive: false });
    for (const ev of ['pointerup', 'pointercancel']) {
      canvas.addEventListener(ev, (e) => { if (e.pointerId === lookId) lookId = null; });
    }
  }

  /** The input frame to send this tick. */
  sample() {
    const k = this.keys;
    let moveY = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0)
      - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let moveX = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0)
      - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    // The stick wins when it is being held, so a device with both a keyboard
    // and a touchscreen does not fight itself.
    if (this.stick.x || this.stick.y) { moveX = this.stick.x; moveY = this.stick.y; }

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
    buttons |= this.touchBtns;

    if (this.wheel) {
      this.holdDist = clamp(this.holdDist - this.wheel * 0.18, 1.0, 3.2);
      this.wheel = 0;
    }

    // Normalise the KEY vector so diagonals are not fast, but leave the stick
    // alone — its magnitude is how far the thumb has pushed, and dividing it by
    // its own length would turn every nudge into a sprint.
    const m = Math.max(1, Math.hypot(moveX, moveY));
    return {
      moveX: moveX / m, moveY: moveY / m,
      yaw: this.yaw, pitch: this.pitch,
      buttons, holdDist: this.holdDist,
    };
  }
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
