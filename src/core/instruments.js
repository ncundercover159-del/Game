// The music's instruments, voiced from scratch in WebAudio: koto and shamisen (plucked strings,
// Karplus-Strong, the shamisen with its buzzing sawari), shakuhachi and shinobue (breathy tones
// that scoop up into the note and bloom a slow vibrato), taiko (a pitched thud, a rim click), the
// temple bell (inharmonic partials, a long ring) and the shō pad (a soft held chord tone). Each call
// plays one note into `bus` at audio time `t`; `dur` in seconds, `vel` 0..1.
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

/** A plucked string: a cached ring buffer at the period's pitch, retuned exactly by playback rate. */
function pluck(a, bus, f, t, vel, damp, len, cutoff) {
  const c = a.ctx, sr = c.sampleRate, n = Math.round(sr / f);
  const src = c.createBufferSource();
  src.buffer = a.pluckBuffer(sr / n, len, damp);
  src.playbackRate.value = f / (sr / n);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = cutoff;
  const g = c.createGain();
  g.gain.value = vel * 1.8;
  src.connect(lp); lp.connect(g); g.connect(bus);
  src.start(t);
}

/** A wind instrument: scoop into the pitch, bloom a vibrato, breath noise over the tone. */
function wind(a, bus, f, t, dur, vel, { attack, vib, breath, type }) {
  const c = a.ctx, end = t + dur;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f * 0.97, t);
  o.frequency.exponentialRampToValueAtTime(f, t + attack * 1.5);
  const lfo = c.createOscillator(), depth = c.createGain();
  lfo.frequency.value = 5.2;
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(f * vib, t + Math.min(dur, 0.6));
  lfo.connect(depth); depth.connect(o.frequency);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel * 0.3, t + attack);
  g.gain.setValueAtTime(vel * 0.3, Math.max(t + attack, end - 0.12));
  g.gain.exponentialRampToValueAtTime(0.0001, end + 0.25);
  o.connect(g); g.connect(bus);
  const n = c.createBufferSource(), bp = c.createBiquadFilter(), ng = c.createGain();
  n.buffer = a.noise(0.5);
  n.loop = true;
  bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 1.5;
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.exponentialRampToValueAtTime(vel * breath * 0.25, t + attack * 0.6);
  ng.gain.exponentialRampToValueAtTime(0.0001, end + 0.2);
  n.connect(bp); bp.connect(ng); ng.connect(bus);
  for (const s of [o, lfo, n]) { s.start(t); s.stop(end + 0.35); }
}

function decaying(a, bus, type, f0, f1, t, peak, dur) {
  const c = a.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus);
  o.start(t); o.stop(t + dur + 0.05);
}

function noiseHit(a, bus, filter, freq, q, t, peak, dur) {
  const c = a.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = a.noise(0.5);
  f.type = filter; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(bus);
  src.start(t); src.stop(t + dur + 0.05);
}

export const INSTRUMENTS = {
  koto: (a, bus, midi, t, dur, vel) => pluck(a, bus, hz(midi), t, vel, 0.997, 2, 3400),
  shamisen: (a, bus, midi, t, dur, vel) => {
    pluck(a, bus, hz(midi), t, vel * 0.85, 0.986, 0.9, 5200);
    noiseHit(a, bus, 'bandpass', hz(midi) * 3, 6, t, vel * 0.06, 0.12);   // the sawari's buzz
  },
  shakuhachi: (a, bus, midi, t, dur, vel) => wind(a, bus, hz(midi), t, dur, vel, { attack: 0.14, vib: 0.007, breath: 0.35, type: 'sine' }),
  fue: (a, bus, midi, t, dur, vel) => wind(a, bus, hz(midi + 12), t, dur, vel * 0.6, { attack: 0.05, vib: 0.005, breath: 0.2, type: 'triangle' }),
  taiko_don: (a, bus, midi, t, dur, vel) => {
    decaying(a, bus, 'sine', 120, 52, t, vel, 0.4);
    noiseHit(a, bus, 'lowpass', 300, 0.7, t, vel * 0.3, 0.12);
  },
  taiko_ka: (a, bus, midi, t, dur, vel) => {
    noiseHit(a, bus, 'bandpass', 2600, 3, t, vel * 0.6, 0.05);
    decaying(a, bus, 'square', 1300, 1100, t, vel * 0.08, 0.03);
  },
  bell: (a, bus, midi, t, dur, vel) => {
    const f = hz(midi);
    [[1, 1, 4], [2, 0.45, 2.6], [2.76, 0.3, 1.8], [5.4, 0.12, 0.9]].forEach(([m, g, d]) => decaying(a, bus, 'sine', f * m, f * m * 0.998, t, vel * g * 0.5, d));
  },
  pad: (a, bus, midi, t, dur, vel) => {
    const c = a.ctx, f = hz(midi), g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1400;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 1.2);
    g.gain.setValueAtTime(vel, t + Math.max(1.2, dur - 1));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.5);
    lp.connect(g); g.connect(bus);
    for (const [type, det] of [['sine', 1], ['triangle', 1.004]]) {
      const o = c.createOscillator();
      o.type = type; o.frequency.value = f * det;
      o.connect(lp); o.start(t); o.stop(t + dur + 1.6);
    }
  },
};
