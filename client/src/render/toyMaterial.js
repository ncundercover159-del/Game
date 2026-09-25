// "Vinyl toy" shader: 3-band cel diffuse, hard specular pip, fresnel rim,
// hemisphere ambient. Works for skinned, instanced and plain meshes.
// Per-vertex attribute `mat` = (specular, emissive). Colours come from
// vertex colours (and/or instance colours) times uColor.
import * as THREE from 'three';

// Shared lighting uniforms, updated once per frame by the renderer.
export const LIGHTING = {
  uLightDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() }, // view space
  uUpView: { value: new THREE.Vector3(0, 1, 0) },                      // view space
  uLightColor: { value: new THREE.Color(1.0, 0.96, 0.88) },
  uSkyColor: { value: new THREE.Color(0.62, 0.7, 0.9) },
  uGroundColor: { value: new THREE.Color(0.32, 0.27, 0.3) },
  uRimColor: { value: new THREE.Color(0.9, 0.95, 1.0) },
  uRimStrength: { value: 0.55 },
};

const VERT = /* glsl */ `
#include <common>
#include <color_pars_vertex>
#include <skinning_pars_vertex>
#include <fog_pars_vertex>
attribute vec2 mat;
varying vec3 vN;
varying vec3 vV;
varying vec2 vM;
void main() {
  #include <color_vertex>
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  #include <skinning_vertex>
  #include <project_vertex>
  #include <fog_vertex>
  vN = normalize(transformedNormal);
  vV = -mvPosition.xyz;
  vM = mat;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uLightDir;
uniform vec3 uUpView;
uniform vec3 uLightColor;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform vec3 uRimColor;
uniform float uRimStrength;
uniform float uSpec;
uniform float uEmissive;
uniform float uFlash;
uniform vec3 uFlashColor;
uniform float uOpacity;
#include <common>
#include <color_pars_fragment>
#include <fog_pars_fragment>
varying vec3 vN;
varying vec3 vV;
varying vec2 vM;
void main() {
  vec3 base = uColor;
  #if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
    base *= vColor.rgb;
  #endif
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(vV);
  float ndl = dot(n, uLightDir);
  // three cel bands: shadow / mid / lit
  float lit = smoothstep(-0.08, 0.02, ndl) * 0.62 + smoothstep(0.42, 0.52, ndl) * 0.38;
  float hemi = dot(n, uUpView) * 0.5 + 0.5;
  vec3 ambient = mix(uGroundColor, uSkyColor, hemi);
  vec3 col = base * (ambient + uLightColor * lit * 0.85);
  // hard glossy pip (vinyl)
  float specAmt = max(vM.x, uSpec);
  vec3 h = normalize(uLightDir + v);
  float sp = smoothstep(0.955, 0.975, dot(n, h)) * specAmt;
  col += vec3(sp) * 0.85;
  // rim light
  float fres = 1.0 - max(dot(n, v), 0.0);
  float rim = smoothstep(0.55, 0.85, fres) * uRimStrength * (0.35 + 0.65 * hemi);
  col += uRimColor * rim * 0.6;
  // emissive parts ignore lighting
  float em = max(vM.y, uEmissive);
  col = mix(col, base * 1.15 + 0.08, em);
  col = mix(col, uFlashColor, uFlash);
  gl_FragColor = vec4(col, uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

const OUTLINE_VERT = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
#include <fog_pars_vertex>
uniform float uThickness;
void main() {
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <skinning_vertex>
  transformed += normalize(objectNormal) * uThickness;
  #include <project_vertex>
  #include <fog_vertex>
}
`;

const OUTLINE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
#include <common>
#include <fog_pars_fragment>
void main() {
  gl_FragColor = vec4(uColor, uOpacity);
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export function createToyMaterial(opts = {}) {
  const uniforms = {
    ...THREE.UniformsLib.fog,
    ...LIGHTING,
    uColor: { value: new THREE.Color(opts.color ?? 0xffffff) },
    uSpec: { value: opts.spec ?? 0 },
    uEmissive: { value: opts.emissive ?? 0 },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(1, 1, 1) },
    uOpacity: { value: opts.opacity ?? 1 },
  };
  // keep references to the shared lighting uniforms (not copies)
  for (const k in LIGHTING) uniforms[k] = LIGHTING[k];
  const m = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    vertexColors: opts.vertexColors ?? true,
    fog: true,
    transparent: (opts.opacity ?? 1) < 1,
    side: opts.side ?? THREE.FrontSide,
  });
  m.userData.toy = true;
  return m;
}

export function createOutlineMaterial(opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsLib.fog,
      uColor: { value: new THREE.Color(opts.color ?? 0x1a1426) },
      uThickness: { value: opts.thickness ?? 0.018 },
      uOpacity: { value: 1 },
    },
    vertexShader: OUTLINE_VERT,
    fragmentShader: OUTLINE_FRAG,
    side: THREE.BackSide,
    fog: true,
  });
}

const _v = new THREE.Vector3();
// Update the view-space light/up vectors once per frame.
export function updateLighting(camera, worldLightDir) {
  _v.copy(worldLightDir).normalize().transformDirection(camera.matrixWorldInverse);
  LIGHTING.uLightDir.value.copy(_v);
  _v.set(0, 1, 0).transformDirection(camera.matrixWorldInverse);
  LIGHTING.uUpView.value.copy(_v);
}
