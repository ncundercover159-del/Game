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
//
// THREE OF THESE MOVED FOR ONE REASON: THE TORSO HAD NO CONTRAST IN IT.
//
// A graded review measured the lightness delta across the torso at 20.9 against
// a failing line of 20 — one point from failing — and photographs of the back
// bear it out: reflective banding at CIE L* 85.3 over a vest at 63.6 is a
// twenty-two point step, which is a change of shade rather than a change of
// material. Retroreflective tape under a lamp is not a pale grey. It is the
// brightest thing on a person by a wide margin, which is the entire reason
// anybody wears it, and photographing as near-white is correct rather than
// generous. That single change takes band-to-vest from 21.7 to 29.6.
//
// The shirt goes the other way for the same reason: a dark navy work layer
// under the vest reads as a shadow the vest is sitting in, and it takes
// vest-to-shirt from 43.9 to 50.5. The vest itself barely moves — it is
// already the right orange, and it has to stay orange rather than becoming
// red, because under a #ffe2b4 lamp anything with less green than this stops
// reading as hi-vis and starts reading as rust.
const HIVIZ = 0xf27d15;        // safety orange
const HIVIZ_DEEP = 0xa8480d;   // its own shadow, for panel breaks
const TAPE = 0xeaeff5;         // retroreflective banding, near-white
const CLOTH = 0x20242c;        // trousers and sleeves
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
  // A JUMBLE IS A CROSSING PROBLEM, NOT A DEPTH PROBLEM.
  //
  // The previous cut put every piece of trim on the vest's own curve, which was
  // the right fix for the previous complaint and did nothing at all for this
  // one. What a second review saw was two reflective RINGS going round the body
  // and four vertical braces running from below the lower ring to above the
  // upper one — two lines crossing two lines, which is a noughts-and-crosses
  // board. Photographed from behind, the back of this vest was a three-by-three
  // grid of orange squares in a white lattice. Every piece was individually
  // defensible; the arrangement was a basket.
  //
  // So NOTHING CROSSES ANYTHING. The rings are the only thing that goes round
  // the body, and the shoulder pieces live entirely above the upper ring and
  // die into the vest's own top edge — which is what a brace does anyway. It
  // goes over your shoulder. It does not run down your back through the
  // banding.
  //
  // AND THE VEST IS OPEN AT THE FRONT, which is the other half of it. A closed
  // orange tube has no front, no back and no way of telling you which way a
  // contractor is facing, so it reads as a barrel however much trim you hang on
  // it. A gap showing the dark layer underneath costs two arguments on the
  // primitive that was already there and buys a centre line for the front, an
  // asymmetry for the silhouette, and somewhere for the eye to start.
  const TAU = Math.PI * 2;
  const VEST_R = 0.250 * G;      // the vest's own radius at the chest
  const TRIM_R = VEST_R + 0.009; // ...and where trim sits on top of it
  const GAP = 0.20;              // half-angle of the front opening, radians
  const BAND_HI = 0.055 * S;
  const BAND_LO = -0.100 * S;
  const VEST_TOP = 0.180 * S;
  const VEST_H = 0.385 * S;
  /** An open strip of cylinder, hugging the vest. `mid` is radians off front. */
  const strip = (mid, width, h, y, colour, r = TRIM_R) => body.add(
    new THREE.CylinderGeometry(r, r, h, 7, 1, true, mid - width / 2, width),
    colour, BI.torso, RF.torso, [0, y, 0],
  );
  /** A ring round the vest, interrupted by the same front opening it is on. */
  const ring = (y, h, colour, r = TRIM_R) => body.add(
    new THREE.CylinderGeometry(r, r, h, 16, 1, true, GAP + 0.03, TAU - 2 * (GAP + 0.03)),
    colour, BI.torso, RF.torso, [0, y, 0],
  );
  body
    // The base layer, and then a ROUNDED top on it. A bare cylinder ends in a
    // flat disc, and a flat dark disc the width of the chest wedged between an
    // orange vest and a head photographs as a black slab with no explanation —
    // which is exactly what the back view was showing above the banding. A
    // squashed ball costs one primitive and turns the same volume into
    // shoulders.
    .add(new THREE.CylinderGeometry(0.220 * G, 0.196 * G, 0.40 * S, 12), CLOTH,
      BI.torso, RF.torso, [0, -0.020 * S, 0])
    .blob(0.218 * G, [1.0, 0.55, 0.84], CLOTH, BI.torso, RF.torso, [0, 0.150 * S, 0], 12)
    // The vest: a slightly larger shell, hanging low, open down the front.
    .add(new THREE.CylinderGeometry(VEST_R, 0.238 * G, VEST_H, 16, 1, true,
      GAP, TAU - 2 * GAP), HIVIZ, BI.torso, RF.torso, [0, VEST_TOP - VEST_H / 2, 0]);
  // Bands, not plates. A box laid across a round torso meets it at four corners
  // and reads as a slab bolted on; the figure ends up looking like a stack of
  // trays. A shallow cylinder a few millimetres proud of the vest wraps it the
  // way a reflective band actually does — and stops where the vest stops, so
  // the opening stays an opening instead of being taped shut.
  ring(BAND_HI, 0.076, TAPE);
  ring(BAND_LO, 0.076, TAPE, TRIM_R + 0.003);
  // Braces over both shoulders, front and back.
  //
  // AND THEY NO LONGER TOUCH THE UPPER BAND, WHICH IS THE WHOLE FIX.
  //
  // The previous cut ran them from the band to the top hem, which was the right
  // answer to the complaint before last: nothing crosses anything, the rings go
  // round the body and the braces live entirely above them. What it produced
  // was a different shape and a worse one. Two wide vertical straps landing
  // squarely on a horizontal band is a Π — photographed from behind, the top
  // half of this vest was a grey capital pi with one small orange window in it,
  // and a review called the back of the vest a grey cross rather than banding.
  //
  // Every piece was right and the arrangement was still wrong, for the second
  // time, which says the lesson is about area rather than about crossings: on
  // the BACK of a hi-vis vest the two horizontal bands have to be the largest
  // reflective things by a clear margin, or whatever else is up there takes
  // over the read.
  //
  // So the braces are narrower — 0.21 rad is about five centimetres on this
  // chest, which is what a strap actually is, against the seven and a half they
  // were — they sit further outboard, and they STOP SHORT of the band with a
  // hand's width of orange under them. That gap is what turns a Π back into two
  // straps and a stripe. The bands get wider at the same time, so the two
  // things that go round the body gain area while the two that go over the
  // shoulder lose it.
  const BRACE_LO = BAND_HI + 0.055 * S;
  for (const s of [-1, 1]) {
    strip(s * 0.66, 0.21, VEST_TOP - BRACE_LO, (VEST_TOP + BRACE_LO) / 2, TAPE);
    strip(Math.PI + s * 0.66, 0.21, VEST_TOP - BRACE_LO, (VEST_TOP + BRACE_LO) / 2, TAPE);
  }
  // Piping down both edges of the opening. An open cylinder sector has no
  // thickness, so without this the front of the vest is a cut in a sheet of
  // paper; a dark lip either side gives it an edge and says the gap is deliberate.
  for (const s of [-1, 1]) {
    strip(s * GAP, 0.075, VEST_H, VEST_TOP - VEST_H / 2, HIVIZ_DEEP, VEST_R + 0.003);
  }
  // One badge, on the chest between the bands, in the slot's own colour. Small
  // on purpose: it is a grace note at two metres and must not compete with the
  // hat at ten.
  strip(0.62, 0.30, 0.055, -0.022 * S, badge, TRIM_R + 0.004);
  body
    // Shoulders, so the arms have somewhere to be. Pulled in and dropped from
    // where they were: at 0.235·G they stood a full 0.10·G proud of the vest
    // and read as two oranges glued to a barrel rather than as the top of a
    // garment.
    .ball(0.114 * G, HIVIZ, BI.torso, RF.torso, [-0.208 * G, 0.150 * S, 0])
    .ball(0.114 * G, HIVIZ, BI.torso, RF.torso, [0.208 * G, 0.150 * S, 0]);

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

  // THE HAT, WHICH IS SOLVED AGAINST THE SKULL RATHER THAN AUTHORED AS
  // CONSTANTS, BECAUSE THAT IS WHAT WAS WRONG WITH IT.
  //
  // Every previous cut of this picked a shell radius out of the air — 0.212·HD,
  // then 0.215·HD — and seated it on a collar at 0.135·HD, against a skull of
  // 0.170·HD. Do the arithmetic at the height the collar actually sits and the
  // skull has already narrowed to about 0.14·HD, so the shell stood SEVEN
  // CENTIMETRES proud of the head all the way round and you could see straight
  // through the gap to where an ear would be. A review put it exactly: a
  // scalloped dome wider than the head with bare skull showing between hat and
  // ear. It does not read as a hard hat because it is not sitting on anything.
  //
  // A hard hat is not appreciably wider than a head. It is a shell on a fabric
  // cradle and the cradle is a centimetre or so. So the rim radius is not a
  // number any more, it is SOLVED: it is the skull's own radius at the height
  // the rim sits, plus that cradle. Every build then gets a hat that touches
  // its own head however big that head is, which a constant could never do —
  // the eight heads here vary by half in scale.
  //
  // Three things follow from that, and all three are what a hard hat has:
  //
  //  * NO ROLL, NO STACK. The old shell had a rolled collar under it, then a
  //    brim under that, then a headband under that — four rings of different
  //    radii at four heights, which photographs as a boater however you tune
  //    it. The shell's own rim IS the widest point of the crown now, and the
  //    brim springs directly off it with nothing in between.
  //  * THE BRIM STARTS WHERE THE CROWN STOPS. Its top face sits three
  //    millimetres above the shell's seat, so there is a lip and there is no
  //    gap. A gap between crown and brim is the single thing that says
  //    "sun hat".
  //  * THE BAND CLOSES THE HAT ONTO THE HEAD. It runs at the SKULL's radius
  //    rather than at a fraction of the shell's, so it fills the space under
  //    the rim instead of adding a fourth ring to the stack, and being dark it
  //    is the shadow line that tells you where the hat stops.
  //
  // A hat is still a thing you wear on TOP of a face. Every crown here is a
  // half sphere seated above the brow bar and nothing has a lower hemisphere —
  // an early cut used a full sphere for the cap and the contractor came out as
  // a coloured egg with a dark bar across it and no eyes at all.
  //
  // The three silhouettes still have to be different at range or the eight
  // builds collapse. Dome: peripheral brim, comb ribs. Fullbrim: a flat disc
  // half again as wide, unmistakable at eight pixels. Cap: a bump cap, lower
  // crown, no brim at the sides and a long peak at the front.

  /** The head blob's own radius at a height, in figure-relative metres. */
  const skullR = (y) => {
    const t = (y - 0.02) / (HR * 1.02);           // the blob's y semi-axis
    return HR * Math.sqrt(Math.max(0.04, 1 - t * t));
  };
  // Where the rim sits: clear of the brow bar, which is the highest thing on
  // the face and reaches eyeY + eyeR·1.13. A hat that clips its own eyebrows
  // is worse than one that floats.
  const RIM = Math.max(0.080 * HD, eyeY + eyeR * 1.30);
  // ...and the cradle. Four centimetres of head scale, which is a suspension,
  // a shell thickness, and the correction for the first cut of this.
  //
  // Solving the rim against the skull fixed the gap and immediately introduced
  // its opposite: photographed front on, the shell came out NARROWER THAN THE
  // EYES. That is not a hat either — it reads as a bottle cap — and it happens
  // because the eyes are not on the skull's silhouette, they are proud of it,
  // so a hat sized to the skull is automatically smaller than the widest thing
  // on the face. Three centimetres of cradle is what a hat has; the extra
  // centimetre is what the caricature has, and the numbers below are set so
  // that every build's brim clears its own eyeballs.
  const RIM_R = skullR(RIM) + 0.042 * HD;

  // The shell: a squashed half sphere whose widest point is its own rim.
  //
  // THE CROWN CAME DOWN, AND THE REASON IS ARITHMETIC RATHER THAN TASTE.
  //
  // The rule this was set by — "a hard hat's crown rises about half its own
  // width above the brim" — is true of a hard hat and was being applied to the
  // wrong denominator. Worked through for THE UNIT: the rim solves to y 0.147
  // and the skull tops out at 0.221, so there is 74 mm of head above the brim
  // line, while a squash of 1.08 on a rim radius of 0.202 put 218 mm of shell
  // above it. The crown was very nearly THREE TIMES the height of the skull it
  // was covering, which is not a hard hat, it is a bowler, and photographed
  // side-on that is exactly what it looked like.
  //
  // The rim is high because the eyes are a caricature: eyeR is half the skull
  // radius, so "clear of the brow bar" lands three quarters of the way up the
  // head and leaves the shell almost nothing to sit on. That is the constraint,
  // it is not going away, and the answer is not to keep growing the crown until
  // the hat looks big — it is to put the missing shell BELOW the brim, where a
  // hard hat actually keeps it. See skirt() below.
  //
  // AND THE NUMBER THAT FOLLOWS FROM ALL OF THAT, BECAUSE THE NOTE ABOVE
  // ARGUED IT AND NEVER APPLIED IT.
  //
  // squashY is the crown's height as a fraction of its own rim radius. A real
  // shell is about 0.6 of it — 90 mm of crown over a 140 mm rim — and this ran
  // 1.08 for the dome, 1.02 for the full brim and 0.90 for the bump cap, so
  // every one of the three was between a half and a full radius too tall.
  // 0.62/0.66/0.55 is the real proportion, and the check that says it is safe
  // is that the crown must still clear the skull it covers: worked for the
  // worst case of the eight builds, THE APPRENTICE, whose head is 1.28 and
  // whose skull stands 70 mm above its own rim against 127 mm of shell.
  const shell = (r, squashY, seat) => head.add(
    squash(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      [1.0, squashY, 1.06]), hatCol, BI.hat, RF.hat, [0, seat, 0],
  );
  // THE SKIRT, WHICH IS THE HALF OF A HARD HAT THAT WAS MISSING.
  //
  // "Bare skull showing between hat and ear" has now been written by two
  // separate reviews, and both times the fix went into the crown or the rim
  // radius, and both times the skull between the brim and the ear stayed
  // exactly where it was — because nothing in this build ever descended below
  // the brim line at all. Every previous cut was a dome plus a disc, and a dome
  // plus a disc is a hat you put ON a head. A hard hat goes AROUND one: the
  // shell wraps down over the temples to about the top of the ear and lower
  // still at the back, and that wrap is most of the silhouette from the side —
  // which is the view the complaint keeps coming from.
  //
  // Open at the front, because that is where the brim is and there is nothing
  // under a brim.
  //
  // AND THE OPENING IS 89 DEGREES EACH SIDE, WHICH IS NOT A TASTE DECISION.
  //
  // The previous cut wrote this function, put 65 degrees in it, and never
  // called it — which is why the complaint survived a third review. 65 was
  // solved against where the eyes' CENTRES are, and the eyes are balls: for
  // THE UNIT the pair sit at 56 degrees off the nose at a radius of 0.190 with
  // a radius of 0.100 each, so at the height the skirt's lower edge runs they
  // reach 84 degrees, and a skirt at 65 would have been driven straight through
  // both eyeballs. Solved at the lower edge for the widest-eyed build and
  // rounded up, the opening is 1.55 rad — which leaves the skirt covering the
  // back and the sides behind the ear, and that is exactly the part of a hard
  // hat that hangs below its own brim.
  //
  // It follows the skull's own curve top and bottom, like the band does, so it
  // is welded to the head rather than hovering off it, and it carries the
  // shell's colour rather than the band's: this is shell, not suspension.
  const SKIRT_OPEN = 1.55;                  // radians each side of the nose
  const skirt = (seat, drop) => {
    const rt = skullR(seat) + 0.030 * HD;
    const rb = skullR(seat - drop) + 0.026 * HD;
    const g = new THREE.CylinderGeometry(rt, rb, drop, 18, 1, true,
      SKIRT_OPEN, Math.PI * 2 - SKIRT_OPEN * 2);
    head.add(g, hatCol, BI.hat, RF.hat, [0, seat - drop / 2, 0]);
  };

  // Three stiffening ribs front-to-back, FOLLOWING the shell instead of being
  // laid across it. A straight box over a dome touches at the crown and its two
  // ends float clear of the surface — photographed front-on that read as three
  // gold nuggets hovering above the brim with daylight under them, which is not
  // what a rib is. An arc of cylinder with its axis across the head is the same
  // primitive the shoulder braces use, and it sits down on the curve for its
  // whole length.
  //
  // The arc's radius is the shell's own radius at that lateral offset, so the
  // outer two ribs are shorter than the middle one for free, and both scales
  // carry the shell's squash so nothing drifts off it at the ends. They stand
  // 0.012·HD proud rather than 0.004 flat: a rib you cannot see the shadow of
  // is not a raised crown ridge, it is a painted stripe.
  const ribs = (r, seat, squashY) => {
    for (const [dx, arc, w] of [[0, 0.92, 0.034], [-0.40, 0.68, 0.026], [0.40, 0.68, 0.026]]) {
      const rr = r * Math.sqrt(Math.max(0.04, 1 - dx * dx)) + 0.008 * HD;
      const g = new THREE.CylinderGeometry(rr, rr, w * HD + 0.006, 10, 1, true,
        Math.PI / 2 - arc, arc * 2);
      g.rotateZ(Math.PI / 2);           // axis across the head; the sector arcs fore-aft
      g.scale(1, squashY, 1.06);        // the shell's own squash, so it stays welded on
      head.add(g, hatDark, BI.hat, RF.hat, [dx * r, seat, 0]);
    }
  };
  // The headband. At the SKULL's radius, in the space under the rim that the
  // shell has just stopped covering, so hat and head are continuous.
  const band = (seat) => {
    const h = 0.052 * HD;
    head.cyl(skullR(seat) + 0.005 * HD, skullR(seat - h) + 0.005 * HD, h, hatDark,
      BI.hat, RF.hat, [0, seat - h / 2, 0], null, 14);
  };

  if (build.hat === 'cap') {
    // A bump cap. Lowest crown of the three, no brim at the sides at all, and a
    // long curved peak — which is the whole silhouette. A half disc rather than
    // a box: a rectangular peak reads as a plank from any angle off-axis, and
    // the curve is one parameter on the same primitive.
    const r = RIM_R * 0.97;
    shell(r, 0.55, RIM);
    // The deepest skirt of the three, because a cap has no brim at the sides
    // and the wrap IS the whole side of it. Two fifths of a skull radius takes
    // the edge to about the top of an ear.
    skirt(RIM, HR * 0.46);
    band(RIM);
    // A HALF DISC IS NOT A PEAK, IT IS A SAUCER.
    //
    // The first cut swept 180 degrees at 1.46 radii, and photographed front on
    // that is a flying saucer with a skullcap on it: from directly ahead you
    // see the whole width of the sweep and none of its length, so the one thing
    // that makes a peak a peak — that it points somewhere — is the one thing
    // you cannot see. A real peak subtends about 120 degrees and is longer than
    // it is wide. Narrower arc, smaller radius, more stretch down +Z, and a
    // steeper tilt so it catches a different value from the crown.
    head.add(
      squash(new THREE.CylinderGeometry(r * 1.30, r * 1.20, 0.024 * HD + 0.006, 14, 1,
        false, -1.05, 2.10), [1.0, 1.0, 1.34]),
      // Tilted so the front DROOPS. Rotation about +X carries +Z downwards, so
      // the sign here is the difference between a peak and a party hat; every
      // previous cut had it negative and photographed with the peak pointing at
      // the ceiling.
      hatCol, BI.hat, RF.hat, [0, RIM - 0.006 * HD, 0.014 * HD], [0.17, 0, 0],
    );
  } else if (build.hat === 'fullbrim') {
    // The full-brim hard hat: a flat disc all the way round, and the crown sits
    // back inside it. In outline this is unmistakably not the other two even
    // when it is eight pixels of hat on forty pixels of person.
    //
    // 1.58 rim radii, which on a real Bullard 5100 or MSA Skullgard is about
    // right. It reads far wider than the old 0.285·HD disc did in relation to
    // its crown, and yet it is NARROWER in absolute terms, because the crown it
    // is measured against is no longer a size and a half too big.
    const r = RIM_R;
    shell(r, 0.66, RIM);
    ribs(r, RIM, 0.66);
    // Shallowest of the three: on a full-brim helmet the disc is doing the work
    // and a deep wrap under it would read as a sou'wester.
    skirt(RIM, HR * 0.26);
    band(RIM);
    // 1.46 radii, not 1.58. A brim more than about half again the crown is a
    // boater whatever else you do to it, and at 1.58 over a crown squashed to
    // 0.94 this photographed as exactly that — a pith helmet on a small man.
    // The crown comes UP at the same time, which is the half that matters: what
    // separates a full-brim hard hat from a sun hat in outline is not the width
    // of the disc, it is how much shell there is standing above it.
    head.cyl(r * 1.46, r * 1.36, 0.026 * HD + 0.006, hatCol, BI.hat, RF.hat,
      [0, RIM - 0.010 * HD, 0], null, 16);
  } else {
    // The standard shell: a peripheral brim, wider front and back than at the
    // sides, which is what a Centurion or an MSA actually looks like from above.
    const r = RIM_R;
    shell(r, 0.62, RIM);
    ribs(r, RIM, 0.62);
    // The standard shell's own wrap. This is the one the review kept
    // photographing from the side and calling a dome with bare skull under it.
    skirt(RIM, HR * 0.38);
    band(RIM);
    head.add(
      squash(new THREE.CylinderGeometry(r * 1.40, r * 1.28, 0.024 * HD + 0.006, 16),
        [1.0, 1.0, 1.20]),
      hatCol, BI.hat, RF.hat, [0, RIM - 0.009 * HD, 0.014 * HD],
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
  //
  // AND THE RAGDOLL SKULL IS NOT HD-SCALED, WHICH IS WHY THIS HAD ITS OWN BUG.
  //
  // The eleven ragdoll lumps come off BONE_SIZES, which is a fixed list the
  // server shares — the head is 0.24 across for everybody. The hat over it was
  // authored at 0.215·HD, so THE APPRENTICE's corpse wore a 0.27 m hat on a
  // 0.125 m head: not merely floating, twice the width of the thing it was on.
  // Solved against the ragdoll's own skull the same way the upright one is.
  const RAG_HR = BONE_SIZES[2][0] * 0.52;
  const ragSkullR = (y) => RAG_HR * Math.sqrt(Math.max(0.04, 1 - (y / (RAG_HR * 1.05)) ** 2));
  const RAG_RIM = 0.052;                 // above the eyes, which sit at EYE_AT[1] - 0.02
  const RAG_R = ragSkullR(RAG_RIM) + 0.022;
  // The hat bone rests 0.14 above the skull's centre, and the geometry is
  // authored relative to it, so the seat is the rim height less that offset.
  const ragSeat = RAG_RIM - 0.14;
  if (build.hat === 'cap') {
    ragHead.add(squash(new THREE.SphereGeometry(RAG_R * 0.97, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2),
      [1.0, 0.84, 1.04]), hatCol, 11, ragHatRest, [0, ragSeat, 0]);
    ragHead.add(squash(new THREE.CylinderGeometry(RAG_R * 1.46, RAG_R * 1.34, 0.028, 12, 1,
      false, -Math.PI / 2, Math.PI), [1.0, 1.0, 1.20]),
    hatCol, 11, ragHatRest, [0, ragSeat - 0.004, 0.010], [-0.15, 0, 0]);
  } else {
    const w = build.hat === 'fullbrim' ? 1.58 : 1.28;
    ragHead.add(squash(new THREE.SphereGeometry(RAG_R, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2),
      [1.0, 0.98, 1.06]), hatCol, 11, ragHatRest, [0, ragSeat, 0]);
    ragHead.cyl(RAG_R * w, RAG_R * (w - 0.10), 0.028, hatCol, 11, ragHatRest,
      [0, ragSeat - 0.008, 0.008], null, 14);
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
