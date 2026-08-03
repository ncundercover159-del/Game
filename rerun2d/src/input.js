// RERUN 2D — two inputs. Left/right, and jump. That is the entire scheme;
// the complexity is supposed to live in the systems, not the controls.

export class Controls {
  constructor() {
    this.x = 0;
    this.jump = false;
    this.stab = false;
    this.leftId = null;
    this.jumpId = null;
    this.stabId = null;

    this.pad = document.getElementById('pad');
    this.knob = document.getElementById('pad-knob');
    this.jumpBtn = document.getElementById('jump');
    this.stabBtn = document.getElementById('stab');
    this.originX = 0;
    this.CLAMP = 52;

    this.bindPad();
    this.bindJump();
    this.bindStab();
    this.bindKeys();
  }

  bindPad() {
    const z = this.pad;
    const start = (t) => {
      this.leftId = t.identifier;
      this.originX = t.clientX;
      this.pad.classList.add('active');
      this.move(t);
    };
    z.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.leftId === null) start(e.changedTouches[0]);
    }, { passive: false });
    z.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === this.leftId) this.move(t);
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) if (t.identifier === this.leftId) this.release();
    };
    z.addEventListener('touchend', end, { passive: false });
    z.addEventListener('touchcancel', end, { passive: false });

    z.addEventListener('mousedown', (e) => {
      this.leftId = 'mouse'; this.originX = e.clientX;
      this.pad.classList.add('active');
    });
    window.addEventListener('mousemove', (e) => {
      if (this.leftId === 'mouse') this.move(e);
    });
    window.addEventListener('mouseup', () => {
      if (this.leftId === 'mouse') this.release();
    });
  }

  move(pt) {
    let dx = pt.clientX - this.originX;
    if (dx > this.CLAMP) { this.originX = pt.clientX - this.CLAMP; dx = this.CLAMP; }
    if (dx < -this.CLAMP) { this.originX = pt.clientX + this.CLAMP; dx = -this.CLAMP; }
    this.x = dx / this.CLAMP;
    this.knob.style.transform = `translateX(${dx.toFixed(1)}px)`;
  }

  release() {
    this.leftId = null;
    this.x = 0;
    this.knob.style.transform = 'translateX(0px)';
    this.pad.classList.remove('active');
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
          this.jumpId = null; this.jump = false; b.classList.remove('down');
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

  bindStab() {
    const b = this.stabBtn;
    b.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.stabId !== null) return;
      this.stabId = e.changedTouches[0].identifier;
      this.stab = true;
      b.classList.add('down');
    }, { passive: false });
    const up = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stabId) {
          this.stabId = null; this.stab = false; b.classList.remove('down');
        }
      }
    };
    b.addEventListener('touchend', up, { passive: false });
    b.addEventListener('touchcancel', up, { passive: false });
    b.addEventListener('mousedown', (e) => {
      e.preventDefault(); this.stab = true; b.classList.add('down');
    });
    window.addEventListener('mouseup', () => {
      if (this.stabId === null) { this.stab = false; b.classList.remove('down'); }
    });
  }

  /** Lit only when a past self is actually in reach. */
  setArmed(on) {
    if (this._armed === on) return;
    this._armed = on;
    this.stabBtn.classList.toggle('armed', on);
  }

  bindKeys() {
    const keys = new Set();
    const apply = () => {
      if (this.leftId === null) {
        this.x = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) -
          (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
      }
      this.jump = keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW');
      this.stab = keys.has('KeyK') || keys.has('ArrowDown') || keys.has('KeyS');
    };
    window.addEventListener('keydown', (e) => {
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.code === 'Space') e.preventDefault();
      keys.add(e.code); apply();
    });
    window.addEventListener('keyup', (e) => { keys.delete(e.code); apply(); });
  }

  show(on) {
    document.getElementById('controls').classList.toggle('hidden', !on);
    if (!on) this.release();
  }
}
