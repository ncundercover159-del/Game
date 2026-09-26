// Formant-synth "barks": short gibberish reactions voiced per racer from the
// racer's data ({ pitch, formant, rasp }). A pulse/saw source goes through
// three band-pass formant filters that glide between vowels; the formant
// preset shapes the source (robotic ring-mod, ghoulish vibrato, bubbly
// warble...). Each reaction also has a caption for subtitles.
import { noiseBuffer } from './synth.js';

const VOWELS = {
  a: [800, 1150, 2900], e: [450, 1800, 2700], i: [300, 2300, 3000], o: [480, 820, 2800], u: [330, 700, 2500],
};

// reaction -> syllables [vowel, duration, pitch multiplier start, end] + caption
const BARKS = {
  whoo:   { syl: [['u', 0.12, 1.0, 1.5], ['o', 0.22, 1.5, 1.8]], text: 'Whoo-hoo!' },
  cheer:  { syl: [['e', 0.1, 1.1, 1.3], ['a', 0.25, 1.4, 1.2]], text: 'Yeah!' },
  roar:   { syl: [['a', 0.45, 0.8, 0.6]], rasp: 0.5, text: 'RAAWR!' },
  growl:  { syl: [['o', 0.35, 0.6, 0.55]], rasp: 0.6, trem: 28, text: 'Grrr…' },
  yelp:   { syl: [['i', 0.14, 1.7, 1.1]], text: 'Yipe!' },
  huff:   { syl: [['u', 0.25, 0.9, 0.7]], breath: 0.7, text: 'Hmph.' },
  smirk:  { syl: [['e', 0.08, 1.2, 1.2], ['e', 0.1, 1.0, 1.0], ['e', 0.12, 1.2, 1.4]], text: 'Heh heh!' },
  laugh:  { syl: [['a', 0.09, 1.3, 1.3], ['a', 0.09, 1.2, 1.2], ['a', 0.12, 1.1, 1.0]], text: 'Ha-ha-ha!' },
  oof:    { syl: [['u', 0.16, 1.0, 0.7]], text: 'Oof!' },
  wah:    { syl: [['u', 0.08, 1.0, 1.0], ['a', 0.35, 1.1, 0.7]], text: 'Waaah!' },
  hey:    { syl: [['e', 0.08, 1.1, 1.1], ['i', 0.18, 1.3, 1.1]], text: 'Hey!' },
  letsgo: { syl: [['e', 0.1, 1.0, 1.0], ['o', 0.28, 1.2, 1.4]], text: "Let's go!" },
  boo:    { syl: [['u', 0.4, 1.3, 0.9]], trem: 6, text: 'Boooo!' },
  beep:   { syl: [['i', 0.07, 1.4, 1.4], ['o', 0.07, 1.0, 1.0], ['i', 0.12, 1.6, 1.6]], text: 'Beep-boop!' },
};
const ALIASES = { select: 'letsgo', taunt: 'laugh', win: 'cheer', lose: 'huff', hit: 'oof', boost: 'whoo', item: 'smirk', overtake: 'smirk' };

// Character presets keyed by racer voice.formant
const PRESETS = {
  dragon:  { f: 1.0, src: 'sawtooth', base: 190 },
  robotic: { f: 1.05, src: 'square', base: 170, ring: 55 },
  grumble: { f: 0.85, src: 'sawtooth', base: 140 },
  squeaky: { f: 1.25, src: 'square', base: 260 },
  chuckle: { f: 1.0, src: 'sawtooth', base: 180, trem: 9 },
  bubbly:  { f: 1.1, src: 'triangle', base: 220, vib: 14 },
  goofy:   { f: 1.15, src: 'square', base: 230, vib: 7 },
  ghoul:   { f: 0.9, src: 'sawtooth', base: 150, vib: 5, breath: 0.4 },
  creak:   { f: 0.8, src: 'sawtooth', base: 120, trem: 18 },
  hoot:    { f: 0.95, src: 'triangle', base: 200 },
  airy:    { f: 1.2, src: 'triangle', base: 240, breath: 0.5 },
  rumble:  { f: 0.75, src: 'sawtooth', base: 110 },
  sweet:   { f: 1.25, src: 'triangle', base: 270 },
  purr:    { f: 0.9, src: 'sawtooth', base: 150, trem: 22 },
};

export function barkCaption(reaction) {
  const b = BARKS[reaction] || BARKS[ALIASES[reaction]];
  return b?.text || '';
}

// Play a bark. voice = racer.voice, reaction = e.g. 'whoo' | 'hit' (alias), dest = output node.
export function playBark(ctx, dest, t, voice = {}, reaction = 'cheer', gain = 1) {
  const b = BARKS[reaction] || BARKS[ALIASES[reaction]] || BARKS.cheer;
  const p = PRESETS[voice.formant] || PRESETS.dragon;
  const pitch = (voice.pitch ?? 1) * p.base * (0.95 + Math.random() * 0.1);
  const out = ctx.createGain();
  out.gain.value = 0.0001;
  out.connect(dest);
  // source
  const osc = ctx.createOscillator();
  osc.type = p.src;
  let src = osc;
  if (p.ring) {
    // ring modulation for robots
    const rm = ctx.createGain(); rm.gain.value = 0;
    const mod = ctx.createOscillator(); mod.frequency.value = p.ring;
    mod.connect(rm.gain); osc.connect(rm);
    mod.start(t); mod.stop(t + 1.5);
    src = rm;
  }
  if (p.vib) {
    const l = ctx.createOscillator(), lg = ctx.createGain();
    l.frequency.value = p.vib; lg.gain.value = pitch * 0.05;
    l.connect(lg).connect(osc.frequency); l.start(t); l.stop(t + 1.5);
  }
  // formant bank
  const mix = ctx.createGain(); mix.gain.value = 1;
  const filters = [0, 1, 2].map((k) => {
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = [6, 9, 12][k];
    const g = ctx.createGain(); g.gain.value = [1, 0.6, 0.25][k];
    src.connect(f).connect(g).connect(mix);
    return f;
  });
  // rasp / breath noise
  const rasp = Math.max(voice.rasp ?? 0, b.rasp ?? 0);
  const breath = Math.max(b.breath ?? 0, p.breath ?? 0);
  let nsrc = null;
  if (rasp > 0 || breath > 0) {
    nsrc = ctx.createBufferSource(); nsrc.buffer = noiseBuffer(ctx); nsrc.loop = true;
    const ng = ctx.createGain(); ng.gain.value = rasp * 0.5 + breath * 0.8;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1500; nf.Q.value = 0.8;
    nsrc.connect(nf).connect(ng).connect(mix);
  }
  // tremolo (growls, chuckles)
  const trem = b.trem || p.trem;
  let post = mix;
  if (trem) {
    const tg = ctx.createGain(); tg.gain.value = 0.6;
    const l = ctx.createOscillator(), lg = ctx.createGain();
    l.frequency.value = trem; lg.gain.value = 0.4;
    l.connect(lg).connect(tg.gain); l.start(t); l.stop(t + 1.5);
    mix.connect(tg); post = tg;
  }
  post.connect(out);
  // syllables
  let tt = t;
  const vol = 0.5 * gain;
  for (const [v, dur, p0, p1] of b.syl) {
    const fm = VOWELS[v];
    osc.frequency.setValueAtTime(pitch * p0, tt);
    osc.frequency.exponentialRampToValueAtTime(pitch * p1, tt + dur);
    filters.forEach((f, k) => f.frequency.setTargetAtTime(fm[k] * p.f * (0.85 + (voice.pitch ?? 1) * 0.15), tt, 0.02));
    out.gain.setTargetAtTime(vol, tt, 0.012);
    out.gain.setTargetAtTime(vol * 0.35, tt + dur * 0.8, 0.02);
    tt += dur + 0.025;
  }
  out.gain.setTargetAtTime(0.0001, tt, 0.03);
  osc.start(t); osc.stop(tt + 0.25);
  nsrc?.start(t, Math.random()); nsrc?.stop(tt + 0.25);
  return b.text;
}

export { BARKS };
