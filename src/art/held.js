// Tools held during swing animations. Each (tool, direction, pose) becomes one sprite anchored like
// the character (anchor = the character's feet), so it is drawn at the player's position.
// Heads are drawn once pointing right and rotated for other directions.
import { grid, line, blit, parse, outline, bounds, crop } from './raster.js';

const STEEL = { a: 'stone4', b: 'stone3', c: 'stone2', d: 'stone1', w: 'wood4', W: 'wood2', g: 'gold1', G: 'gold0' };

// Heads in "right" orientation; the handle attaches at the head's top-left pixel.
const HEADS = {
  hoe: `
    ab
    bc
    bc
    cd
    d.`,
  axe: `
    .ab.
    abbc
    abcd
    .bd.`,
  pickaxe: `
    .a
    ab
    bc
    .c
    .d`,
  sickle: `
    abbb.
    ....c
    ....d
    ...d.`,
};

function rotateCW(g) {
  const out = grid(g.h, g.w);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) out.px[x * out.w + (g.h - 1 - y)] = g.px[y * g.w + x];
  return out;
}
function rotateCCW(g) {
  const out = grid(g.h, g.w);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) out.px[(g.w - 1 - x) * out.w + y] = g.px[y * g.w + x];
  return out;
}

function headFor(tool, orient) {
  const g = parse(HEADS[tool], STEEL);
  if (orient === 'down') return rotateCW(g);
  if (orient === 'up') return rotateCCW(g);
  return g;
}

// [hand, end, head orientation] in frame coordinates (anchor (8, 32)).
const POSES = {
  down: { raise: [[9, 16], [11, -5], 'up'], strike: [[8, 22], [8, 38], 'down'] },
  up: { raise: [[8, 16], [7, -5], 'up'], strike: [[8, 16], [8, -8], 'up'] },
  right: { raise: [[9, 17], [1, -2], 'up'], strike: [[11, 22], [22, 31], 'right'] },
};

// Working canvas: frame coordinates are offset by PAD so tools can extend beyond the frame.
const PAD = 16;

function swingSprite(tool, dir, pose) {
  const [[hx, hy], [ex, ey], orient] = POSES[dir][pose];
  const g = grid(16 + PAD * 2, 32 + PAD * 2);
  line(g, hx + PAD, hy + PAD, ex + PAD, ey + PAD, 'wood4');
  line(g, hx + PAD + 1, hy + PAD, ex + PAD + 1, ey + PAD, 'wood2');
  const head = headFor(tool, orient);
  const ox = orient === 'up' ? ex - 1 : orient === 'down' ? ex - head.w + 2 : ex;
  const oy = orient === 'up' ? ey - head.h + 1 : ey;
  blit(g, head, ox + PAD, oy + PAD);
  return finish(outline(g, { color: 'ink0', pad: 0 }));
}

function finish(g) {
  const b = bounds(g);
  const out = crop(g, ...b);
  // Anchor: the character's feet (8, 32) in frame coordinates, relative to the cropped sprite.
  return { g: out, ax: 8 + PAD - b[0], ay: 32 + PAD - b[1] };
}

// Watering can held in front; tilted when pouring.
const CAN = { o: 'ink0', a: 'wood2', b: 'wood1', c: 'gold1', d: 'gold0', w: 'water3' };
const CAN_GRIDS = {
  hold: `
    ..aaaa...
    .a....a..
    obbbbbbo.
    obccccdo.
    obcccddooo
    obccccdoc.
    obbbbbbo..
    .oooooo...`,
  pour: `
    ...aaaa.....
    ..a....a....
    .obbbbbbo...
    .obccccdo...
    .obcccddooo.
    .obccccdo.co
    ..obbbbbo..w
    ...ooooo...w`,
};

function canSprite(dir, pose) {
  const rows = CAN_GRIDS[pose === 'raise' ? 'hold' : 'pour'];
  let c = parse(rows, CAN);
  if (dir === 'down' || dir === 'up') c = rotateCW(c);
  const g = grid(16 + PAD * 2, 32 + PAD * 2);
  const at = { down: [4, 18], up: [4, 12], right: [9, 17] }[dir];
  blit(g, c, at[0] + PAD, at[1] + PAD + (pose === 'raise' ? 0 : 2));
  return finish(g);
}

export const HELD_TOOLS = ['hoe', 'axe', 'pickaxe', 'sickle', 'can'];

/** Register `held_${tool}_${dir}_${pose}` for pose in raise/strike. */
export function addHeldTools(atlas) {
  for (const tool of HELD_TOOLS) for (const dir of ['down', 'up', 'right']) for (const pose of ['raise', 'strike']) {
    const s = tool === 'can' ? canSprite(dir, pose) : swingSprite(tool, dir, pose);
    atlas.add(`held_${tool}_${dir}_${pose}`, s.g, s.ax, s.ay);
  }
}
