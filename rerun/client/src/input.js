// RERUN — two inputs. A joystick and a jump button. That is the whole scheme;
// the complexity lives in the systems.

const CLAMP = 60; // px of travel before the stick is fully deflected

export class Controls {
  constructor() {
    this.stick = { x: 0, y: 0 };
    this.jump = false;

    this.zone = document.getElementById('stick-zone');
    this.base = document.getElementById('stick-base');
    this.knob = document.getElementById('stick-knob');
    this.jumpBtn = document.getElementById('jump');

    this.stickId = null;
    this.jumpId = null;
    this.origin = { x: 0, y: 0 };

    this.bindStick();
    this.bindJump();
    this.bindKeyboard();
  }

  bindStick() {
    const z = this.zone;

    const start = (t) => {
      this.stickId = t.identifier;
      this.origin.x = t.clientX;
      this.origin.y = t.clientY;
      this.base.style.left = `${t.clientX}px`;
      this.base.style.top = `${t.clientY}px`;
      this.base.classList.add('active');
      this.move(t);
    };

    z.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.stickId !== null) return;
      start(e.changedTouches[0]);
    }, { passive: false });

    z.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === this.stickId) this.move(t);
      }
    }, { passive: false });

    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stickId) this.release();
      }
    };
    z.addEventListener('touchend', end, { passive: false });
    z.addEventListener('touchcancel', end, { passive: false });

    // Desktop convenience while you are building the thing.
    z.addEventListener('mousedown', (e) => {
      this.stickId = 'mouse';
      this.origin.x = e.clientX; this.origin.y = e.clientY;
      this.base.style.left = `${e.clientX}px`;
      this.base.style.top = `${e.clientY}px`;
      this.base.classList.add('active');
    });
    window.addEventListener('mousemove', (e) => {
      if (this.stickId === 'mouse') this.move(e);
    });
    window.addEventListener('mouseup', () => {
      if (this.stickId === 'mouse') this.release();
    });
  }

  move(pt) {
    let dx = pt.clientX - this.origin.x;
    let dy = pt.clientY - this.origin.y;
    const d = Math.hypot(dx, dy);
    if (d > CLAMP) { dx = (dx / d) * CLAMP; dy = (dy / d) * CLAMP; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.stick.x = dx / CLAMP;
    this.stick.y = -dy / CLAMP; // screen-up is positive
  }

  release() {
    this.stickId = null;
    this.stick.x = 0;
    this.stick.y = 0;
    this.knob.style.transform = 'translate(0px, 0px)';
    this.base.classList.remove('active');
  }

  bindJump() {
    const b = this.jumpBtn;
    b.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.jumpId !== null) return;
      this.jumpId = e.changedTouches[0].identifier;
      this.jump = true;
      b.classList.add('down');
    }, { passive: false });

    const up = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.jumpId) {
          this.jumpId = null;
          this.jump = false;
          b.classList.remove('down');
        }
      }
    };
    b.addEventListener('touchend', up, { passive: false });
    b.addEventListener('touchcancel', up, { passive: false });

    b.addEventListener('mousedown', (e) => {
      e.preventDefault(); this.jump = true; b.classList.add('down');
    });
    window.addEventListener('mouseup', () => {
      if (this.jumpId === null) { this.jump = false; b.classList.remove('down'); }
    });
  }

  bindKeyboard() {
    const keys = new Set();
    const apply = () => {
      const x = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) -
        (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
      const y = (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0) -
        (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0);
      if (this.stickId === null) {
        const m = Math.hypot(x, y) || 1;
        this.stick.x = x / m;
        this.stick.y = y / m;
      }
      this.jump = keys.has('Space');
    };
    window.addEventListener('keydown', (e) => {
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.code === 'Space') e.preventDefault();
      keys.add(e.code);
      apply();
    });
    window.addEventListener('keyup', (e) => { keys.delete(e.code); apply(); });
  }

  show(on) {
    document.getElementById('controls').classList.toggle('hidden', !on);
    if (!on) this.release();
  }
}
