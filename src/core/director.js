// The audio director. Every frame it reads the moment (title or play, where, when, the weather, a
// boss in the room, a festival on the map, a minigame that wants quiet), picks the music theme
// (systems/music.js) and crossfades to it, keeps the next bars scheduled a little ahead on the
// audio clock, and hands the moment to the ambience. `wanted` is the theme even before sound
// starts (browsers wait for a first key or click), for tests.
import { Composer, themeFor } from '../systems/music.js';
import { THEMES } from '../data/music.js';
import { INSTRUMENTS } from './instruments.js';
import { Ambience } from './ambience.js';
import { festivalOn, festivalLive } from '../systems/festivals.js';
import { WEATHER } from '../systems/weather.js';

const AHEAD = 0.6;        // s of music scheduled ahead
const FADE_OUT = 1.8, FADE_IN = 1.4;

export class Director {
  constructor(audio) {
    this.audio = audio;
    this.ambience = new Ambience(audio);
    this.wanted = null;
    this.playing = undefined;   // the theme now sounding (undefined before the first frame)
    this.track = null;          // { name, composer, gain, next }
    this.hushed = false;
    this.count = 0;
  }

  /** What the director needs to know about the game right now. */
  moment(g) {
    if (g.scene === 'title') return { scene: 'title' };
    const def = g.world.map.def, f = festivalOn(g.cal);
    return {
      scene: 'play', map: def.id, cave: !!def.cave, zone: def.zone || 0, indoors: !!def.indoor,
      boss: !!def.cave && g.world.combat.foes.some((x) => x.def.boss),
      festival: !!f && f.map === def.id && festivalLive(f, g.cal.minutes),
      season: g.seasonId, minutes: g.cal.minutes, weather: g.weather, rain: !!WEATHER[g.weather]?.rain,
      hush: g.modals.some((m) => m.hush),
    };
  }

  update(dt, g) {
    const s = this.moment(g);
    this.wanted = themeFor(s);
    if (!this.audio.ctx) return;
    if (this.wanted !== this.playing) this.switchTo(this.wanted);
    if (!!s.hush !== this.hushed) this.hush(!!s.hush);
    this.schedule();
    this.ambience.update(dt, s);
  }

  /** Fade the old theme out and start the new one (or silence) on a fresh gain. */
  switchTo(name) {
    const c = this.audio.ctx, now = c.currentTime;
    if (this.track) {
      const old = this.track.gain;
      old.gain.cancelScheduledValues(now);
      old.gain.setValueAtTime(old.gain.value, now);
      old.gain.linearRampToValueAtTime(0, now + FADE_OUT);
      setTimeout(() => old.disconnect(), (FADE_OUT + 4) * 1000);
    }
    this.playing = name;
    this.track = null;
    if (!name) return;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this.hushed ? 0 : 1, now + FADE_IN);
    gain.connect(this.audio.musicBus);
    this.track = { name, composer: new Composer(name, ++this.count * 7919), gain, next: now + 0.15 };
  }

  /** A minigame that wants quiet (a rhythm game, the iai stand-off) ducks the music. */
  hush(on) {
    this.hushed = on;
    const g = this.track?.gain, now = this.audio.ctx.currentTime;
    if (!g) return;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(on ? 0 : 1, now + (on ? 0.3 : 1.2));
  }

  schedule() {
    const tr = this.track, a = this.audio, now = a.ctx.currentTime;
    if (!tr) return;
    // After a pause the clock has moved on: start again from now rather than catch up.
    if (tr.next < now - 0.5) tr.next = now + 0.1;
    const spb = 60 / THEMES[tr.name].bpm;
    while (tr.next < now + AHEAD) {
      for (const n of tr.composer.nextBar()) {
        const t = tr.next + n.beat * spb, dur = n.dur * spb;
        if (a.mvoice(t, dur + 1)) INSTRUMENTS[n.inst](a, tr.gain, n.midi, t, dur, n.vel);
      }
      tr.next += 4 * spb;
    }
  }
}
