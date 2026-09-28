// Kyūdō at the dōjō as pure rules: four arrows at a target across the range. Hold to draw; at full
// draw the aim drifts, a little more the longer you hold (the arms tire), and you steer it with the
// arrows. Let go to loose: the arrow lands where you aimed plus the wind's push, which you read from
// the streamer by the target and must aim off for. Positions are in target radii (the face is 1).
// Letting go before full draw drops the arrow short into the sand.
export const ARROWS = 4;
export const DRAW_TIME = 0.9;         // s to full draw
export const TIRE = 4;                // s at full draw before the arms give and the arrow goes anyway
export const FLIGHT = 0.55;           // s the arrow is in the air
export const STEER = 0.9;             // radii/s the arrows move the aim
// Scoring rings, from the middle out: [outer radius, points].
export const RINGS = [[0.14, 10], [0.32, 7], [0.52, 5], [0.76, 3], [1, 1]];

export const scoreAt = (x, y) => (RINGS.find(([r]) => Math.hypot(x, y) <= r) || [0, 0])[1];

export class Kyudo {
  /** `steady` 0..1 calms the sway (Swordsmanship); `rng` sets the wind and where each draw starts. */
  constructor(rng, { steady = 0 } = {}) {
    this.rng = rng;
    this.sway = 0.34 * (1 - Math.min(0.6, steady));
    this.shots = [];                  // { x, y, score }
    this.t = 0;
    this.nock();
  }

  /** Ready the next arrow: a fresh wind, the aim somewhere off the middle. */
  nock() {
    const r = this.rng;
    this.phase = 'ready';             // ready | draw | full | flight | done
    this.pull = 0;
    this.hold = 0;
    this.wind = { x: (r.next() - 0.5) * 0.7, y: (r.next() - 0.5) * 0.12 };
    const a = r.next() * Math.PI * 2, d = 0.3 + r.next() * 0.3;
    this.aim = { x: Math.cos(a) * d, y: Math.sin(a) * d };
    this.arrow = null;
  }

  get done() { return this.phase === 'done'; }
  get total() { return this.shots.reduce((a, s) => a + s.score, 0); }
  get hits() { return this.shots.filter((s) => s.score > 0).length; }
  /** 0 splendid, 1 good, 2 poor. */
  get grade() { return this.total >= 28 ? 0 : this.total >= 14 ? 1 : 2; }

  /**
   * Advance by dt. `input`: { down (Use held), dx, dy (-1..1 steering) }. Returns 'loose', 'land',
   * 'short', 'over' or null.
   */
  step(dt, { down, dx = 0, dy = 0 }) {
    this.t += dt;
    switch (this.phase) {
      case 'ready':
        if (down) this.phase = 'draw';
        return null;
      case 'draw':
        if (!down) return this.release(true);
        this.pull = Math.min(1, this.pull + dt / DRAW_TIME);
        if (this.pull >= 1) this.phase = 'full';
        return null;
      case 'full': {
        this.hold += dt;
        // The drift: two slow waves and a tremor that grows as the arms tire.
        const amp = this.sway * (1 + this.hold * 0.6), t = this.t;
        this.aim.x += (Math.sin(t * 1.3) * 0.6 + Math.sin(t * 3.1 + 1) * 0.4) * amp * dt + dx * STEER * dt;
        this.aim.y += (Math.cos(t * 1.1) * 0.6 + Math.sin(t * 2.7) * 0.4) * amp * dt + dy * STEER * dt;
        if (!down || this.hold >= TIRE) return this.release(false);
        return null;
      }
      case 'flight': {
        const a = this.arrow;
        a.t += dt;
        if (a.t < FLIGHT) return null;
        this.shots.push({ x: a.x, y: a.y, score: a.score });
        if (this.shots.length >= ARROWS) { this.phase = 'done'; return 'over'; }
        this.nock();
        return a.short ? 'short' : 'land';
      }
      default: return null;
    }
  }

  release(early) {
    const x = early ? this.aim.x : this.aim.x + this.wind.x, y = early ? 1.6 : this.aim.y + this.wind.y;
    this.arrow = { x, y, t: 0, short: early, score: early ? 0 : scoreAt(x, y) };
    this.phase = 'flight';
    return 'loose';
  }
}
