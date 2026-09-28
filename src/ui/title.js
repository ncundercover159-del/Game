// The title screen: the valley in slow parallax (titleScene.js) under the wordmark, and Continue /
// New Farm / Load / Settings / Credits. A new farm picks its slot, then goes through the new-farm
// steps (newgame.js); Settings and Credits open over the valley.
import { fonts } from '../core/text.js';
import { panel, rect, centre } from './widgets.js';
import { List } from './list.js';
import { t } from '../data/strings.js';
import { listSlots } from '../core/save.js';
import { SEASONS } from '../systems/calendar.js';
import { SAVE_SLOTS } from '../config.js';
import { TitleScene } from './titleScene.js';
import { NewFarm } from './newgame.js';
import { SettingsPage } from './settings.js';
import { Credits } from './credits.js';

export class Title {
  constructor(game) {
    this.game = game;
    this.mode = 'main';          // main | new | load | newfarm | settings | credits
    this.scene = new TitleScene();
    this.refresh();
  }

  refresh() {
    const g = this.game;
    this.slots = listSlots();
    const latest = this.slots.filter((s) => s.doc).sort((a, b) => b.doc.savedAt - a.doc.savedAt)[0];
    this.main = new List(g, [
      { label: t('menu_continue'), disabled: !latest, act: () => g.loadSlot(latest.n) },
      { label: t('menu_new'), act: () => this.pick('new') },
      { label: t('menu_load'), disabled: !latest, act: () => this.pick('load') },
      { label: t('menu_settings'), act: () => { this.mode = 'settings'; this.settings = new SettingsPage(g); } },
      { label: t('menu_credits'), act: () => { this.mode = 'credits'; this.credits = new Credits(g, { onEnd: () => { this.mode = 'main'; } }); } },
    ]);
  }

  slotLabel(s) {
    if (s.doc) {
      const m = s.doc.meta;
      return t('menu_slot', { n: s.n, name: m.name, date: `${SEASONS[m.season].name} ${m.day}`, year: m.year, money: m.money });
    }
    if (s.error) return t('menu_corrupt', { n: s.n });
    return t('menu_empty_slot', { n: s.n });
  }

  pick(mode) {
    const g = this.game;
    this.mode = mode;
    const items = this.slots.map((s) => ({
      label: this.slotLabel(s),
      disabled: mode === 'load' && !s.doc,
      act: () => (mode === 'new' ? this.newFarm(s.n) : g.loadSlot(s.n)),
    }));
    items.push({ label: t('menu_back'), act: () => { this.mode = 'main'; } });
    this.sub = new List(g, items);
    // New farms default to the first empty slot.
    if (mode === 'new') {
      const empty = this.slots.findIndex((s) => !s.doc);
      this.sub.sel = empty >= 0 ? empty : 0;
    }
  }

  newFarm(slot) {
    const g = this.game;
    this.mode = 'newfarm';
    this.newfarm = new NewFarm(g, {
      slot,
      onDone: (opts) => g.startNew(slot, opts),
      onCancel: () => { this.mode = 'main'; g.wearLook(g.state.look); },
    });
  }

  update(dt, input) {
    const g = this.game;
    this.scene.update(dt, g.screen.w, g.screen.h);
    if (this.mode === 'newfarm') { this.newfarm.update(dt, input); return; }
    if (this.mode === 'credits') { if (!this.credits.update(dt, input)) this.mode = 'main'; return; }
    if (this.mode === 'settings') {
      if (!this.settings.busy && (input.pressed('cancel') || input.pressed('menu'))) { this.mode = 'main'; g.sfx('ui_back'); return; }
      const r = this.settingsRect();
      this.settings.update(input, r.x + 10, r.y + 26, r.w - 20, r.h - 34);
      return;
    }
    const list = this.mode === 'main' ? this.main : this.sub;
    if (this.mode !== 'main' && input.pressed('cancel')) { this.mode = 'main'; g.sfx('ui_back'); return; }
    const it = list.update(input);
    if (it) it.act();
  }

  settingsRect() {
    const { w, h } = this.game.screen;
    const pw = Math.min(360, w - 16), ph = Math.min(220, h - 24);
    return { x: Math.floor(w / 2 - pw / 2), y: Math.floor(h / 2 - ph / 2), w: pw, h: ph };
  }

  draw(ctx) {
    const g = this.game, { w, h } = g.screen;
    this.scene.draw(ctx, w, h);
    if (this.mode === 'credits') { this.credits.draw(ctx); return; }
    if (this.mode === 'newfarm') { this.newfarm.draw(ctx); return; }
    if (this.mode === 'settings') {
      const r = this.settingsRect();
      ctx.globalAlpha = 0.35;
      rect(ctx, 'ink0', 0, 0, w, h);
      ctx.globalAlpha = 1;
      panel(ctx, g.atlas, r.x, r.y, r.w, r.h);
      fonts.big.draw(ctx, t('menu_settings'), r.x + 12, r.y + 8, 'red1');
      this.settings.draw(ctx, r.x + 10, r.y + 26, r.w - 20, r.h - 34);
      return;
    }
    const cy = Math.floor(h * 0.16);
    // Wordmark: the title in the big pixel font drawn at 2x via an offscreen copy keeps it crisp.
    drawBig(ctx, t('menu_title'), w / 2, cy, 2);
    centre(ctx, fonts.big, t('menu_subtitle'), w / 2, cy + 30, 'gold2', 'ink0');
    const list = this.mode === 'main' ? this.main : this.sub;
    const lw = this.mode === 'main' ? 120 : Math.min(w - 20, list.width() + 8);
    const lh = list.items.length * 16 + 12;
    const lx = Math.floor(w / 2 - lw / 2), ly = Math.floor(h * 0.47);
    panel(ctx, g.atlas, lx, ly, lw, lh);
    list.draw(ctx, lx + 4, ly + 6, lw - 8);
    centre(ctx, fonts.body, t('menu_version', { n: SAVE_SLOTS }), w / 2, h - 14, 'ink5');
  }
}

let bigCache = null;
function drawBig(ctx, str, cx, y, scale) {
  const f = fonts.big;
  if (!bigCache || bigCache.str !== str) {
    const w = f.measure(str) + 2, h = f.cell + 2;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const cc = c.getContext('2d');
    f.draw(cc, str, 1, 2, 'ink0');
    f.draw(cc, str, 2, 1, 'red1');
    f.draw(cc, str, 1, 1, 'ink6');
    bigCache = { str, c };
  }
  const c = bigCache.c;
  ctx.drawImage(c, Math.round(cx - (c.width * scale) / 2), y, c.width * scale, c.height * scale);
}
