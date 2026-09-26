// Skid marks: a ring buffer of thin quads laid behind the rear wheels while
// drifting, braking hard or boosting off a drift. One draw call for everyone.
import * as THREE from 'three';

const MAX = 1800;          // quads
const HALF_W = 0.16;       // mark half width (m)

export class SkidMarks {
  constructor(scene) {
    this.pos = new Float32Array(MAX * 4 * 3);
    this.alpha = new Float32Array(MAX * 4);
    const idx = new Uint32Array(MAX * 6);
    for (let i = 0; i < MAX; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 1, i * 4 + 3, i * 4 + 2], i * 6);
    const g = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aAttr = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posAttr);
    g.setAttribute('alpha', this.aAttr);
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      uniforms: { uColor: { value: new THREE.Color('#1a1418') } },
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor, vA * 0.55); }',
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.next = 0;
    this.last = new Map(); // kart id -> [left, right] previous wheel points
  }

  // k: kart view state. Called every frame per kart.
  update(k) {
    const marking = k.grounded && Math.abs(k.speed) > 7 && (k.drift || k.spin > 0 || (k.surface === 'road' && Math.abs(k.lat || 0) > 4)) && !k.rescue;
    if (!marking) { this.last.delete(k.id); return; }
    const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
    const rx = -fz, rz = fx;
    const back = -0.75, side = 0.62;
    const y = k.y + 0.03;
    const cur = [-1, 1].map((sd) => [k.x + fx * back + rx * side * sd, y, k.z + fz * back + rz * side * sd]);
    const prev = this.last.get(k.id);
    this.last.set(k.id, cur);
    if (!prev) return;
    for (let w = 0; w < 2; w++) {
      const a = prev[w], b = cur[w];
      const dx = b[0] - a[0], dz = b[2] - a[2];
      const len = Math.hypot(dx, dz);
      if (len < 0.05 || len > 6) continue;
      const nx = (-dz / len) * HALF_W, nz = (dx / len) * HALF_W;
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      const p = this.pos, o = i * 12;
      p[o] = a[0] + nx; p[o + 1] = a[1]; p[o + 2] = a[2] + nz;
      p[o + 3] = a[0] - nx; p[o + 4] = a[1]; p[o + 5] = a[2] - nz;
      p[o + 6] = b[0] + nx; p[o + 7] = b[1]; p[o + 8] = b[2] + nz;
      p[o + 9] = b[0] - nx; p[o + 10] = b[1]; p[o + 11] = b[2] - nz;
      const al = k.drift ? 0.9 : 0.6;
      this.alpha.fill(al, i * 4, i * 4 + 4);
      this.dirty = true;
    }
  }

  // fade everything slowly so old marks disappear; upload changes once per frame
  flush(dt) {
    this.fadeT = (this.fadeT || 0) + dt;
    if (this.fadeT > 0.5) {
      this.fadeT = 0;
      const a = this.alpha;
      for (let i = 0; i < a.length; i++) if (a[i] > 0) a[i] = Math.max(0, a[i] - 0.012);
      this.dirty = true;
    }
    if (this.dirty) { this.posAttr.needsUpdate = true; this.aAttr.needsUpdate = true; this.dirty = false; }
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
