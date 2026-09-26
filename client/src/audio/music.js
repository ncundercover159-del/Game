// Procedural chiptune music. Songs are small data files (assets/audio/songs/*.json):
// tempo, key, scale, chord progression, drum patterns and voice settings. The
// lead melody is generated from the chords with a seeded RNG unless the song
// spells it out. Playback is a look-ahead step sequencer with separate layer
// buses: base (bass + drums), lead, pad and a "drift" arpeggio layer that the
// game fades in while drifting. Final lap speeds the tempo up.
import { midiToHz, noiseBuffer, envelope } from './synth.js';
import { makeRng, hashString } from '@shared/math.js';

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  pentatonic: [0, 2, 4, 7, 9, 12, 14],
};

// scale degree (any integer) -> semitones from root
function degree(scale, d) {
  const n = scale.length;
  const oct = Math.floor(d / n);
  return scale[((d % n) + n) % n] + 12 * oct;
}

const RHYTHMS = [
  'x.x.x...x.x.x...', 'x..x..x.x...x...', 'x...x.x.x.x.x...', 'x.xxx...x...x.x.',
  'x...x...x.xxx...', 'xx..x.x.x..x....', 'x.x...x.x.x.x...', 'x..xx.x...x.x...',
];

// Build the per-step note tables for a song (deterministic).
export function compileSong(song) {
  const rng = makeRng(hashString(song.id || 'song'));
  const scale = SCALES[song.scale] || SCALES.major;
  const chords = song.chords || [0, 3, 4, 0];
  const bars = chords.length;
  const steps = bars * 16;
  const chordTones = (bar) => { const r = chords[bar % bars]; return [r, r + 2, r + 4]; };
  // lead: explicit (scale degrees, null = rest) or generated motif A A' B A''
  let lead = song.lead?.notes;
  if (!lead) {
    lead = new Array(steps).fill(null);
    const motifs = [];
    for (let m = 0; m < 3; m++) {
      const rh = song.lead?.rhythm || RHYTHMS[Math.floor(rng() * RHYTHMS.length)];
      const contour = [];
      let pos = Math.floor(rng() * 3);
      for (let i = 0; i < 16; i++) { pos += Math.floor(rng() * 3) - 1; pos = Math.max(-1, Math.min(3, pos)); contour.push(pos); }
      motifs.push({ rh, contour });
    }
    const form = [0, 0, 1, 0, 0, 2, 1, 2];
    for (let bar = 0; bar < bars; bar++) {
      const mo = motifs[form[bar % form.length]];
      const ct = chordTones(bar);
      for (let i = 0; i < 16; i++) {
        if (mo.rh[i] !== 'x') continue;
        const strong = i % 4 === 0;
        const c = mo.contour[i];
        // strong beats land on chord tones, weak beats walk the scale
        const note = strong ? ct[((c % 3) + 3) % 3] + (c > 2 ? 7 : 0) : ct[0] + c + (bar % 2 && i > 8 ? 1 : 0);
        lead[bar * 16 + i] = note + 7; // lead sits an octave up
      }
    }
  }
  const bassStyle = song.bass?.style || 'octaves';
  const bass = new Array(steps).fill(null);
  for (let bar = 0; bar < bars; bar++) {
    const r = chords[bar];
    for (let i = 0; i < 16; i++) {
      let n = null;
      if (bassStyle === 'octaves') n = i % 2 === 0 ? (i % 4 === 0 ? r : r + 7) : null;
      else if (bassStyle === 'pulse') n = i % 2 === 0 ? r : null;
      else if (bassStyle === 'walk') n = i % 4 === 0 ? r + [0, 2, 4, 5][i / 4] : null;
      else if (bassStyle === 'gallop') n = [0, 3, 4, 8, 11, 12].includes(i) ? r : null;
      else if (bassStyle === 'sparse') n = i === 0 || i === 10 ? r : null;
      else n = i % 4 === 0 ? r : null;
      if (n !== null) bass[bar * 16 + i] = n - 7; // an octave below root
    }
  }
  const arpPat = song.arp?.pattern || [0, 1, 2, 1];
  const arpN = new Array(steps).fill(null);
  for (let s = 0; s < steps; s++) {
    const bar = Math.floor(s / 16);
    const ct = chordTones(bar);
    if (s % (song.arp?.every || 1) === 0) arpN[s] = ct[arpPat[(s / (song.arp?.every || 1)) % arpPat.length] % 3] + 7 + (Math.floor(s / 4) % 2 ? 7 : 0);
  }
  const pad = chords.map((r) => [r, r + 2, r + 4]);
  const pat = (str, fallback) => (str || fallback).padEnd(16, '.').slice(0, 16);
  const drums = {
    kick: pat(song.drums?.kick, 'x...x...x...x...'),
    snare: pat(song.drums?.snare, '....x.......x...'),
    hat: pat(song.drums?.hat, 'x.x.x.x.x.x.x.x.'),
  };
  return { song, scale, steps, bars, lead, bass, arp: arpN, pad, drums };
}

export class MusicPlayer {
  constructor(ctx, dest) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.connect(dest);
    this.layers = {};
    for (const name of ['base', 'lead', 'pad', 'drift', 'drums']) {
      const g = ctx.createGain();
      g.gain.value = name === 'drift' ? 0 : 1;
      g.connect(this.out);
      this.layers[name] = g;
    }
    this.current = null;
    this.tempoMul = 1;
    this.timer = null;
  }

  play(song, { fade = 0.6 } = {}) {
    if (this.current?.song === song) return;
    const now = this.ctx.currentTime;
    if (this.current) {
      // quick fade out, then swap
      this.out.gain.cancelScheduledValues(now);
      this.out.gain.setTargetAtTime(0.0001, now, 0.08);
    }
    this.current = song ? compileSong(song) : null;
    this.step = 0;
    this.tempoMul = 1;
    this.nextTime = now + 0.25;
    this.out.gain.setTargetAtTime(1, now + 0.2, fade / 3);
    this.setLayer('drift', 0, 0.01);
    if (!this.timer && song) this.timer = setInterval(() => this.schedule(), 25);
    if (!song) this.stop();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.current = null;
    this.out.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.1);
  }

  setLayer(name, v, time = 0.25) {
    const g = this.layers[name];
    if (g) g.gain.setTargetAtTime(v, this.ctx.currentTime, time);
  }

  setTempo(mul) { this.tempoMul = mul; }

  schedule() {
    const c = this.current;
    if (!c) return;
    const ctx = this.ctx;
    const stepDur = 60 / (c.song.bpm * this.tempoMul) / 4;
    if (this.nextTime < ctx.currentTime - 0.3) this.nextTime = ctx.currentTime + 0.05; // tab was asleep
    while (this.nextTime < ctx.currentTime + 0.14) {
      this.playStep(c, this.step, this.nextTime, stepDur);
      const swing = c.song.swing && this.step % 2 === 0 ? c.song.swing : 0;
      this.nextTime += stepDur * (1 + swing * (this.step % 2 === 0 ? 1 : -1));
      this.step = (this.step + 1) % c.steps;
    }
  }

  note(bus, t, midi, dur, o) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = o.wave || 'square';
    osc.frequency.setValueAtTime(midiToHz(midi), t);
    if (o.vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = 5.5; lg.gain.value = midiToHz(midi) * 0.006;
      l.connect(lg).connect(osc.frequency);
      l.start(t + 0.08); l.stop(t + dur + 0.1);
    }
    const g = ctx.createGain();
    let node = osc;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node.connect(f); node = f; }
    node.connect(g).connect(bus);
    const end = envelope(g.gain, t, { a: o.a ?? 0.005, d: o.d ?? dur, peak: o.vol ?? 0.1, sustain: o.sustain ?? 0.5, hold: o.hold ? dur * 0.8 : 0, r: 0.04 });
    osc.start(t);
    osc.stop(end + 0.05);
  }

  drum(kind, t, vol) {
    const ctx = this.ctx, bus = this.layers.drums;
    if (kind === 'kick') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      o.connect(g).connect(bus);
      envelope(g.gain, t, { a: 0.002, d: 0.22, peak: 0.55 * vol });
      o.start(t); o.stop(t + 0.3);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    if (kind === 'snare') { f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7; envelope(g.gain, t, { a: 0.002, d: 0.14, peak: 0.32 * vol }); }
    else { f.type = 'highpass'; f.frequency.value = 7000; envelope(g.gain, t, { a: 0.001, d: kind === 'openhat' ? 0.16 : 0.035, peak: 0.12 * vol }); }
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random()); src.stop(t + 0.25);
    if (kind === 'snare') {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(190, t);
      o.connect(og).connect(bus);
      envelope(og.gain, t, { a: 0.002, d: 0.08, peak: 0.18 * vol });
      o.start(t); o.stop(t + 0.15);
    }
  }

  playStep(c, s, t, stepDur) {
    const song = c.song;
    const root = song.root ?? 60;
    const midi = (deg) => root + degree(c.scale, deg);
    const i = s % 16;
    const d = c.drums;
    if (d.kick[i] === 'x') this.drum('kick', t, 1);
    if (d.snare[i] === 'x') this.drum('snare', t, 1);
    if (d.hat[i] === 'x' || (this.tempoMul > 1.05 && i % 2 === 1)) this.drum(d.hat[i] === 'o' ? 'openhat' : 'hat', t, 1);
    if (c.bass[s] !== null) this.note(this.layers.base, t, midi(c.bass[s]), stepDur * 1.6, { wave: song.bass?.wave || 'triangle', vol: song.bass?.vol ?? 0.2, d: stepDur * 1.8, sustain: 0.7, hold: true });
    if (c.lead[s] !== null) {
      // hold the note until the next one (max 4 steps)
      let len = 1;
      while (len < 4 && c.lead[(s + len) % c.steps] === null) len++;
      this.note(this.layers.lead, t, midi(c.lead[s]), stepDur * len, { wave: song.lead?.wave || 'square', vol: song.lead?.vol ?? 0.075, d: stepDur * len, sustain: 0.6, hold: true, vib: len > 2, lp: song.lead?.lp || 5000 });
    }
    if (c.arp[s] !== null) this.note(this.layers.drift, t, midi(c.arp[s]) + 12, stepDur * 0.9, { wave: song.arp?.wave || 'square', vol: song.arp?.vol ?? 0.05, d: stepDur * 0.9, lp: 6000 });
    if (i === 0 && song.pad !== false) {
      const bar = Math.floor(s / 16);
      for (const deg of c.pad[bar]) this.note(this.layers.pad, t, midi(deg), stepDur * 16, { wave: song.pad?.wave || 'triangle', vol: song.pad?.vol ?? 0.03, a: 0.08, d: stepDur * 16, sustain: 0.8, hold: true, lp: 2500 });
    }
  }
}
