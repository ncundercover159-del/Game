// The kyūdō range: a letterboxed band with the archer, the long range, the target on its sand bank
// and a streamer that shows the wind; an inset of the target face with your aim and the arrows
// already in it. Rules in systems/kyudo.js. Time is frozen while it runs.
import { fonts } from '../core/text.js';
import { rect, centre } from './widgets.js';
import { t } from '../data/strings.js';
import { Kyudo, ARROWS, FLIGHT, TIRE, RINGS } from '../systems/kyudo.js';
import { levelOf } from '../systems/skills.js';
import { Rng } from '../core/rng.js';

const R = 34;                        // inset target radius, px
const BANDS = ['ink6', 'ink0', 'ink6', 'ink0', 'gold2'];

export class KyudoGame {
  /** onEnd(grade, { total, hits }). */
  constructor(game, { onEnd }) {
    this.game = game;
    this.onEnd = onEnd;
    const rng = new Rng((game.seed ^ (game.dayIndex * 4099) ^ 0x6b79) >>> 0);
    this.k = new Kyudo(rng, { steady: (levelOf(game.skills.sword.xp) - 1) * 0.06 });
    this.pops = [];
    this.after = 0;
    this.armed = false;      // the key that opened the range must come up before a draw starts
    this.hush = true;        // quiet on the range
  }

  update(dt, input) {
    const g = this.game, k = this.k;
    if (k.done) {
      this.after += dt;
      if (this.after > 0.6 && (input.pressed('confirm') || input.pressed('use') || input.pressed('cancel'))) { this.onEnd(k.grade, { total: k.total, hits: k.hits }); return false; }
      return true;
    }
    const down = input.isDown('use') || input.isDown('confirm');
    if (!this.armed) { this.armed = !down; return true; }
    const dx = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    const dy = (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0);
    const was = k.phase;
    const ev = k.step(dt, { down, dx, dy });
    if (was === 'ready' && k.phase === 'draw') g.sfx('swing');
    if (ev === 'loose') g.sfx('twang');
    if (ev === 'land' || ev === 'short' || ev === 'over') {
      const s = k.shots.at(-1);
      g.sfx(s.score ? 'thunk' : 'step');
      this.pops.push({ text: s.score ? t('ky_points', { n: s.score }) : t(s.y > 1.5 ? 'ky_short' : 'ky_miss'), color: s.score >= 7 ? 'gold3' : s.score ? 'ink6' : 'ink4', t: 1 });
    }
    for (const p of this.pops) p.t -= dt;
    this.pops = this.pops.filter((p) => p.t > 0);
    return true;
  }

  draw(ctx) {
    const g = this.game, { w, h } = g.screen, k = this.k;
    ctx.globalAlpha = 0.7;
    rect(ctx, 'ink0', 0, 0, w, h);
    ctx.globalAlpha = 1;
    const band = 156, top = Math.floor(h / 2 - band / 2), gy = top + 118;
    // Sky, the far hedge, the range's raked sand.
    rect(ctx, 'indigo1', 0, top, w, band);
    rect(ctx, 'grass1', 0, gy - 34, w, 10);
    rect(ctx, 'straw2', 0, gy - 24, w, 38);
    for (let x = 0; x < w; x += 6) rect(ctx, 'straw1', x, gy - 16 + (x % 12 ? 0 : 6), 4, 1);
    const tx = w - 180, ax = 76;
    this.drawBank(ctx, tx, gy);
    this.drawStreamer(ctx, tx - 34, gy, k.wind.x);
    this.drawArcher(ctx, ax, gy);
    // An arrow in the air, on a shallow arc from the bow to the bank.
    if (k.phase === 'flight') {
      const f = k.arrow.t / FLIGHT, x0 = ax + 18, x1 = k.arrow.short ? ax + 90 : tx;
      const x = x0 + (x1 - x0) * f, y = gy - 40 + (k.arrow.short ? f * 34 : -Math.sin(f * Math.PI) * 14 + f * 30);
      rect(ctx, 'wood4', Math.round(x) - 6, Math.round(y), 8, 1);
      rect(ctx, 'ink6', Math.round(x) - 8, Math.round(y) - 1, 2, 3);
    }
    this.drawInset(ctx, w - 56, top + 52);
    // Arrows left, the score so far.
    for (let i = 0; i < ARROWS; i++) rect(ctx, i < k.shots.length ? 'ink3' : 'wood4', 12 + i * 5, top + 8, 2, 14);
    fonts.small.draw(ctx, t('ky_total', { n: k.total }), 36, top + 10, 'ink6');
    for (const [i, p] of this.pops.entries()) {
      ctx.globalAlpha = Math.min(1, p.t * 3);
      centre(ctx, fonts.body, p.text, w - 56, top + 96 + i * 10 - Math.round((1 - p.t) * 8), p.color);
      ctx.globalAlpha = 1;
    }
    if (k.done) {
      centre(ctx, fonts.big, t(`ky_grade${k.grade}`), w / 2 - 40, top + 16, ['gold3', 'grass5', 'ink5'][k.grade]);
      centre(ctx, fonts.small, t('ky_tally', { total: k.total, hits: k.hits, n: ARROWS }), w / 2 - 40, top + 36, 'ink5');
    }
    centre(ctx, fonts.small, t('ky_help'), w / 2, top + band + 6, 'ink5');
  }

  /** The sand bank (azuchi) under its little roof, and the target in front of it. */
  drawBank(ctx, x, gy) {
    rect(ctx, 'wood1', x - 26, gy - 66, 52, 4);
    rect(ctx, 'wood2', x - 24, gy - 62, 3, 30); rect(ctx, 'wood2', x + 21, gy - 62, 3, 30);
    rect(ctx, 'straw3', x - 22, gy - 58, 44, 34);
    rect(ctx, 'straw4', x - 22, gy - 58, 44, 2);
    // The target, edge-on from here: a small ringed disc.
    for (const [i, c] of BANDS.entries()) { const r = Math.max(1, Math.round(6 - i * 1.2)); rect(ctx, c, x - r, gy - 36 - r, r * 2, r * 2); }
  }

  /** A streamer on a pole: it streams out with the wind, and hangs when there is none. */
  drawStreamer(ctx, x, gy, wind) {
    rect(ctx, 'wood3', x, gy - 70, 2, 46);
    const len = 18, lift = Math.min(1, Math.abs(wind) / 0.35), dir = Math.sign(wind) || 1;
    for (let i = 0; i < len; i++) {
      const px = x + 1 + Math.round(dir * i * lift + Math.sin(this.game.clockTime * 6 + i * 0.5) * lift);
      const py = gy - 68 + Math.round(i * (1 - lift) + Math.sin(i * 0.4) * lift);
      rect(ctx, i % 6 < 3 ? 'red2' : 'ink6', px, py, 2, 3);
    }
  }

  /** The archer at 2x with the bow: the string drawn back as far as the pull. */
  drawArcher(ctx, x, gy) {
    const a = this.game.atlas, k = this.k;
    ctx.save();
    ctx.scale(2, 2);
    a.draw(ctx, 'player_right_idle0', x / 2, (gy - 12) / 2);
    ctx.restore();
    const bx = x + 16, by0 = gy - 76, by1 = gy - 20, mid = (by0 + by1) / 2;
    for (let y = by0; y <= by1; y++) {
      const f = (y - mid) / ((by1 - by0) / 2);
      rect(ctx, 'wood4', Math.round(bx + (1 - f * f) * 6), y, 2, 1);
    }
    const pull = k.phase === 'draw' || k.phase === 'full' ? k.pull : 0, hand = bx - Math.round(pull * 14);
    for (let i = 0; i <= 20; i++) {
      const f = i / 20;
      const [x0, y0, x1, y1] = f < 0.5 ? [bx, by0, hand, mid] : [hand, mid, bx, by1];
      const ff = f < 0.5 ? f * 2 : (f - 0.5) * 2;
      rect(ctx, 'ink5', Math.round(x0 + (x1 - x0) * ff), Math.round(y0 + (y1 - y0) * ff), 1, 1);
    }
    if (pull > 0) rect(ctx, 'wood4', hand, Math.round(mid), 24, 1);
    // The draw, then how long the arms will hold.
    const tired = k.phase === 'full' ? k.hold / TIRE : 0;
    rect(ctx, 'ink1', x - 16, gy + 4, 36, 4);
    rect(ctx, tired > 0 ? (tired > 0.6 ? 'red3' : 'gold2') : 'water3', x - 15, gy + 5, Math.round(34 * (tired > 0 ? 1 - tired : pull)), 2);
  }

  /** The target face, close up: rings, the arrows in it, and your aim while at full draw. */
  drawInset(ctx, cx, cy) {
    const k = this.k;
    rect(ctx, 'ink1', cx - R - 4, cy - R - 4, R * 2 + 8, R * 2 + 8);
    RINGS.slice().reverse().forEach(([r], i) => this.disc(ctx, cx, cy, r * R, BANDS[i]));
    for (const s of k.shots) {
      if (s.y > 1.5 || Math.hypot(s.x, s.y) > 1.3) continue;
      const x = Math.round(cx + s.x * R), y = Math.round(cy + s.y * R);
      rect(ctx, 'ink2', x - 1, y - 1, 3, 3); rect(ctx, 'wood4', x, y, 1, 1);
    }
    if (k.phase === 'full' || k.phase === 'draw') {
      ctx.globalAlpha = k.phase === 'full' ? 1 : 0.4;
      const x = Math.round(cx + k.aim.x * R), y = Math.round(cy + k.aim.y * R);
      rect(ctx, 'red3', x - 4, y, 3, 1); rect(ctx, 'red3', x + 2, y, 3, 1);
      rect(ctx, 'red3', x, y - 4, 1, 3); rect(ctx, 'red3', x, y + 2, 1, 3);
      ctx.globalAlpha = 1;
    }
  }

  disc(ctx, cx, cy, r, c) {
    for (let y = -Math.floor(r); y <= r; y++) {
      const hw = Math.round(Math.sqrt(Math.max(0, r * r - y * y)));
      rect(ctx, c, cx - hw, cy + y, hw * 2, 1);
    }
  }
}
