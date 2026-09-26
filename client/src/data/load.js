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
  // Optional real models: any .glb under assets/ gets a URL; racer/vehicle JSON
  // "assets.model" / "model" fields reference them relative to their folder.
  const glbUrls = import.meta.glob('../../assets/**/*.glb', { eager: true, query: '?url', import: 'default' });
  const racers = {};
  for (const [p, r] of Object.entries(racerMods)) {
    const dir = p.slice(0, p.lastIndexOf('/'));
    const figPath = `${dir}/${r.assets?.figure || 'figure.json'}`;
    const modelUrl = r.assets?.model ? glbUrls[`${dir}/${r.assets.model}`] || null : null;
    if (r.assets?.model && !modelUrl) console.warn(`[data] racer ${r.id}: model ${r.assets.model} not found, using procedural figure`);
    racers[r.id] = { ...r, figure: figureMods[figPath] || null, assetDir: dir, modelUrl };
  }
  const cups = import.meta.glob('./cups.json', { eager: true, import: 'default' });
  const ach = import.meta.glob('./achievements.json', { eager: true, import: 'default' });
  const songs = import.meta.glob('../../assets/audio/songs/*.json', { eager: true, import: 'default' });
  return setGameData({
    racers,
    vehicles: Object.fromEntries(Object.entries(g(import.meta.glob('../../assets/vehicles/*.json', { eager: true, import: 'default' })))
      .map(([id, v]) => [id, v.model ? { ...v, modelUrl: glbUrls[`../../assets/vehicles/${v.model}`] || null } : v])),
    wheels: g(import.meta.glob('../../assets/wheels/*.json', { eager: true, import: 'default' })),
    gliders: g(import.meta.glob('../../assets/gliders/*.json', { eager: true, import: 'default' })),
    tracks: g(import.meta.glob('./tracks/*.json', { eager: true, import: 'default' })),
    arenas: g(import.meta.glob('./arenas/*.json', { eager: true, import: 'default' })),
    cups: Object.values(cups)[0] || [],
    achievements: Object.values(ach)[0] || [],
    songs: g(songs),
    // staff ghosts are big: loaded lazily (id -> () => Promise<{ id, time, racer, code }>)
    staffTimes: Object.values(import.meta.glob('./staffTimes.json', { eager: true, import: 'default' }))[0] || {},
    staff: Object.fromEntries(Object.entries(import.meta.glob('./staff/*.json', { import: 'default' }))
      .map(([p, fn]) => [p.split('/').pop().replace('.json', ''), fn])),
  });
}
