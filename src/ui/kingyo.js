// The goldfish tub: the water seen from above with the fish, your paper scoop (it clouds and thins
// as it weakens), a bowl for the catch, the paper's strength and the time left. Rules in
// systems/kingyo.js. Time is frozen while it runs.
import { fonts } from '../core/text.js';
import { rect, centre } from './widgets.js';
import { t } from '../data/strings.js';
import { Kingyo, TUB, POI_R, LIMIT } from '../systems/kingyo.js';
import { Rng } from '../core/rng.js';

const LOOK = { wakin: ['red2', 'red3'], kohaku: ['ink6', 'red2'], demekin: ['ink0', 'ink2'] };

export class KingyoGame {
  /** onEnd(grade, { n, kinds }). */
  constructor(game, { onEnd }) {
    this.game = game;
    this.onEnd = onEnd;
    this.k = new Kingyo(new Rng((game.seed ^ (game.dayIndex * 2654435761)) >>> 0));
    this.after = 0;
    this.splash = [];       // rings on the water { x, y, t }
    this.armed = false;     // the key that opened the tub must come up before the first dip
  }

  update(dt, input) {
    const g = this.game, k = this.k;
    if (k.done) {
      this.after += dt;
      if (this.after > 0.6 && (input.pressed('confirm') || input.pressed('use') || input.pressed('cancel'))) { this.onEnd(k.grade, { n: k.caught.length, kinds: k.caught }); return false; }
      return true;
    }
    const dx = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    const dy = (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0);
    const dip = input.isDown('use') || input.isDown('confirm');
    if (!this.armed) { this.armed = !dip; return true; }
    const before = k.caught.length;
    const ev = k.step(dt, { dx, dy, dip });
    if (ev === 'dip') { g.sfx('splash'); this.splash.push({ x: k.poi.x, y: k.poi.y, t: 0.5 }); }
    if (ev === 'lift') g.sfx(k.caught.length > before ? 'harvest' : 'water');
    if (ev === 'tear') { g.sfx('tear'); g.shake(0.08); }
    for (const s of this.splash) s.t -= dt;
    this.splash = this.splash.filter((s) => s.t > 0);
    return true;
  }

  draw(ctx) {
    const g = this.game, { w, h } = g.screen, k = this.k;
    ctx.globalAlpha = 0.7;
    rect(ctx, 'ink0', 0, 0, w, h);
    ctx.globalAlpha = 1;
    const band = 156, top = Math.floor(h / 2 - band / 2);
    rect(ctx, 'indigo0', 0, top, w, band);
    const ox = Math.floor(w / 2 - TUB.w) - 36, oy = top + 10;
    // The tub at twice size: a blue-lined wooden rim, the water with a shimmer, the fish, the poi.
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(2, 2);
    rect(ctx, 'wood1', -4, -4, TUB.w + 8, TUB.h + 8);
    rect(ctx, 'water3', -2, -2, TUB.w + 4, TUB.h + 4);
    rect(ctx, 'water1', 0, 0, TUB.w, TUB.h);
    for (let i = 0; i < 14; i++) {
      const x = (i * 37 + Math.floor(g.clockTime * 6)) % TUB.w, y = (i * 23) % TUB.h;
      rect(ctx, 'water2', x, y, 5, 1);
    }
    for (const f of k.fish) this.drawFish(ctx, f.x, f.y, f.a, f.kind);
    for (const s of this.splash) this.ring(ctx, s.x, s.y, POI_R + (0.5 - s.t) * 16, 'water4');
    this.drawPoi(ctx, k.poi.x, k.poi.y);
    ctx.restore();
    // The bowl, the paper, the time.
    const bx = ox + TUB.w * 2 + 58, by = oy + 60;
    rect(ctx, 'water2', bx - 18, by - 4, 36, 16); rect(ctx, 'ink5', bx - 20, by - 6, 40, 2);
    rect(ctx, 'ink5', bx - 20, by - 6, 2, 18); rect(ctx, 'ink5', bx + 18, by - 6, 2, 18); rect(ctx, 'ink5', bx - 18, by + 12, 36, 2);
    k.caught.slice(-8).forEach((kind, i) => this.drawFish(ctx, bx - 12 + (i % 4) * 8, by + 1 + Math.floor(i / 4) * 6, i % 2 ? 0 : Math.PI, kind));
    centre(ctx, fonts.body, t('kg_caught', { n: k.caught.length }), bx, by + 18, 'ink6');
    fonts.small.draw(ctx, t('kg_paper'), bx - 22, oy + 8, 'ink5');
    rect(ctx, 'ink1', bx - 22, oy + 18, 44, 4);
    rect(ctx, k.paper > 0.35 ? 'ink6' : 'red3', bx - 21, oy + 19, Math.round(42 * k.paper), 2);
    fonts.small.draw(ctx, t('kg_time', { n: Math.max(0, Math.ceil(LIMIT - k.t)) }), bx - 22, by + 34, 'ink5');
    if (k.done) {
      centre(ctx, fonts.big, t(k.torn ? 'kg_torn' : 'kg_time_up'), ox + TUB.w, oy + TUB.h - 12, 'gold3');
      centre(ctx, fonts.small, t(`kg_grade${k.grade}`, { n: k.caught.length }), ox + TUB.w, oy + TUB.h + 6, ['gold3', 'grass5', 'ink5'][k.grade]);
    }
    centre(ctx, fonts.small, t('kg_help'), w / 2, top + band + 6, 'ink5');
  }

  /** A goldfish from above: a tapering body along its heading, a fan of tail, and for the demekin,
   * its two eyes out to the sides. */
  drawFish(ctx, x, y, a, kind) {
    const [c0, c1] = LOOK[kind], cos = Math.cos(a), sin = Math.sin(a);
    for (let i = 0; i < 6; i++) {
      const px = Math.round(x + cos * (3 - i)), py = Math.round(y + sin * (3 - i)), s = i < 4 ? 2 : 1;
      rect(ctx, i === 1 || (kind === 'kohaku' && i === 3) ? c1 : c0, px, py, s, s);
    }
    const tx = x - cos * 4, ty = y - sin * 4;
    rect(ctx, c1, Math.round(tx - sin * 2), Math.round(ty + cos * 2), 1, 1);
    rect(ctx, c1, Math.round(tx + sin * 2), Math.round(ty - cos * 2), 1, 1);
    if (kind === 'demekin') { rect(ctx, 'ink4', Math.round(x + cos * 2 - sin * 2), Math.round(y + sin * 2 + cos * 2), 1, 1); rect(ctx, 'ink4', Math.round(x + cos * 2 + sin * 2), Math.round(y + sin * 2 - cos * 2), 1, 1); }
  }

  /** The poi: a red plastic ring with a handle, the paper inside clouding as it weakens. */
  drawPoi(ctx, x, y) {
    const k = this.k, p = k.poi;
    ctx.globalAlpha = p.wet ? 0.35 : 0.6;
    if (!k.torn) for (let dy = -POI_R + 1; dy < POI_R; dy++) {
      const hw = Math.round(Math.sqrt(POI_R * POI_R - dy * dy)) - 1;
      rect(ctx, k.paper > 0.35 ? 'ink6' : 'ink5', x - hw, y + dy, hw * 2, 1);
    }
    ctx.globalAlpha = 1;
    // Weak paper shows its tears.
    if (k.paper < 0.35 || k.torn) for (const [hx, hy, r] of [[-4, -2, 2], [3, 3, k.torn ? 7 : 1], [5, -5, 1]]) rect(ctx, 'water1', x + hx - r, y + hy - r, r * 2, r * 2);
    this.ring(ctx, x, y, POI_R, 'red2');
    for (let i = 0; i < 14; i++) rect(ctx, 'red1', x + POI_R + i, y + Math.round(i * 0.6), 2, 2);
  }

  ring(ctx, x, y, r, c) {
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      rect(ctx, c, Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 1, 1);
    }
  }
}
