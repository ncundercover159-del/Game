// HAZARD PAY — JOB 01: THE WAREHOUSE
//
// The teaching level. One big shed, a quota, and a van. Everything valuable is
// either heavy, fragile, or on a shelf you cannot reach alone, so the level
// teaches all three verbs — haul, don't drop, boost a friend — without ever
// saying so.
//
// Layout, looking down (north = -Z):
//
//   +--------------------------------------------------+
//   |  [MEZZANINE 4.2m]          racking   racking      |
//   |         stairs                                    |
//   |                       CONVEYOR                    |
//   |  racking      +-----------+          racking      |
//   |               |   PIT     |                       |
//   |  racking      +-----------+          racking      |
//   |                                                   |
//   |          [====== LOADING DOCK ======]             |
//   +--------------------------------------------------+

import { box, shell, racking, stairs, catwalk, prop, scatter, light } from './build.js';

const W = 46, D = 34, H = 9.5;

const brushes = [
  ...shell(0, 0, W, D, H, 'concrete', 0.7, { wallMat: 'panel', ceilMat: 'deckplate' }),

  // --- the pit: an open inspection trench, dead centre, unlit ---------------
  box([0, -1.4, 1.0], [7.0, 0.6, 5.0], 'concrete', { tag: 'pitfloor' }),
  box([-3.8, -0.55, 1.0], [0.5, 1.7, 5.0], 'concrete'),
  box([3.8, -0.55, 1.0], [0.5, 1.7, 5.0], 'concrete'),
  box([0, -0.55, -1.8], [7.0, 1.7, 0.5], 'concrete'),
  box([0, -0.55, 3.8], [7.0, 1.7, 0.5], 'concrete'),
  // ...and the plank somebody left across it, which will not hold a piano.
  //
  // Narrower and further back than it was. At 900mm wide sitting at z=2.2 it
  // spanned the full width of the trench right behind the near kerb, so from
  // the south approach — which is the way you come from the spawn — it capped
  // the hole: you saw a black plinth with hazard tape on top and no opening at
  // all. 620mm at z=1.2 leaves two metres of open trench between the near kerb
  // and the plank, so the hole reads as a hole from the direction people
  // actually arrive from.
  //
  // z=1.2 and not further north because the pit's two escape crates sit at
  // z=-1.0 and z=0.0 and the second one tops out at y=0.025 — a plank at y=0
  // to 0.12 laid over it would intersect the only way out of the trench.
  box([0, 0.06, 1.2], [8.6, 0.12, 0.62], 'plank', { tag: 'plank' }),

  // CHEVRONS ON THE LIP.
  //
  // The pit used to announce itself by being the brightest object in the shed —
  // a mint-green tube down in the trench, dead centre of frame, out-glowing the
  // van. That is exactly backwards: the hazard was the beacon and the
  // destination was unlit, so the eye was pulled to the one place you must not
  // go. The warning now lives on the LIP, where a real trench marks itself, and
  // the hole behind it is allowed to be dark.
  //
  // `decal: true` — drawn, never collided with. These are 30mm proud of a
  // 300mm kerb, which autostep (420mm) walks over without noticing, so they
  // looked harmless as solid brushes. They were not: four thin colliders on the
  // kerb changed where the bots walked by enough that a whole shift ended with
  // the crew downed and the quota missed, and the crushing happened ten metres
  // away on the far side of the shed. `railing` is the safety-yellow-and-black
  // chevron texture.
  box([-3.8, 0.315, 1.0], [0.5, 0.03, 5.0], 'railing', { tag: 'pitmark', decal: true }),
  box([3.8, 0.315, 1.0], [0.5, 0.03, 5.0], 'railing', { tag: 'pitmark', decal: true }),
  box([0, 0.315, -1.8], [7.0, 0.03, 0.5], 'railing', { tag: 'pitmark', decal: true }),
  box([0, 0.315, 3.8], [7.0, 0.03, 0.5], 'railing', { tag: 'pitmark', decal: true }),

  // A WAY BACK OUT OF THE PIT.
  //
  // Without these the trench is a soft-lock. Its floor is at -1.10 and its lip
  // at +0.30, so getting out is a 1.40m climb, and a contractor can manage
  // 0.99m — a 0.57m jump plus 0.42m of autostep. Anyone who fell in, or was
  // knocked in, stayed there for the rest of the job with no way to say so.
  //
  // Two crates somebody stacked against the north wall, at 0.60m and 0.75m.
  // Both are under the 0.99m limit with room to spare for a bad approach, and
  // "there is junk in the inspection pit" needs no explaining to anyone.
  box([-2.2, -0.80, -1.0], [1.4, 0.60, 1.0], 'crate', { tag: 'pitstep' }),
  box([-2.2, -0.35, 0.0], [1.2, 0.75, 0.9], 'crate', { tag: 'pitstep' }),

  // --- the roof, which had nothing in it ------------------------------------
  //
  // Fifteen hundred square metres of ceiling with no purlins, no joists, no
  // ducting: a review called the ceiling shot "brown fog" and it was right,
  // because there was literally nothing up there to catch a highlight or throw
  // a shadow. A shed roof is mostly structure seen from below.
  //
  // Purlins run the long axis at a 4m pitch, 250mm below the deck, so they sit
  // ABOVE the pendants at 6.8m and are lit from underneath — which is what puts
  // a rhythm of bright edges and dark gaps overhead instead of a flat plane.
  // They merge into the existing steelblue mesh, so the whole roof costs no
  // extra draw calls at all.
  ...[-14, -10, -6, -2, 2, 6, 10, 14].map(
    (z) => box([0, 9.25, z], [46, 0.36, 0.22], 'steelblue', { tag: 'purlin' }),
  ),
  // two rafters across them, and a duct run down the middle
  box([-11, 9.02, 0], [0.3, 0.2, 33], 'steelblue', { tag: 'purlin' }),
  box([11, 9.02, 0], [0.3, 0.2, 33], 'steelblue', { tag: 'purlin' }),
  // `structsteel`, not `metal`. THIS DUCT WAS THE "SKY BAND".
  //
  // Three grading passes chased a blue band across the top of every wide shot
  // and filed it as an aliasing artefact, a bloom problem, and a sky gradient.
  // It was none of those. `metal` has an albedo around 0.80 — the brightest
  // recipe in the roof by a factor of two against deckplate's 0.365 and
  // structsteel's 0.285 — so a thirty-metre run of it at 8.55m was simply the
  // brightest object up there, catching every pendant and smearing across the
  // ceiling. Measured on a variant build, this one word takes the ceiling's blue
  // coverage from 2.2% to 0.6% and the top-of-frame from 21/25/85 to 24/26/65.
  //
  // `structsteel`'s own comment already argues this case for the rafters. The
  // duct simply never got it.
  box([4.5, 8.55, 0], [0.9, 0.9, 30], 'structsteel', { tag: 'duct' }),

  // --- racking rows --------------------------------------------------------
  //
  // BACKED ON THEIR OUTBOARD FACES, which is a lighting decision rather than a
  // warehousing one. This shed is 46m by 34m with nothing vertical in it above
  // knee height, so its pendants had no surface to land on except the floor —
  // and the floor duly won the brightest-region measurement in four frames out
  // of five, not because it was lit well but because it was the only thing lit
  // at all. Backing the outboard face of each row turns the two side aisles into
  // corridors with lit walls, which is where the eye is supposed to go.
  //
  // The west rows close to the west (-1) and the east rows to the east (+1), so
  // every bay stays open to the aisle a contractor actually walks down and the
  // top-deck stock is still reachable from it.
  //
  // THE z=11 ROWS ARE DELIBERATELY LEFT OPEN. Backing them put a 4.3m wall at
  // z=11.61 across x 9.95-18.05, and the dock deck starts at z=11.7 — so it
  // sealed the east approach to the loading bay. smoke.js caught it within a
  // minute: a contractor walking in to pick up a safe stopped 3.11m short of it
  // against a wall that had not existed when the fixture was written. The two
  // deep-shed rows are where the aisles actually are and where the lighting
  // problem actually is.
  ...racking(-15, -9, 4, 3, { back: -1 }),
  ...racking(-15, 2, 4, 3, { back: -1 }),
  ...racking(-15, 11, 3, 2),
  ...racking(14, -9, 4, 3, { back: 1 }),
  ...racking(14, 2, 4, 3, { back: 1 }),
  ...racking(14, 11, 3, 2),

  // --- mezzanine over the north-west corner --------------------------------
  box([-13, 4.2, -13.5], [18, 0.35, 6.5], 'dockdeck', { tag: 'mezz' }),
  ...catwalk([2, 4.2, -13.5], [12, 0.3, 2.0]),
  ...stairs([-4.2, 0, -9.5], [-4.2, 4.2, -13.0], 1.5),
  box([-22, 2.1, -13.5], [0.2, 4.2, 6.5], 'railing', { tag: 'rail', thin: true }),

  // --- conveyor: a moving hazard that is also a shortcut --------------------
  box([0, 0.95, -6.5], [26, 0.25, 1.6], 'rubber', { tag: 'conveyor', drift: [1.9, 0, 0] }),
  box([0, 0.45, -6.5], [26, 0.7, 0.3], 'steelblue'),

  // --- loading dock, and THE VAN, WHICH UNTIL NOW DID NOT EXIST ------------
  //
  // The task text says "load £5,200 of stock into the van". There was no van.
  // The extraction volume sat inside two flat cladding panels and a lid four
  // metres up, over a stretch of the same dock decking the player was standing
  // on, and the whole reason the bay kept blowing out under every lighting
  // scheme tried on it is that a 12m-wide alcove of pale corrugated cladding is
  // not a thing light can be put inside. The reference plate for this is the
  // inside of R.E.P.O.'s extraction truck: a DARK RIBBED BOX whose bright
  // element is the rectangular opening, not its surfaces — 74% of that frame
  // sits below sRGB 32.
  //
  // So the dock now stops at the loading edge and a box body is parked against
  // it, bed flush with the deck so nothing has to be lifted over a step. Inside
  // is 8.5m x 2.6m x 2.4m clear, which wraps the extraction volume with room to
  // walk. Lined in ply over rubber matting, because those are the two materials
  // in the set that are dark AND carry real texture — the critic measured the
  // old deckplate bed at p90/p10 1.01, which is to say no material at all.
  //
  // The deck itself is `dockdeck` and not `deckplate`. Those were one recipe
  // until now, and one recipe could not serve both ends of the job: `deckplate`
  // is fifteen hundred square metres of roof read at eight metres and fifteen
  // degrees, so everything in it is authored at a 2.75 m rib pitch to survive
  // minification — and the same map laid on the twelve metres of deck a player
  // walks across all job long showed TWO RIBS and nothing else. Measured on a
  // native crop under the bay lamp it came back at p90/p10 1.02 against a
  // reference band of 1.81-2.18, which is not a flat-ish surface, it is no
  // surface at all, at the one place in the level every run has to end.
  // See dockdeck() in client/src/art/textures.js for what replaced it.
  box([0, 0.6, 12.95], [12, 1.2, 2.5], 'dockdeck', { tag: 'dock' }),
  box([0, 0.3, 10.8], [6.0, 0.6, 2.2], 'dockdeck', { tag: 'ramp', ramp: true }),

  // the body: bed, two sides, bulkhead, roof
  box([0, 1.075, 15.5], [8.8, 0.25, 2.6], 'rubber', { tag: 'vanbed' }),
  box([-4.4, 2.4, 15.5], [0.3, 2.4, 2.6], 'crate', { tag: 'vanwall' }),
  box([4.4, 2.4, 15.5], [0.3, 2.4, 2.6], 'crate', { tag: 'vanwall' }),
  box([0, 2.4, 16.95], [9.1, 2.4, 0.3], 'crate', { tag: 'vanwall' }),
  box([0, 3.75, 15.4], [9.1, 0.3, 2.8], 'crate', { tag: 'vanroof' }),

  // the rear frame, which is what actually reads as "a van" from across the
  // shed: two uprights and a header outlining the opening
  box([-4.4, 2.4, 14.05], [0.3, 2.4, 0.3], 'steelblue'),
  box([4.4, 2.4, 14.05], [0.3, 2.4, 0.3], 'steelblue'),
  box([0, 3.45, 14.05], [9.1, 0.3, 0.3], 'steelblue'),
  // sill lip you set a safe down over
  box([0, 1.26, 14.16], [8.8, 0.12, 0.22], 'steelblue', { tag: 'vansill' }),

  // both doors swung back flat against the sides. `decal: true` — they are
  // dressing, and dressing that can move the simulation is dressing nobody can
  // safely add. Four 30mm chevrons on the pit kerb once ended a whole shift
  // with the crew downed and the quota missed.
  box([-4.72, 2.4, 13.0], [0.12, 2.4, 2.2], 'steelblue', { tag: 'vandoor', decal: true }),
  box([4.72, 2.4, 13.0], [0.12, 2.4, 2.2], 'steelblue', { tag: 'vandoor', decal: true }),

  // chassis and bumper under the bed line. No wheels: brushes are axis-aligned
  // boxes, so a wheel would be a cube, and from a dock at deck height you never
  // see below the sill anyway. Round geometry is what that needs and the brush
  // system has none.
  box([0, 0.75, 15.5], [9.0, 0.4, 2.6], 'steelblue', { tag: 'vanchassis' }),
  box([0, 0.5, 14.05], [7.4, 0.22, 0.3], 'steelblue'),
];

export const warehouse = {
  id: 'warehouse',
  name: 'THE WAREHOUSE',
  subtitle: 'JOB 01 · UNIT 7, CRAYFORD',
  brief: 'Clear the unit. Anything not bolted down is billable. Mind the pit — '
    + 'the plank is rated for one contractor and you are going to test that.',

  env: {
    skyTop: '#20242c', skyBottom: '#3a3129',
    // The unit is 46m across its diagonal; fog starting at 14m and ending at
    // 74m never engages, so distance reads as flat.
    //
    // ...and 6/42 was the overshoot in the other direction. Linear fog at
    // near 6 begins SIX METRES FROM THE EYE, which is inside the working range:
    // everything a contractor looks at while doing the job is already being
    // blended toward #23252b before they have taken a step. At 24m — the
    // distance the van has to read from — the blend is (24-6)/(42-6) = 50%.
    //
    // Measured, and this is the whole of why the destination would not read.
    // Knocking out each contribution in turn at that distance: no lamp puts
    // ANYTHING measurable on the van's surround, and neither does the ambient,
    // the environment map or the sun — all four move it by 0.0-0.4. Turning the
    // fog off moves the van's own aperture from 39.1 to 55.3 and the contrast
    // from 1.49:1 to 2.08:1. The van was not too dim; it was fifty per cent
    // dissolved.
    //
    // 12/58 keeps the far end reading — the diagonal is 57m, so a sight line
    // down the length of the shed still finishes near-solid — and takes the
    // blend at 24m from 50% to 25%. The original complaint that fog which never
    // engages makes distance flat was correct and this does not undo it; it
    // moves the engagement out of the range where the job happens.
    fog: { color: '#23252b', near: 12, far: 58 },
    sun: { dir: [-0.35, -0.82, -0.45], color: '#ffd9a8', intensity: 1.5 },
    // THE SKY TERM WAS A FLAT BLUE CONSTANT ON EVERY UP-FACING SURFACE.
    //
    // '#5b6472' is (91,100,114) — decisively blue — and a hemisphere light puts
    // it on every pixel whose normal points up, unconditionally. Measured, the
    // darkest 5% of a spawn frame came back 9/10/31: a channel spread of 22
    // against 1.6-3.9 in the reference plates, which is verbatim the rubric's
    // C1 FAILS condition, "surfaces facing away from all lights are lit by a
    // single flat term". It is why unlit concrete read as cold cloud rather
    // than as dark concrete, and pulling the pendants into pools is what made
    // it visible — the old wall-to-wall lamp wash had been swamping it.
    //
    // Warm grey with the blue taken out, and the ground bounce warmed to match
    // a sodium-lit shed. The hemisphere stays because something has to light
    // an up-facing surface in shade; what changes is that it no longer paints
    // the whole floor one saturated colour.
    ambient: { sky: '#6a6459', ground: '#33291f', intensity: 0.85 },
    // 0.55, AND THIS IS THE ONE THAT MATTERED MOST.
    //
    // Measured against the reference plates, this game had no blacks in it at
    // all: our darkest tenth sat at sRGB 21-24 while R.E.P.O.'s MEDIAN is 11-12
    // and its whole-frame mean is 14. Our mean was 50. Nothing in the picture
    // was ever dark, which is most of why an otherwise competent frame read as
    // a render rather than as a room — and every texture judgement made at the
    // old exposure was made on the wrong curve, so this comes before any
    // further material work rather than after it.
    //
    // It is exposure and not albedo. The `panel` recipe records three separate
    // attempts to fix the same symptom by darkening the material, the last of
    // which bought 30 levels off 205 for a 36% cut, and its own comment
    // concludes albedo is out of range. It is.
    exposure: 0.55,
  },

  // On the dock (its deck is at y=1.2), well inside the shell — the spawn ring
  // has to fit within the level or the last contractor starts in a wall.
  spawn: [0, 1.35, 13.4],
  spawnYaw: Math.PI,
  spawnSpread: 1.7,

  // The van bed, sitting on the dock. A prop that comes to rest in here and
  // stays put is money.
  extract: { p: [0, 2.05, 15.4], s: [8.0, 1.9, 2.4] },

  quota: 5200,
  timeLimit: 330,

  brushes,

  lights: [
    // POOLS, WITH DARK BETWEEN THEM — which this shed has never had.
    //
    // Five pendants with 20-22m of range in a room 46m across means every point
    // on the floor is inside four of them at once. Measured across the whole
    // 46x34m floor, brightest-to-darkest irradiance was 2.4:1; the reference
    // measures 11.6:1 between a lit and an unlit patch of the SAME stone. At
    // 2.4:1 there is no such thing as a pool and no such thing as shade, so
    // nothing in the room silhouettes against anything else and a torch has
    // nothing to be better than.
    //
    // I went to range 10 first and walked straight into the failure that is
    // written down four screens above this line. LAMP_REACH records an earlier
    // attempt at exactly this idea reaching 133:1 with the floor between lamps
    // at 0.006; range 10 measured 53.7:1 with the fill at 0.0036 and 40% of the
    // frame lit, against a harness band of 2-9:1 and a 50% floor. Same mistake,
    // in the same file, under a comment describing it.
    //
    // 15 is the middle. Each pool is about a 13.4m radius on the floor from
    // 6.8m up against a 14m spacing, so adjacent pools now meet at their edges
    // rather than overlapping four deep — which is what gives a floor a bright
    // middle and a dim edge instead of one flat sheet — and the gaps beyond the
    // ring stay dark for the torch to work in.
    // Range 17 on these four, not 15, and the reason is an error in my own
    // commit message. I wrote that the pools "meet at their edges against a 14m
    // spacing". 14m is the Z spacing. The X spacing is 28m — these sit at
    // x = +/-14 — and a lamp 6.9m up with a 15m window reaches a floor radius of
    // sqrt(15^2 - 6.9^2) = 13.3m, so the two rows stopped 0.7m short of the
    // centre line and left a dead strip down the middle of the shed. Measured on
    // a half-metre grid, (-0.5, 4) was receiving exactly 0.000 — outside every
    // pendant's range window at once. 17 reaches 15.5m and the rows overlap.
    //
    // 42 -> 24, AND THE POINT IS WHERE THE LIGHT GOES, NOT HOW MUCH OF IT.
    //
    // Every previous argument on this line was about the total: the room was
    // too dark, so the number went up; the pools blew out, so it came down.
    // A grading pass measured the distribution instead and the answer was not
    // on that axis at all. Our key floor reads 143 sRGB where the reference's
    // lit stone reads 65 — 2.2x hot — while our deep fill reads 6/5/6 against
    // the reference's 6/5/9, which is a match to within a value. We are not
    // crushed at the bottom. We are stretched at the top, and the median sits
    // at 22 because the light is all in the pools and there is nothing in
    // between them.
    //
    // A pendant 8.4m over a flat slab cannot make a pool: by the time its cone
    // reaches the floor it is a wash, and the only surface in reach is the
    // concrete at your boots — which is precisely why the brightest region in
    // four frames out of five was the floor, and why the assertion about it
    // failed on area rather than on height. So the key comes down and the
    // difference goes into the fixtures below, 0.5m off a surface, where a
    // lamp CAN make a pool. Total flux is roughly unchanged: 202 -> 196.
    light([-14, 8.4, -9], { intensity: 24, range: 17, color: '#ffe2b4' }),
    light([14, 8.4, -9], { intensity: 24, range: 17, color: '#ffe2b4' }),
    light([-14, 8.4, 5], { intensity: 24, range: 17, color: '#ffe2b4' }),
    light([14, 8.4, 5], { intensity: 24, range: 17, color: '#ffe2b4' }),
    light([0, 8.4, -14], { intensity: 20, range: 15, color: '#ffd9a0' }),

    // --- LOW FIXTURES, WHICH IS WHERE THE 42 WENT ----------------------------
    //
    // Wall packs at 2.6m, half a metre off the cladding, and aisle lamps at
    // 2.5m, half a metre off the face of the stock. Short range on all of them,
    // deliberately: a 6m window from 2.6m up puts the whole pool on a wall and
    // the rack faces rather than spreading a further wash over concrete that is
    // already lit. Each one is a small bright thing at eye level with a dark
    // housing round it, which is what the reference plates are full of and what
    // this shed had none of below 4.6m.
    //
    // `mount: 'fixed'` on every one, because the blanket 1.6m pendant drop would
    // put a 2.5m lamp at 0.9m — in the player's face, and inside the aisle they
    // walk down. The van lamps learned this the hard way and it is written up
    // three screens below.
    light([-22.4, 2.6, -4.0], { intensity: 10, range: 6.0, color: '#ffd9a0', mount: 'fixed' }),
    light([-22.4, 2.6, 4.0], { intensity: 10, range: 6.0, color: '#ffd9a0', mount: 'fixed' }),
    light([22.4, 2.6, -8.0], { intensity: 10, range: 6.0, color: '#ffd9a0', mount: 'fixed' }),
    light([22.4, 2.6, 0.0], { intensity: 10, range: 6.0, color: '#ffd9a0', mount: 'fixed' }),
    light([22.4, 2.6, 8.0], { intensity: 10, range: 6.0, color: '#ffd9a0', mount: 'fixed' }),
    // The aisle faces. The rows sit at x -20.4..-9.6 and 8.6..19.4 with their
    // backs outboard, so these hang in the open aisle 0.6m off the stock the
    // player is actually reading.
    //
    // 2.5m -> 3.6m, because at 2.5 they were lighting the floor more than the
    // stock. The decks are at 2.15, 4.30 and 6.50; a lamp at 2.5 sits just above
    // the first deck and its nearest surface by a long way is the concrete 2.5m
    // below it. At 3.6 it sits between decks one and two, so both deck faces are
    // about 1.2m away and the floor is 3.6m — which by inverse square is roughly
    // half the floor and several times the stock. Measured on the racking shot,
    // the brightest region in the frame was floor at 91% of frame height.
    light([-15.0, 3.6, -7.8], { intensity: 9, range: 5.5, color: '#ffe2b4', mount: 'fixed' }),
    light([-15.0, 3.6, 3.2], { intensity: 9, range: 5.5, color: '#ffe2b4', mount: 'fixed' }),
    light([14.0, 3.6, -10.2], { intensity: 9, range: 5.5, color: '#ffe2b4', mount: 'fixed' }),
    light([14.0, 3.6, 0.8], { intensity: 9, range: 5.5, color: '#ffe2b4', mount: 'fixed' }),
    // AND THE MIDDLE, WHICH THE FIRST VERSION OF THIS FORGOT.
    //
    // Taking the pendants from 42 to 24 and putting the difference into wall and
    // aisle fixtures moved the light to the EDGES of the shed. Measured: the
    // peak came down properly, p90 56 -> 33, but the floor between the pools
    // halved — fill 0.0316 -> 0.0133 — and key over fill went 9.3:1 to 20.4:1,
    // which is further from the reference's 11.6:1 than where it started. The
    // grading pass's complaint was "a hot key, a black floor and nothing in
    // between", and I had fixed the first third and made the last third worse.
    //
    // The fix is the same principle applied to the middle rather than more wash
    // over it: there IS a surface down the centre of this shed, the conveyor at
    // z=-6.5, and it had no light on it at all. Three lamps 1.45m above the belt
    // light the belt, the floor either side of it, and anything riding it — and
    // they give the open centre of the room the lit line it needs to be a
    // composition rather than a gap between two lit walls.
    light([-9.0, 2.4, -6.5], { intensity: 9, range: 6.0, color: '#ffe2b4', mount: 'fixed' }),
    light([0.0, 2.4, -6.5], { intensity: 9, range: 6.0, color: '#ffe2b4', mount: 'fixed' }),
    light([9.0, 2.4, -6.5], { intensity: 9, range: 6.0, color: '#ffe2b4', mount: 'fixed' }),

    // --- LANDMARKS, so the eye has somewhere to go that is not your boots ----
    //
    // In five of six graded frames the largest bright region in the picture was
    // the floor immediately in front of the camera, centred at 67-92% of frame
    // height. In the reference plate captioned "torch in hand" it sits at 25% —
    // a lit doorway at the far end of a corridor that you walk toward. Ours
    // rewarded looking down; the reference rewards looking down the room.
    //
    // Two wall packs on the north gable and one over the far racking aisle,
    // deliberately small-range so they are bright POINTS at distance rather than
    // more general illumination. They carry fixture geometry like every other
    // lamp, so what you see from thirty metres away is a lit lens with a dark
    // housing round it, which is what a landmark is.
    light([-10.5, 4.6, -16.2], { intensity: 20, range: 7, color: '#ffd9a0', mount: 'fixed' }),
    light([10.5, 4.6, -16.2], { intensity: 20, range: 7, color: '#ffd9a0', mount: 'fixed' }),
    light([-20.5, 3.4, 11.5], { intensity: 16, range: 6, color: '#ffe2b4', mount: 'fixed' }),

    // --- INSIDE THE VAN ------------------------------------------------------
    //
    // These used to be bay lamps hung in an alcove, and every value tried on
    // them was wrong for the same reason: there was nothing to put the light
    // INSIDE. Now there is a box, so they go in it, and the thing the player
    // sees from across the shed is a lit rectangular opening rather than a
    // glowing wall — which is what the reference plate actually does.
    //
    // Back to 24 from 15. Backing off to 15 was my call and it was wrong: the
    // critic measured attention properly, as the share of the frame's brightest
    // 1% falling inside the bay, and got 38% at 24 against 26% at 15. 34 buys
    // no more attention than 24 and costs 17 sRGB of near-field blowout, so 24
    // is the top of the useful range. My reason for backing off — "the cladding
    // is legible again" — was true of the WALL and false of the DECK, which was
    // never flat because of the lamp. It was flat because deckplate carries a
    // 2.75m rib pitch and a 5m bed shows under two ribs of it. That bed is
    // rubber matting now.
    //
    // 3.15 is 450mm under the roof lining and just clear of the load volume,
    // which tops out at 3.0.
    // ONE LAMP, AND IT CASTS. This was two at intensity 24 and only one of them
    // had `shadow: true` — which in a renderer where a point light without a
    // shadow map is occluded by NOTHING meant the second one lit the whole shed
    // straight through the van's own roof and bulkhead. Measured: it put linear
    // 0.1346 on the shell's south wall directly above the van against 0.0109 on
    // the same wall fourteen metres along, i.e. 92% of the light on that patch
    // arrived through half a metre of solid geometry, and the wall above the van
    // was 12.7x brighter than the same wall elsewhere. That is what the blue
    // starburst over the loading bay has been for three grading passes.
    //
    // And 24 was far too much for a closed box in any case: the interior wall
    // measured mean sRGB 213 with a local SD of 0.45 — a blank white card, in
    // the one place the reference plate is nearly black. Albedo cannot fix that
    // and the material file records three separate attempts to make it.
    //
    // 7 at range 5 puts the pool on the bed and the threshold and lets it fall
    // off toward the bulkhead, which is what a load light in a box body does.
    // 2.2 at range 3.5, down from 7 at 5. Dropping 24 to 7 moved the interior
    // wall from sRGB 213 to 195, which is an 8% move where about an 85% one was
    // needed: the reference truck's interior walls measure 31-38 and its floor
    // 12, with the bright APERTURE at 98 — so ours was not merely bright, its
    // walls were twice the reference's single brightest element. A dark box
    // with a bright hole, not an illuminated display case. The `crate` battens
    // survive this: local SD went 0.45 to 8.7 at intensity 7 and the darkness
    // is what they need to read as relief rather than as a pattern.
    // ...and then re-lifted to 8, because dropping the van AND the global
    // exposure in the same change was one cut too many: the interior went to
    // linear 0.003 and the opening took 0.1% of the frame's brightest pixels,
    // i.e. the destination disappeared entirely. The instruction was to bring
    // the picture down and then re-lift the van and the ramp, and this is the
    // second half of it. Pulled forward to z=14.8 as well, so the pool falls on
    // the sill and the threshold rather than on the bulkhead — the reference
    // truck's bright element is its APERTURE at 98 against walls of 31-38, and
    // an aperture is lit from just inside it.
    // ...AND THEY ARE THE ONLY TWO COLD LAMPS IN THE SHED, WHICH IS WHY THE VAN
    // KEPT PHOTOGRAPHING BLUE AFTER THE GRADE WAS FIXED.
    //
    // Nine lamps here are #ffe2b4 or #ffd9a0 tungsten and one is the pit's
    // amber flicker. These two — the van's load light and the ramp light — were
    // #dfeaff, a blue-white, and between them they light the deck, the sill and
    // the whole dock floor that fills the bottom half of every shot into the
    // bay. Once the cool bias came out of the post grade, they were what was
    // left: the same frame that reads warm everywhere else had its floor at
    // blue-minus-red +23 against a reference shaded stone of -1.
    //
    // Swept live on the van plate, blue-minus-red on the dock floor:
    //
    //     #dfeaff   +23        #fff2e2   -12
    //     #eaf0f5   +10        #ffe8cc   -24
    //     #f5f2ec    -1
    //
    // #f5f2ec is the reference value to the level, and it is not a retreat to
    // tungsten: it is a clean neutral white, still plainly a colder and newer
    // fitting than the amber bay lamps around it, which is the thing the blue
    // was there to say. It just no longer says it by painting the floor.
    light([0, 3.1, 14.8], { intensity: 12, range: 4, color: '#f5f2ec', mount: 'fixed', shadow: true }),
    // A MARKER ON THE HEADER, WHICH IS HOW THE REFERENCE SOLVES THIS.
    //
    // The van reads 1.80:1 against its surround at 12m and 1.47:1 at 24m,
    // against a floor of 2:1, and it has been graded "not the brightest thing in
    // its own frame" for three passes. Raising the load light further is the
    // wrong lever and the file records four attempts at it: past about 12 the
    // interior stops being a lit box and becomes a white card, which is the
    // fault three separate cuts were made to remove.
    //
    // The reference plate does not floodlight its destination either. It puts a
    // small EMITTER on it — a cart made findable by its own lit display rather
    // than by a lamp pointed at it. Intensity 3 over a range of 3 lights almost
    // nothing; what it puts in the frame is its own lens, a bright point at the
    // top of the aperture that is legible from the far end of the shed and does
    // not wash the sill. Warm, so it does not undo the colour work below.
    //
    // ...AND THE FIRST PLACEMENT WAS ON THE ROOF, OUTSIDE THE BOX.
    //
    // 4.05m. The van's roof brush spans 3.60 to 3.90 and its rear header 3.30
    // to 3.60, so a lamp at 4.05 sat ON TOP of the vehicle, above both. That is
    // why it contributed 0.9 luma to an aperture it was not inside and moved the
    // destination contrast by 0.02 — I wrote that "what it puts in the frame is
    // its own lens" and the lens was not in the frame.
    //
    // It also leaked. Point lights in this renderer do not self-occlude without
    // a shadow map, and both shadow slots are spoken for, so range is the only
    // containment there is: from the roof a 3m window reached the shed's south
    // wall and lit it. That went unnoticed while the fog began at 6m, because
    // the fog washed the wall and its control patch to the same value — 0.0034
    // against 0.0034, a clean 1.00x. Moving the fog out of the working range
    // exposed it at 1.98x against a limit of 2.0. A fog that hides a light leak
    // is not atmosphere, it is a lid.
    //
    // 3.15m puts it under the header and inside the aperture where it belongs,
    // and range 2.0 cannot reach past z=16.3 — short of the bulkhead at 16.95,
    // let alone the wall behind it.
    light([0, 3.15, 14.3], { intensity: 3, range: 2.0, color: '#ffd9a0', mount: 'fixed' }),
    // and one over the ramp, so the approach is legible without being in shot
    // RANGE 8 -> 6, AND THIS LAMP WAS THE WHOLE DEFECT AT THIS END OF THE SHED.
    //
    // Three assertions were failing on the dock frame — the bright region was
    // 16.3% of it against a cap of 8%, at 2.45:1 against its surround against a
    // floor of 3:1, and the van itself read 1.70:1 at 12m and 1.40:1 at 24m
    // against a floor of 2:1. Every one of them is the same lamp, and it is not
    // the one anybody had been looking at.
    //
    // Measured by zeroing each light in turn and re-reading three patches of the
    // dock frame — foreground concrete, the pool at frame centre, the lit stock
    // inside the van:
    //
    //     lamp                     floor    pool   cargo
    //     van load  (0,3.1,14.8)    -0.1     0.0    55.0
    //     ramp      (0,3.4,11.6)    62.5    30.7    33.5
    //     the torch                 -0.1    28.5     0.0
    //
    // The foreground floor is 68 and this lamp is 62.5 of it. At 3.4m up with a
    // range of 8 it reaches a floor radius of sqrt(8^2 - 3.4^2) = 7.2m, so it
    // was washing the dock from z=4.4 to z=18.8 — the entire bottom half of
    // every shot into the bay. The comment four screens above this line says
    // exactly that about these two lamps and blames their COLOUR for it. The
    // colour was a real fault and it is fixed; the size of the pool is a second
    // one that was hiding behind it.
    //
    // Range 6 reaches 4.9m of floor instead of 7.2m, which is the ramp and the
    // sill rather than the whole apron. Three's windowed falloff means that is a
    // gradient rather than a ring on the concrete.
    //
    // The cargo loses 33.5 with it, so the load light goes 8 -> 12. That lamp is
    // perfectly selective — it puts 55 on the cargo and measurably NOTHING on
    // the floor, because it is inside a box body with a shadow map on it — so it
    // is the correct place to buy the contrast back. Aperture bright, apron
    // dark, which is the reference truck's arrangement: walls 31-38, floor 12,
    // aperture 98.
    light([0, 3.4, 11.6], { intensity: 9, range: 6, color: '#f5f2ec', mount: 'fixed' }),

    // --- THE PIT, WHICH IS THE DIMMEST ---------------------------------------
    //
    // Was intensity 7 of '#9fffc0' sitting 700mm off the trench floor: 243 lux
    // on the slab under it against 12 for the shed, i.e. the principal fall
    // hazard was twenty times brighter than the room and dead centre of three
    // frames out of five. Now a failing amber strip at the lip, dimmer than the
    // floor it interrupts. The chevrons above do the warning; the hole is a
    // hole, and you are meant to lose your footing in it.
    // Range 1.2, not 4.2, and this is a correction of my own claim. The commit
    // that added it said "the hole is a hole"; measured from the south approach
    // the inside face of the north trench wall reads mean 142 against 50 for the
    // surrounding shed floor and 10 for the chevron kerb that is supposed to be
    // the warning. A non-casting lamp at the lip with 4.2m of reach floodlights
    // a wall 2.5m away and nothing occludes it, so the trench was a lit alcove
    // 2.9x brighter than the floor around it and 15x brighter than its own
    // hazard livery. At 1.2 it could not reach the walls at all — but it could
    // not reach the KERB either, and pulling the pendants in to make pools took
    // the room light off the chevrons at the same time, so the best-read object
    // in the level went dark. Range 3.0 reaches most of the kerb top and stops
    // short of the trench's inner faces at 3.55, which is the distinction that
    // matters: it lights the warning and not the hole.
    light([0, 0.15, 1.0], { intensity: 1.6, range: 3.0, color: '#ff9d3c', flicker: 0.7, mount: 'fixed', fixture: false }),
  ],

  props: [
    // top decks: the payday, and out of reach without a boost
    prop('safe', [-15.2, 6.6, -9]),
    prop('serverrack', [14.4, 6.6, 2]),
    prop('elk', [-14, 6.6, 2]),
    prop('chandelier', [13.6, 6.6, -9]),

    // mid decks: reachable, awkward
    prop('crt', [-16.4, 4.4, -9]), prop('crt', [-14.0, 4.4, -9]),
    prop('printer', [15.0, 4.4, -9]), prop('printer', [12.8, 4.4, 2]),
    prop('vending', [-13.0, 2.3, 11]),
    prop('cheque', [14.0, 4.4, 11], [0, 0.4, 0]),

    // floor: the two-person problems
    // y must stay under 0.548: gravity is -22, so a 700mm drop lands at
    // 6.22m/s against this piano's 5.5m/s fragility and it shatters on load.
    prop('piano', [-7.5, 0.52, -2.5], [0, 0.3, 0]),
    prop('bathtub', [8.0, 0.6, 6.5], [0, -0.5, 0]),
    prop('generator', [6.5, 0.6, -12.0]),

    // mezzanine
    prop('officechair', [-16, 4.6, -13.5]),
    prop('officechair', [-11, 4.6, -13.5], [0, 1.2, 0]),
    prop('fishbowl', [-8.0, 4.6, -13.5]),
    prop('ladder', [2, 4.6, -13.5], [0, 0, 1.4]),

    // the conveyor, which will deliver these to somebody's shins
    prop('extinguisher', [-9, 1.3, -6.5], [0, 0, 1.57]),
    prop('mug', [-6, 1.2, -6.5]),
    prop('stapler', [-3, 1.2, -6.5]),

    ...scatter('mug', [0, 0.2, 6], [22, 0.1, 10], 9, 3),
    ...scatter('stapler', [0, 0.2, 0], [24, 0.1, 16], 6, 7),
    ...scatter('extinguisher', [0, 0.4, -3], [26, 0.1, 18], 5, 11),
  ],

  tasks: [
    {
      id: 'quota', type: 'extract_value', target: 5200,
      title: 'MEET THE QUOTA',
      detail: 'Load £5,200 of stock into the van.',
    },
    {
      id: 'fragile', type: 'no_breakages', limit: 3,
      title: 'BREAK LESS THAN FOUR THINGS',
      detail: 'Breakages come out of your pay. Three is tolerated.',
      bonus: 600,
    },
    {
      id: 'piano', type: 'extract_kind', kind: 'piano', count: 1, intact: true,
      title: 'THE PIANO',
      detail: 'It weighs 220kg. It is not going to move itself.',
      bonus: 900,
    },
  ],
};
