// Track validator: geometry sanity (self-overlap, tight corners, branch ends),
// AI completion (12 bots, all laps, rescues/stuck) and top-down SVG maps.
//   node tools/track-check.mjs [trackId|all] [--race] [--svg outDir] [--mirror]
import fs from 'node:fs';
import path from 'node:path';
import { loadNodeData } from '../shared/data/nodeLoader.js';
import '../shared/track/track.js';
import '../shared/track/arena.js';
import { createWorld } from '../shared/track/world.js';
import { Race } from '../shared/sim/race.js';
import { listOf } from '../shared/data/registry.js';

const args = process.argv.slice(2);
const DATA = loadNodeData();
const which = args.find((a) => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--svg')) || 'all';
const doRace = args.includes('--race');
const svgDir = args.includes('--svg') ? args[args.indexOf('--svg') + 1] : null;
const mirror = args.includes('--mirror');

const ids = which === 'all' ? Object.keys(DATA.tracks) : which.split(',');
let failed = 0;

for (const id of ids) {
  const def = DATA.tracks[id];
  if (!def) { console.log(`✗ ${id}: not found`); failed++; continue; }
  const problems = [];
  let w;
  try { w = createWorld(def, { mirror }); } catch (e) { console.log(`✗ ${id}: build failed`, e); failed++; continue; }
  const R = w.main;
  // self overlap between distant parts of the main ribbon at similar heights
  let overlaps = 0;
  for (let i = 0; i < R.n; i += 2) {
    for (let j = i + 2; j < R.n; j += 2) {
      let ds = Math.abs(R.s[i] - R.s[j]);
      ds = Math.min(ds, w.length - ds);
      if (ds < 60) continue;
      const need = R.hw[i] + R.off[i] + R.hw[j] + R.off[j] + 3;
      const d = Math.hypot(R.x[i] - R.x[j], R.z[i] - R.z[j]);
      if (d < need && Math.abs(R.y[i] - R.y[j]) < 7) { overlaps++; if (overlaps < 4) problems.push(`overlap near s=${R.s[i].toFixed(0)} & s=${R.s[j].toFixed(0)} (d=${d.toFixed(1)} need ${need.toFixed(1)})`); }
    }
  }
  // tightest corner radius (on 6 m chords)
  let minRad = Infinity, minAt = 0;
  for (let i = 0; i < R.n; i++) {
    const a = (i - 3 + R.n) % R.n, b = (i + 3) % R.n;
    let d = Math.atan2(R.tx[b], R.tz[b]) - Math.atan2(R.tx[a], R.tz[a]);
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const rad = (6 * R.step) / Math.max(1e-6, Math.abs(d));
    if (rad < minRad) { minRad = rad; minAt = R.s[i]; }
  }
  if (minRad < 14) problems.push(`very tight corner r=${minRad.toFixed(1)} at s=${minAt.toFixed(0)}`);
  // steepness
  let maxSlope = 0;
  for (let i = 0; i < R.n; i++) {
    let nearGap = false;
    for (let k = -3; k <= 3; k++) if (R.gap[(i + k + R.n) % R.n]) nearGap = true;
    if (!nearGap) maxSlope = Math.max(maxSlope, Math.abs(R.slope[i]));
  }
  if (maxSlope > 0.32) problems.push(`steep slope ${maxSlope.toFixed(2)}`);
  // branches must start and end on the main road
  for (const B of w.ribbons.slice(1)) {
    for (const end of [0, B.n - 1]) {
      const pj = w.nearestMain(B.x[end], B.y[end], B.z[end]);
      if (Math.abs(pj.L) > pj.hw + pj.off + 2 || Math.abs(pj.cy - B.y[end]) > 2.5) problems.push(`branch ${B.id} end ${end ? 'exit' : 'entry'} not on main road (L=${pj.L.toFixed(1)}, dy=${(pj.cy - B.y[end]).toFixed(1)})`);
    }
  }
  const hazards = (w.hazards || []).map((h) => h.type);
  const pi = def._pathInfo;
  if (pi && pi.closeErr > 25) problems.push(`path does not close (error ${pi.closeErr.toFixed(1)} m)`);
  let line = `${id.padEnd(15)} len ${w.length.toFixed(0).padStart(5)} m  minR ${minRad.toFixed(0).padStart(3)}  slope ${maxSlope.toFixed(2)}  branches ${w.ribbons.length - 1}  hazards [${[...new Set(hazards)].join(',')}]${pi ? `  close ${pi.closeErr.toFixed(1)}` : ''}`;

  if (doRace) {
    const racers = listOf('racers');
    const entrants = Array.from({ length: 12 }, (_, i) => ({ id: `b${i}`, racerId: racers[i % racers.length].id, vehicleId: 'ember_roadster', wheelsId: 'standard', gliderId: 'sky_wing', human: false }));
    const race = new Race({ world: w, laps: def.laps || 3, classId: '150cc', seed: 99, skipCountdown: true, entrants, difficulty: 'hard' });
    let rescues = 0, shortcutUse = 0, hazardHits = 0;
    const onBranch = new Set();
    const maxTicks = 60 * 60 * 6;
    let t = 0;
    while (race.phase !== 'finished' && t < maxTicks) {
      race.step();
      for (const e of race.drainEvents()) {
        if (e.type === 'rescue') rescues++;
        if (e.type === 'hazardHit') hazardHits++;
      }
      for (const k of race.karts) if (k.ribbon > 0 && !onBranch.has(`${k.id}:${k.lap}`)) { onBranch.add(`${k.id}:${k.lap}`); shortcutUse++; }
      t++;
    }
    const fin = race.karts.filter((k) => k.finished && k.finishTime > 0 && !k.estimated);
    const best = Math.min(...race.karts.flatMap((k) => k.lapTimes || []).filter((x) => x > 0));
    const avgLap = fin.length ? fin.reduce((a, k) => a + k.finishTime, 0) / fin.length / (def.laps || 3) : 0;
    line += `\n                race: ${fin.length}/12 finished  avgLap ${avgLap.toFixed(1)}s  bestLap ${best.toFixed(1)}s  rescues ${rescues}  shortcuts ${shortcutUse}  hazardHits ${hazardHits}`;
    if (fin.length < 10) problems.push(`only ${fin.length}/12 AI finished`);
    if (rescues > 12 * (def.laps || 3) * 1.2) problems.push(`many rescues (${rescues})`);
  }
  console.log(`${problems.length ? '✗' : '✓'} ${line}`);
  for (const p of problems) console.log(`    - ${p}`);
  if (problems.length) failed++;

  if (svgDir) {
    fs.mkdirSync(svgDir, { recursive: true });
    fs.writeFileSync(path.join(svgDir, `${id}.svg`), svgOf(w));
  }
}
if (failed) { console.log(`\n${failed} track(s) with problems`); process.exitCode = 1; }

function svgOf(w) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const R of w.ribbons) for (let i = 0; i < R.n; i++) {
    minX = Math.min(minX, R.x[i]); maxX = Math.max(maxX, R.x[i]); minZ = Math.min(minZ, R.z[i]); maxZ = Math.max(maxZ, R.z[i]);
    minY = Math.min(minY, R.y[i]); maxY = Math.max(maxY, R.y[i]);
  }
  const pad = 30;
  const W = maxX - minX + pad * 2, H = maxZ - minZ + pad * 2;
  const X = (x) => (x - minX + pad).toFixed(1), Z = (z) => (z - minZ + pad).toFixed(1); // top-down, +z down
  const col = (y) => { const f = (y - minY) / Math.max(1, maxY - minY); return `hsl(${220 - f * 200},70%,${40 + f * 20}%)`; };
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" width="600" height="${(600 * H / W).toFixed(0)}" style="background:#223">`;
  for (const R of w.ribbons) {
    for (let i = 0; i < R.n - (R.closed ? 0 : 1); i++) {
      const j = (i + 1) % R.n;
      const gap = R.gap[i];
      out += `<line x1="${X(R.x[i])}" y1="${Z(R.z[i])}" x2="${X(R.x[j])}" y2="${Z(R.z[j])}" stroke="${gap ? '#f33' : col(R.y[i])}" stroke-width="${(R.hw[i] * 2).toFixed(1)}" stroke-linecap="round" opacity="${R.closed ? 0.9 : 0.7}"/>`;
    }
    for (const r of R.ramps) {
      const s = ((r.s1 % w.length) + w.length) % w.length;
      const i = Math.floor(s / R.step) % R.n;
      out += `<circle cx="${X(R.x[i])}" cy="${Z(R.z[i])}" r="5" fill="${r.glider ? '#0ff' : '#ff0'}"/>`;
    }
  }
  const st = w.at(w.startS / w.length, 0);
  out += `<circle cx="${X(st.x)}" cy="${Z(st.z)}" r="7" fill="#fff"/>`;
  const st2 = w.at((w.startS + 25) / w.length, 0);
  out += `<line x1="${X(st.x)}" y1="${Z(st.z)}" x2="${X(st2.x)}" y2="${Z(st2.z)}" stroke="#fff" stroke-width="3"/>`;
  for (const h of w.hazards || []) if (h.x !== undefined) out += `<circle cx="${X(h.x)}" cy="${Z(h.z)}" r="6" fill="#f0f"/>`;
  for (const b of w.placements.itemBoxes) out += `<circle cx="${X(b.x)}" cy="${Z(b.z)}" r="2" fill="#f8c"/>`;
  out += `<text x="8" y="22" fill="#fff" font-size="18" font-family="sans-serif">${w.def.name} (${w.length.toFixed(0)} m)</text></svg>`;
  return out;
}
