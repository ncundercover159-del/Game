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
    // sqrt keeps the samples uniform over the disc instead of piling them up
    // at the centre, which otherwise makes the AO a thin dark outline.
    float r = uRadius * sqrt( t );
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
// Everything lands here: occlusion, bloom, exposure, the film curve, the look,
// and the sRGB encode. One read of the scene buffer, one write to the screen.

const GRADE_FRAG = /* glsl */`
varying vec2 vUv;
uniform sampler2D tScene;
uniform sampler2D tAO;
uniform sampler2D tBloom;
uniform float uExposure;
uniform float uAO;
uniform float uBloom;
uniform float uVignette;
uniform float uGrain;
uniform float uAberration;
uniform float uTime;

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

void main() {
  vec2 d = vUv - 0.5;
  float r2 = dot( d, d );

  // Lateral chromatic aberration: zero in the middle, growing with the square
  // of the radius, exactly as a cheap lens does it. This is the one effect that
  // most says "you are watching this through a camera bolted to a helmet".
  vec2 off = d * r2 * uAberration;
  vec3 col;
  col.r = texture2D( tScene, vUv + off ).r;
  col.g = texture2D( tScene, vUv ).g;
  col.b = texture2D( tScene, vUv - off ).b;

  // Occlusion before the curve, so a contact shadow rolls off with everything
  // else rather than punching a flat grey hole in the image.
  float ao = texture2D( tAO, vUv ).r;
  col *= mix( 1.0, ao, uAO );

  col += texture2D( tBloom, vUv ).rgb * uBloom;

  col = aces( col * uExposure );

  // The look. A job site at dusk: shadows pulled towards cold blue, highlights
  // left warm, and enough saturation taken out that the hi-viz reads as the
  // brightest thing in the frame — which, on a real site, it is.
  float l = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
  col = mix( vec3( l ), col, 0.93 );
  col += vec3( -0.005, 0.0, 0.013 ) * ( 1.0 - l );
  col = clamp( ( col - 0.5 ) * 1.06 + 0.5 + 0.016, 0.0, 1.0 );

  col *= 1.0 - uVignette * r2 * ( 1.0 + r2 );

  col = srgb( col );

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
      tScene: { value: null },
      tAO: { value: null },
      tBloom: { value: null },
      uExposure: { value: 1 },
      uAO: { value: 0.48 },
      uBloom: { value: 0.62 },
      uVignette: { value: 0.34 },
      uGrain: { value: 0.05 },
      // In UV units, and it is multiplied by the radius squared, so the corner
      // offset is a quarter of this. Three pixels at 720p. The first pass had
      // this fifty times higher and the warehouse came out as a rainbow.
      uAberration: { value: 0.013 },
      uTime: { value: 0 },
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
      for (const m of [this.aoMat, this.aoBlurMat]) {
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
    g.uAO.value = depth ? 0.48 : 0;
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
