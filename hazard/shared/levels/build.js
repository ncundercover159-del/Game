// HAZARD PAY — level authoring helpers.
//
// A level is plain data: a list of boxes, a list of props, a list of lights.
// Both the server (Rapier colliders) and the client (Three meshes) build from
// the same arrays, so a wall can never be somewhere the renderer disagrees
// with. These helpers just make the data less tedious to type.
//
// Convention: `p` is the CENTRE of a box, `s` is its FULL extents, `r` is euler
// XYZ in radians. Y is up. Materials are names, not colours — the render pass
// owns what 'concrete' means.

export const box = (p, s, mat = 'concrete', extra) => ({ p, s, mat, ...extra });

/** A room shell: floor, ceiling and four walls, hollow inside. */
export function shell(cx, cz, w, d, h, mat = 'concrete', t = 0.6, opts = {}) {
  const out = [
    box([cx, -t / 2, cz], [w + t * 2, t, d + t * 2], opts.floorMat || mat, { tag: 'floor' }),
  ];
  if (!opts.open) {
    out.push(box([cx, h + t / 2, cz], [w + t * 2, t, d + t * 2], opts.ceilMat || mat, { tag: 'ceiling' }));
  }
  const wm = opts.wallMat || mat;
  out.push(
    box([cx, h / 2, cz - d / 2 - t / 2], [w + t * 2, h, t], wm, { tag: 'wall' }),
    box([cx, h / 2, cz + d / 2 + t / 2], [w + t * 2, h, t], wm, { tag: 'wall' }),
    box([cx - w / 2 - t / 2, h / 2, cz], [t, h, d], wm, { tag: 'wall' }),
    box([cx + w / 2 + t / 2, h / 2, cz], [t, h, d], wm, { tag: 'wall' }),
  );
  return out;
}

/**
 * Pallet racking. The bays are walkable-through at floor level and the decks
 * are climbable, which is the point: the good stuff goes on the top deck.
 */
export function racking(cx, cz, bays, decks, opts = {}) {
  const bayW = opts.bayW || 2.7;
  const depth = opts.depth || 1.1;
  const deckH = opts.deckH || 2.15;
  const rot = opts.rot || 0;
  const out = [];
  const halfW = (bays * bayW) / 2;

  const place = (lx, ly, lz, sx, sy, sz, mat, tag) => {
    const c = Math.cos(rot), s = Math.sin(rot);
    out.push(box(
      [cx + lx * c - lz * s, ly, cz + lx * s + lz * c],
      rot ? [sz, sy, sx] : [sx, sy, sz],
      mat, { tag },
    ));
  };

  // uprights
  for (let i = 0; i <= bays; i++) {
    const lx = -halfW + i * bayW;
    for (const lz of [-depth / 2, depth / 2]) {
      place(lx, (decks * deckH) / 2, lz, 0.12, decks * deckH, 0.12, 'steelblue', 'strut');
    }
  }
  // decks
  for (let d = 1; d <= decks; d++) {
    place(0, d * deckH, 0, bays * bayW, 0.09, depth, 'steelblue', 'deck');
  }
  return out;
}

/** A straight run of steel stairs, as a staircase of boxes. */
export function stairs(from, to, width = 1.4, mat = 'grate') {
  const out = [];
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
  const run = Math.hypot(dx, dz);
  const steps = Math.max(2, Math.round(dy / 0.21));
  const nx = dx / run, nz = dz / run;
  const stepRun = run / steps;
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps;
    const h = from[1] + dy * ((i + 1) / steps);
    out.push(box(
      [from[0] + dx * t, h / 2, from[2] + dz * t],
      [Math.abs(nx) > Math.abs(nz) ? stepRun : width, h, Math.abs(nx) > Math.abs(nz) ? width : stepRun],
      mat, { tag: 'stair' },
    ));
  }
  return out;
}

/** A catwalk with kick rails, so falling off it takes commitment. */
export function catwalk(p, s, mat = 'grate') {
  return [
    box(p, s, mat, { tag: 'catwalk' }),
    box([p[0], p[1] + 0.55, p[2] - s[2] / 2], [s[0], 1.1, 0.06], 'railing', { tag: 'rail', thin: true }),
    box([p[0], p[1] + 0.55, p[2] + s[2] / 2], [s[0], 1.1, 0.06], 'railing', { tag: 'rail', thin: true }),
  ];
}

export const prop = (kind, p, r) => (r ? { kind, p, r } : { kind, p });

/**
 * Scatter n props of a kind across a region, deterministically.
 *
 * `extent` is horizontal only and the drop height is fixed and tiny on purpose.
 * Gravity here is -22, so a prop authored even 25cm above its resting place
 * lands at 3.3m/s — past the point where a mug survives. Authors should be able
 * to sprinkle a hundred fragile things around without quietly destroying them
 * all before anybody arrives.
 */
export function scatter(kind, centre, extent, n, seed = 1) {
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(prop(kind, [
      centre[0] + (rnd() - 0.5) * extent[0],
      centre[1] + 0.03,
      centre[2] + (rnd() - 0.5) * extent[2],
    ], [0, rnd() * Math.PI * 2, 0]));
  }
  return out;
}

export const light = (p, opts = {}) => ({
  p, color: opts.color || '#ffe9c4', intensity: opts.intensity ?? 12,
  range: opts.range ?? 14, ...opts,
});
