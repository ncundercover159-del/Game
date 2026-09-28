// The day's flow and the village's services, kept out of game.js: sleeping and the morning after,
// shops, eating, bowing, the notice board, the mailbox and the shrine altars.
import { Dialog } from './ui/dialog.js';
import { InkWipe } from './ui/transition.js';
import { summaryLines, drawSummary } from './ui/summary.js';
import { ShopMenu } from './ui/shop.js';
import { ForgeMenu } from './ui/forge.js';
import { NoticeMenu } from './ui/notice.js';
import { MailMenu } from './ui/mail.js';
import { OfferingMenu } from './ui/offering.js';
import { CookMenu } from './ui/cook.js';
import { Cutscene } from './ui/cutscene.js';
import { t } from './data/strings.js';
import { itemDef } from './data/items.js';
import { SHOPS } from './data/shops.js';
import { MAPS } from './maps/index.js';
import { RESTORATIONS } from './data/restorations.js';
import { endDay } from './systems/day.js';
import { decay } from './systems/bonds.js';
import { decayMult } from './systems/virtues.js';
import { refresh } from './systems/requests.js';
import { deliverMail } from './systems/mail.js';
import { coopNight } from './systems/animals.js';
import { hasPerk, addBuff, stamp } from './systems/skills.js';
import { WEATHER } from './systems/weather.js';
import { dayIndex, dateLabel, weekday, formatTime, SEASONS, WEEKDAYS } from './systems/calendar.js';

export function askSleep(g) {
  g.modals.push(new Dialog(g, {
    text: t('sleep_ask'),
    choices: [t('yes'), t('no')],
    onChoose: (i) => { if (i === 0) sleep(g, false); },
  }));
}

/** End the day behind an ink wipe: overnight systems, wake in the farmhouse, autosave. */
export function sleep(g, passedOut) {
  g.sfx('sleep');
  let summary = null;
  g.modals.push(new InkWipe(g, {
    onCovered: () => {
      const r = endDay(g, passedOut);
      g.hp = g.hpMax;
      const day = dayIndex(g.cal);
      decay(g.bonds, day, decayMult(g.virtues));
      refresh(g.requests, g.seed, day, g.seasonId);
      layEggs(g, day - 1);
      r.mail = deliverMail(g);
      const bed = MAPS.house_farm.wake;
      g.enter('house_farm', bed.tx, bed.ty, bed.dir);
      g.villagers.snap();
      for (const w of g.worlds.values()) w.spawnSpots();
      g.saveNow(true);
      summary = summaryLines(r, g);
      morning(g, r, passedOut);
    },
    card: (ctx) => summary && drawSummary(ctx, g, summary),
    minCard: 0.8,
    waitConfirm: true,
  }));
}

/** Overnight in the coop: fed animals lay; the eggs are set out on the coop floor. */
function layEggs(g, yesterday) {
  if (!g.animals.list.length) return;
  const coop = g.worldFor('coop');
  for (const e of coopNight(g.animals, yesterday, g.rng)) {
    const spot = coop.flock.freeTile();
    if (spot) coop.map.addObject({ type: 'produce', x: spot[0], y: spot[1], kind: e.id, q: e.q, v: 0 });
  }
  if (g.animals.list.some((a) => !a.fed)) g.aside('tk_hungry', { once: `hungry${g.cal.day}` });
}

/** Tsukikage's morning lines: what happened, what the day holds. */
function morning(g, r, passedOut) {
  if (passedOut) g.aside('tk_passout', { vars: { lost: r.lost } });
  else g.aside('tk_morning', { vars: { date: dateLabel(g.cal), weekday: weekday(g.cal).name } });
  if (r.newSeason) g.aside('tk_new_season', { vars: { season: `${SEASONS[g.cal.season].en} (${SEASONS[g.cal.season].jp})` } });
  if (WEATHER[g.weather].rain) g.aside('tk_rain', { once: 'rain' });
  if (g.tomorrow === 'typhoon') g.aside('tk_typhoon_warn');
  if (r.upgraded) g.aside('tk_upgrade_ready', { vars: { tool: itemDef(r.upgraded).name } });
  if (r.mail) g.aside('tk_mail', { vars: { n: r.mail } });
  if (g.flags.restored_bell) g.sfx('bell');
}

/** Open a shop from its counter: only in opening hours, never on its closed day, keeper present. */
export function openShop(g, id) {
  const shop = SHOPS[id];
  const m = g.cal.minutes;
  const keeper = MAPS[id].keeper && g.villagers.get(MAPS[id].keeper.npc);
  if (dayIndex(g.cal) % 7 === shop.closedDay || m < shop.open || m >= shop.close) {
    const day = WEEKDAYS[shop.closedDay];
    g.say('shop_closed', { name: shop.name, open: formatTime(shop.open), close: formatTime(shop.close), closed: t('shop_closed_day', { day: `${day.name} ${day.jp}` }) });
    return;
  }
  if (keeper && keeper.map !== id) { g.say('shop_away', { npc: keeper.def.name }); return; }
  g.sfx('ui_ok');
  g.modals.push(id === 'kajiya' ? new ForgeMenu(g) : new ShopMenu(g, id));
}

/** Eat the selected food for Genki (Chef: half as much again) and any buff it gives. */
export function eat(g, slot) {
  const s = g.inventory.slots[slot];
  const def = itemDef(s.id);
  if (g.genki >= g.genkiMax && g.hp >= g.hpMax && !def.buff) { g.sfx('deny'); g.aside('tk_not_hungry', { once: `full_genki${g.cal.day}` }); return; }
  const n = Math.round(def.genki * (hasPerk(g.skills, 'chef') ? 1.5 : 1));
  g.genki = Math.min(g.genkiMax, g.genki + n);
  // Food mends a little too; Ume's salves mend a lot.
  const heal = (def.heal || 0) + Math.round(n * 0.3);
  g.hp = Math.min(g.hpMax, g.hp + heal);
  g.inventory.takeFrom(slot, 1);
  g.sfx('eat');
  g.toast(def.heal ? 'toast_healed' : 'toast_ate', { item: def.name, n, h: heal }, `icon_${s.id}`);
  if (def.buff) {
    const [kind, amount, hours] = def.buff;
    addBuff(g.buffs, kind, amount, stamp(dayIndex(g.cal), g.cal.minutes) + hours * 60);
    g.toast('toast_buff', { buff: t(`buff_${kind}`), h: hours }, `icon_${s.id}`);
  }
}

/** Learn a dish from one of Okiku's recipe scrolls. */
export function learnRecipe(g, slot) {
  const s = g.inventory.slots[slot], dish = itemDef(s.id).dish;
  if (g.recipes.includes(dish)) { g.sfx('deny'); g.toast('recipe_known'); return; }
  g.recipes.push(dish);
  g.inventory.takeFrom(slot, 1);
  g.sfx('harvest');
  g.toast('recipe_learned', { dish: itemDef(dish).name }, `icon_${dish}`);
}

export function openCooking(g) {
  g.sfx('ui');
  g.modals.push(new CookMenu(g));
}

/** Bowing to a Jizō: respect, once a day. */
export function bow(g) {
  g.say('jizo_bow');
  const key = `bow_${dayIndex(g.cal)}`;
  if (g.flags[key]) return;
  for (const k of Object.keys(g.flags)) if (k.startsWith('bow_')) delete g.flags[k];
  g.flags[key] = true;
  g.addVirtue('rei', 1);
}

export function openNotice(g) {
  refresh(g.requests, g.seed, dayIndex(g.cal), g.seasonId);
  g.sfx('ui');
  g.modals.push(new NoticeMenu(g));
}

export function openMailbox(g) {
  if (!g.mail.inbox.length) { g.say('mail_empty'); return; }
  g.sfx('ui');
  g.modals.push(new MailMenu(g));
}

export function openAltar(g, altar) {
  g.sfx('ui');
  g.modals.push(new OfferingMenu(g, altar));
}

/** An altar is complete: a part of the valley is restored (flag, effect, and a short scene). */
export function restore(g, altar) {
  const r = RESTORATIONS[altar];
  g.flags[`restored_${r.id}`] = true;
  r.apply?.(g);
  g.modals.push(new Cutscene(g, r.script));
}
