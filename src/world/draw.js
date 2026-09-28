// World drawing: water, ground chunks, target tile, shadows, then every sprite y-sorted (objects,
// crops, buildings, drops, the player), then particles.
import { TILE } from '../config.js';
import { OBJECT_TYPES } from '../data/objects.js';
import { stageOf } from '../data/crops.js';
import { hex } from '../art/palette.js';

const SHADOW_ALPHA = 0.36;
const pool = [];
const list = [];

function rec(y, kind, ref) {
  const r = pool.pop() || {};
  r.y = y; r.kind = kind; r.ref = ref;
  list.push(r);
}

/** The seasonal variant of a frame when the atlas has one (`name@autumn`). */
function seasonal(atlas, name, season) {
  if (season === 'spring') return name;
  const alt = `${name}@${season}`;
  return atlas.has(alt) ? alt : name;
}

function objectSprite(o) {
  switch (o.type) {
    case 'sluice': return o.open ? 'sluice_open' : 'sluice_shut';
    case 'weed': return o.v === 3 ? 'weed_flower' : `weed${o.v}`;
    case 'stone': return `stone${o.v}`;
    case 'twig': return `twig${o.v}`;
    case 'bamboo': return `bamboo${o.v}`;
    case 'fence': return o.v ? 'fence_post' : 'fence';
    default: return o.kind ? `${o.type}_${o.kind}` : o.type;
  }
}

export function drawWorld(w, ctx, cam) {
  const { map, ground, player, game } = w;
  const atlas = game.atlas;
  ground.drawWater(ctx, cam, w.time);
  ground.flush();
  ground.draw(ctx, cam);

  const x0 = Math.max(0, Math.floor(cam.ix / TILE) - 3), x1 = Math.min(map.w - 1, Math.floor((cam.ix + cam.w) / TILE) + 3);
  const y0 = Math.max(0, Math.floor(cam.iy / TILE) - 1), y1 = Math.min(map.h - 1, Math.floor((cam.iy + cam.h) / TILE) + 5);

  // Collect drawables.
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const k = ty * map.w + tx;
    const oi = map.objAt[k];
    if (oi >= 0) {
      const o = map.objects[oi];
      if (OBJECT_TYPES[o.type].flat) drawObject(w, ctx, cam, o);
      else rec((ty + 1) * TILE, 'obj', o);
    }
    const crop = map.crops.get(k);
    if (crop) rec((ty + 1) * TILE - 2, 'crop', { crop, tx, ty });
  }
  for (const b of map.buildings) rec((b.ty + b.h) * TILE, 'bld', b);
  for (const d of w.drops.list) rec(d.y, 'drop', d);
  for (const n of game.villagers.onMap(map.id)) rec(n.y, 'npc', n);
  rec(player.y, 'player', player);

  if (game.scene === 'play') drawTarget(w, ctx, cam);

  // Shadows under everything that stands up.
  ctx.globalAlpha = SHADOW_ALPHA;
  for (const r of list) {
    if (r.kind === 'obj') {
      const s = OBJECT_TYPES[r.ref.type].shadow;
      if (s) atlas.draw(ctx, s, r.ref.x * TILE + 8 - cam.ix, r.ref.y * TILE + 14 - cam.iy);
    } else if (r.kind === 'player' || r.kind === 'npc') {
      atlas.draw(ctx, 'shadow_s', Math.round(r.ref.x) - cam.ix, Math.round(r.ref.y) - 1 - cam.iy);
    } else if (r.kind === 'drop') {
      atlas.draw(ctx, 'shadow_s', r.ref.x - cam.ix, r.ref.y - cam.iy);
    }
  }
  ctx.globalAlpha = 1;

  list.sort((a, b) => a.y - b.y);
  for (const r of list) {
    if (r.kind === 'obj') drawObject(w, ctx, cam, r.ref);
    else if (r.kind === 'crop') {
      const { crop, tx, ty } = r.ref;
      const name = crop.dead ? 'crop_withered' : `crop_${crop.id}_${stageOf(crop.id, crop.growth)}`;
      atlas.draw(ctx, name, tx * TILE + 8 - cam.ix, ty * TILE + 15 - cam.iy);
    } else if (r.kind === 'bld') {
      const b = r.ref;
      const [bx, by] = map.spriteOrigin(b);
      atlas.draw(ctx, seasonal(atlas, b.sprite, game.seasonId), bx - cam.ix, by - cam.iy);
    } else if (r.kind === 'drop') {
      const d = r.ref;
      const bob = d.z === 0 ? Math.round(Math.sin(w.time * 4 + d.x) * 1) : 0;
      atlas.draw(ctx, `icon_${d.id}`, d.x - 8 - cam.ix, d.y - 14 - d.z + bob - cam.iy);
    } else if (r.kind === 'npc') {
      const n = r.ref, f = n.frame();
      const x = Math.round(n.x) - cam.ix, y = Math.round(n.y) - cam.iy;
      atlas.draw(ctx, f.name, x, y, f.flip);
      if (n.emote) atlas.draw(ctx, `emote_${n.emote.kind}`, x, y - 32 - Math.round(Math.min(1, (1.6 - n.emote.t) * 8) * 2));
    } else drawPlayer(w, ctx, cam);
  }
  for (const r of list) pool.push(r);
  list.length = 0;

  w.fx.draw(ctx, atlas, cam);
}

function drawObject(w, ctx, cam, o) {
  const atlas = w.game.atlas;
  const bx = o.x * TILE + 8 + (o.ox || 0) - cam.ix + (o.shake > 0 ? Math.round(Math.sin(w.time * 70) * 2 * (o.shake / 0.25)) : 0);
  const by = (o.y + 1) * TILE + (o.oy || 0) - cam.iy;
  if (o.type === 'tree' || o.type === 'forest' || o.type === 'sacred') {
    const base = `tree_${o.kind}${o.v}`;
    atlas.draw(ctx, `${base}_trunk`, bx, by - 1);
    if (o.type === 'sacred') atlas.draw(ctx, 'shimenawa', bx, by - 16);
    const sway = Math.round(Math.sin(w.time * 1.1 + o.x * 0.9 + o.y * 0.3) * 0.7);
    // Walk-behind: fade the canopy when the player is hidden under it.
    const p = w.player;
    const canopy = seasonal(atlas, `${base}_canopy`, w.game.seasonId);
    const f = atlas.frame(canopy);
    const behind = p.y < (o.y + 1) * TILE && Math.abs(p.x - (o.x * TILE + 8)) < f.w / 2 && p.y > (o.y + 1) * TILE - f.ay + 8;
    if (behind) ctx.globalAlpha = 0.55;
    atlas.draw(ctx, canopy, bx + sway, by - 1);
    ctx.globalAlpha = 1;
    return;
  }
  atlas.draw(ctx, seasonal(atlas, objectSprite(o), w.game.seasonId), bx, by);
  // Unread letters: a bubble over the mailbox.
  if (o.type === 'mailbox' && w.game.mail.inbox.some((l) => !l.read)) atlas.draw(ctx, 'emote_bang', bx, by - 20 + Math.round(Math.sin(w.time * 3)));
}

function drawPlayer(w, ctx, cam) {
  const p = w.player;
  const atlas = w.game.atlas;
  const f = p.frame();
  const x = Math.round(p.x) - cam.ix, y = Math.round(p.y) - cam.iy;
  const tool = p.swing ? p.swing.tool : p.charge ? p.chargeTool : null;
  const held = tool ? `held_${tool}_${f.dir}_${f.pose}` : null;
  // A raised tool is behind the head; a strike toward the camera or sideways is in front.
  const behind = f.pose === 'raise' || f.dir === 'up';
  if (held && behind) atlas.draw(ctx, held, x, y, f.flip);
  atlas.draw(ctx, f.name, x, y, f.flip);
  if (held && !behind) atlas.draw(ctx, held, x, y, f.flip);
  if (p.charge) {
    // Charge pips over the head: one per level reached.
    const level = w.chargeLevel();
    for (let i = 0; i < p.charge.max; i++) {
      ctx.fillStyle = hex('ink0');
      ctx.fillRect(x - p.charge.max * 3 + i * 6, y - 40, 5, 4);
      ctx.fillStyle = hex(i < level ? 'gold2' : 'ink3');
      ctx.fillRect(x - p.charge.max * 3 + i * 6 + 1, y - 39, 3, 2);
    }
  }
}

function drawTarget(w, ctx, cam) {
  const t = w.target;
  if (!t || !w.map.inside(t.x, t.y)) return;
  const pulse = 0.65 + 0.35 * Math.abs(Math.sin(w.time * 3));
  ctx.globalAlpha = pulse;
  for (const [x, y] of w.targetTiles()) if (w.map.inside(x, y)) w.game.atlas.draw(ctx, 'ui_target', x * TILE - cam.ix, y * TILE - cam.iy);
  ctx.globalAlpha = 1;
  if (!w.game.input.mouseAiming()) return;
  // Reach indicator: corner ticks around the 3x3 the mouse can target.
  const p = w.player;
  const x = (p.tx - 1) * TILE - cam.ix, y = (p.ty - 1) * TILE - cam.iy, s = TILE * 3;
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = hex('ink5');
  for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + s - 1, y, -1, 1], [x, y + s - 1, 1, -1], [x + s - 1, y + s - 1, -1, -1]]) {
    ctx.fillRect(Math.min(cx, cx + dx * 3), cy, 4, 1);
    ctx.fillRect(cx, Math.min(cy, cy + dy * 3), 1, 4);
  }
  ctx.globalAlpha = 1;
}
