// Rhythm minigames: a chart of timed notes and a judge. Mochi pounding (strike on the beat, never
// while your partner's hand is in the mortar), the Bon Odori (dance steps on the arrows), the
// Otaue planting (set a seedling on each drumbeat), Setsubun's mamemaki (beans at the oni, never
// at Kinta when he pops up instead), forging at Genzō's anvil (your sledge after his hammer, never
// while he turns the blade) and kata at the dōjō (Rin's forms, still when she calls a halt).
// Pure: the UI (ui/rhythm.js) feeds it presses.

export const WINDOW = { perfect: 0.075, good: 0.15 };
export const LEAD = 1.6;          // s of count-in before the first note
export const KEYS = ['use', 'up', 'down', 'left', 'right'];

/** A note: { t (s), key, rest } — a `rest` is a moment you must NOT press `key` (a hand in the mortar).
 * `cue` (s) is when a partner leads it (Genzō's hammer), for the scene to show. */
const note = (t, key, rest = false, cue = null) => ({ t, key, rest, cue });

const STEPS = [
  ['left', 'left', 'right', 'right'],
  ['up', 'use', 'up', 'use'],
  ['left', 'right', 'left', 'right'],
  ['down', 'down', 'up', 'use'],
];

// Rin's kata: four-move forms of steps (arrows) and cuts (Use).
const KATA = [
  ['right', 'use', 'left', 'use'],
  ['up', 'use', 'use', 'down'],
  ['left', 'left', 'use', 'right'],
  ['down', 'use', 'up', 'use'],
];

export const CHARTS = {
  // The pounder strikes; between strikes the turner's hand goes in. It quickens in the second half.
  mochi(rng) {
    const out = [];
    let t = 0;
    for (let i = 0; i < 32; i++) {
      const beat = i < 16 ? 0.72 : 0.62;
      out.push(note(t, 'use'));
      out.push(note(t + beat / 2, 'use', true));
      // Now and then the turner lingers: a double turn, and one strike is skipped.
      if (i % 8 === 7 && rng.next() < 0.7) { out.push(note(t + beat, 'use', true)); t += beat; }
      t += beat;
    }
    return out;
  },
  bonodori(rng) {
    const out = [];
    let t = 0;
    for (let bar = 0; bar < 8; bar++) {
      const steps = STEPS[(bar + Math.floor(rng.next() * 4)) % 4];
      for (const k of steps) { out.push(note(t, k)); t += 0.66; }
    }
    return out;
  },
  mamemaki(rng) {
    const out = [];
    let t = 0;
    for (let i = 0; i < 28; i++) {
      out.push(note(t, 'use', i > 3 && rng.next() < 0.25));
      t += 0.5 + rng.next() * 0.5;
    }
    return out;
  },
  // Genzō taps the spot with his hand hammer and your sledge falls half a beat later; every sixth
  // beat or so he turns the blade over instead, and you hold. It quickens as the steel thins.
  forge(rng) {
    const out = [];
    let t = 0;
    for (let i = 0; i < 30; i++) {
      const beat = 0.8 - Math.min(0.2, i * 0.008);
      const turn = i % 6 === 5 || (i > 12 && rng.next() < 0.08);
      out.push(note(t + beat / 2, 'use', turn, t));
      t += beat;
    }
    return out;
  },
  // Eight forms; after each, Rin calls "yame" and you stand still for a beat.
  kata(rng) {
    const out = [];
    let t = 0;
    for (let form = 0; form < 8; form++) {
      for (const k of KATA[(form + Math.floor(rng.next() * 4)) % 4]) { out.push(note(t, k)); t += 0.62; }
      out.push(note(t, 'use', true));
      t += 0.62;
    }
    return out;
  },
  otaue(rng) {
    const out = [];
    let t = 0;
    for (let row = 0; row < 6; row++) {
      for (let i = 0; i < 4; i++) { out.push(note(t, 'use')); t += 0.8; }
      // Between rows the drummer beats alone: step back, don't plant.
      out.push(note(t, 'use', true));
      t += 0.8 + (rng.next() < 0.5 ? 0.4 : 0);
    }
    return out;
  },
};

export class Rhythm {
  constructor(notes) {
    this.notes = notes.map((n) => ({ ...n, judge: null }));
    this.t = -LEAD;
    this.combo = 0;
    this.maxCombo = 0;
    this.tally = { perfect: 0, good: 0, miss: 0, ouch: 0 };
    this.end = Math.max(...notes.map((n) => n.t)) + 0.8;
  }

  get beats() { return this.notes.filter((n) => !n.rest).length; }
  get done() { return this.t >= this.end; }

  /** Advance time and apply this frame's presses (a Set of KEYS). Returns the judgements made. */
  step(dt, pressed) {
    this.t += dt;
    const out = [];
    for (const key of pressed) {
      // The nearest open note for this key within the good window.
      let best = null;
      for (const n of this.notes) {
        if (n.judge || n.key !== key) continue;
        const d = Math.abs(n.t - this.t);
        if (d <= WINDOW.good && (!best || d < Math.abs(best.t - this.t))) best = n;
      }
      if (!best) continue;
      if (best.rest) { best.judge = 'ouch'; this.combo = 0; this.tally.ouch++; }
      else {
        best.judge = Math.abs(best.t - this.t) <= WINDOW.perfect ? 'perfect' : 'good';
        this.tally[best.judge]++;
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
      }
      out.push(best);
    }
    for (const n of this.notes) {
      if (n.judge || this.t - n.t <= WINDOW.good) continue;
      n.judge = n.rest ? 'safe' : 'miss';
      if (!n.rest) { this.tally.miss++; this.combo = 0; out.push(n); }
    }
    return out;
  }

  /** 0..1: perfects count fully, goods 60%, each ouch takes one away. */
  get ratio() {
    const { perfect, good, ouch } = this.tally;
    return Math.max(0, (perfect + good * 0.6 - ouch) / this.beats);
  }

  /** 0 splendid, 1 good, 2 clumsy. */
  get grade() {
    const r = this.ratio;
    return r >= 0.8 ? 0 : r >= 0.5 ? 1 : 2;
  }
}
