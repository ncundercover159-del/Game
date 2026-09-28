// Sumi-e ink-brush wipe: ragged ink strokes sweep across, `onCovered` runs while the screen is
// dark, an optional card (e.g. the end-of-day line) shows, then the ink sweeps away.
import { fonts } from '../core/text.js';
import { rect, centre } from './widgets.js';
import { hashf } from '../core/rng.js';

const SWEEP = 0.55;

export class InkWipe {
  constructor(game, { onCovered, card = null, hold = 0.3, minCard = 1.2, covered = false }) {
    this.game = game;
    this.onCovered = onCovered;
    this.card = card;
    this.hold = hold;
    this.minCard = minCard;
    this.t = 0;
    // `covered` starts on black and only sweeps away (entering the game from the title).
    this.phase = covered ? 'hold' : 'in';
    this.covered = covered;
  }

  update(dt, input) {
    this.t += dt;
    if (this.phase === 'in' && this.t >= SWEEP) {
      this.phase = 'hold';
      this.t = 0;
      if (!this.covered) { this.covered = true; this.onCovered?.(); }
    } else if (this.phase === 'hold') {
      const cardDone = !this.card || (this.t > this.minCard && (input.pressed('confirm') || input.pressed('click') || this.t > this.minCard + 2.5));
      if (this.t >= this.hold && cardDone) { this.phase = 'out'; this.t = 0; }
    } else if (this.phase === 'out' && this.t >= SWEEP) {
      return false;
    }
    return true;
  }

  draw(ctx) {
    const { w, h } = this.game.screen;
    const f = this.phase === 'in' ? this.t / SWEEP : this.phase === 'hold' ? 1 : 1 - this.t / SWEEP;
    if (f >= 1) rect(ctx, 'ink0', 0, 0, w, h);
    else {
      // Rows of brush strokes with ragged, bristly leading edges.
      const rows = Math.ceil(h / 6);
      for (let r = 0; r < rows; r++) {
        const lag = hashf(r, 0, 0, 11) * 0.35;
        const k = Math.max(0, Math.min(1, (f - lag * (1 - f)) / (1 - lag * 0.5)));
        const len = Math.round(k * (w + 40));
        const jag = Math.round(hashf(r, 1, 0, 12) * 18);
        const x = this.phase === 'out' ? w - len + jag : -jag;
        rect(ctx, 'ink0', x, r * 6, len, 6);
        rect(ctx, 'ink1', this.phase === 'out' ? x - 2 : x + len, r * 6 + 2, 2, 2);
      }
    }
    if (this.card && this.phase === 'hold') {
      const lines = this.card;
      const y0 = Math.floor(h / 2 - (lines.length * 16) / 2);
      lines.forEach((l, i) => centre(ctx, i === 0 ? fonts.big : fonts.body, l, w / 2, y0 + i * 16, i === 0 ? 'gold2' : 'ink5'));
    }
  }
}
