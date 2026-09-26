// Progression: auto-unlocks (races/treasures/cups/classes), achievements with
// coin rewards, the coin Shop, the Profile card and the Daily Challenge.
import { h, button, uiSound } from '../ui/ui.js';
import { topbar, coinsBadge, unlockText, racerCard } from '../ui/screens.js';
import { fmtTime } from '../ui/hud.js';
import { ICONS } from '../ui/icons.js';
import { getData, listOf, getTrackDef, getRacer } from '@shared/data/registry.js';
import { CLASSES } from '@shared/config.js';
import { makeRng, hashString } from '@shared/math.js';
import { getProfile, updateProfile, isUnlocked, unlock, addCoins, bumpStat } from '../core/profile.js';
import { buildField } from '../core/grandprix.js';

const KINDS = [['racers', 'Racers'], ['vehicles', 'Karts & Bikes'], ['wheels', 'Wheels'], ['gliders', 'Gliders']];
const MAIN_CUPS = ['skyland', 'molten', 'haunted', 'gearworks'];
const cupTrophies = (p, cup) => Object.entries(p.trophies).filter(([k]) => k.startsWith(`${cup}:`)).map(([, v]) => v);

// Is an unlock condition met (ignores coin purchases)?
export function conditionMet(u, p = getProfile()) {
  if (!u || u.type === 'default') return true;
  switch (u.type) {
    case 'races': return p.stats.races >= u.count;
    case 'treasures': return Object.keys(p.treasures).length >= u.count;
    case 'cup': return cupTrophies(p, u.cup).some((t) => !u.trophy || t === u.trophy || (u.trophy === 'silver' && t === 'gold'));
    case 'goldAll': return MAIN_CUPS.every((c) => cupTrophies(p, c).includes('gold'));
    case 'achievement': return !!p.achievements[u.id];
    default: return false;
  }
}

// Unlock everything whose condition is now met. Returns display names of new unlocks.
export function checkUnlocks() {
  const p = getProfile();
  const out = [];
  for (const [kind, label] of KINDS) {
    for (const def of listOf(kind)) {
      if (!def.unlock || def.unlock.type === 'default' || def.unlock.type === 'coins') continue;
      if (!isUnlocked(kind, def) && conditionMet(def.unlock, p) && unlock(kind, def.id)) out.push(`${def.name} (${label.replace(/s$/, '')})`);
    }
  }
  for (const cup of getData().cups) {
    if (cup.unlock && cup.unlock.type !== 'default' && !p.unlocked.tracks.includes(cup.id) && conditionMet(cup.unlock, p) && unlock('tracks', cup.id)) out.push(cup.name);
  }
  // classes: Mirror after gold in every 150cc cup, 200cc after gold in every Mirror cup
  const goldIn = (cls) => MAIN_CUPS.every((c) => p.trophies[`${c}:${cls}`] === 'gold');
  if (goldIn('150cc') && unlock('classes', 'mirror')) out.push('Mirror class');
  if (goldIn('mirror') && unlock('classes', '200cc')) out.push('200cc class');
  return out;
}

// --- achievements ------------------------------------------------------------------------
export function achievementProgress(a, p = getProfile()) {
  const c = a.check;
  let cur = 0, target = 1;
  if (c.stat) { cur = p.stats[c.stat] || 0; target = c.gte; }
  else if (c.trophies) { cur = Object.values(p.trophies).filter((t) => t === c.trophies).length; target = c.gte; }
  else if (c.goldCups) { cur = MAIN_CUPS.filter((cup) => cupTrophies(p, cup).includes('gold')).length; target = c.goldCups; }
  else if (c.trophyClass) { cur = Object.entries(p.trophies).some(([k, v]) => k.endsWith(`:${c.trophyClass}`) && v === 'gold') ? 1 : 0; }
  else if (c.treasures) { cur = Object.keys(p.treasures).length; target = c.treasures; }
  else if (c.medals) { cur = Object.values(p.medals).filter((m) => c.medals === 'any' || m === c.medals).length; target = c.gte; }
  else if (c.unlockedAll) { const all = listOf(c.unlockedAll); cur = all.filter((d) => isUnlocked(c.unlockedAll, d)).length; target = all.length; }
  else if (c.dailyStreak) { cur = p.daily.streak || 0; target = c.dailyStreak; }
  return { cur: Math.min(cur, target), target, done: cur >= target };
}

export function checkAchievements() {
  const p = getProfile();
  const got = [];
  for (const a of getData().achievements || []) {
    if (p.achievements[a.id]) continue;
    if (achievementProgress(a, p).done) {
      updateProfile((pp) => { pp.achievements[a.id] = Date.now(); });
      addCoins(a.reward || 0);
      got.push(a);
    }
  }
  return got;
}

// --- daily challenge -----------------------------------------------------------------------
export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dailyChallenge(key = todayKey()) {
  const rng = makeRng(hashString(`daily:${key}`));
  const tracks = Object.values(getData().tracks).filter((t) => !t.dev && !t.remixOf && MAIN_CUPS.includes(t.cup));
  const track = tracks[Math.floor(rng() * tracks.length)];
  const racers = listOf('racers');
  const racer = racers[Math.floor(rng() * racers.length)];
  const classId = rng() < 0.5 ? '100cc' : '150cc';
  const goals = [
    { type: 'place', n: 1 + Math.floor(rng() * 3), text: (g) => `Finish in the top ${g.n}` },
    { type: 'coins', n: 7 + Math.floor(rng() * 4), text: (g) => `Finish with at least ${g.n} coins` },
    { type: 'noHit', n: 6, text: () => 'Finish top 6 without getting hit' },
    { type: 'mt', n: 10 + Math.floor(rng() * 8), text: (g) => `Fire ${g.n}+ mini-turbos and finish` },
  ];
  const goal = goals[Math.floor(rng() * goals.length)];
  return { key, trackId: track?.id, racerId: racer?.id, classId, goal: { type: goal.type, n: goal.n }, text: goal.text(goal), reward: 150 };
}

function dailyPassed(ch, k, stats) {
  if (!k?.finished || k.estimated) return false;
  switch (ch.goal.type) {
    case 'place': return k.place <= ch.goal.n;
    case 'coins': return k.coins >= ch.goal.n;
    case 'noHit': return k.place <= ch.goal.n && (stats.hits || 0) === 0;
    case 'mt': return (stats.mts || 0) >= ch.goal.n;
    default: return false;
  }
}

// --- screens --------------------------------------------------------------------------------
class ShopScreen {
  constructor() { this.tab = 'racers'; }
  build() {
    const p = getProfile();
    const items = listOf(this.tab).filter((d) => d.unlock && d.unlock.type !== 'default');
    const tabs = h('div.tabs', KINDS.map(([id, label]) => button(label, () => { this.tab = id; this.rerender(); }, id === this.tab ? 'on' : '')));
    const list = h('div.shop-list', items.length ? items.map((d) => {
      const owned = isUnlocked(this.tab, d);
      const u = d.unlock;
      let action;
      if (owned) action = h('span.owned', '✔ Owned');
      else if (u.type === 'coins') {
        action = button(`${ICONS.coin} ${u.cost}`, () => {
          if (getProfile().coins < u.cost) { this.app.audio?.play('error'); return this.app.toast(`Need ${u.cost - getProfile().coins} more coins`); }
          addCoins(-u.cost);
          unlock(this.tab, d.id);
          this.app.audio?.play('purchase');
          this.app.toast(`Unlocked ${d.name}!`);
          this.rerender();
        }, p.coins >= u.cost ? 'green' : 'alt');
      } else action = h('span.small.locked', `🔒 ${unlockText(u)}`);
      const pic = this.tab === 'racers' ? racerCard(d, {}) : h('div.shop-ic', d.name.slice(0, 1));
      return h(`div.shop-row${owned ? '.own' : ''}`, pic, h('div.shop-info', h('b', d.name), h('small', d.tagline || d.desc || d.type || '')), action);
    }) : h('div.small', 'Everything here is free!'));
    return h('div.dim-bg.shop', topbar(this, 'Shop', [coinsBadge()]), tabs, list);
  }
  rerender() { const n = this.build(); this.el.replaceChildren(...n.childNodes); }
  enter() { this.app.showMenuStage('title'); }
}

class ProfileScreen {
  build() {
    const p = getProfile();
    const s = p.stats;
    const nameIn = h('input.text-in', { value: p.name, maxlength: 16, onchange: () => updateProfile((pp) => { pp.name = nameIn.value.trim().slice(0, 16) || 'Racer'; }) });
    const stat = (label, v) => h('tr', h('td', label), h('td', String(v)));
    const cls = ['50cc', '100cc', '150cc', 'mirror', '200cc'];
    const icon = { gold: '🥇', silver: '🥈', bronze: '🥉' };
    const trophies = h('table.rtable.trophies', h('tr', h('td', ''), cls.map((c) => h('td', { '50cc': '50', '100cc': '100', '150cc': '150', mirror: 'M', '200cc': '200' }[c]))),
      getData().cups.map((cup) => h('tr', h('td', cup.name.replace(' Cup', '')), cls.map((c) => h('td', icon[p.trophies[`${cup.id}:${c}`]] || '·')))));
    const medals = Object.entries(p.medals).map(([id, m]) => `${icon[m]} ${getTrackDef(id)?.name || id}`);
    const ach = (getData().achievements || []).map((a) => {
      const pr = achievementProgress(a, p);
      const done = !!p.achievements[a.id];
      return h(`div.ach${done ? '.done' : ''}`, h('span.ic', a.icon), h('div', h('b', a.name), h('small', `${a.desc} · ${done ? 'Done!' : `${Math.floor(pr.cur)}/${pr.target}`} · ${a.reward}🪙`)));
    });
    const doneN = Object.keys(p.achievements).length;
    return h('div.dim-bg.profile', topbar(this, 'Profile', [coinsBadge()]),
      h('div.profile-grid',
        h('div.panel', h('h2', 'Racer card'), nameIn,
          h('table.rtable', stat('Races', s.races), stat('Wins', s.wins), stat('Podiums', s.podiums), stat('Grand Prix', s.gpCompleted),
            stat('Mini-turbos', s.miniTurbos), stat('Tricks', s.tricks), stat('Items hit', s.hitsLanded), stat('Coins collected', s.coinsCollected),
            stat('Distance', `${(s.distance / 1000).toFixed(1)} km`), stat('Treasures', Object.keys(p.treasures).length), stat('Battles won', s.battleWins))),
        h('div.panel', h('h2', 'Trophies'), trophies, h('h2', 'Time trial medals'), h('div.small', medals.length ? medals.join(' · ') : 'Beat staff ghosts in Time Trial to earn medals.')),
        h('div.panel.achs', h('h2', `Achievements ${doneN}/${(getData().achievements || []).length}`), h('div.ach-list', ach))));
  }
  enter() { this.app.showMenuStage('title'); }
}

class DailyScreen {
  build() {
    const ch = dailyChallenge();
    const p = getProfile();
    const done = p.daily.lastDate === ch.key;
    const def = getTrackDef(ch.trackId);
    const racer = getRacer(ch.racerId);
    return h('div.dim-bg.daily', topbar(this, 'Daily Challenge', [coinsBadge()]),
      h('div.online-grid',
        h('div.panel', h('h2', `Today · ${ch.key}`),
          h('div.daily-goal', ch.text),
          h('div', `Track: ${def?.name} · ${CLASSES[ch.classId].label}`),
          h('div', `Racer: ${racer?.name} (loaned for the day)`),
          h('div.small', `Reward ${ch.reward} coins + ${Math.min(7, (p.daily.streak || 0) + 1) * 10} streak bonus`),
          done ? h('div.daily-done', '✔ Completed today — come back tomorrow!') : button('Go!', () => this.app.startDaily(ch), 'big green fight')),
        h('div.panel', h('h2', 'Streak'), h('div.streak', `🔥 ${p.daily.streak || 0} day${p.daily.streak === 1 ? '' : 's'}`),
          h('div.small', 'Complete a challenge on consecutive days to grow your streak bonus.'))));
  }
  enter() { this.app.showMenuStage('title'); }
}

export function installProgression(App) {
  const P = App.prototype;
  P.checkUnlocks = function () { return checkUnlocks(); };
  P.openShop = function (m) { m.push(new ShopScreen()); };
  P.openProfile = function (m) { m.push(new ProfileScreen()); };
  P.openDaily = function (m) { m.push(new DailyScreen()); };

  // after every race / battle / time trial: unlocks + achievements
  P.checkProgress = function () {
    for (const u of checkUnlocks()) { this.toast(`🔓 Unlocked: ${u}`); this.audio?.play('unlock'); }
    for (const a of checkAchievements()) { this.toast(`${a.icon} Achievement: ${a.name} (+${a.reward}🪙)`); this.audio?.play('unlock'); }
  };
  P.onRaceFinished = function (session) {
    if (this.flow?.mode === 'daily') {
      const ch = this.flow.challenge;
      const k = session.localKart();
      if (dailyPassed(ch, k, this.raceStats || {})) {
        const p = getProfile();
        const yesterday = todayKey(new Date(Date.now() - 86400000));
        const streak = p.daily.lastDate === yesterday ? (p.daily.streak || 0) + 1 : 1;
        const bonus = Math.min(7, streak) * 10;
        updateProfile((pp) => { pp.daily.lastDate = ch.key; pp.daily.streak = streak; });
        addCoins(ch.reward + bonus);
        bumpStat('dailies');
        setTimeout(() => this.toast(`📅 Daily complete! +${ch.reward + bonus} coins · streak ${streak}`), 600);
      } else setTimeout(() => this.toast(`Daily not completed: ${ch.text}. Try again!`), 600);
    }
    setTimeout(() => this.checkProgress(), 1200);
  };
  P.startDaily = function (ch) {
    const sel = getProfile().selection;
    const player = { racerId: ch.racerId, vehicleId: sel.vehicleId, wheelsId: sel.wheelsId, gliderId: sel.gliderId, name: getProfile().name || 'You' };
    const field = buildField(player, { count: 12, seed: hashString(ch.key) % 100000 });
    this.startRace({ trackId: ch.trackId, classId: ch.classId, laps: 3, mode: 'race', items: true, entrants: field, localId: 'p1', intro: true });
    this.flow = { mode: 'daily', challenge: ch };
  };
}
