// Irrigation: channels (mizo) carry water from natural water by 4-connected flood-fill. A closed
// sluice gate on a channel stops the flow. A tilled tile next to flowing water is a flooded paddy,
// which counts as watered every day.
import { G } from '../world/gamemap.js';

export const SOIL = { NONE: 0, TILLED: 1, CHANNEL: 2 };
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function sluiceClosed(map, x, y) {
  const o = map.objectAt(x, y);
  return !!o && o.type === 'sluice' && !o.open;
}

/** Recompute map.flow (1 = channel tile carrying water). Returns the number of wet channel tiles. */
export function computeFlow(map) {
  const n = map.w * map.h;
  if (!map.flow || map.flow.length !== n) map.flow = new Uint8Array(n);
  const prev = map.flow.slice();
  map.flow.fill(0);
  const queue = [];
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const k = map.i(x, y);
    if (map.soil[k] !== SOIL.CHANNEL || sluiceClosed(map, x, y)) continue;
    if (N4.some(([dx, dy]) => map.inside(x + dx, y + dy) && map.ground[map.i(x + dx, y + dy)] === G.WATER)) {
      map.flow[k] = 1;
      queue.push(k);
    }
  }
  while (queue.length) {
    const k = queue.pop();
    const x = k % map.w, y = Math.floor(k / map.w);
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy;
      if (!map.inside(nx, ny)) continue;
      const nk = map.i(nx, ny);
      if (map.flow[nk] || map.soil[nk] !== SOIL.CHANNEL || sluiceClosed(map, nx, ny)) continue;
      map.flow[nk] = 1;
      queue.push(nk);
    }
  }
  let count = 0;
  for (let k = 0; k < n; k++) {
    if (map.flow[k]) count++;
    if (map.flow[k] !== prev[k]) {
      const x = k % map.w, y = Math.floor(k / map.w);
      map.touch(x, y);
      // Neighbouring fields change between dry soil and paddy.
      for (const [dx, dy] of N4) if (map.inside(x + dx, y + dy)) map.touch(x + dx, y + dy);
    }
  }
  return count;
}

/** Tile carries water: natural water or a flowing channel. */
export function watery(map, x, y) {
  if (!map.inside(x, y)) return false;
  const k = map.i(x, y);
  return map.ground[k] === G.WATER || (map.soil[k] === SOIL.CHANNEL && !!map.flow?.[k]);
}

/** A tilled tile beside flowing water is a flooded paddy. */
export function isFlooded(map, x, y) {
  if (!map.inside(x, y) || map.soil[map.i(x, y)] !== SOIL.TILLED) return false;
  return N4.some(([dx, dy]) => watery(map, x + dx, y + dy));
}
