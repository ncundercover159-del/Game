// The player: movement, facing, walk/idle animation and the tool-swing state machine.
// The swing's effect is applied by the caller (World) at the strike frame via `onStrike`.
import { TILE } from '../config.js';
import { moveBox } from './collision.js';

export const SPEED = 72;            // px/s (4.5 tiles/s)
const EXHAUSTED = 0.7;
const HW = 5, HH = 6;               // collision half-width and height at the feet
const SWING = [0.13, 0.09, 0.16];   // raise, strike, follow-through (s)
const WALK_FRAME = 0.15;
const IDLE_FRAME = 0.6;

export const DIRS = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

export class Player {
  constructor({ x, y, dir = 'down' }) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.anim = 'idle';
    this.animT = 0;
    this.swing = null;   // { tool, t, struck, tx, ty, level }
    this.charge = null;  // { tool, t, max } while an upgraded hoe or can is held down
    this.stepT = 0;
    this.frozen = false;
  }

  get tx() { return Math.floor(this.x / TILE); }
  get ty() { return Math.floor((this.y - 3) / TILE); }

  /** Tile directly in front of the player. */
  facingTile() {
    const [dx, dy] = DIRS[this.dir];
    return { x: this.tx + dx, y: this.ty + dy };
  }

  face(tx, ty) {
    const dx = tx - this.tx, dy = ty - this.ty;
    if (!dx && !dy) return;
    this.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }

  get busy() { return !!this.swing || !!this.charge; }

  startSwing(tool, tx, ty, level = 0) {
    this.swing = { tool, t: 0, struck: false, tx, ty, level };
    this.anim = 'tool';
  }

  /** Returns true on the step the swing lands (strike frame begins). */
  updateSwing(dt) {
    const s = this.swing;
    s.t += dt;
    let landed = false;
    if (!s.struck && s.t >= SWING[0]) { s.struck = true; landed = true; }
    if (s.t >= SWING[0] + SWING[1] + SWING[2]) { this.swing = null; this.anim = 'idle'; this.animT = 0; }
    return landed;
  }

  /** Walk by an input vector (-1..1 per axis). Returns the distance moved. */
  walk(dt, ax, ay, map, exhausted, speedMult = 1) {
    if (!ax && !ay) {
      if (this.anim === 'walk') { this.anim = 'idle'; this.animT = 0; }
      return 0;
    }
    const len = Math.hypot(ax, ay);
    const sp = SPEED * speedMult * (exhausted ? EXHAUSTED : 1) * dt * Math.min(1, len);
    const vx = (ax / len) * sp, vy = (ay / len) * sp;
    // Face the dominant axis; keep the current facing on exact diagonals to avoid flicker.
    if (Math.abs(ax) > Math.abs(ay)) this.dir = ax > 0 ? 'right' : 'left';
    else if (Math.abs(ay) > Math.abs(ax)) this.dir = ay > 0 ? 'down' : 'up';
    else if (!((ax > 0 && this.dir === 'right') || (ax < 0 && this.dir === 'left') || (ay > 0 && this.dir === 'down') || (ay < 0 && this.dir === 'up'))) {
      this.dir = ay > 0 ? 'down' : 'up';
    }
    const ox = this.x, oy = this.y;
    moveBox(map, this, vx, vy, HW, HH);
    if (this.anim !== 'walk') { this.anim = 'walk'; this.animT = 0; }
    return Math.hypot(this.x - ox, this.y - oy);
  }

  tick(dt) {
    this.animT += dt;
  }

  /** Atlas frame name and flip for the current pose. */
  frame() {
    const flip = this.dir === 'left';
    const d = flip ? 'right' : this.dir;
    if (this.charge) return { name: `player_${d}_tool0`, flip, pose: 'raise', dir: d };
    if (this.swing) {
      const t = this.swing.t;
      const i = t < SWING[0] ? 0 : t < SWING[0] + SWING[1] ? 1 : 2;
      return { name: `player_${d}_tool${i}`, flip, pose: i === 0 ? 'raise' : 'strike', dir: d };
    }
    if (this.anim === 'walk') return { name: `player_${d}_walk${Math.floor(this.animT / WALK_FRAME) % 4}`, flip, dir: d };
    return { name: `player_${d}_idle${Math.floor(this.animT / IDLE_FRAME) % 2}`, flip, dir: d };
  }

  serialize() {
    return { x: this.x, y: this.y, dir: this.dir };
  }
}
