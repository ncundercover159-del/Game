// Visuals for an arena world (battle arenas and the test plane).
import * as THREE from 'three';
import { PROPS } from './propDefs.js';
import { buildFigureTemplate, instantiateFigure } from './figure.js';
import { TEX } from './textures.js';
import { createToyMaterial } from './toyMaterial.js';
import { THEMES } from './themes.js';

function wedge(w, d, h0, h1) {
  // ramp wedge: local z from -d/2 (h0) to +d/2 (h1), bottom at 0
  const g = new THREE.BufferGeometry();
  const x = w / 2, z = d / 2;
  const v = [
    -x, 0, -z, x, 0, -z, x, 0, z, -x, 0, z,          // bottom 0-3
    -x, h0, -z, x, h0, -z, x, h1, z, -x, h1, z,      // top 4-7
  ];
  const idx = [
    4, 6, 5, 4, 7, 6,   // top (ramp)
    0, 1, 5, 0, 5, 4,   // back (low end)
    3, 7, 6, 3, 6, 2,   // front (high end)
    0, 4, 7, 0, 7, 3,   // left
    1, 2, 6, 1, 6, 5,   // right
  ];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  const ng = g.toNonIndexed();
  ng.computeVertexNormals();
  // uvs: planar top projection
  const p = ng.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / 4; uv[i * 2 + 1] = p.getZ(i) / 4; }
  ng.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return ng;
}

export class ArenaView {
  constructor(scene, world, opts = {}) {
    this.scene = scene;
    this.world = world;
    const def = world.def;
    const theme = THEMES[def.theme] || THEMES.skyland;
    this.theme = theme;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.anim = [];

    const b = def.bounds;
    const size = b.shape === 'circle' ? b.r * 2 : Math.max(b.w, b.d);
    // base floor
    const floorTex = (theme.arenaFloor === 'asphalt' ? TEX.asphalt(theme.road) : TEX.tiles(...(theme.tiles || []))).clone();
    floorTex.needsUpdate = true;
    floorTex.repeat.set(size / 16, size / 16);
    const floorMat = new THREE.MeshLambertMaterial({ map: floorTex });
    const floorGeo = b.shape === 'circle' ? new THREE.CircleGeometry(b.r, 64) : new THREE.PlaneGeometry(b.w, b.d);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = world.baseHeight;
    this.group.add(floor);
    // uv fix for circle
    if (b.shape === 'circle') {
      const uv = floorGeo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (size / 16), uv.getY(i) * (size / 16));
    }

    // outer walls
    const wallMat = createToyMaterial({ vertexColors: false, color: theme.rail || '#2f6fe0', spec: 0.6 });
    const trimMat = new THREE.MeshLambertMaterial({ map: TEX.stripes(theme.kerbA || '#e8402a', theme.kerbB || '#ffffff', 2) });
    if (b.shape === 'circle') {
      const g = new THREE.CylinderGeometry(b.r + 0.6, b.r + 0.6, 1.4, 64, 1, true);
      const m = new THREE.Mesh(g, wallMat);
      m.material.side = THREE.DoubleSide;
      m.position.y = world.baseHeight + 0.7;
      this.group.add(m);
    } else {
      for (const [x, z, w, d] of [[0, b.d / 2 + 0.5, b.w + 2, 1], [0, -b.d / 2 - 0.5, b.w + 2, 1], [b.w / 2 + 0.5, 0, 1, b.d], [-b.w / 2 - 0.5, 0, 1, b.d]]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.4, d), wallMat);
        m.position.set(x, world.baseHeight + 0.7, z);
        this.group.add(m);
        const t = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.3, d + 0.1), trimMat);
        t.position.set(x, world.baseHeight + 1.45, z);
        this.group.add(t);
      }
    }

    // floors
    const topMats = {
      offroad: new THREE.MeshLambertMaterial({ map: rep(TEX.grass(theme.grassA, theme.grassB), 0.1) }),
      ice: new THREE.MeshLambertMaterial({ color: '#bfe9ff', map: rep(TEX.tiles('#dff5ff', '#c8ecff', '#a8dcf5'), 0.12) }),
      sand: new THREE.MeshLambertMaterial({ map: rep(TEX.sand(), 0.1) }),
      road: new THREE.MeshLambertMaterial({ map: rep(TEX.asphalt(theme.road), 0.12) }),
      lava: new THREE.MeshBasicMaterial({ map: rep(TEX.lava(), 0.05) }),
      boost: new THREE.MeshBasicMaterial({ map: TEX.chevrons().clone(), transparent: true }),
    };
    topMats.boost.map.needsUpdate = true;
    this.padTex = topMats.boost.map;
    this.topMats = topMats;
    const sideMat = createToyMaterial({ vertexColors: false, color: theme.cliff || '#c9a46c' });
    const propMat = createToyMaterial({ vertexColors: false, color: '#ff7a1a', spec: 1 });
    for (const f of world.floors) {
      const surf = f.surface || 'road';
      const flat = f.h <= world.baseHeight + 0.01 && f.shape !== 'ramp';
      if (f.prop === 'cone') {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(f.r, f.h, 12), propMat);
        cone.position.set(f.x, world.baseHeight + f.h / 2, f.z);
        this.group.add(cone);
        continue;
      }
      if (flat) {
        const g = f.shape === 'circle' ? new THREE.CircleGeometry(f.r, 32) : new THREE.PlaneGeometry(f.w, f.d);
        const m = new THREE.Mesh(g, topMats[surf] || topMats.road);
        m.rotation.set(-Math.PI / 2, 0, (f.rot || 0) + (f.pad ? Math.PI : 0));
        m.position.set(f.x, world.baseHeight + (f.pad ? 0.04 : 0.02), f.z);
        scaleUV(g, f.shape === 'circle' ? [f.r * 2, f.r * 2] : [f.w, f.d], f.pad ? [1, 1] : null);
        this.group.add(m);
        continue;
      }
      if (f.shape === 'ramp') {
        const g = wedge(f.w, f.d, f.h0 - world.baseHeight, f.h1 - world.baseHeight);
        const mm = new THREE.Mesh(g, f.glider ? topMats.boost : topMats.road);
        mm.position.set(f.x, world.baseHeight, f.z);
        mm.rotation.y = f.rot || 0;
        this.group.add(mm);
        continue;
      }
      if (f.shape === 'circle') {
        const g = new THREE.CylinderGeometry(f.r, f.r * 1.05, f.h - world.baseHeight, 24);
        const m = new THREE.Mesh(g, sideMat);
        m.position.set(f.x, world.baseHeight + (f.h - world.baseHeight) / 2, f.z);
        this.group.add(m);
        const top = new THREE.Mesh(new THREE.CircleGeometry(f.r, 24), topMats[surf] || topMats.road);
        top.rotation.x = -Math.PI / 2;
        top.position.set(f.x, f.h + 0.01, f.z);
        this.group.add(top);
      } else {
        const hh = f.h - world.baseHeight;
        const m = new THREE.Mesh(new THREE.BoxGeometry(f.w, hh, f.d), sideMat);
        m.position.set(f.x, world.baseHeight + hh / 2, f.z);
        m.rotation.y = f.rot || 0;
        this.group.add(m);
        const tg = new THREE.PlaneGeometry(f.w, f.d);
        scaleUV(tg, [f.w, f.d]);
        const top = new THREE.Mesh(tg, topMats[surf] || topMats.road);
        top.rotation.set(-Math.PI / 2, 0, f.rot || 0);
        top.position.set(f.x, f.h + 0.01, f.z);
        this.group.add(top);
      }
    }

    // decals
    // decorative props and landmarks around the arena (visual only)
    this.spinners = [];
    for (const pr of def.props || []) {
      const pd = PROPS[pr.type];
      if (!pd) { console.warn('[arena] unknown prop', pr.type); continue; }
      const fig = instantiateFigure(buildFigureTemplate(pd, { key: `lm:${pr.type}:${def.theme}`, detail: 0.5 }), { outline: true });
      fig.mesh.position.set(pr.x, (pr.y ?? 0) + world.baseHeight, pr.z);
      fig.mesh.rotation.y = pr.rot ?? Math.atan2(-pr.x, -pr.z);
      fig.mesh.scale.setScalar(pr.scale || 1);
      this.group.add(fig.mesh);
      if (fig.bones.spin) this.spinners.push({ bone: fig.bones.spin, speed: pr.spin ?? 1 });
    }
    // what's below the arena: cloud sea for sky islands, lava or ground otherwise
    {
      const big = size * 6;
      const under = theme.under || 'island';
      const mat = under === 'island' ? new THREE.MeshBasicMaterial({ color: theme.cloudSea || '#e8f6ff' })
        : theme.groundTex === 'lava' ? new THREE.MeshBasicMaterial({ map: rep(TEX.lava(), 1) })
          : new THREE.MeshLambertMaterial({ color: theme.grassA });
      if (mat.map) { mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping; mat.map.repeat.set(big / 20, big / 20); this.lavaTex = mat.map; }
      const g = new THREE.Mesh(new THREE.PlaneGeometry(big, big), mat);
      g.rotation.x = -Math.PI / 2;
      g.position.y = world.baseHeight - (under === 'island' ? 60 : 1.2);
      this.group.add(g);
      if (under === 'island') {
        const it = instantiateFigure(buildFigureTemplate(PROPS.island, { key: 'prop:island', detail: 0.5 }), { outline: false });
        const sc = (size / 2 + 6) / 9;
        it.mesh.scale.set(sc, sc * 0.6, sc);
        it.mesh.position.y = world.baseHeight - 0.2;
        this.group.add(it.mesh);
      }
    }

    for (const d of def.decals || []) {
      if (d.type === 'ring') {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(d.r * 2, d.r * 2), new THREE.MeshBasicMaterial({ map: TEX.ring(), transparent: true, depthWrite: false, opacity: 0.8 }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(d.x, world.baseHeight + 0.03, d.z);
        this.group.add(m);
      }
    }
  }

  update(dt, t) {
    if (this.padTex) this.padTex.offset.y = -t * 1.6;
    if (this.lavaTex) this.lavaTex.offset.y = -t * 0.02;
    for (const s of this.spinners || []) s.bone.rotation.z = t * s.speed;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    for (const m of Object.values(this.topMats || {})) { m.map?.dispose(); m.dispose(); }
    this.group.removeFromParent();
  }
}

function rep(tex, s) {
  const t = tex.clone();
  t.needsUpdate = true;
  t.userData.scale = s;
  return t;
}

function scaleUV(g, [w, d], fixed) {
  const uv = g.attributes.uv;
  const sx = fixed ? fixed[0] : w / 8, sy = fixed ? fixed[1] : d / 8;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  uv.needsUpdate = true;
}
