// Word tiles for the haiku composer (systems/verse.js). `s`: syllables; `img`: how vivid the image
// is (0-3); `kigo`: the season it names; `cut`: a cutting word (kireji) that pauses the verse.
// All original; English syllable counts stand in for the Japanese on.
export const KIGO = {
  spring: [
    { w: 'plum blossoms', s: 4, img: 3 }, { w: 'spring rain', s: 2, img: 2 }, { w: 'frogs', s: 1, img: 2 },
    { w: 'cherry petals', s: 4, img: 3 }, { w: 'haze', s: 1, img: 2 }, { w: 'the skylark', s: 3, img: 3 },
  ],
  summer: [
    { w: 'cicadas', s: 3, img: 3 }, { w: 'fireflies', s: 3, img: 3 }, { w: 'summer grass', s: 3, img: 2 },
    { w: 'morning glory', s: 4, img: 3 }, { w: 'the long day', s: 3, img: 1 }, { w: 'heat', s: 1, img: 2 },
  ],
  autumn: [
    { w: 'harvest moon', s: 3, img: 3 }, { w: 'red maples', s: 3, img: 3 }, { w: 'autumn wind', s: 3, img: 2 },
    { w: 'crickets', s: 2, img: 2 }, { w: 'chestnuts', s: 2, img: 2 }, { w: 'geese', s: 1, img: 2 },
  ],
  winter: [
    { w: 'first snow', s: 2, img: 3 }, { w: 'winter moon', s: 3, img: 3 }, { w: 'bare branches', s: 3, img: 2 },
    { w: 'frost', s: 1, img: 2 }, { w: 'withered fields', s: 3, img: 2 }, { w: 'the cold', s: 2, img: 1 },
  ],
};

export const CUTS = [
  { w: 'ah —', s: 1, img: 0, cut: true },
  { w: 'how quiet —', s: 3, img: 1, cut: true },
];

export const WORDS = [
  { w: 'the old well', s: 3, img: 2 }, { w: 'my hoe', s: 2, img: 1 }, { w: 'a crow', s: 2, img: 2 },
  { w: 'the rusted sword', s: 4, img: 3 }, { w: 'rice paddies', s: 4, img: 2 }, { w: 'still water', s: 3, img: 2 },
  { w: 'the mountain path', s: 4, img: 2 }, { w: 'the temple bell', s: 4, img: 3 }, { w: 'my shadow', s: 3, img: 2 },
  { w: 'a tired ox', s: 3, img: 2 }, { w: 'lantern light', s: 3, img: 2 }, { w: 'falls asleep', s: 3, img: 1 },
  { w: 'drifts away', s: 3, img: 2 }, { w: 'in the rain', s: 3, img: 1 }, { w: 'alone', s: 2, img: 1 },
  { w: 'again', s: 2, img: 0 }, { w: 'at dusk', s: 2, img: 2 }, { w: 'the wind', s: 2, img: 1 },
  { w: 'smoke', s: 1, img: 1 }, { w: 'stone', s: 1, img: 1 }, { w: 'and', s: 1, img: 0 }, { w: 'the', s: 1, img: 0 },
  { w: 'on the roof', s: 3, img: 1 }, { w: 'no one comes', s: 3, img: 2 }, { w: 'silence', s: 2, img: 2 },
  { w: 'the river', s: 3, img: 2 }, { w: 'a kappa', s: 3, img: 2 }, { w: 'my old straw hat', s: 4, img: 3 },
  { w: 'the gate', s: 2, img: 1 }, { w: 'wet sandals', s: 3, img: 2 }, { w: 'far away', s: 3, img: 1 },
  { w: 'a child laughs', s: 3, img: 2 }, { w: 'tea', s: 1, img: 1 }, { w: 'the ferry', s: 3, img: 2 },
];
