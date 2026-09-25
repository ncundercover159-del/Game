// Loads optional GLB models (drop-in replacements for procedural figures).
// Bones are looked up by name so the procedural Animator can drive them.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const cache = new Map();

export async function loadModel(url) {
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url));
  const gltf = await cache.get(url);
  const root = skeletonClone(gltf.scene);
  const bones = {}, bind = {};
  root.traverse((o) => {
    if (o.isBone || o.type === 'Object3D') {
      if (o.name && !bones[o.name]) {
        bones[o.name] = o;
        bind[o.name] = { pos: o.position.clone(), quat: o.quaternion.clone() };
      }
    }
    if (o.isMesh) { o.castShadow = false; o.frustumCulled = !o.isSkinnedMesh; }
  });
  return { root, bones, bind, animations: gltf.animations };
}

export function disposeModelCache() { cache.clear(); }
export { THREE };
