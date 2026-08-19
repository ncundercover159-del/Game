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
//
// AND THE RULE THAT CAME OUT OF MEASURING, WHICH GOVERNS EVERY GENERATOR BELOW:
//
//    HIGH-FREQUENCY DETAIL LIVES IN THE HEIGHT CHANNEL. ALBEDO STAYS LOW.
//
// Two lamps a metre under a fifteen-hundred-square-metre ceiling were throwing
// straight rosettes a third of the way across the frame. The obvious suspects
// were the relief and the gloss — a bumped normal on a semi-metallic surface is
// the usual way to make a mirror out of aliasing — so all three were tested by
// mutating the shipped material live and re-photographing the same frame:
//
//    flatten the HEIGHT channel  -> no change whatsoever
//    metalness 0, envMap 0       -> no change whatsoever
//    flatten the ALBEDO channel  -> gone, completely, first try
//
// It was never the lighting. It was plain minification aliasing in the colour,
// beating against the radial falloff of a nearby lamp, and no amount of
// anisotropic filtering fixes it because at four degrees of grazing angle the
// footprint ratio is far past any hardware's tap budget.
//
// Height is exempt because it reaches the frame through a screen-space
// derivative that averages to nothing as the texel shrinks, and through a
// grazing-angle fade on top of that. So a floor can have all the tooth it wants
// at five millimetres — you will feel it at two metres and it will vanish by
// twenty, which is exactly what relief does in the real world. Colour cannot do
// that. Anything repeated ten thousand times must be QUIET IN ALBEDO.

import * as THREE from 'three';

// 256 is the honest size for a prop you see at arm's length for two seconds.
// The four architectural surfaces are different: they cover essentially the
// whole screen, they are read at a metre and at thirty, and at 256 over a
// three-metre tile a texel is 1.2 cm — visibly soft the moment you stand next
// to a wall. They get 512. Everything else would be paying boot time for detail
// nobody looks at.
const SIZE = 256;
const BIG = new Set(['concrete', 'panel', 'deckplate', 'dockdeck', 'steelblue']);
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
  // Poured floor slab: saw-cut into bays, power-floated, stained by whatever
  // has stood on it, with a fine tooth you can only see up close.
  //
  // TWO FEATURES WERE DELETED FROM THIS AND BOTH DELETIONS ARE THE POINT.
  //
  // It had ridged noise thresholded into hairline cracks. Ridged noise
  // thresholded near its peak does not produce cracks, it produces the CONTOUR
  // LINES of the noise field: metre-scale closed loops that wander across the
  // floor like the height lines on an Ordnance Survey map. From standing height
  // the warehouse looked like somebody had been at it with a biro. A crack in a
  // slab is short, straight-ish and follows a stress line; if you want cracks,
  // draw cracks, and if you want a surface, do not let a noise function's
  // level sets become the largest thing in the picture.
  //
  // And it had aggregate as a threshold on 38-cell value noise, which is a
  // fifteen-centimetre SMOOTH BLOB, brightened by thirteen per cent. Those are
  // not stones. Those are the pale splatters that made the floor look like it
  // had been dust-sheeted. Aggregate in a power-floated slab is barely a colour
  // at all — the trowel brings the fines to the top — so it is in height now,
  // where it belongs, and it is small.
  //
  // What replaces both is the thing a warehouse floor actually has and this did
  // not: the saw-cut joint grid. It is the only feature on a slab you can see
  // from the far wall, it is straight, and being straight it is the one thing
  // in the whole texture set that tells you which way the building runs.
  // AND THE THIRD DELETION, WHICH IS A LESSON ABOUT THE OTHER TWO.
  //
  // With the biro doodles and the snow-splatter gone, the floor measured a
  // standard deviation of 3.0 out of 255 and a review called it dirty lino.
  // Both earlier notes were right about WHAT to remove and wrong about what
  // to leave: taking out the two loud wrong features left nothing behind but
  // eight per cent of pour drift and seven per cent of float swirl, and a
  // surface with no contrast in it is not restrained, it is blank.
  //
  // The rule is not "albedo stays quiet". It is:
  //
  //     ALBEDO CONTRAST IS FINE. ALBEDO FREQUENCY IS WHAT ALIASES.
  //
  // A two-metre oil stain at twenty-five per cent can be seen from the far
  // wall and cannot alias at any distance, because at thirty metres it is
  // still forty pixels across. A five-centimetre pale speck at thirteen per
  // cent is invisible at two metres and a screen of crawling dots at twenty.
  // Everything added below is metre-scale and carries real contrast;
  // everything already here that was centimetre-scale has come down.
  //
  // What a working warehouse floor actually has, in order of how far away you
  // can see it: saw-cut bay joints, then spills, then dust. So it has those.
  concrete(u, v, o) {
    const pour = fbm(u, v, 2, 3, 11);          // where one day's pour met the next
    const patch = fbm(u, v, 4, 2, 97);         // power-float swirl, wear, damp
    const tooth = fbm(u, v, 40, 3, 23);        // the fine surface — HEIGHT
    // Aggregate. Finer and much weaker than it was: at 115 cells over a 5.6 m
    // tile these were 5 cm blobs driving a 0.42 cavity-occlusion term, which is
    // a five-centimetre dark dot every five centimetres over fifteen hundred
    // square metres. That is the "uniform white speckle" a review read as snow;
    // it was in height rather than colour, but a strong enough cavity term
    // turns height into colour and the channel rule does not save you.
    const grit = vnoise(u, v, 170, 41);

    // The joint sits at the middle of the tile, not on the seam: a feature
    // straddling u=0 is a feature the wrap has to filter across, and this one
    // is three texels wide.
    const jd = Math.min(Math.abs(u - 0.5), Math.abs(v - 0.5));
    const joint = 1 - smooth(0.0030, 0.0110, jd);
    // Concrete either side of a cut is the part that gets chipped and swept,
    // so it is paler than the field. A joint with a bright shoulder reads at
    // three times the distance of a joint without one.
    const shoulder = (1 - smooth(0.011, 0.055, jd)) * (1 - joint);

    // Spills. Thresholded low-frequency noise, so the edges are definite the
    // way a puddle of gear oil is definite, rather than a soft gradient.
    // Roughly a 1.9 m feature — unmissable at the far wall, unable to alias.
    //
    // THINNED, because it was reading as holes in the floor. At a 0.545
    // threshold on three octaves these covered most of a bay, and mixing 80%
    // of the way to a 0.13 grey took a 0.415 slab down past anything that could
    // still be called concrete — a shot of the racking aisle came back with
    // three-metre black amoebas across the floor that no reasonable viewer
    // reads as oil. Higher threshold for less of it, and see below: what makes
    // a spill legible is not that it is dark, it is that it is WET.
    const spill = smooth(0.600, 0.700, fbm(u, v, 3, 3, 71));
    // ...and the pale opposite: dust, plaster, efflorescence out of the slab.
    const bloom = smooth(0.60, 0.80, fbm(u, v, 2, 2, 137));

    let l = 0.415 + (pour - 0.5) * 0.095;
    l *= mix(0.89, 1.08, smooth(0.28, 0.68, patch));
    // Mostly a groove, only slightly a line. A saw cut fills with dirt and goes
    // dark, but if the darkening carries the feature then at thirty metres the
    // joint is a one-pixel black wire and it crawls.
    l *= 1 - joint * 0.24;
    l *= 1 + shoulder * 0.10;
    l *= 1 + bloom * 0.13;

    // Concrete is warm-grey when dry and cooler where it has been wet. Two
    // hues out of one material is nearly free and it is what stops a floor
    // this large from reading as a single flat value.
    const damp = smooth(0.52, 0.80, pour);
    let r = l * mix(1.055, 0.955, damp);
    let g = l * mix(1.000, 0.990, damp);
    let b = l * mix(0.915, 1.050, damp);
    // Oil is warm-black and it kills the slab's blue before it kills its red,
    // which is why a stain reads as a stain and not as a shadow.
    r = mix(r, 0.235, spill * 0.52);
    g = mix(g, 0.205, spill * 0.52);
    b = mix(b, 0.178, spill * 0.52);
    o[0] = r; o[1] = g; o[2] = b;
    // The spill's real tell is in the height channel, not the colour one.
    // roughVar is negative on concrete, so raising height here makes the patch
    // SMOOTHER than the slab around it, and a smooth patch on a matte floor
    // picks up a lamp as a soft sheen. That is what an oil stain looks like
    // from six metres; a dark blob is what a hole looks like. Tripled from the
    // 0.06 it was, which was too small to survive the roughness clamp.
    o[3] = clamp01(0.52 + (tooth - 0.5) * 0.30 + (grit - 0.5) * 0.15
      - joint * 0.50 + spill * 0.20);
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
  //
  // The grime here used to be four octaves off a four-cell base — fourteen
  // centimetre blotches at twenty-six per cent contrast, over a wall forty-six
  // metres long. That is the same mistake as the ceiling in a quieter key: it
  // does not read as dirt at any distance, it reads as the wall boiling. Dirt
  // on a wall is a metre across. Two octaves, and the fine end of it goes into
  // height where the light can decide whether it matters.
  panel(u, v, o) {
    const ribs = 8;
    const phase = fract(u * ribs);
    // Trapezoidal, not sinusoidal: cladding has a flat crown and a flat valley
    // with a short web between them, and the flats are what catch a highlight.
    const tri = Math.abs(phase - 0.5) * 2;
    const ribH = 1 - smooth(0.22, 0.78, tri);
    const dirt = fbm(u, v, 3, 2, 3);              // metre-scale grime
    const grit = fbm(u, v, 26, 3, 3);             // the tooth — HEIGHT
    const streaks = streak(u, v, 9, 6, 2, 29);    // rain runs, vertical on a wall
    const rustAt = smooth(0.72, 0.94, fbm(u, v, 5, 2, 53)) * smooth(0.42, 0.88, streaks);
    // Sheet joints only at the tile edge. An earlier version put three across
    // the tile and the wall came out looking like brickwork.
    const seam = smooth(0.994, 1.0, Math.abs(Math.cos(v * Math.PI)));

    // A FADED WARM GREY, NOT A COOL ONE. Cladding is the second largest area in
    // the level after the roof deck and it was mixed 0.47/0.50/0.50 — neutral
    // tipping green-blue. Between it, the roof and the racking, a review
    // measured a single hue family covering 39.6-58.2% of the frame against a
    // reference band of 19-31%, and the cheapest way to spend that down is to
    // stop painting the biggest surfaces with it. Industrial cladding fades
    // towards cream, so this is also just what it looks like.
    // ...and then DOWN by a sixth, because of where this material actually
    // gets its brightest reading. Cladding lines the van, and the van has a
    // 1360 cd lamp in a 2.4 m box: a 0.50 albedo panel a metre from that lamp
    // returns far more radiance than the tone curve has anywhere to put, so
    // every shot into the van came back as a white card with no ribs in it.
    // Painted steel that has been in a yard for a decade is not a 0.50 surface
    // anyway. The shoulder in post.js is the other half of this fix.
    //
    // AND THEN DOWN AGAIN, BY A SEVENTH, WITH THE MEASUREMENT THAT SAYS WHY
    // THIS IS AS FAR AS ALBEDO CAN TAKE IT.
    //
    // The bay was relit — canopy raised a metre, fixtures moved off the back
    // wall — and a shot into it still measures the wall at 204.7 luma with a
    // local standard deviation of 1.6. That is not a bright wall, it is a white
    // card: the corrugation is present in the height channel and arrives at the
    // screen as a one-level ghost, because everything in that bay lands in the
    // part of the ACES curve that has no slope left.
    //
    // Four suspects were photographed one at a time on the shipped materials.
    // The environment map: no effect whatsoever, to the level. The bloom: 0.3
    // of a level. The van's own lamps: the wall goes from 205 to 8, so it is
    // entirely direct light. And the albedo, swept live — x0.86 takes the wall
    // to 197, x0.74 to 187, x0.64 to 175.
    //
    // Read that sweep honestly. A 36% cut in albedo buys 30 levels out of 205,
    // because the surface arrives at roughly 6.5 in scene-linear and a log
    // shoulder preserves RATIOS: 6.5 and 4.2 are close together wherever you
    // put them. The lever with enough range is the lamp, and lamp intensity is
    // level data. So this takes the one seventh that costs the SHED the least
    // — its own west wall goes 71 to 56, which it can afford and arguably wants
    // — and the rest of that fight belongs to whoever owns the fixtures.
    let r = 0.362, g = 0.356, b = 0.330;
    // The rib pitch is 57 cm, which is still a dozen pixels wide at the far
    // wall, so this one repeating feature is allowed real contrast.
    const shade = 0.92 + 0.14 * ribH;
    r *= shade; g *= shade; b *= shade;
    const grime = mix(0.86, 1.05, dirt) * mix(0.94, 1.04, streaks);
    r *= grime; g *= grime; b *= grime * 0.96;
    // Rust bleeds warm and kills the paint's slight green.
    r = mix(r, 0.42, rustAt); g = mix(g, 0.23, rustAt); b = mix(b, 0.13, rustAt);
    r *= 1 - seam * 0.45; g *= 1 - seam * 0.45; b *= 1 - seam * 0.45;
    o[0] = r; o[1] = g; o[2] = b;
    o[3] = clamp01(ribH * 0.74 + 0.11 - seam * 0.45 - rustAt * 0.18 + (grit - 0.5) * 0.22);
  },

  // Profiled steel roof deck. Two ribs across the tile and nothing else in the
  // colour channel at all.
  //
  // This one material is the whole ceiling of the warehouse — fifteen hundred
  // square metres of it — as well as the mezzanine, the loading dock and the
  // ramp. It has been chequer plate and it has been tread plate, and both times
  // the lamps a metre beneath it grew straight rosettes reaching a third of the
  // way across the frame.
  //
  // The previous note blamed the specular, softened the tread, dropped the
  // relief and dropped the gloss, and the rosettes survived all of it. So they
  // got measured properly, by mutating the shipped material live and
  // re-photographing one frame three times: flatten HEIGHT, no change; kill
  // metalness and the environment map, no change; flatten ALBEDO, gone
  // instantly and completely.
  //
  // It is not a lighting effect and it never was. It is the colour channel
  // aliasing under minification and beating against the radial falloff of a
  // lamp — a lamp is a smooth circular gradient, so where the beat pattern
  // crosses it you get bright and dark bands laid out radially, and that is a
  // starburst. Anisotropy cannot reach it: at four degrees the footprint ratio
  // is fifty to one and the hardware gives you sixteen taps.
  //
  // So this surface is now allowed exactly ONE feature with contrast in it, and
  // that feature is 2.75 m across. At the far wall of the shed a rib is still
  // fifty pixels wide; it physically cannot alias. Everything a roof deck has
  // at arm's length — the tooth of the galvanising, the fastener dimples down
  // each crown — is in the height channel, which reaches the frame through a
  // screen-space derivative and averages itself to nothing by twenty metres.
  //
  // The base value also came UP, 0.30 to 0.365. A dark ceiling with no features
  // in it was measuring as a flat navy slab across the top third of the frame,
  // and the fix for a hole in the picture is never to recolour the hole.
  // AND THE SECOND PROBLEM WITH IT, WHICH IS THE OPPOSITE OF THE FIRST.
  //
  // Everything above is about the ceiling, twenty metres away and seen at four
  // degrees. But this same material is also the loading dock, the ramp and the
  // mezzanine — surfaces you stand ON, two metres from the lens, filling the
  // bottom third of the frame. At a 5.5 m tile a 2.2 m ramp gets four tenths of
  // one tile, which is four fifths of a single rib, and photographs of the dock
  // showed exactly that: a large flat pale slab with a faint gradient on it and
  // no other information anywhere. The closest surface in two of five standard
  // shots had less detail in it than the far wall.
  //
  // Both requirements are satisfiable at once, and the channel rule is what
  // makes them so. The ALBEDO stays exactly as coarse as the ceiling needs. The
  // near-field detail all goes in HEIGHT, where it reaches the frame through a
  // screen-space derivative that averages to nothing under minification — so it
  // is simply not present by the time the surface is far enough away to alias.
  //
  // Two additions. A stiffening flute rolled into each pan, which real profiled
  // deck has and which runs PARALLEL to the main ribs — parallel, because a
  // second family of lines crossing the first is the metre-scale grid that got
  // the fastener dimples deleted, and lines that share a direction never form
  // one. And a second, much finer octave of tooth at four centimetres, which is
  // the spangle on galvanising and is what your eye actually reads at two
  // metres.
  deckplate(u, v, o) {
    // THE RIB RUNS ACROSS THE PURLINS, WHICH IS BOTH HOW A ROOF IS BUILT AND
    // THE FIX FOR THE STREAKING BEING ONE-DIRECTIONAL.
    //
    // This keyed on `v` until now. On a ceiling the triplanar picks the p.xz
    // projection, so u is world x and v is world z — and the purlins the level
    // hangs under this deck are 46 m bars running along X at a 4 m pitch in Z.
    // Deck ribs on `v` are ALSO spaced in Z and also run along X, so every
    // repeating feature on the entire roof pointed the same way: the rib, the
    // flute and the structure. A review measured the ceiling's gradient energy
    // at 0.50 x-to-y against a reference band of 0.99-1.27, which is not a
    // texture that is too strong, it is a texture with only one direction in
    // it, and no amount of softening a set of parallel lines makes them stop
    // being parallel.
    //
    // Profiled deck spans FROM purlin TO purlin — that is what the ribs are
    // for — so a real roof has its deck ribs at right angles to its purlins
    // and cannot be built the other way round. Keying on `u` is therefore not
    // a cross-hatch bolted on to beat a metric; it is the only orientation the
    // roof could actually have, and it puts a second direction overhead for
    // free.
    const ribs = 2;
    const phase = fract(u * ribs);
    const tri = Math.abs(phase - 0.5) * 2;
    const crown = 1 - smooth(0.34, 0.58, tri);      // flat top of the rib
    const web = smooth(0.34, 0.58, tri) * (1 - smooth(0.58, 0.92, tri));
    // The pan between the crowns, which is where a flute is rolled.
    const pan = smooth(0.62, 0.80, tri);
    // The flute pitch went 12 a tile to 7 — 46 cm to 79 cm — when the dock,
    // the ramp and the mezzanine moved off this recipe onto dockdeck() below.
    // With those gone this map has exactly one job, a roof seen from eight
    // metres underneath at fifteen to forty degrees, and 46 cm of pressed flute
    // at that angle is under two pixels: it cannot read as a flute, only as a
    // comb, and a comb of parallel lines is half of what a review kept calling
    // ceiling streaking. Nothing is lost by the change because the surface that
    // wanted a fine flute is no longer this one.
    const flute = pan * (1 - smooth(0.30, 0.70, Math.abs(fract(u * 7) - 0.5) * 2));

    // Everything below is metre-scale or bigger, deliberately.
    const wash = fbm(u, v, 2, 2, 5);                // decades of roof leaks
    const soot = fbm(u, v, 3, 2, 19);
    // ...and everything here is height only.
    //
    // There WERE fastener dimples down each crown. They came straight back out
    // again: a stripe every 92 cm crossed with a rib every 2.75 m is a grid of
    // metre-scale rectangles, and under a lamp a metre above it the derivative
    // bump turned that grid into a field of bright blocks. It is the same
    // lesson as the albedo one keyed to a different channel — height is exempt
    // from the starburst, not from having taste. Anything REGULAR needs to be
    // either large enough to be architecture or small enough to be tooth, and
    // roof fasteners seen from eight metres below are neither.
    const tooth = fbm(u, v, 36, 3, 41);
    const spangle = fbm(u, v, 150, 2, 7);

    // A RIB IS A FOLD, AND A FOLD IS A NORMAL. THIS IS THE CEILING STREAKING.
    //
    // These two lines used to swing the albedo by twenty-seven per cent across
    // a rib, which paints the corrugation on rather than folding it — the same
    // mistake panel() above has a paragraph about, never applied here. It
    // matters far more on this surface than on that one, because this surface
    // is fifteen hundred square metres of roof seen at fifteen to forty degrees
    // and a stripe every 2.75 m is a set of PARALLEL LINES. Parallel lines
    // under perspective converge, and converging high-contrast lines under
    // minification are the fans a review kept calling ceiling streaking.
    //
    // A bisect proved it was the albedo and not the light: with the map forced
    // to a single texel and nothing else changed, the ceiling came back as
    // clean pools of lamplight with no fans in it anywhere, while switching the
    // derivative bump off on its own left every fan exactly where it was. (The
    // bump was doing something else and just as wrong — see the level-of-detail
    // note in materials.js — but it was not this.)
    //
    // So the rib keeps a hint in colour and does its work in height, where the
    // relief LOD can take it away at the distance it stops being resolvable.
    // What is left up there at thirty metres is wash, soot and lamplight, which
    // is what a roof thirty metres away actually looks like.
    let l = 0.365 + (wash - 0.5) * 0.075;
    l *= 1 + crown * 0.06 - web * 0.025;
    l *= mix(0.90, 1.06, soot);
    // WARM, not cool. This one material is the ceiling, the dock, the ramp and
    // the mezzanine — comfortably the largest painted area in the game — and it
    // was tinted 3% blue. Every up-facing part of it then also caught the
    // hemisphere's sky colour, which is a desaturated blue by design, and the
    // dock came back as pale denim while the ceiling read as an overcast sky
    // rather than as a roof. A graded review measured the dominant hue share at
    // 42-58% of frame against a reference band of 19-31% and this surface is
    // the single biggest contributor to it. Galvanising thirty years into a
    // working shed is a warm grey; saying so here costs nothing and takes the
    // largest blue field in the level out of the count.
    o[0] = l * 1.030; o[1] = l * 1.000; o[2] = l * 0.955;
    o[3] = clamp01(0.24 + crown * 0.42 + flute * 0.16
      + (tooth - 0.5) * 0.26 + (spangle - 0.5) * 0.20);
  },

  // THE DOCK, THE RAMP AND THE MEZZANINE — chequer plate, walked on for years.
  //
  // Split off deckplate(), which was serving this surface and the roof at once
  // and could only ever suit one of them. The roof wants a 2.75 m rib because
  // it is nine metres up; a loading dock is walked over at two metres and five
  // metres of it showed under two ribs and nothing else. Measured on a 120 px
  // native crop under the bay lamp, the dock deck came back at p90/p10 of 1.02
  // against R.E.P.O.'s cellar at 2.18 and PEAK's carpet at 2.02 — which is not
  // "a bit flat", it is a surface with no material in it whatsoever, sitting at
  // the one place in the level the player has to walk to.
  //
  // So this one is authored for a two-metre read, and every number in it is set
  // by that:
  //
  //  * DURBAR PLATE at a 20 cm lozenge pitch. It is what a dock is actually
  //    surfaced with, it is isotropic — two lozenge orientations crossing —
  //    which is the property the roof deck could never have, and at 20 cm it is
  //    ten pixels at two metres and gone by fifteen, so it can carry real
  //    contrast without becoming a moire from across the shed.
  //  * ALBEDO SPREAD OF ABOUT A THIRD, deliberately, where deckplate ran plus
  //    or minus seven per cent. The lozenges are burnished bright by boots; the
  //    plate between them holds dirt. That contrast IS the material.
  //  * LOAD DAMAGE. A dock is not a clean plate: pallet corners gouge it in
  //    straight lines, heels scuff it in patches, and the traffic lane down the
  //    middle is polished while the edges are not. All three are metre-scale,
  //    so they survive to the far end of the dock while the lozenges do not.
  dockdeck(u, v, o) {
    // Two lozenge families at right angles, each a short bar. abs(fract-0.5)
    // gives a triangle; the product of a wide one and a narrow one is a bar,
    // and offsetting the second family by half a cell interleaves them the way
    // a real plate does.
    const N = 4;                                   // 4 lozenges per 0.80 m tile
    const bar = (a, b) => (1 - smooth(0.10, 0.42, Math.abs(fract(a) - 0.5) * 2))
      * (1 - smooth(0.55, 0.95, Math.abs(fract(b) - 0.5) * 2));
    const lozA = bar(u * N + v * N * 0.5, v * N);
    const lozB = bar(v * N + u * N * 0.5 + 0.5, u * N + 0.5);
    const loz = Math.max(lozA, lozB);

    // The traffic lane: a metre-and-a-half band of polished plate down the
    // middle of the tile where everything gets wheeled, and grime either side.
    const lane = 1 - smooth(0.08, 0.34, Math.abs(fract(v + 0.5) - 0.5));
    const grime = fbm(u, v, 3, 3, 311);            // 27 cm blotches of dirt
    const wear = fbm(u, v, 2, 2, 419);             // metre-scale polish

    // Pallet gouges: long straight scores, one axis, thresholded hard so they
    // are cuts rather than shading.
    const score = smooth(0.80, 0.93, streak(u, v, 22, 14, 2, 47));
    // Heel scuffs: small, dense, and only where people stand rather than drive.
    const scuff = smooth(0.56, 0.86, fbm(u, v, 30, 2, 83)) * (1 - lane * 0.7);

    // Steel, dirty. The burnished tops run a long way over the dark plate —
    // this is where the p90/p10 comes from and it is not subtle on purpose.
    let l = 0.235;
    l *= mix(0.80, 1.12, grime);
    l = mix(l, 0.475, loz * mix(0.55, 1.0, wear));   // lozenge tops, burnished
    l = mix(l, 0.520, lane * 0.34);                  // the polished traffic lane
    l = mix(l, 0.140, scuff * 0.30);                 // scuffed patches go dull
    l = mix(l, 0.560, score * 0.55);                 // a fresh gouge is bare steel
    // Galvanised steel that has been walked on is a warm grey with the zinc
    // showing cool where it is bright. Two hues, keyed to the same feature that
    // carries the value, so the plate reads as metal rather than as paint.
    o[0] = l * mix(1.035, 0.980, loz);
    o[1] = l * 1.000;
    o[2] = l * mix(0.930, 1.045, loz);
    // Height: the lozenges stand proud, the gouges cut in, and a fine tooth
    // under all of it. The relief LOD in materials.js takes the tooth away
    // before it can alias.
    const tooth = fbm(u, v, 64, 3, 29);
    o[3] = clamp01(0.30 + loz * 0.55 - score * 0.34 + (tooth - 0.5) * 0.22
      - scuff * 0.10);
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
  // corner a forklift has ever found, punched with the slot pattern the beams
  // hook into.
  //
  // Two corrections here, both from looking at it rather than at the numbers.
  //
  // The blue was ELECTRIC. 0.27/0.45/0.66 is a saturated primary, and three
  // hundred metres of saturated primary against a warm concrete floor gave the
  // frame two colour families and nothing in between — a graded review called
  // the warehouse a duotone and this is half of what it meant. The value is
  // almost unchanged (0.427 luma against 0.408) and the chroma is down by
  // nearly half: it still reads unmistakably as racking blue, it just stops
  // being the loudest thing in the shed. Note the direction of the fix. Darken
  // it and it goes back to the black hole it was measured as before; the
  // problem was never brightness.
  //
  // And the perforations were ridged noise again — the same level-set contour
  // loops that were scribbling on the floor, wrapped around the uprights.
  // Racking is punched on a regular pitch because a beam has to hook into it,
  // so it is a regular pitch now, and mostly in height.
  steelblue(u, v, o) {
    const chip = vnoise(u, v, 22, 7);
    const chipMask = smooth(0.76, 0.90, chip);
    const scuff = streak(u, v, 24, 5, 2, 13);
    const dirt = fbm(u, v, 4, 2, 61);
    // Slots down the upright: 8 per 1.75 m tile is a 22 cm pitch, which is what
    // adjustable pallet racking is actually punched at.
    const sy = Math.abs(fract(v * 8) - 0.5) * 2;
    const sx = Math.abs(fract(u * 3) - 0.5) * 2;
    const slot = (1 - smooth(0.28, 0.52, sy)) * (1 - smooth(0.16, 0.40, sx));

    let r = 0.33, g = 0.42, b = 0.52;
    const s = mix(0.86, 1.12, scuff) * mix(0.90, 1.04, dirt);
    r *= s; g *= s; b *= s;
    // Chipped paint shows grey primer, not bare steel — this is cheap racking.
    r = mix(r, 0.42, chipMask); g = mix(g, 0.40, chipMask); b = mix(b, 0.38, chipMask);
    r *= 1 - slot * 0.34; g *= 1 - slot * 0.34; b *= 1 - slot * 0.34;
    o[0] = r; o[1] = g; o[2] = b;
    o[3] = clamp01(0.55 + (scuff - 0.5) * 0.28 - chipMask * 0.22 - slot * 0.55);
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

  // A plywood packing crate: ply face, sawn batten frame, and whatever the last
  // shipper stencilled on it.
  //
  // THIS GENERATOR DID NOT EXIST, AND THE TWO BRUSHES THAT ASK FOR IT ARE THE
  // ONLY WAY OUT OF THE INSPECTION PIT.
  //
  // materialFor() answers an unknown name with the debug chequer, on the
  // grounds that a typo in hand-authored level data should look wrong rather
  // than crash a level. That is the right contract and it still failed here,
  // because nothing was LOOKING: the two crates somebody stacked against the
  // north wall of the pit — the pair a contractor who fell in has to climb to
  // get out again, added specifically to fix a soft-lock — have been rendering
  // as a magenta-and-navy checkerboard the whole time. See MATERIAL_NAMES in
  // materials.js and the lint that consumes it, which is the other half of
  // this: an unknown material now says so, loudly, instead of quietly painting
  // itself pink on the critical path.
  //
  // THE TILE IS 0.90 m AND THE BATTENS ARE THE ONLY LOUD THING IN IT.
  //
  // Both halves of that are the rule at the top of this file. A batten pitch of
  // 45 cm is architecture: at twenty metres it is still a dozen pixels wide, so
  // it physically cannot alias, and it is the one feature that reads as A CRATE
  // rather than as a brown box from the far side of the shed. Everything finer
  // — the ply's grain, the saw tooth on the timber, the crushed corners — is in
  // the HEIGHT channel, where a screen-space derivative averages it away by
  // itself as the crate gets further off.
  //
  // Nothing here is near the tile seam, which is the other lesson this file has
  // already paid for twice: the battens sit at the quarter and three-quarter
  // marks, so u = 0 lands in the middle of a ply panel and a stack of crates
  // has no visible join running through it.
  crate(u, v, o) {
    // The frame. Two battens across and two up, at a 0.45 m pitch.
    const bx = Math.abs(fract(u * 2) - 0.5) * 2;
    const by = Math.abs(fract(v * 2) - 0.5) * 2;
    // Uprights run the full height; the rails stop where they meet them, which
    // is how a crate is actually nailed together and stops the frame reading as
    // a lattice laid on top of the box.
    const upright = 1 - smooth(0.13, 0.21, bx);
    const rail = (1 - smooth(0.15, 0.23, by)) * (1 - upright);
    const batten = Math.max(upright, rail);

    // Ply. Long fine grain one way, and the broad blotchy figure of a rotary
    // cut veneer at a scale you can see across a room.
    const fibre = streak(u, v, 110, 16, 2, 19);
    const veneer = streak(u, v, 5, 3, 3, 47);
    const patch = fbm(u, v, 3, 2, 71);            // damp, dirt, sun

    // Stencilled markings, in the middle of one panel. A bar of text and the
    // little square that means the contents are somebody else's problem. Kept
    // deliberately weak: this repeats every 90 cm over every crate in the level
    // and a strong decal at that pitch is wallpaper, not a marking.
    const sx = Math.abs(fract(u + 0.5) - 0.5), sy = Math.abs(fract(v + 0.5) - 0.5);
    const barY = 1 - smooth(0.020, 0.030, Math.abs(sy - 0.085));
    const bar = barY * (1 - smooth(0.115, 0.140, sx))
      // ...broken into blocks, so it reads as lettering rather than as a line.
      * smooth(0.35, 0.55, Math.abs(fract(u * 26) - 0.5) * 2);
    const boxMark = (1 - smooth(0.030, 0.040, Math.abs(sx - 0.055)))
      * (1 - smooth(0.045, 0.055, Math.abs(sy + 0.030)));
    const stencil = Math.max(bar, boxMark) * (1 - batten);

    // Scuffing, where a crate meets a forklift: along the battens, because the
    // frame is what stands proud and the frame is what gets hit.
    const scuff = smooth(0.55, 0.85, fbm(u, v, 9, 3, 29)) * batten;

    let l = 0.455 + (veneer - 0.5) * 0.115 + (fibre - 0.5) * 0.055;
    l *= mix(0.88, 1.06, patch);
    // A batten is sawn softwood over a sanded ply face, so it is both a shade
    // darker and a different surface. The darkening is small on purpose — the
    // frame carries in HEIGHT, and a dark line at 45 cm would be a grid.
    l *= 1 - batten * 0.13;
    l = mix(l, 0.72, scuff * 0.45);               // raw timber under the dirt
    l = mix(l, 0.155, stencil * 0.80);            // stencil ink
    // Softwood ply: warm, and yellower than the scaffold board next door
    // because it has not spent a winter outside.
    o[0] = l * 1.145; o[1] = l * 1.005; o[2] = l * 0.735;
    o[3] = clamp01(0.44 + batten * 0.34 + (fibre - 0.5) * 0.34
      + (veneer - 0.5) * 0.16 - scuff * 0.20);
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

  // French polish: almost nothing, which is the look. Faint swirl marks and
  // the occasional dust nib caught under the finish.
  //
  // THE SWIRL IS WIDER THAN IT WAS, AND IT IS IN THE HEIGHT AS MUCH AS THE
  // COLOUR. A review found the piano flat — one value across a metre and a half
  // of object at a metre and a half from the lens — and half of that was here:
  // six per cent of albedo swing on a surface whose albedo is one per cent is
  // six ten-thousandths of anything. A polished panel does not vary its colour,
  // it varies where it is POINTING, by a fraction of a degree over a hand's
  // width, which is why a real one shows a slow band of light travelling across
  // it as you move. That is height, and height is free to be large here because
  // the relief LOD takes it away as soon as the object is small on screen.
  lacquer(u, v, o) {
    const swirl = streak(u, v, 60, 30, 2, 19);
    // The slow figure of a hand-rubbed panel: about 25 cm on this tile, which
    // is the size of the band of light a lacquered lid actually shows.
    const panel = fbm(u, v, 3, 2, 137);
    const nib = vnoise(u, v, 140, 83);
    const l = 0.92 + (swirl - 0.5) * 0.06 + (panel - 0.5) * 0.05
      - (nib > 0.965 ? 0.10 : 0);
    o[0] = l * 1.01; o[1] = l; o[2] = l * 0.98;
    o[3] = clamp01(0.5 + (swirl - 0.5) * 0.2 + (panel - 0.5) * 0.55
      + (nib > 0.965 ? -0.3 : 0));
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

  // A contractor's overalls, their gloves, and the hi-vis vest over the top.
  // Cloth, but coarser than upholstery, and with the grime of a job that pays
  // by the hazard.
  //
  // THE TWILL WAS A BASKET. At thirty diagonal cycles across a 0.34 m... no,
  // across a 0.50 m tile, the thread pitch was 1.7 cm — and a 1.7 cm thread is
  // not cloth, it is wicker. Photographed from two metres the back of the vest
  // came out as a laundry hamper with reflective bands round it, which is a
  // large part of why a review could not see the banding: it was competing with
  // a weave running at the same scale and higher contrast.
  //
  // The real reason it read that hard was the height channel, not the colour.
  // 0.45 of relief under a bump of 1.8 turns a 1.7 cm ripple into a rope. So
  // the pitch is halved to 8 mm, which is coarse workwear rather than basketry,
  // and the relief comes down by nearly half — the recipe's `bump` comes down
  // with it. What survives is a cloth that has a direction and a nap and does
  // not have a warp you could get your finger under.
  overall(u, v, o) {
    const twill = Math.abs(fract((u * 2 + v) * 62) - 0.5) * 2;
    const weave = 1 - smooth(0.25, 0.75, twill);
    const fluff = fbm(u, v, 34, 3, 17);
    const grime = fbm(u, v, 5, 3, 83);
    const l = (0.79 + weave * 0.13 + (fluff - 0.5) * 0.10) * mix(0.86, 1.05, grime);
    o[0] = l; o[1] = l * 0.995; o[2] = l * 0.99;
    o[3] = clamp01(0.42 + weave * 0.26 + (fluff - 0.5) * 0.26);
  },

  // A hard hat and the face under it. Nothing else in the game uses this: the
  // contractor's head is one skinned mesh and this is its one material, so
  // whatever is written here is worn by both a moulded plastic shell and a
  // human forehead at the same time.
  //
  // AND IT WAS READING AS CORK. BOTH OF THEM. WHICH IS WHAT THAT MEANS.
  //
  // The previous cut had already taken one pass at this — the mould figure came
  // down from thirty cycles a tile to eight, and a note above it explains why
  // eleven-millimetre pitting is not a moulding. The note was right and the fix
  // did not go nearly far enough, because the frequency was only half of it:
  //
  //   * `mould` was fbm at 8 cells with THREE OCTAVES on a 0.34 m tile. The
  //     base cell is 4 cm and the third octave is one centimetre, so cutting
  //     the base frequency by four left the finest detail exactly where it was.
  //     Octaves are the frequency you actually shipped.
  //   * `nick` was ridged noise thresholded at 0.93 over 30 cells. That does not
  //     draw nicks. It draws the LEVEL SETS of the noise field — the same closed
  //     contour loops that were scribbling on the concrete floor until they were
  //     deleted from it — at 1.1 cm across, wrapped round a skull.
  //   * and the pair of them drove -0.55 of height under a bump of 1.05, so the
  //     light dug every one of those pits out again on top of the colour.
  //
  // Photographed at a metre the verdict was the same from every angle: cork.
  // There is no amplitude at which centimetre-scale pitting reads as injection
  // moulding, because injection moulding does not have any — and there is
  // certainly none at which it reads as skin.
  //
  // What is left is the two things both objects genuinely have. A slow drift in
  // sheen across the shell, at seventeen centimetres, which is the size of the
  // thing itself and so can never be mistaken for grain. And drag: long shallow
  // scuffs from a hat that lives in the back of a van, stretched nine to one so
  // they read as strokes rather than as noise, and carried mostly in HEIGHT so
  // the light decides how much of them you see and distance takes them away.
  // On a face the same field is a soft shading variation and nothing else,
  // which is all a face at this register wants.
  //
  // AND THEN IT WAS AN UNTEXTURED GRADIENT, WHICH IS THE OTHER FAILURE.
  //
  // Taking the centimetre-scale pitting out was right and it left nothing
  // behind: a following review called the hat and the skull a smooth gradient
  // with no material in them at all. Both notes are correct and they are not in
  // tension, because they are about different CHANNELS. Cork was a colour
  // problem — a hard contrast field at a frequency the eye reads as grain,
  // present at every distance because albedo does not fade. What a moulding and
  // a face genuinely have is a fine RELIEF: orange peel off the tool on one,
  // pores on the other, both about a millimetre and both invisible past arm's
  // length.
  //
  // Height is now the right place for it, which it was not when that note was
  // written: materials.js has grown a texel-density fade on the relief, so
  // anything in this channel is fully present in a portrait at a metre and
  // completely gone by the time a contractor is a forty-pixel figure across the
  // shed. That is precisely the behaviour that makes fine detail safe, and it
  // is what makes putting it back defensible after taking it out.
  gear(u, v, o) {
    const sheen = fbm(u, v, 2, 2, 5);            // ~17 cm — one side of a shell
    const drag = streak(u, v, 12, 9, 2, 61);     // scuffs, along the moulding
    // Orange peel. 96 cells on a 0.34 m tile is 3.5 mm, which is what comes off
    // an injection tool and what a cheek looks like at half a metre.
    const peel = fbm(u, v, 96, 2, 211);
    // ...and the tooling flow, which on a shell runs front to back and on a
    // face passes for the grain of skin. Stretched, so it is a direction rather
    // than a speckle.
    const flow = streak(u, v, 40, 6, 2, 173);
    const l = 0.905 + (sheen - 0.5) * 0.030 + (drag - 0.5) * 0.038
      + (peel - 0.5) * 0.012;
    // A whisper warm rather than a whisper cool. The vertex colour carries the
    // hue on the hat and the skin tone on the face, and a cold multiplier on a
    // face is the difference between a person and a corpse.
    o[0] = l; o[1] = l * 0.997; o[2] = l * 0.990;
    o[3] = clamp01(0.60 + (drag - 0.5) * 0.26 + (sheen - 0.5) * 0.14
      + (peel - 0.5) * 0.30 + (flow - 0.5) * 0.16);
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
