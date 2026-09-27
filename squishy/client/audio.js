// Procedural audio: nature beds that crossfade by zone, a sparse koto /
// shakuhachi motif, and soft squishy / chime / bell effects. No asset files.

const KOTO_SCALE = [293.66, 311.13, 392.0, 440.0, 466.16, 587.33, 622.25, 784.0]; // D miyako-bushi

export function createAudio() {
  let ctx = null, master = null, reverb = null, sfxBus = null, musicBus = null;
  let beds = null;
  let muted = false;
  const kotoBufs = [];
  let nextPhrase = 0;
  let lastHop = 0;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);

    reverb = ctx.createConvolver();
    reverb.buffer = impulse(3.2, 2.6);
    const wet = ctx.createGain(); wet.gain.value = 0.35;
    reverb.connect(wet).connect(master);

    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master); musicBus.connect(reverb);
    const sfxVerb = ctx.createGain(); sfxVerb.gain.value = 0.25; sfxBus.connect(sfxVerb).connect(reverb);

    for (const f of KOTO_SCALE) kotoBufs.push(karplus(f, 2.4));
    beds = makeBeds();
    nextPhrase = ctx.currentTime + 4;
  }

  function impulse(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  function noiseBuffer(sec = 3) {
    const len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { // soft pinkish noise
      const w = Math.random() * 2 - 1;
      last = last * 0.96 + w * 0.2;
      d[i] = last * 2.2 + w * 0.15;
    }
    return b;
  }

  function karplus(freq, sec) {
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * sec);
    const b = ctx.createBuffer(1, len, sr);
    const d = b.getChannelData(0);
    const period = Math.round(sr / freq);
    const ring = new Float32Array(period);
    for (let i = 0; i < period; i++) ring[i] = (Math.random() * 2 - 1) * (1 - i / period * 0.5);
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const next = (idx + 1) % period;
      const v = ring[idx];
      ring[idx] = (v + ring[next]) * 0.4985;
      d[i] = v * (i < 40 ? i / 40 : 1);
      idx = next;
    }
    return b;
  }

  function makeBeds() {
    const nb = noiseBuffer(4);
    const loop = (filterType, freq, q, gain) => {
      const src = ctx.createBufferSource();
      src.buffer = nb; src.loop = true;
      src.playbackRate.value = 0.8 + Math.random() * 0.4;
      const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07 + Math.random() * 0.08;
      const lfoG = ctx.createGain(); lfoG.gain.value = gain * 0.35;
      const out = ctx.createGain(); out.gain.value = gain;
      lfo.connect(lfoG).connect(out.gain);
      src.connect(f).connect(out).connect(g).connect(master);
      src.start(ctx.currentTime + Math.random()); lfo.start();
      return g;
    };
    return {
      wind: loop('lowpass', 420, 0.5, 0.22),
      leaves: loop('bandpass', 2800, 0.8, 0.05),
      water: loop('bandpass', 950, 1.4, 0.16),
      bamboo: loop('bandpass', 1700, 2.5, 0.08),
      birdsW: 0, cricketW: 0,
      nextBird: 0, nextCricket: 0,
    };
  }

  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  function tone(freq, { type = 'sine', t = ctx.currentTime, a = 0.005, d = 0.3, peak = 0.3, to = null, bus = sfxBus, detune = 0 } = {}) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + a + d * 0.8);
    const g = ctx.createGain();
    env(g, t, a, peak, d);
    o.connect(g).connect(bus);
    o.start(t); o.stop(t + a + d + 0.05);
  }

  function noiseHit({ t = ctx.currentTime, freq = 800, q = 1, d = 0.2, peak = 0.2, to = null, type = 'bandpass' } = {}) {
    const src = ctx.createBufferSource(); src.buffer = beds ? noiseBufferCache() : noiseBuffer(1);
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + d);
    const g = ctx.createGain(); env(g, t, 0.01, peak, d);
    src.connect(f).connect(g).connect(sfxBus);
    src.start(t, Math.random()); src.stop(t + d + 0.1);
  }
  let _nb = null;
  function noiseBufferCache() { return _nb || (_nb = noiseBuffer(2)); }

  function bellPartials(base, t, dur, peak, ratios = [1, 2.0, 2.76, 4.1, 5.4]) {
    ratios.forEach((r, i) => tone(base * r, { t, a: 0.004, d: dur / (1 + i * 0.6), peak: peak / (1 + i * 0.9), bus: musicBus, detune: (Math.random() - 0.5) * 6 }));
  }

  function pluck(i, t, gain = 0.5) {
    const src = ctx.createBufferSource(); src.buffer = kotoBufs[i];
    const g = ctx.createGain(); g.gain.value = gain;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = (Math.random() - 0.5) * 0.6; src.connect(g).connect(pan).connect(musicBus); }
    else src.connect(g).connect(musicBus);
    src.start(t);
  }

  function shakuhachi(freq, t, dur) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const vib = ctx.createOscillator(); vib.frequency.value = 4.5;
    const vibG = ctx.createGain(); vibG.gain.setValueAtTime(0, t); vibG.gain.linearRampToValueAtTime(freq * 0.012, t + dur * 0.6);
    vib.connect(vibG).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.35);
    g.gain.setValueAtTime(0.09, t + dur - 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const breath = ctx.createBufferSource(); breath.buffer = noiseBufferCache();
    const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = freq * 2; bf.Q.value = 3;
    const bg = ctx.createGain(); bg.gain.value = 0.25;
    breath.connect(bf).connect(bg).connect(g);
    o.connect(g).connect(musicBus);
    o.start(t); vib.start(t); breath.start(t);
    o.stop(t + dur + 0.1); vib.stop(t + dur + 0.1); breath.stop(t + dur + 0.1);
  }

  function phrase(dusk) {
    const t0 = ctx.currentTime + 0.1;
    if (Math.random() < 0.22) {
      const f = KOTO_SCALE[[0, 2, 3, 5][(Math.random() * 4) | 0]] / 2;
      shakuhachi(f, t0, 3 + Math.random() * 2);
      return;
    }
    let idx = (Math.random() * 5) | 0;
    const n = 2 + ((Math.random() * 4) | 0);
    let t = t0;
    for (let i = 0; i < n; i++) {
      pluck(idx, t, 0.35 + Math.random() * 0.2);
      if (Math.random() < 0.25) pluck(Math.max(0, idx - 2), t + 0.02, 0.2);
      idx = Math.max(0, Math.min(KOTO_SCALE.length - 1, idx + [-2, -1, 1, 2, 1][(Math.random() * 5) | 0]));
      t += 0.32 + Math.random() * (0.5 + dusk * 0.3);
    }
  }

  function bird(t) {
    const base = 2600 + Math.random() * 1800;
    const n = 2 + ((Math.random() * 4) | 0);
    for (let i = 0; i < n; i++) {
      const s = t + i * (0.09 + Math.random() * 0.05);
      tone(base * (1 + Math.random() * 0.2), { t: s, a: 0.01, d: 0.07, peak: 0.035, to: base * (0.7 + Math.random() * 0.6), bus: master });
    }
  }

  function cricket(t) {
    const f = 4200 + Math.random() * 500;
    for (let i = 0; i < 3; i++) tone(f, { t: t + i * 0.06, a: 0.005, d: 0.035, peak: 0.018, bus: master });
  }

  // zone weights: [forest, bamboo, pond, approach, courtyard]
  function update(zoneW, dusk, dt) {
    if (!ctx || !beds) return;
    const now = ctx.currentTime;
    const [f, b, p, a, c] = zoneW;
    const set = (g, v) => g.gain.setTargetAtTime(v, now, 0.8);
    set(beds.wind, 0.55 + a * 0.3 + c * 0.2 + f * 0.2);
    set(beds.leaves, f * 0.9 + c * 0.4 * (1 - dusk));
    set(beds.water, p * 1.0 + a * 0.12);
    set(beds.bamboo, b * 1.0);
    const birdRate = (f + b * 0.6 + p * 0.7 + a * 0.5) * (1 - dusk);
    if (now > beds.nextBird && birdRate > 0.05) {
      bird(now);
      beds.nextBird = now + (1.5 + Math.random() * 5) / birdRate;
    }
    if (dusk > 0.3 && now > beds.nextCricket) {
      cricket(now);
      beds.nextCricket = now + 0.3 + Math.random() * 0.9 / dusk;
    }
    if (now > nextPhrase) {
      phrase(dusk);
      nextPhrase = now + 9 + Math.random() * 14;
    }
  }

  const sfx = {
    squish() { const t = ctx.currentTime; tone(560, { t, d: 0.16, peak: 0.28, to: 230 }); noiseHit({ t, freq: 500, q: 2, d: 0.12, peak: 0.08, to: 250 }); },
    unsquish() { tone(260, { d: 0.12, peak: 0.12, to: 520 }); },
    hop(amp) {
      const t = ctx.currentTime;
      if (t - lastHop < 0.12) return;
      lastHop = t;
      tone(170 + Math.random() * 40, { t, d: 0.06, peak: 0.035 * amp, to: 120 });
    },
    land(v) { tone(240, { d: 0.12, peak: Math.min(0.25, 0.05 + v * 0.02), to: 140 }); },
    spring() { const t = ctx.currentTime; tone(180, { t, d: 0.45, peak: 0.25, to: 820, type: 'triangle' }); tone(360, { t: t + 0.02, d: 0.3, peak: 0.08, to: 1200 }); },
    bump() { tone(300, { d: 0.07, peak: 0.08, to: 200 }); },
    splash() { noiseHit({ freq: 1800, q: 0.8, d: 0.5, peak: 0.3, to: 300 }); tone(700, { d: 0.2, peak: 0.08, to: 200 }); },
    plate() { noiseHit({ freq: 300, q: 4, d: 0.1, peak: 0.2 }); tone(150, { d: 0.12, peak: 0.12 }); },
    solve() {
      const t = ctx.currentTime;
      [0, 2, 3, 5, 7].forEach((k, i) => bellPartials(KOTO_SCALE[k], t + i * 0.13, 2.2, 0.12));
    },
    chime() { const t = ctx.currentTime; [2, 5, 7].forEach((k, i) => bellPartials(KOTO_SCALE[k], t + i * 0.16, 2.5, 0.13)); },
    gentle() { const t = ctx.currentTime; [3, 2, 5].forEach((k, i) => bellPartials(KOTO_SCALE[k], t + i * 0.2, 2, 0.1)); },
    retry() { const t = ctx.currentTime; pluck(3, t, 0.5); pluck(1, t + 0.25, 0.5); },
    trivia() { const t = ctx.currentTime; pluck(0, t, 0.5); pluck(2, t + 0.15, 0.5); pluck(5, t + 0.3, 0.5); },
    tap() { tone(880, { d: 0.05, peak: 0.08 }); },
    firefly() { const t = ctx.currentTime; tone(1760, { t, d: 0.25, peak: 0.07 }); tone(2637, { t: t + 0.06, d: 0.3, peak: 0.05 }); },
    stones() { noiseHit({ freq: 600, q: 0.7, d: 1.2, peak: 0.18, to: 200, type: 'lowpass' }); tone(90, { d: 1.0, peak: 0.12, to: 70 }); },
    tick() { noiseHit({ freq: 2400, q: 8, d: 0.04, peak: 0.12 }); },
    bellsolo() {
      const t = ctx.currentTime;
      for (let i = 0; i < 6; i++) tone(2900 + Math.random() * 900, { t: t + i * 0.05, d: 0.18, peak: 0.05, bus: musicBus });
    },
    bell() {
      const t = ctx.currentTime;
      for (let i = 0; i < 14; i++) tone(2800 + Math.random() * 1200, { t: t + i * 0.045, d: 0.25, peak: 0.06, bus: musicBus });
      bellPartials(110, t + 0.3, 7, 0.35, [1, 2.02, 2.41, 2.98, 4.16, 5.43]);
      bellPartials(111.2, t + 0.3, 7, 0.12, [1]);
      [0, 2, 3, 5, 7, 5, 3].forEach((k, i) => pluck(k, t + 1.6 + i * 0.42, 0.45));
    },
  };

  return {
    init,
    update,
    play(name, ...args) { if (ctx && !muted && sfx[name]) sfx[name](...args); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.1);
      return muted;
    },
    get muted() { return muted; },
  };
}
