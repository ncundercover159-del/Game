// The valley's sounds under the music. Beds run all the time and swell or fade with the place and
// the weather (wind, rain, running water, the mountain's low rumble, the foundry's fire); creatures
// call now and then (birds by day, bell crickets and frogs on summer nights, cicadas in the heat,
// crows in the cold, owls, water dripping in the mine, the forge-fire crackling). All on the
// ambience bus. Driven by core/director.js with the moment it reads from the game.

// Bed levels for a moment (0..~0.2), and each bed's filter.
const BEDS = {
  wind: { filter: 'bandpass', freq: 380, q: 0.6 },
  rain: { filter: 'highpass', freq: 1300, q: 0.4 },
  water: { filter: 'lowpass', freq: 520, q: 0.8 },
  rumble: { filter: 'lowpass', freq: 110, q: 0.7 },
  fire: { filter: 'bandpass', freq: 1700, q: 0.5 },
};
const WIND = { wind: 0.1, storm: 0.12, typhoon: 0.18, snow: 0.045, blizzard: 0.16 };
const RAIN = { rain: 0.06, tsuyu: 0.06, storm: 0.09, typhoon: 0.12 };
const WATER = { grove: 0.06, farm: 0.012, village: 0.016 };

/** Target level of each bed for a moment `s` (see Director.moment). */
export function bedLevels(s) {
  if (s.scene === 'title') return { wind: 0.03, rain: 0, water: 0.01, rumble: 0, fire: 0 };
  const out = !s.indoors && !s.cave;
  return {
    wind: out ? WIND[s.weather] ?? 0.025 : s.cave && s.zone === 5 ? 0.05 : 0.004,
    rain: RAIN[s.weather] ? (out ? RAIN[s.weather] : s.indoors ? RAIN[s.weather] * 0.3 : 0) : 0,
    water: out ? WATER[s.map] || 0 : s.cave && s.zone === 2 ? 0.025 : 0,
    rumble: s.cave ? (s.zone === 4 ? 0.1 : 0.05) : 0,
    fire: s.cave && s.zone === 4 ? 0.03 : 0,
  };
}

/** Calls per second of each creature for a moment. */
export function callRates(s) {
  const r = { bird: 0, cricket: 0, frog: 0, cicada: 0, crow: 0, owl: 0, drip: 0, crackle: 0 };
  if (s.scene === 'title') { r.cricket = 0.3; return r; }
  if (s.cave) { r.drip = s.zone === 4 ? 0.1 : 0.5; if (s.zone === 4) r.crackle = 2; return r; }
  if (s.indoors || s.rain) return r;
  const m = s.minutes, day = m >= 6 * 60 && m < 17 * 60 + 30, night = m >= 19 * 60 || m < 4 * 60;
  const wild = ['farm', 'grove', 'shrine', 'village', 'kurayama'].includes(s.map);
  if (!wild) return r;
  if (day) r.bird = s.season === 'winter' ? 0.06 : 0.25;
  if (day && s.season === 'summer' && m >= 9 * 60 && m < 17 * 60 && s.map !== 'farm') r.cicada = 0.08;
  if (day && (s.season === 'autumn' || s.season === 'winter')) r.crow = 0.02;
  if (night && (s.season === 'summer' || s.season === 'autumn')) r.cricket = 0.6;
  if (night && (s.season === 'summer' || s.season === 'spring') && (s.map === 'farm' || s.map === 'village')) r.frog = 0.3;
  if (night && (s.season === 'autumn' || s.season === 'winter') && s.map !== 'village') r.owl = 0.03;
  return r;
}

// At most this many creature calls start in any second of audio time, so they can never pile up
// (a context the browser suspends freezes its clock while the game runs on).
const MAX_CALLS = 4;

export class Ambience {
  constructor(audio) {
    this.a = audio;
    this.beds = null;
    this.gust = 0;
    this.recent = [];      // audio times of the calls started in the last second
  }

  /** Make the beds once the context exists: looping noise through a filter, silent to begin with. */
  start() {
    const c = this.a.ctx;
    this.beds = {};
    for (const [id, b] of Object.entries(BEDS)) {
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = this.a.noise(2);
      src.loop = true;
      f.type = b.filter; f.frequency.value = b.freq; f.Q.value = b.q;
      g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.a.ambBus);
      src.start();
      this.beds[id] = { g, level: 0 };
    }
  }

  update(dt, s) {
    const a = this.a, c = a.ctx;
    if (!c) return;
    if (!this.beds) this.start();
    // The wind gusts: its level wanders around the target.
    this.gust += dt;
    const levels = bedLevels(s);
    levels.wind *= 0.75 + 0.25 * Math.sin(this.gust * 0.37) + 0.1 * Math.sin(this.gust * 1.3);
    for (const [id, bed] of Object.entries(this.beds)) {
      const v = Math.max(0, levels[id]);
      if (Math.abs(v - bed.level) < 0.002) continue;
      bed.level = v;
      bed.g.gain.setTargetAtTime(v, c.currentTime, 0.8);
    }
    if (c.state !== 'running') return;
    const now = c.currentTime;
    this.recent = this.recent.filter((t) => t > now - 1);
    for (const [kind, rate] of Object.entries(callRates(s))) {
      if (rate <= 0 || this.recent.length >= MAX_CALLS || Math.random() >= rate * dt) continue;
      this.recent.push(now);
      CALLS[kind](a, a.ambBus, now + Math.random() * 0.2);
    }
  }
}

// ------------------------------------------------------------------ the creatures

function chirp(a, bus, t, f0, f1, dur, peak, type = 'sine') {
  const c = a.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.02, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus);
  o.start(t); o.stop(t + dur + 0.02);
  return { o, g };
}

/** A tone whose loudness pulses at `rate` Hz: crickets, cicadas, frogs. */
function pulsed(a, bus, t, f, dur, rate, peak, type = 'sine') {
  const c = a.ctx, o = c.createOscillator(), am = c.createOscillator(), amg = c.createGain(), g = c.createGain();
  o.type = type; o.frequency.value = f;
  am.frequency.value = rate; amg.gain.value = peak / 2;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak / 2, t + 0.05);
  g.gain.setValueAtTime(peak / 2, t + dur - 0.1);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  am.connect(amg); amg.connect(g.gain);
  o.connect(g); g.connect(bus);
  for (const x of [o, am]) { x.start(t); x.stop(t + dur + 0.05); }
}

export const CALLS = {
  bird: (a, bus, t) => {
    const f = 2600 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) chirp(a, bus, t + i * 0.11, f * (1 + (i % 2) * 0.15), f * 1.3, 0.07, 0.025);
  },
  cricket: (a, bus, t) => pulsed(a, bus, t, 4300 + Math.random() * 300, 0.35 + Math.random() * 0.3, 38, 0.012),
  frog: (a, bus, t) => { for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) pulsed(a, bus, t + i * 0.28, 170 + Math.random() * 40, 0.18, 30, 0.018, 'triangle'); },
  cicada: (a, bus, t) => pulsed(a, bus, t, 2500 + Math.random() * 500, 1.8 + Math.random(), 22, 0.01, 'sawtooth'),
  crow: (a, bus, t) => { for (let i = 0; i < 2; i++) chirp(a, bus, t + i * 0.4, 720, 520, 0.28, 0.02, 'sawtooth'); },
  owl: (a, bus, t) => { chirp(a, bus, t, 420, 380, 0.35, 0.03); chirp(a, bus, t + 0.55, 420, 360, 0.6, 0.03); },
  drip: (a, bus, t) => { chirp(a, bus, t, 1500 + Math.random() * 600, 700, 0.07, 0.03); chirp(a, bus, t + 0.18, 1200, 600, 0.06, 0.01); },
  crackle: (a, bus, t) => chirp(a, bus, t, 3000 + Math.random() * 2000, 1500, 0.015, 0.02, 'square'),
};
