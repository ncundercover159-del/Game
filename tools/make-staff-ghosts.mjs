// Generates staff ghosts: an expert AI runs a clean time trial (3 mushrooms,
// no rivals) on every track; the best of several attempts is saved as the
// staff ghost that medals are measured against.
//   node tools/make-staff-ghosts.mjs [trackId]
import fs from 'node:fs';
import path from 'node:path';
import { loadNodeData, PATHS } from '../shared/data/nodeLoader.js';
import '../shared/track/track.js';
import { createWorld } from '../shared/track/world.js';
import { Race } from '../shared/sim/race.js';
import { GhostRecorder, encodeGhost, decodeGhost } from '../shared/sim/ghost.js';

const DATA = loadNodeData();
const only = process.argv[2];
const outDir = path.join(PATHS.DATA_DIR, 'staff');
fs.mkdirSync(outDir, { recursive: true });
const STAFF = { skyland: 'gustav', molten: 'cinder', haunted: 'grimchain', gearworks: 'boltz', retro: 'draxo' };

for (const [id, def] of Object.entries(DATA.tracks)) {
  if (def.dev || (only && id !== only)) continue;
  const racer = STAFF[def.cup] || 'draxo';
  const entrant = { id: 'staff', racerId: racer, vehicleId: 'ember_roadster', wheelsId: 'slick', gliderId: 'sky_wing', human: false, name: 'Staff' };
  let best = null;
  for (const seed of [1, 2, 3, 4, 5]) {
    const world = createWorld(def);
    const race = new Race({ world, mode: 'timetrial', laps: def.laps || 3, seed, skipCountdown: true, entrants: [entrant], difficulty: 'expert', items: false });
    const k = race.karts[0];
    k.item = 'shroom3'; k.itemCount = 3;
    const rec = new GhostRecorder(k, { track: id, racer, vehicle: entrant.vehicleId, wheels: entrant.wheelsId, glider: entrant.gliderId, name: 'Staff' });
    for (let t = 0; t < 60 * 400 && !k.finished; t++) { race.step(); race.drainEvents(); rec.step(); }
    if (!k.finished || k.estimated) continue;
    if (!best || k.finishTime < best.time) best = rec.finish(k.finishTime, k.lapTimes);
  }
  if (!best) { console.log(`✗ ${id}: staff never finished`); continue; }
  const code = encodeGhost(best);
  const back = decodeGhost(code);
  if (back.frames.length !== best.frames.length || Math.abs(back.frames[back.frames.length - 3] - best.frames[best.frames.length - 3]) > 0) throw new Error('ghost codec mismatch');
  fs.writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify({ id, time: best.time, racer, code }) + '\n');
  console.log(`✓ ${id.padEnd(16)} ${best.time.toFixed(3)} s  (${(code.length / 1024).toFixed(1)} KB)`);
}

// small eager index of staff times (medal thresholds without loading ghosts)
const times = {};
for (const f of fs.readdirSync(outDir)) if (f.endsWith('.json')) { const j = JSON.parse(fs.readFileSync(path.join(outDir, f), 'utf8')); times[j.id] = j.time; }
fs.writeFileSync(path.join(PATHS.DATA_DIR, 'staffTimes.json'), JSON.stringify(times, null, 1) + '\n');
