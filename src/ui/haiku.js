// The haiku composer: three lines to fill 5-7-5 from a tray of word tiles, then recite it to the
// judges. Arrows (or the mouse) pick a tile, confirm lays it on the line being written, cancel
// takes the last one back. Rules and scoring live in systems/verse.js.
import { fonts } from '../core/text.js';
import { panel, thin, rect, centre, hit } from './widgets.js';
import { t } from '../data/strings.js';
import { Rng } from '../core/rng.js';
import { SHAPE, dealTray, syllables, fits, complete, scoreVerse, verseGrade, recite } from '../systems/verse.js';

const COLS = 4, TW = 88, TH = 16;

export class HaikuComposer {
  /** onEnd(grade, { score, text }) — grade 0 first prize, 1 second, 2 none (or gave up). */
  constructor(game, { onEnd }) {
    this.game = game;
    this.onEnd = onEnd;
    this.season = game.seasonId;
    this.tray = dealTray(this.season, new Rng((game.seed ^ (game.dayIndex * 104729)) >>> 0));
    this.lines = [[], [], []];
    this.sel = 0;
    this.result = null;
    this.after = 0;
  }

  get line() { const i = this.lines.findIndex((l, k) => syllables(l) < SHAPE[k]); return i < 0 ? 2 : i; }
  get ready() { return complete(this.lines); }
  get count() { return this.tray.length + 1; }   // the last slot is "Recite"

  update(dt, input) {
    const g = this.game;
    if (this.result) {
      this.after += dt;
      if (this.after > 0.5 && input.pressed('confirm')) { this.onEnd(this.result.grade, this.result); return false; }
      return true;
    }
    this.layout();
    const n = this.count;
    if (input.pressed('left')) { this.sel = (this.sel + n - 1) % n; g.sfx('ui'); }
    if (input.pressed('right')) { this.sel = (this.sel + 1) % n; g.sfx('ui'); }
    if (input.pressed('up')) { this.sel = Math.max(0, this.sel - COLS); g.sfx('ui'); }
    if (input.pressed('down')) { this.sel = Math.min(n - 1, this.sel + COLS); g.sfx('ui'); }
    const m = input.mouse;
    let clicked = false;
    if (input.pressed('click')) for (let i = 0; i < n; i++) if (hit(m.x, m.y, ...this.tileRect(i))) { this.sel = i; clicked = true; }
    if (input.pressed('cancel') || input.pressed('rclick')) this.takeBack();
    else if (input.pressed('confirm') || clicked) this.choose();
    return true;
  }

  choose() {
    const g = this.game;
    if (this.sel === this.tray.length) {
      if (!this.ready) { g.sfx('deny'); return; }
      const r = scoreVerse(this.lines, this.season);
      this.result = { ...r, grade: verseGrade(r.score), text: recite(this.lines) };
      g.sfx(this.result.grade < 2 ? 'harvest' : 'ui_back');
      return;
    }
    const tile = this.tray[this.sel], i = this.line;
    if (this.ready || !fits(this.lines, i, tile)) { g.sfx('deny'); return; }
    this.lines[i].push(tile);
    g.sfx('ui_ok');
    if (this.ready) this.sel = this.tray.length;
  }

  /** Take the last tile back; with nothing written, give up. */
  takeBack() {
    const g = this.game;
    for (let i = 2; i >= 0; i--) if (this.lines[i].length) { this.lines[i].pop(); g.sfx('ui_back'); return; }
    g.sfx('ui_back');
    this.result = { grade: 2, score: 0, kigo: false, text: '', gaveUp: true };
    this.after = 1;
  }

  layout() {
    const { w, h } = this.game.screen;
    this.w = Math.min(COLS * (TW + 4) + 20, w - 8);
    this.h = 222;
    this.x = Math.floor(w / 2 - this.w / 2);
    this.y = Math.floor(h / 2 - this.h / 2) - 6;
  }

  tileRect(i) {
    const c = i % COLS, r = Math.floor(i / COLS);
    return [this.x + 10 + c * (TW + 4), this.y + 104 + r * (TH + 3), TW, TH];
  }

  draw(ctx) {
    const g = this.game;
    this.layout();
    ctx.globalAlpha = 0.5;
    rect(ctx, 'ink0', 0, 0, g.screen.w, g.screen.h);
    ctx.globalAlpha = 1;
    panel(ctx, g.atlas, this.x, this.y, this.w, this.h);
    fonts.big.draw(ctx, t('hk_title'), this.x + 10, this.y + 6, 'red1');
    fonts.small.draw(ctx, t('hk_season', { season: t(`hk_${this.season}`) }), this.x + this.w - 10 - fonts.small.measure(t('hk_season', { season: t(`hk_${this.season}`) })), this.y + 10, 'wood3');
    // The three lines on a strip of paper, with their syllable counts.
    rect(ctx, 'ink6', this.x + 10, this.y + 26, this.w - 20, 70);
    const cur = this.ready ? -1 : this.line;
    this.lines.forEach((l, i) => {
      const y = this.y + 32 + i * 21;
      if (i === cur) rect(ctx, 'straw4', this.x + 12, y - 2, this.w - 24, 17);
      const text = l.map((x) => x.w).join(' ');
      fonts.body.draw(ctx, text || (i === cur ? '…' : ''), this.x + 18, y + 2, 'ink1');
      const s = `${syllables(l)}/${SHAPE[i]}`;
      fonts.small.draw(ctx, s, this.x + this.w - 18 - fonts.small.measure(s), y + 4, syllables(l) === SHAPE[i] ? 'grass3' : 'wood3');
    });
    // The tray, then Recite.
    this.tray.forEach((tile, i) => {
      const [x, y] = this.tileRect(i);
      const can = !this.ready && fits(this.lines, this.line, tile);
      if (i === this.sel) thin(ctx, g.atlas, x - 1, y - 1, TW + 2, TH + 2);
      else rect(ctx, 'wood5', x, y, TW, TH);
      fonts.small.draw(ctx, tile.w, x + 4, y + 4, can ? (i === this.sel ? 'red1' : 'wood0') : 'wood3');
      fonts.small.draw(ctx, String(tile.s), x + TW - 8, y + 4, 'wood3');
    });
    const [rx, ry] = this.tileRect(this.tray.length);
    if (this.sel === this.tray.length) thin(ctx, g.atlas, rx - 1, ry - 1, TW + 2, TH + 2);
    else rect(ctx, this.ready ? 'red2' : 'wood4', rx, ry, TW, TH);
    centre(ctx, fonts.small, t('hk_recite'), rx + TW / 2, ry + 4, this.ready ? (this.sel === this.tray.length ? 'red1' : 'ink6') : 'wood2');
    fonts.small.draw(ctx, t('hk_help'), this.x + 10, this.y + this.h - 14, 'wood3');
    if (this.result && !this.result.gaveUp) this.drawResult(ctx);
  }

  drawResult(ctx) {
    const g = this.game, r = this.result, bw = this.w - 40, bx = this.x + 20, by = this.y + 60;
    panel(ctx, g.atlas, bx, by, bw, 80);
    centre(ctx, fonts.big, t(`hk_grade${r.grade}`), bx + bw / 2, by + 10, ['gold1', 'grass2', 'wood3'][r.grade]);
    centre(ctx, fonts.body, t('hk_score', { n: r.score }), bx + bw / 2, by + 30, 'wood1');
    centre(ctx, fonts.small, t(r.kigo ? 'hk_kigo_yes' : 'hk_kigo_no'), bx + bw / 2, by + 46, r.kigo ? 'grass2' : 'red2');
    centre(ctx, fonts.small, t('hk_continue'), bx + bw / 2, by + 62, 'wood3');
  }
}
