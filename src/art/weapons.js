// Weapons in hand (anchored like the character, feet at (8, 32)) and the icons of weapons, ores,
// gems, bars and the things spirits leave behind. 16x16 icons with a 1px margin.
import { grid, set, line, fillRect, ellipse, polygon, parse, outline, bounds, crop, blit } from './raster.js';

const PAD = 20;

// Blade looks: [edge, flat, back] ramps plus hilt and guard colours.
const BLADES = {
  katana_rusted: { edge: 'stone3', flat: 'wood3', back: 'wood2', hilt: 'ink2', wrap: 'wood1', guard: 'wood2', len: 15 },
  katana_tetsu: { edge: 'ink6', flat: 'stone4', back: 'stone2', hilt: 'ink1', wrap: 'indigo1', guard: 'gold1', len: 15 },
  hisui: { edge: 'ink6', flat: 'stone4', back: 'stone2', hilt: 'ink1', wrap: 'grass2', guard: 'grass4', len: 15 },
  mizuchi: { edge: 'ink6', flat: 'water4', back: 'water2', hilt: 'ink1', wrap: 'water1', guard: 'stone3', len: 15 },
  kurogane: { edge: 'stone3', flat: 'ink3', back: 'ink1', hilt: 'red1', wrap: 'ink0', guard: 'gold2', len: 16 },
  kitsunebi: { edge: 'gold3', flat: 'gold2', back: 'gold1', hilt: 'ink1', wrap: 'red1', guard: 'gold1', len: 15 },
  onikiri: { edge: 'ink6', flat: 'stone3', back: 'stone1', hilt: 'ink0', wrap: 'ink2', guard: 'stone4', len: 16 },
  tsukikage: { edge: 'ink6', flat: 'indigo3', back: 'indigo2', hilt: 'ink1', wrap: 'indigo0', guard: 'gold2', len: 16 },
};

// [hand, tip] in frame coordinates for each direction and pose.
const POSES = {
  down: { raise: [[10, 17], [14, 3]], strike: [[8, 23], [7, 41]], guard: [[4, 21], [16, 19]] },
  up: { raise: [[7, 17], [3, 3]], strike: [[8, 17], [8, -2]], guard: [[3, 19], [15, 17]] },
  right: { raise: [[9, 18], [0, 5]], strike: [[11, 22], [27, 23]], guard: [[11, 20], [13, 6]] },
};

/** A blade from hand to tip: a short wrapped grip, a guard, then the edge, flat and back. */
function bladeSprite(look, dir, pose, poleLen = 0) {
  const [[hx, hy], [ex, ey]] = POSES[dir][pose];
  const g = grid(16 + PAD * 2, 32 + PAD * 2);
  const len = Math.hypot(ex - hx, ey - hy);
  const ux = (ex - hx) / len, uy = (ey - hy) / len;
  const at = (d) => [Math.round(hx + ux * d) + PAD, Math.round(hy + uy * d) + PAD];
  const grip = poleLen || 3;
  // Grip (a pole for spears and glaives) runs back from the hand.
  for (let d = -grip; d <= 1; d += 0.5) { const [x, y] = at(d); set(g, x, y, poleLen ? 'wood3' : look.wrap); }
  if (!poleLen) { const [x, y] = at(-grip); set(g, x, y, look.hilt); }
  const [gx, gy] = at(2);
  set(g, gx, gy, look.guard); set(g, gx - Math.round(uy), gy + Math.round(ux), look.guard); set(g, gx + Math.round(uy), gy - Math.round(ux), look.guard);
  const bladeLen = Math.min(look.len, len + 4);
  for (let d = 3; d <= bladeLen; d += 0.5) {
    const [x, y] = at(d);
    set(g, x, y, look.flat);
    // The edge on one side, the back on the other (a curved katana reads as two tones).
    set(g, x + Math.round(uy), y - Math.round(ux), d > bladeLen - 1 ? look.flat : look.edge);
  }
  const [tx, ty] = at(bladeLen + 0.5);
  set(g, tx, ty, look.edge);
  return finish(outline(g, { color: 'ink0', pad: 0 }));
}

function finish(g) {
  const b = bounds(g);
  return { g: crop(g, ...b), ax: 8 + PAD - b[0], ay: 32 + PAD - b[1] };
}

const SPEAR_HEAD = { edge: 'ink6', flat: 'stone4', back: 'stone2', hilt: 'wood1', wrap: 'wood3', guard: 'red2', len: 0 };

/** Spear and glaive: a long pole with a head at the end. */
function poleSprite(kind, dir, pose) {
  const [[hx, hy], [ex, ey]] = POSES[dir][pose];
  const g = grid(16 + PAD * 2, 32 + PAD * 2);
  const len = Math.hypot(ex - hx, ey - hy), ux = (ex - hx) / len, uy = (ey - hy) / len;
  const reach = kind === 'yari' ? 26 : 22;
  const at = (d) => [Math.round(hx + ux * d) + PAD, Math.round(hy + uy * d) + PAD];
  for (let d = -8; d <= reach - 6; d += 0.5) { const [x, y] = at(d); set(g, x, y, 'wood3'); set(g, x - Math.round(uy), y + Math.round(ux), 'wood1'); }
  const [cx, cy] = at(reach - 6);
  set(g, cx, cy, 'red2');
  for (let d = reach - 5; d <= reach; d += 0.5) {
    const [x, y] = at(d);
    set(g, x, y, 'stone4');
    if (kind === 'naginata') { set(g, x + Math.round(uy), y - Math.round(ux), 'ink6'); if (d > reach - 3) set(g, x + 2 * Math.round(uy), y - 2 * Math.round(ux), 'stone3'); }
    else if (d < reach - 1) set(g, x + Math.round(uy), y - Math.round(ux), 'ink6');
  }
  return finish(outline(g, { color: 'ink0', pad: 0 }));
}

/** The kanabō: a thick iron club, studs along its head. */
function clubSprite(dir, pose) {
  const [[hx, hy], [ex, ey]] = POSES[dir][pose];
  const g = grid(16 + PAD * 2, 32 + PAD * 2);
  const len = Math.hypot(ex - hx, ey - hy), ux = (ex - hx) / len, uy = (ey - hy) / len;
  const at = (d) => [Math.round(hx + ux * d) + PAD, Math.round(hy + uy * d) + PAD];
  for (let d = -3; d <= 17; d += 0.5) {
    const [x, y] = at(d), thick = d > 5 ? 1 : 0;
    set(g, x, y, d < 2 ? 'red1' : 'ink2');
    if (thick) { set(g, x + Math.round(uy), y - Math.round(ux), 'ink1'); set(g, x - Math.round(uy), y + Math.round(ux), 'ink3'); }
    if (thick && Math.round(d) % 3 === 0) set(g, x + 2 * Math.round(uy), y - 2 * Math.round(ux), 'stone3');
  }
  return finish(outline(g, { color: 'ink0', pad: 0 }));
}

/** The bow held out (strike) or across the back (raise, guard). */
function bowSprite(dir, pose) {
  const g = grid(16 + PAD * 2, 32 + PAD * 2);
  const drawn = pose === 'strike';
  const [cx, cy] = drawn ? { down: [8, 26], up: [8, 14], right: [16, 21] }[dir] : [4, 18];
  const vertical = !drawn || dir === 'right';
  for (let i = -9; i <= 9; i++) {
    const bend = Math.round((1 - (i * i) / 81) * 3);
    const [x, y] = vertical ? [cx + bend, cy + i] : [cx + i, cy + (dir === 'up' ? -bend : bend)];
    set(g, x + PAD, y + PAD, Math.abs(i) > 7 ? 'wood1' : 'wood3');
  }
  if (drawn) {
    if (vertical) {
      line(g, cx + PAD, cy - 9 + PAD, cx + PAD - 2, cy + PAD, 'ink5');
      line(g, cx + PAD - 2, cy + PAD, cx + PAD, cy + 9 + PAD, 'ink5');
    } else {
      line(g, cx - 9 + PAD, cy + PAD, cx + 9 + PAD, cy + PAD, 'ink5');
    }
  }
  return finish(outline(g, { color: 'ink0', pad: 0 }));
}

export const HELD_WEAPONS = [...Object.keys(BLADES), 'yari', 'naginata', 'yumi', 'kanabo'];

/** Register `held_<weapon>_<dir>_<pose>` for raise, strike and guard. */
export function addHeldWeapons(atlas) {
  for (const id of HELD_WEAPONS) for (const dir of ['down', 'up', 'right']) for (const pose of ['raise', 'strike', 'guard']) {
    const s = id === 'yumi' ? bowSprite(dir, pose) : id === 'kanabo' ? clubSprite(dir, pose) : id === 'yari' || id === 'naginata' ? poleSprite(id, dir, pose) : bladeSprite(BLADES[id], dir, pose);
    atlas.add(`held_${id}_${dir}_${pose}`, s.g, s.ax, s.ay);
  }
}

// ---------------------------------------------------------------- icons

function icon(draw, outlineColor = 'ink0') {
  const g = grid(16, 16);
  draw(g);
  const o = outline(g, { color: outlineColor });
  return crop(o, 1, 1, 16, 16);
}

function swordIcon(look) {
  return icon((g) => {
    for (let i = 0; i < 9; i++) { set(g, 5 + i, 10 - i, look.flat); set(g, 6 + i, 10 - i, look.edge); }
    set(g, 14, 1, look.edge);
    for (const [x, y] of [[3, 11], [4, 12], [5, 11], [4, 10]]) set(g, x, y, look.guard);
    for (let i = 0; i < 3; i++) { set(g, 3 - i, 13 + i - 1, look.wrap); set(g, 2 - i, 13 + i, look.hilt); }
  });
}

function poleIcon(kind) {
  return icon((g) => {
    line(g, 1, 14, 11, 4, 'wood3'); line(g, 2, 14, 12, 4, 'wood1');
    set(g, 11, 4, 'red2');
    if (kind === 'yari') { line(g, 12, 3, 14, 1, 'stone4'); set(g, 13, 3, 'ink6'); }
    else { line(g, 12, 3, 14, 1, 'stone4'); line(g, 13, 3, 14, 2, 'ink6'); set(g, 14, 3, 'stone3'); set(g, 13, 1, 'stone3'); }
  });
}

function bowIcon() {
  return icon((g) => {
    for (let i = -6; i <= 6; i++) {
      const b = Math.round((1 - (i * i) / 36) * 3);
      set(g, 5 + b, 8 + i, 'wood2');
      set(g, 6 + b, 8 + i, Math.abs(i) > 4 ? 'wood1' : 'wood3');
    }
    line(g, 4, 2, 4, 14, 'ink5');
  });
}

function rock(ramp, vein, veinDots) {
  return icon((g) => {
    polygon(g, [[2, 12], [3, 6], [7, 3], [12, 4], [14, 9], [12, 13], [5, 14]], ramp[1]);
    polygon(g, [[4, 7], [7, 4], [11, 5], [9, 8], [5, 9]], ramp[2]);
    for (const [x, y] of veinDots) { set(g, x, y, vein[0]); set(g, x + 1, y, vein[1]); }
  });
}

const VEINS = [[5, 10], [9, 7], [11, 10], [7, 12], [6, 6]];

function gem(ramp) {
  return icon((g) => {
    polygon(g, [[8, 1], [13, 6], [8, 14], [3, 6]], ramp[1]);
    polygon(g, [[8, 1], [8, 14], [3, 6]], ramp[2]);
    line(g, 3, 6, 13, 6, ramp[3]);
    set(g, 6, 4, 'ink6'); set(g, 7, 3, 'ink6');
  });
}

function copperBar() {
  const g = grid(16, 16);
  for (const [ox, oy] of [[2, 8], [6, 5]]) for (let y = 0; y < 5; y++) for (let x = 0; x < 9; x++) {
    if (x < y * 0.4 || x > 8 - y * 0.4) continue;
    set(g, ox + x, oy + y, y === 0 ? 'red4' : y < 2 ? 'red3' : y < 4 ? 'wood3' : 'wood2');
  }
  return crop(outline(g, { color: null }), 1, 1, 16, 16);
}

const ARROW = parse(`
  ..............aa
  .............aba
  ...........cc.a.
  .........cc.....
  .......cc.......
  .....cc.........
  ...cc...........
  d.c.............
  ddd.............
  .dd.............`, { a: 'stone4', b: 'stone2', c: 'wood4', d: 'ink6' });

export function weaponIcons() {
  return {
    katana_rusted: swordIcon(BLADES.katana_rusted),
    katana_tetsu: swordIcon(BLADES.katana_tetsu),
    hisui: swordIcon(BLADES.hisui),
    mizuchi: swordIcon(BLADES.mizuchi),
    kurogane: swordIcon(BLADES.kurogane),
    kitsunebi: swordIcon(BLADES.kitsunebi),
    onikiri: swordIcon(BLADES.onikiri),
    tsukikage: swordIcon(BLADES.tsukikage),
    kanabo: icon((g) => {
      for (let i = 0; i < 12; i++) { set(g, 2 + i, 14 - i, i < 3 ? 'red1' : 'ink2'); if (i > 3) { set(g, 3 + i, 14 - i, 'ink1'); set(g, 2 + i, 13 - i, 'ink3'); } }
      for (const [x, y] of [[8, 7], [10, 5], [12, 3], [7, 10], [11, 8], [13, 6]]) set(g, x, y, 'stone3');
    }),
    gold_ore: rock(['stone0', 'stone1', 'stone2'], ['gold1', 'gold3'], VEINS),
    satetsu: icon((g) => {
      polygon(g, [[2, 13], [6, 7], [10, 6], [14, 13]], 'ink1');
      for (let i = 0; i < 14; i++) set(g, 4 + ((i * 7) % 9), 9 + ((i * 5) % 4), i % 3 ? 'stone1' : 'ink3');
    }),
    gold_bar: (() => {
      const g = grid(16, 16);
      for (const [ox, oy] of [[2, 8], [6, 5]]) for (let y = 0; y < 5; y++) for (let x = 0; x < 9; x++) {
        if (x < y * 0.4 || x > 8 - y * 0.4) continue;
        set(g, ox + x, oy + y, y === 0 ? 'gold3' : y < 2 ? 'gold2' : y < 4 ? 'gold1' : 'gold0');
      }
      return crop(outline(g, { color: null }), 1, 1, 16, 16);
    })(),
    reiseki: icon((g) => {
      ellipse(g, 8, 8.5, 4.5, 5.5, 'indigo2'); ellipse(g, 7, 7, 2.5, 3.5, 'indigo3'); set(g, 6, 5, 'ink6'); set(g, 6, 6, 'ink6');
    }, 'indigo0'),
    tengu_feather: icon((g) => {
      line(g, 3, 14, 13, 2, 'ink2');
      for (let i = 0; i < 9; i++) { set(g, 4 + i, 12 - i, 'ink1'); set(g, 5 + i, 13 - i, 'ink1'); set(g, 3 + i, 11 - i, 'ink3'); }
      set(g, 13, 2, 'stone3');
    }),
    kappa_dish: icon((g) => {
      ellipse(g, 8, 9, 6, 3, 'ink5'); ellipse(g, 8, 8.5, 4.5, 2, 'water3'); set(g, 6, 8, 'ink6');
      line(g, 9, 7, 11, 10, 'ink1');
    }),
    kyubi_tail: icon((g) => {
      ellipse(g, 7, 9, 4, 5, 'ink6'); ellipse(g, 9, 5, 3, 3, 'ink6'); ellipse(g, 10, 4, 1.5, 1.5, 'gold2');
      line(g, 5, 14, 7, 12, 'ink4');
    }, 'ink3'),
    yari: poleIcon('yari'),
    naginata: poleIcon('naginata'),
    yumi: bowIcon(),
    arrow: crop(outline((() => { const g = grid(16, 16); blit(g, ARROW, 0, 3); return g; })(), { color: 'ink0' }), 1, 1, 16, 16),
    copper_ore: rock(['stone0', 'stone1', 'stone2'], ['teal1', 'red3'], VEINS),
    iron_ore: rock(['stone0', 'stone1', 'stone2'], ['red1', 'wood2'], VEINS),
    copper_bar: copperBar(),
    jade: gem(['grass0', 'grass2', 'grass4', 'grass6']),
    water_crystal: gem(['water1', 'water3', 'water4', 'ink6']),
    leaf_charm: icon((g) => {
      polygon(g, [[3, 13], [4, 6], [8, 2], [12, 3], [13, 8], [9, 12]], 'grass3');
      line(g, 3, 13, 11, 4, 'grass5'); line(g, 1, 15, 3, 13, 'wood2');
    }),
    spirit_wisp: icon((g) => {
      ellipse(g, 8, 9, 4, 4, 'water3'); ellipse(g, 8, 9, 2.5, 2.5, 'water4'); ellipse(g, 8, 9, 1, 1, 'ink6');
      for (const [x, y] of [[8, 4], [9, 3], [10, 2], [7, 5]]) set(g, x, y, 'water4');
    }, 'water1'),
    salve: icon((g) => {
      ellipse(g, 8, 10, 5, 4, 'ink5'); ellipse(g, 8, 9, 5, 2, 'ink6'); ellipse(g, 8, 8, 3, 1, 'grass4');
      fillRect(g, 4, 11, 9, 1, 'indigo2');
    }),
    kizugusuri: icon((g) => {
      fillRect(g, 6, 2, 4, 2, 'wood2');
      polygon(g, [[5, 5], [11, 5], [13, 10], [11, 14], [5, 14], [3, 10]], 'red1');
      polygon(g, [[5, 6], [8, 6], [6, 12], [4, 10]], 'red3');
      fillRect(g, 6, 8, 4, 4, 'ink6'); set(g, 7, 9, 'red2'); set(g, 8, 10, 'red2');
    }),
  };
}

// Projectiles and combat marks (drawn in the world).
export function combatSprites() {
  const foxfire = [0, 1].map((f) => {
    const g = grid(10, 12);
    ellipse(g, 5, 7, 3.5, 3.5, 'water3'); ellipse(g, 5, 7, 2, 2.2, 'water4'); ellipse(g, 5, 7, 1, 1, 'ink6');
    for (const [x, y] of f ? [[5, 2], [4, 3], [6, 1]] : [[5, 3], [6, 2], [4, 1]]) set(g, x, y, 'water4');
    return outline(g, { color: 'water1' });
  });
  const arrowR = parse(`
    d...........aa.
    ddccccccccccaba
    d...........aa.`, { a: 'stone4', b: 'stone2', c: 'wood4', d: 'ink6' });
  const arrowD = grid(3, 15);
  for (let y = 0; y < 15; y++) for (let x = 0; x < 3; x++) arrowD.px[y * 3 + x] = arrowR.px[x * 15 + y];
  const smoke = [3, 5, 7].map((r) => { const g = grid(r * 2 + 2, r * 2 + 2); ellipse(g, r + 1, r + 1, r, r * 0.8, 'ink4'); ellipse(g, r, r, r * 0.6, r * 0.5, 'ink5'); return g; });
  const ripple = [0, 1, 2].map((f) => {
    const g = grid(18, 8);
    ellipse(g, 9, 4, 5 + f * 2, 2 + f * 0.6, 'water4');
    ellipse(g, 9, 4, 4 + f * 2, 1.4 + f * 0.6, 0);
    return g;
  });
  return { foxfire0: foxfire[0], foxfire1: foxfire[1], arrow_right: arrowR, arrow_down: arrowD, smoke0: smoke[0], smoke1: smoke[1], smoke2: smoke[2], ripple0: ripple[0], ripple1: ripple[1], ripple2: ripple[2] };
}
