// HAZARD PAY — things worth money, as geometry.
//
// ==========================================================================
//  MODULE INTERFACE — the art pass owns the internals of this file and
//  nothing else may.
//
//  export function meshForProp(def): THREE.Object3D
//
//  `def` is the catalogue entry straight out of shared/props.js. The art
//  recipe is `def.look` — `{ kind, mat, tint }` — and `def.shape`, `def.size`
//  and `def.parts` are the exact collider the server simulates, so a mesh
//  built from them can never look bigger or smaller than the thing you
//  actually collide with.
//
//  Contract, in both directions:
//
//   * ORIGIN. The returned object's origin is the rigid body's origin, and its
//     +Y is world up in the prop's rest pose. The caller sets position and
//     quaternion from the wire and nothing else. Compound parts use `offset`
//     exactly as the server does.
//
//   * ONE CALL PER KIND. The renderer asks once per prop kind and clones the
//     result for every instance, so geometry and materials must be safe to
//     share across clones (they are, under THREE's clone semantics). Do not
//     stash per-instance state on the object.
//
//   * DRAW CALLS ARE THE BUDGET. Every Mesh in the returned object is a draw
//     call per prop on screen, and a warehouse holds forty-odd props. Merge
//     parts that share a material — the placeholder does, and a real pass with
//     four materials on a piano should still merge to four meshes, not forty.
//
//   * NO LOADERS. Procedural or inlined only; the build has no asset pipeline.
//
//   * A missing `look.kind` case must still return something. New props get
//     added to the catalogue before anyone draws them.
// ==========================================================================
//
// ONE MESH PER PROP. NOT FOUR. NOT TWO.
//
// The interface above says a piano may be four meshes. It is one, and the
// reason is a number: the warehouse spends 101 of its 155 draw calls inside
// shadow passes. A shadow-casting point light is six cube faces and the sun is
// a seventh, so every extra node on a prop is not one draw call, it is closer
// to three by the time the frame is finished — and the plant has fifty-five
// props. A piano at four meshes would cost twelve.
//
// Which means colour cannot come from the material, because a piano has black
// lacquer, ivory keys, brass pedals and red felt on it. So none of it does:
// every material in RECIPES sits near white, `materialFor` runs with
// vertexColors on, and the ENTIRE palette of every object in this file is baked
// into the COLOR attribute. Seventeen kinds of object, ten materials, one draw
// call each, and a novelty cheque can still have four colours printed on it.
//
// That also means props no longer ask for `tintedMaterial`. A per-tint material
// is a separate object with separate uniforms — harmless for draw calls but it
// forbids anything downstream from ever merging or instancing two props of
// different colour, and instancing props by kind is the next obvious win in
// this renderer. `look.tint` is now a paint colour, read here and baked.
//
// WHAT THE SHAPES ARE FOR. The brief for the catalogue is that it is absurd —
// taxidermy elk, novelty cheque, fishbowl with a fish in it — and an absurd
// object is only funny if you can tell what it is. The test each of these has
// to pass is a silhouette test at about six metres in bad light: a bathtub must
// have feet and a rolled rim, a CRT must have a deep back, a chandelier must
// have candles hanging off it. Detail below that threshold is not worth a
// triangle, and most of these are under 400.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { materialFor } from './materials.js';

/**
 * A geometry accumulator that bakes colour and top-down shading as it goes.
 *
 * Every primitive is positioned in the prop's own space and immediately tinted,
 * because once these are merged there is no way to tell which triangles used to
 * be the handle.
 */
class Build {
  constructor() { this.geos = []; }

  add(geo, colour, at, rot) {
    // Rotate before translating, and tint after both: the shade term reads the
    // normal, and a rotation moves normals.
    if (rot) { geo.rotateX(rot[0] || 0); geo.rotateY(rot[1] || 0); geo.rotateZ(rot[2] || 0); }
    if (at) geo.translate(at[0], at[1], at[2]);
    paint(geo, colour);
    this.geos.push(geo);
    return this;
  }

  box(w, h, d, c, at, rot) { return this.add(new THREE.BoxGeometry(w, h, d), c, at, rot); }

  cyl(rt, rb, h, c, at, rot, seg = 12, open = false) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), c, at, rot);
  }

  ball(r, c, at, seg = 12) {
    return this.add(new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1)), c, at);
  }

  /** A partial sphere — bowls, domes, the top of an extinguisher. */
  dome(r, c, at, seg = 12, t0 = 0, t1 = Math.PI / 2, rot) {
    return this.add(
      new THREE.SphereGeometry(r, seg, Math.max(4, seg >> 1), 0, Math.PI * 2, t0, t1), c, at, rot,
    );
  }

  ring(r, tube, c, at, rot, seg = 12, tseg = 6, arc = Math.PI * 2) {
    return this.add(new THREE.TorusGeometry(r, tube, tseg, seg, arc), c, at, rot);
  }

  /**
   * One mesh, one material, always. See the note at the top of the file.
   *
   * `materialFor` is shared per name, so every metal prop in the level points
   * at the same object and nothing downstream is blocked from merging them.
   */
  mesh(matName, name) {
    const g = this.geos.length === 1 ? this.geos[0] : mergeGeometries(this.geos, false);
    for (const x of this.geos) if (x !== g) x.dispose();
    const m = new THREE.Mesh(g, materialFor(matName));
    m.name = name;
    return m;
  }
}

const _c = new THREE.Color();

/**
 * Bake a colour and a little top-down shading into COLOR.
 *
 * The shading is not decoration. A merged prop is one draw call with one
 * material, so the only thing distinguishing the top of a crate from its side
 * before a lamp reaches it is this, and in a level where most objects spend
 * most of their time in bounce light it is doing more work than the lighting.
 */
function paint(geo, colour) {
  _c.set(colour);
  const nrm = geo.getAttribute('normal');
  const n = geo.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const shade = 0.84 + (nrm ? nrm.getY(i) : 1) * 0.16;
    col[i * 3] = _c.r * shade;
    col[i * 3 + 1] = _c.g * shade;
    col[i * 3 + 2] = _c.b * shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

/** Shift a colour's lightness without leaving its hue. */
function shade(hex, k) {
  _c.set(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  _c.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l * k)));
}

// Colours shared across several props, so a bolt looks like a bolt everywhere.
const STEEL = '#8e949c';
const DARKSTEEL = '#42474e';
const BRASS = '#b5903f';
const RUBBERBLACK = '#1b1d21';
const GLASSDARK = '#171b20';

// --- the catalogue, one builder per kind ------------------------------------
// Every builder gets (b, def, tint). `def` carries the collider it must live
// inside; `tint` is the level's paint colour for the object.

const KIND = {

  // A mug is eleven centimetres tall and you will see it from four metres, so
  // it gets exactly two features: a handle, so the silhouette is a mug, and a
  // dark well, so it is a mug with coffee in it.
  mug(b, def, tint) {
    const r = def.size[0], h = def.size[1];
    b.cyl(r, r * 0.86, h, tint, [0, 0, 0], null, 14);
    b.cyl(r * 0.90, r * 0.90, h * 0.06, shade(tint, 0.55), [0, h * 0.47, 0], null, 14);
    b.cyl(r * 0.84, r * 0.84, h * 0.30, '#2b1d13', [0, h * 0.36, 0], null, 12);
    // Three-quarters of a torus, so the join into the wall is hidden inside it.
    b.ring(r * 0.62, r * 0.15, tint, [r * 1.05, -h * 0.06, 0], [0, Math.PI / 2, 0], 10, 5, 4.2);
    b.cyl(r * 0.72, r * 0.72, h * 0.05, shade(tint, 0.8), [0, -h * 0.5, 0], null, 12);
  },

  // The stapler is the cheapest joke in the catalogue: it is a lump, but a lump
  // with a hinge and a chrome strike plate reads instantly as an office stapler
  // rather than as a brick.
  stapler(b, def, tint) {
    const [w, h, d] = def.size;
    b.box(w, h * 0.42, d, shade(tint, 0.7), [0, -h * 0.29, 0]);
    b.box(w * 0.42, h * 0.10, d * 0.62, STEEL, [w * 0.24, -h * 0.06, 0]);   // strike plate
    b.box(w * 0.94, h * 0.46, d * 0.90, tint, [-w * 0.02, h * 0.20, 0]);    // the arm
    b.cyl(h * 0.22, h * 0.22, d * 0.92, DARKSTEEL, [-w * 0.42, h * 0.02, 0],
      [Math.PI / 2, 0, 0], 8);                                              // the hinge
    b.box(w * 0.30, h * 0.14, d * 0.70, shade(tint, 1.35), [w * 0.30, h * 0.44, 0]);
  },

  // Every red thing in an industrial building is either a fire extinguisher or
  // pretending to be one. Domed both ends, black neck, brass valve, and the
  // hose, which is the bit that makes the silhouette unmistakable.
  extinguisher(b, def, tint) {
    const r = def.size[0], h = def.size[1];
    const body = h * 0.66;
    b.cyl(r, r, body, tint, [0, -h * 0.10, 0], null, 14);
    b.dome(r, tint, [0, -h * 0.10 + body / 2, 0], 14);
    b.dome(r, shade(tint, 0.75), [0, -h * 0.10 - body / 2, 0], 14, Math.PI / 2, Math.PI / 2);
    b.cyl(r * 1.04, r * 1.04, h * 0.10, shade(tint, 0.55), [0, -h * 0.06, 0], null, 14);
    b.cyl(r * 0.30, r * 0.34, h * 0.10, RUBBERBLACK, [0, h * 0.28, 0], null, 10);
    b.cyl(r * 0.22, r * 0.22, h * 0.06, BRASS, [0, h * 0.35, 0], null, 10);
    b.box(r * 1.5, h * 0.035, r * 0.5, BRASS, [r * 0.35, h * 0.40, 0], [0, 0, -0.16]);
    b.box(r * 1.3, h * 0.03, r * 0.45, DARKSTEEL, [r * 0.30, h * 0.33, 0], [0, 0, 0.10]);
    // Hose: a half torus down the flank. Two boxes would read as a handle.
    b.ring(h * 0.17, r * 0.13, RUBBERBLACK, [r * 0.5, h * 0.10, 0], [Math.PI / 2, 0, 0.3], 10, 4, Math.PI * 1.3);
    b.box(r * 1.7, h * 0.16, r * 0.12, '#f0ead8', [0, -h * 0.10, r * 0.99]);  // the label
  },

  // A desktop printer is a wedge with a tray hanging out of the front and a
  // lid that never quite shuts.
  printer(b, def, tint) {
    const [w, h, d] = def.size;
    b.box(w, h * 0.62, d, tint, [0, -h * 0.19, 0]);
    b.box(w * 0.98, h * 0.30, d * 0.86, shade(tint, 1.06), [0, h * 0.28, -d * 0.04], [-0.05, 0, 0]);
    b.box(w * 0.86, h * 0.05, d * 0.42, shade(tint, 0.72), [0, h * 0.44, d * 0.28]); // paper
    b.box(w * 0.80, h * 0.06, d * 0.50, shade(tint, 0.86), [0, -h * 0.34, d * 0.44], [0.22, 0, 0]);
    b.box(w * 0.72, h * 0.09, d * 0.05, GLASSDARK, [0, -h * 0.02, d * 0.51]);        // output slot
    b.box(w * 0.20, h * 0.06, d * 0.14, '#1d2a1e', [w * 0.34, h * 0.14, d * 0.44]);  // panel
    b.box(w * 0.035, h * 0.03, d * 0.035, '#57d977', [w * 0.30, h * 0.16, d * 0.50]); // the light
    for (let i = 0; i < 4; i++) {
      b.box(w * 0.05, h * 0.03, d * 0.03, RUBBERBLACK,
        [-w * 0.42 + i * w * 0.30, -h * 0.49, d * 0.36]);
    }
  },

  // FISHBOWL (OCCUPIED). The fish is the entire prop. Everything else is a
  // container for the fish.
  //
  // Draw order matters here and it is the only place in this file where it
  // does: the material is transparent with depth writes on, so anything meant
  // to be seen THROUGH the glass has to be in the buffer before the glass is.
  fishbowl(b, def, tint) {
    const r = def.size[0];
    b.cyl(r * 0.74, r * 0.55, r * 0.22, '#6b6252', [0, -r * 0.74, 0], null, 14);   // gravel
    b.box(r * 0.10, r * 0.34, r * 0.06, '#3d7a3a', [-r * 0.30, -r * 0.48, 0], [0, 0.4, 0.15]);
    b.box(r * 0.09, r * 0.28, r * 0.05, '#4d8a3a', [-r * 0.18, -r * 0.52, r * 0.2], [0, -0.5, -0.2]);
    // The occupant. Flattened sphere, a wedge of tail, and a black eye you can
    // find from three metres.
    b.add(new THREE.SphereGeometry(r * 0.20, 10, 7), '#e8712a', [r * 0.10, -r * 0.10, 0]);
    b.geos[b.geos.length - 1].scale(1.5, 0.9, 0.42);
    b.box(r * 0.16, r * 0.20, r * 0.03, '#f08a3c', [-r * 0.16, -r * 0.08, 0], [0, 0, 0.5]);
    b.ball(r * 0.045, '#100c08', [r * 0.24, -r * 0.05, r * 0.06], 6);
    // The bowl: open at the top, with a rolled lip.
    b.dome(r, tint, [0, 0, 0], 16, 0.62, Math.PI - 0.62);
    b.ring(r * 0.80, r * 0.055, tint, [0, r * 0.62, 0], [Math.PI / 2, 0, 0], 16, 5);
  },

  // An office chair is legible only from its five-star base and its gas strut.
  // The seat is the least characteristic part of it.
  officechair(b, def, tint) {
    b.cyl(0.30, 0.30, 0.035, DARKSTEEL, [0, 0.05, 0], null, 10);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      b.box(0.055, 0.045, 0.30, DARKSTEEL,
        [Math.sin(a) * 0.16, 0.05, Math.cos(a) * 0.16], [0, a, 0]);
      b.ball(0.035, RUBBERBLACK, [Math.sin(a) * 0.30, 0.032, Math.cos(a) * 0.30], 7);
    }
    b.cyl(0.035, 0.045, 0.34, STEEL, [0, 0.22, 0], null, 10);
    b.cyl(0.06, 0.06, 0.09, DARKSTEEL, [0, 0.36, 0], null, 10);
    // Seat and back: rounded fronts, a lumbar bulge, and piping round the edge.
    b.box(0.46, 0.085, 0.44, tint, [0, 0.44, 0], [0.04, 0, 0]);
    b.box(0.48, 0.035, 0.46, shade(tint, 0.62), [0, 0.40, 0]);
    b.box(0.42, 0.50, 0.075, tint, [0, 0.74, -0.20], [-0.13, 0, 0]);
    b.box(0.36, 0.16, 0.055, shade(tint, 1.22), [0, 0.60, -0.155], [-0.13, 0, 0]);
    b.box(0.44, 0.06, 0.09, shade(tint, 0.62), [0, 0.97, -0.235], [-0.13, 0, 0]);
    for (const s of [-1, 1]) {
      b.box(0.04, 0.20, 0.05, DARKSTEEL, [s * 0.24, 0.55, -0.06]);
      b.box(0.06, 0.045, 0.26, shade(tint, 0.8), [s * 0.24, 0.66, -0.02]);
    }
  },

  // A step ladder, folded. The A-frame is the whole silhouette, so the two
  // stiles splay and the treads run between them.
  ladder(b, def, tint) {
    const [w, h, d] = def.size;
    const steps = 6;
    for (const s of [-1, 1]) {
      b.box(0.055, h, d * 0.34, tint, [s * (w / 2 - 0.04), 0, -d * 0.22], [0.035 * s * 0, 0, -s * 0.03]);
      b.box(0.045, h * 0.96, d * 0.28, shade(tint, 0.82), [s * (w / 2 - 0.06), -h * 0.02, d * 0.26], [-0.05, 0, -s * 0.02]);
    }
    for (let i = 0; i < steps; i++) {
      const y = -h / 2 + 0.16 + (i * (h - 0.34)) / steps;
      b.box(w - 0.09, 0.028, d * 0.30, shade(tint, 1.1), [0, y, -d * 0.20]);
      b.box(w - 0.13, 0.02, d * 0.05, DARKSTEEL, [0, y - 0.02, -d * 0.20]);
    }
    b.box(w, 0.05, d * 0.80, shade(tint, 1.18), [0, h / 2 - 0.02, 0]);         // top platform
    b.box(w * 0.9, 0.035, 0.035, DARKSTEEL, [0, h / 2 - 0.05, d * 0.30]);      // hinge
    b.box(w * 0.5, 0.20, 0.02, '#e8d24a', [0, -h / 2 + 0.42, -d * 0.36]);      // warning label
  },

  // TAXIDERMY ELK. A shoulder mount: the shoulders, a long muzzle, ears set
  // back, glass eyes, and a rack that is far too wide for any doorway in the
  // level — which is the entire reason it is in the catalogue.
  elk(b, def, tint) {
    b.box(0.52, 0.62, 0.34, tint, [0, 0, 0]);                            // shoulders
    b.box(0.44, 0.30, 0.30, shade(tint, 0.9), [0, 0.20, 0.06], [0.18, 0, 0]);
    b.box(0.26, 0.30, 0.26, tint, [0, 0.44, 0.10]);                      // skull
    b.box(0.17, 0.17, 0.24, shade(tint, 1.12), [0, 0.40, 0.24], [0.24, 0, 0]);  // muzzle
    b.ball(0.055, '#191410', [0, 0.36, 0.36], 8);                        // nose
    for (const s of [-1, 1]) {
      b.ball(0.036, '#120e0a', [s * 0.10, 0.50, 0.21], 7);               // eyes
      b.box(0.055, 0.13, 0.09, shade(tint, 0.78), [s * 0.15, 0.56, 0.02], [0, s * 0.5, s * 0.55]);
      // The rack. A beam sweeping back and up with four tines off the top of
      // it: fewer, longer tines read as antlers, and more of them read as a
      // shrub.
      b.box(0.055, 0.055, 0.30, '#8a7148', [s * 0.13, 0.62, 0.10], [0.5, s * 0.55, 0]);
      b.box(0.05, 0.05, 0.34, '#93794e', [s * 0.30, 0.74, 0.16], [0.15, s * 0.85, 0]);
      for (let i = 0; i < 4; i++) {
        b.box(0.032, 0.19 + i * 0.035, 0.032, '#9c8253',
          [s * (0.22 + i * 0.10), 0.80 + i * 0.028, 0.24 - i * 0.03], [0.25, 0, -s * 0.30]);
      }
    }
    b.box(0.46, 0.44, 0.05, '#4a3120', [0, 0.02, -0.16]);                // the plaque
  },

  // NOVELTY CHEQUE. Two metres of card with printing on it. The printing is
  // vertex colour on flat boxes, which is all a cheque is anyway.
  cheque(b, def, tint) {
    const [w, h, d] = def.size;
    b.box(w, h, d, tint);
    b.box(w * 0.97, h * 0.90, d * 0.2, shade(tint, 0.94), [0, 0, d * 0.5]);
    b.box(w * 0.93, h * 0.80, d * 0.1, '#2f5f8a', [0, 0, d * 0.62]);      // the border
    b.box(w * 0.90, h * 0.72, d * 0.1, tint, [0, 0, d * 0.70]);
    // Bank block, three ruled lines, an amount box and a very large pound sign.
    b.box(w * 0.16, h * 0.16, d * 0.1, '#2f5f8a', [-w * 0.36, h * 0.24, d * 0.78]);
    for (let i = 0; i < 3; i++) {
      b.box(w * 0.46, h * 0.020, d * 0.1, '#5a6470', [-w * 0.06, h * 0.10 - i * h * 0.17, d * 0.78]);
    }
    b.box(w * 0.22, h * 0.26, d * 0.1, '#d8d2bc', [w * 0.32, h * 0.10, d * 0.78]);
    b.box(w * 0.035, h * 0.20, d * 0.14, '#20242a', [w * 0.26, h * 0.11, d * 0.80]);
    b.box(w * 0.055, h * 0.028, d * 0.14, '#20242a', [w * 0.265, h * 0.13, d * 0.80]);
    b.box(w * 0.055, h * 0.028, d * 0.14, '#20242a', [w * 0.265, h * 0.06, d * 0.80]);
    b.box(w * 0.26, h * 0.030, d * 0.1, '#1b2f52', [-w * 0.10, -h * 0.30, d * 0.78], [0, 0, 0.05]);
  },

  // A CRT is a very deep box pretending to be a shallow one, and the depth is
  // the joke: 26 kg of it. The screen is domed, because a flat one reads as a
  // flat panel and the whole point is that this is not one.
  crt(b, def, tint) {
    const [w, h, d] = def.size;
    b.box(w * 0.66, h * 0.70, d * 0.52, shade(tint, 0.80), [0, h * 0.06, -d * 0.24], [0, 0, 0]);
    b.box(w, h * 0.86, d * 0.50, tint, [0, h * 0.06, d * 0.25]);
    b.box(w * 0.86, h * 0.66, d * 0.06, GLASSDARK, [0, h * 0.12, d * 0.50]);
    b.add(new THREE.SphereGeometry(w * 0.44, 12, 8, 0, Math.PI * 2, 0, 0.42),
      '#232b33', [0, h * 0.12, d * 0.50 - w * 0.41], [Math.PI / 2, 0, 0]);   // the bulge
    b.box(w * 0.90, h * 0.13, d * 0.10, shade(tint, 1.05), [0, -h * 0.34, d * 0.48]);
    for (let i = 0; i < 3; i++) {
      b.box(w * 0.05, h * 0.035, d * 0.04, shade(tint, 0.62), [-w * 0.30 + i * w * 0.10, -h * 0.34, d * 0.53]);
    }
    b.box(w * 0.05, h * 0.05, d * 0.04, '#3ad06a', [w * 0.38, -h * 0.34, d * 0.53]);
    for (let i = 0; i < 5; i++) {
      b.box(w * 0.52, h * 0.02, d * 0.03, shade(tint, 0.55), [0, h * 0.49, -d * 0.10 - i * d * 0.06]);
    }
    b.box(w * 0.52, h * 0.10, d * 0.44, shade(tint, 0.88), [0, -h * 0.45, 0]);   // the swivel foot
  },

  // A vending machine is a lit window with product in it, and the product has
  // to be visible or it is a red wardrobe.
  vending(b, def, tint) {
    const [w, h, d] = def.size;
    b.box(w, h, d, tint);
    b.box(w * 0.62, h * 0.94, d * 0.06, GLASSDARK, [-w * 0.16, h * 0.01, d * 0.50]);
    b.box(w * 0.58, h * 0.62, d * 0.10, '#0d1116', [-w * 0.16, h * 0.14, d * 0.51]);
    // Six shelves of something fizzy. Four colours, so it reads as a selection.
    const cans = ['#c94a3a', '#3f7fc0', '#d9a63a', '#4aa860'];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 5; c++) {
        b.box(w * 0.085, h * 0.075, d * 0.05, cans[(r + c) % 4],
          [-w * 0.40 + c * w * 0.115, h * 0.36 - r * h * 0.135, d * 0.52]);
      }
      b.box(w * 0.56, h * 0.012, d * 0.05, '#7e858e', [-w * 0.16, h * 0.31 - r * h * 0.135, d * 0.52]);
    }
    b.box(w * 0.26, h * 0.96, d * 0.04, shade(tint, 0.72), [w * 0.34, h * 0.01, d * 0.51]);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) {
        b.box(w * 0.05, h * 0.028, d * 0.03, '#20242a',
          [w * 0.26 + j * w * 0.08, h * 0.30 - i * h * 0.06, d * 0.53]);
      }
    }
    b.box(w * 0.20, h * 0.10, d * 0.03, '#1a1d22', [w * 0.34, -h * 0.16, d * 0.53]);
    b.box(w * 0.94, h * 0.12, d * 0.04, shade(tint, 1.30), [0, h * 0.42, d * 0.52]);   // header
    b.box(w * 0.70, h * 0.13, d * 0.05, '#15181d', [-w * 0.10, -h * 0.40, d * 0.51]);  // the flap
    b.box(w, h * 0.05, d, shade(tint, 0.55), [0, -h * 0.50, 0]);
  },

  // A floor safe is a cube with a door on it, and everything that makes it
  // read as a SAFE rather than as a cube is on that door.
  safe(b, def, tint) {
    const [w, h, d] = def.size;
    b.box(w, h, d, tint);
    b.box(w * 0.90, h * 0.88, d * 0.06, shade(tint, 1.14), [0, 0, d * 0.49]);
    b.box(w * 0.78, h * 0.76, d * 0.05, shade(tint, 0.86), [0, 0, d * 0.53]);
    // The wheel. Four spokes and a hub, offset to one side with the dial beside
    // it, because a centred wheel reads as a washing machine.
    b.cyl(w * 0.055, w * 0.055, d * 0.10, DARKSTEEL, [w * 0.12, 0, d * 0.56], [Math.PI / 2, 0, 0], 10);
    b.ring(w * 0.20, w * 0.028, STEEL, [w * 0.12, 0, d * 0.58], null, 14, 5);
    for (let i = 0; i < 4; i++) {
      b.box(w * 0.40, w * 0.045, d * 0.04, STEEL, [w * 0.12, 0, d * 0.58], [0, 0, (i * Math.PI) / 4]);
    }
    b.cyl(w * 0.10, w * 0.10, d * 0.045, BRASS, [-w * 0.24, h * 0.10, d * 0.56], [Math.PI / 2, 0, 0], 12);
    b.box(w * 0.03, w * 0.10, d * 0.02, '#20242a', [-w * 0.24, h * 0.18, d * 0.58]);
    b.box(w * 0.16, h * 0.06, d * 0.05, DARKSTEEL, [-w * 0.20, -h * 0.20, d * 0.55]);
    for (const s of [-1, 1]) {
      b.cyl(h * 0.045, h * 0.045, h * 0.10, DARKSTEEL, [-w * 0.46, s * h * 0.30, d * 0.45], null, 8);
    }
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        b.box(w * 0.14, h * 0.05, d * 0.14, '#15181c', [sx * w * 0.40, -h * 0.50, sz * d * 0.40]);
      }
    }
  },

  // A 42U rack, which is a black box unless you can see that it is FULL of
  // something. So it is full of blades, and the blades have lights on.
  serverrack(b, def, tint) {
    const [w, h, d] = def.size;
    b.box(w, h, d, tint);
    b.box(w * 0.92, h * 0.96, d * 0.04, shade(tint, 0.7), [0, 0, d * 0.50]);
    const units = 11;
    for (let i = 0; i < units; i++) {
      const y = -h * 0.44 + (i * h * 0.88) / units;
      b.box(w * 0.86, h * 0.055, d * 0.05, shade(tint, 2.3), [0, y, d * 0.52]);
      b.box(w * 0.80, h * 0.022, d * 0.04, '#0b0d10', [0, y, d * 0.54]);
      // Two lights a blade. Blue-green because that is the colour of a machine
      // room and it is the only cool light source in a warm level.
      b.box(w * 0.035, h * 0.014, d * 0.03, i % 3 ? '#4fe08a' : '#f0c23a',
        [-w * 0.34, y, d * 0.55]);
      b.box(w * 0.035, h * 0.014, d * 0.03, '#3f9fe0', [-w * 0.27, y, d * 0.55]);
      for (let k = 0; k < 3; k++) {
        b.box(w * 0.10, h * 0.028, d * 0.03, shade(tint, 1.6), [w * 0.08 + k * w * 0.15, y, d * 0.55]);
      }
    }
    b.box(w * 0.10, h, d * 1.02, shade(tint, 1.5), [-w * 0.46, 0, 0]);
    b.box(w * 0.10, h, d * 1.02, shade(tint, 1.5), [w * 0.46, 0, 0]);
    b.box(w * 0.98, h * 0.05, d * 0.98, shade(tint, 1.8), [0, h * 0.50, 0]);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        b.cyl(w * 0.06, w * 0.06, h * 0.05, '#101216', [sx * w * 0.36, -h * 0.50, sz * d * 0.38], null, 8);
      }
    }
  },

  // UPRIGHT PIANO. 220 kg, two people, and by far the most recognisable
  // silhouette in the catalogue if and only if it has a keyboard on it. So it
  // has 21 white keys and 15 black ones, which is a lie about how many an
  // upright has and a truth about what one looks like.
  piano(b, def, tint) {
    const w = 1.48, h = 1.20, d = 0.62;
    b.box(w, h, d, tint, [0, 0.60, 0]);
    b.box(w * 0.94, h * 0.46, d * 0.10, shade(tint, 1.5), [0, 0.86, d * 0.50]);    // upper panel
    b.box(w * 0.90, h * 0.20, d * 0.06, shade(tint, 0.5), [0, 1.03, d * 0.53]);    // music desk
    b.box(w, 0.06, d * 1.10, shade(tint, 1.7), [0, 1.20, 0]);                      // the lid
    b.box(w * 1.02, 0.08, d * 0.34, shade(tint, 1.5), [0, 0.98, 0.42]);            // fallboard
    // The keys. One pale slab with grooves cut by the black keys sitting on it.
    b.box(w * 0.92, 0.035, 0.26, '#efe9da', [0, 0.955, 0.47]);
    for (let i = 0; i < 21; i++) {
      b.box(w * 0.036, 0.038, 0.24, '#f7f2e6', [-w * 0.44 + i * w * 0.044, 0.958, 0.48]);
    }
    let x = -w * 0.425;
    for (let i = 0; i < 21; i++) {
      // Black keys go in the 2-3 pattern, which is the thing your eye actually
      // checks when it decides whether something is a piano.
      if ([0, 1, 3, 4, 5].includes(i % 7)) {
        b.box(w * 0.024, 0.030, 0.15, '#141210', [x + i * w * 0.044 + w * 0.022, 0.982, 0.435]);
      }
    }
    b.box(w * 1.02, 0.10, d * 0.28, shade(tint, 1.4), [0, 0.90, 0.40]);            // key cheeks
    b.box(w * 0.30, 0.22, 0.10, shade(tint, 1.2), [0, 0.11, d * 0.42]);            // pedal lyre
    for (let i = -1; i <= 1; i++) {
      b.box(0.05, 0.02, 0.13, BRASS, [i * 0.09, 0.06, d * 0.46], [-0.2, 0, 0]);
    }
    for (const s of [-1, 1]) {
      b.box(0.13, 1.20, d * 1.02, shade(tint, 1.35), [s * (w / 2 - 0.05), 0.60, 0]);
      b.cyl(0.055, 0.055, 0.08, '#26221e', [s * (w / 2 - 0.08), 0.04, d * 0.30], null, 8);
      b.cyl(0.055, 0.055, 0.08, '#26221e', [s * (w / 2 - 0.08), 0.04, -d * 0.30], null, 8);
    }
  },

  // CAST IRON BATH. Rolled rim, four feet, and taps. Without the feet it is a
  // skip.
  bathtub(b, def, tint) {
    const L = 1.70, W = 0.74, H = 0.60;
    b.box(L, 0.16, W, tint, [0, 0.10, 0]);
    for (const s of [-1, 1]) b.box(L, 0.56, 0.10, tint, [0, 0.44, s * 0.32]);
    for (const s of [-1, 1]) b.box(0.10, 0.56, W, tint, [s * 0.80, 0.44, 0]);
    // The rolled rim is the whole read: a bath is a bath because of the lip.
    for (const s of [-1, 1]) {
      b.cyl(0.055, 0.055, L + 0.10, shade(tint, 1.03), [0, 0.71, s * 0.335], [0, 0, Math.PI / 2], 8);
      b.cyl(0.055, 0.055, W, shade(tint, 1.03), [s * 0.825, 0.71, 0], [Math.PI / 2, 0, 0], 8);
    }
    b.box(L - 0.16, 0.03, W - 0.16, shade(tint, 0.90), [0, 0.19, 0]);   // the inside floor
    b.cyl(0.035, 0.035, 0.02, STEEL, [-0.55, 0.21, 0], null, 10);       // plughole
    // Taps at the far end.
    b.cyl(0.028, 0.032, 0.09, BRASS, [0.72, 0.76, -0.10], null, 8);
    b.cyl(0.028, 0.032, 0.09, BRASS, [0.72, 0.76, 0.10], null, 8);
    for (const s of [-1, 1]) b.box(0.075, 0.018, 0.018, BRASS, [0.72, 0.81, s * 0.10]);
    for (const s of [-1, 1]) b.box(0.018, 0.018, 0.075, BRASS, [0.72, 0.81, s * 0.10]);
    b.cyl(0.022, 0.022, 0.16, BRASS, [0.72, 0.82, 0], null, 8);
    b.box(0.10, 0.025, 0.03, BRASS, [0.66, 0.89, 0], [0, 0, 0.35]);
    // Claw feet. Splayed, so the shadow under the bath has four legs in it.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        b.cyl(0.05, 0.075, 0.10, shade(tint, 0.45), [sx * 0.66, 0.05, sz * 0.28], [sx * 0.0, 0, sz * 0.18], 8);
      }
    }
  },

  // DIESEL GENERATOR. A skid, a block, a radiator with a grille, and a stack.
  // The stack is what makes it a generator and not a toolbox.
  generator(b, def, tint) {
    const [w, h, d] = def.size;
    b.box(w, h * 0.16, d, shade(tint, 0.45), [0, -h * 0.42, 0]);           // the skid
    b.box(w * 0.92, h * 0.62, d * 0.88, tint, [0, -h * 0.02, 0]);
    b.box(w * 0.30, h * 0.26, d * 0.62, shade(tint, 0.72), [-w * 0.12, h * 0.40, 0]);
    // Radiator: a grille of slats at one end, which reads at any distance.
    b.box(w * 0.06, h * 0.54, d * 0.78, shade(tint, 0.55), [-w * 0.47, -h * 0.02, 0]);
    for (let i = 0; i < 7; i++) {
      b.box(w * 0.02, h * 0.045, d * 0.72, '#191b1e', [-w * 0.50, h * 0.18 - i * h * 0.075, 0]);
    }
    b.cyl(w * 0.055, w * 0.055, h * 0.55, DARKSTEEL, [w * 0.28, h * 0.48, -d * 0.24], null, 10);
    b.cyl(w * 0.075, w * 0.075, h * 0.07, '#131518', [w * 0.28, h * 0.74, -d * 0.24], null, 10);
    b.box(w * 0.22, h * 0.26, d * 0.06, '#1c2126', [w * 0.20, h * 0.10, d * 0.46]);   // control panel
    b.box(w * 0.04, h * 0.04, d * 0.03, '#e0563a', [w * 0.14, h * 0.16, d * 0.50]);
    b.box(w * 0.04, h * 0.04, d * 0.03, '#4fe08a', [w * 0.26, h * 0.16, d * 0.50]);
    b.cyl(w * 0.035, w * 0.035, h * 0.10, STEEL, [w * 0.20, h * 0.02, d * 0.50], [Math.PI / 2, 0, 0], 8);
    b.box(w * 0.44, h * 0.20, d * 0.50, shade(tint, 0.62), [w * 0.24, -h * 0.20, 0]);  // fuel tank
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        b.ring(h * 0.055, h * 0.016, DARKSTEEL, [sx * w * 0.36, h * 0.34, sz * d * 0.36], null, 8, 4);
      }
    }
  },

  // CHANDELIER. The collider is widest at the BOTTOM, which is upside down for
  // a chandelier and exactly right for a two-tier one hanging by its stem: the
  // arms splay out under the fitting. Candles on the arms, drops between them.
  chandelier(b, def, tint) {
    b.cyl(0.16, 0.13, 0.44, shade(tint, 0.62), [0, 0.50, 0], null, 10);      // the stem
    b.cyl(0.18, 0.10, 0.10, shade(tint, 0.5), [0, 0.74, 0], null, 10);       // canopy
    b.ball(0.075, tint, [0, 0.24, 0], 10);                                   // the centre bauble
    const tiers = [
      { r: 0.56, y: 0.04, n: 8, len: 0.24 },
      { r: 0.34, y: 0.26, n: 6, len: 0.16 },
    ];
    for (const t of tiers) {
      b.ring(t.r * 0.86, 0.022, shade(tint, 0.7), [0, t.y + 0.02, 0], [Math.PI / 2, 0, 0], 14, 5);
      for (let i = 0; i < t.n; i++) {
        const a = (i / t.n) * Math.PI * 2;
        const x = Math.sin(a) * t.r, z = Math.cos(a) * t.r;
        b.box(0.028, 0.028, t.len + 0.16, shade(tint, 0.75),
          [x * 0.55, t.y + 0.03, z * 0.55], [0.22, a, 0]);
        b.cyl(0.055, 0.075, 0.035, shade(tint, 0.9), [x, t.y + 0.075, z], null, 8);  // the bobeche
        b.cyl(0.024, 0.026, 0.11, '#f4ecd2', [x, t.y + 0.14, z], null, 8);           // the candle
        b.ball(0.026, '#ffd27a', [x, t.y + 0.21, z], 6);                             // the flame
        // Drops. Two per arm, tapered, and they are what makes the whole thing
        // read as crystal rather than as a wheel.
        for (const s of [-1, 1]) {
          const dx = Math.sin(a + s * 0.22) * t.r * 0.92;
          const dz = Math.cos(a + s * 0.22) * t.r * 0.92;
          b.cyl(0.020, 0.001, 0.10, tint, [dx, t.y - 0.06, dz], null, 6);
        }
      }
    }
  },
};

/**
 * A drawable for one prop kind.
 *
 * @param {object} def catalogue entry from shared/props.js
 * @returns {THREE.Object3D} fresh object, safe to clone per instance
 */
export function meshForProp(def) {
  const look = def.look || {};
  const b = new Build();
  const make = KIND[look.kind];
  if (make) make(b, def, look.tint || '#b8b8b8');
  else fallback(b, def, look.tint || '#b8b8b8');
  // A builder that produced nothing at all would hand mergeGeometries an empty
  // array and get null back, which becomes a mesh with no geometry and a
  // once-per-frame throw somewhere else entirely. Cheap to rule out here.
  if (!b.geos.length) fallback(b, def, look.tint || '#b8b8b8');
  return b.mesh(look.mat, `prop:${def.id}`);
}

/**
 * What an unrecognised kind gets: the collider, drawn.
 *
 * New props are added to the catalogue before anyone models them, and a level
 * that spawns one should show a plausible object rather than nothing.
 */
function fallback(b, def, tint) {
  const parts = def.shape === 'compound'
    ? def.parts
    : [{ shape: def.shape, size: def.size, offset: [0, 0, 0] }];
  for (const p of parts) {
    const s = p.size;
    const o = p.offset || [0, 0, 0];
    if (p.shape === 'cyl') b.cyl(s[0], s[0], s[1], tint, o, null, 12);
    else if (p.shape === 'ball') b.ball(s[0], tint, o, 12);
    else b.box(s[0], s[1], s[2], tint, o);
  }
}
