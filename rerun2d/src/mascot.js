// THE LUMPS — the specimen strip on the title card.
//
// Three live Lumps, twenty generations apart, scuttling on the spot. It is the
// only honest way to explain the escalation: by observation eighteen you are
// looking at a ten-legged thing in a hat, and no sentence conveys that as fast
// as the thing does.

import { PAPER, pigmentFor, hatFor, mix } from './constants.js';
import { poseOf, makeMem, drawLump } from './creature.js';

const GENS = [1, 9, 18];

export class Mascots {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.last = performance.now();
    this.t = 0;
    this.subjects = GENS.map((gen, i) => ({
      gen,
      mem: makeMem(gen * 2.39),
      // A standing scuttle: distance climbs, so the legs walk, but nothing
      // moves. It is a treadmill and they have not noticed.
      s: { vx: 0, vz: 0, vy: 0, grounded: true, dead: false, dist: 0 },
      phase: i * 1.9,
      style: {
        fill: pigmentFor(gen),
        fillDark: mix(pigmentFor(gen), PAPER.ink, 0.30),
        hat: hatFor(gen),
        sclera: '#fbf6e8',
        ink: PAPER.ink,
        shadow: PAPER.shadow,
        gen,
        alpha: 1,
        scale: 1,
        lineWidth: 1.4,
      },
    }));
    this.resize();
  }

  resize() {
    const c = this.canvas;
    const W = c.clientWidth || 300;
    const H = c.clientHeight || 96;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = W; this.H = H; this.dpr = dpr;
  }

  frame(now) {
    // The card is hidden while playing, so its box is only measurable when it
    // is actually on screen. Catch up here rather than on the resize event.
    if (this.canvas.clientWidth && this.canvas.clientWidth !== this.W) this.resize();

    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!(dt > 0) || dt > 0.2) dt = 1 / 60;
    this.t += dt;

    const c = this.ctx;
    const { W, H } = this;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, W, H);

    // Sized so the antenna clears the top of the strip at the peak of a hop and
    // the legs stay off the caption at the bottom of one.
    const S = Math.min(H * 0.38, W / 5.6);
    const ground = H * 0.66;

    for (let i = 0; i < this.subjects.length; i++) {
      const sub = this.subjects[i];
      const x = W * (i + 0.5) / this.subjects.length;

      // Turn on the spot and pretend to walk, with a hop every few seconds.
      const swing = Math.sin(this.t * 0.7 + sub.phase);
      sub.s.vx = Math.cos(this.t * 0.5 + sub.phase) * 2.4;
      sub.s.vz = swing * 1.4;
      sub.s.dist += Math.abs(swing) * dt * 2.6;

      const hopT = (this.t * 0.62 + sub.phase) % 3;
      const hop = hopT < 0.5 ? Math.sin((hopT / 0.5) * Math.PI) : 0;
      sub.s.grounded = hop <= 0.001;
      sub.s.vy = hop > 0 ? Math.cos((hopT / 0.5) * Math.PI) * 6 : 0;

      const pose = poseOf(sub.s, dt, this.t, sub.mem);
      sub.style.scale = 1;
      sub.style.lineWidth = Math.max(1, S * 0.032);
      drawLump(c, x, ground - hop * S * 0.42, ground, S, pose, sub.style);

      label(c, `GENERATION ${sub.gen}`, x, H - 3, PAPER.inkFaint, 7);
    }
  }
}

function label(c, text, x, y, colour, size) {
  c.save();
  c.font = `700 ${size}px "Helvetica Neue", "Arial Narrow", Inter, system-ui, sans-serif`;
  c.fillStyle = colour;
  c.textAlign = 'center';
  if ('letterSpacing' in c) c.letterSpacing = `${(size * 0.18).toFixed(2)}px`;
  c.fillText(text, x, y);
  c.restore();
}
