// Crisp pixel text. Glyphs from the vendored pixel fonts are rasterised once at their native size,
// alpha-thresholded to 1-bit, and cached in a white glyph atlas; tinted copies of the atlas are made
// per palette colour on demand. Text is always drawn at integer positions.
import { hex } from '../art/palette.js';
import { makeCanvas } from '../art/compiler.js';

export const FONT_FILES = {
  small: { file: 'fusion-pixel-8px-jp.woff2', size: 8, family: 'RoninPixel8' },
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

export class PixelFont {
  // `track`: extra pixels between Latin letters, so the one-pixel strokes do not crowd each other.
  constructor({ family, size, track = 0 }) {
    this.size = size;
    this.track = track;
    this.font = `${size}px "${family}"`;
    this.atlas = makeCanvas(ATLAS, ATLAS);
    this.actx = this.atlas.getContext('2d', { willReadFrequently: true });
    this.scratch = makeCanvas(size * 4, size * 3);
    this.sctx = this.scratch.getContext('2d', { willReadFrequently: true });
    this.sctx.font = this.font;
    this.sctx.textBaseline = 'alphabetic';
    const m = this.sctx.measureText('Hg');
    this.ascent = Math.round(m.fontBoundingBoxAscent ?? size);
    const descent = Math.round(m.fontBoundingBoxDescent ?? size / 3);
    // Trim the font's built-in top padding so draw(x, y) puts the tallest ink at y.
    this.top = this.inkTop('H漢Íあ');
    this.cell = this.ascent + descent - this.top;
    this.lineHeight = size + 3;
    this.glyphs = new Map();
    this.next = 0;
    this.tints = new Map();   // colour name -> { canvas, version }
    this.version = 0;
  }

  inkTop(str) {
    const s = this.sctx, W = this.scratch.width, H = this.scratch.height;
    s.clearRect(0, 0, W, H);
    s.fillStyle = '#fff';
    let top = this.ascent;
    for (const ch of str) {
      s.clearRect(0, 0, W, H);
      s.fillText(ch, 0, this.ascent);
      const d = s.getImageData(0, 0, W, H).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] >= 128) { top = Math.min(top, Math.floor(i / 4 / W)); break; }
    }
    return Math.max(0, top);
  }

  glyph(ch) {
    let g = this.glyphs.get(ch);
    if (g) return g;
    const s = this.sctx, cell = this.cell;
    const adv = Math.round(s.measureText(ch).width);
    const w = Math.min(cell * 2, Math.max(1, adv));
    s.clearRect(0, 0, this.scratch.width, this.scratch.height);
    s.fillStyle = '#fff';
    s.fillText(ch, 0, this.ascent);
    const img = s.getImageData(0, this.top, cell * 2, cell);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const on = d[i + 3] >= 128;
      d[i] = d[i + 1] = d[i + 2] = 255;
      d[i + 3] = on ? 255 : 0;
    }
    const cols = Math.floor(ATLAS / (cell * 2));
    const sx = (this.next % cols) * cell * 2, sy = Math.floor(this.next / cols) * cell;
    this.next++;
    this.actx.putImageData(img, sx, sy);
    g = { sx, sy, w: cell * 2, h: cell, adv: w + (ch.codePointAt(0) < 0x2000 ? this.track : 0) };
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
