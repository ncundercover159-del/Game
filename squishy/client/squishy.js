// The squishy: an irregular mochi blob with a dot face. All the softness is
// faked with springs on a few nested transforms — idle breathing, a continuous
// hop-bounce while moving, squash on landing with overshoot, directional
// flattening on bumps, and the deliberate pancake "big squish".

import * as THREE from 'three';
import { EV } from '../shared/physics.js';
import { addRim, glowTexture } from './util.js';

export const COLORS = [
  { body: '#f7b3c5', rim: '#ffd6c8', blush: '#ff8fa8', name: 'Mochi' },
  { body: '#a9d58e', rim: '#f4f0b0', blush: '#ff9f9a', name: 'Matcha' },
];

function blobGeometry(seed) {
  const g = new THREE.IcosahedronGeometry(0.47, 3);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    // gentle low-frequency lumps so it never reads as a perfect sphere
    const lump = 1 + 0.035 * Math.sin(n.x * 3.1 + seed) * Math.sin(n.y * 2.3 + seed * 2) + 0.025 * Math.sin(n.z * 4.2 + seed * 3);
    v.multiplyScalar(lump);
    v.y *= 0.9;
    if (v.y < -0.2) v.y = -0.2 + (v.y + 0.2) * 0.45; // soft flat bottom
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeBoundingBox();
  g.translate(0, -g.boundingBox.min.y, 0);
  g.computeVertexNormals();
  return g;
}

const eyeGeo = new THREE.SphereGeometry(0.066, 12, 8);
const shineGeo = new THREE.SphereGeometry(0.022, 6, 4);
const inkMat = new THREE.MeshBasicMaterial({ color: '#2d2320' });
const shineMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const shadowTex = glowTexture('rgba(40,25,20,0.55)', 'rgba(40,25,20,0)');

export class Squishy {
  constructor(scene, slot) {
    const c = COLORS[slot];
    this.slot = slot;
    this.root = new THREE.Group();
    this.dir = new THREE.Group();     // rotated to the last contact normal
    this.flat = new THREE.Group();    // scaled along that normal
    this.undir = new THREE.Group();
    this.yawG = new THREE.Group();
    this.hopG = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.dir); this.dir.add(this.flat); this.flat.add(this.undir);
    this.undir.add(this.yawG); this.yawG.add(this.hopG); this.hopG.add(this.body);

    const mat = addRim(new THREE.MeshStandardMaterial({ color: c.body, roughness: 0.55, metalness: 0 }), c.rim, 0.55, 2.2);
    this.mat = mat;
    const mesh = new THREE.Mesh(blobGeometry(slot * 2.7 + 1), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.body.add(mesh);

    // face
    const face = new THREE.Group();
    face.position.set(0, 0.43, 0.39);
    face.rotation.x = -0.12;
    this.eyes = [];
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, inkMat);
      eye.position.set(sx * 0.14, 0, 0);
      eye.scale.set(0.9, 1.15, 0.5);
      const shine = new THREE.Mesh(shineGeo, shineMat);
      shine.position.set(0.018, 0.022, 0.045);
      eye.add(shine);
      face.add(eye);
      this.eyes.push(eye);
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.055, 14), new THREE.MeshBasicMaterial({ color: c.blush, transparent: true, opacity: 0.55, depthWrite: false }));
      blush.position.set(sx * 0.225, -0.07, -0.02);
      blush.rotation.y = sx * 0.55;
      blush.scale.y = 0.6;
      face.add(blush);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 6, 12, Math.PI), inkMat);
    mouth.rotation.z = Math.PI;
    mouth.position.set(0, -0.06, 0.01);
    face.add(mouth);
    this.mouth = mouth;
    this.body.add(face);
    this.face = face;

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.renderOrder = 1;
    this.shadow = shadow;
    scene.add(shadow);
    scene.add(this.root);

    // animation state
    this.s = 1; this.sv = 0;          // vertical squash spring
    this.f = 1; this.fv = 0;          // contact flatten spring
    this.hop = 0; this.hopAmp = 0;
    this.yaw = 0;
    this.groundY = 0;
    this.blinkT = 2 + Math.random() * 3;
    this.lean = 0;
    this.state = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, g: 1, sqd: 0 };
    this.onHop = null;
    this.visible = true;
  }

  setVisible(v) { this.root.visible = v; this.shadow.visible = v; }

  setState(s) {
    const st = this.state;
    st.x = s.x; st.y = s.y; st.z = s.z; st.vx = s.vx; st.vy = s.vy; st.vz = s.vz;
    st.yaw = s.yaw; st.g = s.g; st.sqd = s.sqd;
  }

  // Physics events -> springs.
  event(ev, info = {}) {
    if (ev & EV.LAND) this.sv -= Math.min(9, 2 + (info.land || 6) * 0.55);
    if (ev & EV.BUMP) {
      const a = Math.atan2(info.bx || 0, info.bz || 1);
      this.dir.rotation.y = a; this.undir.rotation.y = -a;
      this.fv -= 5.5;
    }
    if (ev & EV.SPRING) { this.sv += 7; this.hopAmp = 0; }
    if (ev & EV.SQUISH) this.sv -= 3;
  }

  // Being bounced on by the partner.
  pressed() { this.sv -= 6; }

  update(dt, t) {
    const st = this.state;
    const speed = Math.hypot(st.vx, st.vz);
    const moving = st.g && speed > 0.4 && !st.sqd;

    // continuous small hop-bounce while rolling along
    const targetAmp = moving ? Math.min(1, speed / 4) : 0;
    this.hopAmp += (targetAmp - this.hopAmp) * Math.min(1, dt * 8);
    if (this.hopAmp > 0.02) {
      const prev = Math.floor(this.hop / Math.PI);
      this.hop += dt * (7 + speed * 1.3);
      if (Math.floor(this.hop / Math.PI) !== prev && this.onHop && moving) this.onHop(this.hopAmp);
    } else this.hop = 0;
    const h = Math.abs(Math.sin(this.hop));
    const hopY = h * 0.2 * this.hopAmp;
    const hopStretch = 1 + (h - 0.35) * 0.2 * this.hopAmp;

    // vertical squash spring (overshoots on release -> classic squash & stretch)
    let target = 1 + Math.sin(t * 2.2 + this.slot * 1.7) * 0.025; // breathing
    if (st.sqd) target = 0.3;
    else if (!st.g) target = st.vy > 0 ? 1.22 : 1.06;
    const k = st.sqd ? 420 : 300, c = st.sqd ? 22 : 12;
    // semi-implicit substeps keep the springs stable on slow frames
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h2 = dt / n;
    for (let i = 0; i < n; i++) {
      this.sv += ((target - this.s) * k - this.sv * c) * h2;
      this.s += this.sv * h2;
      // contact flatten spring (~150ms back to round)
      this.fv += ((1 - this.f) * 520 - this.fv * 24) * h2;
      this.f += this.fv * h2;
    }
    this.s = Math.max(0.2, Math.min(1.6, this.s));
    this.f = Math.max(0.55, Math.min(1.3, this.f));

    const sy = this.s * hopStretch;
    const sxz = 1 / Math.sqrt(Math.max(0.2, sy));
    this.body.scale.set(sxz * (st.sqd ? 1.1 : 1), sy, sxz * (st.sqd ? 1.1 : 1));
    // flatten along the contact axis (local z after the dir rotation), bulge the rest
    const bulge = 1 / Math.sqrt(this.f);
    this.flat.scale.set(bulge, bulge, this.f);

    // facing (shortest-arc smoothing); after idling a moment, turn to say hi
    // to the camera so the face shows
    this.idle = moving || !st.g || speed > 0.2 ? 0 : (this.idle || 0) + dt;
    const faceYaw = this.idle > 1.6 ? Math.PI : st.yaw;
    let d = faceYaw - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * (this.idle > 1.6 ? 4 : 12));
    this.yawG.rotation.y = this.yaw;
    this.lean += ((moving ? 0.14 * this.hopAmp : 0) - this.lean) * Math.min(1, dt * 8);
    this.hopG.rotation.x = this.lean;
    this.hopG.position.y = hopY;

    // blink; happy squint when squished
    this.blinkT -= dt;
    let eyeY = 1.15;
    if (this.blinkT < 0) { eyeY = 0.12; if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 4; }
    if (st.sqd) eyeY = 0.25;
    for (const e of this.eyes) e.scale.y += (eyeY - e.scale.y) * Math.min(1, dt * 30);
    this.mouth.scale.setScalar(st.sqd ? 1.5 : !st.g ? 1.3 : 1);

    this.root.position.set(st.x, st.y, st.z);
    if (st.g) this.groundY = st.y;
    const above = Math.max(0, st.y - this.groundY);
    this.shadow.position.set(st.x, this.groundY + 0.03, st.z);
    const ss = Math.max(0.35, 1 - above * 0.18) * (st.sqd ? 1.35 : 1);
    this.shadow.scale.set(ss, ss, 1);
    this.shadow.material.opacity = Math.max(0.2, 1 - above * 0.2);
  }

  setDusk(d) {
    const r = this.mat.userData.rim;
    if (r) r.uRimStrength.value = 0.55 + d * 0.35;
  }
}
