// Freshwater fish of the valley. `where`: river (farm and village river), pond (farm pond), pool
// (the grove pool), falls (the pool right under the waterfall), stream (the grove stream), cave (the
// Flooded Cellars' pools), yomi (the still pools of the Yomi Slope). Seasons and hours mean nothing
// under the mountain, so the cave fish list all of them.
// `hours` [from, to) in minutes (may pass midnight: to > 1440). `weather`: 'rain' | 'storm' | 'clear' | undefined.
// `move` is how it swims in the reel minigame; `diff` 1-10 sets its speed and nerve.
const DAY = [360, 1140], ALL = [360, 1560], NIGHT = [1080, 1560];
const YEAR = ['spring', 'summer', 'autumn', 'winter'];

export const FISH = {
  ayu: { name: 'Ayu', jp: '鮎', seasons: ['summer'], where: ['river', 'stream'], hours: DAY, diff: 4, move: 'dart', sell: 80, look: 'slim', colors: ['stone1', 'stone3', 'gold2'], desc: 'The sweetfish. It smells faintly of watermelon.' },
  iwana: { name: 'Iwana', jp: '岩魚', seasons: ['spring', 'summer', 'autumn'], where: ['stream', 'falls'], hours: DAY, diff: 5, move: 'dart', sell: 90, look: 'slim', colors: ['wood1', 'wood3', 'ink6'], pattern: 'spots', desc: 'A char of cold mountain water, pale-spotted.' },
  yamame: { name: 'Yamame', jp: '山女魚', seasons: ['spring', 'autumn'], where: ['stream'], hours: DAY, diff: 4, move: 'smooth', sell: 75, look: 'slim', colors: ['stone1', 'stone3', 'sakura3'], pattern: 'bars', desc: 'A mountain trout with thumbprint marks along its side.' },
  amago: { name: 'Amago', jp: '天魚', seasons: ['spring', 'summer'], where: ['stream', 'falls'], hours: DAY, diff: 5, move: 'dart', sell: 95, look: 'slim', colors: ['stone1', 'stone3', 'red3'], pattern: 'spots', desc: 'Like a yamame, freckled with red.' },
  koi: { name: 'Koi', jp: '鯉', seasons: ['spring', 'summer', 'autumn', 'winter'], where: ['pond', 'pool'], hours: ALL, diff: 3, move: 'smooth', sell: 60, look: 'deep', colors: ['wood1', 'wood2', 'gold1'], desc: 'A common carp, bronze and patient.' },
  funa: { name: 'Funa', jp: '鮒', seasons: ['spring', 'summer', 'autumn'], where: ['pond', 'river'], hours: ALL, diff: 2, move: 'smooth', sell: 30, look: 'deep', colors: ['stone0', 'stone2', 'stone3'], desc: 'Crucian carp. Every child in the valley has caught one.' },
  moroko: { name: 'Moroko', jp: '諸子', seasons: ['spring'], where: ['pond'], hours: DAY, diff: 2, move: 'smooth', sell: 25, look: 'small', colors: ['stone2', 'stone3', 'stone4'], desc: 'A small, fine-boned minnow. Grilled whole in spring.' },
  tanago: { name: 'Tanago', jp: '鱮', seasons: ['spring', 'autumn'], where: ['pond', 'pool'], hours: DAY, diff: 3, move: 'dart', sell: 40, look: 'small', colors: ['indigo1', 'sakura2', 'sakura3'], desc: 'A bitterling, flushed with colour like a sunset.' },
  dojo: { name: 'Loach', jp: '泥鰌', seasons: ['spring', 'summer'], where: ['pond'], hours: ALL, diff: 3, move: 'dart', sell: 25, look: 'eel', colors: ['wood0', 'wood2', 'straw2'], desc: 'A whiskered little loach from the mud.' },
  oikawa: { name: 'Oikawa', jp: '追河', seasons: ['spring', 'summer'], where: ['river'], hours: DAY, diff: 2, move: 'smooth', sell: 30, look: 'slim', colors: ['water1', 'water3', 'ink6'], desc: 'Pale chub, quick in the shallows.' },
  ugui: { name: 'Ugui', jp: '石斑魚', seasons: ['spring', 'autumn', 'winter'], where: ['river'], hours: ALL, diff: 2, move: 'smooth', sell: 28, look: 'slim', colors: ['stone0', 'stone2', 'red3'], desc: 'Japanese dace. It turns red-striped in spring.' },
  hasu: { name: 'Hasu', jp: '鰣', seasons: ['summer'], where: ['river'], hours: DAY, diff: 4, move: 'dart', sell: 55, look: 'slim', colors: ['indigo0', 'stone3', 'ink6'], desc: 'A predator minnow with a crooked grin.' },
  nigoi: { name: 'Nigoi', jp: '似鯉', seasons: ['spring', 'summer'], where: ['river'], hours: ALL, diff: 3, move: 'smooth', sell: 38, look: 'slim', colors: ['stone1', 'stone2', 'stone4'], desc: 'Looks like a carp, fights like a carp, is not a carp.' },
  masu: { name: 'Masu', jp: '鱒', seasons: ['spring'], where: ['river'], hours: DAY, diff: 5, move: 'mixed', sell: 110, look: 'slim', colors: ['stone1', 'stone3', 'sakura2'], pattern: 'spots', desc: 'The cherry salmon, home from the sea in blossom time.' },
  salmon: { name: 'Salmon', jp: '鮭', seasons: ['autumn'], where: ['river'], hours: ALL, diff: 6, move: 'mixed', sell: 140, look: 'deep', colors: ['red0', 'red2', 'stone3'], desc: 'Home to spawn, hook-jawed and stubborn.' },
  kajika: { name: 'Kajika', jp: '鰍', seasons: ['autumn', 'winter'], where: ['stream'], hours: ALL, diff: 3, move: 'sinker', sell: 45, look: 'flat', colors: ['wood0', 'wood2', 'wood3'], pattern: 'bars', desc: 'A river sculpin that hides under stones.' },
  kamatsuka: { name: 'Kamatsuka', jp: '鎌柄', seasons: ['summer', 'autumn'], where: ['river'], hours: DAY, diff: 3, move: 'sinker', sell: 35, look: 'slim', colors: ['straw1', 'straw3', 'straw4'], pattern: 'spots', desc: 'A goby minnow that noses through the sand.' },
  gigi: { name: 'Gigi', jp: '義義', seasons: ['summer'], where: ['river'], hours: NIGHT, diff: 5, move: 'sinker', sell: 70, look: 'eel', colors: ['wood1', 'straw1', 'straw3'], desc: 'A bagrid catfish that squeaks "gigi" when caught.' },
  unagi: { name: 'Eel', jp: '鰻', seasons: ['summer'], where: ['river', 'pond'], hours: NIGHT, diff: 7, move: 'mixed', sell: 150, look: 'eel', colors: ['ink1', 'teal0', 'straw3'], desc: 'A river eel. Grilled with sweet sauce, it is summer\'s stamina food.' },
  namazu: { name: 'Namazu', jp: '鯰', seasons: ['summer', 'autumn'], where: ['pond', 'river'], weather: 'rain', hours: ALL, diff: 6, move: 'sinker', sell: 120, look: 'deep', colors: ['ink1', 'stone1', 'stone2'], desc: 'A catfish. They say its thrashing shakes the earth.' },
  wakasagi: { name: 'Wakasagi', jp: '公魚', seasons: ['winter'], where: ['pond', 'pool'], hours: DAY, diff: 2, move: 'floater', sell: 35, look: 'small', colors: ['water0', 'stone3', 'ink6'], desc: 'A pond smelt fished through the ice.' },
  ebi: { name: 'River Prawn', jp: '手長蝦', seasons: ['summer', 'autumn'], where: ['pond', 'river'], hours: NIGHT, diff: 2, move: 'floater', sell: 60, look: 'prawn', colors: ['wood1', 'wood3', 'straw3'], desc: 'Long-armed river prawn. Crisp when fried.' },
  sawagani: { name: 'River Crab', jp: '沢蟹', seasons: ['spring', 'summer', 'autumn'], where: ['stream'], hours: DAY, diff: 1, move: 'sinker', sell: 30, look: 'crab', colors: ['red0', 'red2', 'red3'], desc: 'A tiny freshwater crab from under the stones.' },
  kawamutsu: { name: 'Kawamutsu', jp: '川鯥', seasons: ['summer'], where: ['stream', 'pool'], hours: DAY, diff: 3, move: 'dart', sell: 40, look: 'slim', colors: ['indigo0', 'stone2', 'gold2'], desc: 'A dark-lined dace of shaded pools.' },
  medaka: { name: 'Medaka', jp: '目高', seasons: ['summer'], where: ['pond'], hours: DAY, diff: 1, move: 'floater', sell: 20, look: 'small', colors: ['straw1', 'straw3', 'ink6'], desc: 'The rice fish, no longer than a fingernail. Children keep them in bowls on the step.' },
  itoyo: { name: 'Stickleback', jp: '糸魚', seasons: ['spring'], where: ['stream'], hours: DAY, diff: 3, move: 'dart', sell: 45, look: 'small', colors: ['teal0', 'stone2', 'red2'], pattern: 'bars', desc: 'A spiny little fish. In spring the males blush red and build nests of weed.' },
  shirauo: { name: 'Icefish', jp: '白魚', seasons: ['winter', 'spring'], where: ['river'], hours: DAY, diff: 2, move: 'floater', sell: 55, look: 'slim', colors: ['ink4', 'ink5', 'ink6'], desc: 'Nearly clear and thin as a noodle. Best while the river is still cold enough to hurt.' },
  horadojo: { name: 'Cave Loach', jp: '洞泥鰌', seasons: YEAR, where: ['cave'], hours: ALL, diff: 4, move: 'sinker', sell: 90, look: 'eel', colors: ['sakura1', 'ink5', 'ink6'], desc: 'Blind and pink-pale. It has never needed eyes, and seems a little offended that you do.' },
  akari: { name: 'Glowfin', jp: '灯魚', seasons: YEAR, where: ['cave'], hours: ALL, diff: 5, move: 'dart', sell: 120, look: 'small', colors: ['indigo1', 'water3', 'gold3'], pattern: 'spots', desc: 'A small fish with a light in each cheek, bright enough to read by, if you read very small.' },
  kurokoi: { name: 'Drowned Carp', jp: '沈み鯉', seasons: YEAR, where: ['cave'], hours: ALL, diff: 6, move: 'smooth', sell: 160, look: 'deep', colors: ['ink1', 'teal0', 'stone2'], desc: 'A black carp from the old storehouse wells. Somebody fed its grandparents rice every morning.' },
  yomi_unagi: { name: 'Yomi Eel', jp: '黄泉鰻', seasons: YEAR, where: ['yomi'], hours: ALL, diff: 8, move: 'mixed', sell: 450, look: 'eel', colors: ['ink0', 'indigo1', 'ink5'], desc: 'Cold as the water it came from. It does not thrash; it waits for you to give up.' },
  hitodama: { name: 'Soul Minnow', jp: '人魂魚', seasons: YEAR, where: ['yomi'], hours: ALL, diff: 7, move: 'floater', sell: 380, look: 'small', colors: ['water1', 'water4', 'ink6'], desc: 'It swims up toward the light and not away from it. Nobody is sure what it is looking for.' },
  osanshouo: {
    name: 'Giant Salamander', jp: '大山椒魚', seasons: ['spring', 'summer'], where: ['stream'], hours: NIGHT, weather: 'rain',
    diff: 9, move: 'sinker', sell: 2500, look: 'salamander', colors: ['wood0', 'wood1', 'stone2'], pattern: 'spots', legendary: true,
    desc: 'The master of the stream: a hundred years old and as long as you are tall. It was here first, and it knows it.',
  },
  onamazu: {
    name: 'Great Namazu', jp: '大鯰', seasons: ['summer'], where: ['pond'], hours: ALL, weather: 'storm',
    diff: 10, move: 'sinker', sell: 3500, look: 'deep', colors: ['ink0', 'ink1', 'stone1'], legendary: true,
    desc: 'The catfish whose thrashing shakes the earth. Tonight it only shook your rod. It comes up in summer storms, in your own pond.',
  },
  tsukigoi: {
    name: 'Moon Carp', jp: '月鯉', seasons: ['autumn'], where: ['falls'], hours: [1320, 1560], weather: 'clear', fullMoon: true,
    diff: 10, move: 'mixed', sell: 3000, look: 'deep', colors: ['indigo2', 'ink5', 'ink6'], legendary: true,
    desc: 'Silver as the moon it rose to meet. Only on a clear autumn full-moon night, under the falls.',
  },
};

// What else a line brings up now and then.
export const JUNK = {
  waraji: { name: 'Old Sandal', jp: '古草鞋', sell: 1, desc: 'Somebody walked home with one wet foot.' },
  driftwood: { name: 'Driftwood', jp: '流木', sell: 3, desc: 'Silver-grey wood polished by the river.' },
};

/** The full moon is the 15th of every month. */
export const isFullMoon = (cal) => cal.day === 15;
