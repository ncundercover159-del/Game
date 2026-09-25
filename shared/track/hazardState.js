// Themed track hazard state. Every hazard's state is a pure function of race
// time (plus the leader's lap for bridge collapses), so the server applies
// effects and clients render and predict the exact same motion without any
// extra network data. Also provides the dynamic colliders used by the probe.
//
// Types: windGust, geyser, boulder, collapse, carousel, door, fog, conveyor,
//        crusher, laser, piston, ghost
const cyc = (time, period, phase = 0) => ((((time + phase) % period) + period) % period);

// Build runtime hazard objects (world positions from track space).
export function buildHazards(world) {
  const defs = world.def.hazards || [];
  const L = world.length || 1;
  return defs.map((d, i) => {
    const h = { ...d, id: i, period: d.period ?? 6, phase: d.phase ?? i * 1.37 };
    if (d.t !== undefined && world.at) {
      const p = world.at(d.t, d.lane ?? 0, d.ribbon || 0);
      Object.assign(h, { x: p.x, y: p.y, z: p.z, yaw: p.yaw, rx: p.rx, rz: p.rz, hw: p.hw });
    }
    if (d.t0 !== undefined) { h.s0 = d.t0 * L; h.s1 = d.t1 * L; }
    if (d.type === 'boulder' && world.at) {
      h.path = [];
      for (let k = 0; k <= 24; k++) {
        const f = k / 24;
        const t = d.t0 + (d.t1 - d.t0) * f;
        const lane = (d.lane0 ?? 0) + ((d.lane1 ?? 0) - (d.lane0 ?? 0)) * f;
        h.path.push(world.at(t, lane));
      }
    }
    return h;
  });
}

// Hazard state at `time` (shared by physics and rendering).
export function hazardState(h, time, race) {
  const c = cyc(time, h.period, h.phase);
  switch (h.type) {
    case 'windGust': {
      const warn = h.warn ?? 1.2;
      return { active: c < (h.on ?? 2.5), warning: c > h.period - warn, f: c };
    }
    case 'geyser': {
      const on = h.on ?? 1.1;
      return { active: c < on, warning: c > h.period - 1.2, height: c < on ? Math.sin((c / on) * Math.PI) : 0 };
    }
    case 'boulder': {
      const dur = h.duration ?? 4;
      const f = c / dur;
      if (f > 1 || !h.path) return { active: false };
      const idx = f * (h.path.length - 1);
      const a = h.path[Math.floor(idx)], b = h.path[Math.min(h.path.length - 1, Math.floor(idx) + 1)];
      const u = idx - Math.floor(idx);
      return { active: true, x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u + (h.r ?? 2.4), z: a.z + (b.z - a.z) * u, roll: c * 3 };
    }
    case 'collapse': {
      // collapses when the leader reaches the given lap (default: final lap)
      const lap = h.lap ?? (race?.laps || 3);
      const leaderLap = race ? Math.max(...race.karts.map((k) => (k.lap || 0) + 1)) : 1;
      return { active: leaderLap >= lap };
    }
    case 'carousel': {
      return { active: true, angle: time * (h.speed ?? 0.9) + h.phase };
    }
    case 'door': {
      const open = h.open ?? 4;
      return { active: c >= open, open: c < open, f: c / h.period };
    }
    case 'crusher': {
      // up (waiting) -> slam down -> hold -> rise
      const slamAt = h.period - (h.down ?? 0.9);
      const down = c >= slamAt;
      const t = down ? (c - slamAt) / (h.down ?? 0.9) : 0;
      const hgt = down ? (t < 0.15 ? 1 - t / 0.15 : t > 0.7 ? (t - 0.7) / 0.3 : 0) : Math.min(1, c / 0.6);
      return { active: down && t < 0.7, warning: c > slamAt - 1.2 && !down, height: hgt };
    }
    case 'laser': {
      const on = h.on ?? 1.4;
      return { active: c < on, warning: c > h.period - 0.8 };
    }
    case 'piston': {
      const out = h.out ?? 1.2;
      const ext = c < out ? Math.sin((c / out) * Math.PI) : 0;
      return { active: ext > 0.2, ext };
    }
    case 'ghost': {
      const f = (Math.sin((time + h.phase) * (h.speed ?? 0.6)) + 1) / 2;
      return { active: true, lane: (h.lane0 ?? -0.8) + ((h.lane1 ?? 0.8) - (h.lane0 ?? -0.8)) * f };
    }
    default:
      return { active: true };
  }
}

// Dynamic colliders for the world probe: doors (closed) and pistons (extended)
// act as walls; collapsed bridges become holes.
export function probeDynamic(world, x, y, z, s, lateral, out, agentRadius) {
  const dyn = world.dynamic;
  if (!dyn || !dyn.length) return;
  const time = world.time || 0;
  for (const h of dyn) {
    const st = hazardState(h, time, world.hazardRace);
    if (h.type === 'collapse') {
      if (!st.active || h.s0 === undefined) continue;
      const inS = h.s1 >= h.s0 ? s >= h.s0 && s <= h.s1 : s >= h.s0 || s <= h.s1;
      const safe = h.safeLane ?? 0.25;
      if (inS && Math.abs(lateral / (h.hw || 10)) > safe) out.ground = false;
      continue;
    }
    if (h.type === 'carousel') {
      // solid hub
      const dx = x - h.x, dz = z - h.z, d = Math.hypot(dx, dz) || 1;
      const pen = (h.hub ?? 1.8) + agentRadius - d;
      if (pen > 0 && Math.abs(y - h.y) < 4 && pen > out.pen) { out.pen = pen; out.wnx = dx / d; out.wnz = dz / d; }
      continue;
    }
    if (!st.active) continue;
    // box collider across the road at the hazard point
    const w = h.type === 'piston' ? (h.hw || 10) * (h.reach ?? 0.55) * st.ext : (h.w ?? (h.hw || 5) * 2) / 2;
    const d = (h.d ?? 1.2) / 2;
    const side = h.side === 'left' ? -1 : 1;
    const cx = h.type === 'piston' ? h.x + (h.rx || 0) * side * ((h.hw || 10) + 1 - w) : h.x;
    const cz = h.type === 'piston' ? h.z + (h.rz || 0) * side * ((h.hw || 10) + 1 - w) : h.z;
    const rx = h.rx ?? 1, rz = h.rz ?? 0;
    const dx = x - cx, dz = z - cz;
    const lx = dx * rx + dz * rz;           // across the road
    const lz = dx * -rz + dz * rx;          // along the road
    const R = agentRadius;
    const px = w + R - Math.abs(lx), pz = d + R - Math.abs(lz);
    if (px > 0 && pz > 0 && Math.abs(y - h.y) < 4) {
      let nx, nz, pen;
      if (pz < px) { const sg = Math.sign(lz) || 1; nx = -rz * sg; nz = rx * sg; pen = pz; }
      else { const sg = Math.sign(lx) || 1; nx = rx * sg; nz = rz * sg; pen = px; }
      if (pen > out.pen) { out.pen = pen; out.wnx = nx; out.wnz = nz; }
    }
  }
}
