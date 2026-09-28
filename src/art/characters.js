// Layered character sprites. Grids use semantic keys so one set of drawings serves every skin
// tone, hair colour and outfit via palette swaps (see LOOKS / lookLegend).
//
// Frame: 16x32, anchor just below the feet (8, 32). Parts: head (rows 0-15), torso (rows 16-23),
// legs (rows 24-31). Directions: down, up, right (left mirrors right at draw time).
//
// Keys: H h j hair (outline, mid, light) | S s f F skin (outline, shadow, mid, light) | e eye |
// m mouth | K k l L kosode | c C collar | b B obi | P p q Q hakama | T sandal | t tabi |
// x X g sword (scabbard, scabbard light, guard/hilt) | w tie cord
import { parse, grid, blit, set } from './raster.js';
import { restyleHead, longHair } from './looks.js';

const HEAD = {
  down: `
    .......HH.......
    ......HjhH......
    ....HHHwwHHH....
    ...HhhjjhhhhH...
    ..HhjjhhhhhhhH..
    .HhjhhhhhhhhhhH.
    .HhhhhhhhhhhhhH.
    .HhhhhhhhhhhhhH.
    .HhhHhHhhhHhhhH.
    .HhHFFHFFFFHfHH.
    .HhFFFFFFFFffhH.
    .HhFFeFFFFefshH.
    .HsFFeFFFFefssH.
    ..SsfFFFmFffsS..
    ...SSsffffsSS...
    .....SSSSSS.....`,
  up: `
    .......HH.......
    ......HjhH......
    ....HHHwwHHH....
    ...HhhjjhhhhH...
    ..HhjjhhhhhhhH..
    .HhjhhhhhhhhhhH.
    .HhhhhhhhhhhhhH.
    .HhjhhhHhhhhhhH.
    .HhhhhHhhhhhhhH.
    .HhhhHhhhhhHhhH.
    .HhhhhhhhhhhhhH.
    .HhhhhhhhhhhhhH.
    .SHhhhhhhhhhhHS.
    ..SHHhhhhhhHHS..
    ...SsHHHHHHsS...
    .....SSSSSS.....`,
  right: `
    .....HH.........
    ....HjhH........
    ...HHwwHHHH.....
    ..HhhjjhhhhHH...
    .HhjjhhhhhhhhH..
    .HjhhhhhhhhhhhH.
    .HhhhhhhhhhhhhH.
    .HhhhhhhhhhhhhH.
    .HhhhhhhhhHhhhH.
    .HhhhhhhhHfFHFH.
    .HhhhhhSSfFFFFFS
    .HhhhhSfsFFFFeFS
    .HhhhhSsSFFFFeFS
    ..HhhhHSfFFFFFS.
    ...HHHHSsfFFmS..
    .......SSSSSS...`,
};

const TORSO = {
  down: {
    stand: `
      .....KccccK.....
      ...KKLcffcLKK...
      ..KLLLLcclllkK..
      .KLKLLLLclllKkK.
      .KLKLLLLllllKkK.
      .KLKbbbbbbbbKkK.
      .SfSBbbbbbgxSsS.
      ..S.KKKKKKxX.S..`,
    armsA: `
      .....KccccK.....
      ...KKLcffcLKK...
      ..KLLLLcclllkK..
      .KLKLLLLclllKkK.
      .KLKLLLLllllKkK.
      .SfSbbbbbbbbKkK.
      ..S.BbbbbbgxSsS.
      ....KKKKKKxX.S..`,
    armsB: `
      .....KccccK.....
      ...KKLcffcLKK...
      ..KLLLLcclllkK..
      .KLKLLLLclllKkK.
      .KLKLLLLllllKkK.
      .KLKbbbbbbbbSsS.
      .SfSBbbbbbgxxS..
      ..S.KKKKKKxX....`,
    raise: `
      ..SS.KccccK.SS..
      ..SfKLcffcLKsS..
      ..KLLLLcclllkK..
      ..KLLLLLclllkK..
      ...KLLLLllllK...
      ...KbbbbbbbbK...
      ...KBbbbbbgxK...
      ....KKKKKKxX....`,
    strike: `
      .....KccccK.....
      ...KKLcffcLKK...
      ..KLLLLcclllkK..
      ..KLLLLLclllkK..
      ...KLLLLLlllK...
      ...KbSffffsbK...
      ...KBSffffsgK...
      ....KKSSSSxX....`,
  },
  up: {
    stand: `
      .....KKKKKK.....
      ...KKLLLLllKK...
      ..KLLLLLLlllkK..
      .KLKLLLLllllKkK.
      .KLKLLLLllllKkK.
      .KLKbbbbbbbbKkK.
      .SfSBbbbbbbbSsS.
      ..S.KKKKKKKK.S..`,
    armsA: `
      .....KKKKKK.....
      ...KKLLLLllKK...
      ..KLLLLLLlllkK..
      .KLKLLLLllllKkK.
      .KLKLLLLllllKkK.
      .SfSbbbbbbbbKkK.
      ..S.BbbbbbbbSsS.
      ....KKKKKKKK.S..`,
    armsB: `
      .....KKKKKK.....
      ...KKLLLLllKK...
      ..KLLLLLLlllkK..
      .KLKLLLLllllKkK.
      .KLKLLLLllllKkK.
      .KLKbbbbbbbbSsS.
      .SfSBbbbbbbbxS..
      ..S.KKKKKKKxX...`,
    raise: `
      ..SS.KKKKKK.SS..
      ..SfKLLLLllKsS..
      ..KLLLLLLlllkK..
      ..KLLLLLllllkK..
      ...KLLLLllllK...
      ...KbbbbbbbbK...
      ...KBbbbbbbbK...
      ....KKKKKKKK....`,
    strike: `
      .....KKKKKK.....
      ...KKLLLLllKK...
      ..KLLLLLLlllkK..
      ..KLLLLLllllkK..
      ...KLLLLllllK...
      ..SKbbbbbbbbKS..
      ..SKBbbbbbbbKS..
      ....KKKKKKKK....`,
  },
  right: {
    stand: `
      ......KKKccK....
      .....KLLLLcfK...
      ....KLLLLLlcK...
      ....KLLKLLllK...
      ....KLLKLLllK...
      ....KbbKbbbbK...
      ..xXKBBSfSbgxx..
      ....KKKSSKKK....`,
    armsA: `
      ......KKKccK....
      .....KLLLLcfK...
      ....KLLLLLlcK...
      ....KLLLKLllK...
      ....KLLLLKllK...
      ....KbbbbKSfS...
      ..xXKBBBbSSgxx..
      ....KKKKKKKK....`,
    armsB: `
      ......KKKccK....
      .....KLLLLcfK...
      ....KLLLLLlcK...
      ....KLKLLLllK...
      ...KLKLLLlllK...
      ...SfSbbbbbbK...
      ..xXSSBBbbbgxx..
      ....KKKKKKKK....`,
    raise: `
      .........SS.....
      ......KKKSfK....
      .....KLLLLKcK...
      ....KLLLLLlcK...
      ....KLLLLLllK...
      ....KbbbbbbbK...
      ..xXKBBbbbbgxx..
      ....KKKKKKKK....`,
    strike: `
      ......KKKccK....
      .....KLLLLcfK...
      ....KLLLLLLKK...
      ....KLLLLLLLSS..
      ....KLLLLLKSfS..
      ....KbbbbbbSS...
      ..xXKBBbbbbgxx..
      ....KKKKKKKK....`,
  },
};

const LEGS = {
  down: {
    stand: `
      ....PQqqqqpP....
      ....PQpqPqpP....
      ...PQqpqPqpqP...
      ...PQqpqPqpqP...
      ..PQqqpqPqqpqP..
      ..PPPPPPPPPPPP..
      ....tTT..TTt....
      ....TTT..TTT....`,
    stepA: `
      ....PQqqqqpP....
      ....PQpqPqpP....
      ...PQqpqPqpqP...
      ...PQqpqPqpqP...
      ..PQqqpqPPPPPP..
      ..PPPPPPP.TTt...
      ....tTT.........
      ....TTT.........`,
    stepB: `
      ....PQqqqqpP....
      ....PQpqPqpP....
      ...PQqpqPqpqP...
      ...PQqpqPqpqP...
      ..PPPPPPPqqpqP..
      ...tTT.PPPPPPP..
      .........TTt....
      .........TTT....`,
  },
  up: {
    stand: `
      ....PqqqqqqP....
      ....PqqqPqqP....
      ...PqqqqPqqpP...
      ...PqqqqPqqpP...
      ..PqqqqpPqqqpP..
      ..PPPPPPPPPPPP..
      ....TTT..TTT....
      ....TTT..TTT....`,
    stepA: `
      ....PqqqqqqP....
      ....PqqqPqqP....
      ...PqqqqPqqpP...
      ...PqqqqPqqpP...
      ..PqqqqpPPPPPP..
      ..PPPPPPP.TTT...
      ....TTT.........
      ....TTT.........`,
    stepB: `
      ....PqqqqqqP....
      ....PqqqPqqP....
      ...PqqqqPqqpP...
      ...PqqqqPqqpP...
      ..PPPPPPPqqqpP..
      ...TTT.PPPPPPP..
      .........TTT....
      .........TTT....`,
  },
  right: {
    stand: `
      ....PQqqqqqP....
      ....PQqqqqqP....
      ...PQqqqqqqpP...
      ...PQqqqpqqpP...
      ..PQqqqqpqqqpP..
      ..PPPPPPPPPPPP..
      ......tTTT......
      .....TTTTTT.....`,
    stepA: `
      ....PQqqqqqP....
      ...PQqqqqqqpP...
      ..PQqqqqpqqqpP..
      .PQqqqqPPqqqqpP.
      .PQqqqpP.PqqqpP.
      .PPPPPP...PPPPP.
      ..tTT......tTTT.
      .TTTT.....TTTTT.`,
    stepB: `
      ....PQqqqqqP....
      ...PQqqqqqqpP...
      ...PQqqqpqqqpP..
      ..PQqqqqPqqqpP..
      ..PQqqqPPqqqpP..
      ..PPPPP.PPPPPP..
      ...TTT....tTTT..
      ..TTTT....TTTTT.`,
  },
};

// Part placement within the 16x32 frame.
const HEAD_Y = 0, TORSO_Y = 16, LEGS_Y = 24;

export const LOOKS = {
  player: {
    hair: ['ink0', 'ink2', 'ink3'],
    skin: ['skin1', 'skin3', 'skin4', 'skin5'],
    kosode: ['ink0', 'indigo0', 'indigo1', 'indigo2'],
    hakama: ['ink0', 'stone1', 'stone2', 'stone3'],
    obi: ['wood1', 'wood2'],
    feet: ['wood1', 'ink5'],
    collar: ['ink6', 'ink5'],
    cord: 'red2',
    sword: true,
  },
};

export function lookLegend(look) {
  const [H, h, j] = look.hair;
  const [S, s, f, F] = look.skin;
  const [K, k, l, L] = look.kosode;
  const [P, p, q, Q] = look.hakama;
  return {
    H, h, j, S, s, f, F, e: 'ink0', m: s,
    K, k, l, L, c: look.collar[0], C: look.collar[1],
    b: look.obi[1], B: look.obi[0], P, p, q, Q, T: look.feet[0], t: look.feet[1],
    // Without a sword the scabbard pixels become obi and robe.
    ...(look.sword ? { x: 'ink1', X: 'ink3', g: 'gold1' } : { x: K, X: K, g: look.obi[1] }),
    w: look.cord,
  };
}

/**
 * Animations: each frame lists [torsoPose, legsPose, bob]. Bob lowers head+torso by 1px on the
 * contact frames of the walk. Frame durations are in seconds.
 */
export const ANIMS = {
  idle: { dur: 0.6, frames: [['stand', 'stand', 0], ['stand', 'stand', 0, 1]] },
  walk: { dur: 0.15, frames: [['armsA', 'stepA', 1], ['stand', 'stand', 0], ['armsB', 'stepB', 1], ['stand', 'stand', 0]] },
  tool: { dur: 0.1, frames: [['raise', 'stand', 0], ['strike', 'stand', 1], ['strike', 'stand', 0]] },
};

/**
 * Compose one frame. `breath` (idle frame 2) drops only the head by 1px, a 2-frame breathing
 * idle that keeps the feet planted.
 */
export function composeFrame(look, dir, torsoPose, legsPose, bob, breath = 0) {
  const legend = lookLegend(look);
  const g = grid(16, 32);
  blit(g, parse(LEGS[dir][legsPose], legend), 0, LEGS_Y);
  blit(g, parse(TORSO[dir][torsoPose], legend), 0, TORSO_Y + bob);
  const style = look.style || 'topknot';
  blit(g, parse(style === 'topknot' ? HEAD[dir] : restyleHead(HEAD[dir], dir, style), legend), 0, HEAD_Y + bob + breath);
  if (style === 'long') for (const [x, y] of longHair(dir)) set(g, x, y + bob, look.hair[1]);
  return g;
}

export const DIRS = ['down', 'up', 'right'];

/**
 * A child: the same drawing with the legs shortened (head and body drop 5 px onto the hem and
 * feet), so children read small beside adults.
 */
export function childFrame(g) {
  const out = grid(16, 32);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 16; x++) out.px[(y + 5) * 16 + x] = g.px[y * 16 + x];
  for (let y = 29; y < 32; y++) for (let x = 0; x < 16; x++) if (g.px[y * 16 + x]) out.px[y * 16 + x] = g.px[y * 16 + x];
  return out;
}

/** Register every frame of a character in the atlas as `${id}_${dir}_${anim}${i}`. */
/** Repaint a registered character's frames with a new look (same frames, same sizes). */
export function restyleCharacter(atlas, id, look, anims = Object.keys(ANIMS)) {
  for (const dir of DIRS) for (const anim of anims) {
    ANIMS[anim].frames.forEach(([t, l, bob, breath = 0], i) => atlas.repaint(`${id}_${dir}_${anim}${i}`, composeFrame(look, dir, t, l, bob, breath)));
  }
}

export function addCharacter(atlas, id, look, anims = Object.keys(ANIMS)) {
  for (const dir of DIRS) {
    for (const anim of anims) {
      const def = ANIMS[anim];
      def.frames.forEach(([t, l, bob, breath = 0], i) => {
        const g = composeFrame(look, dir, t, l, bob, breath);
        atlas.add(`${id}_${dir}_${anim}${i}`, look.child ? childFrame(g) : g, 8, 32);
      });
    }
  }
}
