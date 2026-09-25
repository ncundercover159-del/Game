// requestAnimationFrame loop with frame/work timing for the quality governor.
export class Loop {
  constructor(fn, quality) {
    this.fn = fn;
    this.quality = quality;
    this.running = false;
    this.last = 0;
    this.frame = this.frame.bind(this);
    document.addEventListener('visibilitychange', () => { this.last = performance.now(); });
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }
  stop() { this.running = false; }
  frame(now) {
    if (!this.running) return;
    requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    const frameMs = now - this.last;
    this.last = now;
    const t0 = performance.now();
    this.fn(dt, now / 1000);
    const work = performance.now() - t0;
    this.quality?.sample(frameMs, work);
  }
}
