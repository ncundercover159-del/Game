// Centripetal Catmull-Rom spline + arc-length resampling (no Three.js needed).

function tj(ti, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  return ti + Math.pow(Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-4, 0.5);
}

// Point on the centripetal Catmull-Rom segment between p1 and p2, u in [0,1].
export function catmull(p0, p1, p2, p3, u, out = [0, 0, 0]) {
  const t0 = 0;
  const t1 = tj(t0, p0, p1);
  const t2 = tj(t1, p1, p2);
  const t3 = tj(t2, p2, p3);
  const t = t1 + (t2 - t1) * u;
  for (let k = 0; k < 3; k++) {
    const a1 = ((t1 - t) / (t1 - t0)) * p0[k] + ((t - t0) / (t1 - t0)) * p1[k];
    const a2 = ((t2 - t) / (t2 - t1)) * p1[k] + ((t - t1) / (t2 - t1)) * p2[k];
    const a3 = ((t3 - t) / (t3 - t2)) * p2[k] + ((t - t2) / (t3 - t2)) * p3[k];
    const b1 = ((t2 - t) / (t2 - t0)) * a1 + ((t - t0) / (t2 - t0)) * a2;
    const b2 = ((t3 - t) / (t3 - t1)) * a2 + ((t - t1) / (t3 - t1)) * a3;
    out[k] = ((t2 - t) / (t2 - t1)) * b1 + ((t - t1) / (t2 - t1)) * b2;
  }
  return out;
}

// Densely evaluate a spline through `pts` (arrays [x,y,z]); returns
// { pos: [[x,y,z]...], seg: [segmentIndex...], u: [...] , len: [...cumulative] }
export function denseSpline(pts, closed, perSeg = 24) {
  const n = pts.length;
  const pos = [], seg = [], us = [], len = [];
  const get = (i) => {
    if (closed) return pts[((i % n) + n) % n];
    if (i < 0) return extrapolate(pts[0], pts[1]);
    if (i >= n) return extrapolate(pts[n - 1], pts[n - 2]);
    return pts[i];
  };
  const segs = closed ? n : n - 1;
  let total = 0;
  let prev = null;
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < perSeg; j++) {
      const u = j / perSeg;
      const p = catmull(get(i - 1), get(i), get(i + 1), get(i + 2), u);
      if (prev) total += Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]);
      pos.push(p); seg.push(i); us.push(u); len.push(total);
      prev = p;
    }
  }
  // closing point
  const last = closed ? get(0) : get(n - 1);
  total += Math.hypot(last[0] - prev[0], last[1] - prev[1], last[2] - prev[2]);
  pos.push([...last]); seg.push(closed ? 0 : n - 2); us.push(closed ? 0 : 1); len.push(total);
  return { pos, seg, u: us, len, total };
}

function extrapolate(a, b) {
  return [a[0] * 2 - b[0], a[1] * 2 - b[1], a[2] * 2 - b[2]];
}

// Resample a dense polyline at uniform arc length spacing `ds`.
// Returns arrays of positions and the (segment, u) parameters for attribute interpolation.
export function resample(dense, ds, closed, nSeg) {
  const count = closed ? Math.max(8, Math.round(dense.total / ds)) : Math.max(2, Math.round(dense.total / ds) + 1);
  const step = dense.total / (closed ? count : count - 1);
  const out = [];
  let j = 0;
  for (let i = 0; i < count; i++) {
    const s = i * step;
    while (j < dense.len.length - 2 && dense.len[j + 1] < s) j++;
    const l0 = dense.len[j], l1 = dense.len[j + 1];
    const f = l1 > l0 ? (s - l0) / (l1 - l0) : 0;
    const a = dense.pos[j], b = dense.pos[j + 1];
    // parameter along control segments for attribute interpolation
    const segA = dense.seg[j] + dense.u[j];
    let segB = dense.seg[j + 1] + dense.u[j + 1];
    if (segB < segA) segB += nSeg; // wrap guard (closed)
    out.push({
      p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f],
      param: segA + (segB - segA) * f,
      s,
    });
  }
  return { samples: out, step, total: dense.total };
}
