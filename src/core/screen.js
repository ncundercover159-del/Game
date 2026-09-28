// Integer-scaled pixel display. Everything renders to a low-res logical canvas, then one
// nearest-neighbour upscale to device pixels. The logical size adapts to the window (the visible
// area grows instead of letterboxing).
import { VIEW } from '../config.js';

/** Pick the integer scale whose logical height is closest to ideal within the allowed band. */
export function chooseScale(devW, devH) {
  let best = 1, bestScore = Infinity;
  for (let s = 1; s <= 24; s++) {
    const h = devH / s, w = devW / s;
    if (h < 120 || w < 160) break;
    let score = Math.abs(h - VIEW.idealH);
    if (h < VIEW.minH || h > VIEW.maxH) score += 1000;
    if (w < VIEW.minW) score += 500;
    if (score < bestScore) { bestScore = score; best = s; }
  }
  return best;
}

export class Screen {
  constructor(display) {
    this.display = display;
    this.dctx = display.getContext('2d', { alpha: false });
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.w = 480;
    this.h = 270;
    this.scale = 1;
    this.dpr = 1;
    this.onResize = null;
    this.resize();
    addEventListener('resize', () => this.resize());
    screen.orientation?.addEventListener?.('change', () => this.resize());
  }

  resize() {
    this.dpr = window.devicePixelRatio || 1;
    const devW = Math.round(innerWidth * this.dpr), devH = Math.round(innerHeight * this.dpr);
    this.scale = chooseScale(devW, devH);
    this.w = Math.ceil(devW / this.scale);
    this.h = Math.ceil(devH / this.scale);
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.display.width = this.w * this.scale;
    this.display.height = this.h * this.scale;
    // CSS size in CSS pixels; may overhang the window by < 1 logical pixel, which is clipped.
    this.display.style.width = `${(this.w * this.scale) / this.dpr}px`;
    this.display.style.height = `${(this.h * this.scale) / this.dpr}px`;
    this.ctx.imageSmoothingEnabled = false;
    this.dctx.imageSmoothingEnabled = false;
    this.onResize?.(this.w, this.h);
  }

  present() {
    this.dctx.drawImage(this.canvas, 0, 0, this.w * this.scale, this.h * this.scale);
  }

  /** Convert client (CSS) coordinates to logical pixels. */
  toLogical(clientX, clientY) {
    const r = this.display.getBoundingClientRect();
    return {
      x: Math.floor(((clientX - r.left) * this.dpr) / this.scale),
      y: Math.floor(((clientY - r.top) * this.dpr) / this.scale),
    };
  }
}
