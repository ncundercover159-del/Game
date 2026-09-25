// Gradient sky dome with a sun disc, plus puffy billboard clouds.
import * as THREE from 'three';
import { makeRng } from '@shared/math.js';
import { TEX } from './textures.js';

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w; // always at the far plane
}`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uStars;
uniform float uTime;
varying vec3 vDir;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.65, h), 0.8)) : mix(uHorizon, uBottom, smoothstep(0.0, -0.3, h));
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunColor * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.25);
  if (uStars > 0.0 && h > 0.05) {
    vec3 q = floor(d * 220.0);
    float st = step(0.9965, hash(q)) * (0.6 + 0.4 * sin(uTime * 2.0 + hash(q + 3.0) * 20.0));
    col += vec3(st) * uStars * smoothstep(0.05, 0.3, h);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class Sky {
  constructor(scene, theme) {
    this.uniforms = {
      uTop: { value: new THREE.Color(theme.skyTop || '#3f8fe8') },
      uHorizon: { value: new THREE.Color(theme.skyHorizon || '#bfe6ff') },
      uBottom: { value: new THREE.Color(theme.skyBottom || '#8fb9e0') },
      uSunDir: { value: new THREE.Vector3(...(theme.sunDir || [0.4, 0.55, 0.3])).normalize() },
      uSunColor: { value: new THREE.Color(theme.sunColor || '#fff4d6') },
      uStars: { value: theme.stars || 0 },
      uTime: { value: 0 },
    };
    const geo = new THREE.SphereGeometry(900, 24, 16);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    scene.add(this.mesh);

    // clouds: sprites in a ring around the world
    this.clouds = new THREE.Group();
    const n = theme.clouds ?? 26;
    if (n > 0) {
      const tex = TEX.soft();
      const rng = makeRng(42);
      const cloudColor = new THREE.Color(theme.cloudColor || '#ffffff');
      for (let i = 0; i < n; i++) {
        const puff = new THREE.Group();
        const a = rng() * Math.PI * 2;
        const r = 380 + rng() * 260;
        puff.position.set(Math.cos(a) * r, (theme.cloudHeight ?? 60) + rng() * 120, Math.sin(a) * r);
        const k = 3 + Math.floor(rng() * 4);
        for (let j = 0; j < k; j++) {
          const sm = new THREE.SpriteMaterial({ map: tex, color: cloudColor, transparent: true, opacity: theme.cloudOpacity ?? 0.95, depthWrite: false, fog: false });
          const sp = new THREE.Sprite(sm);
          const s = 50 + rng() * 60;
          sp.scale.set(s * 1.6, s, 1);
          sp.position.set((j - k / 2) * 30 + rng() * 10, rng() * 16, rng() * 20);
          puff.add(sp);
        }
        this.clouds.add(puff);
      }
      scene.add(this.clouds);
    }
  }

  update(camera, t) {
    this.mesh.position.copy(camera.position);
    this.uniforms.uTime.value = t;
    this.clouds.rotation.y = t * 0.004;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
