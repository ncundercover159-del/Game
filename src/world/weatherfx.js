// Screen-space weather and ambience: rain streaks with splashes, snow, wind-blown leaves and petals,
// lightning, and dusk fireflies. Purely visual, with its own RNG; particles are pooled.
import { hex } from '../art/palette.js';
import { Rng } from '../core/rng.js';

const MAX = 320;

// weather -> [particles per second per 100x100 px, kind, drift x speed]
const RATES = {
  rain: [30, 'rain', -40], tsuyu: [38, 'rain', -20], storm: [60, 'rain', -90], typhoon: [80, 'rain', -220],
  snow: [10, 'snow', -10], blizzard: [45, 'snow', -160], wind: [2.5, 'leaf', -120],
};
// Clear-day ambience per season: petals, none, leaves, none.
const AMBIENT = [[0.5, 'petal', -30], null, [0.6, 'leaf', -35], null];

export class WeatherFx {
  constructor() {
    this.pool = Array.from({ length: MAX }, () => ({ on: false }));
    this.rng = new Rng(99);
    this.acc = 0;
    this.flash = 0;
    this.nextBolt = 5;
  }

  spawn(kind, w, h, drift) {
    const p = this.pool.find((q) => !q.on);
    if (!p) return;
    const r = this.rng;
    p.on = true;
    p.kind = kind;
    p.x = r.float(-40, w + 80);
    p.y = r.float(-20, kind === 'rain' ? h * 0.2 : h);
    p.vx = drift * r.float(0.8, 1.2);
    p.vy = kind === 'rain' ? r.float(280, 360) : kind === 'snow' ? r.float(18, 36) : r.float(8, 20);
    p.life = kind === 'rain' ? r.float(0.35, 0.9) : r.float(3, 7);
    p.t = 0;
    p.phase = r.float(0, 6.28);
    p.color = kind === 'petal' ? (r.chance(0.5) ? 'sakura3' : 'sakura4') : kind === 'leaf' ? (r.chance(0.5) ? 'red3' : 'gold2') : null;
  }

  update(dt, weather, seasonIdx, w, h, minutes, flashes) {
    const rate = RATES[weather] || (weather === 'clear' || weather === 'cloudy' ? AMBIENT[seasonIdx] : null);
    if (rate) {
      this.acc += dt * rate[0] * (w * h) / 10000;
      while (this.acc >= 1) { this.acc -= 1; this.spawn(rate[1], w, h, rate[2]); }
    }
    this.fireflies = seasonIdx === 1 && !WET.has(weather) && minutes >= 19 * 60 && minutes < 23 * 60;
    for (const p of this.pool) {
      if (!p.on) continue;
      p.t += dt;
      if (p.t >= p.life) {
        if (p.kind === 'rain' && !p.splash) { p.splash = true; p.t = 0; p.life = 0.15; p.vx = 0; p.vy = 0; continue; }
        p.on = false;
        p.splash = false;
        continue;
      }
      const sway = p.kind === 'rain' ? 0 : Math.sin(p.t * 2 + p.phase) * 12;
      p.x += (p.vx + sway) * dt;
      p.y += p.vy * dt;
    }
    this.flash = Math.max(0, this.flash - dt);
    if ((weather === 'storm' || weather === 'typhoon') && flashes) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) { this.flash = 0.18; this.nextBolt = this.rng.float(6, 15); return 'thunder'; }
    }
    return null;
  }

  /** Particles over the lit scene; fireflies glow, so they are drawn after the lighting pass. */
  draw(ctx, time, w, h) {
    for (const p of this.pool) {
      if (!p.on) continue;
      const x = Math.round(p.x), y = Math.round(p.y);
      if (p.kind === 'rain') {
        ctx.fillStyle = hex(p.splash ? 'ink5' : 'water4');
        if (p.splash) { ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x, y - 1, 1, 1); }
        else { ctx.globalAlpha = 0.7; ctx.fillRect(x, y, 1, 4); ctx.fillRect(x - 1, y + 3, 1, 2); ctx.globalAlpha = 1; }
      } else if (p.kind === 'snow') {
        ctx.fillStyle = hex('ink6');
        ctx.fillRect(x, y, p.phase > 3 ? 2 : 1, p.phase > 3 ? 2 : 1);
      } else {
        ctx.fillStyle = hex(p.color);
        ctx.fillRect(x, y, 2, 1);
        if (Math.sin(p.t * 5 + p.phase) > 0) ctx.fillRect(x + 1, y + 1, 1, 1);
      }
    }
    if (this.fireflies) {
      for (let i = 0; i < 14; i++) {
        const fx = ((i * 97 + Math.sin(time * 0.3 + i) * 40) % w + w) % w;
        const fy = ((i * 53 + Math.cos(time * 0.4 + i * 2) * 30) % h + h) % h;
        if (Math.sin(time * 2 + i * 1.7) < 0.2) continue;
        ctx.fillStyle = hex('gold3');
        ctx.fillRect(Math.round(fx), Math.round(fy), 1, 1);
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = hex('gold2');
        ctx.fillRect(Math.round(fx) - 1, Math.round(fy), 3, 1);
        ctx.fillRect(Math.round(fx), Math.round(fy) - 1, 1, 3);
        ctx.globalAlpha = 1;
      }
    }
    if (this.flash > 0) {
      ctx.globalAlpha = this.flash * 3;
      ctx.fillStyle = hex('ink6');
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }
}

const WET = new Set(['rain', 'tsuyu', 'storm', 'typhoon']);
