// Kingyo-sukui, the goldfish tub at the fireworks night, as pure rules. Steer the paper scoop (poi)
// over the tub; hold Use to dip it and let go to lift, and every fish over the paper comes up into
// your bowl. The paper weakens every moment it is wet, faster when dragged, and a little for every
// fish it lifts (a fat black demekin most of all). Dip right beside a fish and it darts away. When
// the paper tears the game is over; lifting too much at once tears it on the way up.
export const TUB = { w: 150, h: 68 };      // the water, in px (drawn at twice size)
export const POI_R = 10;                   // the paper's radius
export const SPEED = { dry: 90, wet: 36 }; // px/s the poi moves above and in the water
export const WET = 0.035;                  // paper lost per wet second
export const DRAG = 0.0014;                // ... and per px dragged underwater
export const LIMIT = 45;                   // s before the stall-keeper calls time
export const KINDS = {
  wakin: { weight: 0.1, speed: 19, n: 6 },       // the common red goldfish
  kohaku: { weight: 0.12, speed: 17, n: 3 },     // red and white
  demekin: { weight: 0.25, speed: 12, n: 2 },    // the black pop-eyed one
};
const STARTLE = 16;                        // px: dipping this close makes a fish dart

export class Kingyo {
  constructor(rng) {
    this.rng = rng;
    this.fish = [];
    for (const [kind, k] of Object.entries(KINDS)) for (let i = 0; i < k.n; i++) this.fish.push(this.newFish(kind));
    this.poi = { x: TUB.w / 2, y: TUB.h / 2, wet: false };
    this.paper = 1;
    this.caught = [];
    this.t = 0;
    this.torn = false;
  }

  newFish(kind) {
    const r = this.rng, a = r.next() * Math.PI * 2;
    return { kind, x: 10 + r.next() * (TUB.w - 20), y: 10 + r.next() * (TUB.h - 20), a, turn: r.next() * 2, dart: 0 };
  }

  get done() { return this.torn || this.t >= LIMIT || !this.fish.length; }
  /** 0 splendid (5+), 1 good (2+), 2 poor. */
  get grade() { const n = this.caught.length; return n >= 5 ? 0 : n >= 2 ? 1 : 2; }

  /** Advance by dt. `input`: { dx, dy (-1..1), dip (Use held) }. Returns 'dip', 'lift', 'tear' or null. */
  step(dt, { dx = 0, dy = 0, dip = false }) {
    if (this.done) return null;
    this.t += dt;
    const p = this.poi;
    let ev = null;
    // Moving the poi: slow through the water, and every wet pixel costs paper.
    const sp = p.wet ? SPEED.wet : SPEED.dry, len = Math.hypot(dx, dy) || 1;
    const mx = (dx / len) * sp * dt * Math.min(1, Math.hypot(dx, dy)), my = (dy / len) * sp * dt * Math.min(1, Math.hypot(dx, dy));
    p.x = Math.max(POI_R, Math.min(TUB.w - POI_R, p.x + mx));
    p.y = Math.max(POI_R, Math.min(TUB.h - POI_R, p.y + my));
    if (p.wet) this.paper -= WET * dt + DRAG * Math.hypot(mx, my);
    if (dip && !p.wet) {
      p.wet = true;
      ev = 'dip';
      for (const f of this.fish) if (Math.hypot(f.x - p.x, f.y - p.y) < STARTLE) { f.a = Math.atan2(f.y - p.y, f.x - p.x); f.dart = 0.5; }
    } else if (!dip && p.wet) {
      p.wet = false;
      ev = this.lift();
    }
    if (this.paper <= 0 && !this.torn) { this.torn = true; this.paper = 0; ev = 'tear'; }
    for (const f of this.fish) this.swim(f, dt);
    return ev;
  }

  /** Lift the poi: the fish over it come up, lightest first, while the paper holds. */
  lift() {
    const p = this.poi;
    const over = this.fish.filter((f) => Math.hypot(f.x - p.x, f.y - p.y) <= POI_R * 0.85).sort((a, b) => KINDS[a.kind].weight - KINDS[b.kind].weight);
    for (const f of over) {
      this.paper -= KINDS[f.kind].weight;
      if (this.paper <= 0) return 'tear';      // it tears under this one, which drops back
      this.caught.push(f.kind);
      this.fish.splice(this.fish.indexOf(f), 1);
    }
    return 'lift';
  }

  /** A fish wanders, turning now and then, darting when startled, and turning back from the rim. */
  swim(f, dt) {
    const k = KINDS[f.kind], r = this.rng;
    f.turn -= dt;
    if (f.turn <= 0) { f.a += (r.next() - 0.5) * 2.2; f.turn = 0.8 + r.next() * 2; }
    const sp = k.speed * (f.dart > 0 ? 3 : 1);
    f.dart = Math.max(0, f.dart - dt);
    f.x += Math.cos(f.a) * sp * dt;
    f.y += Math.sin(f.a) * sp * dt;
    if (f.x < 6 || f.x > TUB.w - 6) { f.a = Math.PI - f.a; f.x = Math.max(6, Math.min(TUB.w - 6, f.x)); }
    if (f.y < 6 || f.y > TUB.h - 6) { f.a = -f.a; f.y = Math.max(6, Math.min(TUB.h - 6, f.y)); }
  }
}
