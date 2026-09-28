// Shops: hours, closed weekdays (0 = Getsu ... 6 = Nichi) and stock by season and weekday.
import { CROPS } from './crops.js';
import { SCROLLS } from './recipes.js';
import { hash } from '../core/rng.js';

export const SHOPS = {
  yorozuya: {
    name: 'Yorozuya', jp: '万屋', open: 9 * 60, close: 17 * 60, closedDay: 2, hello: 'chobei_hello', buys: true,
    // Seeds for the current season, plus sundries. Do (Saturday) is seed-discount day.
    stock(seasonId, weekdayIdx, g) {
      const seeds = Object.keys(CROPS).filter((id) => CROPS[id].seasons.includes(seasonId)).map((id) => `seed_${id}`);
      const mult = weekdayIdx === 5 ? 0.9 : 1;
      const packs = ['pack24', 'pack36'].filter((id, i) => g.inventory.size < (i ? 36 : 24) && (i === 0 || g.inventory.size >= 24));
      return [...seeds.map((id) => ({ id, mult })), ...['sluice', 'uke', 'chick', 'duckling', ...packs].map((id) => ({ id, mult: 1 }))];
    },
  },
  kajiya: { name: 'Kajiya', jp: '鍛冶屋', open: 9 * 60, close: 16 * 60, closedDay: 6, hello: 'genzo_hello' },
  chaya: {
    name: 'Chaya', jp: '茶屋', open: 8 * 60, close: 20 * 60, closedDay: 3, hello: 'okiku_hello',
    // Food, and up to three recipe scrolls you don't know yet (a different few each day).
    stock: (seasonId, weekdayIdx, g) => {
      const unknown = SCROLLS.filter((d) => !g.recipes.includes(d));
      const day = hash(g.seed, g.dayIndex, 0, 91);
      const scrolls = unknown.filter((_, i) => (i + day) % Math.max(1, Math.ceil(unknown.length / 3)) === 0).slice(0, 3);
      return [...['tea', 'dango', 'onigiri'], ...scrolls.map((d) => `scroll_${d}`)].map((id) => ({ id, mult: 1 }));
    },
  },
  yakuya: {
    name: 'Yakuya', jp: '薬屋', open: 10 * 60, close: 18 * 60, closedDay: 0, hello: 'ume_hello',
    stock: () => ['tonic', 'salve', 'kizugusuri'].map((id) => ({ id, mult: 1 })),
  },
  // M6. Stalls in the square (`keeper`, `at` the map they stand on) and shops open only on `days`.
  sakuya: {
    name: 'Sakuya\'s Stall', jp: '咲耶の店', open: 8 * 60, close: 17 * 60, days: [3, 4], keeper: 'sakuya', at: 'village', hello: 'sakuya_hello',
    stock: (seasonId, weekdayIdx, g) => {
      const rare = ['jade', 'water_crystal', 'magatama', 'steel_bar'][hash(g.seed, g.dayIndex, 0, 93) % 4];
      return [...['tofu', 'miso', 'sake', 'copper_bar', 'arrow', 'uke'], rare].map((id) => ({ id, mult: 1 }));
    },
  },
  kon: {
    name: 'Night Market', jp: '夜市', open: 18 * 60, close: 24 * 60, days: [5], keeper: 'kon', at: 'village', hello: 'kon_hello',
    stock: (seasonId, weekdayIdx, g) => [...['inari', 'spirit_wisp', 'leaf_charm', 'water_crystal'], ...(g.recipes.includes('inari') ? [] : ['scroll_inari'])].map((id) => ({ id, mult: 1 })),
  },
  tatsu: {
    name: 'Daiku', jp: '大工', open: 9 * 60, close: 17 * 60, closedDay: 6, hello: 'tatsu_hello',
    stock: (seasonId, weekdayIdx, g) => [...(g.flags.house_upgraded || g.construction ? [] : ['house_ext']), 'sluice', 'uke'].map((id) => ({ id, mult: 1 })),
  },
  sento: {
    name: 'Sentō', jp: '銭湯', open: 15 * 60, close: 23 * 60, closedDay: 1, hello: 'yuzu_hello',
    stock: () => ['bath_salt', 'tea', 'dango'].map((id) => ({ id, mult: 1 })),
  },
  // The shrine's charm stand: no keeper, an honesty box.
  omamori: {
    name: 'Charm Stand', jp: 'お守り', open: 6 * 60, close: 22 * 60, hello: 'omamori_hello',
    stock: () => ['red_thread', 'shrine_vow'].map((id) => ({ id, mult: 1 })),
  },
};
