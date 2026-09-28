// Bosses of the deep zones, three phases each by health. Every blow, shot and shockwave has a tell.
//   The Kappa Elder (floor 40, a sumo ring in a moat)
//     1  shiko stomp then a charging shove; slaps up close
//     2  dives into the moat (ripples show where), bursts out in a lunge, spits water from the moat
//     3  the deep bow: parry it and the water spills from his dish (he reels a long while);
//        miss it and it becomes a headbutt
//   Kyūbi, the Nine-Tailed (floor 60)
//     1  foxfire volleys in a fan; a dashing bite
//     2  fans her tails and becomes four: the copies cast no shadow and do no harm
//     3  nine foxfire orbs circle her and fly at you one by one, each flaring first; then she tires
//   Oni Warlord Kurenai (floor 80, lava and vents)
//     1  armoured (three plates turn light blows; heavy strikes knock them off): club smashes with
//        a shockwave ring
//     2  fire breath: she draws in (glowing), then breathes a cone of fireballs; quicker smashes
//     3  the leap: she crouches, marks where she will land, and comes down in a wide ring
import { BRAINS, blow, startTell, dist, GLINT } from './brains.js';
import { TILE } from '../config.js';

const DIR = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

function phaseOf(f) {
  const r = f.hp / f.maxHp;
  return r > f.def.phases[1] ? 1 : r > f.def.phases[2] ? 2 : 3;
}

function glint(f, dur) {
  if (!f.mem.glinted && f.t >= dur - GLINT) f.mem.glinted = true;
}

/** Tell, then run `then` once it ends. */
function told(f, dur, then) {
  glint(f, dur);
  if (f.t >= dur) then();
}

/** On the first look at the player: Tsukikage names the boss once. */
function wake(f, w, key) {
  if (dist(f, w.game.player) < 140) { w.game.aside(key, { once: true }); f.setState('approach'); }
}

function dashAt(f, p, speed) {
  const dx = p.x - f.x, dy = p.y - f.y, len = Math.hypot(dx, dy) || 1;
  f.face(p.x, p.y);
  return [(dx / len) * speed, (dy / len) * speed];
}

// ---------------------------------------------------------------- the Kappa Elder

/** The water tile nearest the player (the moat), for surfacing beside them. */
function moatNear(w, p) {
  let best = null;
  const m = w.map, ptx = Math.floor(p.x / TILE), pty = Math.floor((p.y - 3) / TILE);
  for (let y = pty - 6; y <= pty + 6; y++) for (let x = ptx - 6; x <= ptx + 6; x++) {
    if (!m.isWater(x, y)) continue;
    const d = Math.hypot(x - ptx, y - pty);
    if (d >= 2 && (!best || d < best.d)) best = { x, y, d };
  }
  return best ? { x: best.x * TILE + 8, y: best.y * TILE + 14 } : null;
}

function kappaElder(f, w, dt) {
  const p = w.game.player, d = f.def, m = f.mem;
  const phase = phaseOf(f);
  if (phase > (m.phase || 1)) { m.phase = phase; w.game.aside(`tk_kappa_${phase}`, { once: true }); f.hidden = false; f.setState('recover'); }
  m.chargeCd = Math.max(0, (m.chargeCd ?? 2) - dt);
  m.diveCd = Math.max(0, (m.diveCd ?? 1) - dt);
  switch (f.state) {
    case 'idle': wake(f, w, 'tk_kappa'); break;
    case 'approach': {
      f.hidden = false;
      f.face(p.x, p.y);
      const r = dist(f, p);
      if (m.phase === 2 && !m.diveCd && moatNear(w, p)) { f.setState('dive'); break; }
      if (m.phase === 3 && f.t > 0.8 && w.combat.rng.next() < 0.02) { startTell(f, w, 'bowTell'); break; }
      if (r > 64 && !m.chargeCd) { startTell(f, w, 'shikoTell'); w.game.shake(0.15); break; }
      if (r > d.reach - 2) f.walkTo(w.map, p.x, p.y, d.speed, dt);
      if (r <= d.reach + 6 && f.t > 0.4) { m.slaps = m.phase === 1 ? 2 : 3; m.windup = d.tell; startTell(f, w); }
      break;
    }
    case 'tell':
      told(f, m.windup, () => { f.setState('attack'); m.struck = false; });
      break;
    case 'attack':
      if (!m.struck) { m.struck = true; w.game.sfx('hit'); if (dist(f, p) < d.reach + 6) blow(f, w); }
      if (f.t >= 0.22) {
        if (--m.slaps > 0) { f.face(p.x, p.y); m.windup = Math.max(0.35, m.windup - 0.1); startTell(f, w); }
        else f.setState('recover');
      }
      break;
    case 'shikoTell':
      told(f, 0.75, () => { m.v = dashAt(f, p, 210); m.struck = false; f.setState('charge'); w.game.sfx('fall'); });
      break;
    case 'charge':
      f.move(w.map, m.v[0], m.v[1], dt);
      if (!m.struck && dist(f, p) < d.reach + 4) { m.struck = true; blow(f, w); }
      if (f.t >= 0.45) { m.chargeCd = 3.5; f.setState('recover'); }
      break;
    case 'dive':
      // Into the moat; the ripple glides toward you.
      if (f.t < dt * 1.5) { w.fx.burst('fx_drop', f.x, f.y - 6, 14, { speed: 50, up: 80 }); w.game.sfx('water'); m.at = moatNear(w, p); }
      f.hidden = true;
      if (m.at) f.walkTo(w.map, m.at.x, m.at.y, 140, dt);
      if (f.t >= 1.3) { f.face(p.x, p.y); startTell(f, w, w.combat.rng.next() < 0.4 ? 'spitTell' : 'surfaceTell'); }
      break;
    case 'surfaceTell':
      told(f, 0.55, () => { f.hidden = false; w.fx.burst('fx_drop', f.x, f.y - 6, 12, { speed: 40, up: 70 }); m.v = dashAt(f, p, 200); m.struck = false; f.setState('lunge'); });
      break;
    case 'lunge':
      f.move(w.map, m.v[0], m.v[1], dt);
      if (!m.struck && dist(f, p) < d.reach + 4) { m.struck = true; blow(f, w); }
      if (f.t >= 0.35) { m.dives = (m.dives || 0) + 1; if (m.dives % 2 === 0) m.diveCd = 5; f.setState('recover'); }
      break;
    case 'spitTell':
      told(f, 0.6, () => {
        f.hidden = false;
        const a = Math.atan2(p.y - 10 - f.cy, p.x - f.x);
        for (const s of [-0.3, 0, 0.3]) w.combat.shoot(f, 'water', Math.cos(a + s) * 110, Math.sin(a + s) * 110, Math.round(f.dmg * 0.7));
        w.game.sfx('water');
        m.diveCd = 3;
        f.setState('recover');
      });
      break;
    case 'bowTell':
      // The deep bow: parry the head coming down and the water spills from his dish.
      told(f, 0.85, () => {
        const r = dist(f, p) < d.reach + 10 ? blow(f, w) : null;
        if (r === 'parried') {
          f.stagger(3);
          f.setState('spilled');
          f.stun = 3;
          w.fx.burst('fx_drop', f.x, f.cy - 10, 16, { speed: 50, up: 60 });
          w.game.aside('tk_kappa_spill', { once: true });
        } else f.setState('recover');
      });
      break;
    case 'spilled': f.setState('recover'); break;
    case 'recover':
      f.hidden = false;
      if (f.t >= 0.8) f.setState('approach');
      break;
    default: f.hidden = false; f.setState('approach');
  }
}

// ---------------------------------------------------------------- Kyūbi

function kyubi(f, w, dt) {
  const p = w.game.player, d = f.def, m = f.mem;
  const phase = f.illusion ? 1 : phaseOf(f);
  if (phase > (m.phase || 1)) { m.phase = phase; w.game.aside(`tk_kyubi_${phase}`, { once: true }); f.setState(phase === 2 ? 'fanTell' : 'ringTell'); f.mem.glinted = false; w.game.sfx('tell'); }
  m.dashCd = Math.max(0, (m.dashCd ?? 1.5) - dt);
  if (f.illusion && (m.life -= dt) <= 0) { w.combat.pop(f); return; }
  switch (f.state) {
    case 'idle': wake(f, w, 'tk_kyubi'); break;
    case 'approach': {
      const r = dist(f, p);
      f.face(p.x, p.y);
      m.a = (m.a ?? 0) + dt * 0.9;
      const tx = p.x + Math.cos(m.a) * 70, ty = p.y + Math.sin(m.a) * 50;
      if (!w.map.solid(Math.floor(tx / TILE), Math.floor((ty - 3) / TILE))) f.walkTo(w.map, tx, ty, d.speed * 0.7, dt);
      if (f.t < 1) break;
      if (!f.illusion && m.phase === 2 && !m.clones && f.t > 2) { startTell(f, w, 'fanTell'); break; }
      if (!f.illusion && m.phase === 3 && !m.orbs && f.t > 2) { startTell(f, w, 'ringTell'); break; }
      if (r < 90 && !m.dashCd) { startTell(f, w, 'dashTell'); break; }
      if (!f.illusion && f.t > 1.8) startTell(f, w, 'volleyTell');
      break;
    }
    case 'volleyTell':
      told(f, 0.6, () => {
        const a = Math.atan2(p.y - 10 - f.cy, p.x - f.x);
        for (const s of [-0.35, 0, 0.35]) w.combat.shoot(f, 'foxfire', Math.cos(a + s) * 100, Math.sin(a + s) * 100, Math.round(f.dmg * 0.7));
        w.game.sfx('fire');
        f.setState('recover');
      });
      break;
    case 'dashTell':
      told(f, d.tell, () => { m.v = dashAt(f, p, 230); m.struck = false; f.setState('dash'); w.game.sfx('swing'); });
      break;
    case 'dash':
      f.move(w.map, m.v[0], m.v[1], dt);
      if (!m.struck && dist(f, p) < d.reach + 4) { m.struck = true; if (!f.illusion) blow(f, w); }
      if (f.t >= 0.35) { m.dashCd = 2.5; f.setState('recover'); }
      break;
    case 'fanTell':
      // Her tails fan out; three copies step from them. Only she casts a shadow.
      told(f, 0.8, () => {
        m.clones = true;
        w.combat.smoke(f.x, f.y);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 + 0.5;
          const tx = Math.floor((f.x + Math.cos(a) * 40) / TILE), ty = Math.floor((f.y - 3 + Math.sin(a) * 30) / TILE);
          if (w.map.solid(tx, ty)) continue;
          const c = w.combat.spawn('kyubi', tx, ty);
          c.illusion = true;
          c.maxHp = c.hp = 1;
          c.mem.phase = 1;
          c.mem.life = 10;
          c.setState('approach');
        }
        m.clonesAgain = 12;
        f.setState('recover');
      });
      break;
    case 'ringTell':
      told(f, 0.9, () => {
        m.orbs = true;
        w.combat.orbs(f, 9, 32, 0.7);
        m.orbsAgain = 14;
        f.setState('channel');
      });
      break;
    case 'channel':
      // She holds still while the ring flies; then she is spent for a moment.
      if (!w.combat.shots.some((s) => s.orbit && s.owner === f)) { f.setState('tired'); w.game.aside('tk_kyubi_tired', { once: true }); }
      break;
    case 'tired': if (f.t >= 2.5) f.setState('approach'); break;
    case 'recover': if (f.t >= 0.6) f.setState('approach'); break;
    default: f.setState('approach');
  }
  if (!f.illusion && m.phase === 2 && m.clones && (m.clonesAgain -= dt) <= 0) m.clones = false;
  if (!f.illusion && m.phase === 3 && m.orbs && f.state !== 'channel' && (m.orbsAgain -= dt) <= 0) m.orbs = false;
}

// ---------------------------------------------------------------- Kurenai

function kurenai(f, w, dt) {
  const p = w.game.player, d = f.def, m = f.mem;
  let phase = phaseOf(f);
  if (f.armour === 0 && phase === 1) phase = 2;
  if (phase > (m.phase || 1)) { m.phase = phase; w.game.aside(`tk_kurenai_${phase}`, { once: true }); w.combat.ventRate = phase === 3 ? 2 : 1.4; f.setState('recover'); }
  f.guard = f.armour > 0;
  m.breathCd = Math.max(0, (m.breathCd ?? 3) - dt);
  m.leapCd = Math.max(0, (m.leapCd ?? 2) - dt);
  switch (f.state) {
    case 'idle': wake(f, w, 'tk_kurenai'); break;
    case 'approach': {
      const r = dist(f, p);
      f.face(p.x, p.y);
      if (m.phase === 3 && !m.leapCd && r > 40) { startTell(f, w, 'leapTell'); break; }
      if (m.phase >= 2 && !m.breathCd && r > 40 && r < 120) { startTell(f, w, 'breathTell'); break; }
      if (r > d.reach - 4) f.walkTo(w.map, p.x, p.y, d.speed * (m.phase === 1 ? 1 : 1.3), dt);
      if (r <= d.reach + 8 && f.t > 0.5) { m.smashes = 2; m.windup = m.phase === 1 ? d.tell : d.tell * 0.8; startTell(f, w); }
      break;
    }
    case 'tell':
      told(f, m.windup, () => { f.setState('attack'); m.struck = false; });
      break;
    case 'attack':
      if (!m.struck) {
        m.struck = true;
        const [dx, dy] = DIR[f.dir];
        const ix = f.x + dx * 22, iy = f.y + dy * 16;
        w.game.sfx('fall');
        w.game.shake(0.25);
        w.fx.burst('fx_dirt', ix, iy, 12, { speed: 70, up: 40 });
        const hit = dist(f, p) < d.reach + 4 && blow(f, w);
        if (!hit || hit === 'avoided') w.combat.area(f, ix, iy, 40, Math.round(f.dmg * 0.6));
        w.combat.ring(ix, iy, 40);
      }
      if (f.t >= 0.3) {
        if (--m.smashes > 0) { f.face(p.x, p.y); m.windup = Math.max(0.45, m.windup - 0.15); startTell(f, w); }
        else f.setState('recover');
      }
      break;
    case 'breathTell':
      told(f, 0.8, () => {
        const a = Math.atan2(p.y - 10 - f.cy, p.x - f.x);
        for (const s of [-0.5, -0.25, 0, 0.25, 0.5]) w.combat.shoot(f, 'fire', Math.cos(a + s) * 120, Math.sin(a + s) * 120, Math.round(f.dmg * 0.6));
        w.game.sfx('fire');
        m.breathCd = 6;
        f.setState('recover');
      });
      break;
    case 'leapTell':
      // She crouches; where she will land is marked on the ground for the whole leap.
      if (f.t < dt * 1.5) m.land = { x: p.x, y: p.y };
      told(f, 0.7, () => { m.from = { x: f.x, y: f.y }; f.setState('leap'); w.game.sfx('swing'); });
      break;
    case 'leap': {
      const k = Math.min(1, f.t / 0.6);
      f.x = m.from.x + (m.land.x - m.from.x) * k;
      f.y = m.from.y + (m.land.y - m.from.y) * k;
      f.z = Math.sin(k * Math.PI) * 40;
      if (k >= 1) {
        f.z = 0;
        if (w.map.solid(Math.floor(f.x / TILE), Math.floor((f.y - 3) / TILE))) { f.x = m.from.x; f.y = m.from.y; }
        w.game.sfx('fall');
        w.game.shake(0.35);
        w.fx.burst('fx_dirt', f.x, f.y, 16, { speed: 80, up: 50 });
        w.combat.area(f, f.x, f.y, 48, f.dmg);
        w.combat.ring(f.x, f.y, 48);
        m.land = null;
        m.leapCd = 7;
        f.setState('recover');
      }
      break;
    }
    case 'recover': if (f.t >= (m.phase === 1 ? 1.1 : 0.8)) f.setState('approach'); break;
    default: f.z = 0; f.setState('approach');
  }
}

Object.assign(BRAINS, { kappaElder, kyubi, kurenai });
