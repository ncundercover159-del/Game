// Visuals for everything the server animates: floor switches, the pond ring,
// stepping stones, rising stairs, the five gates, the shrine bell, fireflies.

import * as THREE from 'three';
import {
  PLATES, CIRCLE, GATES, GATE_IDS, STONES, STAIRS, TERRACE, BELL, SHRINE,
  FIREFLIES, fireflyPos, halfWidthAt, mulberry32,
} from '../shared/level.js';
import { stoneTop } from '../shared/physics.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Batcher, std, canvasTex, glowTexture, clamp01 } from './util.js';

const PLATE_IDS = Object.keys(PLATES);

// Collapse a group's direct mesh children into one mesh per material.
function mergeChildren(group) {
  const byMat = new Map();
  for (const c of [...group.children]) {
    if (!c.isMesh || c.children.length) continue;
    c.updateMatrix();
    const g = (c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone()).applyMatrix4(c.matrix);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!byMat.has(c.material)) byMat.set(c.material, []);
    byMat.get(c.material).push(g);
    group.remove(c);
  }
  for (const [mat, geos] of byMat) {
    const m = new THREE.Mesh(mergeGeometries(geos, false), mat);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }
  return group;
}

export function buildPuzzles(scene, M) {
  const rand = mulberry32(5);
  const api = {};
  const view = { open: {}, stairs: 0, stones: 0 };
  for (const id of GATE_IDS) view.open[id] = 0;

  // ---- floor switches ---------------------------------------------------------------
  const runeTex = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#fff'; g.lineWidth = 7;
    g.beginPath(); g.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 5;
    g.beginPath(); g.arc(w / 2, h / 2, w * 0.24, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.beginPath(); g.arc(w / 2 + Math.cos(a) * w * 0.32, h / 2 + Math.sin(a) * h * 0.32, 4, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
    }
  }, { srgb: true });
  const plates = {};
  for (const id of PLATE_IDS) {
    const p = PLATES[id];
    const grp = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r + 0.12, 0.14, 24), std('#9a9588'));
    base.position.y = 0.07;
    base.receiveShadow = true;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(p.r - 0.12, p.r - 0.08, 0.06, 24), std('#b7b1a2'));
    top.position.y = 0.16;
    top.receiveShadow = true;
    const runeMat = new THREE.MeshBasicMaterial({ map: runeTex, color: '#ffd28a', transparent: true, opacity: 0.35, depthWrite: false });
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(p.r * 1.8, p.r * 1.8), runeMat);
    rune.rotation.x = -Math.PI / 2;
    rune.position.y = 0.2;
    grp.add(base, top, rune);
    grp.position.set(p.x, p.y, p.z);
    scene.add(grp);
    plates[id] = { grp, top, runeMat, glow: 0, press: 0 };
  }

  // pond ring: little stones in a circle + a glowing band
  const ringMat = new THREE.MeshBasicMaterial({ color: '#9ff0e0', transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide });
  {
    const ring = new THREE.Mesh(new THREE.RingGeometry(CIRCLE.r - 0.18, CIRCLE.r, 48), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(CIRCLE.x, 0.04, CIRCLE.z);
    scene.add(ring);
    const b = new Batcher();
    const pebble = new THREE.DodecahedronGeometry(0.16, 0);
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      b.put(pebble, M.stone, CIRCLE.x + Math.cos(a) * (CIRCLE.r + 0.2), 0.06, CIRCLE.z + Math.sin(a) * (CIRCLE.r + 0.2), { ry: rand() * 3, sy: 0.6 });
    }
    b.build(scene);
  }

  // ---- stepping stones ---------------------------------------------------------------
  const stones = [];
  for (const s of STONES) {
    const geo = new THREE.CylinderGeometry(s.r * 0.95, s.r * 1.05, 2.4, 10);
    geo.translate(0, -1.2, 0);
    const m = new THREE.Mesh(geo, rand() < 0.5 ? M.stone : M.stoneDark);
    const mossCap = new THREE.Mesh(new THREE.CylinderGeometry(s.r * 0.7, s.r * 0.8, 0.05, 10), M.moss);
    mossCap.position.set((rand() - 0.5) * 0.3, 0.005, (rand() - 0.5) * 0.3);
    m.add(mossCap);
    m.position.set(s.x, 0, s.z);
    m.rotation.y = rand() * 3;
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    stones.push(m);
  }
  // expanding ripple rings as stones break the surface
  const ripples = [];
  const rippleGeo = new THREE.RingGeometry(0.9, 1.0, 32);
  for (const s of STONES) {
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
    const r = new THREE.Mesh(rippleGeo, mat);
    r.rotation.x = -Math.PI / 2;
    r.position.set(s.x, -0.32, s.z);
    r.renderOrder = 4;
    scene.add(r);
    ripples.push({ mesh: r, t: 9 });
  }

  // ---- stairs up to the terrace ------------------------------------------------------------
  const stairMeshes = [];
  {
    const d = (STAIRS.z1 - STAIRS.z0) / STAIRS.n;
    for (let i = 0; i < STAIRS.n; i++) {
      const h = ((i + 1) / STAIRS.n) * TERRACE.h;
      const geo = new THREE.BoxGeometry(STAIRS.x1 - STAIRS.x0, h, STAIRS.z1 - (STAIRS.z0 + i * d));
      geo.translate(0, -h / 2, 0);
      const m = new THREE.Mesh(geo, i % 2 ? M.stone : M.stoneDark);
      m.position.set((STAIRS.x0 + STAIRS.x1) / 2, 0, (STAIRS.z0 + i * d + STAIRS.z1) / 2);
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
      stairMeshes.push({ m, h });
    }
  }

  // ---- gates -----------------------------------------------------------------------------------
  const gates = {};
  const questionTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#2b2623'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2d18a'; g.font = 'bold 84px "Hiragino Mincho ProN", "Yu Mincho", serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('問', w / 2, h / 2 + 4);
  });
  const plaqueMat = new THREE.MeshStandardMaterial({ map: questionTex, roughness: 0.7 });

  const fence = (b, g, kind) => {
    const hw = halfWidthAt(g.z);
    const y = g.y;
    const matPost = kind === 'bamboo' ? M.woodLight : kind === 'stone' ? M.stone : kind === 'wood' ? M.wood : M.vermilion;
    for (const sx of [-1, 1]) {
      const x0 = g.dw, x1 = hw;
      if (kind === 'stone') {
        b.put(new THREE.BoxGeometry(x1 - x0, 1.5, 0.7), M.stoneDark, sx * (x0 + x1) / 2, y + 0.75, g.z);
        b.put(new THREE.BoxGeometry(x1 - x0 + 0.1, 0.18, 0.85), M.moss, sx * (x0 + x1) / 2, y + 1.55, g.z);
        b.put(new THREE.BoxGeometry(0.8, 3.2, 0.8), M.stone, sx * (g.dw + 0.4), y + 1.6, g.z);
        b.put(new THREE.ConeGeometry(0.62, 0.5, 4), M.stoneDark, sx * (g.dw + 0.4), y + 3.45, g.z, { ry: Math.PI / 4 });
        continue;
      }
      for (let x = x0; x <= x1 + 0.01; x += kind === 'bamboo' ? 0.22 : 1.1) {
        if (kind === 'bamboo') b.put(new THREE.CylinderGeometry(0.07, 0.07, 2.4 + rand() * 0.5, 6), M.woodLight, sx * x, y + 1.25, g.z);
        else b.put(new THREE.BoxGeometry(0.18, 1.5, 0.18), matPost, sx * x, y + 0.75, g.z);
      }
      if (kind !== 'bamboo') {
        b.put(new THREE.BoxGeometry(x1 - x0, 0.12, 0.1), matPost, sx * (x0 + x1) / 2, y + 1.25, g.z);
        b.put(new THREE.BoxGeometry(x1 - x0, 0.12, 0.1), matPost, sx * (x0 + x1) / 2, y + 0.6, g.z);
      } else {
        b.put(new THREE.CylinderGeometry(0.06, 0.06, x1 - x0, 6), M.rope, sx * (x0 + x1) / 2, y + 1.9, g.z, { rz: Math.PI / 2 });
      }
      // door posts
      b.put(new THREE.BoxGeometry(0.3, kind === 'rope' || kind === 'torii' ? 1.6 : 2.8, 0.3), matPost, sx * (g.dw + 0.15), y + (kind === 'rope' || kind === 'torii' ? 0.8 : 1.4), g.z);
    }
  };

  const fenceBatch = new Batcher();
  for (const id of GATE_IDS) {
    const g = GATES[id];
    if (id !== 'tg2') fence(fenceBatch, g, g.kind);
    else {
      // torii: low tamagaki fence either side
      const hw = halfWidthAt(g.z);
      for (const sx of [-1, 1]) {
        for (let x = g.dw + 0.4; x <= hw; x += 0.8) fenceBatch.put(new THREE.BoxGeometry(0.14, 1.2, 0.14), M.vermilion, sx * x, g.y + 0.6, g.z);
        fenceBatch.put(new THREE.BoxGeometry(hw - g.dw, 0.1, 0.12), M.vermilion, sx * (hw + g.dw) / 2, g.y + 1.05, g.z);
        fenceBatch.put(new THREE.BoxGeometry(hw - g.dw, 0.1, 0.12), M.vermilion, sx * (hw + g.dw) / 2, g.y + 0.5, g.z);
      }
    }
    const door = new THREE.Group();
    door.position.set(0, g.y, g.z);
    scene.add(door);
    const gate = { door, kind: g.kind, parts: [] };
    if (g.kind === 'wood') {
      for (const sx of [-1, 1]) {
        const hinge = new THREE.Group();
        hinge.position.x = sx * g.dw;
        const leaf = new THREE.Group();
        for (let i = 0; i < 5; i++) {
          const plank = new THREE.Mesh(new THREE.BoxGeometry(g.dw / 5 - 0.04, 2.2, 0.12), M.wood);
          plank.position.set(-sx * (g.dw / 5) * (i + 0.5), 1.15, 0);
          plank.castShadow = true;
          leaf.add(plank);
        }
        for (const y of [0.5, 1.8]) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(g.dw, 0.14, 0.16), M.woodLight);
          bar.position.set(-sx * g.dw / 2, y, 0.08);
          leaf.add(bar);
        }
        hinge.add(mergeChildren(leaf));
        door.add(hinge);
        gate.parts.push({ hinge, sx });
      }
    } else if (g.kind === 'bamboo') {
      const lattice = new THREE.Group();
      for (let x = -g.dw; x <= g.dw + 0.01; x += 0.26) {
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), M.woodLight);
        s.position.set(x, 1.3, 0);
        s.castShadow = true;
        lattice.add(s);
      }
      for (const y of [0.6, 1.4, 2.2]) {
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, g.dw * 2 + 0.3, 6), M.rope);
        r.rotation.z = Math.PI / 2; r.position.set(0, y, 0.08);
        lattice.add(r);
      }
      door.add(mergeChildren(lattice));
      gate.parts.push({ lattice });
    } else if (g.kind === 'stone') {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(g.dw * 2, 2.6, 0.5), M.stone);
      slab.position.y = 1.3;
      slab.castShadow = slab.receiveShadow = true;
      const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), plaqueMat);
      plaque.rotation.y = Math.PI;
      plaque.position.set(0, 0.3, -0.26);
      slab.add(plaque);
      const rope = new THREE.Mesh(new THREE.TorusGeometry(g.dw * 1.1, 0.07, 6, 24, Math.PI), M.rope);
      rope.rotation.z = Math.PI; rope.position.set(0, 2.9, -0.3); rope.scale.y = 0.25;
      door.add(slab, rope);
      gate.parts.push({ slab, rope });
    } else {
      // shimenawa rope with paper shide, plus a hanging 問 plaque
      const grp = new THREE.Group();
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-g.dw, 1.35, 0), new THREE.Vector3(-g.dw / 2, 0.95, 0), new THREE.Vector3(0, 0.85, 0),
        new THREE.Vector3(g.dw / 2, 0.95, 0), new THREE.Vector3(g.dw, 1.35, 0),
      ]);
      const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.12, 8), M.rope);
      rope.castShadow = true;
      grp.add(rope);
      for (let i = 1; i < 6; i++) {
        const p = curve.getPoint(i / 6);
        const shide = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.5), M.paper);
        shide.position.set(p.x, p.y - 0.35, p.z);
        grp.add(shide);
      }
      mergeChildren(grp);
      const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.06), [M.black, M.black, M.black, M.black, M.black, plaqueMat]);
      plaque.position.set(0, 0.35, -0.05);
      grp.add(plaque);
      door.add(grp);
      gate.parts.push({ grp });
    }
    gates[id] = gate;
  }
  fenceBatch.build(scene);

  // timer gate countdown lamp (a lantern on the post that dims as time runs out)
  const timerLamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffcc66', emissiveIntensity: 0 }));
  timerLamp.position.set(GATES.timer.dw + 0.15, 3.05, GATES.timer.z - 0.2);
  scene.add(timerLamp);

  // ---- bell (suzu) + rope ------------------------------------------------------------------------
  const bell = new THREE.Group();
  bell.position.set(BELL.x, TERRACE.h + 5.0, SHRINE.z0 - 0.9);
  {
    const suzu = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), M.gold);
    suzu.castShadow = true;
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.2), M.black);
    slit.position.set(0, -0.12, -0.28);
    suzu.add(slit);
    const ropeTex = canvasTex(32, 256, (g, w, h) => {
      for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#f3efe6' : '#c93a2b'; g.fillRect(0, i * 16, w, 16); }
    });
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 3.1, 8), new THREE.MeshStandardMaterial({ map: ropeTex, roughness: 0.9 }));
    rope.position.y = -1.9;
    const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.35, 8), std('#c93a2b'));
    tassel.position.y = -3.55;
    bell.add(suzu, rope, tassel);
  }
  scene.add(bell);
  let bellSwing = 0, bellV = 0;

  // ---- fireflies ------------------------------------------------------------------------------------
  const ffGeo = new THREE.BufferGeometry();
  const ffPos = new Float32Array(FIREFLIES.length * 3);
  const ffAlpha = new Float32Array(FIREFLIES.length);
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  ffGeo.setAttribute('alpha', new THREE.BufferAttribute(ffAlpha, 1));
  const ffMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uMap: { value: glowTexture('rgba(255,245,170,1)', 'rgba(255,200,80,0)') }, uScale: { value: 300 } },
    vertexShader: `attribute float alpha; varying float vA; uniform float uScale;
      void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = uScale * 0.55 / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D uMap; varying float vA; void main(){ vec4 c = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(c.rgb * vec3(1.0, 0.95, 0.6), c.a * vA); }`,
  });
  const fireflies = new THREE.Points(ffGeo, ffMat);
  fireflies.frustumCulled = false;
  scene.add(fireflies);
  const ffCaught = new Float32Array(FIREFLIES.length); // burst timer after being caught

  // ambient fireflies for the dusk finale (not catchable)
  const AMB = 40;
  const ambGeo = new THREE.BufferGeometry();
  const ambPos = new Float32Array(AMB * 3), ambA = new Float32Array(AMB);
  const ambData = Array.from({ length: AMB }, () => ({ x: (rand() - 0.5) * 30, z: 150 + rand() * 56, y: TERRACE.h + 0.5 + rand() * 4, ph: rand() * 6, sp: 0.2 + rand() * 0.4 }));
  ambGeo.setAttribute('position', new THREE.BufferAttribute(ambPos, 3));
  ambGeo.setAttribute('alpha', new THREE.BufferAttribute(ambA, 1));
  const amb = new THREE.Points(ambGeo, ffMat);
  amb.frustumCulled = false;
  scene.add(amb);

  // ---- update ------------------------------------------------------------------------------------------
  const tmp = { x: 0, y: 0, z: 0 };
  api.view = view;
  api.catchFirefly = (i) => { ffCaught[i] = 0.001; };
  api.ringBell = (strength = 1) => { bellV += 2.8 * strength; };
  api.stonesRipple = () => { for (const r of ripples) r.t = 0; };

  api.update = (dt, t, snap, meta, serverT, dusk, localPlayers, pixelRatio) => {
    // smooth server values
    if (snap) {
      const w = snap.w;
      GATE_IDS.forEach((id, i) => { view.open[id] += (w[i] - view.open[id]) * Math.min(1, dt * 10); });
      view.stairs += (w[5] - view.stairs) * Math.min(1, dt * 10);
      view.stones += (w[6] - view.stones) * Math.min(1, dt * 10);
    }
    const flags = meta?.flags;

    // plates
    PLATE_IDS.forEach((id, bit) => {
      const p = plates[id];
      const pressed = snap ? (snap.pm >> bit) & 1 : 0;
      p.press += ((pressed ? 1 : 0) - p.press) * Math.min(1, dt * 14);
      let solved = false;
      if (flags) {
        if (id === 'f1' || id === 'f2') solved = flags.forest;
        else if (id === 'c1' || id === 'c2') solved = flags.court;
        else if (id === 'stairs') solved = flags.stairs;
        else if (id === 'timer') solved = flags.timerLatched || (snap && snap.tm > 0);
        else if (id === 'pondFar') solved = snap && snap.sh > 0;
      }
      const target = solved ? 1 : 0.3 + 0.2 * Math.sin(t * 2 + bit);
      p.glow += (Math.max(target, p.press) - p.glow) * Math.min(1, dt * 6);
      p.runeMat.opacity = 0.15 + p.glow * 0.8;
      p.runeMat.color.set(solved ? '#ffd27a' : '#fff2d6');
      p.top.position.y = 0.16 - p.press * 0.06;
    });

    // pond ring brightens with each squishy inside
    let inside = 0;
    for (const lp of localPlayers) { const dx = lp.x - CIRCLE.x, dz = lp.z - CIRCLE.z; if (dx * dx + dz * dz < CIRCLE.r * CIRCLE.r) inside++; }
    ringMat.opacity = 0.18 + inside * 0.22 + (snap && snap.sh > 0 ? 0.25 : 0) + Math.sin(t * 2) * 0.05;

    // stones
    const top = stoneTop(view.stones);
    stones.forEach((m, i) => {
      m.position.y = top + Math.sin(t * 1.3 + i) * 0.015 * view.stones;
      m.visible = view.stones > 0.01;
    });
    for (const r of ripples) {
      r.t += dt;
      const u = r.t / 1.6;
      r.mesh.material.opacity = u < 1 ? (1 - u) * 0.5 : 0;
      r.mesh.scale.setScalar(1 + u * 1.2);
    }

    // stairs rise from the ground
    for (const s of stairMeshes) {
      s.m.position.y = s.h * view.stairs;
      s.m.visible = view.stairs > 0.01;
    }

    // gates
    for (const id of GATE_IDS) {
      const o = view.open[id];
      const e = o * o * (3 - 2 * o);
      const gate = gates[id];
      if (gate.kind === 'wood') {
        for (const p of gate.parts) p.hinge.rotation.y = p.sx * e * 1.7;
      } else if (gate.kind === 'bamboo') {
        gate.parts[0].lattice.position.y = e * 3.0;
      } else if (gate.kind === 'stone') {
        gate.parts[0].slab.position.y = 1.3 - e * 2.75;
        gate.parts[0].rope.visible = e < 0.2;
      } else {
        const grp = gate.parts[0].grp;
        grp.position.y = e * 5.5;
        grp.rotation.z = Math.sin(t * 1.5 + id.length) * 0.02 * (1 - e);
        grp.visible = e < 0.98;
      }
    }

    // timer lamp
    const tm = snap ? snap.tm : 0;
    timerLamp.material.emissiveIntensity = tm > 0 ? (tm / 15) * 2.5 * (tm < 4 ? 0.6 + 0.4 * Math.sin(t * 12) : 1) : 0;

    // bell swing
    bellV += (-bellSwing * 30 - bellV * 1.8) * dt;
    bellSwing += bellV * dt;
    bell.rotation.x = bellSwing * 0.25;
    bell.rotation.z = Math.sin(t * 0.7) * 0.01;

    // fireflies
    const mask = meta ? meta.ff : 0;
    const visFF = clamp01(0.35 + dusk);
    for (let i = 0; i < FIREFLIES.length; i++) {
      fireflyPos(i, serverT, tmp);
      const caught = (mask >> i) & 1;
      let a = visFF * (0.55 + 0.45 * Math.sin(t * 3 + i * 1.7));
      if (caught) {
        if (ffCaught[i] === 0) ffCaught[i] = 10; // caught before we saw it
        ffCaught[i] += dt;
        const u = ffCaught[i] / 0.8;
        a = u < 1 ? (1 - u) * 1.5 : 0;
        tmp.y += ffCaught[i] * 2;
      }
      ffPos[i * 3] = tmp.x; ffPos[i * 3 + 1] = tmp.y; ffPos[i * 3 + 2] = tmp.z;
      ffAlpha[i] = a;
    }
    ffGeo.attributes.position.needsUpdate = true;
    ffGeo.attributes.alpha.needsUpdate = true;
    ffMat.uniforms.uScale.value = 300 * pixelRatio;

    const ambVis = clamp01((dusk - 0.3) / 0.4);
    amb.visible = ambVis > 0;
    if (amb.visible) {
      ambData.forEach((f, i) => {
        const a = t * f.sp + f.ph;
        ambPos[i * 3] = f.x + Math.sin(a) * 1.2; ambPos[i * 3 + 1] = f.y + Math.sin(a * 1.3) * 0.5; ambPos[i * 3 + 2] = f.z + Math.cos(a * 0.7) * 1.2;
        ambA[i] = ambVis * (0.4 + 0.6 * Math.max(0, Math.sin(t * 2.2 + i * 2.3)));
      });
      ambGeo.attributes.position.needsUpdate = true;
      ambGeo.attributes.alpha.needsUpdate = true;
    }
  };

  api.reset = () => {
    ffCaught.fill(0);
    for (const id of GATE_IDS) view.open[id] = 0;
    view.stairs = 0; view.stones = 0;
  };

  return api;
}

