// Weather: one type per day, rolled deterministically from (seed, day) and known the evening before
// (the forecast in the end-of-day summary and on the notice board).
import { hash, hashf } from '../core/rng.js';
import { DAYS_PER_SEASON } from './calendar.js';

export const WEATHER = {
  clear: { name: 'Clear', jp: '晴れ', rain: false },
  cloudy: { name: 'Cloudy', jp: '曇り', rain: false, tint: 0.12 },
  rain: { name: 'Rain', jp: '雨', rain: true, tint: 0.25 },
  wind: { name: 'Windy', jp: '風', rain: false },
  storm: { name: 'Thunderstorm', jp: '雷雨', rain: true, tint: 0.4 },
  tsuyu: { name: 'Tsuyu rains', jp: '梅雨', rain: true, tint: 0.3 },
  typhoon: { name: 'Typhoon', jp: '台風', rain: true, tint: 0.45 },
  snow: { name: 'Snow', jp: '雪', rain: false, tint: 0.1 },
  blizzard: { name: 'Blizzard', jp: '吹雪', rain: false, tint: 0.3 },
};

// Weighted tables per season index; summer days 1-10 are the tsuyu rainy season.
const TABLES = [
  [['clear', 45], ['cloudy', 20], ['rain', 20], ['wind', 15]],
  [['clear', 50], ['cloudy', 15], ['rain', 15], ['storm', 20]],
  [['clear', 45], ['cloudy', 20], ['rain', 20], ['wind', 15]],
  [['snow', 35], ['clear', 30], ['cloudy', 25], ['blizzard', 10]],
];
const TSUYU = [['tsuyu', 70], ['cloudy', 20], ['clear', 10]];

/** The two typhoon days of an autumn (days 5-26, at least 4 days apart). */
export function typhoonDays(seed, year) {
  const a = 5 + (hash(seed, year, 1, 991) % 10);
  const b = a + 4 + (hash(seed, year, 2, 992) % 8);
  return [a, Math.min(b, 26)];
}

/** Weather for a calendar date { day, season, year }. */
export function weatherFor(seed, t) {
  if (t.year === 1 && t.season === 0 && t.day <= 2) return 'clear';
  if (t.season === 2 && typhoonDays(seed, t.year).includes(t.day)) return 'typhoon';
  const table = t.season === 1 && t.day <= 10 ? TSUYU : TABLES[t.season];
  let r = hashf(seed, t.year * 112 + t.season * DAYS_PER_SEASON + t.day, 0, 777) * table.reduce((a, [, w]) => a + w, 0);
  for (const [id, w] of table) if ((r -= w) < 0) return id;
  return table[0][0];
}
