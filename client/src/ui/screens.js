// Menu screens. Each screen builds its DOM in build(), and may react in
// enter()/exit()/update(). The App owns flow state (GP, selection, etc).
import { h, button, statBars, uiSound } from './ui.js';
import { ICONS, ELEMENT_GLYPHS, ELEMENT_COLORS } from './icons.js';
import { ITEM_ICONS } from './itemIcons.js';
import { getData, listOf, getRacer, getVehicle, getWheels, getGlider, getTrackDef } from '@shared/data/registry.js';
import { totalStats } from '@shared/physics/stats.js';
import { ITEM_DEFS } from '@shared/sim/items.js';
import { CLASSES, RACE } from '@shared/config.js';
import { getProfile, updateProfile, isUnlocked } from '../core/profile.js';
import { fmtTime, ordinal } from './hud.js';

const backBtn = (screen) => h('button.back-btn', { onclick: () => { uiSound.back(); screen.manager.back(); }, 'aria-label': 'Back' }, h('span', { html: ICONS.back }));
export const coinsBadge = () => h('div.coins-badge', { html: `${ICONS.coin}<b>${getProfile().coins}</b>` });
export const topbar = (screen, title, extra = []) => h('div.topbar', backBtn(screen), h('h1', title), ...extra);

export function racerCard(r, { selected, locked, onClick } = {}) {
  const img = r.portrait ? h('img', { src: r.portrait, alt: r.name }) : h('div.ph', { html: ELEMENT_GLYPHS[r.element] || '' });
  const el = h(`button.rcard${selected ? '.sel' : ''}${locked ? '.locked' : ''}`, { style: { '--c': ELEMENT_COLORS[r.element] || '#666' }, onclick: onClick }, img, h('div.nm', r.name));
  el.dataset.id = r.id;
  return el;
}

export function unlockText(u) {
  if (!u || u.type === 'default') return 'Available';
  switch (u.type) {
    case 'coins': return `Buy for ${u.cost} coins`;
    case 'cup': return `Win the ${u.cup} cup (${u.trophy || 'any trophy'})`;
    case 'races': return `Finish ${u.count} races`;
    case 'treasures': return `Find ${u.count} treasure chests`;
    case 'achievement': return `Achievement: ${u.id}`;
    case 'goldAll': return 'Gold trophies in every cup';
    default: return 'Locked';
  }
}

// ---------------------------------------------------------------------------
export class TitleScreen {
  build() {
    const el = h('div.title-screen',
      h('div.logo', { html: 'SKY<span>KART</span><small>ELEMENTAL KART RACING</small>' }),
      h('div.tap-start', 'Tap to start'),
      h('div.version', 'v0.9 · all progress is saved on this device'));
    el.addEventListener('pointerdown', () => {
      this.app.audio?.unlock();
      uiSound.confirm();
      this.manager.go(new MainMenu());
    }, { once: true });
    return el;
  }
  enter() { this.app.showMenuStage('title'); this.app.audio?.playMusic('menu'); }
}

export class MainMenu {
  build() {
    const tile = (cls, title, sub, glyph, fn) => h(`button.tile.${cls}`, { onclick: () => { uiSound.click(); fn(); } }, h('span.glyph', { html: ELEMENT_GLYPHS[glyph] || '' }), title, h('small', sub));
    const app = this.app;
    return h('div.main-menu',
      h('div.topbar', h('h1', { html: 'SKY<span style="color:var(--gold)">KART</span>' }), coinsBadge()),
      h('div.menu-grid',
        tile('gp', 'Grand Prix', '4 races · points · trophies', 'magic', () => this.manager.push(new ClassSelect({ next: 'gp' }))),
        tile('vs', 'Versus', 'Custom rules', 'fire', () => this.manager.push(new ClassSelect({ next: 'vs' }))),
        tile('tt', 'Time Trial', 'Beat the ghosts', 'air', () => this.manager.push(new RacerSelect({ next: 'tt', classId: '150cc' }))),
        tile('battle', 'Battle', 'Balloons · Coin Runners', 'dark', () => this.manager.push(new RacerSelect({ next: 'battle', classId: '100cc' }))),
        tile('online', 'Online', 'Room codes · up to 12', 'tech', () => app.openOnline?.() ?? app.toast('Online play needs the game server (npm run server).')),
      ),
      h('div.menu-row',
        button('Garage', () => this.manager.push(new RacerSelect({ next: 'garage' })), 'alt'),
        button('Shop', () => app.openShop?.(this.manager), 'alt'),
        button('Profile', () => app.openProfile?.(this.manager), 'alt'),
        button('Daily', () => app.openDaily?.(this.manager), 'alt'),
        button('Settings', () => app.openSettings?.(this.manager), 'alt'),
        button('Credits', () => app.openCredits?.(this.manager), 'alt'),
      ));
  }
  enter() { this.app.showMenuStage('title'); this.app.audio?.playMusic('menu'); }
  resume() { this.enter(); this.el.querySelector('.coins-badge')?.replaceWith(coinsBadge()); }
  onBack() {}
}

export class ClassSelect {
  constructor(params) { this.params = params; }
  build() {
    const prof = getProfile();
    const choice = (id) => {
      const c = CLASSES[id];
      const locked = !prof.unlocked.classes.includes(id);
      const need = id === 'mirror' ? 'Win gold in every 150cc cup' : id === '200cc' ? 'Win gold in every Mirror cup' : '';
      return h(`button.choice${locked ? '.locked' : ''}`, {
        onclick: () => {
          if (locked) return this.app.toast(`Locked: ${need}`);
          uiSound.confirm();
          this.manager.push(new RacerSelect({ ...this.params, classId: id }));
        },
      }, c.label, h('small', locked ? '🔒 ' + need : { '50cc': 'Relaxed', '100cc': 'Quick', '150cc': 'Fast!', mirror: 'Flipped tracks', '200cc': 'Insane' }[id]));
    };
    return h('div.dim-bg', topbar(this, this.params.next === 'gp' ? 'Grand Prix' : 'Versus'), h('div.choices', ['50cc', '100cc', '150cc', 'mirror', '200cc'].map(choice)));
  }
  enter() { this.app.showMenuStage('title'); }
}

export class RacerSelect {
  constructor(params) { this.params = params; }
  build() {
    this.sel = getProfile().selection.racerId;
    this.grid = h('div.card-grid');
    this.info = h('div.info-panel');
    this.confirm = button('Choose!', () => this.choose(), 'big');
    this.renderGrid();
    return h('div.dim-bg.select-screen', topbar(this, this.params.next === 'garage' ? 'Garage · Racer' : 'Choose your racer', [coinsBadge()]),
      h('div.select-layout', h('div.select-left', this.grid), h('div.select-mid'), h('div.select-right', this.info, this.confirm)));
  }
  renderGrid() {
    this.grid.innerHTML = '';
    for (const r of listOf('racers')) {
      const locked = !isUnlocked('racers', r);
      this.grid.appendChild(racerCard(r, { selected: r.id === this.sel, locked, onClick: () => this.pick(r.id) }));
    }
  }
  pick(id) {
    this.sel = id;
    uiSound.hover();
    this.renderGrid();
    this.showInfo();
    const p = getProfile().selection;
    this.app.menu.showRacer({ racerId: id, vehicleId: p.vehicleId, wheelsId: p.wheelsId, gliderId: p.gliderId });
    this.app.audio?.bark(id, 'select');
  }
  showInfo() {
    const r = getRacer(this.sel);
    const locked = !isUnlocked('racers', r);
    const p = getProfile().selection;
    const stats = totalStats(r, getVehicle(p.vehicleId), getWheels(p.wheelsId), getGlider(p.gliderId));
    const sig = ITEM_DEFS[r.signature];
    this.info.innerHTML = '';
    this.info.append(
      h('h3', h('span.el', { style: { background: ELEMENT_COLORS[r.element] }, html: ELEMENT_GLYPHS[r.element] }), r.name),
      h('div.sub', `${r.element} · ${r.size}`),
      h('p', locked ? '🔒 ' + unlockText(r.unlock) : r.tagline || ''),
      statBars(stats),
      sig ? h('div.sig', h('span.ic', { html: ITEM_ICONS[r.signature] || '' }), `Signature: ${sig.name}`) : null,
    );
    this.confirm.disabled = locked;
  }
  choose() {
    const r = getRacer(this.sel);
    if (!isUnlocked('racers', r)) return;
    updateProfile((p) => { p.selection.racerId = r.id; });
    this.app.menu.react('taunt');
    this.app.audio?.bark(r.id, 'taunt');
    this.manager.push(new KartSelect(this.params));
  }
  enter() {
    this.app.showMenuStage('select');
    this.pick(this.sel);
  }
  resume() { this.enter(); }
}

export class KartSelect {
  constructor(params) { this.params = params; this.tab = 'body'; }
  build() {
    this.list = h('div.part-list');
    this.info = h('div.info-panel');
    this.tabs = h('div.tabs');
    this.renderTabs();
    this.renderList();
    const label = { gp: 'Pick a cup', vs: 'Pick a track', tt: 'Pick a track', battle: 'Pick an arena', garage: 'Done', online: 'Done' }[this.params.next] || 'Next';
    return h('div.dim-bg.select-screen', topbar(this, 'Garage', [coinsBadge()]),
      h('div.select-layout', h('div.select-left', this.tabs, this.list), h('div.select-mid'), h('div.select-right', this.info, button(label, () => this.next(), 'big'))));
  }
  renderTabs() {
    this.tabs.innerHTML = '';
    for (const [id, name] of [['body', 'Kart / Bike'], ['wheels', 'Wheels'], ['glider', 'Glider']]) {
      this.tabs.appendChild(button(name, () => { this.tab = id; this.renderTabs(); this.renderList(); }, id === this.tab ? 'on' : ''));
    }
  }
  renderList() {
    const sel = getProfile().selection;
    const kind = { body: 'vehicles', wheels: 'wheels', glider: 'gliders' }[this.tab];
    const key = { body: 'vehicleId', wheels: 'wheelsId', glider: 'gliderId' }[this.tab];
    this.list.innerHTML = '';
    for (const v of listOf(kind)) {
      const locked = !isUnlocked(kind, v);
      const el = h(`button.part${sel[key] === v.id ? '.sel' : ''}${locked ? '.locked' : ''}`, {
        onclick: () => {
          if (locked) return this.app.toast(`🔒 ${unlockText(v.unlock)}`);
          uiSound.hover();
          updateProfile((p) => { p.selection[key] = v.id; });
          this.renderList();
          this.refresh();
        },
      }, v.name, h('small', v.type ? `${v.type} · ${v.theme || ''}` : locked ? '🔒' : ''));
      this.list.appendChild(el);
    }
    this.refresh();
  }
  refresh() {
    const p = getProfile().selection;
    const stats = totalStats(getRacer(p.racerId), getVehicle(p.vehicleId), getWheels(p.wheelsId), getGlider(p.gliderId));
    this.info.innerHTML = '';
    this.info.append(h('h3', getVehicle(p.vehicleId)?.name), h('div.sub', `${getWheels(p.wheelsId)?.name} wheels · ${getGlider(p.gliderId)?.name}`), statBars(stats));
    this.app.menu.showRacer({ racerId: p.racerId, vehicleId: p.vehicleId, wheelsId: p.wheelsId, gliderId: p.gliderId });
  }
  next() {
    uiSound.confirm();
    if (this.params.onDone) return this.params.onDone();
    const n = this.params.next;
    if (n === 'gp') this.manager.push(new CupSelect(this.params));
    else if (n === 'vs' || n === 'tt') this.manager.push(new TrackSelect(this.params));
    else if (n === 'battle') this.app.openBattleSetup?.(this.manager, this.params);
    else this.manager.go(new MainMenu());
  }
  enter() { this.app.showMenuStage('garage'); this.refresh(); }
  resume() { this.enter(); }
}

export function trackAvailable(id) { return !!getData().tracks[id]; }

export function drawTrackThumb(canvas, id) {
  const def = getTrackDef(id);
  if (!def?.points) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width = 300, H = canvas.height = 150;
  const pts = def.points.map((p) => (Array.isArray(p) ? p : p.p));
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, , z] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
  const s = Math.min((W - 30) / (maxX - minX || 1), (H - 30) / (maxZ - minZ || 1));
  const map = ([x, , z]) => [W / 2 - (x - (minX + maxX) / 2) * s, H / 2 - (z - (minZ + maxZ) / 2) * s];
  ctx.lineJoin = ctx.lineCap = 'round';
  for (const [w, c] of [[14, '#1a1426'], [8, '#ffffff']]) {
    ctx.beginPath();
    pts.concat([pts[0]]).forEach((p, i) => { const [x, y] = map(p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.stroke();
  }
}

export class CupSelect {
  constructor(params) { this.params = params; }
  build() {
    const prof = getProfile();
    const row = h('div.cup-row');
    for (const cup of getData().cups) {
      const nAvail = cup.tracks.filter(trackAvailable).length;
      const avail = nAvail > 0;
      const locked = cup.unlock && !prof.unlocked.tracks.includes(cup.id) && cup.unlock.type !== 'default';
      const tro = prof.trophies[`${cup.id}:${this.params.classId}`];
      const el = h(`button.cup${!avail || locked ? '.locked' : ''}`, {
        style: { '--c': cup.color },
        onclick: () => {
          if (locked) return this.app.toast(`🔒 ${unlockText(cup.unlock)}`);
          if (!avail) return this.app.toast('The tracks in this cup are still under construction.');
          if (nAvail < cup.tracks.length) this.app.toast(`${cup.tracks.length - nAvail} track(s) under construction — shortened cup`);
          uiSound.confirm();
          this.app.startGP({ cupId: cup.id, classId: this.params.classId });
        },
      },
      h('div.glyph', { html: ELEMENT_GLYPHS[cup.icon] || '' }), cup.name,
      h('ol', cup.tracks.map((t) => h(`li${trackAvailable(t) ? '' : '.na'}`, getTrackDef(t)?.name || 'Under construction'))),
      h('div.tro', tro ? { gold: '🥇 Gold', silver: '🥈 Silver', bronze: '🥉 Bronze' }[tro] : '—'));
      row.appendChild(el);
    }
    return h('div.dim-bg', topbar(this, `Grand Prix · ${CLASSES[this.params.classId].label}`), row);
  }
  enter() { this.app.showMenuStage('title'); }
}

export class TrackSelect {
  constructor(params) { this.params = params; }
  build() {
    const grid = h('div.track-grid');
    const prof = getProfile();
    for (const cup of getData().cups) {
      for (const id of cup.tracks) {
        const def = getTrackDef(id);
        const c = h('canvas');
        const best = prof.bestTimes[id];
        const el = h(`button.tcard${def ? '' : '.na'}`, {
          style: { '--c': cup.color },
          onclick: () => {
            if (!def) return this.app.toast('This track is still under construction.');
            uiSound.confirm();
            if (this.params.next === 'tt') this.app.openTimeTrialSetup?.(this.manager, id) ?? this.app.startTimeTrial({ trackId: id });
            else this.app.openVersusRules?.(this.manager, { ...this.params, trackId: id }) ?? this.app.startVersus({ ...this.params, trackId: id });
          },
        }, c, def?.name || 'Under construction', best ? h('div', { style: { fontSize: '11px', opacity: 0.85 } }, `Best ${fmtTime(best.time)}`) : null);
        if (def) drawTrackThumb(c, id);
        grid.appendChild(el);
      }
    }
    return h('div.dim-bg', topbar(this, this.params.next === 'tt' ? 'Time Trial · Track' : 'Versus · Track'), grid);
  }
  enter() { this.app.showMenuStage('title'); }
}

// ---------------------------------------------------------------------------
export class ResultsScreen {
  // params: { race, gp, gained, onNext, nextLabel, localId }
  constructor(params) { this.params = params; }
  build() {
    const { race, gp, gained, localId } = this.params;
    const row = (k, i, pts) => {
      const r = getRacer(k.racerId);
      const tr = h(`tr${k.id === localId ? '.me' : ''}`, { style: { animationDelay: `${i * 0.05}s` } },
        h('td', `${k.place ?? i + 1}`),
        h('td', h('span.el', { style: { color: ELEMENT_COLORS[r?.element] }, html: ELEMENT_GLYPHS[r?.element] || '' }), k.id === localId ? `${k.name} (You)` : k.name),
        h('td', race.mode === 'battle'
          ? (race.battle?.variant === 'coins' ? `🪙 ${k.coins}` : `🎈 ${k.balloons ?? 0} · ${k.score ?? 0} pops`)
          : k.finishTime !== undefined ? fmtTime(k.finishTime) + (k.estimated ? '*' : '') : ''),
        h('td.pts', pts !== undefined ? `+${pts}` : ''));
      return tr;
    };
    const left = h('div.panel', h('h2', race.mode === 'battle' ? 'Battle results' : 'Race results'), h('table.rtable', (race.ranked || race.karts).map((k, i) => row(k, i, gained?.[k.id]))));
    const panels = [left];
    if (!gp && race.karts.some((k) => k.team !== undefined)) {
      const pts = [0, 0];
      for (const k of race.karts) if (k.team !== undefined) pts[k.team] += RACE.points[(k.place || 12) - 1] || 0;
      const win = pts[0] === pts[1] ? 'Draw!' : pts[0] > pts[1] ? 'Red team wins!' : 'Blue team wins!';
      panels.push(h('div.panel', h('h2', win), h('div.team-score', h('span', { style: { color: '#ff4f4f' } }, `Red ${pts[0]}`), ' – ', h('span', { style: { color: '#3d8bff' } }, `Blue ${pts[1]}`))));
    }
    if (gp) {
      const st = gp.standings();
      panels.push(h('div.panel', h('h2', `Standings · Race ${gp.index}/${gp.tracks.length}`),
        h('table.rtable', st.map((e, i) => h(`tr${e.id === localId ? '.me' : ''}`, { style: { animationDelay: `${0.4 + i * 0.05}s` } },
          h('td', `${i + 1}`), h('td', e.name + (e.human ? ' (You)' : '')), h('td', ''), h('td.pts', `${e.points}`))))));
    } else {
      const me = race.karts.find((k) => k.id === localId);
      if (me) panels.push(h('div.panel', h('h2', 'Your race'), h('table.rtable',
        (me.lapTimes || []).map((t, i) => h('tr', h('td', `L${i + 1}`), h('td', 'Lap time'), h('td', ''), h('td', fmtTime(t)))),
        h('tr', h('td', '🪙'), h('td', 'Coins'), h('td', ''), h('td', `${me.coins}`)),
        h('tr', h('td', '🎯'), h('td', 'Items hit'), h('td', ''), h('td', `${me.hitsLanded || 0}`)))));
    }
    return h('div.dim-bg',
      h('div.topbar', h('h1', gp ? `${gp.cup?.name || 'Grand Prix'}` : 'Results')),
      h('div.results', panels),
      h('div.bottom-bar', ...(this.params.extraButtons || []), button(this.params.nextLabel || 'Continue', () => this.params.onNext(), 'big')));
  }
  onBack() {}
}

export class PodiumScreen {
  constructor(params) { this.params = params; }
  build() {
    const { trophy, gp } = this.params;
    const label = trophy ? { gold: 'GOLD TROPHY!', silver: 'Silver trophy!', bronze: 'Bronze trophy!' }[trophy] : 'Better luck next time!';
    return h('div.podium-screen',
      h('div.headline', `${gp.cup?.name} · ${CLASSES[gp.classId]?.label}`),
      h('div', trophy ? h('div.trophy', { gold: '🏆', silver: '🥈', bronze: '🥉' }[trophy]) : null, h('div.headline', { style: { fontSize: '30px' } }, label),
        this.params.reward ? h('div', { style: { textAlign: 'center', fontWeight: 700 } }, `+${this.params.reward} coins`) : null,
        ...(this.params.unlocks || []).map((u) => h('div', { style: { textAlign: 'center', fontWeight: 700, color: 'var(--gold)' } }, `Unlocked: ${u}`))),
      h('div.bottom-bar', button('Continue', () => this.params.onNext(), 'big')));
  }
  enter() {
    const st = this.params.gp.standings().slice(0, 3);
    this.app.showMenuStage('podium', { entrants: st });
  }
  onBack() {}
}

export class PauseScreen {
  constructor(params) { this.params = params; }
  build() {
    const p = this.params;
    return h('div.pause-screen', h('div.panel', h('h2', 'Paused'),
      button('Resume', () => p.onResume(), 'big'),
      p.onRestart ? button('Restart', () => p.onRestart(), 'alt') : null,
      button('Settings', () => p.onSettings?.(), 'alt'),
      button('Quit', () => p.onQuit(), 'pink')));
  }
  onBack() { this.params.onResume(); }
}

export { ordinal };
