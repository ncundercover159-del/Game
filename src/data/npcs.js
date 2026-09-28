// The villagers: who they are, where they live, when they were born, what they like, and where they
// are through the day. Dialogue lives in data/dialogue/<id>.js.
//
// Schedules: a list of variants; the first whose `when` matches today is used (keys: season id,
// weekday index 0-6 = Getsu..Nichi, rain true/false). A route is [minutes, map, tx, ty, facing]
// stops: from that time on the villager walks to that spot and waits there.

export const NPCS = {
  genzo: {
    name: 'Genzō', jp: '源蔵', role: 'Swordsmith', home: 'kajiya', voice: 110, romance: false,
    birthday: { season: 2, day: 14 },
    gifts: {
      loved: ['iron_bar', 'steel_bar', 'tamahagane'],
      liked: ['onigiri', 'daikon', 'negi', 'satoimo', 'tea'],
      disliked: ['strawberry', 'dango', 'shungiku'],
      hated: ['hay'],
    },
    schedule: [
      { when: { weekday: 6 }, route: [[360, 'kajiya', 10, 3, 'down'], [600, 'shrine', 19, 13, 'up'], [840, 'village', 46, 39, 'down'], [1080, 'chaya', 7, 5, 'right'], [1200, 'kajiya', 10, 3, 'down']] },
      { route: [[360, 'kajiya', 5, 5, 'up'], [530, 'kajiya', 8, 4, 'down'], [960, 'kajiya', 5, 5, 'up'], [1020, 'village', 40, 41, 'down'], [1140, 'kajiya', 10, 3, 'down']] },
    ],
  },
  okiku: {
    name: 'Okiku', jp: 'お菊', role: 'Teahouse keeper', home: 'chaya', voice: 330, romance: false,
    birthday: { season: 0, day: 9 },
    gifts: {
      loved: ['strawberry', 'azuki', 'dango'],
      liked: ['tea', 'shiso', 'suika', 'kabocha', 'satsumaimo'],
      disliked: ['stone', 'gobo', 'wood'],
      hated: ['tonic'],
    },
    schedule: [
      { when: { weekday: 3, rain: false }, route: [[360, 'chaya', 11, 3, 'down'], [540, 'village', 55, 20, 'left'], [780, 'shrine', 12, 12, 'up'], [1000, 'village', 22, 12, 'left'], [1140, 'chaya', 11, 3, 'down']] },
      { route: [[360, 'chaya', 11, 3, 'down'], [450, 'chaya', 2, 3, 'down'], [1210, 'chaya', 11, 3, 'down']] },
    ],
  },
  tomoe: {
    name: 'Tomoe', jp: '巴', role: 'Shrine maiden', home: 'shamusho', voice: 380, romance: true,
    birthday: { season: 1, day: 21 },
    gifts: {
      loved: ['rice', 'soba', 'tea'],
      liked: ['daikon', 'kabu', 'strawberry', 'bamboo', 'dango'],
      disliked: ['iron_bar', 'stone', 'nasu'],
      hated: ['tonic'],
    },
    schedule: [
      { when: { rain: true }, route: [[360, 'shamusho', 1, 3, 'down'], [450, 'honden', 8, 5, 'up'], [720, 'shamusho', 6, 4, 'left'], [840, 'honden', 12, 5, 'up'], [1140, 'shamusho', 1, 3, 'down']] },
      { when: { weekday: 6 }, route: [[360, 'shamusho', 1, 3, 'down'], [420, 'shrine', 14, 13, 'down'], [660, 'village', 60, 20, 'down'], [900, 'village', 34, 16, 'right'], [1080, 'shrine', 20, 20, 'down'], [1180, 'shamusho', 1, 3, 'down']] },
      { route: [[360, 'shamusho', 1, 3, 'down'], [420, 'shrine', 14, 13, 'down'], [720, 'shamusho', 6, 4, 'left'], [800, 'shrine', 10, 12, 'left'], [1000, 'shrine', 20, 22, 'down'], [1140, 'shamusho', 1, 3, 'down']] },
    ],
  },
  heibei: {
    name: 'Heibei', jp: '平兵衛', role: 'Village headman', home: 'heibei', voice: 150, romance: false,
    birthday: { season: 3, day: 4 },
    gifts: {
      loved: ['rice', 'daizu', 'tonic'],
      liked: ['soba', 'satoimo', 'onigiri', 'hakusai', 'tea'],
      disliked: ['suika', 'dango'],
      hated: ['stone'],
    },
    schedule: [
      { when: { rain: true }, route: [[360, 'heibei', 2, 4, 'down'], [480, 'heibei', 7, 4, 'right'], [900, 'village', 43, 12, 'up'], [1000, 'heibei', 7, 4, 'right'], [1200, 'heibei', 2, 4, 'down']] },
      { route: [[360, 'heibei', 2, 4, 'down'], [480, 'village', 43, 12, 'up'], [600, 'village', 49, 6, 'up'], [780, 'heibei', 7, 4, 'right'], [900, 'village', 56, 20, 'down'], [1080, 'village', 39, 39, 'down'], [1200, 'heibei', 2, 4, 'down']] },
    ],
  },
  ume: {
    name: 'Ume', jp: '梅', role: 'Herbalist', home: 'yakuya', voice: 300, romance: true,
    birthday: { season: 0, day: 23 },
    gifts: {
      loved: ['shoga', 'shiso', 'gobo'],
      liked: ['tonic', 'negi', 'tea', 'bamboo', 'kabu'],
      disliked: ['dango', 'strawberry', 'suika'],
      hated: ['hay'],
    },
    schedule: [
      { when: { rain: true }, route: [[360, 'yakuya', 9, 3, 'down'], [570, 'yakuya', 5, 3, 'down'], [1100, 'yakuya', 9, 3, 'down']] },
      { when: { weekday: 0 }, route: [[360, 'yakuya', 9, 3, 'down'], [480, 'village', 4, 13, 'left'], [720, 'village', 17, 34, 'left'], [900, 'shrine', 9, 11, 'up'], [1140, 'yakuya', 9, 3, 'down']] },
      { route: [[360, 'yakuya', 9, 3, 'down'], [570, 'yakuya', 5, 3, 'down'], [1090, 'village', 26, 33, 'down'], [1200, 'yakuya', 9, 3, 'down']] },
    ],
  },
  daigo: {
    name: 'Daigo', jp: '大吾', role: 'Fisherman and ferryman', home: 'daigo', voice: 120, romance: true,
    birthday: { season: 1, day: 6 },
    gifts: {
      loved: ['onigiri', 'satsumaimo', 'kyuri'],
      liked: ['edamame', 'negi', 'daikon', 'tea', 'dango'],
      disliked: ['tonic', 'shungiku'],
      hated: ['stone'],
    },
    schedule: [
      { when: { rain: true }, route: [[360, 'daigo', 1, 4, 'down'], [480, 'daigo', 3, 5, 'up'], [900, 'chaya', 10, 5, 'left'], [1140, 'daigo', 1, 4, 'down']] },
      { route: [[360, 'daigo', 1, 4, 'down'], [400, 'village', 30, 39, 'down'], [720, 'village', 47, 39, 'down'], [780, 'village', 40, 42, 'right'], [1020, 'chaya', 10, 5, 'left'], [1200, 'daigo', 1, 4, 'down']] },
    ],
  },
  kaito: {
    name: 'Kaito', jp: '海斗', role: 'Farmer', home: 'kaito', voice: 240, romance: true,
    birthday: { season: 2, day: 2 },
    gifts: {
      loved: ['suika', 'kabocha', 'edamame'],
      liked: ['rice', 'soramame', 'dango', 'onigiri', 'strawberry'],
      disliked: ['komatsuna', 'tea'],
      hated: ['gobo'],
    },
    schedule: [
      { when: { rain: true }, route: [[360, 'kaito', 1, 4, 'down'], [480, 'kaito', 3, 5, 'up'], [780, 'chaya', 7, 5, 'right'], [1020, 'kaito', 3, 5, 'up'], [1200, 'kaito', 1, 4, 'down']] },
      { when: { season: 'winter' }, route: [[360, 'kaito', 1, 4, 'down'], [540, 'village', 60, 20, 'up'], [780, 'yorozuya', 9, 6, 'up'], [900, 'village', 52, 13, 'down'], [1140, 'kaito', 1, 4, 'down']] },
      { route: [[360, 'kaito', 1, 4, 'down'], [400, 'village', 60, 52, 'up'], [720, 'village', 66, 53, 'up'], [900, 'village', 60, 20, 'up'], [1080, 'village', 25, 33, 'left'], [1200, 'kaito', 1, 4, 'down']] },
    ],
  },
  chobei: {
    name: 'Chōbei', jp: '長兵衛', role: 'Storekeeper', home: 'yorozuya', voice: 170, romance: false,
    birthday: { season: 3, day: 17 },
    gifts: {
      loved: ['steel_bar', 'tamahagane', 'suika'],
      liked: ['rice', 'daizu', 'azuki', 'iron_bar', 'soba'],
      disliked: ['hay', 'wood', 'shiso'],
      hated: ['stone'],
    },
    schedule: [
      { when: { weekday: 2 }, route: [[360, 'yorozuya', 10, 3, 'down'], [480, 'village', 44, 12, 'up'], [720, 'chaya', 7, 5, 'right'], [900, 'village', 64, 20, 'left'], [1140, 'yorozuya', 10, 3, 'down']] },
      { route: [[360, 'yorozuya', 10, 3, 'down'], [520, 'yorozuya', 6, 4, 'down'], [1030, 'village', 64, 20, 'left'], [1140, 'yorozuya', 10, 3, 'down']] },
    ],
  },
};

export const NPC_IDS = Object.keys(NPCS);

// Bonds (kizuna): 250 points a heart, ten hearts.
export const BOND = {
  perHeart: 250, maxHearts: 10, talk: 20, giftsPerWeek: 2, birthdayMult: 8,
  gift: { loved: 80, liked: 45, neutral: 20, disliked: -20, hated: -40 },
  decayAfterDays: 7, decay: 10,
};

/** Which schedule variant applies today. */
export function routeFor(npc, { season, weekday, rain }) {
  const v = NPCS[npc].schedule.find(({ when = {} }) =>
    (when.season === undefined || when.season === season) &&
    (when.weekday === undefined || when.weekday === weekday) &&
    (when.rain === undefined || when.rain === rain));
  return v.route;
}

/** The stop a villager should be at (or heading to) at `minutes`. */
export function stopAt(route, minutes) {
  let cur = route[0];
  for (const s of route) if (s[0] <= minutes) cur = s;
  return cur;
}

// People who speak in scenes but are not villagers (no schedule, bond or gifts).
export const SPEAKERS = {
  jubei: { name: 'Jūbei', jp: '十兵衛', voice: 95 },
};
