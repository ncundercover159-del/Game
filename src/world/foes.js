// An enemy in the world: position, health, knockback, the white hit flash, and the state its brain
// drives (world/brains.js). Foes never hurt by touch: every blow comes from an attack with a tell.
import { TILE } from '../config.js';
import { moveBox } from './collision.js';
import { ENEMIES, BOSSES } from '../data/enemies.js';
import { modsOf, MODS } from '../data/caves.js';
import { enemyHp, depthMult } from '../systems/combat.js';
import { BRAINS } from './brains.js';

const HW = 5, HH = 5;

export class Foe {
  constructor(kind, x, y, difficulty, floor = 1) {
    // The Yomi Slope's modifiers: tougher, fiercer or swifter foes (never quicker tells).
    const mods = BOSSES[kind] ? [] : modsOf(floor);
    const mod = (key) => mods.reduce((a, id) => a * (MODS[id][key] || 1), 1);
    const base = BOSSES[kind] || ENEMIES[kind];
    const def = mod('speed') === 1 ? base : { ...base, speed: base.speed * mod('speed') };
    this.kind = kind;
    this.def = def;
    this.brain = def.brain;
    this.x = x;
    this.y = y;
    this.home = { x, y };
    // Deeper floors breed tougher foes: a little more health and bite per floor (bosses are fixed).
    const depth = def.boss ? depthMult(1) : depthMult(floor);
    this.maxHp = enemyHp(def.hp * depth.hp * mod('hp'), difficulty);
    this.dmg = Math.round(def.dmg * depth.dmg * mod('dmg'));
    this.hp = this.maxHp;
    this.state = 'idle';
    this.t = 0;
    this.dir = 'down';
    this.flash = 0;
    this.kb = null;
    this.stun = 0;
    this.z = 0;             // height above the ground (hops)
    this.alpha = 1;
    this.hidden = false;    // lurking or faded: can't be hit or seen
    this.dead = false;
    this.anim = 0;
    this.mem = {};          // brain scratch
    this.illusion = false;  // a copy with no shadow: pops at a touch, harms no one
    this.armour = def.armour || 0;
  }

  /** Spirits float over water and kappa swim in it. */
  get wet() { return !!(this.def.float || this.def.water); }

  get radius() { return this.def.radius || (this.def.big ? 10 : 7); }
  get cy() { return this.y - (this.def.height ?? (this.def.person || this.kind === 'yurei' ? 14 : this.def.big ? 18 : 8)) - this.z; }

  /** Face toward a point (4 directions). */
  face(x, y) {
    const dx = x - this.x, dy = y - this.y;
    this.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }

  /** Walk toward (x, y) at `speed`, sliding along walls; returns the distance moved. */
  walkTo(map, x, y, speed, dt) {
    const dx = x - this.x, dy = y - this.y, d = Math.hypot(dx, dy);
    if (d < 1) return 0;
    const ox = this.x, oy = this.y;
    const s = Math.min(d, speed * dt);
    moveBox(map, this, (dx / d) * s, (dy / d) * s, HW, HH, this.wet);
    return Math.hypot(this.x - ox, this.y - oy);
  }

  move(map, vx, vy, dt) {
    const ox = this.x, oy = this.y;
    moveBox(map, this, vx * dt, vy * dt, HW, HH, this.wet);
    return Math.hypot(this.x - ox, this.y - oy);
  }

  setState(s) {
    this.state = s;
    this.t = 0;
  }

  update(w, dt) {
    this.t += dt;
    this.anim += dt;
    this.flash = Math.max(0, this.flash - dt);
    if (this.kb) {
      this.kb.t -= dt;
      this.move(w.map, this.kb.vx, this.kb.vy, dt);
      if (this.kb.t <= 0) this.kb = null;
    }
    if (this.stun > 0) {
      this.stun -= dt;
      if (this.stun <= 0 && this.state === 'stagger') this.setState('recover');
      return;
    }
    BRAINS[this.brain](this, w, dt);
  }

  /** Knocked back from (fx, fy) with `force` px/s, lighter foes further. */
  knock(fx, fy, force) {
    const d = Math.hypot(this.x - fx, this.y - fy) || 1;
    const f = force / (this.def.mass || 1);
    this.kb = { vx: ((this.x - fx) / d) * f, vy: ((this.y - fy) / d) * f, t: 0.12 };
  }

  /** Parried: reeling, open to a counter. */
  stagger(time) {
    this.setState('stagger');
    this.stun = time;
    this.mem.windup = 0;
  }

  get tile() { return { x: Math.floor(this.x / TILE), y: Math.floor((this.y - 3) / TILE) }; }
}
