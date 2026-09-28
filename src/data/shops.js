// Shops: hours, closed weekdays (0 = Getsu ... 6 = Nichi) and stock by season and weekday.
import { CROPS } from './crops.js';

export const SHOPS = {
  yorozuya: {
    name: 'Yorozuya', jp: '万屋', open: 9 * 60, close: 17 * 60, closedDay: 2,
    // Seeds for the current season, plus sundries. Do (Saturday) is seed-discount day.
    stock(seasonId, weekdayIdx) {
      const seeds = Object.keys(CROPS).filter((id) => CROPS[id].seasons.includes(seasonId)).map((id) => `seed_${id}`);
      const mult = weekdayIdx === 5 ? 0.9 : 1;
      return [...seeds.map((id) => ({ id, mult })), { id: 'sluice', mult: 1 }];
    },
  },
  kajiya: { name: 'Kajiya', jp: '鍛冶屋', open: 9 * 60, close: 16 * 60, closedDay: 6 },
};

// A round trip down the valley road costs this much of the day.
export const TRIP_MINUTES = 60;
