// RERUN 2D — sound.
//
// There is no music. By the tenth exposure the tower has a rhythmic
// background of distant screams on a twenty-second cycle. That is the
// soundtrack.

const MAX_SCREAMS = 6;

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.active = 0;
  }

  /** Must be called inside a user gesture. */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get ready() { return !!this.ctx; }

  /** A short descending oscillator. `age` fades older exposures into texture. */
  scream(age = 1, near = 1) {
    if (!this.ready || this.active >= MAX_SCREAMS) return;
    const t = this.ctx.currentTime;
    const dur = 0.72;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(430 + Math.random() * 90, t);
    osc.frequency.exponentialRampToValueAtTime(88, t + dur);

    const wob = this.ctx.createOscillator();
    wob.type = 'sine';
    wob.frequency.value = 11;
    const wg = this.ctx.createGain();
    wg.gain.value = 26;
    wob.connect(wg).connect(osc.frequency);

    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 2400 - Math.min(1900, (age - 1) * 190);

    const gain = this.ctx.createGain();
    const peak = 0.2 * near * Math.pow(0.9, Math.max(0, age - 1));
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(filt).connect(gain).connect(this.master);
    osc.start(t); wob.start(t);
    osc.stop(t + dur + 0.02); wob.stop(t + dur + 0.02);
    this.active++;
    osc.onended = () => { this.active--; };
  }

  /** The shutter: a new exposure lands. */
  shutter() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const n = this.ctx.createBufferSource();
    const len = Math.floor(this.ctx.sampleRate * 0.06);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    n.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.value = 0.5;
    n.connect(f).connect(g).connect(this.master);
    n.start(t);
  }

  /** A short bright shear, then the scream on top of it. */
  stab() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const n = this.ctx.createBufferSource();
    const len = Math.floor(this.ctx.sampleRate * 0.09);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    n.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 3200;
    const g = this.ctx.createGain();
    g.gain.value = 0.42;
    n.connect(f).connect(g).connect(this.master);
    n.start(t);
    this.blip(1500, 0.07, 'square', 0.07, 320);
  }

  blip(freq, dur, type, vol, glide) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  beep(high) { this.blip(high ? 880 : 520, 0.13, 'triangle', 0.13); }
  plate() { this.blip(920, 0.05, 'square', 0.05); }
}
