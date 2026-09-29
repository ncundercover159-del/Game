import { describe, expect, it } from 'vitest';
import content from '../src/generated/content.json';
import type { Content } from '../src/content/types';
import { findPath } from '../src/engine/path';
import { TILES } from '../src/engine/tiledefs';

const C = content as unknown as Content;

/** Where a player can appear on a map: spawn, warp arrivals, stop arrival. */
function entries(mapId: string): [number, number][] {
  const out: [number, number][] = [];
  const m = C.maps[mapId];
  out.push([m.spawn.x, m.spawn.y]);
  if (m.stop) out.push([m.stop.arrive.x, m.stop.arrive.y]);
  for (const other of Object.values(C.maps)) for (const w of other.warps) if (w.to === mapId) out.push([w.tx, w.ty]);
  return out;
}

describe('every scene can be reached on foot', () => {
  it('each npc-started scene has a walkable route to the npc (or across a counter)', () => {
    const problems: string[] = [];
    for (const ch of C.chapters) for (const sc of ch.scenes) {
      const npc = sc.start.npc;
      if (!npc) continue;
      const spot = sc.cast[npc];
      if (!spot) { problems.push(`${sc.id}: start npc ${npc} not in cast`); continue; }
      const m = C.maps[spot.map];
      const others = Object.entries(sc.cast).filter(([id, s]) => id !== npc && s.map === spot.map).map(([, s]) => [s.x, s.y]);
      const solid = (x: number, y: number) => x < 0 || y < 0 || x >= m.w || y >= m.h || TILES[m.tiles[y * m.w + x]].solid;
      const blocked = (x: number, y: number) => solid(x, y) || others.some(([ox, oy]) => ox === x && oy === y) || (x === spot.x && y === spot.y);
      const targets: [number, number][] = [];
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        if (!blocked(spot.x + dx, spot.y + dy)) targets.push([spot.x + dx, spot.y + dy]);
        else if (solid(spot.x + dx, spot.y + dy) && !blocked(spot.x + 2 * dx, spot.y + 2 * dy)) targets.push([spot.x + 2 * dx, spot.y + 2 * dy]);
      }
      const ok = entries(spot.map).some(([ex, ey]) => targets.some(([tx, ty]) => (ex === tx && ey === ty) || findPath(m.w, m.h, blocked, ex, ey, tx, ty)));
      if (!ok) problems.push(`${sc.id}: can't reach ${npc} at ${spot.map} ${spot.x},${spot.y}`);
    }
    expect(problems).toEqual([]);
  });

  it('every map can be reached from the home street via doors and stops', () => {
    const seen = new Set(['street']);
    const queue = ['street'];
    const stops = Object.values(C.maps).filter((m) => m.stop).map((m) => m.id);
    while (queue.length) {
      const id = queue.shift()!;
      const next = [...C.maps[id].warps.map((w) => w.to), ...(C.maps[id].stop ? stops : [])];
      for (const n of next) if (!seen.has(n)) { seen.add(n); queue.push(n); }
    }
    expect(Object.keys(C.maps).filter((m) => !seen.has(m))).toEqual([]);
  });

  it('doors and stops a chapter needs are unlocked by that chapter', () => {
    const flagsBy: string[] = [];
    const problems: string[] = [];
    const collect = (nodes: any[]) => { for (const n of nodes) { if (n.k === 'set') flagsBy.push(...Object.keys(n.flags)); if (n.k === 'choice') for (const o of n.opts) collect(o.then); } };
    for (const ch of C.chapters) {
      collect(ch.intro);
      for (const sc of ch.scenes) {
        const map = sc.start.enterMap ?? (sc.start.npc ? sc.cast[sc.start.npc]?.map : undefined);
        if (map && map !== 'street') {
          const ways = [
            ...Object.values(C.maps).flatMap((m) => m.warps.filter((w) => w.to === map).map((w) => w.needFlag)),
            ...(C.maps[map].stop ? [C.maps[map].stop!.needFlag] : []),
          ];
          if (!ways.some((f) => !f || flagsBy.includes(f))) problems.push(`${sc.id}: ${map} is still locked`);
        }
        collect(sc.script);
      }
    }
    expect(problems).toEqual([]);
  });
});
