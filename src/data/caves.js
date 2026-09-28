// Mount Kurayama. Floors are generated from the save seed and the floor number (systems/cavegen.js).
// Zone 1 (floors 1-20) Old Mine Tunnels, zone 2 (21-40) Flooded Cellars, zone 3 (41-60) Foxfire
// Halls, zone 4 (61-80) Oni Foundry. A lantern stands every LANTERN_EVERY floors; lit ones let you
// start from them. The last floor of each zone is a boss's arena. `pools` are water, or lava in the
// foundry (`lava`), where vents also breathe fire on a cycle.
export const ZONES = [
  {
    id: 'mine', name: 'Old Mine Tunnels', jp: '古坑道', from: 1, to: 20,
    enemies: [['bandit', 3], ['karakasa', 4], ['tanuki', 3]],
    ores: [['copper', 6], ['iron', 3], ['stone', 5]],
    water: 0, timbers: true,
  },
  {
    id: 'cellars', name: 'Flooded Cellars', jp: '水没の蔵', from: 21, to: 40,
    enemies: [['kappa', 3], ['chochin', 3], ['yurei', 3], ['bandit', 1]],
    ores: [['iron', 4], ['jade', 2], ['crystal', 2], ['stone', 4]],
    water: 3, timbers: false,
  },
  {
    id: 'foxfire', name: 'Foxfire Halls', jp: '狐火の間', from: 41, to: 60,
    enemies: [['kitsune', 4], ['onibi', 3], ['tengu', 2], ['chochin', 1]],
    ores: [['gold', 3], ['reiseki', 3], ['iron', 2], ['stone', 4]],
    water: 0, timbers: false,
  },
  {
    id: 'foundry', name: 'Oni Foundry', jp: '鬼の鋳造場', from: 61, to: 80,
    enemies: [['oni', 2], ['inoshishi', 3], ['shinobi', 3], ['onibi', 1]],
    ores: [['satetsu', 4], ['gold', 2], ['iron', 2], ['stone', 3]],
    water: 3, lava: true, vents: true, timbers: false,
  },
];

export const LANTERN_EVERY = 5;
export const BOSS_FLOORS = { 20: 'jubei', 40: 'kappa_elder', 60: 'kyubi', 80: 'kurenai' };
// The deepest floor reachable in this version: below it the foundry's stair is sealed with slag.
export const LAST_FLOOR = 80;

// Ore nodes: hp for the pickaxe, the minimum pickaxe tier, and drops.
export const ORES = {
  stone: { name: 'Rock', hp: 2, tier: 0, drops: [['stone', 1, 3]], xp: 2 },
  copper: { name: 'Copper Vein', hp: 3, tier: 0, drops: [['copper_ore', 1, 3], ['stone', 0, 1]], xp: 5 },
  iron: { name: 'Iron Vein', hp: 5, tier: 0, drops: [['iron_ore', 1, 3], ['stone', 0, 1]], xp: 8 },
  jade: { name: 'Jade Seam', hp: 6, tier: 1, drops: [['jade', 1, 1], ['stone', 1, 2]], xp: 12 },
  crystal: { name: 'Water Crystal', hp: 6, tier: 1, drops: [['water_crystal', 1, 2]], xp: 12 },
  gold: { name: 'Gold Seam', hp: 7, tier: 1, drops: [['gold_ore', 1, 2], ['stone', 0, 1]], xp: 16 },
  reiseki: { name: 'Spirit Stone', hp: 7, tier: 1, drops: [['reiseki', 1, 1]], xp: 16 },
  satetsu: { name: 'Iron Sand Bed', hp: 8, tier: 2, drops: [['satetsu', 2, 4]], xp: 20 },
};

// What breakable urns and chests hold, per zone: [item, min, max, weight].
export const URN_LOOT = {
  1: [['copper_ore', 1, 2, 4], ['onigiri', 1, 1, 2], ['mon', 10, 40, 4], ['arrow', 2, 5, 2], ['nothing', 0, 0, 6]],
  2: [['iron_ore', 1, 2, 4], ['tonic', 1, 1, 1], ['mon', 20, 70, 4], ['arrow', 3, 6, 2], ['nothing', 0, 0, 6]],
  3: [['gold_ore', 1, 1, 3], ['salve', 1, 1, 2], ['mon', 40, 110, 4], ['arrow', 4, 8, 2], ['nothing', 0, 0, 6]],
  4: [['satetsu', 1, 3, 4], ['kizugusuri', 1, 1, 1], ['mon', 60, 160, 4], ['sumi', 2, 4, 2], ['nothing', 0, 0, 6]],
};
export const CHEST_LOOT = {
  1: [['iron_bar', 1, 2, 3], ['onigiri', 2, 3, 3], ['mon', 80, 160, 3], ['tonic', 1, 1, 2], ['kosen', 1, 1, 1]],
  2: [['steel_bar', 1, 1, 2], ['jade', 1, 2, 3], ['mon', 150, 300, 3], ['tonic', 1, 2, 2], ['water_crystal', 1, 2, 2]],
  3: [['gold_bar', 1, 1, 2], ['reiseki', 1, 2, 3], ['mon', 250, 450, 3], ['kizugusuri', 1, 1, 2], ['magatama', 1, 1, 1]],
  4: [['steel_bar', 2, 3, 3], ['tamahagane', 1, 1, 1], ['mon', 350, 600, 3], ['kizugusuri', 1, 2, 2], ['gold_bar', 1, 1, 2]],
};

export const zoneOf = (floor) => ZONES.find((z) => floor >= z.from && floor <= z.to) || ZONES[ZONES.length - 1];
