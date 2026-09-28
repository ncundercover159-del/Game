// Mount Kurayama. Floors are generated from the save seed and the floor number (systems/cavegen.js).
// Zone 1 (floors 1-20) Old Mine Tunnels, zone 2 (21-40) Flooded Cellars. A lantern stands every
// LANTERN_EVERY floors; lit ones let you start from them. Boss floors have a fixed arena.
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
];

export const LANTERN_EVERY = 5;
export const BOSS_FLOORS = { 20: 'jubei' };
// The deepest floor reachable in this version: below it the cellars are flooded to the ceiling.
export const LAST_FLOOR = 40;

// Ore nodes: hp for the pickaxe, the minimum pickaxe tier, and drops.
export const ORES = {
  stone: { name: 'Rock', hp: 2, tier: 0, drops: [['stone', 1, 3]], xp: 2 },
  copper: { name: 'Copper Vein', hp: 3, tier: 0, drops: [['copper_ore', 1, 3], ['stone', 0, 1]], xp: 5 },
  iron: { name: 'Iron Vein', hp: 5, tier: 0, drops: [['iron_ore', 1, 3], ['stone', 0, 1]], xp: 8 },
  jade: { name: 'Jade Seam', hp: 6, tier: 1, drops: [['jade', 1, 1], ['stone', 1, 2]], xp: 12 },
  crystal: { name: 'Water Crystal', hp: 6, tier: 1, drops: [['water_crystal', 1, 2]], xp: 12 },
};

// What breakable urns and chests hold, per zone: [item, min, max, weight].
export const URN_LOOT = {
  1: [['copper_ore', 1, 2, 4], ['onigiri', 1, 1, 2], ['mon', 10, 40, 4], ['arrow', 2, 5, 2], ['nothing', 0, 0, 6]],
  2: [['iron_ore', 1, 2, 4], ['tonic', 1, 1, 1], ['mon', 20, 70, 4], ['arrow', 3, 6, 2], ['nothing', 0, 0, 6]],
};
export const CHEST_LOOT = {
  1: [['iron_bar', 1, 2, 3], ['onigiri', 2, 3, 3], ['mon', 80, 160, 3], ['tonic', 1, 1, 2], ['kosen', 1, 1, 1]],
  2: [['steel_bar', 1, 1, 2], ['jade', 1, 2, 3], ['mon', 150, 300, 3], ['tonic', 1, 2, 2], ['water_crystal', 1, 2, 2]],
};

export const zoneOf = (floor) => ZONES.find((z) => floor >= z.from && floor <= z.to) || ZONES[ZONES.length - 1];
