// App shell: renderer, input, touch controls, race sessions and HUD.
// (Menus and screens arrive in M4/M5; for now we boot straight into a race.)
import { Renderer } from '../render/renderer.js';
import { QualityGovernor } from './quality.js';
import { InputManager } from './input.js';
import { TouchControls } from '../ui/touchControls.js';
import { Loop } from './loop.js';
import { LocalSession } from './session.js';
import { RaceStage } from '../render/raceStage.js';
import { Hud, fmtTime, ordinal } from '../ui/hud.js';
import { settings } from './settings.js';
import { haptic, HAPTICS } from './haptics.js';
import { KART, RACE } from '@shared/config.js';
import { ITEM_ICONS } from '../ui/itemIcons.js';
import '@shared/track/track.js';

export class App {
  constructor(gameEl, uiEl) {
    this.gameEl = gameEl;
    this.uiEl = uiEl;
    this.quality = new QualityGovernor();
    this.renderer = new Renderer(gameEl, this.quality);
    this.input = new InputManager();
    this.hud = new Hud(uiEl);
    this.hud.setVisible(false);
    this.touch = new TouchControls(uiEl);
    this.hud.onItemIcon = (html) => this.touch.setItemIcon(html);
    this.input.attachTouch(this.touch);
    this.loop = new Loop((dt, t) => this.frame(dt, t), this.quality);
    this.session = null;
    this.stage = null;
    this.lastInput = { steer: 0, btn: 0 };
    this.params = new URLSearchParams(location.search);
    this.devMode = this.params.has('dev');
  }

  async start() {
    this.dev = document.createElement('div');
    this.dev.className = 'dev-panel';
    this.dev.style.display = this.devMode ? '' : 'none';
    this.uiEl.appendChild(this.dev);
    window.addEventListener('keydown', (e) => { if (e.code === 'KeyR' && this.devMode) this.startRace(); });
    this.startRace();
    document.getElementById('boot')?.classList.add('gone');
    this.loop.start();
  }

  startRace(cfg = {}) {
    this.stage?.dispose();
    this.results?.remove();
    const p = this.params;
    const trackId = cfg.trackId || p.get('track') || 'sky_cloudtop';
    const intro = p.has('nointro') || trackId === 'test_plane' ? 0 : RACE.introTime;
    this.session = new LocalSession({
      trackId,
      mode: trackId === 'test_plane' ? 'freeplay' : 'race',
      laps: +(p.get('laps') || 3),
      classId: p.get('cc') || '150cc',
      introTime: intro,
      entrants: [
        { id: 'p1', racerId: p.get('racer') || 'draxo', vehicleId: p.get('kart') || 'ember_roadster', wheelsId: 'standard', gliderId: 'sky_wing', human: true, name: 'You' },
        ...Array.from({ length: +(p.get('dummies') || 0) }, (_, i) => ({ id: 'd' + i, racerId: 'draxo', vehicleId: 'ember_roadster', wheelsId: 'standard', gliderId: 'sky_wing', name: 'Dummy ' + (i + 1) })),
      ],
      localId: 'p1',
    });
    this.session.inputFn = p.has('auto')
      ? () => { const a = this.autopilot(this.session.localKart()); a.btn |= this.lastInput.btn & ~(1 | 2 | 64); return a; }
      : () => this.lastInput;
    // dev dummies: simple line followers at different lanes/speeds (real AI arrives in M4)
    this.session.stepHooks.push((race) => {
      for (const k of race.karts) {
        if (k.human) continue;
        const idx = +k.id.slice(1);
        const inp = this.autopilot(k, ((idx % 5) - 2) * 0.3);
        if (idx % 3 === 0 && (race.tick % 240) < 120) inp.btn &= ~1;
        race.setInput(k.id, inp);
      }
    });
    this.session.onEvents = (ev) => this.onEvents(ev);
    this.stage = new RaceStage(this.renderer, this.session);
    this.hud.setWorld(this.session.world);
    this.hud.setVisible(true);
    this.hud.last = {};
    this.touch.setVisible(true);
    if (intro) this.hud.banner(`<div style="font-size:26px">${this.session.def.name}</div>`, 'title', intro * 1000 - 400);
  }

  // dev autopilot (pure pursuit on the centre line); replaced by the real AI in M4
  autopilot(k, lane = 0) {
    const w = this.session.world;
    if (!w.at || k.s === undefined) return { steer: 0, btn: 1 };
    const tgt = w.at((k.s + 14 + Math.abs(k.speed) * 0.5) / w.length, lane);
    let d = Math.atan2(tgt.x - k.x, tgt.z - k.z) - k.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return { steer: Math.max(-1, Math.min(1, -d * 2.5)), btn: 1 | 64 };
  }

  onEvents(ev) {
    this.stage?.handleEvents(ev);
    const me = this.session.localId;
    const hud = this.hud;
    for (const e of ev) {
      const mine = e.id === me;
      switch (e.type) {
        case 'countdown': hud.countdown(e.n); break;
        case 'go': hud.countdown(0); break;
        case 'startBoost': if (mine) { hud.banner('ROCKET START!', 'go', 900); haptic(HAPTICS.bigBoost); } break;
        case 'burnout': if (mine) hud.banner('Too early!', '', 900); break;
        case 'lap': if (mine) {
          hud.banner(e.final ? 'FINAL LAP!' : `LAP ${e.lap}`, e.final ? 'final' : '', 1500);
          hud.split(`Lap ${e.lap - 1}: ${fmtTime(e.time)}`);
          haptic(HAPTICS.lap);
        } break;
        case 'finish': if (mine) {
          hud.banner(`FINISH!<div style="font-size:30px">${e.place}${ordinal(e.place)} · ${fmtTime(e.time)}</div>`, 'finish', 3500);
          haptic(HAPTICS.lap);
        } break;
        case 'raceEnd': setTimeout(() => this.showResults(), 1800); break;
        case 'miniTurbo': if (mine) haptic(e.tier >= 2 ? HAPTICS.bigBoost : HAPTICS.boost); break;
        case 'hit': if (mine) haptic(HAPTICS.hit); break;
        case 'itemHit': {
          const by = e.by != null ? this.session.race.kart(e.by) : null;
          const victim = this.session.race.kart(e.id);
          if (by && victim && by !== victim) {
            const icon = ITEM_ICONS[e.src] || ITEM_ICONS[{ fire: 'flame', squish: 'star', flail: 'flail' }[e.src]] || '';
            hud.tick(`${by.id === me ? '<b>You</b>' : by.name} <span class="ic">${icon}</span> ${victim.id === me ? '<b>You</b>' : victim.name}`, by.id === me ? '#6dff8a' : victim.id === me ? '#ff5a5a' : null);
          }
          break;
        }
        case 'itemReady': if (mine) haptic(HAPTICS.item); break;
        case 'coin': if (mine) haptic(HAPTICS.coin); break;
        case 'cometWarn': if (mine) hud.banner('<span style="color:#9fd0ff">SKY COMET!</span>', '', 1400); break;
        case 'swapWarn': if (mine || e.target === me) hud.banner('<span style="color:#e0a0ff">SWAP SPELL!</span>', '', 1400); break;
        case 'treasure': if (mine) hud.banner('<span style="color:#ffd23f">Treasure found!</span>', '', 1800); break;
        default: break;
      }
    }
  }

  showResults() {
    const race = this.session.race;
    const el = document.createElement('div');
    el.className = 'results-lite';
    const rows = (race.ranked || race.karts).map((k) => `<tr class="${k.id === this.session.localId ? 'me' : ''}"><td>${k.place}${ordinal(k.place)}</td><td>${k.name}</td><td>${fmtTime(k.finishTime)}${k.estimated ? '*' : ''}</td></tr>`).join('');
    el.innerHTML = `<div class="panel"><h2>Results</h2><table>${rows}</table><button class="btn big">Race again</button></div>`;
    el.querySelector('button').onclick = () => this.startRace();
    this.uiEl.appendChild(el);
    this.results = el;
  }

  frame(dt) {
    this.lastInput = this.input.sample();
    if (this.session) this.session.update(dt);
    if (this.stage) {
      this.stage.update(dt, this.lastInput);
      this.stage.render();
    }
    const k = this.session?.localKart();
    if (k) {
      this.hud.update(k, this.session.race);
      this.hud.updateItem(k, performance.now() / 1000);
      this.hud.updateWarnings(this.session.itemState?.()?.projectiles, this.session.localId);
      this.hud.drawMinimap(this.session.karts, this.session.localId);
    }
    if (k && this.devMode) {
      const st = this.renderer.stats();
      const bar = (v, n = 20) => '#'.repeat(Math.round(Math.min(1, v) * n)).padEnd(n, '.');
      this.dev.textContent =
        `speed ${(k.speed * 3.6).toFixed(0).padStart(4)} km/h  surf ${k.surface}\n` +
        `drift ${k.drift ? (k.drift > 0 ? 'R' : 'L') : '-'} tier ${k.driftTier} [${bar(k.driftCharge / KART.mtCharge[2])}]\n` +
        `boost ${k.boostTime.toFixed(2)} ${k.boostKind || ''}  air ${k.grounded ? '-' : k.airTime.toFixed(2)}${k.glider ? ' GLIDE' : ''}\n` +
        `fps ${this.quality.fps.toFixed(0)} q ${this.quality.q.name} calls ${st.calls} tris ${st.tris}`;
    }
  }
}

export { settings };
