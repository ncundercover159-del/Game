// Art gallery: palette, every atlas frame (1x and 4x) and the 47 autotile cases per terrain.
import { RAMPS } from '../src/art/palette.js';
import { buildArt } from '../src/art/index.js';
import { blobMasks, grassTile, tilledTile, pathTile, landTile, waterTile, channelTile, GRASS_PALS } from '../src/art/terrain.js';
import { gridToCanvas } from '../src/art/compiler.js';

const root = document.getElementById('root');
const section = (title) => {
  const h = document.createElement('h2');
  h.textContent = title;
  root.appendChild(h);
  const d = document.createElement('div');
  d.className = 'grid';
  root.appendChild(d);
  return d;
};

const pal = section(`Palette (${Object.values(RAMPS).flat().length} colours)`);
pal.className = 'pal';
for (const [ramp, hexes] of Object.entries(RAMPS)) hexes.forEach((hex, i) => {
  const sw = document.createElement('div');
  sw.className = 'sw';
  sw.innerHTML = `<div style="background:${hex}"></div>${ramp}${i}<br>${hex}`;
  pal.appendChild(sw);
});

function cell(parent, src, sx, sy, w, h, label, scale = 4) {
  const c = document.createElement('div');
  c.className = 'cell';
  const one = document.createElement('canvas');
  one.width = w; one.height = h; one.className = 'one';
  one.getContext('2d').drawImage(src, sx, sy, w, h, 0, 0, w, h);
  const big = document.createElement('canvas');
  big.width = w; big.height = h;
  big.style.width = w * scale + 'px'; big.style.height = h * scale + 'px';
  big.getContext('2d').drawImage(src, sx, sy, w, h, 0, 0, w, h);
  const s = document.createElement('span');
  s.textContent = `${label} ${w}x${h}`;
  c.append(one, big, s);
  parent.appendChild(c);
}

const atlas = buildArt();
const groups = new Map();
for (const [name, f] of atlas.frames) {
  const key = name.split('_')[0];
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push([name, f]);
}
for (const [key, frames] of groups) {
  const sec = section(`${key} (${frames.length})`);
  frames.sort((a, b) => a[0].localeCompare(b[0]));
  for (const [name, f] of frames) cell(sec, atlas.canvas, f.x, f.y, f.w, f.h, name, f.w > 60 ? 2 : 4);
}

const masks = blobMasks();
const terrains = {
  grass: (m) => grassTile(m, 0), 'grass (summer)': (m) => grassTile(m, 0, GRASS_PALS[1]),
  'grass (autumn)': (m) => grassTile(m, 0, GRASS_PALS[2]), 'grass (winter)': (m) => grassTile(m, 0, GRASS_PALS[3]),
  tilled: (m) => tilledTile(m, 0, false), wet: (m) => tilledTile(m, 0, true),
  paddy: (m) => tilledTile(m, 0, false, 'paddy'), straw: (m) => tilledTile(m, 0, false, 'straw'),
  channel: (m) => channelTile(m, 0, true), 'channel (dry)': (m) => channelTile(m, 0, false),
  path: (m) => pathTile(m, 0), land: (m) => landTile(m, 0), water: (m) => waterTile(m, 0, 0),
};
for (const [name, gen] of Object.entries(terrains)) {
  const sec = section(`terrain: ${name} (${masks.length} blob cases)`);
  for (const m of masks) cell(sec, gridToCanvas(gen(m)), 0, 0, 16, 16, `${name}:${m}`, 3);
}
window.__galleryReady = true;
