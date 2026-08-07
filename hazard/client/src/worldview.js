// HAZARD PAY — the scene.
//
// Builds a Three scene from the same level data the server built its colliders
// from, then moves things about as snapshots arrive. It never simulates: every
// transform in here came off the wire. That is the point — eight people can
// only agree about where a piano is if exactly one machine decides.
//
// The one hard performance rule: the static build is merged into ONE mesh per
// material. A warehouse is 116 brushes and three levels of racking; drawn
// individually that is a draw call each, before a single prop. Merged, the
// whole building is about eight.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PROP_BY_ID } from '../../shared/props.js';
import { PFLAG, OFLAG } from '../../shared/protocol.js';
import { PLAYER_RADIUS, PLAYER_HEIGHT, INTERP_DELAY_MS } from '../../shared/tune.js';
import { materialFor } from './art/materials.js';
import { meshForProp } from './art/props.js';
import { BONE_SIZES } from './art/figure.js';
import { makeFigure } from './art/figure.js';

const _q = new THREE.Quaternion();

// Candela per unit of a level's lamp "intensity". See buildEnvironment.
const LIGHT_GAIN = 11;

// Hemisphere and sun are already in sensible units, but a job site wants to
// read as gloomy-but-legible rather than actually unlit: you have to be able to
// see the crate you are about to trip over.
// Tuned against the harness's mean-luma probe, which asserts a band rather than
// a floor: a scene can fail by being washed out just as easily as by being
// black, and "brighten it until the test passes" walks straight into the first.
const AMBIENT_GAIN = 0.62;
const SUN_GAIN = 0.8;

export class WorldView {
  constructor(level) {
    this.level = level;
    this.scene = new THREE.Scene();
    this.props = new Map();     // wire id -> { obj, def, from, to }
    this.figures = new Map();   // slot -> figure
    this.stats = { staticDraws: 0, tris: 0 };

    this.buildEnvironment();
    this.buildStatic();
    this.buildProps();
    this.buildExtractZone();
  }

  // --- sky, fog, lights -----------------------------------------------------
  buildEnvironment() {
    const env = this.level.env || {};
    const fog = env.fog || { color: '#202226', near: 12, far: 70 };
    this.scene.fog = new THREE.Fog(new THREE.Color(fog.color), fog.near, fog.far);
    this.scene.background = new THREE.Color(env.skyTop || '#1a1d22');

    const amb = env.ambient || {};
    // Hemisphere rather than flat ambient: a warehouse lit by one constant
    // colour has no sense of up, and every box reads as a sticker. Sky above,
    // bounced floor colour below, is most of what sells an interior cheaply.
    this.scene.add(new THREE.HemisphereLight(
      new THREE.Color(amb.sky || '#5b6472'),
      new THREE.Color(amb.ground || '#2b2521'),
      (amb.intensity ?? 0.85) * AMBIENT_GAIN,
    ));

    const sun = env.sun;
    if (sun) {
      const d = new THREE.DirectionalLight(new THREE.Color(sun.color), (sun.intensity ?? 1.2) * SUN_GAIN);
      const dir = sun.dir || [-0.4, -0.8, -0.4];
      // Place it far enough out that the shadow frustum covers the level.
      d.position.set(-dir[0] * 40, -dir[1] * 40, -dir[2] * 40);
      d.castShadow = true;
      d.shadow.mapSize.set(2048, 2048);
      const c = d.shadow.camera;
      c.left = -30; c.right = 30; c.top = 30; c.bottom = -30;
      c.near = 1; c.far = 110;
      d.shadow.bias = -0.0006;
      d.shadow.normalBias = 0.035;
      this.scene.add(d);
      this.sun = d;
    }

    // Three.js has used physical light units since r155: a point light's
    // intensity is candela and falls off with distance squared, so the
    // human-readable numbers a level author writes ("34") land at a fraction of
    // a lux by the time they reach the floor eight metres below. Rather than
    // make every level file carry four-digit magic numbers, convert here once.
    this.lamps = [];
    for (const l of this.level.lights || []) {
      const p = new THREE.PointLight(new THREE.Color(l.color), l.intensity * LIGHT_GAIN, l.range, 2);
      p.position.set(l.p[0], l.p[1], l.p[2]);
      this.scene.add(p);
      if (l.flicker) this.lamps.push({ light: p, base: l.intensity, amount: l.flicker });
    }
  }

  // --- the building ---------------------------------------------------------
  buildStatic() {
    const byMat = new Map();
    for (const b of this.level.brushes) {
      const g = new THREE.BoxGeometry(b.s[0], b.s[1], b.s[2]);

      // A little per-brush tonal jitter, baked into vertex colour. Free, and it
      // stops a hundred identical grey boxes reading as one flat surface.
      shadeBox(g, hashJitter(b.p));

      if (b.r) g.rotateX(b.r[0] || 0), g.rotateY(b.r[1] || 0), g.rotateZ(b.r[2] || 0);
      g.translate(b.p[0], b.p[1], b.p[2]);

      const key = b.mat || 'concrete';
      if (!byMat.has(key)) byMat.set(key, []);
      byMat.get(key).push(g);
    }

    for (const [mat, geos] of byMat) {
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      for (const g of geos) if (g !== merged) g.dispose();
      const mesh = new THREE.Mesh(merged, materialFor(mat));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `static:${mat}`;
      this.scene.add(mesh);
      this.stats.staticDraws++;
      this.stats.tris += merged.getAttribute('position').count / 3;
    }
  }

  buildProps() {
    // One prototype per kind, cloned per instance: forty props of a dozen kinds
    // means a dozen geometries, not forty.
    const protos = new Map();
    for (const def of Object.values(PROP_BY_ID)) protos.set(def.id, meshForProp(def));

    // The wire numbers props 1..n in the order the level lists them, which is
    // exactly the order World.spawnProps walks. Mirror it rather than inventing
    // ids, or every prop in the game is a different object to the server.
    let id = 1;
    for (const p of this.level.props) {
      const def = PROP_BY_ID[p.kind];
      if (!def) { id++; continue; }
      const obj = protos.get(def.id).clone();
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.position.set(p.p[0], p.p[1], p.p[2]);
      if (p.r) obj.rotation.set(p.r[0], p.r[1], p.r[2]);
      this.scene.add(obj);
      this.props.set(id, {
        obj, def, broken: false, extracted: false,
        from: { p: obj.position.clone(), q: obj.quaternion.clone(), t: 0 },
        to: { p: obj.position.clone(), q: obj.quaternion.clone(), t: 0 },
      });
      id++;
    }
  }

  /** The van: a wireframe volume so you can see where money has to end up. */
  buildExtractZone() {
    const e = this.level.extract;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(e.s[0], e.s[1], e.s[2]),
      new THREE.MeshBasicMaterial({
        color: 0x4fd08a, transparent: true, opacity: 0.07,
        depthWrite: false, side: THREE.BackSide,
      }),
    );
    box.position.set(e.p[0], e.p[1], e.p[2]);
    this.scene.add(box);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(e.s[0], e.s[1], e.s[2])),
      new THREE.LineBasicMaterial({ color: 0x6bf0a8, transparent: true, opacity: 0.5 }),
    );
    edges.position.copy(box.position);
    this.scene.add(edges);
  }

  // --- per snapshot ---------------------------------------------------------
  /**
   * Fold a decoded snapshot into the scene's interpolation buffers.
   *
   * Nothing is moved here. Everything gets a from/to pair and `sample()` walks
   * between them, INTERP_DELAY_MS in the past, so a dropped packet costs
   * smoothness rather than a teleport.
   */
  ingest(snap, renderNow) {
    for (const p of snap.props) {
      const rec = this.props.get(p.id);
      if (!rec) continue;
      rec.from.p.copy(rec.obj.position);
      rec.from.q.copy(rec.obj.quaternion);
      rec.from.t = renderNow;
      rec.to.p.set(p.x, p.y, p.z);
      rec.to.q.set(p.qx, p.qy, p.qz, p.qw);
      rec.to.t = renderNow + INTERP_DELAY_MS;

      const broken = (p.flags & OFLAG.BROKEN) !== 0;
      if (broken && !rec.broken) {
        rec.broken = true;
        rec.obj.material = materialFor('broken');
      }
      const gone = (p.flags & OFLAG.EXTRACTED) !== 0;
      if (gone !== rec.extracted) { rec.extracted = gone; rec.obj.visible = !gone; }
    }

    const seen = new Set();
    for (const pl of snap.players) {
      seen.add(pl.slot);
      let fig = this.figures.get(pl.slot);
      if (!fig) {
        fig = makeFigure(pl.slot);
        // root and rig are SIBLINGS in the scene, not nested. Ragdoll bone
        // transforms arrive in world space, so parenting the rig under the
        // figure's own position would apply that position twice.
        this.scene.add(fig.root);
        this.scene.add(fig.rig);
        this.figures.set(pl.slot, fig);
      }
      fig.from.p.copy(fig.root.position);
      fig.from.yaw = fig.yaw;
      fig.from.t = renderNow;
      fig.to.p.set(pl.x, pl.y, pl.z);
      fig.to.yaw = pl.yaw;
      fig.to.t = renderNow + INTERP_DELAY_MS;
      fig.ragdoll = (pl.flags & PFLAG.RAGDOLL) !== 0;
      fig.crouched = (pl.flags & PFLAG.CROUCH) !== 0;
      fig.moving = (pl.flags & PFLAG.SPRINT) !== 0;
    }

    // Bones only arrive for people who are currently furniture.
    for (const b of snap.bones) {
      const fig = this.figures.get(b.slot);
      if (!fig || !fig.bones[b.index]) continue;
      const bone = fig.bones[b.index];
      bone.position.set(b.x, b.y, b.z);
      bone.quaternion.set(b.qx, b.qy, b.qz, b.qw);
    }

    for (const [slot, fig] of this.figures) {
      if (seen.has(slot)) continue;
      this.scene.remove(fig.root);
      this.scene.remove(fig.rig);
      this.figures.delete(slot);
    }
  }

  /** Walk every interpolation buffer to `renderNow`. */
  sample(renderNow, dt) {
    for (const rec of this.props.values()) {
      const f = span(rec.from.t, rec.to.t, renderNow);
      rec.obj.position.lerpVectors(rec.from.p, rec.to.p, f);
      _q.copy(rec.from.q).slerp(rec.to.q, f);
      rec.obj.quaternion.copy(_q);
    }

    for (const fig of this.figures.values()) {
      const f = span(fig.from.t, fig.to.t, renderNow);
      fig.root.visible = !fig.ragdoll;
      fig.rig.visible = fig.ragdoll;
      if (fig.ragdoll) continue;
      fig.root.position.lerpVectors(fig.from.p, fig.to.p, f);
      fig.yaw = fig.from.yaw + shortestAngle(fig.to.yaw - fig.from.yaw) * f;
      fig.root.rotation.y = fig.yaw;
      fig.step(dt, fig.moving);
    }

    for (const l of this.lamps) {
      // A failing tube, not a strobe: mostly on, occasionally not.
      const n = Math.sin(renderNow * 0.017) * Math.sin(renderNow * 0.0071 + 1.3);
      l.light.intensity = l.base * LIGHT_GAIN * (1 - l.amount * Math.max(0, n) ** 3);
    }
  }

  /** Which prop is nearest the crosshair, for the grab reticle. */
  propAt(id) { return this.props.get(id); }

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
  }
}

function span(t0, t1, t) {
  if (t1 <= t0) return 1;
  const f = (t - t0) / (t1 - t0);
  return f < 0 ? 0 : f > 1 ? 1 : f;
}

function shortestAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Deterministic per-position jitter, so a rebuild shades identically. */
function hashJitter(p) {
  const h = Math.sin(p[0] * 12.9898 + p[1] * 78.233 + p[2] * 37.719) * 43758.5453;
  return (h - Math.floor(h)) * 0.14 - 0.07;
}

function shadeBox(geo, jitter) {
  const nrm = geo.getAttribute('normal');
  const n = geo.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const ny = nrm.getY(i);
    // Up faces catch the light, undersides fall away. Baked, so it costs
    // nothing and survives being merged into one giant mesh.
    const shade = (0.80 + ny * 0.20) * (1 + jitter);
    col[i * 3] = shade; col[i * 3 + 1] = shade; col[i * 3 + 2] = shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

export { PLAYER_RADIUS, PLAYER_HEIGHT, BONE_SIZES };
