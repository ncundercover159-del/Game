// Fishing rules: which water a tile is, what bites there and when, how long a bite takes, and the
// reel minigame's physics (a pure simulation stepped by the UI and by tests).
import { FISH, JUNK, isFullMoon } from '../data/fish.js';

/** The kind of water at a tile: a map's `waters` regions first, then its default. */
export function waterKind(map, x, y) {
  if (!map.inside(x, y) || !map.isWater(x, y)) return null;
  for (const w of map.def.waters || []) {
    const [x0, y0, x1, y1] = w.rect;
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return w.kind;
  }
  return map.def.waterKind || 'river';
}

/** Fish that could bite: season, place, hours (wrapping past midnight), weather, moon. */
export function fishFor(where, { season, minutes, weather, cal, caught = {} }) {
  const places = where === 'falls' ? ['falls', 'pool'] : [where];
  return Object.keys(FISH).filter((id) => {
    const f = FISH[id];
    if (!f.seasons.includes(season) || !f.where.some((w) => places.includes(w))) return false;
    const [a, b] = f.hours;
    if (!(minutes >= a && minutes < b) && !(minutes + 1440 >= a && minutes + 1440 < b)) return false;
    if (f.weather === 'rain' && !['rain', 'storm', 'tsuyu', 'typhoon'].includes(weather)) return false;
    if (f.weather === 'clear' && weather !== 'clear') return false;
    if (f.fullMoon && !isFullMoon(cal)) return false;
    if (f.legendary && caught[id]) return false;
    return true;
  });
}

/** Roll what takes the hook: a fish weighted toward the easy ones, or now and then junk. */
export function rollCatch(rng, ids, level) {
  if (!ids.length || rng.next() < Math.max(0.03, 0.12 - level * 0.01)) {
    const junk = Object.keys(JUNK);
    return junk[Math.floor(rng.next() * junk.length)];
  }
  const legend = ids.find((id) => FISH[id].legendary);
  if (legend && rng.next() < 0.25) return legend;
  const pool = ids.filter((id) => !FISH[id].legendary);
  if (!pool.length) return legend;
  const w = pool.map((id) => 10 / FISH[id].diff);
  let r = rng.next() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) if ((r -= w[i]) < 0) return pool[i];
  return pool[pool.length - 1];
}

/** Seconds until a bite, shorter with skill. */
export const biteDelay = (rng, level) => 1.4 + rng.next() * Math.max(1.5, 5.5 - level * 0.3);

// ---------------------------------------------------------------- reel minigame

export const TRACK = 108;        // px of water column in the meter
const FISH_H = 10;

/** The reel: keep the catch bar over the fish until the progress bar fills. */
export class Reel {
  constructor(fishId, { level = 1, steady = false, bonus = 0, rng }) {
    const f = FISH[fishId];
    this.diff = f ? f.diff : 1;
    this.move = f ? f.move : 'floater';
    this.rng = rng;
    this.barH = Math.round((26 + level * 2) * (steady ? 1.33 : 1) * (1 + bonus));
    this.bar = 0;              // bottom of the catch bar, px from the bottom of the track
    this.barV = 0;
    this.fish = TRACK * 0.3;   // fish centre, px from the bottom
    this.target = this.fish;
    this.retarget = 0;
    this.progress = 0.3;
    this.perfect = true;
    this.done = null;          // 'caught' | 'lost'
  }

  pickTarget() {
    const r = this.rng.next(), d = this.diff;
    const move = this.move === 'mixed' ? ['smooth', 'dart', 'sinker', 'floater'][Math.floor(this.rng.next() * 4)] : this.move;
    const span = TRACK - FISH_H;
    if (move === 'sinker') this.target = span * r * 0.55;
    else if (move === 'floater') this.target = span * (0.45 + r * 0.55);
    else if (move === 'dart') this.target = r < 0.5 ? span * r * 0.4 : span * (0.6 + r * 0.4);
    else this.target = span * r;
    const calm = move === 'dart' ? 0.45 : 1.1;
    this.retarget = calm * (1.2 - d * 0.07) + this.rng.next() * 0.9;
  }

  inside() {
    return this.fish >= this.bar - 2 && this.fish <= this.bar + this.barH + 2;
  }

  step(dt, holding) {
    if (this.done) return this.done;
    // The fish.
    this.retarget -= dt;
    if (this.retarget <= 0) this.pickTarget();
    const speed = 18 + this.diff * 11;
    const dy = this.target - this.fish;
    this.fish += Math.sign(dy) * Math.min(Math.abs(dy), speed * dt * (0.6 + Math.min(1, Math.abs(dy) / 30)));
    // The bar: lifted while held, falls otherwise, bounces softly off the bottom.
    this.barV += (holding ? 420 : -380) * dt;
    this.barV = Math.max(-220, Math.min(220, this.barV));
    this.bar += this.barV * dt;
    if (this.bar < 0) { this.bar = 0; this.barV = -this.barV * 0.35; }
    if (this.bar > TRACK - this.barH) { this.bar = TRACK - this.barH; this.barV = 0; }
    // Progress.
    if (this.inside()) this.progress += 0.42 * dt;
    else { this.progress -= (0.22 + this.diff * 0.018) * dt; this.perfect = false; }
    if (this.progress >= 1) this.done = 'caught';
    else if (this.progress <= 0) this.done = 'lost';
    return this.done;
  }
}

// ---------------------------------------------------------------- traps

// What a bamboo trap holds by morning: small river life, sometimes rubbish.
const TRAP_CATCH = [['sawagani', 4], ['ebi', 3], ['dojo', 3], ['funa', 2], ['tanago', 1], ['waraji', 1], ['driftwood', 1]];

/** Overnight: each empty trap may catch something (always, with the Trapper perk). */
export function trapsNight(map, rng, trapper) {
  let n = 0;
  const total = TRAP_CATCH.reduce((a, [, w]) => a + w, 0);
  for (const o of map.objects) {
    if (o.type !== 'trap' || o.catch || rng.next() >= (trapper ? 1 : 0.5)) continue;
    let r = rng.next() * total;
    for (const [id, w] of TRAP_CATCH) if ((r -= w) < 0) { o.catch = id; break; }
    n++;
  }
  return n;
}
