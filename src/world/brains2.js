// Behaviours of the deep zones, in the same shape as world/brains.js: every blow, shot and
// shockwave follows a tell the player can read.
//   trickster (kitsune)   circles, crouches and bites; hurt, it splits into illusions with no shadow
//   swarm (onibi, crows)  orbit the player loosely, flare, then stoop at where you stood
//   summoner (tengu)      keeps its distance, spreads its wings to call crows, flicks feathers like
//                         knives, and fans you up close
//   brute (oni)           guards, raises its club a long moment, smashes (a shockwave ring), then
//                         stands open while the ground still shakes
//   stealth (shinobi)     unseen but for dust at its feet; appears, raises an arm, throws three stars,
//                         cuts if you are close, and vanishes in smoke
import { BRAINS, blow, startTell, dist, GLINT } from './brains.js';
import { TILE } from '../config.js';

const AGGRO = 120, LEASH = 230;
const DIR = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

function glint(f, dur) {
  if (!f.mem.glinted && f.t >= dur - GLINT) f.mem.glinted = true;
}

function awake(f, w) {
  if (dist(f, w.game.player) < AGGRO) { f.setState('approach'); return true; }
  return false;
}

function leashed(f, w) {
  if (dist(f, w.game.player) > LEASH) { f.setState('idle'); return true; }
  return false;
}

/** A point `r` px from the player at angle `a`, pulled back onto open ground if it is in rock. */
function around(w, a, r) {
  const p = w.game.player;
  const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r * 0.8;
  return w.map.solid(Math.floor(x / TILE), Math.floor((y - 3) / TILE)) ? { x: p.x, y: p.y } : { x, y };
}

// ---------------------------------------------------------------- kitsune

function trickster(f, w, dt) {
  const p = w.game.player, d = f.def, m = f.mem;
  switch (f.state) {
    case 'idle': awake(f, w); break;
    case 'approach': {
      if (leashed(f, w)) break;
      m.a = (m.a ?? w.combat.rng.next() * 6.28) + dt * 1.2;
      const at = around(w, m.a, 46);
      f.walkTo(w.map, at.x, at.y, d.speed, dt);
      f.face(p.x, p.y);
      // Hurt once, the real fox throws off two copies of itself.
      if (!f.illusion && !m.split && f.hp < f.maxHp * 0.6) { f.setState('split'); break; }
      if (f.t > 1.4 + (m.jitter ??= w.combat.rng.next())) { startTell(f, w); m.jitter = undefined; }
      break;
    }
    case 'split':
      if (f.t >= 0.5) {
        m.split = true;
        w.combat.smoke(f.x, f.y);
        for (const a of [-1.2, 1.2]) {
          const at = around(w, Math.atan2(f.y - p.y, f.x - p.x) + a, 44);
          const c = w.combat.spawn(f.kind, Math.floor(at.x / TILE), Math.floor((at.y - 3) / TILE));
          c.illusion = true;
          c.maxHp = c.hp = 1;
          c.mem.split = true;
          c.mem.life = 9;
          c.setState('approach');
        }
        f.setState('approach');
      }
      break;
    case 'tell':
      glint(f, d.tell);
      if (f.t >= d.tell) {
        const dx = p.x - f.x, dy = p.y - f.y, len = Math.hypot(dx, dy) || 1;
        f.face(p.x, p.y);
        m.v = [(dx / len) * 190, (dy / len) * 190];
        m.hit = false;
        f.setState('lunge');
      }
      break;
    case 'lunge':
      f.move(w.map, m.v[0], m.v[1], dt);
      if (!m.hit && dist(f, p) < d.reach + 4) { m.hit = true; if (!f.illusion) blow(f, w); }
      if (f.t >= 0.28) f.setState('recover');
      break;
    case 'recover': if (f.t >= 0.6) f.setState('approach'); break;
    default: f.setState('approach');
  }
  // Illusions fade after a while.
  if (f.illusion && (m.life -= dt) <= 0) w.combat.pop(f);
}

// ---------------------------------------------------------------- onibi, crows

function swarm(f, w, dt) {
  const p = w.game.player, d = f.def, m = f.mem;
  switch (f.state) {
    case 'idle': awake(f, w); break;
    case 'approach': {
      if (leashed(f, w)) break;
      m.a = (m.a ?? w.combat.rng.next() * 6.28) + dt * (m.spin ??= w.combat.rng.next() < 0.5 ? 1.4 : -1.4);
      const at = around(w, m.a, 40);
      f.walkTo(w.map, at.x, at.y, d.speed, dt);
      if (f.t > (m.wait ??= 1.4 + w.combat.rng.next() * 1.6)) { m.wait = undefined; startTell(f, w); }
      break;
    }
    case 'tell':
      glint(f, d.tell);
      if (f.t >= d.tell) {
        const dx = p.x - f.x, dy = p.y - f.y, len = Math.hypot(dx, dy) || 1;
        m.v = [(dx / len) * 170, (dy / len) * 170];
        m.hit = false;
        f.face(p.x, p.y);
        f.setState('dive');
      }
      break;
    case 'dive':
      f.move(w.map, m.v[0], m.v[1], dt);
      if (!m.hit && dist(f, p) < d.reach + 4) { m.hit = true; blow(f, w); }
      if (f.t >= 0.3) f.setState('recover');
      break;
    case 'recover': if (f.t >= 0.5) f.setState('approach'); break;
    default: f.setState('approach');
  }
}

// ---------------------------------------------------------------- tengu

const CROWS = 3;

function summoner(f, w, dt) {
  const p = w.game.player, d = f.def, m = f.mem;
  m.callCd = Math.max(0, (m.callCd ?? 1) - dt);
  switch (f.state) {
    case 'idle': awake(f, w); break;
    case 'approach': {
      if (leashed(f, w)) break;
      const r = dist(f, p);
      f.face(p.x, p.y);
      if (r < 70) f.walkTo(w.map, f.x - (p.x - f.x), f.y - (p.y - f.y), d.speed, dt);
      else if (r > 110) f.walkTo(w.map, p.x, p.y, d.speed, dt);
      const crows = w.combat.foes.filter((x) => x.kind === 'karasu' && !x.dead).length;
      if (!m.callCd && crows < CROWS) { startTell(f, w, 'summon'); break; }
      if (r < d.reach + 10 && f.t > 0.5) startTell(f, w);
      else if (f.t > 2.2) startTell(f, w, 'throwTell');
      break;
    }
    case 'throwTell':
      glint(f, d.tell);
      if (f.t >= d.tell) {
        const a = Math.atan2(p.y - 10 - f.cy, p.x - f.x);
        for (const s of [-0.12, 0.12]) w.combat.shoot(f, 'feather', Math.cos(a + s) * 140, Math.sin(a + s) * 140, f.dmg);
        w.game.sfx('swing');
        f.setState('recover');
      }
      break;
    case 'summon':
      glint(f, d.tell);
      if (f.t >= d.tell) {
        for (const a of [-0.8, 0.8]) {
          const tx = Math.floor((f.x + Math.cos(a) * 18) / TILE), ty = Math.floor((f.y - 3 - 12) / TILE);
          if (!w.map.solid(tx, ty)) w.combat.spawn('karasu', tx, ty).setState('approach');
        }
        w.game.sfx('tell');
        m.callCd = 7;
        f.setState('recover');
      }
      break;
    case 'tell':
      glint(f, d.tell);
      if (f.t >= d.tell) { f.setState('attack'); m.struck = false; }
      break;
    case 'attack':
      if (!m.struck) { m.struck = true; w.game.sfx('swing'); if (dist(f, p) < d.reach + 6) blow(f, w); }
      if (f.t >= 0.3) f.setState('recover');
      break;
    case 'recover': if (f.t >= 0.8) f.setState('approach'); break;
    default: f.setState('approach');
  }
}

// ---------------------------------------------------------------- oni

function brute(f, w, dt) {
  const p = w.game.player, d = f.def, m = f.mem;
  switch (f.state) {
    case 'idle': f.guard = true; awake(f, w); break;
    case 'approach':
      if (leashed(f, w)) break;
      f.guard = true;
      f.face(p.x, p.y);
      if (dist(f, p) > d.reach - 4) f.walkTo(w.map, p.x, p.y, d.speed, dt);
      if (dist(f, p) <= d.reach + 8 && f.t > 0.6) startTell(f, w);
      break;
    case 'tell':
      glint(f, d.tell);
      if (f.t >= d.tell) { f.setState('attack'); m.struck = false; }
      break;
    case 'attack':
      if (!m.struck) {
        m.struck = true;
        const [dx, dy] = DIR[f.dir];
        const ix = f.x + dx * 18, iy = f.y + dy * 14;
        w.game.sfx('fall');
        w.game.shake(0.2);
        w.fx.burst('fx_dirt', ix, iy, 10, { speed: 60, up: 40 });
        // The club itself can be turned by a parry; the ring it sends out has to be stepped out of.
        const hit = dist(f, p) < d.reach + 4 && blow(f, w);
        if (!hit || hit === 'avoided') w.combat.area(f, ix, iy, 36, Math.round(f.dmg * 0.6));
        w.combat.ring(ix, iy, 36);
      }
      if (f.t >= 0.3) { f.guard = false; f.setState('recover'); }
      break;
    case 'recover': f.guard = false; if (f.t >= 1.3) f.setState('approach'); break;
    default: f.setState('approach');
  }
}

// ---------------------------------------------------------------- shinobi

function stealth(f, w, dt) {
  const p = w.game.player, d = f.def, m = f.mem;
  switch (f.state) {
    case 'idle': f.alpha = 1; awake(f, w); break;
    case 'approach':
      if (leashed(f, w)) break;
      w.combat.smoke(f.x, f.y);
      w.game.sfx('smoke');
      f.setState('stalk');
      break;
    case 'stalk': {
      // Unseen, it circles to a new place; only the dust at its feet gives it away.
      f.hidden = true;
      m.a ??= w.combat.rng.next() * 6.28;
      const at = around(w, m.a, 56);
      f.walkTo(w.map, at.x, at.y, d.speed, dt);
      if (f.t >= 1.6) {
        m.a = undefined;
        f.hidden = false;
        w.combat.smoke(f.x, f.y);
        f.face(p.x, p.y);
        startTell(f, w, dist(f, p) < d.reach + 12 ? 'tell' : 'throwTell');
      }
      break;
    }
    case 'throwTell':
      glint(f, d.tell);
      if (f.t >= d.tell) {
        const a = Math.atan2(p.y - 10 - f.cy, p.x - f.x);
        for (const s of [-0.25, 0, 0.25]) w.combat.shoot(f, 'shuriken', Math.cos(a + s) * 150, Math.sin(a + s) * 150, f.dmg);
        w.game.sfx('swing');
        f.setState('recover');
      }
      break;
    case 'tell':
      glint(f, d.tell);
      if (f.t >= d.tell) { f.setState('attack'); m.struck = false; }
      break;
    case 'attack':
      if (f.t < 0.08) f.move(w.map, DIR[f.dir][0] * 120, DIR[f.dir][1] * 120, dt);
      if (!m.struck) { m.struck = true; w.game.sfx('swing'); if (dist(f, p) < d.reach + 6) blow(f, w); }
      if (f.t >= 0.25) f.setState('recover');
      break;
    case 'recover': if (f.t >= 0.9) f.setState('approach'); break;
    default: f.hidden = false; f.setState('approach');
  }
}

Object.assign(BRAINS, { trickster, swarm, summoner, brute, stealth });
