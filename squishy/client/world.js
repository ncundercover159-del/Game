// Static scenery, lighting, sky and fog for the five zones, plus the cosmetic
// systems that live in them (bamboo sway, koi, god rays, falling leaves).

import * as THREE from 'three';
import {
  ZONES, TERRACE, POND, SQUEEZE, STONES, FOREST_TRUNKS, GROVE_STALKS, LANTERNS_POND,
  LANTERNS_APPROACH, LANTERNS_COURT, KOMAINU, TORII, SHRINE, POLES, halfWidthAt, mulberry32,
} from '../shared/level.js';
import { Batcher, chunkedInstances, canvasTex, speckle, addSway, addRim, std, shared, lerp, clamp01 } from './util.js';

const SEASONS = {
  autumn: {
    canopy: ['#d8452b', '#e5702f', '#c7351f', '#efa03a', '#b93328', '#e48b3c'],
    leaf: '#e0662f', leaf2: '#c9402a',
    grass: '#b3a860', grassTips: ['#c8b86a', '#a99a4c', '#d69a46'],
    ground: '#a3a862',
  },
  spring: {
    canopy: ['#f6c3d1', '#f1abc0', '#fbd8e2', '#e89db6', '#f8e1e8', '#f3b8c9'],
    leaf: '#f8c6d4', leaf2: '#fbe3ea',
    grass: '#98b865', grassTips: ['#a6c56e', '#86a655', '#b7cf7d'],
    ground: '#9dba6b',
  },
};

const DAY = {
  sun: new THREE.Color('#ffc58c'), sunI: 2.7,
  sky: new THREE.Color('#ffe3c2'), grd: new THREE.Color('#6e6a3a'), hemiI: 1.15,
  fog: new THREE.Color('#f1c9a0'), fogD: 0.0135,
  top: new THREE.Color('#8fb3d6'), hor: new THREE.Color('#ffd1a1'),
  rim: new THREE.Color('#ffd2b0'),
};
const DUSK = {
  sun: new THREE.Color('#ff7f55'), sunI: 0.95,
  sky: new THREE.Color('#8f7fb6'), grd: new THREE.Color('#3b2d3a'), hemiI: 0.75,
  fog: new THREE.Color('#7f6a8c'), fogD: 0.019,
  top: new THREE.Color('#27305a'), hor: new THREE.Color('#f2956f'),
  rim: new THREE.Color('#ff9f8a'),
};

export const SUN_DIR = new THREE.Vector3(-0.55, 0.42, -0.72).normalize(); // towards the sun

export function groundY(x, z) {
  return Math.abs(x) < 16 && z > TERRACE.z0 && z < 212 ? TERRACE.h : 0;
}

export function buildWorld(scene, renderer) {
  const rand = mulberry32(99);
  const world = { dusk: 0, season: null };
  const updaters = [];

  // ---- sky, fog, lights -------------------------------------------------------
  scene.fog = new THREE.FogExp2(DAY.fog.clone(), DAY.fogD);
  scene.background = DAY.fog.clone();

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTop: { value: DAY.top.clone() }, uHor: { value: DAY.hor.clone() },
      uSun: { value: SUN_DIR.clone() }, uSunCol: { value: new THREE.Color('#fff0d0') },
      uGlow: { value: 1 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
    fragmentShader: `uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSun; uniform vec3 uSunCol; uniform float uGlow; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y, -0.2, 1.0);
        vec3 c = mix(uHor, uTop, pow(max(h, 0.0), 0.55));
        float s = max(dot(normalize(vDir), normalize(uSun)), 0.0);
        c += uSunCol * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.35) * uGlow;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 12), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(DAY.sky.clone(), DAY.grd.clone(), DAY.hemiI);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(DAY.sun.clone(), DAY.sunI);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 80;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(DAY.rim.clone(), 0.7); // warm back light for squishy rims
  scene.add(rim, rim.target);

  // ---- materials -------------------------------------------------------------------
  const M = {
    stone: std('#a7a295'),
    stoneDark: std('#8b877b'),
    moss: std('#71804a'),
    vermilion: std('#c8432b', { roughness: 0.7 }),
    black: std('#2b2623', { roughness: 0.7 }),
    wood: std('#7a4b31'),
    woodLight: std('#a7774c'),
    plaster: std('#efe4d0'),
    roof: std('#56736a', { roughness: 0.6 }),
    gold: std('#d9b25a', { roughness: 0.35, metalness: 0.6 }),
    paper: std('#fbf3e4'),
    trunk: std('#5e4332'),
    trunkPale: std('#8e7a66'),
    rope: std('#d9c38d'),
    glow: new THREE.MeshStandardMaterial({ color: '#ffe2a6', emissive: '#ffb45c', emissiveIntensity: 0.4, roughness: 0.8 }),
  };
  world.materials = M;

  // ---- ground --------------------------------------------------------------------------
  const grassTex = canvasTex(256, 256, (g, w, h) => {
    speckle(g, w, h, '#ffffff', ['#d9d9c2', '#e8efd8', '#c9ccb0', '#f4f1e0', '#bfc7a4'], 900, 7, mulberry32(3));
  }, { repeat: [14, 44] });
  const groundShape = new THREE.Shape();
  groundShape.moveTo(-70, 30); groundShape.lineTo(70, 30); groundShape.lineTo(70, -250); groundShape.lineTo(-70, -250); groundShape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(POND.x0, -POND.z0); hole.lineTo(POND.x0, -POND.z1); hole.lineTo(POND.x1, -POND.z1); hole.lineTo(POND.x1, -POND.z0); hole.closePath();
  groundShape.holes.push(hole);
  const groundGeo = new THREE.ShapeGeometry(groundShape);
  groundGeo.rotateX(-Math.PI / 2);
  { // world-space UVs so the grass texture tiles evenly
    const pos = groundGeo.attributes.position, uv = groundGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 10, pos.getZ(i) / 10);
  }
  grassTex.repeat.set(1, 1);
  const groundMat = std('#9dba6b', { map: grassTex });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  scene.add(ground);

  // terrace (raised shrine grounds) — stone walls, raked gravel on top
  const stoneWallTex = (rx, ry) => canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#8f8a7c'; g.fillRect(0, 0, w, h);
    const r = mulberry32(11);
    const rows = 4;
    for (let row = 0; row < rows; row++) {
      let x = -r() * 40;
      while (x < w) {
        const bw = 40 + r() * 40;
        const shade = 150 + r() * 40 | 0;
        g.fillStyle = `rgb(${shade},${shade - 6},${shade - 18})`;
        g.fillRect(x + 2, row * (h / rows) + 2, bw - 4, h / rows - 4);
        if (r() < 0.4) { g.fillStyle = 'rgba(100,120,60,0.35)'; g.fillRect(x + 2, row * (h / rows) + 2, bw * 0.5, 6); }
        x += bw;
      }
    }
  }, { repeat: [rx, ry] });
  const gravelTex = canvasTex(256, 256, (g, w, h) => {
    speckle(g, w, h, '#d9d2c2', ['#c4bcaa', '#e9e3d6', '#b5ad9b', '#f3eee3'], 2400, 2.2, mulberry32(5));
    g.strokeStyle = 'rgba(150,140,120,0.25)'; g.lineWidth = 2;
    for (let y = 8; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  }, { repeat: [6, 14] });
  {
    const w = 32, d = 212 - TERRACE.z0;
    const geo = new THREE.BoxGeometry(w, TERRACE.h, d);
    const side = std('#ffffff', { map: stoneWallTex(d / 4, 1) });
    const front = std('#ffffff', { map: stoneWallTex(w / 4, 1) });
    const top = std('#ffffff', { map: gravelTex });
    const mesh = new THREE.Mesh(geo, [side, side, top, top, front, front]);
    mesh.position.set(0, TERRACE.h / 2, TERRACE.z0 + d / 2);
    mesh.receiveShadow = true; mesh.castShadow = true;
    scene.add(mesh);
  }

  const B = new Batcher();

  // stone slab path (flat: no need to cast shadows)
  const flat = new Batcher();
  {
    const slab = new THREE.BoxGeometry(1, 0.1, 1);
    const blocked = (x, z) =>
      FOREST_TRUNKS.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + 0.7) ||
      GROVE_STALKS.some((t) => Math.hypot(t.x - x, t.z - z) < 0.6) ||
      (z > POND.z0 - 0.6 && z < POND.z1 + 0.6) ||
      (z > SQUEEZE.z0 - 0.3 && z < SQUEEZE.z1 + 0.3) ||
      (z > 131.5 && z < TERRACE.z0 + 0.4);
    for (let z = 1; z < 193; z += 0.95) {
      const cx = Math.sin(z * 0.09) * 1.2 * (z < TERRACE.z0 ? 1 : 0.2);
      for (let k = -1; k <= 1; k++) {
        const x = cx + k * 0.95 + (rand() - 0.5) * 0.25;
        const zz = z + (rand() - 0.5) * 0.25;
        if (blocked(x, zz) || rand() < 0.12) continue;
        const s = 0.72 + rand() * 0.25;
        flat.put(slab, rand() < 0.3 ? M.stoneDark : M.stone, x, groundY(x, zz) + 0.02, zz, { ry: rand() * 0.5, sx: s, sz: s * (0.8 + rand() * 0.3) });
      }
    }
  }

  // rocks & shrubs along the edges
  const rockGeo = new THREE.DodecahedronGeometry(0.5, 0);
  const shrubGeo = new THREE.IcosahedronGeometry(0.8, 1);
  const shrubMat = std('#4f6b3a', { flatShading: true });
  for (let z = -4; z < 206; z += 1.7) {
    for (const side of [-1, 1]) {
      const hw = halfWidthAt(z);
      if (z > 40 && z < 86) continue; // bamboo does the walls there
      if (z > POND.z0 - 1 && z < POND.z1 + 1 && rand() < 0.5) continue;
      const x = side * (hw + 0.1 + rand() * 1.2);
      const y = groundY(x, z);
      if (rand() < 0.35) B.put(rockGeo, rand() < 0.5 ? M.stone : M.moss, x, y + 0.1, z + rand(), { rx: rand() * 3, ry: rand() * 3, sx: 0.8 + rand(), sy: 0.6 + rand() * 0.6, sz: 0.8 + rand() });
      else B.put(shrubGeo, shrubMat, x, y + 0.3, z + rand(), { sx: 0.9 + rand() * 0.8, sy: 0.7 + rand() * 0.5, sz: 0.9 + rand() * 0.8 });
    }
  }

  // ---- trees (instanced: trunk + canopy for maple/sakura and pine) ------------------
  const trees = { maple: [], pine: [] };
  const addTree = (kind, x, z, s) => trees[kind].push({ x, y: groundY(x, z), z, s, r: rand() * Math.PI * 2 });
  for (const t of FOREST_TRUNKS) addTree(t.kind, t.x, t.z, t.kind === 'pine' ? 1.1 : 1.05);
  for (let z = -16; z < 224; z += 2.8) {
    for (const side of [-1, 1]) {
      const bamboo = z > 40 && z < 86;
      const hw = z > 206 ? 0 : halfWidthAt(Math.max(-4, Math.min(207, z)));
      const rows = bamboo ? 1 : 2;
      for (let r = 0; r < rows; r++) {
        let x = side * (hw + 1.2 + r * 5 + rand() * 4 + (bamboo ? 11 : 0));
        const zz = z + (rand() - 0.5) * 2;
        if (z > 206 && Math.abs(x) < 7) x += side * 7;
        if (zz > POND.z0 - 1 && zz < POND.z1 + 1 && Math.abs(x) < POND.x1 + 1) continue;
        const kind = rand() < (z > 124 ? 0.45 : 0.55) ? 'maple' : 'pine';
        addTree(kind, x, zz, 0.85 + rand() * 0.55);
      }
    }
  }
  for (const sx of [-1, 1]) for (let z = 164; z < 208; z += 3.3) addTree('maple', sx * (14.9 + rand() * 0.6), z, 0.7 + rand() * 0.25);
  for (let x = -26; x <= 26; x += 3.2) addTree(rand() < 0.5 ? 'pine' : 'maple', x + rand(), -8 - rand() * 5, 0.9 + rand() * 0.4);

  const mapleTrunk = new THREE.CylinderGeometry(0.1, 0.2, 2.6, 6); mapleTrunk.translate(0, 1.3, 0);
  const mapleCanopyParts = [[0, 3.1, 0, 1.25], [0.9, 3.4, 0.4, 0.95], [-0.8, 3.2, -0.3, 1.0], [0.2, 4.0, -0.4, 0.85], [-0.3, 2.8, 0.8, 0.8], [0.6, 2.7, -0.8, 0.75]];
  const mapleCanopy = (() => {
    const b = new Batcher();
    const ico = new THREE.IcosahedronGeometry(1, 1);
    for (const [x, y, z, s] of mapleCanopyParts) b.put(ico, M.stone, x, y, z, { sx: s, sy: s * 0.8, sz: s });
    return mergeAll([...b.groups.get(M.stone).values()].flat());
  })();
  const pineTrunk = new THREE.CylinderGeometry(0.14, 0.24, 3.2, 6); pineTrunk.translate(0, 1.6, 0);
  const pineCanopy = (() => {
    const b = new Batcher();
    const cone = new THREE.ConeGeometry(1, 1, 8);
    for (const [y, r, h] of [[3.0, 1.9, 2.6], [4.3, 1.5, 2.3], [5.4, 1.1, 2.0], [6.3, 0.65, 1.5]]) b.put(cone, M.stone, 0, y, 0, { sx: r, sy: h, sz: r });
    return mergeAll([...b.groups.get(M.stone).values()].flat());
  })();
  const canopyMat = addSway(std('#ffffff', { flatShading: true, roughness: 0.9 }), { amp: 0.0035, speed: 1.1 });
  const pineMat = addSway(std('#ffffff', { flatShading: true, roughness: 0.9 }), { amp: 0.0025, speed: 0.9 });
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), v4 = new THREE.Vector3(), s4 = new THREE.Vector3();
  const treeFill = (colorFn) => (im, i, t) => {
    q4.setFromEuler(e4.set(0, t.r, 0));
    im.setMatrixAt(i, m4.compose(v4.set(t.x, t.y, t.z), q4, s4.set(t.s, t.s, t.s)));
    if (colorFn) im.setColorAt(i, colorFn(t));
  };
  trees.maple.forEach((t) => { t.ci = rand(); t.cl = rand(); });
  chunkedInstances(scene, mapleTrunk, M.trunk, trees.maple, treeFill());
  chunkedInstances(scene, pineTrunk, M.trunk, trees.pine, treeFill());
  const mapleInst = chunkedInstances(scene, mapleCanopy, canopyMat, trees.maple, treeFill(() => new THREE.Color('#fff')));
  chunkedInstances(scene, pineCanopy, pineMat, trees.pine, treeFill(() => new THREE.Color().setHSL(0.3 + rand() * 0.06, 0.32 + rand() * 0.1, 0.2 + rand() * 0.07)));

  // ---- bamboo grove ------------------------------------------------------------
  const stalks = [];
  const addStalk = (x, z, r = 0.1 + rand() * 0.06, h = 8 + rand() * 5) => stalks.push({ x, z, r, h, lean: (rand() - 0.5) * 0.05 });
  for (const s of GROVE_STALKS) addStalk(s.x, s.z, s.r, 7 + rand() * 4);
  for (let z = 40; z < 88; z += 0.55) {
    for (const side of [-1, 1]) {
      const hw = halfWidthAt(Math.min(83.9, Math.max(42, z)));
      for (let k = 0; k < 5; k++) {
        const x = side * (hw + 0.15 + Math.pow(rand(), 1.4) * 11);
        addStalk(x, z + (rand() - 0.5) * 0.5);
      }
    }
  }
  for (const side of [-1, 1]) { // the squeeze wall
    for (let x = 1.45; x < 8.3; x += 0.27) {
      addStalk(side * x, SQUEEZE.z0 + 0.25 + rand() * 0.15, 0.1 + rand() * 0.03, 7 + rand() * 4);
      addStalk(side * (x + 0.13), SQUEEZE.z1 - 0.25 - rand() * 0.15, 0.1 + rand() * 0.03, 7 + rand() * 4);
    }
  }
  const bambooTex = canvasTex(32, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#6f9a45'); gr.addColorStop(0.5, '#a8c46a'); gr.addColorStop(1, '#6f9a45');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(60,80,30,0.7)'; g.fillRect(0, h - 10, w, 5);
    g.fillStyle = 'rgba(230,240,190,0.6)'; g.fillRect(0, h - 5, w, 3);
  }, { repeat: [1, 7] });
  const bambooGeo = new THREE.CylinderGeometry(1, 1, 1, 7, 1, true); bambooGeo.translate(0, 0.5, 0);
  const bambooMat = addSway(std('#ffffff', { map: bambooTex, roughness: 0.6 }), { amp: 0.0022, speed: 1.4 });
  const leafClumps = [];
  chunkedInstances(scene, bambooGeo, bambooMat, stalks, (im, i, st) => {
    q4.setFromEuler(e4.set(st.lean, 0, st.lean * 0.7));
    im.setMatrixAt(i, m4.compose(v4.set(st.x, 0, st.z), q4, s4.set(st.r, st.h, st.r)));
    im.setColorAt(i, new THREE.Color().setHSL(0.24 + rand() * 0.05, 0.3 + rand() * 0.2, 0.55 + rand() * 0.2));
    if (Math.abs(st.x) < 14) leafClumps.push({ x: st.x + (rand() - 0.5) * 1.4, y: st.h * (0.75 + rand() * 0.25), z: st.z + (rand() - 0.5) * 1.4, s: 0.7 + rand() * 0.7 });
  });
  {
    const leafGeo = new THREE.IcosahedronGeometry(1, 0);
    const leafMat = addSway(std('#ffffff', { flatShading: true, roughness: 0.9 }), { amp: 0.0022, speed: 1.4 });
    // clumps sway as if at the stalk tip: shader measures height above y=0
    leafMat.onBeforeCompile = ((orig) => (sh, r) => {
      orig(sh, r);
      sh.vertexShader = sh.vertexShader.replace('swayRoot = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;', 'swayRoot = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; swayRoot.y = 0.0;');
    })(leafMat.onBeforeCompile);
    leafMat.customProgramCacheKey = () => 'bambooLeaves';
    chunkedInstances(scene, leafGeo, leafMat, leafClumps, (im, i, c) => {
      q4.setFromEuler(e4.set(rand(), rand() * 3, rand()));
      im.setMatrixAt(i, m4.compose(v4.set(c.x, c.y, c.z), q4, s4.set(c.s * 1.3, c.s * 0.4, c.s * 1.1)));
      im.setColorAt(i, new THREE.Color().setHSL(0.25 + rand() * 0.06, 0.45, 0.35 + rand() * 0.15));
    }, { receive: false });
  }
  // fallen stalks across the squeeze gap, stacked so only the bottom slot is open
  {
    const log = new THREE.CylinderGeometry(0.13, 0.13, 3.4, 8);
    for (let i = 0; i < 7; i++) {
      const y = SQUEEZE.clear + 0.13 + i * 0.36;
      B.put(log, M.woodLight, (rand() - 0.5) * 0.2, y, (SQUEEZE.z0 + SQUEEZE.z1) / 2 + (i % 2 ? 0.18 : -0.18), { rz: Math.PI / 2 + (rand() - 0.5) * 0.06 });
    }
    const tie = new THREE.CylinderGeometry(0.16, 0.16, 0.12, 8);
    for (const x of [-1.5, 1.5]) for (let i = 0; i < 7; i++) B.put(tie, M.rope, x, SQUEEZE.clear + 0.13 + i * 0.36, (SQUEEZE.z0 + SQUEEZE.z1) / 2, { rz: Math.PI / 2 });
  }

  // ---- koi pond ---------------------------------------------------------------------
  const pondW = POND.x1 - POND.x0, pondD = POND.z1 - POND.z0, pondCz = (POND.z0 + POND.z1) / 2;
  {
    const basin = new THREE.Mesh(new THREE.BoxGeometry(pondW, 2, pondD), std('#4c5a3f', { side: THREE.BackSide }));
    basin.position.set(0, POND.floor + 1, pondCz);
    basin.receiveShadow = true;
    scene.add(basin);
    for (let i = 0; i < 30; i++) {
      B.put(rockGeo, rand() < 0.5 ? M.stoneDark : M.moss, POND.x0 + rand() * pondW, POND.floor + 0.1, POND.z0 + rand() * pondD, { rx: rand() * 3, sx: 0.6 + rand(), sy: 0.4, sz: 0.6 + rand() });
    }
    // rim stones
    for (let x = POND.x0; x <= POND.x1; x += 0.9) {
      for (const z of [POND.z0, POND.z1]) {
        if (Math.abs(x) < 1.6) continue;
        B.put(rockGeo, rand() < 0.6 ? M.stone : M.moss, x + rand() * 0.3, -0.05, z + (rand() - 0.5) * 0.3, { rx: rand() * 3, ry: rand() * 3, sx: 0.8 + rand() * 0.5, sy: 0.35 + rand() * 0.2, sz: 0.7 + rand() * 0.4 });
      }
    }
  }
  const waterMat = new THREE.ShaderMaterial({
    transparent: true, fog: true, depthWrite: false,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: shared.time, uDeep: { value: new THREE.Color('#2f6f6a') }, uSky: { value: new THREE.Color('#ffd9b0') },
      uSunDir: { value: SUN_DIR.clone() }, uSunCol: { value: new THREE.Color('#fff1d0') },
    }]),
    vertexShader: `varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uSunDir; uniform vec3 uSunCol; varying vec3 vWorld;
      #include <common>
      #include <fog_pars_fragment>
      void main(){
        vec2 p = vWorld.xz;
        float t = uTime;
        vec2 grad = vec2(0.0);
        grad += vec2(cos(p.x * 1.3 + t * 1.1), 0.0) * 0.08;
        grad += vec2(0.0, cos(p.y * 1.7 - t * 0.9)) * 0.07;
        grad += vec2(cos((p.x + p.y) * 2.9 + t * 1.7)) * 0.035;
        grad += vec2(cos((p.x - p.y) * 4.3 - t * 2.3)) * 0.02;
        vec3 N = normalize(vec3(-grad.x, 1.0, -grad.y));
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        vec3 col = mix(uDeep, uSky, 0.06 + 0.5 * fres);
        vec3 H = normalize(normalize(uSunDir) + V);
        float spec = pow(max(dot(N, H), 0.0), 180.0);
        col += uSunCol * spec * 1.6;
        float a = mix(0.62, 0.93, fres) + spec;
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(pondW, pondD), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, POND.water, pondCz);
  water.renderOrder = 2;
  scene.add(water);
  world.water = waterMat;

  // lily pads & lotus
  {
    const pad = new THREE.CircleGeometry(0.45, 12, 0.3, Math.PI * 1.85);
    pad.rotateX(-Math.PI / 2);
    const padMat = std('#5f8c46', { side: THREE.DoubleSide });
    const lotus = new THREE.ConeGeometry(0.16, 0.22, 6);
    const lotusMat = std('#f7c5d5', { flatShading: true, emissive: '#f7a5c0', emissiveIntensity: 0.15 });
    for (let i = 0; i < 18; i++) {
      const x = POND.x0 + 1 + rand() * (pondW - 2), z = POND.z0 + 1 + rand() * (pondD - 2);
      if (STONES.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + 0.8)) continue;
      const s = 0.7 + rand() * 0.7;
      flat.put(pad, padMat, x, POND.water + 0.02, z, { ry: rand() * 6, sx: s, sz: s });
      if (rand() < 0.35) B.put(lotus, lotusMat, x + 0.1, POND.water + 0.12, z, { rx: Math.PI });
    }
  }

  // koi: tiny boids with a fresnel shimmer and a swishing tail
  const koi = [];
  {
    const n = 11;
    const body = new THREE.SphereGeometry(1, 10, 8);
    body.scale(0.14, 0.09, 0.4);
    const tail = new THREE.ConeGeometry(0.13, 0.28, 6);
    tail.rotateX(-Math.PI / 2); tail.scale(1, 0.25, 1); tail.translate(0, 0, -0.48);
    const fins = new THREE.BoxGeometry(0.42, 0.01, 0.1); fins.translate(0, -0.02, 0.1);
    const geo = mergeAll([body, tail, fins].map((g) => g.index ? g.toNonIndexed() : g));
    // kohaku-style patches baked as vertex colours
    const pos = geo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const white = new THREE.Color('#fff8f0'), red = new THREE.Color('#e8452a');
    for (let i = 0; i < pos.count; i++) {
      const patch = Math.sin(pos.getX(i) * 22 + 1.3) * Math.cos(pos.getZ(i) * 11) > 0.15 && pos.getY(i) > -0.03;
      cols.set((patch ? red : white).toArray(), i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const mat = addRim(std('#ffffff', { vertexColors: true, roughness: 0.35 }), '#bff7ff', 0.9, 2.0);
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => {
      prev(sh, r);
      sh.uniforms.uTime = shared.time;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
          float koiPh = instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 1.7;
          #else
          float koiPh = 0.0;
          #endif
          float tailW = smoothstep(0.1, -0.6, transformed.z);
          transformed.x += sin(uTime * 7.0 + koiPh + transformed.z * 4.0) * 0.09 * tailW;`);
    };
    mat.customProgramCacheKey = () => 'koi';
    const im = new THREE.InstancedMesh(geo, mat, n);
    const palette = ['#ff6a3d', '#fff5ea', '#ffb347', '#f04a2a', '#ffe9b0', '#ff8a5c'];
    for (let i = 0; i < n; i++) {
      im.setColorAt(i, new THREE.Color(palette[i % palette.length]));
      koi.push({
        x: POND.x0 + 2 + rand() * (pondW - 4), z: POND.z0 + 2 + rand() * (pondD - 4),
        vx: rand() - 0.5, vz: rand() - 0.5, y: -0.72 - rand() * 0.25, wander: rand() * 6, s: 0.8 + rand() * 0.5,
      });
    }
    im.castShadow = false;
    scene.add(im);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    updaters.push((dt, t) => {
      for (const f of koi) {
        f.wander += (Math.sin(t * 0.3 + f.s * 10) * 0.8) * dt;
        let ax = Math.sin(f.wander) * 0.6, az = Math.cos(f.wander) * 0.6;
        // stay inside the pond
        if (f.x < POND.x0 + 1.5) ax += 2; if (f.x > POND.x1 - 1.5) ax -= 2;
        if (f.z < POND.z0 + 1.5) az += 2; if (f.z > POND.z1 - 1.5) az -= 2;
        for (const o of koi) {
          if (o === f) continue;
          const dx = f.x - o.x, dz = f.z - o.z, d2 = dx * dx + dz * dz;
          if (d2 < 1 && d2 > 1e-4) { ax += dx / d2 * 0.3; az += dz / d2 * 0.3; }
        }
        for (const s of STONES) {
          const dx = f.x - s.x, dz = f.z - s.z, d = Math.hypot(dx, dz);
          if (d < s.r + 0.5) { ax += dx / d * 2; az += dz / d * 2; }
        }
        f.vx += ax * dt; f.vz += az * dt;
        const sp = Math.hypot(f.vx, f.vz), max = 0.9, min = 0.35;
        const k = sp > max ? max / sp : sp < min ? min / Math.max(sp, 1e-3) : 1;
        f.vx *= k; f.vz *= k;
        f.x += f.vx * dt; f.z += f.vz * dt;
      }
      koi.forEach((f, i) => {
        q.setFromAxisAngle(up, Math.atan2(f.vx, f.vz));
        m.compose(new THREE.Vector3(f.x, f.y + Math.sin(t + i) * 0.03, f.z), q, new THREE.Vector3(f.s, f.s, f.s));
        im.setMatrixAt(i, m);
      });
      im.instanceMatrix.needsUpdate = true;
    });
  }

  // ---- stone lanterns (tōrō) ------------------------------------------------------
  const glowMat = M.glow;
  const toro = (x, z) => {
    const y = groundY(x, z);
    const cyl = (r0, r1, h, seg = 8) => new THREE.CylinderGeometry(r0, r1, h, seg);
    B.put(cyl(0.42, 0.5, 0.25, 6), M.stoneDark, x, y + 0.12, z);
    B.put(cyl(0.16, 0.2, 0.9, 8), M.stone, x, y + 0.7, z);
    B.put(cyl(0.38, 0.3, 0.18, 6), M.stone, x, y + 1.2, z);
    B.put(new THREE.BoxGeometry(0.46, 0.42, 0.46), M.stone, x, y + 1.5, z);
    B.put(new THREE.BoxGeometry(0.3, 0.26, 0.48), glowMat, x, y + 1.5, z);
    B.put(new THREE.BoxGeometry(0.48, 0.26, 0.3), glowMat, x, y + 1.5, z);
    B.put(new THREE.ConeGeometry(0.62, 0.42, 6), M.stoneDark, x, y + 1.92, z);
    B.put(new THREE.SphereGeometry(0.11, 8, 6), M.stone, x, y + 2.18, z);
  };
  [...LANTERNS_POND, ...LANTERNS_APPROACH, ...LANTERNS_COURT].forEach((l) => toro(l.x, l.z));

  // ---- torii ------------------------------------------------------------------------
  const torii = (z, y, half, scale = 1) => {
    const s = scale;
    for (const sx of [-1, 1]) {
      B.put(new THREE.CylinderGeometry(0.28 * s, 0.33 * s, 5.2 * s, 12), M.vermilion, sx * half, y + 2.6 * s, z);
      B.put(new THREE.CylinderGeometry(0.38 * s, 0.38 * s, 0.4 * s, 12), M.black, sx * half, y + 0.2 * s, z);
    }
    B.put(new THREE.BoxGeometry(half * 2 + 2.6 * s, 0.34 * s, 0.6 * s), M.vermilion, 0, y + 5.05 * s, z);
    B.put(new THREE.BoxGeometry(half * 2 + 3.2 * s, 0.3 * s, 0.75 * s), M.black, 0, y + 5.38 * s, z);
    for (const sx of [-1, 1]) B.put(new THREE.BoxGeometry(1.0 * s, 0.3 * s, 0.75 * s), M.black, sx * (half + 1.7 * s), y + 5.46 * s, z, { rz: sx * 0.18 });
    B.put(new THREE.BoxGeometry(half * 2 + 1.4 * s, 0.3 * s, 0.26 * s), M.vermilion, 0, y + 3.95 * s, z);
    B.put(new THREE.BoxGeometry(0.34 * s, 0.9 * s, 0.26 * s), M.vermilion, 0, y + 4.5 * s, z);
    B.put(new THREE.BoxGeometry(0.75 * s, 0.95 * s, 0.1 * s), M.black, 0, y + 4.5 * s, z - 0.17 * s);
    B.put(new THREE.BoxGeometry(0.55 * s, 0.75 * s, 0.02 * s), M.gold, 0, y + 4.5 * s, z - 0.23 * s);
  };
  torii(TORII.z, TERRACE.h, TORII.halfSpan);

  // ---- komainu ----------------------------------------------------------------------
  for (const k of KOMAINU) {
    const y = TERRACE.h, side = Math.sign(k.x);
    const part = (geo, mat, x, yy, z, o) => ({ geo, mat, x, y: yy, z, o });
    const parts = [
      part(new THREE.BoxGeometry(1.3, 1.1, 1.5), M.stoneDark, 0, 0.55, 0),
      part(new THREE.BoxGeometry(1.45, 0.14, 1.65), M.stone, 0, 1.12, 0),
      part(new THREE.SphereGeometry(0.5, 10, 8), M.stone, 0, 1.62, 0.15, { sx: 0.95, sy: 0.9, sz: 1.2 }),
      part(new THREE.SphereGeometry(0.46, 10, 8), M.stone, 0, 2.2, -0.35, { sx: 1.05, sy: 0.95, sz: 0.95 }),
      part(new THREE.SphereGeometry(0.5, 8, 6), M.stoneDark, 0, 2.18, -0.22, { sx: 1.2, sy: 1.1, sz: 0.8 }),
      part(new THREE.SphereGeometry(0.16, 8, 6), M.stone, 0, 2.08, -0.8, { sx: 1.4, sy: 0.9, sz: 1 }),
      part(new THREE.ConeGeometry(0.22, 0.6, 6), M.stoneDark, 0, 2.05, 0.75, { rx: -0.6 }),
      part(new THREE.SphereGeometry(0.07, 6, 5), M.black, -0.17, 2.32, -0.74),
      part(new THREE.SphereGeometry(0.07, 6, 5), M.black, 0.17, 2.32, -0.74),
      part(new THREE.CylinderGeometry(0.12, 0.14, 0.5, 6), M.stone, -0.28, 1.4, -0.45),
      part(new THREE.CylinderGeometry(0.12, 0.14, 0.5, 6), M.stone, 0.28, 1.4, -0.45),
    ];
    const base = new THREE.Matrix4().compose(new THREE.Vector3(k.x, y, k.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, side * 0.45, 0)), new THREE.Vector3(1, 1, 1));
    for (const p of parts) {
      const o = p.o || {};
      const local = new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx || 0, 0, 0)), new THREE.Vector3(o.sx || 1, o.sy || 1, o.sz || 1));
      B.add(p.geo, p.mat, base.clone().multiply(local));
    }
  }

  // ---- shrine building --------------------------------------------------------------
  {
    const y = TERRACE.h;
    const cx = 0, z0 = SHRINE.z0, z1 = SHRINE.z1, w = SHRINE.x1 - SHRINE.x0, d = z1 - z0, cz = (z0 + z1) / 2;
    B.put(new THREE.BoxGeometry(w + 0.8, 0.6, d + 0.8), M.stone, cx, y + 0.3, cz);
    for (let i = 0; i < 3; i++) B.put(new THREE.BoxGeometry(3.4, 0.2, 0.45), M.woodLight, cx, y + 0.1 + i * 0.2, z0 - 0.8 + i * 0.35 - 0.3);
    B.put(new THREE.BoxGeometry(w - 1, 3.4, d - 1.4), M.plaster, cx, y + 0.6 + 1.7, cz + 0.4);
    // lattice doors
    for (let i = -3; i <= 3; i++) B.put(new THREE.BoxGeometry(0.06, 3.0, 0.06), M.wood, cx + i * 0.5, y + 2.2, z0 + 0.25);
    for (let j = 0; j < 6; j++) B.put(new THREE.BoxGeometry(3.2, 0.06, 0.06), M.wood, cx, y + 0.9 + j * 0.55, z0 + 0.25);
    for (const px of [-5.4, -3.2, -1.6, 1.6, 3.2, 5.4]) {
      for (const pz of [z0 - 0.1, z1 - 0.2]) B.put(new THREE.CylinderGeometry(0.2, 0.22, 4.2, 10), M.vermilion, px, y + 0.6 + 2.1, pz);
    }
    B.put(new THREE.BoxGeometry(w + 0.4, 0.4, 0.4), M.vermilion, cx, y + 4.6, z0 - 0.1);
    B.put(new THREE.BoxGeometry(w + 0.4, 0.4, 0.4), M.vermilion, cx, y + 4.6, z1 - 0.2);
    // gabled roof with deep eaves
    const slope = 0.52, len = d / 2 / Math.cos(slope) + 1.8;
    for (const s of [-1, 1]) {
      B.put(new THREE.BoxGeometry(w + 3.6, 0.34, len), M.roof, cx, y + 6.2, cz + s * (len / 2 - 0.9) * Math.cos(slope) - s * 0.2, { rx: s * slope });
      B.put(new THREE.BoxGeometry(w + 3.8, 0.12, 0.3), M.gold, cx, y + 6.2 - (len / 2) * Math.sin(slope) - 0.05, cz + s * (len - 0.9) * Math.cos(slope) - s * 0.3, { rx: s * slope });
    }
    B.put(new THREE.BoxGeometry(w + 3.8, 0.5, 0.7), M.black, cx, y + 7.2, cz);
    for (const s of [-1, 1]) B.put(new THREE.BoxGeometry(0.2, 1.6, 0.25), M.black, cx + s * (w / 2 + 1.7), y + 7.6, cz, { rz: s * 0.45 });
    for (let i = -2; i <= 2; i++) B.put(new THREE.CylinderGeometry(0.14, 0.14, 1.3, 8), M.gold, cx + i * 1.6, y + 7.55, cz, { rx: Math.PI / 2 });
    // offering box and shimenawa rope under the eave
    B.put(new THREE.BoxGeometry(1.8, 0.8, 0.8), M.wood, cx, y + 0.4, z0 - 1.9);
    for (let i = 0; i < 9; i++) B.put(new THREE.BoxGeometry(1.7, 0.04, 0.08), M.black, cx, y + 0.8, z0 - 2.2 + i * 0.075);
    const ropeCurve = new THREE.CatmullRomCurve3([-4.8, -2.4, 0, 2.4, 4.8].map((x, i) => new THREE.Vector3(x, y + 4.25 - (i === 2 ? 0.35 : i % 2 ? 0.25 : 0), z0 - 0.45)));
    B.add(new THREE.TubeGeometry(ropeCurve, 30, 0.14, 8), M.rope, new THREE.Matrix4());
    for (const x of [-3.6, -1.2, 1.2, 3.6]) B.put(new THREE.BoxGeometry(0.2, 0.5, 0.02), M.paper, x, y + 3.75, z0 - 0.5, { rz: 0.15 });
  }

  // ---- courtyard fence, lantern strings -----------------------------------------------
  {
    const post = new THREE.BoxGeometry(0.16, 1.2, 0.16);
    const rail = new THREE.BoxGeometry(0.08, 0.1, 1);
    for (const sx of [-1, 1]) {
      for (let z = TERRACE.z0 + 0.5; z < 206; z += 1.2) {
        const hw = halfWidthAt(Math.min(z, 207));
        const x = sx * (hw + 0.25);
        B.put(post, M.vermilion, x, TERRACE.h + 0.6, z);
        B.put(rail, M.vermilion, x, TERRACE.h + 1.05, z + 0.6, { sz: 1.2 });
        B.put(rail, M.vermilion, x, TERRACE.h + 0.55, z + 0.6, { sz: 1.2 });
      }
    }
  }
  const paperLanterns = [];
  {
    const pole = new THREE.CylinderGeometry(0.1, 0.12, 4.6, 8);
    for (const p of POLES) B.put(pole, M.wood, p.x, TERRACE.h + 2.3, p.z);
    const pts = [];
    for (const sx of [-5.5, 5.5]) {
      for (let seg = 0; seg < 2; seg++) {
        const za = [165, 176][seg], zb = [176, 187][seg];
        const line = [];
        for (let i = 0; i <= 12; i++) {
          const u = i / 12;
          line.push(new THREE.Vector3(sx, TERRACE.h + 4.3 - Math.sin(u * Math.PI) * 0.6, za + (zb - za) * u));
        }
        pts.push(line);
        for (let i = 1; i < 12; i += 2) paperLanterns.push({ x: sx, y: line[i].y - 0.45, z: line[i].z, red: (i >> 1) % 2 === 0 });
      }
    }
    for (const line of pts) B.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(line), 20, 0.025, 4), M.black, new THREE.Matrix4());
    // two big lanterns under the shrine eaves
    paperLanterns.push({ x: -3.9, y: TERRACE.h + 3.55, z: SHRINE.z0 - 0.4, red: false, big: true });
    paperLanterns.push({ x: 3.9, y: TERRACE.h + 3.55, z: SHRINE.z0 - 0.4, red: false, big: true });
  }
  const lanternRedMat = new THREE.MeshStandardMaterial({ color: '#e0513a', emissive: '#ff6a3d', emissiveIntensity: 0.15, roughness: 0.8 });
  const lanternWhiteMat = new THREE.MeshStandardMaterial({ color: '#fbf1dc', emissive: '#ffcf87', emissiveIntensity: 0.15, roughness: 0.8 });
  {
    const bodyGeo = new THREE.SphereGeometry(0.3, 14, 10); bodyGeo.scale(1, 1.3, 1);
    const cap = new THREE.CylinderGeometry(0.17, 0.17, 0.08, 10);
    const reds = paperLanterns.filter((l) => l.red), whites = paperLanterns.filter((l) => !l.red);
    const inst = (list, mat) => {
      const im = new THREE.InstancedMesh(bodyGeo, mat, list.length);
      list.forEach((l, i) => {
        const s = l.big ? 1.7 : 1;
        im.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(l.x, l.y, l.z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)));
        B.put(cap, M.black, l.x, l.y + 0.4 * s, l.z, { sx: s, sz: s });
        B.put(cap, M.black, l.x, l.y - 0.4 * s, l.z, { sx: s, sz: s });
      });
      scene.add(im);
      return im;
    };
    inst(reds, lanternRedMat);
    inst(whites, lanternWhiteMat);
  }

  // ---- forest welcome: small stone marker & jizo-ish rocks ---------------------------------
  B.put(new THREE.BoxGeometry(0.6, 1.4, 0.4), M.stone, -3.2, 0.7, 1.5, { ry: 0.3 });
  B.put(new THREE.BoxGeometry(0.66, 0.12, 0.46), M.moss, -3.2, 1.42, 1.5, { ry: 0.3 });

  B.build(scene);
  flat.build(scene, { cast: false });

  // ---- god rays ----------------------------------------------------------------------
  const rayTex = canvasTex(64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-in';
    const gv = g.createLinearGradient(0, 0, 0, h);
    gv.addColorStop(0, 'rgba(0,0,0,0.9)'); gv.addColorStop(0.7, 'rgba(0,0,0,0.35)'); gv.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gv; g.fillRect(0, 0, w, h);
  });
  const rays = [];
  {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, -0.5, 0);
    const spots = [];
    for (let i = 0; i < 9; i++) spots.push([(rand() - 0.5) * 12, 3 + i * 4.3]);
    for (let i = 0; i < 8; i++) spots.push([(rand() - 0.5) * 11, 44 + i * 5]);
    for (let i = 0; i < 4; i++) spots.push([(rand() - 0.5) * 14, 88 + i * 9]);
    for (const [x, z] of spots) {
      const mat = new THREE.MeshBasicMaterial({ map: rayTex, color: '#ffe0a8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      const w = 1.2 + rand() * 2.2, len = 13 + rand() * 5;
      mesh.userData = { base: new THREE.Vector3(x, 0, z).addScaledVector(SUN_DIR, len * 0.95), w, len, ph: rand() * 6, str: 0.1 + rand() * 0.12 };
      mesh.renderOrder = 3;
      mesh.frustumCulled = false;
      scene.add(mesh);
      rays.push(mesh);
    }
  }

  // ---- falling leaves / petals -----------------------------------------------------------
  const LEAVES = 260;
  const leafPos = new Float32Array(LEAVES * 3);
  const leafData = [];
  for (let i = 0; i < LEAVES; i++) {
    leafData.push({ x: (rand() - 0.5) * 30, y: rand() * 10, z: (rand() - 0.5) * 36, s: 0.4 + rand() * 0.6, ph: rand() * 6 });
  }
  const leafGeo = new THREE.BufferGeometry();
  leafGeo.setAttribute('position', new THREE.BufferAttribute(leafPos, 3));
  const leafTex = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.42, h * 0.22, 0.6, 0, Math.PI * 2); g.fill();
  });
  const leafMat = new THREE.PointsMaterial({ size: 0.24, map: leafTex, transparent: true, depthWrite: false, color: '#e0662f', alphaTest: 0.2 });
  const leaves = new THREE.Points(leafGeo, leafMat);
  leaves.frustumCulled = false;
  scene.add(leaves);

  // ---- API ---------------------------------------------------------------------------------
  world.setSeason = (season) => {
    const S = SEASONS[season] || SEASONS.autumn;
    world.season = season;
    const c = new THREE.Color();
    for (const im of mapleInst) {
      im.userData.items.forEach((t, i) => {
        c.set(S.canopy[(t.ci * S.canopy.length) | 0]).offsetHSL(0, 0, (t.cl - 0.5) * 0.06);
        im.setColorAt(i, c);
      });
      im.instanceColor.needsUpdate = true;
    }
    groundMat.color.set(S.ground);
    leafMat.color.set(S.leaf);
  };

  const tmpC = new THREE.Color();
  world.setDusk = (d) => {
    world.dusk = d;
    const mix = (a, b) => tmpC.copy(a).lerp(b, d);
    sun.color.copy(mix(DAY.sun, DUSK.sun)); sun.intensity = lerp(DAY.sunI, DUSK.sunI, d);
    hemi.color.copy(mix(DAY.sky, DUSK.sky)); hemi.groundColor.copy(mix(DAY.grd, DUSK.grd)); hemi.intensity = lerp(DAY.hemiI, DUSK.hemiI, d);
    scene.fog.color.copy(mix(DAY.fog, DUSK.fog)); scene.fog.density = lerp(DAY.fogD, DUSK.fogD, d);
    scene.background.copy(scene.fog.color);
    skyMat.uniforms.uTop.value.copy(mix(DAY.top, DUSK.top));
    skyMat.uniforms.uHor.value.copy(mix(DAY.hor, DUSK.hor));
    skyMat.uniforms.uGlow.value = 1 - d * 0.6;
    rim.color.copy(mix(DAY.rim, DUSK.rim));
    waterMat.uniforms.uSky.value.copy(mix(new THREE.Color('#ffd9b0'), new THREE.Color('#b58aa8')));
    const lit = clamp01((d - 0.25) / 0.5);
    glowMat.emissiveIntensity = 0.35 + lit * 2.6;
    lanternRedMat.emissiveIntensity = 0.15 + lit * 1.9;
    lanternWhiteMat.emissiveIntensity = 0.15 + lit * 1.6;
  };

  const tmp = new THREE.Vector3(), right = new THREE.Vector3(), nrm = new THREE.Vector3(), basis = new THREE.Matrix4();
  world.update = (dt, t, camera, focus) => {
    shared.time.value = t;
    // shadow camera follows the local squishy
    sun.position.copy(focus).addScaledVector(SUN_DIR, 40);
    sun.target.position.copy(focus);
    rim.position.copy(focus).add(tmp.set(2, 5, 12));
    rim.target.position.copy(focus);
    sky.position.copy(camera.position);

    const rayFade = 1 - world.dusk;
    for (const r of rays) {
      const u = r.userData;
      const dist = u.base.distanceTo(camera.position);
      const vis = clamp01((40 - dist) / 14) * clamp01((dist - 4) / 4) * rayFade;
      r.material.opacity = u.str * vis * (0.75 + 0.25 * Math.sin(t * 0.4 + u.ph));
      r.visible = r.material.opacity > 0.003;
      if (!r.visible) continue;
      tmp.subVectors(camera.position, u.base);
      right.crossVectors(SUN_DIR, tmp).normalize();
      nrm.crossVectors(right, SUN_DIR).normalize();
      basis.makeBasis(right.multiplyScalar(u.w), tmp.copy(SUN_DIR).multiplyScalar(u.len), nrm);
      basis.setPosition(u.base);
      r.matrixAutoUpdate = false;
      r.matrix.copy(basis);
      r.matrixWorldNeedsUpdate = true;
    }

    // leaves drift around the focus point and wrap
    const pos = leafGeo.attributes.position;
    const inCourt = focus.z > 150;
    for (let i = 0; i < LEAVES; i++) {
      const l = leafData[i];
      l.y -= dt * (0.45 + l.s * 0.4);
      l.x += Math.sin(t * 0.9 + l.ph) * dt * 0.6 + dt * 0.35;
      l.z += Math.cos(t * 0.7 + l.ph) * dt * 0.3;
      if (l.y < 0) l.y += 10;
      const x = ((l.x - focus.x) % 30 + 45) % 30 - 15;
      // keep leaves ahead of the camera (which trails ~7 m behind the focus)
      const z = ((l.z - focus.z) % 36 + 36) % 36 - 3;
      pos.setXYZ(i, focus.x + x, groundY(focus.x + x, focus.z + z) + l.y, focus.z + z);
    }
    pos.needsUpdate = true;
    leafMat.opacity = inCourt ? 0.75 - world.dusk * 0.4 : 0.9;

    for (const u of updaters) u(dt, t);
  };

  world.setSeason('autumn');
  world.setDusk(0);
  return world;
}

function mergeAll(geos) {
  // local import-free merge for same-attribute geometries
  const list = geos.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
    if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
    return n;
  });
  let count = 0;
  for (const g of list) count += g.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const size = list[0].attributes[name].itemSize;
    const arr = new Float32Array(count * size);
    let off = 0;
    for (const g of list) { arr.set(g.attributes[name].array, off); off += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  return out;
}
