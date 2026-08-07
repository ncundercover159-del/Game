// THE LUMPS — the plate, drawn as a page.
//
// The enclosure is a measured plan: floor, walls, the shelf, the hole, drawn in
// one ink on aged paper the way you would draw a tank you were about to put
// something horrible into. The specimens are the only saturated thing on the
// page, and the joke is entirely in that gap — deadpan apparatus, absurd
// tenants.
//
// Plan view is flat. Height is carried by exactly one trick: a body is shifted
// up the screen in proportion to how far it is above the surface underneath it,
// and leaves its shadow behind. Geometry is never shifted, because lifting a
// wall would hide the room behind it.

import {
  PAPER, LIFT, PLATE_RADIUS, TOTAL_ROUNDS, PHASE,
  pigmentFor, hatFor, mix,
} from './constants.js';
import {
  ARENA, STATIC_BOXES, DOOR_BOX, PIT, PLATES, LEDGE_TOP,
  BOXES_DOOR_CLOSED, BOXES_DOOR_OPEN, surfaceBelow,
} from '@shared/arena.js';
import { poseOf, makeMem, drawLump } from './creature.js';

const FACE = '"Helvetica Neue", "Arial Narrow", Inter, system-ui, sans-serif';
const TAU = Math.PI * 2;

// Room to breathe: the tank never runs into the thumbs or the header.
const INSET_TOP = 74;
const INSET_BOTTOM = 138;
const INSET_SIDE = 22;
const HEAD_ROOM = 1.4; // metres of empty page above the tank, for lifted bodies

// Specimens are drawn larger than they collide. At true scale a Lump is 0.69m
// across in a 10.4m room, which on a phone is a dot — and a dot cannot have a
// face. It squashes into its neighbours a little; blobs should.
const DRAW_SCALE = 1.45;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.page = document.createElement('canvas');   // paper + apparatus
    this.stains = document.createElement('canvas'); // every death, forever
    this.scars = [];
    this.slashes = [];
    this.styles = new Map();
    this.pool = [];
    this.draws = [];
    this.shake = 0;
    this.lastNow = performance.now();
    this.liveMem = makeMem(1.7);
    this.caret = { x: 0, y: 0, on: false };

    this.resize();
  }

  // ---- layout -------------------------------------------------------------
  resize() {
    // Measured off the window, never off the canvas: the canvas's own box is
    // downstream of the size we are about to give it.
    const W = Math.max(1, window.innerWidth);
    const H = Math.max(1, window.innerHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    this.W = W; this.H = H; this.dpr = dpr;
    for (const c of [this.canvas, this.page, this.stains]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const wide = ARENA.maxX - ARENA.minX + 1.2;      // + wall thickness
    const deep = ARENA.maxZ - ARENA.minZ + HEAD_ROOM;
    const availW = W - INSET_SIDE * 2;
    const availH = H - INSET_TOP - INSET_BOTTOM;
    this.S = Math.max(6, Math.min(availW / wide, availH / deep));

    const S = this.S;
    this.ox = W / 2;
    this.oy = INSET_TOP + (availH - (ARENA.maxZ - ARENA.minZ) * S) / 2
      - ARENA.minZ * S;

    this.drawPage();
    this.restain();
  }

  sx(x) { return this.ox + x * this.S; }
  sy(z) { return this.oy + z * this.S; }

  // ---- the page: everything that never moves ------------------------------
  drawPage() {
    const c = this.page.getContext('2d');
    const { S, W, H } = this;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, W, H);

    // graph paper
    c.fillStyle = PAPER.page;
    c.fillRect(0, 0, W, H);
    grid(c, 0, 0, W, H, S / 2, PAPER.grid, 1);
    grid(c, 0, 0, W, H, S * 2.5, PAPER.gridBold, 1);

    // a wash in the corners, so the page looks handled
    const vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32,
      W / 2, H / 2, Math.max(W, H) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(74,54,32,0.24)');
    c.fillStyle = vg;
    c.fillRect(0, 0, W, H);

    this.drawMargin(c);

    const x0 = this.sx(ARENA.minX), x1 = this.sx(ARENA.maxX);
    const z0 = this.sy(ARENA.minZ), z1 = this.sy(ARENA.maxZ);

    // ---- floor ----
    c.fillStyle = PAPER.floor;
    c.fillRect(x0, z0, x1 - x0, z1 - z0);
    grid(c, x0, z0, x1 - x0, z1 - z0, S, PAPER.floorGrid, 1, x0, z0);

    // ---- the hole ----
    this.drawPit(c);

    // ---- the shelf: out of jump reach, and the whole reason you climb ----
    const ledge = STATIC_BOXES.find((b) => b.kind === 'ledge');
    this.drawSlab(c, ledge, PAPER.ledge, `+${LEDGE_TOP.toFixed(2)}`);

    // ---- the closet ----
    for (const b of STATIC_BOXES) if (b.kind === 'room') this.drawWall(c, b);

    // ---- the tank rim ----
    c.strokeStyle = PAPER.ink;
    c.lineWidth = 3;
    c.strokeRect(x0, z0, x1 - x0, z1 - z0);
    c.lineWidth = 1;
    c.strokeStyle = PAPER.inkFaint;
    c.strokeRect(x0 - 5, z0 - 5, x1 - x0 + 10, z1 - z0 + 10);

    this.drawRuler(c, x0, x1, z0, z1);
    this.drawCompass(c, x0 + 20, z1 - 34);
  }

  drawPit(c) {
    const { S } = this;
    const x = this.sx(PIT.x0), y = this.sy(PIT.z0);
    const w = (PIT.x1 - PIT.x0) * S, h = (PIT.z1 - PIT.z0) * S;

    // A hole is drawn as a hole: dark, with the rim stepping down into it.
    c.fillStyle = PAPER.pitRim;
    c.fillRect(x, y, w, h);
    const inset = Math.min(w, h) * 0.09;
    c.fillStyle = PAPER.pit;
    c.fillRect(x + inset, y + inset, w - inset * 2, h - inset * 2);

    c.strokeStyle = PAPER.ink;
    c.lineWidth = 2;
    c.strokeRect(x, y, w, h);

    // rim ticks, pointing in — the convention for "this goes down"
    c.strokeStyle = 'rgba(36,29,28,0.45)';
    c.lineWidth = 1;
    c.beginPath();
    const step = Math.max(7, S * 0.34);
    for (let i = x + step / 2; i < x + w; i += step) {
      c.moveTo(i, y); c.lineTo(i, y + inset);
      c.moveTo(i, y + h); c.lineTo(i, y + h - inset);
    }
    for (let j = y + step / 2; j < y + h; j += step) {
      c.moveTo(x, j); c.lineTo(x + inset, j);
      c.moveTo(x + w, j); c.lineTo(x + w - inset, j);
    }
    c.stroke();

    label(c, 'NO FLOOR', x + w / 2, y + h / 2 + 3, 'rgba(239,231,216,0.62)', 8, 'center');
  }

  /** A raised platform: same plan, lighter, contoured, with a shadow south. */
  drawSlab(c, b, fill, note) {
    const x = this.sx(b.x0), y = this.sy(b.z0);
    const w = (b.x1 - b.x0) * this.S, h = (b.z1 - b.z0) * this.S;

    c.fillStyle = PAPER.shadow;
    c.globalAlpha = 0.5;
    c.fillRect(x + 4, y + 5, w, h);
    c.globalAlpha = 1;

    c.fillStyle = fill;
    c.fillRect(x, y, w, h);
    c.strokeStyle = PAPER.ink;
    c.lineWidth = 2;
    c.strokeRect(x, y, w, h);
    c.strokeStyle = PAPER.inkFaint;
    c.lineWidth = 1;
    c.strokeRect(x + 4, y + 4, w - 8, h - 8);

    // Spot height in the corner, out of the way of whatever plates sit on it.
    if (note) label(c, note, x + 8, y + 15, PAPER.inkSoft, 9, 'left');
  }

  /** A wall, in plan: a hatched bar. Never lifted — that would hide the room. */
  drawWall(c, b) {
    const x = this.sx(b.x0), y = this.sy(b.z0);
    const w = (b.x1 - b.x0) * this.S, h = (b.z1 - b.z0) * this.S;
    c.fillStyle = PAPER.room;
    c.fillRect(x, y, w, h);
    hatch(c, x, y, w, h, 5, 'rgba(36,29,28,0.30)', 1);
    c.strokeStyle = PAPER.ink;
    c.lineWidth = 1.6;
    c.strokeRect(x, y, w, h);
  }

  drawRuler(c, x0, x1, z0, z1) {
    const S = this.S;
    c.strokeStyle = PAPER.inkFaint;
    c.lineWidth = 1;
    c.beginPath();
    for (let m = Math.ceil(ARENA.minX); m <= ARENA.maxX; m++) {
      const x = this.sx(m);
      const big = m % 5 === 0;
      c.moveTo(x, z1 + 6); c.lineTo(x, z1 + (big ? 13 : 9));
    }
    for (let m = Math.ceil(ARENA.minZ); m <= ARENA.maxZ; m++) {
      const y = this.sy(m);
      const big = m % 5 === 0;
      c.moveTo(x0 - 6, y); c.lineTo(x0 - (big ? 13 : 9), y);
    }
    c.stroke();

    // scale bar: five metres, halved, the way a real one is
    const bx = x1 - S * 5, by = z1 + 22;
    c.fillStyle = PAPER.ink;
    for (let i = 0; i < 5; i++) {
      if (i % 2 === 0) c.fillRect(bx + i * S, by, S, 4);
    }
    c.strokeStyle = PAPER.ink;
    c.lineWidth = 1;
    c.strokeRect(bx, by, S * 5, 4);
    label(c, '0', bx, by + 14, PAPER.inkSoft, 8, 'center');
    label(c, '5 m', bx + S * 5, by + 14, PAPER.inkSoft, 8, 'center');

    // Kept short: the scale bar starts five metres in from the right edge.
    label(c, 'FIG. 1 · ENCLOSURE 7', x0, by + 13, PAPER.inkSoft, 8.5, 'left');
    label(c, 'PLAN VIEW · SHEET 1 OF 1', x0, by + 25, PAPER.inkFaint, 7.5, 'left');
  }

  drawCompass(c, x, y) {
    c.strokeStyle = PAPER.inkSoft;
    c.fillStyle = PAPER.inkSoft;
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x, y + 13); c.lineTo(x, y - 9);
    c.stroke();
    c.beginPath();
    c.moveTo(x, y - 13); c.lineTo(x - 3.4, y - 6); c.lineTo(x + 3.4, y - 6);
    c.closePath();
    c.fill();
    label(c, 'N', x, y + 23, PAPER.inkSoft, 8, 'center');
  }

  /**
   * Marginalia. The page is a sheet out of somebody's observation notebook, and
   * it all lives down the sides and under the tank, where the HUD is not.
   */
  drawMargin(c) {
    const { W, H } = this;
    const hair = 'rgba(36,29,28,0.16)';

    c.save();
    c.translate(11, H / 2);
    c.rotate(-Math.PI / 2);
    label(c, 'SPECIMEN: LUMP (COMMON) · SUBJECT IS ITS OWN CONTROL',
      0, 0, hair, 8, 'center');
    c.restore();

    c.save();
    c.translate(W - 11, H / 2);
    c.rotate(Math.PI / 2);
    label(c, `POPULATION CAP 60 · ${TOTAL_ROUNDS} OBSERVATIONS · SURPLUS INCINERATED`,
      0, 0, hair, 8, 'center');
    c.restore();
  }

  // ---- stains: the page keeps every death --------------------------------
  addScar(x, z) {
    // One per death, and a match cannot produce more than about 140 of those.
    // Dropping the oldest only affects what a resize rebuilds — the ink itself
    // is already on the layer, which is rather the point.
    if (this.scars.length > 240) this.scars.shift();
    const s = { x, z, r: 0.28 + Math.random() * 0.2, seed: Math.random() * 9 };
    this.scars.push(s);
    this.stamp(this.stains.getContext('2d'), s);
  }

  restain() {
    const c = this.stains.getContext('2d');
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.W, this.H);
    for (const s of this.scars) this.stamp(c, s);
  }

  /** A blot. Irregular, low contrast, and it never comes off. */
  stamp(c, s) {
    const S = this.S;
    const x = this.sx(s.x), y = this.sy(s.z);
    c.globalAlpha = 0.22;
    c.fillStyle = PAPER.red;
    c.beginPath();
    const N = 11;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU;
      const r = s.r * S * (0.7 + Math.sin(a * 3 + s.seed) * 0.28 + Math.sin(a * 5 - s.seed) * 0.14);
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.7;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
    c.globalAlpha = 0.14;
    for (let i = 0; i < 4; i++) {
      const a = s.seed + i * 1.7;
      c.beginPath();
      c.arc(x + Math.cos(a) * s.r * S * 1.5, y + Math.sin(a) * s.r * S * 1.1,
        s.r * S * 0.16, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  addSlash(fromX, fromZ, toX, toZ) {
    this.slashes.push({ x0: fromX, z0: fromZ, x1: toX, z1: toZ, t: 1 });
    this.shake = 1;
  }

  // ---- frame --------------------------------------------------------------
  draw(room, now, clock) {
    const c = this.ctx;
    const S = this.S;
    let dt = (now - this.lastNow) / 1000;
    this.lastNow = now;
    if (!(dt > 0) || dt > 0.2) dt = 1 / 60;
    const t = now / 1000;

    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 6);

    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.shake > 0) {
      const k = this.shake * this.shake * 3.5;
      c.translate(Math.sin(now * 0.09) * k, Math.cos(now * 0.13) * k);
    }

    c.drawImage(this.page, 0, 0, this.W, this.H);
    c.drawImage(this.stains, 0, 0, this.W, this.H);

    this.drawDoor(c, room);
    this.drawPlates(c, room, t);

    // ---- collect, sort, draw -----------------------------------------------
    const boxes = room.doorOpen ? BOXES_DOOR_OPEN : BOXES_DOOR_CLOSED;
    const draws = this.draws;
    draws.length = 0;
    let n = 0;

    const total = room.ghosts.length;
    for (let i = 0; i < total; i++) {
      const g = room.ghosts[i];
      if (now < g.revealAt) continue;
      const s = g.cur;
      const e = this.slot(n++);
      e.x = s.x; e.y = s.y; e.z = s.z;
      e.pose = poseOf(s, dt, t, g.mem);

      // Older exposures sit further back on the page, but never so far that a
      // specimen you have to climb becomes hard to find.
      let alpha = Math.max(0.62, 0.96 - (total - 1 - i) * 0.011);
      // Corpses stay on the page — they are the record — but they step back so
      // the specimens still doing something read on top of them.
      if (e.pose.dead) alpha *= 0.75;
      let scale = 1;
      // A fresh one develops in: it arrives oversized and settles.
      const since = (now - g.revealAt) / 340;
      if (since < 1) {
        scale = 1 + (1 - since) * (1 - since) * 0.5;
        alpha *= 0.35 + since * 0.65;
      }
      e.style = this.styleFor(g.gen, alpha, scale, false);
      e.ring = 0;
      e.target = room.target === g;
      draws.push(e);
    }

    if (room.phase !== PHASE.RESULTS) {
      const p = room.player;
      const e = this.slot(n++);
      e.x = p.x; e.y = p.y; e.z = p.z;
      e.pose = poseOf(p, dt, t, this.liveMem);
      e.style = this.styleFor(room.round, 1, 1.06, true);
      e.ring = 1;
      e.target = false;
      draws.push(e);
    }

    draws.sort(byDepth);
    this.caret.on = false;
    for (const e of draws) this.drawSpecimen(c, e, boxes, t);

    // Which one is you, in a tank of sixty. A caret, because on this page
    // everything is annotated — and on top of everything, because in a crowd
    // this is the only thing keeping you findable.
    if (this.caret.on) {
      const bob = Math.sin(t * 3.4) * 2;
      const x = this.caret.x;
      const top = this.caret.y - S * 1.05 - bob;

      // A tag on the page, not a mark on the specimen: a caret with a paper
      // flag behind it, so it survives being drawn over sixty black outlines.
      c.fillStyle = PAPER.ink;
      c.beginPath();
      c.moveTo(x, top + 9);
      c.lineTo(x - 5, top);
      c.lineTo(x + 5, top);
      c.closePath();
      c.fill();

      c.save();
      c.font = `700 7px ${FACE}`;
      if ('letterSpacing' in c) c.letterSpacing = '1.12px';
      const w = c.measureText('SUBJECT').width + 10;
      c.fillStyle = PAPER.floor;
      c.strokeStyle = PAPER.ink;
      c.lineWidth = 1;
      c.beginPath();
      c.rect(x - w / 2, top - 11, w, 11);
      c.fill();
      c.stroke();
      c.fillStyle = PAPER.ink;
      c.textAlign = 'center';
      c.fillText('SUBJECT', x, top - 3);
      c.restore();
    }

    // ---- effects -----------------------------------------------------------
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const s = this.slashes[i];
      s.t -= dt * 3.6;
      if (s.t <= 0) { this.slashes.splice(i, 1); continue; }
      c.globalAlpha = s.t;
      c.strokeStyle = PAPER.red;
      c.lineWidth = 2 + s.t * 4;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(this.sx(s.x0), this.sy(s.z0));
      c.lineTo(this.sx(s.x1), this.sy(s.z1));
      c.stroke();
      c.globalAlpha = 1;
    }

    void S; void clock;
  }

  /** Wipe the page between matches. The stains are the only thing that carries. */
  reset() {
    this.scars.length = 0;
    this.slashes.length = 0;
    this.shake = 0;
    this.liveMem = makeMem(1.7);
    this.restain();
  }

  slot(i) {
    let e = this.pool[i];
    if (!e) { e = { x: 0, y: 0, z: 0, pose: null, style: null, ring: 0, target: false }; this.pool[i] = e; }
    return e;
  }

  drawSpecimen(c, e, boxes, t) {
    const S = this.S;
    const gy = surfaceBelow(boxes, e.x, e.z, e.y + 0.02);
    const overNothing = gy === -Infinity;
    const base = overNothing ? 0 : gy;

    const px = this.sx(e.x);
    const foot = this.sy(e.z);
    const py = foot - (e.y - base) * S * LIFT;

    // Below the floor and over the hole: it is inside the hole, so it is only
    // visible through the hole.
    const clipped = overNothing && e.y < -0.05;
    if (clipped) {
      c.save();
      c.beginPath();
      c.rect(this.sx(PIT.x0), this.sy(PIT.z0),
        (PIT.x1 - PIT.x0) * S, (PIT.z1 - PIT.z0) * S);
      c.clip();
    }

    // The living specimen is the one under observation, and is ringed as such.
    if (e.ring && !e.pose.dead) {
      c.save();
      c.globalAlpha = 0.7;
      c.strokeStyle = PAPER.ink;
      c.lineWidth = 1.2;
      c.setLineDash([4, 4]);
      c.lineDashOffset = -t * 14;
      c.beginPath();
      c.ellipse(px, foot, S * 0.62, S * 0.40, 0, 0, TAU);
      c.stroke();
      c.restore();
    }

    // A knifed self gets chalked, because this is a laboratory.
    if (e.pose.dead) {
      c.save();
      c.globalAlpha = 0.5;
      c.strokeStyle = PAPER.inkSoft;
      c.lineWidth = 1.4;
      c.setLineDash([3, 5]);
      c.beginPath();
      c.ellipse(px, foot, S * 0.55, S * 0.38, 0, 0, TAU);
      c.stroke();
      c.restore();
    }

    if (e.target) {
      c.save();
      c.strokeStyle = PAPER.red;
      c.lineWidth = 2;
      c.globalAlpha = 0.55 + Math.sin(t * 14) * 0.3;
      c.beginPath();
      c.ellipse(px, foot, S * 0.58, S * 0.38, 0, 0, TAU);
      c.stroke();
      c.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = i * (Math.PI / 2) + Math.PI / 4;
        c.moveTo(px + Math.cos(a) * S * 0.66, foot + Math.sin(a) * S * 0.44);
        c.lineTo(px + Math.cos(a) * S * 0.86, foot + Math.sin(a) * S * 0.58);
      }
      c.stroke();
      c.restore();
    }

    drawLump(c, px, py, overNothing ? null : foot, S, e.pose, e.style);

    // Where to put the caret, if this is you. It cannot go on now — anything
    // further south is drawn after this and would paint straight over it.
    if (e.ring) { this.caret.x = px; this.caret.y = py; this.caret.on = true; }

    if (clipped) c.restore();
  }

  drawDoor(c, room) {
    const S = this.S;
    const b = DOOR_BOX;
    const x = this.sx(b.x0), y = this.sy(b.z0);
    const w = (b.x1 - b.x0) * S, h = (b.z1 - b.z0) * S;
    const open = room.doorSlide;

    c.save();
    c.globalAlpha = 1 - open * 0.88;
    c.fillStyle = '#a8916c';
    c.fillRect(x, y, w, h);
    hatch(c, x, y, w, h, 4, 'rgba(36,29,28,0.42)', 1);
    c.restore();

    c.save();
    c.strokeStyle = open > 0.5 ? PAPER.inkFaint : PAPER.ink;
    c.lineWidth = 1.6;
    c.setLineDash(open > 0.5 ? [4, 4] : []);
    c.strokeRect(x, y, w, h);
    c.restore();
  }

  drawPlates(c, room, t) {
    const S = this.S;
    const R = PLATE_RADIUS * S;
    const req = new Set(room.required);

    for (let i = 0; i < PLATES.length; i++) {
      const p = PLATES[i];
      const x = this.sx(p.x), y = this.sy(p.z);
      const st = room.plates[i];
      const needed = req.has(i);
      const turn = room.turnstiles.has(i);
      const tint = turn ? PAPER.blue : PAPER.red;

      if (!needed) {
        // Every plate exists in every round; the unlit ones stay on the plan so
        // you can learn the room before it asks you for them.
        c.strokeStyle = PAPER.inkHair;
        c.lineWidth = 1;
        ellipse(c, x, y, R * 0.94, R * 0.94, false);
        continue;
      }

      if (st.pressed) {
        const pulse = 1 + Math.sin(t * 9 + i) * 0.03;
        c.globalAlpha = 0.30;
        c.fillStyle = PAPER.amber;
        ellipse(c, x, y, R * pulse, R * pulse, true);
        c.globalAlpha = 1;
        c.strokeStyle = PAPER.amber;
        c.lineWidth = 2.4;
        ellipse(c, x, y, R * pulse, R * pulse, false);
        // radiating ticks: it is bearing weight
        c.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = k * (TAU / 8) + t * (turn ? 1.6 : 0.3);
          c.moveTo(x + Math.cos(a) * R * 1.08, y + Math.sin(a) * R * 1.08);
          c.lineTo(x + Math.cos(a) * R * 1.30, y + Math.sin(a) * R * 1.30);
        }
        c.lineWidth = 1.6;
        c.stroke();
      } else {
        c.strokeStyle = tint;
        c.lineWidth = 2;
        c.setLineDash(turn ? [5, 4] : []);
        ellipse(c, x, y, R, R, false);
        c.setLineDash([]);
        c.strokeStyle = turn ? PAPER.blueSoft : PAPER.redSoft;
        c.lineWidth = 1;
        ellipse(c, x, y, R * 0.84, R * 0.84, false);
      }

      if (turn) {
        // Arrowheads pointing in: this one wants arrivals, not residents.
        c.strokeStyle = st.pressed ? PAPER.amber : PAPER.blue;
        c.lineWidth = 1.6;
        c.beginPath();
        for (let k = 0; k < 4; k++) {
          const a = k * (TAU / 4) + Math.PI / 4 + t * 0.8;
          const ax = x + Math.cos(a) * R * 0.62, ay = y + Math.sin(a) * R * 0.62;
          c.moveTo(ax + Math.cos(a + 2.5) * R * 0.22, ay + Math.sin(a + 2.5) * R * 0.22);
          c.lineTo(ax, ay);
          c.lineTo(ax + Math.cos(a - 2.5) * R * 0.22, ay + Math.sin(a - 2.5) * R * 0.22);
        }
        c.stroke();
      }

      label(c, p.name, x, y + R + 11, st.pressed ? PAPER.ink : PAPER.inkSoft, 7.5, 'center');
    }
  }

  // ---- specimen pigments ---------------------------------------------------
  /**
   * One style object per generation, kept and mutated rather than rebuilt:
   * a generation appears at most once per frame, so there is nothing to alias.
   * The living specimen gets its own, because during settling it shares a
   * generation number with the ghost it has just become.
   */
  styleFor(gen, alpha, scale, living) {
    const cache = living ? this.liveStyles || (this.liveStyles = new Map()) : this.styles;
    let s = cache.get(gen);
    if (!s) {
      const base = pigmentFor(gen);
      s = {
        fill: base,
        fillDark: mix(base, PAPER.ink, 0.30),
        hat: mix(hatFor(gen), '#ffffff', 0.12),
        sclera: '#fbf6e8',
        ink: PAPER.ink,
        shadow: PAPER.shadow,
        gen,
        alpha: 1,
        scale: 1,
        lineWidth: 1,
      };
      cache.set(gen, s);
    }
    s.alpha = alpha;
    s.scale = scale * DRAW_SCALE;
    s.lineWidth = Math.max(0.8, this.S * s.scale * (living ? 0.040 : 0.032));
    return s;
  }
}

// ------------------------------------------------------------------ helpers --
function byDepth(a, b) { return (a.z - b.z) || (a.y - b.y); }

function grid(c, x, y, w, h, step, colour, lw, phaseX, phaseY) {
  if (step < 4) return;
  c.strokeStyle = colour;
  c.lineWidth = lw;
  c.beginPath();
  const px = phaseX === undefined ? 0 : phaseX;
  const py = phaseY === undefined ? 0 : phaseY;
  for (let i = px % step; i < x + w; i += step) {
    if (i < x) continue;
    c.moveTo(i, y); c.lineTo(i, y + h);
  }
  for (let j = py % step; j < y + h; j += step) {
    if (j < y) continue;
    c.moveTo(x, j); c.lineTo(x + w, j);
  }
  c.stroke();
}

function hatch(c, x, y, w, h, step, colour, lw) {
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  c.strokeStyle = colour;
  c.lineWidth = lw;
  c.beginPath();
  for (let i = -h; i < w + h; i += step) {
    c.moveTo(x + i, y);
    c.lineTo(x + i - h, y + h);
  }
  c.stroke();
  c.restore();
}

function ellipse(c, x, y, rx, ry, fill) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, TAU);
  if (fill) c.fill(); else c.stroke();
}

function label(c, text, x, y, colour, size, align) {
  c.save();
  c.font = `700 ${size}px ${FACE}`;
  c.fillStyle = colour;
  c.textAlign = align || 'left';
  if ('letterSpacing' in c) c.letterSpacing = `${(size * 0.16).toFixed(2)}px`;
  c.fillText(text, x, y);
  c.restore();
}

