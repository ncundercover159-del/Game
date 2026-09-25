// Client-side data loader: bundles every JSON via Vite globs and fills the
// shared registry. Racer figures are attached as racer.figure.
import { setGameData } from '@shared/data/registry.js';

const g = (mods) => {
  const out = {};
  for (const [p, j] of Object.entries(mods)) out[j.id || p.split('/').pop().replace('.json', '')] = j;
  return out;
};

export function loadClientData() {
  const racerMods = import.meta.glob('../../assets/racers/*/racer.json', { eager: true, import: 'default' });
  const figureMods = import.meta.glob('../../assets/racers/*/*.json', { eager: true, import: 'default' });
  const racers = {};
  for (const [p, r] of Object.entries(racerMods)) {
    const dir = p.slice(0, p.lastIndexOf('/'));
    const figPath = `${dir}/${r.assets?.figure || 'figure.json'}`;
    racers[r.id] = { ...r, figure: figureMods[figPath] || null, assetDir: dir };
  }
  const cups = import.meta.glob('./cups.json', { eager: true, import: 'default' });
  const ach = import.meta.glob('./achievements.json', { eager: true, import: 'default' });
  const songs = import.meta.glob('../../assets/audio/songs/*.json', { eager: true, import: 'default' });
  return setGameData({
    racers,
    vehicles: g(import.meta.glob('../../assets/vehicles/*.json', { eager: true, import: 'default' })),
    wheels: g(import.meta.glob('../../assets/wheels/*.json', { eager: true, import: 'default' })),
    gliders: g(import.meta.glob('../../assets/gliders/*.json', { eager: true, import: 'default' })),
    tracks: g(import.meta.glob('./tracks/*.json', { eager: true, import: 'default' })),
    arenas: g(import.meta.glob('./arenas/*.json', { eager: true, import: 'default' })),
    cups: Object.values(cups)[0] || [],
    achievements: Object.values(ach)[0] || [],
    songs: g(songs),
  });
}
