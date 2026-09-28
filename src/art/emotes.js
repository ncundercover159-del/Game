// Emote bubbles shown over villagers' heads: a white speech bubble with a tail and a symbol.
import { parse, blit, set } from './raster.js';

const BUBBLE = `
  ..ooooooooo..
  .owwwwwwwwwo.
  owwwwwwwwwwwo
  owwwwwwwwwwwo
  owwwwwwwwwwwo
  owwwwwwwwwwwo
  owwwwwwwwwwwo
  owwwwwwwwwwwo
  .owwwwwwwwwo.
  ..oooowwoooo.
  ......owo....
  .......o.....`;

// 7x6 symbols drawn into the bubble at (3, 1).
const SYMBOLS = {
  bang: [`
    ...r...
    ...r...
    ...r...
    ...r...
    .......
    ...r...`, { r: 'red2' }],
  q: [`
    ..iii..
    .i...i.
    ....i..
    ...i...
    .......
    ...i...`, { i: 'indigo2' }],
  heart: [`
    .rr.rr.
    rRrrrrr
    rrrrrrr
    .rrrrr.
    ..rrr..
    ...r...`, { r: 'red2', R: 'red4' }],
  dots: [`
    .......
    .......
    .......
    .......
    i..i..i
    .......`, { i: 'ink2' }],
  note: [`
    ...iiii
    ...i..i
    ...i..i
    .iii.ii
    iiii.ii
    .ii....`, { i: 'indigo1' }],
  anger: [`
    .r...r.
    rr...rr
    .......
    .......
    rr...rr
    .r...r.`, { r: 'red2' }],
};

export function emotes() {
  const out = {};
  for (const [k, [rows, legend]] of Object.entries(SYMBOLS)) {
    const g = parse(BUBBLE, { o: 'ink1', w: 'ink6' });
    blit(g, parse(rows, legend), 3, 2);
    set(g, 2, 1, 'ink6');
    out[k] = g;
  }
  return out;
}

/** Script and data shorthand: `emote kaito !` and friends. */
export const EMOTE_ALIAS = { '!': 'bang', '?': 'q', '<3': 'heart', '...': 'dots', '~': 'note', '#': 'anger' };

/** 16x16 heart for bond toasts. */
export function heartIcon() {
  return parse(`
    ................
    ................
    ...ooo...ooo....
    ..orrRo.orrro...
    .orRRrrorrrrro..
    .orRrrrrrrrrro..
    .orrrrrrrrrrro..
    .orrrrrrrrrrdo..
    ..orrrrrrrrdo...
    ...orrrrrrdo....
    ....orrrrdo.....
    .....orrdo......
    ......odo.......
    .......o........
    ................
    ................`, { o: 'red0', r: 'red2', R: 'red4', d: 'red1' });
}

/** 7x6 hearts for the Bonds tab: full and empty. */
export function smallHeart(filled) {
  return parse(`
    .o.o.o.
    orororo
    orrrrro
    .orrro.
    ..oro..
    ...o...`, filled ? { o: 'red0', r: 'red2' } : { o: 'wood2', r: 'wood4' });
}
