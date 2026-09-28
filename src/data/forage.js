// Wild forage by season and place, and the artefacts that turn up in dig spots. Items are
// registered in data/items.js. `where` lists maps; `pine` means it only grows at the roots of pines.
export const FORAGE = {
  warabi: { name: 'Warabi', jp: '蕨', seasons: ['spring'], where: ['grove', 'shrine', 'village'], sell: 30, desc: 'Bracken fiddleheads. Soak them in ash water before cooking.' },
  zenmai: { name: 'Zenmai', jp: '薇', seasons: ['spring'], where: ['grove', 'shrine'], sell: 35, desc: 'Royal fern shoots, cotton-furred and curled like a question.' },
  fukinoto: { name: 'Fukinotō', jp: '蕗の薹', seasons: ['spring'], where: ['grove', 'farm', 'village'], sell: 40, desc: 'Butterbur buds, the first green of the year. Bitter, in a good way.' },
  taranome: { name: 'Tara-no-me', jp: 'たらの芽', seasons: ['spring'], where: ['grove', 'shrine'], sell: 60, desc: 'Angelica tree buds. Best as tempura, say the old folk.' },
  takenoko: { name: 'Takenoko', jp: '筍', seasons: ['spring'], where: ['grove'], sell: 80, desc: 'A bamboo shoot, dug before it sees the sun.' },
  myoga: { name: 'Myōga', jp: '茗荷', seasons: ['summer'], where: ['grove', 'shrine'], sell: 45, desc: 'Ginger buds from the shade. Said to make you forgetful.' },
  yamajiso: { name: 'Wild Perilla', jp: '山紫蘇', seasons: ['summer'], where: ['grove', 'farm', 'village'], sell: 25, desc: 'Perilla gone wild along the paths.' },
  ajisai: { name: 'Hydrangea', jp: '紫陽花', seasons: ['summer'], where: ['shrine', 'village', 'grove'], sell: 50, desc: 'A head of rain-season blossom, blue as the tsuyu sky.' },
  yamamomo: { name: 'Bayberries', jp: '山桃', seasons: ['summer'], where: ['grove'], sell: 55, desc: 'Sweet-sour red berries from the mountain bayberry.' },
  matsutake: { name: 'Matsutake', jp: '松茸', seasons: ['autumn'], where: ['grove', 'shrine'], pine: true, sell: 300, desc: 'The pine mushroom. Its scent is autumn itself. Worth a small fortune.' },
  shiitake: { name: 'Shiitake', jp: '椎茸', seasons: ['autumn', 'spring'], where: ['grove'], sell: 60, desc: 'Grows on fallen oak. Rich, meaty, and good dried.' },
  maitake: { name: 'Maitake', jp: '舞茸', seasons: ['autumn'], where: ['grove', 'shrine'], sell: 90, desc: 'The dancing mushroom, named for the joy of whoever finds it.' },
  kuri: { name: 'Chestnut', jp: '栗', seasons: ['autumn'], where: ['grove', 'village', 'farm'], sell: 40, desc: 'Prickly husk, sweet nut. Roast it in the irori ash.' },
  ginnan: { name: 'Ginkgo Nuts', jp: '銀杏', seasons: ['autumn'], where: ['shrine', 'village'], sell: 45, desc: 'From the shrine ginkgo. Smells terrible; tastes wonderful.' },
  akebi: { name: 'Akebi', jp: '通草', seasons: ['autumn'], where: ['grove'], sell: 70, desc: 'A purple pod that splits to show a sweet white heart.' },
  momiji: { name: 'Maple Leaf', jp: '紅葉', seasons: ['autumn'], where: ['shrine', 'grove', 'village', 'farm'], sell: 15, desc: 'A perfect red leaf. Some people fry them in batter.' },
  yuzu: { name: 'Yuzu', jp: '柚子', seasons: ['winter'], where: ['village', 'grove'], sell: 60, desc: 'Fragrant winter citrus. A few in the bath on the solstice.' },
  nanten: { name: 'Nanten', jp: '南天', seasons: ['winter'], where: ['shrine', 'village', 'farm'], sell: 30, desc: 'Red berries that "turn difficulty around". A lucky gift.' },
  tsubaki: { name: 'Camellia', jp: '椿', seasons: ['winter'], where: ['shrine', 'grove'], sell: 50, desc: 'A red camellia fallen whole onto the snow.' },
  yamaimo: { name: 'Mountain Yam', jp: '山芋', seasons: ['winter'], where: ['grove', 'farm'], sell: 85, desc: 'A long root dug from frozen ground. Grated, it is slippery and good.' },
};

export const ARTIFACTS = {
  kosen: { name: 'Old Coin', jp: '古銭', sell: 60, weight: 5, desc: 'A green-rusted coin with a square hole. Older than the shogunate.' },
  toki: { name: 'Pottery Shard', jp: '陶器片', sell: 40, weight: 6, desc: 'A piece of glazed pot with a painted band.' },
  yajiri: { name: 'Arrowhead', jp: '鏃', sell: 80, weight: 3, desc: 'An iron arrowhead. Somebody fought here, long ago.' },
  magatama: { name: 'Magatama', jp: '勾玉', sell: 400, weight: 1, desc: 'A comma-shaped jade bead. The shrine would want to see this.' },
};

// Forage and dig spots placed per map each morning.
export const SPOTS = {
  grove: { forage: 12, dig: 3 },
  shrine: { forage: 5, dig: 1 },
  village: { forage: 4, dig: 1 },
  farm: { forage: 3, dig: 1 },
};
