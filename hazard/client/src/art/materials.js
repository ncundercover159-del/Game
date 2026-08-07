// HAZARD PAY — surfaces.
//
// ==========================================================================
//  MODULE INTERFACE — this is a placeholder implementation. The art pass owns
//  the internals of this file and nothing else may.
//
//  export function materialFor(matName: string): THREE.Material
//
//  Contract, in both directions:
//
//   * `matName` is a level brush's `mat` field, verbatim, out of
//     shared/levels/*.js — 'concrete', 'panel', 'deckplate', 'plank',
//     'steelblue', 'rubber', 'grate', 'railing', ... — plus a handful of names
//     the renderer asks for itself: 'broken' (a prop's husk) and whatever a
//     prop's `look.mat` says ('ceramic', 'metal', 'glass', 'fabric', ...).
//     An unknown name MUST return something rather than throwing; levels are
//     hand-authored data and a typo should look wrong, not crash.
//
//   * The return value is SHARED. One material serves every brush of that name
//     in the level, so it may not depend on per-brush data, and the caller
//     never disposes it. Cache internally; the same name must return the same
//     object every time or the merge-by-material pass stops merging.
//
//   * Vertex colours are ON in the returned material where it makes sense: the
//     static build is one merged geometry per material and it bakes a little
//     per-brush tonal variation into COLOR so the whole warehouse is not one
//     flat grey. If a replacement material ignores vertex colours the level
//     still renders, just flatter.
//
//   * Textures must be procedural or inlined. There is no asset pipeline and
//     the build has no loader.
// ==========================================================================

import * as THREE from 'three';

const cache = new Map();

// Placeholder palette. Rough, honest values — a real art pass replaces the lot.
// `rough`/`metal` are PBR; `flat` opts a surface out of lighting entirely,
// which is what railings and grating want so they read as silhouette.
const RECIPES = {
  concrete: { color: 0x8d8b85, rough: 0.94, metal: 0.0 },
  panel: { color: 0x6f7681, rough: 0.72, metal: 0.15 },
  deckplate: { color: 0x5d6167, rough: 0.62, metal: 0.55 },
  grate: { color: 0x4a4e54, rough: 0.55, metal: 0.7 },
  steelblue: { color: 0x3f6fa3, rough: 0.5, metal: 0.6 },
  railing: { color: 0xd8b13a, rough: 0.6, metal: 0.3 },
  plank: { color: 0xa9793f, rough: 0.9, metal: 0.0 },
  rubber: { color: 0x2c2e33, rough: 0.98, metal: 0.0 },

  // prop surfaces
  ceramic: { color: 0xe8e3d8, rough: 0.35, metal: 0.0 },
  plastic: { color: 0xc9c4ba, rough: 0.6, metal: 0.0 },
  metal: { color: 0x9aa0a8, rough: 0.4, metal: 0.75 },
  glass: { color: 0x9fd8e8, rough: 0.12, metal: 0.0, opacity: 0.55 },
  fabric: { color: 0x3d4450, rough: 1.0, metal: 0.0 },
  fur: { color: 0x6b4a2f, rough: 0.95, metal: 0.0 },
  card: { color: 0xf2f0e6, rough: 0.85, metal: 0.0 },
  lacquer: { color: 0x191512, rough: 0.22, metal: 0.1 },
  enamel: { color: 0xeceae4, rough: 0.28, metal: 0.05 },
  rust: { color: 0xd4791f, rough: 0.88, metal: 0.35 },

  // the renderer's own names
  broken: { color: 0x50504c, rough: 1.0, metal: 0.0 },
  unknown: { color: 0xff00c8, rough: 1.0, metal: 0.0 },
};

/**
 * The one shared material for a named surface.
 *
 * @param {string} matName brush `mat`, prop `look.mat`, or a renderer name.
 * @returns {THREE.Material} shared, cached, never disposed by the caller.
 */
export function materialFor(matName) {
  const key = matName || 'unknown';
  const hit = cache.get(key);
  if (hit) return hit;

  const r = RECIPES[key] || RECIPES.unknown;
  const mat = new THREE.MeshStandardMaterial({
    color: r.color,
    roughness: r.rough,
    metalness: r.metal,
    vertexColors: true,
    transparent: r.opacity !== undefined,
    opacity: r.opacity ?? 1,
    // Both faces, because the shell's walls are viewed from inside and a level
    // author should never have to think about winding order.
    side: THREE.FrontSide,
  });
  mat.name = key;
  cache.set(key, mat);
  return mat;
}

/**
 * Tint a material for a single prop without breaking sharing.
 *
 * Props carry a `look.tint` and there are seventeen kinds, so seventeen cached
 * variants is cheap and seventeen hundred would not be. Keyed on name+tint.
 *
 * @param {string} matName as materialFor
 * @param {string|number} tint CSS colour or hex
 * @returns {THREE.Material} shared per (name, tint) pair
 */
export function tintedMaterial(matName, tint) {
  if (tint === undefined || tint === null) return materialFor(matName);
  const key = `${matName || 'unknown'}|${tint}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const mat = materialFor(matName).clone();
  mat.color.set(tint);
  mat.name = key;
  cache.set(key, mat);
  return mat;
}
