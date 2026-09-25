// Pooled CPU-simulated particles drawn as one Points object per system.
// Each particle: position, velocity, life, size curve, colour curve, gravity, drag.
import * as THREE from 'three';
import { TEX } from './textures.js';

const VERT = /* glsl */ `
attribute float aSize;
attribute vec4 aColor;
attribute float aSpin;
varying vec4 vColor;
varying float vSpin;
uniform float uScale;
uniform float uMaxSize;
#include <fog_pars_vertex>
void main() {
  vColor = aColor;
  vSpin = aSpin;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = min(uMaxSize, aSize * uScale / max(0.5, -mvPosition.z));
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uShape;
varying vec4 vColor;
varying float vSpin;
#include <fog_pars_fragment>
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float c = cos(vSpin), s = sin(vSpin);
  uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y) + 0.5;
  float a;
  if (uShape > 0.5) {
    // confetti / leaf chips: squares squashed by spin
    vec2 q = abs(uv - 0.5);
    a = step(q.x, 0.42) * step(q.y, 0.22);
  } else {
    a = texture2D(uMap, uv).a;
  }
  gl_FragColor = vec4(vColor.rgb, vColor.a * a);
  if (gl_FragColor.a < 0.01) discard;
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export class ParticleSystem {
  constructor(scene, { max = 800, additive = false, shape = 'soft' } = {}) {
    this.max = max;
    this.count = 0;
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.size1 = new Float32Array(max);
    this.c0 = new Float32Array(max * 4);
    this.c1 = new Float32Array(max * 4);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.spin = new Float32Array(max);
    this.spinV = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.aColor = new THREE.BufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aSpin = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.aPos);
    this.geo.setAttribute('aSize', this.aSize);
    this.geo.setAttribute('aColor', this.aColor);
    this.geo.setAttribute('aSpin', this.aSpin);
    this.geo.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        ...THREE.UniformsLib.fog,
        uMap: { value: TEX.soft() },
        uScale: { value: 300 },
        uMaxSize: { value: 60 },
        uShape: { value: shape === 'square' ? 1 : 0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      fog: true,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 5 : 4;
    scene.add(this.points);
    this.budget = 1;
  }

  setViewport(heightPx, fovDeg = 60) {
    this.mat.uniforms.uScale.value = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
    this.mat.uniforms.uMaxSize.value = heightPx * 0.12;
  }

  // o: { x,y,z, vx,vy,vz, life, size:[a,b], color:[r,g,b,a] , color1, gravity, drag, spin }
  emit(o) {
    if (this.count >= this.max) return;
    const i = this.count++;
    this.p[i * 3] = o.x; this.p[i * 3 + 1] = o.y; this.p[i * 3 + 2] = o.z;
    this.v[i * 3] = o.vx || 0; this.v[i * 3 + 1] = o.vy || 0; this.v[i * 3 + 2] = o.vz || 0;
    this.life[i] = this.maxLife[i] = o.life || 1;
    const s = o.size || [1, 0];
    this.size0[i] = s[0]; this.size1[i] = s[1];
    const c0 = o.color || [1, 1, 1, 1];
    const c1 = o.color1 || [c0[0], c0[1], c0[2], 0];
    for (let k = 0; k < 4; k++) { this.c0[i * 4 + k] = c0[k] ?? 1; this.c1[i * 4 + k] = c1[k] ?? 0; }
    this.grav[i] = o.gravity || 0;
    this.drag[i] = o.drag || 0;
    this.spin[i] = o.spin0 ?? Math.random() * 6.28;
    this.spinV[i] = o.spin || 0;
  }

  update(dt) {
    let n = this.count;
    const P = this.aPos.array, S = this.aSize.array, C = this.aColor.array, R = this.aSpin.array;
    for (let i = 0; i < n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // swap-remove
        n--;
        this.copy(n, i);
        i--;
        continue;
      }
      const d = Math.exp(-this.drag[i] * dt);
      this.v[i * 3] *= d; this.v[i * 3 + 1] = this.v[i * 3 + 1] * d - this.grav[i] * dt; this.v[i * 3 + 2] *= d;
      this.p[i * 3] += this.v[i * 3] * dt;
      this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt;
      this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      this.spin[i] += this.spinV[i] * dt;
      const t = 1 - this.life[i] / this.maxLife[i];
      P[i * 3] = this.p[i * 3]; P[i * 3 + 1] = this.p[i * 3 + 1]; P[i * 3 + 2] = this.p[i * 3 + 2];
      S[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * t;
      for (let k = 0; k < 4; k++) C[i * 4 + k] = this.c0[i * 4 + k] + (this.c1[i * 4 + k] - this.c0[i * 4 + k]) * t;
      R[i] = this.spin[i];
    }
    this.count = n;
    this.geo.setDrawRange(0, n);
    this.aPos.needsUpdate = this.aSize.needsUpdate = this.aColor.needsUpdate = this.aSpin.needsUpdate = true;
    this.aPos.clearUpdateRanges?.();
  }

  copy(from, to) {
    for (let k = 0; k < 3; k++) { this.p[to * 3 + k] = this.p[from * 3 + k]; this.v[to * 3 + k] = this.v[from * 3 + k]; }
    for (let k = 0; k < 4; k++) { this.c0[to * 4 + k] = this.c0[from * 4 + k]; this.c1[to * 4 + k] = this.c1[from * 4 + k]; }
    this.life[to] = this.life[from]; this.maxLife[to] = this.maxLife[from];
    this.size0[to] = this.size0[from]; this.size1[to] = this.size1[from];
    this.grav[to] = this.grav[from]; this.drag[to] = this.drag[from];
    this.spin[to] = this.spin[from]; this.spinV[to] = this.spinV[from];
  }

  clear() { this.count = 0; this.geo.setDrawRange(0, 0); }

  dispose() {
    this.points.removeFromParent();
    this.geo.dispose();
    this.mat.dispose();
  }
}

// Convenience bundle: additive glow, normal smoke/dust, square confetti.
export class Effects {
  constructor(scene) {
    this.glow = new ParticleSystem(scene, { max: 1000, additive: true });
    this.spark = new ParticleSystem(scene, { max: 1000 });
    this.smoke = new ParticleSystem(scene, { max: 900 });
    this.chips = new ParticleSystem(scene, { max: 700, shape: 'square' });
    this.all = [this.glow, this.spark, this.smoke, this.chips];
    this.budget = 1;
  }
  setBudget(b) { this.budget = b; }
  // chance-based throttle for low quality
  ok() { return this.budget >= 1 || Math.random() < this.budget; }
  setViewport(h, fov) { for (const s of this.all) s.setViewport(h, fov); }
  update(dt) { for (const s of this.all) s.update(dt); }
  clear() { for (const s of this.all) s.clear(); }
  dispose() { for (const s of this.all) s.dispose(); }
}
