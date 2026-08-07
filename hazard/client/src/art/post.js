// HAZARD PAY — post-processing.
//
// ==========================================================================
//  MODULE INTERFACE — placeholder. The art pass owns the internals of this
//  file and nothing else may.
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

/**
 * The no-op chain: draw the scene, nothing else.
 *
 * @returns {{render:(dt:number)=>void, setSize:(w:number,h:number)=>void, dispose:()=>void}}
 */
export function installPost(renderer, scene, camera) {
  return {
    render() { renderer.render(scene, camera); },
    setSize() { /* the renderer is sized by the caller */ },
    dispose() { },
  };
}
