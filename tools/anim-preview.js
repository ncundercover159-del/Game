// Plays every character animation in every direction at 1x and 4x, plus tool swings.
import { buildArt } from '../src/art/index.js';
import { ANIMS } from '../src/art/characters.js';
import { grassTile } from '../src/art/terrain.js';
import { gridToCanvas } from '../src/art/compiler.js';

const atlas = buildArt();
const grass = gridToCanvas(grassTile(511, 5));
const DIRS = [['down', false], ['up', false], ['right', false], ['left', true]];
const DUR = { idle: [0.6, 0.6], walk: [0.15, 0.15, 0.15, 0.15], tool: [0.13, 0.09, 0.16, 0.3] };
const cells = [];
const gridEl = document.getElementById('grid');
for (const anim of Object.keys(ANIMS)) {
  for (const [dir, flip] of DIRS) {
    const c = document.createElement('div');
    c.className = 'cell';
    const small = document.createElement('canvas');
    small.width = 48; small.height = 64;
    const big = document.createElement('canvas');
    big.width = 48; big.height = 64;
    big.style.width = '192px'; big.style.height = '256px';
    c.append(big, small, `${anim} · ${dir}`);
    gridEl.appendChild(c);
    cells.push({ anim, dir, flip, ctxs: [small.getContext('2d'), big.getContext('2d')] });
  }
}
let t = Number(new URLSearchParams(location.search).get('t')) || 0, last = performance.now();
function frame(now) {
  const speed = new URLSearchParams(location.search).has('t') ? 0 : Number(document.getElementById('speed').value);
  t += ((now - last) / 1000) * speed;
  last = now;
  const tool = document.getElementById('tool').value;
  for (const cell of cells) {
    const durs = DUR[cell.anim];
    const total = durs.reduce((a, b) => a + b, 0);
    let k = t % total, i = 0;
    while (k > durs[i]) { k -= durs[i]; i++; }
    const d = cell.flip ? 'right' : cell.dir;
    const fi = Math.min(i, ANIMS[cell.anim].frames.length - 1);
    for (const ctx of cell.ctxs) {
      ctx.imageSmoothingEnabled = false;
      for (let y = 0; y < 64; y += 16) for (let x = 0; x < 48; x += 16) ctx.drawImage(grass, x, y);
      const held = cell.anim === 'tool' && i < 3 ? `held_${tool}_${d}_${i === 0 ? 'raise' : 'strike'}` : null;
      const behind = i === 0 || d === 'up';
      if (held && behind) atlas.draw(ctx, held, 24, 48, cell.flip);
      atlas.draw(ctx, `player_${d}_${cell.anim}${fi}`, 24, 48, cell.flip);
      if (held && !behind) atlas.draw(ctx, held, 24, 48, cell.flip);
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__previewReady = true;
