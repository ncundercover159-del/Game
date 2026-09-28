// Every item in the game. `icon` defaults to the item id (atlas frame `icon_<id>`).
// Prices are in mon (文). Quality multiplies sell value (see QUALITY).

export const QUALITY = [
  { name: '', stars: 0, mult: 1 },
  { name: 'Fine', stars: 1, mult: 1.1 },
  { name: 'Excellent', stars: 2, mult: 1.25 },
  { name: 'Masterwork', stars: 3, mult: 1.5 },
];

export const ITEMS = {
  hoe: { name: 'Kuwa', jp: '鍬', kind: 'tool', tool: 'hoe', desc: 'A hoe. Breaks ground for planting.' },
  can: { name: 'Jōro', jp: '如雨露', kind: 'tool', tool: 'can', desc: 'A copper watering can. Fill it at the well, pond or river.' },
  sickle: { name: 'Kama', jp: '鎌', kind: 'tool', tool: 'sickle', desc: 'A sickle. Cuts weeds into hay and harvests crops.' },
  axe: { name: 'Ono', jp: '斧', kind: 'tool', tool: 'axe', desc: 'An axe. Fells trees, splits stumps and bamboo.' },
  pickaxe: { name: 'Tsuruhashi', jp: '鶴嘴', kind: 'tool', tool: 'pickaxe', desc: 'A pickaxe. Breaks stones and turns soil back.' },

  seed_daikon: { name: 'Daikon Seeds', jp: '大根の種', kind: 'seed', crop: 'daikon', price: 20, sell: 10, desc: 'Plant in spring. Ready in 4 days.' },
  seed_komatsuna: { name: 'Komatsuna Seeds', jp: '小松菜の種', kind: 'seed', crop: 'komatsuna', price: 25, sell: 12, desc: 'Plant in spring. Ready in 5 days.' },
  seed_soramame: { name: 'Soramame Seeds', jp: '空豆の種', kind: 'seed', crop: 'soramame', price: 30, sell: 15, desc: 'Plant in spring. Ready in 6 days.' },
  seed_strawberry: { name: 'Strawberry Runners', jp: '苺の苗', kind: 'seed', crop: 'strawberry', price: 50, sell: 25, desc: 'Plant in spring. Ready in 8 days, then fruits every 4.' },

  daikon: { name: 'Daikon', jp: '大根', kind: 'crop', sell: 40, desc: 'A long white radish, crisp and peppery.' },
  komatsuna: { name: 'Komatsuna', jp: '小松菜', kind: 'crop', sell: 50, desc: 'Tender mustard greens. Good in miso soup.' },
  soramame: { name: 'Soramame', jp: '空豆', kind: 'crop', sell: 55, desc: 'Broad beans whose pods point at the sky.' },
  strawberry: { name: 'Strawberry', jp: '苺', kind: 'crop', sell: 75, desc: 'Sweet and bright as a festival lantern.' },

  wood: { name: 'Wood', jp: '木材', kind: 'material', sell: 2, desc: 'Sturdy timber for building and crafting.' },
  stone: { name: 'Stone', jp: '石', kind: 'material', sell: 2, desc: 'Plain field stone.' },
  hay: { name: 'Hay', jp: '干し草', kind: 'material', sell: 1, desc: 'Cut grass, dried. Animals will want it.' },
  bamboo: { name: 'Bamboo', jp: '竹', kind: 'material', sell: 4, desc: 'Light, strong culms. Fences, pipes, baskets.' },
};

export const STACK = 99;

export function itemDef(id) {
  const d = ITEMS[id];
  if (!d) throw new Error(`Unknown item "${id}"`);
  return d;
}

export function isStackable(id) {
  return itemDef(id).kind !== 'tool';
}

export function sellPrice(id, quality = 0) {
  return Math.floor((itemDef(id).sell || 0) * QUALITY[quality].mult);
}
