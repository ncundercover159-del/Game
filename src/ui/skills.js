// The Skills tab: six skills with level, XP bar and chosen perks; the seven virtues as a heptagon
// chart (drawn pixel by pixel so it stays crisp).
import { fonts } from '../core/text.js';
import { rect } from './widgets.js';
import { hex } from '../art/palette.js';
import { SKILLS, SKILL_IDS, PERKS, MAX_LEVEL } from '../data/skills.js';
import { VIRTUES, VIRTUE_IDS } from '../data/virtues.js';
import { levelOf, progress } from '../systems/skills.js';
import { effectText } from '../systems/virtues.js';
import { t } from '../data/strings.js';

const perkName = (id) => Object.values(PERKS).flat(2).find((p) => p.id === id)?.name || id;

/** A 1 px Bresenham line in a palette colour. */
function pline(ctx, color, x0, y0, x1, y1) {
  ctx.fillStyle = hex(color);
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** Fill a polygon by scanlines (even-odd), whole pixels only. */
function pfill(ctx, color, pts) {
  ctx.fillStyle = hex(color);
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= y + 0.5 && by > y + 0.5) || (by <= y + 0.5 && ay > y + 0.5)) xs.push(ax + ((y + 0.5 - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) ctx.fillRect(Math.round(xs[i]), y, Math.round(xs[i + 1]) - Math.round(xs[i]), 1);
  }
}

export function drawSkillsPage(ctx, game, x, y, w, h) {
  SKILL_IDS.forEach((id, i) => {
    const s = game.skills[id], lv = levelOf(s.xp);
    const ry = y + 10 + i * 20;
    fonts.body.draw(ctx, SKILLS[id].jp, x + 10, ry, 'red1');
    fonts.body.draw(ctx, SKILLS[id].name, x + 36, ry, 'wood1');
    fonts.body.draw(ctx, t('skill_lv', { lv }), x + 142, ry, 'wood2');
    rect(ctx, 'wood1', x + 36, ry + 11, 102, 4);
    rect(ctx, 'grass4', x + 37, ry + 12, Math.round(100 * (lv >= MAX_LEVEL ? 1 : progress(s.xp))), 2);
    if (s.perks.length) fonts.small.draw(ctx, s.perks.map(perkName).join(' · '), x + 142, ry + 10, 'gold0');
  });
  // Virtue heptagon on the right.
  const cx = x + w - 62, cy = y + 64, R = 38;
  const at = (i, r) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 7;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  for (const f of [1, 0.5]) {
    const ring = VIRTUE_IDS.map((_, i) => at(i, R * f));
    ring.forEach((p, i) => pline(ctx, 'wood3', ...p, ...ring[(i + 1) % 7]));
  }
  const vals = VIRTUE_IDS.map((v, i) => at(i, R * Math.max(0.06, game.virtues[v] / 100)));
  pfill(ctx, 'red3', vals);
  vals.forEach((p, i) => pline(ctx, 'red1', ...p, ...vals[(i + 1) % 7]));
  VIRTUE_IDS.forEach((v, i) => {
    const [lx, ly] = at(i, R + 9);
    const label = VIRTUES[v].jp;
    fonts.body.draw(ctx, label, Math.round(lx - fonts.body.measure(label) / 2), Math.round(ly - 5), 'wood1');
  });
  fonts.small.draw(ctx, t('virtues'), cx - fonts.small.measure(t('virtues')) / 2, cy + R + 16, 'wood2');
  // What the virtues are doing for you, along the bottom (two lines at most).
  const effects = VIRTUE_IDS.map((v) => [v, effectText(game.virtues, v)]).filter(([, e]) => e).map(([v, e]) => `${VIRTUES[v].jp} ${e}`);
  const lines = fonts.small.wrap(effects.length ? effects.join('  ·  ') : t('virtue_none'), w - 16).slice(0, 2);
  lines.forEach((l, i) => fonts.small.draw(ctx, l, x + 8, y + h - 12 - (lines.length - 1 - i) * 10, effects.length ? 'gold0' : 'wood3'));
}
