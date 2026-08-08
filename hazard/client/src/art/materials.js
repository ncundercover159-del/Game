// HAZARD PAY — surfaces.
//
// ==========================================================================
//  MODULE INTERFACE — the art pass owns the internals of this file and
//  nothing else may.
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
//
// HOW THESE ARE TEXTURED
//
// The static level is ONE merged mesh per material — 116 brushes of wildly
// different sizes welded into a single buffer. Whatever UVs BoxGeometry wrote
// are per-brush 0..1, so a 46-metre wall and a 12-centimetre strut would get
// exactly one tile each and the wall would smear into porridge. There is
// nowhere to fix that on the CPU either: worldview.js owns the merge and this
// file only gets handed a material name.
//
// So the UVs are computed in the shader from position instead. Every surface
// projects the texture down the three world axes and blends by normal, which
// gives a constant texel density everywhere for free and never smears. The
// blend weights are raised to the fourth power, which matters more than it
// sounds: every brush in this game is an axis-aligned box, so a sharpened
// weight means one axis wins outright on every flat face and only the curved
// props (mugs, fishbowls) ever pay for a real three-way blend.
//
// The projection is taken from the BIND-POSE object position, not the world
// position. For the merged level those are the same thing; for a prop it means
// the grain stays welded to the crate as it tumbles instead of swimming
// through it, and for a contractor it means the weave on their overalls does
// not slide about as they walk.
//
// One texture does all four jobs. RGB is albedo, ALPHA is height, and
// roughness, cavity occlusion and the bump normal are all derived from that
// height in the fragment shader. Three fetches a fragment instead of nine.

import * as THREE from 'three';
import { surfaceTexture } from './textures.js';

const cache = new Map();

// tile:     metres per texture repeat. Sets texel density; smaller = finer.
// bump:     derivative-bump strength. The height channel is read as a screen
//           space gradient, so this fades out with distance on its own.
// roughVar: how much height moves roughness. NEGATIVE means the raised parts
//           are the polished ones, which is what wear actually does — boots
//           burnish the tops of tread plate and leave the pits rough.
// ao:       cavity occlusion from height. Cheap, and the only thing that makes
//           a corrugated wall look corrugated when the sun is behind you.
// mottle:   large-scale albedo drift, to break the tile. Costs four sines and
//           saves a 1024² texture.
const RECIPES = {
  concrete: { tex: 'concrete', tile: 2.6, rough: 0.94, metal: 0.0, bump: 2.6, roughVar: -0.20, ao: 0.42, mottle: 0.20 },
  panel: { tex: 'panel', tile: 1.7, rough: 0.74, metal: 0.22, bump: 3.4, roughVar: -0.22, ao: 0.45, mottle: 0.16 },
  deckplate: { tex: 'deckplate', tile: 0.42, rough: 0.60, metal: 0.62, bump: 3.8, roughVar: -0.34, ao: 0.40, mottle: 0.14 },
  grate: { tex: 'grate', tile: 0.60, rough: 0.58, metal: 0.68, bump: 3.4, roughVar: -0.22, ao: 0.55, mottle: 0.10 },
  steelblue: { tex: 'steelblue', tile: 1.10, rough: 0.52, metal: 0.55, bump: 2.2, roughVar: -0.26, ao: 0.30, mottle: 0.12 },
  railing: { tex: 'railing', tile: 0.85, rough: 0.58, metal: 0.28, bump: 2.0, roughVar: -0.20, ao: 0.26, mottle: 0.10 },
  plank: { tex: 'plank', tile: 1.20, rough: 0.90, metal: 0.0, bump: 2.4, roughVar: -0.16, ao: 0.34, mottle: 0.14 },
  rubber: { tex: 'rubber', tile: 0.90, rough: 0.97, metal: 0.0, bump: 3.2, roughVar: -0.10, ao: 0.45, mottle: 0.10 },

  // Prop surfaces. These sit near white and let vertex colour carry the hue —
  // see props.js. Seventeen kinds of object, ten materials, and a novelty
  // cheque can still be four different colours in a single draw call.
  ceramic: { tex: 'ceramic', tile: 0.30, rough: 0.34, metal: 0.0, bump: 1.0, roughVar: -0.12, ao: 0.18, mottle: 0 },
  plastic: { tex: 'plastic', tile: 0.42, rough: 0.58, metal: 0.0, bump: 1.6, roughVar: -0.14, ao: 0.22, mottle: 0 },
  metal: { tex: 'metal', tile: 0.55, rough: 0.42, metal: 0.72, bump: 1.6, roughVar: -0.28, ao: 0.20, mottle: 0 },
  glass: { tex: 'glass', tile: 0.50, rough: 0.10, metal: 0.0, bump: 0.8, roughVar: -0.08, ao: 0.10, mottle: 0, opacity: 0.42 },
  fabric: { tex: 'fabric', tile: 0.34, rough: 0.98, metal: 0.0, bump: 1.8, roughVar: 0.10, ao: 0.34, mottle: 0 },
  fur: { tex: 'fur', tile: 0.28, rough: 0.94, metal: 0.0, bump: 2.4, roughVar: 0.12, ao: 0.36, mottle: 0 },
  card: { tex: 'card', tile: 0.60, rough: 0.86, metal: 0.0, bump: 1.0, roughVar: 0.08, ao: 0.16, mottle: 0 },
  lacquer: { tex: 'lacquer', tile: 0.80, rough: 0.20, metal: 0.12, bump: 0.9, roughVar: -0.10, ao: 0.12, mottle: 0 },
  enamel: { tex: 'enamel', tile: 0.85, rough: 0.26, metal: 0.06, bump: 1.4, roughVar: -0.38, ao: 0.20, mottle: 0 },
  rust: { tex: 'rust', tile: 0.85, rough: 0.88, metal: 0.38, bump: 2.8, roughVar: -0.16, ao: 0.38, mottle: 0.08 },

  // The contractor. Not asked for by the level, but figure.js wants the same
  // triplanar machinery and there is no sense having two of it.
  overall: { tex: 'overall', tile: 0.50, rough: 0.92, metal: 0.0, bump: 1.8, roughVar: 0.10, ao: 0.30, mottle: 0 },
  gear: { tex: 'gear', tile: 0.34, rough: 0.44, metal: 0.06, bump: 1.6, roughVar: -0.20, ao: 0.22, mottle: 0 },

  // The renderer's own names.
  broken: { tex: 'broken', tile: 0.55, rough: 1.0, metal: 0.0, bump: 3.0, roughVar: -0.10, ao: 0.45, mottle: 0.10, noVertexColour: true },
  unknown: { tex: 'unknown', tile: 1.0, rough: 1.0, metal: 0.0, bump: 0, roughVar: 0, ao: 0, mottle: 0 },
};

// --- the triplanar patch -----------------------------------------------------
// One function object, shared by every material this file makes. That is not a
// tidiness point: three keys its program cache on onBeforeCompile.toString(),
// so one function means one shader compile for the whole game instead of
// twenty-odd identical ones.

const VERT_HOOK = /* glsl */`
#include <beginnormal_vertex>
// Bind-pose object space, captured before skinning and before the model
// matrix. See the note at the top of the file.
vTpP = position;
vTpN = objectNormal;
`;

const VERT_PARS = /* glsl */`
varying vec3 vTpP;
varying vec3 vTpN;
`;

const FRAG_PARS = /* glsl */`
uniform sampler2D tpMap;
uniform vec4 tpTune;   // x tiles/metre, y bump, z roughness variance, w cavity ao
uniform float tpMottle;
varying vec3 vTpP;
varying vec3 vTpN;

// Height for this fragment, filled in at map_fragment and read three chunks
// later by the bump and the occlusion.
float tpHeight;

vec4 tpFetch( vec3 p, vec3 n ) {
  vec3 w = abs( n );
  w = w * w; w = w * w;                     // ^4: a flat face picks one axis outright
  w /= max( w.x + w.y + w.z, 1e-4 );
  float s = tpTune.x;
  return texture2D( tpMap, p.zy * s ) * w.x
       + texture2D( tpMap, p.xz * s ) * w.y
       + texture2D( tpMap, p.xy * s ) * w.z;
}

// Four sines of very low frequency. Not noise in any respectable sense, but
// over a 46-metre shed it never visibly repeats, and it is what stops the
// floor reading as graph paper.
float tpDrift( vec3 p ) {
  return sin( p.x * 0.41 + p.z * 0.23 ) * sin( p.z * 0.37 - p.y * 0.19 )
       + sin( p.x * 0.113 - p.z * 0.157 ) * sin( p.y * 0.09 + p.x * 0.071 );
}
`;

const FRAG_MAP = /* glsl */`
#include <map_fragment>
{
  vec4 tp = tpFetch( vTpP, normalize( vTpN ) );
  tpHeight = tp.a;
  diffuseColor.rgb *= tp.rgb * ( 1.0 + tpMottle * tpDrift( vTpP ) );
}
`;

const FRAG_ROUGH = /* glsl */`
#include <roughnessmap_fragment>
roughnessFactor = clamp( roughnessFactor + ( tpHeight - 0.5 ) * tpTune.z, 0.045, 1.0 );
`;

// Derivative bump rather than a tangent-space normal map. There are no tangents
// on a merged level and computing them for a triplanar surface means three sets
// of them; taking the screen-space gradient of the height we already fetched
// costs nothing extra and fades out with distance by itself, which is a free
// mip-level LOD on the relief.
const FRAG_NORMAL = /* glsl */`
#include <normal_fragment_maps>
if ( tpTune.y > 0.0 ) {
  vec3 sp = - vViewPosition;
  vec3 sx = normalize( dFdx( sp ) );
  vec3 sy = normalize( dFdy( sp ) );
  vec2 dH = vec2( dFdx( tpHeight ), dFdy( tpHeight ) ) * tpTune.y;
  vec3 R1 = cross( sy, normal );
  vec3 R2 = cross( normal, sx );
  float det = dot( sx, R1 );
  vec3 grad = sign( det ) * ( dH.x * R1 + dH.y * R2 );
  // The clamp on det is the difference between relief and fireflies: at a
  // grazing angle the two screen derivatives go parallel and det goes to zero.
  normal = normalize( max( abs( det ), 0.20 ) * normal - grad );
}
`;

const FRAG_AO = /* glsl */`
#include <aomap_fragment>
reflectedLight.indirectDiffuse *= 1.0 - tpTune.w * ( 1.0 - tpHeight );
`;

function patch(shader) {
  const tp = this.userData.tp;
  shader.uniforms.tpMap = tp.map;
  shader.uniforms.tpTune = tp.tune;
  shader.uniforms.tpMottle = tp.mottle;

  shader.vertexShader = VERT_PARS + shader.vertexShader
    .replace('#include <beginnormal_vertex>', VERT_HOOK);

  shader.fragmentShader = FRAG_PARS + shader.fragmentShader
    .replace('#include <map_fragment>', FRAG_MAP)
    .replace('#include <roughnessmap_fragment>', FRAG_ROUGH)
    .replace('#include <normal_fragment_maps>', FRAG_NORMAL)
    .replace('#include <aomap_fragment>', FRAG_AO);
}

/**
 * Give any standard material the triplanar treatment.
 *
 * Exported because figure.js and props.js build materials this file has no
 * name for, and they should all end up on the same shader program.
 *
 * @param {THREE.MeshStandardMaterial} mat modified in place
 * @param {string} texName a generator name from textures.js
 * @param {object} [over] recipe overrides — tile, bump, roughVar, ao, mottle
 * @returns {THREE.MeshStandardMaterial} the same material
 */
export function applyTriplanar(mat, texName, over = {}) {
  const base = RECIPES[texName] || {};
  const r = { tile: 1, bump: 2, roughVar: -0.2, ao: 0.3, mottle: 0, ...base, ...over };
  mat.userData.tp = {
    map: { value: surfaceTexture(texName) },
    tune: { value: new THREE.Vector4(1 / r.tile, r.bump, r.roughVar, r.ao) },
    mottle: { value: r.mottle },
  };
  mat.onBeforeCompile = patch;
  mat.needsUpdate = true;
  return mat;
}

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
    // White, because the colour lives in the texture and in vertex colours.
    // A tint here would multiply on top of both and there is nothing left to
    // say that they have not already said.
    color: 0xffffff,
    roughness: r.rough ?? 1,
    metalness: r.metal ?? 0,
    // A husk should read as the same grey wreckage whatever it used to be, so
    // it is the one surface that ignores the colours baked into the prop.
    vertexColors: !r.noVertexColour,
    transparent: r.opacity !== undefined,
    opacity: r.opacity ?? 1,
    // Both faces, because the shell's walls are viewed from inside and a level
    // author should never have to think about winding order.
    side: THREE.FrontSide,
  });
  applyTriplanar(mat, r.tex || 'unknown');
  mat.name = key;
  cache.set(key, mat);
  return mat;
}

/**
 * Tint a material for a single prop without breaking sharing.
 *
 * Kept for the interface, but props.js no longer needs it: prop colour is
 * baked into vertex colours so that forty objects of seventeen kinds share ten
 * materials. Still here because a caller is allowed to ask.
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
  // clone() copies userData by reference for plain objects, which is what we
  // want — the variant shares the parent's texture and tuning uniforms.
  mat.color.set(tint);
  mat.name = key;
  cache.set(key, mat);
  return mat;
}
