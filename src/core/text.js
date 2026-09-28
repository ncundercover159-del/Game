// Crisp pixel text. Glyphs from the vendored pixel fonts are rasterised once at their native size,
// alpha-thresholded to 1-bit, and cached in a white glyph atlas; tinted copies of the atlas are made
// per palette colour on demand. Text is always drawn at integer positions.
import { hex } from '../art/palette.js';
import { makeCanvas } from '../art/compiler.js';

export const FONT_FILES = {
  small: { file: 'fusion-pixel-8px-jp.woff2', size: 8, family: 'RoninPixel8', track: 1 },
  body: { file: 'fusion-pixel-10px-jp.woff2', size: 10, family: 'RoninPixel10', track: 1 },
  big: { file: 'fusion-pixel-12px-jp.woff2', size: 12, family: 'RoninPixel12', track: 1 },
};

export async function loadFonts(base = './') {
  await Promise.all(Object.values(FONT_FILES).map(async (f) => {
    const face = new FontFace(f.family, `url(${base}assets/fonts/${f.file})`);
    await face.load();
    document.fonts.add(face);
  }));
}

const ATLAS = 512;
// Glyphs are drawn this many times too large and read back at the middle of each font pixel.
// Browsers smooth and embolden text differently (some thicken every stroke by a fraction of a
// pixel, which a plain threshold turns into a whole one); a font pixel eight times its size keeps
// its middle whatever the smoothing does at its edges.
const OVER = 8;

export class PixelFont {
  // `track`: extra pixels after each Latin letter, so the one-pixel strokes do not crowd each other
  // (digits keep their own spacing, so counts and prices stay compact).
  constructor({ family, size, track = 0 }) {
    this.size = size;
    this.track = track;
    this.atlas = makeCanvas(ATLAS, ATLAS);
    this.actx = this.atlas.getContext('2d', { willReadFrequently: true });
    this.scratch = makeCanvas(size * 4 * OVER, size * 3 * OVER);
    this.sctx = this.scratch.getContext('2d', { willReadFrequently: true });
    this.sctx.font = `${size * OVER}px "${family}"`;
    this.sctx.textBaseline = 'alphabetic';
    const m = this.sctx.measureText('Hg');
    this.ascent = Math.round((m.fontBoundingBoxAscent ?? size * OVER) / OVER);
    const descent = Math.round((m.fontBoundingBoxDescent ?? (size * OVER) / 3) / OVER);
    // Trim the font's built-in top padding so draw(x, y) puts the tallest ink at y.
    this.top = this.inkTop('H漢Íあ');
    this.cell = this.ascent + descent - this.top;
    this.lineHeight = size + 3;
    this.glyphs = new Map();
    this.next = 0;
    this.tints = new Map();   // colour name -> { canvas, version }
    this.version = 0;
  }

  /** Draw `ch` large on the scratch canvas; returns a test for font pixel (x, y) being inked. */
  raster(ch) {
    const s = this.sctx, W = this.scratch.width, H = this.scratch.height;
    s.clearRect(0, 0, W, H);
    s.fillStyle = '#fff';
    s.fillText(ch, 0, this.ascent * OVER);
    const d = s.getImageData(0, 0, W, H).data, half = OVER >> 1;
    return (x, y) => {
      const px = x * OVER + half, py = y * OVER + half;
      return px < W && py < H && d[(py * W + px) * 4 + 3] >= 128;
    };
  }

  inkTop(str) {
    const cols = this.size * 4, rows = this.size * 3;
    let top = this.ascent;
    for (const ch of str) {
      const on = this.raster(ch);
      for (let y = 0; y < Math.min(top, rows); y++) {
        let hit = false;
        for (let x = 0; x < cols && !hit; x++) hit = on(x, y);
        if (hit) { top = y; break; }
      }
    }
    return Math.max(0, top);
  }

  glyph(ch) {
    let g = this.glyphs.get(ch);
    if (g) return g;
    const cell = this.cell;
    const adv = Math.round(this.sctx.measureText(ch).width / OVER);
    const w = Math.min(cell * 2, Math.max(1, adv));
    const on = this.raster(ch);
    const img = this.actx.createImageData(cell * 2, cell), d = img.data;
    for (let y = 0; y < cell; y++) {
      for (let x = 0; x < cell * 2; x++) {
        const i = (y * cell * 2 + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = 255;
        d[i + 3] = on(x, y + this.top) ? 255 : 0;
      }
    }
    const cols = Math.floor(ATLAS / (cell * 2));
    const sx = (this.next % cols) * cell * 2, sy = Math.floor(this.next / cols) * cell;
    this.next++;
    this.actx.putImageData(img, sx, sy);
    g = { sx, sy, w: cell * 2, h: cell, adv: w + (ch.codePointAt(0) < 0x2000 && !(ch >= '0' && ch <= '9') ? this.track : 0) };
    this.glyphs.set(ch, g);
    this.version++;
    return g;
  }

  tinted(color) {
    let t = this.tints.get(color);
    if (!t) {
      t = { canvas: makeCanvas(ATLAS, ATLAS), version: -1 };
      this.tints.set(color, t);
    }
    if (t.version !== this.version) {
      const c = t.canvas.getContext('2d');
      c.globalCompositeOperation = 'copy';
      c.drawImage(this.atlas, 0, 0);
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = hex(color);
      c.fillRect(0, 0, ATLAS, ATLAS);
      t.version = this.version;
    }
    return t.canvas;
  }

  measure(str) {
    let w = 0;
    for (const ch of str) w += this.glyph(ch).adv;
    return w;
  }

  /** Draw `str` with its top-left at (x, y). Returns the advance width. */
  draw(ctx, str, x, y, color = 'ink6') {
    for (const ch of str) this.glyph(ch);  // make sure the atlas is complete before tinting
    const atlas = this.tinted(color);
    let cx = Math.round(x);
    const cy = Math.round(y);
    for (const ch of str) {
      const g = this.glyphs.get(ch);
      if (ch !== ' ') ctx.drawImage(atlas, g.sx, g.sy, g.w, g.h, cx, cy, g.w, g.h);
      cx += g.adv;
    }
    return cx - Math.round(x);
  }

  /** Text with a 1px drop shadow (for captions over the world). */
  drawShadow(ctx, str, x, y, color = 'ink6', shadow = 'ink0') {
    this.draw(ctx, str, x + 1, y + 1, shadow);
    return this.draw(ctx, str, x, y, color);
  }

  /** Word-wrap to a pixel width. Handles CJK by allowing breaks between any two wide glyphs. */
  wrap(str, maxW) {
    const lines = [];
    for (const para of str.split('\n')) {
      let line = '';
      for (const word of para.split(/(\s+)/)) {
        const test = line + word;
        if (this.measure(test) <= maxW || !line) line = test;
        else { lines.push(line.trimEnd()); line = word.trimStart(); }
      }
      lines.push(line);
    }
    return lines;
  }
}

export const fonts = {};

export function initFonts() {
  for (const [k, f] of Object.entries(FONT_FILES)) fonts[k] = new PixelFont(f);
  return fonts;
}
