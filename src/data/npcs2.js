// The rest of the valley (M6). Same shape as data/npcs.js. A stop on the map 'away' means the
// villager is not in the valley then (Sakuya between market days, Kon by day, Rin before she
// arrives and when she wanders). `when.flag` matches a story flag ('!flag' when it is unset).
const AWAY = (t) => [t, 'away', 0, 0, 'down'];

export const NPCS2 = {
  soken: {
    name: 'Sōken', jp: '宗謙', role: 'Temple monk', home: 'tera', voice: 130, romance: true,
    birthday: { season: 3, day: 12 },
    gifts: {
      loved: ['tea', 'tofu', 'matsutake'],
      liked: ['rice', 'daikon', 'shiitake', 'yudofu', 'kabu'],
      disliked: ['sake', 'kunsei', 'unagi'],
      hated: ['iron_bar'],
    },
    schedule: [
      { when: { rain: true }, route: [[360, 'tera', 4, 5, 'up'], [720, 'tera', 7, 6, 'left'], [900, 'tera', 4, 5, 'up'], [1140, 'tera', 7, 6, 'left']] },
      { route: [[360, 'tera', 4, 5, 'up'], [540, 'shrine', 10, 6, 'down'], [720, 'village', 20, 7, 'down'], [900, 'tera', 4, 5, 'up'], [1140, 'tera', 7, 6, 'left']] },
    ],
  },
  rin: {
    name: 'Rin', jp: '凛', role: 'Wandering swordswoman', home: 'dojo', voice: 280, romance: true,
    birthday: { season: 2, day: 10 },
    gifts: {
      loved: ['steel_bar', 'kunsei', 'sake'],
      liked: ['onigiri', 'ayu', 'iwana', 'tea', 'jade'],
      disliked: ['strawberry', 'dango', 'ajisai'],
      hated: ['hay'],
    },
    schedule: [
      { when: { flag: '!rin_arrived' }, route: [AWAY(360)] },
      { when: { weekday: 0 }, route: [AWAY(360)] },
      { when: { weekday: 1 }, route: [AWAY(360)] },
      { when: { rain: true }, route: [[360, 'dojo', 6, 5, 'down'], [720, 'chaya', 10, 5, 'left'], [900, 'dojo', 6, 5, 'down']] },
      { route: [[360, 'dojo', 6, 5, 'down'], [600, 'village', 30, 20, 'left'], [840, 'chaya', 10, 5, 'left'], [1080, 'village', 8, 28, 'up'], [1200, 'dojo', 6, 5, 'down']] },
    ],
  },
  toyo: {
    name: 'Toyo', jp: 'トヨ', role: 'Pickle-maker', home: 'toyo', voice: 260, romance: false,
    birthday: { season: 0, day: 3 },
    gifts: {
      loved: ['tsukemono', 'miso', 'shiso'],
      liked: ['daikon', 'kabu', 'hakusai', 'kyuri', 'nasu', 'shoga'],
      disliked: ['sake', 'stone'],
      hated: ['kunsei'],
    },
    schedule: [
      { when: { rain: true }, route: [[360, 'toyo', 4, 5, 'down'], [480, 'toyo', 6, 4, 'up'], [900, 'toyo', 4, 5, 'down']] },
      { route: [[360, 'toyo', 4, 5, 'down'], [480, 'toyo', 6, 4, 'up'], [720, 'village', 18, 28, 'down'], [900, 'chaya', 10, 3, 'left'], [1080, 'toyo', 4, 5, 'down']] },
    ],
  },
  kinta: {
    name: 'Kinta', jp: '金太', role: 'Village boy', home: 'toyo', voice: 420, romance: false,
    birthday: { season: 1, day: 12 },
    gifts: {
      loved: ['dango', 'suika', 'yajiri'],
      liked: ['strawberry', 'onigiri', 'sawagani', 'kuri', 'kabocha'],
      disliked: ['komatsuna', 'shungiku', 'tea'],
      hated: ['gobo'],
    },
    schedule: [
      { when: { rain: true }, route: [[360, 'toyo', 2, 6, 'down'], [720, 'toyo', 3, 4, 'up'], [1020, 'toyo', 2, 6, 'down']] },
      { route: [[360, 'toyo', 2, 6, 'down'], [480, 'village', 30, 17, 'right'], [720, 'village', 44, 21, 'right'], [900, 'village', 36, 33, 'down'], [1080, 'toyo', 2, 6, 'down']] },
    ],
  },
  tatsu: {
    name: 'Tatsu', jp: '辰', role: 'Carpenter', home: 'tatsu', voice: 140, romance: true,
    birthday: { season: 0, day: 18 },
    gifts: {
      loved: ['wood', 'bamboo', 'sake'],
      liked: ['onigiri', 'soba_noodles', 'iron_bar', 'kuri', 'tea'],
      disliked: ['strawberry', 'ajisai'],
      hated: ['hay'],
    },
    schedule: [
      { when: { weekday: 6 }, route: [[360, 'tatsu', 2, 3, 'down'], [480, 'shrine', 24, 6, 'up'], [960, 'chaya', 7, 5, 'right'], [1140, 'tatsu', 2, 3, 'down']] },
      { route: [[360, 'tatsu', 2, 3, 'down'], [480, 'tatsu', 7, 4, 'down'], [1020, 'village', 62, 20, 'left'], [1140, 'tatsu', 2, 3, 'down']] },
    ],
  },
  yuzu: {
    name: 'Yuzu', jp: '柚', role: 'Bathhouse keeper', home: 'sento', voice: 360, romance: true,
    birthday: { season: 1, day: 25 },
    gifts: {
      loved: ['yuzu', 'strawberry', 'tamagoyaki'],
      liked: ['tea', 'dango', 'suika', 'tsubaki', 'momiji'],
      disliked: ['kunsei', 'gobo'],
      hated: ['sumi'],
    },
    schedule: [
      { route: [[360, 'sento', 9, 3, 'down'], [540, 'village', 64, 17, 'down'], [720, 'chaya', 10, 5, 'left'], [900, 'sento', 2, 4, 'down'], [1380, 'sento', 9, 3, 'down']] },
    ],
  },
  sakuya: {
    name: 'Sakuya', jp: '咲耶', role: 'Travelling merchant', home: 'chaya', voice: 320, romance: true,
    birthday: { season: 2, day: 20 },
    gifts: {
      loved: ['jade', 'water_crystal', 'magatama'],
      liked: ['sake', 'miso', 'tsukemono', 'tea', 'kuri'],
      disliked: ['hay', 'stone', 'wood'],
      hated: ['waraji'],
    },
    schedule: [
      { when: { weekday: 3 }, route: [[360, 'chaya', 10, 3, 'left'], [480, 'village', 50, 17, 'down'], [1020, 'chaya', 10, 3, 'left']] },
      { when: { weekday: 4 }, route: [[360, 'chaya', 10, 3, 'left'], [480, 'village', 50, 17, 'down'], [1020, 'village', 26, 13, 'down'], AWAY(1140)] },
      { route: [AWAY(360)] },
    ],
  },
  okubo: {
    name: 'Ōkubo', jp: '大久保', role: 'Magistrate', home: 'daikansho', voice: 90, romance: false,
    birthday: { season: 3, day: 22 },
    gifts: {
      loved: ['sake', 'magatama', 'steel_bar'],
      liked: ['kunsei', 'miso', 'tamahagane', 'unadon'],
      disliked: ['hay', 'komatsuna', 'onigiri'],
      hated: ['waraji', 'driftwood'],
    },
    schedule: [
      { when: { weekday: 2 }, route: [[360, 'daikansho', 6, 3, 'down'], [600, 'village', 49, 28, 'up'], [840, 'daikansho', 6, 3, 'down']] },
      { route: [[360, 'daikansho', 6, 3, 'down'], [600, 'village', 49, 6, 'down'], [690, 'daikansho', 6, 3, 'down']] },
    ],
  },
  shinsuke: {
    name: 'Shinsuke', jp: '新助', role: 'Magistrate\'s officer', home: 'daikansho', voice: 200, romance: false,
    birthday: { season: 0, day: 27 },
    gifts: {
      loved: ['onigiri', 'soba_noodles', 'ochazuke'],
      liked: ['tea', 'rice', 'kuri', 'dango', 'ayu'],
      disliked: ['sake', 'tonic'],
      hated: ['stone'],
    },
    schedule: [
      { when: { rain: true }, route: [[360, 'daikansho', 10, 6, 'down'], [720, 'chaya', 7, 5, 'right'], [840, 'daikansho', 10, 6, 'down']] },
      { route: [[360, 'daikansho', 10, 6, 'down'], [480, 'village', 40, 13, 'down'], [720, 'village', 20, 13, 'down'], [900, 'village', 60, 13, 'down'], [1080, 'village', 45, 6, 'down'], [1200, 'daikansho', 10, 6, 'down']] },
    ],
  },
  kon: {
    name: 'Kon', jp: 'コン', role: 'Night-market vendor', home: 'village', voice: 440, romance: false,
    birthday: { season: 2, day: 5 },
    gifts: {
      loved: ['inari', 'tofu', 'yudofu'],
      liked: ['dango', 'kuri', 'akebi', 'magatama', 'spirit_wisp'],
      disliked: ['iron_bar', 'steel_bar'],
      hated: ['kizugusuri'],
    },
    schedule: [
      { when: { weekday: 5 }, route: [AWAY(360), [1080, 'village', 60, 17, 'down'], AWAY(1440)] },
      { route: [AWAY(360)] },
    ],
  },
};
