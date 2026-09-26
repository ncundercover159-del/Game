// App shell: renderer, input, audio, menus (screens + 3D menu stage) and races.
import { Renderer } from '../render/renderer.js';
import { QualityGovernor } from './quality.js';
import { InputManager } from './input.js';
import { TouchControls } from '../ui/touchControls.js';
import { Loop } from './loop.js';
import { LocalSession } from './session.js';
import { RaceStage } from '../render/raceStage.js';
import { MenuStage } from '../render/menuStage.js';
import { Hud, fmtTime, ordinal } from '../ui/hud.js';
import { ScreenManager, h } from '../ui/ui.js';
import { TitleScreen, MainMenu, ResultsScreen, PodiumScreen, PauseScreen } from '../ui/screens.js';
import { settings } from './settings.js';
import { haptic, HAPTICS } from './haptics.js';
import { GrandPrix, buildField } from './grandprix.js';
import { getProfile, updateProfile, addCoins, recordTrophy, bumpStat } from './profile.js';
import { KART, RACE, CLASSES, PROGRESSION } from '@shared/config.js';
import { ITEM_ICONS } from '../ui/itemIcons.js';
import { PortraitRenderer } from '../render/portraits.js';
import { NetClient } from '../net/client.js';
import { NetSession } from '../net/netSession.js';
import { OnlineMenu, LobbyScreen } from '../ui/online.js';
import { listOf } from '@shared/data/registry.js';
import '@shared/track/track.js';
import { installTimeTrial } from '../modes/timeTrial.js';
import { installBattle } from '../modes/battle.js';
import { installProgression } from '../modes/progression.js';
import { installSettings } from '../ui/settingsScreen.js';
import { installVersus } from '../modes/versus.js';
import { initAccessibility } from './accessibility.js';

export class App {
  constructor(gameEl, uiEl) {
    this.gameEl = gameEl;
    this.uiEl = uiEl;
    this.quality = new QualityGovernor();
    this.renderer = new Renderer(gameEl, this.quality);
    this.input = new InputManager();
    this.input.onPause = () => this.togglePause();
    this.hud = new Hud(uiEl);
    this.hud.setVisible(false);
    this.hud.onPause = () => this.togglePause();
    this.touch = new TouchControls(uiEl);
    this.input.attachTouch(this.touch);
    this.hud.onItemIcon = (html) => this.touch.setItemIcon(html);
    this.screens = new ScreenManager(uiEl, this);
    this.loop = new Loop((dt, t) => this.frame(dt, t), this.quality);
    this.session = null;
    this.stage = null;
    this.menu = null;
    this.mode = 'boot';
    this.lastInput = { steer: 0, btn: 0 };
    this.params = new URLSearchParams(location.search);
    this.devMode = this.params.has('dev');
    this.audio = null;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.mode === 'menu') this.screens.back();
      if (this.mode === 'race' && this.stage?.spectating && (e.code === 'ArrowRight' || e.code === 'ArrowLeft')) this.stage.cycleFocus(e.code === 'ArrowRight' ? 1 : -1);
    });
    gameEl.addEventListener('pointerdown', () => { if (this.mode === 'race' && this.stage?.spectating) this.stage.cycleFocus(1); });
  }

  async start() {
    initAccessibility();
    this.fpsEl = h('div.fps');
    this.uiEl.appendChild(this.fpsEl);
    this.dev = h('div.dev-panel', { style: { display: this.devMode ? '' : 'none' } });
    this.uiEl.appendChild(this.dev);
    this.toastEl = h('div.toast');
    this.uiEl.appendChild(this.toastEl);
    try {
      const { AudioManager } = await import('../audio/audio.js');
      this.audio = new AudioManager();
      this.audio.onCaption = (text) => { if (this.mode === 'race') this.hud.caption(text); };
    } catch (e) {
      console.warn('[audio] unavailable', e);
    }
    // render racer portraits once (HUD minimap, select cards, results, lobby)
    try {
      this.portraits = new PortraitRenderer(this.renderer);
      this.portraits.renderAll();
      this.hud.portraits = new Map(listOf('racers').map((r) => [r.id, this.portraits.get(r.id)?.image]));
    } catch (e) {
      console.warn('[portraits] failed, falling back to element glyphs', e);
    }
    document.getElementById('boot')?.classList.add('gone');
    this.loop.start();
    const p = this.params;
    if (p.get('edit')) {
      const { TrackEditor } = await import('../dev/editor.js');
      this.editor = new TrackEditor(this, p.get('edit'));
    } else if (p.get('race') || p.get('track')) {
      // dev shortcut: jump straight into a race
      const trackId = p.get('race') || p.get('track');
      const player = { ...getProfile().selection, racerId: p.get('racer') || getProfile().selection.racerId, name: 'You' };
      const field = p.has('solo') ? [{ ...player, id: 'p1', human: true }] : buildField(player, { count: +(p.get('count') || 12), seed: 5 });
      this.flow = { mode: 'versus' };
      this.startRace({ trackId, classId: p.get('cc') || '150cc', laps: +(p.get('laps') || 3), mode: trackId === 'test_plane' ? 'freeplay' : 'race', entrants: field, localId: 'p1', intro: !p.has('nointro') });
    } else {
      this.goMenu(true);
    }
  }

  toast(msg) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.remove('show');
    void this.toastEl.offsetWidth;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => this.toastEl.classList.remove('show'), 2600);
  }

  // ---------------------------------------------------------------------------
  showMenuStage(mode, opts) {
    if (!this.menu) this.menu = new MenuStage(this.renderer);
    this.renderer.onResize = () => this.menu.onResize();
    this.menu.setMode(mode, opts);
  }

  goMenu(title = false) {
    this.endRaceView();
    this.mode = 'menu';
    this.hud.setVisible(false);
    this.touch.setVisible(false);
    if (!this.menu) this.menu = new MenuStage(this.renderer);
    this.renderer.onResize = () => this.menu.onResize();
    this.menu.onResize();
    this.screens.go(title ? new TitleScreen() : new MainMenu());
  }

  endRaceView() {
    this.audio?.endRace();
    this.stage?.dispose();
    this.stage = null;
    this.session?.dispose?.();
    this.session = null;
    this.paused = false;
  }

  // ---------------------------------------------------------------------------
  playerEntrant() {
    const s = getProfile().selection;
    return { racerId: s.racerId, vehicleId: s.vehicleId, wheelsId: s.wheelsId, gliderId: s.gliderId, name: getProfile().name || 'You' };
  }

  startGP({ cupId, classId }) {
    const gp = new GrandPrix({ cupId, classId, player: this.playerEntrant(), seed: Date.now() % 100000, laps: +(this.params.get('laps') || 3) });
    this.flow = { mode: 'gp', gp };
    this.startRace({ ...gp.raceConfig(), intro: true });
  }

  startVersus(cfg) {
    const player = this.playerEntrant();
    const field = buildField(player, { count: cfg.count || 12, seed: Date.now() % 100000 });
    if (cfg.teams) field.forEach((e, i) => { e.team = i % 2; }); // player (index 0) is Red
    if (cfg.difficulty) field.forEach((e) => { if (!e.human) e.difficulty = cfg.difficulty; });
    this.flow = { mode: 'versus', cfg };
    this.startRace({ trackId: cfg.trackId, classId: cfg.classId || '150cc', mirror: CLASSES[cfg.classId]?.mirror, laps: cfg.laps || 3, items: cfg.items !== false, mode: 'race', entrants: field, localId: 'p1', intro: true, teams: cfg.teams });
  }

  startTimeTrial({ trackId }) {
    const player = { ...this.playerEntrant(), id: 'p1', human: true };
    this.flow = { mode: 'tt', trackId };
    this.startRace({ trackId, classId: '150cc', laps: 3, mode: 'timetrial', items: false, entrants: [player], localId: 'p1', intro: true });
  }

  startRace(cfg) {
    this.screens.clear();
    this.endRaceView();
    this.lastRaceCfg = cfg;
    const intro = cfg.intro === false ? 0 : RACE.introTime;
    const session = new LocalSession({
      trackId: cfg.trackId,
      mode: cfg.mode || 'race',
      laps: cfg.laps || 3,
      classId: cfg.classId || '150cc',
      mirror: cfg.mirror || CLASSES[cfg.classId]?.mirror,
      items: cfg.items,
      introTime: intro,
      entrants: cfg.entrants,
      localId: cfg.localId || 'p1',
      seed: cfg.seed || (Date.now() % 100000),
      difficulty: cfg.difficulty,
      battle: cfg.battle,
    });
    const race = session.race;
    if (cfg.mode === 'timetrial') {
      const k = session.localKart();
      k.item = 'shroom3'; k.itemCount = 3;
    }
    const p = this.params;
    session.inputFn = p.has('auto')
      ? () => { const a = race.ai.drive(session.localKart(), 1 / 60); a.btn |= this.lastInput.btn & (8 | 32 | 128 | 256); return a; }
      : () => this.lastInput;
    this.attachSession(session, cfg, intro);
  }

  // Shared by local and online sessions: stage, HUD, controls.
  attachSession(session, cfg, intro) {
    this.session = session;
    this.onSessionCreated?.(session, cfg);
    this.session.onEvents = (ev) => this.onEvents(ev);
    this.stage = new RaceStage(this.renderer, this.session);
    this.stage.onReplay = (on) => { this.hud.el.classList.toggle('replaying', on); this.touch.setVisible(!on); };
    this.mode = 'race';
    this.hud.setWorld(this.session.world);
    this.hud.last = {};
    this.hud.setMode(cfg.mode || 'race');
    this.hud.setVisible(true);
    this.touch.setVisible(true);
    this.touch.reset();
    this.raceEnded = false;
    this.raceStats = { hits: 0, mts: 0 };
    if (intro) this.hud.banner(`<div style="font-size:26px">${this.session.def.name}</div>`, 'title', intro * 1000 - 400);
    this.audio?.startRace(this.session.def);
  }

  // ---------------------------------------------------------------------------
  togglePause() {
    if (this.mode !== 'race' || this.raceEnded) return;
    if (this.paused) return this.resume();
    this.paused = true;
    this.session.paused = true;
    this.touch.setVisible(false);
    this.audio?.pause(true);
    const online = !!this.session.isOnline;
    this.screens.push(new PauseScreen({
      onResume: () => this.resume(),
      onRestart: this.flow?.mode !== 'gp' && !online ? () => this.startRace(this.lastRaceCfg) : null,
      onSettings: () => this.openSettings?.(this.screens),
      onQuit: () => { this.audio?.pause(false); this.session?.leave?.(); this.goMenu(); },
    }));
  }

  resume() {
    this.paused = false;
    if (this.session) this.session.paused = false;
    this.screens.clear();
    this.touch.setVisible(true);
    this.audio?.pause(false);
  }

  // ---------------------------------------------------------------------------
  onEvents(ev) {
    this.stage?.handleEvents(ev);
    this.audio?.onEvents(ev, this.session);
    const me = this.session.localId;
    const hud = this.hud;
    const race = this.session.race;
    for (const e of ev) {
      const mine = e.id === me;
      switch (e.type) {
        case 'countdown': hud.countdown(e.n); break;
        case 'go': hud.countdown(0); break;
        case 'startBoost': if (mine) { hud.banner('ROCKET START!', 'go', 900); haptic(HAPTICS.bigBoost); bumpStat('rocketStarts'); } break;
        case 'burnout': if (mine) hud.banner('Too early!', '', 900); break;
        case 'lap': if (mine) {
          hud.banner(e.final ? 'FINAL LAP!' : `LAP ${e.lap}`, e.final ? 'final' : '', 1500);
          const best = this.flow?.mode === 'tt' ? getProfile().bestTimes[this.session.def.id]?.laps?.[e.lap - 2] : null;
          hud.split(`Lap ${e.lap - 1}: ${fmtTime(e.time)}${best ? ` (${e.time < best ? '-' : '+'}${Math.abs(e.time - best).toFixed(2)})` : ''}`, best ? e.time < best : undefined);
          haptic(HAPTICS.lap);
        } break;
        case 'finish': if (mine) {
          hud.banner(`FINISH!<div style="font-size:30px">${e.place}${ordinal(e.place)} · ${fmtTime(e.time)}</div>`, 'finish', 3200);
          haptic(HAPTICS.lap);
          this.stage?.onLocalFinish?.();
          if (this.stage) this.stage.spectating = true; // tap to watch others while the race finishes
        } break;
        case 'raceEnd': this.onRaceEnd(); break;
        case 'miniTurbo': if (mine) {
          this.raceStats.mts++; haptic(e.tier >= 2 ? HAPTICS.bigBoost : HAPTICS.boost); bumpStat('miniTurbos'); if (e.tier === 3) bumpStat('purpleTurbos'); } break;
        case 'trick': if (mine) bumpStat('tricks'); break;
        case 'hit': if (mine) {
          this.raceStats.hits++; haptic(HAPTICS.hit); bumpStat('timesHit'); } break;
        case 'rescue': if (mine) bumpStat('falls'); break;
        case 'itemHit': {
          const by = e.by != null ? race.kart(e.by) : null;
          const victim = race.kart(e.id);
          if (by && victim && by !== victim) {
            const icon = ITEM_ICONS[e.src] || ITEM_ICONS[{ fire: 'flame', squish: 'star', flail: 'flail', peelThrow: 'peel' }[e.src]] || '';
            hud.tick(`${by.id === me ? '<b>You</b>' : by.name} <span class="ic">${icon}</span> ${victim.id === me ? '<b>You</b>' : victim.name}`, by.id === me ? '#6dff8a' : victim.id === me ? '#ff5a5a' : null);
          }
          break;
        }
        case 'itemReady': if (mine) haptic(HAPTICS.item); break;
        case 'coin': if (mine) haptic(HAPTICS.coin); break;
        case 'cometWarn': if (mine) hud.banner('<span style="color:#9fd0ff">SKY COMET!</span>', '', 1400); break;
        case 'swapWarn': if (mine || e.target === me) hud.banner('<span style="color:#e0a0ff">SWAP SPELL!</span>', '', 1400); break;
        case 'treasure': if (mine) {
          hud.banner('<span style="color:#ffd23f">Treasure found!</span>', '', 1800);
          updateProfile((p) => { p.treasures[this.session.def.id] = true; });
        } break;
        default: break;
      }
    }
  }

  onRaceEnd() {
    if (this.raceEnded) return;
    this.raceEnded = true;
    const me = this.session.localKart();
    // rewards & stats
    const place = me?.place || 12;
    let coins = 0;
    if (this.flow?.mode !== 'tt' && me) {
      coins = (RACE.coinsPerPlace[place - 1] || 0) + (me.coinsTotal || 0) * PROGRESSION.coinsPerRaceCoin;
      addCoins(coins);
    }
    updateProfile((p) => {
      const s = p.stats;
      s.races++;
      if (this.session.isOnline) s.onlineRaces++;
      if (place === 1) s.wins++;
      if (this.flow?.mode === 'battle' && place === 1) s.battleWins++;
      if (place <= 3) s.podiums++;
      s.itemsUsed += me?.itemsUsed || 0;
      s.hitsLanded += me?.hitsLanded || 0;
      s.coinsCollected += me?.coinsTotal || 0;
      s.distance += Math.max(0, me?.raceDist || 0);
      s.racerUse[me?.racerId] = (s.racerUse[me?.racerId] || 0) + 1;
      s.trackUse[this.session.def.id] = (s.trackUse[this.session.def.id] || 0) + 1;
    });
    this.onRaceFinished?.(this.session, { place, coins });
    setTimeout(() => this.showResults(coins), 2300);
  }

  showResults(coins) {
    if (!this.session) return;
    const race = this.session.race;
    this.hud.setVisible(false);
    this.touch.setVisible(false);
    const flow = this.flow || { mode: 'versus' };
    if (flow.mode === 'gp') {
      const gp = flow.gp;
      const results = race.karts.map((k) => ({ id: k.id, place: k.place, time: k.finishTime }));
      const gained = gp.record(results);
      this.screens.go(new ResultsScreen({
        race, gp, gained, localId: this.session.localId,
        nextLabel: gp.finished ? 'Podium!' : 'Next race',
        onNext: () => (gp.finished ? this.showPodium(gp) : this.startRace({ ...gp.raceConfig(), intro: true })),
      }));
    } else if (flow.mode === 'tt') {
      this.onTimeTrialDone?.(this.session);
      this.screens.go(new ResultsScreen({
        race, localId: this.session.localId, nextLabel: 'Menu', onNext: () => this.goMenu(),
        extraButtons: this.timeTrialButtons?.() || [],
      }));
    } else {
      this.screens.go(new ResultsScreen({
        race, localId: this.session.localId, nextLabel: this.session.isOnline ? 'Back to lobby' : 'Menu',
        onNext: () => (this.session?.isOnline ? this.backToLobby?.() : this.goMenu()),
        extraButtons: this.session.isOnline ? [] : [h('button.btn.alt', { onclick: () => this.startRace(this.lastRaceCfg) }, 'Rematch')],
      }));
    }
    if (coins) this.toast(`+${coins} coins`);
  }

  // --- online ---------------------------------------------------------------------
  openOnline() { this.screens.push(new OnlineMenu()); }

  async connectOnline() {
    if (!this.net) {
      this.net = new NetClient();
      this.net.on('welcome', (m) => {
        this.onlineId = m.id;
        if (!m.resumed) { this.lobby = new LobbyScreen(this.net); this.screens.go(this.lobby); }
      });
      this.net.on('start', (m) => this.startOnlineRace(m));
      this.net.on('results', (m) => { this.lastOnlineResults = m.results; });
      this.net.on('room', (m) => {
        if (m.phase === 'lobby' && this.mode === 'race' && this.session?.isOnline && this.raceEnded) this.backToLobby();
      });
    }
    await this.net.connect();
    return this.net;
  }

  startOnlineRace(start) {
    this.screens.clear();
    this.endRaceView();
    this.flow = { mode: 'online' };
    const session = new NetSession(this.net, start);
    session.inputFn = () => this.lastInput;
    this.lastRaceCfg = null;
    this.attachSession(session, { mode: start.mode, battle: start.battle }, 3);
    if (session.spectator) this.toast('Race in progress — spectating until the next one.');
  }

  backToLobby() {
    this.endRaceView();
    this.mode = 'menu';
    this.hud.setVisible(false);
    this.touch.setVisible(false);
    if (!this.menu) this.menu = new MenuStage(this.renderer);
    this.renderer.onResize = () => this.menu.onResize();
    this.lobby = this.lobby || new LobbyScreen(this.net);
    this.lobby.el = null;
    this.screens.go(this.lobby);
  }

  showPodium(gp) {
    const trophy = gp.trophy();
    let reward = 0;
    const unlocks = [];
    if (trophy) {
      reward = PROGRESSION.trophyBonus[trophy];
      addCoins(reward);
      recordTrophy(gp.cup.id, gp.classId, trophy);
      bumpStat('gpCompleted');
      unlocks.push(...(this.checkUnlocks?.() || []));
    }
    this.endRaceView();
    this.mode = 'menu';
    this.screens.go(new PodiumScreen({ gp, trophy, reward, unlocks, onNext: () => this.goMenu() }));
    this.audio?.playMusic(trophy ? 'victory' : 'results');
    setTimeout(() => this.checkProgress?.(), 1500);
  }

  // ---------------------------------------------------------------------------
  frame(dt) {
    this.lastInput = this.input.sample();
    const sh = settings().showFps;
    this.fpsEl.style.display = sh ? '' : 'none';
    if (sh && (this._fpsT = (this._fpsT || 0) + dt) > 0.5) { this._fpsT = 0; this.fpsEl.textContent = `${Math.round(this.renderer.quality.fps)} fps · ${this.renderer.quality.q.name}`; }
    if (this.mode === 'race' && this.session) {
      this.session.update(dt);
      if (this.stage) {
        this.stage.update(this.paused ? 0 : dt, this.lastInput);
        this.stage.render();
      }
      const k = this.session.localKart();
      if (k) {
        this.hud.update(k, this.session.race);
        this.hud.updateItem(k, performance.now() / 1000);
        this.hud.updateWarnings(this.session.itemState?.()?.projectiles, this.session.localId);
        this.hud.drawMinimap(this.session.karts, this.session.localId);
        this.audio?.updateRace(this.session, k, dt);
      }
      if (this.session?.isOnline) this.hud.setNet(this.net?.rtt || 0, this.session.lagging);
      const spec = this.stage?.spectating && this.stage.focusId !== this.session?.localId ? this.session.race.kart(this.stage.focusId)?.name : null;
      this.hud.setSpectate(spec);
      if (!k && this.stage && this.session) {
        const f = this.session.race.kart(this.stage.focusId);
        if (f) { this.hud.update(f, this.session.race); this.hud.drawMinimap(this.session.karts, f.id); }
      }
      if (k && this.devMode) {
        const st = this.renderer.stats();
        const bar = (v, n = 20) => '#'.repeat(Math.round(Math.min(1, v) * n)).padEnd(n, '.');
        this.dev.textContent =
          `speed ${(k.speed * 3.6).toFixed(0).padStart(4)} km/h  surf ${k.surface}  rb ${k.rubberMul.toFixed(3)}\n` +
          `drift ${k.drift ? (k.drift > 0 ? 'R' : 'L') : '-'} tier ${k.driftTier} [${bar(k.driftCharge / KART.mtCharge[2])}]\n` +
          `boost ${k.boostTime.toFixed(2)} ${k.boostKind || ''}  air ${k.grounded ? '-' : k.airTime.toFixed(2)}${k.glider ? ' GLIDE' : ''}\n` +
          `fps ${this.quality.fps.toFixed(0)} q ${this.quality.q.name} calls ${st.calls} tris ${st.tris}`;
      }
    } else if (this.menu) {
      this.menu.update(dt);
      this.menu.render();
      this.screens.update(dt);
    }
  }
}

installTimeTrial(App);
installBattle(App);
installProgression(App);
installSettings(App);
installVersus(App);

export { settings };
