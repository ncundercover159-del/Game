// The music as pure rules: the pentatonic scales, which theme fits the moment (place, season,
// hour, weather, a boss, a festival), and a composer that turns a theme and a seed into bars of
// notes. A section is eight bars of two-bar phrases, A A B A', the last coming home to the root;
// new B phrases every section and a new A every other, with a breath now and then. The audio
// director (core/director.js) schedules what this returns; nothing here touches WebAudio.
import { THEMES } from '../data/music.js';
import { Rng } from '../core/rng.js';

export const SCALES = {
  yo: [0, 2, 5, 7, 9],           // bright folk song: spring and summer days, the village
  minyo: [0, 3, 5, 7, 10],       // min'yō, the work-song scale: the grove
  in: [0, 1, 5, 7, 8],           // miyako-bushi: autumn, dusk, the shrine, the night
  kumoi: [0, 2, 3, 7, 9],        // winter
  hirajoshi: [0, 2, 3, 7, 8],    // the foxfire halls, a fight
  iwato: [0, 1, 5, 6, 10],       // the mine and the foundry
};

const LATE = 22 * 60, DAWN = 6 * 60, DUSK = 19 * 60;
const SHRINE_ROOMS = new Set(['honden', 'shamusho']);

/**
 * The theme for a moment, or null for silence (late at night the valley has only its sounds).
 * `s`: { scene, map, cave, zone, indoors, boss, festival, season, minutes, rain }.
 */
export function themeFor(s) {
  if (s.scene === 'title') return 'title';
  if (s.boss) return 'boss';
  if (s.cave) return `cave_${Math.min(5, Math.max(1, s.zone || 1))}`;
  if (s.festival) return 'festival';
  if (s.minutes >= LATE || s.minutes < DAWN) return null;
  if (s.indoors) return SHRINE_ROOMS.has(s.map) ? 'shrine' : 'home';
  if (s.minutes >= DUSK) return 'night';
  if (s.rain) return 'rain';
  if (s.map === 'shrine') return 'shrine';
  if (s.map === 'grove' || s.map === 'kurayama') return 'grove';
  if (s.map === 'village') return 'village';
  return `farm_${s.season}`;
}

/** MIDI note of a scale degree counted up from the root (5 degrees to the octave). */
export function pitch(theme, degree) {
  const sc = SCALES[theme.scale], o = Math.floor(degree / sc.length), i = degree - o * sc.length;
  return theme.root + o * 12 + sc[i];
}

// Note lengths in beats, by how busy the theme is.
const DURS = { busy: [0.5, 0.5, 1, 1, 1, 1.5, 2], mid: [1, 1, 1, 2, 1.5, 0.5], calm: [2, 2, 3, 4, 1] };
// Taiko patterns: [beat, 'don' | 'ka', velocity].
const PULSES = {
  light: [[0, 'don', 0.35], [2, 'ka', 0.18]],
  matsuri: [[0, 'don', 0.45], [1, 'don', 0.3], [1.5, 'don', 0.25], [2, 'ka', 0.2], [2.5, 'don', 0.3], [3, 'ka', 0.2], [3.5, 'ka', 0.15]],
  forge: [[0, 'don', 0.5], [2.5, 'ka', 0.25]],
  battle: [[0, 'don', 0.5], [0.5, 'ka', 0.2], [1, 'don', 0.35], [1.5, 'ka', 0.2], [2, 'don', 0.45], [2.5, 'ka', 0.2], [3, 'don', 0.35], [3.5, 'don', 0.3]],
};
const LEAD_HOME = 5;          // the lead sits an octave above the root

export class Composer {
  constructor(name, seed = 1) {
    this.name = name;
    this.th = THEMES[name];
    this.rng = new Rng(seed);
    this.bar = 0;
    this.a = this.phrase(0);
    this.b = this.phrase(3);
  }

  get pace() { const d = this.th.density; return d >= 0.65 ? 'busy' : d >= 0.4 ? 'mid' : 'calm'; }

  /** A two-bar phrase (8 beats) of { beat, dur, degree | null }, ending on `end` (a degree above home). */
  phrase(end) {
    const r = this.rng, durs = DURS[this.pace], out = [];
    let beat = 0, deg = LEAD_HOME + Math.floor(r.next() * 5) - 1;
    while (beat < 8) {
      const dur = Math.min(8 - beat, durs[Math.floor(r.next() * durs.length)]);
      const rest = beat > 0 && r.next() < (1 - this.th.density) * 0.35;
      out.push({ beat, dur, degree: rest ? null : deg });
      beat += dur;
      const u = r.next();
      deg += u < 0.35 ? 1 : u < 0.7 ? -1 : u < 0.82 ? 2 : u < 0.94 ? -2 : 0;
      deg = Math.max(LEAD_HOME - 3, Math.min(LEAD_HOME + 6, deg));
    }
    const last = out.filter((n) => n.degree !== null).at(-1);
    if (last) last.degree = LEAD_HOME + end;
    return out;
  }

  /** The next bar: [{ beat (0..4), inst, midi, dur (beats), vel }]. */
  nextBar() {
    const th = this.th, n = this.bar++, inSection = n % 8, section = Math.floor(n / 8);
    if (inSection === 0 && n > 0) {
      this.b = this.phrase(3);
      if (section % 2 === 0) this.a = this.phrase(0);
    }
    const out = [];
    // The lead: A A B A', but every fourth section breathes for its last two bars.
    const breath = section % 4 === 3 && inSection >= 6;
    const ph = inSection < 4 ? this.a : inSection < 6 ? this.b : this.a;
    const half = inSection % 2;
    if (!breath) {
      for (const x of ph) {
        if (x.degree === null || x.beat < half * 4 || x.beat >= half * 4 + 4) continue;
        out.push({ beat: x.beat - half * 4, inst: th.lead, midi: pitch(th, x.degree), dur: x.dur, vel: 0.5 + this.rng.next() * 0.15 });
      }
    }
    this.under(out, th);
    // The drone: the root and the scale's fourth degree (a fifth, or the iwato's darker tritone).
    if (th.drone && inSection % 2 === 0) out.push({ beat: 0, inst: 'pad', midi: th.root - 12, dur: 8, vel: 0.05 }, { beat: 0, inst: 'pad', midi: pitch(th, 3) - 12, dur: 8, vel: 0.035 });
    if (th.pulse) for (const [beat, kind, vel] of PULSES[th.pulse]) out.push({ beat, inst: `taiko_${kind}`, midi: 0, dur: 1, vel });
    if (th.bells && inSection === 0) out.push({ beat: 0, inst: 'bell', midi: th.root + 24, dur: 4, vel: 0.28 });
    return out;
  }

  /** The figure under the lead, one bar of it. */
  under(out, th) {
    const low = (deg) => pitch(th, deg);
    switch (th.under) {
      case 'koto_arp': [0, 2, 4, 2].forEach((d, i) => out.push({ beat: i, inst: 'koto', midi: low(d), dur: 1, vel: 0.2 })); break;
      case 'koto_low': out.push({ beat: 0, inst: 'koto', midi: low(0), dur: 2, vel: 0.24 }, { beat: 2, inst: 'koto', midi: low(3), dur: 2, vel: 0.2 }); break;
      case 'koto_trem': for (let i = 0; i < 8; i++) out.push({ beat: i / 2, inst: 'koto', midi: low(i % 2 ? 5 : 0), dur: 0.5, vel: 0.12 }); break;
      case 'shamisen_beat': for (let i = 0; i < 4; i++) out.push({ beat: i + 0.5, inst: 'shamisen', midi: low(i % 2 ? 3 : 0), dur: 0.5, vel: 0.18 }); break;
      default: break;
    }
  }
}
