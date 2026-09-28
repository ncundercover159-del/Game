// The coop's animals as wanderers in the coop room: they amble between floor tiles, pause, and
// turn to look at you when petted. Positions are cosmetic and not saved.
import { TILE } from '../config.js';
import { pet, allPetted } from '../systems/animals.js';
import { dayIndex } from '../systems/calendar.js';
import { XP } from '../data/skills.js';
import { petMult } from '../systems/virtues.js';

const SPEED = 18;

export class Flock {
  constructor(world) {
    this.w = world;
    this.beasts = new Map();   // animal id -> { x, y, dir, tx, ty, wait, walkT, heart }
  }

  /** Keep one wanderer per animal in the coop state (new chicks appear by the door). */
  sync() {
    const st = this.w.game.animals, m = this.w.map;
    for (const a of st.list) {
      if (this.beasts.has(a.id)) continue;
      const [x, y] = this.freeTile() || [m.def.spawn.tx, m.def.spawn.ty - 1];
      this.beasts.set(a.id, { a, x: x * TILE + 8, y: y * TILE + 12, dir: 'down', tx: x, ty: y, wait: this.w.rng.next() * 2, walkT: 0, heart: 0 });
    }
    for (const id of [...this.beasts.keys()]) if (!st.list.some((a) => a.id === id)) this.beasts.delete(id);
  }

  freeTile() {
    const m = this.w.map;
    for (let i = 0; i < 40; i++) {
      const x = 1 + Math.floor(this.w.rng.next() * (m.w - 2)), y = 3 + Math.floor(this.w.rng.next() * (m.h - 5));
      if (!m.solid(x, y) && !m.objectAt(x, y)) return [x, y];
    }
    return null;
  }

  update(dt) {
    this.sync();
    for (const b of this.beasts.values()) {
      b.heart = Math.max(0, b.heart - dt);
      const gx = b.tx * TILE + 8, gy = b.ty * TILE + 12;
      const dx = gx - b.x, dy = gy - b.y, d = Math.hypot(dx, dy);
      if (d > 0.5) {
        const s = Math.min(d, SPEED * dt);
        b.x += (dx / d) * s;
        b.y += (dy / d) * s;
        b.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        b.walkT += dt;
        continue;
      }
      if ((b.wait -= dt) > 0) continue;
      b.wait = 1 + this.w.rng.next() * 3;
      const [nx, ny] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(this.w.rng.next() * 4)];
      if (!this.w.map.solid(b.tx + nx, b.ty + ny) && b.ty + ny >= 3) { b.tx += nx; b.ty += ny; }
    }
  }

  at(tx, ty) {
    for (const b of this.beasts.values()) if (Math.floor(b.x / TILE) === tx && Math.floor((b.y - 3) / TILE) === ty) return b;
    return null;
  }

  /** Petting: affection once a day, a heart, and Chūgi when every animal has had its turn. */
  pet(b) {
    const g = this.w.game, day = dayIndex(g.cal);
    b.heart = 1.2;
    b.wait = 2;
    if (!pet(b.a, day, petMult(g.virtues))) { g.sfx('ui'); return; }
    g.sfx('harvest');
    g.xp('farming', XP.animal);
    if (allPetted(g.animals, day)) g.addVirtue('chugi', 1);
  }

  frame(b) {
    const flip = b.dir === 'left';
    const moving = Math.hypot(b.tx * TILE + 8 - b.x, b.ty * TILE + 12 - b.y) > 0.5;
    return { name: `${b.a.kind}_${flip ? 'right' : b.dir}_${moving ? Math.floor(b.walkT / 0.2) % 2 : 0}`, flip };
  }
}
