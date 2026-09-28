// Home and hearth, kept out of game.js and flow.js: offering the Red Thread and the Shrine Vow,
// Tatsu's farmhouse extension, the wedding morning, and what a spouse does before you wake.
import { Dialog } from './ui/dialog.js';
import { t } from './data/strings.js';
import { itemDef } from './data/items.js';
import { NPCS } from './data/npcs.js';
import { ROMANCE, NOT_YET } from './data/romance.js';
import { fitHouse } from './maps/index.js';
import { forgetNav } from './systems/nav.js';
import { romanceCheck, court, engage, weddingDue, marry, weddingScript } from './systems/romance.js';
import { rainWater } from './systems/farming.js';
import { pet } from './systems/animals.js';
import { dayIndex } from './systems/calendar.js';
import { speak, bondOf } from './world/talk.js';

const BUILD_DAYS = 3;
// What a spouse might leave by the hearth.
const SPOUSE_DISHES = ['onigiri', 'yakiimo', 'tamagoyaki', 'miso_soup'];

/** Lay out the farmhouse for this save (the extension is a flag), and forget any stale copy. */
export function settleHouse(g) {
  fitHouse(!!g.flags.house_upgraded);
  forgetNav('house_farm');
  g.worlds.delete('house_farm');
}

/** Offer the held Red Thread or Shrine Vow; false if it isn't one (so the usual gift path runs).
 * `chat` is the plain talk to fall back on. */
export function offerRomance(g, n, chat) {
  const cur = g.inventory.current;
  if (!cur || itemDef(cur.id).kind !== 'romance') return false;
  const r = romanceCheck(g, n.id, cur.id);
  if (!r.ok && !r.why) return false;
  const name = itemDef(cur.id).name;
  g.modals.push(new Dialog(g, {
    text: t('romance_ask', { item: name, npc: NPCS[n.id].name }),
    choices: [t('romance_give'), t('gift_talk')],
    onChoose: (i) => {
      if (i === 0) take(g, n, cur.id, r);
      else chat(g, n);
    },
  }));
  return true;
}

function take(g, n, item, r) {
  if (!r.ok) { n.showEmote('dots'); g.modals.push(speak(g, n.id, NOT_YET[r.why])); return; }
  const b = bondOf(g, n.id);
  g.inventory.remove(item, 1);
  n.showEmote('heart');
  g.sfx('harvest');
  const npc = NPCS[n.id].name;
  if (item === 'red_thread') {
    court(b);
    g.addVirtue('makoto', 2);
    g.modals.push(speak(g, n.id, ROMANCE[n.id].court, { onClose: () => g.toast('toast_courting', { npc }, 'icon_heart') }));
  } else {
    engage(g.romance, n.id, dayIndex(g.cal));
    g.modals.push(speak(g, n.id, ROMANCE[n.id].vow, { onClose: () => g.toast('toast_engaged', null, 'icon_heart') }));
  }
}

/** Buying the extension from Tatsu: he needs the timber and stone on hand. Returns true if begun. */
export function orderHouse(g, def) {
  const short = def.needs.filter(([id, n]) => g.inventory.count(id) < n);
  if (short.length) {
    g.sfx('deny');
    g.toast('build_needs', { needs: def.needs.map(([id, n]) => `${n} ${itemDef(id).name}`).join(', ') });
    return false;
  }
  for (const [id, n] of def.needs) g.inventory.remove(id, n);
  g.construction = { what: 'house', ready: dayIndex(g.cal) + BUILD_DAYS };
  g.toast('build_started', null, 'icon_house_ext');
  return true;
}

/**
 * Overnight, before waking: finish Tatsu's work, and hold the wedding if it is due. Returns
 * { built, wedding } for the morning and where to wake (the shrine on a wedding day).
 */
export function homeNight(g) {
  const day = dayIndex(g.cal), out = { built: false, wedding: null };
  if (g.construction && day >= g.construction.ready) {
    g.flags.house_upgraded = true;
    g.construction = null;
    settleHouse(g);
    out.built = true;
  }
  if (weddingDue(g.romance, day)) {
    const id = out.wedding = g.romance.engaged.npc;
    marry(g.romance);
    // Set before waking at the shrine, so no other scene there claims the morning.
    g.pendingScene = {
      script: weddingScript(id),
      onEnd: () => { g.toast('toast_married', { npc: NPCS[id].name }, 'icon_heart'); g.warp({ to: 'farm', tx: 29, ty: 11, dir: 'down' }); },
    };
  }
  return out;
}

/** The morning after: the wedding scene, the builder's news, and a spouse's help around the farm. */
export function homeMorning(g, r) {
  if (r.wedding) return;
  if (r.built) g.aside('tk_house_done');
  else if (g.construction) g.aside('tk_building', { once: 'building' });
  const day = dayIndex(g.cal);
  if (g.romance.engaged?.day === day + 1) g.aside('tk_wedding_eve');
  const sp = g.romance.spouse;
  if (!sp) return;
  const npc = NPCS[sp].name, roll = g.rng.next();
  const farm = g.worldFor('farm').map;
  if (roll < 0.35 && !g.rain) { rainWater(farm); g.aside('sp_watered', { vars: { npc } }); }
  else if (roll < 0.55 && g.animals.list.length) { for (const a of g.animals.list) pet(a, day); g.aside('sp_petted', { vars: { npc } }); }
  else if (roll < 0.7) {
    const dish = SPOUSE_DISHES[Math.floor(g.rng.next() * SPOUSE_DISHES.length)];
    g.pickUp(dish, 1);
    g.aside('sp_cooked', { vars: { npc, dish: itemDef(dish).name } });
  }
}

/** Where to wake: the shrine steps on a wedding day, else your own futon. */
export function wakeSpot(r) {
  return r.wedding ? { map: 'shrine', tx: 18, ty: 13, dir: 'up' } : null;
}
