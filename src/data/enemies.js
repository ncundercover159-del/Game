// Enemies of Mount Kurayama. `brain` picks the behaviour in world/brains.js. Every attack is
// preceded by a `tell` (seconds of wind-up with a flash and a sound) so nothing hits unannounced;
// melee attacks can be parried in the last PARRY_WINDOW of the tell and at the strike.
// `weak`: element that deals x1.5. `drops`: [item, min, max, chance]. `xp`: Swordsmanship XP.
export const ENEMIES = {
  bandit: {
    name: 'Nobushi', jp: '野武士', brain: 'duelist', hp: 32, dmg: 12, speed: 40, tell: 0.5, reach: 20,
    guard: true, xp: 12, zone: 1, weak: null, mass: 1,
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
};

// Jūbei, bandit chief, guards floor 20. Phases start at these fractions of his health.
export const BOSS_JUBEI = {
  name: 'Kurogane no Jūbei', jp: '黒鉄の十兵衛', hp: 260, dmg: 14, speed: 52, tell: 0.45, reach: 22, xp: 200,
  phases: [1, 0.6, 0.3], weak: null, mass: 2,
};

// Difficulty scales what enemies deal and endure, and what a defeat costs.
export const DIFFICULTY = {
  relaxed: { name: 'Relaxed', dmg: 0.6, hp: 0.8, loss: 0, items: 0, drops: 1 },
  standard: { name: 'Standard', dmg: 1, hp: 1, loss: 0.1, lossCap: 1000, items: 2, drops: 1 },
  warrior: { name: 'Warrior', dmg: 1.35, hp: 1.3, loss: 0.15, lossCap: 2500, items: 4, drops: 1.5 },
};
