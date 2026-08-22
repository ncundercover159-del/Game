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
  // A SOLID BACK, WHEN THE LEVEL ASKS FOR ONE.
  //
  // Not for realism — real pallet racking is open both sides — but because a
  // 46x34m shed with nothing vertical in it gives its lamps nowhere to land
  // except the floor. Measured, the brightest region in four frames out of five
  // was the concrete at the player's boots, and it won by default: it was the
  // only surface within reach of a pendant. A backed bay turns each aisle into a
  // corridor with lit walls, which is what puts a bright band at eye level and
  // gives a silhouette something to read against.
  //
  // `opts.back` is a side, -1 or +1, so a row can be closed on its outboard face
  // and stay open to the aisle a contractor actually walks down.
  if (opts.back) {
    // ABOVE HEAD HEIGHT ONLY, and the reason is that the first version of this
    // sealed the level.
    //
    // `side` is a LOCAL Z offset, and with rot=0 that is world Z. A row is
    // `bays * bayW` long in X and only `depth` deep in Z, so its large faces are
    // the +/-Z ones — which is right for making an aisle read as a corridor, and
    // catastrophically wrong at full height. A grading pass found the result:
    // solid 10.8 x 6.45m panels at z = -9.61, 1.39 and 10.39, colliding, cutting
    // the west and east thirds of the shed into three sealed compartments each.
    // The quota route runs down x=0 and is clear, which is exactly why no test
    // failed and why it took somebody photographing an aisle to notice.
    //
    // From 2.2m up, so a contractor walks under it and the light still lands on
    // it. That is not a compromise — it is better for the thing the panel was
    // added for, because a lit surface between 2.2m and 6.45m projects HIGH in
    // frame, which is where the bright region is supposed to be.
    const side = Math.sign(opts.back) * (depth / 2 + 0.06);
    const top = decks * deckH;
    const under = Math.min(2.2, top - 0.4);
    place(0, (under + top) / 2, side, bays * bayW, top - under, 0.08,
      opts.backMat || 'structsteel', 'rackback');
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

/**
 * A catwalk with kick rails, so falling off it takes commitment.
 *
 * The rails go on the LONG sides. Railing a fixed pair of faces looks harmless
 * until somebody authors a walkway that runs along Z, at which point the rails
 * land across both ends and wall the gantry off completely — you cannot get on
 * or off it, and nothing about the level data says so.
 */
export function catwalk(p, s, mat = 'grate') {
  const alongX = s[0] >= s[2];
  const rail = (dx, dz) => box(
    [p[0] + dx, p[1] + 0.55, p[2] + dz],
    alongX ? [s[0], 1.1, 0.06] : [0.06, 1.1, s[2]],
    'railing', { tag: 'rail', thin: true },
  );
  return [
    box(p, s, mat, { tag: 'catwalk' }),
    alongX ? rail(0, -s[2] / 2) : rail(-s[0] / 2, 0),
    alongX ? rail(0, s[2] / 2) : rail(s[0] / 2, 0),
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
