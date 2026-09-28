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
};

// The sickle doubles as a short, weak weapon.
export const SICKLE = { cls: 'sword', dmg: 4, speed: 1.2, reach: 18, arc: 1, crit: 0.04, ki: 25 };

// Arrows: crafted, one per shot.
export const ARROW_SPEED = 260;

// Things Genzō smelts: `in` -> `out`, with charcoal (sumi) as fuel. Steel after the bandit chief.
export const SMELT = {
  copper_bar: { in: [['copper_ore', 5], ['sumi', 1]], mon: 20 },
  iron_bar: { in: [['iron_ore', 5], ['sumi', 1]], mon: 40 },
  steel_bar: { in: [['iron_ore', 5], ['sumi', 3]], mon: 150, after: 'boss_jubei' },
};
