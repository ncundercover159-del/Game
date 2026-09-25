// Procedural "figure" builder. A figure JSON lists bones and primitive parts;
// everything is merged into ONE skinned geometry (each vertex rigidly bound to
// its bone) so a whole racer or vehicle costs one draw call (+1 for outline).
// The same format is used for racers, vehicles, wheels and gliders.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createToyMaterial, createOutlineMaterial } from './toyMaterial.js';

const DEG = Math.PI / 180;
const MAT_TYPES = {
  gloss: [1, 0], matte: [0, 0], soft: [0.45, 0], metal: [1, 0], glow: [0, 1], eye: [1, 0], dark: [0.6, 0],
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const MIRROR = new THREE.Matrix4().makeScale(-1, 1, 1);

function vec3(a, def = 0) {
  if (a === undefined || a === null) return [def, def, def];
  if (typeof a === 'number') return [a, a, a];
  return [a[0] ?? def, a[1] ?? def, a[2] ?? def];
}

function resolveColor(c, palette) {
  if (!c) return new THREE.Color(0xff00ff);
  if (palette && palette[c]) c = palette[c];
  return new THREE.Color(c);
}

function seg(r, detail, min = 6, max = 18) {
  const lo = detail < 0.5 ? Math.max(5, Math.round(min * 0.75)) : min;
  const hi = Math.max(lo, Math.round(max * Math.min(1, detail * 1.2)));
  return Math.max(lo, Math.min(hi, Math.round((7 + r * 32) * detail)));
}

// Tapered tube along a Catmull-Rom curve (horns, tails, tongues, antennas).
function taperTube(points, r0, r1, tubular, radial) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  const frames = curve.computeFrenetFrames(tubular, false);
  const pos = [], nor = [], idx = [];
  const P = new THREE.Vector3(), N = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(t, P);
    const r = r0 + (r1 - r0) * t;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const sin = Math.sin(a), cos = -Math.cos(a);
      N.set(0, 0, 0)
        .addScaledVector(frames.normals[i], cos)
        .addScaledVector(frames.binormals[i], sin)
        .normalize();
      pos.push(P.x + N.x * r, P.y + N.y * r, P.z + N.z * r);
      nor.push(N.x, N.y, N.z);
    }
  }
  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = (i + 1) * (radial + 1) + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  // end caps (fans)
  const cap = (i, flip) => {
    curve.getPointAt(i / tubular, P);
    const T = frames.tangents[i];
    const c = pos.length / 3;
    pos.push(P.x, P.y, P.z);
    nor.push(T.x * (flip ? -1 : 1), T.y * (flip ? -1 : 1), T.z * (flip ? -1 : 1));
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      if (flip) idx.push(c, a + 1, a); else idx.push(c, a, a + 1);
    }
  };
  cap(0, true);
  cap(tubular, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

function extrudeShape(pts, depth, bevel = 0.012) {
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 4,
  });
  g.translate(0, 0, -depth / 2);
  g.deleteAttribute('uv');
  const ng = g.index ? g : withIndex(g);
  ng.computeVertexNormals();
  return ng;
}

function withIndex(g) {
  const n = g.attributes.position.count;
  const idx = new Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  g.setIndex(idx);
  return g;
}

// Returns [{geo, color, mat}] in part-local space.
function shapeGeometries(part, palette, detail) {
  const out = [];
  const color = resolveColor(part.c, palette);
  const mat = MAT_TYPES[part.m || 'gloss'] || MAT_TYPES.gloss;
  const push = (geo, c = color, m = mat) => out.push({ geo, color: c, mat: m });
  switch (part.shape) {
    case 'sphere': {
      const r = part.r ?? 1;
      const sz = vec3(part.s, 1);
      const big = r * Math.max(sz[0], sz[1], sz[2]);
      const ws = seg(big, detail), hs = Math.max(5, Math.round(ws * 0.7));
      const g = new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, 0, (part.hemi ? 0.5 : 1) * Math.PI);
      push(g);
      break;
    }
    case 'capsule': {
      const r = part.r ?? 0.1;
      push(new THREE.CapsuleGeometry(r, part.len ?? 0.2, 3, seg(r, detail, 6, 12)));
      break;
    }
    case 'cone': {
      const r = part.r ?? 0.1, h = part.h ?? 0.3;
      const g = new THREE.ConeGeometry(r, h, seg(r, detail, 5, 12), 1);
      g.translate(0, h / 2, 0);
      push(g);
      break;
    }
    case 'cyl': {
      const rt = part.rt ?? part.r ?? 0.1, rb = part.rb ?? part.r ?? 0.1;
      push(new THREE.CylinderGeometry(rt, rb, part.h ?? 0.2, seg(Math.max(rt, rb), detail, 6, 16), 1));
      break;
    }
    case 'box': {
      const [w, h, d] = vec3(part.size, 0.2);
      const rad = Math.min(part.round ?? 0.03, Math.min(w, h, d) / 2 - 0.001);
      push(new RoundedBoxGeometry(w, h, d, 2, Math.max(0.001, rad)));
      break;
    }
    case 'torus': {
      push(new THREE.TorusGeometry(part.r ?? 0.2, part.tube ?? 0.04, 6, seg(part.r ?? 0.2, detail, 8, 20), (part.arc ?? 360) * DEG));
      break;
    }
    case 'lathe': {
      const pts = part.points.map((p) => new THREE.Vector2(p[0], p[1]));
      push(new THREE.LatheGeometry(pts, seg(0.3, detail, 8, 16)));
      break;
    }
    case 'tube': {
      const r0 = part.r0 ?? part.r ?? 0.05, r1 = part.r1 ?? part.r ?? 0.05;
      push(taperTube(part.points, r0, r1, part.segs ?? Math.round(10 * detail + 2), seg(Math.max(r0, r1), detail, 5, 10)));
      break;
    }
    case 'extrude': {
      push(extrudeShape(part.points, part.depth ?? 0.03, part.bevel ?? 0.012));
      break;
    }
    case 'eye': {
      const r = part.r ?? 0.1;
      const ws = seg(r, detail, 10, 16);
      const white = new THREE.SphereGeometry(r, ws, Math.round(ws * 0.75));
      push(white, resolveColor(part.white || '#ffffff', palette), MAT_TYPES.eye);
      const irisR = r * (part.iris_size ?? 0.62);
      const look = part.look || [0, 0];
      const dir = new THREE.Vector3(Math.sin(look[0] * DEG), Math.sin(look[1] * DEG), 1).normalize();
      const place = (g, dist, flat) => {
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
        g.scale(1, 1, flat);
        g.applyQuaternion(q);
        g.translate(dir.x * dist, dir.y * dist, dir.z * dist);
        return g;
      };
      push(place(new THREE.SphereGeometry(irisR, 12, 8), r * 0.9, 0.32), resolveColor(part.iris || '#3a7bd5', palette), MAT_TYPES.eye);
      const pupR = irisR * (part.pupil_size ?? 0.5);
      push(place(new THREE.SphereGeometry(pupR, 10, 6), r * 0.97, 0.3), resolveColor(part.pupil || '#101018', palette), MAT_TYPES.eye);
      if (part.highlight !== false) {
        const hl = new THREE.SphereGeometry(r * 0.16, 6, 4);
        const hx = dir.x * r * 0.95 + irisR * 0.38, hy = dir.y * r * 0.95 + irisR * 0.42, hz = dir.z * r * 0.93;
        hl.translate(hx, hy, hz + r * 0.1);
        push(hl, new THREE.Color(1, 1, 1), MAT_TYPES.glow);
      }
      if (part.lid) {
        // eyelid / brow shell for attitude: a partial sphere over the top of the eye
        const lid = part.lid;
        const cover = lid.cover ?? 0.35; // 0..1 fraction of the eye covered from the top
        const g = new THREE.SphereGeometry(r * 1.08, ws, 6, 0, Math.PI * 2, 0, Math.PI * cover);
        g.rotateX((lid.pitch ?? 25) * DEG);
        g.rotateZ((lid.tilt ?? 0) * DEG);
        push(g, resolveColor(lid.c || part.lidColor || '#333', palette), MAT_TYPES[lid.m || 'gloss']);
      }
      break;
    }
    default:
      console.warn('[figure] unknown shape', part.shape);
  }
  return out;
}

function partMatrix(part) {
  const p = vec3(part.p, 0);
  const r = vec3(part.rot, 0);
  const s = part.shape === 'sphere' ? vec3(part.s, 1) : vec3(part.s, 1);
  _e.set(r[0] * DEG, r[1] * DEG, r[2] * DEG, 'YXZ');
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_v.set(p[0], p[1], p[2]), _q, _s.set(s[0], s[1], s[2]));
}

function counterpart(name) {
  if (/L$/.test(name)) return name.slice(0, -1) + 'R';
  if (/L(\d+)$/.test(name)) return name.replace(/L(\d+)$/, 'R$1');
  return name;
}

// Expand bone definitions (auto-mirrored "…L" bones create "…R").
function expandBones(def) {
  const bones = { root: { parent: null, pos: [0, 0, 0], rot: [0, 0, 0] } };
  const src = def.bones || {};
  for (const name in src) {
    const b = src[name];
    bones[name] = { parent: b.parent || 'root', pos: vec3(b.pos, 0), rot: vec3(b.rot, 0), autoMirror: !!b.mirror };
    if (b.mirror) {
      const rn = counterpart(name);
      bones[rn] = {
        parent: counterpart(b.parent || 'root'),
        pos: [-bones[name].pos[0], bones[name].pos[1], bones[name].pos[2]],
        rot: [bones[name].rot[0], -bones[name].rot[1], -bones[name].rot[2]],
      };
    }
  }
  return bones;
}

// Expand mirrors and arrays into a flat list of {bone, matrix, part}.
// "ring": { n, r, a0, tilt } places n copies on a circle (XZ plane) facing outward.
function expandRings(parts) {
  const out = [];
  for (const part of parts) {
    if (!part.ring) { out.push(part); continue; }
    const { n = 6, r = 0.2, a0 = 0, tilt = 0 } = part.ring;
    const p = vec3(part.p, 0), rot = vec3(part.rot, 0);
    for (let i = 0; i < n; i++) {
      const a = (a0 + (360 * i) / n) * DEG;
      out.push({ ...part, ring: undefined, p: [p[0] + Math.sin(a) * r, p[1], p[2] + Math.cos(a) * r], rot: [rot[0] + tilt, rot[1] + a / DEG, rot[2]] });
    }
  }
  return out;
}

function expandParts(parts, bones, prefixBone) {
  const out = [];
  for (const part of expandRings(parts)) {
    const n = part.array?.n || 1;
    for (let i = 0; i < n; i++) {
      let pp = part;
      if (i > 0 || part.array) {
        const a = part.array || {};
        const dp = vec3(a.dp, 0), dr = vec3(a.dr, 0);
        const p = vec3(part.p, 0), r = vec3(part.rot, 0);
        const sc = Math.pow(a.ds ?? 1, i);
        const s = vec3(part.s, 1);
        pp = {
          ...part,
          p: [p[0] + dp[0] * i, p[1] + dp[1] * i, p[2] + dp[2] * i],
          rot: [r[0] + dr[0] * i, r[1] + dr[1] * i, r[2] + dr[2] * i],
          s: [s[0] * sc, s[1] * sc, s[2] * sc],
        };
      }
      const bone = prefixBone || pp.bone || 'root';
      const m = partMatrix(pp);
      out.push({ bone: bones[bone] ? bone : 'root', m, part: pp });
      // parts on an auto-mirrored "...L" bone are mirrored onto "...R" automatically
      const autoMirror = !prefixBone && bones[bone]?.autoMirror && pp.mirror !== false;
      if (pp.mirror || autoMirror) {
        const mb = counterpart(bone);
        const mm = MIRROR.clone().multiply(m).multiply(MIRROR);
        out.push({ bone: bones[mb] ? mb : bone, m: mm, part: pp });
      }
    }
  }
  return out;
}

const templateCache = new Map();

// Build (or fetch cached) merged skinned geometry + bone layout for a figure.
// attach: [{ bone, def }] extra part sets (wheels, glider, props) added to bones.
export function buildFigureTemplate(def, { key, attach = [], detail = 1 } = {}) {
  const cacheKey = key ? `${key}|${detail}` : null;
  if (cacheKey && templateCache.has(cacheKey)) return templateCache.get(cacheKey);

  const bones = expandBones(def);
  for (const a of attach) {
    if (a.def?.bones) Object.assign(bones, expandBones({ bones: a.def.bones }));
  }
  const names = Object.keys(bones);
  // order so parents come first
  const ordered = [];
  const visit = (n) => {
    if (ordered.includes(n)) return;
    const p = bones[n].parent;
    if (p && bones[p]) visit(p);
    ordered.push(n);
  };
  names.forEach(visit);
  const index = Object.fromEntries(ordered.map((n, i) => [n, i]));

  // bind-pose world matrices
  const world = {};
  for (const n of ordered) {
    const b = bones[n];
    _e.set(b.rot[0] * DEG, b.rot[1] * DEG, b.rot[2] * DEG, 'YXZ');
    _q.setFromEuler(_e);
    const local = new THREE.Matrix4().compose(_v.set(...b.pos), _q, _s.set(1, 1, 1));
    world[n] = b.parent ? world[b.parent].clone().multiply(local) : local;
  }

  const partList = expandParts(def.parts || [], bones);
  for (const a of attach) {
    const pal = { ...(def.palette || {}), ...(a.def.palette || {}) };
    for (const e of expandParts(a.def.parts || [], bones, a.bone)) {
      if (a.scale) e.m = new THREE.Matrix4().makeScale(a.scale, a.scale, a.scale).multiply(e.m);
      if (a.offset) e.m = new THREE.Matrix4().makeTranslation(...a.offset).multiply(e.m);
      e.palette = pal;
      out_push(partList, e);
    }
    if (a.mirrorTo) {
      for (const e of expandParts(a.def.parts || [], bones, a.mirrorTo)) {
        e.m = MIRROR.clone().multiply(e.m).multiply(MIRROR);
        e.palette = pal;
        out_push(partList, e);
      }
    }
  }

  const geos = [];
  let tris = 0;
  for (const e of partList) {
    const pal = e.palette || def.palette || {};
    for (const g of shapeGeometries(e.part, pal, detail)) {
      let geo = g.geo;
      if (geo.attributes.uv) geo.deleteAttribute('uv');
      if (geo.attributes.uv1) geo.deleteAttribute('uv1');
      if (!geo.index) withIndex(geo);
      _m.copy(world[e.bone]).multiply(e.m);
      geo.applyMatrix4(_m);
      const n = geo.attributes.position.count;
      const col = new Float32Array(n * 3), mat = new Float32Array(n * 2);
      const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      const bi = index[e.bone];
      for (let i = 0; i < n; i++) {
        col[i * 3] = g.color.r; col[i * 3 + 1] = g.color.g; col[i * 3 + 2] = g.color.b;
        mat[i * 2] = g.mat[0]; mat[i * 2 + 1] = g.mat[1];
        si[i * 4] = bi; sw[i * 4] = 1;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('mat', new THREE.BufferAttribute(mat, 2));
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
      tris += geo.index.count / 3;
      geos.push(geo);
    }
  }
  const geometry = geos.length ? mergeGeometries(geos, false) : new THREE.BufferGeometry();
  geos.forEach((g) => g.dispose());
  geometry.computeBoundingSphere();
  const tpl = { geometry, bones, ordered, tris, def, outline: def.outline ?? 0.016 };
  if (cacheKey) templateCache.set(cacheKey, tpl);
  return tpl;
}

function out_push(list, e) { list.push(e); }

// Create a live instance (own bones/skeleton) from a template.
export function instantiateFigure(tpl, { outline = true, material } = {}) {
  const boneObjs = {};
  const list = [];
  for (const n of tpl.ordered) {
    const b = tpl.bones[n];
    const bone = new THREE.Bone();
    bone.name = n;
    bone.position.set(...b.pos);
    bone.rotation.set(b.rot[0] * DEG, b.rot[1] * DEG, b.rot[2] * DEG, 'YXZ');
    boneObjs[n] = bone;
    list.push(bone);
    if (b.parent && boneObjs[b.parent]) boneObjs[b.parent].add(bone);
  }
  const mat = material || createToyMaterial();
  const mesh = new THREE.SkinnedMesh(tpl.geometry, mat);
  mesh.add(boneObjs.root);
  mesh.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(list);
  mesh.bind(skeleton);
  const bs = tpl.geometry.boundingSphere;
  mesh.boundingSphere = new THREE.Sphere(bs.center.clone(), bs.radius * 1.6);
  let outlineMesh = null;
  if (outline) {
    outlineMesh = new THREE.SkinnedMesh(tpl.geometry, createOutlineMaterial({ thickness: tpl.outline }));
    outlineMesh.bind(skeleton, mesh.bindMatrix);
    outlineMesh.boundingSphere = mesh.boundingSphere;
    mesh.add(outlineMesh);
  }
  const bind = {};
  for (const n in boneObjs) {
    const b = boneObjs[n];
    bind[n] = { pos: b.position.clone(), quat: b.quaternion.clone() };
  }
  return { mesh, outline: outlineMesh, bones: boneObjs, bind, material: mat, tpl };
}

export function clearFigureCache() {
  for (const t of templateCache.values()) t.geometry.dispose();
  templateCache.clear();
}
