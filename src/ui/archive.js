// The Archive's ledger desk, two tabs ([ and ] switch): Donate (anything in your pack the Archive
// lacks) and Collection (each collection's progress, with the pieces still missing shown as pale
// outlines). Rules in systems/archive.js; rewards are paid here as donations complete them.
import { fonts } from '../core/text.js';
import { thin, hit, iconName } from './widgets.js';
import { t } from '../data/strings.js';
import { itemDef } from '../data/items.js';
import { COLLECTIONS, COLLECTION_REWARD } from '../data/archive.js';
import { donatable, donate, collectionOf, progress, TOTAL } from '../systems/archive.js';
import { RowShop } from './shop.js';

const TABS = ['arc_tab_donate', 'arc_tab_collection'];
const IDS = Object.keys(COLLECTIONS);

export class ArchiveMenu extends RowShop {
  constructor(game) {
    super(game, t('arc_title'), t('arc_hello'));
  }

  /** One row per kind of thing in the pack that the Archive lacks. */
  donateRows() {
    const g = this.game, st = g.archive, seen = new Set(), rows = [];
    for (const s of g.inventory.slots) {
      if (!s || seen.has(s.id) || !donatable(st, s.id)) continue;
      seen.add(s.id);
      rows.push({ id: s.id, icon: iconName(s.id), label: itemDef(s.id).name, right: COLLECTIONS[collectionOf(s.id)].name });
    }
    return rows;
  }

  collectionRows() {
    const st = this.game.archive;
    return IDS.map((c) => ({ icon: null, label: `${COLLECTIONS[c].name} ${COLLECTIONS[c].jp}`, right: `${progress(st, c)}/${COLLECTIONS[c].items.length}` }));
  }

  rows() { return this.tab === 0 ? this.donateRows() : this.collectionRows(); }

  update(dt, input) {
    const g = this.game;
    this.layout();
    if (input.pressed('cancel') || input.pressed('menu') || input.pressed('rclick')) { g.sfx('ui_back'); return false; }
    if (input.pressed('prev') || input.pressed('next')) { this.tab = 1 - this.tab; this.sel = 0; g.sfx('ui'); }
    if (input.pressed('click')) TABS.forEach((_, i) => { if (hit(input.mouse.x, input.mouse.y, this.x + 10 + i * 74, this.y + this.h - 22, 70, 16) && i !== this.tab) { this.tab = i; this.sel = 0; g.sfx('ui'); } });
    const rows = this.rows();
    if (!rows.length) return true;
    this.sel = Math.min(this.sel, rows.length - 1);
    if (this.navigate(input, rows.length) && this.tab === 0) this.give(rows[this.sel].id);
    return true;
  }

  give(id) {
    const g = this.game, r = donate(g.archive, id);
    if (!r) { g.sfx('deny'); return; }
    g.inventory.remove(id, 1);
    g.sfx('harvest');
    g.toast('arc_donated', { item: itemDef(id).name, n: g.archive.donated.length, of: TOTAL }, iconName(id));
    for (const m of r.milestones) this.pay(m, t('arc_milestone', { n: m.n }));
    if (r.completed) this.pay(COLLECTION_REWARD, t('arc_complete', { name: COLLECTIONS[r.completed].name }));
  }

  /** A reward: money, items, virtue, with a line saying why. */
  pay(rw, why) {
    const g = this.game;
    g.toast('arc_reward', { why }, 'icon_archive_seal');
    if (rw.money) { g.money += rw.money; g.toast('arc_money', { n: rw.money }, 'icon_coin'); }
    for (const [item, n] of rw.items || []) g.pickUp(item, n);
    if (rw.virtue) g.addVirtue(rw.virtue[0], rw.virtue[1]);
  }

  draw(ctx) {
    const g = this.game;
    this.frame(ctx);
    const rows = this.rows();
    if (rows.length) this.drawRows(ctx, rows);
    else fonts.body.draw(ctx, t('arc_nothing'), this.x + 14, this.y + 44, 'wood3');
    if (this.tab === 1) this.drawPieces(ctx, IDS[this.sel]);
    fonts.small.draw(ctx, t('arc_total', { n: g.archive.donated.length, of: TOTAL }), this.x + this.w - 90, this.y + this.h - 18, 'wood3');
    TABS.forEach((k, i) => {
      const bx = this.x + 10 + i * 74;
      thin(ctx, g.atlas, bx, this.y + this.h - 22, 70, 16);
      fonts.body.draw(ctx, t(k), Math.round(bx + 35 - fonts.body.measure(t(k)) / 2), this.y + this.h - 20, i === this.tab ? 'red1' : 'wood3');
    });
  }

  /** The selected collection's pieces: found ones in colour, missing ones as pale outlines. */
  drawPieces(ctx, c) {
    const g = this.game, items = COLLECTIONS[c].items, per = Math.floor((this.w - 20) / 18);
    const y0 = this.y + 40 + IDS.length * 18 + 6;
    items.forEach((id, i) => {
      const x = this.x + 10 + (i % per) * 18, y = y0 + Math.floor(i / per) * 18;
      if (g.archive.donated.includes(id)) g.atlas.draw(ctx, iconName(id), x, y);
      else { ctx.globalAlpha = 0.28; g.atlas.drawWhite(ctx, iconName(id), x, y); ctx.globalAlpha = 1; }
    });
  }
}
