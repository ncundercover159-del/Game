// App shell (M1): renderer, input, touch controls and a test-drive session.
import { Renderer } from '../render/renderer.js';
import { QualityGovernor } from './quality.js';
import { InputManager } from './input.js';
import { TouchControls } from '../ui/touchControls.js';
import { Loop } from './loop.js';
import { LocalSession } from './session.js';
import { RaceStage } from '../render/raceStage.js';
import { settings } from './settings.js';
import { KART } from '@shared/config.js';

export class App {
  constructor(gameEl, uiEl) {
    this.gameEl = gameEl;
    this.uiEl = uiEl;
    this.quality = new QualityGovernor();
    this.renderer = new Renderer(gameEl, this.quality);
    this.input = new InputManager();
    this.touch = new TouchControls(uiEl);
    this.input.attachTouch(this.touch);
    this.loop = new Loop((dt, t) => this.frame(dt, t), this.quality);
    this.session = null;
    this.stage = null;
    this.lastInput = { steer: 0, btn: 0 };
    this.params = new URLSearchParams(location.search);
  }

  async start() {
    this.dev = document.createElement('div');
    this.dev.className = 'dev-panel';
    this.uiEl.appendChild(this.dev);
    this.banner = document.createElement('div');
    this.banner.style.cssText = 'position:absolute;left:0;right:0;top:30%;text-align:center;font-family:var(--font-display);font-size:90px;-webkit-text-stroke:4px #1a1426;paint-order:stroke fill;color:#ffd23f;pointer-events:none;text-shadow:0 6px 0 #1a1426';
    this.uiEl.appendChild(this.banner);
    window.addEventListener('keydown', (e) => { if (e.code === 'KeyR') this.startTestDrive(); });
    this.startTestDrive();
    this.touch.setVisible(true);
    document.getElementById('boot')?.classList.add('gone');
    this.loop.start();
  }

  startTestDrive() {
    this.stage?.dispose();
    const p = this.params;
    this.session = new LocalSession({
      trackId: p.get('track') || 'test_plane',
      mode: 'freeplay',
      laps: 3,
      classId: p.get('cc') || '150cc',
      entrants: [{ id: 'p1', racerId: p.get('racer') || 'draxo', vehicleId: p.get('kart') || 'ember_roadster', wheelsId: 'standard', gliderId: 'sky_wing', human: true }],
      localId: 'p1',
    });
    this.session.inputFn = () => this.lastInput;
    this.session.onEvents = (ev) => this.onEvents(ev);
    this.stage = new RaceStage(this.renderer, this.session);
  }

  onEvents(ev) {
    this.stage?.handleEvents(ev);
    for (const e of ev) {
      if (e.type === 'countdown') this.flash(String(e.n));
      if (e.type === 'go') this.flash('GO!');
      if (e.type === 'startBoost') this.flash('ROCKET START!', 26);
      if (e.type === 'burnout') this.flash('Too early!', 30);
    }
  }

  flash(text, size = 90) {
    this.banner.textContent = text;
    this.banner.style.fontSize = size + 'px';
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => { this.banner.textContent = ''; }, 800);
  }

  frame(dt) {
    this.lastInput = this.input.sample();
    if (this.session) this.session.update(dt);
    if (this.stage) {
      this.stage.update(dt, this.lastInput);
      this.stage.render();
    }
    const k = this.session?.localKart();
    if (k && (this.params.has('dev') || settings().showFps || true)) {
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
