// Frees GPU resources of everything under an object: geometries, materials
// and their textures. Safe for shared/cached resources too — three.js simply
// re-uploads them the next time they are rendered.
export function disposeTree(root) {
  const seen = new Set();
  const free = (x) => { if (x && !seen.has(x)) { seen.add(x); x.dispose?.(); } };
  root.traverse((o) => {
    free(o.geometry);
    if (o.isSkinnedMesh) free(o.skeleton); // bone texture
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const k of Object.keys(m)) if (m[k]?.isTexture) free(m[k]);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) free(u.value);
      free(m);
    }
  });
}
