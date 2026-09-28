// The rhythm minigames' screen: a letterboxed band with the scene (the mortar and the pounders, the
// dance round the yagura, the planting line in the paddy) above a lane of notes scrolling to a
// ring. Rules and charts live in systems/rhythm.js. Time is frozen while it runs.
import { fonts } from '../core/text.js';
import { rect, centre } from './widgets.js';
import { t } from '../data/strings.js';
import { Rhythm, CHARTS, KEYS } from '../systems/rhythm.js';
import { Rng } from '../core/rng.js';

const SPEED = 96;            // px/s the notes travel
const POSE = 0.14;           // s a strike pose is held
// Animation clocks run from the count-in, when time is still negative.
const mod = (a, n) => ((Math.floor(a) % n) + n) % n;
const JUDGE_COLOR = { perfect: 'gold3', good: 'grass5', miss: 'ink4', ouch: 'red3' };

/** A small pixel arrow (7x8) pointing `dir`: a four-row head and a three-wide stem. */
function arrow(ctx, dir, x, y, c) {
  for (let i = 0; i < 4; i++) {
    if (dir === 'up') rect(ctx, c, x + 3 - i, y + i, i * 2 + 1, 1);
    if (dir === 'down') rect(ctx, c, x + 3 - i, y + 7 - i, i * 2 + 1, 1);
    if (dir === 'left') rect(ctx, c, x + i, y + 3 - i, 1, i * 2 + 1);
    if (dir === 'right') rect(ctx, c, x + 7 - i, y + 3 - i, 1, i * 2 + 1);
  }
  if (dir === 'up') rect(ctx, c, x + 2, y + 4, 3, 4);
  if (dir === 'down') rect(ctx, c, x + 2, y, 3, 4);
  if (dir === 'left') rect(ctx, c, x + 4, y + 2, 4, 3);
  if (dir === 'right') rect(ctx, c, x, y + 2, 4, 3);
}

export class RhythmGame {
  /** kind: mochi | bonodori | otaue | mamemaki; partner: the villager beside you; onEnd(grade, tally). */
  constructor(game, { kind, partner = 'okiku', crowd = [], onEnd }) {
    this.game = game;
    this.kind = kind;
    this.partner = partner;
    this.crowd = crowd;
    this.onEnd = onEnd;
    const rng = new Rng((game.seed ^ (game.dayIndex * 7919)) >>> 0);
    this.r = new Rhythm(CHARTS[kind](rng));
    this.pose = 0;
    this.lastKey = 'down';
    this.pops = [];       // { text, color, t }
    this.squash = 0;
    this.after = 0;
    this.beat = -1;
  }

  update(dt, input) {
    const g = this.game, r = this.r;
    if (r.done) {
      this.after += dt;
      if (this.after > 1.4 || (this.after > 0.4 && input.pressed('confirm'))) { this.onEnd(r.grade, r.tally); return false; }
      return true;
    }
    const pressed = new Set(KEYS.filter((k) => input.pressed(k) || (k === 'use' && input.pressed('confirm'))));
    for (const k of pressed) { this.pose = POSE; this.lastKey = k; }
    // The count-in: a drumbeat each beat before the first note.
    const b = Math.floor(r.t / 0.6);
    if (r.t < 0 && b !== this.beat) { this.beat = b; g.sfx('taiko'); }
    for (const n of r.step(dt, pressed)) {
      this.pops.push({ text: t(`rh_${n.judge}`), color: JUDGE_COLOR[n.judge], t: 0.6 });
      if (n.judge === 'ouch') { g.sfx('hurt'); g.shake(0.12); }
      else if (n.judge === 'miss') g.sfx('step');
      else { g.sfx({ mochi: 'pound', bonodori: 'clap', otaue: 'plant', mamemaki: 'hit' }[this.kind]); this.squash = 0.15; }
    }
    this.pose = Math.max(0, this.pose - dt);
    this.squash = Math.max(0, this.squash - dt);
    for (const p of this.pops) p.t -= dt;
    this.pops = this.pops.filter((p) => p.t > 0);
    return true;
  }

  draw(ctx) {
    const g = this.game, { w, h } = g.screen, r = this.r;
    ctx.globalAlpha = 0.7;
    rect(ctx, 'ink0', 0, 0, w, h);
    ctx.globalAlpha = 1;
    const band = 156, top = Math.floor(h / 2 - band / 2), cx = Math.floor(w / 2);
    rect(ctx, 'indigo0', 0, top, w, band);
    this[this.kind](ctx, cx, top + 100);
    // The lane.
    const ly = top + band - 30, hitX = cx - 120;
    rect(ctx, 'ink1', 0, ly - 2, w, 26);
    rect(ctx, 'ink2', 0, ly - 2, w, 1);
    rect(ctx, 'gold1', hitX - 1, ly - 1, 14, 24);
    rect(ctx, 'ink1', hitX + 1, ly + 1, 10, 20);
    for (const n of r.notes) {
      if (n.judge && n.judge !== 'safe' && n.judge !== 'miss') continue;
      const x = Math.round(hitX + 2 + (n.t - r.t) * SPEED);
      if (x < -10 || x > w + 10) continue;
      if (n.rest) this.restGlyph(ctx, x, ly + 6);
      else if (n.key === 'use') this.useGlyph(ctx, x, ly + 6, n.judge === 'miss');
      else arrow(ctx, n.key, x, ly + 6, n.judge === 'miss' ? 'ink3' : 'water4');
    }
    for (const [i, p] of this.pops.entries()) {
      ctx.globalAlpha = Math.min(1, p.t * 3);
      centre(ctx, fonts.body, p.text, hitX + 6, ly - 16 - i * 10 - Math.round((0.6 - p.t) * 12), p.color);
      ctx.globalAlpha = 1;
    }
    if (r.combo >= 4) fonts.small.draw(ctx, t('rh_combo', { n: r.combo }), w - 70, top + 6, 'gold2');
    if (r.t < 0) centre(ctx, fonts.big, t('rh_ready'), cx, top + 20, 'gold3');
    if (r.done) {
      centre(ctx, fonts.big, t(`rh_grade${r.grade}`), cx, top + 16, ['gold3', 'grass5', 'ink5'][r.grade]);
      const { perfect, good, miss, ouch } = r.tally;
      centre(ctx, fonts.small, t('rh_tally', { perfect, good, miss, ouch, combo: r.maxCombo }), cx, top + 36, 'ink5');
    }
    centre(ctx, fonts.small, t(`rh_help_${this.kind}`), cx, top + band + 6, 'ink5');
  }

  useGlyph(ctx, x, y, missed) {
    const c = missed ? 'ink3' : { mochi: 'ink6', bonodori: 'gold2', otaue: 'grass5', mamemaki: 'straw4' }[this.kind];
    rect(ctx, c, x + 1, y, 5, 7);
    rect(ctx, c, x, y + 1, 7, 5);
    rect(ctx, 'ink1', x + 2, y + 2, 1, 1);
  }

  restGlyph(ctx, x, y) {
    rect(ctx, 'red1', x, y, 7, 7);
    rect(ctx, 'ink1', x + 1, y + 1, 5, 5);
    for (let i = 0; i < 5; i++) { rect(ctx, 'red3', x + 1 + i, y + 1 + i, 1, 1); rect(ctx, 'red3', x + 5 - i, y + 1 + i, 1, 1); }
  }

  /** Is the partner's hand in the mortar right now? */
  handIn() { return this.r.notes.some((n) => n.rest && Math.abs(n.t - this.r.t) < 0.16); }

  // ---------------------------------------------------------------- scenes (ground line at gy)

  mochi(ctx, cx, gy) {
    const a = this.game.atlas;
    rect(ctx, 'indigo1', 0, gy - 6, this.game.screen.w, 40);
    ctx.save();
    ctx.scale(2, 2);
    a.draw(ctx, 'decor_usu', cx / 2, gy / 2 + 4);
    a.draw(ctx, this.pose > 0 ? 'player_right_tool1' : 'player_right_tool0', (cx - 34) / 2, gy / 2 + 4);
    a.draw(ctx, `${this.partner}_right_idle${this.handIn() ? 1 : 0}`, (cx + 36) / 2, gy / 2 + 4, true);
    ctx.restore();
    // Your kine: raised over your head, or down on the mochi for a moment after a strike.
    const hands = [cx - 22, gy - 34], head = this.pose > 0 ? [cx - 6, gy - 30] : [cx - 38, gy - 76];
    for (let i = 0; i <= 40; i++) rect(ctx, 'wood2', Math.round(hands[0] + (head[0] - hands[0]) * i / 40), Math.round(hands[1] + (head[1] - hands[1]) * i / 40), 3, 3);
    rect(ctx, 'wood0', head[0] - 7, head[1] - 5, 16, 10);
    rect(ctx, 'wood3', head[0] - 6, head[1] - 4, 14, 8);
    rect(ctx, 'wood5', head[0] - 6, head[1] - 4, 14, 2);
    // The mochi in the mortar, and the turner's hand when it goes in.
    const sq = this.squash > 0 ? 2 : 0;
    rect(ctx, 'ink6', cx - 8 - sq, gy - 22 + sq, 14 + sq * 2, 5 - sq);
    rect(ctx, 'ink5', cx - 6, gy - 18, 10, 1);
    if (this.handIn()) { rect(ctx, 'skin4', cx + 2, gy - 26, 8, 4); rect(ctx, 'skin5', cx + 3, gy - 26, 5, 2); }
  }

  bonodori(ctx, cx, gy) {
    const a = this.game.atlas, time = this.r.t;
    rect(ctx, 'indigo1', 0, gy - 6, this.game.screen.w, 40);
    a.draw(ctx, 'decor_yagura', cx, gy - 8);
    const dir = this.pose > 0 ? { use: 'down', up: 'up', down: 'down', left: 'left', right: 'right' }[this.lastKey] : 'down';
    const d = dir === 'left' ? 'right' : dir;
    const dancers = ['player', ...this.crowd].slice(0, 7);
    dancers.forEach((id, i) => {
      const x = cx - 84 + i * 28, beat = mod((time + i * 0.2) / 0.66, 4);
      const frame = id === 'player' ? `player_${d}_walk${mod(time * 6, 4)}` : `${id}_${['down', 'right', 'down', 'right'][beat]}_idle${beat % 2}`;
      a.draw(ctx, frame, x, gy + 22, id === 'player' ? dir === 'left' : beat === 3);
    });
  }

  /** Who is popping up from behind the stall: the oni (Genzō in a mask) or Kinta. */
  popper() {
    const n = this.r.notes.find((x) => !x.judge && Math.abs(x.t - this.r.t) < 0.3);
    return n ? (n.rest ? 'kinta' : 'oni') : null;
  }

  mamemaki(ctx, cx, gy) {
    const a = this.game.atlas, who = this.popper();
    rect(ctx, 'indigo1', 0, gy - 6, this.game.screen.w, 40);
    ctx.save();
    ctx.scale(2, 2);
    if (who) {
      const x = (cx + 30) / 2, y = gy / 2 - 2;
      a.draw(ctx, who === 'oni' ? 'genzo_down_idle0' : 'kinta_down_idle1', x, y);
      if (who === 'oni') {
        // The mask: a red face, gold eyes and two horns.
        rect(ctx, 'red2', x - 5, y - 27, 10, 8);
        rect(ctx, 'gold2', x - 3, y - 25, 2, 1); rect(ctx, 'gold2', x + 1, y - 25, 2, 1);
        rect(ctx, 'ink6', x - 5, y - 30, 2, 3); rect(ctx, 'ink6', x + 3, y - 30, 2, 3);
        rect(ctx, 'ink0', x - 2, y - 21, 4, 1);
      }
    }
    a.draw(ctx, 'yatai_day', (cx + 30) / 2, gy / 2 + 12);
    a.draw(ctx, this.pose > 0 ? 'player_right_tool1' : 'player_right_idle0', (cx - 50) / 2, gy / 2 + 12);
    ctx.restore();
    if (this.pose > 0) for (let i = 0; i < 3; i++) rect(ctx, 'straw4', cx - 30 + i * 14 + Math.round((POSE - this.pose) * 200), gy - 20 + i * 3, 2, 2);
  }

  otaue(ctx, cx, gy) {
    const a = this.game.atlas, w = this.game.screen.w;
    rect(ctx, 'water1', 0, gy - 16, w, 42);
    for (let x = 0; x < w; x += 12) rect(ctx, 'water2', x + ((x / 12) % 2) * 5, gy - 8 + ((x / 12) % 3) * 9, 6, 1);
    const planted = this.r.tally.perfect + this.r.tally.good;
    for (let i = 0; i < planted; i++) {
      const x = cx + 90 - (i % 4) * 12 - Math.floor(i / 4) * 4, y = gy - 10 + (i % 4) * 8;
      rect(ctx, 'grass4', x, y - 4, 1, 4);
      rect(ctx, 'grass5', x - 1, y - 5, 1, 2);
      rect(ctx, 'grass5', x + 1, y - 6, 1, 3);
    }
    const back = Math.min(60, planted * 2);
    a.draw(ctx, this.pose > 0 ? 'player_down_walk1' : 'player_down_idle0', cx + 70 - back, gy + 20);
    this.crowd.slice(0, 3).forEach((id, i) => a.draw(ctx, `${id}_down_idle${mod(this.r.t * 1.5 + i, 2)}`, cx - 60 + i * 26 - back / 2, gy + 20));
    a.draw(ctx, 'decor_taiko', cx - 150, gy + 20);
  }
}
