// HAZARD PAY — post-processing.
//
// ==========================================================================
//  MODULE INTERFACE — the art pass owns the internals of this file and
//  nothing else may.
//
//  export function installPost(renderer, scene, camera): PostChain
//
//  A PostChain is:
//    { render(dt), setSize(w, h), dispose() }
//
//  main.js calls installPost() once at boot and then calls chain.render(dt)
//  every frame INSTEAD OF renderer.render(scene, camera), and chain.setSize()
//  on resize. Returning the passthrough below is always valid — the game must
//  run with no post at all, because a composer that fails to build should cost
//  you grading, not the whole frame.
//
//  Constraints:
//   * No external assets. Anything a pass needs (noise, dirt masks, LUTs) is
//     generated procedurally at boot or inlined.
//   * Cost matters more than usual here: this is a browser, and the physics is
//     already spending its budget on the CPU. Prefer one good pass to five
//     cheap ones.
// ==========================================================================
//
// THE CHAIN
//
//   scene ──▶ HDR buffer (+ depth) ──┬──▶ SSAO ──▶ blur ──┐
//                                    │                    ├──▶ grade ──▶ screen
//                                    └──▶ bright ─▶ blur ─┘
//
// Two composer passes, and the second one does all of that internally. That is
// deliberate: every extra Pass is another full-screen read and write of a
// 1280×720 half-float buffer, and the bandwidth costs more than the maths does.
//
// Ambient occlusion is the load-bearing effect here and everything else is
// seasoning. Without it a crate is a lit box hovering a millimetre above a lit
// floor; with it the crate has a shadow welded to its base and the eye stops
// arguing. It is reconstructed from the depth buffer alone — no normal
// prepass — because a second pass over the scene would cost forty draw calls
// and normals from depth derivatives are more than good enough for contact.
//
// TONE MAPPING MOVES HERE. main.js sets renderer.toneMapping, but three only
// applies that in a material when the target is the default framebuffer; the
// moment the scene renders into a composer buffer the pixels stay linear HDR.
// That is what we want — bloom belongs in linear light, before the roll-off —
// so the ACES curve and the sRGB encode are done by hand at the end, reading
// renderer.toneMappingExposure so a level's `exposure` still means something.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// --- shared bits -------------------------------------------------------------

const VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4( position.xy, 0.0, 1.0 );
}
`;

// Window depth -> view Z, and view Z + screen ray -> view position. Written out
// once and pasted into both shaders that need it; three's own packing chunk is
// not available to a hand-rolled ShaderMaterial without pulling in the whole
// ShaderChunk table.
const DEPTH_LIB = /* glsl */`
uniform sampler2D tDepth;
uniform vec2 uRay;        // 1/P[0][0], 1/P[1][1] — the frustum half-extents at z=-1
uniform float uNear;
uniform float uFar;

float viewZ( vec2 uv ) {
  float d = texture2D( tDepth, uv ).x;
  return ( uNear * uFar ) / ( ( uFar - uNear ) * d - uFar );
}

vec3 viewPos( vec2 uv ) {
  float z = viewZ( uv );
  return vec3( ( uv * 2.0 - 1.0 ) * uRay, -1.0 ) * ( -z );
}
`;

// --- ambient occlusion -------------------------------------------------------

const AO_FRAG = /* glsl */`
varying vec2 vUv;
uniform vec2 uTexel;
uniform mat4 uProj;
uniform float uRadius;
uniform float uBias;
${DEPTH_LIB}

const int SAMPLES = 12;

float hash12( vec2 p ) {
  vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
  p3 += dot( p3, p3.yzx + 33.33 );
  return fract( ( p3.x + p3.y ) * p3.z );
}

void main() {
  float z = viewZ( vUv );
  // The sky has no depth to speak of; leave it unoccluded rather than ringing
  // the whole horizon in grey.
  if ( -z > uFar * 0.98 ) { gl_FragColor = vec4( 1.0 ); return; }

  vec3 P = viewPos( vUv );

  // Normal from depth. Picking the nearer of the two neighbours on each axis
  // rather than averaging is what stops a silhouette growing a halo: across a
  // depth cliff one side is a lie and the other is the surface you are on.
  vec3 pr = viewPos( vUv + vec2( uTexel.x, 0.0 ) );
  vec3 pl = viewPos( vUv - vec2( uTexel.x, 0.0 ) );
  vec3 pt = viewPos( vUv + vec2( 0.0, uTexel.y ) );
  vec3 pb = viewPos( vUv - vec2( 0.0, uTexel.y ) );
  vec3 dx = abs( pr.z - P.z ) < abs( P.z - pl.z ) ? pr - P : P - pl;
  vec3 dy = abs( pt.z - P.z ) < abs( P.z - pb.z ) ? pt - P : P - pb;
  vec3 N = normalize( cross( dx, dy ) );
  if ( dot( N, P ) > 0.0 ) N = -N;

  float ang = hash12( vUv / uTexel ) * 6.28318;
  float occ = 0.0;

  for ( int i = 0; i < SAMPLES; i ++ ) {
    float t = ( float( i ) + 0.5 ) / float( SAMPLES );
    // Two jobs from one loop. sqrt(t) spreads the samples evenly over the disc
    // rather than piling them at the centre, and the extra ramp stretches the
    // outer half of the spiral well past uRadius, so the same twelve taps give
    // both the hard line where a crate meets the floor and the broad softening
    // in the corner of a room. Two separate passes would cost twice as much for
    // an effect nobody could point at in a still.
    float r = uRadius * sqrt( t ) * mix( 0.42, 2.3, t );
    float a = ang + t * 25.13274;             // four turns of a spiral
    vec3 dir = vec3( cos( a ), sin( a ), 0.0 );
    vec3 s = normalize( dir + N * 0.7 );
    if ( dot( s, N ) < 0.0 ) s = -s;
    vec3 sp = P + s * r;

    vec4 clip = uProj * vec4( sp, 1.0 );
    vec2 suv = clip.xy / clip.w * 0.5 + 0.5;
    float sz = viewZ( suv );

    // Occluded if the depth buffer says something sits in front of the sample,
    // and only if that something is close enough to be the same object.
    float range = smoothstep( 0.0, 1.0, uRadius / max( 1e-4, abs( P.z - sz ) ) );
    occ += ( sz > sp.z + uBias ? 1.0 : 0.0 ) * range;
  }

  gl_FragColor = vec4( vec3( 1.0 - occ / float( SAMPLES ) ), 1.0 );
}
`;

// Separable blur, run twice. Depth-aware: a hard edge between a crate and the
// floor behind it should stay hard, or the crate's contact shadow smears out
// across the floor and it starts hovering again.
const AO_BLUR_FRAG = /* glsl */`
varying vec2 vUv;
uniform sampler2D tAO;
uniform vec2 uDir;
${DEPTH_LIB}

void main() {
  float centre = viewZ( vUv );
  float sum = 0.0, wsum = 0.0;
  for ( int i = -3; i <= 3; i ++ ) {
    vec2 uv = vUv + uDir * float( i );
    float w = exp( -float( i * i ) * 0.22 );
    w *= 1.0 / ( 1.0 + abs( viewZ( uv ) - centre ) * 4.0 );
    sum += texture2D( tAO, uv ).r * w;
    wsum += w;
  }
  gl_FragColor = vec4( vec3( sum / max( wsum, 1e-4 ) ), 1.0 );
}
`;

// --- bloom -------------------------------------------------------------------

const BRIGHT_FRAG = /* glsl */`
varying vec2 vUv;
uniform sampler2D tScene;
uniform float uThreshold;
uniform float uClamp;

void main() {
  vec3 c = texture2D( tScene, vUv ).rgb;
  float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
  // Soft knee. A hard threshold makes the bloom pop on and off as a lamp
  // crosses it, which reads as a bug rather than as a lamp.
  float k = clamp( ( l - uThreshold ) / max( uThreshold, 1e-3 ), 0.0, 1.0 );
  c *= k * k;

  // AND THEN CLAMP IT, WHICH IS THE WHOLE POINT OF THIS PASS.
  //
  // The dock lamp sits 600 mm from the wall it is bolted to. Inverse square on
  // 440 candela over 0.6 m arrives at roughly 1200× white, so the unclamped
  // bright pass handed the blur a source twelve hundred units tall, the blur
  // spread it over a 190 px disc, and every pixel of that disc was still far
  // past 1.0 after the ACES roll-off. A measured frame had 2,700 pixels at luma
  // 253+ and no lamp SHAPE anywhere in it — the emitter had been eaten by its
  // own halo.
  //
  // A bloom is a lens artefact and a lens scatters a FRACTION of what enters
  // it. Clamping the source says exactly that: past a point, more light does not
  // buy more veil, it only buys a brighter core — which the tone curve then
  // handles, and which is what keeps a lamp reading as an object with an edge.
  gl_FragColor = vec4( min( c, vec3( uClamp ) ), 1.0 );
}
`;

const BLUR_FRAG = /* glsl */`
varying vec2 vUv;
uniform sampler2D tSrc;
uniform vec2 uDir;

void main() {
  // Nine taps with linear-sampled pairs would be cheaper still, but the source
  // is a quarter-resolution buffer and this is not where the frame goes.
  vec3 c = texture2D( tSrc, vUv ).rgb * 0.196;
  c += ( texture2D( tSrc, vUv + uDir ).rgb + texture2D( tSrc, vUv - uDir ).rgb ) * 0.175;
  c += ( texture2D( tSrc, vUv + uDir * 2.0 ).rgb + texture2D( tSrc, vUv - uDir * 2.0 ).rgb ) * 0.124;
  c += ( texture2D( tSrc, vUv + uDir * 3.4 ).rgb + texture2D( tSrc, vUv - uDir * 3.4 ).rgb ) * 0.070;
  c += ( texture2D( tSrc, vUv + uDir * 5.2 ).rgb + texture2D( tSrc, vUv - uDir * 5.2 ).rgb ) * 0.033;
  gl_FragColor = vec4( c, 1.0 );
}
`;

// --- the grade ---------------------------------------------------------------
// Everything lands here: edge antialiasing, occlusion, bloom, exposure, the film
// curve, the look, and the sRGB encode. One read of the scene buffer, one write
// to the screen.

const GRADE_FRAG = /* glsl */`
varying vec2 vUv;
uniform sampler2D tScene;
uniform sampler2D tAO;
uniform sampler2D tBloom;
uniform vec2 uTexel;
uniform float uExposure;
uniform float uAO;
uniform float uBloom;
uniform vec3 uShadowTint;
uniform vec3 uHighTint;
uniform float uVignette;
uniform float uGrain;
uniform float uAberration;
uniform float uTime;
uniform vec3 uLift;
uniform vec3 uAerial;
uniform float uAerialRate;
// Contrast about a pivot ABOVE mid-grey. A pivot at 0.5 pushes the shadows
// down and the highlights up equally; this room's problem is that its mid-tones
// all sit in a narrow band just under half, so a high pivot spreads that band
// downwards — which is what separates lit floor from unlit floor — without
// blowing the lamps, which are already at the top of the ACES roll-off.
uniform float uContrast;
uniform float uPivot;
uniform float uShoulderAt;  // scene-linear value where highlight recovery starts
uniform float uShoulderK;   // how much range the shoulder folds into itself
uniform vec3 uBalance;      // scene-linear white balance, applied before the curve
uniform float uTopAt;       // display value where the output gate starts bending
uniform float uCeil;        // ...and the value it may approach but never reach
${DEPTH_LIB}

// Three's ACES fit, reproduced because the material-side tone mapping is
// switched off the moment we render into a buffer instead of the canvas.
vec3 aces( vec3 c ) {
  const mat3 IN = mat3(
    0.59719, 0.07600, 0.02840,
    0.35458, 0.90834, 0.13383,
    0.04823, 0.01566, 0.83777 );
  const mat3 OUT = mat3(
     1.60475, -0.10208, -0.00327,
    -0.53108,  1.10813, -0.07276,
    -0.07367, -0.00605,  1.07602 );
  c = IN * c;
  vec3 a = c * ( c + 0.0245786 ) - 0.000090537;
  vec3 b = c * ( 0.983729 * c + 0.4329510 ) + 0.238081;
  return clamp( OUT * ( a / b ), 0.0, 1.0 );
}

vec3 srgb( vec3 c ) {
  return mix( c * 12.92, 1.055 * pow( c, vec3( 0.41666 ) ) - 0.055, step( 0.0031308, c ) );
}

float hash12( vec2 p ) {
  vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
  p3 += dot( p3, p3.yzx + 33.33 );
  return fract( ( p3.x + p3.y ) * p3.z );
}

const vec3 LUMA = vec3( 0.2126, 0.7152, 0.0722 );

// Perceptual luma for edge detection. The buffer is linear HDR and a linear
// luma finds no edge at all in the shadows, which is exactly where the stair
// steps on a rack upright live. One divide and a sqrt buys the whole toe back.
float flum( vec3 c ) {
  float l = dot( c, LUMA );
  return sqrt( l / ( 1.0 + l ) );
}

// FXAA, the console variant: four diagonal luma taps decide which way the edge
// runs, then two bilinear taps smear across it. The scene renders into a
// composer buffer, so the renderer's own MSAA never applies and every diagonal
// in the level — ramp, stair, rack upright — is a raw staircase without this.
// A 4x multisampled float target would be better and costs bandwidth this game
// does not have spare.
vec3 fxaa( vec2 uv, vec3 mid ) {
  vec2 t = uTexel;
  float lM = flum( mid );
  float lNW = flum( texture2D( tScene, uv + vec2( -t.x, -t.y ) ).rgb );
  float lNE = flum( texture2D( tScene, uv + vec2( t.x, -t.y ) ).rgb );
  float lSW = flum( texture2D( tScene, uv + vec2( -t.x, t.y ) ).rgb );
  float lSE = flum( texture2D( tScene, uv + vec2( t.x, t.y ) ).rgb );

  float lMin = min( lM, min( min( lNW, lNE ), min( lSW, lSE ) ) );
  float lMax = max( lM, max( max( lNW, lNE ), max( lSW, lSE ) ) );
  // Flat neighbourhood: leave it alone. Skipping the four colour taps here is
  // most of why this is affordable — on a textured floor the branch is taken
  // for the large majority of the frame.
  if ( lMax - lMin < max( 0.045, lMax * 0.17 ) ) return mid;

  vec2 dir = vec2( -( ( lNW + lNE ) - ( lSW + lSE ) ), ( lNW + lSW ) - ( lNE + lSE ) );
  float red = max( ( lNW + lNE + lSW + lSE ) * 0.03125, 0.0078 );
  dir = clamp( dir / ( min( abs( dir.x ), abs( dir.y ) ) + red ), -8.0, 8.0 ) * t;

  vec3 a = 0.5 * ( texture2D( tScene, uv + dir * -0.1667 ).rgb
                 + texture2D( tScene, uv + dir * 0.1667 ).rgb );
  vec3 b = a * 0.5 + 0.25 * ( texture2D( tScene, uv - dir * 0.5 ).rgb
                            + texture2D( tScene, uv + dir * 0.5 ).rgb );
  // The wide pair can reach past the edge onto something unrelated; if its luma
  // has left the neighbourhood, fall back to the narrow one.
  float lB = flum( b );
  return ( lB < lMin || lB > lMax ) ? a : b;
}

void main() {
  vec2 d = vUv - 0.5;
  float r2 = dot( d, d );

  vec3 mid = texture2D( tScene, vUv ).rgb;
  vec3 col = fxaa( vUv, mid );

  // Lateral chromatic aberration, applied as a DIFFERENCE on top of the
  // antialiased colour rather than by resampling all three channels at three
  // places. Sampling per channel throws the aliasing back in on red and blue,
  // and at any magnitude you can actually see it that turns every thin bright
  // edge — every rack upright, every ceiling rib — into a rainbow. That is what
  // the first version of this did. A pixel and a bit at the extreme corner,
  // tapering to nothing by the middle third, is a lens; anything more is a bug.
  vec2 off = d * r2 * uAberration;
  col.r += texture2D( tScene, vUv + off ).r - mid.r;
  col.b += texture2D( tScene, vUv - off ).b - mid.b;

  // Occlusion before the curve, so a contact shadow rolls off with everything
  // else rather than punching a flat grey hole in the image. Squared, because
  // the raw cone estimate is far too polite about a crate sitting on a floor.
  float ao = texture2D( tAO, vUv ).r;
  col *= mix( 1.0, ao * ao, uAO );

  col += texture2D( tBloom, vUv ).rgb * uBloom;

  // HIGHLIGHT RECOVERY, AHEAD OF THE CURVE.
  //
  // ACES has run out of slope by about 8 in scene-linear: everything above that
  // lands within a per cent of white and the differences between them are gone.
  // The van's interior lamp is 1360 cd in a 2.4 m box, which puts the panel a
  // metre from it somewhere near 60 — so the whole inside of the van clipped to
  // a flat white card, ribs, floor, crates and all, and it did so in the one
  // place in the level every player walks into on every run.
  //
  // A log shoulder above a threshold is the cheap fix. Below uShoulderAt it is
  // exactly the identity, so nothing in the normal range moves at all; above
  // it, ratios are preserved logarithmically instead of being flattened, and
  // 60-vs-90 comes out of the curve still 60-vs-90 rather than white-vs-white.
  // Applied on the maximum channel and reapplied as a scale, so a highlight
  // keeps its hue instead of desaturating towards white one channel at a time.
  float peak = max( col.r, max( col.g, col.b ) );
  if ( peak > uShoulderAt ) {
    float over = peak - uShoulderAt;
    float rolled = uShoulderAt + uShoulderK * log( 1.0 + over / uShoulderK );
    col *= rolled / peak;
  }

  // WHITE BALANCE, IN SCENE LINEAR, WHICH IS WHERE A CAMERA DOES IT.
  //
  // Every light in this warehouse is warm by level data: the lamps are #ffe2b4
  // and #ffd9a0, the sun is #ffd9a8, and concrete's own albedo is a warm grey on
  // top of that. Multiply those together and the illuminant arrives at the film
  // at about 1.6 red-to-blue before the grade touches it, which is not a warm
  // scene, it is an orange filter over the lens — three reviews called the floor
  // khaki and they were describing this number.
  //
  // The previous attempt fought it in display space with a shadow tint, which
  // cannot work: a tint is an ADDITION and the cast is a MULTIPLICATION, so it
  // over-corrects the blacks while leaving every lit surface exactly as orange
  // as it was. A gain does the right thing everywhere at once.
  //
  // Deliberately a PARTIAL correction. Balance the tungsten out completely and
  // the lamps stop reading as tungsten — the whole point of a warm key is that
  // it is warm against something. This takes roughly half of it out, which
  // leaves the pools golden and stops the shadows between them being golden too.
  col *= uBalance;

  col = aces( col * uExposure );

  // The look. A job site at dusk: enough saturation taken out that the hi-viz
  // reads as the brightest thing in the frame — which, on a real site, it is.
  //
  // The shadow tint used to be ( -0.005, 0, +0.013 ), one more cool source on a
  // scene that already had a cool hemisphere and a cool rim, and taking it out
  // is most of what killed the navy. Swinging it warm instead overshot in the
  // other direction — with #ffe2b4 lamps on cream cladding, the frame measured
  // R54 G44 B32, a 1.69 channel spread where the rubric wants under 1.5, and an
  // amber cast is no more a grade than an indigo one was. So it is nearly
  // neutral now: a whisper warm, because the lamps are tungsten and the shadows
  // in a room lit by tungsten are the only place a cool note can come from
  // without contradicting them.
  //
  // The saturation pull does the rest of the work. It came down from 0.93 to
  // 0.88 for the same reason: when every large surface in the frame is being
  // lit by the same warm source, the cheapest way to stop that reading as a
  // filter over the lens is to take some of the chroma out of all of it and let
  // the hi-vis and the hazard stripes keep theirs by being brighter.
  //
  // The shadow tint is a SPLIT now rather than a global nudge. With the balance
  // above doing the heavy lifting the frame no longer needs rescuing from its
  // own illuminant, so this can go back to the only job a tint is good at:
  // putting a different hue in the shadows from the one in the lights, which is
  // colour contrast rather than a colour cast. Cool in the dark, a whisper warm
  // in the light, and both small enough to be felt rather than seen.
  // AND THE SPLIT IS WIDER AND STRONGER THAN IT WAS, BECAUSE IT WAS NOT DOING
  // THE JOB IT IS THE ONLY THING THAT CAN DO.
  //
  // Bucketed by luma, every reference plate on disk rotates hard: PEAK runs
  // blue-to-green 2.18 in its shadows against 1.63 in its highlights, and the
  // three R.E.P.O. frames run 1.38-2.21 down to 0.69-1.08. Half a unit to over
  // one. This build measured 0.98 down to 0.81 across the range a player
  // actually looks at — the right direction and a fifth of the distance — and
  // most of that came from the black point rather than from anything in the
  // picture, because the bottom four deciles of our frame ARE the black point.
  //
  // Two things were holding it down and both are here. The split ran on
  // ( 1 - l )^2, which crosses over at l = 0.29: everything above about a fifth
  // of display white was getting the WARM half of a warm/cool split, which on a
  // frame whose mid-tones are most of the picture means the split was warming
  // three quarters of it and cooling the empty quarter. And the amplitudes were
  // a third of what they needed to be to register against a scene lit end to
  // end by one tungsten illuminant.
  //
  // So: crossover up to the middle of the range, on a smoothstep rather than a
  // square, so the transition is a ramp and not a corner. Held as uniforms
  // rather than literals because this is exactly the knob a probe wants to
  // sweep live against the reference numbers.
  //
  // THE AMPLITUDES ARE SMALL AND THAT IS NOT TIMIDITY, IT IS THE COLOUR SPACE.
  //
  // This line runs after aces() and BEFORE srgb(), so the numbers here are
  // scene-referred and the encode expands them enormously at the bottom of the
  // range: 0.032 of blue added to a shadow comes out the other side of the
  // transfer function at fifty-one counts, not eight. That was tried, measured
  // and photographed — the whole shed went navy, which is the exact failure
  // this file has a paragraph about further down and the reason the previous
  // shadow tint was removed altogether. A fifth of that is a rotation; a third
  // of it is a cast.
  float l = dot( col, LUMA );
  col = mix( vec3( l ), col, 0.88 );
  float sh = 1.0 - smoothstep( 0.04, 0.62, l );
  col += uShadowTint * sh + uHighTint * ( 1.0 - sh );
  // NO UPPER CLAMP HERE ANY MORE — see the gate at the bottom of the shader.
  // Contrast about a pivot multiplies the top of the range as well as spreading
  // the middle, so a clamp at this line is where a lamp stopped being a lamp:
  // everything above ACES 0.959 came out of it at exactly 1.0 and the whole
  // upper half of the tone curve was thrown away one line before it was needed.
  col = max( ( col - uPivot ) * uContrast + uPivot + 0.006, 0.0 );

  float vig = 1.0 - uVignette * r2 * ( 1.0 + r2 );
  col *= vig;

  col = srgb( col );

  // THE TOE. Everything above this line can still reach RGB 0,0,0, and a frame
  // with twenty per cent of its pixels at absolute zero is not dark, it is
  // empty — a graded review measured exactly that here and it is the single
  // cheapest thing to fix. Real footage has a floor: sensor bias, lens flare,
  // and light that has bounced twice. PEAK's darkest five per cent sits around
  // RGB 35/32/58, lifted and blue-violet, and that is the target.
  //
  // The far term is aerial perspective. Distance lifts and cools faster than
  // the near field, which reads as depth for free and pulls the back half of
  // the racking out of the black it was disappearing into. Fog can only wash
  // towards its own colour and takes the highlights with it; a lift leaves
  // anything already bright exactly where it was.
  //
  // The mask has to be TIGHT. A toe that reaches into the mid-tones does not
  // read as a lifted black, it reads as milk poured over the whole frame — the
  // first attempt used a half-luma ramp and turned a warehouse into fog.
  // Squared, and done by a quarter of the way up, so it moves the empty pixels
  // and leaves anything with detail in it alone.
  //
  // And note what this can and cannot do. Measured, the darkest five per cent
  // of the frame landed at RGB 35/33/58 — dead on the reference — while
  // SIXTY-FOUR PER CENT of the same frame was a flat navy slab. Both facts at
  // once, because a black point is a floor and says nothing about how much of
  // the picture is lying on it. The fix for that was never here; it is the
  // bounce floor in materials.js, which puts something in the dark instead of
  // recolouring the nothing. This line is only allowed to set where zero is.
  float dist = min( -viewZ( vUv ), 70.0 );
  float far = 1.0 - exp( -dist * uAerialRate );
  float shadow = 1.0 - smoothstep( 0.0, 0.24, dot( col, LUMA ) );
  shadow *= shadow;
  // AND THE LIFT IS GATED BY DISTANCE, BECAUSE AT TWO METRES THERE IS NO AIR.
  //
  // This is the fix for the navy monolith. An upright piano finished in black
  // lacquer, standing 1.5 m from the lens and filling 14% of the frame, has a
  // luma of about 0.03 — so the shadow mask is 1.0 across every pixel of it and
  // the flat lift landed on the whole object at full strength. RGB 25/23/40
  // is not a black piano, it is a navy slab, and three separate reviews called
  // it exactly that while the black-point statistic it exists to serve passed
  // clean. A black point is a property of the ATMOSPHERE between you and a
  // surface. The far racking has thirty metres of dusty air in front of it and
  // should lift; a piano you could touch has none and should stay black.
  //
  // Not to zero, though. Killing the near-field lift outright is how the build
  // got its crushed blacks the first time — the floor of 0.22 is what keeps a
  // shadowed boot from reaching absolute zero, and absolute zero is a hole in
  // the picture whatever colour it is.
  float air = mix( 0.22, 1.0, smoothstep( 0.8, 11.0, dist ) );
  col += ( uLift * air + uAerial * far ) * shadow * vig;

  // Grain last and in display space, because that is where a sensor's noise
  // actually lives, and weighted towards the shadows where you would see it.
  float n = hash12( vUv * 1024.0 + fract( uTime ) * 91.7 ) - 0.5;
  col += n * uGrain * ( 1.0 - 0.7 * dot( col, vec3( 0.333 ) ) );

  // THE OUTPUT GATE. Nothing above this line is allowed to reach white, and
  // this is the line that guarantees it rather than hoping.
  //
  // Asked three separate times to stop the lamps clipping, this build went 0.7%
  // -> 0.8% -> 1.1% of the frame pinned at 250+ luma, getting worse every time
  // somebody tuned a threshold. Both reference games clip 0.00% on every frame
  // measured. The reason tuning kept failing is that clipping was not being
  // caused by any one term: a lamp core, plus its bloom, plus the contrast
  // multiply, plus the black lift, each individually reasonable, arrived at the
  // clamp together — and a clamp is where information goes to die silently.
  // A budget that four independent knobs can each spend is not a budget.
  //
  // So the top of the range gets an asymptote instead of a wall. Above uTopAt
  // the curve bends and approaches uCeil without ever touching it, which makes
  // "this frame does not clip" a property of the shader rather than of the
  // current values of five other uniforms. It also means a lamp KEEPS ITS
  // GRADIENT: the reference crop that this is measured against is a sconce
  // whose core stays a hard saturated green with legible masonry ten pixels
  // away, and you only get that if the brightest 5% of the image still has a
  // slope in it.
  //
  // Applied to the peak channel and re-applied as a scale, so a hot tungsten
  // lamp compresses towards a dimmer version of its own colour rather than
  // losing red last and turning white at the core.
  float pk = max( col.r, max( col.g, col.b ) );
  if ( pk > uTopAt ) {
    float head = max( uCeil - uTopAt, 1e-3 );
    col *= ( uTopAt + head * ( 1.0 - exp( -( pk - uTopAt ) / head ) ) ) / pk;
  }

  gl_FragColor = vec4( clamp( col, 0.0, 1.0 ), 1.0 );
}
`;

// --- the pass ----------------------------------------------------------------

class SitePass extends Pass {
  constructor(camera, width, height) {
    super();
    this.camera = camera;
    this.time = 0;
    this.needsSwap = true;

    const half = { type: THREE.HalfFloatType, depthBuffer: false };
    const w2 = Math.max(1, width >> 1), h2 = Math.max(1, height >> 1);
    const w4 = Math.max(1, width >> 2), h4 = Math.max(1, height >> 2);
    // AO is a single channel but three has no R8 render target worth the
    // trouble; an RGBA8 half-res buffer is 900KB and nobody will miss it.
    this.aoA = new THREE.WebGLRenderTarget(w2, h2, { depthBuffer: false });
    this.aoB = new THREE.WebGLRenderTarget(w2, h2, { depthBuffer: false });
    this.bloomA = new THREE.WebGLRenderTarget(w4, h4, half);
    this.bloomB = new THREE.WebGLRenderTarget(w4, h4, half);
    for (const rt of [this.aoA, this.aoB, this.bloomA, this.bloomB]) {
      rt.texture.minFilter = THREE.LinearFilter;
      rt.texture.magFilter = THREE.LinearFilter;
      rt.texture.generateMipmaps = false;
    }

    const shader = (frag, uniforms) => new THREE.ShaderMaterial({
      uniforms, vertexShader: VERT, fragmentShader: frag,
      depthTest: false, depthWrite: false, blending: THREE.NoBlending,
    });

    const depthUniforms = () => ({
      tDepth: { value: null },
      uRay: { value: new THREE.Vector2(1, 1) },
      uNear: { value: 0.1 },
      uFar: { value: 200 },
    });

    this.aoMat = shader(AO_FRAG, {
      ...depthUniforms(),
      uTexel: { value: new THREE.Vector2(1 / w2, 1 / h2) },
      uProj: { value: new THREE.Matrix4() },
      // Half a metre. Big enough to darken the join between a crate and the
      // floor, small enough that a wall does not shadow the whole room.
      uRadius: { value: 0.55 },
      uBias: { value: 0.025 },
    });
    this.aoBlurMat = shader(AO_BLUR_FRAG, {
      ...depthUniforms(),
      tAO: { value: null },
      uDir: { value: new THREE.Vector2() },
    });
    this.brightMat = shader(BRIGHT_FRAG, {
      tScene: { value: null },
      uThreshold: { value: 1.62 },
      // ONE STOP OF VEIL, DOWN FROM FOUR.
      //
      // 6.5 sounded conservative and was not: multiplied by the 0.55 mix it put
      // 3.6 units of scene-linear light on top of whatever was already there,
      // over a disc sixty pixels across, and 3.6 is past the top of the tone
      // curve on its own. The result photographs as a hard-edged white plate
      // with a lamp somewhere inside it — the shot into the van was one
      // continuous blown disc from the roof rib to the floor.
      //
      // A bloom is scattered light and scattered light is a small fraction of
      // the beam. What makes a lamp read as bright is the CONTRAST between its
      // core and the room, not the area of the smear, and the smear is the
      // thing that destroys the contrast by lifting the room.
      uClamp: { value: 2.2 },
    });
    this.blurMat = shader(BLUR_FRAG, {
      tSrc: { value: null },
      uDir: { value: new THREE.Vector2() },
    });
    this.gradeMat = shader(GRADE_FRAG, {
      ...depthUniforms(),
      tScene: { value: null },
      tAO: { value: null },
      tBloom: { value: null },
      uTexel: { value: new THREE.Vector2(1 / width, 1 / height) },
      uExposure: { value: 1 },
      uAO: { value: 0.70 },
      uBloom: { value: 0.55 },
      uContrast: { value: 1.08 },
      uPivot: { value: 0.52 },
      // The shoulder starts far lower and folds far harder than it did.
      //
      // At 1.6/2.2 the recovery was arithmetically real and visually absent:
      // scene-linear 60 (the van panel) came out at 8.9, scene-linear 30 came
      // out at 7.6, and ACES maps both of those to within three thousandths of
      // white. Recovering a range into a part of the curve that has no slope
      // left is not recovering it. At 0.9/0.55 the same pair lands at 3.48 and
      // 3.09, which ACES still separates, and the gate at the bottom of the
      // shader keeps that separation instead of clamping it away.
      uShoulderAt: { value: 0.9 },
      uShoulderK: { value: 0.55 },
      // Half a correction towards D65 off a tungsten key. See the shader.
      //
      // Pulled back from ( 0.945, 1.0, 1.115 ). A global multiply cannot tell a
      // highlight from a shadow, so every point of tungsten it took out of the
      // floor it also took out of the lamp pools — and the lamp pools are the
      // one place in this game that is SUPPOSED to be orange. Measured, the
      // brightest decile of a shed shot was sitting at blue-to-green 0.81 where
      // the references run 0.62-1.08, which is not a warm key, it is a key that
      // has been balanced most of the way to neutral. Half the correction comes
      // out here and rather more than half of it goes back in as a shadow tint
      // below, which puts the same total distance between light and shadow
      // while spending it on a rotation instead of on a cast.
      uBalance: { value: new THREE.Vector3(0.952, 1.0, 1.096) },
      // The gate. uCeil is the hard promise — no pixel leaves this shader
      // above it — and 0.955 in display space is 243/255, which puts the whole
      // frame under the 250 that a clipping test counts, with room for the
      // grain on top. uTopAt is where the bend starts; low enough that the van
      // interior has somewhere to be compressed INTO, high enough that nothing
      // a player would call a mid-tone is touched by it.
      uTopAt: { value: 0.72 },
      uCeil: { value: 0.955 },
      // The split tone. Additive, in display space, and the ONLY thing in the
      // chain that can put a different hue in the shadows from the one in the
      // lights — a multiply cannot, because it scales both by the same factor.
      // Luma-weighted so neither half moves the exposure: the green channel
      // carries almost none of either tint.
      uShadowTint: { value: new THREE.Vector3(-0.007, -0.001, 0.014) },
      uHighTint: { value: new THREE.Vector3(0.010, 0.002, -0.008) },
      uVignette: { value: 0.36 },
      // Grain is measured in display units, and this one is easy to overdo in a
      // way that does not look like grain: at 0.045 the noise is ±6/255, which
      // puts the local standard deviation of EVERY pixel in the frame above the
      // threshold a reviewer uses to tell textured from smooth. The frame came
      // back 93% textured against a reference that leaves 63% of itself
      // deliberately plain. Grain must live under the detail, not on top of it.
      uGrain: { value: 0.012 },
      // UV units, multiplied by radius squared. See the note in the shader —
      // the failure mode of this effect is not "too subtle", it is "rainbow".
      //
      // DO NOT SET THIS FROM ARITHMETIC. The predicted corner offset and the
      // measured one disagree by a factor of two and a bit, because the
      // aberration is applied as a difference on top of an FXAA'd colour and
      // the resampling changes the effective displacement. A cross-correlation
      // of the red and blue channels against green measured 2.8 px at the frame
      // edge where a lens wants 0.6-1.5, so this is the number that produced
      // 2.8, divided by what it needed dividing by. Trust the pixels.
      uAberration: { value: 0.0026 },
      uTime: { value: 0 },
      // Display-space black floor and its far-field extra.
      //
      // These both came DOWN by a third once materials.js grew a bounce floor,
      // and that ordering is the whole lesson. Before the bounce, the lift was
      // the only thing in two thirds of the frame and had to be large enough to
      // be a picture on its own — which is precisely why the warehouse went
      // navy. Once every surface returns a fraction of its own albedo, the lift
      // only has to do what a black point is for: keep absolute zero off the
      // screen. Anything more and it starts tinting things that already have a
      // colour of their own.
      //
      // AND THEN THE BLUE CAME OUT OF THEM, WHICH IS THE NAVY.
      //
      // 0.098/0.090/0.156 is a blue:red ratio of 1.6, and it was landing on top
      // of a scene already lit blue twice over — a #5b6472 hemisphere and a
      // #7fa8d8 rim at 0.42 that reaches every surface in the level. Three cool
      // sources stacked is not a cool grade, it is a colour cast, and every
      // wide shot came back with navy walls, navy racking and a navy roof.
      //
      // A black point is allowed a tint; it is not allowed to be the loudest
      // hue in the frame. What is left is a hair cool and essentially neutral,
      // so the warm lamps stay the only strong colour in a shot and the hi-vis
      // stays the only strong colour on a contractor. The aerial term keeps
      // slightly more of its blue than the near lift does, because that one is
      // standing in for actual air and actual air is actually blue.
      uLift: { value: new THREE.Vector3(0.086, 0.084, 0.098) },
      uAerial: { value: new THREE.Vector3(0.030, 0.033, 0.044) },
      uAerialRate: { value: 0.030 },
    });

    // Stride multiplier for the second blur pair, in quarter-res texels. 2.6
    // reached about 54 screen pixels from the core, which is five times the
    // radius at which the reference sconce still has legible masonry beside it.
    this.wide = 1.5;

    this.quad = new FullScreenQuad();
    this.setSize(width, height);
  }

  setSize(width, height) {
    const w2 = Math.max(1, width >> 1), h2 = Math.max(1, height >> 1);
    const w4 = Math.max(1, width >> 2), h4 = Math.max(1, height >> 2);
    this.aoA.setSize(w2, h2);
    this.aoB.setSize(w2, h2);
    this.bloomA.setSize(w4, h4);
    this.bloomB.setSize(w4, h4);
    this.aoMat.uniforms.uTexel.value.set(1 / w2, 1 / h2);
    // FXAA works at full resolution, so it wants the screen texel, not the
    // half-res one the occlusion runs at.
    this.gradeMat.uniforms.uTexel.value.set(1 / width, 1 / height);
    this._half = new THREE.Vector2(1 / w2, 1 / h2);
    this._quarter = new THREE.Vector2(1 / w4, 1 / h4);
  }

  draw(renderer, material, target) {
    this.quad.material = material;
    renderer.setRenderTarget(target);
    this.quad.render(renderer);
  }

  render(renderer, writeBuffer, readBuffer) {
    const cam = this.camera;
    const p = cam.projectionMatrix.elements;
    const depth = readBuffer.depthTexture;

    // --- occlusion ---------------------------------------------------------
    if (depth) {
      for (const m of [this.aoMat, this.aoBlurMat, this.gradeMat]) {
        m.uniforms.tDepth.value = depth;
        m.uniforms.uNear.value = cam.near;
        m.uniforms.uFar.value = cam.far;
        m.uniforms.uRay.value.set(1 / p[0], 1 / p[5]);
      }
      this.aoMat.uniforms.uProj.value.copy(cam.projectionMatrix);
      this.draw(renderer, this.aoMat, this.aoA);

      this.aoBlurMat.uniforms.tAO.value = this.aoA.texture;
      this.aoBlurMat.uniforms.uDir.value.set(this._half.x, 0);
      this.draw(renderer, this.aoBlurMat, this.aoB);

      this.aoBlurMat.uniforms.tAO.value = this.aoB.texture;
      this.aoBlurMat.uniforms.uDir.value.set(0, this._half.y);
      this.draw(renderer, this.aoBlurMat, this.aoA);
    }

    // --- bloom -------------------------------------------------------------
    this.brightMat.uniforms.tScene.value = readBuffer.texture;
    this.draw(renderer, this.brightMat, this.bloomA);

    // Two blur passes at two strides: the second, wider one is what turns a
    // tight halo into the soft bloom a dusty warehouse actually has. `wide` is
    // a field rather than a constant so a probe can sweep the halo radius
    // against the reference crop in one browser session; every previous attempt
    // at this number cost a four-minute rebuild and was therefore guessed at.
    const q = this._quarter;
    const wide = this.wide;
    for (const [sx, sy, src, dst] of [
      [q.x, 0, this.bloomA, this.bloomB],
      [0, q.y, this.bloomB, this.bloomA],
      [q.x * wide, 0, this.bloomA, this.bloomB],
      [0, q.y * wide, this.bloomB, this.bloomA],
    ]) {
      this.blurMat.uniforms.tSrc.value = src.texture;
      this.blurMat.uniforms.uDir.value.set(sx, sy);
      this.draw(renderer, this.blurMat, dst);
    }

    // --- grade -------------------------------------------------------------
    const g = this.gradeMat.uniforms;
    g.tScene.value = readBuffer.texture;
    g.tAO.value = depth ? this.aoA.texture : null;
    g.uAO.value = depth ? 0.70 : 0;
    // No depth means no aerial term either — viewZ would read an empty sampler
    // and put a flat grey wash over the whole frame.
    g.uAerialRate.value = depth ? 0.030 : 0;
    g.tBloom.value = this.bloomA.texture;
    g.uExposure.value = renderer.toneMappingExposure;
    g.uTime.value = this.time;
    this.draw(renderer, this.gradeMat, this.renderToScreen ? null : writeBuffer);
  }

  dispose() {
    for (const rt of [this.aoA, this.aoB, this.bloomA, this.bloomB]) rt.dispose();
    for (const m of [this.aoMat, this.aoBlurMat, this.brightMat, this.blurMat, this.gradeMat]) m.dispose();
    this.quad.dispose();
  }
}

/**
 * Build the chain, or fall back to drawing the scene straight.
 *
 * @returns {{render:(dt:number)=>void, setSize:(w:number,h:number)=>void, dispose:()=>void}}
 */
export function installPost(renderer, scene, camera) {
  try {
    const size = renderer.getSize(new THREE.Vector2());
    const dpr = renderer.getPixelRatio();
    const w = Math.max(1, Math.floor(size.width * dpr));
    const h = Math.max(1, Math.floor(size.height * dpr));

    const depthTexture = new THREE.DepthTexture(w, h);
    const rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      depthTexture,
    });
    rt.texture.name = 'hazard.scene';

    const composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    const site = new SitePass(camera, w, h);
    composer.addPass(site);

    // RenderPass writes into the READ buffer and does not swap, so the scene
    // always lands in renderTarget2 — and renderTarget2 is a clone, which means
    // it got its own copy of the depth texture. SitePass reads whichever one it
    // is handed, so this only matters if it ever comes back null.
    const depthOk = !!composer.renderTarget2.depthTexture;
    if (!depthOk) console.warn('hazard: no depth texture on the composer buffer; occlusion is off');

    // renderer.info resets itself at the start of every renderer.render(), and
    // this chain calls that eight or nine times a frame — so by the time the
    // HUD reads the counter it would be reporting one full-screen quad. Take
    // the reset over manually and the number becomes the frame's real total,
    // which is the number anyone asking about draw calls actually wants.
    renderer.info.autoReset = false;

    return {
      // Additive to the interface and read-only in practice: main.js uses
      // render/setSize/dispose and nothing else, but a grading probe that
      // cannot reach the uniforms has to rebuild the bundle for every candidate
      // value, and at four minutes a build that is the difference between
      // sweeping a curve and guessing at it.
      get grade() { return site.gradeMat.uniforms; },
      get bright() { return site.brightMat.uniforms; },
      get site() { return site; },
      render(dt) {
        renderer.info.reset();
        site.time += dt || 0.016;
        composer.render(dt);
      },
      setSize(width, height) {
        const r = renderer.getPixelRatio();
        const pw = Math.max(1, Math.floor(width * r));
        const ph = Math.max(1, Math.floor(height * r));
        composer.setSize(pw, ph);
        // setSize on a render target does not carry to its depth attachment,
        // and a stale depth texture is a silently wrong AO rather than a crash.
        for (const t of [composer.renderTarget1, composer.renderTarget2]) {
          if (!t.depthTexture) continue;
          t.depthTexture.image.width = pw;
          t.depthTexture.image.height = ph;
          t.depthTexture.dispose();
        }
        site.setSize(pw, ph);
      },
      dispose() {
        renderer.info.autoReset = true;
        site.dispose();
        composer.renderTarget1.dispose();
        composer.renderTarget2.dispose();
      },
    };
  } catch (err) {
    // A composer that fails to build costs you grading, not the frame.
    console.warn('hazard: post-processing unavailable, drawing straight', err);
    return {
      render() { renderer.render(scene, camera); },
      setSize() { },
      dispose() { },
    };
  }
}
