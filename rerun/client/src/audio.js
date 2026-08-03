// RERUN — sound.
//
// There is no music. By round five the arena has a rhythmic background of
// distant screams on a twenty-second cycle. That is the soundtrack.

const MAX_CONCURRENT_SCREAMS = 6;

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.active = 0;
    this.muted = false;
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
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get ready() { return !!this.ctx && !this.muted; }

  /**
   * The scream. A short descending oscillator. `distance` fades older, further
   * ghosts down so forty of them is texture rather than an air-raid siren.
   */
  scream(distance = 0, generation = 1) {
    if (!this.ready) return;
    if (this.active >= MAX_CONCURRENT_SCREAMS) return;
    const t = this.ctx.currentTime;
    const dur = 0.72;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(430 + Math.random() * 90, t);
    osc.frequency.exponentialRampToValueAtTime(88, t + dur);

    const wob = this.ctx.createOscillator();
    wob.type = 'sine';
    wob.frequency.value = 11;
    const wobGain = this.ctx.createGain();
    wobGain.gain.value = 26;
    wob.connect(wobGain).connect(osc.frequency);

    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 2400 - Math.min(1800, distance * 90);

    const gain = this.ctx.createGain();
    const far = 1 / (1 + distance * 0.09);
    const old = Math.pow(0.86, Math.max(0, generation - 1));
    const peak = 0.2 * far * old;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(filt).connect(gain).connect(this.master);
    osc.start(t);
    wob.start(t);
    osc.stop(t + dur + 0.02);
    wob.stop(t + dur + 0.02);
    this.active++;
    osc.onended = () => { this.active--; };
  }

  /** The small pop as a new ghost fades in during the settling beat. */
  pop() {
    this.blip(660, 0.09, 'triangle', 0.16, 1180);
  }

  plate() {
    this.blip(880, 0.06, 'square', 0.07);
  }

  beep(high) {
    this.blip(high ? 880 : 520, 0.13, 'triangle', 0.14);
  }

  thud() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.28);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  blip(freq, dur, type, vol, glideTo) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}
