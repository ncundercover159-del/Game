// Procedural canvas textures (no image assets needed). Cached by key.
import * as THREE from 'three';
import { makeRng } from '@shared/math.js';

const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTex(c, { repeat = true, srgb = true, aniso = 4, mip = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.generateMipmaps = mip;
  if (!mip) t.minFilter = THREE.LinearFilter;
  return t;
}

function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

function noiseFill(ctx, w, h, base, spread, seed, count = 2400, size = [1, 3]) {
  const rng = makeRng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < count; i++) {
    const v = (rng() - 0.5) * spread;
    ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    const s = size[0] + rng() * (size[1] - size[0]);
    ctx.fillRect(rng() * w, rng() * h, s, s);
  }
}

export const TEX = {
  asphalt: (tint = '#45474e') => cached('asphalt' + tint, () => {
    const [c, ctx] = canvas(256, 256);
    noiseFill(ctx, 256, 256, tint, 0.22, 7, 5200, [1, 2.5]);
    return toTex(c);
  }),
  grass: (a = '#5cb842', b = '#6cc94e') => cached('grass' + a + b, () => {
    const [c, ctx] = canvas(256, 256);
    ctx.fillStyle = a; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = b; ctx.fillRect(0, 0, 256, 128);
    noiseFill(ctx, 256, 256, 'rgba(0,0,0,0)', 0.18, 3, 3000, [1, 3]);
    return toTex(c);
  }),
  sand: (a = '#e2c27a') => cached('sand' + a, () => {
    const [c, ctx] = canvas(128, 128);
    noiseFill(ctx, 128, 128, a, 0.2, 11, 1800, [1, 2]);
    return toTex(c);
  }),
  checker: (n = 8, a = '#ffffff', b = '#141418') => cached(`checker${n}${a}${b}`, () => {
    const [c, ctx] = canvas(128, 128);
    const s = 128 / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      ctx.fillStyle = (x + y) % 2 ? a : b;
      ctx.fillRect(x * s, y * s, s, s);
    }
    const t = toTex(c);
    t.magFilter = THREE.NearestFilter;
    return t;
  }),
  stripes: (a = '#e8402a', b = '#ffffff', n = 2) => cached(`stripes${a}${b}${n}`, () => {
    const [c, ctx] = canvas(64, 64);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? b : a;
      ctx.fillRect(0, (i * 64) / n, 64, 64 / n);
    }
    return toTex(c);
  }),
  tiles: (a = '#8fb7d9', b = '#7ea8cc', line = '#5f89ad') => cached(`tiles${a}${b}${line}`, () => {
    const [c, ctx] = canvas(256, 256);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      ctx.fillStyle = (x + y) % 2 ? a : b;
      ctx.fillRect(x * 64, y * 64, 64, 64);
    }
    ctx.strokeStyle = line; ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(256, i * 64); ctx.stroke();
    }
    return toTex(c);
  }),
  chevrons: () => cached('chevrons', () => {
    const [c, ctx] = canvas(128, 128);
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#ff9a1f'); g.addColorStop(1, '#ffdd33');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 2; i++) {
      const y = i * 64 + 10;
      ctx.beginPath();
      ctx.moveTo(14, y + 40); ctx.lineTo(64, y); ctx.lineTo(114, y + 40);
      ctx.lineTo(114, y + 56); ctx.lineTo(64, y + 16); ctx.lineTo(14, y + 56);
      ctx.closePath(); ctx.fill();
    }
    return toTex(c);
  }),
  soft: () => cached('soft', () => {
    const [c, ctx] = canvas(64, 64);
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return toTex(c, { repeat: false, srgb: false });
  }),
  blob: () => cached('blob', () => {
    const [c, ctx] = canvas(64, 64);
    const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return toTex(c, { repeat: false, srgb: false });
  }),
  ring: () => cached('ring', () => {
    const [c, ctx] = canvas(256, 256);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 10;
    ctx.setLineDash([26, 18]);
    ctx.beginPath(); ctx.arc(128, 128, 120, 0, Math.PI * 2); ctx.stroke();
    return toTex(c, { repeat: false });
  }),
  question: () => cached('question', () => {
    const [c, ctx] = canvas(128, 128);
    ctx.clearRect(0, 0, 128, 128);
    ctx.font = 'bold 104px "Lilita One", Arial Black, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 12; ctx.strokeStyle = '#7a2a8a';
    ctx.strokeText('?', 64, 70);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('?', 64, 70);
    return toTex(c, { repeat: false });
  }),
  skid: () => cached('skid', () => {
    const [c, ctx] = canvas(32, 64);
    const g = ctx.createLinearGradient(0, 0, 32, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.3, 'rgba(0,0,0,0.8)');
    g.addColorStop(0.7, 'rgba(0,0,0,0.8)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 64);
    return toTex(c, { srgb: false });
  }),
  metal: (a = '#6b7384') => cached('metal' + a, () => {
    const [c, ctx] = canvas(256, 256);
    noiseFill(ctx, 256, 256, a, 0.12, 5, 1500, [1, 2]);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3;
    for (let i = 0; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(0, i * 128); ctx.lineTo(256, i * 128); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i * 128, 0); ctx.lineTo(i * 128, 256); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      for (const [ox, oy] of [[12, 12], [116, 12], [12, 116], [116, 116]]) {
        ctx.beginPath(); ctx.arc(x * 128 + ox, y * 128 + oy, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    return toTex(c);
  }),
  cobble: (a = '#6d6478') => cached('cobble' + a, () => {
    const [c, ctx] = canvas(256, 256);
    ctx.fillStyle = '#3b3442'; ctx.fillRect(0, 0, 256, 256);
    const rng = makeRng(9);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const ox = (y % 2) * 16;
      const l = 0.85 + rng() * 0.3;
      ctx.fillStyle = shade(a, l);
      roundRect(ctx, x * 32 + ox + 2 - 16, y * 32 + 2, 28, 28, 7);
      roundRect(ctx, x * 32 + ox + 2 + 240, y * 32 + 2, 28, 28, 7);
    }
    return toTex(c);
  }),
  planks: (a = '#a0703e') => cached('planks' + a, () => {
    const [c, ctx] = canvas(256, 256);
    ctx.fillStyle = '#4a3020'; ctx.fillRect(0, 0, 256, 256);
    const rng = makeRng(13);
    for (let y = 0; y < 8; y++) {
      ctx.fillStyle = shade(a, 0.85 + rng() * 0.3);
      ctx.fillRect(0, y * 32 + 2, 256, 28);
      ctx.fillStyle = 'rgba(60,35,20,0.35)';
      for (let k = 0; k < 3; k++) ctx.fillRect(0, y * 32 + 8 + k * 7 + rng() * 3, 256, 1.5);
      ctx.fillStyle = '#3a2618';
      for (const x of [24 + rng() * 40, 150 + rng() * 60]) { ctx.beginPath(); ctx.arc(x, y * 32 + 16, 2.4, 0, Math.PI * 2); ctx.fill(); }
    }
    return toTex(c);
  }),
  rainbow: () => cached('rainbow', () => {
    const [c, ctx] = canvas(256, 64);
    const cols = ['#ff4f4f', '#ff9a1e', '#ffe04f', '#56d23e', '#3db4ff', '#a84cff'];
    cols.forEach((col, i) => { ctx.fillStyle = col; ctx.fillRect((i * 256) / 6, 0, 256 / 6 + 1, 64); });
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(0, 0, 256, 6);
    return toTex(c);
  }),
  lava: () => cached('lava', () => {
    const [c, ctx] = canvas(256, 256);
    const rng = makeRng(21);
    ctx.fillStyle = '#ff5a12'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = rng() > 0.5 ? 'rgba(255,220,60,0.5)' : 'rgba(120,20,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(rng() * 256, rng() * 256, 10 + rng() * 30, 6 + rng() * 16, rng() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    return toTex(c);
  }),
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.fill();
}

export function shade(hex, l) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(l);
  return `#${c.getHexString()}`;
}
