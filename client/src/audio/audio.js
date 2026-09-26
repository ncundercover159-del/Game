// AudioManager: Web Audio graph, procedural music, SFX, engines and voice barks.
//
//   master -> compressor -> destination
//     ├ music bus  (MusicPlayer layers: base/lead/pad/drums + drift arpeggio)
//     ├ sfx bus    (one-shots, positional by distance/angle to the listener kart)
//     ├ engine bus (local engine + skid/dirt/spark loops + 3 nearest rival engines)
//     └ voice bus  (formant barks, captioned when subtitles are on)
//
// The context is created on the first user gesture (browser autoplay rules).
import { SFX } from './sfx.js';
import { MusicPlayer } from './music.js';
import { playBark, barkCaption } from './voice.js';
import { noiseBuffer } from './synth.js';
import { settings, onSettings } from '../core/settings.js';
import { uiSound } from '../ui/ui.js';
import { getData, getRacer } from '@shared/data/registry.js';
import { hazardState } from '@shared/track/hazardState.js';
import { wrapAngle } from '@shared/math.js';

const ITEM_SFX = {
  star: 'star', horn: 'horn', shroom: 'boost', shroom3: 'boost', goldShroom: 'boost', magnet: 'magic', swap: 'magic',
  flame: 'flame', eruption: 'rumble', wave: 'wave', boulder: 'rumble', tunnel: 'tunnel', tornado: 'whoosh', vine: 'vine',
  roots: 'vine', emp: 'zap', flash: 'zap', clone: 'magic', drone: 'zap', harpoon: 'whoosh', tongue: 'whoosh', flail: 'whoosh',
  coinPack: 'coin', comet: 'cometWarn', ink: 'ink', bolt: 'bolt',
};
const OFFROAD = new Set(['offroad', 'sand', 'snow', 'water']);
const HAZARD_SFX = { geyser: 'geyser', crusher: 'crusher', laser: 'laser', ghost: 'ghost', boulder: 'rumble', carousel: 'bump', door: 'door' };

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.pendingMusic = null;
    this.last = new Map();       // rate limiting per sfx
    this.hazPrev = new Map();
    this.barkCd = 0;
    this.onCaption = null;
    this.paused = false;
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, { once: false, passive: true });
    window.addEventListener('keydown', unlock, { once: false });
    this._unlockListeners = unlock;
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend(); else this.ctx.resume();
    });
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { console.warn('[audio] Web Audio not supported'); return; }
    const ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4;
    comp.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.connect(comp);
    const bus = () => { const g = ctx.createGain(); g.connect(this.master); return g; };
    this.musicBus = bus(); this.sfxBus = bus(); this.engineBus = bus(); this.voiceBus = bus();
    this.music = new MusicPlayer(ctx, this.musicBus);
    this.applyVolumes();
    onSettings(() => this.applyVolumes());
    // UI click sounds for every button
    uiSound.click = () => this.play('click');
    uiSound.back = () => this.play('back');
    uiSound.hover = () => this.play('hover');
    uiSound.confirm = () => this.play('confirm');
    if (this.pendingMusic) this.playMusic(this.pendingMusic);
    if (this.raceDef) this.buildEngines();
    window.removeEventListener('pointerdown', this._unlockListeners);
    window.removeEventListener('keydown', this._unlockListeners);
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = settings();
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.masterVolume ?? 0.9, t, 0.05);
    this.musicBus.gain.setTargetAtTime((s.musicVolume ?? 0.6) * 0.5, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfxVolume ?? 0.9, t, 0.05);
    this.engineBus.gain.setTargetAtTime((s.sfxVolume ?? 0.9) * 0.8, t, 0.05);
    this.voiceBus.gain.setTargetAtTime(s.voiceVolume ?? 0.8, t, 0.05);
  }

  // ---------------------------------------------------------------------------------
  play(name, opts = {}, gain = 1, pan = 0) {
    const ctx = this.ctx;
    const fn = SFX[name];
    if (!ctx || !fn || gain < 0.02) return;
    const now = ctx.currentTime;
    const key = name + (opts.key || '');
    if (now - (this.last.get(key) || 0) < (opts.minGap ?? 0.04)) return;
    this.last.set(key, now);
    let dest = this.sfxBus;
    if (gain < 0.99 || pan) {
      const g = ctx.createGain(); g.gain.value = gain;
      if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p).connect(this.sfxBus); }
      else g.connect(this.sfxBus);
      dest = g;
      setTimeout(() => g.disconnect(), 3000);
    }
    fn(ctx, dest, now + 0.005, opts);
  }

  playMusic(name) {
    this.pendingMusic = name;
    if (!this.ctx) return;
    const song = getData().songs?.[name] || getData().songs?.skyland;
    if (!song) { console.warn('[audio] missing song', name); return; }
    this.music.play(song);
    this.music.setTempo(1);
  }

  startRace(def) {
    this.raceDef = def;
    this.finalLap = false;
    this.playMusic(def.music || def.cup || (def.type === 'arena' ? 'battle' : 'skyland'));
    this.buildEngines();
  }

  pause(p) {
    this.paused = p;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineBus.gain.setTargetAtTime(p ? 0 : (settings().sfxVolume ?? 0.9) * 0.8, t, 0.05);
    this.music.out.gain.setTargetAtTime(p ? 0.3 : 1, t, 0.1);
  }

  // ---------------------------------------------------------------------------------
  // Engines: a local engine voice + drift/offroad/spark loops, and 3 pooled rival voices.
  buildEngines() {
    const ctx = this.ctx;
    if (!ctx) return;
    this.disposeEngines();
    const mk = (withLoops) => {
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      o1.type = 'sawtooth'; o2.type = 'square';
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 2;
      const g = ctx.createGain(); g.gain.value = 0;
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      o1.connect(lp); o2.connect(lp); lp.connect(g);
      if (pan) g.connect(pan).connect(this.engineBus); else g.connect(this.engineBus);
      o1.start(); o2.start();
      const v = { o1, o2, lp, g, pan };
      if (withLoops) {
        const loop = (type, f, q) => {
          const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx); src.loop = true;
          const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
          const lg = ctx.createGain(); lg.gain.value = 0;
          src.connect(fl).connect(lg).connect(this.engineBus); src.start();
          return { src, fl, g: lg };
        };
        v.skid = loop('bandpass', 1100, 2.2);
        v.dirt = loop('lowpass', 260, 1);
        v.spark = loop('highpass', 3500, 0.7);
        v.wind = loop('bandpass', 500, 0.5);
      }
      return v;
    };
    this.local = mk(true);
    this.rivals = [mk(false), mk(false), mk(false)];
  }

  disposeEngines() {
    const kill = (v) => {
      if (!v) return;
      try { v.o1.stop(); v.o2.stop(); for (const l of [v.skid, v.dirt, v.spark, v.wind]) l?.src.stop(); } catch { /* already stopped */ }
      v.g.disconnect();
    };
    kill(this.local);
    for (const r of this.rivals || []) kill(r);
    this.local = null; this.rivals = [];
  }

  endRace() {
    this.raceDef = null;
    this.disposeEngines();
  }

  updateRace(session, k, dt) {
    const ctx = this.ctx;
    if (!ctx || !this.local || this.paused) return;
    const t = ctx.currentTime;
    const sp = Math.abs(k.speed);
    const racing = true;
    // local engine
    const boost = k.boostTime > 0 ? 1 : 0;
    const f = 42 + sp * 2.9 + boost * 25 + (k.drift ? 8 : 0);
    const L = this.local;
    L.o1.frequency.setTargetAtTime(f, t, 0.05);
    L.o2.frequency.setTargetAtTime(f * 0.501, t, 0.05);
    L.lp.frequency.setTargetAtTime(350 + sp * 45 + boost * 900, t, 0.08);
    L.g.gain.setTargetAtTime(racing ? 0.09 + Math.min(0.08, sp * 0.0025) + boost * 0.04 : 0, t, 0.1);
    const air = !k.grounded;
    L.skid.g.gain.setTargetAtTime(k.drift && !air ? 0.11 : 0, t, 0.05);
    L.skid.fl.frequency.setTargetAtTime(900 + (k.driftTier || 0) * 250, t, 0.05);
    L.dirt.g.gain.setTargetAtTime(!air && OFFROAD.has(k.surface) && sp > 4 ? 0.22 : 0, t, 0.08);
    L.spark.g.gain.setTargetAtTime(k.drift && k.driftTier > 0 ? 0.02 + k.driftTier * 0.02 : 0, t, 0.04);
    L.spark.fl.frequency.setTargetAtTime(3000 + (k.driftTier || 0) * 1500, t, 0.05);
    L.wind.g.gain.setTargetAtTime(air || k.glider ? 0.12 : Math.max(0, (sp - 25) * 0.004), t, 0.2);
    // music: drift arpeggio layer + final-lap tempo
    this.music.setLayer('drift', k.drift ? 1 : 0, k.drift ? 0.15 : 0.6);
    // rival engines: 3 nearest, panned by angle, attenuated by distance
    const others = session.karts.filter((o) => o !== k && !o.eliminated)
      .map((o) => ({ o, d: Math.hypot(o.x - k.x, o.z - k.z) })).sort((a, b) => a.d - b.d).slice(0, 3);
    this.rivals.forEach((v, i) => {
      const e = others[i];
      if (!e || e.d > 70) { v.g.gain.setTargetAtTime(0, t, 0.2); return; }
      const osp = Math.abs(e.o.speed);
      const rf = 45 + osp * 2.7 + (e.o.boostTime > 0 ? 25 : 0);
      v.o1.frequency.setTargetAtTime(rf, t, 0.08);
      v.o2.frequency.setTargetAtTime(rf * 0.502, t, 0.08);
      v.lp.frequency.setTargetAtTime(300 + osp * 30, t, 0.1);
      v.g.gain.setTargetAtTime(0.06 / (1 + e.d / 8), t, 0.1);
      if (v.pan) v.pan.pan.setTargetAtTime(this.panFor(k, e.o.x, e.o.z), t, 0.1);
    });
    // hazards: play their cue when they fire near the listener
    const w = session.world;
    if (w.hazards?.length) {
      for (const h of w.hazards) {
        if (h.x === undefined || !(h.type in HAZARD_SFX) || h.type === 'boulder') continue;
        const d = Math.hypot(h.x - k.x, h.z - k.z);
        const st = hazardState(h, w.time || 0, w.hazardRace);
        const was = this.hazPrev.get(h) || false;
        this.hazPrev.set(h, st.active);
        if (st.active && !was && d < 70 && h.type !== 'ghost' && h.type !== 'carousel') this.play(HAZARD_SFX[h.type], { key: h.id }, 1 / (1 + d / 18), this.panFor(k, h.x, h.z));
      }
    }
    this.barkCd -= dt;
  }

  panFor(k, x, z) {
    const a = wrapAngle(Math.atan2(x - k.x, z - k.z) - k.yaw);
    return Math.max(-0.9, Math.min(0.9, -Math.sin(a))); // positive angle = to the left
  }

  // ---------------------------------------------------------------------------------
  onEvents(events, session) {
    if (!this.ctx) return;
    const me = session.localId;
    const listener = session.localKart?.() || session.karts?.[0];
    const at = (e) => {
      if (e.id == null || e.id === me || !listener) return [1, 0];
      const o = session.race.kart(e.id);
      if (!o) return [1, 0];
      const d = Math.hypot(o.x - listener.x, o.z - listener.z);
      return [d > 90 ? 0 : 0.8 / (1 + d / 14), this.panFor(listener, o.x, o.z)];
    };
    for (const e of events) {
      const mine = e.id === me;
      const [g, pan] = at(e);
      switch (e.type) {
        case 'countdown': this.play('countdown', { minGap: 0.3 }); break;
        case 'go': this.play('go'); this.music.out.gain.setTargetAtTime(1, this.ctx.currentTime, 0.1); break;
        case 'startBoost': if (mine) { this.play('rocket'); this.barkLocal(session, 'boost'); } break;
        case 'burnout': if (mine) this.play('burnout'); break;
        case 'lap':
          if (mine) {
            if (e.final) { this.play('finalLap'); this.music.setTempo(1.12); this.finalLap = true; } else this.play('lap');
          }
          break;
        case 'finish':
          if (mine) {
            this.play('finish');
            this.barkLocal(session, e.place <= 3 ? 'win' : 'lose', true);
            this.music.setTempo(1);
          }
          break;
        case 'raceEnd': this.endRace(); break;
        case 'hop': if (mine) this.play('hop'); break;
        case 'land': this.play('land', { air: e.air }, g * (mine ? 1 : 0.5), pan); break;
        case 'mtTier': if (mine) this.play('mtTier', { tier: e.tier }); break;
        case 'miniTurbo': this.play('miniTurbo', { tier: e.tier }, g, pan); if (mine && e.tier >= 3) this.barkLocal(session, 'boost'); break;
        case 'boost': this.play(e.kind === 'pad' ? 'pad' : 'boost', {}, g, pan); break;
        case 'trick': this.play('trick', {}, g, pan); if (mine && Math.random() < 0.35) this.barkLocal(session, 'whoo'); break;
        case 'glider': if (mine) this.play('glider'); break;
        case 'wallHit': if (mine) this.play('wallHit', { impact: e.impact }); break;
        case 'bump': this.play('bump', {}, g, pan); break;
        case 'itemBox': this.play('itemBox', {}, g * (mine ? 1 : 0.6), pan); if (mine) this.rouletteTicks(); break;
        case 'itemReady': if (mine) this.play('itemReady'); break;
        case 'itemUse': { const s = ITEM_SFX[e.item]; if (s) this.play(s, {}, g, pan); break; }
        case 'throw': this.play('throw', {}, g, pan); break;
        case 'drop': this.play('drop', {}, g, pan); break;
        case 'hit':
          this.play('hit', {}, g, pan);
          if (e.kind === 'spin' || e.kind === 'tumble') this.play('spinOut', {}, g * 0.8, pan);
          if (e.kind === 'shrink') this.play('shrink', {}, g, pan);
          if (e.lost > 0 && mine) this.play('coinLose');
          if (mine) this.barkLocal(session, 'hit');
          break;
        case 'itemHit': if (e.by === me && e.id !== me) this.barkLocal(session, 'taunt'); break;
        case 'explosion': this.play('explosion', { big: e.big }, Math.max(g, 0.3), pan); break;
        case 'bolt': this.play('bolt'); break;
        case 'ink': if (mine || e.target === me) this.play('ink'); break;
        case 'shielded': this.play('shield', {}, g, pan); break;
        case 'bounce': this.play('bounce', {}, g * 0.6, pan); break;
        case 'pop': case 'balloonPop': this.play('pop', {}, g, pan); break;
        case 'eliminated': this.play('explosion', {}, g, pan); break;
        case 'coin': case 'coinPick': if (mine) this.play('coin'); else this.play('coin', {}, g * 0.3, pan); break;
        case 'steal': if (mine || e.target === me) this.play('coinLose'); break;
        case 'homing': if (e.target === me) this.play('homing', { minGap: 0.2 }); break;
        case 'cometWarn': this.play('cometWarn'); break;
        case 'swapWarn': case 'swap': this.play('magic', {}, g, pan); break;
        case 'emped': case 'shock': case 'flash': this.play('zap', {}, g, pan); break;
        case 'vine': case 'roots': this.play('vine', {}, g, pan); break;
        case 'droneShot': this.play('zap', {}, g * 0.6, pan); break;
        case 'treasure': if (mine) this.play('treasure'); break;
        case 'rescue': if (mine) this.play('rescue'); break;
        case 'respawn': if (mine) this.play('respawn'); break;
        case 'wrongWay': if (mine) this.play('wrongWay', { minGap: 1.5 }); break;
        case 'hazardHit': { const s = HAZARD_SFX[e.kind]; if (s) this.play(s, {}, g, pan); break; }
        case 'place': if (mine && e.place === 1 && e.old > 1) this.barkLocal(session, 'overtake'); break;
        default: break;
      }
    }
  }

  rouletteTicks() {
    const ctx = this.ctx;
    for (let i = 0; i < 10; i++) {
      setTimeout(() => { if (ctx.state === 'running' && !this.paused) SFX.roulette(ctx, this.sfxBus, ctx.currentTime); }, 80 + i * 90 + i * i * 4);
    }
  }

  barkLocal(session, reaction, force = false) {
    const k = session.localKart?.();
    if (!k) return;
    if (!force && this.barkCd > 0) return;
    this.barkCd = 2.2;
    const racer = getRacer(k.racerId);
    const r = racer?.reactions?.[reaction];
    this.bark(k.racerId, r ? r[Math.floor(Math.random() * r.length)] : reaction);
  }

  // Racer voice bark (select screen, race reactions). Captioned when subtitles are on.
  bark(racerId, reaction = 'cheer') {
    const racer = getRacer(racerId);
    if (!racer) return;
    const r = racer.reactions?.[reaction];
    const word = r ? r[Math.floor(Math.random() * r.length)] : reaction;
    if (this.ctx) playBark(this.ctx, this.voiceBus, this.ctx.currentTime + 0.01, racer.voice, word, 1);
    if (settings().subtitles && this.onCaption) this.onCaption(`${racer.name}: “${barkCaption(word)}”`);
  }
}
