// Renders themed track hazards. Motion comes from hazardState(h, world.time)
// (the same pure function the physics uses), so what you see is what hits you.
import * as THREE from 'three';
import { hazardState } from '@shared/track/hazardState.js';
import { buildFigureTemplate, instantiateFigure } from './figure.js';
import { TEX } from './textures.js';
import { PROPS } from './propDefs.js';

// Hazard models in the figure format (see figure.js / docs/DATA_FORMATS.md).
const HAZARD_MODELS = {
  geyserVent: {
    palette: { rock: '#5a4a44', rock2: '#7a6660', hot: '#ff7a1a' },
    parts: [
      { shape: 'torus', r: 2.2, tube: 0.7, rot: [90, 0, 0], p: [0, 0.2, 0], c: 'rock', m: 'matte' },
      { shape: 'cyl', r: 1.8, h: 0.1, p: [0, 0.05, 0], c: 'hot', m: 'glow' },
      { shape: 'sphere', r: 0.7, p: [2.4, 0.3, 0.6], c: 'rock2', m: 'matte' },
      { shape: 'sphere', r: 0.5, p: [-2.2, 0.25, -1], c: 'rock2', m: 'matte' },
    ],
  },
  boulder: {
    palette: { rock: '#8a6a50', rock2: '#6a4e3a', crack: '#ff7a1a' },
    parts: [
      { shape: 'sphere', r: 1, c: 'rock', m: 'matte' },
      { shape: 'sphere', r: 0.45, p: [0.6, 0.5, 0.3], c: 'rock2', m: 'matte' },
      { shape: 'sphere', r: 0.4, p: [-0.5, -0.4, 0.6], c: 'rock2', m: 'matte' },
      { shape: 'torus', r: 0.98, tube: 0.05, c: 'crack', m: 'glow' },
    ],
  },
  carousel: {
    palette: { base: '#6a3aa8', trim: '#ffd23f', pole: '#f0e6ff', horse: '#ffffff', saddle: '#ff5a8a', roof: '#ff5a8a', roof2: '#ffffff' },
    bones: { spin: { pos: [0, 0, 0] } },
    parts: [
      { shape: 'cyl', r: 1.6, h: 0.6, p: [0, 0.3, 0], c: 'base' },
      { shape: 'cyl', r: 0.5, h: 7, p: [0, 3.5, 0], c: 'trim' },
      { shape: 'cone', r: 3, h: 2.2, p: [0, 7, 0], c: 'roof' },
      { shape: 'sphere', r: 0.4, p: [0, 9.3, 0], c: 'trim', m: 'glow' },
      { bone: 'spin', shape: 'box', size: [0.5, 0.5, 8], p: [0, 2.8, 0], c: 'trim', ring: { n: 3, r: 4 } },
      { bone: 'spin', shape: 'cyl', r: 0.12, h: 4, p: [0, 1.4, 0], c: 'pole', ring: { n: 3, r: 7 } },
      { bone: 'spin', shape: 'capsule', r: 0.5, len: 1.4, p: [0, 1.2, 0], rot: [0, 0, 90], c: 'horse', ring: { n: 3, r: 7 } },
      { bone: 'spin', shape: 'box', size: [0.7, 0.2, 0.7], round: 0.1, p: [0, 1.75, 0], c: 'saddle', ring: { n: 3, r: 6.9 } },
    ],
  },
  doorFrame: {
    palette: { stone: '#5a4e66', stone2: '#3a3044', glow: '#7cffb2' },
    parts: [
      { shape: 'box', size: [1.6, 9, 2], round: 0.3, p: [1, 4.5, 0], c: 'stone', m: 'matte' },
      { shape: 'box', size: [1.6, 9, 2], round: 0.3, p: [-1, 4.5, 0], c: 'stone', m: 'matte' },
      { shape: 'box', size: [2, 1.6, 2.2], round: 0.3, p: [0, 9.5, 0], c: 'stone2', m: 'matte' },
      { shape: 'sphere', r: 0.35, p: [0, 9.5, 1.1], c: 'glow', m: 'glow' },
    ],
  },
  doorPanel: {
    palette: { wood: '#6a4424', band: '#2a2530', stud: '#ffd23f' },
    parts: [
      { shape: 'box', size: [1, 1, 0.5], c: 'wood', m: 'matte' },
      { shape: 'box', size: [1.02, 0.08, 0.55], p: [0, 0.3, 0], c: 'band' },
      { shape: 'box', size: [1.02, 0.08, 0.55], p: [0, -0.3, 0], c: 'band' },
    ],
  },
  crusher: {
    palette: { steel: '#7a8292', dark: '#3e4450', warn: '#ffc21a', warn2: '#1a1a22', teeth: '#c8ccd4' },
    parts: [
      { shape: 'box', size: [1, 0.8, 1], round: 0.05, p: [0, 0.4, 0], c: 'steel', m: 'metal' },
      { shape: 'box', size: [1.02, 0.12, 1.02], p: [0, 0.75, 0], c: 'warn' },
      { shape: 'box', size: [0.96, 0.1, 0.96], p: [0, 0.05, 0], c: 'dark' },
    ],
  },
  crusherShaft: {
    palette: { steel: '#5a6272', dark: '#3e4450' },
    parts: [{ shape: 'cyl', r: 0.6, h: 1, p: [0, 0.5, 0], c: 'steel', m: 'metal' }],
  },
  pylon: {
    palette: { steel: '#4a5262', warn: '#ffc21a', lens: '#ff3a5a' },
    parts: [
      { shape: 'box', size: [1, 5, 1], round: 0.2, p: [0, 2.5, 0], c: 'steel', m: 'metal' },
      { shape: 'box', size: [1.1, 0.4, 1.1], p: [0, 5, 0], c: 'warn' },
      { shape: 'sphere', r: 0.35, p: [0, 1.2, 0.5], c: 'lens', m: 'glow', array: { n: 3, dp: [0, 1.2, 0] } },
    ],
  },
  pistonHead: {
    palette: { steel: '#8a92a2', face: '#ffc21a', dark: '#2a2e38' },
    parts: [
      { shape: 'box', size: [1, 1, 1], round: 0.08, c: 'steel', m: 'metal' },
      { shape: 'box', size: [0.1, 1.02, 1.02], p: [0.5, 0, 0], c: 'face' },
    ],
  },
  ghost: {
    palette: { body: '#e8f0ff', eye: '#1a1426', cheek: '#9ab8ff', glow: '#7cffb2' },
    parts: [
      { shape: 'sphere', r: 1.1, s: [1, 1.1, 1], p: [0, 1.2, 0], c: 'body', m: 'soft' },
      { shape: 'cone', r: 1.1, h: 1.4, p: [0, 1.1, 0], rot: [180, 0, 0], c: 'body', m: 'soft' },
      { shape: 'sphere', r: 0.35, p: [0.8, 0.9, 0], c: 'body', m: 'soft', mirror: true },
      { shape: 'eye', r: 0.25, p: [0.38, 1.45, 0.9], iris: 'eye', iris_size: 0.85, pupil_size: 0.6, mirror: true },
      { shape: 'sphere', r: 0.2, s: [1, 1.3, 0.5], p: [0, 0.95, 1.02], c: 'eye', m: 'matte' },
    ],
  },
  fan: {
    palette: { post: '#8a5a32', hub: '#ffd23f', blade: '#ffffff', sock: '#ff5a1f' },
    bones: { spin: { pos: [0, 5, 0.6] } },
    parts: [
      { shape: 'cyl', r: 0.25, h: 5, p: [0, 2.5, 0], c: 'post', m: 'matte' },
      { bone: 'spin', shape: 'cyl', r: 0.45, h: 0.6, rot: [90, 0, 0], c: 'hub' },
      { bone: 'spin', shape: 'box', size: [0.5, 4.4, 0.08], c: 'blade', array: { n: 2, dr: [0, 0, 90] } },
      { shape: 'cone', r: 0.5, h: 2.2, p: [0, 5.8, -1.2], rot: [-90, 0, 0], c: 'sock', m: 'matte' },
    ],
  },
};

const tplCache = new Map();
const UP = new THREE.Vector3(0, 1, 0);
function model(name, outline = true) {
  if (!tplCache.has(name)) tplCache.set(name, buildFigureTemplate(HAZARD_MODELS[name] || PROPS[name], { key: `hz:${name}`, detail: 0.6 }));
  return instantiateFigure(tplCache.get(name), { outline });
}

export class HazardView {
  constructor(scene, world, fx, theme) {
    this.scene = scene;
    this.world = world;
    this.fx = fx;
    this.theme = theme;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.items = [];
    this.fogBase = scene.fog ? { near: scene.fog.near, far: scene.fog.far } : null;
    this.fogMix = 0;
    this._rv = new THREE.Vector3();
    for (const h of world.hazards || []) {
      const v = this.build(h);
      if (v) this.items.push(v);
    }
  }

  build(h) {
    const G = this.group;
    const w = this.world;
    const molten = this.theme.voidSurface === 'lava' || this.theme.ambient === 'embers';
    switch (h.type) {
      case 'geyser': {
        const vent = model('geyserVent', false);
        vent.mesh.position.set(h.x, h.y + 0.02, h.z);
        G.add(vent.mesh);
        const colMat = new THREE.MeshBasicMaterial({ color: h.color || (molten ? '#ff8a2a' : '#8fe4ff'), transparent: true, opacity: 0.85, depthWrite: false });
        const col = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.0, 1, 14, 1, true), colMat);
        col.position.set(h.x, h.y, h.z);
        G.add(col);
        return { h, vent, col, colMat, hot: molten };
      }
      case 'boulder': {
        const f = model(h.model && (HAZARD_MODELS[h.model] || PROPS[h.model]) ? h.model : 'boulder');
        const r = h.r ?? 2.4;
        f.mesh.scale.setScalar(r);
        G.add(f.mesh);
        return { h, fig: f, r };
      }
      case 'carousel': {
        const f = model('carousel');
        const sc = (h.r ?? 8) / 7;
        f.mesh.scale.set(sc, 1, sc);
        f.mesh.position.set(h.x, h.y, h.z);
        G.add(f.mesh);
        return { h, fig: f };
      }
      case 'door': {
        const wd = h.w ?? (h.hw || 5) * 2;
        const holder = new THREE.Group();
        holder.position.set(h.x, h.y, h.z);
        holder.rotation.y = Math.atan2(-(h.rz ?? 0), h.rx ?? 1); // local X = road right
        G.add(holder);
        for (const side of [-1, 1]) {
          const post = model('doorFrame');
          post.mesh.position.set(side * (wd / 2 + 1), 0, 0);
          post.mesh.scale.set(0.6, 1, 0.6);
          holder.add(post.mesh);
        }
        const panels = [-1, 1].map((side) => {
          const p = model('doorPanel');
          p.mesh.scale.set(wd / 2, 6, 1);
          holder.add(p.mesh);
          return { p, side };
        });
        const beam = new THREE.Mesh(new THREE.BoxGeometry(wd + 4, 1.4, 1.2), new THREE.MeshLambertMaterial({ color: '#3a3044' }));
        beam.position.y = 8.2;
        holder.add(beam);
        return { h, holder, panels, wd };
      }
      case 'crusher': {
        const wd = h.w ?? 7, dp = h.d ?? 3;
        const holder = new THREE.Group();
        holder.position.set(h.x, h.y, h.z);
        holder.rotation.y = Math.atan2(-(h.rz ?? 0), h.rx ?? 1);
        G.add(holder);
        const head = model('crusher');
        head.mesh.scale.set(wd, 2.6, dp);
        holder.add(head.mesh);
        const shaft = model('crusherShaft', false);
        holder.add(shaft.mesh);
        for (const side of [-1, 1]) {
          const py = model('pylon');
          py.mesh.scale.set(1.2, 2.2, 1.2);
          py.mesh.position.set(side * (wd / 2 + 1.4), 0, 0);
          holder.add(py.mesh);
        }
        const top = new THREE.Mesh(new THREE.BoxGeometry(wd + 4, 1.2, 1.6), new THREE.MeshLambertMaterial({ color: '#3e4450' }));
        top.position.y = 11.5;
        holder.add(top);
        // warning shadow on the road
        const warnMat = new THREE.MeshBasicMaterial({ color: '#ff3a3a', transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
        const warn = new THREE.Mesh(new THREE.PlaneGeometry(wd, dp), warnMat);
        warn.rotation.x = -Math.PI / 2;
        warn.position.y = 0.08;
        holder.add(warn);
        return { h, holder, head, shaft, warnMat };
      }
      case 'laser': {
        const holder = new THREE.Group();
        holder.position.set(h.x, h.y, h.z);
        holder.rotation.y = Math.atan2(-(h.rz ?? 0), h.rx ?? 1);
        G.add(holder);
        const span = (h.hw || 10) * 2 + 2;
        for (const side of [-1, 1]) {
          const py = model('pylon');
          py.mesh.position.set(side * span / 2, 0, 0);
          holder.add(py.mesh);
        }
        const beamMat = new THREE.MeshBasicMaterial({ color: h.color || '#ff2a5a', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
        const beams = [];
        for (let k = 0; k < 3; k++) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(span, 0.18, 0.18), beamMat);
          b.position.y = 1.2 + k * 1.2;
          holder.add(b);
          beams.push(b);
        }
        return { h, holder, beams, beamMat };
      }
      case 'piston': {
        const side = h.side === 'left' ? -1 : 1;
        const holder = new THREE.Group();
        holder.position.set(h.x, h.y, h.z);
        holder.rotation.y = Math.atan2(-(h.rz ?? 0), h.rx ?? 1);
        G.add(holder);
        const head = model('pistonHead');
        const d = h.d ?? 1.2;
        holder.add(head.mesh);
        const housing = new THREE.Mesh(new THREE.BoxGeometry(3, 4.2, d + 1.2), new THREE.MeshLambertMaterial({ color: '#4a5262' }));
        housing.position.set(side * ((h.hw || 10) + 2.2), 2.1, 0);
        holder.add(housing);
        return { h, holder, head, side, d };
      }
      case 'ghost': {
        // lane-sweeping obstacle: a ghost by default, or any prop (swinging crates…)
        const f = model(h.model && (HAZARD_MODELS[h.model] || PROPS[h.model]) ? h.model : 'ghost');
        f.mesh.scale.setScalar(h.scale ?? 1.2);
        G.add(f.mesh);
        let rope = null;
        if (h.hang) {
          rope = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 5), new THREE.MeshLambertMaterial({ color: '#3a2a20' }));
          G.add(rope);
        }
        return { h, fig: f, rope };
      }
      case 'windGust': {
        const p = w.at((h.t0 + h.t1) / 2, 0);
        const fans = [];
        for (const t of [h.t0, h.t1]) {
          const q = w.at(t, (h.dir ?? 1) > 0 ? -1.25 : 1.25);
          const f = model('fan');
          f.mesh.position.set(q.x, q.y, q.z);
          f.mesh.rotation.y = q.yaw + ((h.dir ?? 1) > 0 ? Math.PI / 2 : -Math.PI / 2);
          G.add(f.mesh);
          fans.push(f);
        }
        // wind streaks: instanced thin quads that sweep across the zone
        const n = 60;
        const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
        const im = new THREE.InstancedMesh(new THREE.BoxGeometry(3.5, 0.08, 0.08), mat, n);
        im.frustumCulled = false;
        G.add(im);
        const seeds = Array.from({ length: n }, (_, k) => ({ t: h.t0 + (h.t1 - h.t0) * ((k * 0.618) % 1), y: 0.6 + ((k * 0.37) % 1) * 3.5, ph: (k * 0.713) % 1 }));
        return { h, fans, im, mat, seeds, mid: p };
      }
      case 'conveyor': {
        const R = w.main;
        const tex = TEX.chevrons().clone();
        tex.needsUpdate = true;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        const mat = new THREE.MeshBasicMaterial({ map: tex, color: '#ffd23f', transparent: true, opacity: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
        const l0 = Math.min(h.lane0 ?? -1, h.lane1 ?? 1), l1 = Math.max(h.lane0 ?? -1, h.lane1 ?? 1);
        const pos = [], uv = [], idx = [];
        const s0 = h.s0, s1 = h.s1 >= h.s0 ? h.s1 : h.s1 + w.length;
        let row = 0;
        for (let s = s0; s <= s1 + 0.01; s += R.step, row++) {
          for (const lane of [l0, l1]) {
            const q = w.at(s / w.length, lane, 0, 0.06);
            pos.push(q.x, q.y, q.z);
            uv.push(lane === l0 ? 0 : (l1 - l0) * 2, (s - s0) / 6);
          }
          if (row > 0) { const a = (row - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(idx);
        const m = new THREE.Mesh(g, mat);
        G.add(m);
        return { h, tex, mat };
      }
      case 'collapse': return this.buildCollapse(h);
      case 'fog': {
        return { h };
      }
      default:
        console.warn('[hazards] no renderer for hazard type', h.type);
        return null;
    }
  }

  // Collapsing bridge: a plank deck whose outer planks crumble into the void
  // once the collapse triggers (the safe centre lane stays).
  buildCollapse(h) {
    const w = this.world, R = w.main;
    const safe = h.safeLane ?? 0.25;
    const s0 = h.s0, s1 = h.s1 >= h.s0 ? h.s1 : h.s1 + w.length;
    const planks = [];
    const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true });
    const pw = 2.2;
    const geo = new THREE.BoxGeometry(1, 0.35, pw * 0.92);
    const cols = [];
    const colors = ['#8a5a32', '#a06a3a', '#7a4e2a'].map((c) => new THREE.Color(c));
    for (let q = 0; q < geo.attributes.position.count; q++) cols.push(1, 1, 1);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    let k = 0;
    for (let s = s0 + pw / 2; s < s1; s += pw, k++) {
      const c = w.at(s / w.length, 0);
      const hw = c.hw;
      for (const [a, b, outer] of [[-1, -safe, true], [-safe, safe, false], [safe, 1, true]]) {
        const la = a * hw, lb = b * hw;
        const mid = (la + lb) / 2;
        const m = new THREE.Mesh(geo, mat.clone());
        m.material.color.copy(colors[(k + (outer ? 1 : 0)) % 3]);
        m.scale.x = lb - la - 0.12;
        const x = c.x + c.rx * mid, z = c.z + c.rz * mid;
        const y = w.at(s / w.length, mid / hw).y - 0.18;
        m.position.set(x, y, z);
        m.rotation.y = c.yaw;
        this.group.add(m);
        planks.push({ m, outer, base: { x, y, z }, fall: 0, delay: ((k * 7919) % 13) / 13 * 0.9, spin: ((k * 31) % 7 - 3) * 0.4 });
      }
    }
    return { h, planks, fallen: 0 };
  }

  update(dt, t, camera) {
    const w = this.world;
    const time = w.time || 0;
    const race = w.hazardRace;
    let fogTarget = 0;
    for (const v of this.items) {
      const h = v.h;
      const st = hazardState(h, time, race);
      switch (h.type) {
        case 'geyser': {
          const hgt = st.height * (h.power ?? 12);
          v.col.visible = hgt > 0.05;
          v.col.scale.set(1 + 0.08 * Math.sin(t * 30), Math.max(0.01, hgt), 1 + 0.08 * Math.cos(t * 27));
          v.col.position.y = h.y + hgt / 2;
          v.colMat.opacity = 0.6 + 0.3 * st.height;
          if (st.warning && this.fx.ok() && Math.random() < 0.5) {
            this.fx.smoke.emit({ x: h.x + (Math.random() - 0.5) * 2, y: h.y + 0.3, z: h.z + (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 2, life: 0.8, size: [0.8, 1.8], color: v.hot ? [1, 0.6, 0.2, 0.7] : [0.9, 0.95, 1, 0.7] });
          }
          if (st.active && this.fx.ok()) {
            this.fx.glow.emit({ x: h.x + (Math.random() - 0.5) * 2.4, y: h.y + hgt, z: h.z + (Math.random() - 0.5) * 2.4, vx: (Math.random() - 0.5) * 6, vy: 3 + Math.random() * 4, vz: (Math.random() - 0.5) * 6, gravity: 14, life: 0.7, size: [0.7, 0.2], color: v.hot ? [1, 0.55, 0.15, 1] : [0.7, 0.9, 1, 1] });
          }
          break;
        }
        case 'boulder': {
          v.fig.mesh.visible = st.active;
          if (st.active) {
            v.fig.mesh.position.set(st.x, st.y, st.z);
            v.fig.mesh.rotation.set(st.roll, 0, 0);
            const p = h.path;
            if (p && p.length > 1) v.fig.mesh.rotation.y = Math.atan2(p[p.length - 1].x - p[0].x, p[p.length - 1].z - p[0].z);
            if (this.fx.ok() && Math.random() < 0.4) this.fx.smoke.emit({ x: st.x, y: st.y - v.r * 0.8, z: st.z, vy: 1.5, life: 0.9, size: [1.5, 3], color: [0.55, 0.45, 0.4, 0.6] });
          }
          break;
        }
        case 'carousel':
          if (v.fig.bones.spin) v.fig.bones.spin.rotation.y = -st.angle + Math.PI / 2;
          break;
        case 'door': {
          const open = st.open ? Math.min(1, (st.f * h.period) / 0.5) : 1 - Math.min(1, ((st.f * h.period) - (h.open ?? 4)) / 0.35);
          const o = Math.max(0, Math.min(1, open));
          for (const { p, side } of v.panels) p.mesh.position.set(side * (v.wd / 4 + (v.wd / 2) * o), 3, 0);
          break;
        }
        case 'crusher': {
          const top = 9.5;
          const y = 0.2 + st.height * top;
          v.head.mesh.position.y = y;
          v.shaft.mesh.position.y = y + 2.6;
          v.shaft.mesh.scale.set(1, Math.max(0.1, 11.5 - y - 2.6), 1);
          v.warnMat.opacity = st.warning ? 0.25 + 0.25 * Math.sin(t * 20) : st.active ? 0.4 : 0;
          break;
        }
        case 'laser': {
          const on = st.active;
          for (const b of v.beams) b.visible = on || (st.warning && Math.sin(t * 40) > 0);
          v.beamMat.opacity = on ? 0.85 + 0.15 * Math.sin(t * 50) : 0.3;
          for (const b of v.beams) b.scale.y = b.scale.z = on ? 1 : 0.4;
          break;
        }
        case 'piston': {
          const hw = h.hw || 10;
          const reach = hw * (h.reach ?? 0.55) * st.ext;
          const len = Math.max(0.2, reach * 2);
          v.head.mesh.scale.set(len, 3.2, v.d);
          v.head.mesh.position.set(v.side * (hw + 1 - len / 2), 1.8, 0);
          v.head.mesh.rotation.y = v.side < 0 ? Math.PI : 0;
          break;
        }
        case 'ghost': {
          const p = w.at(h.t, st.lane, h.ribbon || 0);
          if (v.rope) {
            // swinging from a rope anchored high above the road centre
            const top = w.at(h.t, 0, h.ribbon || 0);
            const ay = top.y + 16;
            v.fig.mesh.position.set(p.x, p.y + 0.3, p.z);
            v.fig.mesh.rotation.y = p.yaw;
            const dx = p.x - top.x, dz = p.z - top.z, dy = p.y + 2.4 - ay;
            const len = Math.hypot(dx, dy, dz);
            v.rope.position.set((p.x + top.x) / 2, (p.y + 2.4 + ay) / 2, (p.z + top.z) / 2);
            v.rope.scale.y = len;
            v.rope.quaternion.setFromUnitVectors(UP, this._rv.set(dx, dy, dz).normalize().negate());
          } else {
            v.fig.mesh.position.set(p.x, p.y + 0.4 + Math.sin(t * 3 + h.id) * 0.35, p.z);
            v.fig.mesh.rotation.y = p.yaw + Math.PI + Math.sin(t * 1.3) * 0.5;
          }
          break;
        }
        case 'windGust': {
          const target = st.active ? 0.75 : st.warning ? 0.25 : 0;
          v.mat.opacity += (target - v.mat.opacity) * Math.min(1, dt * 6);
          for (const f of v.fans) if (f.bones.spin) f.bones.spin.rotation.z += dt * (st.active ? 18 : st.warning ? 6 : 1.2);
          if (v.mat.opacity > 0.01) {
            const dummy = this._d ??= new THREE.Object3D();
            const dir = h.dir ?? 1;
            v.seeds.forEach((sd, k) => {
              const u = (sd.ph + t * 0.9) % 1;
              const lane = dir * (-1.1 + 2.2 * u);
              const q = w.at(sd.t, lane, 0, sd.y);
              dummy.position.set(q.x, q.y, q.z);
              dummy.rotation.set(0, q.yaw + Math.PI / 2, 0);
              dummy.scale.set(0.6 + Math.sin(u * Math.PI), 1, 1);
              dummy.updateMatrix();
              v.im.setMatrixAt(k, dummy.matrix);
            });
            v.im.instanceMatrix.needsUpdate = true;
          }
          v.im.visible = v.mat.opacity > 0.01;
          break;
        }
        case 'conveyor':
          v.tex.offset.y = -time * (h.speed ?? 8) * (h.dir ?? 1) / 6;
          break;
        case 'collapse': {
          if (st.active) {
            v.fallen += dt;
            for (const p of v.planks) {
              if (!p.outer) continue;
              const ft = v.fallen - p.delay;
              if (ft <= 0) { p.m.position.y = p.base.y + Math.sin(t * 40 + p.delay * 10) * 0.05; continue; }
              p.m.position.y = p.base.y - 15 * ft * ft;
              p.m.rotation.x = p.spin * ft;
              p.m.visible = ft < 3;
              if (ft < dt * 1.5 && this.fx.ok()) this.fx.chips.emit({ x: p.base.x, y: p.base.y, z: p.base.z, vy: 3, life: 1, size: [0.5, 0.3], gravity: 12, color: [0.55, 0.36, 0.2, 1] });
            }
          } else if (v.fallen > 0) {
            v.fallen = 0;
            for (const p of v.planks) { p.m.visible = true; p.m.position.set(p.base.x, p.base.y, p.base.z); p.m.rotation.x = 0; }
          }
          break;
        }
        case 'fog': {
          if (camera && h.s0 !== undefined) {
            const c = camera.position;
            const R = w.main;
            // cheap: fog is on while the camera is near any sample in the zone
            const pj = w.nearestMain(c.x, c.y, c.z);
            const inS = h.s1 >= h.s0 ? pj.s >= h.s0 && pj.s <= h.s1 : pj.s >= h.s0 || pj.s <= h.s1;
            if (inS && Math.abs(pj.L) < 60 && R) fogTarget = Math.max(fogTarget, h.density ?? 1);
          }
          break;
        }
        default: break;
      }
    }
    // fog banks: pull the scene fog in while inside a fog zone
    if (this.fogBase && this.scene.fog && this.items.some((v) => v.h.type === 'fog')) {
      this.fogMix += (fogTarget - this.fogMix) * Math.min(1, dt * 1.5);
      const k = this.fogMix;
      this.scene.fog.near = this.fogBase.near * (1 - k) + 8 * k;
      this.scene.fog.far = this.fogBase.far * (1 - k) + 90 * k;
    }
  }

  dispose() {
    this.group.traverse((o) => { if (o.geometry && !o.isSkinnedMesh && o.isInstancedMesh) o.geometry.dispose(); });
    this.group.removeFromParent();
  }
}
