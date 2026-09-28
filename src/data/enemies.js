// Enemies of Mount Kurayama. `brain` picks the behaviour in world/brains.js. Every attack is
// preceded by a `tell` (seconds of wind-up with a flash and a sound) so nothing hits unannounced;
// melee attacks can be parried in the last PARRY_WINDOW of the tell and at the strike.
// `weak`: element that deals x1.5. `drops`: [item, min, max, chance]. `xp`: Swordsmanship XP.
export const ENEMIES = {
  bandit: {
    name: 'Nobushi', jp: '野武士', brain: 'duelist', hp: 32, dmg: 12, speed: 40, tell: 0.5, reach: 20,
    guard: true, xp: 12, zone: 1, weak: null, mass: 1, person: true,
    drops: [['copper_ore', 1, 2, 0.5], ['onigiri', 1, 1, 0.15], ['iron_ore', 1, 1, 0.2]],
    desc: 'A masterless swordsman gone bad. Raises the blade high before he cuts; guards against light blows.',
  },
  karakasa: {
    name: 'Karakasa', jp: '唐傘', brain: 'hopper', hp: 18, dmg: 8, speed: 34, tell: 0.45, reach: 14,
    xp: 8, zone: 1, weak: 'spirit', mass: 0.6,
    drops: [['bamboo', 1, 2, 0.6], ['hay', 1, 2, 0.3]],
    desc: 'An old umbrella that grew an eye and a grudge. It squats before it leaps.',
  },
  tanuki: {
    name: 'Bake-danuki', jp: '化け狸', brain: 'charger', hp: 24, dmg: 10, speed: 30, tell: 0.6, reach: 12,
    xp: 10, zone: 1, weak: null, mass: 0.9,
    drops: [['kuri', 1, 1, 0.3], ['copper_ore', 1, 1, 0.3], ['leaf_charm', 1, 1, 0.08]],
    desc: 'A trickster raccoon dog. It drums its belly, then rolls at you like a barrel. Walls stop it cold.',
  },
  kappa: {
    name: 'Kappa', jp: '河童', brain: 'ambusher', hp: 34, dmg: 12, speed: 38, tell: 0.45, reach: 16,
    xp: 14, zone: 2, weak: null, mass: 1, water: true,
    drops: [['kyuri', 1, 1, 0.3], ['water_crystal', 1, 1, 0.25], ['jade', 1, 1, 0.1]],
    desc: 'Lurks under still water. The ripple, then a splash, then the lunge. Bow to it and it might bow back.',
  },
  chochin: {
    name: 'Chōchin-obake', jp: '提灯お化け', brain: 'caster', hp: 20, dmg: 9, speed: 26, tell: 0.7, reach: 90,
    xp: 12, zone: 2, weak: 'water', mass: 0.5, float: true,
    drops: [['sumi', 1, 1, 0.4], ['water_crystal', 1, 1, 0.15]],
    desc: 'A paper lantern with a tongue. Its mouth glows before it spits foxfire; a parry sends the flame back.',
  },
  yurei: {
    name: 'Yūrei', jp: '幽霊', brain: 'phantom', hp: 26, dmg: 11, speed: 30, tell: 0.55, reach: 16,
    xp: 14, zone: 2, weak: 'spirit', mass: 0.4, float: true,
    drops: [['jade', 1, 1, 0.2], ['spirit_wisp', 1, 1, 0.35]],
    desc: 'A drowned sorrow. It fades from sight; cold wisps gather where it will appear.',
  },
  // Zone 3, the Foxfire Halls.
  kitsune: {
    name: 'Kitsune', jp: '狐', brain: 'trickster', hp: 40, dmg: 11, speed: 46, tell: 0.45, reach: 16,
    xp: 18, zone: 3, weak: null, mass: 0.7,
    drops: [['reiseki', 1, 1, 0.2], ['leaf_charm', 1, 1, 0.25], ['gold_ore', 1, 1, 0.15]],
    desc: 'A fox that has learned to lie with its whole body. Hurt it and it splits in three; only the true fox casts a shadow.',
  },
  onibi: {
    name: 'Onibi', jp: '鬼火', brain: 'swarm', hp: 14, dmg: 7, speed: 44, tell: 0.4, reach: 12,
    xp: 7, zone: 3, weak: 'water', mass: 0.3, float: true, pack: 3,
    drops: [['sumi', 1, 1, 0.3], ['spirit_wisp', 1, 1, 0.1]],
    desc: 'Will-o\'-wisps that hunt in threes. Each one flares white before it dives.',
  },
  tengu: {
    name: 'Karasu-tengu', jp: '烏天狗', brain: 'summoner', hp: 44, dmg: 10, speed: 34, tell: 0.7, reach: 22,
    xp: 22, zone: 3, weak: 'fire', mass: 1,
    drops: [['tengu_feather', 1, 1, 0.5], ['reiseki', 1, 1, 0.15]],
    desc: 'A crow-headed mountain goblin. It spreads its wings to call its crows, and cuts with its fan when you come close.',
  },
  karasu: {
    name: 'Crow', jp: '烏', brain: 'swarm', hp: 8, dmg: 5, speed: 60, tell: 0.35, reach: 10,
    xp: 3, zone: 3, weak: null, mass: 0.2, float: true, summoned: true,
    drops: [],
    desc: 'A tengu\'s crow. It hangs in the air a moment before it stoops.',
  },
  // Zone 4, the Oni Foundry.
  oni: {
    name: 'Oni', jp: '鬼', brain: 'brute', hp: 110, dmg: 16, speed: 26, tell: 0.9, reach: 26,
    guard: true, xp: 40, zone: 4, weak: 'water', mass: 3, big: true,
    drops: [['satetsu', 1, 3, 0.6], ['gold_ore', 1, 1, 0.2], ['tamahagane', 1, 1, 0.03]],
    desc: 'A foundry oni with an iron club. Light blows glance off its hide; after the smash, when the ground still shakes, it is open.',
  },
  inoshishi: {
    name: 'Inoshishi', jp: '猪', brain: 'charger', hp: 50, dmg: 12, speed: 34, tell: 0.6, reach: 14,
    xp: 20, zone: 4, weak: null, mass: 1.5,
    drops: [['satetsu', 1, 1, 0.3], ['yamaimo', 1, 1, 0.2]],
    desc: 'A boar with a forge-scorched hide. It paws the ground, then charges in a straight line. Walls stop it.',
  },
  // Zone 5, the Yomi Slope.
  retainer: {
    name: 'Ghost Retainer', jp: '亡霊武者', brain: 'duelist', hp: 60, dmg: 11, speed: 42, tell: 0.5, reach: 20,
    guard: true, xp: 30, zone: 5, weak: 'spirit', mass: 1, person: true, ghost: true,
    drops: [['reiseki', 1, 1, 0.3], ['steel_bar', 1, 1, 0.15], ['spirit_wisp', 1, 1, 0.3]],
    desc: 'A samurai of the Aizawa, dead these five years and still in armour. He raises his blade high, as he was taught.',
  },
  shinobi: {
    name: 'Shinobi', jp: '忍', brain: 'stealth', hp: 46, dmg: 10, speed: 50, tell: 0.5, reach: 18,
    xp: 26, zone: 4, weak: null, mass: 1, person: true,
    drops: [['steel_bar', 1, 1, 0.1], ['arrow', 2, 4, 0.4], ['kizugusuri', 1, 1, 0.05]],
    desc: 'An agent of someone below. Unseen but for the dust at its feet; it raises an arm before the stars fly.',
  },
};

// Bosses guard the last floor of each zone. `phases` start at these fractions of health; `armour`
// plates turn light blows until heavy strikes knock them off.
export const BOSSES = {
  jubei: {
    name: 'Kurogane no Jūbei', jp: '黒鉄の十兵衛', brain: 'jubei', boss: true, person: true, hp: 260, dmg: 14, speed: 52, tell: 0.45,
    reach: 22, xp: 200, phases: [1, 0.6, 0.3], weak: null, mass: 2, radius: 9, height: 14, drops: [],
  },
  kappa_elder: {
    name: 'The Kappa Elder', jp: '河童の長老', brain: 'kappaElder', boss: true, hp: 750, dmg: 18, speed: 40, tell: 0.6,
    reach: 26, xp: 350, phases: [1, 0.6, 0.3], weak: null, mass: 4, radius: 13, height: 16, water: true, drops: [],
  },
  kyubi: {
    name: 'Kyūbi, the Nine-Tailed', jp: '九尾', brain: 'kyubi', boss: true, hp: 1300, dmg: 20, speed: 60, tell: 0.55,
    reach: 22, xp: 500, phases: [1, 0.6, 0.3], weak: 'spirit', mass: 3, radius: 12, height: 14, drops: [],
  },
  kurenai: {
    name: 'Oni Warlord Kurenai', jp: '紅', brain: 'kurenai', boss: true, hp: 1400, dmg: 24, speed: 36, tell: 0.7,
    reach: 30, xp: 700, phases: [1, 0.6, 0.3], weak: 'water', mass: 6, radius: 14, height: 22, armour: 3, drops: [],
  },
  aizawa: {
    name: 'The Shade of Lord Aizawa', jp: '相沢公の亡霊', brain: 'shade', boss: true, person: true, ghost: true, hp: 1500, dmg: 22, speed: 50,
    tell: 0.45, reach: 24, xp: 1000, phases: [1, 0.6, 0.3], weak: 'spirit', mass: 3, radius: 9, height: 14, drops: [],
  },
};
export const BOSS_JUBEI = BOSSES.jubei;



// Difficulty scales what enemies deal and endure, and what a defeat costs.
export const DIFFICULTY = {
  relaxed: { name: 'Relaxed', dmg: 0.6, hp: 0.8, loss: 0, items: 0, drops: 1 },
  standard: { name: 'Standard', dmg: 1, hp: 1, loss: 0.1, lossCap: 1000, items: 2, drops: 1 },
  warrior: { name: 'Warrior', dmg: 1.35, hp: 1.3, loss: 0.15, lossCap: 2500, items: 4, drops: 1.5 },
};
