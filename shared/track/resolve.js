// Track definition resolver. Lets track JSON be authored as a "turtle path"
// instead of raw control points, and lets any placement refer to a path
// command ("@7+20" = 20 m after the start of command 7) instead of a raw
// 0..1 fraction. Also builds shortcut branches from a chord description and
// derives retro remixes from another track. Resolution is pure and runs once
// when game data is registered (client and server alike).
//
// path commands:
//   ["S", len, dy?, attrs?]            straight
//   ["L"|"R", radius, degrees, dy?, attrs?]  arc (R = clockwise seen from above)
//   attrs: per-point overrides such as { "w": 16, "off": 4, "bank": 8 }
import { denseSpline, resample } from './spline.js';

const DEG = Math.PI / 180;
const smooth = (f) => f * f * (3 - 2 * f);

// Shortest Dubins path (turn, straight, turn) from pose a to pose b with turn
// radius r. Poses are { x, z, yaw } in track convention. Returns path commands.
export function dubins(a, b, r) {
  const TAU = Math.PI * 2;
  const mod = (v) => ((v % TAU) + TAU) % TAU;
  // standard frame: u = x, v = z, phi = pi/2 - yaw (a left turn in track terms is clockwise here)
  const p0 = { u: a.x, v: a.z, phi: Math.PI / 2 - a.yaw }, p1 = { u: b.x, v: b.z, phi: Math.PI / 2 - b.yaw };
  const du = p1.u - p0.u, dv = p1.v - p0.v;
  const d = Math.hypot(du, dv) / r;
  const th = Math.atan2(dv, du);
  const al = mod(p0.phi - th), be = mod(p1.phi - th);
  const sa = Math.sin(al), sb = Math.sin(be), ca = Math.cos(al), cb = Math.cos(be), cab = Math.cos(al - be);
  const words = [];
  let tmp = 2 + d * d - 2 * cab + 2 * d * (sa - sb);
  if (tmp >= 0) { const q = Math.atan2(cb - ca, d + sa - sb); words.push(['CCW', mod(-al + q), Math.sqrt(tmp), mod(be - q), 'CCW']); }
  tmp = 2 + d * d - 2 * cab + 2 * d * (sb - sa);
  if (tmp >= 0) { const q = Math.atan2(ca - cb, d - sa + sb); words.push(['CW', mod(al - q), Math.sqrt(tmp), mod(-be + q), 'CW']); }
  tmp = -2 + d * d + 2 * cab + 2 * d * (sa + sb);
  if (tmp >= 0) { const pp = Math.sqrt(tmp); const q = Math.atan2(-ca - cb, d + sa + sb) - Math.atan2(-2, pp); words.push(['CCW', mod(-al + q), pp, mod(-mod(be) + q), 'CW']); }
  tmp = d * d - 2 + 2 * cab - 2 * d * (sa + sb);
  if (tmp >= 0) { const pp = Math.sqrt(tmp); const q = Math.atan2(ca + cb, d - sa - sb) - Math.atan2(2, pp); words.push(['CW', mod(al - q), pp, mod(be - q), 'CCW']); }
  if (!words.length) throw new Error('track path: CLOSE found no Dubins path');
  words.sort((x, y) => x[1] + x[2] + x[3] - (y[1] + y[2] + y[3]));
  const [t1, t, p, q, t2] = words[0];
  const cmd = (dir) => (dir === 'CCW' ? 'R' : 'L');
  const out = [];
  if (t > 1e-3) out.push([cmd(t1), r, (t * 180) / Math.PI]);
  if (p * r > 0.05) out.push(['S', p * r]);
  if (q > 1e-3) out.push([cmd(t2), r, (q * 180) / Math.PI]);
  return out;
}

// Turtle path -> control points (+ command start distances for "@" refs).
// ["CLOSE", radius] as the last command returns to the start pose exactly.
export function pathToPoints(path, start = {}) {
  let x = start.x ?? 0, y = start.y ?? 0, z = start.z ?? 0, yaw = (start.yaw ?? 0) * DEG;
  const x0 = x, y0s = y, z0 = z, yaw0 = yaw;
  const pts = [];
  const cmdS = [];
  let s = 0;
  const push = (attrs) => pts.push({ p: [x, y, z], s, ...(attrs || {}) });
  push(null);
  const run = (cmd) => {
    const [op] = cmd;
    const attrs = typeof cmd[cmd.length - 1] === 'object' ? cmd[cmd.length - 1] : null;
    if (op === 'S') {
      const len = cmd[1], dy = typeof cmd[2] === 'number' ? cmd[2] : 0;
      const n = Math.max(1, Math.ceil(len / 32));
      const ys = y;
      for (let k = 1; k <= n; k++) {
        const f = k / n;
        x += Math.sin(yaw) * (len / n); z += Math.cos(yaw) * (len / n);
        y = ys + dy * smooth(f);
        s += len / n;
        push(attrs);
      }
    } else if (op === 'L' || op === 'R') {
      const r = cmd[1], deg = cmd[2], dy = typeof cmd[3] === 'number' ? cmd[3] : 0;
      const sign = op === 'L' ? 1 : -1; // left turn increases yaw
      const arc = r * deg * DEG;
      const n = Math.max(2, Math.ceil(arc / 22));
      const ys = y;
      // centre of the turning circle: left vector is (cos yaw, -sin yaw)
      const lx = Math.cos(yaw) * sign, lz = -Math.sin(yaw) * sign;
      const cx = x + lx * r, cz = z + lz * r;
      const a0 = Math.atan2(x - cx, z - cz);
      for (let k = 1; k <= n; k++) {
        const f = k / n;
        const a = a0 + sign * deg * DEG * f;
        x = cx + Math.sin(a) * r; z = cz + Math.cos(a) * r;
        y = ys + dy * smooth(f);
        s += arc / n;
        push(attrs);
      }
      yaw += sign * deg * DEG;
    } else if (op === 'CLOSE') {
      const sub = dubins({ x, z, yaw }, { x: x0, z: z0, yaw: yaw0 }, cmd[1] ?? 40);
      const lens = sub.map((c) => (c[0] === 'S' ? c[1] : c[1] * c[2] * DEG));
      const tot = lens.reduce((a, b) => a + b, 0) || 1;
      const dyAll = y0s - y;
      sub.forEach((c, i) => run(c[0] === 'S' ? ['S', c[1], (dyAll * lens[i]) / tot, attrs || undefined].filter((v) => v !== undefined) : [c[0], c[1], c[2], (dyAll * lens[i]) / tot]));
    } else {
      throw new Error(`track path: unknown command ${op}`);
    }
  };
  for (const cmd of path) {
    cmdS.push(s);
    run(cmd);
  }
  cmdS.push(s);
  // close the loop: spread any end->start error along the path
  const e0 = pts[pts.length - 1].p, st = pts[0].p;
  const ex = e0[0] - st[0], ey = e0[1] - st[1], ez = e0[2] - st[2];
  const total = s;
  for (const q of pts) {
    const f = q.s / total;
    q.p = [q.p[0] - ex * f, q.p[1] - ey * f, q.p[2] - ez * f].map((v) => Math.round(v * 100) / 100);
  }
  pts.pop(); // last point coincides with the first
  const closeErr = Math.hypot(ex, ez);
  return { points: pts.map(({ s: _s, ...q }) => (Object.keys(q).length === 1 ? q.p : q)), cmdS, total, closeErr, closeVec: [ex, ey, ez] };
}

// "@cmd+metres" / "@cmd-metres" / "@cmd" -> fraction of the lap
function refToT(v, cmdS, total) {
  if (typeof v !== 'string' || v[0] !== '@') return v;
  const m = /^@(\d+)([+-]\d+(?:\.\d+)?)?$/.exec(v.trim());
  if (!m) throw new Error(`track ref: bad reference ${v}`);
  const i = Number(m[1]);
  if (i >= cmdS.length) throw new Error(`track ref: command ${i} out of range`);
  const s = cmdS[i] + Number(m[2] || 0);
  return (((s / total) % 1) + 1) % 1;
}

const T_KEYS = ['t', 't0', 't1', 'from', 'to', 'start'];

function resolveRefs(obj, cmdS, total) {
  if (!obj || typeof obj !== 'object') return;
  for (const k of T_KEYS) if (typeof obj[k] === 'string') obj[k] = refToT(obj[k], cmdS, total);
}

// Main centre line sampled every 2 m (for branch construction).
function centreLine(def) {
  const pts = def.points.map((q) => (Array.isArray(q) ? q : q.p));
  const dense = denseSpline(pts, true, 24);
  const res = resample(dense, 2, true, pts.length);
  return res.samples.map((smp) => smp.p);
}

function lineAt(line, t) {
  const n = line.length;
  const f = ((((t % 1) + 1) % 1) * n);
  const i = Math.floor(f) % n, j = (i + 1) % n, u = f - Math.floor(f);
  const a = line[i], b = line[j];
  const p = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
  const c = line[(i + 2) % n], d = line[(i - 1 + n) % n];
  const tx = c[0] - d[0], tz = c[2] - d[2];
  const l = Math.hypot(tx, tz) || 1;
  return { p, tx: tx / l, tz: tz / l };
}

// Branch from a chord: { from, to, via: [[f, offset, dy], ...], lead }
// Points run from main(from) along main's tangent, through the chord (offset
// sideways by `offset` metres, + = right of the chord direction), into main(to).
function chordBranch(line, b) {
  const A = lineAt(line, b.from), B = lineAt(line, b.to);
  const lead = b.lead ?? 14;
  const dx = B.p[0] - A.p[0], dz = B.p[2] - A.p[2];
  const L = Math.hypot(dx, dz) || 1;
  // forward (sin, cos) has right vector (-cos, sin), i.e. (-dz, dx) for the chord
  const rx = -dz / L, rz = dx / L;
  const pts = [A.p, [A.p[0] + A.tx * lead, A.p[1], A.p[2] + A.tz * lead]];
  for (const [f, off = 0, dy = 0] of b.via || []) {
    pts.push([A.p[0] + dx * f + rx * off, A.p[1] + (B.p[1] - A.p[1]) * f + dy, A.p[2] + dz * f + rz * off]);
  }
  pts.push([B.p[0] - B.tx * lead, B.p[1], B.p[2] - B.tz * lead], B.p);
  return pts.map((p) => p.map((v) => Math.round(v * 100) / 100));
}

// Reverse a track (retro remix variant): runs the same ribbon backwards.
export function reverseDef(def) {
  const d = structuredClone(def);
  d.points = [...d.points].reverse();
  const L = 1;
  const flipT = (t) => ((L - t) % 1 + 1) % 1;
  const flipLane = (o) => {
    if (o.lane !== undefined) o.lane = -o.lane;
    if (o.lane0 !== undefined) o.lane0 = -o.lane0;
    if (o.lane1 !== undefined) o.lane1 = -o.lane1;
    if (o.lanes) o.lanes = o.lanes.map((l) => -l).reverse();
    if (o.dir !== undefined && o.type === 'windGust') o.dir = -o.dir;
    if (o.side) o.side = o.side === 'left' ? 'right' : 'left';
  };
  // point index 0 stays at t=0 if we rotate: reversed list starts at the old last point
  d.points = [d.points[d.points.length - 1], ...d.points.slice(0, -1)];
  for (const key of ['pads', 'itemRows', 'coins', 'hazards', 'landmarks']) {
    for (const o of d[key] || []) {
      const ft = o.ribbon ? (t) => 1 - t : flipT;
      if (o.t !== undefined) o.t = ft(o.t);
      if (o.t0 !== undefined && o.type === 'boulder') {
        // a rolling boulder keeps its physical path (start and end points)
        o.t0 = ft(o.t0); o.t1 = ft(o.t1);
      } else if (o.t0 !== undefined) {
        const a = ft(o.t1), b = ft(o.t0);
        o.t0 = a; o.t1 = b;
        // runs of coins keep their physical ends
        if (key === 'coins' && o.lane1 !== undefined) { const l = o.lane; o.lane = o.lane1; o.lane1 = l; }
      }
      if (!o.ribbon) flipLane(o);
    }
  }
  // ramps: a ramp ending at t with length len now ends at 1 - (t - len/total).
  // A ramp that launches over a gap moves to the far side of that gap instead.
  const gapJump = (r, sections, flip) => {
    const g = (sections || []).find((sec) => sec.gap && Math.abs(sec.from - r.t) < 0.015);
    if (!g) return false;
    r.t = flip(g.to);
    return true;
  };
  for (const r of d.ramps || []) if (!gapJump(r, def.sections, flipT)) r._reverse = true;
  for (const s of d.sections || []) {
    const a = flipT(s.to), b = flipT(s.from);
    s.from = a; s.to = b < a ? b + 1 : b;
    if (s.bank !== undefined) s.bank = -s.bank;
    const l = s.wallsL, r = s.wallsR;
    if (l !== undefined || r !== undefined) { s.wallsL = r; s.wallsR = l; }
  }
  for (const b of d.branches || []) {
    b.points = [...b.points].reverse();
    const origSecs = structuredClone(b.sections || []);
    for (const sec of b.sections || []) { const a = 1 - sec.to, c = 1 - sec.from; sec.from = a; sec.to = c; }
    for (const r of b.ramps || []) if (!gapJump(r, origSecs, (t) => 1 - t)) r._reverse = true;
    for (const p of b.pads || []) p.t = 1 - p.t;
  }
  if (d.treasure && !d.treasure.ribbon) { d.treasure.t = flipT(d.treasure.t); flipLane(d.treasure); }
  else if (d.treasure) d.treasure.t = 1 - d.treasure.t;
  d.start = flipT(d.start || 0);
  // the start line stays where it was, so the grid now faces the other way
  return d;
}

export function resolveTrackDef(def, all = {}) {
  if (def._resolved) return def;
  let d = structuredClone(def);
  if (d.remixOf) {
    const base = all[d.remixOf];
    if (!base) throw new Error(`remix ${d.id}: base track ${d.remixOf} missing`);
    const b = resolveTrackDef(base, all);
    const keep = { ...d };
    d = structuredClone(b);
    d.id = keep.id; d.name = keep.name; d.cup = keep.cup; d.order = keep.order;
    if (keep.reverse) d = reverseDef(d);
    for (const [k, v] of Object.entries(keep)) {
      if (['remixOf', 'reverse', 'look', 'id', 'name', 'cup', 'order'].includes(k)) continue;
      d[k] = v;
    }
    d.look = { ...(b.look || {}), ...(keep.look || {}) };
    d.remixOf = keep.remixOf;
    d._resolved = true;
    return d;
  }
  if (d.path && !d.points) {
    const r = pathToPoints(d.path, d.pathStart);
    d.points = r.points;
    d._pathInfo = { cmdS: r.cmdS, total: r.total, closeErr: r.closeErr };
    const { cmdS, total } = r;
    for (const key of ['pads', 'itemRows', 'coins', 'ramps', 'hazards', 'landmarks', 'sections']) for (const o of d[key] || []) if (!o.ribbon) resolveRefs(o, cmdS, total);
    if (d.treasure && !d.treasure.ribbon) resolveRefs(d.treasure, cmdS, total);
    for (const b of d.branches || []) resolveRefs(b, cmdS, total);
    if (typeof d.start === 'string') d.start = refToT(d.start, cmdS, total);
  }
  if (d.branches?.some((b) => !b.points)) {
    const line = centreLine(d);
    for (const b of d.branches) if (!b.points) b.points = chordBranch(line, b);
  }
  d._resolved = true;
  return d;
}

export function resolveAllTracks(tracks) {
  const out = {};
  for (const [id, def] of Object.entries(tracks)) {
    try { out[id] = resolveTrackDef(def, tracks); } catch (e) { console.error(`[tracks] ${id}:`, e.message); }
  }
  return out;
}
