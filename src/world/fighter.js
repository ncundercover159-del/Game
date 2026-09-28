// The player in a fight: a three-hit light combo with small lunges, a held heavy kiai that costs Ki,
// a dodge step with invulnerability, a parry stance, the bow, and taking hits (knockback, a flash,
// a moment of invulnerability). Rules and numbers come from systems/combat.js.
import { moveBox } from './collision.js';
import { DIRS } from './player.js';
import { SWING, COMBO, HEAVY, DODGE, PARRY, HURT_IFRAMES, parryWindow, kiMax, regenKi, weaponFor, damageTaken } from '../systems/combat.js';
import { ARROW_SPEED } from '../data/weapons.js';
import { buffAmount } from '../systems/skills.js';

const HW = 5, HH = 6;
const LUNGE = 30;          // px/s during a swing's wind-up
const PARRY_STANCE = 0.32;

export class Fighter {
  constructor(w) {
    this.w = w;
    this.act = null;       // { kind: slash|charge|heavy|dodge|parry|shoot, t, ... }
    this.iframes = 0;
    this.counter = 0;      // seconds left of the counter window after a parry
    this.kb = null;        // knockback { vx, vy, t }
    this.flash = 0;
    this.ghosts = [];      // dodge afterimages [{ x, y, frame, t }]
  }

  get game() { return this.w.game; }
  get player() { return this.w.game.player; }
  get busy() { return !!this.act || !!this.kb; }

  /** The weapon in hand, or null (the sickle stays a tool; its swings cut enemies too). */
  weapon() {
    const id = this.heldId();
    return id ? weaponFor(id, this.game.inventory.slots[this.game.inventory.selected].q || 0) : null;
  }

  heldId() {
    const s = this.game.inventory.slots[this.game.inventory.selected];
    return s && s.id !== 'sickle' && weaponFor(s.id) ? s.id : null;
  }

  spendKi(n) {
    const g = this.game;
    if (g.ki < n) { g.sfx('deny'); this.w.fx.burst('fx_pebble', this.player.x, this.player.y - 20, 3, { speed: 10, up: 20 }); return false; }
    g.ki -= n;
    g.kiIdle = 0;
    return true;
  }

  /** Press of Use with a weapon: a light slash (the combo continues if pressed again in time). */
  attack() {
    const wpn = this.weapon();
    if (!wpn) return;
    if (this.act?.kind === 'slash') { if (this.act.t > this.phase(0)) this.act.queued = true; return; }
    if (this.act) return;
    if (wpn.cls === 'bow') { this.shoot(wpn); return; }
    this.startSlash(0);
  }

  phase(i) {
    const s = 1 / (this.weapon()?.speed || 1);
    return SWING.slice(0, i + 1).reduce((a, b) => a + b, 0) * s;
  }

  startSlash(combo) {
    this.act = { kind: 'slash', t: 0, combo, hit: new Set(), queued: false };
    this.game.sfx('swing');
  }

  shoot(wpn) {
    const g = this.game;
    if (!g.inventory.count('arrow')) { g.sfx('deny'); g.aside('tk_no_arrows', { once: true }); return; }
    g.inventory.remove('arrow', 1);
    this.act = { kind: 'shoot', t: 0 };
    const [dx, dy] = DIRS[this.player.dir];
    this.w.combat.shots.push({ kind: 'arrow', x: this.player.x + dx * 8, y: this.player.y - 12 + dy * 6, vx: dx * ARROW_SPEED, vy: dy * ARROW_SPEED, t: 0, life: wpn.reach / ARROW_SPEED, friendly: true, dmg: wpn, dir: this.player.dir });
    g.sfx('swing');
  }

  dodge(ax, ay) {
    if (this.act) return;
    if (!this.spendKi(DODGE.ki)) return;
    let [dx, dy] = ax || ay ? [ax, ay] : DIRS[this.player.dir];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    this.act = { kind: 'dodge', t: 0, dx, dy };
    this.iframes = Math.max(this.iframes, DODGE.iframes);
    this.game.sfx('step');
  }

  parry() {
    if (this.act && this.act.kind !== 'charge') return;
    if (!this.spendKi(PARRY.ki)) return;
    this.act = { kind: 'parry', t: 0 };
    this.game.sfx('ui');
  }

  update(dt, input) {
    const g = this.game, p = this.player;
    g.kiIdle = (g.kiIdle || 0) + dt;
    g.ki = regenKi(g.ki, kiMax(g.virtues), g.kiIdle, dt);
    this.iframes = Math.max(0, this.iframes - dt);
    this.counter = Math.max(0, this.counter - dt);
    this.flash = Math.max(0, this.flash - dt);
    for (const gh of this.ghosts) gh.t += dt;
    this.ghosts = this.ghosts.filter((gh) => gh.t < 0.25);
    if (this.kb) {
      this.kb.t -= dt;
      moveBox(this.w.map, p, this.kb.vx * dt, this.kb.vy * dt, HW, HH);
      if (this.kb.t <= 0) this.kb = null;
      return true;
    }
    let a = this.act;
    if (!a) return false;
    // A dodge cancels a swing or a stance (not a heavy strike already falling).
    if (input.pressed('dodge') && this.w.map.def.cave && a.kind !== 'dodge' && a.kind !== 'heavy') {
      const ax = input.axis();
      this.act = null;
      this.dodge(ax.x, ax.y);
      a = this.act;
      if (!a) return false;
    }
    if (a.kind === 'slash' && input.pressed('use')) this.attack();
    a.t += dt;
    const [fx, fy] = DIRS[p.dir];
    switch (a.kind) {
      case 'slash': {
        if (a.t < this.phase(0)) moveBox(this.w.map, p, fx * LUNGE * dt, fy * LUNGE * dt, HW, HH);
        else if (a.t < this.phase(1)) this.w.combat.playerStrike(a, this.weapon(), { heavy: false });
        if (a.t >= this.phase(2)) {
          const next = a.queued && a.combo < COMBO - 1;
          this.act = null;
          if (next) this.startSlash(a.combo + 1);
          else if (a.combo === 0 && input.isDown('use') && this.weapon()?.cls !== 'bow') this.act = { kind: 'charge', t: 0 };
        }
        break;
      }
      case 'charge':
        if (a.t >= HEAVY.full - HEAVY.hold && !a.ready) { a.ready = true; g.sfx('ui'); }
        if (!input.isDown('use')) {
          this.act = null;
          if (a.ready && this.spendKi(this.weapon()?.ki || 25)) { this.act = { kind: 'heavy', t: 0, hit: new Set() }; g.sfx('fall'); }
        }
        break;
      case 'heavy':
        if (a.t < 0.1) moveBox(this.w.map, p, fx * LUNGE * 2 * dt, fy * LUNGE * 2 * dt, HW, HH);
        else if (a.t < 0.22) this.w.combat.playerStrike(a, this.weapon(), { heavy: true });
        if (a.t >= 0.45) this.act = null;
        break;
      case 'dodge':
        moveBox(this.w.map, p, a.dx * DODGE.speed * dt, a.dy * DODGE.speed * dt, HW, HH);
        if (Math.floor(a.t * 30) !== Math.floor((a.t - dt) * 30)) this.ghosts.push({ x: p.x, y: p.y, t: 0, dir: p.dir });
        if (a.t >= DODGE.time) this.act = null;
        break;
      case 'parry':
        if (a.t >= PARRY_STANCE) this.act = null;
        break;
      case 'shoot':
        if (a.t >= 0.3) this.act = null;
        break;
      default: this.act = null;
    }
    return true;
  }

  /** Is the parry open right now (the first part of the stance)? */
  parrying() {
    return this.act?.kind === 'parry' && this.act.t <= parryWindow(this.game.skills);
  }

  /**
   * An enemy's blow reaches the player. Returns 'parried', 'avoided' or 'hit'.
   * `parryable` blows are turned by an open parry; nothing lands during invulnerability.
   */
  receive(base, fromX, fromY, { parryable = true } = {}) {
    const g = this.game, p = this.player;
    p.swing = null;
    p.charge = null;
    if (parryable && this.parrying()) {
      g.ki = Math.min(kiMax(g.virtues), g.ki + PARRY.refund);
      this.counter = PARRY.counter;
      this.act = null;
      g.sfx('parry');
      this.w.fx.burst('fx_sparkle', (p.x + fromX) / 2, (p.y + fromY) / 2 - 14, 8, { speed: 50, up: 40 });
      this.w.combat.hitstop = 0.09;
      g.shake(0.12);
      g.stats.parries = (g.stats.parries || 0) + 1;
      return 'parried';
    }
    if (this.iframes > 0 || g.hp <= 0) return 'avoided';
    const dmg = damageTaken(base, g.difficulty, g.skills, buffAmount(g.buffs, 'guard'));
    g.hp = Math.max(0, g.hp - dmg);
    this.iframes = HURT_IFRAMES;
    this.flash = 0.15;
    this.act = null;
    const d = Math.hypot(p.x - fromX, p.y - fromY) || 1;
    this.kb = { vx: ((p.x - fromX) / d) * 150, vy: ((p.y - fromY) / d) * 150, t: 0.12 };
    this.w.combat.hitstop = 0.06;
    this.w.combat.floater(p.x, p.y - 30, `${dmg}`, 'red3');
    g.sfx('hurt');
    g.shake(0.18);
    if (g.hp <= 0) this.w.combat.defeated();
    return 'hit';
  }

  /** Body frame, held sprite and whether the held sprite goes behind the body (for draw.js). */
  pose() {
    const a = this.act, p = this.player;
    const flip = p.dir === 'left', d = flip ? 'right' : p.dir;
    const id = this.heldId();
    if (!a) return null;
    const held = (pose) => (id ? `held_${id}_${d}_${pose}` : null);
    switch (a.kind) {
      case 'slash': {
        const i = a.t < this.phase(0) ? 0 : a.t < this.phase(1) ? 1 : 2;
        return { body: `player_${d}_tool${i}`, held: held(i ? 'strike' : 'raise'), behind: i === 0 || d === 'up', flip };
      }
      case 'charge': return { body: `player_${d}_tool0`, held: held('raise'), behind: true, flip, glow: a.ready };
      case 'heavy': return { body: `player_${d}_tool${a.t < 0.1 ? 0 : 1}`, held: held(a.t < 0.1 ? 'raise' : 'strike'), behind: a.t < 0.1 || d === 'up', flip };
      case 'parry': return { body: `player_${d}_tool0`, held: held('guard'), behind: d === 'up', flip };
      case 'shoot': return { body: `player_${d}_tool1`, held: held('strike'), behind: d === 'up', flip };
      case 'dodge': return { body: `player_${d}_walk1`, held: null, behind: false, flip };
      default: return null;
    }
  }
}
