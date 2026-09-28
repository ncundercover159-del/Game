// Shared UI drawing: nine-slice frames, item slots with counts and quality stars, text helpers.
import { hex } from '../art/palette.js';
import { fonts } from '../core/text.js';

/** Nine-slice a frame from the atlas: corners fixed, edges and centre stretched by tiling. */
export function frame(ctx, atlas, name, x, y, w, h, c = 4) {
  const f = atlas.frame(name);
  const img = atlas.canvas;
  const mw = f.w - c * 2, mh = f.h - c * 2;
  x = Math.round(x); y = Math.round(y);
  const piece = (sx, sy, sw, sh, dx, dy, dw, dh) => {
    if (dw <= 0 || dh <= 0) return;
    ctx.drawImage(img, f.x + sx, f.y + sy, sw, sh, dx, dy, dw, dh);
  };
  // Stretching a 1-colour-per-row/column middle strip is exact at integer sizes.
  piece(0, 0, c, c, x, y, c, c);
  piece(f.w - c, 0, c, c, x + w - c, y, c, c);
  piece(0, f.h - c, c, c, x, y + h - c, c, c);
  piece(f.w - c, f.h - c, c, c, x + w - c, y + h - c, c, c);
  piece(c, 0, 1, c, x + c, y, w - c * 2, c);
  piece(c, f.h - c, 1, c, x + c, y + h - c, w - c * 2, c);
  piece(0, c, c, 1, x, y + c, c, h - c * 2);
  piece(f.w - c, c, c, 1, x + w - c, y + c, c, h - c * 2);
  piece(c, c, Math.min(1, mw), Math.min(1, mh), x + c, y + c, w - c * 2, h - c * 2);
}

export function panel(ctx, atlas, x, y, w, h) { frame(ctx, atlas, 'ui_frame', x, y, w, h, 4); }
export function thin(ctx, atlas, x, y, w, h) { frame(ctx, atlas, 'ui_frame_thin', x, y, w, h, 2); }
export function dark(ctx, atlas, x, y, w, h) { frame(ctx, atlas, 'ui_frame_dark', x, y, w, h, 2); }

// Signal colours for good and bad cues. With colour-blind signals on, the greens become blues
// (reds stay red-orange), a pairing most colour-blind players can tell apart.
const SIGNALS = { good: ['grass5', 'water4'], goodDim: ['grass3', 'water2'], goodBar: ['grass4', 'water3'], bad: ['red3', 'red4'] };
export const signal = (game, name) => SIGNALS[name][game.settings.colourblind ? 1 : 0];

export function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = hex(color);
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Icon frame for an item, using the upgraded art for tools above Basic. */
export function iconName(id, tiers) {
  const t = tiers && tiers[id];
  return t ? `icon_${id}@${t}` : `icon_${id}`;
}

/** An item in a 16x16 box at (x, y): icon, stack count bottom-right, quality stars top-left. */
export function item(ctx, atlas, s, x, y, tiers = null) {
  if (!s) return;
  atlas.draw(ctx, iconName(s.id, tiers), x, y);
  if (s.n > 1) {
    const f = fonts.small;
    const str = String(s.n);
    const w = f.measure(str);
    f.draw(ctx, str, x + 17 - w, y + 9, 'ink0');
    f.draw(ctx, str, x + 16 - w, y + 8, 'ink6');
  }
  if (s.q) for (let i = 0; i < s.q; i++) {
    rect(ctx, 'gold0', x - 1 + i * 4, y - 1, 3, 3);
    rect(ctx, s.q === 3 ? 'sakura2' : 'gold2', x + i * 4, y, 1, 1);
  }
}

/** Centred text. */
export function centre(ctx, font, str, cx, y, color, shadow = null) {
  const w = font.measure(str);
  if (shadow) font.draw(ctx, str, Math.round(cx - w / 2) + 1, y + 1, shadow);
  font.draw(ctx, str, Math.round(cx - w / 2), y, color);
  return w;
}

export function hit(mx, my, x, y, w, h) {
  return mx >= x && my >= y && mx < x + w && my < y + h;
}
