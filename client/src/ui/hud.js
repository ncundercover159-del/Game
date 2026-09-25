// In-race HUD (DOM overlay). Layout follows the reference screenshots but keeps
// clear of the bottom corners where thumbs live.
import { ICONS, ELEMENT_COLORS } from './icons.js';
import { KART } from '@shared/config.js';
import { getRacer } from '@shared/data/registry.js';

export const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
};

export function fmtTime(t) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60), s = Math.floor(t % 60), ms = Math.floor((t * 1000) % 1000);
  return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export class Hud {
  constructor(root, opts = {}) {
    this.root = root;
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="hud-tl">
        <div class="item-slot"><div class="item-icon"></div><div class="item-count"></div><div class="coin-bubble">${ICONS.coin}</div></div>
        <div class="pills">
          <div class="pill coins"><span class="ic">${ICONS.coin}</span><b class="coin-n">00</b></div>
          <div class="pill laps"><span class="ic">${ICONS.flag}</span><b class="lap-n">1/3</b></div>
        </div>
      </div>
      <div class="hud-top"><button class="pause-btn" aria-label="Pause">${ICONS.pause}</button><div class="timer">0:00.000</div><div class="split"></div></div>
      <canvas class="minimap" width="240" height="200"></canvas>
      <div class="position"><span class="pos-n">1</span><span class="pos-s">st</span></div>
      <div class="speedo"><svg viewBox="0 0 120 60"><path class="sp-bg" d="M10 55 A50 50 0 0 1 110 55"/><path class="sp-drift" d="M10 55 A50 50 0 0 1 110 55"/><path class="sp-fill" d="M10 55 A50 50 0 0 1 110 55"/></svg><b class="sp-n">0</b></div>
      <div class="banner"></div>
      <div class="wrongway">WRONG WAY!</div>
      <div class="ticker"></div>
      <div class="warn"></div>
      <div class="captions"></div>
    `;
    root.appendChild(this.el);
    const q = (s) => this.el.querySelector(s);
    this.$ = {
      coinN: q('.coin-n'), lapN: q('.lap-n'), timer: q('.timer'), split: q('.split'), posN: q('.pos-n'), posS: q('.pos-s'),
      pos: q('.position'), banner: q('.banner'), wrong: q('.wrongway'), ticker: q('.ticker'), mini: q('.minimap'),
      spFill: q('.sp-fill'), spDrift: q('.sp-drift'), spN: q('.sp-n'), itemIcon: q('.item-icon'), itemCount: q('.item-count'),
      slot: q('.item-slot'), warn: q('.warn'), captions: q('.captions'), pause: q('.pause-btn'), laps: q('.laps'),
    };
    this.$.pause.addEventListener('click', () => this.onPause?.());
    this.arcLen = 157;
    this.$.spFill.style.strokeDasharray = `${this.arcLen}`;
    this.$.spDrift.style.strokeDasharray = `${this.arcLen}`;
    this.last = {};
    this.mini = null;
    this.portraits = opts.portraits || null;
    this.visible = true;
  }

  setVisible(v) {
    this.visible = v;
    this.el.classList.toggle('hidden', !v);
  }

  setMode(mode) { this.el.dataset.mode = mode; }

  // Precompute minimap geometry from the world.
  setWorld(world) {
    const c = this.$.mini;
    const ctx = c.getContext('2d');
    this.mini = { world, ctx, w: c.width, h: c.height };
    const pts = [];
    const add = (R) => {
      const out = [];
      for (let i = 0; i < R.n; i += 2) out.push([R.x[i], R.z[i]]);
      if (R.closed) out.push([R.x[0], R.z[0]]);
      else out.push([R.x[R.n - 1], R.z[R.n - 1]]);
      return out;
    };
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    const lines = [];
    if (world.ribbons) {
      for (const R of world.ribbons) {
        const l = add(R);
        for (const [x, z] of l) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
        lines.push({ pts: l, main: R.closed });
      }
    } else {
      const b = world.bounds;
      const hw = b.shape === 'circle' ? b.r : b.w / 2, hd = b.shape === 'circle' ? b.r : b.d / 2;
      minX = -hw; maxX = hw; minZ = -hd; maxZ = hd;
      this.mini.arena = b;
    }
    // map: world x -> screen x mirrored so "right" on screen matches driving right on the start straight
    const pad = 14;
    const sx = (c.width - pad * 2) / (maxX - minX || 1), sz = (c.height - pad * 2) / (maxZ - minZ || 1);
    const s = Math.min(sx, sz);
    const ox = c.width / 2, oz = c.height / 2;
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    this.mini.map = (x, z) => [ox - (x - cx) * s, oz - (z - cz) * s];
    this.mini.lines = lines;
    this.mini.scale = s;
    // pre-render the static track into an offscreen canvas
    const bg = document.createElement('canvas');
    bg.width = c.width; bg.height = c.height;
    const b = bg.getContext('2d');
    b.lineJoin = b.lineCap = 'round';
    if (this.mini.arena) {
      const ar = this.mini.arena;
      b.fillStyle = 'rgba(255,255,255,0.35)'; b.strokeStyle = 'rgba(26,20,38,0.8)'; b.lineWidth = 4;
      if (ar.shape === 'circle') { b.beginPath(); b.arc(ox, oz, ar.r * s, 0, Math.PI * 2); b.fill(); b.stroke(); }
      else { b.fillRect(ox - (ar.w / 2) * s, oz - (ar.d / 2) * s, ar.w * s, ar.d * s); b.strokeRect(ox - (ar.w / 2) * s, oz - (ar.d / 2) * s, ar.w * s, ar.d * s); }
    }
    for (const pass of [0, 1]) {
      for (const ln of lines) {
        b.beginPath();
        ln.pts.forEach(([x, z], i) => { const [px, py] = this.mini.map(x, z); if (i) b.lineTo(px, py); else b.moveTo(px, py); });
        b.strokeStyle = pass ? (ln.main ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)') : 'rgba(26,20,38,0.75)';
        b.lineWidth = pass ? (ln.main ? 7 : 4) : (ln.main ? 12 : 8);
        if (!ln.main && pass) b.setLineDash([5, 5]); else b.setLineDash([]);
        b.stroke();
      }
    }
    if (world.startS !== undefined) {
      const p = world.at(world.startS / world.length, 0);
      const q = world.at(world.startS / world.length, 1);
      const [ax, ay] = this.mini.map(p.x, p.z), [bx, by] = this.mini.map(q.x, q.z);
      const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
      b.strokeStyle = '#1a1426'; b.lineWidth = 3; b.setLineDash([2, 2]);
      b.beginPath(); b.moveTo(ax - (dx / l) * 8, ay - (dy / l) * 8); b.lineTo(ax + (dx / l) * 8, ay + (dy / l) * 8); b.stroke();
      b.setLineDash([]);
    }
    this.mini.bg = bg;
  }

  drawMinimap(karts, localId, extras = []) {
    const m = this.mini;
    if (!m) return;
    const ctx = m.ctx;
    ctx.clearRect(0, 0, m.w, m.h);
    ctx.drawImage(m.bg, 0, 0);
    for (const e of extras) {
      const [x, y] = m.map(e.x, e.z);
      ctx.fillStyle = e.color || '#ff3d6e';
      ctx.beginPath(); ctx.arc(x, y, e.r || 4, 0, Math.PI * 2); ctx.fill();
    }
    // draw others first, local last (on top)
    const sorted = [...karts].sort((a, b) => (a.id === localId) - (b.id === localId) || b.place - a.place);
    for (const k of sorted) {
      if (k.eliminated) continue;
      const [x, y] = m.map(k.x, k.z);
      const local = k.id === localId;
      const r = local ? 11 : 8;
      const col = ELEMENT_COLORS[k.element] || '#fff';
      ctx.fillStyle = '#1a1426';
      ctx.beginPath(); ctx.arc(x, y, r + 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      const img = this.portraits?.get(k.racerId);
      if (img && img.complete) {
        ctx.save();
        ctx.beginPath(); ctx.arc(x, y, r - 1.5, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
        ctx.restore();
      }
      if (local) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(x, y, r + 1, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  update(k, race, opts = {}) {
    const $ = this.$, L = this.last;
    if (!k) return;
    const coins = String(Math.min(99, k.coins)).padStart(2, '0');
    if (L.coins !== coins) {
      $.coinN.textContent = coins;
      if (L.coins !== undefined) this.pop($.coinN.parentElement);
      L.coins = coins;
      $.coinN.parentElement.classList.toggle('max', k.coins >= KART.coinMax);
    }
    const laps = race.laps || 3;
    const lapShow = Math.min(laps, Math.max(1, (k.lap || 0) + 1));
    const lapTxt = `${lapShow}/${laps}`;
    if (L.lap !== lapTxt) { $.lapN.textContent = lapTxt; if (L.lap) this.pop($.lapN.parentElement); L.lap = lapTxt; }
    const place = k.place || 1;
    if (L.place !== place) {
      $.posN.textContent = place;
      $.posS.textContent = ordinal(place);
      $.pos.classList.toggle('first', place === 1);
      $.pos.classList.toggle('last', place === race.karts.length && race.karts.length > 1);
      if (L.place !== undefined) {
        $.pos.classList.remove('bump-up', 'bump-down');
        void $.pos.offsetWidth;
        $.pos.classList.add(place < L.place ? 'bump-up' : 'bump-down');
      }
      L.place = place;
    }
    const t = k.finished ? k.finishTime : Math.max(0, race.time);
    const tt = fmtTime(t);
    if (L.time !== tt) { $.timer.textContent = tt; L.time = tt; }
    // speedometer + drift charge ring
    const sp = Math.abs(k.speed);
    const f = Math.min(1, sp / 42);
    $.spFill.style.strokeDashoffset = `${this.arcLen * (1 - f)}`;
    const dc = k.drift ? Math.min(1, k.driftCharge / KART.mtCharge[2]) : 0;
    $.spDrift.style.strokeDashoffset = `${this.arcLen * (1 - dc)}`;
    $.spDrift.dataset.tier = k.driftTier || 0;
    const spn = String(Math.round(sp * 3.6));
    if (L.sp !== spn) { $.spN.textContent = spn; L.sp = spn; }
    this.el.classList.toggle('boosting', k.boostTime > 0);
    if (L.ww !== k.isWrongWay) { $.wrong.classList.toggle('show', !!k.isWrongWay); L.ww = k.isWrongWay; }
    this.el.classList.toggle('no-laps', race.mode === 'battle');
  }

  pop(el) {
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  banner(text, cls = '', ms = 1400) {
    const b = this.$.banner;
    b.className = `banner show ${cls}`;
    b.innerHTML = text;
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => { b.className = 'banner'; }, ms);
  }

  countdown(n) {
    const txt = n === 0 ? 'GO!' : String(n);
    this.banner(`<span class="cd">${txt}</span>`, n === 0 ? 'go' : 'count', n === 0 ? 900 : 950);
  }

  split(text, good) {
    const s = this.$.split;
    s.innerHTML = text;
    s.className = `split show ${good === true ? 'good' : good === false ? 'bad' : ''}`;
    clearTimeout(this.splitT);
    this.splitT = setTimeout(() => { s.className = 'split'; }, 2600);
  }

  tick(html, color) {
    const d = document.createElement('div');
    d.className = 'tick';
    d.innerHTML = html;
    if (color) d.style.borderColor = color;
    this.$.ticker.prepend(d);
    while (this.$.ticker.children.length > 4) this.$.ticker.lastChild.remove();
    setTimeout(() => d.classList.add('out'), 2600);
    setTimeout(() => d.remove(), 3100);
  }

  caption(text) {
    const c = this.$.captions;
    const d = document.createElement('div');
    d.textContent = text;
    c.prepend(d);
    while (c.children.length > 3) c.lastChild.remove();
    setTimeout(() => d.remove(), 1800);
  }

  racerName(id) { return getRacer(id)?.name || id; }

  destroy() { this.el.remove(); }
}
