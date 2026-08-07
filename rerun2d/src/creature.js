// THE LUMPS — one specimen, drawn from directly above.
//
// A pear-shaped blob with too many legs, a googly cluster of eyes that migrates
// around to face wherever it is going, a permanently astonished mouth, and an
// antenna with no self-control. Nothing about it is human, which is the point:
// from overhead a person is a disc with shoulders, and a Lump is a Lump.
//
// Every bit of it animates off the recorded transform — position, height,
// grounded, dead — plus cumulative distance travelled, which drives the scuttle
// so the legs match the ground instead of skating. No animation data is stored,
// transmitted or authored anywhere; it all falls out of the tape.
//
// Two frames are in play, and mixing them up is the easy mistake:
//   * the BODY frame is rotated to the heading — legs, blob, tail live there;
//   * the SCREEN frame is not — the antenna, eyes and mouth stick up out of the
//     page, and things that stick up project along the screen's vertical.

const TAU = Math.PI * 2;

// Body radius in metres. The collision cylinder is 0.38, and the Lump sits just
// inside it so it never visibly clips a wall it is resting against.
export const BODY_R = 0.345;

/** Per-specimen animation memory. The tape has no state; this is where it goes. */
export function makeMem(seed) {
  return {
    h: Math.PI / 2,       // heading, held while stationary
    squash: 0,            // landing impulse, decays
    air: false,
    hurt: 0,              // knife recoil
    seed: seed || Math.random() * 100,
  };
}

/**
 * Work out how one specimen looks this frame.
 *
 * `s` is a sample (or a live player) with vx/vz/vy/grounded/dead/dist.
 * `mem` is its animation memory, mutated in place.
 */
export function poseOf(s, dt, t, mem) {
  const vx = s.vx || 0;
  const vz = s.vz || 0;
  const vy = s.vy || 0;
  const seed = mem.seed;
  const dead = !!s.dead;
  const speed = Math.hypot(vx, vz);
  const moving = Math.min(1, speed / 3.6);
  const air = !dead && s.grounded === false;

  // Heading holds when stationary — a Lump that stops does not snap to east —
  // and eases round when it changes, so corners are a turn and not a cut.
  if (speed > 0.4 && !dead) {
    let d = Math.atan2(vz, vx) - mem.h;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    mem.h += d * Math.min(1, dt * 11);
  }

  // Landing squash: caught on the transition, then decayed. Cheap, and it is
  // most of what makes a jump feel like it had weight.
  if (mem.air && !air) mem.squash = 1;
  mem.air = air;
  if (mem.squash > 0) mem.squash = Math.max(0, mem.squash - dt * 5.2);
  if (mem.hurt > 0) mem.hurt = Math.max(0, mem.hurt - dt * 2.4);
  const sq = mem.squash * mem.squash;

  // Idle breathing, plus a faster jelly wobble while scuttling.
  const wob = Math.sin(t * 2.1 + seed) * 0.036 + Math.sin(t * 5.4 + seed * 2) * 0.022 * moving;

  // Rising pinches it thin, falling and landing splat it wide.
  const rise = Math.max(-1, Math.min(1, vy / 7));
  const pinch = air ? rise * 0.13 : 0;
  const lean = moving * 0.22;
  const flat = dead ? 0.34 : 0;

  return {
    dead, air, moving, speed,
    h: mem.h,
    along: BODY_R * (1 + wob + lean - pinch + sq * 0.30 + flat),
    across: BODY_R * (1 + wob - lean * 0.42 - pinch + sq * 0.34 + flat),
    legPhase: (s.dist || 0) * 7.2 + seed,
    blink: blinkAt(t, seed),
    squash: mem.squash,
    hurt: mem.hurt,
    vx, vz, seed,
  };
}

/** Blinks are rare, quick, and deliberately out of step between specimens. */
function blinkAt(t, seed) {
  const period = 3.1 + (seed % 1) * 2.6;
  let p = (t + seed * 7) % period;
  if (p < 0) p += period;
  return p < 0.12 ? 1 - Math.abs(p - 0.06) / 0.06 : 0;
}

/**
 * Draw one Lump.
 *
 * (cx, cy) is where the body sits — the caller has already lifted it by its
 * height — and `ground` is the screen y of its shadow. The gap between them is
 * what sells "off the floor", so both are needed. `S` is pixels per metre.
 */
export function drawLump(c, cx, cy, ground, S, pose, st) {
  const R = S * (st.scale || 1);
  const A = pose.along * R;
  const B = pose.across * R;
  const lw = st.lineWidth || Math.max(0.9, R * 0.052);
  const legs = legCount(st.gen);

  c.globalAlpha = st.alpha;
  c.lineCap = 'round';
  c.lineJoin = 'round';

  // ---- shadow: with no horizon, this is the entire height cue ------------
  if (ground !== null) {
    const lift = Math.max(0, ground - cy);
    const k = 1 / (1 + lift / (R * 1.5));
    c.fillStyle = st.shadow;
    c.globalAlpha = st.alpha * 0.40 * k;
    c.beginPath();
    c.ellipse(cx, ground, A * k * 1.05, A * k * 0.62, 0, 0, TAU);
    c.fill();
    c.globalAlpha = st.alpha;
  }

  // ---- everything that lies flat on the specimen, in the body frame ------
  c.save();
  c.translate(cx, cy);
  c.rotate(pose.h);

  legRing(c, legs, A, B, R, pose, st.ink, lw);
  tail(c, A, R, pose, st.ink, lw);

  c.fillStyle = st.fill;
  c.strokeStyle = st.ink;
  c.lineWidth = lw * 2.2;
  c.beginPath();
  blobPath(c, A, B, pose, st.gen);
  c.fill();
  c.stroke();

  // A belly patch, offset back and to one side so the specimen is never quite
  // symmetrical.
  c.globalAlpha = st.alpha * 0.42;
  c.fillStyle = st.fillDark;
  c.beginPath();
  c.ellipse(-A * 0.30, B * 0.16, A * 0.34, B * 0.30, 0.3, 0, TAU);
  c.fill();
  c.globalAlpha = st.alpha;

  c.restore();

  // ---- everything that sticks up out of the page, in the screen frame ----
  const fx = Math.cos(pose.h), fy = Math.sin(pose.h);

  if (st.gen >= 15) {
    // A second one, from fifteen. It does not help.
    antenna(c, cx - fy * A * 0.34, cy + fx * A * 0.34, fx, fy, A, R, pose, st, lw, 1.6);
    antenna(c, cx + fy * A * 0.34, cy - fx * A * 0.34, fx, fy, A, R, pose, st, lw, -1.1);
  } else {
    antenna(c, cx, cy, fx, fy, A, R, pose, st, lw, 0);
  }
  if (st.gen >= 3) hat(c, cx - fx * A * 0.52, cy - fy * B * 0.52, R, pose, st, lw);

  const n = eyeCount(st.gen);
  const er = R * (n === 1 ? 0.235 : n === 2 ? 0.175 : 0.145);
  const ecx = cx + fx * A * 0.34;
  const ecy = cy + fy * B * 0.34 - R * 0.05;
  for (let i = 0; i < n; i++) {
    const o = n === 1 ? 0 : (i - (n - 1) / 2) * er * 1.85;
    // Eyes spread across the heading, not along it.
    eye(c, ecx - fy * o, ecy + fx * o - Math.abs(o) * 0.22, er, pose, st, i);
  }
  if (!pose.dead) mouth(c, cx + fx * A * 0.72, cy + fy * B * 0.72, R, pose, st, lw);

  c.globalAlpha = 1;
}

// --------------------------------------------------------------------- legs --
/**
 * Legs live along the flanks, in two alternating groups, so it scuttles like
 * something that has been under a rock rather than marching like a soldier.
 */
function legRing(c, legs, A, B, R, pose, ink, lw) {
  const half = Math.ceil(legs / 2);
  c.strokeStyle = ink;
  c.lineWidth = lw * 1.7;
  c.beginPath();
  for (let i = 0; i < legs; i++) {
    const side = i % 2 ? 1 : -1;
    const k = (i / 2) | 0;
    const u = (k + 0.5) / half;
    const ang = side * (Math.PI * 0.20 + u * Math.PI * 0.58);

    const ph = pose.legPhase + k * 1.05 + (side > 0 ? Math.PI : 0);
    let swing = 0, ext = 1;
    if (pose.dead) {
      ext = 1.55 + Math.sin(k * 2.7 + side) * 0.25; // splayed, and done
      swing = Math.sin(k * 1.9) * 0.3;
    } else if (pose.air) {
      ext = 0.5;                                     // tucked
      swing = Math.sin(pose.legPhase * 0.4 + k) * 0.12;
    } else {
      const drive = 0.22 + pose.moving;
      swing = Math.sin(ph) * 0.46 * drive;
      ext = 1 + Math.cos(ph) * 0.22 * drive;
    }

    const hx = Math.cos(ang) * A * 0.84;
    const hy = Math.sin(ang) * B * 0.84;
    const fx = hx + Math.cos(ang) * R * 0.30 * ext + swing * R * 0.26;
    const fy = hy + Math.sin(ang) * R * 0.30 * ext;
    // A knee, so each leg has an elbow of personality instead of being a spoke.
    const kx = (hx + fx) / 2 - Math.sin(ang) * side * R * 0.11;
    const ky = (hy + fy) / 2 + Math.cos(ang) * side * R * 0.11;
    c.moveTo(hx, hy);
    c.quadraticCurveTo(kx, ky, fx, fy);
  }
  c.stroke();
}

/** Three stubby tufts off the back, wagging a beat behind the legs. */
function tail(c, A, R, pose, ink, lw) {
  if (pose.dead) return;
  c.strokeStyle = ink;
  c.lineWidth = lw * 1.5;
  c.beginPath();
  for (let i = -1; i <= 1; i++) {
    const wag = Math.sin(pose.legPhase * 0.5 + i) * 0.32 * (0.3 + pose.moving);
    const a = Math.PI + i * 0.34 + wag;
    c.moveTo(-A * 0.86, i * R * 0.07);
    c.lineTo(-A * 0.86 + Math.cos(a) * R * 0.24, i * R * 0.07 + Math.sin(a) * R * 0.24);
  }
  c.stroke();
}

// --------------------------------------------------------------------- body --
/**
 * A pear, heavier at the back, dented by low-frequency lumps that crawl round
 * it as the specimen walks. Drawn through midpoints so it stays a blob and
 * never a polygon.
 */
function blobPath(c, A, B, pose, gen) {
  const N = 18;
  const lumpiness = 0.055 + Math.min(0.075, gen * 0.005);
  const px = new Array(N), py = new Array(N);
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    const pear = 1 - Math.cos(a) * 0.13;
    const bump = 1 + Math.sin(a * 3 + pose.legPhase * 0.22 + pose.seed) * lumpiness
      + Math.sin(a * 5 - pose.seed) * lumpiness * 0.5;
    px[i] = Math.cos(a) * A * pear * bump;
    py[i] = Math.sin(a) * B * pear * bump;
  }
  c.moveTo((px[N - 1] + px[0]) / 2, (py[N - 1] + py[0]) / 2);
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    c.quadraticCurveTo(px[i], py[i], (px[i] + px[j]) / 2, (py[i] + py[j]) / 2);
  }
  c.closePath();
}

// ------------------------------------------------------------------ fittings --
/** A spring with no damping to speak of, whipping opposite to the scuttle. */
function antenna(c, cx, cy, fx, fy, A, R, pose, st, lw, bend) {
  const bx = cx - fx * A * 0.34;
  const by = cy - fy * A * 0.34;
  const droop = pose.dead ? 0.18 : 0.66 + pose.squash * 0.3;
  const whipX = -pose.vx * 0.075 + Math.sin(pose.legPhase * 0.45 + (bend || 0)) * 0.11 + (bend || 0) * 0.09;
  const whipY = -pose.vz * 0.05;
  const tx = bx + whipX * R;
  const ty = by - R * droop + whipY * R;

  c.strokeStyle = st.ink;
  c.lineWidth = lw * 1.6;
  c.beginPath();
  c.moveTo(bx, by);
  c.quadraticCurveTo(bx + whipX * R * 0.35, (by + ty) / 2, tx, ty);
  c.stroke();
  c.fillStyle = st.ink;
  c.beginPath();
  c.arc(tx, ty, R * 0.062, 0, TAU);
  c.fill();
}

/** The eye. The pupil lags behind the body, which is most of the personality. */
function eye(c, ex, ey, r, pose, st, idx) {
  if (pose.dead) {
    c.strokeStyle = st.ink;
    c.lineWidth = (st.lineWidth || r * 0.2) * 2.2;
    const k = r * 0.72;
    c.beginPath();
    c.moveTo(ex - k, ey - k); c.lineTo(ex + k, ey + k);
    c.moveTo(ex + k, ey - k); c.lineTo(ex - k, ey + k);
    c.stroke();
    return;
  }

  const lid = 1 - pose.blink;
  const clamp = (v) => (v < -1 ? -1 : v > 1 ? 1 : v);
  const px = clamp(-pose.vx * 0.34) * r * 0.32;
  const py = clamp(-pose.vz * 0.34) * r * 0.32;
  const startle = 1 + pose.hurt * 0.55 + pose.squash * 0.2;

  c.fillStyle = st.sclera;
  c.strokeStyle = st.ink;
  c.lineWidth = (st.lineWidth || r * 0.16) * 1.7;
  c.beginPath();
  c.ellipse(ex, ey, r * startle, r * startle * Math.max(0.07, lid), 0, 0, TAU);
  c.fill();
  c.stroke();

  if (lid > 0.34) {
    const pr = r * (pose.hurt > 0.2 ? 0.24 : 0.44);
    c.fillStyle = st.ink;
    c.beginPath();
    c.ellipse(ex + px, ey + py, pr, pr * lid, 0, 0, TAU);
    c.fill();
    // A glint, always top-left, because that is where the lamp is.
    c.fillStyle = st.sclera;
    c.beginPath();
    c.arc(ex + px - pr * 0.42, ey + py - pr * 0.42 * lid, pr * 0.34, 0, TAU);
    c.fill();
  }
  void idx;
}

/** Permanently astonished. Opens wider the faster it goes. */
function mouth(c, mx, my, R, pose, st, lw) {
  const open = 0.30 + pose.moving * 0.34 + pose.hurt * 0.5 + pose.squash * 0.25;
  c.fillStyle = st.ink;
  c.strokeStyle = st.ink;
  c.lineWidth = lw;
  c.beginPath();
  c.ellipse(mx, my, R * 0.085 * (1 + open * 0.3), R * 0.085 * open * 1.7, pose.h, 0, TAU);
  c.fill();
}

/**
 * Party hat at three, and it does not stop growing. Worn on the back of the
 * head so it never covers the eyes, which from directly overhead it otherwise
 * absolutely would.
 */
function hat(c, cx, cy, R, pose, st, lw) {
  const gen = st.gen;
  const grow = gen >= 6 ? Math.min(1.75, 1 + (gen - 6) * 0.05) : 1;
  const w = R * 0.17 * grow;
  const h = R * (pose.dead ? 0.16 : 0.33) * grow;
  const top = cy - R * 0.06;
  c.fillStyle = st.hat;
  c.strokeStyle = st.ink;
  c.lineWidth = lw * 1.8;
  c.beginPath();
  c.moveTo(cx - w, top);
  c.lineTo(cx + (pose.dead ? w * 1.6 : 0), top - h);
  c.lineTo(cx + w, top);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = st.ink;
  c.beginPath();
  c.arc(cx + (pose.dead ? w * 1.6 : 0), top - h, R * 0.06 * Math.min(1.7, grow), 0, TAU);
  c.fill();
}

// ---------------------------------------------------------------- escalation --
// Later generations are not just older, they are further gone. Legs and eyes
// accrue, the hat grows, the lumps get lumpier. By generation twenty a Lump is
// a ten-legged three-eyed thing in a conical hat and nobody decided that on
// purpose; it just kept happening.
// Five leg tiers and four eye tiers, spaced so something still changes in the
// last third of a match: 5, 9, 13 and 17 add a pair of legs, 4, 12 and 18 add
// an eye, 15 adds a second antenna, and the hat never stops.
export function legCount(gen) {
  return 4 + 2 * Math.min(4, Math.max(0, gen - 1) / 4 | 0);
}
export function eyeCount(gen) {
  return gen >= 18 ? 4 : gen >= 12 ? 3 : gen >= 4 ? 2 : 1;
}
