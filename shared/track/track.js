// Ribbon track model. A track is a closed main spline plus optional open
// "branch" splines (shortcuts). Each is resampled every ~2 m into a ribbon of
// samples (centre, tangent, right, half-width, off-road width, bank, flags).
// Ground/wall/void queries project a point onto the nearest ribbon sample.
// Track-space: s = metres along the main ribbon, lane = -1..1 across the road.
import { KART } from '../config.js';
import { denseSpline, resample } from './spline.js';
import { registerTrackWorld } from './world.js';

const DS = 2.0;              // sample spacing (m)
const DEG = Math.PI / 180;
const KERB = 1.2;            // kerb strip width (visual; physically road)

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------------------------------------------------------------------------
// Definition helpers
function pointOf(p) { return Array.isArray(p) ? { p } : p; }

// Mirror a definition across X (Mirror mode): positions flip, lanes flip,
// banks flip and left/right flags swap.
export function mirrorDef(def) {
  const d = structuredClone(def);
  const mp = (p) => {
    const q = pointOf(p);
    const out = { ...q, p: [-q.p[0], q.p[1], q.p[2]] };
    if (q.bank !== undefined) out.bank = -q.bank;
    return out;
  };
  d.points = d.points.map(mp);
  for (const b of d.branches || []) b.points = b.points.map(mp);
  const flipLane = (o) => {
    if (!o) return;
    if (o.lane !== undefined) o.lane = -o.lane;
    if (o.lanes) o.lanes = o.lanes.map((l) => -l).reverse();
    if (o.x !== undefined) o.x = -o.x;
    if (o.dir !== undefined && o.type !== 'conveyor') o.dir = -o.dir;
    if (o.side) o.side = o.side === 'left' ? 'right' : o.side === 'right' ? 'left' : o.side;
  };
  for (const key of ['pads', 'itemRows', 'coins', 'ramps', 'hazards', 'props', 'landmarks', 'decor']) (d[key] || []).forEach(flipLane);
  flipLane(d.treasure);
  for (const s of d.sections || []) {
    if (s.bank !== undefined) s.bank = -s.bank;
    const l = s.wallsL, r = s.wallsR;
    if (l !== undefined || r !== undefined) { s.wallsL = r; s.wallsR = l; }
  }
  if (d.autoBank) d.autoBank = d.autoBank; // curvature flips with geometry automatically
  d.mirrored = true;
  return d;
}

// ---------------------------------------------------------------------------
// Ribbon construction
function buildRibbon(def, spec, id, closed, defaults) {
  const pts = spec.points.map(pointOf);
  const n = pts.length;
  const dense = denseSpline(pts.map((q) => q.p), closed, 24);
  const nSeg = closed ? n : n - 1;
  const res = resample(dense, DS, closed, nSeg);
  const S = res.samples;
  const N = S.length;
  const R = {
    id, closed, n: N, step: res.step, total: res.total,
    x: new Float64Array(N), y: new Float64Array(N), z: new Float64Array(N),
    tx: new Float64Array(N), tz: new Float64Array(N), slope: new Float64Array(N),
    rx: new Float64Array(N), rz: new Float64Array(N),
    hw: new Float64Array(N), off: new Float64Array(N), bank: new Float64Array(N),
    s: new Float64Array(N), mainS: new Float64Array(N),
    wallL: new Uint8Array(N), wallR: new Uint8Array(N), gap: new Uint8Array(N),
    surf: new Array(N), offSurf: new Array(N), flags: new Array(N),
    ramps: [], pads: [], spec,
    aabb: [Infinity, Infinity, -Infinity, -Infinity],
  };
  // attribute at control point i
  const attr = (i, key, dflt) => {
    const q = pts[((i % n) + n) % n];
    return q[key] !== undefined ? q[key] : dflt;
  };
  for (let i = 0; i < N; i++) {
    const smp = S[i];
    R.x[i] = smp.p[0]; R.y[i] = smp.p[1]; R.z[i] = smp.p[2];
    R.s[i] = smp.s;
    const param = smp.param;
    const a = Math.floor(param), f = param - a;
    const lerpAttr = (key, dflt) => attr(a, key, dflt) * (1 - f) + attr(a + 1, key, dflt) * f;
    R.hw[i] = lerpAttr('w', defaults.width) / 2;
    R.off[i] = lerpAttr('off', defaults.offroad);
    R.bank[i] = lerpAttr('bank', defaults.bank);
    R.wallL[i] = defaults.wallsL ? 1 : 0;
    R.wallR[i] = defaults.wallsR ? 1 : 0;
    R.surf[i] = defaults.surface;
    R.offSurf[i] = defaults.offSurface;
    R.flags[i] = null;
  }
  // tangents (central differences)
  for (let i = 0; i < N; i++) {
    let a = i - 1, b = i + 1;
    if (closed) { a = (a + N) % N; b = b % N; } else { a = Math.max(0, a); b = Math.min(N - 1, b); }
    const dx = R.x[b] - R.x[a], dz = R.z[b] - R.z[a], dy = R.y[b] - R.y[a];
    const hl = Math.hypot(dx, dz) || 1;
    R.tx[i] = dx / hl; R.tz[i] = dz / hl;
    R.slope[i] = dy / hl;
    R.rx[i] = -R.tz[i]; R.rz[i] = R.tx[i];
  }
  return R;
}

function smoothArray(arr, radius, closed) {
  const N = arr.length;
  const out = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    let sum = 0, cnt = 0;
    for (let k = -radius; k <= radius; k++) {
      let j = i + k;
      if (closed) j = (j + N) % N; else if (j < 0 || j >= N) continue;
      sum += arr[j]; cnt++;
    }
    out[i] = sum / cnt;
  }
  arr.set(out);
}

// iterate sample indices covering [t0, t1) of a closed ribbon (handles wrap)
function sampleRange(R, t0, t1) {
  const out = [];
  const i0 = Math.floor(((t0 % 1) + 1) % 1 * R.n);
  let i1 = Math.floor(((t1 % 1) + 1) % 1 * R.n);
  if (t1 - t0 >= 1) i1 = i0 + R.n;
  else if (i1 <= i0 && t1 > t0) i1 += R.n;
  for (let i = i0; i < i1; i++) out.push(i % R.n);
  return out;
}

export class TrackWorld {
  constructor(def, opts = {}) {
    this.def = opts.mirror ? mirrorDef(def) : def;
    def = this.def;
    this.type = 'track';
    this.id = def.id;
    const walls = def.walls !== false;
    const defaults = {
      width: def.width ?? 20, offroad: def.offroad ?? 7, bank: def.bank ?? 0,
      wallsL: walls, wallsR: walls, surface: def.surface || 'road', offSurface: def.offSurface || 'offroad',
    };
    this.defaults = defaults;
    const main = buildRibbon(def, def, 0, true, defaults);
    this.main = main;
    this.ribbons = [main];
    this.length = main.total;

    // auto banking from curvature
    if (def.autoBank) {
      for (let i = 0; i < main.n; i++) {
        const a = (i - 3 + main.n) % main.n, b = (i + 3) % main.n;
        const ya = Math.atan2(main.tx[a], main.tz[a]), yb = Math.atan2(main.tx[b], main.tz[b]);
        let d = yb - ya;
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        const kappa = d / (6 * main.step);
        main.bank[i] += clamp(kappa * 30, -1, 1) * def.autoBank;
      }
    }

    // sections
    for (const sec of def.sections || []) {
      for (const i of sampleRange(main, sec.from, sec.to)) this.applySection(main, i, sec);
    }
    smoothArray(main.hw, 5, true);
    smoothArray(main.off, 5, true);
    smoothArray(main.bank, 6, true);
    for (let i = 0; i < main.n; i++) { main.bank[i] = Math.tan(main.bank[i] * DEG); main.mainS[i] = main.s[i]; }

    // ramps & pads on main
    for (const r of def.ramps || []) this.addRamp(main, r);
    for (const p of def.pads || []) this.addPad(main, p);

    // branches (open splines, typically shortcuts)
    (def.branches || []).forEach((b, bi) => {
      const bd = {
        width: b.width ?? defaults.width * 0.6, offroad: b.offroad ?? 3, bank: b.bank ?? 0,
        wallsL: b.walls !== false, wallsR: b.walls !== false, surface: b.surface || 'road', offSurface: b.offSurface || defaults.offSurface,
      };
      const R = buildRibbon(def, b, bi + 1, false, bd);
      for (let i = 0; i < R.n; i++) R.bank[i] = Math.tan(R.bank[i] * DEG);
      for (const sec of b.sections || []) {
        for (let i = Math.floor(sec.from * R.n); i < Math.min(R.n, Math.ceil(sec.to * R.n)); i++) this.applySection(R, i, sec);
      }
      // map branch progress onto main progress (linear between its junctions)
      const s0 = this.nearestMain(R.x[0], R.y[0], R.z[0]).s;
      let s1 = this.nearestMain(R.x[R.n - 1], R.y[R.n - 1], R.z[R.n - 1]).s;
      if (s1 < s0) s1 += this.length;
      for (let i = 0; i < R.n; i++) R.mainS[i] = (s0 + (s1 - s0) * (i / (R.n - 1))) % this.length;
      // blend the branch's ends into the main surface so junctions have no steps
      const pjm = {}, rm = {};
      for (let i = 0; i < R.n; i++) {
        const w = Math.max(0, 1 - Math.min(i, R.n - 1 - i) / 10);
        if (w <= 0) continue;
        const mi = this.nearestSample(main, R.x[i], R.z[i], R.y[i]);
        this.project(main, mi, R.x[i], R.z[i], pjm);
        if (Math.abs(pjm.L) > pjm.hw + pjm.off + 2) continue;
        const mh = this.surfaceHeight(main, pjm, rm);
        R.y[i] = R.y[i] * (1 - w) + mh * w;
      }
      R.shortcut = b.shortcut !== false;
      R.mainFrom = s0; R.mainTo = s1 % this.length;
      for (const r of b.ramps || []) this.addRamp(R, r);
      for (const p of b.pads || []) this.addPad(R, p);
      this.ribbons.push(R);
    });

    for (const R of this.ribbons) {
      for (let i = 0; i < R.n; i++) {
        const e = R.hw[i] + R.off[i] + 4;
        R.aabb[0] = Math.min(R.aabb[0], R.x[i] - e); R.aabb[1] = Math.min(R.aabb[1], R.z[i] - e);
        R.aabb[2] = Math.max(R.aabb[2], R.x[i] + e); R.aabb[3] = Math.max(R.aabb[3], R.z[i] + e);
      }
    }
    this.computeJunctions();
    this.startS = ((def.start || 0) % 1) * this.length;
    this.minY = Math.min(...main.y);
    this._tmp = {};
    this.placements = this.computePlacements();
  }

  applySection(R, i, sec) {
    if (sec.w !== undefined) R.hw[i] = sec.w / 2;
    if (sec.off !== undefined) R.off[i] = sec.off;
    if (sec.bank !== undefined) R.bank[i] = sec.bank;
    if (sec.walls !== undefined) R.wallL[i] = R.wallR[i] = sec.walls ? 1 : 0;
    if (sec.wallsL !== undefined) R.wallL[i] = sec.wallsL ? 1 : 0;
    if (sec.wallsR !== undefined) R.wallR[i] = sec.wallsR ? 1 : 0;
    if (sec.surface) R.surf[i] = sec.surface;
    if (sec.offSurface) R.offSurf[i] = sec.offSurface;
    if (sec.gap) R.gap[i] = 1;
    const vis = {};
    for (const k of ['bridge', 'tunnel', 'noKerb', 'noRail', 'neon', 'cliff', 'water', 'deco']) if (sec[k] !== undefined) vis[k] = sec[k];
    if (Object.keys(vis).length) R.flags[i] = { ...(R.flags[i] || {}), ...vis };
  }

  // Ramp: {t, len, h, lanes:[a,b], glider, kick, type:'kicker'|'hill'}
  addRamp(R, r) {
    const s1 = (r.t ?? 0) * (R.closed ? this.length : R.total);
    const len = r.len ?? 12;
    const lanes = r.lanes || [-1, 1];
    R.ramps.push({ s0: s1 - len, s1, h: r.h ?? 2.2, lanes, glider: !!r.glider, kick: r.kick ?? 0, type: r.type || 'kicker', boost: !!r.boost });
  }

  addPad(R, p) {
    const s = (p.t ?? 0) * (R.closed ? this.length : R.total);
    const len = p.len ?? 7;
    R.pads.push({ s0: s - len / 2, s1: s + len / 2, lane: p.lane ?? 0, w: p.w ?? 4.5 });
  }

  // ramp height & slope contribution at (s, L)
  rampAt(R, s, L, hw, out) {
    out.h = 0; out.dhds = 0; out.glider = false; out.kick = 0; out.boost = false;
    for (const r of R.ramps) {
      let ds = s - r.s0;
      if (R.closed) { if (ds < -this.length / 2) ds += this.length; if (ds > this.length / 2) ds -= this.length; }
      const len = r.s1 - r.s0;
      if (ds < 0 || ds > len) continue;
      const la = r.lanes[0] * hw, lb = r.lanes[1] * hw;
      let lat = 1;
      if (L < la) lat = clamp(1 - (la - L) / 1.5, 0, 1);
      else if (L > lb) lat = clamp(1 - (L - lb) / 1.5, 0, 1);
      if (lat <= 0) continue;
      const f = ds / len;
      let h, d;
      if (r.type === 'hill') { h = r.h * Math.sin(f * Math.PI); d = (r.h * Math.PI * Math.cos(f * Math.PI)) / len; }
      else {
        // ease-in then linear rise to a sharp lip
        const e = 0.25;
        if (f < e) { h = (r.h * f * f) / (2 * e * (1 - e / 2)); d = (r.h * f) / (e * (1 - e / 2)) / len; }
        else { h = (r.h * (f - e / 2)) / (1 - e / 2); d = r.h / (1 - e / 2) / len; }
      }
      out.h += h * lat;
      out.dhds += d * lat;
      if (lat > 0.5) { out.glider ||= r.glider; out.kick = Math.max(out.kick, r.kick); out.boost ||= r.boost; }
    }
    return out;
  }

  // --- geometry queries -----------------------------------------------------------
  // Project (x,z) onto ribbon R near sample index i: returns segment start, u, lateral, dist2.
  project(R, i, x, z, out) {
    const N = R.n;
    const next = (j) => (R.closed ? (j + 1) % N : Math.min(N - 1, j + 1));
    const prev = (j) => (R.closed ? (j - 1 + N) % N : Math.max(0, j - 1));
    // choose the segment (i-1,i) or (i,i+1) that contains the projection
    let a = i;
    const dx = x - R.x[i], dz = z - R.z[i];
    if (dx * R.tx[i] + dz * R.tz[i] < 0) a = prev(i);
    let b = next(a);
    if (a === b) { a = prev(b); }
    const sx = R.x[b] - R.x[a], sz = R.z[b] - R.z[a];
    const sl2 = sx * sx + sz * sz || 1;
    let u = ((x - R.x[a]) * sx + (z - R.z[a]) * sz) / sl2;
    u = clamp(u, 0, 1);
    const cx = R.x[a] + sx * u, cz = R.z[a] + sz * u;
    const rx = R.rx[a] + (R.rx[b] - R.rx[a]) * u, rz = R.rz[a] + (R.rz[b] - R.rz[a]) * u;
    const rl = Math.hypot(rx, rz) || 1;
    out.a = a; out.b = b; out.u = u;
    out.rx = rx / rl; out.rz = rz / rl;
    out.L = (x - cx) * out.rx + (z - cz) * out.rz;
    out.d2 = (x - cx) ** 2 + (z - cz) ** 2;
    out.cy = R.y[a] + (R.y[b] - R.y[a]) * u;
    out.hw = R.hw[a] + (R.hw[b] - R.hw[a]) * u;
    out.off = R.off[a] + (R.off[b] - R.off[a]) * u;
    out.bank = R.bank[a] + (R.bank[b] - R.bank[a]) * u;
    let sb = R.s[b];
    if (R.closed && b < a) sb += R.total;
    out.s = R.s[a] + (sb - R.s[a]) * u;
    if (R.closed) out.s %= R.total;
    out.tx = R.tx[a]; out.tz = R.tz[a];
    return out;
  }

  // hill-climb along the ribbon from a hint to the nearest sample
  climb(R, hint, x, z) {
    const N = R.n;
    const d2 = (j) => (x - R.x[j]) ** 2 + (z - R.z[j]) ** 2;
    let i = hint, di = d2(i);
    for (let iter = 0; iter < 60; iter++) {
      const a = R.closed ? (i + 1) % N : Math.min(N - 1, i + 1);
      const b = R.closed ? (i - 1 + N) % N : Math.max(0, i - 1);
      const da = d2(a), db = d2(b);
      if (da < di && da <= db) { i = a; di = da; }
      else if (db < di) { i = b; di = db; }
      else break;
    }
    return i;
  }

  // brute force nearest sample (optionally preferring samples near height y)
  nearestSample(R, x, z, y) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < R.n; i++) {
      let d = (x - R.x[i]) ** 2 + (z - R.z[i]) ** 2;
      if (y !== undefined) {
        const dy = y - R.y[i];
        d += dy < -2 ? dy * dy * 4 : dy * dy * 0.25;
      }
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  nearestMain(x, y, z) {
    const i = this.nearestSample(this.main, x, z, y);
    return this.project(this.main, i, x, z, {});
  }

  // height of ribbon surface at a projection
  surfaceHeight(R, pj, rampOut) {
    this.rampAt(R, pj.s, pj.L, pj.hw, rampOut);
    return pj.cy + pj.L * pj.bank + rampOut.h;
  }

  // is (x,z) within ribbon R's drivable (road or off-road) area? returns projection or null
  claim(R, x, z, y, hint, out) {
    if (x < R.aabb[0] || x > R.aabb[2] || z < R.aabb[1] || z > R.aabb[3]) return null;
    const i = hint >= 0 ? this.climb(R, hint, x, z) : this.nearestSample(R, x, z, y);
    this.project(R, i, x, z, out);
    out.idx = i;
    if (!R.closed && ((out.a === 0 && out.u <= 0) || (out.b === R.n - 1 && out.u >= 1))) return null; // beyond branch ends
    if (Math.abs(out.L) > out.hw + out.off) return null;
    return out;
  }

  computeJunctions() {
    const tmp = {};
    for (const R of this.ribbons) {
      for (let i = 0; i < R.n; i++) {
        for (const side of [-1, 1]) {
          const e = R.hw[i] + R.off[i] + 1.5;
          const px = R.x[i] + R.rx[i] * e * side, pz = R.z[i] + R.rz[i] * e * side;
          for (const O of this.ribbons) {
            if (O === R) continue;
            if (this.claim(O, px, pz, R.y[i], -1, tmp)) {
              const oy = O.y[tmp.a];
              if (Math.abs(oy - R.y[i]) < 4) {
                if (side < 0) R.wallL[i] = 0; else R.wallR[i] = 0;
                R.flags[i] = { ...(R.flags[i] || {}), junction: true };
              }
            }
          }
        }
      }
    }
  }

  // --- main probe ----------------------------------------------------------------
  probe(agent, x, y, z, out) {
    const t = this._tmp;
    t.pj ??= {}; t.pj2 ??= {}; t.ramp ??= {}; t.ramp2 ??= {};
    let rid = agent.ribbon || 0;
    if (rid >= this.ribbons.length) rid = 0;
    let R = this.ribbons[rid];
    let hint = agent.hint;
    if (hint === undefined || hint < 0 || hint >= R.n) hint = this.nearestSample(R, x, z, y);
    let idx = this.climb(R, hint, x, z);
    let pj = this.project(R, idx, x, z, t.pj);
    // off the end of a branch -> hand back to main
    if (!R.closed && ((pj.a === 0 && pj.u <= 0.001) || (pj.b === R.n - 1 && pj.u >= 0.999))) {
      const ms = R.mainS[idx];
      R = this.main; rid = 0;
      idx = this.climb(R, Math.floor(ms / R.step) % R.n, x, z);
      pj = this.project(R, idx, x, z, t.pj);
    }
    let inside = Math.abs(pj.L) <= pj.hw + pj.off;
    // other ribbons can claim the point (entering a shortcut / leaving one)
    for (let r = 0; r < this.ribbons.length; r++) {
      if (r === rid) continue;
      const O = this.ribbons[r];
      const c = this.claim(O, x, z, y, r === 0 ? Math.floor(((R.mainS[idx] ?? 0) / O.step)) % O.n : -1, t.pj2);
      if (!c) continue;
      const cy = this.surfaceHeight(O, c, t.ramp2);
      if (cy > y + 1.5) continue; // not reachable from here
      const onRoadO = Math.abs(c.L) <= c.hw;
      const onRoadR = Math.abs(pj.L) <= pj.hw;
      if (!inside || (onRoadO && !onRoadR)) {
        R = O; rid = r; idx = c.idx;
        pj = this.project(R, idx, x, z, t.pj);
        inside = true;
        break;
      }
    }
    agent.ribbon = rid;
    agent.hint = idx;

    const h = this.surfaceHeight(R, pj, t.ramp);
    const absL = Math.abs(pj.L);
    const edge = pj.hw + pj.off;
    const side = pj.L < 0 ? -1 : 1;
    const wallOn = side < 0 ? R.wallL[pj.a] : R.wallR[pj.a];
    const rad = agent.radius ?? KART.radius * 0.85;

    out.pen = 0; out.wnx = 0; out.wnz = 0;
    if (wallOn && absL + rad > edge) {
      out.pen = absL + rad - edge;
      out.wnx = -side * pj.rx; out.wnz = -side * pj.rz;
    }
    const gap = R.gap[pj.a] || (R.gap[pj.b] && pj.u > 0.5);
    out.ground = (absL <= edge || (wallOn && absL <= edge + rad + 0.5)) && !gap;
    out.h = h;
    // heightfield normal from slope along s and bank across
    const dhds = R.slope[pj.a] + t.ramp.dhds;
    const dhdl = pj.bank;
    let nx = -dhds * pj.tx - dhdl * pj.rx, nz = -dhds * pj.tz - dhdl * pj.rz, ny = 1;
    const nl = Math.hypot(nx, ny, nz);
    out.nx = nx / nl; out.ny = ny / nl; out.nz = nz / nl;
    let surface = absL <= pj.hw ? R.surf[pj.a] : R.offSurf[pj.a];
    if (absL <= pj.hw && t.ramp.boost) surface = 'boost';
    // boost pads
    if (absL <= pj.hw) {
      for (const p of R.pads) {
        let ds = pj.s - p.s0;
        if (R.closed) { if (ds < -this.length / 2) ds += this.length; if (ds > this.length / 2) ds -= this.length; }
        if (ds >= 0 && ds <= p.s1 - p.s0 && Math.abs(pj.L - p.lane * pj.hw) <= p.w / 2) { surface = 'boost'; break; }
      }
    }
    out.surface = surface;
    out.glider = t.ramp.glider;
    out.ramp = t.ramp.h > 0.1;
    out.rampBoost = t.ramp.kick;
    // track-space info for race logic / AI
    agent.s = R.closed ? pj.s : R.mainS[pj.a] + (R.mainS[pj.b] - R.mainS[pj.a]) * pj.u;
    if (!R.closed && R.mainS[pj.b] < R.mainS[pj.a]) agent.s = R.mainS[pj.a];
    agent.lateral = pj.L;
    agent.lane = pj.L / pj.hw;
    agent.tdx = pj.tx; agent.tdz = pj.tz;
    agent.onRoad = absL <= pj.hw;
    return out;
  }

  // --- placements -------------------------------------------------------------------
  // World position at main track t (0..1) and lane (-1..1). Returns {x,y,z,yaw,idx}.
  at(t, lane = 0, ribbon = 0, dy = 0) {
    const R = this.ribbons[ribbon] || this.main;
    const total = R.closed ? this.length : R.total;
    let s;
    if (R.closed) { s = (t * total) % total; if (s < 0) s += total; }
    else s = clamp(t, 0, 1) * total * 0.9999;
    const i = Math.min(R.n - 1, Math.floor(s / R.step));
    const j = R.closed ? (i + 1) % R.n : Math.min(R.n - 1, i + 1);
    const f = s / R.step - i;
    const lx = R.x[i] + (R.x[j] - R.x[i]) * f, lz = R.z[i] + (R.z[j] - R.z[i]) * f;
    const pj = this.project(R, i, lx, lz, {});
    const L = lane * pj.hw;
    const x = lx + pj.rx * L, z = lz + pj.rz * L;
    const h = this.surfaceHeight(R, this.project(R, i, x, z, {}), {});
    return { x, y: h + dy, z, yaw: Math.atan2(pj.tx, pj.tz), idx: i, hw: pj.hw, rx: pj.rx, rz: pj.rz };
  }

  computePlacements() {
    const d = this.def;
    const out = { itemBoxes: [], coins: [], pads: [], treasure: null };
    for (const row of d.itemRows || []) {
      for (const lane of row.lanes || [-0.6, -0.2, 0.2, 0.6]) {
        const p = this.at(row.t, lane, row.ribbon || 0, 1.1);
        out.itemBoxes.push(p);
      }
    }
    for (const c of d.coins || []) {
      const n = c.n || 5;
      for (let i = 0; i < n; i++) {
        const t = c.t0 + ((c.t1 - c.t0) * i) / Math.max(1, n - 1);
        const lane = c.lane1 !== undefined ? c.lane + ((c.lane1 - c.lane) * i) / Math.max(1, n - 1) : c.lane || 0;
        out.coins.push(this.at(t, lane, c.ribbon || 0, 0.9));
      }
    }
    for (const R of this.ribbons) {
      for (const p of R.pads) {
        const total = R.closed ? this.length : R.total;
        const pos = this.at(((p.s0 + p.s1) / 2) / total, p.lane, R.id, 0.03);
        out.pads.push({ ...pos, len: p.s1 - p.s0, w: p.w });
      }
    }
    if (d.treasure) out.treasure = this.at(d.treasure.t, d.treasure.lane || 0, d.treasure.ribbon || 0, 1.2);
    return out;
  }

  // Grid behind the start line: staggered two columns.
  gridSpawns(n) {
    const out = [];
    const t0 = this.startS / this.length;
    for (let i = 0; i < n; i++) {
      const back = 7 + i * 4.3;
      const lane = i % 2 === 0 ? -0.36 : 0.36;
      const p = this.at(t0 - back / this.length, lane);
      out.push({ ...p, hint: p.idx, ribbon: 0 });
    }
    return out;
  }

  respawnPoint(k) {
    let R = this.ribbons[k.safeRibbon] || this.main;
    let i = k.safeHint >= 0 && k.safeHint < R.n ? k.safeHint : this.nearestSample(R, k.x, k.z, k.y);
    const tmp = {};
    // fell into a gap just ahead of the last safe sample: respawn on the far side
    for (let ahead = 1; ahead < 12; ahead++) {
      const j = R.closed ? (i + ahead) % R.n : Math.min(R.n - 1, i + ahead);
      if (R.gap[j]) {
        let m = j;
        for (let q = 0; q < 60 && R.gap[m]; q++) m = R.closed ? (m + 1) % R.n : Math.min(R.n - 1, m + 1);
        return this.spawnAt(R, R.closed ? (m + 3) % R.n : Math.min(R.n - 1, m + 3), 0);
      }
    }
    // step back a little, avoiding ramps and gaps
    for (let back = 0; back < 40; back++) {
      const j = R.closed ? (i - back + R.n * 4) % R.n : Math.max(0, i - back);
      if (R.gap[j]) continue;
      this.rampAt(R, R.s[j], 0, R.hw[j], tmp);
      if (tmp.h > 0.05) continue;
      if (back < 2) continue;
      i = j;
      break;
    }
    return this.spawnAt(R, i, clamp((k.lane || 0) * 0.5, -0.4, 0.4));
  }

  spawnAt(R, i, lane) {
    const L = lane * R.hw[i];
    const x = R.x[i] + R.rx[i] * L, z = R.z[i] + R.rz[i] * L;
    const y = R.y[i] + L * R.bank[i];
    return { x, y, z, yaw: Math.atan2(R.tx[i], R.tz[i]), ribbon: R.id, hint: i };
  }

  // progress along main track, 0..length
  sAt(x, y, z) { return this.nearestMain(x, y, z).s; }
}

registerTrackWorld(TrackWorld);
