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
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PROP_BY_ID } from '../../shared/props.js';
import { PFLAG, OFLAG } from '../../shared/protocol.js';
import { PLAYER_RADIUS, PLAYER_HEIGHT, INTERP_DELAY_MS, SNAPSHOT_MS } from '../../shared/tune.js';
import { materialFor } from './art/materials.js';
import { meshForProp } from './art/props.js';
import { BONE_SIZES } from './art/figure.js';
import { makeFigure } from './art/figure.js';

const _q = new THREE.Quaternion();

// Candela per unit of a level's lamp "intensity". See buildEnvironment.
const LIGHT_GAIN = 11;

// How many lamps are allowed to cast. Six shadow faces each, so this is a
// budget, not a preference.
const SHADOW_LAMPS = 1;

// Hemisphere and sun are already in sensible units, but a job site wants to
// read as gloomy-but-legible rather than actually unlit: you have to be able to
// see the crate you are about to trip over. Tuned against the harness's
// mean-luma probe, which asserts a band rather than a floor — a scene fails by
// being washed out just as readily as by being black, and "brighten it until
// the test passes" walks straight into the first.
const AMBIENT_GAIN = 0.62;
const SUN_GAIN = 0.8;

export class WorldView {
  constructor(level, renderer) {
    this.level = level;
    this.scene = new THREE.Scene();
    this.props = new Map();     // wire id -> { obj, def, from, to }
    this.figures = new Map();   // slot -> figure
    this.stats = { staticDraws: 0, tris: 0 };
    this.snapAt = 0;      // arrival time of the newest snapshot
    this.snapPrev = 0;    // ...and of the one before it

    this.buildEnvironment();
    this.buildEnvironmentMap(renderer);
    this.buildStatic();
    this.buildProps();
    this.buildExtractZone();
    this.buildWater();
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
    // Which lamps cast. This is not a nicety: the only other caster is an
    // exterior sun that the roof completely occludes, so without it NOTHING
    // indoors casts a shadow and every object floats a few centimetres above
    // wherever it is standing. A review measured the floor directly beneath a
    // contractor as *brighter* than the floor beside them — an anti-shadow.
    //
    // A point light costs six shadow faces, so this cannot be all of them.
    // Brightest first, capped, is a good proxy for "the ones you would notice".
    const casters = [...(this.level.lights || [])]
      .map((l, i) => ({ l, i }))
      .sort((a, b) => b.l.intensity - a.l.intensity)
      .slice(0, SHADOW_LAMPS)
      .reduce((set, e) => set.add(e.i), new Set());

    this.lamps = [];
    (this.level.lights || []).forEach((l, i) => {
      const p = new THREE.PointLight(new THREE.Color(l.color), l.intensity * LIGHT_GAIN, l.range, 2);
      p.position.set(l.p[0], l.p[1], l.p[2]);
      if (casters.has(i)) {
        p.castShadow = true;
        p.shadow.mapSize.set(512, 512);
        p.shadow.camera.near = 0.35;
        p.shadow.camera.far = Math.max(6, l.range);
        p.shadow.bias = -0.004;
        p.shadow.normalBias = 0.04;
      }
      this.scene.add(p);
      if (l.flicker) this.lamps.push({ light: p, base: l.intensity, amount: l.flicker });
    });
  }

  /**
   * A cheap image-based environment.
   *
   * Without scene.environment every metalness value in the material set is
   * inert — metal has nothing to reflect, so it renders as flat dark grey and
   * there is not a single specular highlight anywhere in the frame. RoomEnvironment
   * is a handful of emissive boxes prefiltered into a cubemap: it costs one
   * render at boot and buys back every metallic surface in the game.
   */
  buildEnvironmentMap(renderer) {
    if (!renderer) return;
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const room = new RoomEnvironment();
    const rt = pmrem.fromScene(room, 0.04);
    this.scene.environment = rt.texture;
    // A dim interior should not be lit by a bright studio; the map is here for
    // reflections, not illumination.
    this.scene.environmentIntensity = 0.35;
    this.envRT = rt;
    room.dispose?.();
    pmrem.dispose();
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

  /**
   * The van: where money has to end up, marked on the floor.
   *
   * This was a translucent green box with a wireframe around it, and a review
   * called the current version "a swimming pool" — worse than the wireframe it
   * replaced, on the grounds that a wireframe reads as unfinished while a
   * filled volume reads as finished and wrong. Both were the same mistake:
   * putting a debug gizmo in the shipping frame and tinting the air inside a
   * space you have to look through to aim.
   *
   * A real loading bay marks its floor, not its air. Hazard-striped decal on
   * the deck, four corner brackets standing proud of it, nothing at all between
   * you and the thing you are trying to put down. It reads as signage rather
   * than as a rendering artefact, and the fog gets to do its job through the
   * volume instead of fighting a green wash.
   */
  buildExtractZone() {
    const e = this.level.extract;
    const [w, h, d] = e.s;
    const floor = e.p[1] - h / 2 + 0.012;
    const marks = [];

    // The striped deck. Alternating slabs rather than a texture: it costs one
    // merged geometry, it never moires at a grazing angle, and the stripe size
    // is authored in metres so it reads the same in every level.
    const STRIPE = 0.34;
    for (let x = -w / 2; x < w / 2 - 0.02; x += STRIPE * 2) {
      const seg = Math.min(STRIPE, w / 2 - x);
      const g = new THREE.BoxGeometry(seg, 0.02, d - 0.1);
      g.translate(e.p[0] + x + seg / 2, floor, e.p[2]);
      marks.push(g);
    }
    const deck = new THREE.Mesh(mergeGeometries(marks, false),
      new THREE.MeshStandardMaterial({
        color: 0xe8b53a, roughness: 0.72, metalness: 0.0,
        emissive: 0x3a2a06, emissiveIntensity: 0.4,
      }));
    deck.receiveShadow = true;
    this.scene.add(deck);

    // Corner brackets: two short bars per corner, at knee height, so the volume
    // is legible from inside it as well as from across the room.
    const bars = [];
    const L = Math.min(0.5, w / 4);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const cx = e.p[0] + sx * (w / 2 - 0.05);
        const cz = e.p[2] + sz * (d / 2 - 0.05);
        const a = new THREE.BoxGeometry(L, 0.06, 0.06);
        a.translate(cx - sx * L / 2, floor + 0.42, cz);
        const b = new THREE.BoxGeometry(0.06, 0.06, L);
        b.translate(cx, floor + 0.42, cz - sz * L / 2);
        const post = new THREE.BoxGeometry(0.06, 0.44, 0.06);
        post.translate(cx, floor + 0.22, cz);
        bars.push(a, b, post);
      }
    }
    const frame = new THREE.Mesh(mergeGeometries(bars, false),
      new THREE.MeshStandardMaterial({
        color: 0x9fe8bd, roughness: 0.4, metalness: 0.1,
        emissive: 0x1d5c3a, emissiveIntensity: 0.9,
      }));
    frame.castShadow = true;
    this.scene.add(frame);
  }

  // --- water ------------------------------------------------------------------
  /**
   * The rising water, if this level has any.
   *
   * One plane for the site and one more per declared tank, because a tank whose
   * valve was skipped fills independently and its surface sits above the one
   * outside it. The zone planes are hidden until they diverge, so the common
   * case is a single extra draw call.
   *
   * The surface is the deadline made visible, which is the whole reason it is
   * worth shading properly rather than tinting a quad: a player has to be able
   * to read how fast it is coming from across the room.
   */
  buildWater() {
    this.water = null;
    const f = this.level.flood;
    if (!f) return;

    const b = brushBounds(this.level.brushes);
    const geo = new THREE.PlaneGeometry(b.w, b.d, Math.ceil(b.w), Math.ceil(b.d));
    geo.rotateX(-Math.PI / 2);
    const mat = waterMaterial(this.level);
    const surface = new THREE.Mesh(geo, mat);
    surface.position.set(b.cx, f.start, b.cz);
    surface.renderOrder = 2;
    this.scene.add(surface);

    const zones = [];
    for (const [name, z] of Object.entries(f.zones || {})) {
      const w = z.x[1] - z.x[0], d = z.z[1] - z.z[0];
      const zg = new THREE.PlaneGeometry(w, d, Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(d)));
      zg.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(zg, mat);
      m.position.set((z.x[0] + z.x[1]) / 2, f.start, (z.z[0] + z.z[1]) / 2);
      m.renderOrder = 3;
      m.visible = false;
      this.scene.add(m);
      zones.push({ name, mesh: m });
    }

    this.water = { surface, zones, mat, y: f.start };
  }

  /**
   * Move the surface. `zoneYs` arrives in the level's declaration order, which
   * is the order the server walks and the order the wire uses — three places
   * agreeing on one iteration order rather than three places carrying a name.
   */
  setWater(y, zoneYs) {
    if (!this.water || y === null || y === undefined) return;
    this.water.y = y;
    this.water.surface.position.y = y;
    this.water.zones.forEach((z, i) => {
      const zy = zoneYs && zoneYs.length > i ? zoneYs[i] : y;
      z.mesh.position.y = zy;
      // Only worth drawing when it disagrees with the sheet underneath it;
      // coplanar with the main surface it is pure z-fighting.
      z.mesh.visible = zy > y + 0.02;
    });
  }

  /** Is this point under the water where it is standing? */
  submerged(x, y, z) {
    if (!this.water) return false;
    for (const zn of this.water.zones) {
      const f = this.level.flood.zones[zn.name];
      if (x < f.x[0] || x > f.x[1] || z < f.z[0] || z > f.z[1]) continue;
      return zn.mesh.visible ? y < zn.mesh.position.y : y < this.water.y;
    }
    return y < this.water.y;
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
    // A span runs between the arrival times of two consecutive snapshots, and
    // `sample` reads it one interval in the past. That is not the obvious
    // arrangement and the obvious one has a bug in it worth spelling out.
    //
    // Anchoring each span to "now, until now plus the delay" and then sampling
    // at now is fine at 60fps: a dozen frames pass between snapshots and the
    // fraction climbs 0 to 1 as intended. But the moment a frame takes longer
    // than SNAPSHOT_MS, every frame ingests, every ingest resets the span to
    // now, and the fraction is pinned at 0 for ever. Every remote player
    // freezes solid — not stuttering, not rubber banding, motionless — while
    // the simulation underneath runs perfectly. It is invisible at a
    // developer's frame rate and impossible to diagnose from a bug report.
    //
    // Real arrival times cannot do that. If snapshots are 90ms apart because
    // the client is struggling, the span is 90ms wide and playback is smooth
    // and 90ms behind, which is exactly what it should be.
    this.snapPrev = this.snapAt || (renderNow - SNAPSHOT_MS);
    this.snapAt = renderNow;

    for (const p of snap.props) {
      const rec = this.props.get(p.id);
      if (!rec) continue;
      rec.from.p.copy(rec.seeded ? rec.to.p : rec.obj.position);
      rec.from.q.copy(rec.seeded ? rec.to.q : rec.obj.quaternion);
      rec.from.t = this.snapPrev;
      rec.to.p.set(p.x, p.y, p.z);
      rec.to.q.set(p.qx, p.qy, p.qz, p.qw);
      rec.to.t = this.snapAt;
      rec.seeded = true;

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
      fig.from.p.copy(fig.seeded ? fig.to.p : fig.root.position);
      fig.from.yaw = fig.seeded ? fig.to.yaw : fig.yaw;
      fig.from.t = this.snapPrev;
      fig.to.p.set(pl.x, pl.y, pl.z);
      fig.to.yaw = pl.yaw;
      fig.to.t = this.snapAt;
      fig.seeded = true;
      fig.ragdoll = (pl.flags & PFLAG.RAGDOLL) !== 0;
      fig.crouched = (pl.flags & PFLAG.CROUCH) !== 0;
      fig.moving = (pl.flags & PFLAG.SPRINT) !== 0;
      // Carrying changes the whole pose, so it has to reach the figure. It was
      // already on the wire and was being decoded and thrown away.
      fig.hauling = (pl.flags & PFLAG.HAULING) !== 0;
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

  /**
   * Walk every interpolation buffer to one snapshot in the past.
   *
   * The buffer is two snapshots deep, so the delay has to be one interval — no
   * more. INTERP_DELAY_MS is 110ms, which is 2.2 intervals: sampling there
   * would land before the start of the only span we hold and render everything
   * a full snapshot stale and stepping. It stays imported as the figure to
   * match if the buffer is ever made deeper.
   */
  sample(renderNow, dt) {
    const T = renderNow - SNAPSHOT_MS;
    void INTERP_DELAY_MS;
    for (const rec of this.props.values()) {
      const f = span(rec.from.t, rec.to.t, T);
      rec.obj.position.lerpVectors(rec.from.p, rec.to.p, f);
      _q.copy(rec.from.q).slerp(rec.to.q, f);
      rec.obj.quaternion.copy(_q);
    }

    for (const fig of this.figures.values()) {
      const f = span(fig.from.t, fig.to.t, T);
      fig.root.visible = !fig.ragdoll;
      fig.rig.visible = fig.ragdoll;
      // Knocked over, the body comes off the wire and needs no animating — but
      // the eyes are still theirs, and a contractor whose pupils freeze the
      // instant they hit the floor stops being a character and becomes a prop.
      if (fig.ragdoll) { fig.step(dt, false, { down: true }); continue; }
      fig.root.position.lerpVectors(fig.from.p, fig.to.p, f);
      fig.yaw = fig.from.yaw + shortestAngle(fig.to.yaw - fig.from.yaw) * f;
      fig.root.rotation.y = fig.yaw;
      fig.step(dt, fig.moving, { crouched: fig.crouched, hauling: fig.hauling });
    }

    for (const l of this.lamps) {
      // A failing tube, not a strobe: mostly on, occasionally not.
      const n = Math.sin(renderNow * 0.017) * Math.sin(renderNow * 0.0071 + 1.3);
      l.light.intensity = l.base * LIGHT_GAIN * (1 - l.amount * Math.max(0, n) ** 3);
    }

    if (this.water) this.water.mat.uniforms.uTime.value = renderNow * 0.001;
  }

  /** Which prop is nearest the crosshair, for the grab reticle. */
  propAt(id) { return this.props.get(id); }

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    if (this.envRT) this.envRT.dispose();
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

/** The axis-aligned footprint of a level, with a little slack past the walls. */
function brushBounds(brushes) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const b of brushes) {
    x0 = Math.min(x0, b.p[0] - b.s[0] / 2); x1 = Math.max(x1, b.p[0] + b.s[0] / 2);
    z0 = Math.min(z0, b.p[2] - b.s[2] / 2); z1 = Math.max(z1, b.p[2] + b.s[2] / 2);
  }
  return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0 + 2, d: z1 - z0 + 2 };
}

/**
 * Water, cheaply but not lazily.
 *
 * Three things do all the work, and none of them is a texture. Two crossed sine
 * trains displace the surface and are differentiated analytically for a normal,
 * so the ripples light correctly instead of being a pattern painted on a flat
 * sheet. A Fresnel term drives both colour and opacity — looking straight down
 * you see through it, looking across it you see the room reflected in it, which
 * is the single cue that reads as "liquid" rather than "green glass". And the
 * whole thing is fogged with the scene's own fog, because a surface that stays
 * crisp at forty metres while the wall behind it fades reads as a decal.
 */
const WATER_LAMPS = 4;

function waterMaterial(level) {
  const env = level.env || {};
  const deep = new THREE.Color(env.waterDeep || '#0b1f22');
  const shallow = new THREE.Color(env.waterShallow || '#6fb9ae');

  // The four brightest lamps, as actual reflections.
  //
  // The obvious cheap version — one fixed overhead light direction — does not
  // work and fails in a way that looks like a different bug entirely. Looking
  // down at your feet, the half vector is aligned with a near-vertical normal
  // EVERYWHERE, so the highlight fires across the whole surface at once and the
  // water renders as a flat blown-out sheet with no detail in it. A reflection
  // has to be localised to be read as a reflection, and localising it means
  // knowing where the lamps actually are.
  const lamps = [...(level.lights || [])]
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, WATER_LAMPS);
  const pos = [], col = [];
  for (let i = 0; i < WATER_LAMPS; i++) {
    const l = lamps[i];
    pos.push(l ? new THREE.Vector3(l.p[0], l.p[1], l.p[2]) : new THREE.Vector3());
    const c = new THREE.Color(l ? l.color : '#000');
    col.push(c.multiplyScalar(l ? Math.min(1.6, l.intensity / 26) : 0));
  }

  return new THREE.ShaderMaterial({
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uDeep: { value: deep },
        uShallow: { value: shallow },
        uLampPos: { value: pos },
        uLampCol: { value: col },
      },
    ]),
    vertexShader: `
      #include <common>
      #include <fog_pars_vertex>
      uniform float uTime;
      varying vec3 vWorld;
      varying vec2 vWave;
      varying vec2 vRipple;
      void main() {
        vec3 p = position;
        // Two trains at an angle to each other, at different rates. Parallel
        // ones beat against each other and read as a moire; crossed ones read
        // as chop.
        float a = p.x * 0.42 + uTime * 0.9;
        float b = p.z * 0.31 - uTime * 0.62 + p.x * 0.11;
        p.y += sin(a) * 0.028 + sin(b) * 0.021;
        vWave = vec2(a, b);
        // A third, much finer train, carried to the fragment stage for the
        // highlight only. Without it the specular is one smooth blob sliding
        // about; chop is what breaks a reflection into glitter, and glitter is
        // most of what makes a surface read as water rather than as jade.
        vRipple = vec2(p.x * 3.1 + uTime * 2.2, p.z * 2.7 - uTime * 1.7);
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        // Named mvPosition, not because it reads well but because
        // <fog_vertex> is a text include that references that exact
        // identifier. Call it anything else and the shader fails to compile
        // at runtime, which shows up as an invisible surface rather than as
        // an error anybody notices.
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      #define LAMPS ${WATER_LAMPS}
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uLampPos[LAMPS];
      uniform vec3 uLampCol[LAMPS];
      varying vec3 vWorld;
      varying vec2 vWave;
      varying vec2 vRipple;
      void main() {
        // d/dx and d/dz of the displacement above, by hand, plus the fine train
        // folded into the normal at a much smaller amplitude.
        // The fine train contributes almost nothing to the silhouette and a
        // great deal to the normal — 50mm/m of slope. That ratio is the point:
        // chop you can see the shape of looks like corrugated iron, chop you
        // can only see the highlights of looks like water.
        float nx = cos(vWave.x) * 0.028 * 0.42 + cos(vWave.y) * 0.021 * 0.11
                 + cos(vRipple.x) * 0.050;
        float nz = cos(vWave.y) * 0.021 * 0.31 + cos(vRipple.y) * 0.044;
        vec3 N = normalize(vec3(-nx, 1.0, -nz));
        vec3 V = normalize(cameraPosition - vWorld);

        float f = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
        vec3 col = mix(uDeep, uShallow, f * 0.85 + 0.06);

        // One highlight per lamp, placed where that lamp actually is, and TIGHT.
        //
        // The previous exponents (60 and 700) were measured against the surface
        // alone and produced a specular that touched 23% of the water and added
        // three luma to it. That is not a reflection, it is a uniform wash, and
        // a review looking at the same frame called the surface "smooth, with
        // no reflected image of anything" — correctly, while a whole-frame
        // highlight metric passed the shot on the strength of a submerged lamp
        // showing THROUGH the water.
        //
        // A reflection is a small number of very bright pixels. So: the broad
        // lobe is much tighter and much weaker, the sharp lobe is far tighter
        // and far stronger, and the fine chop — 50mm/m of slope, invisible in
        // the silhouette — is what shatters the sharp one into a glitter path
        // instead of a disc. Values well over 1.0 are intended; the post chain
        // rolls them off, and a highlight that cannot clip is not a highlight.
        vec3 spec = vec3(0.0);
        for (int i = 0; i < LAMPS; i++) {
          vec3 d = uLampPos[i] - vWorld;
          float dist = length(d);
          if (dist < 0.001) continue;
          vec3 H = normalize(d / dist + V);
          float nh = max(dot(N, H), 0.0);
          // Gentler falloff than before: a ceiling lamp is eight metres up and
          // the old inverse-square-ish term had already thrown it away.
          float atten = 1.0 / (1.0 + dist * dist * 0.018);
          spec += uLampCol[i] * (pow(nh, 240.0) * 0.22 + pow(nh, 2600.0) * 6.0) * atten;
        }
        col += spec;

        // A highlight is reflected light, so it does not care what is behind
        // the surface: where the glint is strong the water must go opaque, or
        // alpha blending drags every white sparkle back down towards the teal
        // underneath it and the frame ends up with no neutral highlight at all.
        float alpha = max(mix(0.62, 0.93, f), clamp(max(spec.r, max(spec.g, spec.b)), 0.0, 1.0));
        gl_FragColor = vec4(col, alpha);
        #include <fog_fragment>
      }
    `,
  });
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
