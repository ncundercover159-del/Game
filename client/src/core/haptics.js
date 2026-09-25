// Haptics via navigator.vibrate (Android/Chrome). iOS Safari ignores it silently.
import { settings } from './settings.js';

let last = 0;
export function haptic(pattern) {
  if (!settings().haptics || !navigator.vibrate) return;
  const now = performance.now();
  if (now - last < 40) return; // avoid buzzing constantly
  last = now;
  try { navigator.vibrate(pattern); } catch { /* ignore */ }
}

export const HAPTICS = {
  boost: [18],
  bigBoost: [25, 30, 25],
  hit: [60, 40, 90],
  item: [12],
  coin: [6],
  land: [15],
  lap: [20, 60, 20],
};
