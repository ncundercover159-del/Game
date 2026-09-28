// Creatures of the deep zones, drawn from shapes in the house style (1px dark outline, 3-4 tones a
// ramp, lit from the upper left), all facing right (the game flips them for left):
//   kitsune, onibi, karasu-tengu and its crows (Foxfire Halls); oni and inoshishi (Oni Foundry);
//   the Kappa Elder, Kyūbi and Kurenai (bosses). Each has idle/move frames, a tell pose that reads
//   at a glance, and its attack.
import { grid, set, fillRect, ellipse, polygon, line, outline } from './raster.js';

const hline = (g, x0, x1, y, c) => { for (let x = x0; x <= x1; x++) set(g, x, y, c); };
const vline = (g, x, y0, y1, c) => { for (let y = y0; y <= y1; y++) set(g, x, y, c); };
const done = (g) => outline(g, { color: 'ink0' });

// ---------------------------------------------------------------- kitsune

const FOX = { fur: 'gold1', shade: 'gold0', lit: 'gold2', belly: 'straw4', tip: 'ink6', dark: 'ink1' };

/** A fox side-on. `pose`: walk (step 0/1), crouch (the tell), lunge. `pal` recolours (Kyūbi). */
function fox(pose, step = 0, pal = FOX, w = 22, h = 16) {
  const g = grid(w, h);
  const low = pose === 'crouch' ? 2 : 0, long = pose === 'lunge' ? 2 : 0;
  // Tail: a fat plume curling up behind, white-tipped.
  const ty = pose === 'crouch' ? 3 : 5;
  ellipse(g, 5, ty + 2, 4, 3, pal.fur);
  ellipse(g, 4, ty + 1, 3, 2, pal.lit);
  ellipse(g, 2, ty, 2, 1.6, pal.tip);
  // Body.
  ellipse(g, 11 + long / 2, 9 + low, 5 + long, 3, pal.fur);
  hline(g, 8, 14 + long, 11 + low, pal.belly);
  hline(g, 8, 13 + long, 7 + low, pal.lit);
  // Legs: hind and fore, alternating on the walk.
  const legs = pose === 'lunge' ? [[6, 2], [8, 1], [17, -1], [19, 0]] : [[8, step ? 1 : 0], [10, step ? 0 : 1], [13, step ? 1 : 0], [15, step ? 0 : 1]];
  for (const [x, lift] of legs) vline(g, x, 12 + low - (pose === 'crouch' ? 1 : 0), 14 - lift, pal.shade);
  // Head, snout, ears, eye.
  const hx = 17 + long, hy = 6 + low;
  ellipse(g, hx, hy, 3, 2.5, pal.fur);
  polygon(g, [[hx + 1, hy - 1], [hx + 5, hy + 1], [hx + 1, hy + 2]], pal.fur);
  set(g, hx + 4, hy + 1, 'ink0');
  hline(g, hx - 1, hx + 2, hy + 2, pal.belly);
  for (const ex of [hx - 2, hx]) { polygon(g, [[ex, hy - 2], [ex + 1, hy - 5], [ex + 2, hy - 2]], pal.fur); set(g, ex + 1, hy - 4, pal.dark); }
  set(g, hx + 1, hy, pose === 'crouch' ? 'red3' : 'ink0');
  if (pose === 'lunge') line(g, hx + 2, hy + 2, hx + 4, hy + 2, 'red2');
  return done(g);
}

// ---------------------------------------------------------------- onibi

/** A wisp of blue-white fire; `flare` is the white-hot tell; `dive` is streaked forward. */
function wisp(pose, step = 0) {
  const g = grid(14, 16);
  const [outer, mid, core] = pose === 'flare' ? ['water4', 'ink6', 'ink6'] : ['water2', 'water3', 'water4'];
  if (pose === 'dive') {
    polygon(g, [[1, 9], [8, 5], [13, 8], [8, 12]], outer);
    ellipse(g, 9, 8.5, 3, 2.5, mid);
    ellipse(g, 10, 8.5, 1.5, 1.2, 'ink6');
    return done(g);
  }
  const sway = step ? 1 : -1;
  polygon(g, [[7 + sway, 1], [11, 8], [11, 12], [7, 15], [3, 12], [3, 8]], outer);
  ellipse(g, 7, 11, 3, 3, mid);
  ellipse(g, 7, 11.5, 1.6, 1.6, core);
  set(g, 6, 11, 'ink0'); set(g, 8, 11, 'ink0');
  return done(g);
}

// ---------------------------------------------------------------- karasu-tengu and crows

/** The crow-headed tengu: black robes, a little red tokin cap, a yellow beak, wings and a feather fan. */
function tengu(pose, step = 0) {
  const g = grid(30, 30);
  const cx = 15;
  // Wings: folded at the back, or spread wide for the summoning.
  if (pose === 'spread') {
    for (const s of [-1, 1]) polygon(g, [[cx, 10], [cx + s * 14, 4], [cx + s * 13, 12], [cx + s * 9, 18], [cx, 16]], 'ink1');
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) line(g, cx + s * 3, 12, cx + s * (13 - i * 2), 6 + i * 3, 'ink2');
  } else {
    polygon(g, [[cx - 2, 10], [cx - 8, 8 + step], [cx - 7, 20], [cx - 2, 22]], 'ink1');
    line(g, cx - 3, 12, cx - 7, 10 + step, 'ink2');
  }
  // Robe and legs.
  polygon(g, [[cx - 4, 12], [cx + 4, 12], [cx + 6, 26], [cx - 6, 26]], 'ink2');
  fillRect(g, cx - 3, 13, 7, 2, 'gold1');
  hline(g, cx - 5, cx + 5, 26, 'ink1');
  for (const x of [cx - 3, cx + 2]) fillRect(g, x, 27, 2, 2, 'wood1');
  // Head: black feathers, a red cap, a beak.
  ellipse(g, cx, 8, 4, 4, 'ink1');
  ellipse(g, cx - 1, 7, 2, 2, 'ink2');
  fillRect(g, cx - 1, 2, 3, 2, 'red2');
  polygon(g, [[cx + 3, 7], [cx + 8, 9], [cx + 3, 10]], 'gold2');
  set(g, cx + 2, 7, pose === 'spread' ? 'red3' : 'gold3');
  // The fan: held low, or swept forward to cut.
  const [fx, fy] = pose === 'fan' ? [cx + 10, 14] : [cx + 5, 18];
  line(g, cx + 3, 16, fx, fy, 'wood2');
  ellipse(g, fx + 1, fy - 2, 3, 3, 'grass3');
  ellipse(g, fx + 1, fy - 2, 1.5, 1.5, 'grass5');
  return done(g);
}

function crow(pose, step = 0) {
  const g = grid(14, 12);
  ellipse(g, 7, 7, 4, 2.5, 'ink1');
  ellipse(g, 10, 5, 2, 2, 'ink1');
  polygon(g, [[11, 5], [14, 6], [11, 7]], 'stone2');
  set(g, 10, 4, 'gold2');
  polygon(g, [[1, 7], [4, 6], [4, 9]], 'ink2');
  if (pose === 'dive') polygon(g, [[4, 6], [9, 6], [2, 3]], 'ink2');
  else if (step) polygon(g, [[4, 6], [9, 6], [5, 0]], 'ink2');
  else polygon(g, [[4, 7], [9, 7], [6, 11]], 'ink2');
  return done(g);
}

// ---------------------------------------------------------------- oni

/** A foundry oni: red hide, horns, a wild mane, tiger-skin loincloth, an iron club. */
function oni(pose, step = 0, pal = { skin: ['red1', 'red2', 'red3'], hair: 'ink0' }) {
  const g = grid(36, 40);
  const cx = 16, [dk, md, lt] = pal.skin;
  // Legs, apart and planted.
  for (const [x, lift] of [[cx - 6, step ? 1 : 0], [cx + 2, step ? 0 : 1]]) {
    fillRect(g, x, 30, 5, 7 - lift, md);
    vline(g, x, 30, 36 - lift, dk);
    hline(g, x - 1, x + 4, 37 - lift, dk);
  }
  // Tiger-skin loincloth.
  polygon(g, [[cx - 7, 25], [cx + 8, 25], [cx + 7, 32], [cx - 6, 32]], 'gold2');
  for (let x = cx - 5; x < cx + 7; x += 3) line(g, x, 26, x + 1, 30, 'ink0');
  hline(g, cx - 7, cx + 8, 25, 'wood1');
  // Torso: broad shoulders tapering to the waist, shaded on the right.
  polygon(g, [[cx - 9, 13], [cx + 9, 13], [cx + 7, 26], [cx - 7, 26]], md);
  polygon(g, [[cx + 3, 13], [cx + 9, 13], [cx + 7, 26], [cx + 3, 26]], dk);
  hline(g, cx - 8, cx + 2, 14, lt);
  for (const y of [18, 21]) hline(g, cx - 3, cx + 1, y, dk);
  vline(g, cx - 1, 15, 24, dk);
  // The free arm hangs at the side.
  fillRect(g, cx - 12, 14, 4, 11, md);
  vline(g, cx - 12, 14, 24, lt);
  ellipse(g, cx - 10, 26, 2.5, 2, md);
  // Head: face forward-right, gold eyes under heavy brows, fangs; a wild dark mane; two horns.
  ellipse(g, cx + 1, 8, 5.5, 5, md);
  for (const [x, y] of [[cx - 5, 3], [cx - 6, 7], [cx - 5, 11], [cx - 2, 1], [cx + 2, 1]]) ellipse(g, x, y, 2.5, 2.5, pal.hair);
  hline(g, cx + 1, cx + 5, 6, pal.hair);
  set(g, cx + 2, 7, 'gold3'); set(g, cx + 5, 7, 'gold3');
  hline(g, cx + 1, cx + 5, 11, dk);
  set(g, cx + 2, 12, 'ink6'); set(g, cx + 5, 12, 'ink6');
  set(g, cx + 6, 9, dk);
  for (const hx of [cx - 2, cx + 4]) { polygon(g, [[hx - 1, 4], [hx, -1], [hx + 2, 4]], 'straw4'); set(g, hx, 0, 'ink6'); }
  // The club: raised overhead in the tell, down in front on the smash, resting on the shoulder.
  const club = pose === 'raise' ? [[cx + 8, 14], [cx + 3, -2]] : pose === 'smash' ? [[cx + 9, 18], [cx + 20, 31]] : [[cx + 8, 20], [cx + 13, 4]];
  const [[ax, ay], [bx, by]] = club;
  fillRect(g, cx + 7, 14, 4, 8, md);
  ellipse(g, ax + 0.5, ay + 0.5, 2.5, 2.5, md);
  const len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len;
  for (let d = 0; d <= len; d += 0.5) {
    const x = Math.round(ax + ux * d), y = Math.round(ay + uy * d), r = d < len * 0.35 ? 1 : 2;
    ellipse(g, x + 0.5, y + 0.5, r, r, d < len * 0.35 ? 'wood1' : 'ink2');
  }
  for (let d = len * 0.45; d <= len; d += 2.5) set(g, Math.round(ax + ux * d - uy * 2), Math.round(ay + uy * d + ux * 2), 'stone3');
  return done(g);
}

// ---------------------------------------------------------------- inoshishi

function boar(pose, step = 0) {
  const g = grid(22, 16);
  const low = pose === 'paw' ? 1 : 0, charge = pose === 'charge';
  ellipse(g, 10, 8 + low, 7, 4, 'wood1');
  ellipse(g, 9, 7 + low, 6, 2.5, 'wood2');
  hline(g, 5, 13, 6 + low, 'wood3');
  for (let x = 4; x < 15; x += 2) { set(g, x, 4 + low, 'ink1'); set(g, x + 1, 3 + low, 'ink1'); }
  // Head down and forward, tusks.
  ellipse(g, 17, 9 + low, 3, 3, 'wood1');
  fillRect(g, 19, 9 + low, 3, 2, 'wood4');
  set(g, 21, 9 + low, 'ink0');
  set(g, 19, 11 + low, 'ink6'); set(g, 20, 12 + low, 'ink6');
  set(g, 16, 7 + low, pose === 'paw' ? 'red3' : 'ink0');
  polygon(g, [[14, 6 + low], [15, 3 + low], [16, 6 + low]], 'wood1');
  // Legs.
  const legs = charge
    ? [[5, step ? 2 : 0, -1], [8, step ? 0 : 2, 1], [13, step ? 2 : 0, 1], [16, step ? 0 : 2, 2]]
    : [[5, 0, 0], [8, step, 0], [13, pose === 'paw' ? 3 : step ? 0 : 1, 0], [16, 0, 0]];
  for (const [x, lift, lean] of legs) line(g, x, 11 + low, x + lean, 15 - lift, 'ink1');
  set(g, 2, 7 + low, 'ink1');
  return done(g);
}

// ---------------------------------------------------------------- the Kappa Elder

/** A great old kappa in a sumo belt: shell, a dish of water on his head, white hair round it. */
function kappaElder(pose, step = 0) {
  const g = grid(40, 40);
  const cx = 18, bow = pose === 'bow' ? 1 : 0, lean = pose === 'charge' ? 3 : 0;
  const hy = bow ? 17 : 8;
  // Shell behind.
  ellipse(g, cx - 5 - lean, 20, 9, 10, 'wood1');
  ellipse(g, cx - 6 - lean, 19, 7, 8, 'wood2');
  for (const [x, y] of [[-9, 15], [-5, 13], [-4, 20], [-9, 22], [-6, 26]]) { hline(g, cx + x - lean, cx + x + 3 - lean, y, 'wood3'); }
  // Legs (one up for shiko).
  const shiko = pose === 'stomp';
  fillRect(g, cx - 5, 30, 5, shiko ? 3 : 8, 'grass2');
  fillRect(g, cx + 3, 31 - (shiko ? 7 : 0), 5, 7, 'grass2');
  hline(g, cx - 6, cx, 37, 'grass1');
  hline(g, cx + 2, cx + 8, 37 - (shiko ? 7 : 0), 'grass1');
  // Body and belly, mawashi belt.
  ellipse(g, cx + lean, 22, 10, 10, 'grass3');
  ellipse(g, cx + 2 + lean, 23, 6, 7, 'straw3');
  fillRect(g, cx - 9 + lean, 26, 20, 4, 'indigo1');
  hline(g, cx - 9 + lean, cx + 10 + lean, 26, 'indigo2');
  // Arms: a slap reaches out; otherwise on the knees.
  if (pose === 'slap') { fillRect(g, cx + 8, 16, 12, 4, 'grass3'); ellipse(g, cx + 21, 17, 3, 3, 'grass4'); }
  else { fillRect(g, cx + 8, 18 + bow * 4, 4, 10, 'grass3'); ellipse(g, cx + 10, 28 + bow * 3, 3, 2, 'grass4'); }
  // Head, beak, the dish and its ring of white hair.
  const hx = cx + 5 + lean;
  ellipse(g, hx, hy + 4, 6, 5, 'grass3');
  polygon(g, [[hx + 4, hy + 4], [hx + 10, hy + 6], [hx + 4, hy + 8]], 'gold1');
  set(g, hx + 2, hy + 3, 'ink0');
  ellipse(g, hx, hy, 6, 2, 'ink5');
  ellipse(g, hx, hy - 0.5, 4, 1.5, pose === 'bow' ? 'water4' : 'water3');
  set(g, hx - 2, hy - 1, 'ink6');
  if (bow) for (const [x, y] of [[hx + 5, hy + 1], [hx + 7, hy + 3], [hx + 8, hy + 6]]) set(g, x, y, 'water4');
  return done(g);
}

// ---------------------------------------------------------------- Kyūbi

/** The great white fox: a long body, a narrow head with red markings, and nine tails plumed out
 * from her hindquarters (`tell` fans them wide and high). `dash` stretches her; `tired` lies low. */
function kyubi(pose, step = 0) {
  const g = grid(52, 36);
  const low = pose === 'tired' ? 4 : 0, long = pose === 'dash' ? 4 : 0;
  const rx = 18, ry = 20 + low;
  // Tails first, so the body sits over their roots.
  const spread = pose === 'tell' ? 1.35 : pose === 'dash' ? 0.6 : 1;
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.5 + (i / 8) * 0.75 * spread) + (step ? 0.05 : -0.05) - (spread - 1) * 0.6;
    const len = (13 + (i % 3) * 2) * (pose === 'tell' ? 1.15 : 1);
    for (let k = 0; k <= 1; k += 0.1) {
      const x = rx + Math.cos(a) * len * k, y = ry - Math.sin(a) * len * k * 0.8;
      const r = 1.2 + Math.sin(k * Math.PI) * 1.8;
      ellipse(g, x, y, r, r, k > 0.85 ? 'gold2' : k > 0.55 ? 'ink6' : 'ink5');
    }
  }
  // Body.
  ellipse(g, 27 + long / 2, 21 + low, 10 + long, 5, 'ink6');
  hline(g, 20, 34 + long, 25 + low, 'ink4');
  hline(g, 21, 33 + long, 17 + low, 'stone4');
  // Legs.
  const legs = pose === 'dash' ? [[18, 3], [22, 1], [36, 0], [40, 2]] : [[20, step ? 1 : 0], [24, step ? 0 : 1], [31, step ? 1 : 0], [35, step ? 0 : 1]];
  if (pose !== 'tired') for (const [x, lift] of legs) { vline(g, x, 25, 31 - lift, 'ink5'); vline(g, x + 1, 25, 31 - lift, 'ink4'); set(g, x, 32 - lift, 'ink3'); }
  // Head: long snout, tall ears, gold eye, red markings.
  const hx = 39 + long, hy = 15 + low;
  ellipse(g, hx, hy, 5, 4, 'ink6');
  polygon(g, [[hx + 2, hy - 1], [hx + 10, hy + 2], [hx + 2, hy + 3]], 'ink6');
  set(g, hx + 9, hy + 2, 'ink0');
  for (const ex of [hx - 3, hx + 1]) { polygon(g, [[ex, hy - 3], [ex + 1, hy - 9], [ex + 3, hy - 3]], 'ink6'); set(g, ex + 1, hy - 6, 'red1'); }
  set(g, hx + 2, hy, pose === 'tired' ? 'ink3' : 'gold3');
  hline(g, hx + 1, hx + 4, hy - 1, 'red2');
  set(g, hx + 5, hy + 1, 'red2');
  if (pose === 'dash') line(g, hx + 4, hy + 3, hx + 8, hy + 3, 'red2');
  return g;
}

// ---------------------------------------------------------------- Kurenai

/** The oni warlord: red hide, white mane, gold-horned kabuto; lacquer plates while armoured. */
function kurenai(pose, step = 0, armour = true) {
  const pal = { skin: ['red0', 'red1', 'red2'], hair: 'ink5' };
  const base = oni(pose === 'breathe' || pose === 'crouch' ? 'walk' : pose, step, pal);
  const g = grid(44, 50);
  const oy = pose === 'crouch' ? 10 : 8;
  for (let y = 0; y < base.h; y++) for (let x = 0; x < base.w; x++) { const c = base.px[y * base.w + x]; if (c) g.px[(y + oy) * g.w + x + 4] = c; }
  const cx = 21;
  // Kabuto with great gold horns (maedate).
  fillRect(g, cx - 5, oy + 2, 11, 4, 'ink1');
  hline(g, cx - 6, cx + 6, oy + 6, 'ink2');
  polygon(g, [[cx - 1, oy + 3], [cx - 9, oy - 7], [cx - 6, oy - 7], [cx, oy + 1]], 'gold2');
  polygon(g, [[cx + 1, oy + 3], [cx + 9, oy - 7], [cx + 6, oy - 7], [cx, oy + 1]], 'gold2');
  set(g, cx, oy + 3, 'red3');
  if (armour) {
    // Dō (chest plate) and sode (shoulder guards): black lacquer, red lacing, gold trim.
    fillRect(g, cx - 7, oy + 15, 15, 11, 'ink1');
    for (let y = oy + 17; y < oy + 26; y += 3) hline(g, cx - 6, cx + 7, y, 'red1');
    hline(g, cx - 7, cx + 7, oy + 15, 'gold1');
    for (const sx of [cx - 11, cx + 7]) { fillRect(g, sx, oy + 14, 5, 7, 'ink2'); hline(g, sx, sx + 4, oy + 17, 'red1'); hline(g, sx, sx + 4, oy + 14, 'gold1'); }
  }
  if (pose === 'breathe') { ellipse(g, cx + 5, oy + 12, 2.5, 2, 'gold3'); ellipse(g, cx + 5, oy + 12, 1.2, 1, 'ink6'); }
  return done(g);
}

/** Every frame name -> grid. Anchor: bottom centre. */
export function deepFrames() {
  const out = {};
  for (const s of [0, 1]) {
    out[`kitsune_walk${s}`] = fox('walk', s);
    out[`onibi_float${s}`] = wisp('float', s);
    out[`tengu_idle${s}`] = tengu('idle', s);
    out[`karasu_fly${s}`] = crow('fly', s);
    out[`oni_walk${s}`] = oni('walk', s);
    out[`inoshishi_walk${s}`] = boar('walk', s);
    out[`inoshishi_charge${s}`] = boar('charge', s);
    out[`kappa_elder_idle${s}`] = kappaElder('idle', s);
    out[`kyubi_idle${s}`] = done(kyubi('idle', s));
    out[`kurenai_walk${s}`] = kurenai('walk', s, true);
    out[`kurenai_bare_walk${s}`] = kurenai('walk', s, false);
  }
  Object.assign(out, {
    kitsune_crouch: fox('crouch'), kitsune_lunge: fox('lunge'),
    onibi_flare: wisp('flare'), onibi_dive: wisp('dive'),
    tengu_spread: tengu('spread'), tengu_fan: tengu('fan'),
    karasu_dive: crow('dive'),
    oni_raise: oni('raise'), oni_smash: oni('smash'),
    inoshishi_paw: boar('paw'),
    kappa_elder_stomp: kappaElder('stomp'), kappa_elder_slap: kappaElder('slap'), kappa_elder_bow: kappaElder('bow'), kappa_elder_charge: kappaElder('charge'),
    kyubi_tell: done(kyubi('tell')), kyubi_dash: done(kyubi('dash')), kyubi_tired: done(kyubi('tired')),
  });
  for (const pose of ['raise', 'smash', 'breathe', 'crouch']) {
    out[`kurenai_${pose}`] = kurenai(pose, 0, true);
    out[`kurenai_bare_${pose}`] = kurenai(pose, 0, false);
  }
  return out;
}

// ---------------------------------------------------------------- shots, embers

export function deepShots() {
  const water = (s) => { const g = grid(8, 8); ellipse(g, 4, 4, 3, 3, 'water3'); ellipse(g, 3 + s, 3, 1.5, 1.5, 'water4'); set(g, 3, 2, 'ink6'); return outline(g, { color: 'water1' }); };
  const fire = (s) => { const g = grid(9, 9); ellipse(g, 4.5, 4.5, 3.5, 3.5, 'red3'); ellipse(g, 4.5, 4.5, 2.2, 2.2, 'gold2'); ellipse(g, 4 + s, 4, 1, 1, 'gold3'); return outline(g, { color: 'red1' }); };
  const shuriken = (s) => {
    const g = grid(8, 8);
    const pts = s ? [[4, 0], [4, 7], [0, 4], [7, 4]] : [[1, 1], [6, 6], [1, 6], [6, 1]];
    for (const [x, y] of pts) line(g, 4, 4, x, y, 'stone3');
    set(g, 4, 4, 'ink1');
    return outline(g, { color: 'ink0' });
  };
  const feather = () => { const g = grid(10, 5); line(g, 0, 2, 9, 2, 'ink2'); line(g, 1, 1, 7, 1, 'ink1'); line(g, 1, 3, 7, 3, 'ink1'); set(g, 9, 2, 'stone3'); return outline(g, { color: 'ink0' }); };
  const ember = () => { const g = grid(2, 2); fillRect(g, 0, 0, 2, 2, 'gold2'); set(g, 1, 1, 'red3'); return g; };
  const flare = () => { const g = grid(10, 10); ellipse(g, 5, 5, 4, 4, 'gold3'); ellipse(g, 5, 5, 2.5, 2.5, 'ink6'); return outline(g, { color: 'gold1' }); };
  return {
    water0: water(0), water1: water(1), fire0: fire(0), fire1: fire(1), shuriken0: shuriken(0), shuriken1: shuriken(1),
    feather: feather(), ember: ember(), orb_flare: flare(),
  };
}
