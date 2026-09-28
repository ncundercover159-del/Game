// Villager looks: palette swaps plus hairstyles and outfit shapes over the shared character grids.
// A look is { hair, skin, kosode, hakama, obi, feet, collar, cord } ramps (see characters.js),
// plus `style` (hair), `sword` (only the player wears one), `kimono` (long robe instead of hakama)
// and portrait extras (`age`, `beard`, `mustache`, `ornament`).

// Replacement rows for the top of the head (rows 0-4), per style and direction.
const CROWNS = {
  cropped: {
    down: ['................', '................', '.....HHHHHH.....', '...HHhjjhhhHH...', '..HhjjhhhhhhhH..'],
    up: ['................', '................', '.....HHHHHH.....', '...HHhjjhhhHH...', '..HhjjhhhhhhhH..'],
    right: ['................', '................', '...HHHHHHH......', '..HhjjhhhhHH....', '.HhjjhhhhhhhH...'],
  },
  bun: {
    down: ['......HHHH......', '.....HjhhhH.....', '....HHhwhhHH....', '...HhhjjhhhhH...', '..HhjjhhhhhhhH..'],
    up: ['......HHHH......', '.....HjhhhH.....', '....HHhhwhHH....', '...HhhjjhhhhH...', '..HhjjhhhhhhhH..'],
    right: ['..HHHH..........', '.HjhhhH.........', '.HhhwhHHHH......', '..HhjjhhhhHH....', '.HhjjhhhhhhhH...'],
  },
};
CROWNS.long = CROWNS.cropped;
CROWNS.band = CROWNS.cropped;
// Shaven: the cropped crown, painted in skin tones by the look's hair ramp.
CROWNS.shaved = CROWNS.cropped;

// A headband (hachimaki) across the brow, in the cord colour.
const BAND = {
  down: [6, '.HwwwwwwwwwwwwH.'],
  up: [6, '.HwwwwwwwwwwwwH.'],
  right: [6, '.wwwhhhhhhhhhhH.'],
};

/** Head rows restyled for a hairstyle (topknot is the base drawing). */
export function restyleHead(rows, dir, style) {
  const lines = rows.split('\n').map((l) => l.trim()).filter((l) => l.length);
  const crown = CROWNS[style]?.[dir];
  if (crown) crown.forEach((r, i) => { lines[i] = r; });
  if (style === 'band') lines[BAND[dir][0]] = BAND[dir][1];
  return lines;
}

/** Long hair falling over the shoulders or down the back, painted over the torso (frame coords). */
export function longHair(dir) {
  if (dir === 'down') return [[1, 16], [2, 16], [1, 17], [2, 17], [1, 18], [13, 16], [14, 16], [13, 17], [14, 17], [14, 18]];
  if (dir === 'up') {
    const out = [];
    for (let y = 16; y < 23; y++) for (let x = 6; x < 10; x++) out.push([x, y]);
    return out;
  }
  return [[2, 16], [3, 16], [2, 17], [3, 17], [2, 18], [3, 18], [3, 19]];
}

export const NPC_LOOKS = {
  genzo: {
    hair: ['ink0', 'ink3', 'ink4'], skin: ['skin0', 'skin2', 'skin3', 'skin4'],
    kosode: ['wood0', 'wood1', 'wood2', 'wood3'], hakama: ['ink0', 'ink1', 'ink2', 'ink3'],
    obi: ['ink0', 'ink2'], feet: ['wood1', 'wood3'], collar: ['wood3', 'wood4'], cord: 'ink6',
    style: 'band', age: 2, beard: true,
  },
  okiku: {
    hair: ['ink0', 'ink1', 'ink2'], skin: ['skin2', 'skin4', 'skin5', 'skin6'],
    kosode: ['sakura0', 'sakura1', 'sakura2', 'sakura3'], hakama: ['sakura0', 'sakura1', 'sakura2', 'sakura3'],
    obi: ['gold0', 'gold2'], feet: ['wood1', 'ink6'], collar: ['ink6', 'ink5'], cord: 'red2',
    style: 'bun', kimono: true, age: 1, ornament: 'red2',
  },
  tomoe: {
    hair: ['ink0', 'ink1', 'ink2'], skin: ['skin2', 'skin4', 'skin5', 'skin6'],
    kosode: ['ink3', 'ink5', 'ink6', 'ink6'], hakama: ['red0', 'red1', 'red2', 'red3'],
    obi: ['red1', 'red2'], feet: ['wood1', 'ink6'], collar: ['red2', 'red3'], cord: 'ink6',
    style: 'long', age: 0,
  },
  heibei: {
    hair: ['ink2', 'ink4', 'ink5'], skin: ['skin1', 'skin3', 'skin4', 'skin5'],
    kosode: ['grass0', 'grass1', 'grass2', 'grass3'], hakama: ['stone0', 'stone1', 'stone2', 'stone3'],
    obi: ['wood1', 'wood2'], feet: ['wood1', 'ink5'], collar: ['ink6', 'ink5'], cord: 'ink6',
    style: 'topknot', age: 2, mustache: true,
  },
  ume: {
    hair: ['ink0', 'ink1', 'sakura0'], skin: ['skin1', 'skin3', 'skin4', 'skin5'],
    kosode: ['grass0', 'teal0', 'teal1', 'grass4'], hakama: ['grass0', 'teal0', 'teal1', 'grass4'],
    obi: ['straw1', 'straw3'], feet: ['wood1', 'ink6'], collar: ['straw3', 'straw4'], cord: 'gold2',
    style: 'bun', kimono: true, age: 1, ornament: 'gold2',
  },
  daigo: {
    hair: ['ink0', 'ink2', 'ink3'], skin: ['skin0', 'skin2', 'skin3', 'skin4'],
    kosode: ['water0', 'water1', 'water2', 'water3'], hakama: ['wood0', 'wood1', 'wood2', 'wood3'],
    obi: ['straw1', 'straw3'], feet: ['wood1', 'wood3'], collar: ['ink6', 'water4'], cord: 'water4',
    style: 'band', age: 1, beard: true,
  },
  kaito: {
    hair: ['wood0', 'wood1', 'wood2'], skin: ['skin1', 'skin3', 'skin4', 'skin5'],
    kosode: ['straw0', 'straw1', 'straw2', 'straw3'], hakama: ['wood0', 'wood2', 'wood3', 'wood4'],
    obi: ['wood1', 'wood2'], feet: ['wood1', 'wood4'], collar: ['ink6', 'ink5'], cord: 'wood2',
    style: 'cropped', age: 0,
  },
  chobei: {
    hair: ['ink0', 'ink2', 'ink3'], skin: ['skin2', 'skin4', 'skin5', 'skin6'],
    kosode: ['ink0', 'ink1', 'ink2', 'ink3'], hakama: ['indigo0', 'indigo1', 'indigo2', 'indigo3'],
    obi: ['wood1', 'wood3'], feet: ['wood1', 'ink6'], collar: ['ink6', 'ink5'], cord: 'ink4',
    style: 'topknot', age: 2, mustache: true, kimono: true,
  },
  // M6: the rest of the valley.
  soken: {
    // Shaven head: the hair ramp is his scalp.
    hair: ['skin1', 'skin3', 'skin5'], skin: ['skin1', 'skin3', 'skin4', 'skin5'],
    kosode: ['ink1', 'ink2', 'ink3', 'ink4'], hakama: ['ink1', 'ink2', 'ink3', 'ink4'],
    obi: ['gold0', 'gold1'], feet: ['wood1', 'ink6'], collar: ['gold1', 'gold2'], cord: 'gold1',
    style: 'shaved', kimono: true, age: 1,
  },
  rin: {
    hair: ['ink0', 'ink1', 'indigo1'], skin: ['skin2', 'skin4', 'skin5', 'skin6'],
    kosode: ['indigo0', 'indigo1', 'indigo2', 'indigo3'], hakama: ['ink0', 'ink1', 'ink2', 'ink3'],
    obi: ['red1', 'red2'], feet: ['wood1', 'ink6'], collar: ['ink6', 'ink5'], cord: 'red2',
    style: 'long', sword: true, age: 0,
  },
  toyo: {
    hair: ['ink3', 'ink5', 'ink6'], skin: ['skin1', 'skin3', 'skin4', 'skin5'],
    kosode: ['wood0', 'wood2', 'wood3', 'wood4'], hakama: ['wood0', 'wood2', 'wood3', 'wood4'],
    obi: ['indigo0', 'indigo1'], feet: ['wood1', 'ink6'], collar: ['ink6', 'ink5'], cord: 'indigo1',
    style: 'bun', kimono: true, age: 2,
  },
  kinta: {
    hair: ['ink0', 'ink2', 'ink3'], skin: ['skin2', 'skin4', 'skin5', 'skin6'],
    kosode: ['red0', 'red1', 'red2', 'red3'], hakama: ['wood0', 'wood1', 'wood2', 'wood3'],
    obi: ['straw1', 'straw3'], feet: ['wood1', 'wood4'], collar: ['ink6', 'ink5'], cord: 'straw3',
    style: 'cropped', age: 0, child: true,
  },
  tatsu: {
    hair: ['ink0', 'ink2', 'ink3'], skin: ['skin0', 'skin2', 'skin3', 'skin4'],
    kosode: ['teal0', 'teal0', 'teal1', 'grass3'], hakama: ['stone0', 'stone1', 'stone2', 'stone3'],
    obi: ['wood1', 'wood3'], feet: ['wood1', 'wood3'], collar: ['ink6', 'ink5'], cord: 'ink6',
    style: 'band', age: 1,
  },
  yuzu: {
    hair: ['wood0', 'wood1', 'wood3'], skin: ['skin2', 'skin4', 'skin5', 'skin6'],
    kosode: ['gold0', 'gold1', 'gold2', 'gold3'], hakama: ['gold0', 'gold1', 'gold2', 'gold3'],
    obi: ['red1', 'red2'], feet: ['wood1', 'ink6'], collar: ['ink6', 'ink5'], cord: 'red3',
    style: 'bun', kimono: true, age: 0, ornament: 'gold1',
  },
  sakuya: {
    hair: ['ink0', 'wood0', 'wood1'], skin: ['skin1', 'skin3', 'skin4', 'skin5'],
    kosode: ['water0', 'teal0', 'teal1', 'water3'], hakama: ['wood0', 'wood1', 'wood2', 'wood3'],
    obi: ['gold0', 'gold2'], feet: ['wood1', 'wood4'], collar: ['gold1', 'gold2'], cord: 'gold2',
    style: 'long', age: 1,
  },
  okubo: {
    hair: ['ink0', 'ink1', 'ink2'], skin: ['skin2', 'skin4', 'skin5', 'skin6'],
    kosode: ['ink0', 'ink0', 'ink1', 'ink2'], hakama: ['indigo0', 'ink0', 'ink1', 'indigo1'],
    obi: ['gold0', 'gold1'], feet: ['ink1', 'ink6'], collar: ['ink6', 'ink5'], cord: 'gold2',
    style: 'topknot', sword: true, age: 2, mustache: true,
  },
  shinsuke: {
    hair: ['ink0', 'ink2', 'ink3'], skin: ['skin1', 'skin3', 'skin4', 'skin5'],
    kosode: ['indigo0', 'indigo1', 'indigo2', 'indigo3'], hakama: ['stone0', 'stone1', 'stone2', 'stone3'],
    obi: ['ink0', 'ink2'], feet: ['wood1', 'ink6'], collar: ['ink6', 'ink5'], cord: 'indigo3',
    style: 'topknot', sword: true, age: 0,
  },
  kon: {
    hair: ['wood1', 'gold0', 'gold1'], skin: ['skin2', 'skin4', 'skin5', 'skin6'],
    kosode: ['ink3', 'ink4', 'ink5', 'ink6'], hakama: ['red0', 'red1', 'red2', 'red3'],
    obi: ['gold0', 'gold2'], feet: ['wood1', 'ink6'], collar: ['red2', 'red3'], cord: 'red2',
    style: 'cropped', age: 0,
  },
};
