// Analytic "arena" world: a bounded base floor plus platforms, ramps, pillars and
// surface patches. Used for battle arenas and the M1 test plane.
// Implements the same probe()/respawnPoint() interface as the ribbon track.
import { KART } from '../config.js';

const STEP_UP = 0.4;

function localXZ(f, x, z) {
  const dx = x - f.x, dz = z - f.z;
  const c = f._c, s = f._s;
  return [dx * c - dz * s, dx * s + dz * c];
}

function floorContains(f, x, z) {
  if (f.shape === 'circle') {
    const dx = x - f.x, dz = z - f.z;
    return dx * dx + dz * dz <= f.r * f.r;
  }
  const [lx, lz] = localXZ(f, x, z);
  return Math.abs(lx) <= f.w / 2 && Math.abs(lz) <= f.d / 2;
}

function floorHeight(f, x, z) {
  if (f.shape === 'ramp') {
    const [, lz] = localXZ(f, x, z);
    const t = Math.min(1, Math.max(0, (lz + f.d / 2) / f.d));
    return f.h0 + (f.h1 - f.h0) * t;
  }
  return f.h;
}

// push-out of a point from a solid shape grown by radius R; returns pen & normal
function pushOut(f, x, z, R, out) {
  if (f.shape === 'circle') {
    const dx = x - f.x, dz = z - f.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    const pen = f.r + R - d;
    if (pen <= 0) return false;
    if (d < 1e-5) { out.nx = 1; out.nz = 0; } else { out.nx = dx / d; out.nz = dz / d; }
    out.pen = pen;
    return true;
  }
  const [lx, lz] = localXZ(f, x, z);
  const hx = f.w / 2 + R, hz = f.d / 2 + R;
  if (Math.abs(lx) >= hx || Math.abs(lz) >= hz) return false;
  const px = hx - Math.abs(lx), pz = hz - Math.abs(lz);
  let nlx = 0, nlz = 0, pen;
  if (px < pz) { nlx = Math.sign(lx) || 1; pen = px; } else { nlz = Math.sign(lz) || 1; pen = pz; }
  // local -> world
  out.nx = nlx * f._c + nlz * f._s;
  out.nz = -nlx * f._s + nlz * f._c;
  out.pen = pen;
  return true;
}

export class ArenaWorld {
  constructor(def) {
    this.def = def;
    this.type = 'arena';
    this.baseHeight = def.baseHeight || 0;
    this.baseSurface = def.baseSurface || 'road';
    this.bounds = def.bounds || { shape: 'rect', w: 200, d: 200 };
    this.floors = (def.floors || []).map((f) => this._prep({ ...f }));
    for (const p of def.pads || []) {
      this.floors.push(this._prep({ shape: 'rect', x: p.x, z: p.z, w: p.w || 4, d: p.d || 6, rot: p.rot || 0, h: p.h ?? this.baseHeight, surface: 'boost', pad: true }));
    }
    this.spawns = def.spawns || [{ x: 0, z: 0, yaw: 0 }];
    this._tmp = { nx: 0, nz: 0, pen: 0 };
    this.minY = this.baseHeight;
    this.placements = {
      itemBoxes: (def.itemBoxes || []).map((b) => ({ x: b.x, y: this.heightAt(b.x, b.z) + 1.1, z: b.z, yaw: 0 })),
      coins: (def.coins || []).map((c) => ({ x: c.x, y: this.heightAt(c.x, c.z) + 0.9, z: c.z, yaw: 0 })),
      pads: [],
      treasure: null,
    };
  }

  // Starting positions: the defined spawns first, then a ring facing the centre.
  gridSpawns(n) {
    const out = [];
    const b = this.bounds;
    const R = (b.shape === 'circle' ? b.r : Math.min(b.w, b.d) / 2) * 0.62;
    for (let i = 0; i < n; i++) {
      if (i < this.spawns.length && this.spawns.length >= n) {
        const s = this.spawns[i];
        out.push({ x: s.x, y: this.heightAt(s.x, s.z), z: s.z, yaw: s.yaw ?? Math.atan2(-s.x, -s.z) });
      } else {
        const a = (i / n) * Math.PI * 2;
        const x = Math.sin(a) * R, z = Math.cos(a) * R;
        out.push({ x, y: this.heightAt(x, z), z, yaw: Math.atan2(-x, -z) });
      }
    }
    return out;
  }

  _prep(f) {
    const rot = f.rot || 0;
    f._c = Math.cos(rot);
    f._s = Math.sin(rot);
    if (f.h === undefined) f.h = this.baseHeight;
    if (f.shape === 'ramp') {
      const slope = (f.h1 - f.h0) / f.d;
      const fx = Math.sin(rot), fz = Math.cos(rot);
      const len = Math.sqrt(1 + slope * slope);
      f._n = [-slope * fx / len, 1 / len, -slope * fz / len];
    }
    return f;
  }

  probe(agent, x, y, z, out) {
    let best = this.baseHeight;
    let surface = this.baseSurface;
    let normal = null;
    let glider = false, rampBoost = 0;
    out.pen = 0; out.wnx = 0; out.wnz = 0;
    const R = agent.radius ?? KART.radius * 0.85;
    const tmp = this._tmp;
    let inside = true;

    // outer bounds
    const b = this.bounds;
    if (b.shape === 'circle') {
      const d = Math.sqrt(x * x + z * z);
      const pen = d - (b.r - R);
      if (pen > 0) { out.pen = pen; out.wnx = -x / d; out.wnz = -z / d; }
      if (d > b.r) inside = false;
    } else {
      const hx = b.w / 2 - R, hz = b.d / 2 - R;
      const px = Math.abs(x) - hx, pz = Math.abs(z) - hz;
      if (px > 0 && px >= pz) { out.pen = px; out.wnx = -Math.sign(x); out.wnz = 0; }
      else if (pz > 0) { out.pen = pz; out.wnx = 0; out.wnz = -Math.sign(z); }
      if (Math.abs(x) > b.w / 2 || Math.abs(z) > b.d / 2) inside = false;
    }

    for (let i = 0; i < this.floors.length; i++) {
      const f = this.floors[i];
      if (floorContains(f, x, z)) {
        const fh = floorHeight(f, x, z);
        if (fh <= y + STEP_UP) {
          if (fh >= best - 1e-4) {
            best = fh;
            surface = f.surface || this.baseSurface;
            normal = f._n || null;
            glider = !!f.glider;
            rampBoost = f.kick || 0;
          }
          continue;
        }
      }
      // solid if its top is above us (pillars, platform sides, ramp sides)
      if (f.shape !== 'ramp' && f.h > y + STEP_UP && !f.flat) {
        if (pushOut(f, x, z, R, tmp) && tmp.pen > out.pen) {
          out.pen = tmp.pen; out.wnx = tmp.nx; out.wnz = tmp.nz;
        }
      } else if (f.shape === 'ramp' && floorContains(f, x, z)) {
        // hitting the tall side of a ramp: push out sideways
        if (pushOut(f, x, z, 0, tmp) && tmp.pen > out.pen) {
          out.pen = tmp.pen; out.wnx = tmp.nx; out.wnz = tmp.nz;
        }
      }
    }
    out.ground = inside && surface !== 'void';
    out.h = best;
    if (normal) { out.nx = normal[0]; out.ny = normal[1]; out.nz = normal[2]; }
    else { out.nx = 0; out.ny = 1; out.nz = 0; }
    out.surface = surface;
    out.glider = glider;
    out.ramp = rampBoost > 0 || glider;
    out.rampBoost = rampBoost;
    return out;
  }

  // nearest spawn point
  respawnPoint(k) {
    let best = this.spawns[0], bd = Infinity;
    for (const s of this.spawns) {
      const d = (s.x - k.x) ** 2 + (s.z - k.z) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    return { x: best.x, y: this.heightAt(best.x, best.z), z: best.z, yaw: best.yaw || 0 };
  }

  heightAt(x, z) {
    let best = this.baseHeight;
    for (const f of this.floors) {
      if (floorContains(f, x, z)) best = Math.max(best, floorHeight(f, x, z));
    }
    return best;
  }
}
