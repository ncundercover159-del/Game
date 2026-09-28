// End-of-day screen, drawn on the ink while the day turns over: itemised shipping income, what
// happened overnight, tomorrow's weather, and a seasonal verse.
import { fonts } from '../core/text.js';
import { panel, thin, centre, iconName } from './widgets.js';
import { t } from '../data/strings.js';
import { itemDef, QUALITY } from '../data/items.js';
import { WEATHER } from '../systems/weather.js';
import { SEASONS, weekday, formatTime } from '../systems/calendar.js';
import { HAIKU } from '../data/haiku.js';
import { hash } from '../core/rng.js';
import { festivalOn } from '../systems/festivals.js';
import { MAPS } from '../maps/index.js';

const MAX_LINES = 6;

export function summaryLines(r, game) {
  const notes = [];
  if (r.grew) notes.push(t('sum_grew', { n: r.grew }));
  if (r.withered) notes.push(t('sum_withered', { n: r.withered }));
  if (r.tended) notes.push(t('sum_kodama', { n: r.tended }));
  if (r.typhoonLost) notes.push(t('sum_typhoon', { n: r.typhoonLost }));
  if (r.lost) notes.push(t('sum_lost', { n: r.lost }));
  if (r.toll) notes.push(t('sum_toll', { n: r.toll }));
  if (r.bonus) notes.push(t('sum_kuroda', { n: r.bonus }));
  const fest = festivalOn(game.cal);
  if (fest) notes.push(t('sum_festival', { name: fest.name, place: MAPS[fest.map].name, time: formatTime(fest.from) }));
  const verses = HAIKU[r.prev.season];
  return {
    title: t('sum_title', { date: `${SEASONS[r.prev.season].name} ${r.prev.day}` }),
    ship: r.ship,
    notes,
    verse: verses[hash(game.seed, r.prev.day, r.prev.year, 5) % verses.length],
    tomorrow: t('sum_tomorrow', { date: `${SEASONS[game.cal.season].name} ${game.cal.day} ${weekday(game.cal).jp}`, weather: WEATHER[game.weather].name }),
    wx: `wx_${game.weather}`,
  };
}

export function drawSummary(ctx, game, s) {
  const { w, h } = game.screen;
  const atlas = game.atlas;
  const pw = Math.min(300, w - 20), ph = Math.min(206, h - 16);
  const x = Math.floor(w / 2 - pw / 2), y = Math.floor(h / 2 - ph / 2);
  panel(ctx, atlas, x, y, pw, ph);
  centre(ctx, fonts.big, s.title, w / 2, y + 8, 'red1');
  let yy = y + 26;
  fonts.body.draw(ctx, t('sum_shipped'), x + 12, yy, 'wood2');
  yy += 16;
  if (!s.ship.lines.length) { fonts.body.draw(ctx, t('sum_none'), x + 16, yy, 'wood3'); yy += 13; }
  const lines = s.ship.lines.slice(0, MAX_LINES);
  for (const l of lines) {
    atlas.draw(ctx, iconName(l.id, null), x + 14, yy - 3);
    const stars = l.q ? ` ${'★'.repeat(QUALITY[l.q].stars)}` : '';
    fonts.body.draw(ctx, `${itemDef(l.id).name}${stars} ×${l.n}`, x + 34, yy, 'wood1');
    const v = `${l.value} 文`;
    fonts.body.draw(ctx, v, x + pw - 14 - fonts.body.measure(v), yy, 'wood1');
    yy += 14;
  }
  if (s.ship.lines.length > MAX_LINES) { fonts.small.draw(ctx, `+${s.ship.lines.length - MAX_LINES} more`, x + 34, yy - 2, 'wood3'); yy += 8; }
  if (s.ship.total) {
    const tot = t('sum_total', { n: s.ship.total });
    fonts.big.draw(ctx, tot, x + pw - 14 - fonts.big.measure(tot), yy, 'red1');
    yy += 16;
  }
  for (const n of s.notes) { fonts.body.draw(ctx, n, x + 12, yy, 'wood2'); yy += 12; }
  // Forecast and verse along the bottom.
  const verse = fonts.body.wrap(s.verse, pw - 24).slice(0, 2);
  const by = y + ph - 30 - verse.length * 11;
  thin(ctx, atlas, x + 8, by, pw - 16, 18);
  atlas.draw(ctx, s.wx, x + 13, by + 4);
  fonts.body.draw(ctx, s.tomorrow, x + 30, by + 4, 'wood1');
  verse.forEach((l, i) => centre(ctx, fonts.body, l, w / 2, by + 22 + i * 11, 'wood3'));
  if (Math.floor(game.clockTime * 2) % 2) centre(ctx, fonts.small, t('sum_continue'), w / 2, y + ph + 3, 'ink5');
}
