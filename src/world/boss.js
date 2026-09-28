// Kurogane no Jūbei, the bandit chief on floor 20. Three phases by health:
//   1  (100-60%) cut combos (each cut told by a raised blade and a glint) and a dash-cut from range;
//   2  (60-30%)  calls two of his men once, then vanishes in smoke and reappears behind you;
//   3  (<30%)    sheathes his blade and challenges you to an iai stand-off (ui/iai.js). Win it and
//                the fight is over; lose it and he cuts you, fights on, and offers the duel again.
import { BRAINS, blow, startTell, dist, GLINT } from './brains.js';
import { IaiDuel } from '../ui/iai.js';
import { TILE } from '../config.js';

const DUEL_AGAIN = 9;

function phaseOf(f) {
  const r = f.hp / f.maxHp;
  return r > f.def.phases[1] ? 1 : r > f.def.phases[2] ? 2 : 3;
}

function inFront(f, p, reach) {
  const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy);
  if (d > reach + 10) return false;
  const [fx, fy] = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[f.dir];
  return d < 10 || (dx * fx + dy * fy) / d > 0.1;
}

function boss(f, w, dt) {
  const p = w.game.player, d = f.def, m = f.mem;
  const phase = phaseOf(f);
  if (phase > (m.phase || 1)) enterPhase(f, w, phase);
  m.dashCd = Math.max(0, (m.dashCd ?? 2) - dt);
  m.duelCd = Math.max(0, (m.duelCd || 0) - dt);
  switch (f.state) {
    case 'idle':
      if (dist(f, p) < 120) { w.game.aside('tk_jubei', { once: true }); f.setState('approach'); }
      break;
    case 'approach': {
      f.face(p.x, p.y);
      const r = dist(f, p);
      if (m.phase === 3 && !m.duelCd) { f.setState('sheathe'); break; }
      if (r > 64 && !m.dashCd) { startTell(f, w, 'dashTell'); m.windup = 0.5; break; }
      if (r > d.reach - 2) f.walkTo(w.map, p.x, p.y, d.speed, dt);
      if (r <= d.reach + 6 && f.t > 0.25) { m.cuts = m.phase === 1 ? 2 : 3; m.windup = d.tell; startTell(f, w); }
      break;
    }
    case 'tell':
      if (!m.glinted && f.t >= m.windup - GLINT) m.glinted = true;
      if (f.t >= m.windup) { f.setState('attack'); m.struck = false; }
      break;
    case 'attack': {
      const [lx, ly] = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[f.dir];
      if (f.t < 0.08) f.move(w.map, lx * 110, ly * 110, dt);
      if (!m.struck) { m.struck = true; w.game.sfx('swing'); if (inFront(f, p, d.reach)) blow(f, w); }
      if (f.t >= 0.22) {
        m.cuts--;
        if (m.cuts > 0) { f.face(p.x, p.y); m.windup = Math.max(0.3, m.windup - 0.08); startTell(f, w); }
        else f.setState('recover');
      }
      break;
    }
    case 'dashTell':
      if (!m.glinted && f.t >= m.windup - GLINT) m.glinted = true;
      if (f.t >= m.windup) {
        const dx = p.x - f.x, dy = p.y - f.y, len = Math.hypot(dx, dy) || 1;
        m.v = [(dx / len) * 230, (dy / len) * 230];
        m.struck = false;
        f.face(p.x, p.y);
        f.setState('dash');
        w.game.sfx('swing');
      }
      break;
    case 'dash':
      f.move(w.map, m.v[0], m.v[1], dt);
      if (!m.struck && dist(f, p) < d.reach) { m.struck = true; blow(f, w); }
      if (f.t >= 0.35) { m.dashCd = 4; f.setState('recover'); }
      break;
    case 'recover':
      if (f.t >= (m.phase === 1 ? 0.8 : 0.6)) f.setState(m.phase === 2 && !m.smoked ? 'smoke' : 'approach');
      break;
    case 'smoke':
      // A smoke bomb: gone, then behind you with his blade already rising.
      if (f.t < dt * 1.5) { w.game.sfx('smoke'); w.combat.smoke(f.x, f.y); f.hidden = true; m.smoked = true; }
      if (f.t >= 1.1) {
        const [bx, by] = { down: [0, -1], up: [0, 1], left: [1, 0], right: [-1, 0] }[p.dir];
        f.x = p.x + bx * 22; f.y = p.y + by * 18;
        if (w.map.solid(Math.floor(f.x / TILE), Math.floor((f.y - 3) / TILE))) { f.x = p.x; f.y = p.y - 20; }
        f.hidden = false;
        w.combat.smoke(f.x, f.y);
        f.face(p.x, p.y);
        m.cuts = 1; m.windup = 0.55;
        startTell(f, w);
        m.smokeAgain = 6;
      }
      break;
    case 'sheathe':
      f.guard = false;
      if (f.t >= 0.9 && !w.game.modals.length) {
        w.game.modals.push(new IaiDuel(w.game, { rival: 'jubei', onEnd: (won) => duelOver(f, w, won) }));
        f.setState('duel');
      }
      break;
    case 'duel': break;
    default: f.setState('approach');
  }
}

function enterPhase(f, w, phase) {
  const m = f.mem;
  m.phase = phase;
  if (phase === 2) {
    w.game.aside('tk_jubei_men', { once: true });
    w.game.sfx('tell');
    for (const [dx, dy] of [[-4, -2], [4, -2]]) {
      const tx = Math.floor(f.home.x / TILE) + dx, ty = Math.floor(f.home.y / TILE) + dy;
      if (!w.map.solid(tx, ty)) w.combat.spawn('bandit', tx, ty).setState('approach');
    }
    m.smoked = false;
  }
  if (phase === 3) { w.game.aside('tk_jubei_iai', { once: true }); m.duelCd = 0; }
  f.setState('recover');
}

function duelOver(f, w, won) {
  if (won) { w.combat.kill(f); return; }
  // He cuts through you and fights on; the stand-off comes again later.
  w.combat.fighter.receive(22, f.x, f.y, { parryable: false });
  f.hp = Math.min(f.maxHp, f.hp + Math.round(f.maxHp * 0.08));
  f.mem.duelCd = DUEL_AGAIN;
  f.setState('recover');
}

// Phase 2 reaches for the smoke again a few seconds after each use.
function bossWithSmoke(f, w, dt) {
  const m = f.mem;
  if (m.phase === 2 && m.smoked && m.smokeAgain !== undefined) {
    m.smokeAgain -= dt;
    if (m.smokeAgain <= 0) { m.smoked = false; m.smokeAgain = undefined; }
  }
  boss(f, w, dt);
}

BRAINS.jubei = bossWithSmoke;
