// The Shade of Lord Aizawa, on floor 100: he fights as you were taught to, because he taught you.
//   1  (100-60%) three-cut combos, each cut told by the raised blade and its glint; a lunge from
//                range; and his stance (blade level, a pale light along it): while he holds it he
//                turns light blows aside, as you would, and a heavy strike breaks it
//   2  (60-30%)  calls two of his dead retainers once, then adds the kiai: a long wind-up, a cut
//                that sends out a ring (step out of it; it cannot be parried)
//   3  (<30%)    sheathes and waits for the stand-off (ui/iai.js); win it and it is over, lose it
//                and he cuts you, fights on and offers it again
import { BRAINS, blow, startTell, dist, GLINT } from './brains.js';
import { IaiDuel } from '../ui/iai.js';
import { TILE } from '../config.js';

const DIR = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
const DUEL_AGAIN = 9;

function phaseOf(f) {
  const r = f.hp / f.maxHp;
  return r > f.def.phases[1] ? 1 : r > f.def.phases[2] ? 2 : 3;
}

function glint(f, dur) {
  if (!f.mem.glinted && f.t >= dur - GLINT) f.mem.glinted = true;
}

function enterPhase(f, w, phase) {
  const m = f.mem;
  m.phase = phase;
  w.game.aside(`tk_aizawa_${phase}`, { once: true });
  if (phase === 2) {
    for (const [dx, dy] of [[-4, 1], [4, 1]]) {
      const tx = Math.floor(f.home.x / TILE) + dx, ty = Math.floor(f.home.y / TILE) + dy;
      if (!w.map.solid(tx, ty)) w.combat.spawn('retainer', tx, ty).setState('approach');
    }
    w.game.sfx('bell');
  }
  if (phase === 3) m.duelCd = 0;
  f.guard = false;
  f.setState('recover');
}

function duelOver(f, w, won) {
  if (won) { w.combat.kill(f); return; }
  w.combat.fighter.receive(26, f.x, f.y, { parryable: false });
  f.hp = Math.min(f.maxHp, f.hp + Math.round(f.maxHp * 0.06));
  f.mem.duelCd = DUEL_AGAIN;
  f.setState('recover');
}

function shade(f, w, dt) {
  const p = w.game.player, d = f.def, m = f.mem;
  const phase = phaseOf(f);
  if (phase > (m.phase || 1)) enterPhase(f, w, phase);
  m.dashCd = Math.max(0, (m.dashCd ?? 2) - dt);
  m.kiaiCd = Math.max(0, (m.kiaiCd ?? 3) - dt);
  m.duelCd = Math.max(0, (m.duelCd || 0) - dt);
  switch (f.state) {
    case 'idle':
      if (dist(f, p) < 140) { w.game.aside('tk_aizawa', { once: true }); f.setState('approach'); }
      break;
    case 'approach': {
      f.guard = false;
      f.face(p.x, p.y);
      const r = dist(f, p);
      if (m.phase === 3 && !m.duelCd) { f.setState('sheathe'); break; }
      if (m.phase >= 2 && !m.kiaiCd && r < 60) { startTell(f, w, 'kiaiTell'); break; }
      if (r > 64 && !m.dashCd) { startTell(f, w, 'dashTell'); break; }
      if (r > d.reach - 2) f.walkTo(w.map, p.x, p.y, d.speed, dt);
      if (r <= d.reach + 6 && f.t > 0.3) {
        // Sometimes he waits for you in his stance instead of cutting first.
        if (w.combat.rng.next() < 0.35) { f.setState('stance'); break; }
        m.cuts = 3; m.windup = d.tell; startTell(f, w);
      }
      break;
    }
    case 'stance':
      f.guard = true;
      f.face(p.x, p.y);
      if (f.t >= 1.3) { f.guard = false; m.cuts = 2; m.windup = d.tell; startTell(f, w); }
      break;
    case 'tell':
      glint(f, m.windup);
      if (f.t >= m.windup) { f.setState('attack'); m.struck = false; }
      break;
    case 'attack':
      if (f.t < 0.08) f.move(w.map, DIR[f.dir][0] * 110, DIR[f.dir][1] * 110, dt);
      if (!m.struck) { m.struck = true; w.game.sfx('swing'); if (dist(f, p) < d.reach + 6) blow(f, w); }
      if (f.t >= 0.22) {
        if (--m.cuts > 0) { f.face(p.x, p.y); m.windup = Math.max(0.32, m.windup - 0.06); startTell(f, w); }
        else f.setState('recover');
      }
      break;
    case 'dashTell':
      glint(f, 0.5);
      if (f.t >= 0.5) {
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
    case 'kiaiTell':
      glint(f, 0.95);
      if (f.t >= 0.95) {
        const [dx, dy] = DIR[f.dir];
        const ix = f.x + dx * 16, iy = f.y + dy * 12;
        w.game.sfx('crit');
        w.game.shake(0.25);
        const hit = dist(f, p) < d.reach + 4 && blow(f, w, Math.round(f.dmg * 1.4));
        if (!hit || hit === 'avoided') w.combat.area(f, ix, iy, 40, Math.round(f.dmg * 0.8));
        w.combat.ring(ix, iy, 40);
        m.kiaiCd = 6;
        f.setState('recover');
      }
      break;
    case 'recover': f.guard = false; if (f.t >= (m.phase === 1 ? 0.7 : 0.55)) f.setState('approach'); break;
    case 'sheathe':
      f.guard = false;
      if (f.t >= 1 && !w.game.modals.length) {
        w.game.modals.push(new IaiDuel(w.game, { rival: 'aizawa', window: 0.3, onEnd: (won) => duelOver(f, w, won) }));
        f.setState('duel');
      }
      break;
    case 'duel': break;
    default: f.setState('approach');
  }
}

BRAINS.shade = shade;
