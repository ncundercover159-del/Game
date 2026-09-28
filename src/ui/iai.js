// The iai stand-off scene: letterbox bars, two figures at twice size across a strip of ground, wind,
// a drifting leaf, feints drawn as they happen, and the bell. Press Use (or confirm) to draw.
// Time is frozen while it runs. Rules live in systems/iai.js.
import { fonts } from '../core/text.js';
import { rect, centre } from './widgets.js';
import { t } from '../data/strings.js';
import { Duel } from '../systems/iai.js';
import { Rng } from '../core/rng.js';

export class IaiDuel {
  constructor(game, { rival, onEnd, rng = null, window = null }) {
    this.game = game;
    this.rival = rival;
    this.onEnd = onEnd;
    this.duel = new Duel(rng || new Rng((game.seed ^ Math.floor(game.clockTime * 1000)) >>> 0), game.difficulty, window);
    this.t = 0;
    this.flash = 0;
    this.after = 0;
  }

  update(dt, input) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    const d = this.duel;
    if (d.done) {
      this.after += dt;
      if (this.after > 0.4) { this.onEnd(d.done === 'won'); return false; }
      return true;
    }
    const ev = d.step(dt, input.pressed('use') || input.pressed('confirm'));
    const g = this.game;
    if (ev === 'cue') g.sfx('bell');
    else if (ev === 'won') { g.sfx('crit'); this.flash = 0.25; g.shake(0.15); }
    else if (ev?.startsWith('lost')) { g.sfx('hurt'); this.flash = 0.25; }
    const f = d.feintNow();
    if (f && f !== this.lastFeint) { this.lastFeint = f; g.sfx(f.kind === 'crow' ? 'tell' : 'ui'); }
    return true;
  }

  draw(ctx) {
    const g = this.game, atlas = g.atlas, d = this.duel, r = d.round;
    const { w, h } = g.screen;
    ctx.globalAlpha = 0.7;
    rect(ctx, 'ink0', 0, 0, w, h);
    ctx.globalAlpha = 1;
    const band = 120, top = Math.floor(h / 2 - band / 2);
    rect(ctx, 'indigo0', 0, top, w, band);
    rect(ctx, 'indigo1', 0, top + band - 34, w, 34);
    rect(ctx, 'ink1', 0, top + band - 34, w, 1);
    // Wind: long pale streaks drifting across.
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 6; i++) {
      const x = ((this.t * (60 + i * 13) + i * 97) % (w + 80)) - 40;
      rect(ctx, 'indigo2', Math.round(x), top + 12 + i * 14, 18 + (i % 3) * 8, 1);
    }
    ctx.globalAlpha = 1;
    // The two of them, at twice size.
    const ground = top + band - 20, cx = Math.floor(w / 2);
    const resolved = r.phase === 'result';
    const lunge = resolved ? 30 : 0;
    ctx.save();
    ctx.scale(2, 2);
    const pBody = resolved ? 'player_right_tool1' : 'player_right_idle0';
    const rBody = resolved ? `${this.rival}_right_tool1` : `${this.rival}_right_idle0`;
    const px = (cx - 60 + (r.result === 'won' ? lunge : 0)) / 2, rx = (cx + 60 - (r.result && r.result !== 'won' ? lunge : 0)) / 2;
    atlas.draw(ctx, pBody, px, ground / 2);
    atlas.draw(ctx, rBody, rx, ground / 2, true);
    ctx.restore();
    // A leaf, falling the whole time.
    const lx = cx + Math.round(Math.sin(this.t * 1.3) * 40), ly = top + ((this.t * 14) % (band - 30));
    atlas.draw(ctx, 'fx_leaf', lx, ly);
    const feint = d.feintNow();
    if (feint && r.phase === 'still') centre(ctx, fonts.small, t(`iai_${feint.kind}`), cx, top + 8, 'indigo3');
    if (r.phase === 'cue') {
      centre(ctx, fonts.big, '!', cx, top + 20, 'gold3');
      centre(ctx, fonts.small, t('iai_bell'), cx, top + 36, 'gold2');
    }
    if (r.phase === 'result') centre(ctx, fonts.body, t(`iai_${r.result}`), cx, top + 24, r.result === 'won' ? 'gold2' : 'red3');
    // Rounds: a pip for each side.
    for (let i = 0; i < 2; i++) {
      rect(ctx, i < d.wins ? 'gold2' : 'ink2', cx - 70 + i * 8, top + band - 12, 5, 5);
      rect(ctx, i < d.losses ? 'red2' : 'ink2', cx + 58 + i * 8, top + band - 12, 5, 5);
    }
    centre(ctx, fonts.small, t('iai_help'), cx, top + band + 6, 'ink5');
    if (this.flash > 0) {
      ctx.globalAlpha = Math.min(1, this.flash * 4);
      rect(ctx, 'ink6', 0, top, w, band);
      ctx.globalAlpha = 1;
    }
  }
}
