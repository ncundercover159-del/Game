// Every map by id, with doors linked both ways: a building door with `to` becomes a warp into that
// room, and the room's doorway warps back out to the tile below the door.
import farm from './farm.js';
import village from './village.js';
import shrine from './shrine.js';
import grove from './grove.js';
import { INTERIORS } from './interiors.js';

export const MAPS = {};
for (const def of [farm, village, shrine, grove, ...INTERIORS]) MAPS[def.id] = { warps: [], ...def };

for (const outside of Object.values(MAPS)) {
  for (const b of outside.buildings || []) {
    const d = b.door;
    if (!d?.to) continue;
    const room = MAPS[d.to];
    if (!room) throw new Error(`Map ${outside.id}: door to unknown map "${d.to}"`);
    outside.warps.push({ x: d.tx, y: d.ty, w: 1, h: 1, to: room.id, tx: room.spawn.tx, ty: room.spawn.ty, dir: 'up', door: true });
    room.warps.push({ x: room.door.tx, y: room.door.ty, w: 1, h: 1, to: outside.id, tx: d.tx, ty: d.ty + 1, dir: 'down', door: true });
    room.outside = outside.id;
  }
}
