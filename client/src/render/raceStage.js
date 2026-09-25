// RaceStage: the 3D scene for a race/battle session. Reads interpolated kart
// states from the session each frame and turns sim events into visuals.
import * as THREE from 'three';
import { Sky } from './sky.js';
import { THEMES } from './themes.js';
import { ArenaView } from './arenaView.js';
import { TrackView } from './trackView.js';
import { KartView } from './kartView.js';
import { ChaseCamera } from './camera.js';
import { Effects } from './particles.js';
import { ScreenFx } from './speedLines.js';
import { updateLighting } from './toyMaterial.js';
import { BTN } from '@shared/physics/input.js';
import { RACE } from '@shared/config.js';
import { smoothstep } from '@shared/math.js';

export class RaceStage {
  constructor(renderer, session, opts = {}) {
    this.renderer = renderer;
    this.session = session;
    this.opts = opts;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(68, renderer.aspect, 0.2, 1400);
    this.chase = new ChaseCamera(this.camera);
    const def = session.def;
    const theme = { ...(THEMES[def.theme] || THEMES.skyland), ...(def.look || {}) };
    this.theme = theme;
    this.scene.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);
    this.sky = new Sky(this.scene, theme);
    this.sunDir = new THREE.Vector3(...(theme.sunDir || [0.4, 0.6, 0.3])).normalize();
    const sun = new THREE.DirectionalLight(theme.light, theme.lightIntensity ?? 2);
    sun.position.copy(this.sunDir).multiplyScalar(100);
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(theme.hemiSky, theme.hemiGround, 1.4));
    this.fx = new Effects(this.scene);
    this.fx.setBudget(renderer.quality.q.particles);
    this.fx.setViewport(renderer.gl.getDrawingBufferSize(new THREE.Vector2()).y);
    this.screenFx = new ScreenFx();
    this.scene.add(this.screenFx.mesh);

    if (session.world.type === 'arena') this.worldView = new ArenaView(this.scene, session.world);
    else this.worldView = new TrackView(this.scene, session.world, { quality: renderer.quality.q });

    this.kartViews = new Map();
    const outlines = renderer.quality.q.outlines;
    for (const k of session.karts) {
      const kv = new KartView(this.scene, k.entrant, this.fx, { outlines, local: k.id === session.localId });
      this.kartViews.set(k.id, kv);
    }
    this.t = 0;
    this.focusId = session.localId;
    const lk = session.localKart();
    if (lk) this.chase.snap(lk);
    this.unsubQ = renderer.quality.onChange((q) => {
      this.fx.setBudget(q.particles);
      this.fx.setViewport(renderer.gl.getDrawingBufferSize(new THREE.Vector2()).y, this.chase.baseFov);
      for (const kv of this.kartViews.values()) {
        if (kv.veh.outline) kv.veh.outline.visible = q.outlines;
        if (kv.fig?.outline) kv.fig.outline.visible = q.outlines;
      }
    });
    renderer.onResize = () => {
      this.camera.aspect = renderer.aspect;
      this.chase.setAspect(renderer.aspect);
      this.camera.updateProjectionMatrix();
      this.fx.setViewport(renderer.gl.getDrawingBufferSize(new THREE.Vector2()).y, this.chase.baseFov);
    };
    renderer.onResize();
  }

  handleEvents(events) {
    for (const e of events) {
      const kv = e.id != null ? this.kartViews.get(e.id) : null;
      const local = e.id === this.focusId;
      switch (e.type) {
        case 'miniTurbo': kv?.burst('miniTurbo', e); if (local) this.chase.shake(0.1 * e.tier); break;
        case 'boost': if (e.kind === 'pad' || e.kind === 'shroom' || e.kind === 'start') kv?.burst('boost', e); break;
        case 'mtTier': kv?.burst('mtTier', e); break;
        case 'hit': kv?.burst('hit', e); if (local) this.chase.shake(0.8); break;
        case 'land': kv?.burst('land', e); if (local && e.air > 0.5) this.chase.shake(Math.min(0.5, e.air * 0.3)); break;
        case 'trick': kv?.burst('trick', e); break;
        case 'wallHit': if (local) this.chase.shake(Math.min(0.6, e.impact * 0.04)); break;
        default: break;
      }
    }
  }

  update(dt, input) {
    this.t += dt;
    const s = this.session;
    for (const k of s.karts) {
      const v = s.viewState(k.id);
      if (k.id === this.focusId) v.lookBack = input ? (input.btn & BTN.LOOK) !== 0 : false;
      this.kartViews.get(k.id)?.update(v, dt, this.t);
    }
    const focus = s.viewState(this.focusId);
    if (focus) this.chase.update(focus, dt, { lookBack: focus.lookBack });
    this.updateIntro(focus);
    this.fx.update(dt);
    this.worldView.update?.(dt, this.t, this.camera);
    this.sky.update(this.camera, this.t);
    updateLighting(this.camera, this.sunDir);
    const speed = focus ? Math.abs(focus.speed) : 0;
    this.screenFx.update(dt, {
      amount: focus && focus.boostTime > 0 ? 1 : Math.max(0, (speed - 31) / 10),
      aspect: this.camera.aspect,
      ink: focus ? Math.min(1, focus.ink * 1.5) : 0,
      blind: focus ? Math.min(1, focus.blind * 1.2) : 0,
      damage: 0,
    });
  }

  // Cinematic fly-in before the countdown: sweep along the track to the grid.
  updateIntro(focus) {
    const s = this.session;
    const introLeft = s.phase === 'countdown' ? s.countdown - RACE.countdown : 0;
    const total = s.introTime || 0;
    if (introLeft <= 0 || total <= 0 || !focus) { this.introActive = false; return; }
    this.introActive = true;
    const u = 1 - introLeft / total;
    const w = s.world;
    let pos, look;
    if (w.at) {
      const back = 340 * Math.pow(1 - u, 1.4) + 12;
      const st = w.startS - back;
      const p = w.at(st / w.length, 0);
      const q = w.at((st + 45) / w.length, 0);
      const h = 3 + 34 * Math.pow(1 - u, 2);
      const side = 14 * Math.sin(u * Math.PI);
      pos = { x: p.x + p.rx * side, y: p.y + h, z: p.z + p.rz * side };
      look = { x: q.x, y: q.y + 1, z: q.z };
    } else {
      const a = u * Math.PI * 1.2;
      const r = 90 - 60 * u;
      pos = { x: Math.sin(a) * r, y: 40 - 30 * u, z: Math.cos(a) * r };
      look = { x: 0, y: 0, z: 0 };
    }
    const b = smoothstep(0.82, 1, u);
    const c = this.chase;
    this._ip ??= new THREE.Vector3(); this._il ??= new THREE.Vector3();
    this._ip.set(pos.x, pos.y, pos.z).lerp(c.pos, b);
    this._il.set(look.x, look.y, look.z).lerp(c.look, b);
    this.camera.position.copy(this._ip);
    this.camera.lookAt(this._il);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.unsubQ?.();
    for (const kv of this.kartViews.values()) kv.dispose();
    this.fx.dispose();
    this.worldView.dispose?.();
    this.sky.dispose();
    this.renderer.onResize = null;
  }
}
