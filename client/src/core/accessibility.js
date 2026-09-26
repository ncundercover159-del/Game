// Applies accessibility settings globally: colour-blind palettes (3D drift /
// boost colours + HUD CSS variables), reduced motion and high-contrast HUD.
import { settings, onSettings } from './settings.js';
import { TIER_COLORS } from '../render/kartView.js';

// drift tier 1/2/3 colours per palette (kept distinguishable for each deficiency)
const PALETTES = {
  none:         [[0.24, 0.7, 1.0], [1.0, 0.55, 0.12], [0.78, 0.36, 1.0]],
  protanopia:   [[0.2, 0.5, 1.0], [1.0, 0.9, 0.3], [1.0, 1.0, 1.0]],
  deuteranopia: [[0.2, 0.5, 1.0], [1.0, 0.9, 0.3], [1.0, 1.0, 1.0]],
  tritanopia:   [[1.0, 0.3, 0.45], [0.18, 0.9, 0.84], [1.0, 1.0, 1.0]],
};
const hex = ([r, g, b]) => `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;

export function applyAccessibility() {
  const s = settings();
  const pal = PALETTES[s.colorblind] || PALETTES.none;
  for (let i = 0; i < 3; i++) TIER_COLORS[i + 1] = pal[i];
  const root = document.documentElement;
  root.dataset.cb = s.colorblind || 'none';
  pal.forEach((c, i) => root.style.setProperty(`--tier${i + 1}`, hex(c)));
  root.classList.toggle('reduce-motion', !!s.reduceMotion);
  root.classList.toggle('hc-hud', !!s.highContrastHud);
}

export function initAccessibility() {
  applyAccessibility();
  onSettings(() => applyAccessibility());
}
