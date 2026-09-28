// Crop definitions. `days` = watered nights until ripe; `regrow` = nights until the next harvest
// for crops that keep producing. Item ids: the crop's id (produce) and `seed_<id>` (seeds).
// Sprites: `crop_<id>_<stage>`, stages 0 (seeds) to 4 (ripe), plus `crop_withered`.
//   paddy: only grows on a flooded paddy tile     cover: only grows on straw-covered soil (winter)
//   yield: [min, max] produce per harvest (default 1)
export const CROPS = {
  // Spring
  daikon: { name: 'Daikon', jp: '大根', seasons: ['spring'], days: 4, sell: 40, seedPrice: 20, desc: 'A long white radish, crisp and peppery.' },
  komatsuna: { name: 'Komatsuna', jp: '小松菜', seasons: ['spring'], days: 5, sell: 50, seedPrice: 25, desc: 'Tender mustard greens. Good in miso soup.' },
  soramame: { name: 'Soramame', jp: '空豆', seasons: ['spring'], days: 6, sell: 65, seedPrice: 30, desc: 'Broad beans whose pods point at the sky.' },
  satoimo: { name: 'Satoimo', jp: '里芋', seasons: ['spring'], days: 8, sell: 85, seedPrice: 40, desc: 'Hairy little taro. Slippery, earthy, beloved in stews.' },
  strawberry: { name: 'Strawberry', jp: '苺', seasons: ['spring'], days: 8, regrow: 5, sell: 75, seedPrice: 100, seedName: 'Strawberry Runners', seedJp: '苺の苗', desc: 'Sweet and bright as a festival lantern.' },
  rice: { name: 'Rice', jp: '籾', seasons: ['spring', 'summer'], days: 8, sell: 30, seedPrice: 15, paddy: true, yield: [2, 3], seedName: 'Rice Seedlings', seedJp: '稲の苗', desc: 'Unhulled rice (momi). The valley measures wealth in it.' },
  // Summer
  edamame: { name: 'Edamame', jp: '枝豆', seasons: ['summer'], days: 5, regrow: 3, sell: 45, seedPrice: 25, desc: 'Young soybeans in the pod. Salt them and share.' },
  nasu: { name: 'Nasu', jp: '茄子', seasons: ['summer'], days: 6, regrow: 3, sell: 45, seedPrice: 30, desc: 'Glossy eggplant, dark as lacquer.' },
  kyuri: { name: 'Kyūri', jp: '胡瓜', seasons: ['summer'], days: 5, regrow: 3, sell: 35, seedPrice: 20, desc: 'Cool cucumber. Kappa are said to adore them.' },
  kabocha: { name: 'Kabocha', jp: '南瓜', seasons: ['summer'], days: 10, sell: 160, seedPrice: 60, desc: 'A squat green pumpkin with sweet orange flesh.' },
  suika: { name: 'Suika', jp: '西瓜', seasons: ['summer'], days: 12, sell: 200, seedPrice: 90, desc: 'A striped watermelon, heavy as a temple bell.' },
  shoga: { name: 'Shōga', jp: '生姜', seasons: ['summer'], days: 8, sell: 105, seedPrice: 45, desc: 'Knobbly ginger root that warms from the inside.' },
  shiso: { name: 'Shiso', jp: '紫蘇', seasons: ['summer'], days: 4, regrow: 3, sell: 30, seedPrice: 15, desc: 'Fragrant perilla leaves. Wrap anything in them.' },
  // Autumn
  satsumaimo: { name: 'Satsumaimo', jp: '薩摩芋', seasons: ['autumn'], days: 8, sell: 90, seedPrice: 45, desc: 'Sweet potato. Roast it in the embers of a leaf fire.' },
  soba: { name: 'Soba', jp: '蕎麦', seasons: ['autumn'], days: 6, sell: 55, seedPrice: 25, desc: 'Buckwheat grain, milled for noodles.' },
  daizu: { name: 'Daizu', jp: '大豆', seasons: ['autumn'], days: 7, sell: 60, seedPrice: 30, desc: 'Dried soybeans: miso, tofu and shōyu begin here.' },
  azuki: { name: 'Azuki', jp: '小豆', seasons: ['autumn'], days: 8, sell: 80, seedPrice: 35, desc: 'Small red beans for sweet paste and festival rice.' },
  kabu: { name: 'Kabu', jp: '蕪', seasons: ['autumn'], days: 4, sell: 45, seedPrice: 20, desc: 'A round white turnip with a purple blush.' },
  gobo: { name: 'Gobō', jp: '牛蒡', seasons: ['autumn'], days: 7, sell: 75, seedPrice: 35, desc: 'Burdock root, long as your arm and twice as stubborn.' },
  // Winter (straw-covered plots only)
  hakusai: { name: 'Hakusai', jp: '白菜', seasons: ['winter'], days: 6, sell: 75, seedPrice: 30, cover: true, desc: 'Napa cabbage, sweeter after the frost.' },
  negi: { name: 'Negi', jp: '葱', seasons: ['winter'], days: 5, regrow: 4, sell: 40, seedPrice: 20, cover: true, desc: 'Long welsh onions for nabe and soba.' },
  shungiku: { name: 'Shungiku', jp: '春菊', seasons: ['winter'], days: 5, sell: 60, seedPrice: 25, cover: true, desc: 'Chrysanthemum greens, bitter-bright.' },
};

export const RIPE = 4;

/** Growth stage 0-4 for a crop that has grown `growth` watered nights. */
export function stageOf(id, growth) {
  const { days } = CROPS[id];
  if (growth >= days) return RIPE;
  if (growth <= 0) return 0;
  return 1 + Math.floor(((growth - 1) * 3) / Math.max(1, days - 1));
}

export function inSeason(id, seasonId) {
  return CROPS[id].seasons.includes(seasonId);
}

// Base harvest quality odds before skills (M4) and fertiliser: [fine, excellent].
export const QUALITY_ODDS = [0.12, 0.03];
