// What you can choose for your character on a new farm: hairstyle, hair colour, skin, the kosode and
// the hakama. Colours are ramps from the palette, dark to light. `playerLook` turns a choice into
// a character look for art/characters.js.
export const HAIR_STYLES = ['topknot', 'cropped', 'long', 'bun', 'band'];

export const HAIR_COLOURS = [
  ['ink0', 'ink2', 'ink3'],        // black
  ['wood0', 'wood1', 'wood2'],     // brown
  ['red0', 'red1', 'wood3'],       // auburn
  ['ink3', 'ink4', 'ink5'],        // grey
];

export const SKINS = [
  ['skin1', 'skin3', 'skin4', 'skin5'],
  ['skin2', 'skin4', 'skin5', 'skin6'],
  ['skin0', 'skin2', 'skin3', 'skin4'],
  ['skin0', 'skin1', 'skin2', 'skin3'],
];

export const KOSODE = [
  ['ink0', 'indigo0', 'indigo1', 'indigo2'],   // indigo
  ['red0', 'red1', 'red2', 'red3'],            // madder red
  ['grass0', 'grass1', 'grass2', 'grass3'],    // pine green
  ['wood0', 'wood1', 'wood2', 'wood3'],        // persimmon brown
  ['ink1', 'ink2', 'ink3', 'ink4'],            // charcoal
];

export const HAKAMA = [
  ['ink0', 'stone1', 'stone2', 'stone3'],      // slate
  ['indigo0', 'indigo1', 'indigo2', 'indigo3'],
  ['wood0', 'wood1', 'wood2', 'wood3'],
];

/** The choice a new farm starts with (the look the game shipped with). */
export const DEFAULT_LOOK = { style: 0, hair: 0, skin: 0, kosode: 0, hakama: 0 };
export const LOOK_PARTS = { style: HAIR_STYLES, hair: HAIR_COLOURS, skin: SKINS, kosode: KOSODE, hakama: HAKAMA };

/** A character look (see art/characters.js LOOKS) for a choice; out-of-range parts fall back. */
export function playerLook(choice = DEFAULT_LOOK) {
  const pick = (part) => LOOK_PARTS[part][choice[part]] ?? LOOK_PARTS[part][0];
  return {
    hair: pick('hair'), skin: pick('skin'), kosode: pick('kosode'), hakama: pick('hakama'),
    obi: ['wood1', 'wood2'], feet: ['wood1', 'ink5'], collar: ['ink6', 'ink5'], cord: 'red2',
    style: pick('style'), sword: true,
  };
}
