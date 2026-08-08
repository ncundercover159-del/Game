// HAZARD PAY — a contractor, as geometry.
//
// ==========================================================================
//  MODULE INTERFACE
//
//  export function makeFigure(slot): Figure
//  export const BONE_SIZES: number[][]   // must match server/actor.js BONES
//
//  A Figure is two skeletons in one object, because a contractor is two things
//  depending on whether they are upright:
//
//   * `rig`  — eleven loose boxes, positioned directly from the wire. Used
//              while PFLAG.RAGDOLL is set. The caller writes bones[i].position
//              and .quaternion in WORLD space, so `rig` must not be nested
//              under anything that transforms it.
//   * `root` — an articulated figure with its origin at the FEET and +Z
//              forward, walked by step(dt, moving, opts). Used while upright.
//
//  Exactly one of the two is visible at a time; the caller flips them.
// ==========================================================================
//
// THE DESIGN.
//
// The contractor is not a person. It is a hard hat with a hi-vis vest under it
// and four stubby extremities attached as an afterthought — head roughly a
// third of total height, arms that could not reach their own hat, boots two
// sizes too big. Those proportions are the joke and they are also legibility:
// at twenty metres in a dark warehouse the silhouette is a bright wedge with a
// dome on top, which no crate ever looks like.
//
// The eyes are the whole character. Two glossy spheres with pupils on a
// two-axis spring, so they lag when you turn, overshoot when you stop, and
// slosh when you land. Nothing else in this file buys as much per line: a box
// with wobbling eyes reads as alive, and a beautifully modelled body without
// them reads as a mannequin. They stay attached to the head bone through the
// ragdoll too, so a contractor lying face down in a puddle is still looking at
// you.
//
// THE DRAW CALL BUDGET. Eight of these can be on screen. Every static detail —
// vest bands, belt, buckles, boot soles, hat brim — is baked into its parent's
// geometry with a per-vertex tint and merged, so the whole figure is twelve
// meshes across two materials instead of forty across six. Only things that
// have to move separately get their own node.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Mirrors BONES in server/actor.js. If that list changes, this must too — the
// wire sends bone indices, not names, so a mismatch silently attaches a thigh
// to a head.
export const BONE_SIZES = [
  [0.34, 0.24, 0.22], // pelvis
  [0.38, 0.40, 0.24], // chest
  [0.24, 0.26, 0.24], // head
  [0.13, 0.30, 0.13], // armLU
  [0.11, 0.30, 0.11], // armLL
  [0.13, 0.30, 0.13], // armRU
  [0.11, 0.30, 0.11], // armRL
  [0.16, 0.38, 0.16], // legLU
  [0.14, 0.38, 0.14], // legLL
  [0.16, 0.38, 0.16], // legRU
  [0.14, 0.38, 0.14], // legRL
];

// One hue per slot, spread far enough apart that eight of them are still
// distinguishable in a dim warehouse at twenty metres. Silhouette does most of
// the work up close; colour does it at distance.
const SLOT_HUES = [0.06, 0.55, 0.33, 0.86, 0.13, 0.71, 0.45, 0.95];

// Eight builds, cycled by slot, so a crew of four is four different creatures
// rather than one creature in four colours. Each is a handful of numbers
// because that is all a caricature needs: how tall, how wide, how big is the
// head, how far apart are the eyes, and is the hat a dome or a bucket.
const BUILDS = [
  { name: 'THE FOREMAN', h: 1.00, girth: 1.00, head: 1.00, eyes: 0.105, gap: 0.85, hat: 'dome', snout: 0.00 },
  { name: 'THE TALL ONE', h: 1.14, girth: 0.80, head: 0.84, eyes: 0.088, gap: 0.70, hat: 'bucket', snout: 0.05 },
  { name: 'THE UNIT', h: 0.86, girth: 1.34, head: 1.16, eyes: 0.125, gap: 1.05, hat: 'dome', snout: 0.00 },
  { name: 'THE APPRENTICE', h: 0.82, girth: 0.92, head: 1.28, eyes: 0.140, gap: 1.15, hat: 'dome', snout: 0.00 },
  { name: 'THE LIFER', h: 0.96, girth: 1.12, head: 0.92, eyes: 0.082, gap: 0.75, hat: 'bucket', snout: 0.09 },
  { name: 'THE NEW START', h: 1.06, girth: 0.88, head: 1.04, eyes: 0.115, gap: 0.95, hat: 'dome', snout: 0.03 },
  { name: 'THE SUBCONTRACTOR', h: 0.90, girth: 1.20, head: 1.10, eyes: 0.098, gap: 0.90, hat: 'bucket', snout: 0.07 },
  { name: 'THE AGENCY LAD', h: 1.09, girth: 0.96, head: 0.96, eyes: 0.132, gap: 1.00, hat: 'dome', snout: 0.00 },
];

// --- a tiny tinted-geometry builder -----------------------------------------
// Everything static is accumulated here and merged into one buffer, so a boot
// with a sole and a toe cap costs the same as a boot.
class Part {
  constructor() { this.geos = []; }

  add(geo, colour, [x, y, z] = [0, 0, 0], rot) {
    if (rot) { geo.rotateX(rot[0] || 0); geo.rotateY(rot[1] || 0); geo.rotateZ(rot[2] || 0); }
    geo.translate(x, y, z);
    const c = new THREE.Color(colour);
    const n = geo.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.geos.push(geo);
    return this;
  }

  box(w, h, d, colour, at, rot) { return this.add(new THREE.BoxGeometry(w, h, d), colour, at, rot); }
  cyl(rt, rb, h, colour, at, rot, seg = 10) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), colour, at, rot);
  }
  ball(r, colour, at, seg = 10) {
    return this.add(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)), colour, at);
  }

  mesh(mat) {
    const g = this.geos.length === 1 ? this.geos[0] : mergeGeometries(this.geos, false);
    for (const x of this.geos) if (x !== g) x.dispose();
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
}

export function makeFigure(slot) {
  const hue = SLOT_HUES[slot % SLOT_HUES.length];
  const build = BUILDS[slot % BUILDS.length];

  const vest = new THREE.Color().setHSL(hue, 0.78, 0.54);
  const vestDark = new THREE.Color().setHSL(hue, 0.62, 0.30);
  const cloth = new THREE.Color().setHSL(hue, 0.22, 0.19);   // trousers, sleeves
  const rubber = new THREE.Color(0x1d2026);                   // boots and gloves
  const hiviz = new THREE.Color(0xf6d34a);
  const strap = new THREE.Color(0x2a2d34);
  const skin = new THREE.Color().setHSL((hue + 0.5) % 1, 0.30, 0.62);

  // Two materials for the whole contractor. Matte carries the body; gloss
  // carries the hat and the eyes, which are the only things that should catch a
  // lamp.
  const matte = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.82, metalness: 0.02,
  });
  const gloss = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.16, metalness: 0.05,
  });

  const S = build.h;          // overall height scale
  const G = build.girth;      // how wide through the middle
  const HD = build.head;      // head scale

  // Landmarks, all in metres off the floor. Everything below hangs off these,
  // so a build variant is genuinely a different body rather than a scaled one.
  const hipY = 0.60 * S;
  const chestY = 0.97 * S;
  const neckY = 1.24 * S;

  // --- hips: a wedge with a tool belt ---------------------------------------
  const hips = new Part()
    .box(0.34 * G, 0.24 * S, 0.24 * G, cloth)
    .box(0.37 * G, 0.07, 0.27 * G, strap, [0, 0.10 * S, 0])
    .box(0.07, 0.05, 0.03, hiviz, [0, 0.10 * S, 0.14 * G])
    // The thing every one of them has on their hip and none of them uses.
    .cyl(0.035, 0.035, 0.16, rubber, [0.20 * G, 0.02, 0.02], [0.25, 0, 0])
    .mesh(matte);
  hips.position.set(0, hipY, 0);

  // --- torso: a barrel in a vest that does not fit -------------------------
  const torso = new Part()
    .add(new THREE.CylinderGeometry(0.23 * G, 0.20 * G, 0.44 * S, 12), cloth)
    // The vest: a slightly larger shell, open at the front, hanging low.
    .add(new THREE.CylinderGeometry(0.245 * G, 0.235 * G, 0.34 * S, 12, 1, true), vest,
      [0, -0.03 * S, 0])
    // Bands, not plates. A box laid across a round torso meets it at four
    // corners and reads as a slab bolted on; the figure ends up looking like a
    // stack of trays. A shallow cylinder a few millimetres proud of the vest
    // wraps it the way a reflective band actually does.
    .cyl(0.252 * G, 0.252 * G, 0.055, hiviz, [0, 0.04 * S, 0], null, 12)
    .cyl(0.256 * G, 0.256 * G, 0.055, hiviz, [0, -0.09 * S, 0], null, 12)
    .box(0.075, 0.34 * S, 0.06, hiviz, [-0.12 * G, -0.02 * S, 0.21 * G])
    .box(0.075, 0.34 * S, 0.06, hiviz, [0.12 * G, -0.02 * S, 0.21 * G])
    .box(0.16, 0.10, 0.04, vestDark, [0.12 * G, 0.10 * S, 0.22 * G])   // ID card
    // Shoulders, so the arms have somewhere to be.
    .ball(0.115 * G, cloth, [-0.235 * G, 0.16 * S, 0])
    .ball(0.115 * G, cloth, [0.235 * G, 0.16 * S, 0])
    .mesh(matte);
  torso.position.set(0, chestY, 0);

  // --- head -----------------------------------------------------------------
  // Its own group so it can bobble on the neck independently of the torso.
  const headGroup = new THREE.Group();
  headGroup.position.set(0, neckY, 0);

  const skullParts = new Part()
    .add(new THREE.SphereGeometry(0.17 * HD, 12, 10), skin, [0, 0.02, 0])
    .box(0.06, 0.05, 0.05, cloth, [0, 0.16 * HD, 0]);           // a tuft
  // Some of them have a bit of a snout. It is not explained.
  //
  // Skipped outright rather than added at zero size: mergeGeometries returns
  // NULL when the inputs disagree about which attributes they have, and a
  // degenerate placeholder without normals takes the whole figure with it. The
  // failure is silent in the console-free sense that matters — makeFigure
  // throws once per frame per player and the scene simply has no people in it.
  if (build.snout > 0) {
    skullParts.add(new THREE.SphereGeometry(0.075 * HD, 8, 6), skin,
      [0, -0.02, (0.14 + build.snout) * HD]);
  }
  const skull = skullParts.mesh(matte);
  headGroup.add(skull);

  // The hat and both eyeballs, in one mesh.
  //
  // They are the only glossy things on the body and none of them moves relative
  // to the head, so they merge. That is not fussiness: a shadow-casting point
  // light costs six faces, so every mesh on a figure is drawn about seven times
  // a frame, and eight contractors turn each spare node into fifty-odd draw
  // calls. Only the pupils stay loose, because only the pupils move.
  const hatShell = build.hat === 'bucket'
    ? new THREE.CylinderGeometry(0.20 * HD, 0.215 * HD, 0.20 * HD, 14)
    : new THREE.SphereGeometry(0.205 * HD, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const shell = new Part()
    .add(hatShell, hiviz, [0, build.hat === 'bucket' ? 0.19 * HD : 0.09 * HD, 0])
    .cyl(0.30 * HD, 0.30 * HD, 0.022, hiviz, [0, 0.095 * HD, 0.03 * HD], null, 14)
    .box(0.045, 0.16 * HD, 0.045, hiviz, [0, 0.20 * HD, 0]);    // the ridge
  const EYE_AT = [0.082 * HD * build.gap, 0.03 * HD, 0.125 * HD];
  for (const side of [-1, 1]) {
    shell.ball(build.eyes * HD, 0xf6f4ee, [side * EYE_AT[0], EYE_AT[1], EYE_AT[2]], 12);
  }
  const hat = shell.mesh(gloss);
  headGroup.add(hat);

  // A beacon, because somebody in the crew has to be the one with the beacon.
  // No shadow: it is 32mm across and emissive, so what it casts is noise.
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 8, 6),
    new THREE.MeshStandardMaterial({
      color: 0xff5a2a, emissive: 0xff4a18, emissiveIntensity: 2.4, roughness: 0.4,
    }),
  );
  beacon.castShadow = false;
  beacon.position.set(0, 0.30 * HD, -0.02);
  beacon.visible = slot % 3 === 0;
  headGroup.add(beacon);

  // --- the pupils, which are the entire character ---------------------------
  //
  // BOTH pupils in one mesh. They are driven by a single spring, so they always
  // carry the same offset, so one node can move them both — the geometry holds
  // a sphere at each eye and the mesh itself does the sliding. Two nodes would
  // cost about four more draw calls per contractor for no visible difference.
  //
  // No shadow: they sit on the surface of an eyeball inside a hat brim, and the
  // shadow they cast has never been visible in any frame.
  const EYE_R = build.eyes * HD * 0.66;
  const pupilGeo = mergeGeometries([-1, 1].map((side) => {
    const g = new THREE.SphereGeometry(build.eyes * HD * 0.46, 10, 8);
    g.translate(side * EYE_AT[0], 0, 0);
    return g;
  }), false);
  const pupils = new THREE.Mesh(pupilGeo,
    new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.08 }));
  pupils.castShadow = false;
  headGroup.add(pupils);
  const eyes = [{ node: pupils, base: EYE_AT, r: EYE_R }];

  // --- arms: too short to be useful, ending in enormous gloves --------------
  const armLen = 0.30 * S;
  const makeArm = (side) => {
    const g = new THREE.Group();
    g.position.set(side * 0.245 * G, chestY + 0.15 * S, 0);
    const m = new Part()
      .add(new THREE.CylinderGeometry(0.062, 0.055, armLen, 8), cloth, [0, -armLen / 2, 0])
      .box(0.115, 0.05, 0.115, vest, [0, -armLen + 0.03, 0])       // cuff
      .ball(0.082, rubber, [0, -armLen - 0.045, 0])                 // the glove
      .box(0.05, 0.075, 0.09, rubber, [side * 0.045, -armLen - 0.05, 0.03])  // thumb
      .mesh(matte);
    g.add(m);
    return g;
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // --- legs: stumps in boots ------------------------------------------------
  const legLen = hipY - 0.10 * S;
  const makeLeg = (side) => {
    const g = new THREE.Group();
    g.position.set(side * 0.10 * G, hipY - 0.08 * S, 0);
    const m = new Part()
      .add(new THREE.CylinderGeometry(0.075, 0.068, legLen, 8), cloth, [0, -legLen / 2, 0])
      .box(0.155, 0.10, 0.17, rubber, [0, -legLen - 0.01, 0.008])          // ankle
      .box(0.175, 0.075, 0.30, rubber, [0, -legLen - 0.055, 0.055])        // the boot
      .box(0.185, 0.035, 0.315, 0x0e1013, [0, -legLen - 0.088, 0.055])     // the sole
      .box(0.13, 0.045, 0.05, hiviz, [0, -legLen - 0.03, 0.19])            // toe cap
      .mesh(matte);
    g.add(m);
    return g;
  };
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  const root = new THREE.Group();
  root.add(hips, torso, headGroup, armL, armR, legL, legR);

  // --- ragdoll rig ----------------------------------------------------------
  // Eleven loose boxes driven straight from the wire, but the head bone keeps
  // its hat and its eyes: a contractor face down in a puddle staring at you is
  // funnier than a contractor face down in a puddle, and it costs two clones.
  const rig = new THREE.Group();
  const boneTint = [cloth, vest, skin, cloth, cloth, cloth, cloth, cloth, cloth, cloth, cloth];
  const bones = BONE_SIZES.map((s, i) => {
    const p = new Part().box(s[0], s[1], s[2], boneTint[i]);
    if (i === 1) {
      p.box(s[0] * 1.06, 0.05, s[2] * 1.06, hiviz, [0, 0.09, 0]);
      p.box(s[0] * 1.06, 0.05, s[2] * 1.06, hiviz, [0, -0.06, 0]);
    }
    const m = p.mesh(matte);
    rig.add(m);
    return m;
  });
  const ragHat = hat.clone();
  ragHat.position.set(0, 0.04, 0);
  bones[2].add(ragHat);
  const ragPupils = pupils.clone();
  bones[2].add(ragPupils);
  const ragEyes = [{ node: ragPupils, base: [EYE_AT[0], EYE_AT[1] - 0.02, 0.10], r: EYE_R }];
  rig.visible = false;

  const fig = {
    slot, root, rig, bones, yaw: 0, build: build.name,
    ragdoll: false, crouched: false, moving: false, hauling: false,
    phase: 0,
    // Pupil spring state, in eyeball-local units. Two axes, one integrator.
    eye: { x: 0, y: 0, vx: 0, vy: 0 },
    lastYaw: 0, lastPos: new THREE.Vector3(), bobble: 0, bobbleV: 0,
    from: { p: new THREE.Vector3(), yaw: 0, t: 0 },
    to: { p: new THREE.Vector3(), yaw: 0, t: 0 },

    /**
     * A walk cycle driven by wall clock rather than distance travelled.
     *
     * Distance would be better — feet would match the ground — but the wire
     * does not carry it for other players, and inferring it from interpolated
     * positions jitters every time a packet is late. A clock-driven cycle that
     * only runs while moving is the honest cheap option.
     */
    step(dt, fast, opts = {}) {
      // Face down, the body is coming off the wire bone by bone and none of the
      // upright rig is visible. Only the eyes still have anything to do, and
      // they take their cue from the head bone tumbling rather than from a root
      // position that stopped being updated the moment you fell over.
      if (opts.down) {
        const head = bones[2];
        const d = fig.lastPos.distanceTo(head.position);
        fig.lastPos.copy(head.position);
        const shake = clamp(d * 90, 0, 14);
        fig.eye.vx += (-fig.eye.x * 150 - fig.eye.vx * 9) * dt + (Math.sin(fig.phase * 9) * shake) * dt;
        fig.eye.vy += (-fig.eye.y * 150 - fig.eye.vy * 9) * dt + (shake - 0.8) * dt * 3;
        fig.phase += dt * 6;
        fig.eye.x = clamp(fig.eye.x + fig.eye.vx * dt, -0.62, 0.62);
        fig.eye.y = clamp(fig.eye.y + fig.eye.vy * dt, -0.62, 0.62);
        for (const e of ragEyes) place(e, fig.eye.x, fig.eye.y);
        return;
      }

      const crouched = opts.crouched ?? fig.crouched;
      const hauling = opts.hauling ?? fig.hauling;
      const moved = fig.to.p.distanceToSquared(fig.from.p) > 1e-5;

      const speed = fast ? 13 : 8.5;
      fig.phase += dt * (moved ? speed : 1.2);
      const s = Math.sin(fig.phase);
      const c = Math.cos(fig.phase);
      const amp = moved ? (fast ? 0.72 : 0.52) : 0.05;

      // Legs and arms in opposition, the arms lagging a little so the whole
      // thing does not look like a metronome.
      legL.rotation.x = s * amp;
      legR.rotation.x = -s * amp;
      if (hauling) {
        // Both arms out front, sagging under whatever it is. Stubby arms make
        // this read as a toddler carrying a television, which is correct.
        armL.rotation.x = -1.28 + s * 0.06;
        armR.rotation.x = -1.28 - s * 0.06;
        armL.rotation.z = 0.18; armR.rotation.z = -0.18;
      } else {
        armL.rotation.x = -s * amp * 0.62;
        armR.rotation.x = s * amp * 0.62;
        armL.rotation.z = 0.10 + Math.abs(s) * 0.06;
        armR.rotation.z = -0.10 - Math.abs(s) * 0.06;
      }

      // The waddle. Roll into each step and rise on the push-off — this is what
      // separates "walking" from "sliding with the legs moving", and at these
      // proportions it is most of the comedy.
      const bounce = moved ? Math.abs(s) * 0.045 * S : 0;
      const roll = moved ? c * 0.09 : 0;
      const squat = crouched ? 0.34 * S : 0;

      hips.position.y = hipY + bounce - squat;
      hips.rotation.z = roll;
      torso.position.y = chestY + bounce * 1.15 - squat * 0.9;
      torso.rotation.z = roll * 0.7;
      torso.rotation.x = (hauling ? 0.16 : 0) + (crouched ? 0.22 : 0) + (moved ? 0.06 : 0);
      legL.position.y = hipY - 0.08 * S - squat;
      legR.position.y = hipY - 0.08 * S - squat;
      armL.position.y = chestY + 0.15 * S + bounce - squat * 0.9;
      armR.position.y = chestY + 0.15 * S + bounce - squat * 0.9;

      // --- the head bobbles, and the eyes lag behind the head --------------
      // A second-order spring on the neck. Under-damped on purpose: the head
      // arrives after the body and keeps going for a moment, which is the
      // difference between a figure and a puppet.
      const dyaw = shortest(fig.yaw - fig.lastYaw);
      fig.lastYaw = fig.yaw;
      fig.bobbleV += (-fig.bobble * 46 - fig.bobbleV * 6.5) * dt + dyaw * 1.4;
      fig.bobble += fig.bobbleV * dt;
      fig.bobble = clamp(fig.bobble, -0.55, 0.55);

      headGroup.position.y = neckY + bounce * 1.3 - squat * 0.85;
      headGroup.rotation.z = fig.bobble * 0.5 + roll * 0.35;
      headGroup.rotation.y = fig.bobble * 0.7;
      headGroup.rotation.x = (moved ? -s * 0.05 : Math.sin(fig.phase * 0.6) * 0.03)
        + (hauling ? -0.1 : 0);

      // Googly eyes. The pupils are a damped mass inside the eyeball, kicked by
      // how hard the head just turned and how hard the body just moved. Turn
      // fast and they trail; stop and they overshoot and settle.
      const dp = fig.lastPos.distanceTo(fig.root.position);
      fig.lastPos.copy(fig.root.position);
      const kick = clamp(dyaw * 26 + (moved ? c * 0.9 : 0), -9, 9);
      const bump = clamp(dp * 34 + bounce * 22, 0, 6);
      fig.eye.vx += (-fig.eye.x * 150 - fig.eye.vx * 11) * dt - kick * dt * 4.2;
      fig.eye.vy += (-fig.eye.y * 150 - fig.eye.vy * 11) * dt + (bump - 1.4) * dt * 2.4;
      fig.eye.x = clamp(fig.eye.x + fig.eye.vx * dt, -0.62, 0.62);
      fig.eye.y = clamp(fig.eye.y + fig.eye.vy * dt, -0.62, 0.62);

      for (const e of eyes) place(e, fig.eye.x, fig.eye.y);
      for (const e of ragEyes) place(e, fig.eye.x * 0.7, fig.eye.y * 0.7);
    },
  };

  fig.lastPos.copy(root.position);
  // The caller adds `root` and `rig` to the scene as siblings; keep them
  // unparented from each other so bone transforms off the wire are not
  // double-transformed by the figure's own position.
  return fig;
}

/**
 * Slide a pupil across the front of its eyeball.
 *
 * On the sphere, not across a flat disc: a pupil that translates in X and Y
 * sinks into the eyeball at the edges and pops out of the side, which looks
 * like a bug rather than like looking sideways.
 */
function place(e, x, y) {
  const len = Math.hypot(x, y);
  const k = len > 1 ? 1 / len : 1;
  const px = x * k, py = y * k;
  const pz = Math.sqrt(Math.max(0.05, 1 - px * px - py * py));
  // The geometry already carries one sphere per eye at its own X, so the node
  // only supplies the shared offset — X included, because both eyes look the
  // same way at the same time.
  e.node.position.set(px * e.r, e.base[1] + py * e.r, e.base[2] + pz * e.r);
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function shortest(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
