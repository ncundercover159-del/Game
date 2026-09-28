// Drawing the fight: foes (with their tells, flashes and omens), projectiles, the player's combat
// poses and slash arcs, dodge afterimages, damage numbers and the Ki ring. Called from draw.js.
import { hex } from '../art/palette.js';
import { fonts } from '../core/text.js';
import { kiMax } from '../systems/combat.js';
import { isTell } from './brains.js';

const PERSON = { bandit: 'katana_tetsu', jubei: 'kurogane', shinobi: 'katana_tetsu' };

/** Frame (and held weapon) for a foe's current state. */
function foeFrame(f) {
  const flip = f.dir === 'left', d = flip ? 'right' : f.dir;
  const step = (n, per) => Math.floor(f.anim / per) % n;
  if (PERSON[f.kind]) {
    const w = PERSON[f.kind], id = f.kind;
    if (isTell(f.state)) return { name: `${id}_${d}_tool0`, held: `held_${w}_${d}_raise`, behind: true, flip };
    if (f.state === 'attack' || f.state === 'dash') return { name: `${id}_${d}_tool${f.t < 0.1 ? 1 : 2}`, held: `held_${w}_${d}_strike`, behind: d === 'up', flip };
    if (f.state === 'approach' && f.guard) return { name: `${id}_${d}_walk${step(4, 0.15)}`, held: `held_${w}_${d}_guard`, behind: d === 'up', flip };
    if (f.state === 'approach') return { name: `${id}_${d}_walk${step(4, 0.15)}`, flip };
    return { name: `${id}_${d}_idle${step(2, 0.6)}`, flip };
  }
  switch (f.kind) {
    case 'karakasa':
      if (f.state === 'tell') return { name: 'karakasa_squat', flip };
      if (f.state === 'leap') return { name: 'karakasa_leap', flip };
      return { name: `karakasa_idle${step(2, 0.3)}`, flip };
    case 'tanuki':
      if (f.state === 'tell') return { name: 'tanuki_drum', flip, shake: true };
      if (f.state === 'roll') return { name: `tanuki_roll${step(2, 0.08)}`, flip };
      if (f.state === 'dizzy' || f.state === 'stagger') return { name: 'tanuki_dizzy', flip };
      return { name: `tanuki_walk${step(2, 0.2)}`, flip };
    case 'kappa':
      if (f.state === 'lunge' || f.state === 'attack') return { name: 'kappa_lunge', flip };
      return { name: `kappa_walk${step(2, 0.2)}`, flip };
    case 'chochin':
      if (f.state === 'tell') return { name: 'chochin_glow', flip };
      return { name: `chochin_float${step(2, 0.25)}`, flip };
    case 'yurei':
      if (f.state === 'attack' || f.state === 'recover') return { name: 'yurei_reach', flip };
      return { name: `yurei_drift${step(2, 0.4)}`, flip };
    case 'kitsune':
      if (f.state === 'tell' || f.state === 'split') return { name: 'kitsune_crouch', flip, shake: f.state === 'split' };
      if (f.state === 'lunge') return { name: 'kitsune_lunge', flip };
      return { name: `kitsune_walk${step(2, 0.14)}`, flip };
    case 'onibi':
      if (f.state === 'tell') return { name: step(2, 0.08) ? 'onibi_flare' : 'onibi_float0', flip };
      if (f.state === 'dive') return { name: 'onibi_dive', flip };
      return { name: `onibi_float${step(2, 0.2)}`, flip };
    case 'tengu':
      if (f.state === 'summon') return { name: 'tengu_spread', flip };
      if (f.state === 'tell' || f.state === 'throwTell' || f.state === 'attack') return { name: 'tengu_fan', flip };
      return { name: `tengu_idle${step(2, 0.3)}`, flip };
    case 'karasu':
      if (f.state === 'dive') return { name: 'karasu_dive', flip };
      return { name: `karasu_fly${step(2, f.state === 'tell' ? 0.05 : 0.12)}`, flip };
    case 'oni':
      if (f.state === 'tell') return { name: 'oni_raise', flip, shake: f.t > f.def.tell - 0.2 };
      if (f.state === 'attack' || (f.state === 'recover' && f.t < 0.4)) return { name: 'oni_smash', flip };
      return { name: `oni_walk${step(2, 0.3)}`, flip };
    case 'inoshishi':
      if (f.state === 'tell') return { name: 'inoshishi_paw', flip, shake: true };
      if (f.state === 'roll') return { name: `inoshishi_charge${step(2, 0.08)}`, flip };
      if (f.state === 'dizzy' || f.state === 'stagger') return { name: 'inoshishi_paw', flip };
      return { name: `inoshishi_walk${step(2, 0.2)}`, flip };
    case 'kappa_elder':
      if (f.state === 'shikoTell') return { name: 'kappa_elder_stomp', flip, shake: f.t > 0.5 };
      if (f.state === 'tell' || f.state === 'attack') return { name: f.state === 'attack' ? 'kappa_elder_slap' : 'kappa_elder_idle0', flip };
      if (f.state === 'bowTell' || f.state === 'spilled' || f.state === 'stagger') return { name: 'kappa_elder_bow', flip };
      if (f.state === 'charge' || f.state === 'lunge' || f.state === 'surfaceTell' || f.state === 'spitTell') return { name: 'kappa_elder_charge', flip };
      return { name: `kappa_elder_idle${step(2, 0.5)}`, flip };
    case 'kyubi':
      if (f.state === 'dash') return { name: 'kyubi_dash', flip };
      if (f.state === 'tired' || f.state === 'stagger') return { name: 'kyubi_tired', flip };
      if (isTell(f.state) || f.state === 'channel') return { name: 'kyubi_tell', flip };
      return { name: `kyubi_idle${step(2, 0.35)}`, flip };
    case 'kurenai': {
      const k = f.armour > 0 ? 'kurenai' : 'kurenai_bare';
      if (f.state === 'tell') return { name: `${k}_raise`, flip };
      if (f.state === 'attack' || (f.state === 'recover' && f.t < 0.3)) return { name: `${k}_smash`, flip };
      if (f.state === 'breathTell') return { name: `${k}_breathe`, flip, shake: true };
      if (f.state === 'leapTell') return { name: `${k}_crouch`, flip };
      return { name: `${k}_walk${step(2, 0.35)}`, flip };
    }
    default: return { name: 'karakasa_idle0', flip };
  }
}

/** Add foes and shots to the y-sorted draw list. */
export function collectCombat(w, rec) {
  for (const f of w.combat.foes) if (!f.hidden) rec(f.y, 'foe', f);
  for (const s of w.combat.shots) rec(s.y + 10, 'shot', s);
}

/** Shadows: none for illusions (that is how you tell them), a wide one for bosses and the big. */
export function foeShadow(w, ctx, cam, f) {
  if (f.illusion) return;
  w.game.atlas.draw(ctx, f.def.boss || f.def.big ? 'fx_boss_shadow' : 'shadow_s', Math.round(f.x) - cam.ix, Math.round(f.y) - 1 - cam.iy);
}

export function drawFoe(w, ctx, cam, f) {
  const atlas = w.game.atlas;
  const fr = foeFrame(f);
  const bob = f.def.float ? Math.round(Math.sin(f.anim * 3) * 2) - 4 : 0;
  const x = Math.round(f.x) + (fr.shake ? Math.round(Math.sin(f.anim * 60)) : 0) - cam.ix;
  const y = Math.round(f.y - f.z) + bob - cam.iy;
  ctx.globalAlpha = f.alpha;
  if (fr.held && fr.behind) atlas.draw(ctx, fr.held, x, y, fr.flip);
  if (f.flash > 0) atlas.drawWhite(ctx, fr.name, x, y, fr.flip);
  else atlas.draw(ctx, fr.name, x, y, fr.flip);
  if (fr.held && !fr.behind) atlas.draw(ctx, fr.held, x, y, fr.flip);
  ctx.globalAlpha = 1;
  // The glint: the last moment of a tell, the cue to parry.
  if (isTell(f.state) && f.mem.glinted) {
    const k = Math.floor(f.t * 20) % 2;
    const top = f.def.person ? 36 : f.def.boss || f.def.big ? (f.def.height || 18) * 2 + 6 : 22;
    atlas.draw(ctx, 'fx_glint', x + (fr.flip ? -6 : 6), y - top - k);
  }
  if (f.state === 'stagger' || f.state === 'dizzy') atlas.draw(ctx, 'emote_dots', x, y - 30);
}

export function drawShot(w, ctx, cam, s) {
  const atlas = w.game.atlas;
  const x = Math.round(s.x) - cam.ix, y = Math.round(s.y) - cam.iy;
  const two = Math.floor(s.t * 8) % 2;
  if (s.flare && two) atlas.draw(ctx, 'fx_orb_flare', x, y);
  else if (s.kind === 'foxfire') atlas.draw(ctx, `fx_foxfire${two}`, x, y);
  else if (s.kind === 'water' || s.kind === 'fire') atlas.draw(ctx, `fx_${s.kind}${two}`, x, y);
  else if (s.kind === 'shuriken') atlas.draw(ctx, `fx_shuriken${Math.floor(s.t * 16) % 2}`, x, y);
  else if (s.kind === 'feather') atlas.draw(ctx, 'fx_feather', x, y, s.vx < 0);
  else atlas.draw(ctx, s.dir === 'up' || s.dir === 'down' ? 'fx_arrow_down' : 'fx_arrow_right', x, y, s.dir === 'left');
}

/** Omens drawn on the ground: kappa ripples, the cold wisps where a yūrei will appear. */
export function drawOmens(w, ctx, cam) {
  const atlas = w.game.atlas;
  for (const f of w.combat.foes) {
    if (f.kind === 'kappa' && f.state === 'lurk') atlas.draw(ctx, `fx_ripple${Math.floor(w.time * 3) % 3}`, Math.round(f.x) - cam.ix, Math.round(f.y) - 4 - cam.iy);
    if (f.kind === 'yurei' && f.state === 'omen') atlas.draw(ctx, `fx_wisp${Math.floor(f.t * 6) % 2}`, Math.round(f.x) - cam.ix, Math.round(f.y) - 10 - cam.iy);
    // A shinobi's footfalls raise a little dust even while it is unseen.
    if (f.kind === 'shinobi' && f.state === 'stalk' && Math.floor(f.t * 5) % 2) atlas.draw(ctx, 'fx_pebble', Math.round(f.x) - cam.ix, Math.round(f.y) - 2 - cam.iy);
    // The Kappa Elder under the moat: his ripple.
    if (f.kind === 'kappa_elder' && f.hidden) atlas.draw(ctx, `fx_ripple${Math.floor(w.time * 3) % 3}`, Math.round(f.x) - cam.ix, Math.round(f.y) - 4 - cam.iy);
    // Where Kurenai will land: a shadow that grows as she comes down.
    if (f.kind === 'kurenai' && f.mem.land && (f.state === 'leapTell' || f.state === 'leap') && Math.floor(w.time * 10) % 2) {
      atlas.draw(ctx, 'fx_boss_shadow', Math.round(f.mem.land.x) - cam.ix, Math.round(f.mem.land.y) - 1 - cam.iy);
    }
  }
}

/** The player in a combat pose; returns false when the normal drawing should be used. */
export function drawPlayerCombat(w, ctx, cam, x, y) {
  const fighter = w.combat.fighter, atlas = w.game.atlas;
  for (const gh of fighter.ghosts) {
    ctx.globalAlpha = 0.35 * (1 - gh.t / 0.25);
    const d = gh.dir === 'left' ? 'right' : gh.dir;
    atlas.draw(ctx, `player_${d}_walk1`, Math.round(gh.x) - cam.ix, Math.round(gh.y) - cam.iy, gh.dir === 'left');
  }
  ctx.globalAlpha = fighter.iframes > 0 && !fighter.act && Math.floor(fighter.iframes * 20) % 2 ? 0.5 : 1;
  const pose = fighter.pose();
  if (!pose) {
    ctx.globalAlpha = 1;
    if (fighter.flash > 0) { const f = w.player.frame(); atlas.drawWhite(ctx, f.name, x, y, f.flip); return true; }
    return false;
  }
  if (pose.held && pose.behind) atlas.draw(ctx, pose.held, x, y, pose.flip);
  if (fighter.flash > 0) atlas.drawWhite(ctx, pose.body, x, y, pose.flip);
  else atlas.draw(ctx, pose.body, x, y, pose.flip);
  if (pose.held && !pose.behind) atlas.draw(ctx, pose.held, x, y, pose.flip);
  ctx.globalAlpha = 1;
  if (pose.glow && Math.floor(w.time * 12) % 2) atlas.draw(ctx, 'fx_sparkle', x + (pose.flip ? -8 : 8), y - 34);
  drawSlash(w, ctx, x, y);
  return true;
}

/** The arc of a cut: a sweep of pale pixels at the weapon's reach, only during the active frames. */
function drawSlash(w, ctx, x, y) {
  const fighter = w.combat.fighter, a = fighter.act;
  if (!a || (a.kind !== 'slash' && a.kind !== 'heavy')) return;
  const wpn = fighter.weapon();
  if (!wpn || wpn.cls === 'bow') return;
  const [t0, t1] = a.kind === 'heavy' ? [0.1, 0.22] : [fighter.phase(0), fighter.phase(1)];
  if (a.t < t0 || a.t > t1 + 0.05) return;
  const k = Math.min(1, (a.t - t0) / (t1 - t0));
  const base = { down: Math.PI / 2, up: -Math.PI / 2, right: 0, left: Math.PI }[w.player.dir];
  const arc = wpn.arc + (a.kind === 'heavy' ? 0.5 : 0);
  const reach = wpn.reach + (a.kind === 'heavy' ? 6 : 0);
  const cy = y - 10;
  // Alternate the sweep direction through the combo.
  const dirSign = (a.combo || 0) % 2 ? -1 : 1;
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    if (u > k) break;
    const ang = base + dirSign * (-arc + 2 * arc * u);
    for (let r = reach - 5; r <= reach; r++) {
      const edge = r === reach || r === reach - 5;
      ctx.fillStyle = hex(edge ? 'stone3' : u > k - 0.3 ? 'ink6' : 'stone4');
      ctx.fillRect(Math.round(x + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r * 0.8), 1, 1);
    }
  }
}

/** Damage numbers, shockwave rings and the Ki ring around the player's feet. */
export function drawCombatOverlay(w, ctx, cam) {
  const g = w.game;
  for (const r of w.combat.rings) {
    const k = r.t / 0.35, rad = r.r * (0.3 + 0.7 * k);
    ctx.fillStyle = hex(k < 0.5 ? 'ink6' : 'gold2');
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      ctx.fillRect(Math.round(r.x + Math.cos(a) * rad) - cam.ix, Math.round(r.y + Math.sin(a) * rad * 0.6) - cam.iy, 2, 1);
    }
  }
  for (const fl of w.combat.floaters) {
    ctx.globalAlpha = Math.min(1, (0.8 - fl.t) * 4);
    fonts.small.draw(ctx, fl.text, Math.round(fl.x) - cam.ix - 3, Math.round(fl.y) - cam.iy, fl.color);
  }
  ctx.globalAlpha = 1;
  const max = kiMax(g.virtues);
  if (!w.map.def.cave || (g.ki >= max && !w.combat.engaged)) return;
  const p = g.player, cx = Math.round(p.x) - cam.ix, cy = Math.round(p.y) - cam.iy + 1;
  const n = 28, lit = Math.round((g.ki / max) * n);
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
    ctx.fillStyle = hex(i < lit ? (g.ki < 20 ? 'red3' : 'water4') : 'ink2');
    ctx.fillRect(Math.round(cx + Math.cos(ang) * 11), Math.round(cy + Math.sin(ang) * 4), 1, 1);
  }
}

