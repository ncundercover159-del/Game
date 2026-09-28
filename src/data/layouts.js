// The three ways Hinata Farm can have gone to seed while your uncle was away. The map is the same;
// what grows over it, how much forage turns up and what you start with differ.
//   growth: weights of the overgrowth (see world/populate.js), density: how thick it is,
//   forage: extra forage spots on the farm each morning, items: added to the starting pack.
export const LAYOUTS = {
  hinata: {
    name: 'Terraced Fields', jp: '段々畑',
    desc: 'The farm as your uncle left it: weeds and stones over the old fields, the terraces fenced off above.',
    growth: [['weed', 60], ['stone', 12], ['twig', 10], ['stump', 3], ['tree', 3], ['bamboo', 1.5], ['log', 0.7], ['boulder', 0.7]],
    density: 1, forage: 0, items: [],
  },
  mori: {
    name: 'Woodland', jp: '森の畑',
    desc: 'The forest has walked into the fields. Timber and forage aplenty; slower to clear.',
    growth: [['weed', 44], ['stone', 6], ['twig', 14], ['stump', 9], ['tree', 9], ['bamboo', 3], ['log', 2], ['boulder', 0.5]],
    density: 1.1, forage: 3, items: [['seed_satoimo', 5]],
  },
  kawabe: {
    name: 'Riverside', jp: '川辺の畑',
    desc: 'Lighter ground by the water: fewer stones, reeds and bamboo, and two fish traps in the shed.',
    growth: [['weed', 66], ['stone', 5], ['twig', 8], ['stump', 2], ['tree', 2], ['bamboo', 4], ['log', 0.5], ['boulder', 0.3]],
    density: 0.8, forage: 0, items: [['uke', 2]],
  },
};
export const LAYOUT_IDS = Object.keys(LAYOUTS);
