// Combat on one map: the player's fighter, the foes, projectiles, damage numbers and hit-stop.
// World.update hands it each step; while hit-stop runs, the fight (and the player) hold still.
import { TILE } from '../config.js';
import { Rng } from '../core/rng.js';
import { Foe } from './foes.js';
import { Fighter } from './fighter.js';
import { DIRS } from './player.js';
import { hitDamage, weaponFor } from '../systems/combat.js';
import { DIFFICULTY } from '../data/enemies.js';
import { URN_LOOT } from '../data/caves.js';
import './boss.js';

const KNOCK = 80;

export class Combat {
  constructor(w) {
    this.w = w;
    this.fighter = new Fighter(w);
    this.foes = [];
    this.shots = [];
    this.floaters = [];
    this.hitstop = 0;
    this.rng = new Rng((w.game.seed ^ 0x3c6ef372 ^ (w.map.def.floor || 0) * 7919) >>> 0);
  }

  get game() { return this.w.game; }

  spawn(kind, tx, ty) {
    const f = new Foe(kind, tx * TILE + 8, ty * TILE + 14, this.game.difficulty, this.w.map.def.floor || 1);
    this.foes.push(f);
    return f;
  }

  /** A foe is close and awake: the HUD shows the Ki ring. */
  get engaged() {
    const p = this.game.player;
    return this.foes.some((f) => !f.dead && f.state !== 'idle' && f.state !== 'lurk' && Math.hypot(f.x - p.x, f.y - p.y) < 160);
  }

  /** Returns true while hit-stop freezes the action. */
  update(dt, input) {
    for (const fl of this.floaters) { fl.t += dt; fl.y -= 18 * dt; }
    this.floaters = this.floaters.filter((fl) => fl.t < 0.8);
    if (this.hitstop > 0) { this.hitstop -= dt; return true; }
    const busy = this.fighter.update(dt, input);
    for (const f of this.foes) if (!f.dead) f.update(this.w, dt);
    this.separate();
    this.updateShots(dt);
    this.foes = this.foes.filter((f) => !f.dead);
    return busy;
  }

  /** Foes don't stack on one another. */
  separate() {
    const fs = this.foes;
    for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {
      const a = fs[i], b = fs[j];
      if (a.hidden || b.hidden) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d > 0 && d < 12) {
        const push = (12 - d) / 2;
        a.move(this.w.map, (-dx / d) * push * 60, (-dy / d) * push * 60, 1 / 60);
        b.move(this.w.map, (dx / d) * push * 60, (dy / d) * push * 60, 1 / 60);
      }
    }
  }

  // ---------------------------------------------------------------- the player's blows

  /** During a swing's active frames: cut every foe in the arc once, and break an urn in front. */
  playerStrike(act, weapon, { heavy }) {
    const p = this.game.player;
    const [fx, fy] = DIRS[p.dir];
    const cx = p.x, cy = p.y - 10;
    const reach = weapon.reach + (heavy ? 6 : 0), arc = weapon.arc + (heavy ? 0.5 : 0);
    for (const f of this.foes) {
      if (f.dead || f.hidden || act.hit.has(f)) continue;
      const dx = f.x - cx, dy = f.cy - cy, d = Math.hypot(dx, dy);
      if (d > reach + f.radius) continue;
      if (d > 8 && Math.acos(Math.max(-1, Math.min(1, (dx * fx + dy * fy) / d))) > arc) continue;
      act.hit.add(f);
      this.damage(f, weapon, { combo: act.combo || 0, heavy, counter: this.fighter.counter > 0 }, cx, cy);
    }
    if (!act.urn) {
      const o = this.w.map.objectAt(p.tx + fx, p.ty + fy);
      if (o && o.type === 'urn') { act.urn = true; this.breakUrn(o); }
    }
  }

  /** A sickle swing that lands also cuts whatever stands in front. */
  toolStrike(tool) {
    if (tool !== 'sickle') return;
    this.playerStrike({ hit: new Set(), combo: 0, urn: true }, weaponFor('sickle'), { heavy: false });
  }

  damage(f, weapon, hit, fromX, fromY) {
    const g = this.game;
    const [dx, dy] = DIRS[f.dir];
    const facingAway = (g.player.x - f.x) * dx + (g.player.y - f.y) * dy < 0;
    const r = hitDamage(weapon, hit, { weak: f.def.weak, guard: f.guard, facingAway }, { skills: g.skills, virtues: g.virtues, rng: this.rng });
    f.hp -= r.dmg;
    f.flash = 0.12;
    if (r.blocked) {
      g.sfx('clang');
      f.knock(fromX, fromY, KNOCK * 0.4);
      this.w.fx.burst('fx_sparkle', f.x, f.cy, 4, { speed: 40, up: 30 });
      this.floater(f.x, f.cy - 12, `${r.dmg}`, 'ink4');
      this.hitstop = 0.05;
      g.aside('tk_guard', { once: true });
      return;
    }
    g.sfx(r.crit ? 'crit' : 'hit');
    f.knock(fromX, fromY, KNOCK * (hit.heavy ? 2.2 : hit.combo === 2 ? 1.6 : 1));
    // Heavy blows and counters shake a guard loose and leave the foe reeling.
    if ((hit.heavy || hit.counter) && f.state !== 'stagger' && f.kind !== 'jubei') f.stagger(0.5);
    this.w.fx.burst('fx_sparkle', f.x, f.cy, r.crit ? 8 : 4, { speed: 50, up: 40 });
    this.floater(f.x, f.cy - 12, `${r.dmg}`, r.crit ? 'gold2' : 'ink6');
    this.hitstop = r.crit ? 0.09 : 0.07;
    if (r.crit || hit.heavy) g.shake(0.1);
    if (f.hp <= 0) this.kill(f);
  }

  kill(f) {
    const g = this.game, w = this.w;
    f.dead = true;
    w.fx.burst('fx_sparkle', f.x, f.cy, 14, { speed: 40, up: 90, life: 0.9 });
    w.fx.burst('fx_foxfire0', f.x, f.cy, 3, { speed: 20, up: 60, life: 0.6 });
    g.sfx('dissolve');
    const d = DIFFICULTY[g.difficulty] || DIFFICULTY.standard;
    if (f.kind === 'jubei') { g.bossDown(f); return; }
    for (const [id, min, max, chance] of f.def.drops) {
      if (this.rng.next() >= chance * d.drops) continue;
      const n = this.rng.int(min, max);
      if (n > 0) w.drops.spawn(this.rng, id, n, 0, f.x, f.y - 4);
    }
    g.xp('sword', f.def.xp);
    g.stats.kills = g.stats.kills || {};
    g.stats.kills[f.kind] = (g.stats.kills[f.kind] || 0) + 1;
  }

  breakUrn(o) {
    const g = this.game, w = this.w;
    const zone = w.map.def.zone || 1;
    const table = URN_LOOT[zone];
    let r = this.rng.next() * table.reduce((s, x) => s + x[3], 0);
    const pick = table.find((x) => (r -= x[3]) < 0) || table[0];
    const cx = o.x * TILE + 8, cy = o.y * TILE + 10;
    w.map.removeObject(o);
    w.fx.burst('fx_chip', cx, cy, 10, { speed: 45, up: 70 });
    g.sfx('break');
    const n = this.rng.int(pick[1], pick[2]);
    if (pick[0] === 'mon' && n > 0) { g.money += n; g.toast('toast_found_mon', { n }, 'icon_coin'); }
    else if (pick[0] !== 'nothing' && n > 0) w.drops.spawn(this.rng, pick[0], n, 0, cx, cy);
  }

  // ---------------------------------------------------------------- blows at the player

  enemyBlow(f, dmg) {
    return this.fighter.receive(dmg, f.x, f.y, { parryable: true });
  }

  foxfire(f, p) {
    const dx = p.x - f.x, dy = p.y - 10 - f.cy, d = Math.hypot(dx, dy) || 1;
    this.shots.push({ kind: 'foxfire', x: f.x, y: f.cy, vx: (dx / d) * 95, vy: (dy / d) * 95, t: 0, life: 2.4, friendly: false, dmg: f.dmg, owner: f });
    this.game.sfx('fire');
  }

  updateShots(dt) {
    const map = this.w.map, p = this.game.player;
    for (const s of this.shots) {
      s.t += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const tx = Math.floor(s.x / TILE), ty = Math.floor((s.y + 6) / TILE);
      const wall = map.solid(tx, ty) && !map.isWater(tx, ty);
      if (s.t >= s.life || wall) { s.done = true; this.w.fx.burst('fx_pebble', s.x, s.y + 6, 3, { speed: 20, up: 20 }); continue; }
      if (s.friendly) {
        const f = this.foes.find((x) => !x.dead && !x.hidden && Math.hypot(x.x - s.x, x.cy - s.y) < x.radius + 4);
        if (!f) continue;
        s.done = true;
        if (s.kind === 'arrow') this.damage(f, s.dmg, { combo: 0, heavy: false, counter: false }, s.x - s.vx * 0.1, s.y - s.vy * 0.1);
        else this.damage(f, { dmg: s.dmg, crit: 0 }, { combo: 0, heavy: false, counter: false }, s.x, s.y);
      } else if (Math.hypot(p.x - s.x, p.y - 10 - s.y) < 9) {
        const r = this.fighter.receive(s.dmg, s.x, s.y, { parryable: true });
        if (r === 'parried') {
          // Turned back at the one who threw it, faster.
          s.friendly = true;
          s.vx *= -1.4; s.vy *= -1.4;
          s.t = 0;
          s.dmg = 24;
        } else if (r === 'hit') s.done = true;
      }
    }
    this.shots = this.shots.filter((s) => !s.done);
  }

  /** A smoke bomb's cloud. */
  smoke(x, y) {
    for (let i = 0; i < 3; i++) this.w.fx.burst(`fx_smoke${i}`, x, y - 8, 4, { speed: 30, up: 30, life: 0.9 });
  }

  floater(x, y, text, color) {
    this.floaters.push({ x, y, text, color, t: 0 });
  }

  defeated() {
    this.game.defeat();
  }
}

