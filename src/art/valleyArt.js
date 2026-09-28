// Atlas registration for M6: the new homes' furniture, market stalls, and festival decorations.
import { valleyIcons } from './icons2.js';
import { lanternString, nobori, yagura, usu, sasa, tsukimiStand, yukidoro, kamakura, goza, taiko } from './festivalArt.js';
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
  add('decor_lanterns', lanternString());
  add('decor_nobori_red', nobori(['red0', 'red1', 'red2', 'red4']));
  add('decor_nobori_indigo', nobori(['indigo0', 'indigo1', 'indigo2', 'indigo3']));
  add('decor_yagura', yagura());
  add('decor_usu', usu());
  add('decor_sasa', sasa());
  add('decor_tsukimi', tsukimiStand());
  add('decor_yukidoro', yukidoro());
  add('decor_kamakura', kamakura());
  add('decor_goza', goza());
  add('decor_taiko', taiko());
  for (const [k, g] of Object.entries(valleyIcons())) add(`icon_${k}`, g, 0, 0);
}
