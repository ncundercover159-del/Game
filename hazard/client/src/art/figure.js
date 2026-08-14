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
// WHERE THE IDENTITY COLOUR LIVES, AND WHY IT MOVED.
//
// It used to be the vest. Measured against the background behind them, a
// contractor's hat separated by 46-71 luma and their body by 9.7-20.8 — so the
// hat was carrying essentially the entire read at distance, and the hat was the
// same yellow on all eight builds. Every crew was eight identical yellow dots.
// So the slot colour is on the HAT now, which is the highest, roundest and
// best-lit part of the silhouette, and the vest is one shared safety orange on
// everybody, because that is both what a real site looks like and what makes
// the hat the thing your eye goes to. Body variety comes from the eight BUILDS
// instead, which differ in height, girth, head size and hat TYPE — a shape
// difference survives bad light in a way a hue difference does not.
//
// ==========================================================================
// THE DRAW CALL BUDGET, AND WHY THIS FILE IS SKINNED.
//
// This was twelve separate meshes bolted into a Group hierarchy — one per body
// part, because each part has to move independently. Eight contractors is then
// ninety-six nodes, and a node is not one draw call: a shadow-casting point
// light is six cube faces and the sun is a seventh, so every mesh is submitted
// up to seven times a frame. A measured frame with SIX contractors on screen
// came back at 252 draw calls against a budget of 175. The figures alone cost
// more than the entire warehouse.
//
// So the body is now ONE SkinnedMesh and the head is a second, over a shared
// skeleton, and the animation code is unchanged in kind: the Groups became
// Bones, and a Bone takes .position and .rotation exactly as a Group did.
// Twelve meshes became two, per contractor, in both the upright and the
// ragdoll case.
//
// Rigid skinning, one bone per vertex, weight 1.0 — there is no smooth
// deformation anywhere in this figure and none is wanted; a contractor is a
// bag of solid lumps and should hinge like one. What skinning buys here is not
// bending, it is the GPU doing the scene-graph transform that the CPU was
// paying twelve draw calls to express.
//
// The bind pose matters for one non-obvious reason. materials.js projects its
// textures from BIND-POSE object space, so two bones that share a bind
// position sample the same patch of cloth. That is why the ragdoll's eleven
// bones have a spread-out standing rest pose even though the wire overwrites
// every one of them: the rest pose is never displayed, it only decides where on
// the weave each limb is cut from. Authoring the geometry at that rest position
// and inverting the same offset into the bone inverse cancels exactly, so the
// wire still means what it has always meant.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { materialFor } from './materials.js';

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
// distinguishable in a dim warehouse at twenty metres. This is the HAT now.
const SLOT_HUES = [0.06, 0.55, 0.33, 0.86, 0.13, 0.71, 0.45, 0.95];

// Eight builds, cycled by slot, so a crew of four is four different creatures
// rather than one creature in four colours. Each is a handful of numbers
// because that is all a caricature needs: how tall, how wide, how big is the
// head, how far apart are the eyes, and is the hat a dome or a cap.
// `eyes` is the eyeball radius as a fraction of the head scale, and it is
// smaller here than instinct wants. A photographed close-up settled it: at 0.10
// to 0.145 against a skull radius of 0.17 the two balls could not be placed far
// enough apart to stop overlapping, and what the frame showed was not a pair of
// big cartoon eyes, it was one wide lumpy mass with two dots in it. Eyes read as
// eyes because there are TWO of them with a bridge between; past about four
// tenths of the skull radius that stops being possible on a sphere. Size went
// down and the pupils went up as a fraction, which is where the expression
// actually lives.
//
// AND THE HAT IS A THIRD SILHOUETTE NOW, NOT TWO.
//
// The claim this list has to satisfy is not "eight builds exist", it is that
// eight of them are TELLABLE APART in a dim shed at twenty metres. At twenty
// metres a contractor is about forty pixels tall and the hat is eight of them:
// height and girth have almost stopped mattering, hue is being eaten by a warm
// lamp, and the only thing with any resolution left is the outline of the shell.
// With two hat types that outline had one bit of information in it and four
// builds shared each value. Three types plus wide/narrow is the cheapest way to
// buy the second bit — dome (peripheral brim), cap (peak at the front only) and
// fullbrim (a flat disc all the way round, which is a real hard hat and reads
// completely differently in silhouette from either).
const BUILDS = [
  { name: 'THE FOREMAN', h: 1.00, girth: 1.00, head: 1.00, eyes: 0.078, gap: 0.85, hat: 'fullbrim', snout: 0.00 },
  { name: 'THE TALL ONE', h: 1.14, girth: 0.80, head: 0.84, eyes: 0.068, gap: 0.70, hat: 'cap', snout: 0.05 },
  { name: 'THE UNIT', h: 0.86, girth: 1.34, head: 1.16, eyes: 0.086, gap: 1.05, hat: 'dome', snout: 0.00 },
  { name: 'THE APPRENTICE', h: 0.82, girth: 0.92, head: 1.28, eyes: 0.092, gap: 1.15, hat: 'cap', snout: 0.00 },
  { name: 'THE LIFER', h: 0.96, girth: 1.12, head: 0.92, eyes: 0.066, gap: 0.75, hat: 'fullbrim', snout: 0.09 },
  { name: 'THE NEW START', h: 1.06, girth: 0.88, head: 1.04, eyes: 0.080, gap: 0.95, hat: 'dome', snout: 0.03 },
  { name: 'THE SUBCONTRACTOR', h: 0.90, girth: 1.20, head: 1.10, eyes: 0.074, gap: 0.90, hat: 'cap', snout: 0.07 },
  { name: 'THE AGENCY LAD', h: 1.09, girth: 0.96, head: 0.96, eyes: 0.088, gap: 1.00, hat: 'dome', snout: 0.00 },
];

// The site palette. One vest colour for everybody — see the note at the top.
const HIVIZ = 0xef7a1c;        // safety orange
const HIVIZ_DEEP = 0xa8480d;   // its own shadow, for panel breaks
const TAPE = 0xcfd6dd;         // retroreflective banding, near-white grey
const CLOTH = 0x2b303a;        // trousers and sleeves
const RUBBER = 0x16181d;       // boots and gloves
const SOLE = 0x0d0f12;
const SKIN = 0xd8a883;
const SOCKET = 0x232830;       // the ring behind an eyeball

// --- a skinned-geometry accumulator ------------------------------------------
// Everything static is accumulated here and merged into ONE buffer per
// material, tagged with the bone that owns it. Rigid weights throughout: a
// vertex belongs to exactly one lump.
class Skin {
  constructor() { this.geos = []; }

  /**
   * @param {THREE.BufferGeometry} geo consumed
   * @param {number|string} colour baked into COLOR
   * @param {number} bone index into the skeleton
   * @param {number[]} rest the bone's bind position in figure space
   * @param {number[]} [at] offset within the bone, before the rest translate
   * @param {number[]} [rot] euler XYZ, applied first
   */
  add(geo, colour, bone, rest, at, rot) {
    if (rot) { geo.rotateX(rot[0] || 0); geo.rotateY(rot[1] || 0); geo.rotateZ(rot[2] || 0); }
    geo.translate((at ? at[0] : 0) + rest[0], (at ? at[1] : 0) + rest[1], (at ? at[2] : 0) + rest[2]);

    const n = geo.getAttribute('position').count;
    const c = new THREE.Color(colour);
    const col = new Float32Array(n * 3);
    const si = new Uint16Array(n * 4);
    const sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      si[i * 4] = bone;
      sw[i * 4] = 1;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    this.geos.push(geo);
    return this;
  }

  box(w, h, d, c, bone, rest, at, rot) {
    return this.add(new THREE.BoxGeometry(w, h, d), c, bone, rest, at, rot);
  }

  cyl(rt, rb, h, c, bone, rest, at, rot, seg = 10, open = false) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), c, bone, rest, at, rot);
  }

  ball(r, c, bone, rest, at, seg = 10) {
    return this.add(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)), c, bone, rest, at);
  }

  /** A squashed or stretched ball, for heads, gloves and hat crowns. */
  blob(r, scale, c, bone, rest, at, seg = 10) {
    const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2));
    g.scale(scale[0], scale[1], scale[2]);
    return this.add(g, c, bone, rest, at);
  }

  dome(r, c, bone, rest, at, seg = 12, t1 = Math.PI / 2) {
    return this.add(
      new THREE.SphereGeometry(r, seg, Math.max(4, seg >> 1), 0, Math.PI * 2, 0, t1),
      c, bone, rest, at,
    );
  }

  /**
   * One SkinnedMesh over the shared skeleton.
   *
   * The bind matrix is the identity, and every bone inverse is the inverse of
   * that bone's rest transform, so the shader's
   * `modelMatrix · bindMatrixInverse · boneWorld · boneInverse` collapses to
   * exactly the scene-graph transform the Group hierarchy used to do on the CPU.
   */
  mesh(matName, skeleton, name) {
    if (!this.geos.length) return null;
    const g = this.geos.length === 1 ? this.geos[0] : mergeGeometries(this.geos, false);
    for (const x of this.geos) if (x !== g) x.dispose();
    const m = new THREE.SkinnedMesh(g, materialFor(matName));
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = name;
    m.bind(skeleton, new THREE.Matrix4());
    return m;
  }
}

/** Scale a geometry in place and hand it straight back, for inline use. */
function squash(geo, s) { geo.scale(s[0], s[1], s[2]); return geo; }

/** A bone at a rest position, optionally under a parent bone. */
function bone(name, rest, parent) {
  const b = new THREE.Bone();
  b.name = name;
  b.position.set(rest[0], rest[1], rest[2]);
  if (parent) parent.add(b);
  return b;
}

/**
 * Bone inverses from the current (rest) pose.
 *
 * Called once, with every bone sitting where the geometry was authored around
 * it. From that moment the pose is free to be anything.
 */
function bindSkeleton(rootNode, bones) {
  rootNode.updateMatrixWorld(true);
  return new THREE.Skeleton(bones, bones.map((b) => b.matrixWorld.clone().invert()));
}

export function makeFigure(slot) {
  const hue = SLOT_HUES[slot % SLOT_HUES.length];
  const build = BUILDS[slot % BUILDS.length];

  // The hat is the identity. Bright and saturated, because it has to beat a
  // warehouse lamp for attention from twenty metres away.
  const hatCol = new THREE.Color().setHSL(hue, 0.86, 0.56);
  const hatDark = new THREE.Color().setHSL(hue, 0.72, 0.34);
  // A whisper of the same hue in the trousers, well under the threshold where
  // it could argue with the vest.
  const trouser = new THREE.Color().setHSL(hue, 0.14, 0.14);
  const badge = new THREE.Color().setHSL(hue, 0.70, 0.62);

  const S = build.h;          // overall height scale
  const G = build.girth;      // how wide through the middle
  const HD = build.head;      // head scale

  // Landmarks, all in metres off the floor. Everything below hangs off these,
  // so a build variant is genuinely a different body rather than a scaled one.
  const hipY = 0.60 * S;
  const chestY = 0.97 * S;
  const neckY = 1.24 * S;
  const armLen = 0.30 * S;
  const legLen = hipY - 0.10 * S;

  // --- the upright skeleton -------------------------------------------------
  const root = new THREE.Group();
  const R = {
    hips: [0, hipY, 0],
    torso: [0, chestY, 0],
    head: [0, neckY, 0],
    armL: [-0.245 * G, chestY + 0.15 * S, 0],
    armR: [0.245 * G, chestY + 0.15 * S, 0],
    legL: [-0.10 * G, hipY - 0.08 * S, 0],
    legR: [0.10 * G, hipY - 0.08 * S, 0],
  };
  const hips = bone('hips', R.hips, root);
  const torso = bone('torso', R.torso, root);
  const headB = bone('head', R.head, root);
  const armL = bone('armL', R.armL, root);
  const armR = bone('armR', R.armR, root);
  const legL = bone('legL', R.legL, root);
  const legR = bone('legR', R.legR, root);

  // The hat gets its OWN bone under the head, purely so it can wobble. A hard
  // hat is a rigid shell balanced on a plastic cradle and it does not follow
  // your skull instantly — that quarter-beat of lag is most of what makes these
  // read as animate rather than as posed.
  // EYES ARE PLACED ON THE SKULL, NOT AT A CONSTANT DEPTH.
  //
  // A fixed z worked for one head size and failed for the other seven: the
  // skull radius varies by half across the builds, so the same offset buried
  // the eyes in THE APPRENTICE and floated them in front of THE TALL ONE. The
  // review that found them invisible past eight metres was measuring the buried
  // case. Solving for the depth that puts the ball's centre just inside the
  // surface makes every build protrude by about four fifths of an eyeball,
  // which is what makes them read at range — and it stays true however wide
  // apart `gap` pushes them, because the sphere supplies the z.
  const HR = 0.17 * HD;                                   // skull radius
  const eyeR = build.eyes * HD;
  const eyeX = Math.min(HR * 0.80, eyeR * (1.30 + 0.35 * build.gap));
  const eyeY = 0.015 * HD;
  const eyeZ = Math.sqrt(Math.max(0.0025, HR * HR - eyeX * eyeX - eyeY * eyeY)) * 0.90;
  const EYE_AT = [eyeX, eyeY, eyeZ];
  const hatB = bone('hat', [0, 0, 0], headB);
  const pupilB = bone('pupils', [0, EYE_AT[1], EYE_AT[2]], headB);

  const BONES = [hips, torso, headB, armL, armR, legL, legR, hatB, pupilB];
  const skel = bindSkeleton(root, BONES);
  const BI = Object.fromEntries(BONES.map((b, i) => [b.name, i]));

  // Rest positions in FIGURE space, for authoring. Nested bones accumulate.
  const RF = {
    hips: R.hips, torso: R.torso, head: R.head,
    armL: R.armL, armR: R.armR, legL: R.legL, legR: R.legR,
    hat: R.head,
    pupils: [R.head[0], R.head[1] + EYE_AT[1], R.head[2] + EYE_AT[2]],
  };

  // --- body: hips, torso, arms, legs, one mesh ------------------------------
  const body = new Skin();

  // Hips: a wedge with a tool belt.
  body
    .box(0.34 * G, 0.24 * S, 0.24 * G, trouser, BI.hips, RF.hips)
    .box(0.37 * G, 0.075, 0.27 * G, RUBBER, BI.hips, RF.hips, [0, 0.10 * S, 0])
    .box(0.075, 0.055, 0.035, badge, BI.hips, RF.hips, [0, 0.10 * S, 0.145 * G])
    // The thing every one of them has on their hip and none of them uses.
    .cyl(0.038, 0.038, 0.17, RUBBER, BI.hips, RF.hips, [0.21 * G, 0.01, 0.02], [0.25, 0, 0]);

  // Torso: a barrel in a vest that does not fit.
  //
  // WHAT WAS WRONG WITH THE CHEST WAS DEPTH, NOT COUNT.
  //
  // A review called it a jumble and the reason is one number. The vest is a
  // cylinder of radius 0.248·G, and the two vertical braces, the pocket and the
  // badge were all placed as flat BOXES at z = 0.215–0.245 — that is, INSIDE
  // the vest's own surface. A box buried in a cylinder emerges only where the
  // cylinder curves away from it, so each of those four pieces showed up as a
  // pair of disconnected slivers either side of the centreline. Four features,
  // eight slivers, none of them the shape they were meant to be.
  //
  // A curved surface wants curved trim. Every band on this vest is now an open
  // cylinder SECTOR at a radius a few millimetres proud of it — the same
  // primitive the horizontal bands always used, which is why those were the
  // only part of the chest that read. And the count comes down: a hi-vis reads
  // from across a yard because it is four big shapes, not because it is
  // detailed. Two rings, two braces, one zip.
  const VEST_R = 0.250 * G;      // the vest's own radius at the chest
  const TRIM_R = VEST_R + 0.008; // ...and where trim sits on top of it
  /** An open strip of cylinder, hugging the vest. `mid` is radians off front. */
  const strip = (mid, width, h, y, colour, r = TRIM_R) => body.add(
    new THREE.CylinderGeometry(r, r, h, 7, 1, true, mid - width / 2, width),
    colour, BI.torso, RF.torso, [0, y, 0],
  );
  body
    .add(new THREE.CylinderGeometry(0.23 * G, 0.20 * G, 0.44 * S, 12), CLOTH, BI.torso, RF.torso)
    // The vest: a slightly larger shell, open at the front, hanging low.
    .add(new THREE.CylinderGeometry(VEST_R, 0.240 * G, 0.36 * S, 14, 1, true), HIVIZ,
      BI.torso, RF.torso, [0, -0.03 * S, 0])
    // Bands, not plates. A box laid across a round torso meets it at four
    // corners and reads as a slab bolted on; the figure ends up looking like a
    // stack of trays. A shallow cylinder a few millimetres proud of the vest
    // wraps it the way a reflective band actually does.
    .cyl(TRIM_R, TRIM_R, 0.050, TAPE, BI.torso, RF.torso, [0, 0.055 * S, 0], null, 14)
    .cyl(TRIM_R + 0.003, TRIM_R + 0.003, 0.050, TAPE, BI.torso, RF.torso, [0, -0.095 * S, 0], null, 14);
  // Braces over both shoulders, front and back, closing the vest's silhouette
  // at the top and giving the back view the same read as the front — which
  // matters, because for most of a job you are looking at your crew's backs.
  for (const s of [-1, 1]) {
    strip(s * 0.42, 0.30, 0.30 * S, -0.01 * S, TAPE);
    strip(Math.PI + s * 0.42, 0.30, 0.30 * S, -0.01 * S, TAPE);
  }
  // The zip, dead centre front, dark against the orange. One line, and it is
  // what stops the vest reading as a barrel that happens to be orange.
  strip(0, 0.13, 0.34 * S, -0.02 * S, HIVIZ_DEEP, TRIM_R + 0.001);
  body
    // One badge, high on the chest, in the slot's own colour. Small on purpose:
    // it is a grace note at two metres and must not compete with the hat at ten.
    .add(new THREE.CylinderGeometry(TRIM_R + 0.004, TRIM_R + 0.004, 0.052, 5, 1, true, 0.60, 0.34),
      badge, BI.torso, RF.torso, [0, 0.125 * S, 0])
    // Shoulders, so the arms have somewhere to be.
    .ball(0.118 * G, HIVIZ, BI.torso, RF.torso, [-0.235 * G, 0.165 * S, 0])
    .ball(0.118 * G, HIVIZ, BI.torso, RF.torso, [0.235 * G, 0.165 * S, 0]);

  // Arms: too short to be useful, ending in ENORMOUS gloves. The glove is the
  // single most exaggerated thing on the figure and it should be — a hand
  // wider than the arm it hangs off is legible from across the shed, and it
  // makes the carrying pose read as carrying rather than as reaching.
  for (const [side, b] of [[-1, BI.armL], [1, BI.armR]]) {
    const rest = side < 0 ? RF.armL : RF.armR;
    body
      .add(new THREE.CylinderGeometry(0.064, 0.056, armLen, 8), CLOTH, b, rest, [0, -armLen / 2, 0])
      .cyl(0.072, 0.072, 0.045, TAPE, b, rest, [0, -armLen + 0.055, 0], null, 8)
      .box(0.12, 0.05, 0.12, HIVIZ, b, rest, [0, -armLen + 0.012, 0])
      .blob(0.108, [1.0, 0.92, 1.12], RUBBER, b, rest, [0, -armLen - 0.062, 0.012])
      .blob(0.052, [0.9, 1.25, 0.8], RUBBER, b, rest, [side * 0.082, -armLen - 0.055, 0.035]);
  }

  // Legs: stumps in boots.
  for (const [side, b] of [[-1, BI.legL], [1, BI.legR]]) {
    void side;
    const rest = side < 0 ? RF.legL : RF.legR;
    body
      .add(new THREE.CylinderGeometry(0.078, 0.070, legLen, 8), trouser, b, rest, [0, -legLen / 2, 0])
      .box(0.158, 0.105, 0.175, RUBBER, b, rest, [0, -legLen - 0.012, 0.008])
      .box(0.180, 0.080, 0.315, RUBBER, b, rest, [0, -legLen - 0.058, 0.058])
      .box(0.190, 0.036, 0.330, SOLE, b, rest, [0, -legLen - 0.092, 0.058])
      .box(0.135, 0.048, 0.052, TAPE, b, rest, [0, -legLen - 0.032, 0.198]);
  }

  // --- head: skull, hat, eyes, pupils, one mesh -----------------------------
  // A single material for all four. It is a moulded-plastic recipe, and running
  // the face through it as well is not a compromise — a contractor whose head
  // is the same smooth vinyl as their hard hat reads as a toy of a builder
  // rather than as a small man, and that is the register the brief asked for.
  const head = new Skin();

  head.blob(0.17 * HD, [1.0, 1.02, 0.98], SKIN, BI.head, RF.head, [0, 0.02, 0], 12);
  if (build.snout > 0) {
    head.blob(0.078 * HD, [1.0, 0.85, 1.25], SKIN, BI.head, RF.head,
      [0, -0.025, (0.12 + build.snout) * HD], 8);
  }
  head.box(0.062, 0.05, 0.052, CLOTH, BI.head, RF.head, [0, 0.16 * HD, 0]);   // a tuft

  // THE HAT. Two silhouettes, and they have to be different at range or the
  // eight builds collapse to four. The dome is a hard hat: hemisphere, comb
  // ridge, brim all the way round. The cap is a bump cap: a shallower crown
  // and a PEAK at the front only. The previous 'bucket' was a flat-topped
  // cylinder with a flat brim, which from any distance reads as a bowler.
  // A HAT IS A THING YOU WEAR ON TOP OF A FACE, NOT INSTEAD OF ONE.
  //
  // Every crown here is a half-sphere seated ABOVE the eye line, and that is
  // load-bearing rather than fussy. The first cut used a full squashed sphere
  // for the cap, whose lower hemisphere reached 0.08·HD below the eyes and
  // enclosed the entire face — photographed from the front, the contractor was
  // a coloured egg with a dark bar across it and no eyes at all. Anything with
  // a lower half will eat the head it is sitting on; a dome cannot.
  //
  // The two silhouettes have to stay different at range or the eight builds
  // collapse to four. The dome is a hard hat: hemisphere, comb ridge, brim all
  // the way round. The cap is a bump cap: a lower, flatter crown and a PEAK at
  // the front only. The previous 'bucket' was a flat-topped cylinder with a
  // flat brim, which from any distance reads as a bowler.
  // AND THE THING THEY ALL HAVE TO STOP BEING IS A MUSHROOM.
  //
  // The previous dome was a true hemisphere of radius 0.212·HD sitting on a
  // 0.300·HD disc with a 0.170·HD fin down the middle. Photographed front-on
  // that is a stalk-and-cap, and the review used exactly that word. Three
  // things were wrong and all three are geometric rather than a matter of
  // taste:
  //
  //  * A HARD HAT IS NOT A HEMISPHERE. Its shell is about two thirds as tall as
  //    it is wide. A half-sphere has its widest point at the very bottom, which
  //    is where a mushroom is widest and where a hat is not — a hat's shell
  //    tucks back IN towards the headband. Squashing the sphere and seating it
  //    on a slightly narrower collar does both jobs at once.
  //  * THE FIN. 0.170·HD of comb on a 0.212·HD crown is four fifths of the
  //    shell's own height standing on top of it. Real ribs are a couple of
  //    millimetres of stiffening. Three low ones read as a hard hat; one tall
  //    one reads as a centurion helmet, and at range as a stalk.
  //  * NO SHADOW LINE. Crown and brim were the same colour with no break
  //    between them, so the two merged into one blob. A dark headband in the
  //    gap costs one cylinder and is what tells the eye where the hat stops and
  //    the head starts.
  const CROWN = 0.135 * HD;      // seat height — clear of the eyes at 0.015·HD
  // The shell, common to all three: a squashed dome with a rolled lower edge.
  const shell = (r, squashY, seat) => {
    head.add(squash(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      [1.0, squashY, 1.06]), hatCol, BI.hat, RF.hat, [0, seat, 0]);
    // The roll. A short taper under the dome's rim, narrowing downwards, which
    // is the tuck a real shell has where it meets the headband.
    head.cyl(r * 1.005, r * 0.90, 0.030 * HD + 0.010, hatCol, BI.hat, RF.hat,
      [0, seat - 0.014 * HD, 0], null, 14);
  };
  // Three stiffening ribs front-to-back, low and close together.
  const ribs = (r, seat, squashY) => {
    for (const [dx, len, hgt] of [[0, 1.00, 0.052], [-0.34, 0.86, 0.040], [0.34, 0.86, 0.040]]) {
      head.box(0.030 * HD + 0.008, hgt * HD, r * 1.55 * len, hatDark, BI.hat, RF.hat,
        [dx * r, seat + r * squashY - 0.018 * HD, 0]);
    }
  };
  // The headband, in the shadow under the shell. Dark, and proud enough of the
  // skull to draw a line rather than to be a coincidence of shading.
  const band = (r, seat) => head.cyl(r * 0.93, r * 0.93, 0.036 * HD + 0.006, hatDark,
    BI.hat, RF.hat, [0, seat - 0.030 * HD - 0.004, 0], null, 14);

  if (build.hat === 'cap') {
    // A bump cap. Lowest and smallest crown of the three, no brim at the sides
    // at all, and a long curved peak — which is the whole silhouette. A half
    // disc rather than a box: a rectangular peak reads as a plank from any
    // angle off-axis, and the curve is one parameter on the same primitive.
    const r = 0.196 * HD;
    shell(r, 0.72, CROWN);
    band(r, CROWN);
    head.add(
      squash(new THREE.CylinderGeometry(r * 1.34, r * 1.34, 0.020 * HD + 0.006, 14, 1,
        false, -Math.PI / 2, Math.PI), [1.0, 1.0, 1.14]),
      hatCol, BI.hat, RF.hat, [0, CROWN - 0.014 * HD, 0.014 * HD], [-0.13, 0, 0],
    );
  } else if (build.hat === 'fullbrim') {
    // The full-brim hard hat: a wide flat disc all the way round, and the crown
    // sits well back inside it. In outline this is unmistakably not the other
    // two even when it is eight pixels of hat on forty pixels of person.
    const r = 0.205 * HD;
    shell(r, 0.80, CROWN);
    ribs(r, CROWN, 0.80);
    band(r, CROWN);
    head.cyl(0.355 * HD, 0.330 * HD, 0.024 * HD + 0.006, hatCol, BI.hat, RF.hat,
      [0, CROWN - 0.020 * HD, 0], null, 16);
  } else {
    // The standard shell: a peripheral brim, wider front and back than at the
    // sides, which is what a Centurion or an MSA actually looks like from above.
    const r = 0.215 * HD;
    shell(r, 0.78, CROWN);
    ribs(r, CROWN, 0.78);
    band(r, CROWN);
    head.add(
      squash(new THREE.CylinderGeometry(0.272 * HD, 0.252 * HD, 0.022 * HD + 0.006, 16),
        [1.0, 1.0, 1.22]),
      hatCol, BI.hat, RF.hat, [0, CROWN - 0.018 * HD, 0.020 * HD],
    );
  }

  // THE EYES, WHICH ARE NOW MUCH FURTHER FORWARD THAN THEY WERE.
  //
  // They were measured as invisible past eight metres and the reason was not
  // their size, it was their depth: set at 0.125·HD from the skull centre with
  // a skull radius of 0.17·HD, most of each eyeball was buried inside the head
  // and what protruded sat in the shadow of the brim. They are proud of the
  // face now, they carry a dark socket ring behind them so the white has
  // something to read against, and the pupil is a bigger fraction of the ball.
  for (const side of [-1, 1]) {
    head.blob(eyeR * 1.22, [1, 1, 0.5], SOCKET, BI.head, RF.head,
      [side * eyeX, eyeY, eyeZ - eyeR * 0.30], 10);
    head.ball(eyeR, 0xf7f5ef, BI.head, RF.head, [side * eyeX, eyeY, eyeZ], 12);
  }
  // A brow across the bridge. Three lines of geometry, and it is the difference
  // between two eyeballs stuck on a ball and a face: it gives the pair a top
  // edge, which is the feature the eye uses to decide something is looking at
  // it.
  head.box(eyeX * 2.1, eyeR * 0.42, eyeR * 0.5, hatDark, BI.head, RF.head,
    [0, eyeY + eyeR * 0.92, eyeZ * 0.86], [0.12, 0, 0]);

  // The pupils sit on their own bone so they can slide across the eyeball.
  const EYE_R = eyeR * 0.62;
  for (const side of [-1, 1]) {
    head.blob(eyeR * 0.60, [1, 1, 0.8], 0x0a0b0e, BI.pupils, RF.pupils,
      [side * eyeX, 0, 0], 10);
  }

  const bodyMesh = body.mesh('overall', skel, 'contractor.body');
  const headMesh = head.mesh('gear', skel, 'contractor.head');
  root.add(bodyMesh, headMesh);

  // A beacon, because somebody in the crew has to be the one with the beacon.
  // No shadow: it is 32mm across and emissive, so what it casts is noise. Its
  // own material because nothing else in the game is a light source you can
  // pick up, and it is skipped entirely for two slots in three.
  if (slot % 3 === 0) {
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.034, 8, 6),
      new THREE.MeshStandardMaterial({
        color: 0xff5a2a, emissive: 0xff4a18, emissiveIntensity: 2.2, roughness: 0.4,
      }),
    );
    beacon.castShadow = false;
    beacon.position.set(0, 0.29 * HD, -0.03);
    hatB.add(beacon);
  }

  // --- ragdoll rig ----------------------------------------------------------
  // Eleven loose boxes driven straight from the wire, but the head bone keeps
  // its hat and its eyes: a contractor face down in a puddle staring at you is
  // funnier than a contractor face down in a puddle.
  //
  // The rest pose below is NEVER SEEN. Every one of these eleven bones has its
  // world transform overwritten from the snapshot before the first frame the
  // rig is visible. It exists so that the eleven lumps are cut from eleven
  // different places on the cloth — see the bind-pose note at the top of the
  // file — and because the geometry is authored at the same offset that gets
  // inverted into the bone inverse, it cancels to nothing at render time.
  const rig = new THREE.Group();
  const RAG_REST = [
    [0, 0.60 * S, 0], [0, 0.97 * S, 0], [0, 1.30 * S, 0],
    [-0.30 * G, 1.00 * S, 0], [-0.30 * G, 0.70 * S, 0],
    [0.30 * G, 1.00 * S, 0], [0.30 * G, 0.70 * S, 0],
    [-0.11 * G, 0.42 * S, 0], [-0.11 * G, 0.12 * S, 0],
    [0.11 * G, 0.42 * S, 0], [0.11 * G, 0.12 * S, 0],
  ];
  const bones = RAG_REST.map((rest, i) => bone(`b${i}`, rest, rig));
  const ragHatB = bone('ragHat', [0, 0.14, 0], bones[2]);
  const ragPupilB = bone('ragPupils', [0, EYE_AT[1] - 0.02, 0.11], bones[2]);
  const ragBones = [...bones, ragHatB, ragPupilB];
  const ragSkel = bindSkeleton(rig, ragBones);

  const ragHatRest = [RAG_REST[2][0], RAG_REST[2][1] + 0.14, RAG_REST[2][2]];
  const ragPupilRest = [RAG_REST[2][0], RAG_REST[2][1] + EYE_AT[1] - 0.02, RAG_REST[2][2] + 0.11];

  const ragBody = new Skin();
  const ragHead = new Skin();
  for (let i = 0; i < BONE_SIZES.length; i++) {
    const s = BONE_SIZES[i];
    if (i === 2) {
      ragHead.blob(s[0] * 0.52, [1, 1.05, 1], SKIN, i, RAG_REST[i]);
      continue;
    }
    ragBody.box(s[0], s[1], s[2], i === 1 ? HIVIZ : trouser, i, RAG_REST[i]);
    if (i === 1) {
      ragBody.box(s[0] * 1.06, 0.055, s[2] * 1.06, TAPE, i, RAG_REST[i], [0, 0.09, 0]);
      ragBody.box(s[0] * 1.06, 0.055, s[2] * 1.06, TAPE, i, RAG_REST[i], [0, -0.06, 0]);
    }
  }
  // Domes here too, and for the same reason — a corpse whose hat has eaten its
  // own face is the one pose in the game where you are guaranteed a long look.
  if (build.hat === 'cap') {
    ragHead.add(squash(new THREE.SphereGeometry(0.215 * HD, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2),
      [1.0, 0.80, 1.04]), hatCol, 11, ragHatRest, [0, 0.005, 0]);
    ragHead.box(0.30 * HD, 0.024, 0.15 * HD, hatCol, 11, ragHatRest, [0, 0.012, 0.185 * HD], [-0.10, 0, 0]);
  } else {
    ragHead.dome(0.212 * HD, hatCol, 11, ragHatRest, [0, 0.005, 0], 14);
    ragHead.cyl(0.300 * HD, 0.300 * HD, 0.026, hatCol, 11, ragHatRest, [0, 0.013, 0.022 * HD], null, 14);
  }
  for (const side of [-1, 1]) {
    ragHead.blob(eyeR * 1.22, [1, 1, 0.5], SOCKET, 2, RAG_REST[2],
      [side * eyeX, eyeY - 0.02, 0.10 - eyeR * 0.30], 8);
    ragHead.ball(eyeR, 0xf7f5ef, 2, RAG_REST[2], [side * eyeX, eyeY - 0.02, 0.10], 10);
    ragHead.blob(eyeR * 0.60, [1, 1, 0.8], 0x0a0b0e, 12, ragPupilRest, [side * eyeX, 0, 0], 8);
  }

  const ragBodyMesh = ragBody.mesh('overall', ragSkel, 'contractor.rag.body');
  const ragHeadMesh = ragHead.mesh('gear', ragSkel, 'contractor.rag.head');
  // The bind pose is a cluster around the origin while the live pose is spread
  // across the level, so the bounding sphere three computes at bind time is
  // wrong the moment the wire touches it. Culling against it hides the corpse.
  ragBodyMesh.frustumCulled = false;
  ragHeadMesh.frustumCulled = false;
  rig.add(ragBodyMesh, ragHeadMesh);
  rig.visible = false;

  // A stagger so a crew of eight does not breathe, sway and blink in unison,
  // which is the single most robot-like thing a group of idle characters can do.
  const stagger = (slot * 2.399963) % (Math.PI * 2);

  const fig = {
    slot, root, rig, bones, yaw: 0, build: build.name,
    ragdoll: false, crouched: false, moving: false, hauling: false,
    phase: 0, idle: stagger,
    // Pupil spring state, in eyeball-local units. Two axes, one integrator.
    eye: { x: 0, y: 0, vx: 0, vy: 0 },
    // Hat spring: two axes of lean, plus a lift so it hops on a hard landing.
    lid: { x: 0, z: 0, vx: 0, vz: 0, y: 0, vy: 0 },
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
        const headBone = bones[2];
        const d = fig.lastPos.distanceTo(headBone.position);
        fig.lastPos.copy(headBone.position);
        const shake = clamp(d * 90, 0, 14);
        fig.eye.vx += (-fig.eye.x * 150 - fig.eye.vx * 9) * dt + (Math.sin(fig.phase * 9) * shake) * dt;
        fig.eye.vy += (-fig.eye.y * 150 - fig.eye.vy * 9) * dt + (shake - 0.8) * dt * 3;
        fig.phase += dt * 6;
        fig.eye.x = clamp(fig.eye.x + fig.eye.vx * dt, -0.62, 0.62);
        fig.eye.y = clamp(fig.eye.y + fig.eye.vy * dt, -0.62, 0.62);
        place(ragPupilB, fig.eye.x * 0.7, fig.eye.y * 0.7, EYE_R, 0, 0);
        return;
      }

      const crouched = opts.crouched ?? fig.crouched;
      const hauling = opts.hauling ?? fig.hauling;
      const moved = fig.to.p.distanceToSquared(fig.from.p) > 1e-5;

      const speed = fast ? 13 : 8.5;
      fig.phase += dt * (moved ? speed : 1.2);
      fig.idle += dt;
      const s = Math.sin(fig.phase);
      const c = Math.cos(fig.phase);
      const amp = moved ? (fast ? 0.72 : 0.52) : 0.05;

      // --- standing still is an animation too -------------------------------
      // Two slow oscillators at incommensurate periods, so the loop never
      // visibly repeats: a breath at about 3.5 s and a weight shift from one
      // boot to the other at about 5.5 s. Idle used to be the walk cycle at 4%
      // amplitude, which is a figure vibrating rather than a figure waiting.
      const still = moved ? 0 : 1;
      const breath = Math.sin(fig.idle * 1.80 + stagger);
      const shift = Math.sin(fig.idle * 1.14 + stagger * 1.7);
      const sway = still * shift * 0.022 * G;
      // The chest actually expands. A bone with no children can be scaled
      // freely and the vertices bound to it follow, which is the cheapest
      // possible breath and reads far better than bobbing the whole torso.
      const swell = 1 + still * breath * 0.022;
      torso.scale.set(swell, 1 + still * breath * 0.014, swell);

      // Legs and arms in opposition, the arms lagging a little so the whole
      // thing does not look like a metronome.
      legL.rotation.x = s * amp;
      legR.rotation.x = -s * amp;
      // Lift the trailing foot rather than dragging it through the floor.
      legL.position.y = R.legL[1] + Math.max(0, -s) * amp * 0.06;
      legR.position.y = R.legR[1] + Math.max(0, s) * amp * 0.06;
      if (hauling) {
        // Both arms out front, sagging under whatever it is. Stubby arms make
        // this read as a toddler carrying a television, which is correct.
        armL.rotation.x = -1.28 + s * 0.06;
        armR.rotation.x = -1.28 - s * 0.06;
        armL.rotation.z = 0.20; armR.rotation.z = -0.20;
      } else {
        armL.rotation.x = -s * amp * 0.62;
        armR.rotation.x = s * amp * 0.62;
        armL.rotation.z = 0.10 + Math.abs(s) * 0.06 - still * shift * 0.05;
        armR.rotation.z = -0.10 - Math.abs(s) * 0.06 - still * shift * 0.05;
      }

      // The waddle. Roll into each step and rise on the push-off — this is what
      // separates "walking" from "sliding with the legs moving", and at these
      // proportions it is most of the comedy.
      const bounce = moved ? Math.abs(s) * 0.045 * S : 0;
      const roll = moved ? c * 0.09 : still * shift * 0.05;
      const squat = crouched ? 0.34 * S : 0;

      hips.position.set(sway, hipY + bounce - squat, 0);
      hips.rotation.z = roll;
      // Hips and shoulders counter-rotate through a stride. It is a small angle
      // and it is the difference between a walk and a shop mannequin on rails.
      hips.rotation.y = moved ? -c * 0.10 : 0;
      torso.position.set(sway * 0.6, chestY + bounce * 1.15 - squat * 0.9, 0);
      torso.rotation.z = roll * 0.7;
      torso.rotation.y = moved ? c * 0.12 : 0;
      torso.rotation.x = (hauling ? 0.16 : 0) + (crouched ? 0.22 : 0) + (moved ? 0.06 : 0)
        + still * breath * 0.012;
      legL.position.x = R.legL[0] + sway * 0.4;
      legR.position.x = R.legR[0] + sway * 0.4;
      legL.position.y -= squat;
      legR.position.y -= squat;
      armL.position.set(R.armL[0] + sway * 0.7, R.armL[1] + bounce - squat * 0.9, 0);
      armR.position.set(R.armR[0] + sway * 0.7, R.armR[1] + bounce - squat * 0.9, 0);

      // --- the head bobbles, and the eyes lag behind the head --------------
      // A second-order spring on the neck. Under-damped on purpose: the head
      // arrives after the body and keeps going for a moment, which is the
      // difference between a figure and a puppet.
      const dyaw = shortest(fig.yaw - fig.lastYaw);
      fig.lastYaw = fig.yaw;
      fig.bobbleV += (-fig.bobble * 46 - fig.bobbleV * 6.5) * dt + dyaw * 1.4;
      fig.bobble += fig.bobbleV * dt;
      fig.bobble = clamp(fig.bobble, -0.55, 0.55);

      headB.position.set(sway * 0.3, neckY + bounce * 1.3 - squat * 0.85, 0);
      headB.rotation.z = fig.bobble * 0.5 + roll * 0.35;
      headB.rotation.y = fig.bobble * 0.7 + still * shift * 0.10;
      headB.rotation.x = (moved ? -s * 0.05 : breath * 0.02)
        + (hauling ? -0.1 : 0);

      // --- and the hat lags behind the head --------------------------------
      // Same integrator, longer period and less damping than the neck, so the
      // order of arrival is body, then head, then hat. The vertical term is
      // driven by the walk bounce, so it hops on the down-beat of every step.
      const l = fig.lid;
      l.vx += (-l.x * 62 - l.vx * 7.0) * dt - fig.bobbleV * dt * 0.9;
      l.vz += (-l.z * 62 - l.vz * 7.0) * dt - dyaw * dt * 26;
      l.vy += (-l.y * 150 - l.vy * 10.0) * dt + (moved ? -c * amp * 0.9 : 0) * dt;
      l.x = clamp(l.x + l.vx * dt, -0.30, 0.30);
      l.z = clamp(l.z + l.vz * dt, -0.30, 0.30);
      l.y = clamp(l.y + l.vy * dt, -0.012, 0.020);
      hatB.rotation.set(l.x, 0, l.z);
      hatB.position.set(0, l.y, 0);

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

      place(pupilB, fig.eye.x, fig.eye.y, EYE_R, EYE_AT[1], EYE_AT[2]);
      place(ragPupilB, fig.eye.x * 0.7, fig.eye.y * 0.7, EYE_R, EYE_AT[1] - 0.02, 0.11);
    },
  };

  fig.lastPos.copy(root.position);
  // The caller adds `root` and `rig` to the scene as siblings; keep them
  // unparented from each other so bone transforms off the wire are not
  // double-transformed by the figure's own position.
  return fig;
}

/**
 * Slide the pupil bone across the front of its eyeball.
 *
 * On the sphere, not across a flat disc: a pupil that translates in X and Y
 * sinks into the eyeball at the edges and pops out of the side, which looks
 * like a bug rather than like looking sideways.
 */
function place(node, x, y, r, baseY, baseZ) {
  const len = Math.hypot(x, y);
  const k = len > 1 ? 1 / len : 1;
  const px = x * k, py = y * k;
  const pz = Math.sqrt(Math.max(0.05, 1 - px * px - py * py));
  // The geometry already carries one sphere per eye at its own X, so the bone
  // only supplies the shared offset — X included, because both eyes look the
  // same way at the same time.
  node.position.set(px * r, baseY + py * r, baseZ + pz * r);
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function shortest(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
