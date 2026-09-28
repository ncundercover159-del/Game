// Atlas registration for M5: weapons in hand and their icons, enemies, projectiles, omens, and the
// cave tiles' props. Frame names are the contract with world/draw code.
import { addCharacter } from './characters.js';
import { addHeldWeapons, weaponIcons, combatSprites } from './weapons.js';
import { ENEMY_LOOKS, yokaiFrames, omens } from './enemies.js';
import { oreNode, urn, chest, ladderHole, ropeUp, caveLantern, timbers, crackedWall, bundle, caveMouth, brazier, deepStair } from './cave.js';
import { ORES } from '../data/caves.js';
import { portrait, EXPRESSIONS } from './portraits.js';

export function addCombatArt(atlas, add) {
  addHeldWeapons(atlas);
  for (const [k, g] of Object.entries(weaponIcons())) add(`icon_${k}`, g, 0, 0);
  for (const [k, g] of Object.entries(combatSprites())) add(`fx_${k}`, g, Math.floor(g.w / 2), Math.floor(g.h / 2));
  for (const [id, look] of Object.entries(ENEMY_LOOKS)) addCharacter(atlas, id, look);
  for (const ex of EXPRESSIONS) add(`portrait_jubei_${ex}`, portrait(ENEMY_LOOKS.jubei, ex), 0, 0);
  for (const [k, g] of Object.entries(yokaiFrames())) add(k, g, 8, g.h);
  for (const [k, g] of Object.entries(omens())) add(`fx_${k}`, g, Math.floor(g.w / 2), Math.floor(g.h / 2));

  for (const zone of [1, 2]) {
    for (const kind of Object.keys(ORES)) {
      const g = oreNode(kind, zone);
      add(`ore_${kind}_${zone}`, g, 9, g.h - 1);
    }
    add(`cracked_${zone}`, crackedWall(zone), 8, 16);
  }
  add('urn', urn());
  add('chest_shut', chest(false), 7, 12);
  add('chest_open', chest(true), 7, 12);
  add('ladder', ladderHole(), 8, 16);
  add('rope', ropeUp(), 7, 30);
  add('cave_lantern', caveLantern(false));
  add('cave_lantern_lit', caveLantern(true));
  add('timbers', timbers(), 11, 31);
  add('bundle', bundle());
  add('cave_mouth', caveMouth());
  add('brazier', brazier());
  add('deep', deepStair(), 8, 16);
}
