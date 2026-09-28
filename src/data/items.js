// Every item in the game. `icon` defaults to the item id (atlas frame `icon_<id>`).
// Prices are in mon (文). Quality multiplies sell value (see QUALITY).
import { CROPS } from './crops.js';
import { FORAGE, ARTIFACTS } from './forage.js';
import { FISH, JUNK } from './fish.js';
import { MACHINES, GOODS, DISHES, SCROLLS, SCROLL_PRICE } from './recipes.js';
import { WEAPONS } from './weapons.js';

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
  egg: { name: 'Egg', jp: '卵', kind: 'animal', sell: 50, desc: 'A brown hen\'s egg, still warm.' },
  duck_egg: { name: 'Duck Egg', jp: '鴨の卵', kind: 'animal', sell: 95, desc: 'A pale blue-green egg, rich and large.' },
  chick: { name: 'Chick', jp: 'ひよこ', kind: 'livestock', animal: 'chicken', price: 400, desc: 'Delivered to your coop. Feed it hay and it will lay eggs.' },
  duckling: { name: 'Duckling', jp: '子鴨', kind: 'livestock', animal: 'duck', price: 700, desc: 'Delivered to your coop. Ducks in the valley help the rice along.' },
  parcel: { name: 'Parcel', jp: '小包', kind: 'quest', desc: 'Wrapped in cloth and tied with cord. Somebody is waiting for it.' },

  // Food and medicine: eaten from the hotbar for Genki.
  tea: { name: 'Sencha', jp: '煎茶', kind: 'food', genki: 25, sell: 10, price: 30, desc: 'Green tea from Okiku\'s teahouse. A small lift.' },
  dango: { name: 'Hanami Dango', jp: '花見団子', kind: 'food', genki: 45, sell: 20, price: 60, desc: 'Three sweet rice dumplings on a skewer.' },
  onigiri: { name: 'Onigiri', jp: 'おにぎり', kind: 'food', genki: 70, sell: 30, price: 90, desc: 'A rice ball wrapped in nori. A proper meal for a working day.' },
  tonic: { name: 'Yōjō Tonic', jp: '養生酒', kind: 'food', genki: 140, sell: 100, price: 320, desc: 'Ume\'s bitter herbal tonic. Tastes of bark; works like sleep.' },
};

/** Register a generated item; an id may only be defined once across all the tables. */
function define(id, def) {
  if (ITEMS[id]) throw new Error(`Item "${id}" is defined twice`);
  ITEMS[id] = def;
}

// Produce and seeds come from the crop table.
for (const [id, c] of Object.entries(CROPS)) {
  const where = c.paddy ? ' in a flooded paddy' : c.cover ? ' on straw-covered soil' : '';
  const when = c.seasons.map((s) => s[0].toUpperCase() + s.slice(1)).join(' and ');
  define(`seed_${id}`, {
    name: c.seedName || `${c.name} Seeds`, jp: c.seedJp || `${c.jp}の種`, kind: 'seed', crop: id,
    price: c.seedPrice, sell: Math.floor(c.seedPrice / 2),
    desc: `Plant in ${when}${where}. Ready in ${c.days} days${c.regrow ? `, then every ${c.regrow}` : ''}.`,
  });
  define(id, { name: c.name, jp: c.jp, kind: 'crop', sell: c.sell, desc: c.desc });
}

for (const [id, f] of Object.entries(FORAGE)) define(id, { name: f.name, jp: f.jp, kind: 'forage', sell: f.sell, desc: f.desc });
for (const [id, f] of Object.entries(FISH)) define(id, { name: f.name, jp: f.jp, kind: 'fish', sell: f.sell, desc: f.desc });
for (const [id, j] of Object.entries(JUNK)) define(id, { name: j.name, jp: j.jp, kind: 'junk', sell: j.sell, desc: j.desc });
for (const [id, a] of Object.entries(ARTIFACTS)) define(id, { name: a.name, jp: a.jp, kind: 'artifact', sell: a.sell, desc: a.desc });

for (const [id, m] of Object.entries(MACHINES)) define(id, { name: m.name, jp: m.jp, kind: 'machine', sell: 30, desc: `An artisan machine. Place it on your farm; it turns ${m.n > 1 ? `${m.n} ` : ''}goods into something finer.` });
for (const [id, g] of Object.entries(GOODS)) define(id, { ...g });
for (const [id, d] of Object.entries(DISHES)) {
  if (id === 'onigiri') continue;   // already sold at the teahouse
  define(id, { name: d.name, jp: d.jp, kind: 'food', genki: d.genki, buff: d.buff, sell: Math.round(d.genki * 0.9), desc: d.desc });
}
for (const id of SCROLLS) define(`scroll_${id}`, { name: `Recipe: ${ITEMS[id].name}`, jp: `${ITEMS[id].jp}の作り方`, kind: 'recipe', dish: id, price: SCROLL_PRICE, desc: `Okiku's recipe for ${ITEMS[id].name}. Use it to learn the dish.` });
// Mount Kurayama: ores, gems, bars, what spirits leave behind, and weapons.
define('copper_ore', { name: 'Copper Ore', jp: '銅鉱', kind: 'material', sell: 8, desc: 'Green-streaked rock. Genzō smelts five into a bar.' });
define('iron_ore', { name: 'Iron Ore', jp: '鉄鉱', kind: 'material', sell: 15, desc: 'Heavy, rust-red rock from the old mine.' });
define('copper_bar', { name: 'Copper Bar', jp: '銅', kind: 'material', sell: 40, price: 90, desc: 'Soft red metal. Bows and fittings need it.' });
define('jade', { name: 'Jade', jp: '翡翠', kind: 'gem', sell: 180, desc: 'Green stone from the flooded cellars. Spirits are drawn to it.' });
define('water_crystal', { name: 'Water Crystal', jp: '水晶', kind: 'gem', sell: 140, desc: 'Clear crystal that is always cool to the touch.' });
define('leaf_charm', { name: 'Tanuki Leaf', jp: '狸の葉', kind: 'material', sell: 120, desc: 'The leaf a tanuki wears on its head to change shape. It is still warm.' });
define('spirit_wisp', { name: 'Spirit Wisp', jp: '魂火', kind: 'material', sell: 45, desc: 'A little cold light that stayed behind when a yūrei was put to rest.' });
define('arrow', { name: 'Arrows', jp: '矢', kind: 'ammo', sell: 1, desc: 'Bamboo arrows with stone heads. The yumi uses one per shot.' });
define('salve', { name: 'Ume\'s Salve', jp: '膏薬', kind: 'food', genki: 10, heal: 40, sell: 40, price: 120, desc: 'A pot of herbal salve. Restores 40 Inochi.' });
define('kizugusuri', { name: 'Wound Draught', jp: '傷薬', kind: 'food', genki: 20, heal: 100, sell: 110, price: 350, desc: 'Ume\'s strongest draught. Restores 100 Inochi.' });
for (const [id, w] of Object.entries(WEAPONS)) define(id, { name: w.name, jp: w.jp, kind: 'weapon', weapon: id, sell: w.forge ? Math.round(w.forge.mon / 3) : 0, desc: w.desc });

// M6: courting and marriage, the farmhouse extension, the bathhouse's salt.
define('red_thread', { name: 'Red Thread', jp: '赤い糸', kind: 'romance', price: 500, desc: 'A charm of red silk thread. Give it to someone dear (eight hearts) to court them.' });
define('shrine_vow', { name: 'Shrine Vow', jp: '誓いの札', kind: 'romance', price: 5000, desc: 'A vow tablet from the shrine. Give it to the one you court (ten hearts, and a house with room for two) to propose.' });
define('house_ext', { name: 'Farmhouse Extension', jp: '母屋の増築', kind: 'building', price: 10000, needs: [['wood', 150], ['stone', 50]], desc: 'Tatsu adds a kitchen and a second room to the farmhouse. Three days of work; 150 wood and 50 stone.' });
define('toyo_knife', { name: 'Toyo\'s Knife', jp: 'トヨの包丁', kind: 'keepsake', desc: 'An old kitchen knife, sharpened thin as a leaf. It has cut ten thousand daikon and, mostly, no fingers.' });
define('bokken', { name: 'Kinta\'s Bokken', jp: '金太の木刀', kind: 'keepsake', desc: 'A lopsided wooden sword, carved by a boy who swore to serve your house.' });
define('fox_whisker', { name: 'Fox Whisker', jp: '狐の髭', kind: 'keepsake', desc: 'One silver whisker folded in paper. Hold it up and it turns, very slightly, toward home.' });
define('bath_salt', { name: 'Yuzu Bath Salt', jp: '柚子湯の塩', kind: 'food', genki: 30, sell: 20, price: 60, desc: 'Salt and dried yuzu peel. Smells like Yuzu insists it does.' });

// M6 festivals: what the day gives out, and the prizes.
define('mochi', { name: 'Mochi', jp: '餅', kind: 'food', genki: 60, sell: 30, price: 80, desc: 'Pounded rice, soft and stretchy. Better on the day it is made.' });
define('kakigori', { name: 'Kakigōri', jp: 'かき氷', kind: 'food', genki: 35, buff: ['speed', 0.1, 2], sell: 25, desc: 'Shaved ice with plum syrup, from Kon\'s cart at the fireworks. It melts faster than you eat.' });
define('fuku_mame', { name: 'Fuku-mame', jp: '福豆', kind: 'food', genki: 20, buff: ['foraging', 0.08, 6], sell: 10, desc: 'Roasted Setsubun beans. Eat one for each year of your age, plus one for luck.' });
define('amazake', { name: 'Amazake', jp: '甘酒', kind: 'food', genki: 55, sell: 30, desc: 'Warm, sweet rice drink from the snow-lantern night. It is not really sake. It is really good.' });
define('star_fragment', { name: 'Star Fragment', jp: '星の欠片', kind: 'material', sell: 400, desc: 'A pale stone that fell on Tanabata night. It is warm, and a little heavier when you make a wish.' });
define('festival_fan', { name: 'Festival Fan', jp: '祭り扇', kind: 'keepsake', desc: 'A painted uchiwa from the Bon dance, given to the best dancer. Heibei swears the judging was fair.' });
define('haiku_scroll', { name: 'Prize Haiku', jp: '入選の句', kind: 'material', sell: 600, desc: 'Your prize-winning verse in Sōken\'s brush hand. Collectors in Edo pay for such things. So does Chōbei, grudgingly.' });

define('pack24', { name: 'Large Pack', jp: '大きな背負子', kind: 'upgrade', slots: 24, price: 2000, desc: 'A second row of pockets: 24 slots.' });
define('pack36', { name: 'Traveller\'s Pack', jp: '旅の背負子', kind: 'upgrade', slots: 36, price: 10000, desc: 'Room for everything: 36 slots.' });

export const STACK = 99;

export function itemDef(id) {
  const d = ITEMS[id];
  if (!d) throw new Error(`Unknown item "${id}"`);
  return d;
}

export function isStackable(id) {
  const k = itemDef(id).kind;
  return k !== 'tool' && k !== 'weapon';
}

export function sellPrice(id, quality = 0) {
  return Math.floor((itemDef(id).sell || 0) * QUALITY[quality].mult);
}
