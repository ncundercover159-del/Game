// Validates every data file: racers + figures, vehicles, wheels, gliders,
// tracks (resolved), arenas, cups, songs, achievements and staff ghosts.
// Exit code 1 on any error. Run: npm run check-assets
import fs from 'node:fs';
import path from 'node:path';
import { loadNodeData, PATHS } from '../shared/data/nodeLoader.js';
import '../shared/track/track.js';
import '../shared/track/arena.js';
import { createWorld } from '../shared/track/world.js';
import { ITEM_DEFS } from '../shared/sim/items.js';

const DATA = loadNodeData({ figures: true });
const errors = [], warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

const ELEMENTS = ['fire', 'water', 'earth', 'air', 'life', 'undead', 'tech', 'magic', 'light', 'dark'];
const STATS = ['speed', 'accel', 'weight', 'handling', 'drift', 'offroad', 'miniTurbo'];
const UNLOCKS = ['default', 'coins', 'races', 'treasures', 'cup', 'goldAll', 'achievement'];
const FORMANTS = ['dragon', 'robotic', 'grumble', 'squeaky', 'chuckle', 'bubbly', 'goofy', 'ghoul', 'creak', 'hoot', 'airy', 'rumble', 'sweet', 'purr'];
const SHAPES = ['sphere', 'capsule', 'cone', 'cyl', 'box', 'torus', 'lathe', 'tube', 'extrude', 'eye'];

function checkUnlock(where, u) {
  if (!u) return err(where, 'missing unlock');
  if (!UNLOCKS.includes(u.type)) err(where, `unknown unlock type ${u.type}`);
  if (u.type === 'coins' && !(u.cost > 0)) err(where, 'coin unlock without cost');
  if (u.type === 'cup' && !DATA.cups.some((c) => c.id === u.cup)) err(where, `unlock cup ${u.cup} does not exist`);
}

function checkStats(where, s, keys = STATS) {
  if (!s) return err(where, 'missing stats');
  for (const k of Object.keys(s)) {
    if (!STATS.includes(k)) err(where, `unknown stat ${k}`);
    else if (typeof s[k] !== 'number' || Math.abs(s[k]) > 3) err(where, `stat ${k} out of range (${s[k]})`);
  }
  void keys;
}

function checkFigure(where, fig) {
  if (!fig) return err(where, 'missing figure');
  const bones = new Set(['root', ...Object.keys(fig.bones || {})]);
  for (const [n, b] of Object.entries(fig.bones || {})) {
    if (b.parent && !bones.has(b.parent)) err(where, `bone ${n} has unknown parent ${b.parent}`);
    if (!Array.isArray(b.pos) || b.pos.length !== 3) err(where, `bone ${n} has bad pos`);
  }
  (fig.parts || []).forEach((p, i) => {
    if (!SHAPES.includes(p.shape)) err(where, `part ${i}: unknown shape ${p.shape}`);
    if (p.bone && !bones.has(p.bone)) err(where, `part ${i}: unknown bone ${p.bone}`);
    if (p.c && typeof p.c === 'string' && !p.c.startsWith('#') && !(fig.palette && p.c in fig.palette)) warn(where, `part ${i}: colour "${p.c}" not in palette`);
  });
}

// --- racers
for (const r of Object.values(DATA.racers)) {
  const w = `racer ${r.id}`;
  for (const k of ['id', 'name', 'element', 'size', 'signature', 'voice']) if (r[k] === undefined) err(w, `missing ${k}`);
  if (!ELEMENTS.includes(r.element)) err(w, `unknown element ${r.element}`);
  if (!['light', 'medium', 'heavy'].includes(r.size)) err(w, `bad size ${r.size}`);
  if (!ITEM_DEFS[r.signature]) err(w, `signature item ${r.signature} does not exist`);
  if (r.voice && !FORMANTS.includes(r.voice.formant)) warn(w, `voice formant ${r.voice.formant} has no preset (falls back to dragon)`);
  checkStats(w, r.stats);
  checkUnlock(w, r.unlock);
  checkFigure(w, r.figure);
  if (r.assets?.model && !fs.existsSync(path.join(PATHS.ASSETS, 'racers', r.id, r.assets.model))) err(w, `model ${r.assets.model} missing`);
}
const nRacers = Object.keys(DATA.racers).length;
if (nRacers < 16) err('roster', `only ${nRacers} racers (need 16)`);
if (Object.values(DATA.racers).filter((r) => r.unlock?.type === 'default').length < 8) err('roster', 'fewer than 8 starting racers');

// --- vehicles, wheels, gliders
for (const v of Object.values(DATA.vehicles)) {
  const w = `vehicle ${v.id}`;
  if (!['kart', 'bike', 'quad', 'buggy'].includes(v.type)) warn(w, `unusual type ${v.type}`);
  checkStats(w, v.stats); checkUnlock(w, v.unlock); checkFigure(w, v.figure);
  if (!v.figure?.bones?.wheelBL) warn(w, 'no wheelBL bone (ride height guess used)');
}
for (const x of Object.values(DATA.wheels)) { const w = `wheels ${x.id}`; checkStats(w, x.stats); checkUnlock(w, x.unlock); checkFigure(w, x.figure); if (!(x.radius > 0)) err(w, 'missing radius'); }
for (const x of Object.values(DATA.gliders)) { const w = `glider ${x.id}`; checkStats(w, x.stats); checkUnlock(w, x.unlock); checkFigure(w, x.figure); }
if (Object.keys(DATA.vehicles).length < 20) err('vehicles', `only ${Object.keys(DATA.vehicles).length} (need 12 karts + 8 bikes/quads)`);

// --- tracks & arenas
const staffDir = path.join(PATHS.DATA_DIR, 'staff');
for (const [id, def] of Object.entries(DATA.tracks)) {
  const w = `track ${id}`;
  try {
    const world = createWorld(def);
    if (world.length < 500) warn(w, `short lap (${world.length.toFixed(0)} m)`);
    if (!def.branches?.length && !def.dev) err(w, 'no shortcut branch');
    if (!(world.placements.itemBoxes.length >= 8) && !def.dev) warn(w, 'few item boxes');
  } catch (e) { err(w, `failed to build: ${e.message}`); }
  if (!def.dev && !fs.existsSync(path.join(staffDir, `${id}.json`))) warn(w, 'no staff ghost (run tools/make-staff-ghosts.mjs)');
  if (def.music && !fs.existsSync(path.join(PATHS.ASSETS, 'audio/songs', `${def.music}.json`))) err(w, `music ${def.music} missing`);
}
for (const [id, def] of Object.entries(DATA.arenas)) {
  try { createWorld(def); } catch (e) { err(`arena ${id}`, e.message); }
}
for (const cup of DATA.cups) {
  for (const t of cup.tracks) if (!DATA.tracks[t]) err(`cup ${cup.id}`, `track ${t} missing`);
  if (cup.tracks.length !== 4) err(`cup ${cup.id}`, 'cups need 4 tracks');
}
const mainTracks = Object.values(DATA.tracks).filter((t) => !t.dev && !t.remixOf).length;
if (mainTracks < 16) err('tracks', `only ${mainTracks} main tracks (need 16)`);
if (Object.values(DATA.arenas).filter((a) => !a.dev).length < 3) err('arenas', 'need 3 battle arenas');

// --- songs & achievements
for (const f of fs.readdirSync(path.join(PATHS.ASSETS, 'audio/songs'))) {
  const s = JSON.parse(fs.readFileSync(path.join(PATHS.ASSETS, 'audio/songs', f), 'utf8'));
  if (!(s.bpm > 40 && s.bpm < 260)) err(`song ${f}`, 'bad bpm');
  if (!Array.isArray(s.chords) || !s.chords.length) err(`song ${f}`, 'missing chords');
}
const achIds = new Set();
for (const a of DATA.achievements) {
  if (achIds.has(a.id)) err(`achievement ${a.id}`, 'duplicate id');
  achIds.add(a.id);
  if (!a.check || !Object.keys(a.check).length) err(`achievement ${a.id}`, 'missing check');
}
if (DATA.achievements.length < 30) err('achievements', `only ${DATA.achievements.length} (need 30+)`);

for (const w of warnings) console.log(`  ⚠ ${w}`);
for (const e of errors) console.log(`  ✗ ${e}`);
console.log(`\n${Object.keys(DATA.racers).length} racers · ${Object.keys(DATA.vehicles).length} vehicles · ${Object.keys(DATA.wheels).length} wheels · ${Object.keys(DATA.gliders).length} gliders · ${Object.keys(DATA.tracks).length} tracks · ${Object.keys(DATA.arenas).length} arenas · ${DATA.achievements.length} achievements`);
console.log(errors.length ? `${errors.length} error(s), ${warnings.length} warning(s)` : `All assets OK (${warnings.length} warning(s))`);
process.exitCode = errors.length ? 1 : 0;
