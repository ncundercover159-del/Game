// HAZARD PAY — the catalogue of things worth money.
//
// One entry per kind. The server builds a Rapier collider from `shape`, the
// client builds a mesh from `look`, and both read the same mass and size, so a
// thing can never look heavier than it is.
//
// Mass is the whole design. Under HAUL_FREE_KG you barely notice it; over
// GRAB_MAX_MASS one contractor physically cannot lift it and has to shout for
// help. Everything in between is a negotiation with your own stamina bar.

/**
 * shape: 'box' | 'cyl' | 'ball' | 'compound'
 * size:  box -> [w,h,d] full extents; cyl -> [radius, height]; ball -> [radius]
 * parts: compound only -> [{ shape, size, offset:[x,y,z] }]
 * value: pounds, paid on extraction
 * fragile: impact speed (m/s) that destroys it, or 0 for indestructible
 * look:  hands the client a recipe; the art pass owns what that means
 */
const P = (id, o) => ({ id, restitution: 0.12, friction: 0.85, fragile: 0, ...o });

export const PROPS = [
  // --- the light stuff: pocketable, low value, everywhere ------------------
  P('mug', {
    name: 'DEPARTMENTAL MUG', shape: 'cyl', size: [0.05, 0.11], mass: 0.4,
    value: 12, fragile: 3.2, look: { kind: 'mug', mat: 'ceramic', tint: '#e8e3d8' },
  }),
  P('stapler', {
    name: 'STAPLER, HEAVY DUTY', shape: 'box', size: [0.22, 0.09, 0.07], mass: 1.1,
    value: 34, look: { kind: 'stapler', mat: 'plastic', tint: '#c0392b' },
  }),
  P('extinguisher', {
    name: 'EXTINGUISHER', shape: 'cyl', size: [0.08, 0.52], mass: 9.5,
    value: 88, look: { kind: 'extinguisher', mat: 'metal', tint: '#c0392b' },
  }),
  P('printer', {
    name: 'DESKTOP PRINTER', shape: 'box', size: [0.46, 0.28, 0.38], mass: 11,
    value: 140, fragile: 5.5, look: { kind: 'printer', mat: 'plastic', tint: '#d8d4cc' },
  }),
  P('fishbowl', {
    name: 'FISHBOWL (OCCUPIED)', shape: 'ball', size: [0.19], mass: 6.2,
    value: 260, fragile: 2.6, restitution: 0.05,
    look: { kind: 'fishbowl', mat: 'glass', tint: '#8fd4e8' },
  }),

  // --- awkward: not heavy, but the shape is the problem --------------------
  P('officechair', {
    name: 'ERGONOMIC CHAIR', shape: 'compound', mass: 14, value: 210,
    parts: [
      { shape: 'box', size: [0.48, 0.09, 0.46], offset: [0, 0.44, 0] },
      { shape: 'box', size: [0.44, 0.52, 0.09], offset: [0, 0.74, -0.20] },
      { shape: 'cyl', size: [0.05, 0.34], offset: [0, 0.22, 0] },
      { shape: 'cyl', size: [0.30, 0.07], offset: [0, 0.05, 0] },
    ],
    look: { kind: 'officechair', mat: 'fabric', tint: '#3d4450' },
  }),
  P('ladder', {
    name: 'STEP LADDER', shape: 'box', size: [0.46, 2.30, 0.16], mass: 12,
    value: 120, look: { kind: 'ladder', mat: 'metal', tint: '#c9a227' },
  }),
  P('elk', {
    name: 'TAXIDERMY ELK', shape: 'compound', mass: 38, value: 1150,
    fragile: 7.0,
    parts: [
      { shape: 'box', size: [0.52, 0.62, 0.34], offset: [0, 0, 0] },
      { shape: 'box', size: [0.26, 0.30, 0.26], offset: [0, 0.44, 0.10] },
      { shape: 'box', size: [0.92, 0.44, 0.10], offset: [0, 0.72, 0.14] },
    ],
    look: { kind: 'elk', mat: 'fur', tint: '#6b4a2f' },
  }),
  P('cheque', {
    name: 'NOVELTY CHEQUE', shape: 'box', size: [2.10, 0.95, 0.06], mass: 7,
    value: 300, fragile: 6.0, look: { kind: 'cheque', mat: 'card', tint: '#f2f0e6' },
  }),

  // --- heavy: one person can just about, and will regret it ----------------
  P('crt', {
    name: 'CRT MONITOR', shape: 'box', size: [0.46, 0.42, 0.48], mass: 26,
    value: 190, fragile: 4.2, look: { kind: 'crt', mat: 'plastic', tint: '#ded8c4' },
  }),
  P('vending', {
    name: 'VENDING MACHINE', shape: 'box', size: [0.86, 1.86, 0.78], mass: 118,
    value: 940, fragile: 0, look: { kind: 'vending', mat: 'metal', tint: '#b52d2d' },
  }),
  P('safe', {
    name: 'FLOOR SAFE', shape: 'box', size: [0.54, 0.62, 0.54], mass: 132,
    value: 1400, look: { kind: 'safe', mat: 'metal', tint: '#4a4f55' },
  }),
  P('serverrack', {
    name: 'SERVER RACK', shape: 'box', size: [0.62, 1.94, 0.94], mass: 126,
    value: 1650, fragile: 3.4, look: { kind: 'serverrack', mat: 'metal', tint: '#23272b' },
  }),

  // --- two-person only: over GRAB_MAX_MASS by design -----------------------
  P('piano', {
    name: 'UPRIGHT PIANO', shape: 'compound', mass: 220, value: 2600,
    fragile: 5.5,
    parts: [
      { shape: 'box', size: [1.48, 1.20, 0.62], offset: [0, 0.60, 0] },
      { shape: 'box', size: [1.48, 0.22, 0.30], offset: [0, 0.98, 0.42] },
    ],
    // #191512 IS NOT BLACK LACQUER, IT IS A HOLE. 25/21/18 decodes to a linear
    // luma of 0.0074 — seven tenths of one per cent — and a surface that
    // returns 0.7% of what lands on it cannot show a lid, a fallboard or a
    // pair of key cheeks however carefully props.js models them. Photographed
    // 1.5 m from the lens filling a seventh of the frame, this read as a flat
    // black polygon with no internal value gradient at all, which is what
    // three separate reviews have now called it.
    //
    // A real piano-black polyester finish measures L* 13-18, which is a linear
    // luma around 0.018-0.025 — two and a half times this, and still so plainly
    // black that nobody would call it grey. The gradient the reviews are asking
    // for is not a lighting effect that was missing, it is the shading that was
    // always there multiplied by an albedo big enough to survive the tone
    // curve. See the rim term in art/materials.js for the other half: Fresnel
    // is what gives a dark lacquer its edge, and it is paid for separately.
    look: { kind: 'piano', mat: 'lacquer', tint: '#2b2724' },
  }),
  P('bathtub', {
    name: 'CAST IRON BATH', shape: 'compound', mass: 190, value: 1800,
    parts: [
      { shape: 'box', size: [1.70, 0.16, 0.74], offset: [0, 0.10, 0] },
      { shape: 'box', size: [1.70, 0.56, 0.10], offset: [0, 0.44, 0.32] },
      { shape: 'box', size: [1.70, 0.56, 0.10], offset: [0, 0.44, -0.32] },
      { shape: 'box', size: [0.10, 0.56, 0.74], offset: [0.80, 0.44, 0] },
      { shape: 'box', size: [0.10, 0.56, 0.74], offset: [-0.80, 0.44, 0] },
    ],
    look: { kind: 'bathtub', mat: 'enamel', tint: '#eceae4' },
  }),
  P('generator', {
    name: 'DIESEL GENERATOR', shape: 'box', size: [1.24, 0.92, 0.78], mass: 260,
    value: 2200, look: { kind: 'generator', mat: 'rust', tint: '#d4791f' },
  }),
  P('chandelier', {
    name: 'CHANDELIER', shape: 'compound', mass: 96, value: 3100, fragile: 2.2,
    parts: [
      { shape: 'cyl', size: [0.62, 0.14], offset: [0, 0, 0] },
      { shape: 'cyl', size: [0.40, 0.30], offset: [0, 0.22, 0] },
      { shape: 'cyl', size: [0.16, 0.44], offset: [0, 0.50, 0] },
    ],
    look: { kind: 'chandelier', mat: 'glass', tint: '#f6e7b0' },
  }),
];

export const PROP_BY_ID = Object.fromEntries(PROPS.map((p) => [p.id, p]));
export const PROP_INDEX = Object.fromEntries(PROPS.map((p, i) => [p.id, i]));

/** Rough bounding radius, for grab rays and van fitting. */
export function propRadius(def) {
  if (def.shape === 'ball') return def.size[0];
  if (def.shape === 'cyl') return Math.hypot(def.size[0], def.size[1] / 2);
  if (def.shape === 'box') return Math.hypot(def.size[0], def.size[1], def.size[2]) / 2;
  let r = 0;
  for (const p of def.parts) {
    const o = Math.hypot(p.offset[0], p.offset[1], p.offset[2]);
    const s = p.shape === 'cyl' ? Math.hypot(p.size[0], p.size[1] / 2)
      : p.shape === 'ball' ? p.size[0]
        : Math.hypot(p.size[0], p.size[1], p.size[2]) / 2;
    r = Math.max(r, o + s);
  }
  return r;
}
