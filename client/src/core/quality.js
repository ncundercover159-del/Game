// Adaptive quality governor: watches frame times and steps quality down (or up)
// to hold 60 fps on mid-range phones with a 30 fps floor on low-end devices.
import { settings } from './settings.js';

export const QUALITY_LEVELS = [
  { name: 'low',    pixelRatio: 0.7,  maxDpr: 1.0,  particles: 0.35, outlines: false, props: 0.5, drawDist: 260, shadows: false },
  { name: 'medium', pixelRatio: 1.0,  maxDpr: 1.35, particles: 0.65, outlines: true,  props: 0.8, drawDist: 420, shadows: false },
  { name: 'high',   pixelRatio: 1.0,  maxDpr: 1.8,  particles: 1.0,  outlines: true,  props: 1.0, drawDist: 700, shadows: false },
];

export class QualityGovernor {
  constructor() {
    const s = settings().quality;
    const guess = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4 ? 1 : 2;
    this.auto = s === 'auto';
    this.level = this.auto ? guess : Math.max(0, QUALITY_LEVELS.findIndex((q) => q.name === s));
    this.samples = [];
    this.windowStart = performance.now();
    this.goodWindows = 0;
    this.raises = 0;
    this.listeners = new Set();
    this.fps = 60;
  }

  get q() { return QUALITY_LEVELS[this.level]; }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  setMode(mode) {
    this.auto = mode === 'auto';
    if (!this.auto) this.set(Math.max(0, QUALITY_LEVELS.findIndex((q) => q.name === mode)));
  }

  set(level) {
    level = Math.max(0, Math.min(QUALITY_LEVELS.length - 1, level));
    if (level === this.level) return;
    this.level = level;
    console.info(`[quality] -> ${this.q.name}`);
    this.listeners.forEach((fn) => fn(this.q, level));
  }

  // frameMs: time between frames; workMs: CPU time spent in update+render
  sample(frameMs, workMs) {
    this.samples.push([frameMs, workMs]);
    const now = performance.now();
    if (now - this.windowStart < 2000) return;
    const n = this.samples.length;
    let f = 0, w = 0;
    for (const [a, b] of this.samples) { f += a; w += b; }
    f /= n; w /= n;
    this.fps = 1000 / f;
    this.samples.length = 0;
    this.windowStart = now;
    if (!this.auto || document.hidden) return;
    if (f > 21 && this.level > 0) {
      this.goodWindows = 0;
      this.set(this.level - 1);
    } else if (f < 17.5 && w < 7) {
      if (++this.goodWindows >= 4 && this.level < QUALITY_LEVELS.length - 1 && this.raises < 2) {
        this.goodWindows = 0;
        this.raises++;
        this.set(this.level + 1);
      }
    } else {
      this.goodWindows = 0;
    }
  }
}
