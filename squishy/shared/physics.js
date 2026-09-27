// Deterministic squishy movement, shared by the authoritative server and the
// client's prediction of its own squishy. Keep this free of any DOM / Node APIs.

import {
  ZONES, TERRACE, POND, POND_RESPAWN, GATES, GATE_IDS, GATE_DEPTH, SQUEEZE, STONES,
  STONE_DOWN, STONE_UP, STAIRS, SHRINE, FOREST_TRUNKS, GROVE_STALKS, LANTERNS_POND,
  LANTERNS_APPROACH, LANTERNS_COURT, KOMAINU, TORII, POLES, halfWidthAt,
} from './level.js';

export const DT = 1 / 60;
export const P = {
  R: 0.45,        // body radius
  H: 0.9,         // standing height
  HS: 0.26,       // squished height
  SPEED: 4.4,
  SQ_SPEED: 2.6,
  ACC: 14,
  AIR_ACC: 5,
  G: 24,
  STEP: 0.45,     // max ledge height we roll up without help
  SPRING_V: 11.2, // launch speed off a squished partner
  SQ_MIN: 0.4,    // a tap squishes for at least this long
  KILL_Y: -0.65,
};

export const EV = { LAND: 1, SPRING: 2, BUMP: 4, SPLASH: 8, SQUISH: 16 };

export function newPlayer(x, z, y = 0) {
  return { x, y, z, vx: 0, vy: 0, vz: 0, yaw: 0, g: 1, sq: 0, act: 0, sqd: 0, ev: 0, bx: 0, bz: 0, land: 0 };
}

export function copyPlayer(dst, src) {
  dst.x = src.x; dst.y = src.y; dst.z = src.z;
  dst.vx = src.vx; dst.vy = src.vy; dst.vz = src.vz;
  dst.yaw = src.yaw; dst.g = src.g; dst.sq = src.sq; dst.act = src.act; dst.sqd = src.sqd;
  return dst;
}

// ---- colliders ---------------------------------------------------------------

const box = (x0, x1, y0, y1, z0, z1) => ({ x0, x1, y0, y1, z0, z1 });
const pillar = (x, z, r, y0, y1) => ({ x, z, r, y0, y1 });

function buildStatic() {
  const boxes = [];
  const pillars = [];
  for (const zn of ZONES) {
    boxes.push(box(-zn.hw - 4, -zn.hw, -3, 9, zn.z0 - 0.01, zn.z1 + 0.01));
    boxes.push(box(zn.hw, zn.hw + 4, -3, 9, zn.z0 - 0.01, zn.z1 + 0.01));
  }
  boxes.push(box(-20, 20, -3, 9, -8, ZONES[0].z0));
  boxes.push(box(-20, 20, -3, 9, 206, 212));
  boxes.push(box(-16, 16, -3, TERRACE.h, TERRACE.z0, 212));

  for (const id of GATE_IDS) {
    const g = GATES[id];
    const hw = halfWidthAt(g.z);
    const z0 = g.z - GATE_DEPTH / 2, z1 = g.z + GATE_DEPTH / 2;
    boxes.push(box(-hw, -g.dw, g.y - 1, 9, z0, z1));
    boxes.push(box(g.dw, hw, g.y - 1, 9, z0, z1));
  }

  const sqHw = halfWidthAt(SQUEEZE.z0);
  boxes.push(box(-sqHw, SQUEEZE.x0, -1, 9, SQUEEZE.z0, SQUEEZE.z1));
  boxes.push(box(SQUEEZE.x1, sqHw, -1, 9, SQUEEZE.z0, SQUEEZE.z1));
  boxes.push(box(SQUEEZE.x0, SQUEEZE.x1, SQUEEZE.clear, 9, SQUEEZE.z0, SQUEEZE.z1));

  boxes.push(box(SHRINE.x0, SHRINE.x1, TERRACE.h - 1, 9, SHRINE.z0, SHRINE.z1));

  for (const t of FOREST_TRUNKS) pillars.push(pillar(t.x, t.z, t.r, -1, 9));
  for (const s of GROVE_STALKS) pillars.push(pillar(s.x, s.z, s.r, -1, 9));
  for (const l of LANTERNS_POND) pillars.push(pillar(l.x, l.z, 0.42, -1, 2.3));
  for (const l of LANTERNS_APPROACH) pillars.push(pillar(l.x, l.z, 0.42, l.z > TERRACE.z0 ? TERRACE.h : -1, (l.z > TERRACE.z0 ? TERRACE.h : 0) + 2.3));
  for (const l of LANTERNS_COURT) pillars.push(pillar(l.x, l.z, 0.42, TERRACE.h - 1, TERRACE.h + 2.3));
  for (const l of POLES) pillars.push(pillar(l.x, l.z, 0.14, TERRACE.h - 1, 9));
  for (const k of KOMAINU) pillars.push(pillar(k.x, k.z, 0.8, TERRACE.h - 1, TERRACE.h + 2.2));
  pillars.push(pillar(-TORII.halfSpan, TORII.z, 0.36, TERRACE.h - 1, 9));
  pillars.push(pillar(TORII.halfSpan, TORII.z, 0.36, TERRACE.h - 1, 9));

  for (const b of boxes) { b.zl = b.z0; b.zh = b.z1; }
  for (const p of pillars) { p.zl = p.z - p.r; p.zh = p.z + p.r; }
  return { boxes, pillars };
}

export const STATIC = buildStatic();

// Dynamic world state `w`: { open: {gateId: 0..1}, stairs: 0..1, stones: 0..1 }
export function newWorld() {
  const open = {};
  for (const id of GATE_IDS) open[id] = 0;
  return { open, stairs: 0, stones: 0 };
}

export function stoneTop(stones) {
  return STONE_DOWN + (STONE_UP - STONE_DOWN) * stones;
}

export function buildColliders(w) {
  const boxes = STATIC.boxes.slice();
  const pillars = STATIC.pillars.slice();
  for (const id of GATE_IDS) {
    if (w.open[id] >= 0.6) continue;
    const g = GATES[id];
    const b = box(-g.dw, g.dw, g.y - 1, 9, g.z - GATE_DEPTH / 2, g.z + GATE_DEPTH / 2);
    b.zl = b.z0; b.zh = b.z1;
    boxes.push(b);
  }
  if (w.stairs > 0.02) {
    const d = (STAIRS.z1 - STAIRS.z0) / STAIRS.n;
    for (let i = 0; i < STAIRS.n; i++) {
      const top = ((i + 1) / STAIRS.n) * TERRACE.h * w.stairs;
      const b = box(STAIRS.x0, STAIRS.x1, -1, top, STAIRS.z0 + i * d, STAIRS.z1);
      b.zl = b.z0; b.zh = b.z1;
      boxes.push(b);
    }
  }
  const top = stoneTop(w.stones);
  for (const s of STONES) {
    const p = pillar(s.x, s.z, s.r, -3, top);
    p.zl = s.z - s.r; p.zh = s.z + s.r;
    pillars.push(p);
  }
  return { boxes, pillars };
}

// ---- queries -----------------------------------------------------------------

function inPondHole(x, z) {
  const m = P.R * 0.6; // lean out over the water a little before falling in
  return x > POND.x0 + m && x < POND.x1 - m && z > POND.z0 + m && z < POND.z1 - m;
}

function circleRect(px, pz, b) {
  const cx = px < b.x0 ? b.x0 : px > b.x1 ? b.x1 : px;
  const cz = pz < b.z0 ? b.z0 : pz > b.z1 ? b.z1 : pz;
  const dx = px - cx, dz = pz - cz;
  return dx * dx + dz * dz;
}

// Highest walkable surface beneath the squishy that is no higher than
// prevY + a hair. Surfaces level with where we stand use (almost) the full body
// radius so we roll cleanly over steps and off ledges; lower ones need the
// centre to be over them before we drop onto them.
function supportAt(p, col, prevY) {
  const maxTop = prevY + 0.06;
  let best = inPondHole(p.x, p.z) ? -Infinity : 0;
  for (const b of col.boxes) {
    if (b.zh < p.z - 1 || b.zl > p.z + 1) continue;
    if (b.y1 > maxTop || b.y1 <= best) continue;
    const rr = b.y1 >= prevY - 0.08 ? P.R * 0.95 : P.R * 0.55;
    if (circleRect(p.x, p.z, b) < rr * rr) best = b.y1;
  }
  for (const c of col.pillars) {
    if (c.zh < p.z - 1.5 || c.zl > p.z + 1.5) continue;
    if (c.y1 > maxTop || c.y1 <= best) continue;
    const dx = p.x - c.x, dz = p.z - c.z;
    const r = c.r + (c.y1 >= prevY - 0.08 ? P.R * 0.95 : P.R * 0.35);
    if (dx * dx + dz * dz < r * r) best = c.y1;
  }
  return best;
}

// Lowest ceiling between feet and `h` above them (for un-squishing and heads).
function ceilingAt(p, col, y, h) {
  let best = Infinity;
  for (const b of col.boxes) {
    if (b.zh < p.z - 1 || b.zl > p.z + 1) continue;
    if (b.y0 < y + 0.05 || b.y0 >= y + h || b.y0 >= best) continue;
    if (circleRect(p.x, p.z, b) < P.R * P.R * 0.8) best = b.y0;
  }
  return best;
}

function resolveHorizontal(p, col, h, others, half) {
  for (let pass = 0; pass < 2; pass++) {
    for (const b of col.boxes) {
      if (b.zh < p.z - 1 || b.zl > p.z + 1) continue;
      if (b.y1 <= p.y + 0.01 || b.y0 >= p.y + h) continue;
      const cx = p.x < b.x0 ? b.x0 : p.x > b.x1 ? b.x1 : p.x;
      const cz = p.z < b.z0 ? b.z0 : p.z > b.z1 ? b.z1 : p.z;
      let dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= P.R * P.R) continue;
      const rise = b.y1 - p.y;
      if (rise <= P.STEP && (p.g || p.vy <= 0) && ceilingAt(p, col, b.y1, h) === Infinity) {
        p.y = b.y1;
        continue;
      }
      let nx, nz, push;
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2);
        nx = dx / d; nz = dz / d; push = P.R - d;
      } else {
        // centre is inside the box: leave along the shallowest axis
        const l = p.x - b.x0, r = b.x1 - p.x, n = p.z - b.z0, f = b.z1 - p.z;
        const m = Math.min(l, r, n, f);
        if (m === l) { nx = -1; nz = 0; push = l + P.R; }
        else if (m === r) { nx = 1; nz = 0; push = r + P.R; }
        else if (m === n) { nx = 0; nz = -1; push = n + P.R; }
        else { nx = 0; nz = 1; push = f + P.R; }
      }
      contact(p, nx, nz, push);
    }
    for (const c of col.pillars) {
      if (c.zh < p.z - 1 || c.zl > p.z + 1) continue;
      if (c.y1 <= p.y + 0.01 || c.y0 >= p.y + h) continue;
      let dx = p.x - c.x, dz = p.z - c.z;
      const rr = c.r + P.R;
      const d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr) continue;
      if (c.y1 - p.y <= P.STEP && (p.g || p.vy <= 0)) { p.y = c.y1; continue; }
      const d = Math.sqrt(d2) || 1e-5;
      if (d2 < 1e-10) { dx = 1; dz = 0; }
      contact(p, dx / d, dz / d, rr - d);
    }
  }

  // Other squishies. A squished partner is a springboard.
  for (const o of others) {
    const dx = p.x - o.x, dz = p.z - o.z;
    const d2 = dx * dx + dz * dz;
    const rr = P.R * 2;
    if (d2 >= rr * rr) continue;
    const oh = o.sqd ? P.HS : P.H;
    if (o.sqd && !p.sqd) {
      const top = o.y + oh;
      if (p.y >= top - P.STEP && p.y <= top + 0.35 && p.vy <= 0.5) {
        if (d2 < rr * rr * 0.6) {
          p.y = top;
          p.vy = P.SPRING_V;
          p.g = 0;
          p.ev |= EV.SPRING;
        }
        continue;
      }
    }
    if (p.sqd && !o.sqd) continue; // being bounced on: stay put
    if (p.y >= o.y + oh || p.y + h <= o.y) continue;
    const d = Math.sqrt(d2) || 1e-5;
    const nx = d2 < 1e-10 ? 1 : dx / d, nz = d2 < 1e-10 ? 0 : dz / d;
    contact(p, nx, nz, (rr - d) * half);
  }
}

function contact(p, nx, nz, push) {
  p.x += nx * push;
  p.z += nz * push;
  const vn = p.vx * nx + p.vz * nz;
  if (vn < 0) {
    p.vx -= vn * nx;
    p.vz -= vn * nz;
    if (vn < -1.6) { p.ev |= EV.BUMP; p.bx = nx; p.bz = nz; }
  }
}

// ---- step ----------------------------------------------------------------------

// cmd: { jx, jz, act } in world axes; `others`: states of the other squishies.
// `half`: share of player-player overlap this player resolves (0.5 on the
// server where both are simulated, same on the client for its own prediction).
export function stepPlayer(p, cmd, col, others, dt = DT, half = 0.5) {
  p.ev = 0;
  let jx = cmd.jx || 0, jz = cmd.jz || 0;
  const m = Math.hypot(jx, jz);
  if (m > 1) { jx /= m; jz /= m; }
  const act = cmd.act ? 1 : 0;
  if (act && !p.act) { p.sq = P.SQ_MIN; p.ev |= EV.SQUISH; }
  p.act = act;
  if (p.sq > 0) p.sq = Math.max(0, p.sq - dt);

  let squished = act || p.sq > 0;
  if (!squished && p.sqd && ceilingAt(p, col, p.y, P.H) !== Infinity) squished = true;
  p.sqd = squished ? 1 : 0;
  const h = squished ? P.HS : P.H;

  const speed = squished ? P.SQ_SPEED : P.SPEED;
  const k = Math.min(1, (p.g ? P.ACC : P.AIR_ACC) * dt);
  p.vx += (jx * speed - p.vx) * k;
  p.vz += (jz * speed - p.vz) * k;
  if (m > 0.15) p.yaw = Math.atan2(jx, jz);

  p.x += p.vx * dt;
  p.z += p.vz * dt;
  resolveHorizontal(p, col, h, others, half);

  const prevY = p.y;
  p.vy = Math.max(-30, p.vy - P.G * dt);
  p.y += p.vy * dt;
  if (p.vy > 0) {
    const c = ceilingAt(p, col, prevY, h + p.vy * dt + 0.01);
    if (p.y + h > c) { p.y = c - h; p.vy = 0; }
  }
  const sup = supportAt(p, col, prevY);
  if (p.y <= sup) {
    if (!p.g && p.vy < -3) { p.ev |= EV.LAND; p.land = -p.vy; }
    p.y = sup;
    p.vy = 0;
    p.g = 1;
  } else {
    p.g = 0;
  }

  if (p.y < P.KILL_Y) {
    p.ev |= EV.SPLASH;
    const far = p.z > POND_RESPAWN.split;
    p.z = far ? POND_RESPAWN.far : POND_RESPAWN.near;
    p.x = Math.max(-3, Math.min(3, p.x));
    p.y = 0; p.vx = p.vy = p.vz = 0; p.g = 1;
  }
  return p;
}

// Is a (squished) squishy on a floor switch?
export function onPlate(p, plate) {
  const dx = p.x - plate.x, dz = p.z - plate.z;
  return p.sqd && dx * dx + dz * dz < plate.r * plate.r && Math.abs(p.y - plate.y) < 0.35;
}
