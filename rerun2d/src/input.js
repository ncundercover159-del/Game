// THE LUMPS — three inputs. A stick, a hop, and a knife.
//
// The stick is a floating one: it appears wherever the thumb lands in the left
// half and re-centres if you drag past its radius, because on a phone you never
// look at your thumb.

const CLAMP = 54;
const DEAD = 0.14;

export class Controls {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.jump = false;
    this.stab = false;
    this.padId = null;
    this.jumpId = null;
    this.stabId = null;
    this._armed = null;

    this.zone = document.getElementById('pad-zone');
    this.pad = document.getElementById('pad');
    this.knob = document.getElementById('pad-knob');
    this.jumpBtn = document.getElementById('jump');
    this.stabBtn = document.getElementById('stab');
    this.ox = 0;
    this.oy = 0;

    this.bindPad();
    this.bindButton(this.jumpBtn, 'jump');
    this.bindButton(this.stabBtn, 'stab');
    this.bindKeys();
  }

  // ---- the stick ----------------------------------------------------------
  bindPad() {
    const z = this.zone;

    const start = (id, cx, cy) => {
      this.padId = id;
      this.ox = cx; this.oy = cy;
      this.pad.style.left = `${cx}px`;
      this.pad.style.top = `${cy}px`;
      this.pad.classList.add('active');
      this.move(cx, cy);
    };

    z.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.padId !== null) return;
      const t = e.changedTouches[0];
      start(t.identifier, t.clientX, t.clientY);
    }, { passive: false });

    z.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === this.padId) this.move(t.clientX, t.clientY);
      }
    }, { passive: false });

    const end = (e) => {
      for (const t of e.changedTouches) if (t.identifier === this.padId) this.release();
    };
    z.addEventListener('touchend', end, { passive: false });
    z.addEventListener('touchcancel', end, { passive: false });

    z.addEventListener('mousedown', (e) => {
      e.preventDefault();
      start('mouse', e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', (e) => {
      if (this.padId === 'mouse') this.move(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', () => {
      if (this.padId === 'mouse') this.release();
    });
  }

  move(cx, cy) {
    let dx = cx - this.ox;
    let dy = cy - this.oy;
    const d = Math.hypot(dx, dy);
    if (d > CLAMP) {
      // Drag the origin along rather than pinning the stick, so a long swipe
      // never leaves the thumb pushing against an invisible wall.
      const k = (d - CLAMP) / d;
      this.ox += dx * k;
      this.oy += dy * k;
      dx -= dx * k; dy -= dy * k;
      this.pad.style.left = `${this.ox}px`;
      this.pad.style.top = `${this.oy}px`;
    }
    // Screen-up is POSITIVE y. The shared physics reads the stick as
    // `iz = -input.y`, so north (-Z, up the page) has to come out positive here.
    const nx = dx / CLAMP, ny = -dy / CLAMP;
    const m = Math.hypot(nx, ny);
    if (m < DEAD) { this.x = 0; this.y = 0; } else { this.x = nx; this.y = ny; }
    this.knob.style.transform = `translate(-50%,-50%) translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px)`;
  }

  release() {
    this.padId = null;
    this.x = 0; this.y = 0;
    this.knob.style.transform = 'translate(-50%,-50%)';
    this.pad.classList.remove('active');
  }

  // ---- buttons ------------------------------------------------------------
  bindButton(b, key) {
    const idKey = `${key}Id`;
    b.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this[idKey] !== null) return;
      this[idKey] = e.changedTouches[0].identifier;
      this[key] = true;
      b.classList.add('down');
    }, { passive: false });
    const up = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this[idKey]) {
          this[idKey] = null; this[key] = false; b.classList.remove('down');
        }
      }
    };
    b.addEventListener('touchend', up, { passive: false });
    b.addEventListener('touchcancel', up, { passive: false });
    b.addEventListener('mousedown', (e) => {
      e.preventDefault(); this[key] = true; b.classList.add('down');
    });
    window.addEventListener('mouseup', () => {
      if (this[idKey] === null) { this[key] = false; b.classList.remove('down'); }
    });
  }

  /** The knife lights up only when a past self is actually within reach. */
  setArmed(on) {
    if (this._armed === on) return;
    this._armed = on;
    this.stabBtn.classList.toggle('armed', on);
  }

  bindKeys() {
    const keys = new Set();
    const apply = () => {
      if (this.padId === null) {
        const x = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0)
          - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
        const y = (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0)
          - (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0);
        const m = Math.hypot(x, y) || 1;
        this.x = x / m; this.y = y / m;
      }
      this.jump = keys.has('Space');
      this.stab = keys.has('KeyK') || keys.has('KeyJ') || keys.has('Enter');
    };
    window.addEventListener('keydown', (e) => {
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      keys.add(e.code); apply();
    });
    window.addEventListener('keyup', (e) => { keys.delete(e.code); apply(); });
    window.addEventListener('blur', () => { keys.clear(); apply(); });
  }
}
