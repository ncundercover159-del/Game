// Central registry for data-driven content. The client fills it via Vite globs,
// the server/tests via the fs-based loader in nodeLoader.js.
const DATA = {
  racers: {},     // id -> racer.json (+ figure under .figure when loaded by the client)
  vehicles: {},   // id -> vehicle json
  wheels: {},
  gliders: {},
  tracks: {},     // id -> track json
  arenas: {},     // id -> arena json
  cups: [],
  songs: {},
  achievements: [],
};

export function setGameData(d) {
  for (const k of Object.keys(DATA)) {
    if (d[k] !== undefined) DATA[k] = d[k];
  }
  return DATA;
}

export const getData = () => DATA;
export const getRacer = (id) => DATA.racers[id] || Object.values(DATA.racers)[0];
export const getVehicle = (id) => DATA.vehicles[id] || Object.values(DATA.vehicles)[0];
export const getWheels = (id) => DATA.wheels[id] || Object.values(DATA.wheels)[0];
export const getGlider = (id) => DATA.gliders[id] || Object.values(DATA.gliders)[0];
export const getTrackDef = (id) => DATA.tracks[id] || DATA.arenas[id];

// Sorted list helpers (order field first, then name)
export function listOf(kind) {
  return Object.values(DATA[kind]).sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || String(a.name).localeCompare(String(b.name)));
}
