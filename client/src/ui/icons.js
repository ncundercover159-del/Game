// Inline SVG icons for controls, HUD and item slots (no external assets).
export const ICONS = {
  drift: `<svg viewBox="0 0 64 64"><path d="M14 44c10 6 26 6 36-4" stroke="currentColor" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M18 30c8 3 18 2 24-4" stroke="currentColor" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/><path d="M44 36l8 2-2 8" stroke="currentColor" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  item: `<svg viewBox="0 0 64 64"><rect x="12" y="12" width="40" height="40" rx="10" fill="none" stroke="currentColor" stroke-width="5"/><path d="M26 27c0-4 3-7 7-7s7 3 7 6c0 5-7 5-7 10" stroke="currentColor" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="33" cy="44" r="3.5" fill="currentColor"/></svg>`,
  brake: `<svg viewBox="0 0 64 64"><rect x="18" y="14" width="10" height="36" rx="3" fill="currentColor"/><rect x="36" y="14" width="10" height="36" rx="3" fill="currentColor"/></svg>`,
  trick: `<svg viewBox="0 0 64 64"><path d="M32 10l6 14 15 1-12 9 4 15-13-8-13 8 4-15-12-9 15-1z" fill="currentColor"/></svg>`,
  look: `<svg viewBox="0 0 64 64"><path d="M8 32c6-10 14-16 24-16s18 6 24 16c-6 10-14 16-24 16S14 42 8 32z" fill="none" stroke="currentColor" stroke-width="5"/><circle cx="32" cy="32" r="7" fill="currentColor"/></svg>`,
  pause: `<svg viewBox="0 0 64 64"><rect x="18" y="14" width="10" height="36" rx="3" fill="currentColor"/><rect x="36" y="14" width="10" height="36" rx="3" fill="currentColor"/></svg>`,
  wheel: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="10"/><circle cx="50" cy="50" r="10" fill="currentColor"/><path d="M50 60v30M40 50H8M60 50h32" stroke="currentColor" stroke-width="9" stroke-linecap="round"/><circle cx="50" cy="9" r="5" fill="#ffd23f"/></svg>`,
  coin: `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="32" rx="24" ry="26" fill="#f7b21b" stroke="#6b3f00" stroke-width="4"/><ellipse cx="32" cy="32" rx="15" ry="18" fill="#ffd84d"/><rect x="28" y="20" width="8" height="24" rx="3" fill="#e79a0c"/></svg>`,
  flag: `<svg viewBox="0 0 64 64"><path d="M14 8v50" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M16 10h36v26H16z" fill="#fff"/><path d="M16 10h9v6.5h-9zM34 10h9v6.5h-9zM25 16.5h9V23h-9zM43 16.5h9V23h-9zM16 23h9v6.5h-9zM34 23h9v6.5h-9zM25 29.5h9V36h-9zM43 29.5h9V36h-9z" fill="#111"/></svg>`,
  back: `<svg viewBox="0 0 64 64"><path d="M40 12L20 32l20 20" stroke="currentColor" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  gear: `<svg viewBox="0 0 64 64"><path d="M28 6h8l2 8 6 3 7-4 6 6-4 7 3 6 8 2v8l-8 2-3 6 4 7-6 6-7-4-6 3-2 8h-8l-2-8-6-3-7 4-6-6 4-7-3-6-8-2v-8l8-2 3-6-4-7 6-6 7 4 6-3z" fill="currentColor"/><circle cx="32" cy="32" r="9" fill="#1a1426"/></svg>`,
};

export const ELEMENT_GLYPHS = {
  fire: `<svg viewBox="0 0 64 64"><path d="M32 6c4 12 16 16 16 32a16 16 0 0 1-32 0c0-8 4-12 8-16 0 6 2 9 5 10-2-10 1-18 3-26z" fill="currentColor"/></svg>`,
  water: `<svg viewBox="0 0 64 64"><path d="M32 6C24 20 14 30 14 40a18 18 0 0 0 36 0c0-10-10-20-18-34z" fill="currentColor"/></svg>`,
  earth: `<svg viewBox="0 0 64 64"><path d="M10 46l10-22 12-8 14 6 8 18-6 12H18z" fill="currentColor"/></svg>`,
  air: `<svg viewBox="0 0 64 64"><path d="M8 24h30a8 8 0 1 0-8-8M8 36h42a8 8 0 1 1-8 8M8 48h20" stroke="currentColor" stroke-width="6" fill="none" stroke-linecap="round"/></svg>`,
  life: `<svg viewBox="0 0 64 64"><path d="M12 52C12 26 28 10 54 10c0 26-16 42-42 42z" fill="currentColor"/><path d="M14 50L40 24" stroke="#1a1426" stroke-width="4"/></svg>`,
  undead: `<svg viewBox="0 0 64 64"><path d="M32 8c-13 0-22 9-22 21 0 8 4 13 8 15v10h28V44c4-2 8-7 8-15 0-12-9-21-22-21z" fill="currentColor"/><circle cx="24" cy="30" r="6" fill="#1a1426"/><circle cx="40" cy="30" r="6" fill="#1a1426"/></svg>`,
  tech: `<svg viewBox="0 0 64 64"><path d="M28 6h8l2 8 6 3 7-4 6 6-4 7 3 6 8 2v8l-8 2-3 6 4 7-6 6-7-4-6 3-2 8h-8l-2-8-6-3-7 4-6-6 4-7-3-6-8-2v-8l8-2 3-6-4-7 6-6 7 4 6-3z" fill="currentColor"/><circle cx="32" cy="32" r="9" fill="#1a1426"/></svg>`,
  magic: `<svg viewBox="0 0 64 64"><path d="M32 4l6 20 20 8-20 8-6 20-6-20-20-8 20-8z" fill="currentColor"/></svg>`,
  light: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="12" fill="currentColor"/><path d="M32 4v10M32 50v10M4 32h10M50 32h10M12 12l7 7M45 45l7 7M12 52l7-7M45 19l7-7" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>`,
  dark: `<svg viewBox="0 0 64 64"><path d="M40 8a24 24 0 1 0 16 40A20 20 0 0 1 40 8z" fill="currentColor"/></svg>`,
};

export const ELEMENT_COLORS = {
  fire: '#FF5A1F', water: '#1E9BFF', earth: '#B8793A', air: '#7FE7F2', life: '#4CCB3C',
  undead: '#A8B0C8', tech: '#FFB319', magic: '#A84CFF', light: '#FFE45C', dark: '#D33FBF',
};
export const ELEMENT_GLOW = {
  fire: '#FFD23F', water: '#9FE3FF', earth: '#E3C27A', air: '#FFFFFF', life: '#C8F56A',
  undead: '#6CFFB0', tech: '#3DE0FF', magic: '#FF9BF5', light: '#FFFFFF', dark: '#2B1F4A',
};
