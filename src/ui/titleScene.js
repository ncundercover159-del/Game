// The title's backdrop: the valley in the season of the real calendar, in slow parallax. A stepped
// sky and its sun or moon, the far Kurayama range, nearer ridges, a band of drifting mist, the
// village's hill with its roofs, the pagoda and the torii, a dark foreground ridge, a branch in the
// corner (blossom, leaves, maple or snowy pine) and the season's weather drifting across: petals,
// fireflies, falling leaves, snow. Layers are painted once per size into wrap-around strips.
import { grid, set, fillRect, polygon, ellipse, line } from '../art/raster.js';
import { gridToCanvas } from '../art/compiler.js';
import { rect } from './widgets.js';
import { Rng } from '../core/rng.js';

const SEASONS = {
  spring: { sky: ['water4', 'ink6', 'sakura4', 'sakura3', 'gold3'], sun: ['gold3', 0.62, 9], far: 'indigo3', mid: 'indigo2', hill: ['grass2', 'grass1'], ridge: 'grass0', mist: 'ink6', motes: 'petal', branch: 'blossom' },
  summer: { sky: ['water3', 'water4', 'water4', 'ink6', 'gold3'], sun: ['ink6', 0.18, 7], far: 'water2', mid: 'teal1', hill: ['grass3', 'grass2'], ridge: 'grass0', mist: 'ink6', motes: 'firefly', branch: 'leaves' },
  autumn: { sky: ['indigo2', 'sakura2', 'red4', 'gold2', 'gold3'], sun: ['red3', 0.7, 13], far: 'sakura1', mid: 'red0', hill: ['red1', 'wood1'], ridge: 'ink0', mist: 'sakura4', motes: 'leaf', branch: 'maple' },
  winter: { sky: ['indigo1', 'indigo2', 'indigo3', 'ink5', 'ink6'], sun: ['ink6', 0.3, 6], far: 'indigo2', mid: 'ink3', hill: ['ink5', 'ink4'], ridge: 'ink1', mist: 'ink6', motes: 'snow', branch: 'pine', snow: true },
};

/** The season of the real calendar (the title shows the valley as it is outside your window). */
export function seasonNow(date = new Date()) {
  const m = date.getMonth();
  return m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';
}

/** A ridge line that wraps: sums of sines whose periods divide the strip width. */
function ridge(rng, w, base, amps) {
  const waves = amps.map(([k, a]) => ({ k, a, p: rng.next() * Math.PI * 2 }));
  return Array.from({ length: w }, (_, x) => Math.round(base + waves.reduce((s, v) => s + Math.sin((x / w) * Math.PI * 2 * v.k + v.p) * v.a, 0)));
}

function strip(w, h, heights, color, extra) {
  const g = grid(w, h);
  heights.forEach((y, x) => { for (let yy = Math.max(0, y); yy < h; yy++) set(g, x, yy, color); });
  extra?.(g, heights);
  return gridToCanvas(g);
}

export class TitleScene {
  constructor(season = seasonNow()) {
    this.season = season;
    this.pal = SEASONS[season];
    this.t = 0;
    this.motes = [];
    this.size = null;
  }

  /** Paint the layers for a screen size (again when it changes). */
  build(w, h) {
    const p = this.pal, rng = new Rng(20260928), W = w * 2;
    this.size = `${w}x${h}`;
    const far = ridge(rng, W, h * 0.46, [[3, h * 0.06], [7, h * 0.03], [13, 4]]);
    // The far range, snow on its peaks in winter (and the highest peaks all year).
    this.far = strip(W, h, far, p.far, (g, hs) => hs.forEach((y, x) => { const top = Math.min(...hs); if (y < top + (p.snow ? 14 : 5)) for (let yy = y; yy < y + 3; yy++) set(g, x, yy, 'ink6'); }));
    this.mid = strip(W, h, ridge(rng, W, h * 0.58, [[2, h * 0.05], [5, h * 0.03], [11, 3]]), p.mid);
    // The village hill: roofs along its crest, the pagoda, the torii, lanterns.
    const hill = ridge(rng, W, h * 0.7, [[2, h * 0.04], [4, h * 0.02]]);
    this.hill = strip(W, h, hill, p.hill[0], (g, hs) => {
      for (let x = 0; x < W; x++) for (let y = hs[x]; y < hs[x] + 2; y++) set(g, x, y, p.hill[1]);
      for (let i = 0; i < 9; i++) {
        const x = Math.floor((i + 0.3 + rng.next() * 0.4) * (W / 9)), y = hs[x];
        if (i === 2) this.pagoda(g, x, y);
        else if (i === 6) this.torii(g, x, y);
        else this.house(g, x, y, 10 + Math.floor(rng.next() * 8));
      }
    });
    this.ridge = strip(W, h, ridge(rng, W, h * 0.86, [[3, 6], [8, 3]]), p.ridge);
    this.branch = this.paintBranch();
    this.sky = this.paintSky(w, h);
  }

  paintSky(w, h) {
    const g = grid(w, h), sky = this.pal.sky, bh = Math.ceil((h * 0.62) / sky.length);
    for (let y = 0; y < h; y++) {
      const band = Math.min(sky.length - 1, Math.floor(y / bh)), into = y - band * bh;
      for (let x = 0; x < w; x++) {
        // The last rows of a band checker into the next one: two rows at half, one at a quarter.
        const next = sky[Math.min(sky.length - 1, band + 1)];
        const d = bh - into, mix = d <= 2 ? (x + y) % 2 === 0 : d <= 4 ? (x % 2 === 0 && y % 2 === 0) : false;
        set(g, x, y, mix ? next : sky[band]);
      }
    }
    return gridToCanvas(g);
  }

  house(g, x, y, bw) {
    const c = this.pal.ridge, hw = Math.floor(bw / 2);
    fillRect(g, x - hw + 2, y - 7, bw - 4, 7, c);
    polygon(g, [[x - hw - 1, y - 6], [x, y - 12], [x + hw + 1, y - 6]], c);
    if (this.pal.snow) { line(g, x - hw, y - 7, x, y - 12, 'ink6'); line(g, x, y - 12, x + hw, y - 7, 'ink6'); }
    set(g, x - 1, y - 4, 'gold2');
  }

  pagoda(g, x, y) {
    const c = this.pal.ridge;
    for (let i = 0; i < 5; i++) {
      const yy = y - 6 - i * 7, hw = 11 - Math.round(i * 1.5);
      polygon(g, [[x - hw, yy], [x, yy - 4], [x + hw, yy]], c);
      fillRect(g, x - Math.floor(hw / 2), yy, hw, 3, c);
      if (this.pal.snow) line(g, x - hw, yy, x + hw, yy, 'ink6');
    }
    line(g, x, y - 42, x, y - 50, c);
  }

  torii(g, x, y) {
    fillRect(g, x - 7, y - 16, 2, 16, 'red2');
    fillRect(g, x + 5, y - 16, 2, 16, 'red2');
    fillRect(g, x - 10, y - 18, 20, 2, 'red2');
    fillRect(g, x - 8, y - 13, 16, 1, 'red1');
  }

  /** A branch reaching in from the top-left corner. */
  paintBranch() {
    const g = grid(120, 70), p = this.pal, rng = new Rng(7);
    const pts = [[0, 10], [30, 18], [58, 22], [86, 34], [110, 38]];
    for (let i = 0; i < pts.length - 1; i++) for (let d = 0; d < 3 - Math.floor(i / 2); d++) line(g, pts[i][0], pts[i][1] + d, pts[i + 1][0], pts[i + 1][1] + d, 'wood0');
    line(g, 30, 18, 44, 40, 'wood0'); line(g, 58, 22, 70, 8, 'wood0');
    const bloom = { blossom: ['sakura3', 'sakura4', 'ink6'], leaves: ['grass2', 'grass3', 'grass4'], maple: ['red2', 'red3', 'gold2'], pine: ['grass0', 'grass1', 'ink6'] }[p.branch];
    // Clusters along the branch: a dark underside, the body, a lit top-left.
    for (let i = 0; i < 26; i++) {
      const [ax, ay] = pts[1 + Math.floor(rng.next() * (pts.length - 1))];
      const x = ax + Math.round((rng.next() - 0.5) * 30), y = ay + Math.round((rng.next() - 0.2) * 16);
      const r = p.branch === 'pine' ? 5 : 3 + Math.floor(rng.next() * 2);
      ellipse(g, x, y + 1, r, r * 0.7, bloom[0]);
      ellipse(g, x, y, r - 1, (r - 1) * 0.7, bloom[1]);
      set(g, x - 1, y - 1, bloom[2]); set(g, x - 2, y, bloom[2]);
      if (p.branch === 'pine' && i % 2 === 0) fillRect(g, x - r + 1, y - 2, r * 2 - 2, 1, 'ink6');
    }
    return gridToCanvas(g);
  }

  update(dt, w, h) {
    this.t += dt;
    const kind = this.pal.motes, rate = { petal: 6, firefly: 3, leaf: 3, snow: 14 }[kind];
    if (Math.random() < rate * dt && this.motes.length < 80) {
      this.motes.push(kind === 'firefly'
        ? { x: Math.random() * w, y: h * (0.62 + Math.random() * 0.3), vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 6, life: 4 + Math.random() * 4 }
        : { x: Math.random() * w * 1.2 - w * 0.1, y: -4, vx: kind === 'snow' ? -4 : 10 + Math.random() * 8, vy: kind === 'snow' ? 10 + Math.random() * 8 : 14 + Math.random() * 10, life: 30 });
    }
    for (const m of this.motes) {
      m.x += (m.vx + Math.sin(this.t * 1.5 + m.y * 0.05) * 6) * dt;
      m.y += m.vy * dt;
      m.life -= dt;
    }
    this.motes = this.motes.filter((m) => m.life > 0 && m.y < h + 4 && m.x > -10 && m.x < w + 10);
  }

  draw(ctx, w, h) {
    if (this.size !== `${w}x${h}`) this.build(w, h);
    const p = this.pal;
    // The sky in stepped bands down to the horizon, each seam dithered.
    ctx.drawImage(this.sky, 0, 0);
    const [sc, sy, sr] = p.sun;
    for (let y = -sr; y <= sr; y++) { const hw = Math.round(Math.sqrt(sr * sr - y * y)); rect(ctx, sc, Math.round(w * 0.72) - hw, Math.round(h * sy) + y, hw * 2, 1); }
    // Parallax: each layer drifts at its own pace, wrapping around.
    const layer = (c, speed) => { const off = Math.floor((this.t * speed) % c.width); ctx.drawImage(c, -off, 0); ctx.drawImage(c, c.width - off, 0); };
    layer(this.far, 2);
    layer(this.mid, 5);
    // A band of mist between the ridges.
    const my = Math.round(h * 0.6);
    for (let k = 0; k < 2; k++) {
      ctx.globalAlpha = 0.18 + k * 0.08;
      for (let x = -80; x < w + 80; x += 46) {
        const len = 30 + ((x * 7) % 23), dx = Math.round((this.t * (5 + k * 3)) % 46);
        rect(ctx, p.mist, x + dx, my + k * 5 + Math.round(Math.sin(x * 0.03 + this.t * 0.3) * 2), len, 2 + k);
      }
    }
    ctx.globalAlpha = 1;
    layer(this.hill, 9);
    layer(this.ridge, 16);
    // The season drifting across.
    for (const m of this.motes) {
      if (p.motes === 'firefly') { if (Math.sin(this.t * 3 + m.x) > -0.2) rect(ctx, 'gold3', m.x, m.y, 1, 1); continue; }
      const c = { petal: ['sakura3', 'sakura4'], leaf: ['red3', 'gold2'], snow: ['ink6', 'ink6'] }[p.motes][Math.abs(Math.floor(m.x)) % 2];
      rect(ctx, c, m.x, m.y, p.motes === 'snow' ? 1 : 2, p.motes === 'leaf' ? 2 : 1);
    }
    ctx.save();
    ctx.translate(0, Math.round(Math.sin(this.t * 0.8) * 1));
    ctx.drawImage(this.branch, 0, 0);
    ctx.restore();
  }
}
