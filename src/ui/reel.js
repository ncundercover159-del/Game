// The reel minigame: a water column with the fish darting inside it. Hold Use to lift the catch
// bar; keep the fish inside it until the progress gauge on the right fills. Time is frozen.
import { fonts } from '../core/text.js';
import { panel, rect } from './widgets.js';
import { t } from '../data/strings.js';
import { itemDef } from '../data/items.js';
import { Reel, TRACK } from '../systems/fishing.js';
import { levelOf, hasPerk, buffAmount } from '../systems/skills.js';

export class ReelMenu {
  constructor(game, fishId, onEnd) {
    this.game = game;
    this.fishId = fishId;
    this.onEnd = onEnd;
    this.reel = new Reel(fishId, { level: levelOf(game.skills.fishing.xp), steady: hasPerk(game.skills, 'steady'), bonus: buffAmount(game.buffs, 'fishing'), rng: game.rng });
    this.t = 0;
    this.after = 0;
  }

  update(dt, input) {
    this.t += dt;
    if (this.reel.done) {
      this.after += dt;
      if (this.after > 0.5) { this.onEnd(this.reel.done === 'caught', this.reel.perfect); return false; }
      return true;
    }
    const held = input.isDown('use') || input.isDown('confirm');
    const r = this.reel.step(dt, held);
    if (r) this.game.sfx(r === 'caught' ? 'ui_ok' : 'ui_back');
    else if (held && Math.floor(this.t * 8) !== Math.floor((this.t - dt) * 8)) this.game.sfx('ui');
    return true;
  }

  draw(ctx) {
    const g = this.game, atlas = g.atlas, r = this.reel;
    const { w, h } = g.screen;
    const x = Math.floor(w / 2 + 24), y = Math.floor(h / 2 - TRACK / 2 - 20);
    panel(ctx, atlas, x, y, 44, TRACK + 16);
    const tx = x + 8, ty = y + 8;
    // Water column: stepped bands, lighter toward the top.
    const bands = ['water3', 'water2', 'water2', 'water1', 'water1', 'water0'];
    bands.forEach((c, i) => rect(ctx, c, tx, ty + Math.floor((i * TRACK) / bands.length), 16, Math.ceil(TRACK / bands.length)));
    // Catch bar.
    const by = ty + TRACK - Math.round(r.bar) - r.barH;
    ctx.globalAlpha = 0.8;
    rect(ctx, r.inside() ? 'grass5' : 'grass3', tx, by, 16, r.barH);
    ctx.globalAlpha = 1;
    rect(ctx, 'grass6', tx, by, 16, 1);
    rect(ctx, 'grass1', tx, by + r.barH - 1, 16, 1);
    // The fish.
    const fy = ty + TRACK - Math.round(r.fish) - 12;
    atlas.draw(ctx, `icon_${this.fishId}`, tx, fy + (r.done ? 0 : Math.round(Math.sin(this.t * 20))));
    // Progress gauge.
    rect(ctx, 'wood1', x + 28, ty, 8, TRACK);
    const ph = Math.round((TRACK - 2) * Math.max(0, Math.min(1, r.progress)));
    rect(ctx, r.progress > 0.66 ? 'grass4' : r.progress > 0.33 ? 'gold2' : 'red2', x + 29, ty + TRACK - 1 - ph, 6, ph);
    const label = r.done === 'caught' ? t('fish_got', { fish: itemDef(this.fishId).name }) : r.done ? t('fish_gone') : t('fish_hold');
    fonts.body.drawShadow(ctx, label, Math.round(x + 22 - fonts.body.measure(label) / 2), y + TRACK + 20);
  }
}
