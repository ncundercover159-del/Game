// Every item in the game. `icon` defaults to the item id (atlas frame `icon_<id>`).
// Prices are in mon (文). Quality multiplies sell value (see QUALITY).
import { CROPS } from './crops.js';
import { FORAGE, ARTIFACTS } from './forage.js';
import { FISH, JUNK } from './fish.js';

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
  rod: { name: 'Tsurizao', jp: '釣竿', kind: 'tool', tool: 'rod', desc: 'A bamboo fishing rod. Hold to cast further; strike when the float dips.' },
  uke: { name: 'Fish Trap', jp: '筌', kind: 'place', place: 'uke', sell: 20, price: 150, desc: 'A woven bamboo trap. Set it in water beside the bank; check it each morning.' },

  wood: { name: 'Wood', jp: '木材', kind: 'material', sell: 2, desc: 'Sturdy timber for building and crafting.' },
  stone: { name: 'Stone', jp: '石', kind: 'material', sell: 2, desc: 'Plain field stone.' },
  hay: { name: 'Hay', jp: '干し草', kind: 'material', sell: 1, desc: 'Cut grass, dried. Animals will want it.' },
  bamboo: { name: 'Bamboo', jp: '竹', kind: 'material', sell: 4, desc: 'Light, strong culms. Fences, pipes, baskets.' },
  iron_bar: { name: 'Iron Bar', jp: '鉄', kind: 'material', sell: 60, price: 150, desc: 'Smelted iron from Genzō\'s forge. Tool upgrades need it.' },
  steel_bar: { name: 'Steel Bar', jp: '鋼', kind: 'material', sell: 120, desc: 'Folded steel. Genzō smelts it from ore dug deep in Mount Kurayama.' },
  tamahagane: { name: 'Tamahagane', jp: '玉鋼', kind: 'material', sell: 400, desc: 'Jewel steel from the Oni Foundry, fit for a master blade.' },
  sluice: { name: 'Sluice Gate', jp: '水門', kind: 'place', place: 'sluice', sell: 15, price: 120, desc: 'Place on an irrigation channel. Open or shut it to steer the water.' },
  parcel: { name: 'Parcel', jp: '小包', kind: 'quest', desc: 'Wrapped in cloth and tied with cord. Somebody is waiting for it.' },

  // Food and medicine: eaten from the hotbar for Genki.
  tea: { name: 'Sencha', jp: '煎茶', kind: 'food', genki: 25, sell: 10, price: 30, desc: 'Green tea from Okiku\'s teahouse. A small lift.' },
  dango: { name: 'Hanami Dango', jp: '花見団子', kind: 'food', genki: 45, sell: 20, price: 60, desc: 'Three sweet rice dumplings on a skewer.' },
  onigiri: { name: 'Onigiri', jp: 'おにぎり', kind: 'food', genki: 70, sell: 30, price: 90, desc: 'A rice ball wrapped in nori. A proper meal for a working day.' },
  tonic: { name: 'Yōjō Tonic', jp: '養生酒', kind: 'food', genki: 140, sell: 100, price: 320, desc: 'Ume\'s bitter herbal tonic. Tastes of bark; works like sleep.' },
};

// Produce and seeds come from the crop table.
for (const [id, c] of Object.entries(CROPS)) {
  const where = c.paddy ? ' in a flooded paddy' : c.cover ? ' on straw-covered soil' : '';
  const when = c.seasons.map((s) => s[0].toUpperCase() + s.slice(1)).join(' and ');
  ITEMS[`seed_${id}`] = {
    name: c.seedName || `${c.name} Seeds`, jp: c.seedJp || `${c.jp}の種`, kind: 'seed', crop: id,
    price: c.seedPrice, sell: Math.floor(c.seedPrice / 2),
    desc: `Plant in ${when}${where}. Ready in ${c.days} days${c.regrow ? `, then every ${c.regrow}` : ''}.`,
  };
  ITEMS[id] = { name: c.name, jp: c.jp, kind: 'crop', sell: c.sell, desc: c.desc };
}

for (const [id, f] of Object.entries(FORAGE)) ITEMS[id] = { name: f.name, jp: f.jp, kind: 'forage', sell: f.sell, desc: f.desc };
for (const [id, f] of Object.entries(FISH)) ITEMS[id] = { name: f.name, jp: f.jp, kind: 'fish', sell: f.sell, desc: f.desc };
for (const [id, j] of Object.entries(JUNK)) ITEMS[id] = { name: j.name, jp: j.jp, kind: 'junk', sell: j.sell, desc: j.desc };
for (const [id, a] of Object.entries(ARTIFACTS)) ITEMS[id] = { name: a.name, jp: a.jp, kind: 'artifact', sell: a.sell, desc: a.desc };

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
