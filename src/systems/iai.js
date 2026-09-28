// The iai stand-off as pure rules: best of three rounds. Each round is a silence of random length
// with feints in it (a twig snaps, a leaf lands, a crow calls); then the cue (the temple bell) and a
// short window to draw. Drawing before the cue, or on a feint, loses the round; so does being late.
export const WINDOW = { relaxed: 0.5, standard: 0.36, warrior: 0.28 };
const FEINTS = ['twig', 'leaf', 'crow'];

export class Duel {
  constructor(rng, difficulty = 'standard') {
    this.rng = rng;
    this.window = WINDOW[difficulty] || WINDOW.standard;
    this.wins = 0;
    this.losses = 0;
    this.round = null;
    this.done = null;          // 'won' | 'lost'
    this.next();
  }

  next() {
    const wait = 1.6 + this.rng.next() * 2.4;
    const feints = [];
    // Up to two feints, never in the last half-second before the cue.
    for (let i = 0; i < 2; i++) if (this.rng.next() < 0.6) feints.push({ at: 0.5 + this.rng.next() * Math.max(0.2, wait - 1.1), kind: FEINTS[Math.floor(this.rng.next() * FEINTS.length)] });
    this.round = { t: 0, wait, feints: feints.sort((a, b) => a.at - b.at), phase: 'still', result: null, drawnAt: null };
  }

  /** The feint happening now (for the scene), if any. */
  feintNow() {
    const r = this.round;
    return r.feints.find((f) => r.t >= f.at && r.t < f.at + 0.5) || null;
  }

  /**
   * Advance by dt with `pressed` = the player drew this step. Returns an event: 'cue', 'won',
   * 'lost-early', 'lost-late', 'round', 'over', or null.
   */
  step(dt, pressed) {
    if (this.done) return null;
    const r = this.round;
    r.t += dt;
    switch (r.phase) {
      case 'still':
        if (pressed) return this.lose('early');
        if (r.t >= r.wait) { r.phase = 'cue'; r.cueAt = r.t; return 'cue'; }
        return null;
      case 'cue':
        if (pressed) { r.drawnAt = r.t - r.cueAt; return this.win(); }
        if (r.t - r.cueAt > this.window) return this.lose('late');
        return null;
      case 'result':
        if (r.t - r.resultAt >= 1.3) {
          if (this.wins >= 2 || this.losses >= 2) { this.done = this.wins >= 2 ? 'won' : 'lost'; return 'over'; }
          this.next();
          return 'round';
        }
        return null;
      default: return null;
    }
  }

  win() {
    const r = this.round;
    r.phase = 'result';
    r.result = 'won';
    r.resultAt = r.t;
    this.wins++;
    return 'won';
  }

  lose(why) {
    const r = this.round;
    r.phase = 'result';
    r.result = why;
    r.resultAt = r.t;
    this.losses++;
    return `lost-${why}`;
  }
}
