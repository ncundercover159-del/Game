// Procedural sound effects. Every effect is a function (ctx, dest, t, opts)
// built from the synth primitives, so there are no audio files to ship and
// everything can be re-voiced by editing numbers here.
import { tone, noise, arp } from './synth.js';

const C5 = 523.25;

export const SFX = {
  // --- UI -----------------------------------------------------------------------------
  click: (c, d, t) => tone(c, d, t, { type: 'square', f0: 880, f1: 1320, d: 0.05, vol: 0.12, lp: 4000 }),
  hover: (c, d, t) => tone(c, d, t, { type: 'triangle', f0: 1200, d: 0.03, vol: 0.05 }),
  back: (c, d, t) => tone(c, d, t, { type: 'square', f0: 660, f1: 330, d: 0.08, vol: 0.12, lp: 3000 }),
  confirm: (c, d, t) => arp(c, d, t, C5, [[0, 0], [4, 0.06], [7, 0.12], [12, 0.18]], { type: 'square', d: 0.12, vol: 0.12, lp: 5000 }),
  error: (c, d, t) => arp(c, d, t, 220, [[0, 0], [-1, 0.1]], { type: 'square', d: 0.12, vol: 0.12, lp: 2000 }),
  unlock: (c, d, t) => arp(c, d, t, C5, [[0, 0], [4, 0.08], [7, 0.16], [12, 0.24], [16, 0.32], [19, 0.4]], { type: 'triangle', d: 0.3, vol: 0.2 }),
  purchase: (c, d, t) => { arp(c, d, t, 1318, [[0, 0], [7, 0.07]], { type: 'square', d: 0.15, vol: 0.12 }); return noise(c, d, t, { filter: 'highpass', f0: 6000, d: 0.2, vol: 0.06 }); },

  // --- race flow ------------------------------------------------------------------------
  countdown: (c, d, t) => tone(c, d, t, { type: 'square', f0: 440, d: 0.3, hold: 0.25, vol: 0.2, lp: 3000 }),
  go: (c, d, t) => { tone(c, d, t, { type: 'square', f0: 880, d: 0.6, hold: 0.5, vol: 0.2, lp: 4000 }); return tone(c, d, t, { type: 'square', f0: 1320, d: 0.6, hold: 0.5, vol: 0.1, lp: 4000 }); },
  lap: (c, d, t) => arp(c, d, t, 784, [[0, 0], [5, 0.09], [9, 0.18]], { type: 'square', d: 0.16, vol: 0.14, lp: 5000 }),
  finalLap: (c, d, t) => arp(c, d, t, 587, [[0, 0], [0, 0.12], [0, 0.24], [5, 0.36], [9, 0.48], [12, 0.6]], { type: 'square', d: 0.14, vol: 0.16, lp: 5000 }),
  finish: (c, d, t) => arp(c, d, t, C5, [[0, 0], [4, 0.1], [7, 0.2], [12, 0.3], [7, 0.45], [12, 0.55], [16, 0.7]], { type: 'square', d: 0.2, vol: 0.15, lp: 5000 }),
  wrongWay: (c, d, t) => arp(c, d, t, 330, [[0, 0], [-3, 0.15]], { type: 'sawtooth', d: 0.14, vol: 0.1, lp: 1500 }),
  rocket: (c, d, t) => { noise(c, d, t, { filter: 'bandpass', f0: 600, f1: 3000, d: 0.6, q: 1.2, vol: 0.3 }); return tone(c, d, t, { type: 'sawtooth', f0: 200, f1: 900, d: 0.5, vol: 0.12, lp: 2500 }); },
  burnout: (c, d, t) => { noise(c, d, t, { filter: 'lowpass', f0: 800, d: 0.5, vol: 0.3 }); return tone(c, d, t, { type: 'sawtooth', f0: 120, f1: 60, d: 0.5, vol: 0.15, lp: 800 }); },

  // --- driving ----------------------------------------------------------------------------
  hop: (c, d, t) => tone(c, d, t, { type: 'square', f0: 300, f1: 520, d: 0.07, vol: 0.08, lp: 2500 }),
  land: (c, d, t, o = {}) => noise(c, d, t, { filter: 'lowpass', f0: 400 + (o.air || 0) * 200, f1: 80, d: 0.18 + Math.min(0.3, (o.air || 0) * 0.2), vol: Math.min(0.5, 0.15 + (o.air || 0) * 0.2) }),
  mtTier: (c, d, t, o = {}) => tone(c, d, t, { type: 'triangle', f0: [0, 900, 1200, 1600][o.tier || 1], d: 0.08, vol: 0.12 }),
  miniTurbo: (c, d, t, o = {}) => {
    const tier = o.tier || 1;
    noise(c, d, t, { filter: 'bandpass', f0: 800 + tier * 500, f1: 3500, d: 0.25 + tier * 0.12, q: 1.5, vol: 0.18 + tier * 0.05 });
    return tone(c, d, t, { type: 'sawtooth', f0: 220 + tier * 60, f1: 700 + tier * 200, d: 0.3 + tier * 0.1, vol: 0.08, lp: 3000 });
  },
  boost: (c, d, t) => { noise(c, d, t, { filter: 'bandpass', f0: 500, f1: 2500, d: 0.7, q: 0.8, vol: 0.28 }); return tone(c, d, t, { type: 'sawtooth', f0: 150, f1: 600, d: 0.6, vol: 0.1, lp: 2000 }); },
  pad: (c, d, t) => { arp(c, d, t, 660, [[0, 0], [7, 0.04], [12, 0.08]], { type: 'square', d: 0.07, vol: 0.07 }); return noise(c, d, t, { filter: 'bandpass', f0: 1000, f1: 3000, d: 0.5, vol: 0.2 }); },
  trick: (c, d, t) => arp(c, d, t, 988, [[0, 0], [5, 0.05], [12, 0.1]], { type: 'square', d: 0.08, vol: 0.1, lp: 5000 }),
  glider: (c, d, t) => { noise(c, d, t, { filter: 'bandpass', f0: 300, f1: 1200, d: 0.8, q: 0.7, vol: 0.2 }); return tone(c, d, t, { type: 'triangle', f0: 400, f1: 800, d: 0.3, vol: 0.08 }); },
  wallHit: (c, d, t, o = {}) => { const v = Math.min(0.45, 0.08 + (o.impact || 5) * 0.02); noise(c, d, t, { filter: 'lowpass', f0: 1500, f1: 200, d: 0.15, vol: v }); return tone(c, d, t, { type: 'square', f0: 110, f1: 60, d: 0.1, vol: v * 0.5, lp: 600 }); },
  bump: (c, d, t) => { noise(c, d, t, { filter: 'lowpass', f0: 900, f1: 200, d: 0.1, vol: 0.2 }); return tone(c, d, t, { type: 'triangle', f0: 180, f1: 90, d: 0.1, vol: 0.2 }); },
  splash: (c, d, t) => noise(c, d, t, { filter: 'bandpass', f0: 2000, f1: 400, d: 0.6, q: 0.6, vol: 0.3 }),
  rescue: (c, d, t) => arp(c, d, t, 660, [[12, 0], [7, 0.1], [4, 0.2], [0, 0.3]], { type: 'triangle', d: 0.16, vol: 0.14 }),
  respawn: (c, d, t) => arp(c, d, t, 523, [[0, 0], [7, 0.08], [12, 0.16]], { type: 'triangle', d: 0.14, vol: 0.12 }),

  // --- items -----------------------------------------------------------------------------
  itemBox: (c, d, t) => { noise(c, d, t, { filter: 'highpass', f0: 3000, d: 0.12, vol: 0.12 }); return arp(c, d, t, 784, [[0, 0], [4, 0.04], [7, 0.08], [12, 0.12]], { type: 'square', d: 0.08, vol: 0.09, lp: 6000 }); },
  roulette: (c, d, t) => tone(c, d, t, { type: 'square', f0: 1400, d: 0.025, vol: 0.05 }),
  itemReady: (c, d, t) => arp(c, d, t, 1046, [[0, 0], [7, 0.06]], { type: 'square', d: 0.1, vol: 0.1 }),
  throw: (c, d, t) => noise(c, d, t, { filter: 'bandpass', f0: 1800, f1: 600, d: 0.18, q: 2, vol: 0.18 }),
  drop: (c, d, t) => tone(c, d, t, { type: 'triangle', f0: 400, f1: 200, d: 0.12, vol: 0.12 }),
  homing: (c, d, t) => tone(c, d, t, { type: 'square', f0: 1500, d: 0.05, vol: 0.06, lp: 4000 }),
  hit: (c, d, t) => { noise(c, d, t, { filter: 'bandpass', f0: 1200, f1: 300, d: 0.35, q: 0.8, vol: 0.3 }); return tone(c, d, t, { type: 'square', f0: 600, f1: 90, d: 0.4, vol: 0.14, lp: 2500 }); },
  spinOut: (c, d, t) => tone(c, d, t, { type: 'sawtooth', f0: 800, f1: 200, d: 0.6, vol: 0.1, lp: 2000, vib: [18, 60] }),
  explosion: (c, d, t, o = {}) => { const big = o.big ? 1.6 : 1; noise(c, d, t, { filter: 'lowpass', f0: 2500, f1: 60, d: 0.9 * big, vol: 0.45 }); return tone(c, d, t, { type: 'sine', f0: 90, f1: 30, d: 0.8 * big, vol: 0.4 }); },
  shield: (c, d, t) => tone(c, d, t, { type: 'triangle', f0: 1200, f1: 2400, d: 0.2, vol: 0.12, vib: [30, 40] }),
  bounce: (c, d, t) => tone(c, d, t, { type: 'square', f0: 500, f1: 900, d: 0.06, vol: 0.06 }),
  pop: (c, d, t) => { noise(c, d, t, { filter: 'highpass', f0: 1500, d: 0.08, vol: 0.2 }); return tone(c, d, t, { type: 'sine', f0: 900, f1: 200, d: 0.1, vol: 0.12 }); },
  coin: (c, d, t) => arp(c, d, t, 1976, [[0, 0], [5, 0.06]], { type: 'square', d: 0.12, vol: 0.07, lp: 7000 }),
  coinLose: (c, d, t) => arp(c, d, t, 1318, [[0, 0], [-5, 0.05], [-10, 0.1]], { type: 'square', d: 0.08, vol: 0.06 }),
  bolt: (c, d, t) => { noise(c, d, t, { filter: 'highpass', f0: 2000, d: 0.5, vol: 0.4 }); return tone(c, d, t, { type: 'sawtooth', f0: 2000, f1: 60, d: 0.6, vol: 0.2 }); },
  ink: (c, d, t) => noise(c, d, t, { filter: 'lowpass', f0: 600, f1: 150, d: 0.5, q: 3, vol: 0.3 }),
  star: (c, d, t) => arp(c, d, t, 1046, [[0, 0], [4, 0.05], [7, 0.1], [12, 0.15], [16, 0.2], [19, 0.25]], { type: 'square', d: 0.08, vol: 0.08 }),
  horn: (c, d, t) => { tone(c, d, t, { type: 'sawtooth', f0: 233, d: 0.6, hold: 0.4, vol: 0.2, lp: 1500 }); return tone(c, d, t, { type: 'sawtooth', f0: 311, d: 0.6, hold: 0.4, vol: 0.14, lp: 1500 }); },
  shrink: (c, d, t) => tone(c, d, t, { type: 'square', f0: 1200, f1: 300, d: 0.5, vol: 0.1, vib: [12, 50] }),
  grow: (c, d, t) => tone(c, d, t, { type: 'square', f0: 300, f1: 1200, d: 0.5, vol: 0.1, vib: [12, 50] }),
  magic: (c, d, t) => { arp(c, d, t, 1318, [[0, 0], [3, 0.05], [7, 0.1], [10, 0.15], [14, 0.2]], { type: 'triangle', d: 0.25, vol: 0.1 }); return noise(c, d, t, { filter: 'highpass', f0: 5000, d: 0.4, vol: 0.05 }); },
  whoosh: (c, d, t) => noise(c, d, t, { filter: 'bandpass', f0: 400, f1: 2400, d: 0.35, q: 1.2, vol: 0.2 }),
  zap: (c, d, t) => tone(c, d, t, { type: 'sawtooth', f0: 1800, f1: 300, d: 0.15, vol: 0.12, vib: [60, 200] }),
  rumble: (c, d, t) => noise(c, d, t, { filter: 'lowpass', f0: 250, f1: 60, d: 1.0, vol: 0.4 }),
  flame: (c, d, t) => noise(c, d, t, { filter: 'bandpass', f0: 700, f1: 1500, d: 0.5, q: 0.7, vol: 0.25 }),
  wave: (c, d, t) => noise(c, d, t, { filter: 'lowpass', f0: 3000, f1: 300, d: 1.0, vol: 0.3 }),
  vine: (c, d, t) => tone(c, d, t, { type: 'triangle', f0: 200, f1: 500, d: 0.3, vol: 0.12, vib: [8, 30] }),
  tunnel: (c, d, t) => noise(c, d, t, { filter: 'lowpass', f0: 400, d: 0.6, vol: 0.3 }),
  cometWarn: (c, d, t) => arp(c, d, t, 880, [[0, 0], [0, 0.25], [0, 0.5]], { type: 'square', d: 0.15, vol: 0.12, lp: 3000 }),
  treasure: (c, d, t) => arp(c, d, t, 784, [[0, 0], [4, 0.1], [7, 0.2], [11, 0.3], [12, 0.4], [16, 0.55]], { type: 'triangle', d: 0.35, vol: 0.18 }),

  // --- hazards ---------------------------------------------------------------------------
  geyser: (c, d, t) => noise(c, d, t, { filter: 'bandpass', f0: 500, f1: 1500, d: 1.1, q: 0.5, vol: 0.3 }),
  crusher: (c, d, t) => { noise(c, d, t, { filter: 'lowpass', f0: 800, f1: 80, d: 0.4, vol: 0.5 }); return tone(c, d, t, { type: 'square', f0: 80, f1: 40, d: 0.3, vol: 0.3, lp: 400 }); },
  laser: (c, d, t) => tone(c, d, t, { type: 'sawtooth', f0: 1600, f1: 1400, d: 0.3, vol: 0.08, vib: [40, 60], lp: 5000 }),
  ghost: (c, d, t) => tone(c, d, t, { type: 'sine', f0: 500, f1: 300, d: 0.8, vol: 0.12, vib: [6, 40] }),
  door: (c, d, t) => noise(c, d, t, { filter: 'lowpass', f0: 500, f1: 150, d: 0.5, vol: 0.25 }),
};
