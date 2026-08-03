// RERUN 2D — the plate.
//
// The whole game is drawn as a chronophotograph: a cutaway section inked in
// bone hairlines on a soot-black ground, with the bodies as the only solid
// things in it. Ghosts are exposures — outline figures trailing their own
// previous positions, which costs nothing because we already hold the tape.
//
// Generation decays the exposure. A first-generation ghost is a whole figure;
// by the fourteenth it has burned down to a stick-and-dot diagram. That is the
// art direction and the frame budget pulling in the same direction: the older
// the crowd gets, the cheaper it is to draw.

import {
  ARENA, STATIC_BOXES, DOOR_BOX, DOOR_DROP, SHAFT, PLATES,
} from './arena.js';
import { INK, PLAYER_H, PLATE_HALF, PLAYER_INK, MOVE_SPEED } from './constants.js';
import { sampleAt, makeSample } from './ghostbuf.js';

// Enough room under the ground line to watch somebody fall out of the
// building, and no more empty air above the top floor than the drawing needs.
const VIEW = { y0: -2.4, y1: 17.2 };
const HEADER = 118; // the HUD owns this band
const FOOTER = 0.205; // and the thumbs own this fraction
const STRIDE_RATE = (Math.PI * 2) / 1.35;

// Figure proportions, metres from the feet.
const FIG = {
  hip: 0.60, shoulder: 1.06, neck: 1.14, head: 1.31, headR: 0.20,
  thigh: 0.33, shin: 0.31, upper: 0.26, fore: 0.24, hipX: 0.11, shX: 0.13,
};

const scratch = makeSample();
const TRAIL_MS = [110, 225, 350];
const TRAIL_A = [0.34, 0.19, 0.10];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.bg = document.createElement('canvas');
    this.fg = document.createElement('canvas');
    this.grain = makeGrain();
    this.dpr = 1;
    this.S = 40;
    this.ox = 0;
    this.oy = 0;
    this.scars = [];   // where somebody fell, and when
    this.slashes = []; // and where the knife went in
    this.resize();
  }

  // world -> screen
  sx(x) { return this.ox + x * this.S; }
  sy(y) { return this.oy - y * this.S; }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [this.canvas, this.bg, this.fg]) {
      c.width = Math.round(w * this.dpr);
      c.height = Math.round(h * this.dpr);
      if (c === this.canvas) { c.style.width = `${w}px`; c.style.height = `${h}px`; }
    }
    this.w = w;
    this.h = h;

    // The header owns the top band and the thumbs own the bottom; the section
    // gets what is left, centred in it.
    const availH = h - HEADER - h * FOOTER;
    const availW = w - 34;
    const spanY = VIEW.y1 - VIEW.y0;
    this.S = Math.min(availW / (ARENA.x1 - ARENA.x0), availH / spanY);
    this.ox = (w - (ARENA.x1 - ARENA.x0) * this.S) / 2;
    const top = HEADER + (availH - spanY * this.S) * 0.5;
    this.oy = top + VIEW.y1 * this.S;

    this.paintBackground();
    this.paintForeground();
  }

  // ------------------------------------------------------------- static ---
  paintBackground() {
    const c = this.bg.getContext('2d');
    const { dpr } = this;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    c.fillStyle = INK.ground;
    c.fillRect(0, 0, this.w, this.h);

    const S = this.S;
    const X = (x) => this.sx(x);
    const Y = (y) => this.sy(y);

    // A faint datum: the outline of the building's envelope.
    c.lineWidth = 1;
    c.strokeStyle = INK.boneFaint;
    inked(c, X(ARENA.x0), Y(VIEW.y0 + 0.4), X(ARENA.x0), Y(ARENA.y1), 1.1, 11);
    inked(c, X(ARENA.x1), Y(VIEW.y0 + 0.4), X(ARENA.x1), Y(ARENA.y1), 1.1, 29);
    inked(c, X(ARENA.x0), Y(ARENA.y1), X(ARENA.x1), Y(ARENA.y1), 1.1, 47);

    // Storey datum lines, drawn faint all the way across so the section reads
    // as a set of levels rather than a pile of platforms.
    const levels = [...new Set(STATIC_BOXES.filter((b) => b.kind === 'floor').map((b) => b.y1))];
    c.strokeStyle = 'rgba(239,231,216,0.055)';
    c.setLineDash([2, 7]);
    for (const y of levels) {
      c.beginPath();
      c.moveTo(X(ARENA.x0) - 8, Y(y));
      c.lineTo(X(ARENA.x1) + 8, Y(y));
      c.stroke();
    }
    c.setLineDash([]);

    // The floors themselves: a struck line with the cut hatched beneath, the
    // way a section drawing shows material you have sliced through.
    let seed = 3;
    for (const b of STATIC_BOXES) {
      const x0 = X(b.x0), x1 = X(b.x1), yTop = Y(b.y1), yBot = Y(b.y0);
      const isShell = b.kind === 'wall';
      const depth = Math.min(yBot - yTop, S * 0.34);

      c.strokeStyle = isShell ? INK.boneFaint : INK.boneDim;
      c.lineWidth = isShell ? 1 : 1.15;
      hatch(c, x0, yTop, x1, yTop + depth, isShell ? 11 : 7);

      if (!isShell) {
        c.strokeStyle = INK.bone;
        c.lineWidth = 2;
        inked(c, x0, yTop, x1, yTop, 0.8, (seed += 7));
        // A short return at each open end, so a ledge reads as an edge.
        c.lineWidth = 1.4;
        c.strokeStyle = INK.boneDim;
        if (b.x0 > ARENA.x0 + 0.01) inked(c, x0, yTop, x0, yTop + depth, 0.6, (seed += 3));
        if (b.x1 < ARENA.x1 - 0.01) inked(c, x1, yTop, x1, yTop + depth, 0.6, (seed += 3));
      }
    }

    // The shaft: the one place the drawing stops and the dark keeps going.
    const sx0 = X(SHAFT.x0), sx1 = X(SHAFT.x1), sy = Y(0);
    c.strokeStyle = INK.bone;
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(sx0, sy); c.lineTo(sx0, sy + S * 0.5); c.stroke();
    if (SHAFT.x1 < ARENA.x1 - 0.01) {
      c.beginPath(); c.moveTo(sx1, sy); c.lineTo(sx1, sy + S * 0.5); c.stroke();
    }
    c.setLineDash([3, 9]);
    c.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      c.strokeStyle = `rgba(239,231,216,${0.10 - i * 0.02})`;
      const yy = sy + S * (0.8 + i * 0.55);
      c.beginPath(); c.moveTo(sx0 + 3, yy); c.lineTo(sx1 - 3, yy); c.stroke();
    }
    c.setLineDash([]);

    // The closet reads as an enclosed chamber, so its air is hatched too.
    c.strokeStyle = 'rgba(239,231,216,0.055)';
    c.lineWidth = 1;
    hatch(c, X(6.4), Y(ARENA.y1), X(ARENA.x1), Y(14.0), 9);

    // Emulsion grain over the whole plate.
    c.save();
    c.globalAlpha = 0.5;
    c.fillStyle = c.createPattern(this.grain, 'repeat');
    c.fillRect(0, 0, this.w, this.h);
    c.restore();
  }

  paintForeground() {
    const c = this.fg.getContext('2d');
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    // Plate vignette: the exposure falls off toward the edges of the glass.
    const g = c.createRadialGradient(
      this.w / 2, this.h * 0.42, Math.min(this.w, this.h) * 0.22,
      this.w / 2, this.h * 0.42, Math.max(this.w, this.h) * 0.72,
    );
    g.addColorStop(0, 'rgba(11,10,13,0)');
    g.addColorStop(0.62, 'rgba(11,10,13,0.34)');
    g.addColorStop(1, 'rgba(11,10,13,0.9)');
    c.fillStyle = g;
    c.fillRect(0, 0, this.w, this.h);
  }

  // ------------------------------------------------------------- frame ----
  draw(room, now, clock) {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.drawImage(this.bg, 0, 0, this.w, this.h);

    this.drawDoor(c, room);
    this.drawPlates(c, room);
    this.drawScars(c, now);
    this.drawTarget(c, room, now);

    // Oldest first, so the newest exposure sits on top of the pile.
    const n = room.ghosts.length;
    const trailBudget = n > 34 ? 0 : n > 18 ? 1 : 3;
    for (const g of room.ghosts) {
      if (now < g.revealAt) continue;
      this.drawGhost(c, g, clock, now, trailBudget);
    }

    if (room.phase !== 3) this.drawLiving(c, room.player, now);
    this.drawSlashes(c, now);

    c.drawImage(this.fg, 0, 0, this.w, this.h);
  }

  drawDoor(c, room) {
    const drop = room.doorOpen ? DOOR_DROP : 0;
    this.doorY = this.doorY === undefined ? drop : this.doorY + (drop - this.doorY) * 0.16;
    const b = DOOR_BOX;
    const x0 = this.sx(b.x0), x1 = this.sx(b.x1);
    const y0 = this.sy(b.y1 - this.doorY), y1 = this.sy(b.y0 - this.doorY);
    c.strokeStyle = room.doorOpen ? INK.boneFaint : INK.boneDim;
    c.lineWidth = 1;
    hatch(c, x0, y0, x1, y1, 5);
    c.strokeStyle = room.doorOpen ? INK.boneDim : INK.bone;
    c.lineWidth = 1.6;
    c.strokeRect(x0, y0, x1 - x0, y1 - y0);
  }

  drawPlates(c, room) {
    const S = this.S;
    for (let i = 0; i < PLATES.length; i++) {
      const p = PLATES[i];
      const st = room.plates[i];
      const armed = room.required.includes(i);
      const turn = room.turnstiles.has(i);
      const on = st.pressed;

      const x = this.sx(p.x);
      const y = this.sy(p.y);
      const hw = PLATE_HALF * S;
      const hh = S * 0.14;

      const hot = turn ? INK.cold : INK.amber;
      if (on) {
        // Glow, built from concentric strokes. shadowBlur on mobile is a trap.
        for (let k = 3; k >= 1; k--) {
          c.strokeStyle = turn
            ? `rgba(111,211,255,${0.10 * k})`
            : `rgba(245,166,35,${0.10 * k})`;
          c.lineWidth = k * 3;
          c.beginPath();
          c.moveTo(x - hw - k, y - 1);
          c.lineTo(x + hw + k, y - 1);
          c.stroke();
        }
        c.fillStyle = hot;
        c.beginPath();
        c.moveTo(x - hw, y);
        c.lineTo(x + hw, y);
        c.lineTo(x + hw * 0.82, y - hh);
        c.lineTo(x - hw * 0.82, y - hh);
        c.closePath();
        c.fill();
      } else {
        c.strokeStyle = armed ? (turn ? INK.coldDim : INK.amberDim) : INK.boneFaint;
        c.lineWidth = armed ? 1.6 : 1;
        c.beginPath();
        c.moveTo(x - hw, y);
        c.lineTo(x + hw * 0.82 - (hw * 0.18), y - hh);
        c.lineTo(x - hw * 0.82 + (hw * 0.18), y - hh);
        c.lineTo(x + hw, y);
        c.stroke();
      }

      // Turnstiles get arrows pointing inward: this one wants arrivals.
      if (turn && armed) {
        c.strokeStyle = on ? INK.cold : INK.coldDim;
        c.lineWidth = 1.4;
        const a = hh * 1.9;
        for (const s of [-1, 1]) {
          const bx = x + s * (hw + a * 0.9);
          c.beginPath();
          c.moveTo(bx + s * a * 0.55, y - a * 0.75);
          c.lineTo(bx, y - a * 0.3);
          c.lineTo(bx + s * a * 0.55, y + a * 0.15);
          c.stroke();
        }
      }
    }
  }

  // --------------------------------------------------------- the figures --
  drawGhost(c, g, clock, now, trailBudget) {
    const s = sampleAt(g.rec, clock, g.cur);
    const decay = Math.min(1, (g.gen - 1) / 13);
    const col = ghostInk(g.gen);
    const base = 0.8 - decay * 0.26;

    // Exposure trail: this ghost, a few frames ago. Marey, essentially.
    const steps = Math.max(0, trailBudget - (decay > 0.6 ? 2 : decay > 0.25 ? 1 : 0));
    for (let i = steps - 1; i >= 0; i--) {
      sampleAt(g.rec, clock - TRAIL_MS[i], scratch);
      if (scratch.y < VIEW.y0) continue;
      this.figure(c, scratch, col, base * TRAIL_A[i], decay, now, true);
    }

    if (s.y < VIEW.y0) return;
    const pop = Math.min(1, (now - g.revealAt) / 300);
    this.figure(c, s, col, base * pop, decay, now, false, g.gen);
  }

  drawLiving(c, p, now) {
    if (p.y < VIEW.y0) return;
    const S = this.S;
    // A standing pool of light, so the living body is never lost in the crowd.
    const fx = this.sx(p.x), fy = this.sy(p.y);
    const g = c.createRadialGradient(fx, fy, 1, fx, fy, S * 1.15);
    g.addColorStop(0, 'rgba(247,234,211,0.16)');
    g.addColorStop(1, 'rgba(247,234,211,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(fx, fy, S * 1.15, 0, Math.PI * 2);
    c.fill();

    this.figure(c, p, PLAYER_INK, 1, 0, now, false, 0, true);
  }

  /**
   * One exposure. Everything is precomputed into screen coordinates and then
   * stroked as a single path, so a figure costs three canvas calls.
   */
  figure(c, s, col, alpha, decay, now, isTrail, gen = 0, solid = false) {
    if (alpha <= 0.012) return;
    const S = this.S;
    const X = this.sx(s.x);
    const Y = this.sy(s.y);
    const f = s.facing || 1;

    const speed = Math.min(1, Math.abs(s.vx === undefined ? 0 : s.vx) / (MOVE_SPEED * 0.7));
    const grounded = s.grounded !== false;
    const phase = (s.dist || 0) * STRIDE_RATE;

    let thighA = Math.sin(phase) * 0.62 * speed;
    let thighB = -thighA;
    let kneeA = Math.max(0, -Math.sin(phase - 0.5)) * 0.88 * speed;
    let kneeB = Math.max(0, Math.sin(phase - 0.5)) * 0.88 * speed;
    let armA = -Math.sin(phase) * 0.5 * speed - 0.06;
    let armB = -armA - 0.12;
    let elbowA = 0.24 + Math.max(0, Math.sin(phase)) * 0.42;
    let elbowB = 0.24 + Math.max(0, -Math.sin(phase)) * 0.42;
    let lean = 0.13 * speed;
    let bob = Math.abs(Math.sin(phase)) * 0.028 * speed;

    if (!grounded) {
      thighA = -0.85; kneeA = 1.25;
      thighB = 0.5; kneeB = 0.35;
      armA = -2.0; armB = -1.75;
      elbowA = 0.35; elbowB = 0.5;
      lean = -0.06; bob = 0;
    }
    if (s.dead) {
      const t = now / 1000 * 9;
      thighA = Math.sin(t) * 1.2; thighB = Math.sin(t + 2.1) * 1.2;
      kneeA = 0.6 + Math.sin(t * 1.4) * 0.4; kneeB = 0.6 + Math.sin(t * 1.1) * 0.4;
      armA = -2.6 + Math.sin(t * 1.3) * 0.4; armB = -2.5 + Math.sin(t * 0.9) * 0.4;
      elbowA = 0.2; elbowB = 0.2;
      lean = 0.5; bob = 0;
    }

    // Joints, in metres from the feet, then straight to screen space.
    const hipY = FIG.hip + bob;
    const sl = Math.sin(lean) * f, cl = Math.cos(lean);
    const up = (h) => ({
      x: X + (h - FIG.hip) * sl * S,
      y: Y - (hipY + (h - FIG.hip) * cl) * S,
    });

    const hipL = { x: X - FIG.hipX * S * f, y: Y - hipY * S };
    const hipR = { x: X + FIG.hipX * S * f, y: Y - hipY * S };
    const sh = up(FIG.shoulder);
    const shL = { x: sh.x - FIG.shX * S * f, y: sh.y };
    const shR = { x: sh.x + FIG.shX * S * f, y: sh.y };
    const head = up(FIG.head);

    const knee = (hip, th) => ({
      x: hip.x + Math.sin(th) * FIG.thigh * S * f,
      y: hip.y + Math.cos(th) * FIG.thigh * S,
    });
    const foot = (kn, th, kb) => ({
      x: kn.x + Math.sin(th - kb) * FIG.shin * S * f,
      y: kn.y + Math.cos(th - kb) * FIG.shin * S,
    });
    const kA = knee(hipL, thighA), kB = knee(hipR, thighB);
    const fA = foot(kA, thighA, kneeA), fB = foot(kB, thighB, kneeB);

    const elbow = (s0, a) => ({
      x: s0.x + Math.sin(a) * FIG.upper * S * f,
      y: s0.y + Math.cos(a) * FIG.upper * S,
    });
    const hand = (e, a, b) => ({
      x: e.x + Math.sin(a + b) * FIG.fore * S * f,
      y: e.y + Math.cos(a + b) * FIG.fore * S,
    });
    const eA = elbow(shL, armA), eB = elbow(shR, armB);
    const hA = hand(eA, armA, elbowA), hB = hand(eB, armB, elbowB);

    c.globalAlpha = alpha;

    if (solid) {
      // The living body is the only filled thing on the plate.
      c.strokeStyle = 'rgba(11,10,13,0.9)';
      c.lineWidth = S * 0.20;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      strokeSkeleton(c, hipL, hipR, kA, kB, fA, fB, shL, shR, eA, eB, hA, hB, head);
      c.strokeStyle = col;
      c.lineWidth = S * 0.125;
      strokeSkeleton(c, hipL, hipR, kA, kB, fA, fB, shL, shR, eA, eB, hA, hB, head);

      c.fillStyle = col;
      c.beginPath();
      c.arc(head.x, head.y, FIG.headR * S, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(11,10,13,0.9)';
      c.lineWidth = S * 0.035;
      c.stroke();

      // Two dots, looking where you are going.
      c.fillStyle = INK.ground;
      const ex = head.x + f * FIG.headR * S * 0.34;
      const ey = head.y - FIG.headR * S * 0.12;
      c.beginPath();
      c.arc(ex - f * S * 0.055, ey, S * 0.035, 0, Math.PI * 2);
      c.arc(ex + f * S * 0.075, ey, S * 0.035, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
      return;
    }

    c.strokeStyle = col;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.lineWidth = S * (0.058 - decay * 0.024);
    strokeSkeleton(c, hipL, hipR, kA, kB, fA, fB, shL, shR, eA, eB, hA, hB, head);

    // The head: filled while the exposure is fresh, an open ring once it has
    // burned down.
    c.beginPath();
    c.arc(head.x, head.y, FIG.headR * S * (1 - decay * 0.2), 0, Math.PI * 2);
    if (decay < 0.45) {
      c.fillStyle = col;
      c.globalAlpha = alpha * 0.4;
      c.fill();
      c.globalAlpha = alpha;
    }
    c.lineWidth = S * (0.04 - decay * 0.018);
    c.stroke();

    if (!isTrail) {
      // Marey's joint marks. They survive the decay longest, because by the
      // end that is all the exposure is.
      c.fillStyle = col;
      c.beginPath();
      const r = S * (0.032 + decay * 0.012);
      for (const j of [hipL, hipR, kA, kB, shL, shR, eA, eB]) {
        c.moveTo(j.x + r, j.y);
        c.arc(j.x, j.y, r, 0, Math.PI * 2);
      }
      c.fill();
      if (gen >= 3) this.hats(c, head, gen, S, col, alpha, now, decay);
    }
    c.globalAlpha = 1;
  }

  hats(c, head, gen, S, col, alpha, now, decay) {
    const top = head.y - FIG.headR * S;
    // Capped: at this size an unbounded hat leaves the plate entirely.
    const grow = gen >= 6 ? Math.min(1.75, 1 + (gen - 6) * 0.055) : 1;
    c.strokeStyle = col;
    // The hat is part of the exposure, so it burns down with the figure.
    c.lineWidth = S * (0.032 - decay * 0.014);

    if (gen === 3 || gen >= 6) {
      const w = S * 0.24 * grow, h = S * 0.42 * grow;
      c.beginPath();
      c.moveTo(head.x - w, top);
      c.lineTo(head.x, top - h);
      c.lineTo(head.x + w, top);
      c.stroke();
    }
    if (gen === 4 || gen >= 6) {
      // The brim widens more slowly than the cone climbs, or it swallows the
      // figure it is meant to be sitting on.
      const w = S * 0.36 * (1 + (grow - 1) * 0.45);
      const y = gen >= 6 ? top - S * 0.42 * grow : top;
      c.beginPath();
      c.ellipse(head.x, y, w, S * 0.07, 0, 0, Math.PI * 2);
      c.stroke();
    }
    if (gen === 5 || gen >= 6) {
      // Structurally unsound. It sways.
      const sway = Math.sin(now / 420 + gen) * 0.16;
      let x = head.x, y = gen >= 6 ? top - S * 0.5 * grow : top;
      for (let i = 0; i < 3; i++) {
        const w = S * (0.2 - i * 0.045) * grow;
        const h = S * 0.2 * grow;
        x += sway * S * 0.16;
        c.beginPath();
        c.rect(x - w, y - h, w * 2, h);
        c.stroke();
        y -= h;
      }
    }
    if (gen >= 10) {
      // A small trailing cloud of flies.
      c.fillStyle = col;
      c.globalAlpha = alpha * 0.8;
      c.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = now / 340 + i * 1.9 + gen;
        const r = S * (0.3 + 0.12 * Math.sin(now / 500 + i));
        c.rect(head.x + Math.cos(a) * r, top - S * 0.2 + Math.sin(a * 1.3) * r * 0.6,
          S * 0.035, S * 0.035);
      }
      c.fill();
      c.globalAlpha = alpha;
    }
  }

  /** Brackets around the past self currently inside knife reach. */
  drawTarget(c, room, now) {
    const g = room.target;
    if (!g) return;
    const S = this.S;
    const x = this.sx(g.cur.x);
    const y = this.sy(g.cur.y);
    const hw = S * 0.44, hh = S * PLAYER_H;
    const t = S * 0.16;
    const pulse = 0.45 + 0.3 * Math.sin(now / 140);
    c.strokeStyle = `rgba(224,72,59,${pulse.toFixed(3)})`;
    c.lineWidth = 1.6;
    c.beginPath();
    for (const sxv of [-1, 1]) {
      for (const syv of [0, 1]) {
        const cx = x + sxv * hw;
        const cy = y - syv * hh;
        c.moveTo(cx - sxv * t, cy);
        c.lineTo(cx, cy);
        c.lineTo(cx, cy + (syv ? t : -t));
      }
    }
    c.stroke();
  }

  /** The knife going in. Brief, and the scar outlives it. */
  addSlash(x0, y0, x1, y1) {
    this.slashes.push({ x0, y0, x1, y1, at: performance.now() });
    if (this.slashes.length > 8) this.slashes.shift();
  }

  drawSlashes(c, now) {
    const S = this.S;
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const s = this.slashes[i];
      const age = (now - s.at) / 260;
      if (age > 1) { this.slashes.splice(i, 1); continue; }
      const a = 1 - age;
      const mx = (s.x0 + s.x1) / 2;
      const my = (s.y0 + s.y1) / 2 + PLAYER_H * 0.55;
      const len = S * (0.5 + age * 0.5);
      c.strokeStyle = `rgba(224,72,59,${(0.95 * a).toFixed(3)})`;
      c.lineWidth = 3 * a + 0.6;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(this.sx(mx) - len, this.sy(my) - len * 0.55);
      c.lineTo(this.sx(mx) + len, this.sy(my) + len * 0.55);
      c.stroke();
    }
  }

  // ---------------------------------------------------------------- marks --
  /** Somebody fell here. The plate remembers. */
  addScar(x, y) {
    this.scars.push({ x, y, at: performance.now() });
    if (this.scars.length > 14) this.scars.shift();
  }

  drawScars(c, now) {
    const S = this.S;
    for (let i = this.scars.length - 1; i >= 0; i--) {
      const s = this.scars[i];
      const age = (now - s.at) / 900;
      if (age > 1) { this.scars.splice(i, 1); continue; }
      const r = S * (0.3 + age * 1.5);
      c.strokeStyle = `rgba(224,72,59,${0.5 * (1 - age)})`;
      c.lineWidth = 2 * (1 - age) + 0.5;
      c.beginPath();
      c.arc(this.sx(s.x), this.sy(s.y + PLAYER_H * 0.5), r, -2.5, -0.7);
      c.stroke();
      c.beginPath();
      c.arc(this.sx(s.x), this.sy(s.y + PLAYER_H * 0.5), r * 1.35, -2.3, -0.9);
      c.stroke();
    }
  }
}

// ------------------------------------------------------------------ bits ---

function strokeSkeleton(c, hipL, hipR, kA, kB, fA, fB, shL, shR, eA, eB, hA, hB, head) {
  c.beginPath();
  // spine
  c.moveTo((hipL.x + hipR.x) / 2, hipL.y);
  c.lineTo((shL.x + shR.x) / 2, shL.y);
  // pelvis and shoulders
  c.moveTo(hipL.x, hipL.y); c.lineTo(hipR.x, hipR.y);
  c.moveTo(shL.x, shL.y); c.lineTo(shR.x, shR.y);
  // legs
  c.moveTo(hipL.x, hipL.y); c.lineTo(kA.x, kA.y); c.lineTo(fA.x, fA.y);
  c.moveTo(hipR.x, hipR.y); c.lineTo(kB.x, kB.y); c.lineTo(fB.x, fB.y);
  // arms
  c.moveTo(shL.x, shL.y); c.lineTo(eA.x, eA.y); c.lineTo(hA.x, hA.y);
  c.moveTo(shR.x, shR.y); c.lineTo(eB.x, eB.y); c.lineTo(hB.x, hB.y);
  // neck
  c.moveTo((shL.x + shR.x) / 2, shL.y); c.lineTo(head.x, head.y);
  c.stroke();
}

/** Generation colour: warm bone burning down to cold ash. */
export function ghostInk(gen) {
  const d = Math.min(1, (gen - 1) / 13);
  const r = Math.round(239 - d * 74);
  const g = Math.round(231 - d * 58);
  const b = Math.round(216 - d * 12);
  return `rgb(${r},${g},${b})`;
}

/** A line with a little tremor in it, so the drawing looks inked not plotted. */
function inked(c, x0, y0, x1, y1, amp, seed) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const steps = Math.max(2, Math.min(14, Math.round(len / 26)));
  const nx = -dy / (len || 1), ny = dx / (len || 1);
  c.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const w = i === 0 || i === steps ? 0 : (rnd(seed + i * 13) - 0.5) * 2 * amp;
    const x = x0 + dx * t + nx * w;
    const y = y0 + dy * t + ny * w;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.stroke();
}

/** Diagonal hatching: the section convention for material you have cut. */
function hatch(c, x0, y0, x1, y1, gap) {
  const h = y1 - y0;
  if (h <= 0.5) return;
  c.beginPath();
  for (let x = x0 - h; x < x1; x += gap) {
    const ax = Math.max(x0, x), ay = y0 + Math.max(0, x0 - x);
    const bx = Math.min(x1, x + h), by = y0 + Math.min(h, x1 - x);
    if (bx <= ax) continue;
    c.moveTo(ax, ay);
    c.lineTo(bx, by);
  }
  c.stroke();
}

function rnd(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function makeGrain() {
  const g = document.createElement('canvas');
  g.width = g.height = 96;
  const c = g.getContext('2d');
  const img = c.createImageData(96, 96);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random();
    img.data[i] = 255; img.data[i + 1] = 244; img.data[i + 2] = 226;
    img.data[i + 3] = v > 0.86 ? 12 : v > 0.6 ? 5 : 0;
  }
  c.putImageData(img, 0, 0);
  return g;
}
