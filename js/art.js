'use strict';

/* Every gem, blocker and power-up is drawn with canvas paths so the game
 * ships with zero binary assets and scales to any resolution. */
const Art = {
  COLORS: [
    { key: 'ruby',     light: '#ffb3bf', main: '#ff3d5a', dark: '#a80d29', spark: '#ff8fa0' },
    { key: 'sapphire', light: '#a9dcff', main: '#2f96ff', dark: '#0a4392', spark: '#7cc4ff' },
    { key: 'emerald',  light: '#adf7c1', main: '#2fd160', dark: '#0b7a30', spark: '#79e99a' },
    { key: 'topaz',    light: '#fff0b0', main: '#ffc21f', dark: '#b57200', spark: '#ffdd6e' },
    { key: 'amethyst', light: '#e2c0ff', main: '#a45cff', dark: '#571aa8', spark: '#c493ff' },
    { key: 'amber',    light: '#ffd3ab', main: '#ff7a24', dark: '#a83c00', spark: '#ffab6b' },
  ],

  _iconCache: new Map(),

  // ---------------------------------------------------------------- paths

  pathCircle(ctx, s) { ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); },

  pathDiamond(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * .82, -s * .12);
    ctx.lineTo(0, s);
    ctx.lineTo(-s * .82, -s * .12);
    ctx.closePath();
  },

  pathHexagon(ctx, s) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 3;
      const x = Math.cos(a) * s, y = Math.sin(a) * s;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  },

  pathStar(ctx, s, points = 5, inner = 0.46) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 ? s * inner : s;
      const a = -Math.PI / 2 + i * Math.PI / points;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  },

  pathHeart(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(0, s * .95);
    ctx.bezierCurveTo(-s * 1.35, -s * .1, -s * .62, -s * 1.2, 0, -s * .42);
    ctx.bezierCurveTo(s * .62, -s * 1.2, s * 1.35, -s * .1, 0, s * .95);
    ctx.closePath();
  },

  pathRoundRect(ctx, s, r) {
    const x = -s, y = -s, w = s * 2, h = s * 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  shapeFor(ctx, colorIndex, s) {
    switch (colorIndex) {
      case 0: this.pathHeart(ctx, s * .95); break;
      case 1: this.pathDiamond(ctx, s); break;
      case 2: this.pathHexagon(ctx, s * .98); break;
      case 3: this.pathStar(ctx, s * 1.05, 5, .5); break;
      case 4: this.pathCircle(ctx, s * .92); break;
      default: this.pathRoundRect(ctx, s * .86, s * .34); break;
    }
  },

  // ---------------------------------------------------------------- gems

  /* A plain jewel: body gradient, rim light, glossy highlight, sparkle. */
  drawGem(ctx, cx, cy, size, colorIndex, opts = {}) {
    if (!(colorIndex >= 0)) colorIndex = 0;
    const c = this.COLORS[colorIndex % this.COLORS.length];
    const s = size * .42;
    ctx.save();
    ctx.translate(cx, cy);
    if (opts.rot) ctx.rotate(opts.rot);
    if (opts.scale !== undefined) ctx.scale(opts.scale, opts.scale);
    ctx.globalAlpha = opts.alpha === undefined ? 1 : opts.alpha;

    // drop shadow
    ctx.save();
    ctx.translate(0, s * .16);
    ctx.fillStyle = 'rgba(0,0,0,.30)';
    this.shapeFor(ctx, colorIndex, s * 1.02);
    ctx.fill();
    ctx.restore();

    // body
    const grad = ctx.createLinearGradient(0, -s, 0, s);
    grad.addColorStop(0, c.light);
    grad.addColorStop(.42, c.main);
    grad.addColorStop(1, c.dark);
    this.shapeFor(ctx, colorIndex, s);
    ctx.fillStyle = grad;
    ctx.fill();

    // inner facet
    ctx.save();
    ctx.clip();
    const fg = ctx.createLinearGradient(-s, -s, s, s);
    fg.addColorStop(0, 'rgba(255,255,255,.42)');
    fg.addColorStop(.5, 'rgba(255,255,255,0)');
    fg.addColorStop(1, 'rgba(0,0,0,.20)');
    ctx.fillStyle = fg;
    ctx.fillRect(-s * 1.2, -s * 1.2, s * 2.4, s * 2.4);
    ctx.restore();

    // outline
    ctx.lineWidth = Math.max(1.5, s * .11);
    ctx.strokeStyle = c.dark;
    ctx.globalAlpha = (opts.alpha === undefined ? 1 : opts.alpha) * .85;
    this.shapeFor(ctx, colorIndex, s);
    ctx.stroke();
    ctx.globalAlpha = opts.alpha === undefined ? 1 : opts.alpha;

    // gloss
    ctx.beginPath();
    ctx.ellipse(-s * .28, -s * .38, s * .30, s * .17, -0.55, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.fill();

    // sparkle
    ctx.save();
    ctx.translate(s * .40, -s * .44);
    ctx.rotate(Math.PI / 5);
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    this.pathStar(ctx, s * .22, 4, .28);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  },

  // ------------------------------------------------------------ powerups

  drawRocket(ctx, cx, cy, size, colorIndex, vertical) {
    const c = this.COLORS[(colorIndex >= 0 ? colorIndex : 1) % this.COLORS.length];
    const s = size * .42;
    ctx.save();
    ctx.translate(cx, cy);
    if (!vertical) ctx.rotate(Math.PI / 2);

    // glow pad so rockets read clearly against the board
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.02, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.fill();

    const body = ctx.createLinearGradient(-s * .5, 0, s * .5, 0);
    body.addColorStop(0, '#e9edf5');
    body.addColorStop(.4, '#ffffff');
    body.addColorStop(1, '#9aa4bb');

    // fuselage
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.05);
    ctx.quadraticCurveTo(s * .52, -s * .42, s * .46, s * .52);
    ctx.lineTo(-s * .46, s * .52);
    ctx.quadraticCurveTo(-s * .52, -s * .42, 0, -s * 1.05);
    ctx.closePath();
    ctx.fillStyle = body;
    ctx.fill();
    ctx.lineWidth = Math.max(1.4, s * .09);
    ctx.strokeStyle = '#4a5470';
    ctx.stroke();

    // nose cone + stripe in the gem colour
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.05);
    ctx.quadraticCurveTo(s * .34, -s * .66, s * .30, -s * .34);
    ctx.lineTo(-s * .30, -s * .34);
    ctx.quadraticCurveTo(-s * .34, -s * .66, 0, -s * 1.05);
    ctx.closePath();
    ctx.fillStyle = c.main;
    ctx.fill();
    ctx.strokeStyle = c.dark;
    ctx.stroke();

    ctx.fillStyle = c.main;
    ctx.fillRect(-s * .44, s * .04, s * .88, s * .22);

    // window
    ctx.beginPath();
    ctx.arc(0, -s * .06, s * .19, 0, Math.PI * 2);
    ctx.fillStyle = '#4fd3ff';
    ctx.fill();
    ctx.lineWidth = Math.max(1.2, s * .08);
    ctx.strokeStyle = '#2a3350';
    ctx.stroke();

    // fins
    ctx.fillStyle = c.dark;
    ctx.beginPath();
    ctx.moveTo(-s * .46, s * .10); ctx.lineTo(-s * .84, s * .60); ctx.lineTo(-s * .46, s * .52);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * .46, s * .10); ctx.lineTo(s * .84, s * .60); ctx.lineTo(s * .46, s * .52);
    ctx.closePath(); ctx.fill();

    // flame
    ctx.beginPath();
    ctx.moveTo(-s * .26, s * .52);
    ctx.quadraticCurveTo(0, s * 1.14, s * .26, s * .52);
    ctx.closePath();
    const fl = ctx.createLinearGradient(0, s * .5, 0, s * 1.1);
    fl.addColorStop(0, '#fff3a0');
    fl.addColorStop(1, '#ff6a1f');
    ctx.fillStyle = fl;
    ctx.fill();

    ctx.restore();
  },

  drawTNT(ctx, cx, cy, size, t = 0) {
    const s = size * .42;
    ctx.save();
    ctx.translate(cx, cy);

    ctx.beginPath();
    ctx.ellipse(0, s * .86, s * .74, s * .16, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.fill();

    // barrel
    const g = ctx.createLinearGradient(-s * .7, 0, s * .7, 0);
    g.addColorStop(0, '#8d1f22');
    g.addColorStop(.35, '#e0393c');
    g.addColorStop(.62, '#ff6b6b');
    g.addColorStop(1, '#93191d');
    this.pathRoundRect(ctx, s * .78, s * .18);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, s * .1);
    ctx.strokeStyle = '#5c0f12';
    ctx.stroke();

    // hoops
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.fillRect(-s * .78, -s * .48, s * 1.56, s * .13);
    ctx.fillRect(-s * .78, s * .36, s * 1.56, s * .13);

    // label
    ctx.fillStyle = '#fff6d8';
    ctx.font = `900 ${s * .58}px ${'Trebuchet MS, Verdana, sans-serif'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TNT', 0, s * .02);

    // fuse + spark
    ctx.beginPath();
    ctx.moveTo(s * .18, -s * .78);
    ctx.quadraticCurveTo(s * .72, -s * 1.06, s * .52, -s * 1.32);
    ctx.lineWidth = Math.max(1.6, s * .12);
    ctx.strokeStyle = '#6b4a22';
    ctx.stroke();

    const flick = 0.7 + Math.sin(t * 22) * 0.3;
    ctx.beginPath();
    ctx.arc(s * .52, -s * 1.32, s * .24 * flick, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,196,60,.85)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * .52, -s * 1.32, s * .12 * flick, 0, Math.PI * 2);
    ctx.fillStyle = '#fffbe6';
    ctx.fill();

    ctx.restore();
  },

  drawLightBall(ctx, cx, cy, size, t = 0) {
    const s = size * .44;
    ctx.save();
    ctx.translate(cx, cy);

    // halo
    const halo = ctx.createRadialGradient(0, 0, s * .3, 0, 0, s * 1.35);
    halo.addColorStop(0, 'rgba(255,255,255,.55)');
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath(); ctx.arc(0, 0, s * 1.35, 0, Math.PI * 2);
    ctx.fillStyle = halo; ctx.fill();

    // rotating colour wedges
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.clip();
    ctx.rotate(t * 1.1);
    const n = this.COLORS.length;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, s, (i / n) * Math.PI * 2, ((i + 1) / n) * Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = this.COLORS[i].main;
      ctx.fill();
    }
    ctx.restore();

    // glassy shading
    const sh = ctx.createRadialGradient(-s * .3, -s * .35, s * .05, 0, 0, s);
    sh.addColorStop(0, 'rgba(255,255,255,.85)');
    sh.addColorStop(.45, 'rgba(255,255,255,.10)');
    sh.addColorStop(1, 'rgba(0,0,0,.42)');
    ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2);
    ctx.fillStyle = sh; ctx.fill();

    ctx.lineWidth = Math.max(1.6, s * .1);
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.stroke();

    // twinkle
    ctx.save();
    ctx.rotate(t * 2.2);
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    this.pathStar(ctx, s * .42, 4, .22);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  },

  // ----------------------------------------------------------- overlays

  drawIce(ctx, cx, cy, size, layers) {
    const s = size * .5;
    ctx.save();
    ctx.translate(cx, cy);
    // Kept deliberately translucent: the player still needs to read the
    // colour of the gem trapped underneath.
    const g = ctx.createLinearGradient(-s, -s, s, s);
    g.addColorStop(0, 'rgba(214,244,255,.46)');
    g.addColorStop(.5, 'rgba(150,214,255,.24)');
    g.addColorStop(1, 'rgba(214,244,255,.46)');
    this.pathRoundRect(ctx, s * .94, s * .22);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(2, s * .12);
    ctx.strokeStyle = layers > 1 ? 'rgba(255,255,255,.98)' : 'rgba(255,255,255,.8)';
    ctx.stroke();

    // frost shards
    ctx.save();
    this.pathRoundRect(ctx, s * .94, s * .22);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = Math.max(1.2, s * .07);
    const shards = layers > 1 ? 5 : 3;
    for (let i = 0; i < shards; i++) {
      const a = (i / shards) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s * .2, Math.sin(a) * s * .2);
      ctx.lineTo(Math.cos(a) * s * 1.1, Math.sin(a) * s * 1.1);
      ctx.stroke();
    }
    ctx.restore();

    if (layers > 1) {
      ctx.fillStyle = 'rgba(255,255,255,.20)';
      this.pathRoundRect(ctx, s * .94, s * .22);
      ctx.fill();
    }
    ctx.restore();
  },

  /* Two thin crossed chains — narrow enough that the gem's colour and
   * shape still read through them. */
  drawChain(ctx, cx, cy, size) {
    const s = size * .5;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineCap = 'round';

    const drawBar = (angle) => {
      ctx.save();
      ctx.rotate(angle);
      ctx.lineWidth = Math.max(2, s * .13);
      ctx.strokeStyle = '#20242f';
      ctx.beginPath(); ctx.moveTo(-s * 1.02, 0); ctx.lineTo(s * 1.02, 0); ctx.stroke();
      ctx.lineWidth = Math.max(1.4, s * .09);
      ctx.strokeStyle = '#8d99b0';
      ctx.beginPath(); ctx.moveTo(-s * 1.02, -s * .02); ctx.lineTo(s * 1.02, -s * .02); ctx.stroke();
      // links
      ctx.lineWidth = Math.max(1.2, s * .07);
      ctx.strokeStyle = '#5c6880';
      for (let x = -s * .78; x <= s * .78; x += s * .52) {
        ctx.beginPath();
        ctx.ellipse(x, 0, s * .13, s * .19, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    };
    drawBar(Math.PI / 5);
    drawBar(-Math.PI / 5);
    ctx.restore();
  },

  drawCrate(ctx, cx, cy, size, hp, maxHp) {
    const s = size * .47;
    ctx.save();
    ctx.translate(cx, cy);

    const g = ctx.createLinearGradient(0, -s, 0, s);
    g.addColorStop(0, '#d19a5b');
    g.addColorStop(.5, '#a86c33');
    g.addColorStop(1, '#7a4a1d');
    this.pathRoundRect(ctx, s, s * .16);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(2, s * .12);
    ctx.strokeStyle = '#553112';
    ctx.stroke();

    ctx.save();
    this.pathRoundRect(ctx, s, s * .16);
    ctx.clip();
    // planks
    ctx.strokeStyle = 'rgba(85,49,18,.6)';
    ctx.lineWidth = Math.max(1.4, s * .08);
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(-s, i * s * .55); ctx.lineTo(s, i * s * .55); ctx.stroke();
    }
    // diagonal brace
    ctx.strokeStyle = 'rgba(255,225,180,.35)';
    ctx.lineWidth = Math.max(2, s * .14);
    ctx.beginPath(); ctx.moveTo(-s, -s); ctx.lineTo(s, s); ctx.stroke();

    // damage cracks once it has been hit
    if (maxHp > 1 && hp < maxHp) {
      ctx.strokeStyle = 'rgba(40,20,5,.75)';
      ctx.lineWidth = Math.max(1.6, s * .09);
      ctx.beginPath();
      ctx.moveTo(-s * .5, -s); ctx.lineTo(-s * .2, -s * .2); ctx.lineTo(-s * .55, s * .3); ctx.lineTo(-s * .3, s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * .55, -s); ctx.lineTo(s * .25, -s * .1); ctx.lineTo(s * .6, s * .5);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  },

  drawStone(ctx, cx, cy, size) {
    const s = size * .47;
    ctx.save();
    ctx.translate(cx, cy);
    const g = ctx.createLinearGradient(0, -s, 0, s);
    g.addColorStop(0, '#9aa3b4');
    g.addColorStop(.55, '#6c7688');
    g.addColorStop(1, '#454d5d');
    this.pathRoundRect(ctx, s, s * .3);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(2, s * .12);
    ctx.strokeStyle = '#333a48';
    ctx.stroke();

    ctx.save();
    this.pathRoundRect(ctx, s, s * .3);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.lineWidth = Math.max(1.4, s * .08);
    ctx.beginPath(); ctx.moveTo(-s * .7, -s * .2); ctx.lineTo(-s * .1, -s * .55); ctx.lineTo(s * .5, -s * .25); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath(); ctx.moveTo(-s * .5, s * .5); ctx.lineTo(s * .1, s * .2); ctx.lineTo(s * .8, s * .6); ctx.stroke();
    ctx.restore();
    ctx.restore();
  },

  // -------------------------------------------------------------- icons

  /* Small cached bitmaps used by the HUD / dialogs / booster buttons. */
  icon(kind, colorIndex, px = 56) {
    const key = kind + ':' + colorIndex + ':' + px;
    if (this._iconCache.has(key)) return this._iconCache.get(key);

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cv = document.createElement('canvas');
    cv.width = cv.height = Math.round(px * dpr);
    cv.style.width = cv.style.height = px + 'px';
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    const c = px / 2, size = px * .92;

    switch (kind) {
      case 'gem': this.drawGem(ctx, c, c, size, colorIndex); break;
      case 'crate': this.drawCrate(ctx, c, c, size, 1, 1); break;
      case 'ice': this.drawIce(ctx, c, c, size, 1); break;
      case 'chain': this.drawChain(ctx, c, c, size); break;
      case 'stone': this.drawStone(ctx, c, c, size); break;
      case 'rocketH': this.drawRocket(ctx, c, c, size, 1, false); break;
      case 'rocketV': this.drawRocket(ctx, c, c, size, 1, true); break;
      case 'tnt': this.drawTNT(ctx, c, c, size, 0); break;
      case 'light': this.drawLightBall(ctx, c, c, size, 0); break;
      case 'hammer': this.drawHammer(ctx, c, c, size); break;
      default: this.drawGem(ctx, c, c, size, 0); break;
    }
    this._iconCache.set(key, cv);
    return cv;
  },

  drawHammer(ctx, cx, cy, size) {
    const s = size * .42;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 7);
    // handle
    const hg = ctx.createLinearGradient(-s * .2, 0, s * .2, 0);
    hg.addColorStop(0, '#8a5a28'); hg.addColorStop(.5, '#c58a45'); hg.addColorStop(1, '#7a4a1d');
    ctx.fillStyle = hg;
    ctx.fillRect(-s * .16, -s * .1, s * .32, s * 1.2);
    ctx.strokeStyle = '#4a2c0d';
    ctx.lineWidth = Math.max(1.4, s * .08);
    ctx.strokeRect(-s * .16, -s * .1, s * .32, s * 1.2);
    // head
    const g = ctx.createLinearGradient(0, -s, 0, -s * .1);
    g.addColorStop(0, '#e6ecf7'); g.addColorStop(.5, '#a8b3c8'); g.addColorStop(1, '#5f6a80');
    ctx.beginPath();
    ctx.moveTo(-s * .82, -s * .92);
    ctx.lineTo(s * .82, -s * .92);
    ctx.lineTo(s * .68, -s * .12);
    ctx.lineTo(-s * .68, -s * .12);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#3d4658';
    ctx.stroke();
    // gold band
    ctx.fillStyle = '#ffc531';
    ctx.fillRect(-s * .78, -s * .62, s * 1.56, s * .16);
    ctx.restore();
  },

  /* HUD elements want an <img>-like node; a cloned canvas is easiest. */
  iconNode(kind, colorIndex, px = 56) {
    const src = this.icon(kind, colorIndex, px);
    const cv = document.createElement('canvas');
    cv.width = src.width; cv.height = src.height;
    cv.style.width = px + 'px'; cv.style.height = px + 'px';
    cv.getContext('2d').drawImage(src, 0, 0);
    return cv;
  },
};
