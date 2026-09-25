// World factory: builds the physics model for a track or arena definition.
import { ArenaWorld } from './arena.js';

let TrackWorldClass = null;
export function registerTrackWorld(cls) { TrackWorldClass = cls; }

export function createWorld(def, opts = {}) {
  if (def.type === 'arena') return new ArenaWorld(def, opts);
  if (!TrackWorldClass) throw new Error('TrackWorld not registered');
  return new TrackWorldClass(def, opts);
}
