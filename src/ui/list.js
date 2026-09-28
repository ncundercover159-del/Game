// A vertical list of choices (title screen, save tab, slot pickers): keyboard, mouse and gamepad.
import { fonts } from '../core/text.js';
import { hit } from './widgets.js';

export class List {
  constructor(game, items, { rowH = 16 } = {}) {
    this.game = game;
    this.items = items;
    this.rowH = rowH;
    this.sel = Math.max(0, items.findIndex((i) => !i.disabled));
    this.x = 0; this.y = 0; this.w = 0;
    this.mx = game.input.mouse.x;
    this.my = game.input.mouse.y;
  }

  width() {
    return Math.max(...this.items.map((i) => fonts.big.measure(i.label))) + 24;
  }

  move(d) {
    const n = this.items.length;
    for (let k = 1; k <= n; k++) {
      const i = (this.sel + d * k + n * k) % n;
      if (!this.items[i].disabled) { this.sel = i; this.game.sfx('ui'); return; }
    }
  }

  /** Returns the chosen item on confirm, else null. */
  update(input) {
    if (input.pressed('up')) this.move(-1);
    if (input.pressed('down')) this.move(1);
    const m = input.mouse;
    let over = -1;
    this.items.forEach((it, i) => { if (hit(m.x, m.y, this.x, this.y + i * this.rowH, this.w, this.rowH)) over = i; });
    if ((m.x !== this.mx || m.y !== this.my) && over >= 0 && !this.items[over].disabled) this.sel = over;
    this.mx = m.x;
    this.my = m.y;
    const clicked = input.pressed('click') && over >= 0 && !this.items[over].disabled;
    if (clicked) this.sel = over;
    if (clicked || input.pressed('confirm')) {
      const it = this.items[this.sel];
      if (it && !it.disabled) { this.game.sfx('ui_ok'); return it; }
    }
    return null;
  }

  draw(ctx, x, y, w = this.width()) {
    this.x = x; this.y = y; this.w = w;
    this.items.forEach((it, i) => {
      const yy = y + i * this.rowH;
      const on = i === this.sel;
      if (on) fonts.big.draw(ctx, '▶', x + 4, yy + 1, 'red2');
      fonts.big.draw(ctx, it.label, x + 16, yy + 1, it.disabled ? 'wood3' : on ? 'red1' : 'wood1');
    });
  }
}
