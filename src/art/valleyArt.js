// Atlas registration for M6 and M7: the new homes' furniture, market stalls, festival decorations,
// and M7's dishes, buffs and kodama.
import { valleyIcons } from './icons2.js';
import { lateIcons } from './icons3.js';
import { kodamaFrames, hokora } from './kodama.js';
import { SPEAKER_LOOKS } from './looks.js';
import { portrait, EXPRESSIONS } from './portraits.js';
import { lanternString, nobori, yagura, usu, sasa, tsukimiStand, yukidoro, kamakura, goza, taiko } from './festivalArt.js';
import { butsudan, tub, barrels, sawhorse, desk, swordRack, yatai, omamoriStand, makiwara, mato } from './furniture2.js';

export function addValleyArt(atlas, add) {
  add('butsudan', butsudan());
  add('tub', tub());
  add('barrels', barrels());
  add('sawhorse', sawhorse());
  add('desk', desk());
  add('swordRack', swordRack());
  add('makiwara', makiwara());
  add('mato', mato());
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
  for (const [id, look] of Object.entries(SPEAKER_LOOKS)) for (const ex of EXPRESSIONS) add(`portrait_${id}_${ex}`, portrait(look, ex), 0, 0);
  for (const [k, g] of Object.entries(valleyIcons())) add(`icon_${k}`, g, 0, 0);
  for (const [k, g] of Object.entries(lateIcons())) add(`icon_${k}`, g, 0, 0);
  for (const [k, g] of Object.entries(kodamaFrames())) add(k, g);
  add('hokora', hokora());
}
