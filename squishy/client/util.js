// Small rendering helpers: procedural canvas textures, a static geometry
// batcher (merges props into one mesh per material), and wind sway.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const shared = { time: { value: 0 } };

export function canvasTex(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function rnd(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function speckle(g, w, h, base, colors, n, size, r = Math.random) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(r() * colors.length) | 0];
    g.globalAlpha = 0.25 + r() * 0.5;
    const s = size * (0.4 + r());
    g.beginPath(); g.ellipse(r() * w, r() * h, s, s * (0.5 + r() * 0.6), r() * 3, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}

export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  return canvasTex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, inner); gr.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.6)')); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

// Collects (geometry, material, matrix) triples and bakes one mesh per
// material per 36 m slice of the level, so off-screen slices get culled (for
// the camera and the shadow pass alike).
export const CHUNK = 36;
export class Batcher {
  constructor() { this.groups = new Map(); }
  add(geo, mat, matrix) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.applyMatrix4(matrix);
    g.computeBoundingBox();
    const chunk = Math.floor((g.boundingBox.min.z + g.boundingBox.max.z) / 2 / CHUNK);
    let bucket = this.groups.get(mat);
    if (!bucket) this.groups.set(mat, (bucket = new Map()));
    if (!bucket.has(chunk)) bucket.set(chunk, []);
    bucket.get(chunk).push(g);
    return this;
  }
  // convenience: add at position / rotation / scale
  put(geo, mat, x, y, z, { rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(sx, sy, sz),
    );
    return this.add(geo, mat, m);
  }
  // all geometries for one material, merged (ignores chunks)
  merged(mat) {
    const all = [...this.groups.get(mat).values()].flat();
    return mergeGeometries(all, false);
  }
  build(parent, { cast = true, receive = true } = {}) {
    const meshes = [];
    for (const [mat, bucket] of this.groups) {
      for (const geos of bucket.values()) {
        const merged = mergeGeometries(geos, false);
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = cast; mesh.receiveShadow = receive;
        mesh.matrixAutoUpdate = false;
        parent.add(mesh);
        meshes.push(mesh);
        for (const g of geos) g.dispose();
      }
    }
    this.groups.clear();
    return meshes;
  }
}

// Split instances into z-slices so each InstancedMesh gets a tight bounding
// sphere and can be frustum-culled. `list` items need a `z`; `fill(im, i, item)`
// writes matrix/colour for the item at index i of that slice.
export function chunkedInstances(parent, geo, mat, list, fill, { cast = true, receive = true } = {}) {
  const slices = new Map();
  for (const it of list) {
    const c = Math.floor(it.z / CHUNK);
    if (!slices.has(c)) slices.set(c, []);
    slices.get(c).push(it);
  }
  const meshes = [];
  for (const items of slices.values()) {
    const im = new THREE.InstancedMesh(geo, mat, items.length);
    items.forEach((it, i) => fill(im, i, it));
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = cast; im.receiveShadow = receive;
    im.userData.items = items;
    parent.add(im);
    meshes.push(im);
  }
  return meshes;
}

// Wind sway applied after instancing, scaled by height above the instance
// origin (so tall bamboo tips move most). Works for Mesh and InstancedMesh.
export function addSway(material, { amp = 0.02, speed = 1.3, rootY = 0 } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.time;
    shader.uniforms.uSwayAmp = { value: amp };
    shader.uniforms.uSwaySpeed = { value: speed };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uSwayAmp; uniform float uSwaySpeed;')
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4( transformed, 1.0 );
        vec3 swayRoot = vec3(0.0, ${rootY.toFixed(3)}, 0.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          swayRoot = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #endif
        vec4 swayWorld = modelMatrix * mvPosition;
        float swayH = max(swayWorld.y - swayRoot.y, 0.0);
        float swayPh = swayRoot.x * 0.37 + swayRoot.z * 0.23;
        float swayT = uTime * uSwaySpeed;
        swayWorld.x += (sin(swayT + swayPh) * 0.6 + sin(swayT * 2.3 + swayPh * 1.7) * 0.25) * swayH * swayH * uSwayAmp;
        swayWorld.z += (cos(swayT * 0.8 + swayPh) * 0.4) * swayH * swayH * uSwayAmp;
        mvPosition = viewMatrix * swayWorld;
        gl_Position = projectionMatrix * mvPosition;
      `);
  };
  material.customProgramCacheKey = () => `sway${amp}${speed}${rootY}`;
  return material;
}

// Warm fresnel rim, used on the squishies and koi.
export function addRim(material, color = '#ffd9a8', strength = 0.6, power = 2.4) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    if (prev) prev(shader, r);
    shader.uniforms.uRimColor = { value: new THREE.Color(color) };
    shader.uniforms.uRimStrength = { value: strength };
    material.userData.rim = shader.uniforms;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor; uniform float uRimStrength;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float rimF = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), ${power.toFixed(2)});
        totalEmissiveRadiance += uRimColor * rimF * uRimStrength;`);
  };
  const prevKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => (prevKey ? prevKey() : '') + `rim${power}`;
  return material;
}

export function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...opts });
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
