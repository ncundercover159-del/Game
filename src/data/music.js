// The valley's music, theme by theme. Each is a scale (systems/music.js), a key (the root as a MIDI
// note), a tempo, the lead instrument and the figure under it, and how busy the melody is (0..1).
// `drone` holds the root and fifth on the shō pad; `pulse` names a taiko pattern; `bells` rings the
// temple bell at the top of every section. The director (core/director.js) picks one for the moment.
export const THEMES = {
  title: { scale: 'in', root: 62, bpm: 66, lead: 'shakuhachi', under: 'koto_low', drone: true, density: 0.35 },
  farm_spring: { scale: 'yo', root: 62, bpm: 96, lead: 'koto', under: 'koto_arp', density: 0.65 },
  farm_summer: { scale: 'yo', root: 64, bpm: 104, lead: 'shamisen', under: 'koto_arp', pulse: 'light', density: 0.7 },
  farm_autumn: { scale: 'in', root: 57, bpm: 84, lead: 'koto', under: 'koto_arp', density: 0.55 },
  farm_winter: { scale: 'kumoi', root: 60, bpm: 70, lead: 'koto', under: 'koto_low', drone: true, density: 0.4 },
  rain: { scale: 'in', root: 60, bpm: 72, lead: 'koto', under: 'koto_low', density: 0.35 },
  village: { scale: 'yo', root: 60, bpm: 108, lead: 'shamisen', under: 'koto_arp', pulse: 'light', density: 0.7 },
  shrine: { scale: 'in', root: 62, bpm: 64, lead: 'shakuhachi', under: 'koto_low', drone: true, bells: true, density: 0.4 },
  grove: { scale: 'minyo', root: 65, bpm: 80, lead: 'fue', under: 'koto_arp', density: 0.5 },
  home: { scale: 'yo', root: 60, bpm: 76, lead: 'koto', under: 'koto_low', density: 0.45 },
  night: { scale: 'in', root: 57, bpm: 60, lead: 'shakuhachi', under: null, drone: true, density: 0.3 },
  festival: { scale: 'yo', root: 67, bpm: 120, lead: 'fue', under: 'shamisen_beat', pulse: 'matsuri', density: 0.75 },
  cave_1: { scale: 'iwato', root: 45, bpm: 60, lead: 'koto', under: null, drone: true, density: 0.2 },
  cave_2: { scale: 'in', root: 50, bpm: 58, lead: 'shakuhachi', under: null, drone: true, density: 0.25 },
  cave_3: { scale: 'hirajoshi', root: 57, bpm: 72, lead: 'koto', under: 'koto_trem', bells: true, density: 0.35 },
  cave_4: { scale: 'iwato', root: 43, bpm: 76, lead: 'shamisen', under: null, drone: true, pulse: 'forge', density: 0.3 },
  cave_5: { scale: 'in', root: 45, bpm: 52, lead: 'shakuhachi', under: null, drone: true, bells: true, density: 0.2 },
  boss: { scale: 'hirajoshi', root: 52, bpm: 138, lead: 'shamisen', under: 'koto_trem', pulse: 'battle', density: 0.8 },
};
