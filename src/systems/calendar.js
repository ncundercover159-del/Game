// Calendar and clock maths (pure). Time of day is minutes since midnight of the current day and
// runs from 06:00 (360) to 02:00 the next morning (1560).

export const SEASONS = [
  { id: 'spring', name: 'Haru', en: 'Spring', jp: '春' },
  { id: 'summer', name: 'Natsu', en: 'Summer', jp: '夏' },
  { id: 'autumn', name: 'Aki', en: 'Autumn', jp: '秋' },
  { id: 'winter', name: 'Fuyu', en: 'Winter', jp: '冬' },
];

export const WEEKDAYS = [
  { name: 'Getsu', jp: '月' }, { name: 'Ka', jp: '火' }, { name: 'Sui', jp: '水' }, { name: 'Moku', jp: '木' },
  { name: 'Kin', jp: '金' }, { name: 'Do', jp: '土' }, { name: 'Nichi', jp: '日' },
];

// Zodiac hours, two hours each, starting with 子 at 23:00.
export const ZODIAC = [
  { jp: '子', en: 'Rat' }, { jp: '丑', en: 'Ox' }, { jp: '寅', en: 'Tiger' }, { jp: '卯', en: 'Rabbit' },
  { jp: '辰', en: 'Dragon' }, { jp: '巳', en: 'Snake' }, { jp: '午', en: 'Horse' }, { jp: '未', en: 'Sheep' },
  { jp: '申', en: 'Monkey' }, { jp: '酉', en: 'Rooster' }, { jp: '戌', en: 'Dog' }, { jp: '亥', en: 'Boar' },
];

export const DAYS_PER_SEASON = 28;
export const DAY_START = 6 * 60;
export const DAY_END = 26 * 60;
export const MIDNIGHT = 24 * 60;
export const TICK_MINUTES = 10;
// Real seconds per 10 in-game minutes, by the "time speed" setting.
export const TICK_SECONDS = { normal: 7, slow: 10.5, relaxed: 14 };

export function newCalendar() {
  return { day: 1, season: 0, year: 1, minutes: DAY_START };
}

/** Days since the start of the game (0-based). */
export function dayIndex(t) {
  return (t.year - 1) * DAYS_PER_SEASON * 4 + t.season * DAYS_PER_SEASON + (t.day - 1);
}

export function weekday(t) {
  return WEEKDAYS[dayIndex(t) % 7];
}

/** Every 7th day (Nichi) is Ichi, market day. */
export function isMarketDay(t) {
  return dayIndex(t) % 7 === 6;
}

export function season(t) {
  return SEASONS[t.season];
}

/** Advance to the next morning; returns flags for season/year rollover. */
export function nextDay(t) {
  const out = { ...t, minutes: DAY_START };
  let newSeason = false, newYear = false;
  out.day++;
  if (out.day > DAYS_PER_SEASON) {
    out.day = 1;
    out.season++;
    newSeason = true;
    if (out.season > 3) {
      out.season = 0;
      out.year++;
      newYear = true;
    }
  }
  return { t: out, newSeason, newYear };
}

export function zodiacHour(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  return ZODIAC[Math.floor(((h + 1) % 24) / 2)];
}

export function formatTime(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Parse "17:30" into minutes, mapping 00:00-01:59 onto the tail of the day (24:00-25:59). */
export function parseTime(str) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(str || '');
  if (!m) return null;
  let mins = Number(m[1]) * 60 + Number(m[2]);
  if (mins < DAY_START) mins += MIDNIGHT;
  return Math.max(DAY_START, Math.min(DAY_END - TICK_MINUTES, mins));
}

export function dateLabel(t) {
  const s = SEASONS[t.season];
  return `${s.name} ${t.day}`;
}
