// The Bonds tab of the pause menu: everyone you know, their hearts, birthday, and the gift tastes
// you have discovered by giving.
import { fonts } from '../core/text.js';
import { thin, hit } from './widgets.js';
import { t } from '../data/strings.js';
import { NPCS, NPC_IDS, BOND } from '../data/npcs.js';
import { hearts } from '../systems/bonds.js';
import { SEASONS, dayIndex } from '../systems/calendar.js';

const ROW = 15;

export class BondsPage {
  constructor(game) {
    this.game = game;
    this.sel = 0;
    this.visible = NPC_IDS.length;
  }

  /** The first row shown: the list scrolls to keep the selection in view. */
  top() { return Math.max(0, Math.min(this.sel - this.visible + 1, NPC_IDS.length - this.visible)); }

  update(input, x, y) {
    const n = NPC_IDS.length;
    if (input.pressed('up')) { this.sel = (this.sel + n - 1) % n; this.game.sfx('ui'); }
    if (input.pressed('down')) { this.sel = (this.sel + 1) % n; this.game.sfx('ui'); }
    const m = input.mouse, top = this.top();
    if (input.pressed('click')) {
      for (let k = 0; k < this.visible; k++) if (hit(m.x, m.y, x + 6, y + 8 + k * ROW, 104, ROW)) this.sel = top + k;
    }
  }

  draw(ctx, x, y, w, panelH) {
    const g = this.game, atlas = g.atlas;
    this.visible = Math.min(NPC_IDS.length, Math.floor((panelH - 26) / ROW));
    const top = this.top();
    NPC_IDS.slice(top, top + this.visible).forEach((id, k) => {
      const i = top + k, b = g.bonds[id];
      const ry = y + 8 + k * ROW;
      if (i === this.sel) thin(ctx, atlas, x + 6, ry - 2, 104, ROW);
      fonts.body.draw(ctx, b?.met ? NPCS[id].name : '???', x + 12, ry + 1, i === this.sel ? 'red1' : 'wood1');
      if (b?.talkedDay === dayIndex(g.cal)) fonts.body.draw(ctx, '✓', x + 96, ry + 1, 'grass2');
    });
    // A scroll hint when there is more above or below.
    if (top > 0) fonts.small.draw(ctx, '▲', x + 54, y + 1, 'wood3');
    if (top + this.visible < NPC_IDS.length) fonts.small.draw(ctx, '▼', x + 54, y + 8 + this.visible * ROW - 2, 'wood3');
    const id = NPC_IDS[this.sel], npc = NPCS[id], b = g.bonds[id];
    const px = x + 118, py = y + 8;
    if (!b?.met) {
      fonts.body.wrap(t('bond_unmet'), w - 130).forEach((l, i) => fonts.body.draw(ctx, l, px, py + i * 12, 'wood3'));
      return;
    }
    thin(ctx, atlas, px, py, 50, 50);
    atlas.draw(ctx, `portrait_${id}_neutral`, px + 1, py + 1);
    fonts.big.draw(ctx, npc.name, px + 56, py, 'wood1');
    fonts.big.draw(ctx, npc.jp, px + 60 + fonts.big.measure(npc.name), py, 'red1');
    fonts.body.draw(ctx, npc.role, px + 56, py + 15, 'wood2');
    const bd = npc.birthday;
    fonts.body.draw(ctx, t('bond_birthday', { season: SEASONS[bd.season].name, day: bd.day }), px + 56, py + 28, 'wood2');
    const h = hearts(b.pts);
    for (let i = 0; i < BOND.maxHearts; i++) atlas.draw(ctx, i < h ? 'ui_heart_s' : 'ui_heart_s_empty', px + 56 + i * 8, py + 42);
    const week = b.giftWeek === Math.floor(dayIndex(g.cal) / 7) ? b.giftsThisWeek : 0;
    fonts.body.draw(ctx, t('bond_gifts', { n: week, max: BOND.giftsPerWeek }), px, py + 56, 'wood2');
    const loved = Object.entries(b.known || {}).filter(([, k]) => k === 'loved' || k === 'liked');
    if (loved.length) {
      fonts.body.draw(ctx, t('bond_likes'), px, py + 70, 'wood2');
      loved.slice(0, 8).forEach(([item], i) => atlas.draw(ctx, `icon_${item}`, px + 40 + i * 17, py + 67));
    }
  }
}
