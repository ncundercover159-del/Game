'use strict';

/* Particles and blast visuals. Everything lives in canvas pixel space and
 * is updated from the game's single requestAnimationFrame loop. */
const FX = {
  particles: [],
  effects: [],
  floats: [],

  clear() { this.particles.length = 0; this.effects.length = 0; this.floats.length = 0; },

  // ------------------------------------------------------------ spawners

  burst(x, y, colorIndex, count = 12, spread = 1) {
    const c = Art.COLORS[colorIndex % Art.COLORS.length] || Art.COLORS[0];
    const palette = [c.light, c.main, c.spark, '#ffffff'];
    for (let i = 0; i < count; i++) {
      const a = Utils.rand(0, Math.PI * 2);
      const sp = Utils.rand(60, 260) * spread;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60,
        g: 780,
        life: Utils.rand(.35, .7),
        age: 0,
        size: Utils.rand(2.5, 6.5) * spread,
        color: Utils.pick(palette),
        rot: Utils.rand(0, Math.PI),
        spin: Utils.rand(-9, 9),
        shape: Math.random() < .45 ? 'star' : 'shard',
      });
    }
  },

  shards(x, y, colors, count = 14, spread = 1) {
    for (let i = 0; i < count; i++) {
      const a = Utils.rand(0, Math.PI * 2);
      const sp = Utils.rand(70, 300) * spread;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 80,
        g: 900,
        life: Utils.rand(.3, .65),
        age: 0,
        size: Utils.rand(3, 7) * spread,
        color: Utils.pick(colors),
        rot: Utils.rand(0, Math.PI),
        spin: Utils.rand(-12, 12),
        shape: 'shard',
      });
    }
  },

  sparkle(x, y, count = 6) {
    for (let i = 0; i < count; i++) {
      const a = Utils.rand(0, Math.PI * 2);
      const sp = Utils.rand(30, 150);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        g: 120, life: Utils.rand(.3, .6), age: 0,
        size: Utils.rand(2, 5),
        color: Utils.pick(['#fff', '#ffe9a3', '#ffc531']),
        rot: Utils.rand(0, Math.PI), spin: Utils.rand(-6, 6),
        shape: 'star',
      });
    }
  },

  /* Expanding shockwave ring — used by TNT and combos. */
  ring(x, y, radius, color = '#ffd76e', dur = 0.45) {
    this.effects.push({ kind: 'ring', x, y, radius, color, dur, age: 0 });
  },

  /* Rocket trail flying out from a cell in one direction. */
  trail(x, y, dx, dy, length, color = '#ffffff', dur = 0.32) {
    this.effects.push({ kind: 'trail', x, y, dx, dy, length, color, dur, age: 0 });
  },

  /* Lightning arc from the light ball to each cleared gem. */
  zap(x0, y0, x1, y1, color = '#ffffff', dur = 0.35) {
    this.effects.push({ kind: 'zap', x0, y0, x1, y1, color, dur, age: 0, seed: Math.random() * 1000 });
  },

  flash(x, y, radius, color = '#ffffff', dur = 0.3) {
    this.effects.push({ kind: 'flash', x, y, radius, color, dur, age: 0 });
  },

  /* Rising "+250" style score popup. */
  float(x, y, text, color = '#fff3c0', size = 20) {
    this.floats.push({ x, y, text, color, size, age: 0, dur: 0.85 });
  },

  // -------------------------------------------------------------- update

  update(dt) {
    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.age += dt;
      if (p.age >= p.life) { ps.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
    const es = this.effects;
    for (let i = es.length - 1; i >= 0; i--) {
      es[i].age += dt;
      if (es[i].age >= es[i].dur) es.splice(i, 1);
    }
    const fs = this.floats;
    for (let i = fs.length - 1; i >= 0; i--) {
      fs[i].age += dt;
      if (fs[i].age >= fs[i].dur) fs.splice(i, 1);
    }
  },

  // ---------------------------------------------------------------- draw

  draw(ctx) {
    // effects sit underneath particles
    for (const e of this.effects) {
      const t = e.age / e.dur;
      ctx.save();
      switch (e.kind) {
        case 'ring': {
          const r = e.radius * Utils.easeOutCubic(t);
          ctx.globalAlpha = 1 - t;
          ctx.lineWidth = Math.max(2, e.radius * 0.13 * (1 - t));
          ctx.strokeStyle = e.color;
          ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = (1 - t) * .35;
          ctx.lineWidth = Math.max(1, e.radius * 0.05);
          ctx.strokeStyle = '#fff';
          ctx.beginPath(); ctx.arc(e.x, e.y, r * .78, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case 'flash': {
          const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.radius * (0.6 + t * 0.7));
          g.addColorStop(0, e.color);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.globalAlpha = (1 - t) * .85;
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(e.x, e.y, e.radius * (0.6 + t * 0.7), 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'trail': {
          const head = Utils.easeOutQuad(t) * e.length;
          const tail = Math.max(0, head - e.length * 0.42);
          const x0 = e.x + e.dx * tail, y0 = e.y + e.dy * tail;
          const x1 = e.x + e.dx * head, y1 = e.y + e.dy * head;
          const g = ctx.createLinearGradient(x0, y0, x1, y1);
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(.6, e.color);
          g.addColorStop(1, '#ffffff');
          ctx.globalAlpha = 1 - t * t;
          ctx.strokeStyle = g;
          ctx.lineWidth = 16 * (1 - t * .45);
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
          ctx.lineWidth = 6 * (1 - t * .45);
          ctx.strokeStyle = 'rgba(255,255,255,.95)';
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
          break;
        }
        case 'zap': {
          const p = Utils.clamp(t * 2.2, 0, 1);
          const ex = Utils.lerp(e.x0, e.x1, p), ey = Utils.lerp(e.y0, e.y1, p);
          ctx.globalAlpha = 1 - Math.max(0, (t - .5) * 2);
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(e.x0, e.y0);
          const segs = 5;
          for (let i = 1; i <= segs; i++) {
            const f = i / segs;
            const jx = (Math.sin(e.seed + i * 2.7) * 12) * (1 - f);
            const jy = (Math.cos(e.seed + i * 3.1) * 12) * (1 - f);
            ctx.lineTo(Utils.lerp(e.x0, ex, f) + jx, Utils.lerp(e.y0, ey, f) + jy);
          }
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,.95)';
          ctx.lineWidth = 2;
          ctx.stroke();
          break;
        }
      }
      ctx.restore();
    }

    for (const p of this.particles) {
      const t = p.age / p.life;
      ctx.save();
      ctx.globalAlpha = 1 - t * t;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      const s = p.size * (1 - t * .55);
      if (p.shape === 'star') {
        Art.pathStar(ctx, s * 1.4, 4, .32);
        ctx.fill();
      } else {
        ctx.fillRect(-s / 2, -s / 2, s, s * 1.5);
      }
      ctx.restore();
    }

    for (const f of this.floats) {
      const t = f.age / f.dur;
      ctx.save();
      ctx.globalAlpha = 1 - Utils.easeInQuad(t);
      ctx.translate(f.x, f.y - t * 46);
      const sc = 0.6 + Utils.easeOutBack(Math.min(1, t * 3)) * 0.4;
      ctx.scale(sc, sc);
      ctx.font = `900 ${f.size}px "Trebuchet MS", Verdana, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,.55)';
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
  },
};
