// Player settings with defaults, persisted to localStorage.
import { load, save, deepMerge } from './storage.js';

export const DEFAULT_LAYOUT = {
  // positions are percentages of the safe area (x from left, y from top), size in px
  wheel:  { x: 15, y: 72, size: 150, opacity: 0.85 },
  drift:  { x: 87, y: 74, size: 118, opacity: 0.9 },
  item:   { x: 74, y: 52, size: 84, opacity: 0.9 },
  brake:  { x: 70, y: 83, size: 70, opacity: 0.85 },
  trick:  { x: 91, y: 43, size: 64, opacity: 0.85 },
  look:   { x: 60, y: 88, size: 52, opacity: 0.7 },
};

export const DEFAULT_SETTINGS = {
  steering: 'wheel',          // 'wheel' | 'tilt' | 'buttons'
  autoAccel: true,
  sensitivity: 1.0,           // steering sensitivity multiplier
  tiltSensitivity: 1.0,
  tiltInvert: false,
  deadZone: 0.06,
  oneHanded: false,
  haptics: true,
  layout: DEFAULT_LAYOUT,
  controlScale: 1.0,
  // audio
  masterVolume: 0.9,
  musicVolume: 0.6,
  sfxVolume: 0.9,
  voiceVolume: 0.8,
  // accessibility
  colorblind: 'none',         // 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia'
  reduceMotion: false,
  subtitles: true,            // visual captions for audio cues
  highContrastHud: false,
  // graphics
  quality: 'auto',            // 'auto' | 'low' | 'medium' | 'high'
  showFps: false,
  keyMap: null,               // custom keyboard remap (null = defaults)
  playerName: '',
};

let current = deepMerge(DEFAULT_SETTINGS, load('settings', {}));
const listeners = new Set();

export const settings = () => current;

export function setSetting(path, value) {
  const parts = path.split('.');
  const next = structuredClone(current);
  let o = next;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]] ??= {};
  o[parts[parts.length - 1]] = value;
  current = next;
  save('settings', current);
  listeners.forEach((fn) => fn(current, path));
}

export function resetSettings(key) {
  current = key ? { ...current, [key]: structuredClone(DEFAULT_SETTINGS[key]) } : structuredClone(DEFAULT_SETTINGS);
  save('settings', current);
  listeners.forEach((fn) => fn(current, key || '*'));
}

export function onSettings(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
