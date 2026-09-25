// Renders world items: item boxes (instanced, iridescent) with "?" billboards,
// coins (instanced), projectiles, hazards, drones, swap runes, shockwaves and
// explosions. Reads item state each frame from the session.
import * as THREE from 'three';
import { buildFigureTemplate } from './figure.js';
import { createToyMaterial } from './toyMaterial.js';
import { ITEM_MODELS } from './itemModels.js';
import { TEX } from './textures.js';
import { ELEMENT_COLORS } from '../ui/icons.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

const sharedToy = createToyMaterial();

// Build a mesh for an item model, optionally tinted by element (orbs).
export function itemMesh(kind, element) {
  let def = ITEM_MODELS[kind] || ITEM_MODELS.orb;
  let key = `item:${kind}`;
  if ((kind === 'orb' || kind === 'bolt') && element) {
    def = { ...def, palette: { ...def.palette, core: ELEMENT_COLORS[element] || def.palette.core, c: ELEMENT_COLORS[element] || def.palette.c } };
    key += ':' + element;
  }
  const tpl = buildFigureTemplate(def, { key, detail: 0.6 });
  const m = new THREE.Mesh(tpl.geometry, sharedToy);
  m.frustumCulled = true;
  return m;
}

const BOX_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying vec3 vN; varying vec3 vV; varying float vY;
void main() {
  #include <begin_vertex>
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <project_vertex>
  #include <fog_vertex>
  vN = normalize(transformedNormal); vV = -mvPosition.xyz; vY = position.y;
}`;
const BOX_FRAG = /* glsl */ `
uniform float uTime;
#include <common>
#include <fog_pars_fragment>
varying vec3 vN; varying vec3 vV; varying float vY;
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(vV);
  float f = 1.0 - abs(dot(n, v));
  vec3 rainbow = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + f * 1.3 + uTime * 0.25 + vY * 0.3));
  vec3 col = mix(vec3(1.0, 0.42, 0.86), rainbow, 0.5) + pow(f, 3.0) * 0.6;
  float spec = smoothstep(0.93, 0.97, dot(n, normalize(vec3(0.3, 0.8, 0.5) + v)));
  col += spec;
  gl_FragColor = vec4(col, 0.5 + f * 0.45);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
const BB_VERT = /* glsl */ `
varying vec2 vUv;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  float s = length(instanceMatrix[0].xyz);
  vec4 mvPosition = modelViewMatrix * vec4(instanceMatrix[3].xyz, 1.0);
  mvPosition.xy += position.xy * s;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const BB_FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;
#include <fog_pars_fragment>
void main() {
  vec4 c = texture2D(uMap, vUv);
  if (c.a < 0.05) discard;
  gl_FragColor = c;
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export class ItemView {
  constructor(scene, fx, opts = {}) {
    this.scene = scene;
    this.fx = fx;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.proj = new Map();
    this.haz = new Map();
    this.eff = new Map();
    this.rings = [];
    this.boxAnim = new Map();
    this.boxMat = new THREE.ShaderMaterial({
      uniforms: { ...THREE.UniformsLib.fog, uTime: { value: 0 } },
      vertexShader: BOX_VERT, fragmentShader: BOX_FRAG, transparent: true, depthWrite: false, fog: true,
    });
    this.bbMat = new THREE.ShaderMaterial({
      uniforms: { ...THREE.UniformsLib.fog, uMap: { value: TEX.question() } },
      vertexShader: BB_VERT, fragmentShader: BB_FRAG, transparent: true, fog: true,
    });
    this.coinMat = createToyMaterial({ vertexColors: false, color: '#ffc21a', spec: 1 });
    this.boxes = null;
    this.coins = null;
    this.localId = opts.localId;
  }

  init(state) {
    const nb = state.boxes.length;
    if (nb) {
      this.boxMesh = new THREE.InstancedMesh(new RoundedBoxGeometry(1.7, 1.7, 1.7, 3, 0.35), this.boxMat, nb);
      this.boxMesh.renderOrder = 3;
      this.bbMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.2, 1.2), this.bbMat, nb);
      this.bbMesh.renderOrder = 4;
      this.boxMesh.frustumCulled = this.bbMesh.frustumCulled = false;
      this.group.add(this.boxMesh, this.bbMesh);
    }
    const nc = state.coins.length;
    const coinGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.14, 16);
    coinGeo.rotateX(Math.PI / 2);
    if (nc) {
      this.coinMesh = new THREE.InstancedMesh(coinGeo, this.coinMat, nc);
      this.coinMesh.frustumCulled = false;
      this.group.add(this.coinMesh);
    }
    this.looseMesh = new THREE.InstancedMesh(coinGeo, this.coinMat, 64);
    this.looseMesh.frustumCulled = false;
    this.looseMesh.count = 0;
    this.group.add(this.looseMesh);
    if (state.treasure) {
      this.chest = itemMesh('chest');
      this.chest.position.set(state.treasure.x, state.treasure.y - 1.2, state.treasure.z);
      this.group.add(this.chest);
    }
    this.inited = true;
  }

  update(state, dt, t, karts) {
    if (!state) return;
    if (!this.inited) this.init(state);
    this._t = t;
    this.boxMat.uniforms.uTime.value = t;
    // item boxes
    if (this.boxMesh) {
      state.boxes.forEach((b, i) => {
        let sc = b.active ? 1 : 0;
        const a = this.boxAnim.get(i);
        if (b.active && a !== undefined) {
          const k = Math.min(1, (t - a) / 0.45);
          sc = k < 1 ? 1.25 * Math.sin(k * Math.PI * 0.5) + (k > 0.7 ? -0.25 * (k - 0.7) / 0.3 : 0) : 1;
          if (k >= 1) this.boxAnim.delete(i);
        }
        _e.set(0.35, t * 1.3 + i, 0.2);
        _q.setFromEuler(_e);
        _v.set(b.x, b.y + Math.sin(t * 2 + i) * 0.15, b.z);
        _s.setScalar(Math.max(0.0001, sc));
        _m.compose(_v, _q, _s);
        this.boxMesh.setMatrixAt(i, _m);
        _m.makeScale(Math.max(0.0001, sc), Math.max(0.0001, sc), 1).setPosition(_v);
        this.bbMesh.setMatrixAt(i, _m);
      });
      this.boxMesh.instanceMatrix.needsUpdate = true;
      this.bbMesh.instanceMatrix.needsUpdate = true;
    }
    // coins
    if (this.coinMesh) {
      _e.set(0, t * 3, 0);
      _q.setFromEuler(_e);
      state.coins.forEach((c, i) => {
        _v.set(c.x, c.y + Math.sin(t * 3 + i * 0.7) * 0.12, c.z);
        _s.setScalar(c.active ? 1 : 0.0001);
        _m.compose(_v, _q, _s);
        this.coinMesh.setMatrixAt(i, _m);
      });
      this.coinMesh.instanceMatrix.needsUpdate = true;
    }
    const loose = state.loose || [];
    this.looseMesh.count = Math.min(64, loose.length);
    for (let i = 0; i < this.looseMesh.count; i++) {
      const c = loose[i];
      _e.set(0, t * 4 + i, 0); _q.setFromEuler(_e);
      _v.set(c.x, c.y + Math.abs(Math.sin(t * 5 + i)) * 0.3, c.z);
      _s.setScalar(c.t < 2 && Math.floor(t * 10) % 2 ? 0.0001 : 1);
      _m.compose(_v, _q, _s);
      this.looseMesh.setMatrixAt(i, _m);
    }
    this.looseMesh.instanceMatrix.needsUpdate = true;
    if (this.chest) {
      const taken = state.treasure?.taken?.has?.(this.localId) || state.treasure?.takenLocal;
      this.chest.visible = !taken;
      this.chest.rotation.y = t * 0.8;
      this.chest.position.y = state.treasure.y - 1.1 + Math.sin(t * 2) * 0.15;
    }

    this.syncMap(this.proj, state.projectiles, (p) => this.makeProj(p), (m, p) => this.updateProj(m, p, dt, t));
    this.syncMap(this.haz, state.hazards, (h) => this.makeHaz(h), (m, h) => this.updateHaz(m, h, dt, t));
    this.syncMap(this.eff, state.effects, (e) => this.makeEff(e), (m, e) => this.updateEff(m, e, dt, t, karts));
    this.updateRings(dt);
  }

  syncMap(map, list, make, upd) {
    const seen = new Set();
    for (const o of list || []) {
      seen.add(o.id);
      let m = map.get(o.id);
      if (!m) { m = make(o); if (!m) continue; map.set(o.id, m); this.group.add(m); }
      upd(m, o);
    }
    for (const [id, m] of map) {
      if (!seen.has(id)) { m.removeFromParent(); map.delete(id); }
    }
  }

  makeProj(p) {
    const kind = p.kind === 'peelThrow' ? 'peel' : p.kind;
    const m = itemMesh(kind, p.element);
    if (p.kind === 'comet') m.scale.setScalar(1.4);
    return m;
  }

  updateProj(m, p, dt, t) {
    m.position.set(p.x, p.y, p.z);
    m.rotation.set(0, p.yaw, 0);
    const fx = this.fx;
    if (p.kind === 'orb' || p.kind === 'seeker' || p.kind === 'bolt') {
      m.rotation.y = t * 8;
      if (fx.ok()) {
        const c = new THREE.Color(p.kind === 'seeker' ? '#ff3d4f' : ELEMENT_COLORS[p.element] || '#c04fff');
        fx.glow.emit({ x: p.x, y: p.y, z: p.z, vx: 0, vy: 0.4, vz: 0, life: 0.3, size: [0.9, 0.1], color: [c.r, c.g, c.b, 0.8], color1: [c.r, c.g, c.b, 0] });
      }
    } else if (p.kind === 'comet') {
      m.rotation.set(t * 3, t * 6, 0);
      for (let i = 0; i < 2; i++) fx.glow.emit({ x: p.x, y: p.y, z: p.z, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5) * 2, life: 0.6, size: [2.2, 0.2], color: [0.3, 0.55, 1, 0.9], color1: [0.8, 0.9, 1, 0] });
    } else if (p.kind === 'boulder') {
      m.rotation.set(p.t * 18, p.yaw, 0, 'YXZ');
      if (fx.ok() && Math.random() < 0.5) fx.smoke.emit({ x: p.x, y: p.y - 1.8, z: p.z, vx: (Math.random() - 0.5) * 3, vy: 1.5, vz: (Math.random() - 0.5) * 3, life: 0.7, size: [1.2, 2.6], color: [0.6, 0.48, 0.35, 0.6], color1: [0.7, 0.6, 0.5, 0], drag: 2 });
    } else if (p.kind === 'tornado') {
      m.rotation.y = t * 12;
      if (fx.ok()) fx.smoke.emit({ x: p.x + (Math.random() - 0.5) * 3, y: p.y + Math.random() * 3, z: p.z + (Math.random() - 0.5) * 3, vx: 0, vy: 3, vz: 0, life: 0.6, size: [1, 2], color: [0.95, 0.98, 1, 0.5], color1: [1, 1, 1, 0] });
    } else if (p.kind === 'peelThrow') {
      m.rotation.x = t * 10;
    }
  }

  makeHaz(h) {
    if (h.kind === 'fire') {
      const m = new THREE.Mesh(new THREE.CircleGeometry(h.r, 16), new THREE.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0.7, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      return m;
    }
    return itemMesh(h.kind === 'roots' ? 'roots' : 'peel');
  }

  updateHaz(m, h, dt, t) {
    m.position.set(h.x, h.y + (h.kind === 'fire' ? 0.08 : 0), h.z);
    if (h.kind === 'fire') {
      m.material.opacity = 0.5 + Math.sin(t * 20 + h.id) * 0.15;
      if (this.fx.ok() && Math.random() < 0.6) {
        this.fx.glow.emit({ x: h.x + (Math.random() - 0.5) * h.r * 1.6, y: h.y + 0.2, z: h.z + (Math.random() - 0.5) * h.r * 1.6, vx: 0, vy: 3 + Math.random() * 2, vz: 0, life: 0.45, size: [1.1, 0.2], color: [1, 0.55, 0.1, 0.9], color1: [1, 0.9, 0.3, 0] });
      }
    } else if (h.kind === 'roots') {
      m.rotation.y = h.id * 1.7;
      const grow = Math.min(1, (6 - h.life) * 5);
      m.scale.set(1, grow, 1);
    } else {
      m.rotation.y = h.id;
    }
  }

  makeEff(e) {
    if (e.kind === 'drone') return itemMesh('drone');
    if (e.kind === 'swap') {
      const g = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ map: TEX.ring(), color: '#c05bff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      g.userData.a = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), mat);
      g.userData.b = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), mat);
      g.userData.a.rotation.x = g.userData.b.rotation.x = -Math.PI / 2;
      g.add(g.userData.a, g.userData.b);
      return g;
    }
    return new THREE.Group();
  }

  updateEff(m, e, dt, t, karts) {
    if (e.kind === 'drone') {
      m.position.set(e.x, e.y + Math.sin(t * 6) * 0.15, e.z);
      m.rotation.y = t * 2;
    } else if (e.kind === 'swap') {
      const a = karts.get(e.owner), b = karts.get(e.target);
      if (a) { m.userData.a.position.set(a.x, a.y + 0.2, a.z); m.userData.a.rotation.z = t * 4; }
      if (b) { m.userData.b.position.set(b.x, b.y + 0.2, b.z); m.userData.b.rotation.z = -t * 4; }
      const s = 1 + Math.sin(t * 12) * 0.1;
      m.userData.a.scale.setScalar(s); m.userData.b.scale.setScalar(s);
    }
  }

  // --- one-shot visuals from events -------------------------------------------------
  ring(x, y, z, r, color, life = 0.5) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y + 0.3, z);
    this.group.add(m);
    this.rings.push({ m, r, life, t: 0 });
  }

  updateRings(dt) {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const R = this.rings[i];
      R.t += dt;
      const f = R.t / R.life;
      R.m.scale.setScalar(Math.max(0.01, R.r * Math.sqrt(f)));
      R.m.material.opacity = 0.85 * (1 - f);
      if (f >= 1) { R.m.removeFromParent(); R.m.geometry.dispose(); R.m.material.dispose(); this.rings.splice(i, 1); }
    }
  }

  burst(x, y, z, n, color, speed = 8, sys = 'glow', size = [0.8, 0.05]) {
    const fx = this.fx;
    for (let i = 0; i < n; i++) {
      fx[sys].emit({ x, y, z, vx: (Math.random() - 0.5) * speed, vy: Math.random() * speed * 0.7, vz: (Math.random() - 0.5) * speed, life: 0.5 + Math.random() * 0.3, size, color: [...color, 1], color1: [...color, 0], gravity: sys === 'chips' ? 14 : 2, drag: 2, spin: 8 });
    }
  }

  onEvent(e, state) {
    switch (e.type) {
      case 'itemBox': {
        const b = state.boxes[e.box];
        if (b) this.burst(b.x, b.y, b.z, 16, [1, 0.5, 0.9], 9, 'chips', [0.4, 0.2]);
        break;
      }
      case 'boxRespawn': this.boxAnim.set(e.box, this._t ?? 0); break;
      case 'coinPick': if (e.x !== undefined) this.burst(e.x, e.y, e.z, 8, [1, 0.85, 0.2], 5, 'glow', [0.6, 0.05]); break;
      case 'pop': this.burst(e.x, e.y, e.z, 14, e.kind === 'peel' ? [1, 0.9, 0.3] : [1, 0.6, 0.9], 8, 'chips', [0.35, 0.15]); break;
      case 'explosion':
        this.ring(e.x, e.y, e.z, e.r * 1.6, '#9fd0ff', 0.7);
        this.burst(e.x, e.y + 1, e.z, 40, [0.4, 0.6, 1], 18, 'glow', [2.5, 0.2]);
        this.burst(e.x, e.y + 1, e.z, 24, [1, 1, 1], 14, 'smoke', [2, 4]);
        break;
      case 'shock': {
        const col = { horn: '#ffd23f', eruption: '#ff7a1a', wave: '#3db4ff', emp: '#3de0ff', tunnel: '#b8793a' }[e.kind] || '#ffffff';
        this.ring(e.x, e.y, e.z, e.r, col, 0.55);
        if (e.kind === 'eruption') this.burst(e.x, e.y, e.z, 30, [1, 0.45, 0.1], 16, 'glow', [1.4, 0.1]);
        if (e.kind === 'wave') this.burst(e.x, e.y, e.z, 30, [0.5, 0.85, 1], 14, 'glow', [1, 0.1]);
        if (e.kind === 'tunnel') this.burst(e.x, e.y, e.z, 24, [0.55, 0.42, 0.28], 10, 'smoke', [1.5, 3]);
        break;
      }
      default: break;
    }
  }

  dispose() {
    this.group.removeFromParent();
    this.boxMat.dispose();
    this.bbMat.dispose();
    this.coinMat.dispose();
  }
}
