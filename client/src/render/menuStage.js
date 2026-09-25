// 3D backdrop for menus: title parade, character/kart turntable, podium.
import * as THREE from 'three';
import { Sky } from './sky.js';
import { THEMES } from './themes.js';
import { KartView } from './kartView.js';
import { Effects } from './particles.js';
import { updateLighting, createToyMaterial } from './toyMaterial.js';
import { buildFigureTemplate, instantiateFigure } from './figure.js';
import { PROPS } from './propDefs.js';
import { listOf } from '@shared/data/registry.js';

export function fakeKart(o = {}) {
  return {
    x: 0, y: 0, z: 0, yaw: 0, speed: 0, steer: 0, drift: 0, driftTier: 0, driftCharge: 0, grounded: true,
    gnx: 0, gny: 1, gnz: 0, groundH: 0, boostTime: 0, boostMul: 1, boostKind: '', spin: 0, tumble: 0, squish: 0,
    shrink: 0, star: 0, invuln: 0, rescue: 0, rescuePhase: 0, glider: false, trickDone: false, surface: 'road',
    ghost: 0, burrow: 0, flail: 0, orbit: null, trailing: null, element: 'magic', ...o,
  };
}

export class MenuStage {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, renderer.aspect, 0.1, 1200);
    const theme = { ...THEMES.skyland, clouds: 24, cloudHeight: -20 };
    this.scene.fog = new THREE.Fog(theme.fog, 120, 600);
    this.sky = new Sky(this.scene, theme);
    this.sunDir = new THREE.Vector3(0.4, 0.8, 0.5).normalize();
    const sun = new THREE.DirectionalLight('#fff6e0', 2.2);
    sun.position.copy(this.sunDir).multiplyScalar(50);
    this.scene.add(sun, new THREE.HemisphereLight('#cfe6ff', '#6a8a4a', 1.5));
    this.fx = new Effects(this.scene);
    this.fx.setViewport(renderer.gl.getDrawingBufferSize(new THREE.Vector2()).y, 45);
    this.t = 0;
    this.buildIsland();
    this.views = [];
    this.mode = 'plain';
    this.onResize();
  }

  buildIsland() {
    const g = new THREE.Group();
    const isl = instantiateFigure(buildFigureTemplate(PROPS.island, { key: 'prop:island', detail: 0.8 }), { outline: false });
    isl.mesh.scale.set(3.4, 1.6, 3.4);
    g.add(isl.mesh);
    // track ring for the parade
    const ring = new THREE.Mesh(new THREE.RingGeometry(14, 22, 64), new THREE.MeshLambertMaterial({ color: '#4a4c55' }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    g.add(ring);
    const kerb = new THREE.Mesh(new THREE.RingGeometry(21.6, 22.4, 64), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    kerb.rotation.x = -Math.PI / 2; kerb.position.y = 0.03;
    g.add(kerb);
    // pedestal for select/garage
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 0.6, 40), createToyMaterial({ vertexColors: false, color: '#ffd23f', spec: 1 }));
    ped.position.set(0, 0.3, 0);
    this.pedestal = ped;
    g.add(ped);
    const tree = buildFigureTemplate(PROPS.tree, { key: 'prop:tree', detail: 0.5 });
    for (const [x, z, s] of [[-9, -8, 1], [10, -9, 1.2], [-6, 9, 0.8], [8, 8, 0.9]]) {
      const t = instantiateFigure(tree, { outline: false });
      t.mesh.position.set(x, 0, z); t.mesh.scale.setScalar(s);
      g.add(t.mesh);
    }
    this.island = g;
    this.scene.add(g);
    // podium blocks
    this.podium = new THREE.Group();
    const cols = ['#ffd23f', '#d8dee6', '#e0924a'];
    [[0, 2.4], [-3.4, 1.6], [3.4, 1.1]].forEach(([x, h], i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(3.2, h, 3), createToyMaterial({ vertexColors: false, color: cols[i], spec: 1 }));
      m.position.set(x, h / 2, 0);
      this.podium.add(m);
    });
    this.podium.visible = false;
    this.scene.add(this.podium);
  }

  clearViews() {
    for (const v of this.views) v.kv.dispose();
    this.views = [];
  }

  addView(entrant, state, animMode = 'select') {
    const kv = new KartView(this.scene, entrant, this.fx, { outlines: true });
    if (kv.anim) kv.anim.mode = animMode;
    const v = { kv, state: fakeKart({ element: kv.element, ...state }), entrant };
    this.views.push(v);
    return v;
  }

  setMode(mode, opts = {}) {
    this.mode = mode;
    this.clearViews();
    this.pedestal.visible = mode === 'select' || mode === 'garage';
    this.podium.visible = mode === 'podium';
    this.island.visible = true;
    if (mode === 'title') {
      const racers = opts.racers || listOf('racers').slice(0, 8);
      const vehicles = listOf('vehicles');
      racers.forEach((r, i) => {
        const e = { racerId: r.id, vehicleId: vehicles[i % vehicles.length]?.id, wheelsId: null, gliderId: null };
        const v = this.addView(e, {}, 'parade');
        v.angle = (i / racers.length) * Math.PI * 2;
        v.radius = 16.5 + (i % 2) * 3;
      });
    } else if (mode === 'select' || mode === 'garage') {
      if (opts.entrant) this.showRacer(opts.entrant);
    } else if (mode === 'podium') {
      (opts.entrants || []).slice(0, 3).forEach((e, i) => {
        const x = [0, -3.4, 3.4][i], y = [2.4, 1.6, 1.1][i];
        const v = this.addView(e, { x, y, z: 0, yaw: 0 }, i === 0 ? 'victory' : 'select');
        v.fixed = true;
      });
    }
  }

  showRacer(entrant) {
    this.clearViews();
    const v = this.addView(entrant, { x: 0, y: 0.6, z: 0, yaw: 0.5 }, 'select');
    v.turntable = true;
    v.kv.anim?.play('cheer');
    this.focus = v;
  }

  react(action) { this.focus?.kv.anim?.play(action); }

  onResize() {
    this.camera.aspect = this.renderer.aspect;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    for (const v of this.views) {
      const s = v.state;
      if (this.mode === 'title' && !v.fixed) {
        v.angle += dt * (7 / v.radius);
        s.x = Math.cos(v.angle) * v.radius;
        s.z = Math.sin(v.angle) * v.radius;
        s.yaw = -v.angle; // tangent direction (counter-clockwise)
        s.speed = 7;
        s.steer = -0.3;
        if (Math.random() < 0.003) v.kv.anim?.play(Math.random() < 0.5 ? 'taunt' : 'cheer');
      } else if (v.turntable) {
        s.yaw += dt * 0.6;
        s.speed = 0;
      }
      v.kv.update(s, dt, t);
    }
    this.fx.update(dt);
    // camera per mode
    const c = this.camera;
    if (this.mode === 'title') {
      const a = t * 0.07;
      c.position.set(Math.cos(a) * 36, 12 + Math.sin(t * 0.2) * 2, Math.sin(a) * 36);
      c.lookAt(0, 1, 0);
    } else if (this.mode === 'select' || this.mode === 'garage') {
      // subject sits in the middle column between the grid and the info panel
      c.position.set(-0.9, 2.0, 6.6);
      c.lookAt(-0.45, 1.0, 0);
    } else if (this.mode === 'podium') {
      c.position.set(Math.sin(t * 0.15) * 2, 4.2, 11);
      c.lookAt(0, 2.6, 0);
      if (Math.random() < 0.5) {
        this.fx.chips.emit({ x: (Math.random() - 0.5) * 16, y: 10, z: (Math.random() - 0.5) * 4, vx: 0, vy: -2, vz: 0, life: 4, size: [0.35, 0.35], color: [Math.random(), Math.random(), Math.random(), 1], color1: [1, 1, 1, 1], gravity: 1.5, drag: 0.5, spin: 6 });
      }
    } else {
      c.position.set(0, 8, 26);
      c.lookAt(0, 1, 0);
    }
    this.sky.update(c, t);
    updateLighting(c, this.sunDir);
  }

  render() { this.renderer.render(this.scene, this.camera); }

  dispose() {
    this.clearViews();
    this.fx.dispose();
    this.sky.dispose();
  }
}
