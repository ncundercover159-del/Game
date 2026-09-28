// Tile collision for walkers. The box is centred on x and sits on the feet: [x-hw, x+hw) x [y-hh, y).
import { TILE } from '../config.js';

// `wet`: the walker can cross water (floating spirits, swimming kappa).
export function boxFree(map, x, y, hw, hh, wet = false) {
  const x0 = Math.floor((x - hw) / TILE), x1 = Math.floor((x + hw - 0.001) / TILE);
  const y0 = Math.floor((y - hh) / TILE), y1 = Math.floor((y - 0.001) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (map.solid(tx, ty) && !(wet && map.isWater(tx, ty) && map.objAt[map.i(tx, ty)] < 0)) return false;
  }
  return true;
}

const NUDGE = 6;

/**
 * Move `pos` by (dx, dy) with axis-separated resolution. When a move is blocked only by a corner,
 * the walker slides around it (up to NUDGE px), so doorways and gaps don't snag.
 */
export function moveBox(map, pos, dx, dy, hw, hh, wet = false) {
  if (dx) {
    if (boxFree(map, pos.x + dx, pos.y, hw, hh, wet)) pos.x += dx;
    else if (!dy) slide(map, pos, dx, 0, hw, hh, wet);
  }
  if (dy) {
    if (boxFree(map, pos.x, pos.y + dy, hw, hh, wet)) pos.y += dy;
    else if (!dx) slide(map, pos, 0, dy, hw, hh, wet);
  }
}

function slide(map, pos, dx, dy, hw, hh, wet) {
  const step = Math.abs(dx || dy);
  for (let n = 1; n <= NUDGE; n++) {
    for (const s of [-1, 1]) {
      const ox = dy ? s * n : 0, oy = dx ? s * n : 0;
      if (boxFree(map, pos.x + ox, pos.y + oy, hw, hh, wet) && boxFree(map, pos.x + ox + dx, pos.y + oy + dy, hw, hh, wet)) {
        pos.x += Math.sign(ox) * Math.min(step, Math.abs(ox));
        pos.y += Math.sign(oy) * Math.min(step, Math.abs(oy));
        return;
      }
    }
  }
}
