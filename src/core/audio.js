// Procedural sound effects (WebAudio). No audio files: short noise/sine/pluck recipes, buffers
// cached, voices capped. The context starts on the first user gesture (browser autoplay rules).

const MAX_VOICES = 14;

export class Audio {
  constructor() {
    this.ctx = null;
    this.voices = 0;
    this.volume = { master: 0.8, sfx: 0.8, music: 0.6 };
    this.buffers = new Map();
    const unlock = () => this.unlock();
    addEventListener('pointerdown', unlock, { once: false });
    addEventListener('keydown', unlock, { once: false });
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.out = this.ctx.createGain();
    this.out.connect(this.ctx.destination);
    this.setVolume();
  }

  setVolume(v = {}) {
    Object.assign(this.volume, v);
    if (this.out) this.out.gain.value = this.volume.master * this.volume.sfx;
  }

  noise(dur) {
    const key = 'noise' + dur;
    if (!this.buffers.has(key)) {
      const b = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * dur), this.ctx.sampleRate);
      const d = b.getChannelData(0);
      let s = 1234567;
      for (let i = 0; i < d.length; i++) { s = (s * 1103515245 + 12345) >>> 0; d[i] = (s / 2147483648) - 1; }
      this.buffers.set(key, b);
    }
    return this.buffers.get(key);
  }

  /** Karplus-Strong plucked string (koto-ish), cached per pitch. */
  pluckBuffer(freq, dur = 0.9, damp = 0.996) {
    const key = `pluck${freq}`;
    if (!this.buffers.has(key)) {
      const sr = this.ctx.sampleRate;
      const b = this.ctx.createBuffer(1, Math.ceil(sr * dur), sr);
      const d = b.getChannelData(0);
      const n = Math.round(sr / freq);
      const ring = new Float32Array(n);
      let s = 99;
      for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) >>> 0; ring[i] = (s / 2147483648) - 1; }
      for (let i = 0; i < d.length; i++) {
        const j = i % n;
        const v = ring[j];
        ring[j] = damp * 0.5 * (v + ring[(j + 1) % n]);
        d[i] = v * 0.5;
      }
      this.buffers.set(key, b);
    }
    return this.buffers.get(key);
  }

  voice(dur) {
    if (!this.ctx || this.voices >= MAX_VOICES) return null;
    this.voices++;
    setTimeout(() => { this.voices--; }, dur * 1000 + 50);
    return this.ctx.currentTime;
  }

  env(t, peak, attack, decay) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(this.out);
    return g;
  }

  tone(type, f0, f1, peak, dur, delay = 0) {
    const t = this.voice(dur + delay);
    if (t === null) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t + delay);
    o.frequency.exponentialRampToValueAtTime(f1, t + delay + dur);
    o.connect(this.env(t + delay, peak, 0.005, dur));
    o.start(t + delay);
    o.stop(t + delay + dur + 0.05);
  }

  hiss(filter, freq, q, peak, dur, delay = 0) {
    const t = this.voice(dur + delay);
    if (t === null) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise(0.5);
    const f = this.ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    src.connect(f);
    f.connect(this.env(t + delay, peak, 0.004, dur));
    src.start(t + delay);
    src.stop(t + delay + dur + 0.05);
  }

  pluck(freq, peak = 0.5, delay = 0) {
    const t = this.voice(1 + delay);
    if (t === null) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.pluckBuffer(freq);
    const g = this.ctx.createGain();
    g.gain.value = peak;
    src.connect(g);
    g.connect(this.out);
    src.start(t + delay);
  }

  play(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'till': this.hiss('lowpass', 500, 1, 0.5, 0.12); this.tone('sine', 110, 60, 0.35, 0.12); break;
      case 'water': this.hiss('bandpass', 1400, 2, 0.25, 0.3); this.hiss('bandpass', 2600, 3, 0.12, 0.2, 0.08); break;
      case 'refill': for (let i = 0; i < 4; i++) this.tone('sine', 300 + i * 90, 600 + i * 120, 0.12, 0.07, i * 0.06); break;
      case 'chop': this.tone('triangle', 240, 130, 0.45, 0.08); this.hiss('bandpass', 1800, 4, 0.25, 0.05); break;
      case 'rock': this.tone('square', 1100, 900, 0.12, 0.06); this.hiss('highpass', 3000, 1, 0.25, 0.07); break;
      case 'cut': this.hiss('highpass', 2500, 0.7, 0.3, 0.14); break;
      case 'swing': this.hiss('bandpass', 900, 0.8, 0.12, 0.12); break;
      case 'fall': this.tone('sawtooth', 90, 45, 0.18, 0.5); this.hiss('lowpass', 300, 1, 0.4, 0.4, 0.25); break;
      case 'break': this.tone('triangle', 180, 80, 0.4, 0.15); this.hiss('lowpass', 900, 1, 0.3, 0.2); break;
      case 'plant': this.hiss('lowpass', 700, 1, 0.3, 0.06); this.pluck(660, 0.15, 0.03); break;
      case 'harvest': this.pluck(784, 0.4); this.pluck(1175, 0.3, 0.07); break;
      case 'pickup': this.tone('sine', 880, 1320, 0.12, 0.07); break;
      case 'deny': this.tone('square', 180, 150, 0.1, 0.1); this.tone('square', 140, 120, 0.1, 0.12, 0.1); break;
      case 'ui': this.tone('square', 660, 660, 0.05, 0.03); break;
      case 'ui_ok': this.pluck(587, 0.35); break;
      case 'ui_back': this.pluck(440, 0.3); break;
      case 'step': this.hiss('lowpass', 900, 1, 0.05, 0.04); break;
      case 'sleep': [392, 330, 294, 262].forEach((f, i) => this.pluck(f, 0.3, i * 0.22)); break;
      case 'morning': [523, 659, 784, 1046].forEach((f, i) => this.pluck(f, 0.3, i * 0.15)); break;
      default: break;
    }
  }
}
