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
import './brains2.js';
import './bosses2.js';
import './shade.js';

const KNOCK = 80;
// Seconds an orbiting orb flares before it flies; the fire vents' cycle and bite.
const ORB_FLARE = 0.45;
const VENT = { glow: 0.9, fire: 0.6, rest: 2.4, dmg: 14 };

export class Combat {
  constructor(w) {
    this.w = w;
    this.fighter = new Fighter(w);
    this.foes = [];
    this.shots = [];
    this.floaters = [];
    this.rings = [];          // shockwave rings, for drawing
    this.hitstop = 0;
    this.vents = null;        // the foundry's fire vents, found on the first step
    this.ventRate = 1;        // Kurenai's later phases stoke them
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
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < 0.35);
    if (this.hitstop > 0) { this.hitstop -= dt; return true; }
    const busy = this.fighter.update(dt, input);
    for (const f of this.foes) if (!f.dead) f.update(this.w, dt);
    this.separate();
    this.updateShots(dt);
    this.updateVents(dt);
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
    if (f.illusion) { this.pop(f); return; }
    // Armour plates come off to heavy strikes and counters (and then the blow lands).
    if (f.armour > 0 && (hit.heavy || hit.counter)) {
      f.armour--;
      g.sfx('clang');
      this.w.fx.burst('fx_chip', f.x, f.cy, 10, { speed: 60, up: 50 });
      g.aside(f.armour ? 'tk_armour' : 'tk_armour_off', { once: f.armour ? 'armour' : 'armour_off' });
    }
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
      // Chip damage through a guard still counts.
      if (f.hp <= 0) this.kill(f);
      return;
    }
    g.sfx(r.crit ? 'crit' : 'hit');
    f.knock(fromX, fromY, KNOCK * (hit.heavy ? 2.2 : hit.combo === 2 ? 1.6 : 1));
    // Heavy blows and counters shake a guard loose and leave the foe reeling.
    if ((hit.heavy || hit.counter) && f.state !== 'stagger' && !f.def.boss) f.stagger(0.5);
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
    if (f.def.boss) { g.bossDown(f); return; }
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

  /** A projectile from a foe: foxfire, water, fire, shuriken. Parried, it flies back. */
  shoot(f, kind, vx, vy, dmg) {
    this.shots.push({ kind, x: f.x, y: f.cy, vx, vy, t: 0, life: 2.4, friendly: false, dmg, owner: f });
  }

  /** A shockwave: anyone inside `r` of (x, y) is hit unless they dodged it (no parrying a ring). */
  area(f, x, y, r, dmg) {
    const p = this.game.player;
    if (Math.hypot(p.x - x, p.y - 4 - y) < r) return this.fighter.receive(dmg, x, y, { parryable: false });
    return null;
  }

  ring(x, y, r) { this.rings.push({ x, y, r, t: 0 }); }

  /**
   * Kyūbi's ring: `n` foxfire orbs circle the owner, harmless while they circle; one by one each
   * flares (FLARE seconds) and flies at the player, `every` seconds apart.
   */
  orbs(f, n, r, every) {
    for (let i = 0; i < n; i++) {
      this.shots.push({
        kind: 'foxfire', orbit: true, owner: f, a: (i / n) * Math.PI * 2, r, x: f.x, y: f.cy,
        vx: 0, vy: 0, t: 0, launchAt: 1 + i * every, life: 1 + i * every + 2.5, friendly: false, dmg: Math.round(f.dmg * 0.6),
      });
    }
  }

  /** An illusion touched: it bursts into smoke. */
  pop(f) {
    f.dead = true;
    this.smoke(f.x, f.y);
    this.game.sfx('smoke');
  }

  updateShots(dt) {
    const map = this.w.map, p = this.game.player;
    for (const s of this.shots) {
      s.t += dt;
      if (s.orbit) {
        if (s.owner.dead) { s.done = true; continue; }
        s.a += dt * 2.2;
        s.x = s.owner.x + Math.cos(s.a) * s.r;
        s.y = s.owner.cy + Math.sin(s.a) * s.r * 0.8;
        s.flare = s.t >= s.launchAt - ORB_FLARE;
        if (s.t < s.launchAt) continue;
        const dx = p.x - s.x, dy = p.y - 10 - s.y, d = Math.hypot(dx, dy) || 1;
        s.orbit = false; s.flare = false;
        s.vx = (dx / d) * 120; s.vy = (dy / d) * 120;
        this.game.sfx('fire');
      }
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

  /** Fire vents in the foundry: rest, glow (the tell), then a column of fire over the vent. */
  updateVents(dt) {
    this.vents ??= this.w.map.objects.filter((o) => o.type === 'vent');
    const p = this.game.player;
    for (const o of this.vents) {
      o.t = (o.t ?? this.rng.next() * 3) - dt;
      if (o.t > 0) {
        if (o.phase === 'fire' && !o.hit && Math.hypot(p.x - (o.x * TILE + 8), p.y - (o.y * TILE + 12)) < 14) {
          o.hit = true;
          this.fighter.receive(VENT.dmg, o.x * TILE + 8, o.y * TILE + 12, { parryable: false });
        }
        if (o.phase === 'fire' && Math.floor(o.t * 20) % 2) this.w.fx.burst('fx_ember', o.x * TILE + 8, o.y * TILE + 10, 1, { speed: 15, up: 90, life: 0.5 });
        continue;
      }
      if (o.phase === 'glow') { o.phase = 'fire'; o.t = VENT.fire; o.hit = false; this.game.sfx('fire'); }
      else if (o.phase === 'fire') { o.phase = 'rest'; o.t = (VENT.rest + this.rng.next() * VENT.rest) / this.ventRate; }
      else { o.phase = 'glow'; o.t = VENT.glow; }
      // A column of fire stands up among the other things; a resting vent lies under your feet.
      o.flat = o.phase !== 'fire';
    }
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

