// HAZARD PAY — things worth money, as geometry.
//
// ==========================================================================
//  MODULE INTERFACE — this is a placeholder implementation. The art pass owns
//  the internals of this file and nothing else may.
//
//  export function meshForProp(def): THREE.Object3D
//
//  `def` is the catalogue entry straight out of shared/props.js. The art
//  recipe is `def.look` — `{ kind, mat, tint }` — and the rest of the entry is
//  there because a placeholder cannot invent a shape it has not been told:
//  `def.shape`, `def.size` and `def.parts` are the exact collider the server
//  simulates, so a mesh built from them can never look bigger or smaller than
//  the thing you actually collide with.
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

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { tintedMaterial } from './materials.js';

/**
 * A drawable for one prop kind.
 *
 * @param {object} def catalogue entry from shared/props.js
 * @returns {THREE.Object3D} fresh object, safe to clone per instance
 */
export function meshForProp(def) {
  const look = def.look || {};
  const parts = def.shape === 'compound'
    ? def.parts
    : [{ shape: def.shape, size: def.size, offset: [0, 0, 0] }];

  const geos = [];
  for (const part of parts) {
    const g = primitive(part.shape, part.size);
    const o = part.offset || [0, 0, 0];
    g.translate(o[0], o[1], o[2]);
    geos.push(g);
  }

  // One mesh per prop, always. Forty props at four meshes each would be a
  // hundred and sixty draw calls before a single wall is drawn.
  const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
  for (const g of geos) if (g !== merged) g.dispose();

  paintVertexColours(merged);

  const mesh = new THREE.Mesh(merged, tintedMaterial(look.mat, look.tint));
  mesh.name = `prop:${def.id}`;
  return mesh;
}

// --- placeholder primitives -------------------------------------------------
// Segment counts are deliberately mean. A mug is eleven millimetres across on
// screen most of the time and nobody has ever counted its sides.

function primitive(shape, size) {
  if (shape === 'cyl') return new THREE.CylinderGeometry(size[0], size[0], size[1], 12, 1);
  if (shape === 'ball') return new THREE.SphereGeometry(size[0], 14, 10);
  return new THREE.BoxGeometry(size[0], size[1], size[2]);
}

/**
 * Bake a little top-down shading into COLOR.
 *
 * The shared materials run with vertexColors on, so this is free contrast:
 * upward faces come out light, undersides dark. Without it a merged box reads
 * as a single flat silhouette under a low sun.
 */
function paintVertexColours(geo) {
  const pos = geo.getAttribute('position');
  const nrm = geo.getAttribute('normal');
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const ny = nrm ? nrm.getY(i) : 1;
    const shade = 0.82 + ny * 0.18;
    col[i * 3] = shade; col[i * 3 + 1] = shade; col[i * 3 + 2] = shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}
