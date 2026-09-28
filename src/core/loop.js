// Fixed 60 Hz simulation with an accumulator; rendering on requestAnimationFrame.
// advance(ms) steps the simulation synchronously so headless tests are deterministic.
import { STEP } from '../config.js';

const MAX_FRAME = 0.25;

export class Loop {
  constructor({ update, render }) {
    this.update = update;
    this.render = render;
    this.acc = 0;
    this.last = 0;
    this.running = false;
    this.paused = false;
    this.frameMs = 0;       // JS time of the last update+render, for the debug overlay
    this.fps = 60;
    this._fpsAcc = 0;
    this._fpsFrames = 0;
    this._raf = (t) => this.frame(t);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this._raf);
  }

  stop() {
    this.running = false;
  }

  frame(now) {
    if (!this.running) return;
    const dt = Math.min(MAX_FRAME, (now - this.last) / 1000);
    this.last = now;
    const t0 = performance.now();
    if (!this.paused) {
      this.acc += dt;
      while (this.acc >= STEP) {
        this.update(STEP);
        this.acc -= STEP;
      }
    }
    this.render(this.acc / STEP);
    this.frameMs = performance.now() - t0;
    this._fpsAcc += dt;
    this._fpsFrames++;
    if (this._fpsAcc >= 0.5) {
      this.fps = Math.round(this._fpsFrames / this._fpsAcc);
      this._fpsAcc = 0;
      this._fpsFrames = 0;
    }
    requestAnimationFrame(this._raf);
  }

  /** Run the simulation forward by `ms` of game time immediately (tests, bots). */
  advance(ms) {
    const steps = Math.round(ms / 1000 / STEP);
    for (let i = 0; i < steps; i++) this.update(STEP);
    this.render(0);
    return steps;
  }
}
