// Weapons. `cls`: sword (3-hit combo in an arc), spear (a long straight thrust), glaive (a wide
// sweep), bow (arrows in a line). `dmg` per light hit, `speed` scales the swing time, `reach` in px
// from the player's centre, `arc` the half-angle of the cut in radians, `crit` base chance, `ki` the
// heavy strike's Ki cost, `element` one of fire, water, wind, spirit (x1.5 against a weakness).
// `forge`: what Genzō needs to make it; `after` a flag that must be set first.
export const WEAPONS = {
  katana_rusted: {
    name: 'Rusted Katana', jp: '錆刀', cls: 'sword', dmg: 6, speed: 1, reach: 22, arc: 1.1, crit: 0.05, ki: 25,
    desc: 'Your uncle\'s blade, brown with rust. It still remembers how to cut. Tsukikage would like you to know it can hear you.',
  },
  katana_tetsu: {
    name: 'Tetsu Katana', jp: '鉄刀', cls: 'sword', dmg: 12, speed: 1, reach: 22, arc: 1.1, crit: 0.08, ki: 25,
    forge: { mon: 800, items: [['katana_rusted', 1], ['iron_bar', 3]] },
    desc: 'The old blade, reforged by Genzō around a new iron core. Tsukikage hums when it is drawn.',
  },
  yari: {
    name: 'Yari', jp: '槍', cls: 'spear', dmg: 11, speed: 0.85, reach: 34, arc: 0.35, crit: 0.06, ki: 25,
    forge: { mon: 1200, items: [['iron_bar', 3], ['copper_bar', 2], ['wood', 20]] },
    desc: 'A straight spear with a long oak shaft. Keeps trouble at arm\'s length and a bit.',
  },
  naginata: {
    name: 'Naginata', jp: '薙刀', cls: 'glaive', dmg: 11, speed: 0.8, reach: 28, arc: 1.9, crit: 0.05, ki: 30,
    forge: { mon: 1500, items: [['iron_bar', 4], ['copper_bar', 2], ['wood', 20]] },
    desc: 'A curved blade on a pole. Its sweep clears a half-circle.',
  },
  yumi: {
    name: 'Yumi', jp: '弓', cls: 'bow', dmg: 10, speed: 0.9, reach: 150, arc: 0, crit: 0.1, ki: 20,
    forge: { mon: 900, items: [['bamboo', 10], ['copper_bar', 2]] },
    desc: 'A tall bamboo longbow. Each shot takes one arrow (craft them from bamboo and stone).',
  },
  hisui: {
    name: 'Hisui Blade', jp: '翡翠刀', cls: 'sword', dmg: 14, speed: 1.05, reach: 22, arc: 1.1, crit: 0.08, ki: 22, element: 'spirit',
    forge: { mon: 2200, items: [['iron_bar', 4], ['jade', 3]] }, after: 'boss_jubei',
    desc: 'Jade set in the guard. Restless spirits feel it before it lands.',
  },
  mizuchi: {
    name: 'Mizuchi', jp: '蛟', cls: 'sword', dmg: 15, speed: 1, reach: 22, arc: 1.1, crit: 0.08, ki: 25, element: 'water',
    forge: { mon: 2600, items: [['steel_bar', 3], ['water_crystal', 3]] }, after: 'boss_jubei',
    desc: 'Named for the river dragon. The steel is always cold and faintly wet.',
  },
  kurogane: {
    name: 'Kurogane', jp: '黒鉄', cls: 'sword', dmg: 18, speed: 1.1, reach: 23, arc: 1.15, crit: 0.12, ki: 22,
    desc: 'Jūbei\'s black-iron blade. Heavier than it looks, and quicker.',
  },
  // M7: blades from the deep zones, each after the boss that guards the way.
  kitsunebi: {
    name: 'Kitsunebi', jp: '狐火', cls: 'sword', dmg: 21, speed: 1.05, reach: 22, arc: 1.1, crit: 0.1, ki: 22, element: 'fire',
    forge: { mon: 4000, items: [['gold_bar', 3], ['reiseki', 3], ['steel_bar', 2]] }, after: 'boss_kappa_elder',
    desc: 'A gold-washed blade that leaves a trail of pale fire. Foxes hate it, and say so.',
  },
  onikiri: {
    name: 'Onikiri', jp: '鬼切', cls: 'sword', dmg: 25, speed: 1, reach: 23, arc: 1.15, crit: 0.12, ki: 24, element: 'wind',
    forge: { mon: 6000, items: [['steel_bar', 4], ['reiseki', 4], ['tengu_feather', 3]] }, after: 'boss_kyubi',
    desc: 'The oni-cutter. Tengu feathers are bound into the grip; the blade moves before your hand does.',
  },
  kanabo: {
    name: 'Kanabō', jp: '金棒', cls: 'glaive', dmg: 30, speed: 0.7, reach: 26, arc: 1.6, crit: 0.06, ki: 34,
    desc: 'Kurenai\'s iron club, studded and still warm. Swinging it is like arguing with a landslide.',
  },
  tsukikage: {
    name: 'Tsukikage, Reforged', jp: '月影', cls: 'sword', dmg: 33, speed: 1.1, reach: 24, arc: 1.2, crit: 0.15, ki: 20, element: 'spirit',
    forge: { mon: 15000, items: [['katana_tetsu', 1], ['tamahagane', 5], ['reiseki', 5]] }, after: 'boss_kurenai',
    desc: 'Your uncle\'s sword, folded again around jewel steel. Moonlight runs along the edge. It has, for once, nothing to say.',
  },
};

// The sickle doubles as a short, weak weapon.
export const SICKLE = { cls: 'sword', dmg: 4, speed: 1.2, reach: 18, arc: 1, crit: 0.04, ki: 25 };

// Arrows: crafted, one per shot.
export const ARROW_SPEED = 260;

// Things Genzō smelts: `in` -> `out`, with charcoal (sumi) as fuel. Steel after the bandit chief,
// gold after the Kappa Elder, tamahagane from iron sand after Kurenai.
export const SMELT = {
  copper_bar: { in: [['copper_ore', 5], ['sumi', 1]], mon: 20 },
  iron_bar: { in: [['iron_ore', 5], ['sumi', 1]], mon: 40 },
  steel_bar: { in: [['iron_ore', 5], ['sumi', 3]], mon: 150, after: 'boss_jubei' },
  gold_bar: { in: [['gold_ore', 5], ['sumi', 2]], mon: 300, after: 'boss_kappa_elder' },
  tamahagane: { in: [['satetsu', 8], ['sumi', 5]], mon: 800, after: 'boss_kurenai' },
};
