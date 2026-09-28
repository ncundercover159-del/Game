// The Village Archive (Shūzōkan 集蔵館): the restored kura where the valley keeps one of everything.
// Collections are drawn from the item list by kind, plus the spirit relics and metals by name.
// Milestones pay out as the total grows; finishing a whole collection earns its own reward.
import { ITEMS } from './items.js';

const ofKind = (...kinds) => Object.keys(ITEMS).filter((id) => kinds.includes(ITEMS[id].kind));

export const COLLECTIONS = {
  fish: { name: 'River and Pond', jp: '川魚', items: ofKind('fish') },
  forage: { name: 'Hill and Grove', jp: '山の幸', items: ofKind('forage') },
  crops: { name: 'Field and Paddy', jp: '田畑', items: ofKind('crop') },
  relics: { name: 'Relics and Spirits', jp: '遺物', items: [...ofKind('artifact', 'gem'), 'leaf_charm', 'spirit_wisp', 'star_fragment'] },
  metals: { name: 'Ore and Metal', jp: '金属', items: ['copper_ore', 'iron_ore', 'copper_bar', 'iron_bar', 'steel_bar', 'tamahagane'] },
};

/** Rewards as the whole collection grows: at `n` donations. */
export const MILESTONES = [
  { n: 5, money: 500 },
  { n: 10, items: [['kizugusuri', 2]] },
  { n: 20, money: 2000, virtue: ['makoto', 3] },
  { n: 35, items: [['tamahagane', 1], ['jade', 1]] },
  { n: 50, money: 5000, virtue: ['makoto', 5] },
  { n: 70, items: [['archive_seal', 1]] },
];

/** For finishing any one collection. */
export const COLLECTION_REWARD = { money: 1500, virtue: ['makoto', 3] };
