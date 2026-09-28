// Tool tiers and upgrades at Genzō's forge. Upgrades take UPGRADE_DAYS; the tool is away meanwhile.
//   can: watering can capacity    charge: highest charged-swing level (hoe and can)
export const TIERS = [
  { id: 'basic', name: 'Basic', jp: '並', can: 40, charge: 0 },
  { id: 'iron', name: 'Iron', jp: '鉄', can: 55, charge: 1, cost: { mon: 2000, items: { iron_bar: 5 } } },
  { id: 'steel', name: 'Steel', jp: '鋼', can: 70, charge: 2, cost: { mon: 5000, items: { steel_bar: 5 } } },
  { id: 'tamahagane', name: 'Tamahagane', jp: '玉鋼', can: 85, charge: 3, cost: { mon: 12000, items: { tamahagane: 5 } } },
];

export const UPGRADABLE = ['hoe', 'can', 'axe', 'pickaxe'];
export const UPGRADE_DAYS = 2;
// Seconds of holding per charge level.
export const CHARGE_STEP = 0.45;
