// Builds the visual track from the TrackWorld ribbons: road, kerbs, off-road,
// guard rails, island ledges/cliff skirts (or embankments), start line, pads,
// ramp overlays, scattered props (instanced) and landmarks.
import * as THREE from 'three';
import { TEX } from './textures.js';
import { THEMES } from './themes.js';
import { createToyMaterial } from './toyMaterial.js';
import { buildFigureTemplate, instantiateFigure } from './figure.js';
import { PROPS } from './propDefs.js';
import { makeRng, hashString } from '@shared/math.js';

const KERB = 1.3;

function hAt(world, R, i, L) {
  const r = world.rampAt(R, R.s[i], L, R.hw[i], {});
  return R.y[i] + L * R.bank[i] + r.h;
}

// Build a strip mesh along ribbon R. cols: [{ L(i), dy (num|fn), u, color? }]
function strip(world, R, cols, { include = () => true, vScale = 8, uvL = false, colors = null, mat = null, yOff = 0 } = {}) {
  const N = R.n;
  const segs = R.closed ? N : N - 1;
  const pos = [], uv = [], col = [], mt = [], idx = [];
  const nc = cols.length;
  const base = [];
  // vertices per sample (duplicate the first sample at the end for closed ribbons so v is continuous)
  const count = R.closed ? N + 1 : N;
  for (let ii = 0; ii < count; ii++) {
    const i = ii % N;
    const s = ii === N ? R.total : R.s[i];
    base.push(pos.length / 3);
    for (let c = 0; c < nc; c++) {
      const cd = cols[c];
      const L = cd.L(i);
      const dy = typeof cd.dy === 'function' ? cd.dy(i) : cd.dy || 0;
      const ground = cd.noRamp ? R.y[i] + L * R.bank[i] : hAt(world, R, i, L);
      const y = ground + dy + yOff;
      pos.push(R.x[i] + R.rx[i] * L, y, R.z[i] + R.rz[i] * L);
      uv.push(uvL ? L / vScale : cd.u, s / vScale);
      if (colors) {
        const cc = colors(i, c);
        col.push(cc[0], cc[1], cc[2]);
        mt.push(cc[3] || 0, cc[4] || 0);
      }
    }
  }
  for (let ii = 0; ii < segs; ii++) {
    if (!include(ii % N)) continue;
    const a0 = base[ii], a1 = base[ii + 1];
    for (let c = 0; c < nc - 1; c++) {
      const a = a0 + c, b = a0 + c + 1, cc = a1 + c, d = a1 + c + 1;
      idx.push(a, b, cc, b, d, cc);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (colors) {
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('mat', new THREE.Float32BufferAttribute(mt, 2));
  }
  g.setIndex(idx);
  g.computeVertexNormals();
  return mat ? new THREE.Mesh(g, mat) : g;
}

// mirror a right-side column profile to the left side (reverse order keeps winding)
function leftOf(cols) {
  return cols.map((c) => ({ ...c, L: (i) => -c.L(i) })).reverse();
}

const col3 = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };

export class TrackView {
  constructor(scene, world, opts = {}) {
    this.scene = scene;
    this.world = world;
    const def = world.def;
    const theme = { ...(THEMES[def.theme] || THEMES.skyland), ...(def.look || {}) };
    this.theme = theme;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.spinners = [];
    this.animTex = [];
    this.quality = opts.quality || { props: 1 };
    this.buildMaterials();
    for (const R of world.ribbons) this.buildRibbon(R);
    this.buildStartLine();
    this.buildPads();
    this.buildGround();
    this.buildScatter();
    this.buildLandmarks();
  }

  buildMaterials() {
    const t = this.theme;
    const tex = (tx, rep = 1) => { const c = tx.clone(); c.needsUpdate = true; c.repeat.set(rep, rep); return c; };
    const roadTex = t.roadTex === 'metal' ? TEX.metal(t.road) : t.roadTex === 'cobble' ? TEX.cobble(t.road) : TEX.asphalt(t.road);
    this.mats = {
      road: new THREE.MeshLambertMaterial({ map: tex(roadTex) }),
      branchRoad: new THREE.MeshLambertMaterial({ map: tex(roadTex), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      kerb: new THREE.MeshLambertMaterial({ map: tex(TEX.stripes(t.kerbA, t.kerbB, 2)), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      offroad: new THREE.MeshLambertMaterial({ map: tex(TEX.grass(t.grassA, t.grassB)) }),
      sand: new THREE.MeshLambertMaterial({ map: tex(TEX.sand(t.sand || '#e2c27a')) }),
      snow: new THREE.MeshLambertMaterial({ color: '#f4f8ff', map: tex(TEX.sand('#eef4ff')) }),
      lava: new THREE.MeshBasicMaterial({ map: tex(TEX.lava()) }),
      ice: new THREE.MeshLambertMaterial({ color: '#cdefff', map: tex(TEX.tiles('#e6f7ff', '#d2efff', '#b8e2f8')) }),
      metal: new THREE.MeshLambertMaterial({ map: tex(TEX.metal(t.metal || '#7a8292')) }),
      water: new THREE.MeshLambertMaterial({ color: '#4fb8ff', transparent: true, opacity: 0.85 }),
      checker: new THREE.MeshLambertMaterial({ map: tex(TEX.checker(8)), polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
      pad: new THREE.MeshBasicMaterial({ map: tex(TEX.chevrons()), transparent: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
      wood: new THREE.MeshLambertMaterial({ map: tex(TEX.planks(t.wood || '#a0703e')) }),
      rainbow: new THREE.MeshBasicMaterial({ map: tex(TEX.rainbow()), color: '#e8e8ff' }),
      cobble: new THREE.MeshLambertMaterial({ map: tex(TEX.cobble(t.cobble || '#6d6478')) }),
      toy: createToyMaterial(),
      toyDouble: createToyMaterial({ side: THREE.DoubleSide }),
    };
    this.mats.pad.map.wrapT = THREE.RepeatWrapping;
    this.animTex.push({ tex: this.mats.pad.map, speed: 1.8 });
    this.mats.lava.map.wrapS = this.mats.lava.map.wrapT = THREE.RepeatWrapping;
    this.animTex.push({ tex: this.mats.lava.map, speed: 0.05 });
  }

  surfMat(name) {
    return this.mats[name] || (name === 'road' ? this.mats.road : this.mats.offroad);
  }

  buildRibbon(R) {
    const w = this.world;
    const t = this.theme;
    const G = this.group;
    // collapsing bridges are drawn plank by plank by the hazard view
    const bridgeZones = R === w.main ? (w.hazards || []).filter((h) => h.type === 'collapse' && h.s0 !== undefined) : [];
    const inBridge = (i) => bridgeZones.some((h) => (h.s1 >= h.s0 ? R.s[i] >= h.s0 - 1 && R.s[i] <= h.s1 + 1 : R.s[i] >= h.s0 - 1 || R.s[i] <= h.s1 + 1));
    const notGap = (i) => !R.gap[i] && !R.gap[(i + 1) % R.n] && !(bridgeZones.length && (inBridge(i) || inBridge((i + 1) % R.n)));
    const isBranch = !R.closed;

    // road surface, grouped by surface type
    const roadSurfs = new Set(R.surf);
    for (const surf of roadSurfs) {
      const inc = (i) => notGap(i) && R.surf[i] === surf;
      const cols = [-1, -0.5, 0, 0.5, 1].map((f) => ({ L: (i) => f * R.hw[i], u: 0 }));
      const mat = surf === 'road' ? (isBranch ? this.mats.branchRoad : this.mats.road) : this.surfMat(surf);
      const m = strip(w, R, cols, { include: inc, vScale: 8, uvL: true, mat, yOff: isBranch ? 0.03 : 0 });
      G.add(m);
    }

    // kerbs on corners (and where forced)
    const curv = new Float64Array(R.n);
    for (let i = 0; i < R.n; i++) {
      const a = R.closed ? (i - 4 + R.n) % R.n : Math.max(0, i - 4), b = R.closed ? (i + 4) % R.n : Math.min(R.n - 1, i + 4);
      curv[i] = Math.abs(R.tx[a] * R.tz[b] - R.tz[a] * R.tx[b]);
    }
    const kerbOn = (i) => notGap(i) && !R.flags[i]?.noKerb && (curv[i] > 0.12 || R.flags[i]?.kerb) && R.surf[i] !== 'ice';
    for (const side of [1, -1]) {
      let cols = [
        { L: (i) => R.hw[i], dy: 0.02, u: 0 },
        { L: (i) => R.hw[i] + KERB, dy: 0.05, u: 1 },
      ];
      if (side < 0) cols = leftOf(cols);
      const g = strip(w, R, cols, { include: kerbOn, vScale: 3.2 });
      G.add(new THREE.Mesh(g, this.mats.kerb));
    }

    // off-road bands by surface
    const offSurfs = new Set(R.offSurf);
    for (const surf of offSurfs) {
      const inc = (i) => notGap(i) && R.offSurf[i] === surf && R.off[i] > 0.05;
      for (const side of [1, -1]) {
        let cols = [
          { L: (i) => R.hw[i], u: 0, noRamp: true },
          { L: (i) => R.hw[i] + R.off[i], u: 0, noRamp: true },
        ];
        if (side < 0) cols = leftOf(cols);
        G.add(strip(w, R, cols, { include: inc, vScale: 10, uvL: true, mat: this.surfMat(surf), yOff: isBranch ? 0.02 : -0.01 }));
      }
    }

    // guard rails
    const railC = col3(t.rail), trimC = col3(t.railTrim || '#ffffff');
    const railDark = railC.map((v) => v * 0.55);
    const neon = !!t.neonRails;
    for (const side of [1, -1]) {
      const wallFlag = side > 0 ? R.wallR : R.wallL;
      const inc = (i) => notGap(i) && wallFlag[i] && wallFlag[(i + 1) % R.n] && !R.flags[i]?.noRail && !R.flags[i]?.canyon;
      const e = (i) => R.hw[i] + R.off[i];
      let cols = [
        { L: (i) => e(i), dy: -0.3, u: 0, noRamp: true },
        { L: (i) => e(i), dy: 0.75, u: 0, noRamp: true },
        { L: (i) => e(i) + 0.05, dy: 1.05, u: 0, noRamp: true },
        { L: (i) => e(i) + 0.6, dy: 1.05, u: 0, noRamp: true },
        { L: (i) => e(i) + 0.6, dy: -0.8, u: 0, noRamp: true },
      ];
      const colorsR = [[...railDark, 0.3, 0], [...railC, 0.6, 0], [...trimC, 0.8, neon ? 1 : 0], [...trimC, 0.8, neon ? 1 : 0], [...railDark, 0.3, 0]];
      let colorFn = (i, c) => colorsR[c];
      if (side < 0) { cols = leftOf(cols); colorFn = (i, c) => colorsR[colorsR.length - 1 - c]; }
      G.add(strip(w, R, cols, { include: inc, colors: colorFn, mat: this.mats.toy }));
    }

    // canyon walls: tall leaning rock faces instead of rails
    if (R.flags.some((f) => f?.canyon)) {
      const rock = col3(t.cliff || '#c9a46c'), rockD = col3(t.cliffDark || '#8a6a40'), glow = col3(t.canyonGlow || t.cliff || '#c9a46c');
      const H = (i) => (typeof R.flags[i]?.canyon === 'number' ? R.flags[i].canyon : 9);
      for (const side of [1, -1]) {
        const wallFlag = side > 0 ? R.wallR : R.wallL;
        const e = (i) => R.hw[i] + R.off[i];
        let cols = [
          { L: (i) => e(i), dy: -0.3, u: 0, noRamp: true },
          { L: (i) => e(i) + 0.4, dy: 0.6, u: 0, noRamp: true },
          { L: (i) => e(i) + 1.6, dy: (i) => H(i) * 0.45, u: 0, noRamp: true },
          { L: (i) => e(i) + 2.4 + H(i) * 0.3, dy: (i) => H(i), u: 0, noRamp: true },
          { L: (i) => e(i) + 8 + H(i) * 0.5, dy: (i) => H(i) * 1.05, u: 0, noRamp: true },
        ];
        const colors = [[...glow, 0.2, t.canyonGlow ? 1 : 0], [...rockD, 0, 0], [...rock, 0, 0], [...rock, 0, 0], [...rockD, 0, 0]];
        let colorFn = (i, c) => colors[c];
        if (side < 0) { cols = leftOf(cols); colorFn = (i, c) => colors[colors.length - 1 - c]; }
        G.add(strip(w, R, cols, { include: (i) => notGap(i) && R.flags[i]?.canyon && wallFlag[i], colors: colorFn, mat: this.mats.toy }));
      }
    }

    // tunnels: an arched tube over the road
    if (R.flags.some((f) => f?.tunnel)) {
      const c1 = col3(t.tunnel || t.cliffDark || '#6a4a2a'), c2 = col3(t.tunnelLight || t.rail || '#ffd23f');
      const cols = [];
      const n = 9;
      for (let k = 0; k <= n; k++) {
        const a = Math.PI * (k / n);
        cols.push({ L: (i) => -Math.cos(a) * (R.hw[i] + R.off[i] + 0.8), dy: (i) => Math.sin(a) * 8 + 0.1, u: 0, noRamp: true });
      }
      const colorFn = (i, c) => (c === 4 || c === 5 ? (Math.floor(R.s[i] / 10) % 2 ? [...c2, 0.2, 1] : [...c1, 0, 0]) : [...c1, 0, 0]);
      G.add(strip(w, R, cols, { include: (i) => R.flags[i]?.tunnel && R.flags[(i + 1) % R.n]?.tunnel, colors: colorFn, mat: this.mats.toyDouble }));
    }

    // island ledge + cliff skirt (floating islands) or embankment down to the ground plane
    {
      const under = t.under || 'island';
      const ledge = under === 'island' ? (t.ledge ?? 12) : 0;
      const grass = col3(t.grassA), rock = col3(t.cliff || '#c9a46c'), rockD = col3(t.cliffDark || '#8a6a40');
      for (const side of [1, -1]) {
        const wallFlag = side > 0 ? R.wallR : R.wallL;
        const e = (i) => R.hw[i] + R.off[i] + (wallFlag[i] ? 0.6 : 0);
        const lw = (i) => (wallFlag[i] && !R.flags[i]?.cliff ? ledge : 0);
        const inc = (i) => notGap(i) && !R.flags[i]?.junction && !R.flags[i]?.bridge;
        let cols, colors;
        if (under === 'island') {
          const depth = t.skirtDepth ?? 22;
          cols = [
            { L: (i) => e(i), dy: -0.02, u: 0, noRamp: true },
            { L: (i) => e(i) + lw(i), dy: -0.05, u: 0, noRamp: true },
            { L: (i) => e(i) + lw(i) + 1.2, dy: -1.2, u: 0, noRamp: true },
            { L: (i) => e(i) + lw(i) * 0.8, dy: -depth * 0.45, u: 0, noRamp: true },
            { L: (i) => (e(i) + lw(i)) * 0.35, dy: -depth, u: 0, noRamp: true },
          ];
          colors = [[...grass, 0, 0], [...grass, 0, 0], [...rock, 0, 0], [...rock, 0, 0], [...rockD, 0, 0]];
        } else {
          const gy = this.world.minY - 0.6;
          cols = [
            { L: (i) => e(i), dy: -0.02, u: 0, noRamp: true },
            { L: (i) => e(i) + 1.5, dy: (i) => Math.min(-0.4, gy - (R.y[i] + (e(i) + 1.5) * R.bank[i] * side)), u: 0, noRamp: true },
            { L: (i) => e(i) + 3 + Math.max(0, R.y[i] - gy) * 1.2, dy: (i) => gy - (R.y[i] + (e(i) + 3) * R.bank[i] * side) - 0.3, u: 0, noRamp: true },
          ];
          colors = [[...grass, 0, 0], [...rock, 0, 0], [...rockD, 0, 0]];
        }
        let colorFn = (i, c) => colors[c];
        if (side < 0) { cols = leftOf(cols); colorFn = (i, c) => colors[colors.length - 1 - c]; }
        G.add(strip(w, R, cols, { include: inc, colors: colorFn, mat: this.mats.toy }));
      }
      // underside of the road slab (visible from jumps / below); bridges get a deck edge
      const isBridge = (i) => !!R.flags[i]?.bridge;
      if (under === 'island' || R.flags.some((f) => f?.bridge)) {
        const edge = (i) => R.hw[i] + R.off[i] + ((R.wallR[i] || R.wallL[i]) ? 0.6 : 0);
        const cols = [
          { L: (i) => edge(i), dy: -0.1, u: 0, noRamp: true },
          { L: (i) => edge(i), dy: (i) => (isBridge(i) ? -1.4 : -0.1), u: 0, noRamp: true },
          { L: (i) => -edge(i), dy: (i) => (isBridge(i) ? -1.4 : -0.1), u: 0, noRamp: true },
          { L: (i) => -edge(i), dy: -0.1, u: 0, noRamp: true },
        ];
        const dark = [...col3(t.cliffDark || '#8a6a40'), 0, 0], deck = [...col3(t.bridge || t.rail), 0.4, 0];
        const cf = (i, c) => (isBridge(i) && (c === 0 || c === 3) ? deck : dark);
        G.add(strip(w, R, cols, { include: (i) => notGap(i) && (under === 'island' || isBridge(i)), colors: cf, mat: this.mats.toy }));
        // support pillars under bridges
        const pil = [];
        for (let i = 0; i < R.n; i += 12) if (isBridge(i) && notGap(i)) pil.push(i);
        if (pil.length) {
          const g = new THREE.CylinderGeometry(1.1, 1.5, 1, 8);
          g.translate(0, -0.5, 0);
          const pc = col3(t.pillar || t.cliff || '#c9a46c');
          g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(0).flatMap(() => pc), 3));
          const im = new THREE.InstancedMesh(g, this.mats.toy, pil.length);
          const d = new THREE.Object3D();
          const gy = under === 'island' ? null : this.world.minY - 0.9;
          pil.forEach((i, k) => {
            const top = R.y[i] - 1.3;
            d.position.set(R.x[i], top, R.z[i]);
            d.scale.set(1, gy === null ? 60 : Math.max(0.5, top - gy), 1);
            d.updateMatrix();
            im.setMatrixAt(k, d.matrix);
          });
          im.computeBoundingSphere();
          G.add(im);
        }
      }
    }

    // ramp overlays (boost ramps get chevrons, others yellow/black edge stripes)
    for (const r of R.ramps) {
      const i0 = Math.floor(((r.s0 % w.length) + w.length) % w.length / R.step);
      const n = Math.ceil((r.s1 - r.s0) / R.step) + 1;
      const set = new Set();
      for (let k = 0; k < n; k++) set.add((i0 + k) % R.n);
      const cols = [0, 0.5, 1].map((f) => ({ L: (i) => (r.lanes[0] + (r.lanes[1] - r.lanes[0]) * f) * R.hw[i], dy: 0.04, u: f }));
      const m = strip(w, R, cols, { include: (i) => set.has(i) && set.has((i + 1) % R.n), vScale: 4, mat: r.boost ? this.mats.pad : this.mats.kerb });
      G.add(m);
      // lip face (front edge block) so ramps read as solid
      const lipMat = this.mats.toy;
      const j = (i0 + n - 1) % R.n;
      const L0 = r.lanes[0] * R.hw[j], L1 = r.lanes[1] * R.hw[j];
      const h0 = hAt(w, R, j, 0);
      const box = new THREE.BoxGeometry(L1 - L0, Math.max(0.3, h0 - R.y[j] + 0.2), 0.6);
      const colArr = [];
      const c = col3(r.boost ? '#ff9a1e' : '#ffd23f');
      for (let q = 0; q < box.attributes.position.count; q++) colArr.push(...c);
      box.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
      const lip = new THREE.Mesh(box, lipMat);
      const mid = (L0 + L1) / 2;
      lip.position.set(R.x[j] + R.rx[j] * mid, (h0 + R.y[j]) / 2 - 0.1, R.z[j] + R.rz[j] * mid);
      lip.rotation.y = Math.atan2(R.tx[j], R.tz[j]);
      G.add(lip);
    }
  }

  buildStartLine() {
    const w = this.world;
    const R = w.main;
    const i0 = Math.floor(w.startS / R.step);
    const set = new Set([i0, (i0 + 1) % R.n]);
    const cols = [-1, 1].map((f, k) => ({ L: (i) => f * R.hw[i], dy: 0.03, u: k * (R.hw[i0] * 2) / 3 }));
    const g = strip(w, R, cols, { include: (i) => set.has(i) && i === i0, vScale: 3 });
    this.group.add(new THREE.Mesh(g, this.mats.checker));
  }

  buildPads() {
    for (const p of this.world.placements.pads) {
      const g = new THREE.PlaneGeometry(p.w, p.len);
      const m = new THREE.Mesh(g, this.mats.pad);
      m.rotation.set(-Math.PI / 2, 0, p.yaw + Math.PI);
      m.position.set(p.x, p.y + 0.05, p.z);
      // align to bank roughly by sampling the heights across
      this.group.add(m);
    }
  }

  buildGround() {
    const t = this.theme;
    const w = this.world;
    const R = w.main;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < R.n; i++) {
      minX = Math.min(minX, R.x[i]); maxX = Math.max(maxX, R.x[i]);
      minZ = Math.min(minZ, R.z[i]); maxZ = Math.max(maxZ, R.z[i]);
    }
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const size = Math.max(maxX - minX, maxZ - minZ) + 900;
    if ((t.under || 'island') === 'island') {
      // sea of clouds far below
      const g = new THREE.PlaneGeometry(size * 2, size * 2);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: t.cloudSea || '#e8f6ff', fog: true }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(cx, w.minY - 90, cz);
      this.group.add(m);
    } else {
      const tex = (t.groundTex === 'lava' ? TEX.lava() : t.groundTex === 'metal' ? TEX.metal(t.ground || '#6a7282') : TEX.grass(t.grassA, t.grassB)).clone();
      tex.needsUpdate = true;
      tex.repeat.set(size / 14, size / 14);
      const mat = t.groundTex === 'lava' ? new THREE.MeshBasicMaterial({ map: tex }) : new THREE.MeshLambertMaterial({ map: tex, color: t.groundTint || '#ffffff' });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(cx, w.minY - 0.9, cz);
      this.group.add(m);
      if (t.groundTex === 'lava') this.animTex.push({ tex, speed: 0.02 });
    }
  }

  // Instanced scatter props along the main ribbon edges.
  buildScatter() {
    const w = this.world, R = w.main, t = this.theme;
    const rng = makeRng(hashString(w.def.id || 'track'));
    const under = t.under || 'island';
    const ledge = under === 'island' ? (t.ledge ?? 12) : 60;
    const byType = new Map();
    const tmp = {};
    for (const sc of w.def.scatter || []) {
      const def = PROPS[sc.type];
      if (!def) { console.warn('[track] unknown scatter prop', sc.type); continue; }
      const step = 1 / Math.max(0.001, sc.density * (this.quality.props ?? 1));
      for (let s = rng() * step; s < w.length; s += step * (0.6 + rng() * 0.8)) {
        const i = Math.floor(s / R.step) % R.n;
        const side = rng() < 0.5 ? -1 : 1;
        const wallFlag = side > 0 ? R.wallR[i] : R.wallL[i];
        const floating = sc.dy !== undefined;
        if (!floating && under === 'island' && (!wallFlag || R.flags[i]?.cliff || R.flags[i]?.junction)) continue;
        const maxD = floating ? sc.dist[1] : Math.min(sc.dist[1], ledge - 1.5);
        if (maxD <= sc.dist[0]) continue;
        const d = sc.dist[0] + rng() * (maxD - sc.dist[0]);
        const L = side * (R.hw[i] + R.off[i] + 0.6 + d);
        const x = R.x[i] + R.rx[i] * L, z = R.z[i] + R.rz[i] * L;
        // don't drop props onto any drivable ribbon
        let blocked = false;
        for (const O of w.ribbons) { if (w.claim(O, x, z, R.y[i], -1, tmp)) { blocked = true; break; } }
        if (blocked) continue;
        let y = floating ? R.y[i] + sc.dy + (rng() - 0.5) * 10 : R.y[i] + (R.hw[i] + R.off[i]) * R.bank[i] * side;
        if (!floating && under !== 'island') {
          // follow the embankment down to the ground plane
          const gy = w.minY - 0.9;
          const slopeW = 3 + Math.max(0, R.y[i] - gy) * 1.2;
          y = d + 0.6 >= slopeW ? gy : y + (gy - y) * ((d + 0.6) / slopeW);
        }
        const list = byType.get(sc.type) || [];
        list.push({ x, y, z, rot: rng() * Math.PI * 2, s: (sc.scale || 1) * (0.75 + rng() * 0.5) });
        byType.set(sc.type, list);
      }
    }
    const dummy = new THREE.Object3D();
    for (const [type, list] of byType) {
      const tpl = buildFigureTemplate(this.themedProp(type), { key: `prop:${type}:${this.world.def.theme}`, detail: 0.3 });
      const im = new THREE.InstancedMesh(tpl.geometry, this.mats.toy, list.length);
      list.forEach((p, k) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, p.rot, 0);
        dummy.scale.setScalar(p.s);
        dummy.updateMatrix();
        im.setMatrixAt(k, dummy.matrix);
      });
      im.computeBoundingSphere();
      this.group.add(im);
    }
  }

  themedProp(type) {
    const base = PROPS[type];
    const over = this.theme.propPalettes?.[type];
    return over ? { ...base, palette: { ...base.palette, ...over } } : base;
  }

  buildLandmarks() {
    const w = this.world;
    const t = this.theme;
    for (const lm of w.def.landmarks || []) {
      const def = PROPS[lm.type];
      if (!def) { console.warn('[track] unknown landmark', lm.type); continue; }
      const p = w.at(lm.t, lm.lane || 0, lm.ribbon || 0, lm.dy || 0);
      const tpl = buildFigureTemplate(this.themedProp(lm.type), { key: `lm:${lm.type}:${w.def.theme}`, detail: 0.6 });
      const fig = instantiateFigure(tpl, { outline: true });
      fig.mesh.position.set(p.x, p.y, p.z);
      fig.mesh.rotation.y = p.yaw + (lm.rot || 0);
      fig.mesh.scale.setScalar(lm.scale || 1);
      this.group.add(fig.mesh);
      if (fig.bones.spin) this.spinners.push({ bone: fig.bones.spin, speed: lm.spin ?? 1.2 });
      if (lm.type === 'startArch') this.addBanner(fig.mesh, def);
      // floating landmarks off the track get their own little island
      const offTrack = Math.abs(lm.lane || 0) > 1.2;
      if (offTrack && (t.under || 'island') === 'island' && !lm.dy) {
        const it = buildFigureTemplate(PROPS.island, { key: 'prop:island', detail: 0.5 });
        const isl = instantiateFigure(it, { outline: false });
        isl.mesh.position.set(p.x, p.y, p.z);
        this.group.add(isl.mesh);
      }
    }
  }

  addBanner(parent) {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2f6fe0'; ctx.fillRect(0, 0, 1024, 128);
    ctx.font = '96px "Lilita One", "Arial Black", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 10; ctx.strokeStyle = '#1a1426';
    const text = this.world.def.bannerText || 'SKYKART';
    for (const x of [256, 768]) { ctx.strokeText(text, x, 70); ctx.fillStyle = '#ffd23f'; ctx.fillText(text, x, 70); }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    for (const zs of [1, -1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(28, 2.6), new THREE.MeshBasicMaterial({ map: tex }));
      m.position.set(0, 10, 0.62 * zs);
      if (zs < 0) m.rotation.y = Math.PI;
      parent.add(m);
    }
  }

  update(dt, t) {
    for (const a of this.animTex) a.tex.offset.y = -t * a.speed;
    for (const s of this.spinners) s.bone.rotation.z = t * s.speed;
  }

  dispose() {
    this.group.traverse((o) => { if (o.geometry && !o.isSkinnedMesh) o.geometry.dispose(); });
    this.group.removeFromParent();
    for (const m of Object.values(this.mats)) m.dispose();
  }
}
