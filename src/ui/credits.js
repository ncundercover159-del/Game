// The credits: lines rising slowly over the ink, a pale moon above. Confirm hurries them along,
// Back ends them. Used after the epilogue and from the title screen.
import { fonts } from '../core/text.js';
import { rect, centre } from './widgets.js';
import { CREDITS } from '../data/epilogue.js';

const SPEED = 16;          // px/s
const GAP = { big: 22, body: 14, small: 12, gap: 14 };

export class Credits {
  constructor(game, { onEnd = null } = {}) {
    this.game = game;
    this.onEnd = onEnd;
    this.t = 0;
    this.height = CREDITS.reduce((a, [size]) => a + GAP[size], 0);
  }

  update(dt, input) {
    if (input.pressed('cancel') || input.pressed('menu')) return this.end();
    this.t += dt * (input.down.has('confirm') ? 4 : 1);
    if (this.t * SPEED > this.game.screen.h + this.height + 20) return this.end();
    return true;
  }

  end() {
    this.onEnd?.();
    return false;
  }

  draw(ctx) {
    const { w, h } = this.game.screen;
    rect(ctx, 'ink0', 0, 0, w, h);
    // A moon, and a line of hills.
    ctx.globalAlpha = 0.6;
    for (let y = -9; y <= 9; y++) { const hw = Math.round(Math.sqrt(81 - y * y)); rect(ctx, 'ink5', w - 70 - hw, 40 + y, hw * 2, 1); }
    ctx.globalAlpha = 1;
    for (let x = 0; x < w; x += 2) rect(ctx, 'indigo0', x, h - 30 + Math.round(Math.sin(x * 0.02) * 8 + Math.sin(x * 0.07) * 3), 2, 40);
    let y = h + 10 - Math.round(this.t * SPEED);
    for (const [size, text] of CREDITS) {
      if (text && y > -20 && y < h) centre(ctx, fonts[size], text, w / 2, y, size === 'big' ? 'gold2' : size === 'small' ? 'ink4' : 'ink6');
      y += GAP[size];
    }
  }
}
