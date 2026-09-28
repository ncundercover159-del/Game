// Pooled particles (dirt puffs, chips, leaves, water drops, sparkles). Purely visual: they use their
// own RNG so they never disturb the deterministic simulation.
import { Rng } from '../core/rng.js';

const MAX = 256;

export class Fx {
  constructor() {
    this.pool = Array.from({ length: MAX }, () => ({ on: false }));
    this.rng = new Rng(4242);
    this.count = 0;
  }

  spawn(sprite, x, y, { vx = 0, vy = 0, z = 0, vz = 0, life = 0.6, g = 300 } = {}) {
    const p = this.pool.find((q) => !q.on);
    if (!p) return;
    Object.assign(p, { on: true, sprite, x, y, vx, vy, z, vz, life, t: 0, g });
  }

  /** A burst of `n` particles thrown up and out from (x, y). */
  burst(sprite, x, y, n = 6, { speed = 40, up = 60, life = 0.5 } = {}) {
    const r = this.rng;
    for (let i = 0; i < n; i++) {
      const a = r.float(0, Math.PI * 2);
      this.spawn(sprite, x + r.float(-3, 3), y + r.float(-2, 2), {
        vx: Math.cos(a) * speed * r.float(0.4, 1), vy: Math.sin(a) * speed * 0.4 * r.float(0.4, 1),
        vz: up * r.float(0.6, 1.2), life: life * r.float(0.7, 1.2),
      });
    }
  }

  update(dt) {
    let n = 0;
    for (const p of this.pool) {
      if (!p.on) continue;
      p.t += dt;
      if (p.t >= p.life) { p.on = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vz -= p.g * dt;
      p.z = Math.max(0, p.z + p.vz * dt);
      if (p.z === 0) { p.vx *= 0.8; p.vy *= 0.8; }
      n++;
    }
    this.count = n;
  }

  draw(ctx, atlas, cam) {
    for (const p of this.pool) {
      if (!p.on) continue;
      atlas.draw(ctx, p.sprite, p.x - cam.ix, p.y - p.z - cam.iy);
    }
  }
}
