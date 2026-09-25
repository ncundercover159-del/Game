// Screen-space speed lines + vignette: a full-screen quad drawn last.
import * as THREE from 'three';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform float uAmount;
uniform float uAspect;
uniform vec3 uTint;
uniform float uInk;
uniform float uBlind;
uniform float uDamage;
varying vec2 vUv;
float hash(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  float r = length(p);
  float a = atan(p.y, p.x);
  float seg = floor(a * 42.0 / 6.2831 * 3.0);
  float h = hash(seg * 13.1);
  float speed = fract(h * 7.0 + uTime * (1.6 + h * 1.5));
  float streak = smoothstep(0.02, 0.0, abs(fract(a * 42.0 / 6.2831 * 3.0) - 0.5) - 0.18);
  float band = smoothstep(speed - 0.25, speed, r * 0.9) * smoothstep(speed + 0.05, speed, r * 0.9);
  float lines = streak * band * step(0.45, h) * smoothstep(0.25, 0.7, r) * uAmount;
  vec3 col = uTint;
  float alpha = lines * 0.55;
  // ink: dark blobs
  if (uInk > 0.0) {
    float blob = 0.0;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      vec2 c = vec2(hash(fi * 3.1) - 0.5, hash(fi * 5.7) - 0.5) * vec2(uAspect, 1.0) * 0.9;
      blob = max(blob, smoothstep(0.24 + 0.08 * hash(fi), 0.12, length(p - c)));
    }
    col = mix(col, vec3(0.05, 0.02, 0.1), blob * uInk);
    alpha = max(alpha, blob * uInk * 0.96);
  }
  if (uBlind > 0.0) {
    col = mix(col, vec3(1.0, 0.98, 0.9), uBlind);
    alpha = max(alpha, uBlind * (0.6 + 0.4 * smoothstep(0.0, 0.6, 1.0 - r)));
  }
  if (uDamage > 0.0) {
    float v = smoothstep(0.35, 0.8, r) * uDamage;
    col = mix(col, vec3(1.0, 0.15, 0.1), v);
    alpha = max(alpha, v * 0.5);
  }
  gl_FragColor = vec4(col, alpha);
}`;

export class ScreenFx {
  constructor() {
    this.uniforms = {
      uTime: { value: 0 }, uAmount: { value: 0 }, uAspect: { value: 1.8 },
      uTint: { value: new THREE.Color(1, 1, 1) }, uInk: { value: 0 }, uBlind: { value: 0 }, uDamage: { value: 0 },
    };
    const m = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthTest: false, depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 100;
  }
  update(dt, { amount = 0, aspect = 1.8, ink = 0, blind = 0, damage = 0 }) {
    const u = this.uniforms;
    u.uTime.value += dt;
    u.uAmount.value += (amount - u.uAmount.value) * Math.min(1, dt * 8);
    u.uAspect.value = aspect;
    u.uInk.value = ink;
    u.uBlind.value = blind;
    u.uDamage.value = damage;
    this.mesh.visible = u.uAmount.value > 0.01 || ink > 0 || blind > 0 || damage > 0;
  }
}
