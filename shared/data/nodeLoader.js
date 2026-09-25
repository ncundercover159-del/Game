// Node-side data loader (server, tools, tests). Reads the same JSON files the
// client bundles via import.meta.glob.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setGameData } from './registry.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
const ASSETS = path.join(ROOT, 'client/assets');
const DATA_DIR = path.join(ROOT, 'client/src/data');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

function readDir(dir, map = (j) => j) {
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const j = map(readJson(path.join(dir, f)), f);
    out[j.id || f.replace('.json', '')] = j;
  }
  return out;
}

export function loadNodeData({ figures = false } = {}) {
  const racers = {};
  const rdir = path.join(ASSETS, 'racers');
  if (fs.existsSync(rdir)) {
    for (const id of fs.readdirSync(rdir)) {
      const rp = path.join(rdir, id, 'racer.json');
      if (!fs.existsSync(rp)) continue;
      const r = readJson(rp);
      if (figures) {
        const fp = path.join(rdir, id, r.assets?.figure || 'figure.json');
        if (fs.existsSync(fp)) r.figure = readJson(fp);
      }
      racers[r.id] = r;
    }
  }
  const cupsPath = path.join(DATA_DIR, 'cups.json');
  const achPath = path.join(DATA_DIR, 'achievements.json');
  return setGameData({
    racers,
    vehicles: readDir(path.join(ASSETS, 'vehicles')),
    wheels: readDir(path.join(ASSETS, 'wheels')),
    gliders: readDir(path.join(ASSETS, 'gliders')),
    tracks: readDir(path.join(DATA_DIR, 'tracks')),
    arenas: readDir(path.join(DATA_DIR, 'arenas')),
    cups: fs.existsSync(cupsPath) ? readJson(cupsPath) : [],
    achievements: fs.existsSync(achPath) ? readJson(achPath) : [],
  });
}

export const PATHS = { ROOT, ASSETS, DATA_DIR };
