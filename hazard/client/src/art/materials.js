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
// fill:     bounce floor — see FRAG_AO. THE OTHER MOST IMPORTANT NUMBER HERE.
//           A measured frame had 64% of its pixels sitting flat, dark and blue,
//           and the black-point lift in post could only change the colour of
//           that emptiness, never put anything in it. This is what puts
//           something in it, and it must be paid per material because a
//           concrete floor bounces and a black lacquered piano does not.
// env:      envMapIntensity. The environment map is a bright studio room and
//           its job here is highlights, not illumination; a large architectural
//           metal at full strength turns into a mirror of a room that is not
//           there, which is what blew the near wall out to 144 grey.
// TILE IS IN METRES AND IT IS THE MOST IMPORTANT NUMBER IN THIS FILE. The
// projection is world-scaled, so `tile: 3.2` means one copy of the map covers
// 3.2 m of any surface it lands on, everywhere, regardless of brush size. Get
// it wrong small and every material turns into a fine screen of dots that reads
// as noise at any distance; get it wrong large and a wall looks like a photo of
// a wall pasted onto a wall. Two checks, both of which must pass: stand at 2 m
// and the motif should be obviously the thing it is meant to be, and stand at
// 20 m and it should still be resolvable rather than a grey wash.
const RECIPES = {
  // The eight architectural surfaces. Their tiles all went UP by about half
  // over the first pass: a measured feature size of 4-5 px against a reference
  // that runs 8-27 is not "detailed", it is a screen of dots, and post makes it
  // worse because every pass in the chain is another low-pass filter that the
  // eye reads as more noise rather than less.
  // AND THEN EVERY ARCHITECTURAL FILL CAME DOWN BY A THIRD, WHICH IS THE
  // LIGHTING DESIGN.
  //
  // Worth doing the arithmetic, because it is not close. On concrete the bounce
  // floor was contributing 0.062 to reflected diffuse while the level's own
  // hemisphere light contributed 0.010 — this term was not supplementing the
  // ambient, it WAS the ambient, at six times the strength of the one the level
  // author wrote. A lamp directly overhead adds 0.226 and a patch of floor
  // fourteen metres from any lamp adds 0.033, so the ratio between lit floor and
  // unlit floor was 3.0:1 before the tone curve and about 1.3:1 after it. A
  // review measured 1.01-1.40:1 against a rubric floor of 2:1 and R.E.P.O.
  // running 3.2:1 to 11.6:1, and called it the reason the build does not look
  // like the references. It was right, and this file is where it came from.
  //
  // At a third less the same pair goes to about 3.9:1 linear. That is still not
  // R.E.P.O. — the lamps would have to get brighter and further apart for that,
  // and lamp intensity is level data, not mine — but it is the difference
  // between a room with light in it and a room with an exposure setting.
  //
  // The floor stays deliberately non-zero and the reason is one line further
  // down the file: what this puts back into the dark is TEXTURED and TINTED, so
  // a crate in an unlit corner still shows a top, a side and its own grain. The
  // failure mode being avoided is not darkness, it is emptiness.
  concrete: { tex: 'concrete', tile: 5.6, rough: 0.94, metal: 0.0, bump: 1.05, roughVar: -0.20, ao: 0.42, mottle: 0.16, fill: 0.235 },
  panel: { tex: 'panel', tile: 4.6, rough: 0.80, metal: 0.10, bump: 2.1, roughVar: -0.20, ao: 0.46, mottle: 0.13, fill: 0.205, env: 0.35 },
  // Fifteen hundred square metres of ceiling, and every number here is set by
  // that. The tile went 4.0 -> 5.5 so the deck's two ribs sit at a 2.75 m
  // pitch: see textures.js, where an A/B against the shipped material proved
  // the rosettes around the lamps were albedo minification and not, as three
  // rounds of tuning had assumed, the specular. The relief can come back UP as
  // a result — height was never the problem and a roof with no bump at all
  // reads as painted card.
  // fill stays LOW here despite the ceiling being the thing it was meant to
  // rescue. The bounce term weights down-facing surfaces at 1.30, so a ceiling
  // gets the most of it of anything in the level, and at 0.36 the roof came out
  // brighter than the floor it is supposedly bouncing off. A ceiling is allowed
  // to be the dimmest large surface in a shed; it is not allowed to be empty,
  // and the ribs are what stop it being empty now.
  // env comes DOWN to almost nothing. The environment map is a bright studio
  // room, so any surface that reflects it at all reflects a pale blue-white
  // that is not in the level — and this surface is the ceiling, which is where
  // a review found "an overcast sky" in a shed with no windows. A sooty roof
  // deck reflects essentially nothing. bump comes UP to carry the flutes and
  // the spangle that textures.js now puts in the height channel for the ramp
  // and the dock; at four degrees the graze fade removes all of it anyway, so
  // this number is paid by the near field and not by the ceiling.
  deckplate: { tex: 'deckplate', tile: 5.5, rough: 0.93, metal: 0.05, bump: 1.5, roughVar: -0.14, ao: 0.38, mottle: 0.10, fill: 0.175, env: 0.08 },
  grate: { tex: 'grate', tile: 0.88, rough: 0.62, metal: 0.60, bump: 2.2, roughVar: -0.22, ao: 0.55, mottle: 0.08, fill: 0.155, env: 0.55 },
  // env DOWN from 0.5. Three hundred metres of rack upright is the second
  // largest painted area in the game and a review found it reading as glitter
  // rather than as painted steel. That is not the texture — the chips and
  // scuffs in it are all centimetre-scale or larger — it is a 12 cm box section
  // at twenty metres catching a prefiltered studio reflection on a bumped
  // normal, which is a specular that changes completely from one pixel to the
  // next. Enamel over pressed steel is nearly matte; the highlight it is
  // entitled to comes from the lamps, not from a room that is not there.
  steelblue: { tex: 'steelblue', tile: 1.75, rough: 0.72, metal: 0.22, bump: 1.5, roughVar: -0.22, ao: 0.30, mottle: 0.11, fill: 0.235, env: 0.22 },
  railing: { tex: 'railing', tile: 1.05, rough: 0.62, metal: 0.22, bump: 1.8, roughVar: -0.20, ao: 0.26, mottle: 0.10, fill: 0.225 },
  plank: { tex: 'plank', tile: 1.55, rough: 0.90, metal: 0.0, bump: 2.0, roughVar: -0.16, ao: 0.34, mottle: 0.13, fill: 0.225 },
  rubber: { tex: 'rubber', tile: 1.15, rough: 0.97, metal: 0.0, bump: 2.2, roughVar: -0.10, ao: 0.45, mottle: 0.08, fill: 0.14 },

  // Prop surfaces. These sit near white and let vertex colour carry the hue —
  // see props.js. Seventeen kinds of object, ten materials, and a novelty
  // cheque can still be four different colours in a single draw call.
  ceramic: { tex: 'ceramic', tile: 0.30, rough: 0.34, metal: 0.0, bump: 1.0, roughVar: -0.12, ao: 0.18, mottle: 0, fill: 0.30 },
  plastic: { tex: 'plastic', tile: 0.42, rough: 0.58, metal: 0.0, bump: 1.6, roughVar: -0.14, ao: 0.22, mottle: 0, fill: 0.30 },
  metal: { tex: 'metal', tile: 0.55, rough: 0.42, metal: 0.66, bump: 1.6, roughVar: -0.28, ao: 0.20, mottle: 0, fill: 0.26, env: 0.8 },
  glass: { tex: 'glass', tile: 0.50, rough: 0.10, metal: 0.0, bump: 0.8, roughVar: -0.08, ao: 0.10, mottle: 0, opacity: 0.42, fill: 0.45, env: 1.4 },
  fabric: { tex: 'fabric', tile: 0.34, rough: 0.98, metal: 0.0, bump: 1.8, roughVar: 0.10, ao: 0.34, mottle: 0, fill: 0.30 },
  fur: { tex: 'fur', tile: 0.28, rough: 0.94, metal: 0.0, bump: 2.4, roughVar: 0.12, ao: 0.36, mottle: 0, fill: 0.30 },
  card: { tex: 'card', tile: 0.60, rough: 0.86, metal: 0.0, bump: 1.0, roughVar: 0.08, ao: 0.16, mottle: 0, fill: 0.30 },
  // THE OTHER HALF OF THE NAVY MONOLITH FIX; see the note in post.js.
  //
  // env 1.3 on a near-black surface at roughness 0.20 is a mirror, and what it
  // was mirroring was a prefiltered studio room — pale, blue and nowhere in
  // this level. The piano is only ever seen in a dim shed, so what it should
  // return is a tight highlight off the lamp that is actually there, not a
  // broad blue-grey sheen off one that is not. Roughness up a touch as well:
  // 0.20 is a concert grand under gallery lights, and this thing has been in a
  // warehouse in Crayford. fill down from 0.55 — the highest figure in the file
  // and plainly wrong for black lacquer, which bounces nothing.
  lacquer: { tex: 'lacquer', tile: 0.80, rough: 0.28, metal: 0.10, bump: 0.9, roughVar: -0.10, ao: 0.12, mottle: 0, fill: 0.26, env: 0.45 },
  enamel: { tex: 'enamel', tile: 0.85, rough: 0.26, metal: 0.06, bump: 1.4, roughVar: -0.38, ao: 0.20, mottle: 0, fill: 0.30, env: 1.1 },
  rust: { tex: 'rust', tile: 0.85, rough: 0.88, metal: 0.38, bump: 2.6, roughVar: -0.16, ao: 0.38, mottle: 0.08, fill: 0.28 },

  // The contractor. Not asked for by the level, but figure.js wants the same
  // triplanar machinery and there is no sense having two of it. Their fill runs
  // high on purpose: a player who walks into an unlit corner and vanishes is a
  // gameplay bug, not a lighting choice.
  overall: { tex: 'overall', tile: 0.50, rough: 0.92, metal: 0.0, bump: 1.8, roughVar: 0.10, ao: 0.30, mottle: 0, fill: 0.38 },
  gear: { tex: 'gear', tile: 0.34, rough: 0.44, metal: 0.06, bump: 1.6, roughVar: -0.20, ao: 0.22, mottle: 0, fill: 0.38 },
  skin: { tex: 'skin', tile: 0.26, rough: 0.66, metal: 0.0, bump: 1.1, roughVar: 0.06, ao: 0.20, mottle: 0, fill: 0.40 },

  // The renderer's own names.
  broken: { tex: 'broken', tile: 0.55, rough: 1.0, metal: 0.0, bump: 3.0, roughVar: -0.10, ao: 0.45, mottle: 0.10, fill: 0.28, noVertexColour: true },
  unknown: { tex: 'unknown', tile: 1.0, rough: 1.0, metal: 0.0, bump: 0, roughVar: 0, ao: 0, mottle: 0, fill: 0.1 },
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
uniform float tpFill;
uniform float tpDark;  // bounce left in a corner no lamp reaches
uniform float tpKnee;  // how fast the bounce saturates with direct light
uniform vec2 tpPenumbra; // shadow filter radius in texels: x plane maps, y cube
varying vec3 vTpP;
varying vec3 vTpN;

// A twelve-point sunflower disc, radius 1, used by both shadow filters below.
// Unrolled at the call site rather than looped over a const array: three
// rewrites these shaders on the way to GLSL ES 3.00 and the fewer language
// features that rewrite has to survive, the better.
#define HZ_DISC_0  vec2(  0.2041,  0.0000 )
#define HZ_DISC_1  vec2( -0.2607,  0.2389 )
#define HZ_DISC_2  vec2(  0.0399, -0.4547 )
#define HZ_DISC_3  vec2(  0.3288,  0.4285 )
#define HZ_DISC_4  vec2( -0.6030, -0.1067 )
#define HZ_DISC_5  vec2(  0.5712, -0.3634 )
#define HZ_DISC_6  vec2( -0.1911,  0.7108 )
#define HZ_DISC_7  vec2( -0.3633, -0.7022 )
#define HZ_DISC_8  vec2(  0.7904,  0.2891 )
#define HZ_DISC_9  vec2( -0.8230,  0.3381 )
#define HZ_DISC_10 vec2(  0.3964, -0.8473 )
#define HZ_DISC_11 vec2(  0.2885,  0.9355 )

// Height for this fragment, filled in at map_fragment and read three chunks
// later by the bump and the occlusion.
float tpHeight;

// Four sines of very low frequency. Not noise in any respectable sense, but
// over a 46-metre shed it never visibly repeats, and it is what stops the
// floor reading as graph paper.
float tpDrift( vec3 p ) {
  return sin( p.x * 0.41 + p.z * 0.23 ) * sin( p.z * 0.37 - p.y * 0.19 )
       + sin( p.x * 0.113 - p.z * 0.157 ) * sin( p.y * 0.09 + p.x * 0.071 );
}

vec4 tpFetch( vec3 p, vec3 n ) {
  vec3 w = abs( n );
  w = w * w; w = w * w;                     // ^4: a flat face picks one axis outright
  w /= max( w.x + w.y + w.z, 1e-4 );
  float s = tpTune.x;

  // Bend the tile lattice. A perfectly regular grid of repeats is the thing the
  // eye is best in the world at spotting, and a forty-six metre wall showing
  // fourteen copies of the same rust patch in a dead-straight line is the whole
  // reason people think procedural texturing looks cheap. Displacing the sample
  // by a very low-frequency offset — a fifth of a tile over about fifteen
  // metres — leaves the texture undistorted at any scale you can perceive but
  // puts the repeats out of step with each other, and the grid disappears.
  // Two sine pairs, not a second texture fetch.
  vec2 wob = vec2( tpDrift( p * 0.30 ), tpDrift( p * 0.27 + 9.0 ) ) * 0.22;

  return texture2D( tpMap, p.zy * s + wob ) * w.x
       + texture2D( tpMap, p.xz * s + wob ) * w.y
       + texture2D( tpMap, p.xy * s + wob ) * w.z;
}
`;

const FRAG_MAP = /* glsl */`
#include <map_fragment>
{
  vec4 tp = tpFetch( vTpP, normalize( vTpN ) );
  tpHeight = tp.a;
  // Value drift and HUE drift, at different frequencies. The value drift breaks
  // the tile; the hue drift is doing something else entirely — a graded review
  // counted two colour families in a frame and called it a duotone, and a warm
  // patch of floor next to a cool one is the cheapest colour a scene can own.
  // Both are low frequency by construction, so neither costs any of the smooth
  // area the eye needs somewhere to rest.
  float drift = tpDrift( vTpP );
  vec3 warm = vec3( 1.0 ) + tpMottle * 0.85 * tpDrift( vTpP * 0.36 + 4.0 ) * vec3( 0.55, 0.02, -0.48 );
  diffuseColor.rgb *= tp.rgb * ( 1.0 + tpMottle * drift ) * warm;
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
  vec3 dpx = dFdx( sp );
  vec3 dpy = dFdy( sp );
  // normalize() of a zero-length derivative is a NaN, and a NaN normal is a
  // white pixel. On a wall seen edge-on that happens along the whole silhouette,
  // which is what put snow in the corners of the first render.
  vec3 sx = dpx / max( length( dpx ), 1e-7 );
  vec3 sy = dpy / max( length( dpy ), 1e-7 );
  // Fade the relief out as the surface turns edge-on. A forty-metre ceiling of
  // tread plate is seen at maybe five degrees, one texel spans a dozen pixels,
  // and the height gradient there is noise — left alone it sparkles like tinsel.
  // Physically this is also just true: you cannot resolve relief you cannot see.
  float graze = smoothstep( 0.10, 0.44, abs( dot( normal, normalize( - sp ) ) ) );
  // Clamped, because a mip transition can put a whole texel's worth of height
  // change into one pixel and tip the normal past the horizon.
  vec2 dH = clamp( vec2( dFdx( tpHeight ), dFdy( tpHeight ) ) * tpTune.y * graze, -0.45, 0.45 );
  vec3 R1 = cross( sy, normal );
  vec3 R2 = cross( normal, sx );
  float det = dot( sx, R1 );
  vec3 grad = sign( det ) * ( dH.x * R1 + dH.y * R2 );
  // The floor on det matters for the same reason: at a grazing angle the two
  // screen derivatives go parallel and the determinant collapses.
  normal = normalize( max( abs( det ), 0.25 ) * normal - grad );

  // Specular anti-aliasing. Half this level is painted steel with a metalness
  // over a half, and a bumped normal that swings hard inside one pixel throws a
  // highlight for a single frame and then loses it — white confetti along every
  // rack upright. A normal that varies fast across a pixel IS a rougher surface
  // at that scale, so say so.
  vec3 dnx = dFdx( normal ), dny = dFdy( normal );
  float wobble = max( dot( dnx, dnx ), dot( dny, dny ) );
  roughnessFactor = min( 1.0, sqrt( roughnessFactor * roughnessFactor + wobble * 0.7 ) );
}
`;

// Cavity occlusion, and then the bounce floor.
//
// THE BOUNCE FLOOR IS THE FIX FOR THE NAVY. A measured frame had sixty-four per
// cent of its pixels flat, dark and blue — one indigo slab covering the
// ceiling, the far racking and the crate two metres in front of the camera. The
// instinct is to reach for the black-point lift in the grade, and that is
// exactly wrong: a lift changes the COLOUR of emptiness and cannot add anything
// to look at, so the frame goes from a black hole to a blue hole. The hole is
// the problem.
//
// So: every surface gets a fraction of its own albedo back as light. It is a
// cheat for the second and third light bounce that a real shed full of pale
// concrete genuinely has and that a direct-lighting renderer simply does not
// compute. What makes it work rather than merely brighten is that it is
// TEXTURED and TINTED — what appears out of the dark is concrete-coloured
// concrete with its own grain and its own cavity shading, so the eye gets
// material back, not fog.
//
// Weighted by world-facing: a warehouse bounces off its floor and its pale
// ceiling, so up- and down-facing surfaces catch more of it than a wall does,
// and that alone gives every box in the dark a top, a side and a bottom. The
// world normal is recovered by multiplying the view normal through viewMatrix
// from the left, which for a rotation is its inverse and costs no uniform.
//
// AND IT IS COUPLED TO THE DIRECT LIGHT, WHICH IS THE WHOLE LIGHTING DESIGN.
//
// The version above was a constant, and a constant is not a bounce — it is an
// ambient term wearing a bounce's clothes. Measured with every light in the
// scene switched off, the open floor still read 0.29 while the four bay lamps
// were only worth 0.14 of it: this term was twice the entire lighting rig, and
// it was strongest precisely where it should be weakest, so key-to-fill on
// same-material floor came out at 1.6:1 against a 2:1 rubric floor.
//
// Second-bounce light is proportional to first-bounce light. A corner no lamp
// reaches has nothing to bounce and should stay dark; the floor under a lamp
// is throwing light at everything near it and should get the full term. So the
// bounce is now gated on the direct diffuse this fragment already received —
// available here for free because three runs lights_fragment_end before
// aomap_fragment, so the accumulation is complete by the time we read it.
//
// The gate keeps a FLOOR of tpDark, and that floor is the thing that must not
// go to zero. The failure being avoided has never been darkness, it is
// emptiness: what this puts into the dark is textured, tinted, cavity-shaded
// concrete, so an unlit crate still shows a top, a side and its own grain
// rather than becoming a hole for the grade to paint navy over.
const FRAG_AO = /* glsl */`
#include <aomap_fragment>
float tpCav = 1.0 - tpTune.w * ( 1.0 - tpHeight );
reflectedLight.indirectDiffuse *= tpCav;
if ( tpFill > 0.0 ) {
  vec3 tpW = normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
  float tpUp = abs( tpW.y );
  // Saturating, not linear: the response has to flatten out or the floor
  // directly beneath a 1156 cd lamp gets a second sun stacked on top of it.
  float tpLit = dot( reflectedLight.directDiffuse, vec3( 0.2126, 0.7152, 0.0722 ) );
  float tpGate = mix( tpDark, 1.0, 1.0 - exp( -tpLit * tpKnee ) );
  reflectedLight.indirectDiffuse += diffuseColor.rgb * tpFill * tpGate * mix( 0.62, 1.30, tpUp ) * tpCav;
}
`;

// --- the penumbra ------------------------------------------------------------
//
// THREE'S "PCF SOFT" IS A ONE-TEXEL TENT, AND A ONE-TEXEL TENT IS NOT A SHADOW.
//
// A review called the shadows in this build hard-edged with no penumbra and it
// was describing the filter, not the maps. Both stock paths sample a fixed
// neighbourhood one texel across: the plane path a 3x3 bilinear tent, the cube
// path the eight corners of a unit cube around the sample direction. On the one
// lamp in this level that casts — a 512 cube over a 20 m reach, so about eight
// centimetres a texel at the far edge — that is a transition roughly one
// centimetre wide. Nothing in a warehouse casts a shadow one centimetre wide.
// A four-metre bay lamp two metres from a crate throws a penumbra you can put
// your hand in, and the absence of one is most of why the props read as stuck
// onto the floor rather than standing on it.
//
// So both paths get a twelve-tap sunflower disc instead, at a radius set in
// texels. The tap count barely moves — twelve against nine and seventeen — and
// the disc is what buys the gradient: a tent over one texel can only produce as
// many distinct values as it has taps within one texel of the edge, which is
// why the stock filter reads as a hard line with a single grey pixel on it.
//
// The cube path also gets a real tangent basis. The stock offsets are the
// corners of an axis-aligned cube added to the sample DIRECTION, so their
// effective radius depends on which way the fragment happens to lie from the
// lamp — a filter that is wider in some directions than others, which is a
// second reason the same shadow can look hard on one wall and soft on the next.
// One cross product and a normalize fixes it and nobody will find the cost.
//
// This is done by rewriting three's own chunk rather than by hand-rolling the
// whole shadow path, because everything else in that chunk — the cube face
// mapping, the bias handling, the intensity mix — is fiddly, version-specific
// and correct. If either marker ever stops matching, the const below comes back
// null and patch() leaves the include alone: the shadows go back to being hard,
// which is a regression in the art and not a black screen.
const SOFT_SHADOW = (() => {
  const src = THREE.ShaderChunk.shadowmap_pars_fragment;
  if (typeof src !== 'string') return null;

  const disc = (fn) => Array.from({ length: 12 }, (_, i) => fn(`HZ_DISC_${i}`)).join(' +\n\t\t\t\t');

  // --- plane maps: directional and spot ---
  const planeAt = src.indexOf('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )');
  const planeEnd = src.indexOf('#elif defined( SHADOWMAP_TYPE_VSM )', planeAt);
  if (planeAt < 0 || planeEnd < 0) return null;
  const plane = `#elif defined( SHADOWMAP_TYPE_PCF_SOFT )

			vec2 hzStep = tpPenumbra.x / shadowMapSize;
			shadow = (
				${disc((d) => `texture2DCompare( shadowMap, shadowCoord.xy + ${d} * hzStep, shadowCoord.z )`)}
			) * ( 1.0 / 12.0 );

		`;

  const withPlane = src.slice(0, planeAt) + plane + src.slice(planeEnd);

  // --- cube maps: point lights ---
  // The whole stock nine-tap expression, start to terminator, replaced in one
  // piece. Matching on both ends rather than editing the offset line means a
  // three release that reshapes this block fails the match and falls back
  // instead of splicing a disc into an expression that no longer expects one.
  const cubeAt = withPlane.indexOf('vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;');
  const tail = ') * ( 1.0 / 9.0 );';
  const cubeEnd = withPlane.indexOf(tail, cubeAt);
  if (cubeAt < 0 || cubeEnd < 0) return null;
  // A basis perpendicular to the sample direction. Straight up is the
  // degenerate axis for a lamp directly overhead, which in a warehouse is every
  // lamp, so the fallback matters rather than being defensive boilerplate.
  const cube = `vec3 hzUp = abs( bd3D.y ) < 0.99 ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
				vec3 hzU = normalize( cross( bd3D, hzUp ) );
				vec3 hzV = cross( bd3D, hzU );
				float hzR = shadowRadius * texelSize.y * tpPenumbra.y;

				shadow = (
					${disc((d) => `texture2DCompare( shadowMap, cubeToUV( bd3D + ( hzU * ${d}.x + hzV * ${d}.y ) * hzR, texelSize.y ), dp )`)}
				) * ( 1.0 / 12.0 );`;

  return withPlane.slice(0, cubeAt) + cube + withPlane.slice(cubeEnd + tail.length);
})();

// The two bounce-gate knobs are ONE pair of uniform objects shared by every
// material in the level, not a copy each. Two reasons: the gate is a property
// of the room's lighting rather than of any one surface, and a harness that
// wants to sweep it can assign into `BOUNCE.dark.value` once instead of walking
// the scene graph — which is how these were tuned, in a single browser session
// rather than one four-minute rebuild per candidate value.
// Swept live against key-to-fill and against the pictures. dark 0.30 measured
// beautifully — 12:1, deep inside the reference band — and looked like a black
// void with one lit box in it, which is the same lesson the luma band teaches
// in the other direction. 0.80 keeps material in the unlit half of the room
// and still leaves the lamps a job to do.
export const BOUNCE = {
  dark: { value: 0.80 },
  knee: { value: 2.5 },
};

// Penumbra radius in shadow texels — x for plane maps, y for cube maps. Shared
// by reference for the same reason BOUNCE is: it is a property of the room's
// lighting, and a probe that can only reach one material still needs to move
// all of them.
//
// The two numbers are different because the maps are. The sun's 2048 map covers
// a 60 m frustum, so a texel is under three centimetres and 2.2 of them is a
// 6 cm softening — deliberately restrained, because a wide filter on a plane map
// walks straight past the 3.5 cm normal bias and comes back as acne on anything
// lit at a slant. The casting lamp's 512 cube spans its whole 20 m reach, so a
// texel out at the floor is nearer eight centimetres and four of them is a
// third of a metre of penumbra under a crate, which is about what a four-metre
// bay lamp actually throws.
export const PENUMBRA = { value: new THREE.Vector2(2.2, 4.0) };

function patch(shader) {
  const tp = this.userData.tp;
  shader.uniforms.tpMap = tp.map;
  shader.uniforms.tpTune = tp.tune;
  shader.uniforms.tpMottle = tp.mottle;
  shader.uniforms.tpFill = tp.fill;
  shader.uniforms.tpDark = BOUNCE.dark;
  shader.uniforms.tpKnee = BOUNCE.knee;
  shader.uniforms.tpPenumbra = PENUMBRA;

  shader.vertexShader = VERT_PARS + shader.vertexShader
    .replace('#include <beginnormal_vertex>', VERT_HOOK);

  shader.fragmentShader = FRAG_PARS + shader.fragmentShader
    .replace('#include <map_fragment>', FRAG_MAP)
    .replace('#include <roughnessmap_fragment>', FRAG_ROUGH)
    .replace('#include <normal_fragment_maps>', FRAG_NORMAL)
    .replace('#include <aomap_fragment>', FRAG_AO);

  // The shadow filter, if the surgery above found its landmarks. Substituting
  // the resolved chunk for its own include is safe: three resolves includes
  // AFTER onBeforeCompile, and recursively, so text that has already been
  // resolved simply passes through.
  if (SOFT_SHADOW) {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <shadowmap_pars_fragment>', SOFT_SHADOW);
  }
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
  const r = { tile: 1, bump: 2, roughVar: -0.2, ao: 0.3, mottle: 0, fill: 0.12, env: 1, ...base, ...over };
  mat.userData.tp = {
    map: { value: surfaceTexture(texName) },
    tune: { value: new THREE.Vector4(1 / r.tile, r.bump, r.roughVar, r.ao) },
    mottle: { value: r.mottle },
    fill: { value: r.fill },
    // The shared knobs, by reference, so a probe that reaches any one material
    // through the scene graph can move them for the whole level at once.
    dark: BOUNCE.dark,
    knee: BOUNCE.knee,
    penumbra: PENUMBRA,
  };
  mat.envMapIntensity = r.env;
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
 * Built from scratch rather than cloned on purpose. Material.copy() runs
 * userData through JSON, which would turn the shared texture and the tuning
 * vector into anonymous objects and leave the variant untextured.
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

  const base = materialFor(matName);
  const r = RECIPES[matName] || RECIPES.unknown;
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(tint),
    roughness: base.roughness,
    metalness: base.metalness,
    vertexColors: base.vertexColors,
    transparent: base.transparent,
    opacity: base.opacity,
    side: base.side,
  });
  applyTriplanar(mat, r.tex || 'unknown');
  mat.name = key;
  cache.set(key, mat);
  return mat;
}
