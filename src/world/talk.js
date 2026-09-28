// Talking to villagers and giving them gifts: bond bookkeeping, the line they say, and the
// dialogue box with their portrait and voice.
import { NPCS } from '../data/npcs.js';
import { itemDef } from '../data/items.js';
import { t } from '../data/strings.js';
import { dayIndex } from '../systems/calendar.js';
import { WEATHER } from '../systems/weather.js';
import { newBond, talk, pickLine, giftBlock, giveGift, isGiftable, isBirthday, parseLine, hearts } from '../systems/bonds.js';
import { Dialog } from '../ui/dialog.js';
import DIALOGUE from '../data/dialogue/index.js';

export function bondOf(game, id) {
  if (!game.bonds[id]) game.bonds[id] = newBond();
  return game.bonds[id];
}

/** A dialogue box spoken by a villager. */
export function speak(game, id, line, extra = {}) {
  const { face, text } = typeof line === 'string' ? parseLine(line) : line;
  const npc = NPCS[id];
  return new Dialog(game, {
    text: text.replace(/\{name\}/g, game.state.name),
    speaker: `${npc.name} ${npc.jp}`,
    portrait: `portrait_${id}_${face}`,
    voice: npc.voice,
    ...extra,
  });
}

/** At a shop counter with its keeper: shop, talk (or give), or leave. */
export function counter(game, shop, n) {
  game.villagers.greet(n, game.player.tx, game.player.ty);
  game.modals.push(speak(game, n.id, { face: 'happy', text: t('counter_ask') }, {
    choices: [t('counter_shop'), t('counter_talk'), t('counter_leave')],
    onChoose: (i) => {
      if (i === 0) game.openShop(shop);
      else if (i === 1) interactNpc(game, n);
    },
  }));
}

/** Interacting with a villager: offer the held item as a gift, or just talk. */
export function interactNpc(game, n) {
  const p = game.player;
  game.villagers.greet(n, p.tx, p.ty);
  const cur = game.inventory.current;
  const b = bondOf(game, n.id);
  if (cur && isGiftable(cur.id) && b.met && !giftBlock(b, dayIndex(game.cal))) {
    const name = itemDef(cur.id).name;
    game.modals.push(new Dialog(game, {
      text: t('gift_ask', { item: name, npc: NPCS[n.id].name }),
      choices: [t('gift_give', { item: name }), t('gift_talk')],
      onChoose: (i) => { if (i === 0) gift(game, n); else chat(game, n); },
    }));
    return;
  }
  chat(game, n);
}

function chat(game, n) {
  const day = dayIndex(game.cal);
  const b = bondOf(game, n.id);
  const first = !b.met;
  const line = pickLine(n.id, b, {
    season: game.seasonId, weekday: day % 7, rain: !!WEATHER[game.weather].rain, minutes: game.cal.minutes,
    place: n.map, stop: n.stop && n.stop.slice(1, 4), flags: game.flags, seed: game.seed, day,
  });
  const before = hearts(b.pts);
  talk(b, day);
  if (first) n.showEmote('bang');
  if (isBirthday(n.id, game.cal) && !first) game.aside('tk_birthday', { once: `bday_${n.id}_${game.cal.year}`, vars: { npc: NPCS[n.id].name } });
  game.modals.push(speak(game, n.id, line));
  heartUp(game, n, before);
}

function gift(game, n) {
  const g = game;
  const slot = g.inventory.selected;
  const s = g.inventory.slots[slot];
  const b = bondOf(g, n.id);
  const bday = isBirthday(n.id, g.cal);
  const before = hearts(b.pts);
  talk(b, dayIndex(g.cal));
  const r = giveGift(b, n.id, s.id, dayIndex(g.cal), bday);
  b.known = { ...b.known, [s.id]: r.taste };
  g.inventory.takeFrom(slot, 1);
  n.showEmote({ loved: 'heart', liked: 'note', neutral: 'dots', disliked: 'dots', hated: 'anger' }[r.taste]);
  g.sfx(r.delta > 0 ? 'harvest' : 'deny');
  if (r.delta > 0) g.addVirtue('jin', 1);
  if (bday && r.delta > 0) g.addVirtue('rei', 2);
  g.modals.push(speak(g, n.id, bday && r.delta > 0 ? DIALOGUE[n.id].birthday : DIALOGUE[n.id].gift[r.taste]));
  heartUp(g, n, before);
}

function heartUp(game, n, before) {
  const now = hearts(bondOf(game, n.id).pts);
  if (now > before) game.toast('toast_heart', { npc: NPCS[n.id].name, n: now }, 'icon_heart');
}
