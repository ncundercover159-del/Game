// Atlas registration for M6: the new homes' furniture, market stalls, and festival decorations.
import { valleyIcons } from './icons2.js';
import { butsudan, tub, barrels, sawhorse, desk, swordRack, yatai, omamoriStand } from './furniture2.js';

export function addValleyArt(atlas, add) {
  add('butsudan', butsudan());
  add('tub', tub());
  add('barrels', barrels());
  add('sawhorse', sawhorse());
  add('desk', desk());
  add('swordRack', swordRack());
  add('yatai_day', yatai(['straw1', 'straw2', 'straw3', 'straw4']));
  add('yatai_night', yatai(['indigo0', 'indigo1', 'indigo2', 'indigo3']));
  add('omamori', omamoriStand());
  for (const [k, g] of Object.entries(valleyIcons())) add(`icon_${k}`, g, 0, 0);
}
