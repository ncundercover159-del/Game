// RaceStage: the 3D scene for a race/battle session. Reads interpolated kart
// states from the session each frame and turns sim events into visuals.
import * as THREE from 'three';
import { Sky } from './sky.js';
import { THEMES } from './themes.js';
import { ArenaView } from './arenaView.js';
import { TrackView } from './trackView.js';
import { HazardView } from './hazardView.js';
import { ItemView } from './itemView.js';
import { KartView } from './kartView.js';
import { ChaseCamera } from './camera.js';
import { Effects } from './particles.js';
import { ScreenFx } from './speedLines.js';
import { updateLighting } from './toyMaterial.js';
import { BTN } from '@shared/physics/input.js';
import { RACE } from '@shared/config.js';
import { smoothstep } from '@shared/math.js';
import { ghostPose } from '@shared/sim/ghost.js';
import { fakeKart } from './menuStage.js';

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
    this.hazardView = session.world.hazards?.length ? new HazardView(this.scene, session.world, this.fx, theme) : null;

    this.itemView = new ItemView(this.scene, this.fx, { localId: session.localId });
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

  // Time-trial ghost: a translucent kart replaying recorded poses.
  addGhost(ghost, color) {
    const kv = new KartView(this.scene, { racerId: ghost.racer, vehicleId: ghost.vehicle, wheelsId: ghost.wheels, gliderId: ghost.glider }, this.fx, { outlines: false, ghost: true, ghostColor: color });
    kv.shadow.visible = false;
    const g = { ghost, kv, state: fakeKart({ element: kv.element }), prevX: null, prevZ: null };
    (this.ghosts ||= []).push(g);
    return g;
  }

  updateGhosts(dt) {
    const time = this.session.phase === 'countdown' ? 0 : this.session.time;
    for (const g of this.ghosts || []) {
      const st = g.state;
      const p = ghostPose(g.ghost, time, st);
      if (!p) continue;
      st.speed = g.prevX === null || dt <= 0 ? 0 : Math.hypot(st.x - g.prevX, st.z - g.prevZ) / dt;
      g.prevX = st.x; g.prevZ = st.z;
      st.steer = st.drift * 0.6;
      g.kv.root.visible = !p.done || time < 2;
      g.kv.update(st, dt, this.t);
    }
  }

  handleEvents(events) {
    const istate = this.session.itemState?.();
    for (const e of events) {
      if (istate) this.itemView.onEvent(e, istate);
      const kv = e.id != null ? this.kartViews.get(e.id) : null;
      const local = e.id === this.focusId;
      switch (e.type) {
        case 'miniTurbo': kv?.burst('miniTurbo', e); if (local) this.chase.shake(0.1 * e.tier); break;
        case 'boost': if (e.kind === 'pad' || e.kind === 'shroom' || e.kind === 'start') kv?.burst('boost', e); break;
        case 'mtTier': kv?.burst('mtTier', e); break;
        case 'hit': kv?.burst('hit', e); if (local) { this.chase.shake(0.8); this.damage = 1; } break;
        case 'itemUse': if (kv && e.item && !e.trail && !e.orbit) kv.anim?.play(e.item === 'star' || e.item === 'shroom' ? 'whoo' : 'throw', 1); break;
        case 'throw': kv?.anim?.play(e.dir < 0 ? 'throwBack' : 'throw', 1); break;
        case 'shielded': kv?.anim?.play('block'); break;
        case 'swap': if (local || e.target === this.focusId) this.flashT = 0.6; break;
        case 'place':
          if (e.place === 1 && e.old > 1) kv?.anim?.play('smug');
          else if (e.place === this.session.karts.length && e.old < e.place) kv?.anim?.play('sad');
          else if (e.place < e.old && Math.random() < 0.3) kv?.anim?.play('cheer');
          break;
        case 'finish': if (kv?.anim) kv.anim.mode = e.place <= 3 ? 'victory' : 'defeat'; break;
        case 'rescue': kv?.anim?.play('hit'); break;
        case 'balloonPop': if (kv) this.popBalloon(kv); break;
        case 'eliminated': kv?.anim?.play('sad'); break;
        case 'countdown': if (e.n === 2) for (const v of this.kartViews.values()) if (Math.random() < 0.4) v.anim?.play('taunt'); break;
        case 'land': kv?.burst('land', e); if (local && e.air > 0.5) this.chase.shake(Math.min(0.5, e.air * 0.3)); break;
        case 'trick': kv?.burst('trick', e); break;
        case 'wallHit': if (local) this.chase.shake(Math.min(0.6, e.impact * 0.04)); break;
        default: break;
      }
    }
  }

  popBalloon(kv) {
    const p = kv.root.position;
    const c = new THREE.Color(kv.racer.kartColor || '#ff5a8a');
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      this.fx.chips.emit({ x: p.x, y: p.y + 2.2, z: p.z, vx: Math.cos(a) * 6, vy: 3 + Math.random() * 4, vz: Math.sin(a) * 6, gravity: 12, life: 0.8, size: [0.35, 0.2], color: [c.r, c.g, c.b, 1] });
    }
  }

  // Spectating (joined mid-race, eliminated, or finished): follow another kart.
  cycleFocus(dir = 1) {
    const list = (this.session.race.ranked || this.session.karts).filter((k) => !k.eliminated);
    if (!list.length) return;
    const i = list.findIndex((k) => k.id === this.focusId);
    this.focusId = list[(i + dir + list.length) % list.length].id;
    const k = this.session.viewState(this.focusId);
    if (k) this.chase.snap(k);
  }

  update(dt, input) {
    this.t += dt;
    const s = this.session;
    const local = s.localKart?.();
    if (!this.focusId || !s.race.kart(this.focusId) || (this.spectating && s.race.kart(this.focusId)?.eliminated)) {
      this.focusId = (s.race.ranked || s.karts)[0]?.id;
      this.spectating = true;
    }
    if (local && local.eliminated && this.focusId === local.id) { this.spectating = true; this.cycleFocus(1); }
    for (const k of s.karts) {
      const v = s.viewState(k.id);
      if (k.id === this.focusId) v.lookBack = input ? (input.btn & BTN.LOOK) !== 0 : false;
      this.kartViews.get(k.id)?.update(v, dt, this.t);
    }
    const focus = s.viewState(this.focusId);
    if (focus) this.chase.update(focus, dt, { lookBack: focus.lookBack });
    this.updateIntro(focus);
    this.updateGhosts(dt);
    this.fx.update(dt);
    const karts = new Map(s.karts.map((k) => [k.id, k]));
    this.itemView.update(s.itemState?.(), dt, this.t, karts);
    this.worldView.update?.(dt, this.t, this.camera);
    this.hazardView?.update(dt, this.t, this.camera);
    this.sky.update(this.camera, this.t);
    updateLighting(this.camera, this.sunDir);
    const speed = focus ? Math.abs(focus.speed) : 0;
    this.damage = Math.max(0, (this.damage || 0) - dt * 2.5);
    this.flashT = Math.max(0, (this.flashT || 0) - dt);
    this.screenFx.update(dt, {
      amount: focus && focus.boostTime > 0 ? 1 : Math.max(0, (speed - 31) / 10),
      aspect: this.camera.aspect,
      ink: focus ? Math.min(1, focus.ink * 1.5) : 0,
      blind: Math.max(focus ? Math.min(1, focus.blind * 1.2) : 0, this.flashT > 0 ? this.flashT / 0.6 : 0),
      damage: this.damage || 0,
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
    for (const g of this.ghosts || []) g.kv.dispose();
    this.itemView.dispose();
    this.fx.dispose();
    this.worldView.dispose?.();
    this.hazardView?.dispose();
    this.sky.dispose();
    this.renderer.onResize = null;
  }
}
