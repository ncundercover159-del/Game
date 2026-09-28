// Item drops: pop out in an arc, settle, then fly to the player (magnet) and into the backpack.
// Simulation state (they are saved with nothing: anything still on the ground at sleep is
// collected automatically, see day.js).
const MAGNET = 40;
const PICKUP = 6;

export class Drops {
  constructor() {
    this.list = [];
  }

  spawn(rng, id, n, q, x, y) {
    // Up to 4 visible pieces share the count.
    const pieces = Math.min(n, 4);
    for (let i = 0; i < pieces; i++) {
      const share = Math.floor(n / pieces) + (i < n % pieces ? 1 : 0);
      const a = rng.float(0, Math.PI * 2);
      this.list.push({ id, n: share, q, x, y, z: 4, vx: Math.cos(a) * rng.float(10, 26), vy: Math.sin(a) * rng.float(6, 14), vz: rng.float(70, 100), t: 0 });
    }
  }

  /** `take(drop)` returns the number that did not fit. */
  update(dt, player, take) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i];
      d.t += dt;
      const dx = player.x - d.x, dy = player.y - 6 - d.y;
      const dist = Math.hypot(dx, dy);
      if (d.t > 0.45 && dist < MAGNET) {
        const sp = 140 * dt;
        if (dist > 0.01) {
          d.x += (dx / dist) * Math.min(sp, dist);
          d.y += (dy / dist) * Math.min(sp, dist);
        }
        d.z = Math.max(0, d.z - 60 * dt);
        if (dist < PICKUP) {
          const left = take(d);
          if (left <= 0) this.list.splice(i, 1);
          else d.n = left;
        }
        continue;
      }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vz -= 320 * dt;
      d.z += d.vz * dt;
      if (d.z <= 0) {
        d.z = 0;
        d.vz = Math.abs(d.vz) > 30 ? -d.vz * 0.35 : 0;
        d.vx *= 0.6;
        d.vy *= 0.6;
      }
    }
  }

  /** Everything still lying around (collected at the end of the day). */
  drain() {
    const all = this.list;
    this.list = [];
    return all;
  }
}
