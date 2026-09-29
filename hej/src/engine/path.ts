// Breadth-first path on the tile grid (4-way). Returns tiles to step through, excluding start.
export function findPath(
  w: number, h: number, blocked: (x: number, y: number) => boolean,
  sx: number, sy: number, tx: number, ty: number, maxNodes = 2000,
): [number, number][] | null {
  if (sx === tx && sy === ty) return [];
  const prev = new Map<number, number>();
  const key = (x: number, y: number) => y * w + x;
  const q: number[] = [key(sx, sy)];
  prev.set(q[0], -1);
  const goal = key(tx, ty);
  while (q.length && prev.size < maxNodes) {
    const cur = q.shift()!;
    if (cur === goal) break;
    const cx = cur % w, cy = Math.floor(cur / w);
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const k = key(nx, ny);
      if (prev.has(k) || (blocked(nx, ny) && k !== goal)) continue;
      prev.set(k, cur);
      q.push(k);
    }
  }
  if (!prev.has(goal)) return null;
  const out: [number, number][] = [];
  for (let k = goal; k !== key(sx, sy); k = prev.get(k)!) out.unshift([k % w, Math.floor(k / w)]);
  return out;
}
