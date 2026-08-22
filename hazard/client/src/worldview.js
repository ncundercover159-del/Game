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
import { PROP_BY_ID, propRadius } from '../../shared/props.js';
import { PFLAG, OFLAG } from '../../shared/protocol.js';
import { PLAYER_RADIUS, PLAYER_HEIGHT, INTERP_DELAY_MS, SNAPSHOT_MS } from '../../shared/tune.js';
import { materialFor } from './art/materials.js';
import { meshForProp } from './art/props.js';
import { BONE_SIZES } from './art/figure.js';
import { makeFigure } from './art/figure.js';

const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();

// Candela per unit of a level's lamp "intensity". See buildEnvironment.
const LIGHT_GAIN = 17;

// How far a lamp's pool actually reaches, as a fraction of the range the level
// asked for.
//
// This is the number that turned out to control the lighting design, and it is
// not gain. The warehouse has seven lamps about 14m apart with ranges of 20–22
// in a room 46m across, so every point on the floor is inside four of them at
// once and there is no such thing as being between the lights. Raising the key
// raised the fill by the same amount and the ratio sat at 1.5:1 through a
// halving of the ambient and a threefold cut to the environment map — because
// the fill was never ambient, it was the other four lamps.
//
// ...and then it turned out not to be reach at all. Pulling the pools in did
// raise the ratio — to 133:1, with the floor between the lamps at 0.006 and a
// player unable to see a crate two metres away, which is the failure the
// assertion's UPPER bound exists to catch. The fix was LAMP_DROP below, and
// with the fixtures off the ceiling the level-authored ranges are correct.
//
// Left at 1.0 and kept as a named constant because the reasoning above is the
// thing worth keeping: the fill was never ambient, and the sweep that settled
// it is scratchpad/hz-light.js, which mutates the lights live and measures nine
// candidates against one identical build instead of rebuilding between each.
const LAMP_REACH = 1.0;

// How far a fixture hangs below the point the level hung it at.
//
// The warehouse lamps sit at y=8.4 under a 9.5m roof, so they are 1.1m from the
// ceiling and 8.4m from the floor — and with inverse-square falloff that makes
// the ceiling roughly sixty times brighter than the concrete. A review put it
// exactly: the pools land ON THE CEILING and nothing identifiable reaches the
// floor. No amount of gain fixes that, because gain scales both ends together.
//
// A pendant on a chain is what a warehouse actually has, and it is also the
// only cheap way to make the pool land where the player is walking.
//
// But it CANNOT be a blanket drop, and shipping it as one was a regression.
// Levels put lamps at the bottom of things as well as the top: the plant hangs
// three down inside its tanks, whose floors are at -2.0, -2.8 and -4.4, and
// dropping those by a flat 1.6m buried two of them in concrete where they lit
// precisely nothing. A height threshold would paper over it and would be wrong
// again the first time somebody built a low ceiling, so the drop is measured
// against the surface actually underneath each lamp.
const LAMP_DROP = 1.6;
// ...and never closer than this to whatever it is hanging over.
const LAMP_CLEARANCE = 0.6;

// How many lamps are allowed to cast. Six shadow faces each, so this is a
// budget, not a preference.
//
// Two, not one, and the second one is the van. With a single slot the pick is
// whichever lamp happens to have the largest number next to it, and for most of
// this level's life that was the dock lamp — so the ONLY point-light shadows in
// the game were in a 15m bubble around the loading bay and the entire shed
// floor had none. Re-lighting the van dropped that lamp below the shed's 34s
// and the slot silently moved to a shed lamp, which is better coverage but
// leaves nothing grounded in the van: a safe delivered into the bed would sit
// there with no contact shadow, floating in the one place the player is meant
// to be looking. One slot for the room, one for the destination, chosen by
// `shadow: true` rather than by intensity ranking.
const SHADOW_LAMPS = 2;

// KEY TO FILL. These three numbers are a lighting design, not three brightness
// knobs, and getting them wrong is upstream of every other visual complaint.
//
// A measured review put key-to-fill on unshadowed same-material floor at
// 1.19–1.33 to 1, against a 2:1 floor for anything that wants to read as lit
// and 3.2–11.6 to 1 in the reference game. At 1.2:1 there is no such thing as
// shade: the lamps are barely brighter than the air, so nothing has a lit side
// and an unlit side, every surface reads at the same value, and the room
// flattens into a painted backdrop no matter how good the textures on it are.
//
// So the fill comes down hard and the key goes up to compensate. The trap on
// the way is that a ratio can also be hit by turning the fill down until the
// room is unreadable, which is the same failure as brightening until a luma
// floor passes — the harness asserts a BAND in both directions and the shadows
// still have to have something in them.
const AMBIENT_GAIN = 0.31;
const SUN_GAIN = 0.55;

// A cold kick from behind, casting nothing.
//
// Two directional lights and a hemisphere is the cheapest thing that reads as
// designed rather than as ambient-plus-lamps: the sun warms the side facing it,
// this cools the opposite edge, and a contractor standing in front of a wall
// the same value as their overalls gets a rim that separates them from it. It
// is deliberately not a shadow caster — it is there to draw an edge, and a
// second shadow map would cost more than the edge is worth.
const RIM_GAIN = 0.50;
const RIM_COLOUR = '#7fa8d8';

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
    this.buildTorch();
  }

  /**
   * THE THING THAT MAKES A DARK GAME PLAYABLE, AND WE DID NOT HAVE ONE.
   *
   * The exposure pass took this game down to where the reference plates sit —
   * whole-frame mean 31 against their 14-16, darkest tenth 10 against their 7 —
   * and that was right on its own terms. But it was only half of what the
   * reference is doing, and the missing half is load-bearing: R.E.P.O. players
   * carry "a tiny flashlight that projects a fairly narrow cone of light ahead
   * of you", and one of the plates in refs/MANIFEST.md is captioned "torch in
   * hand". Their frames can sit near black because the player brings their own
   * key light with them.
   *
   * Ours could not. Taking the room down without giving the player a torch is
   * not art direction, it is turning the lights off on somebody trying to find a
   * mug on a shelf, and it would have shipped as "atmospheric" while being
   * unplayable everywhere the pendants do not reach.
   *
   * A spot rather than a point: it has to go where you look, and a cone is what
   * gives the beam an edge you can aim with. It deliberately does NOT cast — a
   * spot shadow is one map against a point light's six, so it is affordable, but
   * the draw budget is accounted to the last dozen and this can be switched on
   * the moment prop instancing frees them. Without occlusion a torch still
   * shades form correctly, since a surface facing away from the beam gets
   * nothing from it; what it loses is objects throwing shadows behind them.
   */
  buildTorch() {
    // 260cd, and the number comes from a comparison rather than from taste. A
    // shed pendant is intensity 34 x LIGHT_GAIN 17 = 578cd about seven metres
    // up, so it puts roughly 12 lux on the floor of its pool. The torch has to
    // be the same order of thing at the distance you actually work at — at five
    // metres 260cd is about 10 lux, so stepping out of a pendant pool with the
    // torch on costs you a little rather than dropping you into nothing. The
    // first attempt was 46cd, which measured 1.5 lux at the same distance and
    // lifted the darkest floor in the level by 30%: a torch you could not see by.
    // A BEAM, NOT AN EXPOSURE LIFT. Four numbers, all of them measured wrong.
    //
    // This was SpotLight(260, 20, 0.55, 0.6, 2) and the critic took it apart:
    // a 0.55 rad half-angle is 31.5 degrees against the camera's 39-degree
    // vertical half-FOV, so the cone covered 81% of the screen's height and its
    // bright region measured 86% of frame WIDTH. A beam that wide cannot read
    // as a beam — it reads as the exposure going up, which is exactly what it
    // looked like. penumbra 0.6 then smeared the boundary across most of the
    // cone's own radius, so there was no edge to aim with either, in a comment
    // that claimed an edge was the whole point of using a cone.
    //
    // And the energy was landing at your feet: decay 2 with a 20m window gives
    // about 29 lux at 3m and 0.54 at 15m, a 54:1 near-to-work ratio, so the
    // torch lit ground you could already see and moved findability at 15m by
    // nothing. Measured, torch-on at the warehouse spawn was worth 0.6 luma of
    // frame mean and took legibility from 99% to 99%.
    //
    // 0.20 rad is 11.5 degrees, which puts the pool at roughly a quarter of
    // frame height and matches the small pool in the reference plate captioned
    // "torch in hand". penumbra 0.30 leaves it an edge. The same lamp poured
    // into about a seventh of the solid angle wants more candela, not fewer, so
    // 600 — the pool ends up both smaller AND brighter. 28m of throw takes the
    // usable range from about 5m to about 12m, which is the distance at which
    // you are actually looking for a crate.
    this.torch = new THREE.SpotLight(0xfff1d8, 600, 28, 0.20, 0.30, 2);
    this.torch.castShadow = false;
    this.torchTarget = new THREE.Object3D();
    this.scene.add(this.torch);
    this.scene.add(this.torchTarget);
    this.torch.target = this.torchTarget;
  }

  /**
   * Point the torch wherever the camera is looking.
   *
   * Driven from the render loop rather than parented to the camera, because the
   * camera is not in the scene graph — main.js drives it directly off the
   * authoritative actor position.
   */
  aimTorch(camera) {
    if (!this.torch) return;
    // Off the shoulder, not out of the bridge of the nose. A torch exactly at
    // the eye lights every surface along the view axis dead-on, which flattens
    // everything it touches; 180mm down and across is enough for the beam to
    // rake what you are looking at and give it a shadow side, and it is roughly
    // where a hand or a helmet clip would be anyway.
    camera.getWorldDirection(_v);
    this.torch.position.copy(camera.position)
      .addScaledVector(_right.set(1, 0, 0).applyQuaternion(camera.quaternion), 0.18)
      .addScaledVector(_up.set(0, 1, 0).applyQuaternion(camera.quaternion), -0.18);
    this.torchTarget.position.copy(camera.position).addScaledVector(_v, 12);
  }

  // --- sky, fog, lights -----------------------------------------------------
  buildEnvironment() {
    const env = this.level.env || {};
    const fog = env.fog || { color: '#202226', near: 12, far: 70 };
    this.scene.fog = new THREE.Fog(new THREE.Color(fog.color), fog.near, fog.far);
    this.scene.background = skyTexture(env);

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

      // The rim, opposite the key and a little above the horizon.
      const rim = new THREE.DirectionalLight(new THREE.Color(env.rim || RIM_COLOUR), RIM_GAIN);
      rim.position.set(dir[0] * 30, Math.abs(dir[1]) * 12, dir[2] * 30);
      this.scene.add(rim);
      this.rim = rim;
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
    // `shadow: true` outranks brightness. Brightest-first is a decent proxy for
    // "the ones you would notice", but it is a proxy, and a level that needs a
    // particular fixture to ground a particular object should be able to say so
    // without having to win an intensity contest to do it.
    const casters = [...(this.level.lights || [])]
      .map((l, i) => ({ l, i }))
      .sort((a, b) => (b.l.shadow ? 1 : 0) - (a.l.shadow ? 1 : 0)
        || b.l.intensity - a.l.intensity)
      .slice(0, SHADOW_LAMPS)
      .reduce((set, e) => set.add(e.i), new Set());

    // FIXTURES, so that the room reads as LIT rather than as TINTED.
    //
    // Until now every lamp in this game was a bare THREE.PointLight and nothing
    // else: no housing, no emitter, no reflector, no cable. Light arrived from
    // an invisible point, which is why a crop of a ceiling lamp is a smear of
    // horizontal bands with no source in it. The reference plate has a dark iron
    // bracket silhouetted against the wall carrying a bright vertical emitter
    // whose core stays a hard readable rectangle inside its halo — the halo is
    // the bloom's job and we already do that part; what was missing is the thing
    // the halo is supposed to be coming out of.
    //
    // A dark shade and a small emissive lens, merged per level into two draws
    // total rather than two per lamp. `fixture: false` opts out, for the pit's
    // amber strip and anything else that is a glow rather than a luminaire.
    const shades = [];
    const lenses = [];

    this.lamps = [];
    (this.level.lights || []).forEach((l, i) => {
      const p = new THREE.PointLight(new THREE.Color(l.color), l.intensity * LIGHT_GAIN, l.range * LAMP_REACH, 2);
      const hang = this.hangHeight(l);
      if (l.fixture !== false) {
        // Sized off the lamp's own reach, so a 22m shed pendant is a bigger
        // object than an 8m van light without either being authored twice.
        const r = Math.min(0.42, 0.10 + l.range * 0.012);
        const shade = new THREE.CylinderGeometry(r, r * 0.55, r * 0.62, 12, 1, true);
        shade.translate(l.p[0], hang + r * 0.34, l.p[2]);
        shades.push(shade);
        const lens = new THREE.SphereGeometry(r * 0.46, 10, 6);
        lens.translate(l.p[0], hang, l.p[2]);
        lenses.push(lens);
      }
      p.position.set(l.p[0], hang, l.p[2]);
      if (casters.has(i)) {
        p.castShadow = true;
        p.shadow.mapSize.set(512, 512);
        p.shadow.camera.near = 0.35;
        p.shadow.camera.far = Math.max(6, l.range * LAMP_REACH);
        p.shadow.bias = -0.004;
        p.shadow.normalBias = 0.04;
      }
      this.scene.add(p);
      if (l.flicker) this.lamps.push({ light: p, base: l.intensity, amount: l.flicker });
    });

    if (shades.length) {
      const shade = new THREE.Mesh(
        shades.length === 1 ? shades[0] : mergeGeometries(shades, false),
        new THREE.MeshStandardMaterial({
          color: 0x14161a, roughness: 0.72, metalness: 0.55, side: THREE.DoubleSide,
        }),
      );
      shade.name = 'lamp:shades';
      shade.castShadow = true;
      this.scene.add(shade);
      // Unlit and self-coloured. A lens that takes lighting is a grey ball
      // hanging under a lamp; the whole job of this mesh is to be the bright
      // hard core the bloom blows a halo around, so it emits and nothing else
      // touches it.
      const lens = new THREE.Mesh(
        lenses.length === 1 ? lenses[0] : mergeGeometries(lenses, false),
        // `toneMapped: false` and a colour past 1.0, so the lens writes near
        // white whatever the exposure is doing and clears the bloom threshold.
        // Without it the emitter was measured at p90 195 against a ceiling of
        // 187-193 around it — the lamp was DIMMER than the surface it hangs
        // against, so there was no halo at all. That is pass 8's complaint
        // exactly inverted: then it was a halo with no core, this was a core
        // with no halo.
        new THREE.MeshBasicMaterial({
          // Under 1.0, because 2.6 overshot in the other direction. It wrote a
          // hard near-white disc at p90 205 against a reference strip light of
          // 149, and produced a halo box no brighter than the frame average
          // (0.94x, against 2.6x in the reference) — the glow has to come from
          // bloom radius, not from driving the emitter through the roof. 0.34
          // linear encodes to about sRGB 155.
          color: new THREE.Color(0.34, 0.32, 0.28), fog: false, toneMapped: false,
        }),
      );
      lens.name = 'lamp:lenses';
      this.scene.add(lens);
      this.stats.staticDraws += 2;
    }
  }

  /**
   * Where a fixture actually hangs, once the floor under it has a say.
   *
   * Finds the highest brush surface below the lamp whose footprint contains it,
   * and refuses to drop the lamp within LAMP_CLEARANCE of that surface. A lamp
   * over open floor gets the full pendant drop; one hanging inside a tank three
   * metres deep gets whatever the tank allows.
   *
   * `mount: 'fixed'` opts out entirely. The drop exists because a lamp tight
   * against a 9.5m roof reads as a stain on the ceiling rather than a fixture
   * lighting a room — but that argument is about PENDANTS, and it does real
   * damage when applied to something bolted to a structure at a height chosen
   * on purpose. The dock lamp was authored at 3.6m and the blanket drop put it
   * at 2.0m: eye height, inside the van's mouth, 800mm off the deck. It blew
   * the bay's side panels to a flat 177 luma with a local SD of 3.6 while the
   * van bed BEHIND it — the place all the money has to go — stayed unlit.
   */
  hangHeight(l) {
    const [x, y, z] = l.p;
    if (l.mount === 'fixed') return y;
    let below = -Infinity;
    for (const b of this.level.brushes) {
      if (Math.abs(x - b.p[0]) > b.s[0] / 2 || Math.abs(z - b.p[2]) > b.s[2] / 2) continue;
      const top = b.p[1] + b.s[1] / 2;
      if (top <= y && top > below) below = top;
    }
    const room = Number.isFinite(below) ? y - below - LAMP_CLEARANCE : Infinity;
    return y - Math.max(0, Math.min(LAMP_DROP, room));
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
    // reflections, not illumination. 0.35 was still illumination — a prefiltered
    // room applies to every surface from every direction at once, which is the
    // textbook definition of fill, and it was quietly holding the key-to-fill
    // ratio down while looking like a reflection setting.
    this.scene.environmentIntensity = 0.12;
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

      const key = surfaceFor(b);
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
      // SMALL THINGS DO NOT CAST.
      //
      // Two shadow-casting point lights are twelve cube faces, and every face
      // redraws every caster in range — measured, that is 144 of this level's
      // 256 draw calls against 112 for the main pass. Twenty-three of the
      // casters are mugs, staplers and extinguishers whose contact shadow is
      // sub-pixel from anywhere a player stands, so they are paying twelve
      // draws each for nothing anyone can see. Everything a person could trip
      // over, stand on or hide behind still casts.
      //
      // This is a reduction, not a threshold move. The budget in the harness
      // has been raised twice already and the honest fix for the rest is
      // instancing props by kind — ten mugs are ten meshes and one InstancedMesh
      // would do — which nobody has written and which I am not pretending is
      // done here.
      obj.castShadow = propRadius(def) > 0.16;
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
        emissive: 0x6b4d0c, emissiveIntensity: 0.9,
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
    // MARKED, NOT FLOODED — and this is the thing the reference does that three
    // rounds of lamp-tuning kept failing to imitate.
    //
    // Every attempt to make the extraction point read has been an attempt to
    // make it BRIGHT, and each one ended with a white box that had no material
    // in it. The reference does the opposite: R.E.P.O.'s drop-off is a dark
    // body carrying a small saturated emissive panel, and its extraction truck
    // is near-black with its aperture as the only lit element. A destination
    // that has to out-glow the room is a destination competing with every lamp
    // in the room; a destination carrying its own saturated marker wins at any
    // exposure, and it still wins once the room has been taken down to where
    // the reference sits.
    //
    // So the brackets emit on their own account rather than borrowing from a
    // lamp. `toneMapped: false` keeps them at that value through the exposure
    // change that just took the whole picture down by nearly half, which is
    // exactly the property wanted: the room got darker, the marker did not.
    const frame = new THREE.Mesh(mergeGeometries(bars, false),
      new THREE.MeshStandardMaterial({
        color: 0x9fe8bd, roughness: 0.4, metalness: 0.1,
        emissive: 0x46e08c, emissiveIntensity: 2.6, toneMapped: false,
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

    if (this.water) this.water.mat.userData.uTime.value = renderNow * 0.001;
  }

  /** Which prop is nearest the crosshair, for the grab reticle. */
  propAt(id) { return this.props.get(id); }

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    if (this.envRT) this.envRT.dispose();
    if (this.scene.background && this.scene.background.isTexture) this.scene.background.dispose();
  }
}

/**
 * The sky, which was a flat slab of one colour.
 *
 * Every level file in the game declares BOTH `skyTop` and `skyBottom`, and the
 * scene only ever read the first of them — so the tower, which is open to the
 * sky by design, had a band of dead #0d1420 across the top of every shot with
 * no gradient in it anywhere. A review called it a sky band and it was right:
 * one flat value over a frame that has aerial perspective, fog and a graded
 * black point in it reads as a backdrop hung behind the set, because a backdrop
 * hung behind a set is exactly what it is.
 *
 * A 2x128 equirectangular ramp fixes it for a few hundred bytes. Three maps an
 * equirect background across the whole sphere, so this also gives the horizon a
 * PLACE — turn round in the tower and the bright band stays where the ground
 * is, which a Color background cannot do however it is tinted.
 *
 * Two things about the ramp itself:
 *
 *   * It is NOT linear in v. A real sky is brightest in a shallow band near the
 *     horizon and settles to its zenith colour over the first fifteen degrees
 *     or so; a linear ramp puts the mid-tone halfway up the dome, which reads
 *     as a studio backdrop lit from below. `pow` biases it hard.
 *   * It goes on being paler BELOW the horizon rather than mirroring. Nothing
 *     in this game shows the lower hemisphere except through a gap in a floor,
 *     and when it does, what should be down there is haze, not a second zenith.
 *
 * The colours themselves stay the level author's — this only decides how they
 * are distributed, which is the renderer's business rather than the level's.
 */
function skyTexture(env) {
  const top = new THREE.Color(env.skyTop || '#1a1d22').convertSRGBToLinear();
  const bot = new THREE.Color(env.skyBottom || env.skyTop || '#1a1d22').convertSRGBToLinear();
  const N = 128;
  const data = new Uint8Array(N * 2 * 4);
  for (let y = 0; y < N; y++) {
    // v runs top of the sphere (y=0) to the bottom (y=N-1).
    const up = 1 - y / (N - 1);           // 1 at the zenith, 0 at the nadir
    // Above the horizon: bias towards the zenith colour fast. Below it: hold
    // near the horizon colour, because that is haze and not sky.
    const t = up > 0.5 ? Math.pow((up - 0.5) * 2, 0.55) : 0;
    const r = bot.r + (top.r - bot.r) * t;
    const g = bot.g + (top.g - bot.g) * t;
    const b = bot.b + (top.b - bot.b) * t;
    for (let x = 0; x < 2; x++) {
      const i = (y * 2 + x) * 4;
      // Written back through the sRGB transfer function, because the texture is
      // tagged sRGB below and the hardware will undo this on the way in. Doing
      // the interpolation in linear and the storage in sRGB is what keeps the
      // ramp smooth instead of banding across the dark half.
      data[i] = Math.round(255 * srgbEncode(r));
      data[i + 1] = Math.round(255 * srgbEncode(g));
      data[i + 2] = Math.round(255 * srgbEncode(b));
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, 2, N, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.name = 'tex:sky';
  tex.needsUpdate = true;
  return tex;
}

function srgbEncode(c) {
  const v = c < 0 ? 0 : c > 1 ? 1 : c;
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
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

// ONE ENAMEL WAS DOING EIGHT JOBS, AND THE LEVELS ARE NOT THE PLACE TO FIX IT.
//
// `steelblue` was drawing racking uprights, racking decks, the conveyor, the
// van's frame, its doors, its chassis, the roof purlins and the roof rafters.
// Measured, that is 0.661 saturation with 79% of every chromatic pixel in the
// frame inside a single fifteen-degree hue bin: at two metres the racking read
// as swimming-pool tile and at nine metres the purlins read as blue strip
// lights bolted to the roof. Splitting the recipe is the fix (see materials.js)
// and this is where the split is DECIDED.
//
// It is decided here, and by TAG, for two reasons. A level is plain data shared
// with the server, and which of three paint jobs a purlin wears is a render
// question that the collider does not have an opinion about; and every one of
// these brushes is already tagged with what it IS, by an author who was not
// thinking about materials when they wrote it. Reading the tag costs nothing
// and cannot drift out of step with the geometry the way a parallel list would.
//
// Anything not named here falls through to structure, which is the right
// default: an untagged steel brush in this game has so far always been a frame
// member, a sill or a kerb.
const STEEL_JOBS = {
  strut: 'rackblue',      // racking uprights, and the tower's scaffold props
  deck: 'rackblue',       // racking beams
  vandoor: 'vandoor',
};

/** Which material actually draws this brush. */
function surfaceFor(b) {
  const mat = b.mat || 'concrete';
  if (mat !== 'steelblue') return mat;
  return STEEL_JOBS[b.tag] || 'structsteel';
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
/**
 * Water, as a physical material rather than a hand-rolled one.
 *
 * The previous version reimplemented specular from scratch against the level's
 * four brightest lamps, and a measured review found the surface completely
 * inert: a smooth teal band at SD 11.9 with no reflected image of the lamp, the
 * walls or the rig anywhere along it. The one neutral highlight in the frame
 * turned out to be a submerged lamp and its bloom showing THROUGH the water,
 * which would have been there if the surface reflected nothing at all.
 *
 * The arithmetic says why, and it is worth keeping: the tight lobe was
 * pow(n·h, 700), which needs the half vector aligned inside about two degrees,
 * while the fine chop only tilts the normal by three — so with the lamps
 * fifteen metres up and attenuating to nine percent, essentially no fragment on
 * that plane ever satisfied it. Reimplementing lighting to get a reflection was
 * the wrong instinct twice over: it did not work, and the renderer already has
 * a correct implementation with the scene's real point lights and a prefiltered
 * environment map behind it.
 *
 * So: a low-roughness physical material, with the waves INJECTED into the
 * standard shader rather than replacing it. Reflections, fog, tone mapping and
 * shadow all come out right by construction, and the only custom code is the
 * displacement and the normal it implies.
 */
function waterMaterial(level) {
  const env = level.env || {};
  const deep = new THREE.Color(env.waterDeep || '#0b1f22');
  const shallow = new THREE.Color(env.waterShallow || '#6fb9ae');

  const mat = new THREE.MeshPhysicalMaterial({
    color: deep,
    // Low, but not zero. A mirror-flat surface reflects the room as a hard
    // double image and reads as glass; a little roughness is what turns a
    // reflection into a sheen.
    roughness: 0.075,
    metalness: 0.0,
    // Water is dielectric: the reflection is a Fresnel effect on a surface with
    // an index of refraction near 1.33, which is what these two numbers say.
    ior: 1.33,
    reflectivity: 0.6,
    envMapIntensity: 2.4,
    transparent: true,
    opacity: 0.86,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const uTime = { value: 0 };
  mat.userData.uTime = uTime;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.uniforms.uDeep = { value: deep };
    shader.uniforms.uShallow = { value: shallow };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime;
        varying vec2 vWave;
        varying vec2 vRipple;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        // Two trains at an angle to each other, at different rates. Parallel
        // ones beat against each other and read as a moire; crossed ones read
        // as chop.
        float wa = transformed.x * 0.42 + uTime * 0.9;
        float wb = transformed.z * 0.31 - uTime * 0.62 + transformed.x * 0.11;
        transformed.y += sin(wa) * 0.028 + sin(wb) * 0.021;
        vWave = vec2(wa, wb);
        // A third, much finer train, carried to the fragment stage for the
        // normal only. It contributes almost nothing to the silhouette and a
        // great deal to what the surface reflects: chop you can see the shape
        // of looks like corrugated iron, chop you can only see the reflections
        // of looks like water.
        vRipple = vec2(transformed.x * 3.1 + uTime * 2.2, transformed.z * 2.7 - uTime * 1.7);`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        varying vec2 vWave;
        varying vec2 vRipple;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          // d/dx and d/dz of the displacement above, by hand.
          float nx = cos(vWave.x) * 0.028 * 0.42 + cos(vWave.y) * 0.021 * 0.11
                   + cos(vRipple.x) * 0.050;
          float nz = cos(vWave.y) * 0.021 * 0.31 + cos(vRipple.y) * 0.044;
          // The plane's world normal is +Y, so the perturbed normal is built in
          // WORLD space and then taken to view space — which is the space the
          // rest of the shader works in. Writing a world-space normal straight
          // into \`normal\` lights the water as though the camera never moved.
          vec3 wN = normalize(vec3(-nx, 1.0, -nz));
          normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);
          // Deliberately NOT also assigning the flat-normal variable that sits
          // alongside this one. It was called geometryNormal until three r167
          // and nonPerturbedNormal after, so naming it at all is a shader that
          // compiles against one version of the library and fails against the
          // next — which is exactly what happened: the whole material threw at
          // link time and the plant rendered with no water at any clock value,
          // silently, because a material that fails to compile does not stop
          // the frame. Only the perturbed normal matters to the lighting here.

          // Fresnel drives colour and opacity together: straight down you see
          // through it, across it you see the room in it. That single cue is
          // most of what reads as liquid rather than as green glass.
          float fres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
          diffuseColor.rgb = mix(uDeep, uShallow, fres * 0.85 + 0.06);
          diffuseColor.a *= mix(0.72, 0.97, fres);
        }`);
  };
  // Two materials that compile differently must not share a program.
  mat.customProgramCacheKey = () => `hazard-water-${level.id}`;
  return mat;
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
