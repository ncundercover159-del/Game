// Enemy behaviours. Each brain is a small state machine over a Foe (world/foes.js). Every attack goes
// idle/approach -> tell (a wind-up the player can read: pose, flash, sound) -> attack -> recover, so
// there is always time to dodge or parry, and recovery is the opening to punish.
import { TILE } from '../config.js';
import { PARRY } from '../systems/combat.js';

const AGGRO = 110, LEASH = 220;
// The last part of a tell shows the glint: the parry cue.
export const GLINT = 0.15;

/** Wind-up states (every attack starts in one): tell, omen, summon and any `...Tell`. */
export const isTell = (s) => s === 'tell' || s === 'omen' || s === 'summon' || s.endsWith('Tell');

export const dist = (f, p) => Math.hypot(p.x - f.x, p.y - f.y);

/** Is the player within `reach` of the foe and roughly in front of where it faces? */
function inFront(f, p, reach) {
  const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy);
  if (d > reach + 8) return false;
  if (d < 10) return true;
  const [fx, fy] = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[f.dir];
  return (dx * fx + dy * fy) / d > 0.2;
}

/** A melee blow lands (or is parried: the foe reels). Illusions only look as if they strike. */
export function blow(f, w, dmg = f.dmg ?? f.def.dmg) {
  if (f.illusion) return null;
  const r = w.combat.enemyBlow(f, dmg);
  if (r === 'parried') f.stagger(PARRY.stagger * (f.def.boss ? 0.6 : 1));
  return r;
}

export function startTell(f, w, state = 'tell') {
  f.setState(state);
  f.mem.glinted = false;
  w.game.sfx('tell');
}

/** Show the glint once, GLINT seconds before a tell ends. */
function glint(f, dur) {
  if (!f.mem.glinted && f.t >= dur - GLINT) f.mem.glinted = true;
}

function leashed(f, w) {
  const p = w.game.player;
  if (dist(f, p) > LEASH) { f.setState('idle'); f.guard = false; return true; }
  return false;
}

const idle = (f, w, next = 'approach') => {
  if (dist(f, w.game.player) < AGGRO) f.setState(next);
};

// ---------------------------------------------------------------- nobushi: guard, raise, cut

function duelist(f, w, dt) {
  const p = w.game.player, d = f.def;
  switch (f.state) {
    case 'idle': f.guard = true; idle(f, w); break;
    case 'approach':
      if (leashed(f, w)) break;
      f.guard = true;
      f.face(p.x, p.y);
      if (dist(f, p) > d.reach - 2) f.walkTo(w.map, p.x, p.y, d.speed, dt);
      if (dist(f, p) <= d.reach + 6 && f.t > 0.4) { f.guard = false; startTell(f, w); f.mem.windup = d.tell; }
      break;
    case 'tell':
      glint(f, f.mem.windup);
      if (f.t >= f.mem.windup) { f.setState('attack'); f.mem.struck = false; }
      break;
    case 'attack':
      if (f.t < 0.08) f.move(w.map, ...lunge(f, 90), dt);
      if (!f.mem.struck) { f.mem.struck = true; if (inFront(f, p, d.reach)) blow(f, w); w.game.sfx('swing'); }
      if (f.t >= 0.25) {
        // Now and then a quicker second cut follows.
        if (!f.mem.double && w.combat.rng.next() < 0.3) { f.mem.double = true; startTell(f, w); f.mem.windup = d.tell * 0.6; f.face(p.x, p.y); }
        else { f.mem.double = false; f.setState('recover'); }
      }
      break;
    case 'recover': f.guard = false; if (f.t >= 0.7) f.setState('approach'); break;
    default: f.setState('approach');
  }
}

function lunge(f, speed) {
  const [x, y] = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[f.dir];
  return [x * speed, y * speed];
}

// ---------------------------------------------------------------- karakasa: squat, leap, stomp

function hopper(f, w, dt) {
  const p = w.game.player, d = f.def;
  switch (f.state) {
    case 'idle': idle(f, w); break;
    case 'approach':
      if (leashed(f, w)) break;
      if (f.t > 0.3) startTell(f, w);
      break;
    case 'tell':
      glint(f, d.tell);
      if (f.t >= d.tell) {
        const dx = p.x - f.x, dy = p.y - f.y, len = Math.hypot(dx, dy) || 1, jump = Math.min(len, 72);
        f.mem.from = { x: f.x, y: f.y };
        f.mem.to = { x: f.x + (dx / len) * jump, y: f.y + (dy / len) * jump };
        f.setState('leap');
        w.game.sfx('step');
      }
      break;
    case 'leap': {
      const k = Math.min(1, f.t / 0.5);
      const tx = f.mem.from.x + (f.mem.to.x - f.mem.from.x) * k, ty = f.mem.from.y + (f.mem.to.y - f.mem.from.y) * k;
      f.walkTo(w.map, tx, ty, 400, dt);
      f.z = Math.sin(k * Math.PI) * 18;
      if (k >= 1) {
        f.z = 0;
        w.fx.burst('fx_dirt', f.x, f.y, 5, { speed: 30, up: 30 });
        if (dist(f, p) < d.reach + 4) blow(f, w);
        f.setState('recover');
      }
      break;
    }
    case 'recover': if (f.t >= 0.7) f.setState('approach'); break;
    default: f.z = 0; f.setState('approach');
  }
}

// ---------------------------------------------------------------- bake-danuki: drum, roll, dizzy

function charger(f, w, dt) {
  const p = w.game.player, d = f.def;
  switch (f.state) {
    case 'idle': idle(f, w); break;
    case 'approach': {
      if (leashed(f, w)) break;
      f.face(p.x, p.y);
      const r = dist(f, p);
      if (r < 36) f.walkTo(w.map, f.x - (p.x - f.x), f.y - (p.y - f.y), d.speed, dt);
      else if (r > 90) f.walkTo(w.map, p.x, p.y, d.speed, dt);
      else if (f.t > 0.5) startTell(f, w);
      break;
    }
    case 'tell':
      glint(f, d.tell);
      if (f.t >= d.tell) {
        const dx = p.x - f.x, dy = p.y - f.y, len = Math.hypot(dx, dy) || 1;
        f.mem.v = [(dx / len) * 150, (dy / len) * 150];
        f.mem.hit = false;
        f.setState('roll');
      }
      break;
    case 'roll': {
      const moved = f.move(w.map, f.mem.v[0], f.mem.v[1], dt);
      if (!f.mem.hit && dist(f, p) < d.reach + 4) {
        f.mem.hit = true;
        if (blow(f, w) === 'parried') break;
      }
      if (moved < 150 * dt * 0.4) { w.game.sfx('rock'); w.game.shake(0.1); f.setState('dizzy'); f.stun = 1.3; break; }
      if (f.t >= 0.9) f.setState('recover');
      break;
    }
    case 'dizzy': f.setState('recover'); break;
    case 'recover': if (f.t >= 0.5) f.setState('approach'); break;
    default: f.setState('approach');
  }
}

// ---------------------------------------------------------------- kappa: lurk, splash, lunge

function ambusher(f, w, dt) {
  const p = w.game.player, d = f.def;
  const wet = w.map.isWater(Math.floor(f.home.x / TILE), Math.floor((f.home.y - 3) / TILE));
  switch (f.state) {
    case 'idle':
      if (wet) { f.hidden = true; f.setState('lurk'); } else idle(f, w);
      break;
    case 'lurk':
      f.hidden = true;
      if (dist(f, p) < 60) { f.hidden = false; f.mem.lunges = 0; w.fx.burst('fx_drop', f.x, f.y - 4, 10, { speed: 40, up: 70 }); startTell(f, w); f.face(p.x, p.y); }
      break;
    case 'approach':
      if (leashed(f, w)) break;
      f.face(p.x, p.y);
      f.walkTo(w.map, p.x, p.y, d.speed, dt);
      if (dist(f, p) < 44 && f.t > 0.6) startTell(f, w);
      break;
    case 'tell':
      glint(f, d.tell);
      if (f.t >= d.tell) {
        const dx = p.x - f.x, dy = p.y - f.y, len = Math.hypot(dx, dy) || 1;
        f.face(p.x, p.y);
        f.mem.v = [(dx / len) * 170, (dy / len) * 170];
        f.mem.hit = false;
        f.setState('lunge');
      }
      break;
    case 'lunge':
      f.move(w.map, f.mem.v[0], f.mem.v[1], dt);
      if (!f.mem.hit && dist(f, p) < d.reach + 4) { f.mem.hit = true; blow(f, w); }
      if (f.t >= 0.3) { f.mem.lunges = (f.mem.lunges || 0) + 1; f.setState('recover'); }
      break;
    case 'recover':
      if (f.t >= 0.6) f.setState(wet && f.mem.lunges >= 2 ? 'return' : 'approach');
      break;
    case 'return':
      f.walkTo(w.map, f.home.x, f.home.y, d.speed * 1.4, dt);
      if (dist(f, f.home) < 3 || f.t > 4) { f.hp = Math.min(f.maxHp, f.hp + Math.round(f.maxHp * 0.15)); f.setState('lurk'); }
      break;
    default: f.setState('approach');
  }
}

// ---------------------------------------------------------------- chōchin-obake: keep away, spit foxfire

function caster(f, w, dt) {
  const p = w.game.player, d = f.def;
  switch (f.state) {
    case 'idle': idle(f, w); break;
    case 'approach': {
      if (leashed(f, w)) break;
      const r = dist(f, p);
      if (r < 60) f.walkTo(w.map, f.x - (p.x - f.x), f.y - (p.y - f.y), d.speed, dt);
      else if (r > 100) f.walkTo(w.map, p.x, p.y, d.speed, dt);
      if (f.t > 1.6 && r < 130) startTell(f, w);
      break;
    }
    case 'tell':
      glint(f, d.tell);
      if (f.t >= d.tell) {
        const dx = p.x - f.x, dy = p.y - 10 - f.cy, len = Math.hypot(dx, dy) || 1;
        w.combat.shoot(f, 'foxfire', (dx / len) * 95, (dy / len) * 95, f.dmg);
        w.game.sfx('fire');
        f.setState('recover');
      }
      break;
    case 'recover': if (f.t >= 0.8) f.setState('approach'); break;
    default: f.setState('approach');
  }
}

// ---------------------------------------------------------------- yūrei: fade, gather, reach

function phantom(f, w, dt) {
  const p = w.game.player, d = f.def;
  switch (f.state) {
    case 'idle': f.alpha = 0.85; idle(f, w, 'drift'); break;
    case 'approach': f.setState('drift'); break;
    case 'drift':
      if (leashed(f, w)) break;
      f.hidden = false;
      f.alpha = 0.85;
      f.walkTo(w.map, p.x, p.y, 18, dt);
      if (f.t >= 2.2) f.setState('fade');
      break;
    case 'fade':
      f.alpha = Math.max(0, 0.85 - f.t * 2);
      if (f.alpha < 0.3) f.hidden = true;
      if (f.alpha <= 0) {
        const a = w.combat.rng.next() * Math.PI * 2;
        f.mem.at = { x: p.x + Math.cos(a) * 18, y: p.y + Math.sin(a) * 14 };
        f.setState('hidden');
      }
      break;
    case 'hidden':
      f.walkTo(w.map, f.mem.at.x, f.mem.at.y, 160, dt);
      if (f.t >= 0.9) { startTell(f, w, 'omen'); w.game.sfx('chill'); }
      break;
    case 'omen':
      glint(f, d.tell);
      if (f.t >= d.tell) { f.hidden = false; f.alpha = 0.9; f.face(p.x, p.y); f.setState('attack'); f.mem.struck = false; }
      break;
    case 'attack':
      // Cold hands reach out toward you as it strikes.
      if (f.t < 0.12) f.walkTo(w.map, p.x, p.y, 70, dt);
      if (!f.mem.struck && f.t >= 0.12) { f.mem.struck = true; if (dist(f, p) < d.reach + 8) blow(f, w); }
      if (f.t >= 0.35) f.setState('recover');
      break;
    case 'recover': f.alpha = 0.9; if (f.t >= 0.7) f.setState('drift'); break;
    default: f.setState('drift');
  }
}

export const BRAINS = { duelist, hopper, charger, ambusher, caster, phantom };
