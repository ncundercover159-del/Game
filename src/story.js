// The story on the game side: villagers signing the petition as you talk to them, sending it off
// once there are enough names, and Kuroda's hired hand at dawn. Rules live in systems/story.js.
import { NPCS } from './data/npcs.js';
import { rainWater } from './systems/farming.js';
import { canSign, signatures, PETITION_NEEDED } from './systems/story.js';
import { hearts } from './systems/bonds.js';
import { dayIndex } from './systems/calendar.js';

/** After a chat: a villager who trusts you signs the petition; with enough names (Shinsuke's
 * ledger counts for several) it goes to the castle. */
export function petitionTalk(g, id) {
  if (canSign(g.flags, id, hearts(g.bonds[id]?.pts || 0))) {
    g.flags[`signed_${id}`] = true;
    g.toast('petition_signed', { npc: NPCS[id].name, n: Math.min(PETITION_NEEDED, signatures(g.flags)), of: PETITION_NEEDED }, 'icon_haiku_scroll');
  }
  if (g.flags.petition && g.flags.petition_sent === undefined && signatures(g.flags) >= PETITION_NEEDED) {
    g.flags.petition_sent = dayIndex(g.cal);
    g.aside('tk_petition_sent');
  }
}

/** Dawn: Kuroda's man waters the fields, as the contract says. */
export function storyMorning(g) {
  if (!g.flags.kuroda_signed || g.rain) return;
  rainWater(g.worldFor('farm').map);
  g.aside('tk_kuroda_hand', { once: true });
}
