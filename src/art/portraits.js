// Dialogue portraits, 48x48, painted from a villager's look: shoulders and collar, face, hair by
// style, and an expression (eyes, brows, mouth, cheeks). Lit from the top-left like everything else.
import { grid, set, get, fillRect, ellipse, polygon, line, outline } from './raster.js';

export const EXPRESSIONS = ['neutral', 'happy', 'sad', 'angry', 'surprised'];

const S = 48;
const CX = 24;

function hline(g, x0, x1, y, c) { for (let x = x0; x <= x1; x++) set(g, x, y, c); }

/** Shoulders in the robe colours with a crossed collar (left over right). */
function shoulders(g, look) {
  const [, k, l, L] = look.kosode;
  polygon(g, [[4, 48], [9, 38], [18, 34], [30, 34], [39, 38], [44, 48]], l);
  polygon(g, [[4, 48], [9, 38], [16, 35], [14, 48]], L);
  polygon(g, [[34, 48], [36, 36], [39, 38], [44, 48]], k);
  // Collar: two bands meeting in a V under the chin.
  const [c, C] = look.collar;
  line(g, 17, 34, 25, 46, C); line(g, 18, 34, 26, 46, c); line(g, 19, 34, 27, 46, c);
  line(g, 31, 34, 25, 44, c); line(g, 30, 34, 24, 44, C);
}

function face(g, look) {
  const [S0, s, f, F] = look.skin;
  fillRect(g, 20, 29, 9, 7, s);           // neck
  hline(g, 20, 28, 29, S0);
  ellipse(g, CX, 20, 11.5, 13, f);        // face
  ellipse(g, CX - 2, 18, 8.5, 9.5, F);    // lit cheek plane
  // Shadow side: a solid band down the right of the face, widening toward the jaw.
  const mid = get(g, CX, 20);
  for (let y = 10; y < 34; y++) for (let x = CX + 6 - (y > 24 ? 2 : 0); x < 38; x++) if (get(g, x, y) === mid) set(g, x, y, s);
  ellipse(g, 12.5, 21, 1.8, 3, f);        // ears
  ellipse(g, 35.5, 21, 1.8, 3, s);
  set(g, 25, 24, s); set(g, 25, 25, s);   // nose shade
  if (look.age >= 2) {                    // lines of an older face
    line(g, 17, 27, 19, 29, s); line(g, 31, 27, 29, 29, s);
    hline(g, 20, 23, 13, s); hline(g, 26, 29, 13, s);
  }
}

function hair(g, look) {
  const [H, h, j] = look.hair;
  const style = look.style || 'topknot';
  // Back hair behind the face for long styles.
  if (style === 'long') {
    fillRect(g, 10, 14, 5, 28, h); fillRect(g, 33, 14, 5, 28, h);
    fillRect(g, 11, 38, 3, 3, look.cord); fillRect(g, 34, 38, 3, 3, look.cord);
  }
  // Cap of hair over the crown with a fringe line.
  ellipse(g, CX, 12, 12.5, 8.5, h);
  ellipse(g, CX - 3, 9, 6, 3.5, j);
  for (let x = 13; x <= 35; x++) {
    const fringe = style === 'cropped' || style === 'shaved' ? 15 + ((x * 7) % 3) : style === 'bun' || style === 'long' ? 14 + (x > CX ? 1 : 0) : 14;
    for (let y = 12; y <= fringe; y++) set(g, x, y, h);
  }
  // Side locks framing the face.
  fillRect(g, 12, 13, 3, style === 'long' || style === 'bun' ? 12 : 8, h);
  fillRect(g, 34, 13, 3, style === 'long' || style === 'bun' ? 12 : 8, H);
  if (style === 'topknot') {
    // Shaved pate in skin with the folded topknot laid forward.
    ellipse(g, CX, 8, 7, 3.5, look.skin[3]);
    fillRect(g, 22, 1, 5, 8, h);
    hline(g, 22, 26, 1, j);
    fillRect(g, 22, 6, 5, 1, look.cord);
  } else if (style === 'bun') {
    ellipse(g, CX, 4, 7.5, 4.5, h);
    ellipse(g, CX - 2, 3, 3.5, 2, j);
    line(g, 30, 1, 36, 7, look.ornament || look.cord);
    set(g, 36, 7, 'gold2');
  } else if (style === 'band') {
    fillRect(g, 12, 11, 25, 3, look.cord);
    hline(g, 12, 36, 11, 'ink6');
    fillRect(g, 36, 10, 4, 3, look.cord);
    set(g, 40, 13, look.cord); set(g, 41, 14, look.cord);
  } else if (style === 'cropped') {
    for (const x of [15, 19, 24, 28, 32]) { set(g, x, 3 + (x % 3), h); set(g, x + 1, 2 + (x % 3), H); }
  }
}

/** Eyes, brows and mouth for an expression. */
function expression(g, look, ex) {
  const brow = look.hair[0];
  const ink = 'ink0';
  const eyeY = 20;
  const eyes = [19, 29];
  // Brows: tilt by mood.
  const tilt = { neutral: [0, 0], happy: [-1, -1], sad: [1, -1], angry: [-1, 1], surprised: [-2, -2] }[ex];
  for (const [i, x] of eyes.entries()) {
    const inner = i === 0 ? x + 2 : x - 2, outer = i === 0 ? x - 2 : x + 2;
    line(g, outer, eyeY - 4 + tilt[0], inner, eyeY - 4 + tilt[1], brow);
  }
  for (const x of eyes) {
    if (ex === 'happy') { set(g, x - 1, eyeY + 1, ink); set(g, x, eyeY, ink); set(g, x + 1, eyeY + 1, ink); continue; }
    const h = ex === 'surprised' ? 4 : ex === 'sad' ? 2 : 3;
    fillRect(g, x - (ex === 'surprised' ? 1 : 0), eyeY - 1, ex === 'surprised' ? 3 : 2, h, ink);
    set(g, x, eyeY - 1, 'ink6');
  }
  const [, s] = look.skin;
  const my = 28;
  switch (ex) {
    case 'happy': hline(g, 22, 26, my, s); set(g, 21, my - 1, s); set(g, 27, my - 1, s); hline(g, 23, 25, my + 1, 'red1'); break;
    case 'sad': hline(g, 22, 26, my + 1, s); set(g, 21, my + 2, s); set(g, 27, my + 2, s); break;
    case 'angry': hline(g, 21, 27, my, s); hline(g, 22, 26, my + 1, 'ink6'); break;
    case 'surprised': ellipse(g, 24, my + 1, 1.8, 2.2, 'red0'); break;
    default: hline(g, 22, 26, my, s);
  }
  if (ex === 'happy' || look.style === 'bun') { set(g, 16, 25, 'sakura3'); set(g, 17, 25, 'sakura3'); set(g, 31, 25, 'sakura2'); set(g, 32, 25, 'sakura2'); }
  if (look.mustache) { hline(g, 20, 23, my - 2, look.hair[1]); hline(g, 25, 28, my - 2, look.hair[1]); }
  if (look.beard) {
    // A short beard along the jaw, lit on the left.
    for (let x = 16; x <= 32; x++) for (let y = 29; y <= 33; y++) {
      if (!get(g, x, y) || (y === 29 && x > 20 && x < 28)) continue;
      set(g, x, y, x < 22 && y < 32 ? look.hair[2] : look.hair[1]);
    }
    hline(g, 22, 26, my, look.skin[1]);
  }
}

export function portrait(look, ex = 'neutral') {
  const g = grid(S - 2, S - 2);
  shoulders(g, look);
  face(g, look);
  hair(g, look);
  expression(g, look, ex);
  return outline(g, { color: 'ink0' });
}
