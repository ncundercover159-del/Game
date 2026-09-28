import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCalendar, dayIndex, weekday, nextDay, zodiacHour, formatTime, parseTime, isMarketDay, DAY_START } from '../../src/systems/calendar.js';

test('new calendar starts Haru 1, year 1, 06:00', () => {
  assert.deepEqual(newCalendar(), { day: 1, season: 0, year: 1, minutes: DAY_START });
});

test('day rolls over into the next season and year', () => {
  let r = nextDay({ day: 28, season: 0, year: 1, minutes: 1500 });
  assert.deepEqual(r.t, { day: 1, season: 1, year: 1, minutes: DAY_START });
  assert.equal(r.newSeason, true);
  r = nextDay({ day: 28, season: 3, year: 1, minutes: 700 });
  assert.deepEqual(r.t, { day: 1, season: 0, year: 2, minutes: DAY_START });
  assert.equal(r.newYear, true);
});

test('weekdays cycle Getsu..Nichi and every 7th day is market day', () => {
  const t = { day: 1, season: 0, year: 1 };
  assert.equal(weekday(t).name, 'Getsu');
  assert.equal(weekday({ ...t, day: 7 }).name, 'Nichi');
  assert.equal(isMarketDay({ ...t, day: 7 }), true);
  assert.equal(isMarketDay({ ...t, day: 8 }), false);
  assert.equal(dayIndex({ day: 1, season: 0, year: 2 }), 112);
});

test('zodiac hours: 子 spans 23:00-01:00, 卯 covers 05:00-07:00', () => {
  assert.equal(zodiacHour(23 * 60).jp, '子');
  assert.equal(zodiacHour(24 * 60 + 30).jp, '子');
  assert.equal(zodiacHour(25 * 60).jp, '丑');
  assert.equal(zodiacHour(6 * 60).jp, '卯');
  assert.equal(zodiacHour(12 * 60).jp, '午');
});

test('time formatting wraps past midnight and parsing maps early hours to the tail of the day', () => {
  assert.equal(formatTime(360), '06:00');
  assert.equal(formatTime(25 * 60 + 10), '01:10');
  assert.equal(parseTime('17:30'), 17 * 60 + 30);
  assert.equal(parseTime('01:00'), 25 * 60);
  assert.equal(parseTime('nonsense'), null);
});
