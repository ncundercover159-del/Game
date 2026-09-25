// Local player profile: currency, unlocks, trophies, best times, stats.
// Everything is local (localStorage); no accounts.
import { load, save, deepMerge } from './storage.js';

const DEFAULT = {
  version: 1,
  name: 'Racer',
  coins: 0,                 // currency
  unlocked: { racers: [], vehicles: [], wheels: [], gliders: [], trails: [], emotes: [], tracks: [], classes: ['50cc', '100cc', '150cc'] },
  trophies: {},             // `${cup}:${class}` -> 'gold' | 'silver' | 'bronze'
  medals: {},               // trackId -> 'gold' | 'silver' | 'bronze' (time trial vs staff)
  bestTimes: {},            // trackId -> { time, laps: [...], racer, vehicle }
  treasures: {},            // trackId -> true
  achievements: {},         // id -> timestamp
  favourites: { racer: null, vehicle: null, track: null },
  selection: { racerId: 'draxo', vehicleId: 'ember_roadster', wheelsId: 'standard', gliderId: 'sky_wing' },
  stats: {
    races: 0, wins: 0, podiums: 0, gpCompleted: 0, itemsUsed: 0, hitsLanded: 0, timesHit: 0, coinsCollected: 0,
    miniTurbos: 0, purpleTurbos: 0, tricks: 0, rocketStarts: 0, distance: 0, battles: 0, battleWins: 0, onlineRaces: 0,
    shortcuts: 0, falls: 0, racerUse: {}, vehicleUse: {}, trackUse: {},
  },
  daily: { lastDate: null, streak: 0, best: {} },
  ghosts: {},               // trackId -> compact ghost string (player's best)
};

let profile = deepMerge(DEFAULT, load('profile', {}));
const listeners = new Set();

export const getProfile = () => profile;

export function updateProfile(fn) {
  fn(profile);
  save('profile', profile);
  listeners.forEach((l) => l(profile));
  return profile;
}

export function onProfile(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function resetProfile() {
  profile = structuredClone(DEFAULT);
  save('profile', profile);
  listeners.forEach((l) => l(profile));
}

// An item is available if its unlock condition is default or it has been unlocked.
export function isUnlocked(kind, def) {
  if (!def) return false;
  if (!def.unlock || def.unlock.type === 'default') return true;
  return profile.unlocked[kind]?.includes(def.id);
}

export function unlock(kind, id) {
  if (profile.unlocked[kind]?.includes(id)) return false;
  updateProfile((p) => { (p.unlocked[kind] ||= []).push(id); });
  return true;
}

export function addCoins(n) { updateProfile((p) => { p.coins = Math.max(0, p.coins + n); }); }

const TROPHY_RANK = { gold: 3, silver: 2, bronze: 1 };
export function recordTrophy(cup, cls, trophy) {
  const key = `${cup}:${cls}`;
  const prev = profile.trophies[key];
  if (!prev || TROPHY_RANK[trophy] > TROPHY_RANK[prev]) updateProfile((p) => { p.trophies[key] = trophy; });
}

export function bumpStat(key, n = 1) {
  updateProfile((p) => { p.stats[key] = (p.stats[key] || 0) + n; });
}
