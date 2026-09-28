// Mount Kurayama. Floors are generated from the save seed and the floor number (systems/cavegen.js).
// Zone 1 (floors 1-20) Old Mine Tunnels, zone 2 (21-40) Flooded Cellars, zone 3 (41-60) Foxfire
// Halls, zone 4 (61-80) Oni Foundry, zone 5 (81 and down, without end) the Yomi Slope, where every
// floor carries modifiers that pile up with depth. A lantern stands every LANTERN_EVERY floors; lit
// ones let you start from them. The last floor of zones 1-4 is a boss's arena; the Shade of Lord
// Aizawa waits on floor 100. `pools` are water, or lava in the
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
  {
    id: 'yomi', name: 'Yomi Slope', jp: '黄泉比良坂', from: 81, to: Infinity,
    enemies: [['retainer', 4], ['yurei', 2], ['kitsune', 2], ['oni', 1], ['shinobi', 2], ['onibi', 1], ['kappa', 1]],
    ores: [['gold', 2], ['reiseki', 3], ['satetsu', 2], ['jade', 1], ['crystal', 1], ['stone', 2]],
    water: 2, timbers: false,
  },
];

// Modifiers of the Yomi Slope: one on floor 81, another every 20 floors down (never repeated on a
// floor). Only foes grow stronger or more; the tells never get shorter.
export const MODS = {
  hardy: { name: 'Hardy', jp: '頑', hp: 1.3 },
  fierce: { name: 'Fierce', jp: '猛', dmg: 1.25 },
  swift: { name: 'Swift', jp: '疾', speed: 1.2 },
  crowded: { name: 'Crowded', jp: '群', foes: 3 },
  dim: { name: 'Dim', jp: '闇', light: 0.6 },
  bountiful: { name: 'Bountiful', jp: '宝', loot: 2 },
};


export const LANTERN_EVERY = 5;
export const BOSS_FLOORS = { 20: 'jubei', 40: 'kappa_elder', 60: 'kyubi', 80: 'kurenai', 100: 'aizawa' };

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
  5: [['reiseki', 1, 1, 3], ['kizugusuri', 1, 1, 2], ['mon', 100, 260, 4], ['gold_ore', 1, 2, 2], ['nothing', 0, 0, 5]],
};
export const CHEST_LOOT = {
  1: [['iron_bar', 1, 2, 3], ['onigiri', 2, 3, 3], ['mon', 80, 160, 3], ['tonic', 1, 1, 2], ['kosen', 1, 1, 1]],
  2: [['steel_bar', 1, 1, 2], ['jade', 1, 2, 3], ['mon', 150, 300, 3], ['tonic', 1, 2, 2], ['water_crystal', 1, 2, 2]],
  3: [['gold_bar', 1, 1, 2], ['reiseki', 1, 2, 3], ['mon', 250, 450, 3], ['kizugusuri', 1, 1, 2], ['magatama', 1, 1, 1]],
  4: [['steel_bar', 2, 3, 3], ['tamahagane', 1, 1, 1], ['mon', 350, 600, 3], ['kizugusuri', 1, 2, 2], ['gold_bar', 1, 1, 2]],
  5: [['tamahagane', 1, 2, 2], ['gold_bar', 1, 2, 3], ['mon', 500, 1000, 3], ['kizugusuri', 2, 3, 2], ['reiseki', 2, 3, 2]],
};

export const zoneOf = (floor) => ZONES.find((z) => floor >= z.from && floor <= z.to) || ZONES[ZONES.length - 1];

/** The modifiers of a Yomi floor, in order (deterministic by floor). */
export function modsOf(floor) {
  if (floor <= 80) return [];
  const ids = Object.keys(MODS), n = Math.min(ids.length, 1 + Math.floor((floor - 81) / 20)), out = [];
  for (let k = 0; out.length < n; k++) {
    const id = ids[(floor * 7 + k * 5 + Math.floor(floor / 3)) % ids.length];
    if (!out.includes(id)) out.push(id);
  }
  return out;
}
