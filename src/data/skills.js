// Skills (Lv 1-10) and their perks. XP comes from doing: harvesting, clearing, foraging, fishing,
// mining, crafting and cooking. At Lv 5 and Lv 10 you choose one of two perks.
export const SKILLS = {
  farming: { name: 'Farming', jp: '農' },
  foraging: { name: 'Foraging', jp: '山菜' },
  fishing: { name: 'Fishing', jp: '釣' },
  mining: { name: 'Mining', jp: '採掘' },
  sword: { name: 'Swordsmanship', jp: '剣' },
  craft: { name: 'Craftsmanship', jp: '匠' },
};
export const SKILL_IDS = Object.keys(SKILLS);

// Total XP needed to reach each level (index = level); Lv 1 at 0.
export const LEVEL_XP = [0, 0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200];
export const MAX_LEVEL = 10;

// Perk choices per skill: [Lv 5 pair, Lv 10 pair]. Effects are read by the systems that use them.
export const PERKS = {
  farming: [
    [{ id: 'tiller', name: 'Tiller', desc: 'Crops sell for 10% more.' }, { id: 'rancher', name: 'Rancher', desc: 'Eggs sell for 20% more.' }],
    [{ id: 'artisan', name: 'Artisan', desc: 'Artisan goods sell for 30% more.' }, { id: 'agriculturist', name: 'Agriculturist', desc: 'Watered crops sometimes grow two days in a night.' }],
  ],
  foraging: [
    [{ id: 'gatherer', name: 'Gatherer', desc: 'A 20% chance to find a second forage item.' }, { id: 'woodsman', name: 'Woodsman', desc: 'Trees and stumps drop 25% more wood.' }],
    [{ id: 'botanist', name: 'Botanist', desc: 'Forage is always at least Fine.' }, { id: 'tracker', name: 'Tracker', desc: 'Twice as many dig spots appear.' }],
  ],
  fishing: [
    [{ id: 'fisher', name: 'Fisher', desc: 'Fish sell for 25% more.' }, { id: 'trapper', name: 'Trapper', desc: 'Fish traps catch twice as often.' }],
    [{ id: 'angler', name: 'Angler', desc: 'Fish sell for 50% more.' }, { id: 'steady', name: 'Steady Hands', desc: 'The catch bar is a third larger.' }],
  ],
  mining: [
    [{ id: 'miner', name: 'Miner', desc: 'Rocks give one more stone.' }, { id: 'smelter', name: 'Smelter', desc: 'Bars sell for 50% more.' }],
    [{ id: 'prospector', name: 'Prospector', desc: 'Boulders sometimes hold iron.' }, { id: 'quarryman', name: 'Quarryman', desc: 'The pickaxe costs no Genki on stone.' }],
  ],
  sword: [
    [{ id: 'fighter', name: 'Fighter', desc: 'Strikes deal 15% more damage.' }, { id: 'guardian', name: 'Guardian', desc: 'Parry windows are longer.' }],
    [{ id: 'kensei', name: 'Kensei', desc: 'Critical strikes are more frequent.' }, { id: 'mountain', name: 'Unmoving Mountain', desc: 'Take 25% less damage.' }],
  ],
  craft: [
    [{ id: 'patient', name: 'Patient Hands', desc: 'Machines work 25% faster.' }, { id: 'thrifty', name: 'Thrifty', desc: 'Crafting recipes need fewer materials.' }],
    [{ id: 'master', name: 'Master Maker', desc: 'Artisan goods are always Fine or better.' }, { id: 'chef', name: 'Chef', desc: 'Dishes restore half again as much Genki.' }],
  ],
};

// XP for common acts.
export const XP = {
  harvest: (sell) => 3 + Math.round(sell / 12), weed: 1, twig: 1, stump: 4, tree: 6, bamboo: 3, log: 10,
  stone: 2, boulder: 10, forage: 7, dig: 5, fish: (difficulty) => 6 + difficulty * 2, trap: 3,
  animal: 5, machine: 6, cook: 4, craft: 5,
};
