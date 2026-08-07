// HAZARD PAY — a contractor, as geometry.
//
// ==========================================================================
//  MODULE INTERFACE — placeholder implementation. The art pass owns the
//  internals of this file and nothing else may.
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
//              forward, walked by step(dt, moving). Used while upright.
//
//  Exactly one of the two is visible at a time; the caller flips them.
// ==========================================================================

import * as THREE from 'three';

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
// distinguishable in a dim warehouse at twenty metres. Silhouette does most of
// the work up close; colour does it at distance.
const SLOT_HUES = [0.06, 0.55, 0.33, 0.86, 0.13, 0.71, 0.45, 0.95];

export function makeFigure(slot) {
  const hue = SLOT_HUES[slot % SLOT_HUES.length];
  const skin = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(hue, 0.62, 0.52), roughness: 0.72, metalness: 0.05,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(hue, 0.45, 0.22), roughness: 0.85, metalness: 0.05,
  });
  const hiviz = new THREE.MeshStandardMaterial({
    color: 0xf2c53d, roughness: 0.6, metalness: 0.0,
    emissive: 0x2a1e00, emissiveIntensity: 0.6,
  });

  // --- upright rig: origin at the feet, +Z forward ---
  const root = new THREE.Group();
  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  };

  const hips = box(0.36, 0.26, 0.24, dark, 0, 0.86, 0);
  const torso = box(0.40, 0.44, 0.26, hiviz, 0, 1.22, 0);
  const head = box(0.24, 0.26, 0.24, skin, 0, 1.58, 0);
  // A hard hat, so the silhouette reads as a person and not a fridge.
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hiviz);
  hat.position.set(0, 1.68, 0);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.02, 12), hiviz);
  brim.position.set(0, 1.68, 0.02);

  const armL = box(0.12, 0.42, 0.12, skin, -0.27, 1.16, 0);
  const armR = box(0.12, 0.42, 0.12, skin, 0.27, 1.16, 0);
  const legL = box(0.15, 0.44, 0.15, dark, -0.11, 0.56, 0);
  const legR = box(0.15, 0.44, 0.15, dark, 0.11, 0.56, 0);

  root.add(hips, torso, head, hat, brim, armL, armR, legL, legR);

  // --- ragdoll rig: eleven loose boxes, driven straight from the wire ---
  const rig = new THREE.Group();
  const bones = BONE_SIZES.map((s, i) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(s[0], s[1], s[2]),
      i === 2 ? skin : i === 1 ? hiviz : i >= 7 ? dark : skin,
    );
    m.castShadow = true;
    rig.add(m);
    return m;
  });
  rig.visible = false;

  const fig = {
    slot, root, rig, bones, yaw: 0,
    ragdoll: false, crouched: false, moving: false,
    phase: 0,
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
    step(dt, fast) {
      const speed = fast ? 11 : 7;
      const moved = fig.to.p.distanceToSquared(fig.from.p) > 1e-5;
      if (moved) fig.phase += dt * speed;
      else fig.phase += dt * 1.1; // idle sway, so nobody is a statue
      const s = Math.sin(fig.phase);
      const amp = moved ? 0.5 : 0.04;
      legL.rotation.x = s * amp;
      legR.rotation.x = -s * amp;
      armL.rotation.x = -s * amp * 0.8;
      armR.rotation.x = s * amp * 0.8;
      torso.position.y = 1.22 + Math.abs(s) * (moved ? 0.03 : 0.004);
    },
  };

  const holder = new THREE.Group();
  holder.add(root);
  holder.add(rig);
  fig.holder = holder;
  // The caller adds `root`; keep rig a sibling in world space so bone
  // transforms off the wire are not double-transformed by the figure's own
  // position. Attaching it to the scene separately is the simplest way.
  fig.rig = rig;
  fig.root = root;
  return fig;
}
