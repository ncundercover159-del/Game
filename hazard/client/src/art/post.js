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

void main() {
  vec3 c = texture2D( tScene, vUv ).rgb;
  float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
  // Soft knee. A hard threshold makes the bloom pop on and off as a lamp
  // crosses it, which reads as a bug rather than as a lamp.
  float k = clamp( ( l - uThreshold ) / max( uThreshold, 1e-3 ), 0.0, 1.0 );
  gl_FragColor = vec4( c * k * k, 1.0 );
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
uniform float uVignette;
uniform float uGrain;
uniform float uAberration;
uniform float uTime;
uniform vec3 uLift;
uniform vec3 uAerial;
uniform float uAerialRate;
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

  col = aces( col * uExposure );

  // The look. A job site at dusk: shadows pulled towards cold blue, highlights
  // left warm, and enough saturation taken out that the hi-viz reads as the
  // brightest thing in the frame — which, on a real site, it is.
  float l = dot( col, LUMA );
  col = mix( vec3( l ), col, 0.93 );
  col += vec3( -0.005, 0.0, 0.013 ) * ( 1.0 - l );
  col = clamp( ( col - 0.5 ) * 1.10 + 0.5 + 0.010, 0.0, 1.0 );

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
  // Squared, and done by a third of the way up, so it moves the empty pixels
  // and leaves anything with detail in it alone.
  float dist = min( -viewZ( vUv ), 70.0 );
  float far = 1.0 - exp( -dist * uAerialRate );
  float shadow = 1.0 - smoothstep( 0.0, 0.30, dot( col, LUMA ) );
  shadow *= shadow;
  col += ( uLift + uAerial * far ) * shadow * vig;

  // Grain last and in display space, because that is where a sensor's noise
  // actually lives, and weighted towards the shadows where you would see it.
  float n = hash12( vUv * 1024.0 + fract( uTime ) * 91.7 ) - 0.5;
  col += n * uGrain * ( 1.0 - 0.7 * dot( col, vec3( 0.333 ) ) );

  gl_FragColor = vec4( col, 1.0 );
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
      uThreshold: { value: 1.30 },
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
      uBloom: { value: 0.62 },
      uVignette: { value: 0.36 },
      uGrain: { value: 0.045 },
      // UV units, multiplied by radius squared, so the extreme corner sees a
      // quarter of this: 1.1 px at 1280 wide. See the note in the shader — the
      // failure mode of this effect is not "too subtle", it is "rainbow".
      uAberration: { value: 0.0035 },
      uTime: { value: 0 },
      // Display-space black floor and its far-field extra. 0.145 * 255 = 37, so
      // an absolutely unlit pixel in the near field lands near 37/34/60.
      uLift: { value: new THREE.Vector3(0.145, 0.134, 0.235) },
      uAerial: { value: new THREE.Vector3(0.050, 0.058, 0.088) },
      uAerialRate: { value: 0.030 },
    });

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
    // tight halo into the soft bloom a dusty warehouse actually has.
    const q = this._quarter;
    for (const [sx, sy, src, dst] of [
      [q.x, 0, this.bloomA, this.bloomB],
      [0, q.y, this.bloomB, this.bloomA],
      [q.x * 2.6, 0, this.bloomA, this.bloomB],
      [0, q.y * 2.6, this.bloomB, this.bloomA],
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
