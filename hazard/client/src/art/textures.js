// HAZARD PAY — surfaces, generated at boot.
//
// There is no asset pipeline and there never will be, so every texture in the
// game is a few hundred lines of arithmetic run once into a DataTexture.
//
// Two decisions shape the whole file:
//
//  * ONE TEXTURE PER SURFACE, RGBA. RGB is albedo; ALPHA is height. Roughness,
//    ambient occlusion and the bump normal are all derived from that one height
//    channel in the shader (see materials.js). It is a lie physically — a pit
//    in concrete is not always rougher than the aggregate beside it — but it is
//    a lie that holds up, and it costs one texture fetch instead of three. On a
//    triplanar surface that is the difference between three samples a fragment
//    and nine.
//
//  * TILEABLE BY CONSTRUCTION. The noise lattice wraps at the tile edge, so a
//    46-metre warehouse floor has no seams. Repetition is broken up in the
//    shader with low-frequency mottling rather than by making the texture
//    bigger, because a 1024² concrete map costs a quarter-second of boot and
//    still repeats.

import * as THREE from 'three';

// 256 is the honest size for a prop you see at arm's length for two seconds.
// The four architectural surfaces are different: they cover essentially the
// whole screen, they are read at a metre and at thirty, and at 256 over a
// three-metre tile a texel is 1.2 cm — visibly soft the moment you stand next
// to a wall. They get 512. Everything else would be paying boot time for detail
// nobody looks at.
const SIZE = 256;
const BIG = new Set(['concrete', 'panel', 'deckplate', 'steelblue']);
const sizeOf = (name) => (BIG.has(name) ? 512 : SIZE);

// --- noise -------------------------------------------------------------------

/** Integer hash. Deterministic across runs, which matters for screenshot diffs. */
function hash2(x, y, s) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const wrapi = (i, p) => ((i % p) + p) % p;
const fract = (x) => x - Math.floor(x);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const mix = (a, b, t) => a + (b - a) * t;

function smooth(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/**
 * Value noise with period `cells` across the unit tile.
 *
 * The wrap is the whole point: the lattice index is taken modulo `cells`, so
 * u=0 and u=1 read the same corners and the texture tiles exactly.
 */
function vnoise(u, v, cells, s) {
  const x = u * cells, y = v * cells;
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const x0 = wrapi(xi, cells), x1 = wrapi(xi + 1, cells);
  const y0 = wrapi(yi, cells), y1 = wrapi(yi + 1, cells);
  const a = hash2(x0, y0, s), b = hash2(x1, y0, s);
  const c = hash2(x0, y1, s), d = hash2(x1, y1, s);
  return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
}

function fbm(u, v, cells, oct, s) {
  let f = 0, amp = 0.5, sum = 0, c = cells;
  for (let i = 0; i < oct; i++) {
    f += vnoise(u, v, c, s + i * 131) * amp;
    sum += amp; amp *= 0.5; c *= 2;
  }
  return f / sum;
}

/** Ridged noise: |2n-1| inverted. Veins, cracks, grain lines. */
function ridge(u, v, cells, oct, s) {
  return 1 - Math.abs(fbm(u, v, cells, oct, s) * 2 - 1);
}

/** Anisotropic fbm — stretched along u. Brushing, fur, wood. */
function streak(u, v, cells, aniso, oct, s) {
  let f = 0, amp = 0.5, sum = 0, c = cells;
  for (let i = 0; i < oct; i++) {
    f += vnoise(u, v, Math.max(1, Math.round(c / aniso)), s + i * 97) * 0
      + vnoise(u * (1 / aniso), v, c, s + i * 97) * amp;
    sum += amp; amp *= 0.5; c *= 2;
  }
  return f / sum;
}

// --- generators --------------------------------------------------------------
// Each writes [r, g, b, height] into `o`, all in 0..1. RGB is authored in
// display space because that is the space a human can reason about; the texture
// is flagged sRGB and the GPU decodes it.

const GEN = {
  // Poured floor slab: aggregate showing through a worn surface, broad pour
  // stains, and the hairline map crazing every warehouse floor has.
  // Poured floor slab: aggregate showing through a worn surface, broad pour
  // stains, and the hairline map crazing every warehouse floor has.
  //
  // Everything here is a lesson in restraint learnt the hard way. The first
  // version had aggregate at 110 cells, which on a 256-pixel map is two pixels
  // a stone — below Nyquist, so it did not read as aggregate, it read as
  // static. And the crazing threshold was wide enough that the ridged noise
  // came out as a thick reticulated network: from six metres up the floor
  // looked like camouflage netting, and the derivative bump put a bright rim on
  // every line of it. Concrete is a QUIET material. Its whole character is
  // large-scale patchiness with a fine tooth, and if you can see any single
  // feature of it from across the room you have overdone it.
  concrete(u, v, o) {
    const pour = fbm(u, v, 2, 3, 11);          // where one day's pour met the next
    const patch = fbm(u, v, 5, 3, 97);         // power-float swirl, wear, damp
    const grain = fbm(u, v, 14, 3, 23);        // the tooth
    const speck = vnoise(u, v, 56, 41);
    const stone = speck > 0.80 ? (speck - 0.80) / 0.20 : 0;
    const crack = ridge(u, v, 11, 2, 71);
    const crk = smooth(0.982, 0.999, crack);

    let l = 0.46 + (grain - 0.5) * 0.055 + (pour - 0.5) * 0.11;
    l *= mix(0.88, 1.06, smooth(0.30, 0.62, patch));
    l += stone * 0.13;
    l *= 1 - crk * 0.20;
    // Concrete is warm-grey when dry and cooler where it has been wet. Two
    // hues out of one material is nearly free and it is what stops a floor
    // this large from reading as a single flat value.
    const damp = smooth(0.52, 0.78, pour);
    o[0] = l * mix(1.05, 0.96, damp);
    o[1] = l * mix(1.00, 0.99, damp);
    o[2] = l * mix(0.92, 1.04, damp);
    // Height is mostly tooth. The crack contributes little: a deep crack in the
    // height channel is what threw the bright rims, and a real hairline crack
    // is a colour, not a valley.
    o[3] = clamp01(0.5 + (grain - 0.5) * 0.34 + stone * 0.30 - crk * 0.16);
  },

  // Corrugated wall cladding. The ribs run along one texture axis, which under
  // box projection means they stand vertically on every wall — which is how
  // cladding is actually hung.
  // Corrugated wall cladding. The ribs run along one texture axis, which under
  // box projection means they stand vertically on every wall — which is how
  // cladding is actually hung.
  //
  // Eight ribs across a 3.2 m tile is a 40 cm pitch, which is real. The count
  // and the tile have to be chosen together: the tile also sets how often the
  // whole sheet repeats along a forty-six metre wall, and at the old four ribs
  // per 2.1 m the wall showed twenty-two copies of the same rust patch in a
  // dead-straight grid. Fewer, wider repeats plus quieter blemishes.
  //
  // The rib SHADING is the other half. It used to swing the albedo by half,
  // which is a painted stripe, not a fold in a metal sheet. A fold is a normal,
  // so it belongs almost entirely in the height channel where the light can
  // decide what it looks like; the albedo keeps a hint of it and no more.
  panel(u, v, o) {
    const ribs = 8;
    const phase = fract(u * ribs);
    // Trapezoidal, not sinusoidal: cladding has a flat crown and a flat valley
    // with a short web between them, and the flats are what catch a highlight.
    const tri = Math.abs(phase - 0.5) * 2;
    const ribH = 1 - smooth(0.22, 0.78, tri);
    const dirt = fbm(u, v, 4, 4, 3);
    const streaks = streak(u, v, 20, 7, 3, 29);   // rain runs, vertical on a wall
    const rustAt = smooth(0.70, 0.92, fbm(u, v, 13, 3, 53)) * smooth(0.4, 0.85, streaks);
    // Sheet joints only at the tile edge. An earlier version put three across
    // the tile and the wall came out looking like brickwork.
    const seam = smooth(0.994, 1.0, Math.abs(Math.cos(v * Math.PI)));

    let r = 0.47, g = 0.50, b = 0.50;
    const shade = 0.92 + 0.14 * ribH;
    r *= shade; g *= shade; b *= shade;
    const grime = mix(0.80, 1.06, dirt) * mix(0.92, 1.04, streaks);
    r *= grime; g *= grime; b *= grime * 0.96;
    // Rust bleeds warm and kills the paint's slight green.
    r = mix(r, 0.42, rustAt); g = mix(g, 0.23, rustAt); b = mix(b, 0.13, rustAt);
    r *= 1 - seam * 0.45; g *= 1 - seam * 0.45; b *= 1 - seam * 0.45;
    o[0] = r; o[1] = g; o[2] = b;
    o[3] = clamp01(ribH * 0.78 + 0.11 - seam * 0.45 - rustAt * 0.18 + (dirt - 0.5) * 0.12);
  },

  // Profiled steel deck: wide trapezoidal ribs with a fine tread pattern in the
  // pans between them.
  //
  // This one material is the whole ceiling of the warehouse — fifteen hundred
  // square metres of it — as well as the mezzanine, the loading dock and the
  // ramp. It was chequer plate, and at ceiling distance chequer plate is a
  // dot screen: a small high-contrast motif repeated tens of thousands of times
  // is, at four degrees of grazing angle, indistinguishable from noise, and the
  // chromatic aberration then painted the noise red and blue.
  //
  // The answer is DETAIL AT TWO SCALES. The rib is the far read: eighty
  // centimetres of pitch, so at thirty metres it is still a dozen pixels wide
  // and the roof reads as a roof. The tread is the near read: it survives to
  // about four metres and mips harmlessly away after that. Neither one is doing
  // the other's job, which is the mistake the chequer plate was making.
  deckplate(u, v, o) {
    // --- far read: three ribs across the tile ---
    const ribs = 3;
    const phase = fract(v * ribs);
    const tri = Math.abs(phase - 0.5) * 2;
    const crown = 1 - smooth(0.30, 0.62, tri);      // flat top of the rib
    const web = smooth(0.30, 0.62, tri) * (1 - smooth(0.62, 0.94, tri));

    // --- near read: tread in the pans, killed on the rib crowns ---
    const cells = 8;
    const gy = v * cells;
    const row = Math.floor(gy);
    const dir = row % 2 === 0 ? 1 : -1;
    const fx = fract(u * cells + (row % 2) * 0.5) - 0.5;
    const fy = fract(gy) - 0.5;
    const a = dir * 0.62;
    const rx = fx * Math.cos(a) - fy * Math.sin(a);
    const ry = fx * Math.sin(a) + fy * Math.cos(a);
    const bar = 1 - smooth(0.70, 1.05, Math.max(Math.abs(rx) / 0.30, Math.abs(ry) / 0.12));

    const wear = fbm(u, v, 6, 3, 5);
    const grime = fbm(u, v, 18, 3, 19);
    // Low contrast on purpose, and lower on the tread than on the rib. Contrast
    // is what turns minification into moiré, and the tread is the part that
    // gets minified.
    let l = 0.30 + 0.09 * grime;
    l = mix(l, l * 1.14, bar * (1 - crown));        // tread tops, polished
    l *= 1 + crown * 0.30 - web * 0.10;             // the rib itself
    l *= mix(0.94, 1.05, wear);
    o[0] = l * 1.0; o[1] = l * 1.01; o[2] = l * 1.06;
    o[3] = clamp01(0.24 + crown * 0.52 + bar * 0.16 * (1 - crown) + (grime - 0.5) * 0.10);
  },

  // Open steel grating: bearing bars one way, twisted cross rods the other,
  // and a lot of nothing in between.
  grate(u, v, o) {
    const bars = 9;
    const bx = Math.abs(fract(u * bars) - 0.5) * 2;
    const bar = 1 - smooth(0.42, 0.68, bx);
    const cy = Math.abs(fract(v * 3) - 0.5) * 2;
    const cross = 1 - smooth(0.72, 0.92, cy);
    const solid = Math.max(bar * 0.9, cross);
    const grime = fbm(u, v, 18, 3, 31);

    const l = mix(0.055, 0.42 + 0.14 * grime, solid);
    o[0] = l * 0.99; o[1] = l; o[2] = l * 1.04;
    o[3] = clamp01(solid * 0.85 + 0.05);
  },

  // Racking upright: enamel over pressed steel, chipped down to primer at every
  // corner a forklift has ever found.
  steelblue(u, v, o) {
    const chip = vnoise(u, v, 26, 7);
    const chipMask = smooth(0.74, 0.86, chip);
    const scuff = streak(u, v, 30, 5, 3, 13);
    const dirt = fbm(u, v, 6, 3, 61);
    const hole = smooth(0.90, 0.98, ridge(u, v, 14, 2, 9));

    // Lifted off the old 0.21/0.38/0.58. There are three hundred metres of this
    // in the level, most of it lit by nothing but bounce, and at that value it
    // measured as twenty-three per cent of the frame at absolute black. A real
    // racking blue is lighter than you think; it only looks dark next to paper.
    let r = 0.27, g = 0.45, b = 0.66;
    const s = mix(0.82, 1.14, scuff) * mix(0.88, 1.04, dirt);
    r *= s; g *= s; b *= s;
    // Chipped paint shows grey primer, not bare steel — this is cheap racking.
    r = mix(r, 0.40, chipMask); g = mix(g, 0.38, chipMask); b = mix(b, 0.35, chipMask);
    r *= 1 - hole * 0.5; g *= 1 - hole * 0.5; b *= 1 - hole * 0.5;
    o[0] = r; o[1] = g; o[2] = b;
    o[3] = clamp01(0.55 + (scuff - 0.5) * 0.3 - chipMask * 0.25 - hole * 0.5);
  },

  // Safety yellow with hazard chevrons, worn through where boots land.
  railing(u, v, o) {
    const band = fract((u + v) * 3.0);
    const dark = smooth(0.46, 0.52, band) * (1 - smooth(0.96, 1.0, band));
    const wear = fbm(u, v, 9, 4, 29);
    const scratch = smooth(0.88, 0.99, ridge(u, v, 26, 2, 77));

    let r = 0.78, g = 0.58, b = 0.09;
    r = mix(r, 0.09, dark); g = mix(g, 0.085, dark); b = mix(b, 0.08, dark);
    const w = mix(0.78, 1.10, wear);
    r *= w; g *= w; b *= w;
    r = mix(r, 0.40, scratch * 0.8); g = mix(g, 0.39, scratch * 0.8); b = mix(b, 0.37, scratch * 0.8);
    o[0] = r; o[1] = g; o[2] = b;
    o[3] = clamp01(0.5 + (wear - 0.5) * 0.4 - scratch * 0.35);
  },

  // Scaffold board: coarse softwood, saw marks along the length, knots.
  plank(u, v, o) {
    const boards = 3;
    const bi = Math.floor(v * boards);
    const inBoard = fract(v * boards);
    const seam = 1 - smooth(0.0, 0.035, Math.min(inBoard, 1 - inBoard));
    const warp = streak(u, v, 4, 6, 3, 7 + bi * 23) * 0.6;
    const rings = fract((inBoard + warp) * 7 + bi * 0.37);
    const grain = smooth(0.0, 0.35, rings) * (1 - smooth(0.55, 0.95, rings));
    const fibre = streak(u, v, 90, 14, 2, 41);

    // Knots: a couple of seeded blobs per board, elongated across the grain.
    let knot = 0;
    for (let k = 0; k < 3; k++) {
      const kx = hash2(bi * 7 + k, 3, 5), ky = hash2(bi * 7 + k, 11, 9);
      let dx = Math.abs(fract(u - kx + 0.5) - 0.5) * 2.2;
      const dy = Math.abs(inBoard - (0.25 + ky * 0.5)) * 3.4;
      dx *= 1.6;
      knot = Math.max(knot, 1 - smooth(0.05, 0.30, Math.hypot(dx, dy)));
    }

    let l = 0.40 + grain * 0.16 + (fibre - 0.5) * 0.10;
    l = mix(l, 0.15, knot * 0.85);
    l *= 1 - seam * 0.55;
    o[0] = l * 1.22; o[1] = l * 0.95; o[2] = l * 0.62;
    o[3] = clamp01(0.5 + grain * 0.35 + (fibre - 0.5) * 0.4 - seam * 0.5 - knot * 0.3);
  },

  // Conveyor belting: lateral cleats, rubber crumb, and years of grease.
  rubber(u, v, o) {
    const rib = Math.abs(fract(v * 9) - 0.5) * 2;
    const cleat = 1 - smooth(0.55, 0.78, rib);
    const crumb = fbm(u, v, 70, 2, 3);
    const grease = fbm(u, v, 5, 3, 47);
    const scuff = streak(u, v, 24, 6, 2, 67);

    let l = 0.115 + crumb * 0.055 + cleat * 0.04;
    l *= mix(0.78, 1.32, grease * 0.6 + scuff * 0.4);
    o[0] = l * 1.04; o[1] = l; o[2] = l * 0.96;
    o[3] = clamp01(0.35 + cleat * 0.45 + (crumb - 0.5) * 0.35);
  },

  // --- prop surfaces --------------------------------------------------------
  // These sit near white on purpose. Prop colour is baked into vertex colours
  // (see props.js) so seventeen kinds of object share ten materials, and the
  // texture only supplies the material's character.

  ceramic(u, v, o) {
    const pin = vnoise(u, v, 130, 13);
    const glaze = fbm(u, v, 8, 3, 5);
    const craze = smooth(0.93, 0.99, ridge(u, v, 10, 3, 21));
    const l = mix(0.90, 1.0, glaze) - (pin > 0.93 ? 0.16 : 0) - craze * 0.12;
    o[0] = l; o[1] = l * 0.995; o[2] = l * 0.98;
    o[3] = clamp01(0.55 + (glaze - 0.5) * 0.3 - craze * 0.4);
  },

  plastic(u, v, o) {
    const pebble = vnoise(u, v, 150, 3) * 0.6 + vnoise(u, v, 75, 19) * 0.4;
    const yellowing = fbm(u, v, 4, 2, 31);
    const l = 0.88 + (pebble - 0.5) * 0.14;
    o[0] = l * mix(0.99, 1.02, yellowing);
    o[1] = l * mix(0.98, 1.0, yellowing);
    o[2] = l * mix(0.97, 0.92, yellowing);
    o[3] = clamp01(0.5 + (pebble - 0.5) * 0.85);
  },

  metal(u, v, o) {
    const brush = streak(u, v, 120, 22, 3, 11);
    const dent = fbm(u, v, 7, 3, 43);
    const smudge = fbm(u, v, 14, 3, 71);
    const l = 0.80 + (brush - 0.5) * 0.20 + (dent - 0.5) * 0.07;
    o[0] = l * 0.99; o[1] = l; o[2] = l * 1.03;
    o[3] = clamp01(0.5 + (brush - 0.5) * 0.6 + (smudge - 0.5) * 0.25);
  },

  glass(u, v, o) {
    const smear = streak(u, v, 12, 4, 3, 17);
    const dust = vnoise(u, v, 90, 53);
    const l = 0.94 + (smear - 0.5) * 0.10 - (dust > 0.95 ? 0.12 : 0);
    o[0] = l * 0.96; o[1] = l; o[2] = l * 1.02;
    o[3] = clamp01(0.5 + (smear - 0.5) * 0.25);
  },

  fabric(u, v, o) {
    // A plain weave: warp and weft on alternating half-cycles.
    const wu = Math.abs(fract(u * 46) - 0.5) * 2;
    const wv = Math.abs(fract(v * 46) - 0.5) * 2;
    const over = fract(u * 23) < 0.5 !== fract(v * 23) < 0.5;
    const thread = over ? 1 - wu : 1 - wv;
    const fluff = fbm(u, v, 40, 2, 23);
    const l = 0.72 + thread * 0.24 + (fluff - 0.5) * 0.10;
    o[0] = l; o[1] = l * 0.99; o[2] = l * 0.98;
    o[3] = clamp01(0.35 + thread * 0.55 + (fluff - 0.5) * 0.2);
  },

  fur(u, v, o) {
    const hair = streak(u, v, 150, 9, 3, 7);
    const clump = streak(u, v, 26, 5, 3, 29);
    const l = 0.72 + (hair - 0.5) * 0.34 + (clump - 0.5) * 0.22;
    o[0] = l * 1.05; o[1] = l * 0.96; o[2] = l * 0.86;
    o[3] = clamp01(0.5 + (hair - 0.5) * 0.8 + (clump - 0.5) * 0.3);
  },

  card(u, v, o) {
    const fibre = streak(u, v, 100, 4, 3, 3);
    const tooth = vnoise(u, v, 170, 61);
    const l = 0.93 + (fibre - 0.5) * 0.07 + (tooth - 0.5) * 0.05;
    o[0] = l; o[1] = l * 0.995; o[2] = l * 0.975;
    o[3] = clamp01(0.5 + (tooth - 0.5) * 0.5 + (fibre - 0.5) * 0.3);
  },

  lacquer(u, v, o) {
    // French polish: almost nothing, which is the look. Faint swirl marks and
    // the occasional dust nib caught under the finish.
    const swirl = streak(u, v, 60, 30, 2, 19);
    const nib = vnoise(u, v, 140, 83);
    const l = 0.92 + (swirl - 0.5) * 0.06 - (nib > 0.965 ? 0.10 : 0);
    o[0] = l * 1.01; o[1] = l; o[2] = l * 0.98;
    o[3] = clamp01(0.5 + (swirl - 0.5) * 0.2 + (nib > 0.965 ? -0.3 : 0));
  },

  enamel(u, v, o) {
    const chip = vnoise(u, v, 34, 11);
    const chipped = smooth(0.86, 0.94, chip);
    const stain = fbm(u, v, 6, 3, 37);
    const rim = smooth(0.90, 0.99, ridge(u, v, 9, 3, 55));
    let l = 0.95 - (1 - stain) * 0.10;
    l = mix(l, 0.30, chipped);          // chips show cast iron under the enamel
    l *= 1 - rim * 0.18;
    o[0] = l; o[1] = l * 0.995; o[2] = l * 0.985;
    o[3] = clamp01(0.55 - chipped * 0.4 - rim * 0.2 + (stain - 0.5) * 0.2);
  },

  rust(u, v, o) {
    const scale = fbm(u, v, 9, 4, 13);
    const flake = smooth(0.55, 0.72, fbm(u, v, 28, 3, 67));
    const pit = smooth(0.88, 0.98, ridge(u, v, 22, 2, 91));
    let r = mix(0.34, 0.62, scale), g = mix(0.15, 0.30, scale), b = mix(0.07, 0.12, scale);
    const f = mix(0.85, 1.15, flake);
    r *= f; g *= f; b *= f;
    r *= 1 - pit * 0.55; g *= 1 - pit * 0.55; b *= 1 - pit * 0.55;
    o[0] = r; o[1] = g; o[2] = b;
    o[3] = clamp01(0.5 + (scale - 0.5) * 0.5 + flake * 0.25 - pit * 0.6);
  },

  // What is left after something valuable meets a concrete floor.
  broken(u, v, o) {
    const shard = ridge(u, v, 7, 2, 3);
    const edge = smooth(0.80, 0.96, shard);
    const soot = fbm(u, v, 12, 3, 29);
    const dust = vnoise(u, v, 80, 47);
    let l = 0.20 + soot * 0.12 + (dust - 0.5) * 0.06;
    l = mix(l, 0.34, edge);
    o[0] = l * 1.02; o[1] = l; o[2] = l * 0.97;
    o[3] = clamp01(0.4 + edge * 0.5 + (dust - 0.5) * 0.3);
  },

  // A contractor's overalls and gloves. Cloth, but coarser than upholstery, and
  // with the grime of a job that pays by the hazard.
  overall(u, v, o) {
    const twill = Math.abs(fract((u * 2 + v) * 30) - 0.5) * 2;
    const weave = 1 - smooth(0.25, 0.75, twill);
    const fluff = fbm(u, v, 34, 3, 17);
    const grime = fbm(u, v, 5, 3, 83);
    const l = (0.76 + weave * 0.20 + (fluff - 0.5) * 0.12) * mix(0.84, 1.06, grime);
    o[0] = l; o[1] = l * 0.995; o[2] = l * 0.99;
    o[3] = clamp01(0.4 + weave * 0.45 + (fluff - 0.5) * 0.3);
  },

  // Hard hats, boot rubber and the retro-reflective bands on a hi-viz vest.
  gear(u, v, o) {
    const mould = fbm(u, v, 30, 3, 5);
    const scuff = streak(u, v, 22, 7, 3, 61);
    const nick = smooth(0.93, 0.99, ridge(u, v, 30, 2, 23));
    const l = (0.90 + (mould - 0.5) * 0.10) * mix(0.90, 1.06, scuff) - nick * 0.16;
    o[0] = l; o[1] = l; o[2] = l * 1.01;
    o[3] = clamp01(0.5 + (mould - 0.5) * 0.4 - nick * 0.5);
  },

  unknown(u, v, o) {
    const c = (Math.floor(u * 8) + Math.floor(v * 8)) % 2;
    o[0] = c; o[1] = 0; o[2] = 1 - c; o[3] = 0.5;
  },
};

// --- assembly ----------------------------------------------------------------

const cache = new Map();

function build(name) {
  const gen = GEN[name] || GEN.unknown;
  const n = sizeOf(name);
  const data = new Uint8Array(n * n * 4);
  const o = [0, 0, 0, 0];
  for (let y = 0; y < n; y++) {
    const v = (y + 0.5) / n;
    for (let x = 0; x < n; x++) {
      gen((x + 0.5) / n, v, o);
      const i = (y * n + x) * 4;
      data[i] = clamp01(o[0]) * 255;
      data[i + 1] = clamp01(o[1]) * 255;
      data[i + 2] = clamp01(o[2]) * 255;
      data[i + 3] = clamp01(o[3]) * 255;
    }
  }

  const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  // sRGB on an RGBA8 texture decodes RGB in hardware and leaves ALPHA linear,
  // which is exactly what we want: colour in display space, height in linear.
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  // The ceiling of this warehouse is fifteen hundred square metres of metal
  // deck seen at four degrees. Trilinear alone picks a mip for the WORST axis
  // and turns it to porridge; anisotropic filtering is the only thing that
  // keeps a receding floor from either shimmering or dissolving. Three clamps
  // this to whatever the hardware will do.
  tex.anisotropy = 16;
  tex.name = `tex:${name}`;
  tex.needsUpdate = true;
  return tex;
}

/**
 * The one shared texture for a named surface. Generated on first ask, which
 * means a level that never uses grating never pays for it.
 *
 * @param {string} name generator name; unknown names get a debug chequer
 * @returns {THREE.DataTexture} RGB albedo, A height. Shared; never dispose it.
 */
export function surfaceTexture(name) {
  const key = GEN[name] ? name : 'unknown';
  let t = cache.get(key);
  if (!t) { t = build(key); cache.set(key, t); }
  return t;
}

export const TEXTURE_NAMES = Object.keys(GEN);
