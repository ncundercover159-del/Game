'use strict';

/* Tiny WebAudio synth — no asset files, everything is generated on the fly. */
const SFX = {
  ctx: null,
  master: null,
  enabled: true,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      this.ctx = null;
    }
  },

  /* Browsers require a user gesture before audio can start. */
  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  tone(opts) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const {
      freq = 440, to = null, type = 'sine', dur = 0.16,
      vol = 0.5, delay = 0, attack = 0.006, curve = 'exp',
    } = opts;

    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to !== null) {
      if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
      else osc.frequency.linearRampToValueAtTime(to, t0 + dur);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain); gain.connect(this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  },

  noise(opts) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const { dur = 0.3, vol = 0.4, delay = 0, freq = 900, q = 1, sweep = null } = opts;
    const t0 = this.ctx.currentTime + delay;
    const frames = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, t0);
    if (sweep) filter.frequency.exponentialRampToValueAtTime(Math.max(40, sweep), t0 + dur);
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter); filter.connect(gain); gain.connect(this.master);
    src.start(t0); src.stop(t0 + dur);
  },

  // ---- named cues ----------------------------------------------------

  /* Match pitch rises with the cascade depth, like every good match-3. */
  match(cascade = 1) {
    const step = Math.min(cascade - 1, 8);
    const base = 523.25 * Math.pow(2, step / 12);
    this.tone({ freq: base, to: base * 1.5, type: 'triangle', dur: 0.16, vol: 0.4 });
    this.tone({ freq: base * 2, type: 'sine', dur: 0.1, vol: 0.16, delay: 0.02 });
  },
  swap() { this.tone({ freq: 380, to: 520, type: 'sine', dur: 0.09, vol: 0.25 }); },
  invalid() { this.tone({ freq: 200, to: 130, type: 'square', dur: 0.13, vol: 0.16 }); },
  select() { this.tone({ freq: 700, type: 'sine', dur: 0.06, vol: 0.18 }); },
  land() { this.tone({ freq: 150, to: 90, type: 'sine', dur: 0.09, vol: 0.2 }); },
  rocket() {
    this.noise({ dur: 0.42, vol: 0.35, freq: 2400, sweep: 320, q: 0.8 });
    this.tone({ freq: 880, to: 220, type: 'sawtooth', dur: 0.35, vol: 0.14 });
  },
  tnt() {
    this.noise({ dur: 0.55, vol: 0.55, freq: 480, sweep: 60, q: 0.6 });
    this.tone({ freq: 120, to: 40, type: 'square', dur: 0.4, vol: 0.28 });
  },
  light() {
    for (let i = 0; i < 6; i++) {
      this.tone({ freq: 500 + i * 220, type: 'sine', dur: 0.3, vol: 0.14, delay: i * 0.035 });
    }
    this.noise({ dur: 0.6, vol: 0.22, freq: 5000, sweep: 900, q: 0.5 });
  },
  crate() { this.noise({ dur: 0.22, vol: 0.4, freq: 700, sweep: 200, q: 1.4 }); },
  ice() { this.noise({ dur: 0.24, vol: 0.32, freq: 4200, sweep: 1800, q: 2.2 }); },
  chain() { this.tone({ freq: 1100, to: 400, type: 'square', dur: 0.14, vol: 0.15 }); },
  button() { this.tone({ freq: 620, to: 820, type: 'triangle', dur: 0.09, vol: 0.28 }); },
  coin() {
    this.tone({ freq: 988, type: 'triangle', dur: 0.08, vol: 0.3 });
    this.tone({ freq: 1319, type: 'triangle', dur: 0.14, vol: 0.26, delay: 0.06 });
  },
  star(i = 0) {
    const notes = [659.25, 830.61, 987.77];
    this.tone({ freq: notes[Math.min(i, 2)], type: 'triangle', dur: 0.3, vol: 0.35 });
    this.tone({ freq: notes[Math.min(i, 2)] * 2, type: 'sine', dur: 0.25, vol: 0.14, delay: 0.03 });
  },
  win() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.42, vol: 0.34, delay: i * 0.11 }));
  },
  lose() {
    const notes = [392, 349.23, 293.66, 233.08];
    notes.forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.36, vol: 0.28, delay: i * 0.14 }));
  },
  shuffle() { this.tone({ freq: 300, to: 900, type: 'sine', dur: 0.4, vol: 0.22 }); },
};
