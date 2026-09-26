// Tiny Web Audio synth toolkit shared by SFX, music and voices: envelopes,
// oscillator/noise one-shots and a cached white-noise buffer.

export const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

let noiseBuf = null;
export function noiseBuffer(ctx) {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let seed = 22222;
  for (let i = 0; i < len; i++) { seed = (seed * 16807) % 2147483647; d[i] = (seed / 2147483647) * 2 - 1; }
  return noiseBuf;
}

// Attack/decay envelope on an AudioParam.
export function envelope(param, t, { a = 0.005, d = 0.1, peak = 1, sustain = 0, hold = 0, r = 0.05 } = {}) {
  param.cancelScheduledValues(t);
  param.setValueAtTime(0.0001, t);
  param.linearRampToValueAtTime(peak, t + a);
  if (hold > 0) {
    param.setTargetAtTime(Math.max(0.0001, peak * sustain), t + a, d / 3);
    param.setTargetAtTime(0.0001, t + a + hold, r / 3);
    return t + a + hold + r;
  }
  param.exponentialRampToValueAtTime(0.0001, t + a + d);
  return t + a + d;
}

// Oscillator one-shot with pitch sweep. Returns end time.
export function tone(ctx, dest, t, o) {
  const osc = ctx.createOscillator();
  osc.type = o.type || 'square';
  osc.frequency.setValueAtTime(o.f0, t);
  if (o.f1) {
    if (o.curve === 'lin') osc.frequency.linearRampToValueAtTime(o.f1, t + (o.sweep ?? o.d ?? 0.1));
    else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + (o.sweep ?? o.d ?? 0.1));
  }
  if (o.detune) osc.detune.setValueAtTime(o.detune, t);
  if (o.vib) {
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = o.vib[0]; lg.gain.value = o.vib[1];
    lfo.connect(lg).connect(osc.frequency);
    lfo.start(t); lfo.stop(t + (o.a ?? 0.005) + (o.d ?? 0.1) + (o.hold ?? 0) + 0.3);
  }
  const g = ctx.createGain();
  let node = osc;
  if (o.lp) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q ?? 0.7;
    node.connect(f); node = f;
  }
  node.connect(g).connect(dest);
  const end = envelope(g.gain, t, { a: o.a ?? 0.005, d: o.d ?? 0.1, peak: o.vol ?? 0.3, sustain: o.sustain ?? 0.6, hold: o.hold ?? 0, r: o.r ?? 0.05 });
  osc.start(t);
  osc.stop(end + 0.05);
  return end;
}

// Filtered noise burst with optional filter sweep.
export function noise(ctx, dest, t, o) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = o.filter || 'bandpass';
  f.frequency.setValueAtTime(o.f0 ?? 1000, t);
  if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + (o.sweep ?? o.d ?? 0.1));
  f.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  src.connect(f).connect(g).connect(dest);
  const end = envelope(g.gain, t, { a: o.a ?? 0.003, d: o.d ?? 0.15, peak: o.vol ?? 0.3, sustain: o.sustain ?? 0.5, hold: o.hold ?? 0, r: o.r ?? 0.05 });
  src.start(t, Math.random() * 1.5);
  src.stop(end + 0.05);
  return end;
}

// Arpeggio helper: play a list of [semitoneOffset, delay] notes from a base.
export function arp(ctx, dest, t, base, steps, o) {
  let end = t;
  for (const [semi, dt] of steps) end = Math.max(end, tone(ctx, dest, t + dt, { ...o, f0: base * Math.pow(2, semi / 12) }));
  return end;
}
